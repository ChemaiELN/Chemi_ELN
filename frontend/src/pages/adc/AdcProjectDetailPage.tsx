import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Modal, Form, Input, Select, Tabs,
  Table, Tooltip, message, ConfigProvider,
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import {
  ArrowLeft, Pencil, Search, BookOpen, BookPlus,
} from 'lucide-react'
import dayjs from 'dayjs'
import {
  projectApi, notebookApi, workflowTemplateApi, userApi,
  type Project, type Notebook,
} from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { useCan } from '../../hooks/usePrivilege'
import ProjectInfoTab         from './tabs/ProjectInfoTab'
import ProjectMasterTab       from './tabs/ProjectMasterTab'
import RelatedDocumentsTab    from './tabs/RelatedDocumentsTab'
import RegulatoryTab          from './tabs/RegulatoryTab'
import RiskAssessmentTab      from './tabs/RiskAssessmentTab'
import SchemeTab              from './tabs/SchemeTab'

// ── Status colours ─────────────────────────────────────────────────────────────
const NB_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', Active: 'green',
  DRAFT: 'default', IN_PROGRESS: 'blue', SUBMITTED: 'gold',
  APPROVED: 'green', REJECTED: 'red', CLOSED: 'purple',
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────

function NotebookAssignedTLCell({ notebookId }: { notebookId: string }) {
  const { data: assignedUsers = [] } = useQuery({
    queryKey: ['notebook-assigned-users', notebookId],
    queryFn:  () => notebookApi.getAssignedUsers(notebookId),
  })
  if (!assignedUsers.length) {
    return <span className="text-[13px] text-amber-500 italic">Not assigned</span>
  }
  const shown = assignedUsers.slice(0, 3)
  const extra = assignedUsers.length - shown.length
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

function OverviewTab({ project, projectId }: { project: Project; projectId: string }) {
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const canCreateNotebook = useCan('adc.notebook.create')

  const [nbModal, setNbModal] = useState(false)
  const [nbForm]  = Form.useForm()

  const [editTarget, setEditTarget] = useState<Notebook | null>(null)
  const [editForm]   = Form.useForm()

  // Search + debounce
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const [nbPage, setNbPage] = useState(1)
  const nbPageSize = 10
  const [nbSortBy,  setNbSortBy]  = useState<string | null>(null)
  const [nbSortDir, setNbSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setNbPage(1) }, [searchTerm])

  // Notebooks
  const { data: nbData, isLoading: loadingNb } = useQuery({
    queryKey: ['adc-notebooks', projectId, nbPage, nbPageSize, searchTerm, nbSortBy, nbSortDir],
    queryFn:  () => notebookApi.listForProject(projectId, {
      page: nbPage, limit: nbPageSize, search: searchTerm || undefined,
      sort_by: nbSortBy ?? undefined, sort_dir: nbSortDir,
    }),
  })
  const notebooks = nbData?.items ?? []
  const notebooksTotal = nbData?.total ?? 0

  // Currently assigned TLs for the notebook being edited
  const { data: editAssignedUsers = [] } = useQuery({
    queryKey: ['notebook-assigned-users', editTarget?.id],
    queryFn:  () => notebookApi.getAssignedUsers(editTarget!.id),
    enabled:  !!editTarget,
  })

  // Templates for notebook modal
  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn:  () => workflowTemplateApi.list({ is_active: true }),
    staleTime: 5 * 60 * 1000,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  // Team Leads for the assign-TL picker
  const { data: adcPdTlUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-tl'],
    queryFn: () => userApi.list({ role_code: 'TL', dept_code: 'ADC_PD' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
  })

  // Prefill the edit form once the notebook's currently assigned TLs load
  useEffect(() => {
    if (editTarget) {
      editForm.setFieldsValue({ tl_user_ids: editAssignedUsers.map(u => u.user_id) })
    }
  }, [editAssignedUsers, editTarget, editForm])

  // Mutations
  const createNb = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { tl_user_ids, ...rest } = vals
      const nb = await notebookApi.create(projectId, rest)
      const ids = (tl_user_ids as string[] | undefined) ?? []
      await Promise.all(ids.map(uid => notebookApi.assignUser(nb.id, uid)))
      return nb
    },
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['adc-notebooks', projectId] })
      qc.invalidateQueries({ queryKey: ['notebook-assigned-users', nb.id] })
      setNbModal(false)
      nbForm.resetFields()
    },
  })

  const openEdit = (nb: Notebook) => {
    setEditTarget(nb)
    editForm.setFieldsValue({ title: nb.title, description: nb.description })
  }

  const editMut = useMutation({
    mutationFn: async (vals: { title: string; description?: string; tl_user_ids: string[] }) => {
      if (!editTarget) return
      await notebookApi.update(editTarget.id, { title: vals.title, description: vals.description })
      const previousIds = editAssignedUsers.map(u => u.user_id)
      const toAdd    = vals.tl_user_ids.filter(uid => !previousIds.includes(uid))
      const toRemove = previousIds.filter(uid => !vals.tl_user_ids.includes(uid))
      await Promise.all([
        ...toAdd.map(uid => notebookApi.assignUser(editTarget.id, uid)),
        ...toRemove.map(uid => notebookApi.unassignUser(editTarget.id, uid)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-notebooks', projectId] })
      qc.invalidateQueries({ queryKey: ['notebook-assigned-users', editTarget?.id] })
      message.success('Notebook updated.')
      setEditTarget(null)
      editForm.resetFields()
    },
    onError: () => message.error('Failed to update notebook'),
  })

  const nbColumns: ColumnsType<Notebook> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Title', dataIndex: 'title', key: 'title', width: 220,
      sorter: true,
      render: (v: string, row: Notebook) => (
        <button
          onClick={() => navigate(`/notebooks/${row.id}/overview`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center',
      sorter: true,
      render: (v: string) => <StatusTag color={NB_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Assigned TL', key: 'assigned_tl', width: 130,
      render: (_: unknown, row: Notebook) => <NotebookAssignedTLCell notebookId={row.id} />,
    },
    {
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: 'Actions', key: 'action', width: 130, align: 'center',
      render: (_: unknown, row: Notebook) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip title="Edit notebook">
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

  return (
    <div className="space-y-3">
      {/* Filter / action bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
        <BookOpen size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebooks</span>
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
        {canCreateNotebook && project.status === 'ACTIVE' && (
          <Button
            type="primary"
            icon={<BookPlus size={14} />}
            onClick={() => setNbModal(true)}
            className="rounded-md font-medium"
          >
            New Notebook
          </Button>
        )}
        {canCreateNotebook && project.status !== 'ACTIVE' && (
          <span className="text-[12px] text-slate-400 italic">
            {project.status === 'CLOSED' ? 'Project is closed' : 'Project is deactivated'} — new Notebooks can't be created.
          </span>
        )}
      </div>

      {/* Notebooks table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={notebooks}
          columns={nbColumns}
          rowKey="id"
          loading={loadingNb}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: nbPage, pageSize: nbPageSize, total: notebooksTotal,
            showSizeChanger: false, size: 'small', showTotal: (t) => `${t} notebooks`,
          }}
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
          locale={{ emptyText: 'No notebooks yet.' }}
        />
      </div>

      {/* Edit Notebook modal */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.code}` : 'Edit Notebook'}
        open={!!editTarget}
        onCancel={() => { setEditTarget(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={editMut.isPending}
        width={480}
        centered
        destroyOnHidden
        closable={false}
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => editMut.mutate(vals)}
        >
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. ADC Synthesis Run 1" />
          </Form.Item>
          <Form.Item label="Team Lead" name="tl_user_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Team Lead(s)"
              allowClear
              showSearch
              filterOption={(inp, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(inp.toLowerCase())
              }
              options={adcPdTlUsers.map(u => ({ value: u.id, label: u.username }))}
            />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional notes…" />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Notebook Modal */}
      <Modal
        title="Create Notebook"
        open={nbModal}
        closable={false}
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
            <Input placeholder="e.g. ADC Synthesis Run 1" />
          </Form.Item>
          <Form.Item label="Workflow Template" name="template_id" rules={[{ required: true }]}>
            <Select
              placeholder="Select a workflow template"
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={templates
                // Opt-out, not opt-in: a template shows here unless its own
                // "Show in Create Notebook" toggle (Template Builder) is off.
                .filter((t) => t.show_in_notebook_dropdown !== false)
                .map((t) => ({
                  value: t.id,
                  label: `${t.name} (v${t.version})`,
                }))}
            />
          </Form.Item>
          <Form.Item label="Team Lead" name="tl_user_ids">
            <Select
              mode="multiple"
              placeholder="Select ADC PD Team Lead(s)"
              allowClear
              showSearch
              filterOption={(input, opt) =>
                String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={adcPdTlUsers.map(u => ({ value: u.id, label: u.username }))}
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


// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdcProjectDetailPage() {
  const { projectId }       = useParams<{ projectId: string }>()
  const navigate            = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab           = searchParams.get('tab') ?? 'overview'

  const { data: project, isLoading } = useQuery({
    queryKey: ['adc-project', projectId],
    queryFn:  () => projectApi.get(projectId!),
    enabled:  !!projectId,
  })

  // Register project name in breadcrumb so UUID → project name
  useBreadcrumbLabel(projectId ?? '', project?.name ?? null)

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true })
  }

  if (isLoading) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading project…" /></div>
  }
  if (!project) return <div className="p-6 text-slate-500">Project not found.</div>

  const tabs = [
    { key: 'overview',                  label: 'Overview' },
    { key: 'project-info',              label: 'Project Info' },
    { key: 'project-master',            label: 'Project Master' },
    { key: 'related-documents',         label: 'Related Documents' },
    { key: 'regulatory-classification', label: 'Regulatory Classification' },
    { key: 'risk-assessment',           label: 'Risk Assessment' },
    { key: 'scheme',                    label: 'Scheme' },
  ]

  return (
    <div className="p-5 lg:p-8">
      {/* Back */}
      {/* <button
        onClick={() => navigate('/adc/projects')}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-violet-600 mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Projects
      </button> */}

      {/* Tabs */}
      <ConfigProvider theme={{ components: { Tabs: {
        inkBarColor: '#7c3aed',
        itemSelectedColor: '#7c3aed',
        itemActiveColor: '#7c3aed',
        itemHoverColor: '#7c3aed',
        titleFontSize: 13,
      }}}}>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        tabBarStyle={{ fontSize: 13, marginBottom: 0 }}
        items={tabs.map(t => ({
          key:      t.key,
          label:    t.label,
          children: (
            <div className="pt-4">
              {t.key === 'overview'
                ? <OverviewTab project={project as Project} projectId={projectId!} />
                : t.key === 'project-info'
                ? <ProjectInfoTab project={project as Project} projectId={projectId!} />
                : t.key === 'project-master'
                ? <ProjectMasterTab project={project as Project} projectId={projectId!} />
                : t.key === 'related-documents'
                ? <RelatedDocumentsTab project={project as Project} projectId={projectId!} />
                : t.key === 'regulatory-classification'
                ? <RegulatoryTab project={project as Project} projectId={projectId!} />
                : t.key === 'risk-assessment'
                ? <RiskAssessmentTab projectId={projectId!} />
                : <SchemeTab project={project as Project} projectId={projectId!} />
              }
            </div>
          ),
        }))}
      />
      </ConfigProvider>
    </div>
  )
}
