import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Grid, Input, Button, Modal, Form, Select, message } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'

const { useBreakpoint } = Grid
import { BookOpen, BookPlus, Search } from 'lucide-react'
import dayjs from 'dayjs'
import {
  cgtNotebookApi, cgtProjectApi, PROCESS_TO_TEMPLATE_CATEGORY, type CgtNotebook,
} from '../../api/cgt'
import { workflowTemplateApi, userApi } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { glassModalProps } from '../../utils/modalStyles'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', SUBMITTED: 'gold', APPROVED: 'blue', REJECTED: 'red', ARCHIVED: 'default',
}

// Only the CGT HOD gets a "New Notebook" action here — the project dropdown
// is scoped to projects QA has assigned to them (manager_id), a concept that
// doesn't apply the same way to any other role on this page.
const CAN_CREATE_HERE = ['HOD']

// Mirrors the table design used in CgtHodDashboard's "Project Received" table —
// glass-card filter bar (icon + label + count badge + search) and a
// glass-card-wrapped sortable table with StatusTag status pills.
export default function CgtNotebooksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const screens = useBreakpoint()
  const user = useAppSelector(selectUser)
  const canCreate = CAN_CREATE_HERE.includes(user?.role_code ?? '') && user?.department_code === 'CGT'

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

  useEffect(() => { setPage(1) }, [search, sortField, sortOrder])

  const [nbModal, setNbModal] = useState(false)
  const [nbForm] = Form.useForm()
  const selectedProjectId = Form.useWatch('project_id', nbForm)

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-notebooks-all', page, pageSize, search, sortField, sortOrder],
    queryFn:  () => cgtNotebookApi.listAll({
      search: search || undefined,
      page,
      limit: pageSize,
      sortBy: sortField,
      sortDir: sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const notebooks = data?.items ?? []
  const total = data?.total ?? 0

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<CgtNotebook> | SorterResult<CgtNotebook>[],
  ) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortField(s?.field ? String(s.field) : undefined)
    setSortOrder(s?.order ?? undefined)
  }

  // Projects assigned to this HOD (server already scopes list_projects to
  // manager_id === current_user.id for a CGT-department HOD).
  const { data: myProjectsData } = useQuery({
    queryKey: ['cgt-projects-assigned-to-me'],
    queryFn:  () => cgtProjectApi.list({ limit: 200 }),
    enabled:  canCreate,
  })
  const myProjects = myProjectsData?.items ?? []

  const selectedProject = myProjects.find(p => p.id === selectedProjectId)
  const templateCategory = selectedProject?.process ? PROCESS_TO_TEMPLATE_CATEGORY[selectedProject.process] : undefined

  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates', templateCategory],
    queryFn:  () => workflowTemplateApi.list({ category: templateCategory, is_active: true }),
    enabled:  !!templateCategory,
    staleTime: 5 * 60 * 1000,
  })
  const templates = Array.isArray(templatesData) ? templatesData : []

  // Team Leads for the assign-TL picker (CGT department)
  const { data: cgtTlUsers = [] } = useQuery({
    queryKey: ['users-cgt-tl'],
    queryFn:  () => userApi.list({ role_code: 'TL', dept_code: 'CGT' }).then(r => r.items),
    enabled:  canCreate,
    staleTime: 5 * 60 * 1000,
  })

  const openCreate = () => {
    nbForm.resetFields()
    setNbModal(true)
  }

  const createNb = useMutation({
    mutationFn: async (vals: Record<string, unknown>) => {
      const { project_id, tl_user_ids, ...rest } = vals
      const nb = await cgtNotebookApi.create(project_id as string, rest)
      const ids = (tl_user_ids as string[] | undefined) ?? []
      await Promise.all(ids.map(uid => cgtNotebookApi.assignUser(nb.id, uid)))
      return nb
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-notebooks-all'] })
      setNbModal(false)
      nbForm.resetFields()
      message.success('Notebook created.')
    },
    onError: () => message.error('Failed to create notebook'),
  })

  const columns: ColumnsType<CgtNotebook> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 150,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Notebook Title', dataIndex: 'title', key: 'title', width: 220,
      sorter: true,
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.id}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 140,
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}`)}
          className="text-[13px] text-teal-600 hover:underline"
        >
          {withEmptyValue(v)}
        </button>
      ),
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
      title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 130,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
  ]

  return (
    <div className="p-6 space-y-3">
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
        <BookOpen size={15} className="text-violet-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700 shrink-0">Notebooks</span>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
          {total}
        </span>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search notebooks…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        {canCreate && (
          <Button
            type="primary"
            icon={<BookPlus size={14} />}
            onClick={openCreate}
            className="rounded-md font-medium"
          >
            New Notebook
          </Button>
        )}
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={notebooks}
          columns={columns}
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
            showTotal: (t) => `${t} notebooks`,
            size: 'small',
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
          locale={{ emptyText: 'No notebooks found.' }}
        />
      </div>

      {/* Create Notebook Modal */}
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
        <Form
          form={nbForm}
          layout="vertical"
          className="mt-3"
          onFinish={vals => createNb.mutate(vals)}
          onValuesChange={(changed) => {
            // Template category depends on the selected project's process —
            // clear any previously-chosen template when the project changes.
            if ('project_id' in changed) {
              nbForm.setFieldValue('template_id', undefined)
            }
          }}
        >
          <Form.Item
            label="Project"
            name="project_id"
            rules={[{ required: true, message: 'Please select a project' }]}
          >
            <Select
              placeholder="Select one of your assigned projects"
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={myProjects.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
              notFoundContent="No projects assigned to you yet"
            />
          </Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. AAV USP Run 1" />
          </Form.Item>
          <Form.Item
            label="Template"
            name="template_id"
            rules={[{ required: true, message: 'Required' }]}
            help={selectedProject?.process ? `Filtered to ${selectedProject.process} templates` : undefined}
          >
            <Select
              placeholder={selectedProjectId ? 'Select a workflow template' : 'Select a project first'}
              showSearch
              disabled={!selectedProjectId}
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={templates.map(t => ({ value: t.id, label: `${t.name} (v${t.version})` }))}
              notFoundContent={!templateCategory ? 'Select a project to see templates' : 'No templates found'}
            />
          </Form.Item>
          <Form.Item label="Team Lead" name="tl_user_ids">
            <Select
              mode="multiple"
              placeholder="Select CGT Team Lead(s)"
              allowClear
              showSearch
              filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={cgtTlUsers.map(u => ({ value: u.id, label: u.username }))}
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
