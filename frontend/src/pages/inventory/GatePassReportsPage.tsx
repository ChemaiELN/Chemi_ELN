import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Button, Input, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { Download, Search } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import {
  gatePassApi,
  type GatePass, type GatePassKpis, type GatePassPendingRow, type GatePassVendorRow,
} from '../../api/inventory'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'

const inr = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const formatDate = (v: string) => {
  const [y, m, d] = v.split('-')
  return y && m && d ? `${d}/${m}/${y}` : v
}
const DOC_COLOR: Record<string, string> = { RETURNABLE: 'blue', NON_RETURNABLE: 'gold' }
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', CREATED: 'blue', APPROVED: 'green', DISPATCHED: 'orange',
  PARTIALLY_RETURNED: 'magenta', CLOSED: 'default', CANCELLED: 'red',
}
const REPORT_OPTIONS = [
  { value: 'register', label: 'Gate Pass Register' },
  { value: 'pending', label: 'Pending Returns' },
  { value: 'vendor', label: 'Vendor-wise Summary' },
]
const DOC_OPTIONS = [
  { value: 'RETURNABLE', label: 'RGP' },
  { value: 'NON_RETURNABLE', label: 'NRGP' },
]

function Kpi({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent: string }) {
  return (
    <div className="glass-card rounded-lg p-4" style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-[12px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function GatePassReportsPage() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<GatePassKpis | null>(null)
  const [report, setReport] = useState('register')
  const [docType, setDocType] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [register, setRegister] = useState<GatePass[]>([])
  const [pending, setPending] = useState<GatePassPendingRow[]>([])
  const [vendor, setVendor] = useState<GatePassVendorRow[]>([])

  useEffect(() => { gatePassApi.reportKpis().then(setKpis).catch(() => {}) }, [])

  // All three reports are paged, searched and sorted by the server. The
  // register in particular used to call the unpaged gatePassApi.list(), which
  // hit the route's default limit of 20 and showed only the newest 20 passes.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search.trim()) params.search = search.trim()
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      if (report === 'register') {
        const { items, total } = await gatePassApi.listPaged({ ...params, ...(docType ? { doc_type: docType } : {}) })
        setRegister(items)
        setTotal(total)
      } else if (report === 'pending') {
        const { items, total } = await gatePassApi.reportPendingPaged(params)
        setPending(items)
        setTotal(total)
      } else {
        const { items, total } = await gatePassApi.reportVendorPaged(params)
        setVendor(items)
        setTotal(total)
      }
    } finally { setLoading(false) }
  }, [report, docType, search, sortBy, sortDir, page, pageSize])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1); setSortBy(null) }, [report])
  useEffect(() => { setPage(1) }, [docType, search])

  const pagination = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: [10, 15, 20, 50, 100],
    showTotal: (t: number) => `${t} records`,
  }
  const onTableChange = (p: TablePaginationConfig, _f: unknown, sorter: any) => {
    if (p.current) setPage(p.current)
    if (p.pageSize) setPageSize(p.pageSize)
    if (sorter?.order) {
      setSortBy(sorter.field as string)
      setSortDir(sorter.order === 'ascend' ? 'asc' : 'desc')
    } else {
      setSortBy(null)
    }
  }

  const exportExcel = async () => {
    setExporting(true)
    try { await gatePassApi.exportReport({ report, ...(report === 'register' && docType ? { doc_type: docType } : {}) }) }
    catch (e: unknown) { message.error((e as Error).message || 'Export failed') }
    finally { setExporting(false) }
  }

  // Sorting is server-side (sort_by/sort_dir): a client comparator would only
  // reorder the current page.

  const registerCols: ColumnsType<GatePass> = [
    { title: 'GP No.', dataIndex: 'gp_number', ellipsis: true, width: 150, sorter: true, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/gate-passes/${r.id}`)}>{v}</a> },
    { title: 'Type', dataIndex: 'doc_type', width: 150, sorter: true, render: v => <StatusTag color={DOC_COLOR[v] ?? 'default'}>{v === 'RETURNABLE' ? 'RGP' : 'NRGP'}</StatusTag> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Date', dataIndex: 'gp_date', width: 150, sorter: true, render: v => <span className="text-[13px] text-slate-800">{formatDate(v)}</span> },
    { title: 'Items', dataIndex: 'item_count', width: 150, align: 'center', sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Value (₹)', dataIndex: 'total_value', width: 150, align: 'right', sorter: true, render: v => <span className="text-[13px] text-slate-800">{inr(v)}</span> },
    { title: 'Status', dataIndex: 'status', width: 150, sorter: true, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{String(v).replace(/_/g, ' ')}</StatusTag> },
  ]

  const pendingCols: ColumnsType<GatePassPendingRow> = [
    { title: 'GP No.', dataIndex: 'gp_number', width: 150, sorter: true, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/gate-passes/${r.id}`)}>{v}</a> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Date', dataIndex: 'gp_date', width: 150, sorter: true, render: v => <span className="text-[13px] text-slate-800">{formatDate(v)}</span> },
    { title: 'Days Open', dataIndex: 'days_open', width: 150, align: 'center', sorter: true, render: v => <span className="text-[13px] font-semibold" style={{ color: v > 7 ? '#dc2626' : '#d97706' }}>{v} days {v > 7 ? '⚠' : ''}</span> },
    { title: 'Pending Items', dataIndex: 'pending_items', width: 150, align: 'center', sorter: true, render: v => <span className="text-[13px] text-slate-800">{v} item(s)</span> },
    { title: 'Pending Value (₹)', dataIndex: 'pending_value', width: 150, align: 'right', sorter: true, render: v => <span className="text-[13px] text-slate-800">{inr(v)}</span> },
  ]

  const vendorCols: ColumnsType<GatePassVendorRow> = [
    { title: 'Vendor Code', dataIndex: 'vendor_code', width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Vendor Name', dataIndex: 'vendor_name', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Total Gate Passes', dataIndex: 'gp_count', width: 150, align: 'center', sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Total Value (₹)', dataIndex: 'total_value', width: 150, align: 'right', sorter: true, render: v => <span className="text-[13px] font-semibold text-slate-800">{inr(v)}</span> },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Total Gate Passes" value={withEmptyValue(kpis?.total)} sub="All time" accent="#10b981" />
        <Kpi label="RGP – Returnable" value={withEmptyValue(kpis?.rgp_count)} sub={`${kpis?.pending_returns ?? 0} pending return`} accent="#f59e0b" />
        <Kpi label="NRGP – Non-Returnable" value={withEmptyValue(kpis?.nrgp_count)} sub="Permanent outward" accent="#3b82f6" />
        <Kpi label="Open Value (₹)" value={inr(kpis?.open_value ?? 0)} sub="Material still out" accent="#ef4444" />
      </div>

      {/* Report controls */}
      <div className="glass-card rounded-lg px-4 py-3 flex flex-wrap gap-2 items-center">
        <Select style={{ minWidth: 220 }} value={report} onChange={setReport} options={REPORT_OPTIONS} />
        {report === 'register' && (
          <Select placeholder="All Types" allowClear style={{ minWidth: 150 }} value={docType} onChange={setDocType} options={DOC_OPTIONS} />
        )}
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder={report === 'vendor' ? 'Search vendor…' : 'Search GP no. / vendor…'}
          style={{ width: 220 }}
          allowClear
        />
        <Button icon={<Download size={14} />} loading={exporting} onClick={exportExcel}>Export</Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-[14px] font-semibold text-slate-700">
          {REPORT_OPTIONS.find(o => o.value === report)?.label}
        </div>
        {report === 'register' && <Table dataSource={register} columns={registerCols} rowKey="id" size="middle" tableLayout="fixed" loading={loading} scroll={{ x: 'max-content' }} pagination={pagination} onChange={onTableChange} />}
        {report === 'pending' && <Table dataSource={pending} columns={pendingCols} rowKey="id" size="middle" tableLayout="fixed" loading={loading} scroll={{ x: 'max-content' }} pagination={pagination} onChange={onTableChange} locale={{ emptyText: 'No pending returns' }} />}
        {report === 'vendor' && <Table dataSource={vendor} columns={vendorCols} rowKey={r => r.vendor_code ?? r.vendor_name ?? '—'} size="middle" tableLayout="fixed" loading={loading} scroll={{ x: 'max-content' }} pagination={pagination} onChange={onTableChange} />}
      </div>
    </div>
  )
}
