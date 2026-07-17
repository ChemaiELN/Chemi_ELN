import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Table, Tag, Modal, Form, Input, Select, message, Grid } from 'antd'

const { useBreakpoint } = Grid
import { Plus, Search, BookOpen, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { notebookApi, projectApi, workflowTemplateApi, type Notebook } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

// Chemists/Analysts only ever see notebooks assigned to them — the backend
// enforces this regardless, but request the filtered view directly so the
// UI never shows (then hides) notebooks the user can't actually open.
const ASSIGNMENT_RESTRICTED_ROLES = ['CHEM', 'ANALYST']

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', CLOSED: 'purple',
}

export default function NotebooksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const screens   = useBreakpoint()
  const user      = useAppSelector(selectUser)
  const isAssignmentRestricted = ASSIGNMENT_RESTRICTED_ROLES.includes(user?.role_code ?? '')

  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['notebooks-all', isAssignmentRestricted],
    queryFn:  () => notebookApi.listAll({
      assigned_to_me: isAssignmentRestricted || undefined,
      limit: 200,
    }),
  })

  const allNotebooks = data?.items ?? []
  const q = search.trim().toLowerCase()
  const notebooks = q
    ? allNotebooks.filter(nb =>
        [nb.code, nb.title, nb.project_code, nb.created_by_name, nb.status]
          .some(v => v && String(v).toLowerCase().includes(q))
      )
    : allNotebooks

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
  const synthesisV2Template = templates.find(t => t.slug === 'adc-synthesis-v2')

  // Every notebook follows the ADC Synthesis v2 workflow — auto-select it and lock the field.
  useEffect(() => {
    if (synthesisV2Template) form.setFieldValue('template_id', synthesisV2Template.id)
  }, [synthesisV2Template, form])

  const createNb = useMutation({
    mutationFn: (vals: Record<string, unknown>) => {
      const { project_id, ...rest } = vals
      return notebookApi.create(project_id as string, rest)
    },
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['notebooks-all'] })
      setModal(false)
      form.resetFields()
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
        <span className="  text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Notebook Name',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="text-[13px] font-medium text-slate-700 hover:text-slate-900 hover:underline text-left"
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
        ? <span className="text-[13px] text-slate-600">{v}</span>
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
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 44,
      render: (_: unknown, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Page header */}
      {/* <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Notebooks</h1>
            <p className="text-xs text-slate-400">{notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div> */}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent w-64"
          />
        </div>
        {!isAssignmentRestricted && (
          <Button
            icon={<Plus size={14} />}
            onClick={() => setModal(true)}
            style={{ backgroundColor: '#6366f1cc', border: 'none', color: '#fff' }}
            className="font-semibold rounded-md"
          >
            New Notebook
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={notebooks}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (t) => `${t} notebooks`,
            size: 'small',
          }}
          locale={{ emptyText: 'No notebooks found.' }}
        />
      </div>

      {/* New Notebook Modal */}
      <Modal
        title="New Notebook"
        open={modal}
        onCancel={() => { setModal(false); form.resetFields() }}
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
              options={projects.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Form.Item>

          <Form.Item label="Notebook Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Study NB-001" />
          </Form.Item>

          <Form.Item
            label="Experiment Template"
            name="template_id"
            extra="Scientists will follow this template's screens when recording experiments."
          >
            <Select
              disabled
              options={synthesisV2Template ? [{
                value: synthesisV2Template.id,
                label: `${synthesisV2Template.name} (v${synthesisV2Template.version})`,
              }] : []}
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
