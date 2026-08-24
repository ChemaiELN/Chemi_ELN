import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Input, Select, Button, Tabs, Card, Modal, message, Popconfirm } from 'antd'
import { Plus, FileText, Clock, ShieldCheck, Award, Download, CheckCircle2, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { ardAtrApi, type AtrStatus } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

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

  const canCreateAtr = ['ANALYST', 'CHEM', 'TL', 'TEAM_LEAD', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role_code ?? '') && user?.department_code !== 'QA'
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

  const tabParam = activeTab !== 'all' ? activeTab : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['ard-atrs', statusParam, scope, q, page, pageSize, activeTab],
    queryFn: () => ardAtrApi.list({ status: statusParam, tab: tabParam, scope, q: q || undefined, page, pageSize }),
  })

  // Lightweight counts endpoint — avoids fetching 200 full ATR objects just for badges
  const { data: countsData } = useQuery({
    queryKey: ['ard-atrs-counts', scope, q],
    queryFn: () => ardAtrApi.getCounts(),
    staleTime: 30_000,
  })
  const sc: Record<string, number> = countsData ?? {}

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

  const tabItems = [
    { key: 'all', label: `All ATRs (${data?.total ?? items.length})` },
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
  ]

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
            <Select
              style={{ width: 110 }}
              value={scopeOptions.some(o => o.value === scope) ? scope : scopeOptions[0]?.value}
              options={scopeOptions}
              onChange={(v) => setParam('scope', v)}
            />
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
        </div>

        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filteredItems}
          size="small"
          onRow={(row) => ({ onClick: () => navigate(`/ard/atrs/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
          pagination={{ current: page, pageSize, total: data?.total ?? 0, onChange: (p, ps) => { setPage(p); setPageSize(ps) }, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t) => `${t} ATRs` }}
          columns={[
            { title: 'Form No', dataIndex: 'formNo', render: (v) => <span className="font-mono font-bold text-indigo-900">{v}</span> },
            { title: 'Product Name', dataIndex: 'productName', render: (v) => <span className="font-medium text-slate-800">{v || '—'}</span> },
            { title: 'Project Code', dataIndex: 'projectCode', render: (v) => <Tag color="blue" className="text-xs font-semibold">{v}</Tag> },
            { title: 'Source', dataIndex: 'originModule', render: (v) => <Tag color={v === 'ADC' ? 'blue' : v === 'CGT' ? 'purple' : 'default'} className="text-xs">{v || 'ARD'}</Tag> },
            { title: 'Form Type', dataIndex: 'formTypeName', render: (v) => <span className="text-xs text-slate-600">{v}</span> },
            {
              title: 'Raised By & On', dataIndex: 'raisedBy', render: (v, r) => (
                <div className="text-xs">
                  <p className="font-medium text-slate-700">{v || r.createdBy || '—'}</p>
                  <p className="text-[11px] text-slate-400">{r.raisedOn ? dayjs(r.raisedOn).format('DD MMM YYYY') : '—'}</p>
                </div>
              )
            },
            {
              title: 'Current Owner / TL', dataIndex: 'currentOwnerName', render: (v, r) => (
                <span className="text-xs font-medium text-slate-700">{v || r.assignedTl || 'ARD Queue'}</span>
              )
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
            { title: 'Status', dataIndex: 'status', render: (v: AtrStatus) => <Tag color={statusColor(v)} className="text-xs font-semibold px-2 py-0.5 rounded-md">{v.replace(/_/g, ' ')}</Tag> },
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
      </Card>
    </div>
  )
}
