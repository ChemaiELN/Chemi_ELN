import { useState, useEffect, useCallback } from 'react'
import type { TablePaginationConfig } from 'antd/es/table'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { Button, Input, Select, Table, Tag, DatePicker, Tooltip } from 'antd'
import { Search, RefreshCw } from 'lucide-react'
import { auditTrailApi } from '../../api/inventory'
import type { AuditTrailEntry } from '../../api/inventory'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

const EVENT_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  APPROVE: 'cyan',
  REJECT: 'volcano',
  ISSUE: 'purple',
  ALLOCATE: 'geekblue',
  VERIFY: 'lime',
  COMPLETE: 'teal',
  CANCEL: 'default',
}

function ValueCell({ val }: { val: string | null }) {
  if (!val) return <span className="text-slate-800 text-[13px]">NA</span>
  let parsed: unknown
  try { parsed = JSON.parse(val) } catch { parsed = null }
  if (parsed && typeof parsed === 'object') {
    return (
      <Tooltip title={<pre className="text-xs whitespace-pre-wrap max-w-xs">{JSON.stringify(parsed, null, 2)}</pre>} overlayStyle={{ maxWidth: 360 }}>
        <span className="text-[13px] text-blue-500 cursor-pointer underline decoration-dotted">JSON</span>
      </Tooltip>
    )
  }
  if (val.length > 40) {
    return (
      <Tooltip title={<span className="text-xs">{val}</span>}>
        <span className="text-[13px] truncate max-w-[120px] block cursor-pointer">{val.slice(0, 40)}…</span>
      </Tooltip>
    )
  }
  return <span className="text-[13px]">{val}</span>
}

export default function AuditTrailPage() {
  const [rows, setRows] = useState<AuditTrailEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [eventType, setEventType] = useState<string | undefined>()
  const [entityType, setEntityType] = useState<string | undefined>()
  const [performedBy, setPerformedBy] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [entityTypes, setEntityTypes] = useState<string[]>([])

  useEffect(() => {
    auditTrailApi.eventTypes().then(setEventTypes).catch(() => {})
    auditTrailApi.entityTypes().then(setEntityTypes).catch(() => {})
  }, [])

  // Everything — including the free-text search — is filtered and paged by the
  // server. This page used to fetch the newest 200 rows and search those in the
  // browser, so anything older than the 200th entry was invisible to search.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search.trim()) params.search = search.trim()
      if (eventType) params.event_type = eventType
      if (entityType) params.entity_type = entityType
      if (performedBy.trim()) params.performed_by = performedBy.trim()
      if (dateRange?.[0]) params.date_from = dateRange[0].format('YYYY-MM-DD')
      if (dateRange?.[1]) params.date_to = dateRange[1].format('YYYY-MM-DD')
      const { items, total } = await auditTrailApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, eventType, entityType, performedBy, dateRange, page, pageSize])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, eventType, entityType, performedBy, dateRange])

  const cols: ColumnsType<AuditTrailEntry> = [
    {
      title: 'Event Type',
      ellipsis: true,
      dataIndex: 'event_type',
      key: 'event_type',
      width: 120,
      render: v => <span className="text-[13px]">{(v as string).charAt(0) + (v as string).slice(1).toLowerCase()}</span>,
    },
    {
      title: 'Entity Type',
      ellipsis: true,
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 140,
      render: v => <span className="text-[13px]">{v as string}</span>,
    },
    {
      title: 'Entity Ref',
      ellipsis: true,
      dataIndex: 'entity_ref',
      key: 'entity_ref',
      width: 150,
      render: v => <span className="  text-[13px]">{v as string ?? 'NA'}</span>,
    },
    {
      title: 'Performed By',
      ellipsis: true,
      dataIndex: 'performed_by',
      key: 'performed_by',
      width: 140,
      render: v => <span className="text-[13px]">{v as string}</span>,
    },
    {
      title: 'Performed At',
      ellipsis: true,
      dataIndex: 'performed_at',
      key: 'performed_at',
      width: 160,
      render: v => <span className="text-[13px]">{dayjs(v as string).format('DD/MM/YYYY HH:mm:ss')}</span>,
    },
    {
      title: 'Old Value',
      dataIndex: 'old_value',
      key: 'old_value',
      width: 140,
      render: v => <ValueCell val={v as string | null} />,
    },
    {
      title: 'New Value',
      dataIndex: 'new_value',
      key: 'new_value',
      width: 140,
      render: v => <ValueCell val={v as string | null} />,
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      width: 180,
      render: v => <ValueCell val={v as string | null} />,
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      

      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search ref / user / entity..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-52"
          allowClear
        />
        <Select
          placeholder="Event Type"
          value={eventType}
          onChange={setEventType}
          allowClear
          className="w-36"
          options={eventTypes.map(t => ({ value: t, label: t }))}
        />
        <Select
          placeholder="Entity Type"
          value={entityType}
          onChange={setEntityType}
          allowClear
          className="w-40"
          options={entityTypes.map(t => ({ value: t, label: t }))}
        />
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Performed by..."
          value={performedBy}
          onChange={e => setPerformedBy(e.target.value)}
          className="w-40"
          allowClear
        />
        <RangePicker
          value={dateRange}
          onChange={v => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
          format="DD/MM/YYYY"
          className="w-64"
        />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={load} loading={loading} className="rounded-md font-medium">
          Load
        </Button>
        <span className="text-slate-400 text-xs ml-2">{total} record(s)</span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} records`,
          }}
          onChange={(pagination: TablePaginationConfig) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
          }}
          locale={{ emptyText: 'No audit records match these filters' }}
        />
      </div>
    </div>
  )
}
