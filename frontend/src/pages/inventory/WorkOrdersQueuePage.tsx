import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Search } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { workOrderApi, type WorkOrder } from '../../api/inventory'

const STATUS_COLOR: Record<string, string> = {
  RAISED: 'gold', IN_PROGRESS: 'blue', PENDING_VERIFICATION: 'orange', PENDING_APPROVAL: 'purple', APPROVED: 'green',
}
const KIND_OPTIONS = [{ value: 'PLANNED', label: 'Planned' }, { value: 'UNPLANNED', label: 'Unplanned' }, { value: 'BREAKDOWN', label: 'Breakdown' }]

export default function WorkOrdersQueuePage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (kind) params.kind = kind
      if (search) params.search = search
      setRows(await workOrderApi.list(params))
    } finally { setLoading(false) }
  }, [kind, search])
  useEffect(() => { load() }, [load])

  const columns: ColumnsType<WorkOrder> = [
    { title: 'Workorder No', ellipsis: true, dataIndex: 'workorder_no', width: 140, render: (v, r) => <a className=" text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/work-orders/${r.id}`)}>{v}</a> },
    { title: 'Code', ellipsis: true, dataIndex: 'equipment_code', width: 130, render: v => <span className="font-mono text-[13px] text-slate-600">{v}</span> },
    { title: 'Kind', ellipsis: true, dataIndex: 'kind', width: 110, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Log Type', ellipsis: true, dataIndex: 'log_type', width: 120, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Raised By', ellipsis: true, dataIndex: 'raised_by', width: 130 },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 170, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{String(v).replace(/_/g, ' ')}</StatusTag> },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workorder no…" style={{ width: 220 }} allowClear />
        <Select placeholder="All Kinds" allowClear style={{ minWidth: 160 }} value={kind} onChange={setKind} options={KIND_OPTIONS} />
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20 }} />
      </div>
    </div>
  )
}
