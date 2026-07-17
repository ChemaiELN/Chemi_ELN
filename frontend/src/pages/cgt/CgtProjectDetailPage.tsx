import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Form, Input, Select, Tag, Table } from 'antd'
import { ArrowLeft, Plus, ChevronRight, FolderOpen } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtProjectApi, cgtNotebookApi, PROCESS_TO_TEMPLATE_CATEGORY, type CgtNotebook } from '../../api/cgt'
import { workflowTemplateApi } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const NB_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'blue', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red', ARCHIVED: 'default',
}

// Only HOD/Team Lead can create CGT notebooks — a chemist/analyst who
// created one themselves would otherwise immediately lose access to it
// (assert_cgt_notebook_access blocks anyone not yet explicitly assigned).
const CAN_CREATE_NOTEBOOK = ['HOD', 'TL']

// Project detail page for the CGT module — mirrors AdcProjectDetailPage's
// notebook list + "Create Notebook" pattern, but the template picker is
// filtered by the category mapped from this project's `process` (Molecular
// Biology / Plasmid / AAV), instead of ADC's hardcoded single-slug filter.
export default function CgtProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const canCreateNotebook = CAN_CREATE_NOTEBOOK.includes(user?.role_code ?? '')

  const [nbModal, setNbModal] = useState(false)
  const [nbForm] = Form.useForm()

  const { data: project, isLoading: loadingProject } = useQuery({
    queryKey: ['cgt-project', projectId],
    queryFn: () => cgtProjectApi.get(projectId!),
    enabled: !!projectId,
  })

  const { data: notebooks = [], isLoading: loadingNb } = useQuery({
    queryKey: ['cgt-notebooks', projectId],
    queryFn: () => cgtNotebookApi.listForProject(projectId!),
    enabled: !!projectId,
  })

  const templateCategory = project?.process ? PROCESS_TO_TEMPLATE_CATEGORY[project.process] : undefined

  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates', templateCategory],
    queryFn: () => workflowTemplateApi.list({ category: templateCategory, is_active: true }),
    enabled: !!templateCategory,
    staleTime: 5 * 60 * 1000,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  const createNb = useMutation({
    mutationFn: (vals: Record<string, unknown>) => cgtNotebookApi.create(projectId!, vals),
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['cgt-notebooks', projectId] })
      setNbModal(false)
      nbForm.resetFields()
      navigate(`/cgt/projects/${projectId}/notebooks/${nb.id}`)
    },
  })

  const nbColumns = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 140,
      render: (v: string) => <span className="  text-xs font-semibold text-slate-700">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title',
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${row.id}`)}
          className="text-sm font-medium text-violet-600 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Template', dataIndex: 'template_name', key: 'template_name', width: 220,
      render: (v: string) => v
        ? <span className="text-xs text-slate-600">{v}</span>
        : <span className="text-slate-300 text-xs">—</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={NB_STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (v: string) => <span className="text-xs text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: '', key: 'action', width: 44,
      render: (_: unknown, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${row.id}`)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Breadcrumb */}
      {/* <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/cgt/projects')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => navigate('/cgt/projects')}>
          CGT Projects
        </span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-700">{project?.name ?? '…'}</span>
      </div> */}

      {/* Header */}
      {/* <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
          <FolderOpen size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800 truncate">{project?.name ?? (loadingProject ? 'Loading…' : 'Project')}</h1>
          <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
            <span className="  text-xs">{project?.code}</span>
            {project?.process && <Tag color="purple">{project.process}</Tag>}
          </p>
        </div>
        {canCreateNotebook && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setNbModal(true)}
            disabled={!templateCategory}
            title={!templateCategory ? 'This project has no process set — cannot pick a template category' : undefined}
          >
            New Notebook
          </Button>
        )}
      </div> */}

      {/* Notebooks table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Notebooks</h2>
          {/* <span className="text-xs text-slate-400">{notebooks.length} notebook{notebooks.length !== 1 ? 's' : ''}</span>  */}
           {canCreateNotebook && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setNbModal(true)}
            disabled={!templateCategory}
            title={!templateCategory ? 'This project has no process set — cannot pick a template category' : undefined}
          >
            New Notebook
          </Button>
        )}
        </div>
        
        <Table
          dataSource={notebooks}
          columns={nbColumns}
          rowKey="id"
          loading={loadingNb}
          size="small"
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          locale={{ emptyText: 'No notebooks yet.' }}
        />
      </div>

      {/* Create Notebook Modal */}
      <Modal
        title="Create Notebook"
        open={nbModal}
        onCancel={() => { setNbModal(false); nbForm.resetFields() }}
        onOk={() => nbForm.submit()}
        okText="Create"
        confirmLoading={createNb.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={nbForm} layout="vertical" onFinish={vals => createNb.mutate(vals)} className="mt-3">
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. AAV USP Run 1" />
          </Form.Item>
          <Form.Item
            label="Template"
            name="template_id"
            rules={[{ required: true }]}
            help={project?.process ? `Filtered to ${project.process} templates` : undefined}
          >
            <Select
              placeholder="Select a workflow template"
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={templates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
              notFoundContent={!templateCategory ? 'Set this project\'s process to see templates' : 'No templates found'}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
