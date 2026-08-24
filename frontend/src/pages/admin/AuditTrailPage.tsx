import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Select, Table, Tag, DatePicker, Tooltip } from 'antd'
import { Search } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { adminAuditTrailApi, type AdminAuditTrailEntry } from '../../api/admin'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'

const { RangePicker } = DatePicker

const EVENT_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  GRANT: 'cyan',
  REVOKE: 'volcano',
  RESET: 'purple',
}

function ValueCell({ val }: { val: string | null }) {
  if (!val) return <EmptyValue />
  let parsed: unknown
  try { parsed = JSON.parse(val) } catch { parsed = null }
  if (parsed && typeof parsed === 'object') {
    return (
      <Tooltip title={<pre className="text-xs whitespace-pre-wrap max-w-xs">{JSON.stringify(parsed, null, 2)}</pre>} overlayStyle={{ maxWidth: 360 }}>
        <span className="text-[13px] text-blue-500 cursor-pointer underline decoration-dotted">JSON</span>
      </Tooltip>
    )
  }
  if (val.length > 120) {
    return (
      <Tooltip title={<span className="text-xs">{val}</span>}>
        <span className="text-[13px] truncate max-w-[520px] block cursor-pointer">{val.slice(0, 120)}…</span>
      </Tooltip>
    )
  }
  return <span className="text-[13px]">{val}</span>
}

export default function AuditTrailPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 300)
  const [eventType, setEventType] = useState<string | undefined>()
  const [entityType, setEntityType] = useState<string | undefined>()
  const [performedBy, setPerformedBy] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  const { data: eventTypes = [] } = useQuery({ queryKey: ['admin-audit-event-types'], queryFn: () => adminAuditTrailApi.eventTypes() })
  const { data: entityTypes = [] } = useQuery({ queryKey: ['admin-audit-entity-types'], queryFn: () => adminAuditTrailApi.entityTypes() })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-audit-trail', page, pageSize, search, eventType, entityType, performedBy, dateRange?.[0]?.toISOString(), dateRange?.[1]?.toISOString()],
    queryFn: () => adminAuditTrailApi.list({
      page, page_size: pageSize,
      search: search.trim() || undefined,
      eventType, entityType,
      performedBy: performedBy.trim() || undefined,
      dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'),
      dateTo: dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.items ?? []

  const cols: ColumnsType<AdminAuditTrailEntry> = [
    {
      title: 'Event Type',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 110,
      render: (v: string) => <Tag color={EVENT_COLORS[v] ?? 'default'} bordered className="text-[12px]">{v}</Tag>,
    },
    {
      title: 'Entity Type',
      dataIndex: 'entity_type',
      key: 'entity_type',
      ellipsis: true,
      width: 190,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Entity Ref',
      dataIndex: 'entity_ref',
      key: 'entity_ref',
      ellipsis: true,
      width: 160,
      render: (v: string | null) => withEmptyValue(v && <span className="text-[13px] text-slate-800">{v}</span>),
    },
    {
      title: 'Performed By',
      dataIndex: 'performed_by',
      key: 'performed_by',
      ellipsis: true,
      width: 150,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Performed At',
      dataIndex: 'performed_at',
      key: 'performed_at',
      width: 160,
      render: (v: string) => <span className="text-[13px] text-slate-600">{dayjs(v).format('DD/MM/YYYY HH:mm:ss')}</span>,
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (v: string | null) => <ValueCell val={v} />,
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">Audit Trail</h1>
        <p className="text-slate-400 text-sm">Full history of Administration module actions — users, departments, roles, labs, privileges, settings, and master data.</p>
      </div>

      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search ref / user / entity…"
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
          className="w-52"
          allowClear
        />
        <Select
          placeholder="Event Type"
          value={eventType}
          onChange={(v) => { setEventType(v); setPage(1) }}
          allowClear
          className="w-36"
          options={eventTypes.map((t) => ({ value: t, label: t }))}
        />
        <Select
          placeholder="Entity Type"
          value={entityType}
          onChange={(v) => { setEntityType(v); setPage(1) }}
          allowClear
          className="w-52"
          options={entityTypes.map((t) => ({ value: t, label: t }))}
        />
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Performed by…"
          value={performedBy}
          onChange={(e) => { setPerformedBy(e.target.value); setPage(1) }}
          className="w-40"
          allowClear
        />
        <RangePicker
          value={dateRange}
          onChange={(v) => { setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null); setPage(1) }}
          format="DD/MM/YYYY"
          className="w-64"
        />
        <span className="text-slate-400 text-xs ml-auto">{data?.total ?? 0} records</span>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table
          dataSource={rows}
          columns={cols}
          rowKey="id"
          size="middle"
          loading={isLoading || isFetching}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </div>
    </div>
  )
}
