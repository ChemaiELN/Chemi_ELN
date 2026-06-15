import { useState, useEffect } from 'react'
import { Table, Tag, Button, Spin, message, Modal, Select, Popconfirm, Avatar } from 'antd'
import {
  HomeOutlined, EditOutlined, UserOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import RichTextEditor from '@/common/RichTextEditor'
import { useProjectPermissions } from '@/hooks/useModulePermissions'
import styles from './styles.module.less'
import ProjectEmptyState from '../../shared/ProjectEmptyState'
import { formatDisplayDate } from '../../shared/formatDate'
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

  // ── Objective state ────────────────────────────────────────────────────────
  const [objEditMode, setObjEditMode] = useState(false)
  const [objDraft,    setObjDraft]    = useState('')
  const [objSaving,   setObjSaving]   = useState(false)

  // ── Observation state ──────────────────────────────────────────────────────
  const [obsEditMode, setObsEditMode] = useState(false)
  const [obsDraft,    setObsDraft]    = useState('')
  const [obsSaving,   setObsSaving]   = useState(false)

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
        setObjDraft(proj.objective ?? '')
        setObsDraft(proj.observation ?? '')
      })
      .catch(() => message.error('Failed to load project'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [id])

  const handleSaveObjective = async () => {
    if (!id) return
    setObjSaving(true)
    try {
      const updated = await updateProject(id, { objective: objDraft })
      setProject(updated)
      setObjEditMode(false)
      message.success('Objective saved')
    } catch {
      message.error('Failed to save objective')
    } finally {
      setObjSaving(false)
    }
  }

  const handleSaveObservation = async () => {
    if (!id) return
    setObsSaving(true)
    try {
      const updated = await updateProject(id, { observation: obsDraft })
      setProject(updated)
      setObsEditMode(false)
      message.success('Observation saved')
    } catch {
      message.error('Failed to save observation')
    } finally {
      setObsSaving(false)
    }
  }

  // ── Edit Project modal ────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)

  // ── Add Member modal ──────────────────────────────────────────────────────
  const [addMemberOpen, setAddMemberOpen]   = useState(false)
  const [memberOptions, setMemberOptions]   = useState<{ value: string; label: string }[]>([])
  const [selectedUsers, setSelectedUsers]   = useState<string[]>([])
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const openAddMember = () => {
    getUsers({ page_size: 100, is_active: true, role_code: 'TL' })
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
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Experiments</div>
              <div className={styles.statValue}>{exps.length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Approved</div>
              <div className={styles.statValue}>{exps.filter(e => e.status === 'APPROVED').length}</div>
            </div>
            <div className={styles.statCard}>
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

              {/* 2-column info grid */}
              <div className={styles.infoGrid}>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Code</span>
                  <span className={styles.infoCellVal}>{project.code}</span>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Name</span>
                  <span className={styles.infoCellVal}>{project.name}</span>
                </div>
                {project.product_name && (
                  <div className={styles.infoCell}>
                    <span className={styles.infoCellKey}>Product</span>
                    <span className={styles.infoCellVal}>{project.product_name}</span>
                  </div>
                )}
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Type</span>
                  <span className={styles.infoCellVal}>{project.project_type ?? '—'}</span>
                </div>
                {project.market && (
                  <div className={styles.infoCell}>
                    <span className={styles.infoCellKey}>Market</span>
                    <span className={styles.infoCellVal}>{project.market}</span>
                  </div>
                )}
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Department</span>
                  <span className={styles.infoCellVal}>{project.department?.name ?? '—'}</span>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Manager</span>
                  <span className={styles.infoCellVal}>{project.manager?.display_name ?? '—'}</span>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Start Date</span>
                  <span className={styles.infoCellVal}>{formatDisplayDate(project.start_date)}</span>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Target Date</span>
                  <span className={styles.infoCellVal}>{formatDisplayDate(project.target_date)}</span>
                </div>
                <div className={styles.infoCell}>
                  <span className={styles.infoCellKey}>Status</span>
                  <span className={styles.infoCellVal}>
                    <StatusTag status={project.status} label={STATUS_LABEL[project.status] ?? project.status} />
                  </span>
                </div>
                {project.description && (
                  <div className={styles.infoCellFull}>
                    <span className={styles.infoCellKey}>Description</span>
                    <span className={styles.infoCellVal}>{project.description}</span>
                  </div>
                )}
              </div>

              {/* Objective section */}
              <div className={styles.objectiveSection}>
                <div className={styles.objectiveHeader}>
                  <span className={styles.objectiveTitle}>Objective</span>
                  {project.objective && !objEditMode && canEdit && (
                    <Button
                      type="text" size="small" icon={<EditOutlined />}
                      style={{ color: '#5aa3a1' }}
                      onClick={() => { setObjDraft(project.objective ?? ''); setObjEditMode(true) }}
                    />
                  )}
                </div>

                {objEditMode ? (
                  <div>
                    <RichTextEditor
                      value={objDraft}
                      onChange={setObjDraft}
                      minHeight={140}
                      placeholder="Describe the project objective…"
                    />
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <Button
                        type="primary" size="small"
                        loading={objSaving}
                        onClick={handleSaveObjective}
                        style={{ background: '#5aa3a1', borderColor: '#5aa3a1' }}
                      >
                        Save
                      </Button>
                      <Button size="small" onClick={() => { setObjEditMode(false); setObjDraft(project.objective ?? '') }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : project.objective ? (
                  <div
                    className={styles.objectiveContent}
                    dangerouslySetInnerHTML={{ __html: project.objective }}
                  />
                ) : (
                  <div className={styles.objectiveEmpty}>
                    <span>No objective set yet.</span>
                    {canEdit && (
                      <Button
                        size="small" type="dashed"
                        onClick={() => { setObjDraft(''); setObjEditMode(true) }}
                        style={{ marginTop: 8 }}
                      >
                        + Add Objective
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Observation section */}
              <div className={styles.objectiveSection}>
                <div className={styles.objectiveHeader}>
                  <span className={styles.objectiveTitle}>Observation</span>
                  {project.observation && !obsEditMode && canEdit && (
                    <Button
                      type="text" size="small" icon={<EditOutlined />}
                      style={{ color: '#5aa3a1' }}
                      onClick={() => { setObsDraft(project.observation ?? ''); setObsEditMode(true) }}
                    />
                  )}
                </div>

                {obsEditMode ? (
                  <div>
                    <RichTextEditor
                      value={obsDraft}
                      onChange={setObsDraft}
                      minHeight={140}
                      placeholder="Describe project observations…"
                    />
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <Button
                        type="primary" size="small"
                        loading={obsSaving}
                        onClick={handleSaveObservation}
                        style={{ background: '#5aa3a1', borderColor: '#5aa3a1' }}
                      >
                        Save
                      </Button>
                      <Button size="small" onClick={() => { setObsEditMode(false); setObsDraft(project.observation ?? '') }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : project.observation ? (
                  <div
                    className={styles.objectiveContent}
                    dangerouslySetInnerHTML={{ __html: project.observation }}
                  />
                ) : (
                  <div className={styles.objectiveEmpty}>
                    <span>No observation set yet.</span>
                    {canEdit && (
                      <Button
                        size="small" type="dashed"
                        onClick={() => { setObsDraft(''); setObsEditMode(true) }}
                        style={{ marginTop: 8 }}
                      >
                        + Add Observation
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Team Members */}
            <div className={styles.card}>
              <div className={styles.cardTitleRow}>
                <div className={styles.cardTitle}>Team Lead</div>
                {canEdit && (
                  <Button type="text" size="small"
                    icon={<Plus size={16} strokeWidth={2.5} aria-hidden />}
                    style={{ color: '#5aa3a1' }} onClick={openAddMember}
                    aria-label="Add team member" />
                )}
              </div>
              {members.length === 0
                ? (
                  <ProjectEmptyState
                    compact
                    message={canEdit
                      ? 'No team members yet. Click the + button above to add members.'
                      : 'No team members yet.'}
                  />
                )
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
            {exps.length === 0 ? (
              <ProjectEmptyState
                compact
                message="No experiments yet for this project."
              />
            ) : (
            <Table<ExperimentSummary>
              className={styles.table}
              columns={expColumns}
              dataSource={exps.map(e => ({ ...e, key: e.id }))}
              size="small"
              pagination={false}
              onRow={row => ({ onClick: () => navigate(`/experiments/${row.id}`) })}
            />
            )}
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

      {/* Edit Project Modal */}
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
