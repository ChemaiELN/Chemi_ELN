import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Table, Modal, Form, Input, Select, Tooltip, Spin, message, Grid } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'

const { useBreakpoint } = Grid
import { Plus, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { notebookApi, projectApi, userApi, type Notebook } from '../../api/adc'
import { templateSettingsApi } from '../../api/templateSettings'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { useCan } from '../../hooks/usePrivilege'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', CLOSED: 'purple',
}

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

export default function NotebooksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const screens   = useBreakpoint()
  const canCreateNotebook = useCan('adc.notebook.create')
  // Without view_all the user sees only notebooks assigned to them. The backend
  // enforces this regardless, but requesting the filtered view directly avoids
  // showing (then hiding) notebooks they can't open.
  const scopedToOwnNotebooks = !useCan('adc.notebook.view_all')

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearchTerm(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useEffect(() => { setPage(1) }, [searchTerm])

  const [modal, setModal]   = useState(false)
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['notebooks-all', scopedToOwnNotebooks, page, pageSize, searchTerm, sortBy, sortDir],
    queryFn:  () => notebookApi.listAll({
      assigned_to_me: scopedToOwnNotebooks || undefined,
      page, limit: pageSize, search: searchTerm || undefined,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const notebooks = data?.items ?? []
  const total = data?.total ?? 0

  // Project picker in the New Notebook modal searches server-side as the user
  // types, instead of loading a flat capped page of projects up front.
  const [projectSearchInput, setProjectSearchInput] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setProjectSearch(projectSearchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [projectSearchInput])

  const { data: projectsData, isFetching: projectsSearching } = useQuery({
    queryKey: ['projects-list-modal', projectSearch],
    queryFn:  () => projectApi.list({ search: projectSearch || undefined, limit: 50 }),
    enabled:  modal,
  })
  const projects = projectsData?.items ?? []

  // Admin-curated list (Admin → Template Settings → ADC Template Settings) of
  // templates offered here — replaces the old single hardcoded template.
  const { data: templatesData } = useQuery({
    queryKey: ['template-settings-adc-enabled'],
    queryFn:  templateSettingsApi.listAdcEnabled,
    staleTime: 5 * 60 * 1000,
    enabled: modal,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  // If only one template is enabled, auto-select it for convenience.
  useEffect(() => {
    if (templates.length === 1) form.setFieldValue('template_id', templates[0].id)
  }, [templates, form])

  // Team Leads for the assign-TL picker
  const { data: adcPdTlUsers = [] } = useQuery({
    queryKey: ['users-adc-pd-tl'],
    queryFn: () => userApi.list({ role_code: 'TL', dept_code: 'ADC_PD' }).then(r => r.items),
    staleTime: 5 * 60 * 1000,
    enabled: modal,
  })

  const createNb = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { project_id, tl_user_ids, ...rest } = vals
      const nb = await notebookApi.create(project_id as string, rest)
      const ids = (tl_user_ids as string[] | undefined) ?? []
      await Promise.all(ids.map(uid => notebookApi.assignUser(nb.id, uid)))
      return nb
    },
    onSuccess: (nb) => {
      qc.invalidateQueries({ queryKey: ['notebooks-all'] })
      qc.invalidateQueries({ queryKey: ['notebook-assigned-users', nb.id] })
      setModal(false)
      form.resetFields()
      message.success('Notebook created')
      navigate(`/notebooks/${nb.id}/overview`)
    },
    onError: () => message.error('Failed to create notebook'),
  })

  const columns: ColumnsType<Notebook> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Notebook Name',
      dataIndex: 'title',
      key: 'title',
      width: 200,
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
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project',
      width: 130,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-slate-300 text-[13px]">—</span>,
    },
    {
      title: 'Assigned TL',
      key: 'assigned_tl',
      width: 130,
      render: (_: unknown, row: Notebook) => <NotebookAssignedTLCell notebookId={row.id} />,
    },
    {
      title: 'Created By',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 130,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v || '—'}</span>,
    },
    {
      title: 'Created Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center' as const,
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
        {canCreateNotebook && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModal(true)}
            className="rounded-md font-medium"
          >
            New Notebook
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={notebooks}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{ current: page, pageSize, total, showSizeChanger: false, showTotal: (t) => `${t} notebooks`, size: 'small' }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<Notebook>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No notebooks found.' }}
        />
      </div>

      {/* New Notebook Modal */}
      <Modal
        title="New Notebook"
        open={modal}
        closable={false}
        onCancel={() => { setModal(false); form.resetFields(); setProjectSearchInput('') }}
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
              placeholder="Search a project…"
              showSearch
              filterOption={false}
              onSearch={setProjectSearchInput}
              loading={projectsSearching}
              notFoundContent={projectsSearching ? <Spin size="small" /> : null}
              options={projects.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
            />
          </Form.Item>

          <Form.Item label="Notebook Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Study NB-001" />
          </Form.Item>

          <Form.Item
            label="Experiment Template"
            name="template_id"
            rules={[{ required: true, message: 'Select a template' }]}
            extra="Scientists will follow this template's screens when recording experiments."
          >
            <Select
              placeholder="Select a workflow template"
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={templates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
              notFoundContent="No templates enabled — configure them in Admin → Template Settings"
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
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
