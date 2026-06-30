import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, DatePicker, Table, Tag, Tooltip, Grid } from 'antd'
import { Plus, FolderOpen, ChevronRight, Search } from 'lucide-react'

const { useBreakpoint } = Grid
import { projectApi, departmentApi, type Project } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import dayjs from 'dayjs'

// Role codes — update if your DB uses different codes
const CAN_CREATE_PROJECT = ['HOD', 'QA']
const TL_ROLE = 'TL'

const TYPE_COLOR: Record<string, string> = {
  External: 'red',
  Internal: 'cyan',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green',
  ON_HOLD: 'orange', 'On Hold': 'orange',
  COMPLETED: 'blue', Completed: 'blue',
  CANCELLED: 'red', Cancelled: 'red',
  ARCHIVED: 'default',
}

export default function AdcProjectsPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const user     = useAppSelector(selectUser)

  const screens         = useBreakpoint()
  const canCreate       = CAN_CREATE_PROJECT.includes(user?.role_code ?? '')
  const isTL            = user?.role_code === TL_ROLE

  const [search,    setSearch]  = useState('')
  const [typeFilter, setType]   = useState<string | undefined>()
  const [modalOpen, setModal]   = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['adc-projects', search, typeFilter, isTL],
    queryFn:  () => projectApi.list({
      search:        search     || undefined,
      project_type:  typeFilter || undefined,
      assigned_only: isTL ? true : undefined,
      limit: 200,
    }),
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn:  departmentApi.list,
    staleTime: 5 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => projectApi.create(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-projects'] })
      setModal(false)
      form.resetFields()
    },
  })

  const projects = data?.items ?? []
  const total    = data?.total ?? 0

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 120,
      render: (v: string) => (
        <span className="font-mono text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Project Name', dataIndex: 'name', key: 'name',
      render: (v: string, row: Project) => (
        <button
          onClick={() => navigate(`/adc/projects/${row.id}`)}
          className="text-[13px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Type', dataIndex: 'project_type', key: 'project_type', width: 110,
      render: (v: string) => v
        ? <Tag color={TYPE_COLOR[v] ?? 'default'}>{v}</Tag>
        : <span className="text-slate-300 text-[13px]">—</span>,
    },
    {
      title: 'Customer / Market', dataIndex: 'market', key: 'market', width: 180,
      render: (v: string, row: Project) => {
        const val = v || row.customer
        return val
          ? <span className="text-[13px] text-slate-600">{val}</span>
          : <span className="text-slate-300 text-[13px]">—</span>
      },
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 140,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-slate-300 text-[13px]">—</span>,
    },
    {
      title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (v: string) => (
        <span className="text-[13px] text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>
      ),
    },
    {
      title: '', key: 'action', width: 44,
      render: (_: unknown, row: Project) => (
        <Tooltip title="View project">
          <button
            onClick={() => navigate(`/adc/projects/${row.id}`)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <FolderOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Projects</h1>
            <p className="text-xs text-slate-400">{total} project{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Select
          value={typeFilter}
          onChange={v => setType(v)}
          placeholder="All types"
          allowClear
          style={{ width: 140 }}
          options={[
            { value: 'External', label: 'External' },
            { value: 'Internal', label: 'Internal' },
          ]}
        />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Project name..."
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent w-64"
          />
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={() => setModal(true)}
            className="text-white font-bold rounded-md"
          >
            New Project
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (t) => `${t} projects`,
            size: 'small',
          }}
          locale={{ emptyText: 'No projects found.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title="New Project"
        open={modalOpen}
        onCancel={() => { setModal(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Create Project"
        confirmLoading={createMut.isPending}
        width={680}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={vals => {
            const body = {
              ...vals,
              start_date:  vals.start_date  ? dayjs(vals.start_date).format('YYYY-MM-DD')  : undefined,
              target_date: vals.target_date ? dayjs(vals.target_date).format('YYYY-MM-DD') : undefined,
            }
            createMut.mutate(body)
          }}
          className="mt-3"
        >
          {/* Row 1: Code + Name */}
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Project Code"
              name="code"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input placeholder="e.g. OQ-001" />
            </Form.Item>
            <Form.Item
              label="Project Name"
              name="name"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input placeholder="e.g. Omeprazole API Development" />
            </Form.Item>
          </div>

          {/* Row 2: Product Name + In House ID + Type */}
          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item label="Product Name" name="product_name">
              <Input placeholder="e.g. Omeprazole" />
            </Form.Item>
            <Form.Item label="In House Project ID" name="in_house_project_id">
              <Input placeholder="e.g. IH-2026-001" />
            </Form.Item>
            <Form.Item label="Type" name="project_type">
              <Select
                placeholder="Select type"
                options={[
                  { value: 'External', label: 'External' },
                  { value: 'Internal', label: 'Internal' },
                ]}
                allowClear
              />
            </Form.Item>
          </div>

          {/* Row 3: Market / Customer */}
          <Form.Item label="Market / Customer" name="market">
            <Input placeholder="e.g. Regulated Markets" />
          </Form.Item>

          {/* Row 4: Department + Start + Target */}
          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item label="Department" name="department_id">
              <Select
                placeholder="Select department"
                options={(departments as { id: string; name: string }[]).map(d => ({
                  value: d.id,
                  label: d.name,
                }))}
                allowClear
                showSearch
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item label="Target Date" name="target_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          {/* Row 5: Description */}
          <Form.Item label="Description" name="description">
            <Input.TextArea
              rows={2}
              placeholder="Optional project description"
            />
          </Form.Item>

          {/* Row 6: Objective */}
          <Form.Item label="Objective" name="objective">
            <Input.TextArea
              rows={3}
              placeholder="Describe the project objective..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
