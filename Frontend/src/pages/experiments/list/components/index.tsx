import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Form, Tooltip } from 'antd';
import { getExperiments, createExperiment, getNotebooks, experimentCreatorLabel, type ExperimentSummary as APIExperiment, type NotebookResponse } from '@/utilities/chemiaApi';
import { experimentDetailPath } from '@/pages/experiments/preliminary/lib/routing';
import {
  resolveTemplateFromNotebook,
  workflowNotebookIds,
} from '@/pages/experiments/preliminary/lib/resolveTemplate';
import { firstWorkflowScreen } from '@/pages/experiments/preliminary/lib/templateTypes';
import { formatDisplayDate } from '@/pages/projects/shared/formatDate';
import sharedStyles from '@/pages/projects/shared/styles.module.less';
import {
  Table,
  Button,
  Input,
  Select,
} from 'antd';
import {
  HomeOutlined,
  SearchOutlined,
  ExportOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { Plus } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import Header from '@/common/Header';
import Sidebar from '@/common/Sidebar';
import StatusTag from '@/common/StatusTag';
import styles from './styles.module.less';

// ── View mode type ─────────────────────────────────────────────────────────────
type ViewMode = 'all' | 'ongoing' | 'submitted' | 'pending' | 'verified' | 'review';
type PendingSubFilter = 'all' | 'tome' | 'toothers';

const PENDING_SUB_OPTIONS: { value: PendingSubFilter; label: string }[] = [
  { value: 'all',      label: 'All Pending' },
  { value: 'tome',     label: 'Submitted to Me' },
  { value: 'toothers', label: 'Submitted to Others' },
];

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'all',       label: 'All Experiments' },
  { value: 'ongoing',   label: 'On-Going Experiments' },
  { value: 'submitted', label: 'Submitted Experiments' },
  { value: 'pending',   label: 'Pending for Review' },
  { value: 'verified',  label: 'Verified Experiments' },
  { value: 'review',    label: 'Review Comments' },
];

// ── Data interface ─────────────────────────────────────────────────────────────
interface Experiment {
  key: string;
  index: number;
  title: string;
  fullCode: string;
  code: string;
  version: number;
  status: 'APPROVED' | 'SUBMITTED' | 'VERIFIED' | 'DRAFT' | 'REJECTED' | 'UNLOCKED' | 'VOID';
  createdBy: string;
  notebookId: string;
  projectId: string;
  createdAt: string;
  // extra fields from previous views (kept for column compatibility)
  submittedBy: string;
  submittedTo: string;
  reqCount: number;
  verifiedBy: string;
  improvementSuggested: string;
  suggestedByOn: string;
}

// Map API response → local Experiment shape
function mapAPIExperiment(e: APIExperiment, idx: number): Experiment {
  return {
    key:                  e.id,
    index:                idx + 1,
    title:                e.title,
    fullCode:             e.full_code,
    code:                 e.base_code,
    version:              e.version,
    status:               e.status as Experiment['status'],
    createdBy:            experimentCreatorLabel(e),
    notebookId:           e.notebook_id ?? '',
    projectId:            e.project_id ?? '',
    createdAt:            e.created_at ?? '',
    submittedBy:          '—',
    submittedTo:          '—',
    reqCount:             0,
    verifiedBy:           '—',
    improvementSuggested: '—',
    suggestedByOn:        '—',
  };
}

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Approved', SUBMITTED: 'Submitted', VERIFIED: 'Verified',
  DRAFT: 'Draft', REJECTED: 'Rejected', UNLOCKED: 'Unlocked', VOID: 'Void',
};

// ── Column factory ────────────────────────────────────────────────────────────
const buildColumns = (
  view: ViewMode,
  onViewExperiment: (record: Experiment) => void,
  navigate: ReturnType<typeof useNavigate>,
  notebooksById: Record<string, NotebookResponse>,
  workflowNbs: Set<string>,
): ColumnsType<Experiment> => {
  const base: ColumnsType<Experiment> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 48 },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (val: string, record: Experiment) => (
        <Tooltip title={val}>
          <button
            type="button"
            className={styles.rowLink}
            onClick={() => navigate(experimentDetailPath(record.key, workflowNbs.has(record.notebookId)))}
          >
            {val}
          </button>
        </Tooltip>
      ),
    },
    {
      title: 'Full Code',
      dataIndex: 'fullCode',
      key: 'fullCode',
      width: 160,
      render: (val: string) => (
        <Tooltip title={val}>
          <span className={styles.codeCell}>{val}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Notebook',
      key: 'notebook',
      width: 150,
      ellipsis: true,
      render: (_: unknown, record: Experiment) => {
        const nb = notebooksById[record.notebookId];
        if (!nb) return '—';
        return (
          <Tooltip title={nb.title}>
            <button
              type="button"
              className={styles.rowLink}
              onClick={() => navigate(`/notebooks/${nb.id}/overview`)}
            >
              {nb.code}
            </button>
          </Tooltip>
        );
      },
    },
    { title: 'Version', dataIndex: 'version', key: 'version', width: 72,
      render: (v: number) => <span>{String(v).padStart(3, '0')}</span> },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (val: string) => (
        <StatusTag status={val} label={STATUS_LABEL[val]} />
      ),
    },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy' },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (val: string) => formatDisplayDate(val),
    },
  ];

  const actions: ColumnsType<Experiment> = [
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_: unknown, record: Experiment) => (
        <Tooltip title="View">
          <Button
            className={styles.viewBtn}
            icon={<EyeOutlined />}
            size="small"
            onClick={() => onViewExperiment(record)}
          />
        </Tooltip>
      ),
    },
  ];

  // Extra columns per view
  const extra: ColumnsType<Experiment> = (() => {
    switch (view) {
      case 'ongoing':
        return [
          { title: 'Submitted By', dataIndex: 'submittedBy', key: 'submittedBy',
            render: (v: string) => <span className={styles.userCell}>{v}</span> },
        ];
      case 'submitted':
        return [
          { title: 'Submitted To', dataIndex: 'submittedTo', key: 'submittedTo',
            render: (v: string) => <span className={styles.userCell}>{v}</span> },
        ];
      case 'pending':
        return [
          {
            title: 'Req. Count', dataIndex: 'reqCount', key: 'reqCount', width: 96,
            render: (v: number) => (
              <span className={`${styles.reqBadge} ${v > 0 ? styles.reqBadgeActive : ''}`}>
                {v}
              </span>
            ),
          },
          { title: 'Submitted By', dataIndex: 'submittedBy', key: 'submittedBy',
            render: (v: string) => <span className={styles.userCell}>{v}</span> },
        ];
      case 'verified':
        return [
          { title: 'Verified By', dataIndex: 'verifiedBy', key: 'verifiedBy',
            render: (v: string) => <span className={styles.userCell}>{v}</span> },
        ];
      case 'review':
        return [
          { title: 'Improvement Suggested', dataIndex: 'improvementSuggested', key: 'improvementSuggested',
            render: (v: string) => <span className={styles.commentCell}>{v}</span> },
          { title: 'Suggested By (On)', dataIndex: 'suggestedByOn', key: 'suggestedByOn',
            render: (v: string) => <span className={styles.userCell}>{v}</span> },
        ];
      default:
        return [];
    }
  })();

  return [...base, ...extra, ...actions];
};

// ── View → status filter mapping ──────────────────────────────────────────────
const VIEW_STATUS_FILTER: Partial<Record<ViewMode, Experiment['status'][]>> = {
  ongoing:   ['DRAFT'],
  submitted: ['SUBMITTED'],
  pending:   ['SUBMITTED'],
  verified:  ['VERIFIED', 'APPROVED'],
  review:    ['REJECTED'],
};

// ─────────────────────────────────────────────────────────────────────────────
const ExperimentsListPage: React.FC = () => {
  const navigate = useNavigate();

  const [allData, setAllData]               = useState<Experiment[]>([]);
  const [loading, setLoading]               = useState(false);
  const [viewMode, setViewMode]             = useState<ViewMode>('all');
  const [pendingSub, setPendingSub]         = useState<PendingSubFilter>('all');
  const [filtersOpen, setFiltersOpen]       = useState(false);
  const [filterStatus, setFilterStatus]     = useState<string | undefined>(undefined);
  const [filterNotebook, setFilterNotebook] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterApprovedBy, setFilterApprovedBy] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate]     = useState('');
  const [searchText, setSearchText]         = useState('');

  // ── New Experiment modal ─────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]       = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm]                      = Form.useForm();
  const [nbOptions, setNbOptions]           = useState<{ value: string; label: string }[]>([]);
  const [notebooks, setNotebooks]             = useState<NotebookResponse[]>([]);
  const [workflowNbs, setWorkflowNbs]         = useState<Set<string>>(new Set());

  const notebooksById = useMemo(() => {
    const map: Record<string, NotebookResponse> = {};
    for (const nb of notebooks) map[nb.id] = nb;
    return map;
  }, [notebooks]);

  const loadNotebookOptions = useCallback(() => {
    return getNotebooks({ page_size: 100 })
      .then(r => {
        setNotebooks(r.items);
        setNbOptions(r.items.map(nb => ({ value: nb.id, label: `${nb.code} — ${nb.title}` })));
        setWorkflowNbs(workflowNotebookIds(r.items));
      })
      .catch(() => {});
  }, []);

  const openCreate = () => {
    createForm.resetFields();
    if (nbOptions.length === 0) {
      void loadNotebookOptions();
    }
    setCreateOpen(true);
  };

  const handleCreate = async (values: { notebook_id: string; title: string }) => {
    setCreateLoading(true);
    try {
      let payload: Parameters<typeof createExperiment>[0] = {
        notebook_id: values.notebook_id,
        title:       values.title,
      };

      if (workflowNbs.has(values.notebook_id)) {
        const nb = notebooks.find(n => n.id === values.notebook_id);
        if (nb) {
          const resolved = await resolveTemplateFromNotebook(nb);
          const first = resolved?.definition ? firstWorkflowScreen(resolved.definition) : null;
          if (first) {
            payload = {
              ...payload,
              screen_key:  first.screenKey,
              section_key: first.sectionKey,
              data: {
                _workflow_screen:  first.screenKey,
                _workflow_section: first.sectionKey,
              },
            };
          }
        }
      }

      const exp = await createExperiment(payload);
      message.success('Experiment created');
      setCreateOpen(false);
      navigate(experimentDetailPath(exp.id, workflowNbs.has(values.notebook_id)));
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create experiment');
    } finally {
      setCreateLoading(false);
    }
  };

  const openExperiment = useCallback((record: Experiment) => {
    navigate(experimentDetailPath(record.key, workflowNbs.has(record.notebookId)));
  }, [navigate, workflowNbs]);

  const loadExperiments = () => {
    setLoading(true);
    getExperiments({ page_size: 100 })
      .then(expResp => {
        const items = expResp.items ?? [];
        setAllData(items.map(mapAPIExperiment));
      })
      .catch(() => message.error('Failed to load experiments'))
      .finally(() => setLoading(false));

    // Notebooks are loaded separately so a notebook-list error cannot hide experiments.
    void loadNotebookOptions();
  };

  // Fetch all experiments from the backend on mount
  useEffect(() => {
    loadExperiments();
  }, []);

  const handleClearFilters = () => {
    setFilterStatus(undefined);
    setFilterNotebook('');
    setFilterCreatedBy('');
    setFilterApprovedBy('');
    setFilterFromDate('');
    setFilterToDate('');
  };

  const handleViewChange = (v: ViewMode) => {
    setViewMode(v);
    if (v !== 'pending') setPendingSub('all');
  };

  const columns = useMemo(
    () => buildColumns(viewMode, openExperiment, navigate, notebooksById, workflowNbs),
    [viewMode, openExperiment, navigate, notebooksById, workflowNbs],
  );

  const filteredData = useMemo(() => {
    let data = allData;

    // Apply view-mode status filter
    const statusFilter = VIEW_STATUS_FILTER[viewMode];
    if (statusFilter) {
      data = data.filter((r) => (statusFilter as string[]).includes(r.status));
    }

    // Apply pending sub-filter (mock: "tome" = submittedTo includes current user proxy)
    if (viewMode === 'pending' && pendingSub !== 'all') {
      const ME = 'jane.smith'; // representative current-user placeholder
      if (pendingSub === 'tome') {
        data = data.filter((r) => r.submittedTo === ME);
      } else {
        data = data.filter((r) => r.submittedTo !== ME);
      }
    }

    // Apply free-text search
    if (searchText) {
      const text = searchText.toLowerCase();
      data = data.filter((r) => {
        const nb = notebooksById[r.notebookId];
        const nbText = nb ? `${nb.code} ${nb.title}`.toLowerCase() : '';
        return (
          r.title.toLowerCase().includes(text) ||
          r.fullCode.toLowerCase().includes(text) ||
          r.code.toLowerCase().includes(text) ||
          r.createdBy.toLowerCase().includes(text) ||
          nbText.includes(text)
        );
      });
    }

    return data;
  }, [allData, viewMode, pendingSub, searchText, notebooksById]);

  const activeView = VIEW_OPTIONS.find((v) => v.value === viewMode)!;

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="experiments" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
              <HomeOutlined style={{ marginRight: 4 }} />
              Home
            </span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>Experiments</span>
          </div>



          {/* Filter panel */}
          {/* <div className={styles.filterCard}>
            <div className={styles.filterToggleRow}>
              <Button
                icon={<FilterOutlined />}
                size="small"
                onClick={() => setFiltersOpen((v) => !v)}
                style={{ borderColor: '#d6d3d1', color: '#57534e' }}
              >
                Filters
              </Button>
              {filtersOpen && (
                <span style={{ fontSize: 12, color: '#a8a29e' }}>Showing filter options</span>
              )}
            </div>

            {filtersOpen && (
              <>
                <div className={styles.filterGrid}>
                  <div>
                    <div className={styles.filterLabel}>Status</div>
                    <Select
                      allowClear placeholder="All statuses"
                      value={filterStatus} onChange={(v) => setFilterStatus(v)}
                      style={{ width: '100%' }} size="small"
                    >
                      <Option value="Draft">Draft</Option>
                      <Option value="Submitted">Submitted</Option>
                      <Option value="Verified">Verified</Option>
                      <Option value="Approved">Approved</Option>
                      <Option value="Rejected">Rejected</Option>
                    </Select>
                  </div>
                  <div>
                    <div className={styles.filterLabel}>Notebook Name</div>
                    <Input placeholder="Notebook name" value={filterNotebook}
                      onChange={(e) => setFilterNotebook(e.target.value)} size="small" />
                  </div>
                  <div>
                    <div className={styles.filterLabel}>Created By</div>
                    <Input placeholder="Created by" value={filterCreatedBy}
                      onChange={(e) => setFilterCreatedBy(e.target.value)} size="small" />
                  </div>
                </div>
                <div className={styles.filterDateRow} style={{ marginTop: '0.75rem' }}>
                  <div>
                    <div className={styles.filterLabel}>Approved By</div>
                    <Input placeholder="Approved by" value={filterApprovedBy}
                      onChange={(e) => setFilterApprovedBy(e.target.value)} size="small" />
                  </div>
                  <div>
                    <div className={styles.filterLabel}>From Date</div>
                    <Input type="date" value={filterFromDate}
                      onChange={(e) => setFilterFromDate(e.target.value)} size="small" />
                  </div>
                  <div>
                    <div className={styles.filterLabel}>To Date</div>
                    <Input type="date" value={filterToDate}
                      onChange={(e) => setFilterToDate(e.target.value)} size="small" />
                  </div>
                </div>
                <div className={styles.filterActions} style={{ marginTop: '0.75rem' }}>
                  <Button className={styles.searchBtn} size="small" icon={<SearchOutlined />}>
                    Search
                  </Button>
                  <Button size="small" className={styles.clearBtn} onClick={handleClearFilters}>
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div> */}

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                <span>{activeView.label}</span>
                <span className={styles.countBadge}>{filteredData.length}</span>
              </div>

              <div className={styles.tableCardActions}>
                {/* ── Pending sub-filter (only when Pending for Review is active) ── */}
                {viewMode === 'pending' && (
                  <>
                    <div className={styles.viewSelectWrap}>
                      <span className={styles.viewSelectLabel}>Filter:</span>
                      <Select
                        value={pendingSub}
                        onChange={(v) => setPendingSub(v as PendingSubFilter)}
                        size="small"
                        className={`${styles.pendingSubSelect} ${pendingSub !== 'all' ? styles.viewSelectActive : ''}`}
                        popupMatchSelectWidth={false}
                        options={PENDING_SUB_OPTIONS}
                      />
                    </div>
                    <div className={styles.headerDivider} />
                  </>
                )}

                {/* ── View-mode dropdown ── */}
                <div className={styles.viewSelectWrap}>
                  <span className={styles.viewSelectLabel}>View:</span>
                  <Select
                    value={viewMode}
                    onChange={(v) => handleViewChange(v as ViewMode)}
                    size="small"
                    className={`${styles.viewSelect} ${viewMode !== 'all' ? styles.viewSelectActive : ''}`}
                    popupMatchSelectWidth={false}
                    options={VIEW_OPTIONS}
                  />
                </div>

                <div className={styles.headerDivider} />

                <Input
                  placeholder="Search experiments…"
                  prefix={<SearchOutlined />}
                  size="small"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  className={styles.filterInput}
                />
                <Button size="small" className={styles.clearBtn} onClick={() => setSearchText('')}>Clear</Button>
                <Button className={styles.exportBtn} size="small" icon={<ExportOutlined />}>
                  Export
                </Button>
                <Button
                  size="small"
                  icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
                  onClick={openCreate}
                  className={sharedStyles.primaryActionBtn}
                >
                  New Experiment
                </Button>
              </div>
            </div>

            <Table<Experiment>
              className={styles.table}
              columns={columns}
              dataSource={filteredData}
              size="small"
              rowKey="key"
              loading={loading}
              pagination={{
                total: filteredData.length,
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}–${range[1]} of ${total} experiments`,
              }}
            />
          </div>
        </main>
      </div>

      {/* New Experiment Modal */}
      <Modal
        title="New Experiment"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create Experiment"
        confirmLoading={createLoading}
        className={styles.experimentModal}
        width={480}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="notebook_id" label="Notebook" rules={[{ required: true }]}>
            <Select
              options={nbOptions}
              placeholder="Select notebook"
              showSearch
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="title" label="Experiment Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Run #1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExperimentsListPage;
