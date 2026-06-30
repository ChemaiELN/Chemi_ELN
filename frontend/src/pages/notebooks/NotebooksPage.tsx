import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Table, Tag, Modal, Form, Select, message, Grid } from 'antd'

const { useBreakpoint } = Grid
import { Plus, Search, Eye, Download } from 'lucide-react'
import dayjs from 'dayjs'
import { notebookApi, projectApi, workflowTemplateApi, type Notebook } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const CHEMIST_ROLE = 'CHEM'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', CLOSED: 'purple',
}

export default function NotebooksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const screens   = useBreakpoint()
  const user      = useAppSelector(selectUser)
  const isChemist = user?.role_code === CHEMIST_ROLE

  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [modal, setModal]     = useState(false)
  const [form] = Form.useForm()
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['notebooks-all', search, page, isChemist],
    queryFn:  () => notebookApi.listAll({
      search:         search || undefined,
      assigned_to_me: isChemist || undefined,
      page,
      limit: 10,
    }),
  })

  const { data: projectsData } = useQuery({
    queryKey: ['projects-list-modal'],
    queryFn:  () => projectApi.list({ limit: 200 }),
    enabled:  modal,
  })
  const projects = projectsData?.items ?? []

  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn:  () => workflowTemplateApi.list({ is_active: true }),
    staleTime: 5 * 60 * 1000,
    enabled: modal,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  const createNb = useMutation({
    mutationFn: (vals: Record<string, unknown>) => {
      const { project_id, ...rest } = vals
      return notebookApi.create(project_id as string, rest)
    },
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['notebooks-all'] })
      setModal(false)
      form.resetFields()
      setSelectedProject(null)
      message.success('Notebook created')
      navigate(`/notebooks/${nb.id}/overview`)
    },
    onError: () => message.error('Failed to create notebook'),
  })

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => (
        <span className="font-mono text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Notebook Name',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="text-[13px] font-medium text-teal-600 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project',
      width: 120,
      render: (v: string) => v
        ? <span className="text-[13px] font-medium text-teal-600">{v}</span>
        : <span className="text-slate-300 text-[13px]">—</span>,
    },
    {
      title: 'Created By',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 130,
      render: (v: string) => <span className="text-[13px] text-slate-600">{v || '—'}</span>,
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (v: string) => (
        <span className="text-[13px] text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 44,
      render: (_: unknown, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-800">Notebooks</h1>
          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">
            {data?.total ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            prefix={<Search size={13} className="text-slate-400" />}
            placeholder="Search notebooks..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-52"
            allowClear
          />
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModal(true)}
          >
            New Notebook
          </Button>
          <Button icon={<Download size={14} />}>Export</Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: 10,
            total: data?.total ?? 0,
            onChange: setPage,
            showTotal: (t) => `${t} notebooks`,
            showSizeChanger: false,
            size: 'small',
          }}
          locale={{ emptyText: 'No notebooks found.' }}
        />
      </div>

      {/* New Notebook Modal */}
      <Modal
        title="New Notebook"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields(); setSelectedProject(null) }}
        onOk={() => form.submit()}
        okText="Create"
        confirmLoading={createNb.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={vals => createNb.mutate(vals)}
          className="mt-3"
        >
          <Form.Item label="Project" name="project_id" rules={[{ required: true, message: 'Select a project' }]}>
            <Select
              placeholder="Select project"
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onChange={v => setSelectedProject(v)}
              options={projects.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Form.Item>

          <Form.Item label="Notebook Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Study NB-001" />
          </Form.Item>

          <Form.Item
            label="Experiment Template"
            name="template_id"
            extra={selectedProject
              ? 'Scientists will follow this template\'s screens when recording experiments.'
              : undefined}
          >
            <Select
              placeholder={selectedProject ? 'Select a workflow template' : 'Select a project first'}
              disabled={!selectedProject}
              showSearch
              allowClear
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={templates.map(t => ({
                value: t.id,
                label: `${t.name} (v${t.version})`,
              }))}
            />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
