import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Spin, Button, Modal, Form, Input, Select, Table, Popconfirm, message,
} from 'antd'
import {
  ArrowLeft, UserPlus, X, Plus, Eye, Pencil,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  notebookApi, experimentApi, userApi,
  type Experiment, type NotebookAssignedUser,
} from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'

interface TemplateSection { key: string; title: string; screens: unknown[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const EXP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

export default function NotebookOverviewPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [editModal,    setEditModal]    = useState(false)
  const [assignModal,  setAssignModal]  = useState(false)
  const [expModal,     setExpModal]     = useState(false)
  const [expTitle,     setExpTitle]     = useState('')
  const [userSearch,   setUserSearch]   = useState('')
  const [editForm] = Form.useForm()

  // Notebook data
  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })

  // Experiments
  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['notebook-experiments', notebookId],
    queryFn:  () => experimentApi.listForNotebook(notebookId!),
    enabled:  !!notebookId,
  })

  // Assigned users
  const { data: assignedUsers = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ['notebook-assigned', notebookId],
    queryFn:  () => notebookApi.getAssignedUsers(notebookId!),
    enabled:  !!notebookId,
  })

  // Users for picker
  const { data: usersData } = useQuery({
    queryKey: ['users-search', userSearch],
    queryFn:  () => userApi.list({ search: userSearch || undefined, limit: 30 }),
    enabled:  assignModal,
  })
  const users = usersData?.items ?? []

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

  const assignUser = useMutation({
    mutationFn: (userId: string) => notebookApi.assignUser(notebookId!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-assigned', notebookId] })
      setAssignModal(false)
      setUserSearch('')
      message.success('Chemist assigned')
    },
  })

  const unassignUser = useMutation({
    mutationFn: (userId: string) => notebookApi.unassignUser(notebookId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebook-assigned', notebookId] }),
  })

  const createExp = useMutation({
    mutationFn: (title: string) =>
      experimentApi.createForNotebook(notebookId!, { title }),
    onSuccess: (exp) => {
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setExpModal(false)
      setExpTitle('')
      navigate(`/notebooks/${notebookId}/experiments/${exp.id}`)
    },
    onError: () => message.error('Failed to create experiment'),
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

  const expColumns = [
    {
      title: 'CODE', dataIndex: 'full_code', key: 'code', width: 180,
      render: (v: string) => <span className="font-mono text-xs font-semibold text-teal-700">{v}</span>,
    },
    {
      title: 'TITLE', dataIndex: 'title', key: 'title',
      render: (v: string) => <span className="text-sm text-slate-700">{v || '—'}</span>,
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={EXP_STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'DATE', dataIndex: 'created_at', key: 'date', width: 120,
      render: (v: string) => <span className="text-xs text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'ACTIONS', key: 'actions', width: 80,
      render: (_: unknown, row: Experiment) => (
        <button
          onClick={() => navigate(`/notebooks/${notebookId}/experiments/${row.id}`)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8">
      {/* Back + header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-600 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <Button
          type="primary"
          icon={<Pencil size={13} />}
          onClick={() => {
            editForm.setFieldsValue({ title: nb.title, description: nb.description })
            setEditModal(true)
          }}
        >
          Edit
        </Button>
      </div>

      {/* Notebook title */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{nb.code}</span>
          <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag>
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{nb.title}</h1>
        {nb.description && <p className="text-sm lg:text-base text-slate-500 mt-0.5">{nb.description}</p>}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'TOTAL EXPERIMENTS', value: total,     border: 'border-l-teal-500' },
          { label: 'DRAFT',             value: draft,     border: 'border-l-slate-400' },
          { label: 'SUBMITTED',         value: submitted, border: 'border-l-amber-400' },
          { label: 'APPROVED',          value: approved,  border: 'border-l-emerald-500' },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${s.border} p-4 lg:p-6`}>
            <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className="text-3xl lg:text-4xl font-bold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Two-column: breakdown + info */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
        {/* Experiment Status Breakdown */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
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

        {/* Notebook Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm lg:text-base font-bold text-slate-700">Notebook Info</h2>
            <Button
              size="small"
              type="primary"
              icon={<UserPlus size={12} />}
              onClick={() => setAssignModal(true)}
            >
              Assign Chemist
            </Button>
          </div>

          <div className="space-y-3 lg:space-y-4 text-sm lg:text-base">
            {[
              { label: 'Notebook Code', value: <span className="font-mono text-xs font-semibold">{nb.code}</span> },
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
              { label: 'Assigned To',   value: loadingAssigned
                ? <span className="text-slate-300 text-xs">Loading…</span>
                : assignedUsers.length === 0
                  ? <span className="text-slate-400 italic text-xs">No users assigned</span>
                  : (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(assignedUsers as NotebookAssignedUser[]).map(u => (
                        <span key={u.user_id} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          {u.username}
                          <Popconfirm
                            title="Remove this chemist?"
                            onConfirm={() => unassignUser.mutate(u.user_id)}
                            okText="Remove"
                            okButtonProps={{ danger: true }}
                          >
                            <button className="hover:text-red-500"><X size={10} /></button>
                          </Popconfirm>
                        </span>
                      ))}
                    </div>
                  )
              },
            ].map(row => (
              <div key={row.label} className="flex gap-2">
                <span className="text-slate-400 w-28 lg:w-36 shrink-0">{row.label}</span>
                <span className="text-slate-700 font-medium flex-1">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Experiments */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 lg:px-7 py-3 lg:py-4 border-b border-slate-100">
          <h2 className="text-sm lg:text-base font-bold text-slate-700">
            Recent Experiments
            {total > 0 && (
              <span className="ml-2 text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{total}</span>
            )}
          </h2>
          <div className="flex gap-2">
            <Button
              size="small"
              type="primary"
              icon={<Plus size={12} />}
              onClick={() => setExpModal(true)}
            >
              New Experiment
            </Button>
          </div>
        </div>
        <Table
          dataSource={experiments as Experiment[]}
          columns={expColumns}
          rowKey="id"
          loading={loadingExp}
          size="small"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: 'No experiments yet.' }}
        />
      </div>

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

      {/* Assign Chemist Modal */}
      <Modal
        title="Assign Chemist"
        open={assignModal}
        onCancel={() => { setAssignModal(false); setUserSearch('') }}
        footer={null}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <div className="mt-3 space-y-3">
          <Select
            showSearch
            placeholder="Search user..."
            className="w-full"
            onSearch={setUserSearch}
            filterOption={false}
            options={users
              .filter(u => !(assignedUsers as NotebookAssignedUser[]).some(a => a.user_id === u.id))
              .map(u => ({ value: u.id, label: `${u.username} (${u.emp_no || 'N/A'})` }))}
            onSelect={(userId: string) => assignUser.mutate(userId)}
            loading={assignUser.isPending}
          />
          {(assignedUsers as NotebookAssignedUser[]).length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Currently assigned:</p>
              <div className="space-y-1.5">
                {(assignedUsers as NotebookAssignedUser[]).map(u => (
                  <div key={u.user_id} className="flex items-center justify-between py-1 px-3 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{u.username}</span>
                    <Popconfirm
                      title="Remove this chemist?"
                      onConfirm={() => unassignUser.mutate(u.user_id)}
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                    >
                      <button className="text-slate-300 hover:text-red-500 transition-colors">
                        <X size={13} />
                      </button>
                    </Popconfirm>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* New Experiment */}
      <Modal
        title={`New Experiment${nb.template_name ? ` — ${nb.template_name}` : ''}`}
        open={expModal}
        onCancel={() => { setExpModal(false); setExpTitle('') }}
        onOk={() => { if (expTitle.trim()) createExp.mutate(expTitle.trim()) }}
        okText="Create"
        confirmLoading={createExp.isPending}
        okButtonProps={{ disabled: !expTitle.trim() }}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <div className="mt-3">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Experiment Title <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="e.g. ADC Conjugation Run 1"
            value={expTitle}
            onChange={e => setExpTitle(e.target.value)}
            onPressEnter={() => { if (expTitle.trim()) createExp.mutate(expTitle.trim()) }}
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-2">
            An experiment code will be generated automatically (e.g. EXP-001-01).
          </p>
        </div>
      </Modal>
    </div>
  )
}
