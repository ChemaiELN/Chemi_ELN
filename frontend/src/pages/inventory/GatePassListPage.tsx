import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Input, Button } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Search, FilePlus2 } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { gatePassApi, type GatePass } from '../../api/inventory'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { useColumnSearch } from '../../hooks/useColumnSearch'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', CREATED: 'blue', APPROVED: 'green', DISPATCHED: 'orange',
  PARTIALLY_RETURNED: 'magenta', CLOSED: 'default', CANCELLED: 'red',
}
const DOC_COLOR: Record<string, string> = { RETURNABLE: 'blue', NON_RETURNABLE: 'gold' }

const DOC_OPTIONS = [
  { value: 'RETURNABLE', label: 'RGP (Returnable)' },
  { value: 'NON_RETURNABLE', label: 'NRGP (Non-Returnable)' },
]
const STATUS_OPTIONS = [
  'DRAFT', 'CREATED', 'APPROVED', 'DISPATCHED', 'PARTIALLY_RETURNED', 'CLOSED', 'CANCELLED',
].map(s => ({ value: s, label: s.replace(/_/g, ' ') }))

const inr = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const formatDate = (v: string) => {
  const [y, m, d] = v.split('-')
  return y && m && d ? `${d}/${m}/${y}` : v
}

export default function GatePassListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<GatePass[]>([])
  const [loading, setLoading] = useState(false)
  const [docType, setDocType] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { columnFilters, getColumnSearchProps, handleTableFilters } = useColumnSearch()

  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (docType) params.doc_type = docType
      if (status) params.status = status
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      Object.assign(params, columnFilters)
      const { items, total } = await gatePassApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [docType, status, search, page, pageSize, sortBy, sortDir, columnFilters])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [docType, status, search, columnFilters])

  const columns: ColumnsType<GatePass> = [
    { title: 'GP Number', dataIndex: 'gp_number', ellipsis: true, width: 150, sorter: true, ...getColumnSearchProps('gp_number', 'GP Number'), render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/gate-passes/${r.id}`)}>{v}</a> },
    { title: 'Type', dataIndex: 'doc_type', width: 150, sorter: true, render: v => <StatusTag color={DOC_COLOR[v] ?? 'default'}>{v === 'RETURNABLE' ? 'RGP' : 'NRGP'}</StatusTag> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, width: 150, sorter: true, ...getColumnSearchProps('vendor_name', 'Vendor'), render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Date', dataIndex: 'gp_date', width: 150, sorter: true, render: v => <span className="text-[13px] text-slate-800">{formatDate(v)}</span> },
    { title: 'Items', dataIndex: 'item_count', width: 150, align: 'center', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Value (₹)', dataIndex: 'total_value', width: 150, align: 'right', render: v => <span className="text-[13px] text-slate-800">{inr(v)}</span> },
    { title: 'Status', dataIndex: 'status', width: 150, sorter: true, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{String(v).replace(/_/g, ' ')}</StatusTag> },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search GP number or vendor…" style={{ width: 240 }} allowClear />
        <Select placeholder="All Types" allowClear style={{ minWidth: 200 }} value={docType} onChange={setDocType} options={DOC_OPTIONS} />
        <Select placeholder="All Status" allowClear style={{ minWidth: 170 }} value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <Button type="primary" icon={<FilePlus2 size={15} />} onClick={() => navigate('/inventory/gate-passes/new')}>New Gate Pass</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          tableLayout="fixed"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} gate passes`,
          }}
          onChange={(pagination: TablePaginationConfig, filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<GatePass>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
            handleTableFilters(filters)
          }}
        />
      </div>
    </div>
  )
}
