import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input, Table, Grid } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FlaskConical, Clock, CheckCircle2, Search } from 'lucide-react'
import { cgtExperimentApi, type CgtExperimentListItem } from '../../api/cgt'
import { StatusTag } from '../../components/ui/StatusTag'
import { EmptyValue } from '../../components/ui/EmptyValue'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

const COMPLETED_STATUSES = ['APPROVED']

// ── KPI card — matches ADC's AdcPdChemDashboard style ─────────────────────────
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

// Dashboard for the CGT Chemist/Analyst — mirrors AdcPdChemDashboard.tsx: KPI
// toggle between Total Assigned / Pending / Completed, plus a single flat,
// searchable/sortable table of the experiments assigned to them. Clicking a
// row's title navigates straight into that experiment.
export default function CgtChemDashboard() {
  const navigate = useNavigate()
  const screens  = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [activeView, setActiveView] = useState<'all' | 'pending' | 'completed'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-chem-dashboard'],
    queryFn:  cgtExperimentApi.myDashboard,
  })

  const stats = data?.stats ?? { total: 0, completed: 0, pending: 0 }
  const allExperiments = data?.items ?? []

  const experiments = allExperiments
    .filter(e => activeView === 'all'
      ? true
      : activeView === 'completed'
        ? COMPLETED_STATUSES.includes(e.status)
        : !COMPLETED_STATUSES.includes(e.status))
    .filter(e => searchTerm
      ? [e.full_code, e.title, e.notebook_code, e.project_code, e.status]
          .some(v => v && String(v).toLowerCase().includes(searchTerm))
      : true)

  const columns: ColumnsType<CgtExperimentListItem> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 130,
      sorter: (a, b) => a.full_code.localeCompare(b.full_code),
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Experiment Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v: string, row: CgtExperimentListItem) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.cgt_notebook_id}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook', dataIndex: 'notebook_code', key: 'notebook_code', width: 150,
      sorter: (a, b) => (a.notebook_code ?? '').localeCompare(b.notebook_code ?? ''),
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 130,
      sorter: (a, b) => (a.project_code ?? '').localeCompare(b.project_code ?? ''),
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
        <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <FlaskConical size={15} className="text-violet-500 shrink-0" />
          <span className="text-[13px] font-semibold text-slate-700 shrink-0">{viewLabel}</span>
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
            {experiments.length}
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
        <div className="glass-card rounded-lg overflow-hidden">
          <Table
            dataSource={experiments}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size={screens.md ? 'middle' : 'small'}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
            locale={{ emptyText: 'No experiments assigned to you yet.' }}
          />
        </div>
      </div>
    </div>
  )
}
