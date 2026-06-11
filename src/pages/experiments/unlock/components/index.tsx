import { useState, useEffect } from 'react'
import {
  Table, Select, Button, Input, Tag, Modal, Form, message, Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  HomeOutlined,
  UnlockOutlined,
  StopOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  ExportOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getUnlockRequests,
  getExperiments,
  approveUnlockRequest,
  rejectUnlockRequest,
  type UnlockRequestResponse,
  type ExperimentSummary,
} from '@/utilities/chemiaApi'

const { Text } = Typography

// ─── Status tag styles ────────────────────────────────────────────────────────

const UNLOCK_STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:  { background: '#fef3c7', color: '#92400e', border: 'none', fontWeight: 600, fontSize: 11, borderRadius: 4 },
  APPROVED: { background: '#d1fae5', color: '#065f46', border: 'none', fontWeight: 600, fontSize: 11, borderRadius: 4 },
  REJECTED: { background: '#fee2e2', color: '#991b1b', border: 'none', fontWeight: 600, fontSize: 11, borderRadius: 4 },
}

const EXP_STATUS_STYLE: Record<string, React.CSSProperties> = {
  DRAFT:     { background: '#f5f5f4', color: '#57534e', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  SUBMITTED: { background: '#e0f2fe', color: '#0369a1', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  VERIFIED:  { background: '#ccfbf1', color: '#0f766e', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  APPROVED:  { background: '#d1fae5', color: '#065f46', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  REJECTED:  { background: '#fee2e2', color: '#991b1b', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  UNLOCKED:  { background: '#fef3c7', color: '#92400e', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
  VOID:      { background: '#f1f5f9', color: '#64748b', border: 'none', fontWeight: 500, fontSize: 11, borderRadius: 4 },
}

// ─── Tab → experiment status mapping ─────────────────────────────────────────
// inactive     → VOID   (experiments that have been voided / deactivated)
// delayed-sub  → DRAFT  (created but not submitted — overdue for submission)
// delayed-app  → SUBMITTED (submitted but awaiting TL/QA verification)
// pending-review → VERIFIED (verified by TL, awaiting HOD/QA final approval)

const TAB_STATUS: Record<string, string> = {
  'inactive':       'VOID',
  'delayed-sub':    'DRAFT',
  'delayed-app':    'SUBMITTED',
  'pending-review': 'VERIFIED',
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

interface TabItem { key: string; icon: React.ReactNode; label: string; group?: 'atr' }

const TABS: TabItem[] = [
  { key: 'unlock',         icon: <UnlockOutlined />,            label: 'Unlock Requests' },
  { key: 'inactive',       icon: <StopOutlined />,              label: 'Inactive Experiments' },
  { key: 'delayed-sub',    icon: <ClockCircleOutlined />,       label: 'Delayed Submission' },
  { key: 'delayed-app',    icon: <ClockCircleOutlined />,       label: 'Delayed Approval' },
  { key: 'pending-review', icon: <EyeOutlined />,               label: 'Pending Review' },
  { key: 'overdue-atr',    icon: <ExclamationCircleOutlined />, label: 'Overdue ATR',            group: 'atr' },
  { key: 'pending-clarif', icon: <QuestionCircleOutlined />,    label: 'Pending Clarifications', group: 'atr' },
]

const mainTabs = TABS.filter(t => !t.group)
const atrTabs  = TABS.filter(t => t.group === 'atr')

// ─── Component ────────────────────────────────────────────────────────────────

export default function UnlockExperimentsPage() {
  const navigate = useNavigate()

  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}') } catch { return {} }
  })()
  const isQA: boolean = storedUser?.role === 'QA'

  // ── tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState('unlock')
  const [searchText, setSearchText]     = useState('')

  // ── unlock requests state ──────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [unlockRows, setUnlockRows]     = useState<UnlockRequestResponse[]>([])
  const [unlockLoading, setUnlockLoading] = useState(false)

  // ── experiment tabs state ──────────────────────────────────────────────────
  const [expRows, setExpRows]     = useState<ExperimentSummary[]>([])
  const [expLoading, setExpLoading] = useState(false)
  // badge counts per experiment-tab key
  const [expCounts, setExpCounts] = useState<Record<string, number>>({
    inactive: 0, 'delayed-sub': 0, 'delayed-app': 0, 'pending-review': 0,
  })

  // ── approve modal ──────────────────────────────────────────────────────────
  const [approveTarget, setApproveTarget] = useState<UnlockRequestResponse | null>(null)
  const [approveForm] = Form.useForm()
  const [approveLoading, setApproveLoading] = useState(false)

  // ── reject modal ───────────────────────────────────────────────────────────
  const [rejectTarget, setRejectTarget] = useState<UnlockRequestResponse | null>(null)
  const [rejectForm] = Form.useForm()
  const [rejectLoading, setRejectLoading] = useState(false)

  // ── Load unlock requests ───────────────────────────────────────────────────
  const loadUnlockRequests = () => {
    setUnlockLoading(true)
    getUnlockRequests({ page_size: 200, status: statusFilter })
      .then(r => setUnlockRows(r.items))
      .catch(err => message.error(err instanceof Error ? err.message : 'Failed to load unlock requests'))
      .finally(() => setUnlockLoading(false))
  }

  // ── Load experiments for a tab ─────────────────────────────────────────────
  const loadExperiments = (tab: string) => {
    const status = TAB_STATUS[tab]
    if (!status) return
    setExpLoading(true)
    getExperiments({ status, page_size: 200 })
      .then(r => {
        setExpRows(r.items)
        setExpCounts(prev => ({ ...prev, [tab]: r.total }))
      })
      .catch(err => message.error(err instanceof Error ? err.message : 'Failed to load experiments'))
      .finally(() => setExpLoading(false))
  }

  // ── Pre-fetch badge counts for all experiment tabs on mount ────────────────
  useEffect(() => {
    Object.entries(TAB_STATUS).forEach(([tab, status]) => {
      getExperiments({ status, page_size: 1 })
        .then(r => setExpCounts(prev => ({ ...prev, [tab]: r.total })))
        .catch(() => {})
    })
  }, [])

  // ── React to tab / filter changes ─────────────────────────────────────────
  useEffect(() => {
    setSearchText('')
    if (activeTab === 'unlock') {
      loadUnlockRequests()
    } else if (TAB_STATUS[activeTab]) {
      loadExperiments(activeTab)
    }
  }, [activeTab, statusFilter])

  // ── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = async (values: { review_note?: string }) => {
    if (!approveTarget) return
    setApproveLoading(true)
    try {
      const updated = await approveUnlockRequest(approveTarget.id, values.review_note)
      setUnlockRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Unlock request approved — experiment is now UNLOCKED')
      setApproveTarget(null)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproveLoading(false)
    }
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  const handleReject = async (values: { review_note: string }) => {
    if (!rejectTarget) return
    setRejectLoading(true)
    try {
      const updated = await rejectUnlockRequest(rejectTarget.id, values.review_note)
      setUnlockRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Unlock request rejected')
      setRejectTarget(null)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to reject')
    } finally {
      setRejectLoading(false)
    }
  }

  // ── Filtered rows (current tab) ────────────────────────────────────────────
  const filteredUnlock = unlockRows.filter(r => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      (r.experiment_full_code ?? r.experiment_id).toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      (r.requester_name ?? r.requested_by).toLowerCase().includes(q)
    )
  })

  const filteredExp = expRows.filter(r => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      r.full_code.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      (r.creator_name ?? '').toLowerCase().includes(q)
    )
  })

  // ── Columns: unlock requests ───────────────────────────────────────────────
  const unlockColumns: TableColumnsType<UnlockRequestResponse> = [
    {
      title: '#', key: 'idx', width: 44,
      render: (_: unknown, __: UnlockRequestResponse, i: number) => i + 1,
    },
    {
      title: 'Experiment', key: 'experiment', width: 155,
      render: (_: unknown, record: UnlockRequestResponse) => (
        <Text
          style={{ fontSize: 12, fontFamily: 'monospace', color: '#0f766e', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => navigate(`/experiments/${record.experiment_id}`)}
        >
          {record.experiment_full_code ?? record.experiment_id.slice(0, 8) + '…'}
        </Text>
      ),
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <Tag style={UNLOCK_STATUS_STYLE[v] ?? {}}>{v}</Tag>,
    },
    {
      title: 'Requested By', key: 'requested_by', width: 130,
      render: (_: unknown, record: UnlockRequestResponse) =>
        record.requester_name ?? record.requested_by,
    },
    {
      title: 'Requested On', dataIndex: 'requested_at', key: 'requested_at', width: 115,
      render: (v: string) => v?.slice(0, 10),
    },
    {
      title: 'Reviewed By', key: 'reviewed_by', width: 120,
      render: (_: unknown, record: UnlockRequestResponse) =>
        record.reviewer_name ?? record.reviewed_by ?? '—',
    },
    {
      title: 'Review Note', dataIndex: 'review_note', key: 'review_note', ellipsis: true,
      render: (v: string | null) => v ?? '—',
    },
    ...(isQA
      ? [{
          title: 'Actions', key: 'actions', width: 155,
          render: (_: unknown, record: UnlockRequestResponse) =>
            record.status === 'PENDING' ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <Button
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ borderColor: '#065f46', color: '#065f46', fontSize: 12 }}
                  onClick={() => { approveForm.resetFields(); setApproveTarget(record) }}
                >
                  Approve
                </Button>
                <Button
                  size="small" danger
                  icon={<CloseCircleOutlined />}
                  style={{ fontSize: 12 }}
                  onClick={() => { rejectForm.resetFields(); setRejectTarget(record) }}
                >
                  Reject
                </Button>
              </div>
            ) : null,
        }]
      : []),
  ]

  // ── Columns: experiment tabs ───────────────────────────────────────────────
  const expColumns: TableColumnsType<ExperimentSummary> = [
    {
      title: '#', key: 'idx', width: 44,
      render: (_: unknown, __: ExperimentSummary, i: number) => i + 1,
    },
    {
      title: 'Full Code', dataIndex: 'full_code', key: 'full_code', width: 165,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#0f766e' }}>{v}</span>
      ),
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag style={EXP_STATUS_STYLE[v] ?? {}}>{v}</Tag>,
    },
    {
      title: 'Created By', dataIndex: 'creator_name', key: 'creator_name', width: 140,
      render: (v: string | null, r: ExperimentSummary) => v ?? r.created_by,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (v: string) => v?.slice(0, 10),
    },
    {
      title: 'Last Updated', dataIndex: 'updated_at', key: 'updated_at', width: 110,
      render: (v: string) => v?.slice(0, 10),
    },
    {
      title: '', key: 'actions', width: 56,
      render: (_: unknown, record: ExperimentSummary) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          style={{ border: 'none', background: 'transparent', color: '#78716c', boxShadow: 'none' }}
          onClick={() => navigate(`/experiments/${record.id}`)}
        />
      ),
    },
  ]

  // ── Helpers ────────────────────────────────────────────────────────────────
  const activeTabData = TABS.find(t => t.key === activeTab)
  const isExpTab      = !!TAB_STATUS[activeTab]
  const isAtrTab      = activeTab === 'overdue-atr' || activeTab === 'pending-clarif'
  const currentCount  = activeTab === 'unlock'
    ? filteredUnlock.length
    : isExpTab ? filteredExp.length : 0

  const tabBadgeCount = (key: string) => {
    if (key === 'unlock') return unlockRows.length
    return expCounts[key] ?? 0
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="unlock" />
        <main className={styles.main}>

          {/* ── Top bar ── */}
          <div className={styles.topBar}>
            <nav className={styles.breadcrumb}>
              <HomeOutlined className={styles.breadHome} onClick={() => navigate('/dashboard')} />
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadCurrent}>Unlock Experiments</span>
            </nav>
            <div className={styles.projectBar}>
              <span className={styles.projectLabel}>Project</span>
              <Select placeholder="Select project" size="small" style={{ width: 180 }} allowClear />
            </div>
          </div>

          {/* ── Tab strip ── */}
          <div className={styles.tabsWrap}>
            {mainTabs.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`${styles.tabBadge} ${activeTab === tab.key ? styles.tabBadgeActive : ''}`}>
                  {tabBadgeCount(tab.key)}
                </span>
              </button>
            ))}

            <div className={styles.atrSep}>ATRs</div>

            {atrTabs.map(tab => (
              <button
                key={tab.key}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
                <span className={`${styles.tabBadge} ${activeTab === tab.key ? styles.tabBadgeActive : ''}`}>0</span>
              </button>
            ))}
          </div>

          {/* ── Table card ── */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHead}>
              <div className={styles.tableCardTitle}>
                <span>{activeTabData?.label ?? 'Records'}</span>
                <span className={styles.countBadge}>{currentCount}</span>
                {isExpTab && (
                  <span className={styles.statusPill}>
                    {TAB_STATUS[activeTab]}
                  </span>
                )}
              </div>

              <div className={styles.tableCardActions}>
                {activeTab === 'unlock' && (
                  <Select
                    placeholder="All statuses"
                    allowClear
                    value={statusFilter}
                    onChange={v => setStatusFilter(v)}
                    size="small"
                    style={{ width: 145 }}
                  >
                    <Select.Option value="PENDING">PENDING</Select.Option>
                    <Select.Option value="APPROVED">APPROVED</Select.Option>
                    <Select.Option value="REJECTED">REJECTED</Select.Option>
                  </Select>
                )}
                <Input
                  placeholder="Search…"
                  prefix={<SearchOutlined />}
                  size="small"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  allowClear
                  className={styles.filterInput}
                />
                <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}>Search</Button>
                <Button size="small" className={styles.clearBtn} onClick={() => { setSearchText(''); setStatusFilter(undefined) }}>Clear</Button>
                <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>
                  Export
                </Button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              {/* Unlock Requests tab */}
              {activeTab === 'unlock' && (
                <Table<UnlockRequestResponse>
                  columns={unlockColumns}
                  dataSource={filteredUnlock.map(r => ({ ...r, key: r.id }))}
                  loading={unlockLoading}
                  size="small"
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: false,
                    showTotal: (t, range) => `${range[0]}-${range[1]} of ${t}`,
                    size: 'small',
                  }}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: 'No unlock requests found' }}
                />
              )}

              {/* Experiment tabs (inactive / delayed-sub / delayed-app / pending-review) */}
              {isExpTab && (
                <Table<ExperimentSummary>
                  columns={expColumns}
                  dataSource={filteredExp.map(r => ({ ...r, key: r.id }))}
                  loading={expLoading}
                  size="small"
                  pagination={{
                    pageSize: 15,
                    showSizeChanger: false,
                    showTotal: (t, range) => `${range[0]}-${range[1]} of ${t}`,
                    size: 'small',
                  }}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: `No ${activeTabData?.label?.toLowerCase()} found` }}
                />
              )}

              {/* ATR tabs — placeholder */}
              {isAtrTab && (
                <Table
                  columns={[]}
                  dataSource={[]}
                  size="small"
                  locale={{ emptyText: 'ATR data coming soon' }}
                  pagination={false}
                />
              )}
            </div>
          </div>

        </main>
      </div>

      {/* Approve Modal */}
      <Modal
        title="Approve Unlock Request"
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={() => approveForm.submit()}
        okText="Approve"
        okButtonProps={{ style: { background: '#065f46', borderColor: '#065f46' } }}
        confirmLoading={approveLoading}
        destroyOnClose
        width={420}
      >
        <Form form={approveForm} layout="vertical" onFinish={handleApprove} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="review_note" label="Review Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note for the requester…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="Reject Unlock Request"
        open={!!rejectTarget}
        onCancel={() => setRejectTarget(null)}
        onOk={() => rejectForm.submit()}
        okText="Reject"
        okButtonProps={{ danger: true }}
        confirmLoading={rejectLoading}
        destroyOnClose
        width={420}
      >
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="review_note" label="Reason for Rejection" rules={[{ required: true, message: 'Please provide a rejection reason' }]}>
            <Input.TextArea rows={3} placeholder="Explain why the unlock request is being rejected…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
