import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Spin, Button, Modal, Form, Input, Select, Table, Popconfirm, message, Tabs, Tooltip,
} from 'antd'
import { ArrowLeft, UserPlus, X, Plus, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import {
  cgtNotebookApi, cgtExperimentApi,
  type CgtNotebook, type CgtExperiment, type CgtNotebookAssignedUser,
} from '../../api/cgt'
import { userApi } from '../../api/adc'
import type { TemplateDefinition } from '../admin/templateBuilder/types'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const EXP_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// Only HOD/Team Lead can create experiments or assign chemists/analysts to a
// CGT notebook — mirrors ADC's NotebookOverviewPage (CAN_CREATE_OR_ASSIGN).
const CAN_CREATE_OR_ASSIGN = ['HOD', 'TL']

export default function CgtNotebookPage() {
  const { projectId, notebookId } = useParams<{ projectId: string; notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const canCreateOrAssign = CAN_CREATE_OR_ASSIGN.includes(user?.role_code ?? '')

  const [assignModal, setAssignModal] = useState(false)
  const [expModal, setExpModal] = useState(false)
  const [expTitle, setExpTitle] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [editingAssign, setEditingAssign] = useState(false)
  const [pendingRemoveIds, setPendingRemoveIds] = useState<Set<string>>(new Set())

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

  const { data: assignedUsers = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ['cgt-notebook-assigned', notebookId],
    queryFn: () => cgtNotebookApi.getAssignedUsers(notebookId!),
    enabled: !!notebookId,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-search', userSearch],
    queryFn: () => userApi.list({ search: userSearch || undefined, limit: 30 }),
    enabled: assignModal,
  })
  const users = usersData?.items ?? []

  const createExp = useMutation({
    mutationFn: (title: string) => cgtExperimentApi.createForNotebook(notebookId!, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      setExpModal(false)
      setExpTitle('')
      message.success('Experiment created')
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const assignUser = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map(userId => cgtNotebookApi.assignUser(notebookId!, userId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-notebook-assigned', notebookId] })
      setAssignModal(false)
      setUserSearch('')
      setSelectedUsers([])
      message.success('Chemist(s) assigned')
    },
    onError: () => message.error('Failed to assign one or more chemists'),
  })

  const unassignUser = useMutation({
    mutationFn: (userId: string) => cgtNotebookApi.unassignUser(notebookId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cgt-notebook-assigned', notebookId] }),
  })

  const saveAssignmentEdits = useMutation({
    mutationFn: (userIds: string[]) =>
      Promise.all(userIds.map(userId => cgtNotebookApi.unassignUser(notebookId!, userId))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-notebook-assigned', notebookId] })
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

  if (loadingNb) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const snapshot = nb.template_snapshot as TemplateDefinition | null | undefined
  const sections = snapshot?.sections ?? []
  const total = experiments.length

  const expColumns = [
    {
      title: 'CODE', dataIndex: 'full_code', key: 'code', width: 160,
      render: (v: string) => <span className=" text-xs font-semibold text-violet-700">{v}</span>,
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
      render: (_: unknown, row: CgtExperiment) => (
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${notebookId}/experiments/${row.id}`)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
        >
          <Eye size={14} />
        </button>
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

      {/* <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="  text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded">{nb.code}</span>
          <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag>
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{nb.title}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {nb.template_name ? `${nb.template_name} (v${nb.template_version})` : 'No template'} · {sections.length} section{sections.length !== 1 ? 's' : ''}
        </p>
      </div> */}

      <Tabs
        tabBarStyle={{ fontSize: 13 }}
        items={[
          {
            key: 'recent-experiments',
            label: 'Recent Experiments',
            children: (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 lg:px-7 py-3 lg:py-4 border-b border-slate-100">
                    <h2 className="text-sm lg:text-base font-bold text-slate-700">
                      Recent Experiments
                      {total > 0 && (
                        <span className="ml-2 text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">{total}</span>
                      )}
                    </h2>
                    {canCreateOrAssign && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<Plus size={12} />}
                        onClick={() => setExpModal(true)}
                      >
                        New Experiment
                      </Button>
                    )}
                  </div>
                  <Table
                    dataSource={experiments as CgtExperiment[]}
                    columns={expColumns}
                    rowKey="id"
                    loading={loadingExp}
                    size="small"
                    pagination={{ pageSize: 10, hideOnSinglePage: true }}
                    locale={{ emptyText: 'No experiments yet.' }}
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm lg:text-base font-bold text-slate-700">Assign Chemist</h2>
                    {canCreateOrAssign && (
                      <div className="flex items-center gap-2">
                        {editingAssign ? (
                          <>
                            <Button size="small" onClick={cancelEditAssign}>Cancel</Button>
                            <Button
                              size="small"
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
                              type="primary"
                              icon={<UserPlus size={12} />}
                              onClick={() => setAssignModal(true)}
                            >
                              Assign
                            </Button>
                            <Button
                              size="small"
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
                      {assignedUsers
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
                    { label: 'Title', value: nb.title },
                    { label: 'Project', value: nb.project_code
                      ? <span className="text-violet-600 font-medium">{nb.project_code}</span>
                      : '—' },
                    { label: 'Creator', value: nb.created_by_name || '—' },
                    { label: 'Created', value: dayjs(nb.created_at).format('DD MMM YYYY') },
                    { label: 'Status', value: <Tag color={nb.status === 'ACTIVE' ? 'green' : 'default'}>{nb.status}</Tag> },
                    { label: 'Template', value: nb.template_name
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
        ]}
      />

      {/* New Experiment */}
      <Modal
        title={`New Experiment${nb.template_name ? ` — ${nb.template_name}` : ''}`}
        open={expModal}
        onCancel={() => { setExpModal(false); setExpTitle('') }}
        onOk={() => { if (expTitle.trim()) createExp.mutate(expTitle.trim()) }}
        okText="Create"
        okButtonProps={{ disabled: !expTitle.trim() }}
        confirmLoading={createExp.isPending}
        centered
        destroyOnHidden
      >
        <Form layout="vertical" className="mt-3" onFinish={() => { if (expTitle.trim()) createExp.mutate(expTitle.trim()) }}>
          <Form.Item label="Experiment Title" required>
            <Input
              value={expTitle}
              onChange={e => setExpTitle(e.target.value)}
              placeholder="e.g. Seed Media Preparation"
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Chemist */}
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
              .filter(u => !assignedUsers.some((a: CgtNotebookAssignedUser) => a.user_id === u.id))
              .map(u => ({ value: u.id, label: `${u.username} (${u.emp_no || 'N/A'})` }))}
            loading={assignUser.isPending}
          />
          {assignedUsers.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-2">Currently assigned:</p>
              <div className="space-y-1.5">
                {assignedUsers.map(u => (
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
    </div>
  )
}
