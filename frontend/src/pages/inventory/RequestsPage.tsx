import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Modal, message, Tabs, Input, Select } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Search } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { workOrderApi, type RequestItem } from '../../api/inventory'
import { glassModalStyles } from '../../utils/modalStyles'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

type Kind = 'EQUIPMENT' | 'INSTRUMENT'

const TARGET_KIND_OPTIONS = [
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'INSTRUMENT', label: 'Instrument' },
]

// Scheduled maintenance/calibration requests (Plan + Raise against a Schedule
// row) live in the Planner page now — that data is just InvSchedule rows, so
// having a separate "Planned" tab here duplicated the Planner's own table.
// Only Unplanned/Breakdown remain here: they raise a work order directly
// against an equipment item with no schedule at all, which the Planner has
// no equivalent for.
function DirectPickTab({ targetKind, kind, search }: { targetKind: Kind; kind: 'UNPLANNED' | 'BREAKDOWN'; search: string }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [rows, setRows] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { kind, target_kind: targetKind, skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await workOrderApi.requestsPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [kind, targetKind, search, page, pageSize, sortBy, sortDir])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [kind, targetKind, search])

  const raise = (r: RequestItem) => Modal.confirm({
    title: `${kind === 'BREAKDOWN' ? 'Breakdown' : 'Maintenance'} Request Confirmation`,
    content: 'Are you sure you want to send maintenance request?',
    okText: 'Yes', cancelText: 'No', centered: true, styles: glassModalStyles,
    onOk: async () => {
      try {
        const body = isEquipment ? { equipment_id: r.id } : { instrument_id: r.id }
        const wo = await workOrderApi.raise({ ...body, kind, log_type: isEquipment ? 'MAINTENANCE' : 'CALIBRATION' })
        message.success(`Raised ${wo.workorder_no}`)
        navigate(`/inventory/work-orders/${wo.id}`)
      } catch (e: unknown) { message.error((e as Error).message) }
    },
  })

  const columns: ColumnsType<RequestItem> = [
    {
      title: isEquipment ? 'Equipment Code' : 'Instrument Code',
      dataIndex: 'asset_id',
      ellipsis: true,
      width: 180,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: true,
      width: 180,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      ellipsis: true,
      width: 180,
      sorter: true,
      render: (v: string | null) => v
        ? <StatusTag color="default">{String(v).replace(/_/g, ' ')}</StatusTag>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Actions', key: 'a', width: 120, align: 'center', render: (_, r) => (
        <Button size="small" type="primary" disabled={r.has_open_request} onClick={() => raise(r)}>
          {r.has_open_request ? 'Pending' : 'Raise'}
        </Button>
      ),
    },
  ]

  return (
    <div className="pt-3">
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
            showTotal: t => `${t} requests`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<RequestItem>
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

// Unplanned/Breakdown maintenance can be raised against either an equipment
// item or an instrument — both catalogues support the same direct-pick flow,
// so a target-kind toggle switches which one the tabs below list.
export default function RequestsPage() {
  const [targetKind, setTargetKind] = useState<Kind>('EQUIPMENT')
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search code or name…"
          style={{ width: 220 }}
          allowClear
        />
        <Select value={targetKind} onChange={setTargetKind} style={{ minWidth: 160 }} options={TARGET_KIND_OPTIONS} />
      </div>
      <Tabs
        items={[
          { key: 'unplanned', label: 'Unplanned', children: <DirectPickTab targetKind={targetKind} kind="UNPLANNED" search={search} /> },
          { key: 'breakdown', label: 'Breakdown', children: <DirectPickTab targetKind={targetKind} kind="BREAKDOWN" search={search} /> },
        ]}
      />
    </div>
  )
}
