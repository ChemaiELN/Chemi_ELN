import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, DatePicker, Table, Tag, message, Grid } from 'antd'
import type { TableProps } from 'antd'
import { Plus, FolderOpen, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtProjectApi, type CgtProject } from '../../api/cgt'
import { userApi } from '../../api/adc'
import { templateSettingsApi } from '../../api/templateSettings'
import { glassModalProps } from '../../utils/modalStyles'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useCan } from '../../hooks/usePrivilege'
import CgtHodDashboard from './CgtHodDashboard'
import CgtTlDashboard from './CgtTlDashboard'

const { useBreakpoint } = Grid

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  ON_HOLD: 'orange',
  COMPLETED: 'blue',
  CANCELLED: 'red',
  ARCHIVED: 'default',
}

// Default landing page for the CGT module. Mirrors AdcProjectsPage's page
// header + filter bar + table + create-project modal, with the Department
// field removed and replaced by a Process dropdown (Molecular Biology /
// Plasmid / AAV — the CGT modalities).
export default function CgtProjectsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const user = useAppSelector(selectUser)
  // Governed by the cgt.project.create department-role privilege (Admin →
  // Department Role Privileges). SUPER_ADMIN bypasses via useCan.
  const canCreate = useCan('cgt.project.create')

  // CGT HOD/TL get a dashboard instead of the plain project table — mirrors
  // AdcProjectsPage's role+department branch (AdcPdHodDashboard/AdcPdTlDashboard).
  if (user?.role_code === 'HOD' && user?.department_code === 'CGT') {
    return <CgtHodDashboard />
  }
  if (user?.role_code === 'TL' && user?.department_code === 'CGT') {
    return <CgtTlDashboard />
  }

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<string | undefined>(undefined)
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | undefined>(undefined)

  // Reset to page 1 whenever the search term or sort changes.
  useEffect(() => { setPage(1) }, [search, sortField, sortOrder])

  const [modalOpen, setModal] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [form] = Form.useForm()

  const openCreate = () => {
    form.resetFields()
    setModal(true)
    setNextCode('')
    cgtProjectApi.nextCode().then(r => setNextCode(r.code)).catch(() => setNextCode(''))
  }

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-projects', page, pageSize, search, sortField, sortOrder],
    queryFn: () => cgtProjectApi.list({
      page,
      limit: pageSize,
      search: search || undefined,
      sortBy: sortField,
      sortDir: sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined,
    }),
    placeholderData: (prev) => prev,
  })

  // CGT HOD users — for the Project Lead picker in the create modal. Lets a
  // QA user (or any creator) assign the project to the CGT HOD who'll own it.
  const { data: cgtHodUsers = [] } = useQuery({
    queryKey: ['users-cgt-hod'],
    queryFn: () => userApi.list({ role_code: 'HOD', dept_code: 'CGT' }).then(r => r.items),
    enabled: canCreate,
    staleTime: 5 * 60 * 1000,
  })

  // Admin-curated Process options (Admin → Template Settings → CGT Template
  // Settings), replacing the old hardcoded PROCESS_OPTIONS list.
  const { data: cgtProcesses = [] } = useQuery({
    queryKey: ['template-settings-cgt-processes-active'],
    queryFn: () => templateSettingsApi.listCgtProcesses({ is_active: true }),
    enabled: canCreate,
    staleTime: 5 * 60 * 1000,
  })

  const projects = data?.items ?? []
  const total = data?.total ?? 0

  const createMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => cgtProjectApi.create(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-projects'] })
      setModal(false)
      form.resetFields()
      message.success('CGT project created')
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : 'Failed to create project')
    },
  })

  const handleTableChange: TableProps<CgtProject>['onChange'] = (_pagination, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortField(s?.field ? String(s.field) : undefined)
    setSortOrder(s?.order ?? undefined)
  }

  const columns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 120, sorter: true,
      render: (v: string) => <span className=" text-[13px] font-semibold text-slate-700">{v}</span>,
    },
    {
      title: 'Project Name', dataIndex: 'name', key: 'name', sorter: true,
      render: (v: string) => <span className="text-[13px] font-medium text-slate-700">{v}</span>,
    },
    {
      title: 'Type', dataIndex: 'project_type', key: 'project_type', width: 100, sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Process', dataIndex: 'process', key: 'process', width: 160, sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Market / Customer', dataIndex: 'market', key: 'market', width: 160, sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Created By', dataIndex: 'created_by_name', key: 'created_by_name', width: 140,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 120, sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100, sorter: true,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
  ]

  return (
    <div className="p-6">
      {/* Page header */}
      {/* <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <FolderOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">CGT Projects</h1>
            <p className="text-xs text-slate-400">{total} project{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent w-64"
          />
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={openCreate}
            className="font-bold rounded-md"
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
          onRow={record => ({
            onClick: () => navigate(`/cgt/projects/${record.id}`),
            className: 'cursor-pointer',
          })}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `${t} projects`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          locale={{ emptyText: 'No CGT projects found.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title="New CGT Project"
        open={modalOpen}
        onCancel={() => { setModal(false); form.resetFields(); setNextCode('') }}
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
          onFinish={(vals: Record<string, unknown>) => {
            const body = {
              ...vals,
              start_date: vals.start_date ? dayjs(vals.start_date as never).format('YYYY-MM-DD') : undefined,
              target_date: vals.target_date ? dayjs(vals.target_date as never).format('YYYY-MM-DD') : undefined,
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
              <Input placeholder="e.g. CAR-T Cell Therapy Development" />
            </Form.Item>
          </div>

          {/* Row 2: Product Name + In House ID + Type */}
          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item label="Product Name" name="product_name">
              <Input placeholder="e.g. CAR-T" />
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

          {/* Row 3: Market / Customer + Project Lead */}
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="Market / Customer" name="market">
              <Input placeholder="e.g. Regulated Markets" />
            </Form.Item>
            <Form.Item
              label="Project Lead (CGT)"
              name="manager_id"
              rules={[{ required: true, message: 'Please select a project lead' }]}
            >
              <Select
                placeholder="Select CGT project lead"
                options={cgtHodUsers.map(u => ({ value: u.id, label: u.username }))}
                showSearch
                filterOption={(input, opt) =>
                  String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </div>

          {/* Row 4: Process + Start + Target (Process replaces Department for CGT) */}
          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item
              label="Process"
              name="process"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                placeholder="Select process"
                options={cgtProcesses.map(p => ({ value: p.name, label: p.name }))}
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
