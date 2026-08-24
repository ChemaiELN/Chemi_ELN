import { useMemo, useState } from 'react'
import { Table, Tag, Tabs, Button, Modal, Form, Input, Select, Switch, message, Space, Tooltip, Popconfirm, Empty } from 'antd'
import { Plus, Edit3, Search, Users, UserPlus, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ardOpsApi } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import dayjs from 'dayjs'

const ROLE_COLOR: Record<string, string> = { HOD: 'gold', TL: 'blue', TEAM_LEAD: 'blue', CHEM: 'green', CHEMIST: 'green', ANALYST: 'green' }
const roleTag = (role: string) => {
  const r = (role || '').toUpperCase()
  const label = ['CHEM', 'CHEMIST', 'ANALYST'].includes(r) ? 'Analyst' : r === 'TEAM_LEAD' ? 'TL' : r
  return <Tag color={ROLE_COLOR[r] ?? 'default'} className="text-xs">{label}</Tag>
}

const ARD_DEPTS = new Set(['AD', 'ARD'])
const QA_DEPTS = new Set(['QA'])
const HOD_ROLES = new Set(['HOD', 'HEAD_OF_DEPT', 'MANAGER'])
const TL_ROLES = new Set(['TL', 'TEAM_LEAD'])
const ANALYST_ROLES = new Set(['ANALYST', 'CHEM', 'CHEMIST'])

function userRole(u: { role_code?: string; roleCode?: string }): string {
  return String(u.role_code || u.roleCode || '').toUpperCase()
}
function userDept(u: { department_code?: string | null; departmentCode?: string | null }): string {
  return String(u.department_code || u.departmentCode || '').toUpperCase()
}

// ── Directory Tab ─────────────────────────────────────────────────────────────

const MEMBER_ROLE_OPTIONS = [
  { value: 'ANALYST', label: 'Analyst' },
  { value: 'TL', label: 'Team Lead' },
  { value: 'HOD', label: 'HOD' },
  { value: 'QA', label: 'QA' },
]

function DirectoryTab({
  isHodOrAdmin,
  isTl,
  currentUserId,
  hodOptions,
  tlOptions,
  analystOptions,
  memberOptionsByRole,
  userLookup,
  usersLoading,
}: {
  isHodOrAdmin: boolean
  isTl: boolean
  currentUserId?: string
  hodOptions: { value: string; label: string }[]
  tlOptions: { value: string; label: string }[]
  analystOptions: { value: string; label: string }[]
  memberOptionsByRole: Record<string, { value: string; label: string }[]>
  userLookup: Map<string, { username: string; roleBucket: string }>
  usersLoading: boolean
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<any | null>(null)
  const [addingFor, setAddingFor] = useState<{ teamId: string; tlId: string } | null>(null)
  const [addRole, setAddRole] = useState<string>('ANALYST')
  const [addSelected, setAddSelected] = useState<string[]>([])
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  // Team Members are picked role-first: choose a role, then the people with
  // that role, then add them to the roster being built for this team.
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; role: string }[]>([])
  const [pendingRole, setPendingRole] = useState<string | undefined>(undefined)
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([])

  const addPendingMembers = () => {
    if (!pendingRole || pendingUserIds.length === 0) return
    const roleOptions = memberOptionsByRole[pendingRole] || []
    const existingIds = new Set(teamMembers.map((m) => m.id))
    const toAdd = pendingUserIds
      .filter((id) => !existingIds.has(id))
      .map((id) => ({ id, name: roleOptions.find((o) => o.value === id)?.label || id, role: pendingRole }))
    setTeamMembers([...teamMembers, ...toAdd])
    setPendingUserIds([])
  }

  const { data, isLoading } = useQuery({ queryKey: ['ard-team-directory'], queryFn: ardOpsApi.teamDirectory })
  const items = data?.items ?? []

  const filtered = useMemo(() => {
    // TL sees only their own teams
    let base = items
    if (isTl && !isHodOrAdmin) {
      base = items.filter((t) => (t.tlIds || []).includes(currentUserId ?? ''))
    }
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((t) =>
      t.teamName.toLowerCase().includes(q) ||
      (t.hodName ?? '').toLowerCase().includes(q) ||
      (t.tlNames ?? []).some((n: string) => n.toLowerCase().includes(q))
    )
  }, [items, search, isTl, isHodOrAdmin, currentUserId])

  const saveTeam = useMutation({
    mutationFn: async (vals: any) => {
      if (editingTeam) return ardOpsApi.updateTeam(editingTeam.id, vals)
      return ardOpsApi.createTeam(vals)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-team-directory'] })
      msg.success(editingTeam ? 'Team updated.' : 'Team created.')
      setModalOpen(false)
      setEditingTeam(null)
      form.resetFields()
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save team.'),
  })

  const toggleActive = useMutation({
    mutationFn: (team: any) => ardOpsApi.updateTeam(team.id, { isActive: !team.active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-team-directory'] }); msg.success('Status updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const updateAnalystMap = useMutation({
    mutationFn: ({ teamId, map }: { teamId: string; map: Record<string, string[]> }) =>
      ardOpsApi.updateTeam(teamId, { tlAnalystMap: map }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-team-directory'] }); msg.success('Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const updateCanReview = useMutation({
    mutationFn: ({ teamId, map }: { teamId: string; map: Record<string, boolean> }) =>
      ardOpsApi.updateTeam(teamId, { tlAnalystCanReview: map }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-team-directory'] }); msg.success('Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openCreate = () => {
    setEditingTeam(null)
    form.resetFields()
    setTeamMembers([])
    setPendingRole(undefined)
    setPendingUserIds([])
    if (hodOptions.find((o) => o.value === currentUserId)) {
      form.setFieldsValue({ hodId: currentUserId })
    }
    setModalOpen(true)
  }

  const openEdit = (team: any) => {
    setEditingTeam(team)
    const tlList = team.tlIds || []
    form.setFieldsValue({
      name: team.teamName,
      hodId: team.hodId,
      mainTlId: tlList[0] || undefined,
      description: team.description,
    })
    setTeamMembers(
      (team.memberIds || []).map((id: string) => {
        const u = userLookup.get(id)
        return { id, name: u?.username || id, role: u?.roleBucket || 'ANALYST' }
      })
    )
    setPendingRole(undefined)
    setPendingUserIds([])
    setModalOpen(true)
  }

  const columns = [
    {
      title: 'Team Name',
      dataIndex: 'teamName',
      render: (v: string) => <span className="font-semibold text-slate-800">{v}</span>,
    },
    {
      title: 'HOD',
      dataIndex: 'hodName',
      render: (v: string) => <span className="text-slate-700 text-xs">{v || '—'}</span>,
    },
    {
      title: 'Team Lead(s)',
      dataIndex: 'tlNames',
      render: (v: string[]) =>
        v && v.length > 0
          ? (
            <div className="flex flex-wrap gap-1">
              {v.map((n, idx) => (
                <Tag key={n} color={idx === 0 ? 'purple' : 'blue'} className="text-xs m-0 font-medium">
                  {n}
                </Tag>
              ))}
            </div>
          )
          : <span className="text-slate-400 text-xs">—</span>,
    },
    {
      title: 'Members',
      dataIndex: 'memberIds',
      width: 80,
      align: 'center' as const,
      render: (v: string[]) => <Tag color="blue">{v?.length ?? 0}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, row: any) =>
        isHodOrAdmin ? (
          <Tooltip title={v ? 'Deactivate' : 'Activate'}>
            <Switch
              size="small"
              checked={v}
              onChange={() => toggleActive.mutate(row)}
              loading={toggleActive.isPending}
            />
          </Tooltip>
        ) : (
          <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>
        ),
    },
    {
      title: '',
      width: 60,
      render: (_: any, row: any) => {
        const isMyTl = isTl && (row.tlIds || []).includes(currentUserId)
        if (!isHodOrAdmin && !isMyTl) return null
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {isHodOrAdmin && (
              <Tooltip title="Edit team">
                <Button type="text" size="small" icon={<Edit3 size={14} className="text-indigo-500" />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {ctx}
      <div className="flex items-center gap-2">
        <Users size={20} className="text-indigo-600" />
        <h1 className="text-lg font-bold text-slate-800">ARD Team</h1>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input
          prefix={<Search size={15} className="text-slate-400" />}
          allowClear
          placeholder="Search by team name, HOD or TL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        {isHodOrAdmin && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Create Team
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        dataSource={filtered}
        loading={isLoading}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-slate-400 text-sm">
                  No teams yet.{isHodOrAdmin ? ' Click "Create Team" to get started.' : ''}
                </span>
              }
            />
          ),
        }}
        expandable={{
          expandedRowRender: (row) => {
            const isMyTl = isTl && (row.tlIds || []).includes(currentUserId ?? '')
            const canManage = isHodOrAdmin || isMyTl
            const currentMap: Record<string, string[]> = row.tlAnalystMap || {}
            const canReviewMap: Record<string, boolean> = row.tlAnalystCanReview || {}
            const tls: any[] = row.tls || []

            if (!tls.length) return <p className="text-xs text-slate-400 italic px-4 py-2">No team leads assigned.</p>

            return (
              <div className="px-4 py-3 space-y-3">
                {tls.map((tl: any) => {
                  const isAdding = addingFor?.teamId === row.id && addingFor?.tlId === tl.id
                  const existingIds = currentMap[tl.id] || []
                  return (
                    <div key={tl.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      {/* TL header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100">
                        <div className="flex items-center gap-2">
                          <Tag color="blue" className="text-xs m-0">TL</Tag>
                          <span className="font-semibold text-slate-700 text-sm">{tl.name}</span>
                          <span className="text-slate-400 text-xs">({tl.analysts.length} analysts)</span>
                        </div>
                        {canManage && !isAdding && (
                          <Button type="text" size="small" icon={<Plus size={12} />}
                            className="text-violet-600 text-xs"
                            onClick={() => { setAddingFor({ teamId: row.id, tlId: tl.id }); setAddRole('ANALYST'); setAddSelected([]) }}>
                            Add Analyst
                          </Button>
                        )}
                      </div>

                      {/* Add analyst inline — same role-first, then user-select concept as Team Members in Create Team */}
                      {isAdding && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border-b border-violet-100">
                          <Select
                            size="small"
                            style={{ width: 120 }}
                            value={addRole}
                            onChange={(v) => { setAddRole(v); setAddSelected([]) }}
                            options={MEMBER_ROLE_OPTIONS}
                          />
                          <Select mode="multiple" size="small" style={{ flex: 1 }} showSearch loading={usersLoading}
                            value={addSelected} onChange={setAddSelected}
                            filterOption={(inp, opt) => (opt?.label ?? '').toString().toLowerCase().includes(inp.toLowerCase())}
                            options={(memberOptionsByRole[addRole] || []).filter((o) => !existingIds.includes(o.value))}
                            placeholder="Select user(s)..." />
                          <Button size="small" type="primary" loading={updateAnalystMap.isPending}
                            onClick={() => {
                              if (!addSelected.length) { setAddingFor(null); return }
                              const merged = Array.from(new Set([...existingIds, ...addSelected]))
                              updateAnalystMap.mutate({ teamId: row.id, map: { ...currentMap, [tl.id]: merged } })
                              setAddSelected([])
                              setAddingFor(null)
                            }}>Add</Button>
                          <Button size="small" onClick={() => setAddingFor(null)}>Cancel</Button>
                        </div>
                      )}

                      {/* Analyst list */}
                      {tl.analysts.length === 0
                        ? <p className="text-xs text-slate-400 italic px-3 py-2">No analysts assigned.</p>
                        : (
                          <table className="w-full text-xs">
                            <tbody>
                              {tl.analysts.map((a: any, idx: number) => (
                                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                  <td className="py-1.5 px-3 w-6 text-slate-400">{idx + 1}</td>
                                  <td className="py-1.5 pr-4 font-medium text-slate-700">{a.name}</td>
                                  <td className="py-1.5 pr-4">{roleTag(a.role)}</td>
                                  <td className="py-1.5 pr-4">
                                    <Tooltip title={canManage ? (a.canReview ? 'Can review tests — click to revoke' : 'Cannot review tests — click to grant') : 'Only managers can change this'}>
                                      <div className="flex items-center gap-1.5">
                                        <Switch
                                          size="small"
                                          checked={!!a.canReview}
                                          disabled={!canManage || updateCanReview.isPending}
                                          onChange={(checked) =>
                                            updateCanReview.mutate({ teamId: row.id, map: { ...canReviewMap, [a.id]: checked } })
                                          }
                                        />
                                        <span className="text-xs text-slate-500">Can Review</span>
                                      </div>
                                    </Tooltip>
                                  </td>
                                  {canManage && (
                                    <td className="py-1.5 pr-3 text-right">
                                      <Popconfirm title="Remove analyst?" okText="Remove" okType="danger"
                                        onConfirm={() => {
                                          const updated = existingIds.filter((id: string) => id !== a.id)
                                          updateAnalystMap.mutate({ teamId: row.id, map: { ...currentMap, [tl.id]: updated } })
                                        }}>
                                        <Button type="text" size="small" icon={<X size={12} className="text-red-400" />} />
                                      </Popconfirm>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                    </div>
                  )
                })}

              </div>
            )
          },
          rowExpandable: (row) => (row.tls || []).length > 0,
        }}
        columns={columns}
        className="rounded-lg overflow-hidden border border-slate-200"
      />

      {/* Create / Edit Modal */}
      <Modal
        {...glassModalProps}
        destroyOnHidden
        title={
          <div className="flex items-center gap-2">
            <Users size={16} className="text-indigo-500" />
            <span>{editingTeam ? 'Edit Team' : 'Create New Team'}</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingTeam(null); form.resetFields(); setTeamMembers([]) }}
        onOk={() => form.validateFields().then((v) => {
          // Only one (primary) TL is set here. If the team already had secondary
          // TLs (added later via "Add Team Lead" on the expanded row), keep them —
          // this modal only ever changes who the primary TL is.
          const existingSecondaryTlIds = ((editingTeam?.tlIds || []) as string[]).slice(1)
          const combinedTlIds = Array.from(new Set([v.mainTlId, ...existingSecondaryTlIds])).filter(Boolean)
          const memberIds = teamMembers.map((m) => m.id)
          saveTeam.mutate({
            name: v.name,
            hodId: v.hodId,
            tlIds: combinedTlIds,
            memberIds,
            tlAnalystMap: combinedTlIds[0] && memberIds.length
              ? { [combinedTlIds[0]]: memberIds }
              : {},
            description: v.description,
          })
        })}
        confirmLoading={saveTeam.isPending}
        okText={editingTeam ? 'Save Changes' : 'Create Team'}
        width={560}
      >
        <Form form={form} layout="vertical" className="pt-3">
          <Form.Item name="name" label="Team Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. HPLC Method Development Team A" size="large" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="hodId" label="HOD" rules={[{ required: true, message: 'Required' }]}>
              <Select
                showSearch
                loading={usersLoading}
                filterOption={(i, o) => (o?.label ?? '').toString().toLowerCase().includes(i.toLowerCase())}
                options={hodOptions}
                placeholder="Select HOD"
              />
            </Form.Item>
            <Form.Item name="mainTlId" label="Team Leader" rules={[{ required: true, message: 'Select TL' }]}>
              <Select
                showSearch
                loading={usersLoading}
                filterOption={(i, o) => (o?.label ?? '').toString().toLowerCase().includes(i.toLowerCase())}
                options={tlOptions}
                placeholder="Select Team Leader"
              />
            </Form.Item>
          </div>

          <div className="mb-1 flex items-center gap-2">
            <span className="text-[13px] font-medium text-slate-700">Team Members</span>
            <span className="text-xs text-slate-400 font-normal">Optional</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                style={{ width: '100%', maxWidth: 140 }}
                placeholder="Role"
                value={pendingRole}
                onChange={(v) => { setPendingRole(v); setPendingUserIds([]) }}
                options={MEMBER_ROLE_OPTIONS}
              />
              <Select
                mode="multiple"
                style={{ flex: 1 }}
                showSearch
                loading={usersLoading}
                disabled={!pendingRole}
                placeholder={pendingRole ? 'Select user(s)...' : 'Select a role first'}
                value={pendingUserIds}
                onChange={setPendingUserIds}
                filterOption={(i, o) => (o?.label ?? '').toString().toLowerCase().includes(i.toLowerCase())}
                options={(pendingRole ? memberOptionsByRole[pendingRole] : []).filter(
                  (o) => !teamMembers.some((m) => m.id === o.value)
                )}
              />
              <Button type="primary" ghost onClick={addPendingMembers} disabled={!pendingRole || pendingUserIds.length === 0}>
                Add
              </Button>
            </div>
            {teamMembers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-200/80">
                {teamMembers.map((m) => (
                  <Tag
                    key={m.id}
                    closable
                    onClose={() => setTeamMembers(teamMembers.filter((x) => x.id !== m.id))}
                    className="m-0 py-0.5 px-2"
                  >
                    {m.name} <span className="text-slate-400">· {MEMBER_ROLE_OPTIONS.find((r) => r.value === m.role)?.label || m.role}</span>
                  </Tag>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-2 mb-0">No members added yet.</p>
            )}
          </div>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="Team scope or focus area (optional)" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Workload Tab ──────────────────────────────────────────────────────────────

function WorkloadTab() {
  const { data, isLoading } = useQuery({ queryKey: ['ard-team-workload'], queryFn: ardOpsApi.teamWorkload })
  return (
    <Table
      rowKey="userId"
      dataSource={data?.items}
      loading={isLoading}
      size="small"
      pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
      className="rounded-lg overflow-hidden border border-slate-200"
      columns={[
        { title: 'Analyst', dataIndex: 'userName', render: (v) => <span className="font-semibold text-slate-800">{v}</span> },
        { title: 'Techniques', dataIndex: 'techniques', align: 'center' as const },
        { title: 'Assigned', dataIndex: 'assigned', align: 'center' as const },
        { title: 'In Progress', dataIndex: 'inProgress', align: 'center' as const },
        { title: 'Pending Verify', dataIndex: 'pendingVerify', align: 'center' as const },
        { title: 'Rework', dataIndex: 'rework', align: 'center' as const },
        { title: 'Experiments', dataIndex: 'experiments', align: 'center' as const },
        {
          title: 'Total', dataIndex: 'total', align: 'center' as const,
          render: (v) => <Tag color={v > 5 ? 'red' : v > 2 ? 'orange' : 'green'} className="font-bold">{v}</Tag>,
        },
      ]}
    />
  )
}

// ── Events Tab ────────────────────────────────────────────────────────────────

function EventsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['ard-team-events'], queryFn: ardOpsApi.teamEvents })
  return (
    <Table
      rowKey="id"
      dataSource={data?.items}
      loading={isLoading}
      size="small"
      pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
      className="rounded-lg overflow-hidden border border-slate-200"
      columns={[
        { title: 'Event Type', dataIndex: 'eventType', render: (v) => <Tag color="blue">{v}</Tag> },
        { title: 'Event Time', dataIndex: 'eventTime', render: (v) => <span className="text-slate-500 text-xs">{v ? dayjs(v).format('DD-MMM-YYYY HH:mm') : '—'}</span> },
        { title: 'User', dataIndex: 'user' },
        { title: 'Event Details', dataIndex: 'eventDetails', render: (v) => <span className="text-slate-600 text-xs">{v || '—'}</span> },
      ]}
    />
  )
}

// ── My Sub-Team Tab (TL only) ─────────────────────────────────────────────────

function MySubTeamTab({
  currentUserId,
  analystOptions,
  usersLoading,
}: {
  currentUserId?: string
  analystOptions: { value: string; label: string }[]
  usersLoading: boolean
}) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [addSelected, setAddSelected] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['ard-team-directory'], queryFn: ardOpsApi.teamDirectory })
  const allTeams = data?.items ?? []

  const myTeams = allTeams.filter((t: any) => (t.tlIds || []).includes(currentUserId ?? ''))

  const updateAnalystMap = useMutation({
    mutationFn: ({ teamId, map }: { teamId: string; map: Record<string, string[]> }) =>
      ardOpsApi.updateTeam(teamId, { tlAnalystMap: map }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-team-directory'] }); msg.success('Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const updateCanReview = useMutation({
    mutationFn: ({ teamId, map }: { teamId: string; map: Record<string, boolean> }) =>
      ardOpsApi.updateTeam(teamId, { tlAnalystCanReview: map }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-team-directory'] }); msg.success('Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  if (!myTeams.length) {
    return <Empty description="You are not assigned as a TL in any team." />
  }

  return (
    <div className="space-y-4">
      {ctx}
      {myTeams.map((team: any) => {
        const currentMap: Record<string, string[]> = team.tlAnalystMap || {}
        const myAnalystIds: string[] = currentMap[currentUserId ?? ''] || []
        const tls: any[] = team.tls || []
        const myTlRecord = tls.find((t: any) => t.id === currentUserId)
        const myAnalysts: any[] = myTlRecord?.analysts || []

        return (
          <div key={team.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-2">
                <Tag color="blue">Team</Tag>
                <span className="font-semibold text-slate-700">{team.teamName}</span>
                <span className="text-slate-400 text-xs">{myAnalysts.length} analysts</span>
              </div>
              {!showAdd && (
                <Button size="small" type="text" icon={<UserPlus size={13} />} className="text-violet-600 text-xs"
                  onClick={() => { setShowAdd(true); setAddSelected([]) }}>
                  Add Analyst
                </Button>
              )}
            </div>

            {showAdd && (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border-b border-violet-100">
                <Select mode="multiple" size="small" style={{ flex: 1 }} showSearch loading={usersLoading}
                  value={addSelected} onChange={setAddSelected}
                  filterOption={(inp, opt) => (opt?.label ?? '').toString().toLowerCase().includes(inp.toLowerCase())}
                  options={analystOptions.filter((o) => !myAnalystIds.includes(o.value))}
                  placeholder="Select analysts to add..." />
                <Button size="small" type="primary" loading={updateAnalystMap.isPending}
                  onClick={() => {
                    if (!addSelected.length) { setShowAdd(false); return }
                    const merged = Array.from(new Set([...myAnalystIds, ...addSelected]))
                    updateAnalystMap.mutate({ teamId: team.id, map: { ...currentMap, [currentUserId ?? '']: merged } })
                    setAddSelected([])
                    setShowAdd(false)
                  }}>Add</Button>
                <Button size="small" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            )}

            {isLoading
              ? <div className="p-4 text-center text-slate-400 text-sm">Loading…</div>
              : myAnalysts.length === 0
                ? <p className="text-xs text-slate-400 italic px-4 py-3">No analysts in your sub-team yet.</p>
                : (
                  <table className="w-full text-xs">
                    <tbody>
                      {myAnalysts.map((a: any, idx: number) => {
                        const teamCanReviewMap: Record<string, boolean> = team.tlAnalystCanReview || {}
                        return (
                          <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="py-1.5 px-3 w-6 text-slate-400">{idx + 1}</td>
                            <td className="py-1.5 pr-4 font-medium text-slate-700">{a.name}</td>
                            <td className="py-1.5 pr-4">{roleTag(a.role)}</td>
                            <td className="py-1.5 pr-4">
                              <Tooltip title={a.canReview ? 'Can review tests — click to revoke' : 'Cannot review tests — click to grant'}>
                                <div className="flex items-center gap-1.5">
                                  <Switch
                                    size="small"
                                    checked={!!a.canReview}
                                    disabled={updateCanReview.isPending}
                                    onChange={(checked) =>
                                      updateCanReview.mutate({ teamId: team.id, map: { ...teamCanReviewMap, [a.id]: checked } })
                                    }
                                  />
                                  <span className="text-xs text-slate-500">Can Review</span>
                                </div>
                              </Tooltip>
                            </td>
                            <td className="py-1.5 pr-3 text-right">
                              <Popconfirm title="Remove from your sub-team?" okText="Remove" okType="danger"
                                onConfirm={() => {
                                  const updated = myAnalystIds.filter((id: string) => id !== a.id)
                                  updateAnalystMap.mutate({ teamId: team.id, map: { ...currentMap, [currentUserId ?? '']: updated } })
                                }}>
                                <Button type="text" size="small" icon={<X size={12} className="text-red-400" />} />
                              </Popconfirm>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ArdTeamPage() {
  const user = useAppSelector(selectUser)
  const isHodOrAdmin = ['HOD', 'ADMIN', 'SUPER_ADMIN', 'QA'].includes(user?.role_code ?? '')
  const isTl = user?.role_code === 'TL'

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['ard-team-users'],
    queryFn: ardOpsApi.teamUsers,
    staleTime: 0,
  })

  const allUsers = usersData?.items ?? []
  const userMap = new Map<string, any>()
  if (user) userMap.set(user.id, { id: user.id, username: user.username, role_code: user.role_code, department_code: null })
  allUsers.forEach((u) => userMap.set(u.id, u))
  const combinedUsers = Array.from(userMap.values())

  const hodOptions = combinedUsers
    .filter((u) => HOD_ROLES.has(userRole(u)) && ARD_DEPTS.has(userDept(u)))
    .map((u) => ({ value: u.id, label: u.id === user?.id ? `${u.username} (me)` : u.username }))

  const tlOptions = combinedUsers
    .filter((u) => TL_ROLES.has(userRole(u)) && ARD_DEPTS.has(userDept(u)))
    .map((u) => ({ value: u.id, label: u.username }))

  const analystOptions = combinedUsers
    .filter((u) => ANALYST_ROLES.has(userRole(u)) && ARD_DEPTS.has(userDept(u)))
    .map((u) => ({ value: u.id, label: u.username }))

  const qaOptions = combinedUsers
    .filter((u) => QA_DEPTS.has(userDept(u)))
    .map((u) => ({ value: u.id, label: u.username }))

  const memberOptionsByRole: Record<string, { value: string; label: string }[]> = {
    ANALYST: analystOptions,
    TL: tlOptions,
    HOD: hodOptions,
    QA: qaOptions,
  }

  const userLookup = new Map<string, { username: string; roleBucket: string }>()
  combinedUsers.forEach((u) => {
    const bucket = QA_DEPTS.has(userDept(u)) ? 'QA'
      : HOD_ROLES.has(userRole(u)) ? 'HOD'
      : TL_ROLES.has(userRole(u)) ? 'TL'
      : 'ANALYST'
    userLookup.set(u.id, { username: u.username, roleBucket: bucket })
  })

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      <div className="flex items-center gap-2 px-1">
        <Users size={20} className="text-indigo-600" />
        <h1 className="text-lg font-bold text-slate-800">ARD Team</h1>
      </div>
      <div className="glass-card rounded-lg p-4">
        <Tabs
          defaultActiveKey={isTl && !isHodOrAdmin ? 'my-subteam' : 'directory'}
          items={[
            {
              key: 'directory',
              label: 'Directory',
              children: (
                <DirectoryTab
                  isHodOrAdmin={isHodOrAdmin}
                  isTl={isTl}
                  currentUserId={user?.id}
                  hodOptions={hodOptions}
                  tlOptions={tlOptions}
                  analystOptions={analystOptions}
                  memberOptionsByRole={memberOptionsByRole}
                  userLookup={userLookup}
                  usersLoading={usersLoading}
                />
              ),
            },
            ...(isTl ? [{
              key: 'my-subteam',
              label: 'My Sub-Team',
              children: (
                <MySubTeamTab
                  currentUserId={user?.id}
                  analystOptions={analystOptions}
                  usersLoading={usersLoading}
                />
              ),
            }] : []),
            { key: 'workload', label: 'Workload', children: <WorkloadTab /> },
            { key: 'events', label: 'Recent Events', children: <EventsTab /> },
          ]}
        />
      </div>
    </div>
  )
}
