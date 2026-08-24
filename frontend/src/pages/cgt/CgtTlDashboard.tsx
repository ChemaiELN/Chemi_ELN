import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Table, Tooltip, Modal, Form, Select, DatePicker, message, Grid } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { Column } from '@ant-design/plots'
import { BookOpen, FlaskConical, Pencil, Plus, Search } from 'lucide-react'
import { cgtNotebookApi, cgtExperimentApi, type CgtNotebookWithExperiments } from '../../api/cgt'
import { userApi } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { glassModalProps } from '../../utils/modalStyles'
import dayjs, { type Dayjs } from 'dayjs'

const { RangePicker } = DatePicker

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', CLOSED: 'purple',
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// A single flattened experiment row — each notebook's experiments merged with
// their parent notebook's context, since the "Experiment Created" view lists
// experiments themselves rather than the notebooks that contain them.
interface FlatExperiment {
  id: string
  full_code: string
  title: string
  status: string
  created_at: string
  notebook_id: string
  notebook_code: string
  project_id: string
  project_code: string | null
}

// ── KPI card — matches CGT HOD dashboard style ────────────────────────────────
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

function AssignedChemistCell({ experimentId }: { experimentId: string }) {
  const { data: chemAssigned = [] } = useQuery({
    queryKey: ['cgt-experiment-assigned-users', experimentId],
    queryFn:  () => cgtExperimentApi.getAssignedUsers(experimentId),
  })
  if (!chemAssigned.length) {
    return <span className="text-[13px] text-amber-500 italic">Not assigned</span>
  }
  const shown = chemAssigned.slice(0, 3)
  const extra = chemAssigned.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map(u => (
        <Tooltip key={u.user_id} title={u.username}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center shrink-0 ring-2 ring-white cursor-default">
            <span className="text-white text-[11px] font-bold">
              {(u.username ?? '?').slice(0, 2).toUpperCase()}
            </span>
          </div>
        </Tooltip>
      ))}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 ring-2 ring-white">
          <span className="text-slate-600 text-[10px] font-bold">+{extra}</span>
        </div>
      )}
    </div>
  )
}

// Dashboard for the CGT Team Lead — mirrors AdcPdTlDashboard.tsx: KPI toggle
// between "Notebook Received" (all notebooks assigned to this TL) and
// "Experiment Created" (flattened experiment list + per-chemist analytics).
export default function CgtTlDashboard() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const screens  = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [activeView, setActiveView] = useState<'all' | 'with_experiments'>('all')

  // "Notebook Received" table — real server-side pagination/sort/search.
  const [nbPage, setNbPage] = useState(1)
  const [nbPageSize, setNbPageSize] = useState(10)
  const [nbSortField, setNbSortField] = useState<string | undefined>(undefined)
  const [nbSortOrder, setNbSortOrder] = useState<'ascend' | 'descend' | undefined>(undefined)
  useEffect(() => { setNbPage(1) }, [searchTerm, nbSortField, nbSortOrder])

  const [expTarget, setExpTarget] = useState<CgtNotebookWithExperiments | null>(null)
  const [expForm] = Form.useForm()

  const [editTarget, setEditTarget] = useState<CgtNotebookWithExperiments | null>(null)
  const [editForm] = Form.useForm()

  const [editExpTarget, setEditExpTarget] = useState<FlatExperiment | null>(null)
  const [editExpForm]   = Form.useForm()

  // Analytics panel — date range + chemist drill-down (Experiment Created view only)
  const [analyticsRange, setAnalyticsRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [analyticsChemistId, setAnalyticsChemistId] = useState<string | undefined>(undefined)

  // Cheap aggregate counts for the KPI cards — independent of either table below.
  const { data: statsData } = useQuery({
    queryKey: ['cgt-tl-dashboard-stats'],
    queryFn:  cgtNotebookApi.tlDashboardStats,
  })
  const stats = statsData ?? { total: 0, with_experiments: 0, without_experiments: 0, total_experiments: 0 }

  // "Notebook Received" — paginated/sorted/searched server-side.
  const { data: nbData, isLoading: nbLoading } = useQuery({
    queryKey: ['cgt-tl-notebooks', nbPage, nbPageSize, searchTerm, nbSortField, nbSortOrder],
    queryFn:  () => cgtNotebookApi.listAll({
      page: nbPage,
      limit: nbPageSize,
      search: searchTerm || undefined,
      sortBy: nbSortField,
      sortDir: nbSortOrder === 'ascend' ? 'asc' : nbSortOrder === 'descend' ? 'desc' : undefined,
    }),
    enabled: activeView === 'all',
    placeholderData: (prev) => prev,
  })
  const nbProjects = nbData?.items ?? []
  const nbTotal = nbData?.total ?? 0

  const handleNbTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<CgtNotebookWithExperiments> | SorterResult<CgtNotebookWithExperiments>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setNbSortField(s?.field ? String(s.field) : undefined)
    setNbSortOrder(s?.order ?? undefined)
  }

  // "Experiment Created" + analytics panel needs the FULL experiment set to
  // aggregate per-chemist counts — only fetched once that view is active.
  const { data, isLoading } = useQuery({
    queryKey: ['cgt-tl-dashboard'],
    queryFn:  cgtNotebookApi.tlDashboard,
    enabled:  activeView === 'with_experiments',
  })

  // Chemists for the "Assign Chemist" pickers — also used to filter assigned-users
  // lists down to chemists only, since getAssignedUsers returns every assignee.
  const { data: cgtChemUsers = [] } = useQuery({
    queryKey: ['users-cgt-chem'],
    queryFn: () => userApi.list({ role_code: 'CHEM', dept_code: 'CGT' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  const allWithExp = data?.with_experiments ?? []

  // Flatten every notebook's experiments into individual rows — needed early so
  // the analytics per-experiment chemist queries below can run over it.
  const allExperiments: FlatExperiment[] = allWithExp.flatMap(nb =>
    nb.experiments.map(exp => ({
      ...exp,
      notebook_id:   nb.id,
      notebook_code: nb.code,
      project_id:    nb.cgt_project_id,
      project_code:  nb.project_code,
    }))
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Chemists assigned per experiment (for the analytics panel's per-chemist
  // counts) — fetched explicitly here rather than relying on child cell
  // components, since the chart needs all of them aggregated at once.
  const experimentChemQueries = useQueries({
    queries: allExperiments.map(exp => ({
      queryKey: ['cgt-experiment-assigned-users', exp.id],
      queryFn:  () => cgtExperimentApi.getAssignedUsers(exp.id),
    })),
  })
  const experimentChemMap: Record<string, { id: string; username: string }[]> = {}
  allExperiments.forEach((exp, i) => {
    const assigned = experimentChemQueries[i]?.data ?? []
    experimentChemMap[exp.id] = assigned.map(u => ({ id: u.user_id, username: u.username ?? '?' }))
  })

  // Chemists currently assigned to the experiment being edited
  const { data: editExpAssignedUsers = [] } = useQuery({
    queryKey: ['cgt-experiment-assigned-users', editExpTarget?.id],
    queryFn:  () => cgtExperimentApi.getAssignedUsers(editExpTarget!.id),
    enabled:  !!editExpTarget,
  })
  const editExpAssignedChemIds = editExpAssignedUsers.map(u => u.user_id)

  const createExpMut = useMutation({
    mutationFn: async ({ notebookId, title, chemistIds }: { notebookId: string; title: string; chemistIds: string[] }) => {
      const exp = await cgtExperimentApi.createForNotebook(notebookId, { title })
      await Promise.all(chemistIds.map(uid => cgtExperimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-tl-dashboard'] })
      qc.invalidateQueries({ queryKey: ['cgt-tl-notebooks'] })
      qc.invalidateQueries({ queryKey: ['cgt-tl-dashboard-stats'] })
      message.success('Experiment created.')
      setExpTarget(null)
      expForm.resetFields()
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const openEditNotebook = (nb: CgtNotebookWithExperiments) => {
    setEditTarget(nb)
    editForm.setFieldsValue({ title: nb.title })
  }

  const editMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      cgtNotebookApi.update(id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-tl-dashboard'] })
      qc.invalidateQueries({ queryKey: ['cgt-tl-notebooks'] })
      message.success('Notebook updated.')
      setEditTarget(null)
      editForm.resetFields()
    },
    onError: () => message.error('Failed to update notebook'),
  })

  const openEditExp = (exp: FlatExperiment) => {
    setEditExpTarget(exp)
  }

  useEffect(() => {
    if (editExpTarget) {
      editExpForm.setFieldsValue({ title: editExpTarget.title, chemist_ids: editExpAssignedChemIds })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editExpTarget, editExpAssignedUsers])

  const editExpMut = useMutation({
    mutationFn: async ({ title, chemistIds }: { title: string; chemistIds: string[] }) => {
      if (!editExpTarget) return
      await cgtExperimentApi.update(editExpTarget.id, { title })
      const toAdd    = chemistIds.filter(uid => !editExpAssignedChemIds.includes(uid))
      const toRemove = editExpAssignedChemIds.filter(uid => !chemistIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => cgtExperimentApi.assignUser(editExpTarget.id, uid)),
        ...toRemove.map(uid => cgtExperimentApi.unassignUser(editExpTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-tl-dashboard'] })
      qc.invalidateQueries({ queryKey: ['cgt-experiment-assigned-users', editExpTarget?.id] })
      message.success('Experiment updated.')
      setEditExpTarget(null)
      editExpForm.resetFields()
    },
    onError: () => message.error('Failed to update experiment'),
  })

  const filteredExperiments = searchTerm
    ? allExperiments.filter(e =>
        [e.full_code, e.title, e.status, e.notebook_code, e.project_code]
          .some(v => v && String(v).toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : allExperiments

  // ── Analytics panel data ────────────────────────────────────────────────
  const COMPLETED_STATUSES = ['APPROVED']

  const rangeFilteredExperiments = analyticsRange
    ? allExperiments.filter(e => {
        const t = dayjs(e.created_at)
        return !t.isBefore(analyticsRange[0], 'day') && !t.isAfter(analyticsRange[1], 'day')
      })
    : allExperiments

  // Chemists who actually appear assigned to at least one of this TL's
  // experiments — the only ones relevant to the drill-down dropdown and chart.
  const relevantChemists = Object.values(experimentChemMap)
    .flat()
    .reduce((acc: { id: string; username: string }[], c) => {
      if (!acc.some(x => x.id === c.id)) acc.push(c)
      return acc
    }, [])

  const chemistCounts = relevantChemists.map(c => ({
    ...c,
    count: rangeFilteredExperiments.filter(e => (experimentChemMap[e.id] ?? []).some(x => x.id === c.id)).length,
  })).sort((a, b) => b.count - a.count)

  const selectedChemistExperiments = analyticsChemistId
    ? rangeFilteredExperiments.filter(e => (experimentChemMap[e.id] ?? []).some(c => c.id === analyticsChemistId))
    : []
  const selectedChemistCompleted = selectedChemistExperiments.filter(e => COMPLETED_STATUSES.includes(e.status)).length
  const selectedChemistTotal     = selectedChemistExperiments.length
  const selectedChemistPending   = selectedChemistTotal - selectedChemistCompleted
  const drilldownData = [
    { label: 'Total Assigned', count: selectedChemistTotal },
    { label: 'Completed',      count: selectedChemistCompleted },
    { label: 'Pending',        count: selectedChemistPending },
  ]

  const notebookColumns: ColumnsType<CgtNotebookWithExperiments> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: true,
      render: (v: string, row) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Experiments', key: 'experiments', width: 220,
      render: (_: unknown, row: CgtNotebookWithExperiments) => {
        if (!row.experiments.length) {
          return <span className="text-[13px] text-amber-500 italic">Not created</span>
        }
        const [first, ...rest] = row.experiments
        return (
          <div className="flex items-center gap-1">
            <Tooltip title={first.title}>
              <span className="text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                {first.full_code}
              </span>
            </Tooltip>
            {rest.length > 0 && (
              <Tooltip title={rest.map(e => e.full_code).join(', ')}>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 cursor-default">
                  +{rest.length}
                </span>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: CgtNotebookWithExperiments) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit notebook name">
            <button
              onClick={() => openEditNotebook(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
          <Tooltip title="New Experiment">
            <button
              onClick={() => setExpTarget(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Plus size={13} />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  const experimentColumns: ColumnsType<FlatExperiment> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 150,
      sorter: (a, b) => a.full_code.localeCompare(b.full_code),
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 200,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v: string, row: FlatExperiment) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.project_id}/notebooks/${row.notebook_id}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook', dataIndex: 'notebook_code', key: 'notebook_code', width: 130,
      sorter: (a, b) => a.notebook_code.localeCompare(b.notebook_code),
      render: (v: string, row: FlatExperiment) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.project_id}/notebooks/${row.notebook_id}`)}
          className="text-[13px] text-teal-600 hover:text-teal-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
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
    {
      title: 'Chemist Assigned', key: 'chemist', width: 160,
      render: (_: unknown, row: FlatExperiment) => (
        <AssignedChemistCell experimentId={row.id} />
      ),
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: FlatExperiment) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit experiment">
            <button
              onClick={() => openEditExp(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-2 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={BookOpen} label="Notebook Received" value={stats.total}
          bg="bg-violet-100" iconColor="text-violet-600"
          onClick={() => setActiveView('all')}
          active={activeView === 'all'}
        />
        <KpiCard
          icon={FlaskConical} label="Experiment Created" value={stats.total_experiments}
          bg="bg-emerald-100" iconColor="text-emerald-600"
          onClick={() => setActiveView('with_experiments')}
          active={activeView === 'with_experiments'}
        />
      </div>

      {/* Table section — toggles between Notebook Received and Experiment Created */}
      <div className="space-y-3">
        {activeView === 'all' ? (
          <>
            <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
              <BookOpen size={15} className="text-violet-500 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebook Received</span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                {nbTotal}
              </span>
              <Input
                prefix={<Search size={13} className="text-slate-400" />}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search notebooks…"
                style={{ width: 240 }}
                allowClear
              />
            </div>
            <div className="glass-card rounded-lg overflow-hidden">
              <Table
                dataSource={nbProjects}
                columns={notebookColumns}
                rowKey="id"
                loading={nbLoading}
                size={screens.md ? 'middle' : 'small'}
                scroll={{ x: 'max-content' }}
                onChange={handleNbTableChange}
                pagination={{
                  current: nbPage,
                  pageSize: nbPageSize,
                  total: nbTotal,
                  showSizeChanger: false,
                  size: 'small',
                  showTotal: (t) => `${t} notebooks`,
                  onChange: (p, ps) => { setNbPage(p); setNbPageSize(ps) },
                }}
                locale={{ emptyText: 'No notebooks assigned to you yet.' }}
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[68%_32%] gap-4 items-start">
            {/* Left half — Experiment Created filter bar + table */}
            <div className="space-y-3">
              <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
                <FlaskConical size={15} className="text-emerald-500 shrink-0" />
                <span className="text-[13px] font-semibold text-slate-700 shrink-0">Experiment Created</span>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                  {allExperiments.length}
                </span>
                <Input
                  prefix={<Search size={13} className="text-slate-400" />}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search experiments…"
                  style={{ width: 200 }}
                  allowClear
                />
              </div>
              <div className="glass-card rounded-lg overflow-hidden">
                <Table
                  dataSource={filteredExperiments}
                  columns={experimentColumns}
                  rowKey="id"
                  loading={isLoading}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 5, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
                  locale={{ emptyText: 'No experiments have been created yet.' }}
                />
              </div>
            </div>

            {/* Right half — analytics: experiments per chemist, with date range + drill-down */}
            <div className="glass-card rounded-lg p-4 lg:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[13px] font-semibold text-slate-700">Experiments by Chemist</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <RangePicker
                    value={analyticsRange}
                    onChange={vals => setAnalyticsRange(vals && vals[0] && vals[1] ? [vals[0], vals[1]] : null)}
                  />
                  <Select
                    placeholder="All Chemists"
                    allowClear
                    value={analyticsChemistId}
                    onChange={setAnalyticsChemistId}
                    style={{ width: 160 }}
                    options={relevantChemists.map(c => ({ value: c.id, label: c.username }))}
                  />
                </div>
              </div>

              {!analyticsChemistId ? (
                chemistCounts.length === 0 ? (
                  <p className="text-[13px] text-slate-400 text-center py-10">No chemists assigned yet.</p>
                ) : (
                  <Column
                    data={chemistCounts}
                    xField="username"
                    yField="count"
                    height={260}
                    label={{ position: 'top' }}
                    axis={{ y: { title: 'Experiments' } }}
                    style={{ fill: '#b9a0f3', fillOpacity: 0.75, radiusTopLeft: 4, radiusTopRight: 4 }}
                  />
                )
              ) : (
                <Column
                  data={drilldownData}
                  xField="label"
                  yField="count"
                  colorField="label"
                  height={260}
                  label={{ position: 'top' }}
                  axis={{ y: { title: 'Experiments' } }}
                  scale={{ color: { range: ['#8b5cf6', '#10b981', '#f59e0b'] } }}
                  legend={false}
                  style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Notebook modal — rename the notebook only */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.code}` : 'Edit Notebook'}
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editMut.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => {
            if (!editTarget) return
            editMut.mutate({ id: editTarget.id, title: vals.title })
          }}
        >
          <Form.Item label="Notebook Name" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. AAV USP Run 1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Experiment modal — create the experiment and assign chemist(s) in one step */}
      <Modal
        title={expTarget ? `New Experiment — ${expTarget.title}` : 'New Experiment'}
        open={!!expTarget}
        onCancel={() => { setExpTarget(null); expForm.resetFields() }}
        onOk={() => expForm.submit()}
        okText="Create"
        confirmLoading={createExpMut.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={expForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => {
            if (!expTarget) return
            createExpMut.mutate({
              notebookId: expTarget.id,
              title: vals.title,
              chemistIds: vals.chemist_ids ?? [],
            })
          }}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Seed Media Preparation" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={cgtChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Experiment modal — rename the experiment and change chemist assignment */}
      <Modal
        title={editExpTarget ? `Edit — ${editExpTarget.full_code}` : 'Edit Experiment'}
        open={!!editExpTarget}
        onCancel={() => { setEditExpTarget(null); editExpForm.resetFields() }}
        onOk={() => editExpForm.submit()}
        okText="Save Changes"
        confirmLoading={editExpMut.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editExpForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => editExpMut.mutate({ title: vals.title, chemistIds: vals.chemist_ids ?? [] })}
        >
          <Form.Item label="Experiment Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Seed Media Preparation" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={cgtChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
