import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Input, Select, Button, Tabs, Card, Modal, message, Popconfirm, Space } from 'antd'
import { Plus, FileText, Clock, ShieldCheck, Award, Download, CheckCircle2, Search, Repeat } from 'lucide-react'
import dayjs from 'dayjs'
import { ardAtrApi, ardOpsApi, type AtrStatus, type ArdTestRow, type AtrForm } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { ESignatureModal } from '../../components/common/ESignatureModal'

const STATUS_OPTIONS: AtrStatus[] = [
  'DRAFT', 'SAVED', 'REQUESTED', 'NEW', 'QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK',
  'PENDING_CLARIFICATION', 'CLARIFIED', 'PARTIAL', 'PENDING_APPROVAL',
  'APPROVED', 'VERIFIED', 'CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK',
  'CERTIFIED', 'REJECTED', 'WITHDRAWN', 'ENHANCEMENT_REQUESTED',
]

function statusColor(status: AtrStatus) {
  if (status === 'CERTIFIED') return 'green'
  if (status === 'REJECTED' || status === 'WITHDRAWN') return 'red'
  if (status === 'DRAFT' || status === 'SAVED') return 'default'
  if (status === 'REQUESTED') return 'purple'
  if (status === 'NEW') return 'blue'
  if (status === 'PARTIAL') return 'cyan'
  if (status === 'QA_PRE_APPROVAL' || status === 'CERTIFICATION_REQUESTED') return 'purple'
  if (status === 'CERTIFICATION_REWORK' || status === 'PRE_APPROVAL_REWORK') return 'orange'
  if (status === 'ENHANCEMENT_REQUESTED') return 'magenta'
  return 'gold'
}

export default function ArdAtrsPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const { tagColor: healthTagColor } = useHealthIndicator()
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [activeTab, setActiveTab] = useState('all')
  const [withdrawId, setWithdrawId] = useState<string | null>(null)
  const [withdrawRemarks, setWithdrawRemarks] = useState('')

  const isTl = user?.role_code === 'TL' || user?.role_code === 'TEAM_LEAD'
  const isQa = user?.department_code === 'QA' || user?.role_code === 'QA'
  const isHodUser = ['HOD', 'HEAD_OF_DEPT', 'MANAGER'].includes(user?.role_code ?? '')
  const isHodOrTl = isHodUser || isTl

  // ── Re-assign Test tab (HOD only) ─────────────────────────────────────
  const [reassignTeamTlId, setReassignTeamTlId] = useState<string | undefined>()
  const [activeReassignTlId, setActiveReassignTlId] = useState<string | undefined>()
  const [reassignSearch, setReassignSearch] = useState('')
  const [reassignSelectedIds, setReassignSelectedIds] = useState<string[]>([])
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [reassignEsignOpen, setReassignEsignOpen] = useState(false)
  const [reassignTargetTl, setReassignTargetTl] = useState<string | undefined>()
  const [reassignRemarks, setReassignRemarks] = useState('')

  const { data: teamDirectory } = useQuery({
    queryKey: ['ard-team-directory'],
    queryFn: () => ardOpsApi.listDirectory(),
    enabled: isHodUser,
    staleTime: 60_000,
  })
  const teams = teamDirectory?.items ?? []
  // Only teams this HOD actually leads — never another HOD's team, matching
  // "don't show the other teams if the current user is not the part of the team".
  const myLedTeams = teams.filter((t) => t.hodId === user?.id)
  const myTeamTlOptions = myLedTeams.flatMap((t) =>
    (t.tlIds ?? []).map((tlId, i) => ({ value: tlId, label: `${t.tlNames?.[i] ?? tlId} (${t.teamName})` }))
  )
  // Destination isn't restricted to the HOD's own teams — reassigning across
  // the whole department is the point of this tool.
  const allTlOptions = teams.flatMap((t) =>
    (t.tlIds ?? []).map((tlId, i) => ({ value: tlId, label: `${t.tlNames?.[i] ?? tlId} (${t.teamName})` }))
  )

  const { data: reassignTestsData, isLoading: reassignTestsLoading } = useQuery({
    queryKey: ['ard-reassign-tests', activeReassignTlId],
    queryFn: () => ardAtrApi.listTests({ tlId: activeReassignTlId, pageSize: 200 }),
    enabled: !!activeReassignTlId,
  })
  const reassignTests = (reassignTestsData?.items ?? []).filter((r) => {
    if (!reassignSearch) return true
    const needle = reassignSearch.toLowerCase()
    return [r.projectCode, r.productName, r.sampleCode, r.batchNo, r.testType, r.testSubtype, r.remarks]
      .some((v) => (v ?? '').toLowerCase().includes(needle))
  })

  const bulkReassignTeamMut = useMutation({
    mutationFn: (password: string) =>
      ardAtrApi.bulkReassignTeam({ testIds: reassignSelectedIds, tlId: reassignTargetTl!, remarks: reassignRemarks, password }),
    onSuccess: (res) => {
      msg.success(`Reassigned ${res.updatedCount} test${res.updatedCount !== 1 ? 's' : ''}.`)
      setReassignModalOpen(false)
      setReassignEsignOpen(false)
      setReassignTargetTl(undefined)
      setReassignRemarks('')
      setReassignSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-reassign-tests'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to reassign tests.'),
  })

  // ── Form Pending Approval tab (HOD + TL) ──────────────────────────────
  const [approvalSelectedIds, setApprovalSelectedIds] = useState<string[]>([])
  const [eventsModalRows, setEventsModalRows] = useState<AtrForm[] | null>(null)

  const bulkApproveMut = useMutation({
    mutationFn: async () => {
      let ok = 0
      let failed = 0
      for (const id of approvalSelectedIds) {
        try {
          await ardAtrApi.transition(id, { to: 'APPROVED' })
          ok++
        } catch {
          failed++
        }
      }
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      qc.invalidateQueries({ queryKey: ['ard-atrs'] })
      qc.invalidateQueries({ queryKey: ['ard-atrs-counts'] })
      if (ok) msg.success(`Approved ${ok} ATR${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.error(`${failed} ATR${failed !== 1 ? 's' : ''} could not be approved.`)
      setApprovalSelectedIds([])
    },
  })

  const withdrawMut = useMutation({
    mutationFn: (id: string) => ardAtrApi.transition(id, { to: 'WITHDRAWN', remarks: withdrawRemarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-atrs'] })
      msg.success('ATR withdrawn.')
      setWithdrawId(null)
      setWithdrawRemarks('')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to withdraw ATR.'),
  })

  const canCreateAtr = ['ANALYST', 'CHEM', 'TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role_code ?? '') && user?.department_code !== 'QA'
  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER'].includes(user?.role_code ?? '')
  const defaultScope = user?.role_code === 'TL' || user?.role_code === 'TEAM_LEAD' ? 'team' : isUnscopedAdmin ? 'all' : 'mine'
  const statusParam = params.get('status') ?? undefined
  const scope = params.get('scope') ?? defaultScope
  const q = params.get('q') ?? ''

  const scopeOptions = isUnscopedAdmin
    ? [{ value: 'mine', label: 'Mine' }, { value: 'team', label: 'Team' }, { value: 'all', label: 'All' }]
    : user?.role_code === 'TL' || user?.role_code === 'TEAM_LEAD'
    ? [{ value: 'team', label: 'My Team' }, { value: 'mine', label: 'My ATRs' }]
    : [{ value: 'mine', label: 'My ATRs' }]

  const isMyRaisedTab = activeTab === 'my_raised'
  const isFormApprovalTab = activeTab === 'form_pending_approval'
  // "My Raised ATRs" is a hard override, not one more status filter — it
  // replaces whatever the Scope dropdown says with 'self' (raised by me,
  // and only me; unlike 'mine' this doesn't fold in the rest of the team).
  const effectiveScope = isMyRaisedTab ? 'self' : scope
  // "Form Pending Approval" shows a different column set/actions but is the
  // exact same underlying data as the existing "Verification Request" tab
  // (status PENDING_APPROVAL) — reuse that tab alias rather than adding a
  // second backend status filter for the same thing.
  const tabParam = isMyRaisedTab ? undefined : isFormApprovalTab ? 'verification_request' : activeTab !== 'all' ? activeTab : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['ard-atrs', statusParam, effectiveScope, q, page, pageSize, activeTab],
    queryFn: () => ardAtrApi.list({ status: statusParam, tab: tabParam, scope: effectiveScope, q: q || undefined, page, pageSize }),
  })

  // Dedicated total for the tab badge — the /counts endpoint groups by
  // status, not a single figure, so a small pageSize=1 list call is the
  // simplest way to read back just the total for this scope.
  const { data: myRaisedData } = useQuery({
    queryKey: ['ard-atrs-my-raised-count', q],
    queryFn: () => ardAtrApi.list({ scope: 'self', q: q || undefined, page: 1, pageSize: 1 }),
    staleTime: 30_000,
  })
  const countMyRaised = myRaisedData?.total ?? 0

  // Lightweight counts endpoint — avoids fetching 200 full ATR objects just for badges
  const { data: countsData } = useQuery({
    queryKey: ['ard-atrs-counts', scope, q],
    queryFn: () => ardAtrApi.getCounts(),
    staleTime: 30_000,
  })
  const sc: Record<string, number> = countsData?.counts ?? {}

  const items = data?.items ?? []
  const filteredItems = items   // already server-side filtered by tab

  const countPreApprove = sc['QA_PRE_APPROVAL'] ?? 0
  const countInLab = (sc['IN_PROGRESS'] ?? 0) + (sc['PENDING_APPROVAL'] ?? 0)
  const countCertReq = sc['CERTIFICATION_REQUESTED'] ?? 0
  const countCertified = sc['CERTIFIED'] ?? 0
  const countQueued = countsData?.unassigned ?? 0
  const countMethodDev = countsData?.methodDev ?? 0
  const countUnassigned = countsData?.unassigned ?? 0
  const countVerReq = sc['PENDING_APPROVAL'] ?? 0
  const countEnhancement = sc['ENHANCEMENT_REQUESTED'] ?? 0
  const countCertRework = sc['CERTIFICATION_REWORK'] ?? 0
  const countPendingClar = sc['PENDING_CLARIFICATION'] ?? 0

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
    setPage(1)
  }

  const exportCsv = () => {
    const csvRows = [
      ['Form No', 'Product Name', 'Project Code', 'Form Type', 'Status', 'Raised By', 'Raised On', 'Current Owner', 'Age Days'],
      ...filteredItems.map(r => [
        r.formNo,
        `"${r.productName || ''}"`,
        r.projectCode || '',
        r.formTypeName || '',
        r.status,
        r.raisedBy || r.createdBy || '',
        r.raisedOn ? dayjs(r.raisedOn).format('YYYY-MM-DD HH:mm') : '',
        r.currentOwnerName || r.assignedTl || '',
        r.dateDiffForAge ?? '',
      ])
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `ard_atr_list_${dayjs().format('YYYYMMDD')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Per-column search — a small filter icon in each header that expands
  // into an inline search box, matching the same pattern already used on
  // the Test Execution Queue (ArdTestsPage) for consistency.
  const getColumnSearchProps = (getValue: (row: (typeof items)[number]) => string | null | undefined, title: string) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div
        style={{ padding: 8, background: '#fafafa', borderRadius: 8, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0' }}
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
    onFilter: (value: any, row: (typeof items)[number]) =>
      (getValue(row) ?? '').toString().toLowerCase().includes(String(value).toLowerCase()),
  })

  const tabItems = [
    { key: 'all', label: `All ATRs (${data?.total ?? items.length})` },
    { key: 'my_raised', label: `My Raised ATRs (${countMyRaised})` },
    { key: 'qa_pre_approval', label: `QA Pre-Approval (${countPreApprove})` },
    { key: 'in_lab', label: `Active In Lab (${countInLab})` },
    { key: 'pending_certification', label: `Pending Cert. (${countCertReq})` },
    { key: 'certified', label: `Certified (${countCertified})` },
    ...(isTl || isUnscopedAdmin ? [
      { key: 'queued', label: `Queued ATR (${countQueued})` },
      { key: 'unassigned', label: `Un-assigned (${countUnassigned})` },
      { key: 'verification_request', label: `Verification Request (${countVerReq})` },
      { key: 'enhancement', label: `Enhancement (${countEnhancement})` },
    ] : []),
    ...(isQa || isUnscopedAdmin ? [
      { key: 'cert_rework', label: `Cert. Rework (${countCertRework})` },
      { key: 'pending_clarification', label: `Pending Clarification (${countPendingClar})` },
    ] : []),
    { key: 'method_dev', label: `Method Development (${countMethodDev})` },
    ...(isHodUser ? [{ key: 're_assign', label: 'Re-assign Test' }] : []),
    ...(isHodOrTl ? [{ key: 'form_pending_approval', label: `Form Pending Approval (${countVerReq})` }] : []),
  ]

  const isReassignTab = activeTab === 're_assign'
  const isCustomTab = isReassignTab || isFormApprovalTab

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      {ctx}
      {/* Withdraw from List Modal */}
      <Modal
        {...glassModalProps}
        title="Withdraw ATR"
        open={!!withdrawId}
        onCancel={() => { setWithdrawId(null); setWithdrawRemarks('') }}
        onOk={() => withdrawId && withdrawMut.mutate(withdrawId)}
        confirmLoading={withdrawMut.isPending}
        okText="Confirm Withdraw"
        okButtonProps={{ danger: true }}
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">A mandatory business justification is required to withdraw an ATR.</p>
          <Input.TextArea
            rows={3}
            value={withdrawRemarks}
            onChange={(e) => setWithdrawRemarks(e.target.value)}
            placeholder="Reason for withdrawal..."
          />
        </div>
      </Modal>
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Analytical Test Requests (ATR)</h1>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => { setActiveTab(key); setPage(1) }}
            items={tabItems}
            className="w-full sm:w-auto"
          />
          {!isCustomTab && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Input
              prefix={<Search size={16} className="text-slate-400" />}
              placeholder="Search ATR / product / project..."
              defaultValue={q}
              allowClear
              onChange={(e) => setParam('q', e.target.value || undefined)}
              style={{ width: 220 }}
            />
            <Select
              allowClear
              placeholder="Filter Status"
              style={{ width: 150 }}
              value={statusParam}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              onChange={(v) => setParam('status', v)}
            />
            {!isMyRaisedTab && (
              <Select
                style={{ width: 110 }}
                value={scopeOptions.some(o => o.value === scope) ? scope : scopeOptions[0]?.value}
                options={scopeOptions}
                onChange={(v) => setParam('scope', v)}
              />
            )}
            <Button icon={<Download size={14} />} onClick={exportCsv} className="text-slate-600">
              Export CSV
            </Button>
            {canCreateAtr && (
              <Button
                type="primary"
                icon={<Plus size={15} />}
                onClick={() => navigate('/ard/atrs/new')}
                className="bg-indigo-600 hover:bg-indigo-700 font-medium border-none shadow-xs"
              >
                New ATR Request
              </Button>
            )}
          </div>
          )}
        </div>

        {isReassignTab ? (
          <ReassignTestPanel
            myTeamTlOptions={myTeamTlOptions}
            allTlOptions={allTlOptions}
            reassignTeamTlId={reassignTeamTlId}
            setReassignTeamTlId={setReassignTeamTlId}
            onGo={() => { setActiveReassignTlId(reassignTeamTlId); setReassignSelectedIds([]) }}
            reassignSearch={reassignSearch}
            setReassignSearch={setReassignSearch}
            tests={reassignTests}
            loading={reassignTestsLoading}
            activeReassignTlId={activeReassignTlId}
            selectedIds={reassignSelectedIds}
            setSelectedIds={setReassignSelectedIds}
            onReassignClick={() => setReassignModalOpen(true)}
          />
        ) : isFormApprovalTab ? (
          <FormPendingApprovalPanel
            items={filteredItems}
            loading={isLoading}
            healthTagColor={healthTagColor}
            selectedIds={approvalSelectedIds}
            setSelectedIds={setApprovalSelectedIds}
            onApprove={() => bulkApproveMut.mutate()}
            approving={bulkApproveMut.isPending}
            onEventsClick={() => setEventsModalRows(filteredItems.filter((r) => approvalSelectedIds.includes(r.id)))}
          />
        ) : (
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filteredItems}
          size="small"
          onRow={(row) => ({ onClick: () => navigate(`/ard/atrs/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
          pagination={{ current: page, pageSize, total: data?.total ?? 0, onChange: (p, ps) => { setPage(p); setPageSize(ps) }, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t) => `${t} ATRs` }}
          columns={[
            { title: 'Form No', dataIndex: 'formNo', render: (v) => <span className="font-mono font-bold text-indigo-900">{v}</span>, ...getColumnSearchProps((r) => r.formNo, 'Form No') },
            { title: 'Product Name', dataIndex: 'productName', render: (v) => <span className="font-medium text-slate-800">{v || '—'}</span>, ...getColumnSearchProps((r) => r.productName, 'Product Name') },
            { title: 'Project Code', dataIndex: 'projectCode', render: (v) => <Tag color="blue" className="text-xs font-semibold">{v}</Tag>, ...getColumnSearchProps((r) => r.projectCode, 'Project Code') },
            { title: 'Source', dataIndex: 'originModule', render: (v) => <Tag color={v === 'ADC' ? 'blue' : v === 'CGT' ? 'purple' : 'default'} className="text-xs">{v || 'ARD'}</Tag> },
            { title: 'Form Type', dataIndex: 'formTypeName', render: (v) => <span className="text-xs text-slate-600">{v}</span>, ...getColumnSearchProps((r) => r.formTypeName, 'Form Type') },
            {
              title: 'Raised By & On', dataIndex: 'raisedBy',
              render: (v, r) => (
                <div className="text-xs">
                  <p className="font-medium text-slate-700">{v || r.createdBy || '—'}</p>
                  <p className="text-[11px] text-slate-400">{r.raisedOn ? dayjs(r.raisedOn).format('DD MMM YYYY') : '—'}</p>
                </div>
              ),
              ...getColumnSearchProps((r) => r.raisedBy || r.createdBy, 'Raised By'),
            },
            {
              title: 'Current Owner / TL', dataIndex: 'currentOwnerName',
              render: (v, r) => (
                <span className="text-xs font-medium text-slate-700">{v || r.assignedTl || 'ARD Queue'}</span>
              ),
              ...getColumnSearchProps((r) => r.currentOwnerName || r.assignedTl, 'Current Owner / TL'),
            },
            {
              title: <span className="whitespace-nowrap">Age (Days)</span>, dataIndex: 'dateDiffForAge', render: (v) => (
                v !== undefined && v !== null ? (
                  <Tag icon={<Clock size={11} />} color={healthTagColor(v)} className="text-xs">
                    {v} d
                  </Tag>
                ) : '—'
              )
            },
            {
              title: 'Status', dataIndex: 'status',
              render: (v: AtrStatus) => <Tag color={statusColor(v)} className="text-xs font-semibold px-2 py-0.5 rounded-md">{v.replace(/_/g, ' ')}</Tag>,
              filters: STATUS_OPTIONS.map((s) => ({ text: s.replace(/_/g, ' '), value: s })),
              onFilter: (value, row) => row.status === value,
            },
            {
              title: 'Action', width: 130, render: (_, r) => (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="small" type="link" className="p-0 font-semibold" onClick={() => navigate(`/ard/atrs/${r.id}`)}>
                    View →
                  </Button>
                  {['DRAFT', 'SAVED', 'NEW', 'PARTIAL'].includes(r.status) && (
                    <Button size="small" danger type="text" className="text-xs"
                      onClick={() => { setWithdrawId(r.id); setWithdrawRemarks('') }}>
                      Withdraw
                    </Button>
                  )}
                </div>
              )
            },
          ]}
        />
        )}
      </Card>

      {/* Re-assign Test modal — pick the destination team + mandatory remarks,
          then a required e-signature step (password) before the mutation fires */}
      <Modal
        {...glassModalProps}
        title="Re-assign Test"
        open={reassignModalOpen}
        onCancel={() => setReassignModalOpen(false)}
        onOk={() => setReassignEsignOpen(true)}
        okText="Continue"
        okButtonProps={{ disabled: !reassignTargetTl || !reassignRemarks.trim() }}
      >
        <div className="py-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select TL <span className="text-red-500">*</span></label>
            <Select
              className="w-full"
              placeholder="Select Team Lead"
              value={reassignTargetTl}
              options={allTlOptions}
              onChange={setReassignTargetTl}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks <span className="text-red-500">*</span></label>
            <Input.TextArea
              rows={4}
              value={reassignRemarks}
              onChange={(e) => setReassignRemarks(e.target.value)}
              placeholder="Reason for reassignment..."
            />
          </div>
        </div>
      </Modal>

      <ESignatureModal
        open={reassignEsignOpen}
        title="Re-assign Test (E-Signature)"
        description="Re-authenticate with your password to confirm this team reassignment."
        userName={user?.username || 'Current User'}
        requireReason={false}
        loading={bulkReassignTeamMut.isPending}
        onCancel={() => setReassignEsignOpen(false)}
        onConfirm={async (payload) => {
          await bulkReassignTeamMut.mutateAsync(payload.password)
        }}
      />

      {/* Events — workflow history for the selected ATR(s) on Form Pending Approval */}
      <Modal
        {...glassModalProps}
        title="Events"
        open={!!eventsModalRows}
        onCancel={() => setEventsModalRows(null)}
        footer={null}
      >
        <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
          {(eventsModalRows ?? []).map((r) => (
            <div key={r.id}>
              <p className="text-sm font-semibold text-slate-800 mb-2">{r.formNo}</p>
              {(!r.workflowHistory || (r.workflowHistory as unknown[]).length === 0) ? (
                <p className="text-xs text-slate-400 italic">No events recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {(r.workflowHistory as { from?: string; to?: string; byName?: string; at?: string }[]).map((ev, i) => (
                    <div key={i} className="text-xs border-l-2 border-indigo-200 pl-2">
                      <span className="font-medium text-slate-700">{ev.from ?? '—'} → {ev.to ?? '—'}</span>
                      <span className="text-slate-500"> by {ev.byName ?? '—'}</span>
                      {ev.at && <span className="text-slate-400"> · {dayjs(ev.at).format('DD MMM YYYY (HH:mm)')}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function ReassignTestPanel({
  myTeamTlOptions, allTlOptions, reassignTeamTlId, setReassignTeamTlId, onGo,
  reassignSearch, setReassignSearch, tests, loading, activeReassignTlId,
  selectedIds, setSelectedIds, onReassignClick,
}: {
  myTeamTlOptions: { value: string; label: string }[]
  allTlOptions: { value: string; label: string }[]
  reassignTeamTlId: string | undefined
  setReassignTeamTlId: (v: string | undefined) => void
  onGo: () => void
  reassignSearch: string
  setReassignSearch: (v: string) => void
  tests: ArdTestRow[]
  loading: boolean
  activeReassignTlId: string | undefined
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  onReassignClick: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Choose Team (Team Lead) <span className="text-red-500">*</span></label>
          <Select
            style={{ width: 320 }}
            placeholder="Select your team"
            value={reassignTeamTlId}
            options={myTeamTlOptions}
            onChange={setReassignTeamTlId}
            showSearch
            optionFilterProp="label"
            notFoundContent={myTeamTlOptions.length === 0 ? "You don't lead any team." : undefined}
          />
        </div>
        <Button type="primary" onClick={onGo} disabled={!reassignTeamTlId} className="bg-emerald-600 hover:bg-emerald-700 border-none">
          Go
        </Button>
      </div>

      {activeReassignTlId && (
        <>
          <Input
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Search..."
            value={reassignSearch}
            onChange={(e) => setReassignSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 320 }}
          />

          <Table
            rowKey="id"
            loading={loading}
            dataSource={tests}
            size="small"
            rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
            pagination={{ pageSize: 10, showTotal: (t) => `${t} tests` }}
            columns={[
              { title: 'Project Code', dataIndex: 'projectCode', render: (v) => v || '—' },
              { title: 'Product Name', dataIndex: 'productName', render: (v) => v || '—' },
              { title: 'Sample Code', dataIndex: 'sampleCode', render: (v) => v || '—' },
              { title: 'Batch No.', dataIndex: 'batchNo', render: (v) => v || '—' },
              {
                title: 'Test/SubType', render: (_, r) => (
                  <span>{r.testType}{r.testSubtype ? ` / ${r.testSubtype}` : ''}</span>
                ),
              },
              { title: 'Status', dataIndex: 'status', render: (v: string) => <Tag className="text-xs font-semibold">{v.replace(/_/g, ' ')}</Tag> },
              {
                title: 'Submitted By(On)', render: (_, r) => (
                  <div className="text-xs">
                    <p className="font-medium text-slate-700">{r.requestedBy || '—'}</p>
                    <p className="text-[11px] text-slate-400">{r.requestedOn ? dayjs(r.requestedOn).format('DD MMM YYYY (HH:mm)') : '—'}</p>
                  </div>
                ),
              },
              { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '—' },
            ]}
          />

          <Button
            type="primary"
            disabled={selectedIds.length === 0}
            onClick={onReassignClick}
            icon={<Repeat size={14} />}
            className="bg-indigo-600 hover:bg-indigo-700 border-none"
          >
            Re-assign
          </Button>
        </>
      )}
    </div>
  )
}

function sampleField(r: AtrForm, key: 'sampleCode' | 'sampleType'): string {
  const vals = (r.samples ?? []).map((s) => s[key]).filter((v): v is string => !!v)
  return vals.length ? Array.from(new Set(vals)).join(', ') : '—'
}

function FormPendingApprovalPanel({
  items, loading, healthTagColor, selectedIds, setSelectedIds, onApprove, approving, onEventsClick,
}: {
  items: AtrForm[]
  loading: boolean
  healthTagColor: (days: number) => string
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  onApprove: () => void
  approving: boolean
  onEventsClick: () => void
}) {
  return (
    <div className="space-y-3">
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} ATRs` }}
        columns={[
          { title: 'Sample Code', render: (_, r) => sampleField(r, 'sampleCode') },
          { title: 'Form Type', dataIndex: 'formTypeName', render: (v) => v || '—' },
          { title: 'FormNo.', dataIndex: 'formNo', render: (v) => <span className="font-mono font-semibold text-indigo-900">{v}</span> },
          { title: 'Requested By', render: (_, r) => r.raisedBy || r.createdBy || '—' },
          { title: 'Sample Type', render: (_, r) => sampleField(r, 'sampleType') },
          { title: 'Raised On', render: (_, r) => (r.raisedOn ? dayjs(r.raisedOn).format('DD MMM YYYY') : '—') },
          {
            title: 'Age (Days)', dataIndex: 'dateDiffForAge', render: (v) => (
              v !== undefined && v !== null ? (
                <Tag icon={<Clock size={11} />} color={healthTagColor(v)} className="text-xs">{v} d</Tag>
              ) : '—'
            ),
          },
        ]}
      />
      <div className="flex gap-2">
        <Button type="primary" disabled={selectedIds.length === 0} loading={approving} onClick={onApprove}
          className="bg-emerald-600 hover:bg-emerald-700 border-none">
          Approve
        </Button>
        <Button disabled={selectedIds.length === 0} onClick={onEventsClick}>
          Events
        </Button>
      </div>
    </div>
  )
}
