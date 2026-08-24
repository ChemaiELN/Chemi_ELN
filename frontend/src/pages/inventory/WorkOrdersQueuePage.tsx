import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Input } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Search } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { workOrderApi, type WorkOrder } from '../../api/inventory'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const STATUS_COLOR: Record<string, string> = {
  RAISED: 'gold', IN_PROGRESS: 'blue', PENDING_VERIFICATION: 'orange', PENDING_APPROVAL: 'purple', APPROVED: 'green',
}
const KIND_OPTIONS = [{ value: 'PLANNED', label: 'Planned' }, { value: 'UNPLANNED', label: 'Unplanned' }, { value: 'BREAKDOWN', label: 'Breakdown' }]

export default function WorkOrdersQueuePage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<string | undefined>()
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (kind) params.kind = kind
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await workOrderApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [kind, search, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [kind, search])

  const columns: ColumnsType<WorkOrder> = [
    {
      title: 'Workorder No',
      dataIndex: 'workorder_no',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/work-orders/${r.id}`)}>{v}</a>,
    },
    {
      title: 'Code',
      dataIndex: 'equipment_code',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Kind',
      dataIndex: 'kind',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Log Type',
      dataIndex: 'log_type',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Raised By',
      dataIndex: 'raised_by',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{String(v).replace(/_/g, ' ')}</StatusTag>,
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search workorder no…" style={{ width: 220 }} allowClear />
        <Select placeholder="All Kinds" allowClear style={{ minWidth: 160 }} value={kind} onChange={setKind} options={KIND_OPTIONS} />
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} work orders`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<WorkOrder>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>
    </div>
  )
}
