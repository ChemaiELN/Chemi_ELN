import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MenuProps } from 'antd'
import { Table, Tag, Select, Input, Tabs, Card, Button, Modal, Form, message, Tooltip, Space, Dropdown } from 'antd'
import { TestTube, Search, Clock, UserCheck, Eye, RotateCcw, Unlock, MoreHorizontal } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet, apiPost } from '../../api/client'
import { ardAtrApi } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'

interface TestRow {
  id: string
  atrId: string
  formNo: string
  productName: string
  sampleCode: string
  testType: string
  techniqueName: string | null
  status: string
  assignedToName: string | null
  assignedToId: string | null
  assignedAt: string | null
  createdAt: string | null
  arNumber: string | null
}

const _STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default', PENDING: 'default',
  ASSIGNED: 'blue', IN_PROGRESS: 'processing', DELEGATED: 'purple',
  VERIFICATION_REQUESTED: 'gold', VERIFICATION_REWORK: 'orange',
  VERIFIED: 'green', TENTATIVE: 'cyan', ACCEPTED: 'green',
  PUBLISHED: 'geekblue', UNSATISFACTORY: 'red',
  ENHANCEMENT_REQUESTED: 'magenta',
  UNLOCKED: 'gold', WITHDRAWN: 'volcano', CANCELLED: 'red',
}

function statusColor(status: string) {
  return _STATUS_COLOR[status] ?? 'blue'
}

const TAKEOVER_ROLES = ['TL', 'HOD', 'SUPER_ADMIN', 'ADMIN']

export default function ArdTestsPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const { tagColor: healthTagColor } = useHealthIndicator()

  const isAnalyst = user?.role_code === 'ANALYST' || user?.role_code === 'CHEM'
  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const isScopedUser = !isUnscopedAdmin
  const canTakeover = TAKEOVER_ROLES.includes(user?.role_code ?? '')
  const canUnlock = ['TL', 'HOD', 'ADMIN', 'SUPER_ADMIN', 'QA'].includes(user?.role_code ?? '')
  const isSupervisory = ['HOD', 'QA', 'ADMIN', 'SUPER_ADMIN', 'QC_MANAGER'].includes(user?.role_code ?? '')

  const [activeTab, setActiveTab] = useState(isAnalyst ? 'my_assigned' : 'all')
  const [status, setStatus] = useState<string | undefined>()
  const [q, setQ] = useState('')

  // Assign modal state
  const [assignModal, setAssignModal] = useState<{ row: TestRow } | null>(null)
  const [selectedAnalystId, setSelectedAnalystId] = useState('')
  const [assignPassword, setAssignPassword] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // Takeover modal state
  const [takeover, setTakeover] = useState<{ row: TestRow } | null>(null)
  const [takeoverTarget, setTakeoverTarget] = useState('')
  const [takeoverRemarks, setTakeoverRemarks] = useState('')
  const [takeoverLoading, setTakeoverLoading] = useState(false)

  // Unlock modal state (B-50)
  const [unlockModal, setUnlockModal] = useState<{ row: TestRow } | null>(null)
  const [unlockRemarks, setUnlockRemarks] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)

  // Bulk assign state (B-60)
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkAnalystId, setBulkAnalystId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Cancel modal state (C-02)
  const [cancelModal, setCancelModal] = useState<{ row: TestRow } | null>(null)
  const [cancelRemarks, setCancelRemarks] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Unsatisfactory modal state (C-02)
  const [unsatModal, setUnsatModal] = useState<{ row: TestRow } | null>(null)
  const [unsatRemarks, setUnsatRemarks] = useState('')
  const [unsatLoading, setUnsatLoading] = useState(false)

  // Delegate modal state (C-10)
  const [delegateModal, setDelegateModal] = useState<{ row: TestRow } | null>(null)
  const [delegateTarget, setDelegateTarget] = useState('')
  const [delegateRemarks, setDelegateRemarks] = useState('')
  const [delegateLoading, setDelegateLoading] = useState(false)

  // Request Enhancement modal state (C-02)
  const [enhanceModal, setEnhanceModal] = useState<{ row: TestRow } | null>(null)
  const [enhanceDesc, setEnhanceDesc] = useState('')
  const [enhanceRemarks, setEnhanceRemarks] = useState('')
  const [enhanceLoading, setEnhanceLoading] = useState(false)

  // Accept modal state (C-02)
  const [acceptModal, setAcceptModal] = useState<{ row: TestRow } | null>(null)
  const [acceptRemarks, setAcceptRemarks] = useState('')
  const [acceptLoading, setAcceptLoading] = useState(false)

  const clearSelection = useCallback(() => setSelectedRowKeys([]), [])

  const { data: teamUsersData } = useQuery({
    queryKey: ['ard-team-users'],
    queryFn: () => apiGet<{ items: { id: string; username: string; full_name?: string; role_code: string; department_code?: string }[] }>('/api/ard/team/users'),
  })

  const { data: qualifiedData, isLoading: qualifiedLoading } = useQuery({
    queryKey: ['ard-qualified-analysts', assignModal?.row.atrId, assignModal?.row.id],
    queryFn: () => apiGet<{ techniqueKey: string; items: { userId: string; userName: string; roleCode: string }[]; isRestricted: boolean }>(`/api/ard/tests/${assignModal?.row.atrId}/${assignModal?.row.id}/qualified-analysts`),
    enabled: !!assignModal?.row.atrId && !!assignModal?.row.id,
  })

  const analystOptions = useMemo(() => {
    if (qualifiedData?.isRestricted) {
      // Qualifications are configured — only certified analysts can be selected (list may be empty)
      return (qualifiedData.items ?? []).map((u) => ({
        value: u.userId,
        label: `${u.userName} (${u.roleCode || 'ANALYST'}) ✓ Certified`,
      }))
    }
    // No qualifications configured for this technique — allow all team analysts
    return (teamUsersData?.items ?? [])
      .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code) && u.department_code !== 'QA')
      .map((u) => ({
        value: u.id,
        label: `${u.username} (${u.role_code})`,
      }))
  }, [qualifiedData, teamUsersData])

  const assignmentBlocked = qualifiedData?.isRestricted === true && analystOptions.length === 0

  const { data, isLoading } = useQuery({
    queryKey: ['ard-tests', status, q],
    queryFn: () => apiGet<{ items: TestRow[]; total: number }>('/api/ard/tests', { status, q: q || undefined, pageSize: 100 }),
  })

  const rawItems = data?.items ?? []

  // Role scoping: Scoped users (Analyst / TL) only see assigned or relevant tests
  const items = isScopedUser
    ? rawItems.filter(r => !r.assignedToName || r.assignedToId === user?.id || r.assignedToName === user?.username)
    : rawItems

  // Filter queue lists by active tab
  const filteredItems = items.filter((row) => {
    if (activeTab === 'my_assigned') {
      return row.assignedToId === user?.id || row.assignedToName === user?.username
    }
    if (activeTab === 'pending_verify') return row.status === 'VERIFICATION_REQUESTED'
    if (activeTab === 'rework') return row.status === 'VERIFICATION_REWORK'
    if (activeTab === 'delegated') return row.status === 'DELEGATED'
    if (activeTab === 'in_progress') return row.status === 'IN_PROGRESS' || row.status === 'ASSIGNED'
    if (activeTab === 'unassigned') return row.status === 'UNASSIGNED' || (!row.assignedToName && row.status !== 'CANCELLED' && row.status !== 'WITHDRAWN')
    if (activeTab === 'verified') return row.status === 'VERIFIED'
    if (activeTab === 'unlocked') return row.status === 'UNLOCKED'
    if (activeTab === 'enhancement') return row.status === 'ENHANCEMENT_REQUESTED'
    if (activeTab === 'team_queue') {
      // Tests assigned to any member of the same team (approximated by same TL/department)
      return ['ASSIGNED', 'IN_PROGRESS', 'DELEGATED', 'VERIFICATION_REWORK'].includes(row.status)
    }
    return true
  })

  const countMyAssigned = items.filter(r => r.assignedToId === user?.id || r.assignedToName === user?.username).length
  const countPendingVerify = items.filter(r => r.status === 'VERIFICATION_REQUESTED').length
  const countRework = items.filter(r => r.status === 'VERIFICATION_REWORK').length
  const countDelegated = items.filter(r => r.status === 'DELEGATED').length
  const countInProgress = items.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED').length
  const countUnassigned = items.filter(r => r.status === 'UNASSIGNED' || (!r.assignedToName && r.status !== 'CANCELLED' && r.status !== 'WITHDRAWN')).length
  const countVerified = items.filter(r => r.status === 'VERIFIED').length
  const countUnlocked = items.filter(r => r.status === 'UNLOCKED').length
  const countEnhancement = items.filter(r => r.status === 'ENHANCEMENT_REQUESTED').length
  const countTeamQueue = items.filter(r => ['ASSIGNED', 'IN_PROGRESS', 'DELEGATED', 'VERIFICATION_REWORK'].includes(r.status)).length

  const tabItems = [
    { key: 'all', label: `All Tests (${items.length})` },
    { key: 'my_assigned', label: `Assigned to Me (${countMyAssigned})` },
    { key: 'in_progress', label: `In Progress (${countInProgress})` },
    { key: 'pending_verify', label: `Pending Verification (${countPendingVerify})` },
    { key: 'rework', label: `Verification Rework (${countRework})` },
    { key: 'delegated', label: `Delegated (${countDelegated})` },
    { key: 'unassigned', label: `Unassigned (${countUnassigned})` },
    { key: 'verified', label: `Verified (${countVerified})` },
    { key: 'unlocked', label: `Unlocked (${countUnlocked})` },
    { key: 'enhancement', label: `Enhancement Requested (${countEnhancement})` },
    { key: 'team_queue', label: `Team Queue (${countTeamQueue})` },
  ]

  const handleAssignConfirm = async () => {
    if (!assignModal || !selectedAnalystId) {
      msgApi.error('Please select an analyst.')
      return
    }
    if (!assignPassword) {
      msgApi.error('Please enter your password to sign this assignment.')
      return
    }
    const targetUser = teamUsersData?.items.find((u) => u.id === selectedAnalystId)
    if (!targetUser) return
    setAssignLoading(true)
    try {
      const { row } = assignModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/assign`, {
        analystId: targetUser.id,
        analystName: targetUser.username,
        password: assignPassword,
      })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success(`Test assigned to ${targetUser.username}.`)
      setAssignModal(null)
      setSelectedAnalystId('')
      setAssignPassword('')
    } catch (e: any) {
      const errDetail = e?.response?.data?.detail || e?.detail || e?.message || 'Failed to assign test.'
      msgApi.error(errDetail)
    } finally {
      setAssignLoading(false)
    }
  }

  const handleClaimClick = async (row: TestRow) => {
    try {
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/claim`, {})
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Test claimed successfully.')
    } catch {
      msgApi.error('Failed to claim test.')
    }
  }

  const handleTakeoverConfirm = async () => {
    if (!takeover) return
    if (!takeoverRemarks.trim()) {
      msgApi.error('Remarks are required for takeover.')
      return
    }
    setTakeoverLoading(true)
    try {
      const { row } = takeover
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/takeover`, {
        targetUserId: takeoverTarget.trim() || undefined,
        remarks: takeoverRemarks,
      })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Test taken over successfully.')
      setTakeover(null)
      setTakeoverTarget('')
      setTakeoverRemarks('')
    } catch {
      msgApi.error('Takeover failed. Please try again.')
    } finally {
      setTakeoverLoading(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelModal) return
    if (!cancelRemarks.trim()) { msgApi.error('Remarks are required to cancel.'); return }
    setCancelLoading(true)
    try {
      const { row } = cancelModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/cancel`, { remarks: cancelRemarks })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Test cancelled.')
      setCancelModal(null)
      setCancelRemarks('')
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to cancel test.')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleUnsatConfirm = async () => {
    if (!unsatModal) return
    if (!unsatRemarks.trim()) { msgApi.error('Remarks are required.'); return }
    setUnsatLoading(true)
    try {
      const { row } = unsatModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/unsatisfactory`, { remarks: unsatRemarks })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Test marked as unsatisfactory.')
      setUnsatModal(null)
      setUnsatRemarks('')
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to mark unsatisfactory.')
    } finally {
      setUnsatLoading(false)
    }
  }

  const handleDelegateConfirm = async () => {
    if (!delegateModal) return
    if (!delegateTarget) { msgApi.error('Please select a target analyst.'); return }
    const targetUser = teamUsersData?.items.find((u) => u.id === delegateTarget)
    if (!targetUser) { msgApi.error('User not found.'); return }
    setDelegateLoading(true)
    try {
      const { row } = delegateModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/delegate`, {
        targetUserId: targetUser.id,
        targetUserName: targetUser.username,
        remarks: delegateRemarks,
      })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success(`Test delegated to ${targetUser.username}.`)
      setDelegateModal(null)
      setDelegateTarget('')
      setDelegateRemarks('')
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to delegate test.')
    } finally {
      setDelegateLoading(false)
    }
  }

  const handleEnhanceConfirm = async () => {
    if (!enhanceModal) return
    if (!enhanceDesc.trim()) { msgApi.error('Description is required.'); return }
    setEnhanceLoading(true)
    try {
      const { row } = enhanceModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/enhancement-requests`, {
        description: enhanceDesc,
        remarks: enhanceRemarks,
      })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Enhancement request submitted.')
      setEnhanceModal(null)
      setEnhanceDesc('')
      setEnhanceRemarks('')
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to submit enhancement request.')
    } finally {
      setEnhanceLoading(false)
    }
  }

  const handleAcceptConfirm = async () => {
    if (!acceptModal) return
    setAcceptLoading(true)
    try {
      const { row } = acceptModal
      await apiPost(`/api/ard/tests/${row.atrId}/${row.id}/accept-test`, { remarks: acceptRemarks || undefined })
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success('Test results accepted.')
      setAcceptModal(null)
      setAcceptRemarks('')
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to accept test.')
    } finally {
      setAcceptLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      {ctx}
      <div className="flex items-center gap-2">
        <TestTube size={20} className="text-indigo-600" />
        <h1 className="text-lg font-bold text-slate-800">Test Execution Queue</h1>
      </div>
      <Card className="glass-card rounded-lg overflow-hidden" styles={{ body: { padding: '16px 16px 0' } }}>
        {/* Scrollable tab bar */}
        <div className="overflow-x-auto -mx-4 px-4">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ minWidth: 'max-content' }}
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 py-3 border-t border-slate-100">
          <Input
            placeholder="Search form no / product / sample"
            prefix={<Search size={14} className="text-slate-400" />}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            allowClear
            style={{ flex: '1 1 220px', maxWidth: 320 }}
          />
          <Select
            allowClear
            placeholder="Filter by Status"
            style={{ flex: '1 1 160px', maxWidth: 220 }}
            value={status}
            onChange={setStatus}
            options={[
              'UNASSIGNED', 'ASSIGNED', 'PENDING', 'DELEGATED', 'IN_PROGRESS',
              'VERIFICATION_REQUESTED', 'VERIFICATION_REWORK', 'VERIFIED',
              'TENTATIVE', 'ACCEPTED', 'UNSATISFACTORY', 'PUBLISHED',
              'ENHANCEMENT_REQUESTED', 'UNLOCKED', 'WITHDRAWN', 'CANCELLED',
            ].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
        </div>

        {selectedRowKeys.length > 0 && isUnscopedAdmin && (
          <div className="flex items-center gap-3 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg mb-2">
            <span className="text-sm font-medium text-indigo-700">{selectedRowKeys.length} test{selectedRowKeys.length !== 1 ? 's' : ''} selected</span>
            <Button size="small" type="primary" onClick={() => { setBulkAnalystId(''); setBulkAssignOpen(true) }}>
              Assign Selected
            </Button>
            <Button size="small" onClick={clearSelection}>Clear</Button>
          </div>
        )}

        <Table
          rowKey="id"
          rowSelection={isUnscopedAdmin ? {
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            getCheckboxProps: (row) => ({ disabled: !['UNASSIGNED', 'PENDING', 'ASSIGNED'].includes(row.status) }),
          } : undefined}
          loading={isLoading}
          dataSource={filteredItems}
          size="small"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onRow={(row) => ({ onClick: () => navigate(`/ard/tests/${row.atrId}/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
          columns={[
            { title: 'Form No', dataIndex: 'formNo', render: (v) => <span className="font-mono font-semibold text-indigo-900 whitespace-nowrap">{v}</span> },
            { title: 'Product', dataIndex: 'productName' },
            { title: 'Sample Code', dataIndex: 'sampleCode', render: (v) => <Tag color="blue" className="text-xs font-mono whitespace-nowrap">{v}</Tag> },
            { title: 'Test Type', dataIndex: 'testType' },
            { title: 'Technique', dataIndex: 'techniqueName', render: (v) => v || '—' },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (v: string) => <Tag color={statusColor(v)} className="font-medium text-xs whitespace-nowrap">{v.replace(/_/g, ' ')}</Tag>,
            },
            { title: 'AR No', dataIndex: 'arNumber', render: (v) => v ? <span className="font-mono text-xs text-violet-700 font-semibold whitespace-nowrap">{v}</span> : <span className="text-slate-300 text-xs">—</span> },
            { title: 'Assigned Analyst', dataIndex: 'assignedToName', render: (v) => v || <span className="text-slate-400 italic">Unassigned</span> },
            {
              title: 'Age',
              dataIndex: 'createdAt',
              width: 80,
              render: (v: string | null) => {
                if (!v) return '—'
                const days = dayjs().diff(dayjs(v), 'day')
                return (
                  <Tooltip title={`Created ${dayjs(v).format('DD MMM YYYY')}`}>
                    <Tag icon={<Clock size={10} />} color={healthTagColor(days)} className="text-xs cursor-help">
                      {days}d
                    </Tag>
                  </Tooltip>
                )
              },
            },
            {
              title: 'Assigned Age',
              dataIndex: 'assignedAt',
              width: 100,
              render: (v: string | null, row: TestRow) => {
                if (!v || !['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION_REWORK', 'DELEGATED'].includes(row.status)) return '—'
                const days = dayjs().diff(dayjs(v), 'day')
                return (
                  <Tooltip title={`Assigned ${dayjs(v).format('DD MMM YYYY')}`}>
                    <Tag icon={<UserCheck size={10} />} color={healthTagColor(days)} className="text-xs cursor-help">
                      {days}d
                    </Tag>
                  </Tooltip>
                )
              },
            },
            {
              title: 'Actions',
              width: 200,
              render: (_, row) => {
                const canTakeoverStatus = ['IN_PROGRESS', 'ASSIGNED', 'DELEGATED', 'VERIFICATION_REWORK'].includes(row.status)
                const isUnassigned = !row.assignedToName || row.status === 'UNASSIGNED' || row.status === 'PENDING'
                return (
                  <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      type="link"
                      icon={<Eye size={14} className="text-indigo-600 inline" />}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/ard/tests/${row.atrId}/${row.id}`)
                      }}
                      className="px-1 font-medium"
                    >
                      View
                    </Button>
                    {(canTakeover || isUnscopedAdmin) && (
                      <Button
                        size="small"
                        type="link"
                        icon={<UserCheck size={14} className="text-violet-600 inline" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setAssignModal({ row })
                          setSelectedAnalystId(row.assignedToId || '')
                        }}
                        className="px-1 font-medium text-violet-700"
                      >
                        Assign
                      </Button>
                    )}
                    {isAnalyst && isUnassigned && (
                      <Button
                        size="small"
                        type="link"
                        icon={<UserCheck size={14} className="text-blue-600 inline" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleClaimClick(row)
                        }}
                        className="px-1 font-medium text-blue-700"
                      >
                        Claim
                      </Button>
                    )}
                    {canTakeoverStatus && canTakeover && (
                      <Button
                        size="small"
                        type="link"
                        icon={<RotateCcw size={14} className="text-amber-600 inline" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setTakeover({ row })
                          setTakeoverTarget('')
                          setTakeoverRemarks('')
                        }}
                        className="px-1 font-medium text-amber-700"
                      >
                        Takeover
                      </Button>
                    )}
                    {row.status === 'VERIFIED' && canUnlock && (
                      <Button
                        size="small"
                        type="link"
                        icon={<Unlock size={14} className="text-violet-600 inline" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setUnlockModal({ row })
                          setUnlockRemarks('')
                        }}
                        className="px-1 font-medium text-violet-700"
                      >
                        Unlock
                      </Button>
                    )}
                    {(() => {
                      const moreItems: MenuProps['items'] = []
                      if ((canTakeover || isUnscopedAdmin) && !['VERIFIED', 'CANCELLED', 'WITHDRAWN', 'ACCEPTED', 'PUBLISHED'].includes(row.status)) {
                        moreItems.push({ key: 'cancel', label: 'Cancel', danger: true, onClick: ({ domEvent }) => { domEvent.stopPropagation(); setCancelModal({ row }); setCancelRemarks('') } })
                      }
                      if (isSupervisory && ['VERIFIED', 'TENTATIVE', 'ACCEPTED'].includes(row.status)) {
                        moreItems.push({ key: 'unsatisfactory', label: 'Mark Unsatisfactory', danger: true, onClick: ({ domEvent }) => { domEvent.stopPropagation(); setUnsatModal({ row }); setUnsatRemarks('') } })
                      }
                      if (isSupervisory && row.status === 'TENTATIVE') {
                        moreItems.push({ key: 'accept', label: 'Accept Results', onClick: ({ domEvent }) => { domEvent.stopPropagation(); setAcceptModal({ row }); setAcceptRemarks('') } })
                      }
                      if (canTakeover && ['ASSIGNED', 'IN_PROGRESS'].includes(row.status)) {
                        moreItems.push({ key: 'delegate', label: 'Delegate', onClick: ({ domEvent }) => { domEvent.stopPropagation(); setDelegateModal({ row }); setDelegateTarget(''); setDelegateRemarks('') } })
                      }
                      if (isAnalyst && ['VERIFIED', 'TENTATIVE', 'ACCEPTED'].includes(row.status)) {
                        moreItems.push({ key: 'enhance', label: 'Request Enhancement', onClick: ({ domEvent }) => { domEvent.stopPropagation(); setEnhanceModal({ row }); setEnhanceDesc(''); setEnhanceRemarks('') } })
                      }
                      if (moreItems.length === 0) return null
                      return (
                        <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                          <Button size="small" type="text" icon={<MoreHorizontal size={14} />} onClick={(e) => e.stopPropagation()} />
                        </Dropdown>
                      )
                    })()}
                  </Space>
                )
              },
            },
          ]}
        />
      </Card>

      {/* Assign Analyst Modal */}
      <Modal
        {...glassModalProps}
        title="Assign Analyst to Test"
        open={!!assignModal}
        onCancel={() => { setAssignModal(null); setSelectedAnalystId(''); setAssignPassword('') }}
        onOk={handleAssignConfirm}
        confirmLoading={assignLoading}
        okText="Assign Analyst"
        okButtonProps={{ disabled: assignmentBlocked }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <p className="text-xs text-slate-600">
            Select an analyst from your team to perform this analytical test: <strong>{assignModal?.row.testType}</strong> ({assignModal?.row.formNo}).
          </p>
          {assignmentBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <strong>Assignment blocked:</strong> Qualifications are configured for this technique but no analyst currently holds a valid certification. Update qualification records before assigning.
            </div>
          ) : (
            <>
              <Form.Item
                label={qualifiedData?.isRestricted ? 'Certified Analyst *' : 'Select Analyst *'}
                required
                style={{ marginBottom: 0 }}
              >
                <Select
                  showSearch
                  placeholder={qualifiedLoading ? 'Loading qualified analysts…' : 'Select analyst…'}
                  loading={qualifiedLoading}
                  value={selectedAnalystId}
                  onChange={setSelectedAnalystId}
                  options={analystOptions}
                />
                {qualifiedData?.isRestricted && (
                  <p className="text-xs text-violet-700 mt-1">Only certified analysts shown for this technique.</p>
                )}
              </Form.Item>
              <Form.Item label="Your Password (e-signature) *" required style={{ marginBottom: 0 }}>
                <Input.Password
                  placeholder="Re-enter your password to confirm"
                  value={assignPassword}
                  onChange={(e) => setAssignPassword(e.target.value)}
                  onPressEnter={handleAssignConfirm}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Takeover Modal */}
      <Modal
        {...glassModalProps}
        title="Takeover Test Assignment"
        open={!!takeover}
        onCancel={() => { setTakeover(null); setTakeoverTarget(''); setTakeoverRemarks('') }}
        onOk={handleTakeoverConfirm}
        confirmLoading={takeoverLoading}
        okText="Confirm Takeover"
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <Form.Item label="Target User ID (leave blank to self-assign)" style={{ marginBottom: 12 }}>
            <Input
              value={takeoverTarget}
              onChange={(e) => setTakeoverTarget(e.target.value)}
              placeholder="Target User ID or leave blank to self-assign"
            />
          </Form.Item>
          <Form.Item label="Remarks *" required style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={3}
              value={takeoverRemarks}
              onChange={(e) => setTakeoverRemarks(e.target.value)}
              placeholder="Enter reason for takeover..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Unlock Modal (B-50) */}
      <Modal
        {...glassModalProps}
        title="Unlock Test for Rework"
        open={!!unlockModal}
        onCancel={() => { setUnlockModal(null); setUnlockRemarks('') }}
        onOk={async () => {
          if (!unlockModal) return
          setUnlockLoading(true)
          try {
            await ardAtrApi.unlockTest(unlockModal.row.atrId, unlockModal.row.id, {
              actionRemarks: unlockRemarks || undefined,
              actorUserName: user?.username,
            })
            msgApi.success('Test unlocked successfully')
            qc.invalidateQueries({ queryKey: ['ard-tests'] })
            setUnlockModal(null)
            setUnlockRemarks('')
          } catch {
            msgApi.error('Failed to unlock test')
          } finally {
            setUnlockLoading(false)
          }
        }}
        confirmLoading={unlockLoading}
        okText="Unlock Test"
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <Form.Item label="Remarks (optional)" style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={3}
              value={unlockRemarks}
              onChange={(e) => setUnlockRemarks(e.target.value)}
              placeholder="Reason for unlocking..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Assign Modal (B-60) */}
      <Modal
        {...glassModalProps}
        title={`Bulk Assign ${selectedRowKeys.length} Test${selectedRowKeys.length !== 1 ? 's' : ''}`}
        open={bulkAssignOpen}
        onCancel={() => { setBulkAssignOpen(false); setBulkAnalystId('') }}
        onOk={async () => {
          if (!bulkAnalystId) { msgApi.error('Please select an analyst.'); return }
          const targetUser = teamUsersData?.items.find((u) => u.id === bulkAnalystId)
          if (!targetUser) { msgApi.error('Analyst not found.'); return }
          setBulkLoading(true)
          try {
            const testRefs = selectedRowKeys.map((id) => {
              const row = filteredItems.find((r) => r.id === id)
              return row ? { atrId: row.atrId, testId: row.id } : null
            }).filter(Boolean) as { atrId: string; testId: string }[]
            const res = await ardAtrApi.bulkAssign({
              testIds: testRefs,
              analystId: targetUser.id,
              analystName: targetUser.username,
            })
            msgApi.success(`Assigned ${res.assigned} test${res.assigned !== 1 ? 's' : ''}${res.skipped > 0 ? ` (${res.skipped} skipped)` : ''}.`)
            qc.invalidateQueries({ queryKey: ['ard-tests'] })
            setBulkAssignOpen(false)
            setBulkAnalystId('')
            clearSelection()
          } catch {
            msgApi.error('Bulk assignment failed.')
          } finally {
            setBulkLoading(false)
          }
        }}
        confirmLoading={bulkLoading}
        okText="Assign All"
        okButtonProps={{ disabled: !bulkAnalystId }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <Form.Item label="Assign to Analyst" required style={{ marginBottom: 0 }}>
            <Select
              showSearch
              value={bulkAnalystId || undefined}
              onChange={setBulkAnalystId}
              placeholder="Select analyst..."
              options={(teamUsersData?.items ?? [])
                .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code))
                .map((u) => ({ value: u.id, label: `${u.username} (${u.role_code})` }))}
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Cancel Test Modal (C-02) */}
      <Modal
        {...glassModalProps}
        title="Cancel Test"
        open={!!cancelModal}
        onCancel={() => { setCancelModal(null); setCancelRemarks('') }}
        onOk={handleCancelConfirm}
        confirmLoading={cancelLoading}
        okText="Confirm Cancel"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <p className="text-xs text-slate-600 mb-3">
            Cancel test <strong>{cancelModal?.row.testType}</strong> ({cancelModal?.row.formNo})? This action cannot be undone.
          </p>
          <Form.Item label="Remarks *" required style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={cancelRemarks} onChange={(e) => setCancelRemarks(e.target.value)} placeholder="Enter reason for cancellation..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Unsatisfactory Modal (C-02) */}
      <Modal
        {...glassModalProps}
        title="Mark Test as Unsatisfactory"
        open={!!unsatModal}
        onCancel={() => { setUnsatModal(null); setUnsatRemarks('') }}
        onOk={handleUnsatConfirm}
        confirmLoading={unsatLoading}
        okText="Mark Unsatisfactory"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <p className="text-xs text-slate-600 mb-3">
            Mark <strong>{unsatModal?.row.testType}</strong> ({unsatModal?.row.formNo}) as unsatisfactory?
          </p>
          <Form.Item label="Remarks *" required style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={unsatRemarks} onChange={(e) => setUnsatRemarks(e.target.value)} placeholder="Enter reason..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delegate Modal (C-10) */}
      <Modal
        {...glassModalProps}
        title="Delegate Test"
        open={!!delegateModal}
        onCancel={() => { setDelegateModal(null); setDelegateTarget(''); setDelegateRemarks('') }}
        onOk={handleDelegateConfirm}
        confirmLoading={delegateLoading}
        okText="Delegate"
        okButtonProps={{ disabled: !delegateTarget }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <p className="text-xs text-slate-600">
            Delegate <strong>{delegateModal?.row.testType}</strong> ({delegateModal?.row.formNo}) to another analyst.
          </p>
          <Form.Item label="Delegate To *" required style={{ marginBottom: 12 }}>
            <Select
              showSearch
              placeholder="Select analyst..."
              value={delegateTarget || undefined}
              onChange={setDelegateTarget}
              options={(teamUsersData?.items ?? [])
                .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code))
                .map((u) => ({ value: u.id, label: `${u.username} (${u.role_code})` }))}
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item label="Remarks" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={delegateRemarks} onChange={(e) => setDelegateRemarks(e.target.value)} placeholder="Reason for delegation (optional)..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Request Enhancement Modal (C-02) */}
      <Modal
        {...glassModalProps}
        title="Request Enhancement"
        open={!!enhanceModal}
        onCancel={() => { setEnhanceModal(null); setEnhanceDesc(''); setEnhanceRemarks('') }}
        onOk={handleEnhanceConfirm}
        confirmLoading={enhanceLoading}
        okText="Submit Request"
        okButtonProps={{ disabled: !enhanceDesc.trim() }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <p className="text-xs text-slate-600">
            Submit an enhancement request for <strong>{enhanceModal?.row.testType}</strong> ({enhanceModal?.row.formNo}).
          </p>
          <Form.Item label="Description *" required style={{ marginBottom: 12 }}>
            <Input value={enhanceDesc} onChange={(e) => setEnhanceDesc(e.target.value)} placeholder="Describe the enhancement needed..." />
          </Form.Item>
          <Form.Item label="Remarks" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={enhanceRemarks} onChange={(e) => setEnhanceRemarks(e.target.value)} placeholder="Additional remarks (optional)..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Accept Test Modal (C-02) */}
      <Modal
        {...glassModalProps}
        title="Accept Test Results"
        open={!!acceptModal}
        onCancel={() => { setAcceptModal(null); setAcceptRemarks('') }}
        onOk={handleAcceptConfirm}
        confirmLoading={acceptLoading}
        okText="Accept Results"
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <p className="text-xs text-slate-600 mb-3">
            Accept results for <strong>{acceptModal?.row.testType}</strong> ({acceptModal?.row.formNo})?
          </p>
          <Form.Item label="Remarks (optional)" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={acceptRemarks} onChange={(e) => setAcceptRemarks(e.target.value)} placeholder="Any remarks..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
