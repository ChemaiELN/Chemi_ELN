import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input, Table, Tooltip, Modal, Form, Select, DatePicker, message, Grid } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Column } from '@ant-design/plots'
import { BookOpen, FlaskConical, Pencil, Plus, Search } from 'lucide-react'
import { notebookApi, experimentApi, userApi, type Notebook, type ExperimentListItem } from '../../api/adc'
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

// ── KPI card — matches the HOD dashboard style ────────────────────────────────
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
    queryKey: ['experiment-assigned-users', experimentId],
    queryFn:  () => experimentApi.getAssignedUsers(experimentId),
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0 ring-2 ring-white cursor-default">
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

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdcPdTlDashboard() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const screens  = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const [activeView, setActiveView] = useState<'all' | 'with_experiments'>('all')

  // Independent pagination/sort state per table — they're shown one at a
  // time (never both), but keeping them separate avoids page/sort from one
  // view leaking into the other when the user switches back and forth.
  const [nbPage, setNbPage] = useState(1)
  const nbPageSize = 10
  const [nbSortBy,  setNbSortBy]  = useState<string | null>(null)
  const [nbSortDir, setNbSortDir] = useState<'asc' | 'desc'>('desc')

  const [expPage, setExpPage] = useState(1)
  const expPageSize = 10
  const [expSortBy,  setExpSortBy]  = useState<string | null>(null)
  const [expSortDir, setExpSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => { setNbPage(1); setExpPage(1) }, [searchTerm])

  const [expTarget, setExpTarget] = useState<Notebook | null>(null)
  const [expForm] = Form.useForm()

  const [editTarget, setEditTarget] = useState<Notebook | null>(null)
  const [editForm] = Form.useForm()

  const [editExpTarget, setEditExpTarget] = useState<ExperimentListItem | null>(null)
  const [editExpForm]   = Form.useForm()

  // Analytics panel — date range + chemist drill-down (Experiment Created view only)
  const [analyticsRange, setAnalyticsRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [analyticsChemistId, setAnalyticsChemistId] = useState<string | undefined>(undefined)

  const { data: stats = { total: 0, with_experiments: 0, without_experiments: 0, total_experiments: 0 } } = useQuery({
    queryKey: ['adc-tl-stats'],
    queryFn:  notebookApi.tlStats,
  })

  const { data: nbData, isLoading: loadingNb } = useQuery({
    queryKey: ['adc-tl-notebooks', nbPage, nbPageSize, searchTerm, nbSortBy, nbSortDir],
    queryFn:  () => notebookApi.listAll({
      assigned_to_me: true, page: nbPage, limit: nbPageSize, search: searchTerm || undefined,
      sort_by: nbSortBy ?? undefined, sort_dir: nbSortDir,
    }),
    enabled: activeView === 'all',
  })
  const notebooks = nbData?.items ?? []
  const notebooksTotal = nbData?.total ?? 0

  const { data: expData, isLoading: loadingExp } = useQuery({
    queryKey: ['adc-tl-experiments', expPage, expPageSize, searchTerm, expSortBy, expSortDir],
    queryFn:  () => experimentApi.listAll({
      assigned_to_tl: true, page: expPage, limit: expPageSize, search: searchTerm || undefined,
      sort_by: expSortBy ?? undefined, sort_dir: expSortDir,
    }),
    enabled: activeView === 'with_experiments',
  })
  const experiments = expData?.items ?? []
  const experimentsTotal = expData?.total ?? 0

  // Per-chemist analytics — a dedicated aggregate over the TL's ENTIRE
  // experiment scope (not just the current page), since the chart and
  // drill-down need totals regardless of what page the table is showing.
  const { data: chemistSummary = [] } = useQuery({
    queryKey: ['adc-tl-experiment-summary', analyticsRange?.[0]?.format('YYYY-MM-DD'), analyticsRange?.[1]?.format('YYYY-MM-DD')],
    queryFn: () => notebookApi.tlExperimentSummary(
      analyticsRange ? { from_date: analyticsRange[0].format('YYYY-MM-DD'), to_date: analyticsRange[1].format('YYYY-MM-DD') } : undefined,
    ),
    enabled: activeView === 'with_experiments',
  })

  // Chemists for the "Assign Chemist" pickers — also used to filter assigned-users
  // lists down to chemists only, since getAssignedUsers returns every assignee.
  const { data: adcPdChemUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-chem'],
    queryFn: () => userApi.list({ role_code: 'CHEM', dept_code: 'ADC_PD' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Chemists currently assigned to the experiment being edited
  const { data: editExpAssignedUsers = [] } = useQuery({
    queryKey: ['experiment-assigned-users', editExpTarget?.id],
    queryFn:  () => experimentApi.getAssignedUsers(editExpTarget!.id),
    enabled:  !!editExpTarget,
  })
  const editExpAssignedChemIds = editExpAssignedUsers.map(u => u.user_id)

  const createExpMut = useMutation({
    mutationFn: async ({ notebookId, title, chemistIds }: { notebookId: string; title: string; chemistIds: string[] }) => {
      const exp = await experimentApi.createForNotebook(notebookId, { title })
      await Promise.all(chemistIds.map(uid => experimentApi.assignUser(exp.id, uid)))
      return exp
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-tl-notebooks'] })
      qc.invalidateQueries({ queryKey: ['adc-tl-stats'] })
      message.success('Experiment created.')
      setExpTarget(null)
      expForm.resetFields()
    },
    onError: () => message.error('Failed to create experiment'),
  })

  const openEditNotebook = (nb: Notebook) => {
    setEditTarget(nb)
    editForm.setFieldsValue({ title: nb.title })
  }

  const editMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      notebookApi.update(id, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-tl-notebooks'] })
      message.success('Notebook updated.')
      setEditTarget(null)
      editForm.resetFields()
    },
    onError: () => message.error('Failed to update notebook'),
  })

  const openEditExp = (exp: ExperimentListItem) => {
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
      await experimentApi.update(editExpTarget.id, { title })
      const toAdd    = chemistIds.filter(uid => !editExpAssignedChemIds.includes(uid))
      const toRemove = editExpAssignedChemIds.filter(uid => !chemistIds.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => experimentApi.assignUser(editExpTarget.id, uid)),
        ...toRemove.map(uid => experimentApi.unassignUser(editExpTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-tl-experiments'] })
      qc.invalidateQueries({ queryKey: ['experiment-assigned-users', editExpTarget?.id] })
      qc.invalidateQueries({ queryKey: ['adc-tl-experiment-summary'] })
      message.success('Experiment updated.')
      setEditExpTarget(null)
      editExpForm.resetFields()
    },
    onError: () => message.error('Failed to update experiment'),
  })

  // ── Analytics panel data ────────────────────────────────────────────────
  const chemistCounts = chemistSummary.map(c => ({ username: c.username ?? '?', id: c.user_id, count: c.count }))

  const selectedChemist = analyticsChemistId ? chemistSummary.find(c => c.user_id === analyticsChemistId) : undefined
  const selectedChemistExperiments = selectedChemist?.experiments ?? []
  const COMPLETED_STATUSES = ['APPROVED', 'LOCKED']
  const selectedChemistCompleted = selectedChemistExperiments.filter(e => COMPLETED_STATUSES.includes(e.status)).length
  const selectedChemistTotal     = selectedChemistExperiments.length
  const selectedChemistPending   = selectedChemistTotal - selectedChemistCompleted
  const drilldownData = [
    { label: 'Total Assigned', count: selectedChemistTotal },
    { label: 'Completed',      count: selectedChemistCompleted },
    { label: 'Pending',        count: selectedChemistPending },
  ]

  const notebookColumns: ColumnsType<Notebook> = [
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
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
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
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center' as const,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Experiments', dataIndex: 'experiment_count', key: 'experiment_count', width: 140, align: 'center' as const,
      render: (v: number | undefined) => !v
        ? <span className="text-[13px] text-amber-500 italic">Not created</span>
        : <span className="text-[12px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">{v} Experiment{v === 1 ? '' : 's'}</span>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center' as const,
      render: (_: unknown, row: Notebook) => (
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

  const experimentColumns: ColumnsType<ExperimentListItem> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 200,
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
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/overview`)}
          className="text-[13px] text-teal-600 hover:text-teal-800 hover:underline text-left"
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
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center' as const,
      sorter: true,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Chemist Assigned', key: 'chemist', width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <AssignedChemistCell experimentId={row.id} />
      ),
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center' as const,
      render: (_: unknown, row: ExperimentListItem) => (
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
    <div className="p-6 space-y-6">
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
            <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
              <BookOpen size={15} className="text-violet-500 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebook Received</span>
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                {notebooksTotal}
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
            <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
              <Table
                dataSource={notebooks}
                columns={notebookColumns}
                rowKey="id"
                loading={loadingNb}
                size={screens.md ? 'middle' : 'small'}
                scroll={{ x: 'max-content' }}
                pagination={{ current: nbPage, pageSize: nbPageSize, total: notebooksTotal, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} notebooks` }}
                onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
                  if (pagination.current) setNbPage(pagination.current)
                  const s = sorter as SorterResult<Notebook>
                  if (s.order) {
                    setNbSortBy(s.field as string)
                    setNbSortDir(s.order === 'ascend' ? 'asc' : 'desc')
                  } else {
                    setNbSortBy(null)
                  }
                }}
                locale={{ emptyText: 'No notebooks assigned to you yet.' }}
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[68%_32%] gap-4 items-start">
            {/* Left half — Experiment Created filter bar + table */}
            <div className="space-y-3">
              <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
                <FlaskConical size={15} className="text-emerald-500 shrink-0" />
                <span className="text-[13px] font-semibold text-slate-700 shrink-0">Experiment Created</span>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                  {experimentsTotal}
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
              <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
                <Table
                  dataSource={experiments}
                  columns={experimentColumns}
                  rowKey="id"
                  loading={loadingExp}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  pagination={{ current: expPage, pageSize: expPageSize, total: experimentsTotal, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} experiments` }}
                  onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
                    if (pagination.current) setExpPage(pagination.current)
                    const s = sorter as SorterResult<ExperimentListItem>
                    if (s.order) {
                      setExpSortBy(s.field as string)
                      setExpSortDir(s.order === 'ascend' ? 'asc' : 'desc')
                    } else {
                      setExpSortBy(null)
                    }
                  }}
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
                    options={chemistSummary.map(c => ({ value: c.user_id, label: c.username }))}
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
        closable={false}
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
            <Input placeholder="e.g. ADC Synthesis Run 1" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Experiment modal — create the experiment and assign chemist(s) in one step */}
      <Modal
        title={expTarget ? `New Experiment — ${expTarget.title}` : 'New Experiment'}
        open={!!expTarget}
        closable={false}
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
            <Input placeholder="e.g. ADC Conjugation Run 1" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Experiment modal — rename the experiment and change chemist assignment */}
      <Modal
        title={editExpTarget ? `Edit — ${editExpTarget.full_code}` : 'Edit Experiment'}
        open={!!editExpTarget}
        closable={false}
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
            <Input placeholder="e.g. ADC Conjugation Run 1" />
          </Form.Item>
          <Form.Item label="Assign Chemist" name="chemist_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Chemist(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdChemUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
