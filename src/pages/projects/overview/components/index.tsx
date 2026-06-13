import { useState, useEffect } from 'react'
import { Table, Tag, Button, Spin, message, Modal, Select, Popconfirm, Avatar } from 'antd'
import {
  HomeOutlined, EditOutlined, PlusOutlined, UserOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { useProjectPermissions } from '@/hooks/useModulePermissions'
import styles from './styles.module.less'
import {
  getProject, getProjectMembers, addProjectMembers, removeProjectMember,
  getExperiments, getUsers, updateProject, experimentCreatorLabel,
  type ProjectResponse, type ProjectUserResponse, type ExperimentSummary,
} from '@/utilities/chemiaApi'

const STATUS_LABEL: Record<string, string> = {
  'ACTIVE': 'Active',
  'ON HOLD': 'On Hold',
  'COMPLETED': 'Completed',
  'CANCELLED': 'Cancelled',
}

export default function ProjectOverviewPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canEdit, canRoutes } = useProjectPermissions()

  const [project, setProject]   = useState<ProjectResponse | null>(null)
  const [members, setMembers]   = useState<ProjectUserResponse[]>([])
  const [exps, setExps]         = useState<ExperimentSummary[]>([])
  const [loading, setLoading]   = useState(true)

  const loadAll = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getProject(id),
      getProjectMembers(id),
      getExperiments({ project_id: id, page_size: 6, latest_only: true }),
    ])
      .then(([proj, mems, expResp]) => {
        setProject(proj)
        setMembers(mems)
        setExps(expResp.items)
      })
      .catch(() => message.error('Failed to load project'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [id])

  // ── Edit Project modal ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)

  // ── Add Member modal ──────────────────────────────────────────────────────
  const [addMemberOpen, setAddMemberOpen]   = useState(false)
  const [memberOptions, setMemberOptions]   = useState<{ value: string; label: string }[]>([])
  const [selectedUsers, setSelectedUsers]   = useState<string[]>([])
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const openAddMember = () => {
    getUsers({ page_size: 100, is_active: true })
      .then(resp => {
        const existing = new Set(members.map(m => m.user_id))
        setMemberOptions(resp.items
          .filter(u => !existing.has(u.id))
          .map(u => ({ value: u.id, label: `${u.display_name} (${u.username})` })))
      })
      .catch(() => {})
    setSelectedUsers([])
    setAddMemberOpen(true)
  }

  const handleAddMembers = async () => {
    if (!id || !selectedUsers.length) return
    setAddMemberLoading(true)
    try {
      await addProjectMembers(id, selectedUsers)
      message.success('Member(s) added')
      setAddMemberOpen(false)
      loadAll()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddMemberLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!id) return
    try {
      await removeProjectMember(id, userId)
      message.success('Member removed')
      loadAll()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
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

  if (!project) return null

  const expColumns: ColumnsType<ExperimentSummary> = [
    { title: 'CODE',  dataIndex: 'full_code', key: 'full_code',
      render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
    { title: 'TITLE', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'CREATED BY', dataIndex: 'creator_name', key: 'creator_name',
      render: (_v: string | null, r: ExperimentSummary) => experimentCreatorLabel(r) },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status',
      render: (v: string) => <StatusTag status={v} />,
    },
    { title: 'UPDATED', dataIndex: 'updated_at', key: 'updated_at',
      render: (v: string) => new Date(v).toLocaleDateString() },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="project" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
              <HomeOutlined /> Home
            </span>
            {' / '}
            <span className={styles.breadcrumbLink} onClick={() => navigate('/projects')}>Projects</span>
            {' / '}
            <span className={styles.breadcrumbLink}>{project.code}</span>
            {' / '}
            <span>Overview</span>
          </div>

          {/* Project tab nav */}
          <div className={styles.tabNav}>
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Overview</button>
            {canEdit && (
              <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/milestones`)}>Milestones</button>
            )}
            {canRoutes && (
              <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/routes`)}>Routes &amp; Stages</button>
            )}
          </div>

          {/* Stat cards */}
          <div className={styles.statRow}>
            <div className={`${styles.statCard} ${styles.statCardTotal}`}>
              <div className={styles.statLabel}>Team Members</div>
              <div className={styles.statValue}>{members.length}</div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardApproved}`}>
              <div className={styles.statLabel}>Experiments</div>
              <div className={styles.statValue}>{exps.length}</div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardProgress}`}>
              <div className={styles.statLabel}>Approved</div>
              <div className={styles.statValue}>{exps.filter(e => e.status === 'APPROVED').length}</div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardPending}`}>
              <div className={styles.statLabel}>In Progress</div>
              <div className={styles.statValue}>{exps.filter(e => ['SUBMITTED','VERIFIED'].includes(e.status)).length}</div>
            </div>
          </div>

          {/* Two-column */}
          <div className={styles.twoCol}>
            {/* Project info */}
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Project Info</div>
                {canEdit && (
                  <Button type="text" size="small" icon={<EditOutlined />}
                    style={{ color: '#5aa3a1' }}
                    onClick={() => setEditOpen(true)} />
                )}
              </div>
              <div className={styles.infoRow}>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Code</span>
                  <span className={styles.infoVal} style={{  }}>{project.code}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Name</span>
                  <span className={styles.infoVal}>{project.name}</span>
                </div>
                {project.product_name && (
                  <div className={styles.infoLine}>
                    <span className={styles.infoKey}>Product</span>
                    <span className={styles.infoVal}>{project.product_name}</span>
                  </div>
                )}
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Type</span>
                  <span className={styles.infoVal}>{project.project_type ?? '—'}</span>
                </div>
                {project.market && (
                  <div className={styles.infoLine}>
                    <span className={styles.infoKey}>Market</span>
                    <span className={styles.infoVal}>{project.market}</span>
                  </div>
                )}
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Department</span>
                  <span className={styles.infoVal}>{project.department?.name ?? '—'}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Manager</span>
                  <span className={styles.infoVal}>{project.manager?.display_name ?? '—'}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Start Date</span>
                  <span className={styles.infoVal}>{project.start_date ?? '—'}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Target Date</span>
                  <span className={styles.infoVal}>{project.target_date ?? '—'}</span>
                </div>
                <div className={styles.infoLine}>
                  <span className={styles.infoKey}>Status</span>
                  <span className={styles.infoVal}>
                    <StatusTag status={project.status} label={STATUS_LABEL[project.status] ?? project.status} />
                  </span>
                </div>
                {project.description && (
                  <div className={styles.infoLine} style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                    <span className={styles.infoKey}>Description</span>
                    <span style={{ color: '#44403c', fontSize: 13 }}>{project.description}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Team Members */}
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Team Members</div>
                {canEdit && (
                  <Button type="text" size="small" icon={<PlusOutlined />}
                    style={{ color: '#5aa3a1' }} onClick={openAddMember} />
                )}
              </div>
              {members.length === 0
                ? <p style={{ color: '#78716c', fontSize: 13, margin: 0 }}>No team members yet.</p>
                : (
                  <div className={styles.memberList}>
                    {members.map(m => (
                      <div key={m.user_id} className={styles.memberRow}>
                        <Avatar size={28} icon={<UserOutlined />} style={{ background: '#4a9290' }} />
                        <span className={styles.memberName}>{m.user?.display_name ?? m.user_id}</span>
                        {canEdit && (
                          <Popconfirm title="Remove this member?" onConfirm={() => handleRemoveMember(m.user_id)}
                            okText="Remove" okButtonProps={{ danger: true }}>
                            <Button type="text" size="small" icon={<DeleteOutlined />}
                              style={{ color: '#be123c', marginLeft: 'auto' }} />
                          </Popconfirm>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* Recent experiments */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Recent Experiments</div>
            <Table<ExperimentSummary>
              className={styles.table}
              columns={expColumns}
              dataSource={exps.map(e => ({ ...e, key: e.id }))}
              size="small"
              pagination={false}
              onRow={row => ({ onClick: () => navigate(`/experiments/${row.id}`) })}
            />
          </div>
        </main>
      </div>

      {/* Add Member Modal */}
      <Modal title="Add Team Members" open={addMemberOpen}
        onCancel={() => setAddMemberOpen(false)}
        onOk={handleAddMembers} okText="Add" confirmLoading={addMemberLoading}
        className={styles.addMemberModal}
        destroyOnClose>
        <Select
          mode="multiple" options={memberOptions} style={{ width: '100%', marginTop: 12 }}
          placeholder="Select users to add"
          value={selectedUsers} onChange={setSelectedUsers}
          filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
        />
      </Modal>

      {/* Edit Project Modal (basic status change) */}
      <EditProjectModal
        project={project}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); loadAll() }}
      />
    </div>
  )
}

// ── EditProjectModal ──────────────────────────────────────────────────────────
function EditProjectModal({ project, open, onClose, onSaved }: {
  project: ProjectResponse
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(project.status)

  useEffect(() => { if (open) setStatus(project.status) }, [open, project.status])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProject(project.id, { status })
      message.success('Project updated')
      onSaved()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Project Status" open={open} onCancel={onClose}
      onOk={handleSave} okText="Save" confirmLoading={saving} destroyOnClose width={360}>
      <div style={{ margin: '16px 0' }}>
        <label style={{ fontSize: 13, color: '#78716c', display: 'block', marginBottom: 6 }}>Status</label>
        <Select value={status} onChange={setStatus} style={{ width: '100%' }}
          options={[
            { value: 'ACTIVE',    label: 'Active' },
            { value: 'ON HOLD',   label: 'On Hold' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]} />
      </div>
    </Modal>
  )
}
