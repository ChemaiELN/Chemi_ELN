import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Modal, Form, Input, Select, Tag, Spin, Tabs,
  Table, Tooltip, Popconfirm, message, ConfigProvider,
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
import { BTN_32 } from '../../utils/buttonSize'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import ProjectInfoTab         from './tabs/ProjectInfoTab'
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

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
// Only HOD/Team Lead can create Notebooks — Chemist/Analyst work within
// notebooks already created and assigned to them.
const CAN_CREATE_NOTEBOOK = ['HOD', 'TL']

function OverviewTab({ project, projectId }: { project: Project; projectId: string }) {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const user     = useAppSelector(selectUser)
  const canCreateNotebook = CAN_CREATE_NOTEBOOK.includes(user?.role_code ?? '')

  const [nbModal,     setNbModal]     = useState(false)
  const [memberModal, setMemberModal] = useState(false)
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

  // Users for member picker — only TL and Chemist roles
  const { data: usersData } = useQuery({
    queryKey: ['users-member-picker'],
    queryFn:  () => userApi.list({ limit: 100 }),
    enabled:  memberModal,
    staleTime: 5 * 60 * 1000,
  })
  const users = (usersData?.items ?? []).filter(u => {
    const role = (u.role_name ?? '').toLowerCase()
    return role.includes('chemist') || role.includes('team lead')
  })

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
    mutationFn: (vals: { user_ids: string[] }) =>
      Promise.all(vals.user_ids.map(user_id => projectApi.addMember(projectId, { user_id }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project-members', projectId] })
      setMemberModal(false)
      memberForm.resetFields()
    },
    onError: () => message.error('Failed to add one or more team members'),
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => projectApi.removeMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adc-project-members', projectId] }),
  })

  const nbColumns = [
    {
      title: 'CODE', dataIndex: 'code', key: 'code', width: 220,
      render: (v: string) => <span className=" text-xs font-semibold text-slate-700">{v}</span>,
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
    // {
    //   title: 'TEMPLATE', dataIndex: 'template_name', key: 'template_name', width: 200,
    //   render: (v: string) => v
    //     ? <span className="text-xs text-slate-600">{v}</span>
    //     : <span className="text-slate-300 text-xs">—</span>,
    // },
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
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="flex gap-5 lg:gap-8 items-start">
      {/* Left — Notebooks */}
      <div className="flex-1 min-w-0 space-y-5 lg:space-y-6">
        {/* Notebooks */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 lg:px-7 py-3 lg:py-4 border-b border-slate-100">
            <h2 className="text-sm lg:text-base font-bold text-slate-700">Notebooks</h2>
            {canCreateNotebook && (
              <Button
                size="small"
                icon={<Plus size={12} />}
                onClick={() => setNbModal(true)}
                style={{ backgroundColor: '#6366f1cc', border: 'none', color: '#fff', ...BTN_32 }}
                className="font-semibold"
              >
                New Notebook
              </Button>
            )}
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
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors"
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
              options={templates
                .filter((t) => t.slug === 'adc-synthesis-v2')
                .map((t) => ({
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
          <Form.Item label="Users" name="user_ids" rules={[{ required: true, message: 'Select at least one user' }]}>
            <Select
              mode="multiple"
              showSearch
              allowClear
              placeholder="Search by username…"
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={users.map(u => ({
                value: u.id,
                label: u.username,
              }))}
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
    { key: 'project-info',              label: 'Project Info' },
    { key: 'project-master',            label: 'Project Master' },
    { key: 'related-documents',         label: 'Related Documents' },
    { key: 'regulatory-classification', label: 'Regulatory Classification' },
    { key: 'risk-assessment',           label: 'Risk Assessment' },
    { key: 'scheme',                    label: 'Scheme' },
  ]

  return (
    <div className="p-5 lg:p-8">
      {/* Back */}
      {/* <button
        onClick={() => navigate('/adc/projects')}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-indigo-600 mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Projects
      </button> */}

      {/* Tabs */}
      <ConfigProvider theme={{ components: { Tabs: {
        inkBarColor: '#6366f1',
        itemSelectedColor: '#6366f1',
        itemActiveColor: '#6366f1',
        itemHoverColor: '#6366f1',
        titleFontSize: 13,
      }}}}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        tabBarStyle={{ fontSize: 13, marginBottom: 0 }}
        items={tabs.map(t => ({
          key:      t.key,
          label:    t.label,
          children: (
            <div className="pt-4">
              {t.key === 'overview'
                ? <OverviewTab project={project as Project} projectId={projectId!} />
                : t.key === 'project-info'
                ? <ProjectInfoTab project={project as Project} projectId={projectId!} />
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
      </ConfigProvider>
    </div>
  )
}
