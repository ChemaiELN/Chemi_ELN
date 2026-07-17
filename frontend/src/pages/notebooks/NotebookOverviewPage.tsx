import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Spin, Button, Modal, Form, Input, Select, Table, Popconfirm, message, Tabs, Tooltip,
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
import { BTN_32 } from '../../utils/buttonSize'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

interface TemplateSection { key: string; title: string; screens: unknown[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const EXP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// Only HOD/Team Lead can create Experiments or assign Chemists/Analysts to a
// notebook — Chemist/Analyst work within notebooks already assigned to them.
const CAN_CREATE_OR_ASSIGN = ['HOD', 'TL']

export default function NotebookOverviewPage() {
  const { notebookId } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const canCreateOrAssign = CAN_CREATE_OR_ASSIGN.includes(user?.role_code ?? '')

  const [editModal,    setEditModal]    = useState(false)
  const [assignModal,  setAssignModal]  = useState(false)
  const [expModal,     setExpModal]     = useState(false)
  const [expTitle,     setExpTitle]     = useState('')
  const [userSearch,    setUserSearch]    = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingAssign, setEditingAssign] = useState(false)
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set())
  const [editForm] = Form.useForm()

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
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map(userId => notebookApi.assignUser(notebookId!, userId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-assigned', notebookId] })
      setAssignModal(false)
      setUserSearch('')
      setSelectedUsers([])
      message.success('Chemist(s) assigned')
    },
    onError: () => message.error('Failed to assign one or more chemists'),
  })

  const unassignUser = useMutation({
    mutationFn: (userId: string) => notebookApi.unassignUser(notebookId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebook-assigned', notebookId] }),
  })

  const saveAssignmentEdits = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map(userId => notebookApi.unassignUser(notebookId!, userId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-assigned', notebookId] })
      setEditingAssign(false)
      setPendingRemoveIds(new Set())
      message.success('Assignments updated')
    },
    onError: () => message.error('Failed to update assignments'),
  })

  const toggleRemoveChemist = (userId: string) => {
    setPendingRemoveIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const cancelEditAssign = () => {
    setEditingAssign(false)
    setPendingRemoveIds(new Set())
  }

  const handleSaveAssignEdits = () => {
    if (pendingRemoveIds.size === 0) { setEditingAssign(false); return }
    saveAssignmentEdits.mutate([...pendingRemoveIds])
  }

  const createExp = useMutation({
    mutationFn: (title: string) =>
      experimentApi.createForNotebook(notebookId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setExpModal(false)
      setExpTitle('')
      message.success('Experiment created')
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
      render: (v: string) => <span className="  text-xs font-semibold text-teal-700">{v}</span>,
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
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <Eye size={14} />
        </button>
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Recent Experiments */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 lg:px-7 py-3 lg:py-4 border-b border-slate-100">
                    <h2 className="text-sm lg:text-base font-bold text-slate-700">
                      Recent Experiments
                      {total > 0 && (
                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{total}</span>
                      )}
                    </h2>
                    {canCreateOrAssign && (
                      <div className="flex gap-2">
                        <Button
                          size="small"
                          style={BTN_32}
                          type="primary"
                          icon={<Plus size={12} />}
                          onClick={() => setExpModal(true)}
                        >
                          New Experiment
                        </Button>
                      </div>
                    )}
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

                {/* Assign Chemist */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm lg:text-base font-bold text-slate-700">Assign Chemist</h2>
                    {canCreateOrAssign && (
                      <div className="flex items-center gap-2">
                        {editingAssign ? (
                          <>
                            <Button size="small" style={BTN_32} onClick={cancelEditAssign}>Cancel</Button>
                            <Button
                              size="small"
                              style={BTN_32}
                              type="primary"
                              loading={saveAssignmentEdits.isPending}
                              onClick={handleSaveAssignEdits}
                            >
                              Save
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="small"
                              style={BTN_32}
                              type="primary"
                              icon={<UserPlus size={12} />}
                              onClick={() => setAssignModal(true)}
                            >
                              Assign
                            </Button>
                            <Button
                              size="small"
                              style={BTN_32}
                              icon={<Pencil size={12} />}
                              disabled={assignedUsers.length === 0}
                              onClick={() => setEditingAssign(true)}
                            >
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {loadingAssigned ? (
                    <div className="flex justify-center py-4"><Spin size="small" /></div>
                  ) : assignedUsers.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No users assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {(assignedUsers as NotebookAssignedUser[])
                        .filter(u => !pendingRemoveIds.has(u.user_id))
                        .map(u => (
                          <div key={u.user_id} className="relative">
                            <Tooltip title={u.username || 'Unknown user'}>
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold cursor-default select-none">
                                {(u.username ?? '?').slice(0, 2).toUpperCase()}
                              </div>
                            </Tooltip>
                            {editingAssign && (
                              <button
                                onClick={() => toggleRemoveChemist(u.user_id)}
                                title="Remove"
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors"
                              >
                                <X size={9} />
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
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
                    <div key={s.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${s.border} p-4 lg:p-6`}>
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

      {/* Assign Chemist Modal */}
      <Modal
        title="Assign Chemist"
        open={assignModal}
        onCancel={() => { setAssignModal(false); setUserSearch(''); setSelectedUsers([]) }}
        onOk={() => { if (selectedUsers.length > 0) assignUser.mutate(selectedUsers) }}
        okText="Assign"
        okButtonProps={{ disabled: selectedUsers.length === 0 }}
        confirmLoading={assignUser.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <div className="mt-3 space-y-3">
          <Select
            mode="multiple"
            showSearch
            allowClear
            placeholder="Search user(s)..."
            className="w-full"
            value={selectedUsers}
            onSearch={setUserSearch}
            onChange={(userIds: string[]) => setSelectedUsers(userIds)}
            filterOption={false}
            options={users
              .filter(u => !(assignedUsers as NotebookAssignedUser[]).some(a => a.user_id === u.id))
              .map(u => ({ value: u.id, label: `${u.username} (${u.emp_no || 'N/A'})` }))}
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
