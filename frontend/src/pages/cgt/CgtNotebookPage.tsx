import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Button, Modal, Form, Input, Select, Table, message, Tabs, Tooltip, Grid,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import {
  cgtNotebookApi, cgtExperimentApi,
  type CgtExperiment,
} from '../../api/cgt'
import { NotebookLifecycleActions, LifecycleStatusTag } from '../../components/lifecycle/LifecycleActions'
import { useCan } from '../../hooks/usePrivilege'
import { userApi } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'
import type { TemplateDefinition } from '../admin/templateBuilder/types'

const { useBreakpoint } = Grid

const EXP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// Avatars of the chemist(s) assigned to a single experiment — mirrors ADC's
// AssignedChemistCell. Fetches per-row so the column reflects live assignment.
function AssignedChemistCell({ experimentId }: { experimentId: string }) {
  const { data: chemAssigned = [] } = useQuery({
    queryKey: ['cgt-experiment-assigned-users', experimentId],
    queryFn:  () => cgtExperimentApi.getAssignedUsers(experimentId),
  })
  if (!chemAssigned.length) {
    return <span className="text-[13px] text-amber-500 italic">Not assigned</span>
  }
  const shown = chemAssigned.slice(0, 3)
  const extra = chemAssigned.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map(u => (
        <Tooltip key={u.user_id} title={u.username}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center shrink-0 ring-2 ring-white cursor-default">
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

export default function CgtNotebookPage() {
  const { projectId, notebookId } = useParams<{ projectId: string; notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const screens = useBreakpoint()
  // Governed by the cgt.experiment.create department-role privilege (Admin →
  // Department Role Privileges), not a hardcoded role list.
  const canCreateOrAssign = useCan('cgt.experiment.create')

  const [expModal, setExpModal] = useState(false)
  const [expForm] = Form.useForm()

  const [editExpTarget, setEditExpTarget] = useState<CgtExperiment | null>(null)
  const [editExpForm] = Form.useForm()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['cgt-notebook', notebookId],
    queryFn: () => cgtNotebookApi.get(notebookId!),
    enabled: !!notebookId,
  })

  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['cgt-experiments', notebookId],
    queryFn: () => cgtExperimentApi.listForNotebook(notebookId!),
    enabled: !!notebookId,
  })

  const canCloseNb = useCan('cgt.notebook.close')
  const canReopenNb = useCan('cgt.notebook.reopen')
  const canDeactivateNb = useCan('cgt.notebook.deactivate')

  const invalidateNb = () => qc.invalidateQueries({ queryKey: ['cgt-notebook', notebookId] })
  const closeNbMut = useMutation({
    mutationFn: (password: string) => cgtNotebookApi.close(notebookId!, { password }),
    onSuccess: () => { invalidateNb(); message.success('Notebook closed.') },
  })
  const reopenNbMut = useMutation({
    mutationFn: (password: string) => cgtNotebookApi.reopen(notebookId!, { password }),
    onSuccess: () => { invalidateNb(); message.success('Notebook reopened.') },
  })
  const deactivateNbMut = useMutation({
    mutationFn: (password: string) => cgtNotebookApi.deactivate(notebookId!, { password }),
    onSuccess: () => { invalidateNb(); message.success('Notebook deactivated.') },
  })

  // Chemists for the "Assign Chemist" picker (CGT department, mirroring ADC's ADC_PD filter)
  const { data: cgtChemUsers = [] } = useQuery({
    queryKey: ['users-cgt-chem'],
    queryFn: () => userApi.list({ role_code: 'CHEM', dept_code: 'CGT' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Chemists currently assigned to the experiment being edited
  const { data: editExpAssignedUsers = [] } = useQuery({
    queryKey: ['cgt-experiment-assigned-users', editExpTarget?.id],
    queryFn:  () => cgtExperimentApi.getAssignedUsers(editExpTarget!.id),
    enabled:  !!editExpTarget,
  })
  const editExpAssignedChemIds = editExpAssignedUsers.map(u => u.user_id)

  const createExp = useMutation({
    mutationFn: async ({ title, chemistIds }: { title: string; chemistIds: string[] }) => {
      const exp = await cgtExperimentApi.createForNotebook(notebookId!, { title })
      await Promise.all(chemistIds.map(uid => cgtExperimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      setExpModal(false)
      expForm.resetFields()
      message.success('Experiment created')
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const openEditExp = (exp: CgtExperiment) => {
    setEditExpTarget(exp)
  }

  useEffect(() => {
    if (editExpTarget) {
      editExpForm.setFieldsValue({ title: editExpTarget.title, chemist_ids: editExpAssignedChemIds })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editExpTarget, editExpAssignedUsers])

  const editExpMut = useMutation({
    mutationFn: async ({ title, chemistIds }: { title: string; chemistIds: string[] }) => {
      if (!editExpTarget) return
      await cgtExperimentApi.update(editExpTarget.id, { title })
      const toAdd    = chemistIds.filter(uid => !editExpAssignedChemIds.includes(uid))
      const toRemove = editExpAssignedChemIds.filter(uid => !chemistIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => cgtExperimentApi.assignUser(editExpTarget.id, uid)),
        ...toRemove.map(uid => cgtExperimentApi.unassignUser(editExpTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      qc.invalidateQueries({ queryKey: ['cgt-experiment-assigned-users', editExpTarget?.id] })
      message.success('Experiment updated.')
      setEditExpTarget(null)
      editExpForm.resetFields()
    },
    onError: () => message.error('Failed to update experiment'),
  })

  if (loadingNb) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading notebook…" /></div>
  }
  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const snapshot = nb.template_snapshot as TemplateDefinition | null | undefined
  const sections = snapshot?.sections ?? []
  const total = experiments.length

  const filteredExperiments = searchTerm
    ? (experiments as CgtExperiment[]).filter(e =>
        [e.full_code, e.title, e.status]
          .some(v => v != null && String(v).toLowerCase().includes(searchTerm))
      )
    : (experiments as CgtExperiment[])

  const expColumns: ColumnsType<CgtExperiment> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'code', width: 150,
      sorter: (a, b) => a.full_code.localeCompare(b.full_code),
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: (a, b) => (a.title ?? '').localeCompare(b.title ?? ''),
      render: (v: string, row: CgtExperiment) => (
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${notebookId}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {withEmptyValue(v)}
        </button>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <StatusTag color={EXP_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Chemist Assigned', key: 'chemist', width: 160,
      render: (_: unknown, row: CgtExperiment) => <AssignedChemistCell experimentId={row.id} />,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: CgtExperiment) => (
        <div className="flex items-center justify-center gap-1">
          {canCreateOrAssign && (
            <Tooltip title="Edit experiment">
              <button
                onClick={() => openEditExp(row)}
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
    <div className="p-6 lg:p-8">
      {/* <button
        onClick={() => navigate(`/cgt/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-violet-600 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Project
      </button> */}

      {nb && (
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="  text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{nb.code}</span>
              <LifecycleStatusTag status={nb.status} />
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{nb.title}</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {nb.template_name ? `${nb.template_name} (v${nb.template_version})` : 'No template'} · {sections.length} section{sections.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotebookLifecycleActions
              status={nb.status}
              canClose={canCloseNb}
              canReopen={canReopenNb}
              canDeactivate={canDeactivateNb}
              nonApprovedExperimentCount={experiments.filter(e => e.status !== 'APPROVED').length}
              hasAnyExperiment={experiments.length > 0}
              onClose={p => closeNbMut.mutateAsync(p)}
              onReopen={p => reopenNbMut.mutateAsync(p)}
              onDeactivate={p => deactivateNbMut.mutateAsync(p)}
            />
          </div>
        </div>
      )}

      <Tabs
        tabBarStyle={{ fontSize: 13 }}
        items={[
          {
            key: 'recent-experiments',
            label: 'Recent Experiments',
            children: (
              <div className="space-y-3">
                {/* Filter / action bar */}
                <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
                  <span className="text-[13px] font-semibold text-slate-700 shrink-0">Recent Experiments</span>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                    {total}
                  </span>
                  <Input
                    prefix={<Search size={13} className="text-slate-400" />}
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Search experiments…"
                    style={{ width: 240 }}
                    allowClear
                  />
                  {canCreateOrAssign && nb.status !== 'DEACTIVATED' && (
                    <Button
                      type="primary"
                      icon={<Plus size={14} />}
                      onClick={() => setExpModal(true)}
                      className="rounded-md font-medium"
                    >
                      New Experiment
                    </Button>
                  )}
                  {canCreateOrAssign && nb.status === 'DEACTIVATED' && (
                    <span className="text-[12px] text-slate-400 italic">Notebook is deactivated — new Experiments can't be created.</span>
                  )}
                </div>

                {/* Table */}
                <div className="glass-card rounded-lg overflow-hidden">
                  <Table
                    dataSource={filteredExperiments}
                    columns={expColumns}
                    rowKey="id"
                    loading={loadingExp}
                    size={screens.md ? 'middle' : 'small'}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 5, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
                    locale={{ emptyText: 'No experiments yet.' }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'notebook-info',
            label: 'Notebook Info',
            children: (
              <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
                <h2 className="text-sm lg:text-base font-bold text-slate-700 mb-4">Notebook Info</h2>
                <div className="space-y-3 lg:space-y-4 text-sm lg:text-base max-w-xl">
                  {[
                    { label: 'Notebook Code', value: <span className="  text-xs font-semibold">{nb.code}</span> },
                    { label: 'Title', value: nb.title },
                    { label: 'Project', value: nb.project_code
                      ? <span className="text-violet-600 font-medium">{nb.project_code}</span>
                      : <EmptyValue /> },
                    { label: 'Creator', value: withEmptyValue(nb.created_by_name) },
                    { label: 'Created', value: dayjs(nb.created_at).format('DD MMM YYYY') },
                    { label: 'Status', value: <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag> },
                    { label: 'Template', value: nb.template_name
                      ? <Tag color="purple">{nb.template_name}{nb.template_version ? ` v${nb.template_version}` : ''}</Tag>
                      : <EmptyValue /> },
                  ].map(row => (
                    <div key={row.label} className="flex gap-2">
                      <span className="text-slate-400 w-28 lg:w-36 shrink-0">{row.label}</span>
                      <span className="text-slate-700 font-medium flex-1">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* New Experiment — create the experiment and assign chemist(s) in one step */}
      <Modal
        title={`New Experiment${nb.template_name ? ` — ${nb.template_name}` : ''}`}
        open={expModal}
        onCancel={() => { setExpModal(false); expForm.resetFields() }}
        onOk={() => expForm.submit()}
        okText="Create"
        confirmLoading={createExp.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={expForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => createExp.mutate({ title: (vals.title ?? '').trim(), chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Seed Media Preparation" autoFocus />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) => String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
              options={cgtChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <p className="text-xs text-slate-400 -mt-2">
            An experiment code will be generated automatically (e.g. CGT-EXP-001-01).
          </p>
        </Form>
      </Modal>

      {/* Edit Experiment — rename the experiment and change chemist assignment */}
      <Modal
        title={editExpTarget ? `Edit — ${editExpTarget.full_code}` : 'Edit Experiment'}
        open={!!editExpTarget}
        onCancel={() => { setEditExpTarget(null); editExpForm.resetFields() }}
        onOk={() => editExpForm.submit()}
        okText="Save Changes"
        confirmLoading={editExpMut.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editExpForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => editExpMut.mutate({ title: (vals.title ?? '').trim(), chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Seed Media Preparation" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) => String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())}
              options={cgtChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
