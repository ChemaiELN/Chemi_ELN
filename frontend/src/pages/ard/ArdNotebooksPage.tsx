import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { BookOpen, Plus, FolderKanban, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { ardNotebooksApi, type Notebook } from '../../api/ard-notebooks'
import { ardProjectsApi, type Project } from '../../api/ard-projects'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', CLOSED: 'default', DEACTIVE: 'volcano',
}

const NOTEBOOK_TYPES = [
  { value: 'STP_TEMPLATE',       label: 'STP Template' },
  { value: 'ANALYTICAL',         label: 'Analytical' },
  { value: 'STABILITY',          label: 'Stability' },
  { value: 'METHOD_VALIDATION',  label: 'Method Validation' },
  { value: 'ROUTINE_ANALYSIS',   label: 'Routine Analysis' },
  { value: 'OTHER',              label: 'Other' },
]

const DEFAULT_NOTEBOOK_NAMES: Record<string, string> = {
  STP_TEMPLATE:      'STP Template',
  ANALYTICAL:        'Method Development Notebook',
  STABILITY:         'Stability Study Notebook',
  METHOD_VALIDATION: 'Method Validation Notebook',
  ROUTINE_ANALYSIS:  'Routine Analysis Notebook',
  OTHER:             'General Lab Notebook',
}

export default function ArdNotebooksPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [msgApi, ctx] = message.useMessage()

  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const isScopedUser = !isUnscopedAdmin

  const { data, isLoading } = useQuery({
    queryKey: ['ard-notebooks'],
    queryFn: () => ardNotebooksApi.list({ pageSize: 100 }),
  })

  const { data: projectsData } = useQuery({
    queryKey: ['ard-projects-list'],
    queryFn: () => ardProjectsApi.list({ pageSize: 100 }),
  })

  const accessibleProjects = useMemo(() => {
    const raw = projectsData?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(p => {
      const isOwner = p.ownerName === user.username || p.ownerId === user.id || p.createdById === user.id
      const isTl = (p as any).assignedTl === user.username || (p as any).assignedTl === user.id
      const isMember = ((p as any).team ?? p.teamMembers ?? []).some((m: any) =>
        m.userName === user.username || m.username === user.username || m.userId === user.id || m.id === user.id
      )
      return isOwner || isTl || isMember
    })
  }, [projectsData?.items, isScopedUser, user])

  const accessibleProjectIds = useMemo(() => new Set(accessibleProjects.map(p => p.id)), [accessibleProjects])

  const scopedNotebooks = useMemo(() => {
    const raw = data?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(nb => {
      const isCreator = nb.createdBy === user.username || nb.createdById === user.id
      const isAssigned = ((nb as any).assignedUsers ?? []).some((u: any) =>
        u.userId === user.id || u.userName === user.username
      )
      const isProjectAssigned = nb.projectId ? accessibleProjectIds.has(nb.projectId) : false
      return isCreator || isAssigned || isProjectAssigned
    })
  }, [data?.items, accessibleProjectIds, isScopedUser, user])

  const filteredNotebooks = useMemo(() => {
    let list = scopedNotebooks
    if (statusFilter) list = list.filter(nb => nb.status === statusFilter)
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(nb => {
      const proj = (projectsData?.items ?? []).find(p => p.id === nb.projectId)
      return (
        nb.name?.toLowerCase().includes(term) ||
        nb.code?.toLowerCase().includes(term) ||
        proj?.code?.toLowerCase().includes(term)
      )
    })
  }, [scopedNotebooks, q, statusFilter, projectsData?.items])

  const create = useMutation({
    mutationFn: (vals: Record<string, string>) =>
      ardNotebooksApi.create({
        name: vals.name,
        description: vals.description,
        notebookType: vals.notebookType,
        projectId: vals.projectId,
      }),
    onSuccess: (nb: Notebook) => {
      qc.invalidateQueries({ queryKey: ['ard-notebooks'] })
      msgApi.success('Notebook created')
      setOpen(false)
      form.resetFields()
      navigate(`/ard/notebooks/${nb.id}`)
    },
    onError: () => msgApi.error('Failed to create notebook'),
  })

  const columns: ColumnsType<Notebook> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 150,
      render: v => <span className="font-mono text-xs">{v}</span>,
    },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Project', dataIndex: 'projectId', key: 'projectId', width: 220,
      render: (pid: string) => {
        const proj = (projectsData?.items ?? []).find(p => p.id === pid)
        return proj ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-800 text-xs leading-tight">{(proj as any).productName || proj.name || proj.code}</span>
            <span className="text-[11px] text-slate-400 font-mono">{proj.code}</span>
          </div>
        ) : '—'
      },
    },
    {
      title: 'Type', dataIndex: 'notebookType', key: 'notebookType', width: 150,
      render: v => v ? v.replace(/_/g, ' ') : '—',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy', width: 150 },
    {
      title: 'Created', dataIndex: 'createdAt', key: 'createdAt', width: 130,
      render: (v: string) => v ? dayjs(v).format('DD MMM YYYY') : '—',
    },
  ]

  return (
    <>
      {ctx}
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-violet-600" />
            <h1 className="text-lg font-bold text-slate-800">Notebooks</h1>
            {data && <span className="text-sm text-slate-400 ml-1">({filteredNotebooks.length})</span>}
          </div>
          {!['ANALYST', 'CHEMIST', 'CHEM'].includes(user?.role_code ?? '') && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
              ADD
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-3">
          <Input
            prefix={<Search size={16} className="text-slate-400" />}
            placeholder="Search code / name / project"
            allowClear
            style={{ width: 280 }}
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'CLOSED', label: 'Closed' },
              { value: 'DEACTIVE', label: 'Deactive' },
            ]}
          />
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredNotebooks}
            loading={isLoading}
            onRow={r => ({ onClick: () => navigate(`/ard/notebooks/${r.id}`), className: 'cursor-pointer' })}
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
            locale={{ emptyText: 'No notebooks accessible.' }}
          />
        </div>
      </div>

      <Modal
        {...glassModalProps}
        title="New Notebook"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Create"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={create.mutate}
          className="mt-4"
          onValuesChange={(changed) => {
            if ('notebookType' in changed && changed.notebookType) {
              const currentName = form.getFieldValue('name')
              if (!currentName) {
                form.setFieldValue('name', DEFAULT_NOTEBOOK_NAMES[changed.notebookType] ?? '')
              }
            }
          }}
        >
          <Form.Item name="projectId" label="Project" rules={[{ required: true, message: 'Project selection is required' }]}>
            <Select
              showSearch
              placeholder="Select target project"
              optionFilterProp="label"
              options={accessibleProjects.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.productName} (${p.name || 'Project'})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="notebookType" label="Notebook Type">
            <Select placeholder="Select type (auto-fills name)" options={NOTEBOOK_TYPES} allowClear />
          </Form.Item>
          <Form.Item name="name" label="Notebook Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Auto-filled from type, or enter custom name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brief description of the notebook's scope" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
