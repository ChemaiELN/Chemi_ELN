import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Modal, Form, Input, Select, Tag, Spin, Tabs,
  Table, Tooltip, Popconfirm, message,
} from 'antd'
import {
  ArrowLeft, Plus, ChevronRight,
  UserPlus, X, UserCircle2,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  projectApi, notebookApi, workflowTemplateApi, userApi,
  type Project, type Notebook, type ProjectMember,
} from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import RichEditor, { RichDisplay } from '../../components/RichEditor'
import ProjectMasterTab       from './tabs/ProjectMasterTab'
import RelatedDocumentsTab    from './tabs/RelatedDocumentsTab'
import RegulatoryTab          from './tabs/RegulatoryTab'
import RiskAssessmentTab      from './tabs/RiskAssessmentTab'
import SchemeTab              from './tabs/SchemeTab'

// ── Status colours ─────────────────────────────────────────────────────────────
const NB_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', IN_PROGRESS: 'blue', SUBMITTED: 'gold',
  APPROVED: 'green', REJECTED: 'red', CLOSED: 'purple',
}
const PROJ_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green', ON_HOLD: 'orange', COMPLETED: 'blue',
  CANCELLED: 'red', ARCHIVED: 'default',
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ project, projectId }: { project: Project; projectId: string }) {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const [nbModal,     setNbModal]     = useState(false)
  const [memberModal, setMemberModal] = useState(false)
  const [obsEditing,  setObsEditing]  = useState(false)
  const [obsText,     setObsText]     = useState(project.observation ?? '')
  const [nbForm]     = Form.useForm()
  const [memberForm] = Form.useForm()

  // Notebooks
  const { data: notebooks = [], isLoading: loadingNb } = useQuery({
    queryKey: ['adc-notebooks', projectId],
    queryFn:  () => notebookApi.listForProject(projectId),
  })

  // Templates for notebook modal
  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn:  () => workflowTemplateApi.list({ is_active: true }),
    staleTime: 5 * 60 * 1000,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  // Team members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['adc-project-members', projectId],
    queryFn:  () => projectApi.listMembers(projectId),
  })

  // Users for member picker
  const [userSearch, setUserSearch] = useState('')
  const { data: usersData } = useQuery({
    queryKey: ['users-search', userSearch],
    queryFn:  () => userApi.list({ search: userSearch || undefined, limit: 30 }),
    enabled:  memberModal,
  })
  const users = usersData?.items ?? []

  // Mutations
  const createNb = useMutation({
    mutationFn: (vals: Record<string, unknown>) => notebookApi.create(projectId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-notebooks', projectId] })
      setNbModal(false)
      nbForm.resetFields()
    },
  })

  const addMember = useMutation({
    mutationFn: (vals: { user_id: string; role?: string }) =>
      projectApi.addMember(projectId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project-members', projectId] })
      setMemberModal(false)
      memberForm.resetFields()
    },
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adc-project-members', projectId] }),
  })

  const saveObs = useMutation({
    mutationFn: () => projectApi.update(projectId, { observation: obsText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      setObsEditing(false)
      message.success('Observation saved')
    },
  })

  const nbColumns = [
    {
      title: 'CODE', dataIndex: 'code', key: 'code', width: 120,
      render: (v: string) => <span className="font-mono text-xs font-semibold text-slate-700">{v}</span>,
    },
    {
      title: 'TITLE', dataIndex: 'title', key: 'title',
      render: (v: string, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="text-sm font-medium text-indigo-600 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'TEMPLATE', dataIndex: 'template_name', key: 'template_name', width: 200,
      render: (v: string) => v
        ? <span className="text-xs text-slate-600">{v}</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={NB_STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'CREATED', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: (v: string) => <span className="text-xs text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: '', key: 'action', width: 44,
      render: (_: unknown, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex gap-5 lg:gap-8 items-start">
      {/* Left — Project Info + Notebooks */}
      <div className="flex-1 min-w-0 space-y-5 lg:space-y-6">
        {/* Project Info card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
          <h2 className="text-sm lg:text-base font-bold text-slate-700 mb-4 lg:mb-5">Project Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-4 lg:gap-y-5">
            {[
              { label: 'CODE',        value: project.code },
              { label: 'NAME',        value: project.name },
              { label: 'PRODUCT',     value: project.product_name },
              { label: 'TYPE',        value: project.project_type,
                render: (v: string) => v ? <Tag color={v === 'External' ? 'red' : 'cyan'}>{v}</Tag> : '—' },
              { label: 'MARKET',      value: project.market || project.customer },
              { label: 'DEPARTMENT',  value: project.department_name },
              { label: 'MANAGER',     value: project.manager_id ? '—' : '—' },
              { label: 'START DATE',  value: project.start_date ? dayjs(project.start_date).format('DD MMM YYYY') : '—' },
              { label: 'TARGET DATE', value: project.target_date ? dayjs(project.target_date).format('DD MMM YYYY') : '—' },
            ].map(f => (
              <div key={f.label}>
                <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-0.5">{f.label}</p>
                <div className="text-sm lg:text-base font-medium text-slate-800">
                  {f.render ? f.render(f.value as string) : (f.value || '—')}
                </div>
              </div>
            ))}
            {/* Status — full row */}
            <div>
              <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-0.5">STATUS</p>
              <Tag color={PROJ_STATUS_COLOR[project.status] ?? 'default'}>{project.status}</Tag>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">DESCRIPTION</p>
              <p className="text-sm lg:text-base text-slate-700">{project.description}</p>
            </div>
          )}

          {/* Objective */}
          {project.objective && (
            <div className="mt-3">
              <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">OBJECTIVE</p>
              <p className="text-sm lg:text-base text-slate-700">{project.objective}</p>
            </div>
          )}

          {/* Observation */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">OBSERVATION</p>
            {obsEditing ? (
              <div className="space-y-2">
                <RichEditor
                  value={obsText}
                  onChange={setObsText}
                  placeholder="Enter observation…"
                  minHeight={100}
                />
                <div className="flex gap-2">
                  <Button size="small" type="primary" loading={saveObs.isPending} onClick={() => saveObs.mutate()}>
                    Save
                  </Button>
                  <Button size="small" onClick={() => { setObsEditing(false); setObsText(project.observation ?? '') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {project.observation
                  ? <RichDisplay html={project.observation} />
                  : <p className="text-sm text-slate-400 italic">No observation set yet.</p>
                }
                <button
                  onClick={() => setObsEditing(true)}
                  className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus size={11} /> {project.observation ? 'Edit' : 'Add'} Observation
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Notebooks */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 lg:px-7 py-3 lg:py-4 border-b border-slate-100">
            <h2 className="text-sm lg:text-base font-bold text-slate-700">Notebooks</h2>
            <Button
              type="primary" size="small"
              icon={<Plus size={12} />}
              onClick={() => setNbModal(true)}
            >
              New Notebook
            </Button>
          </div>
          <Table
            dataSource={notebooks as Notebook[]}
            columns={nbColumns}
            rowKey="id"
            loading={loadingNb}
            size="small"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{ emptyText: 'No notebooks yet.' }}
          />
        </div>
      </div>

      {/* Right — Team Lead panel */}
      <div className="w-64 lg:w-80 xl:w-96 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-4 lg:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm lg:text-base font-bold text-slate-700">Team Lead</h2>
            <Tooltip title="Add member">
              <button
                onClick={() => setMemberModal(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
              >
                <Plus size={14} />
              </button>
            </Tooltip>
          </div>

          {loadingMembers ? (
            <div className="flex justify-center py-4"><Spin size="small" /></div>
          ) : members.length === 0 ? (
            <div className="text-center py-6">
              <UserCircle2 size={32} className="mx-auto mb-2 text-slate-200" />
              <p className="text-xs text-slate-400">No team members yet.</p>
              <p className="text-xs text-slate-300 mt-0.5">
                Click the <span className="font-bold">+</span> button above to add members.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(members as ProjectMember[]).map(m => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 group"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">
                      {(m.username ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs lg:text-sm font-semibold text-slate-700 truncate">{m.username ?? '—'}</p>
                    {m.role && <p className="text-[10px] lg:text-xs text-slate-400 truncate">{m.role}</p>}
                  </div>
                  <Popconfirm
                    title="Remove this member?"
                    onConfirm={() => removeMember.mutate(m.user_id)}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                  >
                    <button className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                      <X size={13} />
                    </button>
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Notebook Modal */}
      <Modal
        title="Create Notebook"
        open={nbModal}
        onCancel={() => { setNbModal(false); nbForm.resetFields() }}
        onOk={() => nbForm.submit()}
        okText="Create"
        confirmLoading={createNb.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={nbForm} layout="vertical" onFinish={vals => createNb.mutate(vals)} className="mt-3">
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. ADC Synthesis Run 1" />
          </Form.Item>
          <Form.Item label="Workflow Template" name="template_id" rules={[{ required: true }]}>
            <Select
              placeholder="Select a workflow template"
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={templates.map((t: Record<string, unknown>) => ({
                value: t.id,
                label: `${t.name} (v${t.version})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        title={<span className="flex items-center gap-2"><UserPlus size={15} /> Add Team Member</span>}
        open={memberModal}
        onCancel={() => { setMemberModal(false); memberForm.resetFields() }}
        onOk={() => memberForm.submit()}
        okText="Add"
        confirmLoading={addMember.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={memberForm}
          layout="vertical"
          onFinish={vals => addMember.mutate(vals)}
          className="mt-3"
        >
          <Form.Item label="User" name="user_id" rules={[{ required: true, message: 'Select a user' }]}>
            <Select
              showSearch
              placeholder="Search by username…"
              filterOption={false}
              onSearch={setUserSearch}
              options={users.map((u: { id: string; username: string }) => ({
                value: u.id,
                label: u.username,
              }))}
            />
          </Form.Item>
          <Form.Item label="Role" name="role" initialValue="Member">
            <Select
              options={['Team Lead', 'Member', 'Reviewer', 'Observer'].map(v => ({ value: v, label: v }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdcProjectDetailPage() {
  const { projectId }       = useParams<{ projectId: string }>()
  const navigate            = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab           = searchParams.get('tab') ?? 'overview'

  const { data: project, isLoading } = useQuery({
    queryKey: ['adc-project', projectId],
    queryFn:  () => projectApi.get(projectId!),
    enabled:  !!projectId,
  })

  // Register project name in breadcrumb so UUID → project name
  useBreadcrumbLabel(projectId ?? '', project?.name ?? null)

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!project) return <div className="p-6 text-slate-500">Project not found.</div>

  const tabs = [
    { key: 'overview',                  label: 'Overview' },
    { key: 'project-master',            label: 'Project Master' },
    { key: 'related-documents',         label: 'Related Documents' },
    { key: 'regulatory-classification', label: 'Regulatory Classification' },
    { key: 'risk-assessment',           label: 'Risk Assessment' },
    { key: 'scheme',                    label: 'Scheme' },
  ]

  return (
    <div className="p-5 lg:p-8">
      {/* Back */}
      <button
        onClick={() => navigate('/adc/projects')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Projects
      </button>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabs.map(t => ({
          key:      t.key,
          label:    t.label,
          children: (
            <div className="pt-4">
              {t.key === 'overview'
                ? <OverviewTab project={project as Project} projectId={projectId!} />
                : t.key === 'project-master'
                ? <ProjectMasterTab project={project as Project} projectId={projectId!} />
                : t.key === 'related-documents'
                ? <RelatedDocumentsTab project={project as Project} projectId={projectId!} />
                : t.key === 'regulatory-classification'
                ? <RegulatoryTab project={project as Project} projectId={projectId!} />
                : t.key === 'risk-assessment'
                ? <RiskAssessmentTab projectId={projectId!} />
                : <SchemeTab project={project as Project} projectId={projectId!} />
              }
            </div>
          ),
        }))}
      />
    </div>
  )
}
