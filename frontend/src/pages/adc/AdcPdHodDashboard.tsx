import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Form, Input, Select, DatePicker, Table, Tooltip, Grid, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { FolderOpen, BookOpen, Pencil, Search } from 'lucide-react'
import { projectApi, type Project } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { EmptyValue } from '../../components/ui/EmptyValue'
import dayjs from 'dayjs'

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green',
  ON_HOLD: 'orange', 'On Hold': 'orange',
  COMPLETED: 'blue', Completed: 'blue',
  CANCELLED: 'red', Cancelled: 'red',
  ARCHIVED: 'default',
}

// ── KPI card — matches inventory dashboard style ──────────────────────────────
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
export default function AdcPdHodDashboard() {
  const navigate   = useNavigate()
  const qc         = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const screens    = useBreakpoint()

  // Search + debounce
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  // Edit modal
  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [editForm] = Form.useForm()

  // Active KPI view toggle
  const [activeView, setActiveView] = useState<'all' | 'with_notebooks'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setPage(1) }, [searchTerm, activeView])

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats = { total: 0, with_notebooks: 0, without_notebooks: 0, completed: 0 } } = useQuery({
    queryKey: ['adc-hod-stats'],
    queryFn:  projectApi.hodStats,
  })

  // department_code scopes this to "every ADC_PD project" (the HOD view),
  // not "projects I'm personally assigned to" — see projects.routes.ts.
  const { data, isLoading } = useQuery({
    queryKey: ['adc-hod-projects', page, pageSize, searchTerm, activeView, sortBy, sortDir],
    queryFn:  () => projectApi.list({
      department_code: 'ADC_PD',
      page, limit: pageSize, search: searchTerm || undefined,
      has_notebooks: activeView === 'with_notebooks' ? true : undefined,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const projects = data?.items ?? []
  const total = data?.total ?? 0

  // ── Mutations ──────────────────────────────────────────────────────────────
  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      projectApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-hod-projects'] })
      qc.invalidateQueries({ queryKey: ['adc-hod-stats'] })
      msg.success('Project updated.')
      setEditTarget(null)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update project'),
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openEdit = (p: Project) => {
    setEditTarget(p)
    editForm.setFieldsValue({
      name:                p.name,
      product_name:        p.product_name,
      in_house_project_id: p.in_house_project_id,
      project_type:        p.project_type,
      market:              p.market,
      status:              p.status,
      start_date:          p.start_date  ? dayjs(p.start_date)  : null,
      target_date:         p.target_date ? dayjs(p.target_date) : null,
      description:         p.description,
      objective:           p.objective,
    })
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnsType<Project> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Project Name', dataIndex: 'name', key: 'name', width: 200,
      sorter: true,
      render: (v: string, row) => (
        <button
          onClick={() => navigate(`/adc/projects/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Type', dataIndex: 'project_type', key: 'project_type', width: 130,
      sorter: true,
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
      title: 'Notebooks', dataIndex: 'notebook_count', key: 'notebook_count', width: 140, align: 'center' as const,
      render: (v: number | undefined) => !v
        ? <span className="text-[13px] text-amber-500 italic">Not created</span>
        : <span className="text-[12px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">{v} Notebook{v === 1 ? '' : 's'}</span>,
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 130,
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Start Date', dataIndex: 'start_date', key: 'start_date', width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
        : <EmptyValue />,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center' as const,
      render: (_: unknown, row: Project) => (
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

  const viewLabel = activeView === 'with_notebooks' ? 'Notebook Created' : 'Project Received'

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
        <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
          {activeView === 'all'
            ? <FolderOpen size={15} className="text-violet-500 shrink-0" />
            : <BookOpen size={15} className="text-emerald-500 shrink-0" />}
          <span className="text-[13px] font-semibold text-slate-700 shrink-0">{viewLabel}</span>
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
        <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
          <Table
            dataSource={projects}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size={screens.md ? 'middle' : 'small'}
            scroll={{ x: 'max-content' }}
            pagination={{ current: page, pageSize, total, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} projects` }}
            onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
              if (pagination.current) setPage(pagination.current)
              const s = sorter as SorterResult<Project>
              if (s.order) {
                setSortBy(s.field as string)
                setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
              } else {
                setSortBy(null)
              }
            }}
            locale={{ emptyText: activeView === 'with_notebooks' ? 'No projects have a notebook created yet.' : 'No projects found.' }}
          />
        </div>
      </div>

      {/* ── Edit project modal ────────────────────────────────────────────────── */}
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
        closable={false}
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
          </div>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item label="Target Date" name="target_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

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
