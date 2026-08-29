import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Tabs, Input, Select, Tag, Spin, Alert, Modal, Table, Form, Radio, Popconfirm, message, Switch, Tooltip, Space, Dropdown,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { ArrowLeft, BookOpen, Plus, Trash2, FileText, Star, Edit2, Eye, Activity, History, MoreHorizontal } from 'lucide-react'
import dayjs from 'dayjs'
import { ardNotebooksApi, type Notebook, type ResultParameter, type AssignedUser, type ExperimentSummary } from '../../api/ard-notebooks'
import { ardProjectsApi, type ProjectStp } from '../../api/ard-projects'
import { ardTemplateApi, ardExperimentApi, ardApi } from '../../api/ard'
import { apiGet, ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useBreadcrumbLabel, useBreadcrumbPrefix } from '../../components/layout/ArdShell'
import RichEditor from '../../components/RichEditor'

const { TextArea } = Input

const STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', CLOSED: 'default', DEACTIVE: 'volcano' }
const EXP_STATUS_COLOR: Record<string, string> = {
  NEW: 'default', IN_PROGRESS: 'blue', SUBMITTED: 'purple', APPROVED: 'green', REWORK: 'red',
  VERIFICATION_REQUESTED: 'gold', VERIFIED: 'cyan', UNLOCKED: 'geekblue', DEACTIVATED: 'default',
}
const EXP_STATUS_LABEL: Record<string, string> = {
  NEW: 'New', IN_PROGRESS: 'Ongoing', SUBMITTED: 'Submitted', APPROVED: 'Approved', REWORK: 'Rework',
  VERIFICATION_REQUESTED: 'Verification Requested', VERIFIED: 'Verified',
  UNLOCK_REQUESTED: 'Unlock Requested', UNLOCKED: 'Unlocked', DEACTIVATED: 'Deactivated',
}
const NOTEBOOK_TYPES = [
  { value: 'ANALYTICAL', label: 'Analytical' },
  { value: 'STABILITY', label: 'Stability' },
  { value: 'METHOD_VALIDATION', label: 'Method Validation' },
  { value: 'OTHER', label: 'Other' },
]

function newId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) }

// Aim is edited via RichEditor (Quill), so it's stored as HTML — the
// Experiments tab's table cell needs the plain-text gist, not raw <p> tags.
function stripHtml(html: string | null | undefined): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Summary tab ───────────────────────────────────────────────────────────────
function SummaryTab({ nb, onSave, saving }: { nb: Notebook; onSave: (patch: Partial<Notebook>) => void; saving: boolean }) {
  // Frozen by default (legacy behavior) — Edit unlocks the fields, Cancel
  // discards local changes and re-freezes without saving.
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(nb.name)
  const [description, setDescription] = useState(nb.description ?? '')
  const [notebookType, setNotebookType] = useState(nb.notebookType ?? '')
  const [includeVerificationFlow, setIncludeVerificationFlow] = useState(nb.includeVerificationFlow ?? true)
  const resetFromNb = () => {
    setName(nb.name)
    setDescription(nb.description ?? '')
    setNotebookType(nb.notebookType ?? '')
    setIncludeVerificationFlow(nb.includeVerificationFlow ?? true)
  }
  useEffect(() => { resetFromNb() }, [nb])

  const handleCancel = () => { resetFromNb(); setIsEditing(false) }
  const handleSave = () => {
    onSave({ name, description, notebookType: notebookType || undefined, includeVerificationFlow })
    setIsEditing(false)
  }

  return (
    <div className="glass-card rounded-lg p-5 md:p-2 space-y-5 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Notebook Code</label>
          <div>
            <span className="inline-flex items-center font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md border border-slate-200/70">
              {nb.code}
            </span>
          </div>
        </div>

        <div className="hidden md:block"></div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Name</label>
          {isEditing ? (
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-lg"
              placeholder="Notebook name"
            />
          ) : (
            <p className="text-sm text-slate-700 font-medium">{nb.name}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Notebook Type</label>
          {isEditing && !nb.notebookType ? (
            // Once a type is set it drives downstream behavior (verification
            // defaults, experiment section templates) — fixed for the life
            // of the notebook, so this dropdown only ever appears the very
            // first time, before any type has been chosen.
            <Select
              value={notebookType || undefined}
              onChange={setNotebookType}
              options={NOTEBOOK_TYPES}
              allowClear
              placeholder="Select type"
              className="w-full rounded-lg"
            />
          ) : (
            <p className="text-sm text-slate-700">{NOTEBOOK_TYPES.find(t => t.value === nb.notebookType)?.label ?? nb.notebookType ?? '—'}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Description</label>
          {isEditing ? (
            <TextArea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="rounded-lg"
              placeholder="Enter notebook description..."
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{nb.description || '—'}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Include Verification Flow</label>
          <div className="flex items-center gap-2">
            <Switch checked={isEditing ? includeVerificationFlow : (nb.includeVerificationFlow ?? true)} onChange={setIncludeVerificationFlow} disabled={!isEditing} />
            <span className="text-xs text-slate-500">
              {(isEditing ? includeVerificationFlow : (nb.includeVerificationFlow ?? true))
                ? 'On — experiments in this notebook go through peer Verification before Approval (2-step).'
                : 'Off — experiments in this notebook go straight to Approval (1-step).'}
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Status</label>
          <Tag color={STATUS_COLOR[nb.status] ?? 'default'} className="px-2.5 py-0.5 text-xs font-medium rounded-md">
            {nb.status}
          </Tag>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Created By / On</label>
          <p className="text-xs text-slate-600 font-medium">
            {nb.createdBy} &nbsp;·&nbsp; {nb.createdAt ? dayjs(nb.createdAt).format('DD MMM YYYY') : '—'}
          </p>
        </div>
      </div>

      {nb.status === 'ACTIVE' && (
        <div className="pt-2 flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button type="primary" loading={saving} onClick={handleSave}>Save Changes</Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ nb, onSave, saving }: { nb: Notebook; onSave: (patch: Partial<Notebook>) => void; saving: boolean }) {
  const [users, setUsers] = useState<AssignedUser[]>(nb.assignedUsers)
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const currentUser = useAppSelector(selectUser)
  const [msgApi, msgCtx] = message.useMessage()
  useEffect(() => setUsers(nb.assignedUsers), [nb.assignedUsers])

  // Fetch Project Team members to populate project analyst options
  const { data: projectData } = useQuery({
    queryKey: ['ard-project', nb.projectId],
    queryFn: () => ardProjectsApi.get(nb.projectId ?? ''),
    enabled: !!nb.projectId,
  })

  // Fetch system users to filter strict analysts
  const { data: usersData } = useQuery({
    queryKey: ['system-users'],
    queryFn: async () => {
      try {
        const res = await apiGet<any>('/api/users', { page_size: 500 })
        return Array.isArray(res) ? res : res?.items ?? []
      } catch {
        return []
      }
    },
  })

  // All project team members (any role) — manual says add any user present in the project
  const projectMembers = useMemo(() => {
    const team = projectData?.team ?? []
    const existingNames = new Set(users.map(u => u.userName))

    if (team.length > 0) {
      return team
        .filter((m: any) => !existingNames.has(m.userName))
        .map((m: any) => ({
          value: m.userName,
          label: `${m.userName} (${m.role || 'Member'})`,
          userName: m.userName,
          userId: m.userId || m.userName,
          role: m.role || 'Analyst',
        }))
    }

    // Fallback to all system users
    return (usersData ?? [])
      .filter((u: any) => !existingNames.has(u.username || u.name))
      .map((u: any) => ({
        value: u.username || u.name,
        label: `${u.username || u.name} (${u.role_code || u.role || 'User'})`,
        userName: u.username || u.name,
        userId: u.id || u.emp_no || u.username,
        role: u.role_code || u.role || 'Analyst',
      }))
  }, [projectData?.team, usersData, users])

  // Automatically include creator Team Lead if missing from assignedUsers
  const effectiveUsers = useMemo(() => {
    const creatorName = nb.createdBy || 'Team Lead'
    const hasCreator = users.some(u => u.userName === creatorName || (u.role && u.role.toLowerCase().includes('lead')))
    if (!hasCreator && creatorName) {
      return [
        {
          userId: `tl-${creatorName}`,
          userName: creatorName,
          role: 'Team Lead (Creator)',
        },
        ...users,
      ]
    }
    return users
  }, [users, nb.createdBy])

  const addUser = (vals: { userNames: string[] }) => {
    const selectedNames = vals.userNames || []
    // Resolve against the authoritative system user list first — a project-team
    // entry's userId can itself be a username fallback, which would never match
    // the real account id checked when the member opens the notebook.
    const systemUserByName = new Map(
      (usersData ?? []).map((u: any) => [u.username || u.name, u.id || u.emp_no])
    )

    const newUsers: AssignedUser[] = []
    const unresolved: string[] = []
    for (const name of selectedNames) {
      const match = projectMembers.find((p: any) => p.value === name)
      const userId = systemUserByName.get(name) || match?.userId
      if (!userId) {
        unresolved.push(name)
        continue
      }
      newUsers.push({
        userId,
        userName: match?.userName || name,
        role: match?.role || 'Analyst',
        canEdit: true,
      })
    }

    if (unresolved.length) {
      msgApi.error(`Could not resolve a system account for: ${unresolved.join(', ')}. They were not added.`)
    }

    const existingNames = new Set(users.map(u => u.userName))
    const uniqueNewUsers = newUsers.filter(u => !existingNames.has(u.userName))
    const next = [...users, ...uniqueNewUsers]
    setUsers(next)
    onSave({ assignedUsers: next })
    setOpen(false)
    form.resetFields()
  }

  // Only HOD/TL (or SUPER_ADMIN) manage notebook membership — matches the
  // project team's own rule. The notebook's own creator/owner is NOT exempt
  // from removal (they can be removed by an HOD/TL like anyone else); the
  // only person who can never remove someone is themself, regardless of role.
  const canManageUsers = ['HOD', 'TL', 'TEAM_LEAD', 'SUPER_ADMIN'].includes((currentUser?.role_code ?? '').toUpperCase())

  const remove = (userId: string) => {
    if (userId === currentUser?.id) {
      msgApi.warning('You cannot remove yourself from the notebook.')
      return
    }
    const next = users.filter(u => u.userId !== userId)
    setUsers(next)
    onSave({ assignedUsers: next })
  }

  const toggleCanEdit = (userId: string, checked: boolean) => {
    const next = users.map(u => u.userId === userId ? { ...u, canEdit: checked } : u)
    setUsers(next)
    onSave({ assignedUsers: next })
  }

  const cols: ColumnsType<AssignedUser> = [
    { title: 'User Name', dataIndex: 'userName', key: 'userName' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (v) => <Tag color={v?.includes('Lead') ? 'blue' : 'geekblue'}>{v}</Tag>,
    },
    {
      title: 'Can Edit',
      key: 'canEdit',
      width: 100,
      render: (_, r) => (
        r.role?.includes('Creator') ? (
          <Tooltip title="Creator always has edit access"><Tag color="blue">Owner</Tag></Tooltip>
        ) : (
          <Switch
            size="small"
            checked={r.canEdit !== false}
            onChange={(checked) => toggleCanEdit(r.userId, checked)}
            disabled={nb.status !== 'ACTIVE'}
            checkedChildren="Edit"
            unCheckedChildren="View"
          />
        )
      ),
    },
    ...(canManageUsers ? [{
      title: '', key: 'del', width: 60,
      render: (_: unknown, r: AssignedUser) => {
        const isSelf = r.userId === currentUser?.id
        if (isSelf) {
          return (
            <Tooltip title="You cannot remove yourself from the notebook.">
              <Button type="text" danger icon={<Trash2 size={14} />} disabled />
            </Tooltip>
          )
        }
        return (
          <Popconfirm title="Remove user?" onConfirm={() => remove(r.userId)} disabled={nb.status !== 'ACTIVE'}>
            <Button type="text" danger icon={<Trash2 size={14} />} disabled={nb.status !== 'ACTIVE'} />
          </Popconfirm>
        )
      },
    }] : []),
  ]

  return (
    <div className="space-y-3">
      {msgCtx}
      <div className="flex justify-end">
        <Tooltip title={canManageUsers ? undefined : 'Only HOD or TL can add users to a notebook.'}>
          <Button icon={<Plus size={14} />} onClick={() => setOpen(true)} disabled={nb.status !== 'ACTIVE' || !canManageUsers}>
            Add Users
          </Button>
        </Tooltip>
      </div>
      <Table rowKey="userId" columns={cols} dataSource={effectiveUsers} pagination={false}
        locale={{ emptyText: 'No users assigned.' }} size="small" />
      <Modal {...glassModalProps} title="Add User(s) to Notebook" open={open} onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()} okText="Add Selected" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={addUser} className="mt-4">
          <Form.Item name="userNames" label="Select User(s)" rules={[{ required: true, message: 'Please select at least one user' }]}>
            <Select
              mode="multiple"
              showSearch
              placeholder="Select project team members..."
              options={projectMembers}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Experiments tab ───────────────────────────────────────────────────────────
function ExperimentsTab({ notebookId, notebookProjectId, notebookStatus }: { notebookId: string; notebookProjectId: string | null; notebookStatus: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [creationMode, setCreationMode] = useState<'template' | 'stp'>('template')
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(notebookProjectId ?? undefined)
  const [selectedStp, setSelectedStp] = useState<ProjectStp | null>(null)
  const [selectedTemplateType, setSelectedTemplateType] = useState<string | undefined>(undefined)
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(undefined)
  // Per-row Actions column state (Edit/View/Events/History) — see the
  // Actions column in `cols` below.
  const [eventsRow, setEventsRow] = useState<ExperimentSummary | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notebook-experiments', notebookId],
    queryFn: () => ardNotebooksApi.experiments(notebookId),
  })

  const { data: published } = useQuery({
    queryKey: ['ard-templates-published'],
    queryFn: ardTemplateApi.published,
  })
  const { data: allTemplates } = useQuery({
    queryKey: ['ard-templates-all'],
    queryFn: () => ardTemplateApi.list({ pageSize: 100 }),
  })
  const { data: projectsData } = useQuery({
    queryKey: ['ard-projects-list-nb'],
    queryFn: () => ardProjectsApi.list({ pageSize: 100 }),
    enabled: creationMode === 'stp',
  })
  const { data: projectDetail } = useQuery({
    queryKey: ['ard-project', selectedProjectId],
    queryFn: () => ardProjectsApi.get(selectedProjectId!),
    enabled: creationMode === 'stp' && !!selectedProjectId,
  })
  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  const templateOptions = useMemo(() => {
    const pub = published?.items ?? []
    const list = pub.length > 0 ? pub : (allTemplates?.items ?? [])
    return list.map((t) => ({
      value: t.id,
      label: `${t.name} (v${t.version}${t.status ? ` - ${t.status}` : ''})`,
      name: t.name,
      templateType: t.templateType ?? null,
    }))
  }, [published, allTemplates])

  const templateTypeOptions = useMemo(() => {
    const fromLookup = (masterData?.lookups ?? [])
      .filter((l) => l.category === 'Template Type' && l.active)
      .map((l) => ({ value: l.code, label: l.label }))
    return fromLookup.length > 0
      ? fromLookup
      : [
          { value: 'EXPERIMENT', label: 'Experiment' },
          { value: 'ANALYTICAL', label: 'Analytical' },
          { value: 'STP', label: 'STP Document' },
          { value: 'STABILITY', label: 'Stability Study' },
        ]
  }, [masterData?.lookups])

  const filteredTemplateOptions = useMemo(
    () => selectedTemplateType ? templateOptions.filter(t => t.templateType === selectedTemplateType) : templateOptions,
    [templateOptions, selectedTemplateType],
  )

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).filter(c => c.active).map(c => c.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const testSubtypeOptionsFor = (testType?: string) => {
    const configs = (masterData?.testConfigs ?? []).filter(c => c.active && (!testType || c.testType === testType))
    const subtypes = Array.from(new Set(configs.map(c => c.testSubtype).filter(Boolean)))
    return subtypes.map(s => ({ value: s as string, label: s as string }))
  }

  const projectOptions = useMemo(() =>
    (projectsData?.items ?? []).filter(p => p.status === 'OPEN').map(p => ({
      value: p.id,
      label: `${p.code} — ${p.productName}`,
    }))
  , [projectsData])

  const stpOptions = useMemo<{ value: string; label: string; stp: ProjectStp }[]>(() => {
    const docs = projectDetail?.stpDocuments ?? []
    return docs
      .filter(s => s.status === 'APPROVED')
      .map(s => ({
        // Must be the STP's id, not its documentNo — the backend looks up
        // the STP on the project by `s.id === projectStpId` (see POST
        // /api/ard/experiments), so sending documentNo here always 404s
        // with "STP document not found on this project".
        value: s.id,
        label: `${s.documentNo} v${s.version} — ${s.title}${s.testType ? ` (${s.testType})` : ''}`,
        stp: s,
      }))
  }, [projectDetail])

  const create = useMutation({
    mutationFn: ardExperimentApi.create,
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      qc.invalidateQueries({ queryKey: ['ard-experiments'] })
      message.success('Experiment created successfully!')
      setOpen(false)
      form.resetFields()
      setCreationMode('template')
      navigate(`/ard/experiments/${e.id}`)
    },
    onError: (err: any) => {
      message.error(err instanceof ApiError ? err.detail : 'Failed to create experiment.')
    },
  })

  const highlightMut = useMutation({
    mutationFn: (expId: string) => ardExperimentApi.toggleHighlight(expId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] }),
    // Was silent on failure — a toggle click during a flaky connection looked
    // exactly like "the button doesn't do anything" with no way to tell.
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to update highlight — please try again.'),
  })

  // Events — same generic audit-log endpoint ArdExperimentWorkspacePage.tsx's
  // own Events drawer reads (GET /api/ard/audit/entity/EXPERIMENT/:id).
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['ard-experiment-events', eventsRow?.id],
    queryFn: () => apiGet<{ items: { id: string; action: string; detail: string; userName: string; createdAt: string }[] }>(`/api/ard/audit/entity/EXPERIMENT/${eventsRow!.id}`),
    enabled: !!eventsRow,
  })

  const handleCreate = (vals: any) => {
    const payload: Record<string, any> = { ...vals, notebookId }
    if (creationMode === 'stp' && selectedProjectId && vals.projectStpId) {
      payload.projectId = selectedProjectId
      payload.projectStpId = vals.projectStpId
    }
    create.mutate(payload)
  }

  const handleOpen = () => {
    form.resetFields()
    setCreationMode('template')
    setSelectedProjectId(notebookProjectId ?? undefined)
    setSelectedStp(null)
    setSelectedTemplateType(undefined)
    setSelectedTestType(undefined)
    setOpen(true)
  }

  const cols: ColumnsType<ExperimentSummary> = [
    {
      title: '', dataIndex: 'highlighted', key: 'highlighted', width: 36,
      render: (v: boolean, row: ExperimentSummary) => (
        <Tooltip title={v ? 'Highlighted — click to remove' : 'Highlight experiment'}>
          <button
            onClick={e => { e.stopPropagation(); highlightMut.mutate(row.id) }}
            className="p-0 border-0 bg-transparent cursor-pointer"
          >
            <Star size={14} className={v ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
          </button>
        </Tooltip>
      ),
    },
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 180,
      render: v => <span className="font-mono text-xs font-semibold text-slate-700">{v}</span>,
    },
    { title: 'Template', dataIndex: 'templateName', key: 'templateName', render: v => v ?? '—' },
    { title: 'Aim', dataIndex: 'aim', key: 'aim', ellipsis: true, render: (v: string | null) => stripHtml(v) || '—' },
    {
      title: 'Aim Achieved', dataIndex: 'aimAchieved', key: 'aimAchieved', width: 110,
      render: (v: boolean | null) => v == null ? '—' : (v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>),
    },
    {
      title: 'Started By(On)', key: 'startedBy', width: 170,
      render: (_: unknown, row: ExperimentSummary) => (
        <span className="text-xs">
          {row.startedByName || '—'}{row.createdAt ? ` (${dayjs(row.createdAt).format('DD MMM YYYY')})` : ''}
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: (v: string) => <Tag color={EXP_STATUS_COLOR[v] ?? 'default'} className="text-xs">{EXP_STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'ATR Form No(s)', dataIndex: 'atrFormNos', key: 'atrFormNos',
      render: (v: string[]) => v?.length ? v.join(', ') : '—',
    },
    {
      title: 'Test Number(s)', dataIndex: 'testNumbers', key: 'testNumbers',
      render: (v: string[]) => v?.length ? v.join(', ') : '—',
    },
    {
      title: 'Batch Number', dataIndex: 'batchNumbers', key: 'batchNumbers',
      render: (v: string[]) => v?.length ? v.join(', ') : '—',
    },
    {
      title: 'Storage Condition & Period', dataIndex: 'storageConditions', key: 'storageConditions',
      render: (v: string[]) => v?.length ? v.join(', ') : '—',
    },
    {
      title: 'Actions', key: 'actions', width: 70, fixed: 'right', align: 'center',
      render: (_: unknown, row: ExperimentSummary) => {
        const menuItems: MenuProps['items'] = [
          { key: 'edit', label: 'Edit', icon: <Edit2 size={13} />, onClick: () => navigate(`/ard/experiments/${row.id}`) },
          // Read-only mode: ArdExperimentWorkspacePage.tsx shows only Export
          // PDF + Clone when opened with ?view=1, regardless of status/role.
          { key: 'view', label: 'View', icon: <Eye size={13} />, onClick: () => navigate(`/ard/experiments/${row.id}?view=1`) },
          { key: 'events', label: 'Events', icon: <Activity size={13} />, onClick: () => setEventsRow(row) },
          // Full version comparison is a later feature — this just reserves
          // the action for now, per product review 2026-08-28.
          { key: 'history', label: 'History', icon: <History size={13} />, onClick: () => message.info('Version comparison is coming soon.') },
        ]
        return (
          <div onClick={e => e.stopPropagation()}>
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreHorizontal size={16} />} />
            </Dropdown>
          </div>
        )
      },
    },
  ]

  const items = data?.items ?? []

  return (
    <div className="space-y-3">
      {/* Add Experiment lives in the table's own title slot now — sits flush
          against the table instead of on its own full-width row above it.
          Everything else (Edit/View/Events/History) is in the table's
          Actions column so each icon acts on its own row directly. Make STP
          Worksheet dropped, and HighLight is just the per-row star toggle
          again (no separate comment modal), per product review 2026-08-28. */}
      <Table
        rowKey="id"
        columns={cols}
        dataSource={items}
        loading={isLoading}
        onRow={r => ({
          onClick: () => navigate(`/ard/experiments/${r.id}`),
          className: `cursor-pointer${r.highlighted ? ' bg-amber-50 hover:bg-amber-100/70' : ''}`,
        })}
        pagination={false}
        locale={{ emptyText: 'No experiments in this notebook.' }}
        size="small"
        scroll={{ x: 'max-content' }}
        title={() => (
          <div className="flex justify-end">
            <Tooltip title={notebookStatus !== 'ACTIVE' ? 'Notebook must be Active to add experiments' : ''}>
              <Button type="primary" icon={<Plus size={14} />} onClick={handleOpen} disabled={notebookStatus !== 'ACTIVE'}>
                Add Experiment
              </Button>
            </Tooltip>
          </div>
        )}
      />

      {/* Events — this experiment's own audit trail */}
      <Modal
        {...glassModalProps}
        title={`Events — ${eventsRow?.code ?? ''}`}
        open={!!eventsRow}
        onCancel={() => setEventsRow(null)}
        footer={null}
        destroyOnClose
      >
        <Table
          rowKey="id"
          size="small"
          loading={eventsLoading}
          dataSource={eventsData?.items ?? []}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} events` }}
          locale={{ emptyText: 'No events recorded for this experiment.' }}
          columns={[
            { title: 'Event Type', dataIndex: 'action' },
            { title: 'Event Time', dataIndex: 'createdAt', render: (v: string) => v ? dayjs(v).format('DD MMM YYYY (HH:mm)') : '—' },
            { title: 'User', dataIndex: 'userName', render: (v: string) => v || '—' },
            { title: 'Event Details', dataIndex: 'detail', render: (v: string) => v || '—' },
          ]}
        />
      </Modal>

      <Modal
        {...glassModalProps}
        title="Create New Experiment"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then(handleCreate)}
        confirmLoading={create.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item label="Creation Mode" style={{ marginBottom: 16 }}>
            <Radio.Group
              value={creationMode}
              onChange={e => {
                setCreationMode(e.target.value)
                form.resetFields(['templateId', 'projectStpId', 'aimObjective', 'testType', 'testSubType'])
                setSelectedStp(null)
                setSelectedTemplateType(undefined)
                setSelectedTestType(undefined)
              }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Via Template', value: 'template' },
                { label: 'Via Project STP', value: 'stp' },
              ]}
            />
          </Form.Item>
          {creationMode === 'template' && (
            <>
              <div className="grid grid-cols-2 gap-x-4">
                <Form.Item label="Select Template Type">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select Template Type"
                    options={templateTypeOptions}
                    value={selectedTemplateType}
                    onChange={(v) => { setSelectedTemplateType(v); form.resetFields(['templateId']) }}
                  />
                </Form.Item>
                <Form.Item name="templateId" label="Select Template" rules={[{ required: true, message: 'Please select a template' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select Template"
                    options={filteredTemplateOptions}
                    onChange={(val, opt: any) => {
                      if (opt?.name && !form.getFieldValue('name')) {
                        form.setFieldsValue({ name: opt.name })
                      }
                    }}
                  />
                </Form.Item>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                <Form.Item name="testType" label="Select Test Type" rules={[{ required: true, message: 'Please select a test type' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select Test Type"
                    options={testTypeOptions}
                    onChange={(v) => { setSelectedTestType(v); form.resetFields(['testSubType']) }}
                  />
                </Form.Item>
                <Form.Item name="testSubType" label="Select Sub Type" rules={[{ required: true, message: 'Please select a sub type' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="--Select Sub Type--"
                    options={testSubtypeOptionsFor(selectedTestType)}
                    disabled={!selectedTestType}
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="aimObjective"
                label="Aim/Objective"
                rules={[{ required: true, message: 'Please enter the aim/objective' }]}
              >
                <RichEditor placeholder="Describe the aim/objective of this experiment..." minHeight={140} />
              </Form.Item>
            </>
          )}
          {creationMode === 'stp' && (
            <>
              {/* Project isn't shown when the notebook already belongs to one
                  (matches the legacy form, which has no Project field at all)
                  — only surfaced as a fallback for a notebook with no fixed
                  project, since Select Stp otherwise has nothing to search. */}
              {!notebookProjectId && (
                <Form.Item label="Project" style={{ marginBottom: 12 }}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select project..."
                    options={projectOptions}
                    value={selectedProjectId}
                    onChange={v => { setSelectedProjectId(v); form.resetFields(['projectStpId']); setSelectedStp(null) }}
                    allowClear
                  />
                </Form.Item>
              )}
              <Form.Item
                name="projectStpId"
                label="Project STP Worksheet"
                rules={[{ required: true, message: 'Please select an approved STP' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={stpOptions.length === 0 ? 'No approved STPs for this project' : 'Select STP...'}
                  options={stpOptions}
                  disabled={!selectedProjectId || stpOptions.length === 0}
                  onChange={(val) => {
                    const found = stpOptions.find(o => o.value === val)
                    setSelectedStp(found?.stp ?? null)
                    if (found?.stp?.title && !form.getFieldValue('name')) {
                      form.setFieldsValue({ name: found.stp.title })
                    }
                  }}
                />
              </Form.Item>
              {/* Read-only, derived from the selected STP — mirrors the legacy
                  Angular "Add Experiment" form's Test Type/Sub-Type boxes,
                  which were never independently editable there either. */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-1">Test Type</div>
                  <Input value={selectedStp?.testType || '—'} disabled />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-1">Test Sub-Type</div>
                  <Input value={selectedStp?.testSubtype || '—'} disabled />
                </div>
              </div>
              <Form.Item
                name="aimObjective"
                label="Aim/Objective"
                rules={[{ required: true, message: 'Please enter the aim/objective' }]}
              >
                <TextArea rows={3} placeholder="Describe the aim/objective of this experiment..." />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}

// ── Result Parameters tab ─────────────────────────────────────────────────────
function ResultParametersTab({ nb, onSave, saving }: { nb: Notebook; onSave: (patch: Partial<Notebook>) => void; saving: boolean }) {
  const [params, setParams] = useState<ResultParameter[]>(nb.resultParameters)
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [msgApi, msgCtx] = message.useMessage()
  // FORMULA-derived results are always numeric — mirrors the legacy screen,
  // which grays Type out to Numeric the moment Formula is picked, since a
  // computed value has no "text" case to represent, and only lets Type be
  // chosen at all when the value is User Entered.
  const valueType = Form.useWatch('valueType', form)
  useEffect(() => setParams(nb.resultParameters), [nb.resultParameters])
  useEffect(() => {
    if (valueType === 'FORMULA') form.setFieldValue('dataType', 'NUMERIC')
  }, [valueType, form])

  const openAdd = () => {
    setEditingId(null)
    form.resetFields()
    setOpen(true)
  }
  const openEdit = (p: ResultParameter) => {
    setEditingId(p.id)
    form.setFieldsValue(p)
    setOpen(true)
  }

  const save = (vals: ResultParameter) => {
    const code = (vals.paramCode || '').trim().toLowerCase()
    if (code) {
      const dupe = params.some(p => p.id !== editingId && (p.paramCode || '').trim().toLowerCase() === code)
      if (dupe) {
        msgApi.error(`Parameter code "${vals.paramCode}" is already in use.`)
        return
      }
    }
    const next = editingId
      ? params.map(p => p.id === editingId ? { ...vals, id: editingId } : p)
      : [...params, { ...vals, id: newId() }]
    setParams(next)
    onSave({ resultParameters: next })
    setOpen(false)
    setEditingId(null)
    form.resetFields()
  }
  const remove = (id: string) => {
    const next = params.filter(p => p.id !== id)
    setParams(next)
    onSave({ resultParameters: next })
  }

  const cols: ColumnsType<ResultParameter> = [
    { title: 'Code', dataIndex: 'paramCode', key: 'paramCode', width: 80,
      render: v => v ? <span className="font-mono text-xs font-semibold">{v}</span> : '—' },
    { title: 'Parameter Name', dataIndex: 'paramName', key: 'paramName' },
    { title: 'I/O', dataIndex: 'ioType', key: 'ioType', width: 80,
      render: v => v ? <Tag color={v === 'OUTPUT' ? 'blue' : 'default'}>{v}</Tag> : '—' },
    { title: 'User Entered/Formula', dataIndex: 'valueType', key: 'valueType', width: 130,
      render: v => v === 'FORMULA' ? <Tag color="purple">Formula</Tag> : <Tag>User Entered</Tag> },
    { title: 'Type', dataIndex: 'dataType', key: 'dataType', width: 90,
      render: v => v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '—' },
    { title: 'Formula', dataIndex: 'formula', key: 'formula',
      render: v => v ? <span className="font-mono text-xs">{v}</span> : '—' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 100 },
    {
      title: '', key: 'actions', width: 90,
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <Button type="text" icon={<Edit2 size={14} />} disabled={nb.status !== 'ACTIVE'} onClick={() => openEdit(r)} />
          <Popconfirm title="Remove parameter?" onConfirm={() => remove(r.id)}>
            <Button type="text" danger icon={<Trash2 size={14} />} disabled={nb.status !== 'ACTIVE'} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {msgCtx}
      <div className="flex justify-end">
        <Button icon={<Plus size={14} />} onClick={openAdd} disabled={nb.status !== 'ACTIVE'}>
          Add Parameter
        </Button>
      </div>
      <Table rowKey="id" columns={cols} dataSource={params} pagination={false}
        locale={{ emptyText: 'No result parameters defined.' }} size="small" />
      <Modal {...glassModalProps} title={editingId ? 'Edit Result Parameter' : 'Add Result Parameter'} open={open}
        onCancel={() => { setOpen(false); setEditingId(null); form.resetFields() }}
        onOk={() => form.submit()} okText={editingId ? 'Save' : 'Add'} confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={save} className="mt-4">
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="paramCode" label="Parameter Code" rules={[{ max: 3, message: 'Max 3 characters' }]}>
              <Input placeholder="e.g. ASY" maxLength={3} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="paramName" label="Parameter Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Assay (%w/w)" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="ioType" label="Input / Output">
              <Select placeholder="Select" options={[{ value: 'INPUT', label: 'Input' }, { value: 'OUTPUT', label: 'Output' }]} allowClear />
            </Form.Item>
            <Form.Item name="valueType" label="User Entered/Formula">
              <Select placeholder="Select" options={[{ value: 'INPUT', label: 'User Entered' }, { value: 'FORMULA', label: 'Formula' }]} allowClear />
            </Form.Item>
            <Form.Item name="dataType" label="Type">
              <Select
                placeholder="Select"
                disabled={valueType === 'FORMULA'}
                options={[{ value: 'TEXT', label: 'Text' }, { value: 'NUMERIC', label: 'Numeric' }]}
                allowClear
              />
            </Form.Item>
          </div>
          {valueType === 'FORMULA' && (
            <Form.Item name="formula" label="Formula" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. ASY - IMP1" />
            </Form.Item>
          )}
          <Form.Item name="unit" label="Unit">
            <Input placeholder="e.g. %" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Notebook Events tab ───────────────────────────────────────────────────────
function NotebookEventsTab({ nb }: { nb: Notebook }) {
  const [eventType, setEventType] = useState<string | undefined>()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [userFilter, setUserFilter] = useState<string | undefined>()
  const [shown, setShown] = useState(false)

  const allTrail = [...(nb.auditTrail ?? [])].reverse()

  const uniqueActions = Array.from(new Set(allTrail.map(e => e.action).filter(Boolean)))
  const uniqueUsers   = Array.from(new Set(allTrail.map(e => e.actorName).filter(Boolean)))

  const filtered = shown
    ? allTrail.filter(e => {
        if (eventType && e.action !== eventType) return false
        if (userFilter && e.actorName !== userFilter) return false
        if (fromDate && e.createdAt && e.createdAt < fromDate) return false
        if (toDate   && e.createdAt && e.createdAt.slice(0,10) > toDate) return false
        return true
      })
    : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Event Type</div>
          <Select
            allowClear placeholder="All" style={{ width: 180 }}
            value={eventType} onChange={setEventType}
            options={[{ value: undefined, label: 'All' }, ...uniqueActions.map(a => ({ value: a, label: a }))]}
          />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">From</div>
          <Input type="date" style={{ width: 140 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">To</div>
          <Input type="date" style={{ width: 140 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">User</div>
          <Select
            allowClear placeholder="All Users" style={{ width: 160 }}
            value={userFilter} onChange={setUserFilter}
            options={[{ value: undefined, label: 'All Users' }, ...uniqueUsers.map(u => ({ value: u, label: u }))]}
          />
        </div>
        <Button type="primary" onClick={() => setShown(true)}>Show Events</Button>
      </div>

      {!shown && (
        <p className="text-slate-400 text-sm">Set filters and click "Show Events" to view notebook events.</p>
      )}
      {shown && filtered.length === 0 && (
        <p className="text-slate-400 text-sm">No events match the selected filters.</p>
      )}
      {shown && filtered.map((entry, i) => (
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-slate-700">
            <span className="text-violet-600">{entry.action}</span>
            <span className="text-slate-400">·</span>
            <span>{entry.actorName}</span>
          </div>
          {entry.detail && <p className="text-slate-500 mt-1">{entry.detail}</p>}
          <p className="text-xs text-slate-400 mt-1">{entry.createdAt ? dayjs(entry.createdAt).format('DD MMM YYYY HH:mm') : ''}</p>
        </div>
      ))}
    </div>
  )
}

// ── Equipment tab ─────────────────────────────────────────────────────────────
function EquipmentTab({ notebookId, isOpen }: { notebookId: string; isOpen: boolean }) {
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const [addOpen, setAddOpen] = useState(false)
  const [equipmentId, setEquipmentId] = useState('')
  const [equipmentCode, setEquipmentCode] = useState('')
  const [equipmentName, setEquipmentName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ard-notebook-equipment', notebookId],
    queryFn: () => ardNotebooksApi.listEquipment(notebookId),
    enabled: !!notebookId,
  })

  const addMut = useMutation({
    mutationFn: () => ardNotebooksApi.addEquipment(notebookId, {
      equipmentId: equipmentId.trim(),
      equipmentCode: equipmentCode.trim() || undefined,
      equipmentName: equipmentName.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-notebook-equipment', notebookId] })
      qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] })
      msgApi.success('Equipment linked.')
      setAddOpen(false)
      setEquipmentId(''); setEquipmentCode(''); setEquipmentName('')
    },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to link equipment.'),
  })

  const removeMut = useMutation({
    mutationFn: (linkId: string) => ardNotebooksApi.removeEquipment(notebookId, linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-notebook-equipment', notebookId] })
      qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] })
      msgApi.success('Equipment unlinked.')
    },
    onError: () => msgApi.error('Failed to remove equipment.'),
  })

  const columns: ColumnsType<any> = [
    { title: 'Equipment ID', dataIndex: 'equipmentId', key: 'equipmentId', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { title: 'Code', dataIndex: 'equipmentCode', key: 'equipmentCode', render: (v) => v || '—' },
    { title: 'Name', dataIndex: 'equipmentName', key: 'equipmentName', render: (v) => v || '—' },
    { title: 'Added By', dataIndex: 'addedBy', key: 'addedBy' },
    { title: 'Added At', dataIndex: 'addedAt', key: 'addedAt', render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—' },
    {
      title: '',
      key: 'action',
      render: (_: any, row: any) => isOpen ? (
        <Popconfirm title="Remove this equipment link?" onConfirm={() => removeMut.mutate(row.id)}>
          <Button danger size="small" icon={<Trash2 size={12} />} loading={removeMut.isPending} />
        </Popconfirm>
      ) : null,
    },
  ]

  return (
    <>
      {ctx}
      <div className="space-y-3">
        {isOpen && (
          <div className="flex justify-end">
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>
              Link Equipment
            </Button>
          </div>
        )}
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={false}
          locale={{ emptyText: 'No equipment linked to this notebook.' }}
        />
        <Modal
          {...glassModalProps}
          title="Link Equipment to Notebook"
          open={addOpen}
          onCancel={() => setAddOpen(false)}
          onOk={() => {
            if (!equipmentId.trim()) { msgApi.error('Equipment ID is required.'); return }
            addMut.mutate()
          }}
          confirmLoading={addMut.isPending}
          okText="Link"
        >
          <div className="py-2 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Equipment ID *</label>
              <Input value={equipmentId} onChange={e => setEquipmentId(e.target.value)} placeholder="e.g. EQ-2024-001" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Equipment Code</label>
              <Input value={equipmentCode} onChange={e => setEquipmentCode(e.target.value)} placeholder="e.g. BAL-001" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Equipment Name</label>
              <Input value={equipmentName} onChange={e => setEquipmentName(e.target.value)} placeholder="e.g. Analytical Balance" />
            </div>
          </div>
        </Modal>
      </div>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ArdNotebookWorkspacePage() {
  const { notebookId = '' } = useParams<{ notebookId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()

  const { data: nb, isLoading, error } = useQuery<Notebook>({
    queryKey: ['ard-notebook', notebookId],
    queryFn: () => ardNotebooksApi.get(notebookId),
    enabled: !!notebookId,
    refetchOnWindowFocus: false,
  })

  useBreadcrumbLabel(notebookId, nb?.name ?? null)

  // The notebook route is flat (/ard/notebooks/:id, not nested under its
  // project), so without this the breadcrumb would only ever show
  // "ARD > Notebooks > NotebookName" — losing the project the user actually
  // navigated in from. Injects "Projects > ProjectName" right after "ARD".
  const { data: parentProject } = useQuery({
    queryKey: ['ard-project', nb?.projectId],
    queryFn: () => ardProjectsApi.get(nb!.projectId!),
    enabled: !!nb?.projectId,
  })
  useBreadcrumbPrefix(
    nb?.projectId
      ? [
          { label: 'Projects', href: '/ard/projects' },
          { label: parentProject?.productName || parentProject?.code || '…', href: `/ard/projects/${nb.projectId}` },
        ]
      : null,
  )

  const patch = useMutation({
    mutationFn: (body: Partial<Notebook>) => ardNotebooksApi.patch(notebookId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] })
      qc.invalidateQueries({ queryKey: ['ard-notebooks'] })
    },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Save failed'),
  })


  // Close / Archive / Reopen modal state
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeRemarks, setCloseRemarks] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveRemarks, setArchiveRemarks] = useState('')
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenRemarks, setReopenRemarks] = useState('')

  const closeNotebook = useMutation({
    // The Notebook Events entry for this is now computed server-side from
    // status + remarks (see ardNotebooks.routes.ts PATCH handler) — no need
    // to build an auditEntry client-side.
    mutationFn: () => ardNotebooksApi.patch(notebookId, { status: 'CLOSED', remarks: closeRemarks } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] }); qc.invalidateQueries({ queryKey: ['ard-notebooks'] }); setCloseOpen(false); setCloseRemarks(''); msgApi.success('Notebook closed.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Failed to close notebook.'),
  })

  const archiveNotebook = useMutation({
    mutationFn: () => ardNotebooksApi.patch(notebookId, { status: 'DEACTIVE', remarks: archiveRemarks } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] }); setArchiveOpen(false); setArchiveRemarks(''); msgApi.success('Notebook deactivated.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Failed to deactivate notebook.'),
  })

  const reopenNotebook = useMutation({
    mutationFn: () => ardNotebooksApi.reopen(notebookId, { remarks: reopenRemarks }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] }); setReopenOpen(false); setReopenRemarks(''); msgApi.success('Notebook reopened.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Failed to reopen notebook.'),
  })

  if (isLoading) return <div className="p-8 flex justify-center"><Spin size="large" /></div>
  if (error || !nb) return <div className="p-8"><Alert type="error" message="Notebook not found." /></div>

  const isHodOrAdmin = user?.role_code === 'HOD' || user?.role_code === 'SUPER_ADMIN'

  const tabItems = [
    {
      key: 'summary',
      label: 'Summary',
      children: <SummaryTab nb={nb} onSave={patch.mutate} saving={patch.isPending} />,
    },
    {
      key: 'users',
      label: 'Users',
      children: <UsersTab nb={nb} onSave={patch.mutate} saving={patch.isPending} />,
    },
    {
      key: 'experiments',
      label: 'Experiments',
      children: <ExperimentsTab notebookId={notebookId} notebookProjectId={nb.projectId} notebookStatus={nb.status} />,
    },
    {
      key: 'result-params',
      label: 'Result Parameters',
      children: <ResultParametersTab nb={nb} onSave={patch.mutate} saving={patch.isPending} />,
    },
    {
      key: 'equipment',
      label: 'Equipment',
      children: <EquipmentTab notebookId={notebookId} isOpen={nb.status === 'ACTIVE'} />,
    },
    {
      key: 'audit',
      label: 'Notebook Events',
      children: <NotebookEventsTab nb={nb} />,
    },
  ]

  return (
    <>
      {ctx}
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate(nb.projectId ? `/ard/projects/${nb.projectId}` : '/ard/notebooks')}
            title={nb.projectId ? "Back to Project" : "Back to Notebooks"}
          >
            {nb.projectId ? "Back to Project" : "Back"}
          </Button>
          <BookOpen size={20} className="text-violet-500" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-800 truncate">{nb.name}</h1>
            <p className="text-xs text-slate-400 font-mono">{nb.code}</p>
          </div>
          <Tag color={STATUS_COLOR[nb.status] ?? 'default'} className="ml-auto shrink-0">{nb.status}</Tag>
          <Button
            icon={<FileText size={14} className="inline mr-1" />}
            onClick={async () => {
              try {
                const { blob } = await ardNotebooksApi.downloadReport(notebookId)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${nb.code || notebookId}_report.pdf`
                document.body.appendChild(a)
                a.click()
                URL.revokeObjectURL(url)
                document.body.removeChild(a)
              } catch {
                msgApi.error('Failed to generate notebook report.')
              }
            }}
          >
            Export PDF
          </Button>
          {isHodOrAdmin && nb.status === 'ACTIVE' && (
            <Button onClick={() => setCloseOpen(true)}>Close Notebook</Button>
          )}
          {isHodOrAdmin && (nb.status === 'ACTIVE' || nb.status === 'CLOSED') && (
            <Button danger onClick={() => setArchiveOpen(true)}>Deactivate</Button>
          )}
          {isHodOrAdmin && nb.status === 'CLOSED' && (
            <Button type="primary" onClick={() => setReopenOpen(true)}>Reopen</Button>
          )}
        </div>

        <div className="glass-card rounded-lg p-4">
          <Tabs key={notebookId} items={tabItems} defaultActiveKey="experiments" />
        </div>
      </div>

      {/* Close Notebook Modal */}
      <Modal {...glassModalProps} title="Close Notebook" open={closeOpen} onCancel={() => { setCloseOpen(false); setCloseRemarks('') }}
        onOk={() => { if (!closeRemarks.trim()) { msgApi.error('Remarks are required.'); return } closeNotebook.mutate() }}
        confirmLoading={closeNotebook.isPending} okText="Close Notebook" okButtonProps={{ danger: true }} destroyOnClose>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">Closing a notebook prevents new experiments from being added. Provide a business justification.</p>
          <Input.TextArea rows={3} value={closeRemarks} onChange={e => setCloseRemarks(e.target.value)} placeholder="Reason for closing this notebook..." />
        </div>
      </Modal>

      {/* Deactivate Notebook Modal */}
      <Modal {...glassModalProps} title="Deactivate Notebook" open={archiveOpen} onCancel={() => { setArchiveOpen(false); setArchiveRemarks('') }}
        onOk={() => { if (!archiveRemarks.trim()) { msgApi.error('Remarks are required.'); return } archiveNotebook.mutate() }}
        confirmLoading={archiveNotebook.isPending} okText="Deactivate" okButtonProps={{ danger: true }} destroyOnClose>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">Deactivating this notebook cannot be undone from here — only Closed notebooks can be reopened. Provide a business justification.</p>
          <Input.TextArea rows={3} value={archiveRemarks} onChange={e => setArchiveRemarks(e.target.value)} placeholder="Reason for deactivating this notebook..." />
        </div>
      </Modal>

      {/* Reopen Notebook Modal */}
      <Modal {...glassModalProps} title="Reopen Notebook" open={reopenOpen} onCancel={() => { setReopenOpen(false); setReopenRemarks('') }}
        onOk={() => { if (!reopenRemarks.trim()) { msgApi.error('Remarks are required.'); return } reopenNotebook.mutate() }}
        confirmLoading={reopenNotebook.isPending} okText="Reopen" destroyOnClose>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">Reopening restores the notebook to active status. Provide a justification.</p>
          <Input.TextArea rows={3} value={reopenRemarks} onChange={e => setReopenRemarks(e.target.value)} placeholder="Reason for reopening this notebook..." />
        </div>
      </Modal>
    </>
  )
}
