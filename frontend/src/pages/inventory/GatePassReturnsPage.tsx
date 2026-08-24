import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Alert } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { RotateCcw } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { gatePassApi, type GatePass } from '../../api/inventory'
import { EmptyValue } from '../../components/ui/EmptyValue'

const STATUS_COLOR: Record<string, string> = { DISPATCHED: 'orange', PARTIALLY_RETURNED: 'magenta' }

export default function GatePassReturnsPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<GatePass[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await gatePassApi.pendingReturnsPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [page, pageSize, sortBy, sortDir])
  useEffect(() => { load() }, [load])

  const columns: ColumnsType<GatePass> = [
    { title: 'GP Number', dataIndex: 'gp_number', width: 150, sorter: true, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/gate-passes/${r.id}`)}>{v}</a> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <EmptyValue /> },
    { title: 'Date', dataIndex: 'gp_date', width: 150, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Status', dataIndex: 'status', width: 150, sorter: true, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{String(v).replace(/_/g, ' ')}</StatusTag> },
    { title: 'Pending Items', dataIndex: 'pending_items', width: 150, align: 'center', render: v => <span className="text-[13px] text-slate-800">{v} item(s)</span> },
    { title: 'Action', width: 180, align: 'center', render: (_v, r) => <Button size="small" type="primary" icon={<RotateCcw size={13} />} onClick={() => navigate(`/inventory/gate-passes/${r.id}/return`)}>Process Return</Button> },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Alert
        type="warning" showIcon
        message={`${total} returnable gate pass(es) pending material return.`}
      />
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-[14px] font-semibold text-slate-700">Pending Returns</span>
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
            showTotal: t => `${t} pending returns`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<GatePass>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No pending returns' }}
        />
      </div>
    </div>
  )
}
