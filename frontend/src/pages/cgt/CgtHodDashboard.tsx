import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Form, Input, Select, DatePicker, Table, Tooltip, Grid, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { FolderOpen, BookOpen, Pencil, Search } from 'lucide-react'
import { cgtProjectApi, type CgtProjectWithNotebooks } from '../../api/cgt'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { ApiError } from '../../api/client'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const PROCESS_OPTIONS = ['Molecular Biology', 'Plasmid', 'AAV', 'ADC Synthesis']

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green',
  ON_HOLD: 'orange', 'On Hold': 'orange',
  COMPLETED: 'blue', Completed: 'blue',
  CANCELLED: 'red', Cancelled: 'red',
  ARCHIVED: 'default',
}

// ── KPI card — matches ADC's AdcPdHodDashboard style ──────────────────────────
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

// Dashboard for the CGT HOD — mirrors AdcPdHodDashboard.tsx: KPI toggle
// between "Project Received" (all CGT projects) and "Notebook Created"
// (projects that already have a notebook), with an edit-project modal.
export default function CgtHodDashboard() {
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const screens    = useBreakpoint()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [editTarget, setEditTarget] = useState<CgtProjectWithNotebooks | null>(null)
  const [editForm] = Form.useForm()

  const [activeView, setActiveView] = useState<'all' | 'with_notebooks'>('all')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<string | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>(undefined)

  // Reset to page 1 whenever the toggle, search term, or sort changes.
  useEffect(() => { setPage(1) }, [activeView, searchTerm, sortField, sortOrder])

  // Cheap aggregate counts for the KPI cards — independent of the paginated
  // table below, so switching pages/sorting doesn't reset them.
  const { data: statsData } = useQuery({
    queryKey: ['cgt-hod-dashboard-stats'],
    queryFn:  cgtProjectApi.hodDashboardStats,
  })
  const stats = statsData ?? { total: 0, with_notebooks: 0, without_notebooks: 0, completed: 0 }

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-hod-projects', page, pageSize, searchTerm, sortField, sortOrder, activeView],
    queryFn:  () => cgtProjectApi.list({
      page,
      limit: pageSize,
      search: searchTerm || undefined,
      sortBy: sortField,
      sortDir: sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined,
      has_notebook: activeView === 'with_notebooks' ? true : undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const projects = data?.items ?? []
  const total = data?.total ?? 0

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<CgtProjectWithNotebooks> | SorterResult<CgtProjectWithNotebooks>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortField(s?.field ? String(s.field) : undefined)
    setSortOrder(s?.order ?? undefined)
  }

  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      cgtProjectApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-hod-projects'] })
      qc.invalidateQueries({ queryKey: ['cgt-hod-dashboard-stats'] })
      msg.success('Project updated.')
      setEditTarget(null)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update project'),
  })

  const openEdit = (p: CgtProjectWithNotebooks) => {
    setEditTarget(p)
    editForm.setFieldsValue({
      name:                p.name,
      product_name:        p.product_name,
      in_house_project_id: p.in_house_project_id,
      project_type:        p.project_type,
      market:              p.market,
      process:             p.process,
      status:              p.status,
      start_date:          p.start_date  ? dayjs(p.start_date)  : null,
      target_date:         p.target_date ? dayjs(p.target_date) : null,
      description:         p.description,
      objective:           p.objective,
    })
  }

  const columns: ColumnsType<CgtProjectWithNotebooks> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Project Name', dataIndex: 'name', key: 'name', width: 200,
      sorter: true,
      render: (v: string, row) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Process', dataIndex: 'process', key: 'process', width: 150,
      sorter: true,
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
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Start Date', dataIndex: 'start_date', key: 'start_date', width: 130,
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
        : <EmptyValue />,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: CgtProjectWithNotebooks) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit project">
            <button
              onClick={() => openEdit(row)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-400 hover:text-violet-600 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ]

  const withNotebooksColumns: ColumnsType<CgtProjectWithNotebooks> = [
    columns[0], // Code
    columns[1], // Project Name
    columns[2], // Process
    columns[3], // Status
    {
      title: 'Notebooks', key: 'notebooks', width: 220,
      render: (_: unknown, row: CgtProjectWithNotebooks) => {
        if (!row.notebooks.length) {
          return <span className="text-[13px] text-amber-500 italic">Not created</span>
        }
        const [first, ...rest] = row.notebooks
        return (
          <div className="flex items-center gap-1">
            <Tooltip title={first.title}>
              <span className="text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                {first.code}
              </span>
            </Tooltip>
            {rest.length > 0 && (
              <Tooltip title={rest.map(nb => nb.code).join(', ')}>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 cursor-default">
                  +{rest.length}
                </span>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    columns[4], // Created By
    columns[5], // Start Date
    columns[6], // Actions
  ]

  return (
    <div className="p-6 space-y-6">
      {ctx}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          icon={FolderOpen} label="Project Received" value={stats.total}
          bg="bg-violet-100" iconColor="text-violet-600"
          onClick={() => setActiveView('all')}
          active={activeView === 'all'}
        />
        <KpiCard
          icon={BookOpen} label="Notebook Created" value={stats.with_notebooks}
          bg="bg-emerald-100" iconColor="text-emerald-600"
          onClick={() => setActiveView('with_notebooks')}
          active={activeView === 'with_notebooks'}
        />
      </div>

      {/* Table section — toggles between Project Received and Notebook Created */}
      <div className="space-y-3">
        <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          {activeView === 'all' ? (
            <>
              <FolderOpen size={15} className="text-violet-500 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 shrink-0">Project Received</span>
            </>
          ) : (
            <>
              <BookOpen size={15} className="text-emerald-500 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebook Created</span>
            </>
          )}
          <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
            {total}
          </span>
          <Input
            prefix={<Search size={13} className="text-slate-400" />}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search projects…"
            style={{ width: 240 }}
            allowClear
          />
        </div>
        <div className="glass-card rounded-lg overflow-hidden">
          <Table
            dataSource={projects}
            columns={withNotebooksColumns}
            rowKey="id"
            loading={isLoading}
            size={screens.md ? 'middle' : 'small'}
            scroll={{ x: 'max-content' }}
            onChange={handleTableChange}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              size: 'small',
              showTotal: (t) => `${t} projects`,
              onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            }}
            locale={{ emptyText: activeView === 'all' ? 'No projects found.' : 'No projects have a notebook created yet.' }}
          />
        </div>
      </div>

      {/* Edit project modal */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.code}` : 'Edit Project'}
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editMut.isPending}
        width={640}
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
            editMut.mutate({
              id: editTarget.id,
              body: {
                ...vals,
                start_date:  vals.start_date  ? dayjs(vals.start_date).format('YYYY-MM-DD')  : null,
                target_date: vals.target_date ? dayjs(vals.target_date).format('YYYY-MM-DD') : null,
              },
            })
          }}
        >
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Project Name"
              name="name"
              className="col-span-2"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input />
            </Form.Item>
          </div>

          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item label="Product Name" name="product_name">
              <Input />
            </Form.Item>
            <Form.Item label="In House Project ID" name="in_house_project_id">
              <Input />
            </Form.Item>
            <Form.Item label="Type" name="project_type">
              <Select
                options={[
                  { value: 'External', label: 'External' },
                  { value: 'Internal', label: 'Internal' },
                ]}
                allowClear
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Market / Customer" name="market">
              <Input />
            </Form.Item>
            <Form.Item label="Process" name="process">
              <Select options={PROCESS_OPTIONS.map(p => ({ value: p, label: p }))} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Status" name="status">
              <Select
                options={[
                  { value: 'ACTIVE',    label: 'Active' },
                  { value: 'ON_HOLD',   label: 'On Hold' },
                  { value: 'COMPLETED', label: 'Completed' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          <Form.Item label="Target Date" name="target_date">
            <DatePicker className="w-full" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item label="Objective" name="objective">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
