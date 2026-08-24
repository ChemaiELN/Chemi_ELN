import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Spin, Button, Modal, Form, Input, Select, Table, Tooltip, message, Tabs,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Search, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { notebookApi, experimentApi, userApi, type Experiment } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { BTN_32 } from '../../utils/buttonSize'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { useCan } from '../../hooks/usePrivilege'

interface TemplateSection { key: string; title: string; screens: unknown[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const EXP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

function AssignedChemistCell({ experimentId }: { experimentId: string }) {
  const { data: chemAssigned = [] } = useQuery({
    queryKey: ['experiment-assigned-users', experimentId],
    queryFn:  () => experimentApi.getAssignedUsers(experimentId),
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

export default function NotebookOverviewPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canCreateExperiment = useCan('adc.experiment.create')

  const [editModal, setEditModal] = useState(false)
  const [expModal,  setExpModal]  = useState(false)
  const [editForm] = Form.useForm()
  const [expForm]  = Form.useForm()

  const [editExpTarget, setEditExpTarget] = useState<Experiment | null>(null)
  const [editExpForm]   = Form.useForm()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Notebook data
  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })
  useBreadcrumbLabel(notebookId ?? '', nb?.title ?? null)

  // Experiments
  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['notebook-experiments', notebookId],
    queryFn:  () => experimentApi.listForNotebook(notebookId!),
    enabled:  !!notebookId,
  })

  // Chemists for the "Assign Chemist" picker inside the New Experiment / Edit modals
  const { data: adcPdChemUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-chem'],
    queryFn: () => userApi.list({ role_code: 'CHEM', dept_code: 'ADC_PD' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Chemists currently assigned to the experiment being edited
  const { data: editExpAssignedUsers = [] } = useQuery({
    queryKey: ['experiment-assigned-users', editExpTarget?.id],
    queryFn:  () => experimentApi.getAssignedUsers(editExpTarget!.id),
    enabled:  !!editExpTarget,
  })
  const editExpAssignedChemIds = editExpAssignedUsers.map(u => u.user_id)

  // Mutations
  const updateNb = useMutation({
    mutationFn: (vals: Record<string, unknown>) => notebookApi.update(notebookId!, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook', notebookId] })
      qc.invalidateQueries({ queryKey: ['notebooks-all'] })
      setEditModal(false)
      message.success('Notebook updated')
    },
  })

  const createExp = useMutation({
    mutationFn: async ({ title, chemistIds }: { title: string; chemistIds: string[] }) => {
      const exp = await experimentApi.createForNotebook(notebookId!, { title })
      await Promise.all(chemistIds.map(uid => experimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setExpModal(false)
      expForm.resetFields()
      message.success('Experiment created')
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const openEditExp = (exp: Experiment) => {
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
      await experimentApi.update(editExpTarget.id, { title })
      const toAdd    = chemistIds.filter(uid => !editExpAssignedChemIds.includes(uid))
      const toRemove = editExpAssignedChemIds.filter(uid => !chemistIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => experimentApi.assignUser(editExpTarget.id, uid)),
        ...toRemove.map(uid => experimentApi.unassignUser(editExpTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      qc.invalidateQueries({ queryKey: ['experiment-assigned-users', editExpTarget?.id] })
      message.success('Experiment updated.')
      setEditExpTarget(null)
      editExpForm.resetFields()
    },
    onError: () => message.error('Failed to update experiment'),
  })

  if (loadingNb) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const snapshot = nb.template_snapshot as TemplateSnapshot | null | undefined
  const sections: TemplateSection[] = snapshot?.sections ?? []

  // Stats
  const total     = experiments.length
  const draft     = experiments.filter((e: Experiment) => e.status === 'DRAFT').length
  const submitted = experiments.filter((e: Experiment) => e.status === 'SUBMITTED').length
  const approved  = experiments.filter((e: Experiment) => e.status === 'APPROVED').length

  // Status breakdown for bar chart
  const statusGroups = [
    { label: 'DRAFT',     count: draft,     color: '#94a3b8' },
    { label: 'SUBMITTED', count: submitted,  color: '#f59e0b' },
    { label: 'APPROVED',  count: approved,   color: '#10b981' },
    { label: 'REJECTED',  count: experiments.filter((e: Experiment) => e.status === 'REJECTED').length, color: '#ef4444' },
  ].filter(g => g.count > 0)

  const filteredExperiments = searchTerm
    ? (experiments as Experiment[]).filter(e =>
        [e.full_code, e.title, e.status].some(v => v && String(v).toLowerCase().includes(searchTerm))
      )
    : (experiments as Experiment[])

  const expColumns: ColumnsType<Experiment> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'code', width: 130,
      sorter: (a, b) => a.full_code.localeCompare(b.full_code),
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: (a, b) => (a.title ?? '').localeCompare(b.title ?? ''),
      render: (v: string, row: Experiment) => (
        <button
          onClick={() => navigate(`/notebooks/${notebookId}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v || '—'}
        </button>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <StatusTag color={EXP_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Date', dataIndex: 'created_at', key: 'date', width: 130,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Chemist Assigned', key: 'chemist', width: 160,
      render: (_: unknown, row: Experiment) => <AssignedChemistCell experimentId={row.id} />,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: Experiment) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit experiment">
            <button
              onClick={() => openEditExp(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Back + header */}
      {/* <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
      </div> */}

      {/* Notebook title */}
      {/* <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="  text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{nb.code}</span>
          <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag>
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{nb.title}</h1>
        {nb.description && <p className="text-sm lg:text-base text-slate-500 mt-0.5">{nb.description}</p>}
      </div> */}

      <Tabs
        tabBarStyle={{ fontSize: 13 }}
        items={[
          {
            key: 'recent-experiments',
            label: 'Recent Experiments',
            children: (
              <div className="space-y-3">
                {/* Filter bar */}
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
                  {canCreateExperiment && (
                    <Button
                      type="primary"
                      icon={<Plus size={14} />}
                      onClick={() => setExpModal(true)}
                      className="rounded-md font-medium"
                    >
                      New Experiment
                    </Button>
                  )}
                </div>

                {/* Table */}
                <div className="glass-card rounded-lg overflow-hidden">
                  <Table
                    dataSource={filteredExperiments}
                    columns={expColumns}
                    rowKey="id"
                    loading={loadingExp}
                    size="small"
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 8, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
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
                    { label: 'Title',         value: nb.title },
                    { label: 'Project',       value: nb.project_code
                      ? <span className="text-teal-600 font-medium">{nb.project_code}</span>
                      : '—' },
                    { label: 'Creator',       value: nb.created_by_name || '—' },
                    { label: 'Created',       value: dayjs(nb.created_at).format('DD MMM YYYY') },
                    { label: 'Status',        value: <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag> },
                    { label: 'Template',      value: nb.template_name
                      ? <Tag color="purple">{nb.template_name}{nb.template_version ? ` v${nb.template_version}` : ''}</Tag>
                      : <span className="text-slate-300">—</span> },
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
          {
            key: 'status',
            label: 'Status',
            children: (
              <div className="space-y-5">
                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'TOTAL EXPERIMENTS', value: total,     border: 'border-l-teal-500' },
                    { label: 'DRAFT',             value: draft,     border: 'border-l-slate-400' },
                    { label: 'SUBMITTED',         value: submitted, border: 'border-l-amber-400' },
                    { label: 'APPROVED',          value: approved,  border: 'border-l-emerald-500' },
                  ].map(s => (
                    <div key={s.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${s.border} p-1 sm:p-2`}>
                      <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                      <p className="text-3xl lg:text-4xl font-bold text-slate-800">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Experiment Status Breakdown */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
                  <h2 className="text-sm lg:text-base font-bold text-slate-700 mb-4">Experiment Status Breakdown</h2>
                  {statusGroups.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No experiments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {statusGroups.map(g => (
                        <div key={g.label} className="flex items-center gap-3">
                          <span className="text-xs lg:text-sm font-semibold text-slate-500 w-20 lg:w-24 shrink-0">{g.label}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: total > 0 ? `${(g.count / total) * 100}%` : '0%',
                                backgroundColor: g.color,
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-4 text-right">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Edit Notebook Modal */}
      <Modal
        title="Edit Notebook"
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={() => editForm.submit()}
        okText="Save"
        confirmLoading={updateNb.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={editForm} layout="vertical" onFinish={vals => updateNb.mutate(vals)} className="mt-3">
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Experiment — create the experiment and assign chemist(s) in one step */}
      <Modal
        title={`New Experiment${nb.template_name ? ` — ${nb.template_name}` : ''}`}
        open={expModal}
        closable={false}
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
          onFinish={vals => createExp.mutate({ title: vals.title, chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ADC Conjugation Run 1" autoFocus />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <p className="text-xs text-slate-400 -mt-2">
            An experiment code will be generated automatically (e.g. EXP-001-01).
          </p>
        </Form>
      </Modal>

      {/* Edit Experiment — rename the experiment and change chemist assignment */}
      <Modal
        title={editExpTarget ? `Edit — ${editExpTarget.full_code}` : 'Edit Experiment'}
        open={!!editExpTarget}
        closable={false}
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
          onFinish={vals => editExpMut.mutate({ title: vals.title, chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. ADC Conjugation Run 1" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
