import { useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MenuProps } from 'antd'
import { Table, Tag, Select, Input, Tabs, Card, Button, Modal, Form, message, Tooltip, Space, Dropdown, Checkbox, DatePicker } from 'antd'
import { TestTube, Search, Clock, UserCheck, Eye, RotateCcw, Unlock, MoreHorizontal, History, CheckCircle2, Share2, Calendar, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet, apiPost } from '../../api/client'
import { ardAtrApi } from '../../api/ard'
import { ardUploadsApi } from '../../api/ard-uploads'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'

interface TestRow {
  id: string
  atrId: string
  formNo: string
  productName: string
  projectCode: string | null
  sourceDept: string | null
  sampleCode: string
  batchNo: string | null
  storageCondition: string | null
  packType: string | null
  testType: string
  testSubtype: string | null
  techniqueCode: string | null
  status: string
  priority: string | null
  remarks: string | null
  assignedTl: string | null
  requestedBy: string | null
  requestedOn: string | null
  assignedToName: string | null
  assignedToId: string | null
  assignedAt: string | null
  createdAt: string | null
  arNumber: string | null
  notebookReference: string | null
  analyzedBy: string | null
  resultRemarks: string | null
  results: unknown[] | null
  enhancementRequests: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }[] | null
}

function hasPendingEnhancement(row: TestRow): boolean {
  return (row.enhancementRequests ?? []).some((r) => r.status === 'PENDING')
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

// Custom checklist filter panel for the column select-filters. Built by hand
// (instead of antd Table's built-in `filters` + `filterSearch: true`)
// because that built-in combo rendered two overlapping, duplicated checkbox
// lists in testing — most likely the browser's native autofill suggestion
// box for the built-in search input layering on top of antd's own menu,
// since antd doesn't expose an `autoComplete` override for it. A plain
// Checkbox.Group with our own `autoComplete="off"` search input avoids that
// entirely and is simpler to reason about besides.
function ColumnSelectFilter({ values, selectedKeys, setSelectedKeys, confirm, clearFilters }: {
  values: string[]
  selectedKeys: (string | number)[]
  setSelectedKeys: (keys: (string | number)[]) => void
  confirm: () => void
  clearFilters?: () => void
}) {
  const [search, setSearch] = useState('')
  const visible = values.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
  return (
    <div
      style={{
        padding: 8, width: 220, background: '#fafafa', borderRadius: 8,
        boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0',
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Input
        placeholder="Search in filter"
        prefix={<Search size={12} className="text-slate-400" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoComplete="off"
        allowClear
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {visible.length === 0 ? (
          <div className="text-xs text-slate-400 py-2 text-center">No matches</div>
        ) : (
          <Checkbox.Group
            value={selectedKeys as string[]}
            onChange={(keys) => setSelectedKeys(keys as (string | number)[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {visible.map((v) => <Checkbox key={v} value={v}>{v}</Checkbox>)}
          </Checkbox.Group>
        )}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <Button type="link" size="small" style={{ padding: 0 }}
          onClick={() => { setSelectedKeys([]); clearFilters?.(); confirm() }}>
          Reset
        </Button>
        <Button type="primary" size="small" onClick={() => confirm()}>OK</Button>
      </div>
    </div>
  )
}

// Excel-style column resizing — a thin drag handle on the right edge of each
// header cell. No extra dependency (react-resizable etc.); plain mouse
// events are enough since we only ever drag one edge at a time.
function ResizableTitle(props: any) {
  const { onResize, width, ...restProps } = props
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  if (!width) return <th {...restProps} />

  const onMouseDown = (e: any) => {
    e.stopPropagation()
    e.preventDefault()
    setDragging(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    const onMouseMove = (ev: MouseEvent) => {
      onResize(Math.max(60, startWidthRef.current + (ev.clientX - startXRef.current)))
    }
    const onMouseUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <th {...restProps} style={{ ...restProps.style, position: 'relative' }}>
      {restProps.children}
      <span
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
        className={dragging ? 'bg-indigo-400' : 'hover:bg-indigo-200'}
        style={{
          position: 'absolute', right: -3, top: 0, bottom: 0, width: 6,
          cursor: 'col-resize', userSelect: 'none', touchAction: 'none', zIndex: 2,
        }}
      />
    </th>
  )
}

export default function ArdTestsPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const { tagColor: healthTagColor } = useHealthIndicator()
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

  const isAnalyst = user?.role_code === 'ANALYST' || user?.role_code === 'CHEM'
  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const isScopedUser = !isUnscopedAdmin
  const canTakeover = TAKEOVER_ROLES.includes(user?.role_code ?? '')
  const canUnlock = ['TL', 'HOD', 'ADMIN', 'SUPER_ADMIN', 'QA'].includes(user?.role_code ?? '')
  const isSupervisory = ['HOD', 'QA', 'ADMIN', 'SUPER_ADMIN', 'QC_MANAGER'].includes(user?.role_code ?? '')

  const [activeTab, setActiveTab] = useState(isAnalyst ? 'assigned_tests' : 'all')
  const [status, setStatus] = useState<string | undefined>()
  const [q, setQ] = useState('')
  // "Assigned Tests" is one top-level tab holding two inner views — Me /
  // Others — mirroring the legacy screen's own layout instead of a merged
  // table, since the two views need different action sets (Process only
  // makes sense for your own test).
  const [assignedSubTab, setAssignedSubTab] = useState<'me' | 'others'>('me')
  // Enhancement Requests carries the same Me / Others split as Assigned
  // Tests, kept as its own state so switching tabs doesn't cross-contaminate
  // which sub-view is showing.
  const [enhancementSubTab, setEnhancementSubTab] = useState<'me' | 'others'>('me')

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

  // Bulk accept / delegate state — Unassigned tab's toolbar lets Assign,
  // Accept and Delegate act on however many rows are checked (only Events
  // stays single-row).
  const [bulkAcceptOpen, setBulkAcceptOpen] = useState(false)
  const [bulkAcceptRemarks, setBulkAcceptRemarks] = useState('')
  const [bulkAcceptLoading, setBulkAcceptLoading] = useState(false)
  const [bulkDelegateOpen, setBulkDelegateOpen] = useState(false)
  const [bulkDelegateTarget, setBulkDelegateTarget] = useState('')
  const [bulkDelegateRemarks, setBulkDelegateRemarks] = useState('')
  const [bulkDelegateLoading, setBulkDelegateLoading] = useState(false)

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

  // Events modal — audit trail for a single selected test
  const [eventsModal, setEventsModal] = useState<{ row: TestRow } | null>(null)

  const clearSelection = useCallback(() => setSelectedRowKeys([]), [])

  const { data: teamUsersData } = useQuery({
    queryKey: ['ard-team-users'],
    queryFn: () => apiGet<{ items: { id: string; username: string; full_name?: string; role_code: string; department_code?: string }[] }>('/api/ard/team/users'),
  })

  const { data: teamDirectoryData } = useQuery({
    queryKey: ['ard-team-directory'],
    queryFn: () => apiGet<{ items: any[] }>('/api/ard/team/directory'),
  })

  // Member ids of only the team(s) the current user actually LEADS (as HOD
  // or TL) — scopes the teamUsersData fallback below to "my team" only.
  // Deliberately excludes teams where this user is merely a plain member
  // (e.g. a TL seconded onto another team's roster) — that team's analysts
  // aren't theirs to assign.
  const myTeamMemberIds = useMemo(() => {
    const rawTeams = teamDirectoryData?.items ?? []
    const myTeams = rawTeams.filter((t: any) =>
      t.hodId === user?.id || (t.tlIds ?? []).includes(user?.id)
    )
    const ids = new Set<string>()
    myTeams.forEach((t: any) => (t.memberIds ?? []).forEach((id: string) => ids.add(id)))
    return ids
  }, [teamDirectoryData, user?.id])

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
    // No qualifications configured for this technique — the backend already
    // scopes this to the requester's own team(s), so use it directly rather
    // than falling back to the unscoped /team/users list.
    if (qualifiedData?.items && qualifiedData.items.length > 0) {
      return qualifiedData.items.map((u) => ({
        value: u.userId,
        label: `${u.userName} (${u.roleCode || 'ANALYST'})`,
      }))
    }
    return (teamUsersData?.items ?? [])
      .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code) && u.department_code !== 'QA')
      .filter((u) => myTeamMemberIds.size === 0 || myTeamMemberIds.has(u.id))
      .map((u) => ({
        value: u.id,
        label: `${u.username} (${u.role_code})`,
      }))
  }, [qualifiedData, teamUsersData, myTeamMemberIds])

  const assignmentBlocked = qualifiedData?.isRestricted === true && analystOptions.length === 0

  const { data, isLoading } = useQuery({
    queryKey: ['ard-tests', status],
    queryFn: () => apiGet<{ items: TestRow[]; total: number }>('/api/ard/tests', { status, pageSize: 100 }),
  })

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['ard-test-events', eventsModal?.row.atrId, eventsModal?.row.id],
    queryFn: () => apiGet<{ items: { id: string; action: string; detail: string | null; by: string | null; at: string }[] }>(
      `/api/ard/tests/${eventsModal?.row.atrId}/${eventsModal?.row.id}/events`
    ),
    enabled: !!eventsModal,
  })

  const rawItems = data?.items ?? []

  // Role scoping: Scoped users (Analyst / TL) only see assigned or relevant tests
  const scopedItems = isScopedUser
    ? rawItems.filter(r => !r.assignedToName || r.assignedToId === user?.id || r.assignedToName === user?.username)
    : rawItems

  // Search matches across every column shown in the table, not just the
  // handful of fields the backend used to filter on server-side.
  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return scopedItems
    return scopedItems.filter((row) => [
      row.projectCode, row.productName, row.sourceDept, row.sampleCode,
      row.formNo, row.batchNo, row.storageCondition, row.packType,
      row.testType, row.testSubtype, row.techniqueCode, row.priority,
      row.assignedTl, row.assignedToName, row.arNumber, row.requestedBy,
      row.remarks, row.status,
    ].some((v) => (v ?? '').toString().toLowerCase().includes(needle)))
  }, [scopedItems, q])

  // Filter queue lists by active tab
  const filteredItems = items.filter((row) => {
    if (activeTab === 'assigned_tests') {
      const isMine = row.assignedToId === user?.id || row.assignedToName === user?.username
      return assignedSubTab === 'me' ? isMine : (!!row.assignedToName && !isMine)
    }
    if (activeTab === 'pending_verify') return row.status === 'VERIFICATION_REQUESTED'
    if (activeTab === 'rework') return row.status === 'VERIFICATION_REWORK'
    if (activeTab === 'delegated') return row.status === 'DELEGATED'
    if (activeTab === 'in_progress') return row.status === 'IN_PROGRESS' || row.status === 'ASSIGNED'
    if (activeTab === 'unassigned') return row.status === 'UNASSIGNED' || (!row.assignedToName && row.status !== 'CANCELLED' && row.status !== 'WITHDRAWN')
    if (activeTab === 'verified') return row.status === 'VERIFIED'
    if (activeTab === 'unlocked') return row.status === 'UNLOCKED'
    if (activeTab === 'enhancement') {
      if (!hasPendingEnhancement(row)) return false
      const isMine = row.assignedToId === user?.id || row.assignedToName === user?.username
      return enhancementSubTab === 'me' ? isMine : (!!row.assignedToName && !isMine)
    }
    if (activeTab === 'team_queue') {
      // Tests assigned to any member of the same team (approximated by same TL/department)
      return ['ASSIGNED', 'IN_PROGRESS', 'DELEGATED', 'VERIFICATION_REWORK'].includes(row.status)
    }
    return true
  })

  const countAssignedMe = items.filter(r => r.assignedToId === user?.id || r.assignedToName === user?.username).length
  const countAssignedOthers = items.filter(r => !!r.assignedToName && r.assignedToId !== user?.id && r.assignedToName !== user?.username).length
  const countPendingVerify = items.filter(r => r.status === 'VERIFICATION_REQUESTED').length
  const countRework = items.filter(r => r.status === 'VERIFICATION_REWORK').length
  const countDelegated = items.filter(r => r.status === 'DELEGATED').length
  const countInProgress = items.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED').length
  const countUnassigned = items.filter(r => r.status === 'UNASSIGNED' || (!r.assignedToName && r.status !== 'CANCELLED' && r.status !== 'WITHDRAWN')).length
  const countVerified = items.filter(r => r.status === 'VERIFIED').length
  const countUnlocked = items.filter(r => r.status === 'UNLOCKED').length
  const countEnhancement = items.filter(hasPendingEnhancement).length
  const countEnhancementMe = items.filter(r => hasPendingEnhancement(r) && (r.assignedToId === user?.id || r.assignedToName === user?.username)).length
  const countEnhancementOthers = items.filter(r => hasPendingEnhancement(r) && !!r.assignedToName && r.assignedToId !== user?.id && r.assignedToName !== user?.username).length
  const countTeamQueue = items.filter(r => ['ASSIGNED', 'IN_PROGRESS', 'DELEGATED', 'VERIFICATION_REWORK'].includes(r.status)).length

  const tabItems = [
    { key: 'all', label: `All Tests (${items.length})` },
    { key: 'assigned_tests', label: `Assigned Tests (${countAssignedMe + countAssignedOthers})` },
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

  const handleViewReportClick = async (row: TestRow) => {
    try {
      const files = await ardUploadsApi.list('test_final_report', row.id)
      const latest = files[files.length - 1]
      if (!latest) {
        msgApi.error('No final report uploaded for this test yet.')
        return
      }
      window.open(latest.downloadUrl, '_blank')
    } catch {
      msgApi.error('Failed to load the report.')
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

  const handleBulkAcceptConfirm = async () => {
    setBulkAcceptLoading(true)
    try {
      const rows = selectedRowKeys.map((id) => filteredItems.find((r) => r.id === id)).filter(Boolean) as TestRow[]
      await Promise.all(rows.map((row) =>
        apiPost(`/api/ard/tests/${row.atrId}/${row.id}/accept-test`, { remarks: bulkAcceptRemarks || undefined })
      ))
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success(`Accepted ${rows.length} test${rows.length !== 1 ? 's' : ''}.`)
      setBulkAcceptOpen(false)
      setBulkAcceptRemarks('')
      clearSelection()
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to accept one or more tests.')
    } finally {
      setBulkAcceptLoading(false)
    }
  }

  const handleBulkDelegateConfirm = async () => {
    if (!bulkDelegateTarget) { msgApi.error('Please select a target analyst.'); return }
    const targetUser = teamUsersData?.items.find((u) => u.id === bulkDelegateTarget)
    if (!targetUser) { msgApi.error('User not found.'); return }
    setBulkDelegateLoading(true)
    try {
      const rows = selectedRowKeys.map((id) => filteredItems.find((r) => r.id === id)).filter(Boolean) as TestRow[]
      await Promise.all(rows.map((row) =>
        apiPost(`/api/ard/tests/${row.atrId}/${row.id}/delegate`, {
          targetUserId: targetUser.id,
          targetUserName: targetUser.username,
          remarks: bulkDelegateRemarks,
        })
      ))
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      msgApi.success(`Delegated ${rows.length} test${rows.length !== 1 ? 's' : ''} to ${targetUser.username}.`)
      setBulkDelegateOpen(false)
      setBulkDelegateTarget('')
      setBulkDelegateRemarks('')
      clearSelection()
    } catch (e: any) {
      msgApi.error(e?.response?.data?.detail || e?.message || 'Failed to delegate one or more tests.')
    } finally {
      setBulkDelegateLoading(false)
    }
  }

  // Per-column search filter — a small filter icon in the header opens a
  // popover with a search box, instead of a permanent search row under every
  // header. Keeps the table's single header row intact.
  const getColumnSearchProps = (
    dataIndex: keyof TestRow,
    title: string,
    matcher?: (needle: string, row: TestRow) => boolean,
  ) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div
        style={{
          padding: 8, background: '#fafafa', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0',
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Input
          placeholder={`Search ${title}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          autoComplete="off"
          style={{ width: 180, marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 88 }}>Search</Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm(); }} style={{ width: 88 }}>Reset</Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <Search size={12} color={filtered ? '#4f46e5' : '#94a3b8'} />,
    onFilter: (value: any, row: TestRow) => {
      const needle = String(value).toLowerCase()
      return matcher ? matcher(needle, row) : (row[dataIndex] ?? '').toString().toLowerCase().includes(needle)
    },
  })

  // Per-column select filter — for columns whose values come from a small,
  // discrete set (a name, a code) a checklist of what's actually present in
  // the data reads better than free-text search. Built from filteredItems
  // (the current tab's rows), not the full items list — otherwise a tab like
  // "Delegated" with zero rows would still offer every project code that
  // exists anywhere in the queue.
  const getColumnSelectFilterProps = (
    getValue: (row: TestRow) => string | null | undefined,
    onFilterValue?: (value: string, row: TestRow) => boolean,
  ) => {
    const values = Array.from(new Set(filteredItems.map(getValue).filter((v): v is string => !!v))).sort()
    return {
      filterDropdown: (props: any) => <ColumnSelectFilter values={values} {...props} />,
      filterIcon: (filtered: boolean) => <Search size={12} color={filtered ? '#4f46e5' : '#94a3b8'} />,
      onFilter: onFilterValue
        ? (value: any, row: TestRow) => onFilterValue(String(value), row)
        : (value: any, row: TestRow) => getValue(row) === value,
    }
  }

  // Per-column date-range filter — for a "Raised On" style column, matching
  // the legacy screen's start/end date picker in the header.
  const getColumnDateRangeProps = (getValue: (row: TestRow) => string | null | undefined) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div
        style={{
          padding: 8, background: '#fafafa', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0',
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DatePicker.RangePicker
          value={selectedKeys[0] ?? null}
          onChange={(dates) => setSelectedKeys(dates ? [dates] : [])}
          style={{ marginBottom: 8 }}
        />
        <br />
        <Space>
          <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 88 }}>Search</Button>
          <Button size="small" onClick={() => { setSelectedKeys([]); clearFilters?.(); confirm() }} style={{ width: 88 }}>Reset</Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <Calendar size={12} color={filtered ? '#4f46e5' : '#94a3b8'} />,
    onFilter: (value: any, row: TestRow) => {
      const [start, end] = value as [dayjs.Dayjs, dayjs.Dayjs]
      const raw = getValue(row)
      if (!raw || !start || !end) return false
      const d = dayjs(raw)
      return !d.isBefore(start.startOf('day')) && !d.isAfter(end.endOf('day'))
    },
  })

  const renderSampleCode = (v: string, row: TestRow) => (
    <span className="inline-flex items-center gap-1">
      <Tag color="blue" className="text-xs font-mono whitespace-nowrap m-0">{v}</Tag>
      <Tooltip title="Open ATR">
        <Eye size={12} className="text-slate-400 hover:text-indigo-600 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); navigate(`/ard/atrs/${row.atrId}`) }} />
      </Tooltip>
    </span>
  )
  const renderFormNo = (v: string) => <span className="font-mono font-semibold text-indigo-900 whitespace-nowrap">{v}</span>
  const renderTestSubtype = (v: string, row: TestRow) => `${v}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`
  const renderPriority = (v: string | null) => v ? <Tag color={v === 'HIGH' ? 'red' : v === 'MEDIUM' ? 'orange' : 'default'} className="text-xs">{v}</Tag> : '—'
  const renderAssignedToOn = (v: string | null, row: TestRow) => v ? (
    <div className="leading-tight">
      <div>{v}</div>
      <div className="text-[11px] text-slate-400">{row.assignedAt ? dayjs(row.assignedAt).format('DD MMM YYYY (HH:mm)') : ''}</div>
    </div>
  ) : '—'
  const renderAge = (v: string | null) => {
    if (!v) return '—'
    const days = dayjs().diff(dayjs(v), 'day')
    return (
      <Tooltip title={`Created ${dayjs(v).format('DD MMM YYYY')}`}>
        <Tag icon={<Clock size={10} />} color={healthTagColor(days)} className="text-xs cursor-help">
          {days}d
        </Tag>
      </Tooltip>
    )
  }

  // Applies the drag-resize width state to whichever column set is active.
  const applyColumnWidths = (cols: any[]) => cols.map((col: any) => {
    const key = col.dataIndex ?? col.title
    return {
      ...col,
      width: columnWidths[key] ?? col.width ?? 140,
      onHeaderCell: (column: any) => ({
        width: column.width,
        onResize: (w: number) => setColumnWidths((prev) => ({ ...prev, [key]: w })),
      }),
    }
  })

  const defaultColumns = [
    {
      title: 'Project Code', dataIndex: 'projectCode', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.projectCode),
    },
    {
      title: 'Product Name', dataIndex: 'productName',
      ...getColumnSelectFilterProps((row) => row.productName),
    },
    {
      title: 'Source Dept', dataIndex: 'sourceDept', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.sourceDept),
    },
    {
      title: 'Sample Code', dataIndex: 'sampleCode', render: renderSampleCode,
      ...getColumnSelectFilterProps((row) => row.sampleCode),
    },
    { title: 'Form No.', dataIndex: 'formNo', render: renderFormNo, ...getColumnSearchProps('formNo', 'Form No.') },
    { title: 'Batch No', dataIndex: 'batchNo', render: (v: string) => v || '—', ...getColumnSearchProps('batchNo', 'Batch No') },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string) => v || '—', ...getColumnSearchProps('storageCondition', 'Storage Condition') },
    { title: 'Packing', dataIndex: 'packType', render: (v: string) => v || '—', ...getColumnSearchProps('packType', 'Packing') },
    {
      title: 'Test/SubType', dataIndex: 'testType', render: renderTestSubtype,
      ...getColumnSelectFilterProps(
        (row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`,
        (value, row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` === value,
      ),
    },
    {
      title: 'Priority', dataIndex: 'priority', render: renderPriority,
    },
    {
      title: 'Submitted To', dataIndex: 'assignedTl', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.assignedTl),
    },
    {
      title: 'Assigned Analyst', dataIndex: 'assignedToName', render: (v: string) => v || <span className="text-slate-400 italic">Unassigned</span>,
      ...getColumnSelectFilterProps((row) => row.assignedToName),
    },
    {
      title: 'AR No', dataIndex: 'arNumber', render: (v: string) => v ? <span className="font-mono text-xs text-violet-700 font-semibold whitespace-nowrap">{v}</span> : <span className="text-slate-300 text-xs">—</span>,
      ...getColumnSelectFilterProps((row) => row.arNumber),
    },
    {
      title: 'Requested By (on)', dataIndex: 'requestedBy',
      render: (v: string, row: TestRow) => v ? (
        <div className="leading-tight">
          <div>{v}</div>
          <div className="text-[11px] text-slate-400">{row.requestedOn ? dayjs(row.requestedOn).format('DD MMM YYYY (HH:mm)') : ''}</div>
        </div>
      ) : '—',
      ...getColumnSelectFilterProps((row) => row.requestedBy),
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v || '—' },
    {
      title: 'Age',
      dataIndex: 'createdAt',
      width: 70,
      render: renderAge,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor(v)} className="font-medium text-xs whitespace-nowrap">{v.replace(/_/g, ' ')}</Tag>,
      filters: [
        'UNASSIGNED', 'ASSIGNED', 'PENDING', 'DELEGATED', 'IN_PROGRESS',
        'VERIFICATION_REQUESTED', 'VERIFICATION_REWORK', 'VERIFIED',
        'TENTATIVE', 'ACCEPTED', 'UNSATISFACTORY', 'PUBLISHED',
        'ENHANCEMENT_REQUESTED', 'UNLOCKED', 'WITHDRAWN', 'CANCELLED',
      ].map((s) => ({ text: s.replace(/_/g, ' '), value: s })),
      onFilter: (value: any, row: TestRow) => row.status === value,
    },
  ]

  // Legacy "Assigned Tests → Assigned to Me" column set: no Submitted To /
  // Assigned Analyst / AR No / Status columns since those are all implied by
  // being in this tab (it's already mine); adds a plain "Raised On" date in
  // place of "Requested By (on)".
  const myAssignedColumns = [
    {
      title: 'Project Code', dataIndex: 'projectCode', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.projectCode),
    },
    {
      title: 'Product Name', dataIndex: 'productName',
      ...getColumnSelectFilterProps((row) => row.productName),
    },
    {
      title: 'Source Dept', dataIndex: 'sourceDept', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.sourceDept),
    },
    {
      title: 'Sample Code', dataIndex: 'sampleCode', render: renderSampleCode,
      ...getColumnSelectFilterProps((row) => row.sampleCode),
    },
    { title: 'Batch No', dataIndex: 'batchNo', render: (v: string) => v || '—', ...getColumnSearchProps('batchNo', 'Batch No') },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string) => v || '—', ...getColumnSearchProps('storageCondition', 'Storage Condition') },
    { title: 'Packing', dataIndex: 'packType', render: (v: string) => v || '—', ...getColumnSearchProps('packType', 'Packing') },
    { title: 'Form No.', dataIndex: 'formNo', render: renderFormNo, ...getColumnSearchProps('formNo', 'Form No.') },
    {
      title: 'Test/SubType', dataIndex: 'testType', render: renderTestSubtype,
      ...getColumnSelectFilterProps(
        (row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`,
        (value, row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` === value,
      ),
    },
    {
      title: 'Priority', dataIndex: 'priority', render: renderPriority,
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v || '—' },
    {
      title: 'Raised On', dataIndex: 'requestedOn',
      render: (v: string | null, row: TestRow) => {
        const d = v || row.createdAt
        return d ? dayjs(d).format('DD MMM YYYY') : '—'
      },
    },
    {
      title: 'Age',
      dataIndex: 'createdAt',
      width: 70,
      render: renderAge,
    },
  ]

  // Legacy "Assigned Tests → Assigned to Others" column set: same as "Assigned
  // to Me" but Priority is swapped for "Assigned To(On)" — who on the team
  // has it and when they picked it up — since priority isn't the point once
  // it's someone else's test.
  const assignedOthersColumns = [
    ...myAssignedColumns.filter((col: any) => col.title !== 'Priority'),
  ]
  assignedOthersColumns.splice(9, 0, {
    title: 'Assigned To(On)', dataIndex: 'assignedToName', render: renderAssignedToOn as any,
    ...getColumnSelectFilterProps((row) => row.assignedToName),
  })

  // Legacy "In Progress" column set: adds Test No. (the AR number, under its
  // legacy name), Assigned To(On), a Raised On date-range filter and
  // Experiment Code (the test's notebook reference) in place of the shared
  // table's Priority / Submitted To / AR No / Requested By columns.
  const inProgressColumns = [
    {
      title: 'Project Code', dataIndex: 'projectCode', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.projectCode),
    },
    {
      title: 'Product Name', dataIndex: 'productName',
      ...getColumnSelectFilterProps((row) => row.productName),
    },
    {
      title: 'Source Dept', dataIndex: 'sourceDept', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.sourceDept),
    },
    { title: 'Sample Code', dataIndex: 'sampleCode', render: renderSampleCode, ...getColumnSearchProps('sampleCode', 'Sample Code') },
    { title: 'Batch No', dataIndex: 'batchNo', render: (v: string) => v || '—', ...getColumnSearchProps('batchNo', 'Batch No') },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string) => v || '—', ...getColumnSearchProps('storageCondition', 'Storage Condition') },
    { title: 'Packing', dataIndex: 'packType', render: (v: string) => v || '—', ...getColumnSearchProps('packType', 'Packing') },
    {
      title: 'Test/SubType', dataIndex: 'testType', render: renderTestSubtype,
      ...getColumnSelectFilterProps(
        (row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`,
        (value, row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` === value,
      ),
    },
    { title: 'Form No.', dataIndex: 'formNo', render: renderFormNo, ...getColumnSearchProps('formNo', 'Form No.') },
    { title: 'Test No.', dataIndex: 'arNumber', render: (v: string | null) => v || '—', ...getColumnSearchProps('arNumber', 'Test Number') },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor(v)} className="font-medium text-xs whitespace-nowrap">{v.replace(/_/g, ' ')}</Tag>,
      filters: [
        'UNASSIGNED', 'ASSIGNED', 'PENDING', 'DELEGATED', 'IN_PROGRESS',
        'VERIFICATION_REQUESTED', 'VERIFICATION_REWORK', 'VERIFIED',
        'TENTATIVE', 'ACCEPTED', 'UNSATISFACTORY', 'PUBLISHED',
        'ENHANCEMENT_REQUESTED', 'UNLOCKED', 'WITHDRAWN', 'CANCELLED',
      ].map((s) => ({ text: s.replace(/_/g, ' '), value: s })),
      onFilter: (value: any, row: TestRow) => row.status === value,
    },
    {
      title: 'Assigned To(On)', dataIndex: 'assignedToName', render: renderAssignedToOn,
      ...getColumnSelectFilterProps((row) => row.assignedToName),
    },
    {
      title: 'Raised On', dataIndex: 'requestedOn',
      render: (v: string | null, row: TestRow) => {
        const d = v || row.createdAt
        return d ? dayjs(d).format('DD MMM YYYY (HH:mm)') : '—'
      },
      ...getColumnDateRangeProps((row) => row.requestedOn || row.createdAt),
    },
    { title: 'Experiment Code', dataIndex: 'notebookReference', render: (v: string | null) => v || '—', ...getColumnSearchProps('notebookReference', 'Notebook Reference') },
    { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v || '—' },
    {
      title: 'Age',
      dataIndex: 'createdAt',
      width: 70,
      render: renderAge,
    },
  ]

  // Legacy "Pending Verification" column set: swaps Submitted To / Assigned
  // Analyst / AR No / Requested By / Status for Test No. (arNumber), Analyzed
  // By (the analyst who actually ran it — a separate field from "assigned"),
  // Req Count and Test Remarks. Req Count reads the submitted results array
  // (how many result rows were recorded); Test Remarks reads resultRemarks
  // (the remarks entered alongside those results) — the legacy screen doesn't
  // label these any more precisely than that, so this is our best mapping of
  // its "Req Count" / "Test Remarks" onto what the test record actually has.
  const pendingVerifyColumns = [
    {
      title: 'Project Code', dataIndex: 'projectCode', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.projectCode),
    },
    {
      title: 'Product Name', dataIndex: 'productName',
      ...getColumnSelectFilterProps((row) => row.productName),
    },
    { title: 'Sample Code', dataIndex: 'sampleCode', render: renderSampleCode, ...getColumnSearchProps('sampleCode', 'Sample Code') },
    { title: 'Form No.', dataIndex: 'formNo', render: renderFormNo, ...getColumnSearchProps('formNo', 'Form No.') },
    { title: 'Batch No', dataIndex: 'batchNo', render: (v: string) => v || '—', ...getColumnSearchProps('batchNo', 'Batch No') },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string) => v || '—', ...getColumnSearchProps('storageCondition', 'Storage Condition') },
    { title: 'Packing', dataIndex: 'packType', render: (v: string) => v || '—', ...getColumnSearchProps('packType', 'Packing') },
    {
      title: 'Test/SubType', dataIndex: 'testType', render: renderTestSubtype,
      ...getColumnSelectFilterProps(
        (row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`,
        (value, row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` === value,
      ),
    },
    { title: 'Priority', dataIndex: 'priority', render: renderPriority },
    { title: 'Test No.', dataIndex: 'arNumber', render: (v: string | null) => v || '—', ...getColumnSearchProps('arNumber', 'Test Number') },
    {
      title: 'Analyzed By', dataIndex: 'analyzedBy', render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((row) => row.analyzedBy),
    },
    {
      title: 'Req Count', dataIndex: 'results',
      render: (v: unknown[] | null) => Array.isArray(v) ? v.length : '—',
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v || '—' },
    { title: 'Test Remarks', dataIndex: 'resultRemarks', render: (v: string) => v || '—' },
    {
      title: 'Age',
      dataIndex: 'createdAt',
      width: 70,
      render: renderAge,
    },
  ]

  // Legacy "Enhancement Requests" column set — same shape as Pending
  // Verification but "Analyzed By" becomes a plain "Assigned To" (no
  // stacked timestamp, matching the legacy screen exactly), and it's shared
  // between the Me/Others sub-tabs since neither screenshot shows a column
  // difference between them — only the bottom toolbar differs.
  const enhancementColumns = [
    ...pendingVerifyColumns.filter((col: any) => col.title !== 'Analyzed By'),
  ]
  enhancementColumns.splice(10, 0, {
    title: 'Assigned To', dataIndex: 'assignedToName', render: (v: string | null) => v || '—',
    ...getColumnSelectFilterProps((row) => row.assignedToName),
  })

  // Legacy "Team Queue" column set — the whole team's in-flight work at a
  // glance: who it's submitted to, who raised it, no per-row action set
  // beyond Events (it's a visibility view, not a workspace).
  const teamQueueColumns = [
    {
      title: 'Project Code', dataIndex: 'projectCode', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.projectCode),
    },
    {
      title: 'Product Name', dataIndex: 'productName',
      ...getColumnSelectFilterProps((row) => row.productName),
    },
    {
      title: 'Source Dept', dataIndex: 'sourceDept', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.sourceDept),
    },
    { title: 'Sample Code', dataIndex: 'sampleCode', render: renderSampleCode, ...getColumnSearchProps('sampleCode', 'Sample Code') },
    { title: 'Batch No', dataIndex: 'batchNo', render: (v: string) => v || '—', ...getColumnSearchProps('batchNo', 'Batch No') },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string) => v || '—', ...getColumnSearchProps('storageCondition', 'Storage Condition') },
    { title: 'Packing', dataIndex: 'packType', render: (v: string) => v || '—', ...getColumnSearchProps('packType', 'Packing') },
    { title: 'Form No.', dataIndex: 'formNo', render: renderFormNo, ...getColumnSearchProps('formNo', 'Form No.') },
    { title: 'Priority', dataIndex: 'priority', render: renderPriority },
    {
      title: 'Test/SubType', dataIndex: 'testType', render: renderTestSubtype,
      ...getColumnSelectFilterProps(
        (row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}`,
        (value, row) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` === value,
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor(v)} className="font-medium text-xs whitespace-nowrap">{v.replace(/_/g, ' ')}</Tag>,
      filters: [
        'UNASSIGNED', 'ASSIGNED', 'PENDING', 'DELEGATED', 'IN_PROGRESS',
        'VERIFICATION_REQUESTED', 'VERIFICATION_REWORK', 'VERIFIED',
        'TENTATIVE', 'ACCEPTED', 'UNSATISFACTORY', 'PUBLISHED',
        'ENHANCEMENT_REQUESTED', 'UNLOCKED', 'WITHDRAWN', 'CANCELLED',
      ].map((s) => ({ text: s.replace(/_/g, ' '), value: s })),
      onFilter: (value: any, row: TestRow) => row.status === value,
    },
    {
      title: 'Submitted To', dataIndex: 'assignedTl', render: (v: string) => v || '—',
      ...getColumnSelectFilterProps((row) => row.assignedTl),
    },
    {
      title: 'Created By', dataIndex: 'requestedBy', render: (v: string) => v || '—',
    },
    {
      title: 'Raised On', dataIndex: 'requestedOn',
      render: (v: string | null, row: TestRow) => {
        const d = v || row.createdAt
        return d ? dayjs(d).format('DD MMM YYYY') : '—'
      },
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v || '—' },
    {
      title: 'Age',
      dataIndex: 'createdAt',
      width: 70,
      render: renderAge,
    },
  ]

  const isUnassignedTab = activeTab === 'unassigned'
  // "Assigned Tests" mirrors the legacy screen's own layout: one tab, two
  // inner views (Me / Others) with different trimmed column sets and action
  // toolbars, rather than one merged table — Process only makes sense for
  // your own test, and Priority isn't relevant once it's someone else's.
  const isMyAssignedTab = activeTab === 'assigned_tests' && assignedSubTab === 'me'
  const isAssignedOthersTab = activeTab === 'assigned_tests' && assignedSubTab === 'others'
  const isInProgressTab = activeTab === 'in_progress'
  const isPendingVerifyTab = activeTab === 'pending_verify'
  const isEnhancementTab = activeTab === 'enhancement'
  const isEnhancementMeTab = isEnhancementTab && enhancementSubTab === 'me'
  const isEnhancementOthersTab = isEnhancementTab && enhancementSubTab === 'others'
  const isTeamQueueTab = activeTab === 'team_queue'

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

        {/* Assigned Tests: inner Me / Others switch, matching the legacy screen's own two sub-tabs */}
        {activeTab === 'assigned_tests' && (
          <Tabs
            activeKey={assignedSubTab}
            onChange={(k) => { setAssignedSubTab(k as 'me' | 'others'); clearSelection() }}
            size="small"
            type="card"
            items={[
              { key: 'me', label: `Assigned to Me (${countAssignedMe})` },
              { key: 'others', label: `Assigned to Others (${countAssignedOthers})` },
            ]}
            style={{ marginTop: -4 }}
          />
        )}

        {/* Enhancement Requested: same inner Me / Others switch */}
        {activeTab === 'enhancement' && (
          <Tabs
            activeKey={enhancementSubTab}
            onChange={(k) => { setEnhancementSubTab(k as 'me' | 'others'); clearSelection() }}
            size="small"
            type="card"
            items={[
              { key: 'me', label: `Assigned to Me (${countEnhancementMe})` },
              { key: 'others', label: `Assigned to Others (${countEnhancementOthers})` },
            ]}
            style={{ marginTop: -4 }}
          />
        )}

        {/* Filter row — Unassigned, Assigned Tests and Enhancement Requested tabs drive selection through their own toolbar instead */}
        {!isUnassignedTab && !isMyAssignedTab && !isAssignedOthersTab && !isEnhancementTab && !isTeamQueueTab && (
          <div className="flex flex-wrap gap-2 py-3 border-t border-slate-100">
            <Input
              placeholder="Search all columns…"
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
        )}

        {!isUnassignedTab && !isMyAssignedTab && !isAssignedOthersTab && !isEnhancementTab && !isTeamQueueTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          const isRowUnassigned = !!selectedRow && (!selectedRow.assignedToName || ['UNASSIGNED', 'PENDING'].includes(selectedRow.status))
          const canTakeoverRow = !!selectedRow && ['IN_PROGRESS', 'ASSIGNED', 'DELEGATED', 'VERIFICATION_REWORK'].includes(selectedRow.status)
          const canUnlockRow = !!selectedRow && selectedRow.status === 'VERIFIED'

          const moreItems: MenuProps['items'] = []
          if (selectedRow && (canTakeover || isUnscopedAdmin) && !['VERIFIED', 'CANCELLED', 'WITHDRAWN', 'ACCEPTED', 'PUBLISHED'].includes(selectedRow.status)) {
            moreItems.push({ key: 'cancel', label: 'Cancel', danger: true, onClick: () => { setCancelModal({ row: selectedRow }); setCancelRemarks('') } })
          }
          if (selectedRow && isSupervisory && ['VERIFIED', 'TENTATIVE', 'ACCEPTED'].includes(selectedRow.status)) {
            moreItems.push({ key: 'unsatisfactory', label: 'Mark Unsatisfactory', danger: true, onClick: () => { setUnsatModal({ row: selectedRow }); setUnsatRemarks('') } })
          }
          if (selectedRow && isAnalyst && ['VERIFIED', 'TENTATIVE', 'ACCEPTED'].includes(selectedRow.status)) {
            moreItems.push({ key: 'enhance', label: 'Request Enhancement', onClick: () => { setEnhanceModal({ row: selectedRow }); setEnhanceDesc(''); setEnhanceRemarks('') } })
          }

          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50 border-x border-b border-slate-200">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              {(canTakeover || isUnscopedAdmin) && (
                <Button size="small" type="primary" icon={<UserCheck size={13} />}
                  onClick={() => {
                    if (selectedRow) { setAssignModal({ row: selectedRow }); setSelectedAnalystId(selectedRow.assignedToId || ''); return }
                    setBulkAnalystId(''); setBulkAssignOpen(true)
                  }}>
                  Assign
                </Button>
              )}
              {isAnalyst && (
                <Button size="small" icon={<UserCheck size={13} />}
                  disabled={!isRowUnassigned}
                  onClick={() => { if (selectedRow) handleClaimClick(selectedRow) }}>
                  Claim
                </Button>
              )}
              {isSupervisory && (
                <Button size="small" icon={<CheckCircle2 size={13} />}
                  disabled={selectedRowKeys.length !== 1}
                  onClick={() => { if (selectedRow) { setAcceptModal({ row: selectedRow }); setAcceptRemarks('') } }}>
                  Accept
                </Button>
              )}
              {canTakeover && (
                <Button size="small" icon={<Share2 size={13} />}
                  disabled={selectedRowKeys.length !== 1}
                  onClick={() => { if (selectedRow) { setDelegateModal({ row: selectedRow }); setDelegateTarget(''); setDelegateRemarks('') } }}>
                  Delegate
                </Button>
              )}
              {canTakeover && (
                <Button size="small" icon={<RotateCcw size={13} />}
                  disabled={!canTakeoverRow}
                  onClick={() => { if (selectedRow) { setTakeover({ row: selectedRow }); setTakeoverTarget(''); setTakeoverRemarks('') } }}>
                  Takeover
                </Button>
              )}
              {canUnlock && (
                <Button size="small" icon={<Unlock size={13} />}
                  disabled={!canUnlockRow}
                  onClick={() => { if (selectedRow) { setUnlockModal({ row: selectedRow }); setUnlockRemarks('') } }}>
                  Unlock
                </Button>
              )}
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              {moreItems.length > 0 && (
                <Dropdown menu={{ items: moreItems }} trigger={['click']}>
                  <Button size="small" icon={<MoreHorizontal size={13} />}>More</Button>
                </Dropdown>
              )}
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}

        <Table
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            hideSelectAll: isUnassignedTab || isMyAssignedTab || isAssignedOthersTab || isEnhancementTab || isTeamQueueTab,
          }}
          loading={isLoading}
          dataSource={filteredItems}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onRow={(row) => ({ onClick: () => navigate(`/ard/tests/${row.atrId}/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
          components={{ header: { cell: ResizableTitle } }}
          columns={applyColumnWidths(
            isMyAssignedTab ? myAssignedColumns
              : isAssignedOthersTab ? assignedOthersColumns
              : isInProgressTab ? inProgressColumns
              : isPendingVerifyTab ? pendingVerifyColumns
              : isEnhancementTab ? enhancementColumns
              : isTeamQueueTab ? teamQueueColumns
              : defaultColumns
          )}
        />

        {/* Unassigned tab: Assign/Accept/Delegate act on however many rows are
            checked; only Events is single-row. Sits right below the table,
            by the pagination, instead of above it. */}
        {isUnassignedTab && selectedRowKeys.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-sm font-medium text-slate-600 mr-2">
              {selectedRowKeys.length} selected
            </span>
            <Button size="small" type="primary" icon={<UserCheck size={13} />}
              onClick={() => { setBulkAnalystId(''); setBulkAssignOpen(true) }}>
              Assign
            </Button>
            <Button size="small" icon={<CheckCircle2 size={13} />}
              onClick={() => { setBulkAcceptRemarks(''); setBulkAcceptOpen(true) }}>
              Accept
            </Button>
            <Button size="small" icon={<Share2 size={13} />}
              onClick={() => { setBulkDelegateTarget(''); setBulkDelegateRemarks(''); setBulkDelegateOpen(true) }}>
              Delegate
            </Button>
            <Button size="small" icon={<History size={13} />}
              disabled={selectedRowKeys.length !== 1}
              onClick={() => {
                const row = filteredItems.find((r) => r.id === selectedRowKeys[0])
                if (row) setEventsModal({ row })
              }}>
              Events
            </Button>
            <Button size="small" onClick={clearSelection}>Clear</Button>
          </div>
        )}

        {/* Assigned-to-Me tab: legacy's own toolbar — Process (open the test,
            one at a time), Delegate (hand off, can act on several at once),
            Events (single-row only). No Takeover/Unlock/Accept here — those
            belong to tabs that deal with other people's or completed tests. */}
        {isMyAssignedTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              <Button size="small" type="primary" icon={<Eye size={13} />}
                disabled={!selectedRow}
                onClick={() => { if (selectedRow) navigate(`/ard/tests/${selectedRow.atrId}/${selectedRow.id}`) }}>
                Process
              </Button>
              <Button size="small" icon={<Share2 size={13} />}
                onClick={() => { setBulkDelegateTarget(''); setBulkDelegateRemarks(''); setBulkDelegateOpen(true) }}>
                Delegate
              </Button>
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}

        {/* Assigned-to-Others tab: view-only over teammates' tests — Delegate
            (reassign someone else's test, several at once) and Events (audit
            trail, single-row). No Process — it isn't your test to open. */}
        {isAssignedOthersTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              <Button size="small" icon={<Share2 size={13} />}
                onClick={() => { setBulkDelegateTarget(''); setBulkDelegateRemarks(''); setBulkDelegateOpen(true) }}>
                Delegate
              </Button>
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}

        {/* Enhancement Requests — Assigned to Me: Assign (still unassigned/
            reassignable, several at once), View Report and Events (both
            single-row — a report or an audit trail only ever belongs to one
            test at a time). */}
        {isEnhancementMeTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              <Button size="small" type="primary" icon={<UserCheck size={13} />}
                onClick={() => { setBulkAnalystId(''); setBulkAssignOpen(true) }}>
                Assign
              </Button>
              <Button size="small" icon={<FileText size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) handleViewReportClick(selectedRow) }}>
                View Report
              </Button>
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}

        {/* Enhancement Requests — Assigned to Others: view-only, no Assign — it's already someone else's. */}
        {isEnhancementOthersTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              <Button size="small" icon={<FileText size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) handleViewReportClick(selectedRow) }}>
                View Report
              </Button>
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}

        {/* Team Queue — a team-wide visibility view, not a workspace: the
            only action is Events (single-row audit trail). */}
        {isTeamQueueTab && selectedRowKeys.length > 0 && (() => {
          const selectedRow = selectedRowKeys.length === 1 ? filteredItems.find((r) => r.id === selectedRowKeys[0]) : undefined
          return (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedRowKeys.length} selected
              </span>
              <Button size="small" icon={<History size={13} />}
                disabled={selectedRowKeys.length !== 1}
                onClick={() => { if (selectedRow) setEventsModal({ row: selectedRow }) }}>
                Events
              </Button>
              <Button size="small" onClick={clearSelection}>Clear</Button>
            </div>
          )
        })()}
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

      {/* Bulk Accept Modal (Unassigned tab toolbar) */}
      <Modal
        {...glassModalProps}
        title={`Accept ${selectedRowKeys.length} Test${selectedRowKeys.length !== 1 ? 's' : ''}`}
        open={bulkAcceptOpen}
        onCancel={() => { setBulkAcceptOpen(false); setBulkAcceptRemarks('') }}
        onOk={handleBulkAcceptConfirm}
        confirmLoading={bulkAcceptLoading}
        okText="Accept All"
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2">
          <Form.Item label="Remarks (optional)" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={bulkAcceptRemarks} onChange={(e) => setBulkAcceptRemarks(e.target.value)} placeholder="Any remarks..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Delegate Modal (Unassigned tab toolbar) */}
      <Modal
        {...glassModalProps}
        title={`Delegate ${selectedRowKeys.length} Test${selectedRowKeys.length !== 1 ? 's' : ''}`}
        open={bulkDelegateOpen}
        onCancel={() => { setBulkDelegateOpen(false); setBulkDelegateTarget(''); setBulkDelegateRemarks('') }}
        onOk={handleBulkDelegateConfirm}
        confirmLoading={bulkDelegateLoading}
        okText="Delegate All"
        okButtonProps={{ disabled: !bulkDelegateTarget }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <Form.Item label="Delegate To *" required style={{ marginBottom: 12 }}>
            <Select
              showSearch
              value={bulkDelegateTarget || undefined}
              onChange={setBulkDelegateTarget}
              placeholder="Select analyst..."
              options={(teamUsersData?.items ?? [])
                .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code))
                .map((u) => ({ value: u.id, label: `${u.username} (${u.role_code})` }))}
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item label="Remarks (optional)" style={{ marginBottom: 0 }}>
            <Input.TextArea rows={3} value={bulkDelegateRemarks} onChange={(e) => setBulkDelegateRemarks(e.target.value)} placeholder="Reason for delegation..." />
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

      {/* Events Modal — audit trail for a single test */}
      <Modal
        {...glassModalProps}
        title={`Events — ${eventsModal?.row.testType ?? ''} (${eventsModal?.row.formNo ?? ''})`}
        open={!!eventsModal}
        onCancel={() => setEventsModal(null)}
        footer={[<Button key="close" onClick={() => setEventsModal(null)}>Close</Button>]}
        destroyOnClose
      >
        <Table
          rowKey="id"
          size="small"
          loading={eventsLoading}
          dataSource={eventsData?.items ?? []}
          pagination={false}
          locale={{ emptyText: 'No events recorded yet.' }}
          columns={[
            { title: 'Action', dataIndex: 'action', render: (v: string) => <Tag className="text-xs">{v.replace(/_/g, ' ')}</Tag> },
            { title: 'By', dataIndex: 'by', render: (v: string | null) => v || '—' },
            { title: 'Detail', dataIndex: 'detail', render: (v: string | null) => v || '—' },
            { title: 'At', dataIndex: 'at', render: (v: string) => dayjs(v).format('DD MMM YYYY (HH:mm)') },
          ]}
        />
      </Modal>
    </div>
  )
}
