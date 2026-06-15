import React, { useState, useEffect, useMemo } from 'react'
import { Table, Button, Select, Input, Breadcrumb, message, Modal, Form, Tooltip, Spin } from 'antd'
import {
  HomeOutlined, SearchOutlined,
  ExportOutlined, EyeOutlined,
} from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { usePrivileges } from '@/common/PrivilegesContext'
import { useNotebookPermissions } from '@/hooks/useModulePermissions'
import { isChemRole } from '@/utilities/privileges'
import styles from './styles.module.less'
import {
  getNotebooks, createNotebook, getProjects, getRoutes, getWorkflowTemplates,
  getExperiments, checkAdcPreliminaryStatus,
  type NotebookResponse, type WorkflowTemplateSummary, type ExperimentSummary,
} from '@/utilities/chemiaApi'
import { experimentDetailPath } from '@/pages/experiments/preliminary/lib/routing'
import { notebookUsesWorkflowTemplate } from '@/pages/experiments/preliminary/lib/resolveTemplate'
import { formatDisplayDate } from '@/pages/projects/shared/formatDate'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import bookCloseIcon from '../../../../../assets/icons/book close.svg'
import bookOpenIcon from '../../../../../assets/icons/book open.svg'

interface NotebookRow {
  key: string
  name: string
  projectCode: string
  projectName: string
  projectId: string
  code: string
  createdBy: string
  createdDate: string
  status: 'ACTIVE' | 'ARCHIVED' | 'LOCKED'
}

const NotebooksListPage: React.FC = () => {
  const navigate = useNavigate()
  const { role } = usePrivileges()
  const isChem = isChemRole(role)
  const { canCreate } = useNotebookPermissions()
  const [notebooks, setNotebooks] = useState<NotebookResponse[]>([])
  const [allData, setAllData]     = useState<NotebookRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [searchText, setSearchText] = useState('')
  const [tablePage, setTablePage] = useState(1)

  const [expModalOpen, setExpModalOpen]       = useState(false)
  const [expModalLoading, setExpModalLoading] = useState(false)
  const [selectedNotebook, setSelectedNotebook] = useState<NotebookResponse | null>(null)
  const [modalExperiments, setModalExperiments] = useState<ExperimentSummary[]>([])

  const loadNotebooks = () => {
    setLoading(true)
    Promise.all([
      getNotebooks({ page_size: 100 }),
      getProjects({ page_size: 100 }),
    ])
      .then(([resp, projResp]) => {
        setNotebooks(resp.items)
        const projMap = new Map(
          projResp.items.map(p => [p.id, { code: p.code, name: p.name }]),
        )
        const rows: NotebookRow[] = resp.items.map((nb: NotebookResponse) => {
          const project = projMap.get(nb.project_id)
          return {
            key:         nb.id,
            name:        nb.title,
            projectCode: project?.code ?? '—',
            projectName: project?.name ?? '—',
            projectId:   nb.project_id,
            code:        nb.code,
            createdBy:   nb.creator?.display_name ?? nb.created_by,
            createdDate: nb.created_at ?? '',
            status:      (['ACTIVE','ARCHIVED','LOCKED'].includes(nb.status) ? nb.status : 'ACTIVE') as NotebookRow['status'],
          }
        })
        setAllData(rows)
      })
      .catch(() => message.error('Failed to load notebooks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadNotebooks() }, [])

  useEffect(() => { setTablePage(1) }, [filterStatus, searchText])

  const openNotebookExperiments = (nb: NotebookResponse) => {
    setSelectedNotebook(nb)
    setExpModalOpen(true)
    setExpModalLoading(true)
    setModalExperiments([])
    getExperiments({ notebook_id: nb.id, page_size: 100, latest_only: true })
      .then(resp => setModalExperiments(resp.items))
      .catch(() => message.error('Failed to load experiments'))
      .finally(() => setExpModalLoading(false))
  }

  const handleExperimentClick = (exp: ExperimentSummary) => {
    if (!selectedNotebook) return
    setExpModalOpen(false)
    navigate(experimentDetailPath(exp.id, notebookUsesWorkflowTemplate(selectedNotebook)))
  }

  const handleClear = () => { setFilterStatus(undefined); setSearchText('') }

  const filtered = allData.filter(row => {
    if (filterStatus && row.status !== filterStatus) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      const matchName = row.name.toLowerCase().includes(q)
      const matchCode = row.code.toLowerCase().includes(q)
      const matchProject = row.projectCode.toLowerCase().includes(q)
        || row.projectName.toLowerCase().includes(q)
      if (!matchName && !matchCode && !matchProject) return false
    }
    return true
  })

  // ── New Notebook modal ──────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]     = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [projOptions, setProjOptions]       = useState<{ value: string; label: string }[]>([])
  const [routeOptions, setRouteOptions]     = useState<{ value: string; label: string }[]>([])
  const [stageOptions, setStageOptions]     = useState<{ value: string; label: string }[]>([])
  const [templateOptions, setTemplateOptions] = useState<WorkflowTemplateSummary[]>([])
  const [selProject, setSelProject]         = useState<string | undefined>()
  const [selRoute, setSelRoute]             = useState<string | undefined>()
  const [projectAdcComplete, setProjectAdcComplete] = useState<boolean | null>(null)

  const openCreate = () => {
    createForm.resetFields()
    setSelProject(undefined); setSelRoute(undefined)
    setRouteOptions([]); setStageOptions([])
    getProjects({ page_size: 100 })
      .then(r => setProjOptions(r.items.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))))
      .catch(() => {})
    getWorkflowTemplates()
      .then(setTemplateOptions)
      .catch(() => {})
    // Always refresh notebook list so preliminary_complete flags are up-to-date
    getNotebooks({ page_size: 100 })
      .then(resp => setNotebooks(resp.items))
      .catch(() => {})
    setCreateOpen(true)
  }

  // Filter templates based on real-time ADC preliminary status fetched from backend
  const filteredTemplateOptions = useMemo(() => {
    if (!selProject || projectAdcComplete === null) return templateOptions
    return templateOptions.filter(t => {
      if (projectAdcComplete) return t.slug !== 'adc-preliminary'
      return t.slug !== 'adc-synthesis'
    })
  }, [templateOptions, selProject, projectAdcComplete])

  const handleProjectChange = (pid: string) => {
    setSelProject(pid)
    setSelRoute(undefined)
    setStageOptions([])
    setProjectAdcComplete(null)
    createForm.setFieldValue('route_id', undefined)
    createForm.setFieldValue('stage_id', undefined)
    createForm.setFieldValue('template_id', undefined)
    if (!pid) { setRouteOptions([]); return }
    getRoutes(pid).then(routes =>
      setRouteOptions(routes.map(r => ({ value: r.id, label: `${r.code} — ${r.name}` })))
    ).catch(() => {})
    // Check ADC preliminary completion status live from backend
    checkAdcPreliminaryStatus(pid)
      .then(result => setProjectAdcComplete(result.complete))
      .catch(() => setProjectAdcComplete(false))
  }

  const handleRouteChange = (rid: string) => {
    setSelRoute(rid)
    createForm.setFieldValue('stage_id', undefined)
    if (!selProject || !rid) { setStageOptions([]); return }
    getRoutes(selProject).then(routes => {
      const route = routes.find(r => r.id === rid)
      setStageOptions(route ? route.stages.map(s => ({ value: s.id, label: `${s.code} — ${s.name}` })) : [])
    }).catch(() => {})
  }

  const handleCreate = async (values: Record<string, string>) => {
    setCreateLoading(true)
    try {
      const nb = await createNotebook({
        title:       values.title,
        description: values.description || undefined,
        project_id:  values.project_id,
        route_id:    values.route_id || undefined,
        stage_id:    values.stage_id || undefined,
        template_id: values.template_id || undefined,
      })
      message.success('Notebook created')
      setCreateOpen(false)
      navigate(`/notebooks/${nb.id}/overview`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create notebook')
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: ColumnsType<NotebookRow> = [
    {
      title: '#',
      key: 'index',
      width: 48,
      render: (_v, _r, idx) => idx + 1,
    },
    {
      title: 'Notebook Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: NotebookRow) => (
        <a className={styles.nameLink} onClick={() => navigate(`/notebooks/${record.key}/overview`)}>
          {text}
        </a>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 170,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span className={styles.codeCell}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Project',
      key: 'project',
      ellipsis: true,
      render: (_v: unknown, record: NotebookRow) => {
        if (record.projectCode === '—') return '—'
        return (
          <Tooltip title={record.projectName}>
            <a
              className={styles.projectLink}
              onClick={(e) => { e.stopPropagation(); navigate(`/projects/${record.projectId}/overview`) }}
            >
              {record.projectCode}
            </a>
          </Tooltip>
        )
      },
    },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy', ellipsis: true },
    {
      title: 'Created Date',
      dataIndex: 'createdDate',
      key: 'createdDate',
      width: 120,
      render: (v: string) => formatDisplayDate(v?.slice(0, 10)),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const label = status === 'ACTIVE' ? 'Active' : status === 'ARCHIVED' ? 'Archived' : 'Locked'
        return <StatusTag status={status} label={label} />
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 56,
      render: (_: unknown, record: NotebookRow) => (
        <Tooltip title="View">
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/notebooks/${record.key}/overview`)}
            className={styles.viewBtn} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="lookup2" />
        <main className={styles.main}>
          {/* Breadcrumb + New button */}
          <div className={styles.breadcrumbRow}>
            <Breadcrumb items={[
              { title: <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span> },
              { title: 'Notebooks' },
            ]} />
            {canCreate && !isChem && (
              <Button
                type="primary"
                icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
                size="small"
                className={sharedStyles.primaryActionBtn}
                onClick={openCreate}
              >
                New Notebook
              </Button>
            )}
          </div>

          {/* Chem role: notebook icons instead of table */}
          {isChem ? (
            <div className={styles.chemCard}>
              <div className={styles.chemCardHeader}>
                <div className={styles.tableCardTitle}>
                  My Notebooks
                  <span className={styles.countBadge}>{notebooks.length}</span>
                </div>
              </div>
              {loading ? (
                <div className={styles.chemLoading}><Spin /></div>
              ) : notebooks.length === 0 ? (
                <div className={styles.chemEmpty}>No notebooks assigned to you yet.</div>
              ) : (
                <div className={styles.chemGrid}>
                  {notebooks.map(nb => (
                    <button
                      key={nb.id}
                      type="button"
                      className={styles.chemBookBtn}
                      onClick={() => openNotebookExperiments(nb)}
                      title={nb.title}
                    >
                      <span className={styles.chemBookIconWrap}>
                        <img src={bookCloseIcon} alt="" className={styles.chemBookIconClose} />
                        <img src={bookOpenIcon} alt="" className={styles.chemBookIconOpen} />
                      </span>
                      <span className={styles.chemBookCode}>{nb.code}</span>
                      <span className={styles.chemBookTitle}>{nb.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
          /* Table card */
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Notebooks
                <span className={styles.countBadge}>{filtered.length}</span>
              </div>
              <div className={styles.tableCardFilters}>
                <span className={styles.filterLabel}>Status</span>
                <Select placeholder="All statuses" value={filterStatus}
                  onChange={setFilterStatus} allowClear size="small"
                  className={styles.filterSelect}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'ARCHIVED', label: 'Archived' },
                    { value: 'LOCKED', label: 'Locked' },
                  ]} />
                <Input placeholder="Search notebooks…" prefix={<SearchOutlined />}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  size="small" className={styles.filterInput} allowClear />
                <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
              </div>
              <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>Export</Button>
            </div>
            <Table
              columns={columns}
              dataSource={filtered}
              loading={loading}
              size="small"
              rowKey="key"
              className={styles.table}
              pagination={{
                current: tablePage,
                pageSize: 10,
                total: filtered.length,
                showSizeChanger: false,
                hideOnSinglePage: false,
                size: 'small',
                position: ['bottomRight'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
                onChange: (page) => setTablePage(page),
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
          )}
        </main>
      </div>

      {/* Chem: experiments in selected notebook */}
      <Modal
        title={selectedNotebook ? `${selectedNotebook.code} — ${selectedNotebook.title}` : 'Experiments'}
        open={expModalOpen}
        onCancel={() => setExpModalOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
        className={styles.expModal}
      >
        {expModalLoading ? (
          <div className={styles.chemLoading}><Spin /></div>
        ) : modalExperiments.length === 0 ? (
          <div className={styles.chemEmpty}>No experiments in this notebook.</div>
        ) : (
          <ul className={styles.expList}>
            {modalExperiments.map(exp => (
              <li key={exp.id}>
                <button
                  type="button"
                  className={styles.expListItem}
                  onClick={() => handleExperimentClick(exp)}
                >
                  <span className={styles.expListCode}>{exp.full_code}</span>
                  <span className={styles.expListTitle}>{exp.title}</span>
                  <StatusTag status={exp.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* New Notebook Modal */}
      <Modal title="New Notebook" open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()} okText="Create" confirmLoading={createLoading}
        className={styles.notebookModal}
        width={540} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Notebook Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Study NB-001" />
          </Form.Item>
          <Form.Item name="project_id" label="Project" rules={[{ required: true }]}>
            <Select options={projOptions} placeholder="Select project" showSearch
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              onChange={handleProjectChange} />
          </Form.Item>
          {/* Route and Stage fields hidden
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="route_id" label="Route (optional)">
              <Select options={routeOptions} placeholder="Select route" allowClear showSearch
                disabled={!selProject} onChange={handleRouteChange}
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="stage_id" label="Stage (optional)">
              <Select options={stageOptions} placeholder="Select stage" allowClear showSearch
                disabled={!selRoute}
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </div>
          */}
          <Form.Item name="template_id" label="Experiment Template" rules={[{ required: true, message: 'Please select an experiment template' }]}
            extra="Scientists will follow this template's screens when recording experiments.">
            <Select
              placeholder={!selProject ? 'Select a project first' : projectAdcComplete === null ? 'Loading…' : 'Select a template'}
              disabled={!selProject || projectAdcComplete === null}
              options={filteredTemplateOptions.map(t => ({
                value: t.id,
                label: t.category ? `[${t.category}] ${t.name}` : t.name,
              }))}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotebooksListPage
