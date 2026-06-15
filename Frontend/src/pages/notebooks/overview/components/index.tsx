import React, { useState, useEffect } from 'react'
import { Card, Breadcrumb, Table, Button, Spin, message, Modal, Form, Input, Select, Tooltip } from 'antd'
import { HomeOutlined, ExportOutlined, EditOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { resolveStatusVariant, VARIANT_COLORS } from '@/common/StatusTag/variants'
import { useNotebookPermissions } from '@/hooks/useModulePermissions'
import { formatDisplayDate } from '@/pages/projects/shared/formatDate'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import styles from './styles.module.less'
import {
  getNotebook, updateNotebook, getExperiments, createExperiment, getProject,
  getNotebookPermissions, grantNotebookPermission, getUsers,
  type NotebookResponse, type ExperimentSummary, type ProjectResponse,
  type PermissionResponse,
} from '@/utilities/chemiaApi'
import { experimentDetailPath } from '@/pages/experiments/preliminary/lib/routing'
import {
  notebookUsesWorkflowTemplate,
  resolveTemplateFromNotebook,
  type ResolvedNotebookTemplate,
} from '@/pages/experiments/preliminary/lib/resolveTemplate'
import { firstWorkflowScreen } from '@/pages/experiments/preliminary/lib/templateTypes'

const STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'LOCKED',   label: 'Locked' },
]

const NotebookOverviewPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canEdit, canPermissions } = useNotebookPermissions()

  const [notebook, setNotebook]   = useState<NotebookResponse | null>(null)
  const [project, setProject]     = useState<ProjectResponse | null>(null)
  const [exps, setExps]           = useState<ExperimentSummary[]>([])
  const [loading, setLoading]     = useState(true)
  const [notebookTemplate, setNotebookTemplate] = useState<ResolvedNotebookTemplate | null>(null)
  const [assignedUsers, setAssignedUsers] = useState<PermissionResponse[]>([])

  const loadAll = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getNotebook(id),
      getExperiments({ notebook_id: id, page_size: 20, latest_only: true }),
      getNotebookPermissions(id).catch(() => [] as PermissionResponse[]),
    ])
      .then(async ([nb, expResp, perms]) => {
        setNotebook(nb)
        setExps(expResp.items)
        setAssignedUsers(perms)
        const resolved = await resolveTemplateFromNotebook(nb)
        setNotebookTemplate(resolved)
        getProject(nb.project_id)
          .then(setProject)
          .catch(() => setProject(null))
      })
      .catch(() => message.error('Failed to load notebook'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [id])

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]   = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm] = Form.useForm()

  const openEdit = () => {
    if (!notebook) return
    editForm.setFieldsValue({ title: notebook.title, description: notebook.description ?? '', status: notebook.status })
    setEditOpen(true)
  }

  const handleEdit = async (values: { title: string; description: string; status: string }) => {
    if (!id) return
    setEditSaving(true)
    try {
      const nb = await updateNotebook(id, { title: values.title, description: values.description || undefined, status: values.status })
      setNotebook(nb)
      message.success('Notebook updated')
      setEditOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Assign User modal ──────────────────────────────────────────────────────
  const [assignOpen, setAssignOpen]   = useState(false)
  const [assignLoading, setAssignLoading] = useState(false)
  const [chemOptions, setChemOptions] = useState<{ value: string; label: string }[]>([])
  const [assignForm] = Form.useForm()

  const openAssign = () => {
    if (!id) return
    assignForm.resetFields()
    const existing = new Set(assignedUsers.map(p => p.user_id))
    getUsers({ page_size: 100, is_active: true, role_code: 'CHEM' })
      .then(resp => setChemOptions(resp.items
        .filter(u => !existing.has(u.id))
        .map(u => ({ value: u.id, label: `${u.display_name} (${u.username})` }))))
      .catch(() => {})
    setAssignOpen(true)
  }

  const handleAssign = async (values: { user_id: string }) => {
    if (!id) return
    setAssignLoading(true)
    try {
      await grantNotebookPermission(id, {
        user_id: values.user_id,
        can_view: true, can_edit: true, can_submit: true,
        can_clone: true, can_export: true, can_attach: true,
        can_comment: true, can_request_unlock: true,
      })
      message.success('User assigned')
      setAssignOpen(false)
      const perms = await getNotebookPermissions(id)
      setAssignedUsers(perms)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to assign user')
    } finally {
      setAssignLoading(false)
    }
  }

  // ── New Experiment modal ────────────────────────────────────────────────────
  const [newExpOpen, setNewExpOpen]     = useState(false)
  const [newExpLoading, setNewExpLoading] = useState(false)
  const [newExpForm] = Form.useForm()


  const usesWorkflowTemplate = notebook
    ? notebookUsesWorkflowTemplate(notebook) || !!notebookTemplate
    : false

  const handleNewExp = async (values: { title: string }) => {
    if (!id || !notebook) return
    setNewExpLoading(true)
    try {
      let payload: Parameters<typeof createExperiment>[0] = {
        notebook_id: id,
        title:       values.title,
      }

      const resolved = notebookTemplate ?? await resolveTemplateFromNotebook(notebook)
      if (resolved?.definition) {
        const first = firstWorkflowScreen(resolved.definition)
        if (first) {
          payload = {
            ...payload,
            screen_key:  first.screenKey,
            section_key: first.sectionKey,
            data: {
              _workflow_screen:  first.screenKey,
              _workflow_section: first.sectionKey,
            },
          }
        }
      }

      await createExperiment(payload)
      message.success('Experiment created')
      setNewExpOpen(false)
      loadAll()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create experiment')
    } finally {
      setNewExpLoading(false)
    }
  }

  if (loading) return (
    <div className={styles.page}>
      <Header />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    </div>
  )

  if (!notebook) return null

  // Compute breakdown
  const statusKeys = ['APPROVED','VERIFIED','SUBMITTED','DRAFT','REJECTED','UNLOCKED','VOID']
  const breakdown = statusKeys
    .map(s => ({ label: s, count: exps.filter(e => e.status === s).length }))
    .filter(x => x.count > 0)
  const total = exps.length

  const expColumns: ColumnsType<ExperimentSummary> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code',
      render: (v: string) => <span className={styles.monoText}>{v}</span>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: 'Date', dataIndex: 'updated_at', key: 'updated_at',
      render: (v: string) => formatDisplayDate(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ExperimentSummary) => (
        <Tooltip title="View experiment">
          <Button
            icon={<EyeOutlined />}
            size="small"
            className={styles.viewActionBtn}
            aria-label="View experiment"
            onClick={(e) => {
              e.stopPropagation()
              navigate(experimentDetailPath(record.id, usesWorkflowTemplate))
            }}
          />
        </Tooltip>
      ),
    },
  ]

  const nbStatus = notebook.status
  const nbStatusLabel = nbStatus === 'ACTIVE' ? 'Active' : nbStatus === 'ARCHIVED' ? 'Archived' : 'Locked'

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="lookup2" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumbRow}>
            <Breadcrumb items={[
              { title: <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span> },
              { title: <span className={styles.breadcrumbLink} onClick={() => navigate('/notebooks')}>Notebooks</span> },
              { title: notebook.code },
              { title: 'Overview' },
            ]} />
            <div className={styles.breadcrumbActions}>
              {canEdit && (
                <Button size="small" icon={<EditOutlined />} onClick={openEdit} className={styles.actionBtn}>Edit</Button>
              )}
            </div>
          </div>

          {/* Tab nav */}
          <div className={styles.tabNav}>
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Overview</button>
          </div>

          {/* Stat Cards */}
          <div className={styles.statCards}>
            <div className={`${styles.statCard} ${styles.statCardTotal}`}>
              <div className={styles.statLabel}>Total Experiments</div>
              <div className={styles.statValue}>{total}</div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardApproved}`}>
              <div className={styles.statLabel}>Approved</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'APPROVED').length}
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardSubmitted}`}>
              <div className={styles.statLabel}>Submitted</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'SUBMITTED').length}
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardDraft}`}>
              <div className={styles.statLabel}>Draft</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'DRAFT').length}
              </div>
            </div>
          </div>

          {/* Two-column */}
          <div className={styles.twoCol}>
            {/* Breakdown */}
            <Card className={styles.card} title={<span className={styles.cardTitle}>Experiment Status Breakdown</span>}>
              {breakdown.length === 0
                ? <p style={{ color: '#78716c', fontSize: 13, margin: 0 }}>No experiments yet.</p>
                : (
                  <div className={styles.breakdownList}>
                    {breakdown.map(item => {
                      const labelColor = VARIANT_COLORS[resolveStatusVariant(item.label)]
                      const colorMap: Record<string, string> = {
                        DRAFT: 'barStone',
                        SUBMITTED: 'barSky',
                        APPROVED: 'barEmerald',
                        REJECTED: 'barRose',
                        VERIFIED: 'barTeal',
                        UNLOCKED: 'barStone',
                        VOID: 'barStone',
                      }
                      return (
                        <div key={item.label} className={styles.breakdownRow}>
                          <div className={styles.breakdownMeta}>
                            <span className={styles.breakdownLabel} style={{ color: labelColor }}>{item.label}</span>
                            <span className={styles.breakdownCount}>{item.count}</span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={`${styles.barFill} ${styles[colorMap[item.label] ?? 'barStone']}`}
                              style={{ width: total ? `${(item.count / total) * 100}%` : '0%' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </Card>

            {/* Notebook Info */}
            <Card
              className={styles.card}
              title={<span className={styles.cardTitle}>Notebook Info</span>}
              extra={
                canPermissions && (
                  <Button size="small" type="primary" icon={<Plus size={14} strokeWidth={2.5} />} onClick={openAssign}>
                    Assign Chemist
                  </Button>
                )
              }
            >
              <div className={styles.infoRow}>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Notebook Code</span>
                  <span className={styles.infoVal}><span className={styles.monoText}>{notebook.code}</span></span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Title</span>
                  <span className={styles.infoVal}>{notebook.title}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Project</span>
                  <span className={styles.infoVal}>
                    {project ? (
                      <Tooltip title={project.name}>
                        <button
                          type="button"
                          className={styles.projectLink}
                          onClick={() => navigate(`/projects/${notebook.project_id}/overview`)}
                        >
                          {project.code}
                        </button>
                      </Tooltip>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Creator</span>
                  <span className={styles.infoVal}>{notebook.creator?.display_name ?? '—'}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Created</span>
                  <span className={styles.infoVal}>{formatDisplayDate(notebook.created_at)}</span>
                </div>
                {notebook.description && (
                  <div className={styles.infoLineFull}>
                    <span className={styles.infoKey}>Description</span>
                    <span className={styles.infoVal}>{notebook.description}</span>
                  </div>
                )}
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Status</span>
                  <span className={styles.infoVal}>
                    <StatusTag status={nbStatus} label={nbStatusLabel} />
                  </span>
                </div>
                {notebookTemplate?.templateName && (
                  <div className={styles.infoLine}>
                    <span className={styles.infoKey}>Template</span>
                    <span className={styles.infoVal}>
                      <StatusTag status="template" label={notebookTemplate.templateName} variant="info" />
                    </span>
                  </div>
                )}
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Assigned To</span>
                  <span className={styles.infoVal}>
                    {(() => {
                      const chemUsers = assignedUsers.filter(p => p.user?.role === 'CHEM')
                      return chemUsers.length === 0
                        ? <span style={{ color: '#a8a29e' }}>No users assigned</span>
                        : chemUsers.map(p => (
                            <span key={p.user_id} style={{ display: 'inline-block', marginRight: 6, marginBottom: 4 }}>
                              <StatusTag status="user" label={p.user?.display_name ?? p.user_id} variant="info" />
                            </span>
                          ))
                    })()}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Experiments Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Recent Experiments
                <span className={styles.countBadge}>{exps.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
                  size="small"
                  className={sharedStyles.primaryActionBtn}
                  onClick={() => { newExpForm.resetFields(); setNewExpOpen(true) }}>
                  New Experiment
                </Button>
                <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>Export</Button>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <Table<ExperimentSummary>
                columns={expColumns}
                dataSource={exps.map(e => ({ ...e, key: e.id }))}
                size="small" className={styles.compactTable} pagination={false}
                onRow={row => ({
                  onClick: () => navigate(experimentDetailPath(row.id, usesWorkflowTemplate)),
                })}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      <Modal title="Edit Notebook" open={editOpen} onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()} okText="Save" confirmLoading={editSaving} destroyOnClose width={440}
        className={styles.editModal}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign User Modal */}
      <Modal title="Assign Chemist" open={assignOpen} onCancel={() => setAssignOpen(false)}
        onOk={() => assignForm.submit()} okText="Assign" confirmLoading={assignLoading}
        destroyOnClose width={420}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="user_id" label="Select Chemist" rules={[{ required: true, message: 'Please select a user' }]}>
            <Select
              options={chemOptions}
              placeholder="Search chemist..."
              showSearch
              filterOption={(input, opt) =>
                (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Experiment Modal */}
      <Modal
        title={notebookTemplate ? `New Experiment — ${notebookTemplate.templateName}` : 'New Experiment'}
        open={newExpOpen}
        onCancel={() => setNewExpOpen(false)}
        onOk={() => newExpForm.submit()} okText="Create"
        confirmLoading={newExpLoading} destroyOnClose width={480}
        className={styles.editModal}>
        <Form form={newExpForm} layout="vertical" onFinish={handleNewExp} requiredMark={false} style={{ marginTop: 8 }}>
          <Form.Item name="title" label="Experiment Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Run #1" />
          </Form.Item>
          {notebookTemplate && (
            <p style={{ color: '#78716c', fontSize: 12, margin: 0 }}>
              This experiment will open in the <strong>{notebookTemplate.templateName}</strong> workflow
              chosen when the notebook was created.
            </p>
          )}
        </Form>
      </Modal>
    </div>
  )
}

export default NotebookOverviewPage
