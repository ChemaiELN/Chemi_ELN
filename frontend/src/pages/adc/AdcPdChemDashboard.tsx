import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input, Table, Grid } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { FlaskConical, Clock, CheckCircle2, Search } from 'lucide-react'
import { experimentApi, type ExperimentListItem } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green',
  REJECTED: 'red', LOCKED: 'purple', UNLOCKED: 'gold', VOID: 'orange',
}

// ── KPI card — matches the HOD/TL dashboard style ─────────────────────────────
function KpiCard({ icon: Icon, label, value, bg, iconColor, onClick, active }: {
  icon: React.ElementType; label: string; value: number; bg: string; iconColor: string
  onClick?: () => void; active?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={[
        'group relative overflow-hidden glass-card rounded-lg p-4 lg:p-5 flex items-center gap-3 lg:gap-4 transition-all duration-200',
        onClick ? 'cursor-pointer select-none' : '',
        active ? 'ring-2 ring-violet-400 shadow-md' : '',
      ].join(' ')}
    >
      <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out ${bg}`} />
      <div className={`relative w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"
          style={{ backgroundColor: '#FEFEFA' }}
        />
        <Icon size={18} className={`relative ${iconColor} lg:w-5 lg:h-5`} />
      </div>
      <div className="relative min-w-0">
        <p className="text-2xl lg:text-3xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs lg:text-sm text-slate-500 mt-0.5 leading-tight truncate">{label}</p>
      </div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdcPdChemDashboard() {
  const navigate = useNavigate()
  const screens  = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [activeView, setActiveView] = useState<'all' | 'pending' | 'completed'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setPage(1) }, [searchTerm, activeView])

  const { data: stats = { total: 0, completed: 0, pending: 0 } } = useQuery({
    queryKey: ['adc-chem-stats'],
    queryFn:  experimentApi.myStats,
  })

  // GET /experiments already scopes itself to "my assigned experiments" for a
  // caller without adc.experiment.view_all — a chemist — so this is the same
  // paginated endpoint the general Experiments page uses, just relying on
  // that automatic scoping instead of an explicit filter.
  const { data, isLoading } = useQuery({
    queryKey: ['adc-chem-experiments', page, pageSize, searchTerm, activeView, sortBy, sortDir],
    queryFn:  () => experimentApi.listAll({
      page, limit: pageSize, search: searchTerm || undefined,
      status_group: activeView === 'all' ? undefined : activeView,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const experiments = data?.items ?? []
  const total = data?.total ?? 0

  const columns: ColumnsType<ExperimentListItem> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Experiment Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: true,
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook', dataIndex: 'notebook_code', key: 'notebook_code', width: 130,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 130,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center' as const,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
  ]

  const viewLabel = activeView === 'completed' ? 'Completed' : activeView === 'pending' ? 'Pending' : 'My Experiments'

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          icon={FlaskConical} label="Total Assigned" value={stats.total}
          bg="bg-violet-100" iconColor="text-violet-600"
          onClick={() => setActiveView('all')}
          active={activeView === 'all'}
        />
        <KpiCard
          icon={Clock} label="Pending" value={stats.pending}
          bg="bg-amber-100" iconColor="text-amber-600"
          onClick={() => setActiveView('pending')}
          active={activeView === 'pending'}
        />
        <KpiCard
          icon={CheckCircle2} label="Completed" value={stats.completed}
          bg="bg-emerald-100" iconColor="text-emerald-600"
          onClick={() => setActiveView('completed')}
          active={activeView === 'completed'}
        />
      </div>

      {/* Experiments table */}
      <div className="space-y-3">
        <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
          <FlaskConical size={15} className="text-violet-500 shrink-0" />
          <span className="text-[13px] font-semibold text-slate-700 shrink-0">{viewLabel}</span>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
            {total}
          </span>
          <Input
            prefix={<Search size={13} className="text-slate-400" />}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search experiments…"
            style={{ width: 240 }}
            allowClear
          />
        </div>
        <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
          <Table
            dataSource={experiments}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size={screens.md ? 'middle' : 'small'}
            scroll={{ x: 'max-content' }}
            pagination={{ current: page, pageSize, total, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
            onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
              if (pagination.current) setPage(pagination.current)
              const s = sorter as SorterResult<ExperimentListItem>
              if (s.order) {
                setSortBy(s.field as string)
                setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
              } else {
                setSortBy(null)
              }
            }}
            locale={{ emptyText: 'No experiments assigned to you yet.' }}
          />
        </div>
      </div>
    </div>
  )
}
