import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Tabs, Input, Select, Tag, Spin, Alert, Modal, Table, Form, Radio, Popconfirm, message, Segmented, Card, Switch, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, BookOpen, Plus, Trash2, LayoutList, FileText, Star } from 'lucide-react'
import dayjs from 'dayjs'
import { ardNotebooksApi, type Notebook, type ResultParameter, type AssignedUser, type ExperimentSummary } from '../../api/ard-notebooks'
import { ardProjectsApi, type ProjectStp } from '../../api/ard-projects'
import { ardTemplateApi, ardExperimentApi } from '../../api/ard'
import { apiGet, ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const { TextArea } = Input

const STATUS_COLOR: Record<string, string> = { OPEN: 'green', CLOSED: 'default', ARCHIVED: 'volcano' }
const EXP_STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: 'blue', SUBMITTED: 'purple', APPROVED: 'green', REWORK: 'red',
  VERIFICATION_REQUESTED: 'gold', VERIFIED: 'cyan', UNLOCKED: 'geekblue', DEACTIVATED: 'default',
}
const EXP_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Ongoing', SUBMITTED: 'Submitted', APPROVED: 'Approved', REWORK: 'Rework',
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

// ── Summary tab ───────────────────────────────────────────────────────────────
function SummaryTab({ nb, onSave, saving }: { nb: Notebook; onSave: (patch: Partial<Notebook>) => void; saving: boolean }) {
  const [name, setName] = useState(nb.name)
  const [description, setDescription] = useState(nb.description ?? '')
  const [notebookType, setNotebookType] = useState(nb.notebookType ?? '')
  useEffect(() => { setName(nb.name); setDescription(nb.description ?? ''); setNotebookType(nb.notebookType ?? '') }, [nb])
  const dirty = name !== nb.name || description !== (nb.description ?? '') || notebookType !== (nb.notebookType ?? '')
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
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={nb.status !== 'OPEN'}
            className="rounded-lg"
            placeholder="Notebook name"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Notebook Type</label>
          <Select
            value={notebookType || undefined}
            onChange={setNotebookType}
            options={NOTEBOOK_TYPES}
            allowClear
            placeholder="Select type"
            className="w-full rounded-lg"
            disabled={nb.status !== 'OPEN'}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs text-slate-400 font-medium block mb-1.5">Description</label>
          <TextArea
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={nb.status !== 'OPEN'}
            className="rounded-lg"
            placeholder="Enter notebook description..."
          />
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

      {dirty && nb.status === 'OPEN' && (
        <div className="pt-2 flex justify-end">
          <Button type="primary" loading={saving} onClick={() => onSave({ name, description, notebookType: notebookType || undefined })}>
            Save Changes
          </Button>
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
            disabled={nb.status !== 'OPEN'}
            checkedChildren="Edit"
            unCheckedChildren="View"
          />
        )
      ),
    },
    {
      title: '', key: 'del', width: 60,
      render: (_, r) => (
        r.role?.includes('Creator') ? null : (
          <Popconfirm title="Remove user?" onConfirm={() => remove(r.userId)} disabled={nb.status !== 'OPEN'}>
            <Button type="text" danger icon={<Trash2 size={14} />} disabled={nb.status !== 'OPEN'} />
          </Popconfirm>
        )
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {msgCtx}
      <div className="flex justify-end">
        <Button icon={<Plus size={14} />} onClick={() => setOpen(true)} disabled={nb.status !== 'OPEN'}>
          Add Users
        </Button>
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

  const templateOptions = useMemo(() => {
    const pub = published?.items ?? []
    const list = pub.length > 0 ? pub : (allTemplates?.items ?? [])
    return list.map((t) => ({
      value: t.id,
      label: `${t.name} (v${t.version}${t.status ? ` - ${t.status}` : ''})`,
      name: t.name,
    }))
  }, [published, allTemplates])

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
        value: s.documentNo,
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
    setOpen(true)
  }

  const cols: ColumnsType<ExperimentSummary> = [
    {
      title: '', dataIndex: 'highlighted', key: 'highlighted', width: 36,
      render: (v: boolean, row: ExperimentSummary) => (
        <button
          onClick={e => { e.stopPropagation(); highlightMut.mutate(row.id) }}
          className="p-0 border-0 bg-transparent cursor-pointer"
          title={v ? 'Remove highlight' : 'Highlight experiment'}
        >
          <Star size={14} className={v ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />
        </button>
      ),
    },
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 180,
      render: v => <span className="font-mono text-xs font-semibold text-slate-700">{v}</span>,
    },
    { title: 'Template', dataIndex: 'templateName', key: 'templateName', render: v => v ?? '—' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 190,
      render: (v: string) => <Tag color={EXP_STATUS_COLOR[v] ?? 'default'} className="text-xs">{EXP_STATUS_LABEL[v] ?? v}</Tag>,
    },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Tooltip title={notebookStatus !== 'OPEN' ? 'Notebook must be OPEN to add experiments' : ''}>
          <Button type="primary" icon={<Plus size={14} />} onClick={handleOpen} disabled={notebookStatus !== 'OPEN'}>
            New Experiment
          </Button>
        </Tooltip>
      </div>
      <Table
        rowKey="id"
        columns={cols}
        dataSource={data?.items ?? []}
        loading={isLoading}
        onRow={r => ({ onClick: () => navigate(`/ard/experiments/${r.id}`), className: 'cursor-pointer' })}
        pagination={false}
        locale={{ emptyText: 'No experiments in this notebook.' }}
        size="small"
      />
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
              onChange={e => { setCreationMode(e.target.value); form.resetFields(['templateId', 'projectStpId']) }}
              optionType="button"
              buttonStyle="solid"
              options={[
                { label: 'Via Template', value: 'template' },
                { label: 'Via Project STP', value: 'stp' },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Experiment Name" rules={[{ required: true, message: 'Please enter an experiment name' }]}>
            <Input placeholder="e.g. Assay & Related Substances Test" />
          </Form.Item>
          {creationMode === 'stp' && (
            <>
              <Form.Item label="Project" style={{ marginBottom: 12 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select project..."
                  options={projectOptions}
                  value={selectedProjectId}
                  onChange={v => { setSelectedProjectId(v); form.resetFields(['projectStpId']) }}
                  allowClear
                />
              </Form.Item>
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
                    if (found?.stp?.title && !form.getFieldValue('name')) {
                      form.setFieldsValue({ name: found.stp.title })
                    }
                  }}
                />
              </Form.Item>
            </>
          )}
          <Form.Item name="templateId" label="Template (section structure)" rules={[{ required: true, message: 'Please select a template' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select template..."
              options={templateOptions}
              onChange={(val, opt: any) => {
                if (opt?.name && !form.getFieldValue('name')) {
                  form.setFieldsValue({ name: opt.name })
                }
              }}
            />
          </Form.Item>
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
  useEffect(() => setParams(nb.resultParameters), [nb.resultParameters])

  const add = (vals: ResultParameter) => {
    const next = [...params, { ...vals, id: newId() }]
    setParams(next)
    onSave({ resultParameters: next })
    setOpen(false)
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
    { title: 'Type', dataIndex: 'dataType', key: 'dataType', width: 90,
      render: v => v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '—' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 100 },
    {
      title: '', key: 'del', width: 60,
      render: (_, r) => (
        <Popconfirm title="Remove parameter?" onConfirm={() => remove(r.id)}>
          <Button type="text" danger icon={<Trash2 size={14} />} disabled={nb.status !== 'OPEN'} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button icon={<Plus size={14} />} onClick={() => setOpen(true)} disabled={nb.status !== 'OPEN'}>
          Add Parameter
        </Button>
      </div>
      <Table rowKey="id" columns={cols} dataSource={params} pagination={false}
        locale={{ emptyText: 'No result parameters defined.' }} size="small" />
      <Modal {...glassModalProps} title="Add Result Parameter" open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()} okText="Add" confirmLoading={saving}>
        <Form form={form} layout="vertical" onFinish={add} className="mt-4">
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
            <Form.Item name="valueType" label="Value">
              <Select placeholder="Select" options={[{ value: 'INPUT', label: 'Input' }, { value: 'FORMULA', label: 'Formula' }]} allowClear />
            </Form.Item>
            <Form.Item name="dataType" label="Type">
              <Select placeholder="Select" options={[{ value: 'TEXT', label: 'Text' }, { value: 'NUMERIC', label: 'Numeric' }]} allowClear />
            </Form.Item>
          </div>
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

  const patch = useMutation({
    mutationFn: (body: Partial<Notebook>) => ardNotebooksApi.patch(notebookId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] })
      qc.invalidateQueries({ queryKey: ['ard-notebooks'] })
    },
    onError: () => msgApi.error('Save failed'),
  })

  const [viewMode, setViewMode] = useState<'tabbed' | 'single'>('tabbed')

  // Close / Archive / Reopen modal state
  const [closeOpen, setCloseOpen] = useState(false)
  const [closeRemarks, setCloseRemarks] = useState('')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveRemarks, setArchiveRemarks] = useState('')
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenRemarks, setReopenRemarks] = useState('')

  const closeNotebook = useMutation({
    mutationFn: () => ardNotebooksApi.patch(notebookId, { status: 'CLOSED', remarks: closeRemarks, auditEntry: { action: 'Status → CLOSED', detail: closeRemarks } } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] }); qc.invalidateQueries({ queryKey: ['ard-notebooks'] }); setCloseOpen(false); setCloseRemarks(''); msgApi.success('Notebook closed.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Failed to close notebook.'),
  })

  const archiveNotebook = useMutation({
    mutationFn: () => ardNotebooksApi.patch(notebookId, { status: 'ARCHIVED', auditEntry: { action: 'Status → ARCHIVED', detail: archiveRemarks } } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-notebook', notebookId] }); setArchiveOpen(false); setArchiveRemarks(''); msgApi.success('Notebook archived.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Failed to archive notebook.'),
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
      children: <EquipmentTab notebookId={notebookId} isOpen={nb.status === 'OPEN'} />,
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
          <Segmented
            size="middle"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'tabbed' | 'single')}
            options={[
              { label: 'Tabbed View', value: 'tabbed', icon: <LayoutList size={14} className="inline mr-1" /> },
              { label: 'Single Page View', value: 'single', icon: <FileText size={14} className="inline mr-1" /> },
            ]}
          />
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
          {isHodOrAdmin && nb.status === 'OPEN' && (
            <Button onClick={() => setCloseOpen(true)}>Close Notebook</Button>
          )}
          {isHodOrAdmin && (nb.status === 'OPEN' || nb.status === 'CLOSED') && (
            <Button danger onClick={() => setArchiveOpen(true)}>Archive</Button>
          )}
          {isHodOrAdmin && (nb.status === 'CLOSED' || nb.status === 'ARCHIVED') && (
            <Button type="primary" onClick={() => setReopenOpen(true)}>Reopen</Button>
          )}
        </div>

        {/* Tabs vs Single Page Cards */}
        {viewMode === 'tabbed' ? (
          <div className="glass-card rounded-lg p-4">
            <Tabs items={tabItems} />
          </div>
        ) : (
          <div className="space-y-6">
            {tabItems.map((tab) => (
              <Card
                key={tab.key}
                title={<span className="font-bold text-slate-800 text-base">{tab.label}</span>}
                className="rounded-lg overflow-hidden"
              >
                {tab.children}
              </Card>
            ))}
          </div>
        )}
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

      {/* Archive Notebook Modal */}
      <Modal {...glassModalProps} title="Archive Notebook" open={archiveOpen} onCancel={() => { setArchiveOpen(false); setArchiveRemarks('') }}
        onOk={() => { if (!archiveRemarks.trim()) { msgApi.error('Remarks are required.'); return } archiveNotebook.mutate() }}
        confirmLoading={archiveNotebook.isPending} okText="Archive" okButtonProps={{ danger: true }} destroyOnClose>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-500">Archiving deactivates this notebook permanently. Provide a business justification.</p>
          <Input.TextArea rows={3} value={archiveRemarks} onChange={e => setArchiveRemarks(e.target.value)} placeholder="Reason for archiving this notebook..." />
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
