import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, Tag, Table, Tooltip, message, Grid } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, Plus, FolderOpen, Pencil, BookOpen, BookPlus, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtProjectApi, cgtNotebookApi, type CgtNotebook } from '../../api/cgt'
import { ProjectLifecycleActions, LifecycleStatusTag } from '../../components/lifecycle/LifecycleActions'
import { useCan } from '../../hooks/usePrivilege'
import { userApi } from '../../api/adc'
import { templateSettingsApi } from '../../api/templateSettings'
import { StatusTag } from '../../components/ui/StatusTag'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { isQaViewOnly } from '../../utils/privileges'

const { useBreakpoint } = Grid

const NB_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', SUBMITTED: 'gold', APPROVED: 'blue', REJECTED: 'red', ARCHIVED: 'default',
}

// Only HOD/Team Lead can create CGT notebooks — a chemist/analyst who
// created one themselves would otherwise immediately lose access to it
// (assert_cgt_notebook_access blocks anyone not yet explicitly assigned).
const CAN_CREATE_NOTEBOOK = ['HOD', 'TL']

// Renders the avatars of the Team Lead(s) assigned to a notebook — mirrors
// ADC's NotebookAssignedTLCell. Fetches per-row so the column reflects live
// assignment state without bloating the notebook list payload.
function CgtNotebookAssignedTLCell({ notebookId }: { notebookId: string }) {
  const { data: assignedUsers = [] } = useQuery({
    queryKey: ['cgt-notebook-assigned-users', notebookId],
    queryFn:  () => cgtNotebookApi.getAssignedUsers(notebookId),
  })
  if (!assignedUsers.length) {
    return <span className="text-[13px] text-amber-500 italic">Not assigned</span>
  }
  const shown = assignedUsers.slice(0, 3)
  const extra = assignedUsers.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map(u => (
        <Tooltip key={u.user_id} title={u.username}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0 ring-2 ring-white cursor-default">
            <span className="text-white text-[11px] font-bold">
              {(u.username ?? '?').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </Tooltip>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 ring-2 ring-white">
          <span className="text-slate-600 text-[10px] font-bold">+{extra}</span>
        </div>
      )}
    </div>
  )
}

// Project detail page for the CGT module — mirrors AdcProjectDetailPage's
// notebook list + "Create Notebook" pattern, but the template picker is
// filtered by the category mapped from this project's `process` (Molecular
// Biology / Plasmid / AAV), instead of ADC's hardcoded single-slug filter.
// Notebook creation and Team Lead assignment happen in one step (create →
// assign), and an edit modal reconciles TL assignment — same as ADC.
export default function CgtProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const screens = useBreakpoint()
  const user = useAppSelector(selectUser)
  const canCreateNotebook = CAN_CREATE_NOTEBOOK.includes(user?.role_code ?? '') && !isQaViewOnly(user)

  const [nbModal, setNbModal] = useState(false)
  const [nbForm] = Form.useForm()

  const [editTarget, setEditTarget] = useState<CgtNotebook | null>(null)
  const [editForm] = Form.useForm()

  // Search + debounce — mirrors AdcProjectDetailPage's OverviewTab filter bar
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['cgt-project', projectId],
    queryFn: () => cgtProjectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: notebooks = [], isLoading: loadingNb } = useQuery({
    queryKey: ['cgt-notebooks', projectId],
    queryFn: () => cgtNotebookApi.listForProject(projectId!),
    enabled: !!projectId,
  })

  const canCloseProject = useCan('cgt.project.close')
  const canReopenProject = useCan('cgt.project.reopen')
  const canDeactivateProject = useCan('cgt.project.deactivate')
  const allNotebooksDeactivated = notebooks.length > 0 && notebooks.every(nb => nb.status === 'DEACTIVATED')

  const invalidateProject = () => qc.invalidateQueries({ queryKey: ['cgt-project', projectId] })
  const closeProjectMut = useMutation({
    mutationFn: (password: string) => cgtProjectApi.close(projectId!, { password }),
    onSuccess: () => { invalidateProject(); message.success('Project closed.') },
  })
  const reopenProjectMut = useMutation({
    mutationFn: (password: string) => cgtProjectApi.reopen(projectId!, { password }),
    onSuccess: () => { invalidateProject(); message.success('Project reopened.') },
  })
  const deactivateProjectMut = useMutation({
    mutationFn: (password: string) => cgtProjectApi.deactivate(projectId!, { password }),
    onSuccess: () => { invalidateProject(); message.success('Project deactivated.') },
  })

  const { data: templatesData } = useQuery({
    queryKey: ['template-settings-cgt-process-templates-for-process', project?.process],
    queryFn: () => templateSettingsApi.templatesForProcess(project!.process as string),
    enabled: !!project?.process,
    staleTime: 5 * 60 * 1000,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  // Team Leads for the assign-TL picker (CGT department, mirroring ADC's ADC_PD filter)
  const { data: cgtTlUsers = [] } = useQuery({
    queryKey: ['users-cgt-tl'],
    queryFn: () => userApi.list({ role_code: 'TL', dept_code: 'CGT' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Currently assigned TLs for the notebook being edited
  const { data: editAssignedUsers = [] } = useQuery({
    queryKey: ['cgt-notebook-assigned-users', editTarget?.id],
    queryFn:  () => cgtNotebookApi.getAssignedUsers(editTarget!.id),
    enabled:  !!editTarget,
  })

  // Prefill the edit form once the notebook's currently assigned TLs load
  useEffect(() => {
    if (editTarget) {
      editForm.setFieldsValue({ tl_user_ids: editAssignedUsers.map(u => u.user_id) })
    }
  }, [editAssignedUsers, editTarget, editForm])

  const createNb = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { tl_user_ids, ...rest } = vals
      const nb = await cgtNotebookApi.create(projectId!, rest)
      const ids = (tl_user_ids as string[] | undefined) ?? []
      await Promise.all(ids.map(uid => cgtNotebookApi.assignUser(nb.id, uid)))
      return nb
    },
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['cgt-notebooks', projectId] })
      qc.invalidateQueries({ queryKey: ['cgt-notebook-assigned-users', nb.id] })
      setNbModal(false)
      nbForm.resetFields()
      message.success('Notebook created.')
    },
  })

  const openEdit = (nb: CgtNotebook) => {
    setEditTarget(nb)
    editForm.setFieldsValue({ title: nb.title, description: nb.description })
  }

  const editMut = useMutation({
    mutationFn: async (vals: { title: string; description?: string; tl_user_ids?: string[] }) => {
      if (!editTarget) return
      await cgtNotebookApi.update(editTarget.id, { title: vals.title, description: vals.description })
      const nextIds = vals.tl_user_ids ?? []
      const previousIds = editAssignedUsers.map(u => u.user_id)
      const toAdd    = nextIds.filter(uid => !previousIds.includes(uid))
      const toRemove = previousIds.filter(uid => !nextIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => cgtNotebookApi.assignUser(editTarget.id, uid)),
        ...toRemove.map(uid => cgtNotebookApi.unassignUser(editTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-notebooks', projectId] })
      qc.invalidateQueries({ queryKey: ['cgt-notebook-assigned-users', editTarget?.id] })
      message.success('Notebook updated.')
      setEditTarget(null)
      editForm.resetFields()
    },
    onError: () => message.error('Failed to update notebook'),
  })

  const filteredNotebooks = searchTerm
    ? notebooks.filter(nb =>
        [nb.code, nb.title, nb.status, nb.template_name]
          .some(v => v != null && String(v).toLowerCase().includes(searchTerm))
      )
    : notebooks

  const NB_COL_WIDTH = 150

  const nbColumns: ColumnsType<CgtNotebook> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: NB_COL_WIDTH,
      sorter: (a, b) => a.code.localeCompare(b.code),
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: NB_COL_WIDTH,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Template', dataIndex: 'template_name', key: 'template_name', width: NB_COL_WIDTH,
      sorter: (a, b) => (a.template_name ?? '').localeCompare(b.template_name ?? ''),
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Assigned TL', key: 'assigned_tl', width: NB_COL_WIDTH,
      render: (_: unknown, row: CgtNotebook) => <CgtNotebookAssignedTLCell notebookId={row.id} />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: NB_COL_WIDTH,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <StatusTag color={NB_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: NB_COL_WIDTH,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: NB_COL_WIDTH, align: 'center',
      render: (_: unknown, row: CgtNotebook) => (
        <div className="flex items-center justify-center gap-1">
          {canCreateNotebook && (
            <Tooltip title="Edit notebook">
              <button
                onClick={() => openEdit(row)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
              >
                <Pencil size={13} />
              </button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-4">
      {/* Breadcrumb */}
      {/* <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/cgt/projects')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => navigate('/cgt/projects')}>
          CGT Projects
        </span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-700">{project?.name ?? '…'}</span>
      </div> */}

      {/* Header */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
          <FolderOpen size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">{project?.name ?? (loadingProject ? 'Loading…' : 'Project')}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="  text-xs">{project?.code}</span>
            {project?.process && <Tag color="purple">{project.process}</Tag>}
            {project && <LifecycleStatusTag status={project.status} />}
          </p>
        </div>
        {project && (
          <ProjectLifecycleActions
            status={project.status}
            canClose={canCloseProject}
            canReopen={canReopenProject}
            canDeactivate={canDeactivateProject}
            allNotebooksDeactivated={allNotebooksDeactivated}
            onClose={p => closeProjectMut.mutateAsync(p)}
            onReopen={p => reopenProjectMut.mutateAsync(p)}
            onDeactivate={p => deactivateProjectMut.mutateAsync(p)}
          />
        )}
      </div>

      {/* Notebooks filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <BookOpen size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebooks</span>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
          {notebooks.length}
        </span>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search notebooks…"
          style={{ width: 240 }}
          allowClear
        />
        {canCreateNotebook && project?.status === 'ACTIVE' && (
          <Button
            type="primary"
            icon={<BookPlus size={14} />}
            onClick={() => setNbModal(true)}
            disabled={!project?.process}
            title={!project?.process ? 'This project has no process set — cannot pick a template' : undefined}
            className="rounded-md font-medium"
          >
            New Notebook
          </Button>
        )}
        {canCreateNotebook && project && project.status !== 'ACTIVE' && (
          <span className="text-[12px] text-slate-400 italic">
            {project.status === 'CLOSED' ? 'Project is closed' : 'Project is deactivated'} — new Notebooks can't be created.
          </span>
        )}
      </div>

      {/* Notebooks table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={filteredNotebooks}
          columns={nbColumns}
          rowKey="id"
          loading={loadingNb}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 5, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} notebooks` }}
          locale={{ emptyText: 'No notebooks yet.' }}
        />
      </div>

      {/* Create Notebook Modal */}
      <Modal
        title="Create Notebook"
        open={nbModal}
        closable={false}
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
            <Input placeholder="e.g. AAV USP Run 1" />
          </Form.Item>
          <Form.Item
            label="Template"
            name="template_id"
            rules={[{ required: true }]}
            help={project?.process ? `Filtered to ${project.process} templates` : undefined}
          >
            <Select
              placeholder="Select a workflow template"
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={templates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
              notFoundContent={!project?.process ? 'Set this project\'s process to see templates' : 'No templates found'}
            />
          </Form.Item>
          <Form.Item label="Team Lead" name="tl_user_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Team Lead(s)"
              allowClear
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cgtTlUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Notebook Modal */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.code}` : 'Edit Notebook'}
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editMut.isPending}
        width={480}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={editForm} layout="vertical" onFinish={vals => editMut.mutate(vals)} className="mt-3">
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. AAV USP Run 1" />
          </Form.Item>
          <Form.Item label="Team Lead" name="tl_user_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Team Lead(s)"
              allowClear
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cgtTlUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
