import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Table, Input, Select, DatePicker, Button, Tag, Space, Tooltip } from 'antd'
import { Search, Download, RotateCcw, Clock } from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { apiGet } from '../../api/client'

const { RangePicker } = DatePicker

interface AuditRow {
  id: string
  eventType: string
  eventTime: string | null
  eventTimeFormatted: string | null
  user: string
  entityType: string
  eventDetails: string
}

interface AuditResponse {
  items: AuditRow[]
  total: number
  page: number
  pageSize: number
}

const ENTITY_TYPES = [
  { value: 'ALL', label: 'All Entity Types' },
  { value: 'ATR', label: 'ATR Form' },
  { value: 'ATR_TEST', label: 'ATR Test' },
  { value: 'EXPERIMENT', label: 'Experiment' },
  { value: 'QC_TRF', label: 'QC-TRF' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'TEAM', label: 'Team' },
  { value: 'TEMPLATE', label: 'Template' },
  { value: 'MASTER_DATA', label: 'Master Data' },
]

const ENTITY_COLOR: Record<string, string> = {
  ATR: 'blue', ATR_TEST: 'cyan', EXPERIMENT: 'purple', QC_TRF: 'orange',
  PROJECT: 'green', TEAM: 'magenta', TEMPLATE: 'geekblue', MASTER_DATA: 'gold',
}

export default function ArdAuditPage() {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('ALL')
  const [actor, setActor] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [page, setPage] = useState(1)
  const pageSize = 50

  const params = {
    q: q || undefined,
    kind: kind !== 'ALL' ? kind : undefined,
    actor: actor || undefined,
    date_from: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
    date_to: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
    page,
    pageSize,
  }

  const { data, isLoading, refetch } = useQuery<AuditResponse>({
    queryKey: ['ard-audit', params],
    queryFn: () => {
      const sp = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) })
      return apiGet(`/api/ard/audit?${sp.toString()}`)
    },
  })

  const handleReset = useCallback(() => {
    setQ('')
    setKind('ALL')
    setActor('')
    setDateRange([null, null])
    setPage(1)
  }, [])

  const handleExport = useCallback(() => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (kind !== 'ALL') sp.set('kind', kind)
    if (actor) sp.set('actor', actor)
    if (dateRange[0]) sp.set('date_from', dateRange[0].format('YYYY-MM-DD'))
    if (dateRange[1]) sp.set('date_to', dateRange[1].format('YYYY-MM-DD'))
    window.open(`/api/ard/audit/export/xlsx?${sp.toString()}`, '_blank')
  }, [q, kind, actor, dateRange])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={20} className="text-violet-600" />
          <h1 className="text-lg font-bold text-slate-800">Audit Trail</h1>
          <Tag color="blue" className="font-semibold rounded-full px-2.5">{data?.total ?? 0}</Tag>
        </div>
        <Space>
          <Tooltip title="Export to Excel">
            <Button icon={<Download size={14} />} onClick={handleExport}>
              Export
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-lg p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Search</p>
          <Input
            prefix={<Search size={14} className="text-slate-400" />}
            placeholder="Entity / action / user..."
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            allowClear
          />
        </div>

        <div className="min-w-[180px]">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Entity Type</p>
          <Select
            value={kind}
            options={ENTITY_TYPES}
            onChange={v => { setKind(v); setPage(1) }}
            className="w-full"
          />
        </div>

        <div className="min-w-[160px]">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">User</p>
          <Input
            placeholder="Filter by user..."
            value={actor}
            onChange={e => { setActor(e.target.value); setPage(1) }}
            allowClear
          />
        </div>

        <div className="min-w-[260px]">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Date Range</p>
          <RangePicker
            value={dateRange}
            onChange={v => { setDateRange(v ? [v[0], v[1]] : [null, null]); setPage(1) }}
            format="DD MMM YYYY"
            className="w-full"
          />
        </div>

        <Button icon={<RotateCcw size={14} />} onClick={handleReset}>
          Reset
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table<AuditRow>
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          size="small"
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: false,
            showTotal: (t) => `${t} events`,
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Event Type',
              dataIndex: 'eventType',
              width: 200,
              sorter: (a, b) => a.eventType.localeCompare(b.eventType),
              render: (v) => <span className="font-mono text-xs">{v}</span>,
            },
            {
              title: 'Event Time',
              dataIndex: 'eventTimeFormatted',
              width: 180,
              sorter: (a, b) => (a.eventTime ?? '').localeCompare(b.eventTime ?? ''),
              render: (v, row) => (
                <span className="font-mono text-xs text-slate-600">
                  {v || (row.eventTime ? dayjs(row.eventTime).format('DD MMM YYYY (HH:mm:ss)') : '—')}
                </span>
              ),
            },
            {
              title: 'User',
              dataIndex: 'user',
              width: 130,
              sorter: (a, b) => a.user.localeCompare(b.user),
              render: (v) => <span className="font-semibold text-slate-700">{v}</span>,
            },
            {
              title: 'Entity Type',
              dataIndex: 'entityType',
              width: 120,
              render: (v) => (
                <Tag color={ENTITY_COLOR[v] ?? 'default'} className="text-xs">
                  {v || '—'}
                </Tag>
              ),
            },
            {
              title: 'Event Details',
              dataIndex: 'eventDetails',
              render: (v) => <span className="text-slate-600">{v || '—'}</span>,
            },
          ]}
        />
      </div>
    </div>
  )
}
