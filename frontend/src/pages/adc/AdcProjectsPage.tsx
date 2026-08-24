import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, DatePicker, Table, Grid, message } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Search } from 'lucide-react'

const { useBreakpoint } = Grid
import { projectApi, type Project } from '../../api/adc'
import { adminApi } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useCan } from '../../hooks/usePrivilege'
import { StatusTag } from '../../components/ui/StatusTag'
import { EmptyValue } from '../../components/ui/EmptyValue'
import AdcPdHodDashboard from './AdcPdHodDashboard'
import AdcPdTlDashboard from './AdcPdTlDashboard'
import dayjs from 'dayjs'

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

  const screens   = useBreakpoint()
  const canCreate = useCan('adc.project.create')
  // Without view_all a user only sees projects they're assigned to.
  const canViewAllProjects = useCan('adc.project.view_all')
  // Landing dashboard: hod takes precedence over tl so holding both is deterministic.
  const canHodDashboard = useCan('adc.dashboard.hod')
  const canTlDashboard  = useCan('adc.dashboard.tl')

  if (canHodDashboard) {
    return <AdcPdHodDashboard />
  }
  // TL dashboard shows notebooks/experiments rather than the plain project list.
  if (canTlDashboard) {
    return <AdcPdTlDashboard />
  }

  const [searchInput, setSearchInput] = useState('')
  const [search,      setSearch]      = useState('')
  const [modalOpen, setModal]   = useState(false)
  const [nextCode,  setNextCode] = useState('')
  const [form] = Form.useForm()

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])
  useEffect(() => { setPage(1) }, [search])

  const openCreate = () => {
    form.resetFields()
    setModal(true)
    setNextCode('')
    projectApi.nextCode().then(r => setNextCode(r.code)).catch(() => setNextCode(''))
  }

  const { data, isLoading } = useQuery({
    queryKey: ['adc-projects', canViewAllProjects, page, pageSize, search, sortBy, sortDir],
    queryFn:  () => projectApi.list({
      assigned_only: canViewAllProjects ? undefined : true,
      page,
      limit: pageSize,
      search: search || undefined,
      sort_by: sortBy ?? undefined,
      sort_dir: sortDir,
    }),
  })

  const projects = data?.items ?? []
  const total = data?.total ?? 0

  // ADC PD HOD users — for the Project Lead picker in the create modal.
  const { data: adcPdHodUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-hod'],
    queryFn: async () => {
      const res = await adminApi.listUsers({ is_active: true, page_size: 100 })
      return (res.items ?? []).filter(
        u => u.role_code === 'HOD' && u.department_name === 'ADC PD'
      )
    },
    enabled: canCreate,
    staleTime: 5 * 60 * 1000,
  })

  const createMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => projectApi.create(vals),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['adc-projects'] })
      setModal(false)
      form.resetFields()
      message.success(`Project ${project.code} created successfully.`)
    },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to create project.'),
  })

  const columns = [
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
      render: (v: string, row: Project) => (
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
      title: 'Customer / Market', dataIndex: 'market', key: 'market', width: 130,
      sorter: true,
      render: (v: string, row: Project) => {
        const val = v || row.customer
        return val
          ? <span className="text-[13px] text-slate-800">{val}</span>
          : <EmptyValue />
      },
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 130,
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Created Dt', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center' as const,
      sorter: true,
      render: (v: string) => (
        <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search…"
          style={{ width: 240 }}
          allowClear
        />
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={openCreate}
            className="rounded-md font-medium"
          >
            New Project
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} projects`,
            size: 'small',
          }}
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
          locale={{ emptyText: 'No projects found.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title="New Project"
        open={modalOpen}
        onCancel={() => { setModal(false); form.resetFields(); setNextCode('') }}
        onOk={() => form.submit()}
        okText="Create Project"
        confirmLoading={createMut.isPending}
        width={680}
        centered
        destroyOnHidden
        closable={false}
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
            <Form.Item label="Project Code (auto-generated)">
              <Input value={nextCode || 'Generating…'} disabled />
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

          {/* Row 4: Project Lead */}
          <Form.Item
            label="Project Lead (ADC PD)"
            name="manager_id"
            rules={[{ required: true, message: 'Please select a project lead' }]}
          >
            <Select
              placeholder="Select ADC PD project lead"
              options={adcPdHodUsers.map(u => ({
                value: u.id,
                label: u.username,
              }))}
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {/* Row 5: Start + Target */}
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item label="Target Date" name="target_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>

          {/* Row 6: Description */}
          <Form.Item label="Description" name="description">
            <Input.TextArea
              rows={2}
              placeholder="Optional project description"
            />
          </Form.Item>

          {/* Row 7: Objective */}
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
