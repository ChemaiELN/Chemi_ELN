import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, FolderOpen, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { ardProjectsApi, type Project } from '../../api/ard-projects'
import { ardNotebooksApi } from '../../api/ard-notebooks'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

function statusColor(s: string) {
  return s === 'OPEN' ? 'green' : 'default'
}

export default function ArdProjectsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [q, setQ] = useState('')
  const [form] = Form.useForm()
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [notebookConfirmOpen, setNotebookConfirmOpen] = useState(false)
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  const isAnalyst = user?.role_code === 'ANALYST' || user?.role_code === 'CHEMIST'

  const { data, isLoading } = useQuery({
    queryKey: ['ard-projects', statusFilter, q],
    queryFn: () => ardProjectsApi.list({ status: statusFilter, q: q || undefined, pageSize: 50 }),
  })

  const projectsList = useMemo(() => data?.items ?? [], [data?.items])

  const createMut = useMutation({
    mutationFn: (v: { code: string; productName: string; customer?: string; description?: string }) =>
      ardProjectsApi.create(v),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['ard-projects'] })
      msgApi.success(`Project ${p.code} created successfully.`)
      setOpen(false)
      form.resetFields()
      setCreatedProjectId(p.id)
      setNotebookConfirmOpen(true)
    },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to create project.'),
  })

  const handleNotebookConfirmYes = async () => {
    if (!createdProjectId) return
    setCreatingNotebook(true)
    try {
      const defaultNotebooks = [
        { name: 'STP Template', type: 'STP_TEMPLATE' },
        { name: 'Method Development Notebook', type: 'ANALYTICAL' },
        { name: 'Method Validation Notebook', type: 'METHOD_VALIDATION' },
        { name: 'Routine Analysis Notebook', type: 'ROUTINE_ANALYSIS' },
      ]
      for (const item of defaultNotebooks) {
        await ardNotebooksApi.create({
          name: item.name,
          projectId: createdProjectId,
          notebookType: item.type,
        })
      }
      qc.invalidateQueries({ queryKey: ['ard-notebooks-list'] })
      msgApi.success('Created 4 default notebooks successfully.')
      setNotebookConfirmOpen(false)
      // Land on the project's own page, not straight into a notebook — the
      // user should see the project they just created, with its new
      // notebooks listed, rather than being dropped into one of them.
      navigate(`/ard/projects/${createdProjectId}`)
    } catch {
      msgApi.error('Failed to create default notebooks.')
    } finally {
      setCreatingNotebook(false)
    }
  }

  const handleNotebookConfirmNo = () => {
    const id = createdProjectId
    setNotebookConfirmOpen(false)
    setCreatedProjectId(null)
    if (id) navigate(`/ard/projects/${id}`)
  }

  const columns: ColumnsType<Project> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 130,
      render: (v) => <span className="font-mono font-semibold text-slate-700">{v}</span>,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      render: (v, row) => (
        <div>
          <span className="font-medium text-slate-700">{v}</span>
          {row.name && row.name !== v && (
            <span className="text-xs text-slate-400 ml-2">({row.name})</span>
          )}
        </div>
      ),
    },
    { title: 'Customer', dataIndex: 'customer', render: v => v || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Created By / Created on',
      key: 'created',
      width: 150,
      render: (_, row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700">{row.createdBy || 'Admin'}</div>
          <div className="text-slate-400">{row.createdAt ? dayjs(row.createdAt).format('DD-MMM-YYYY HH:mm') : '—'}</div>
        </div>
      ),
    },
    {
      title: 'Updated By / Updated on',
      key: 'updated',
      width: 150,
      render: (_, row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700">{row.updatedBy || row.createdBy || 'Admin'}</div>
          <div className="text-slate-400">{row.updatedAt ? dayjs(row.updatedAt).format('DD-MMM-YYYY HH:mm') : '—'}</div>
        </div>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      {ctx}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FolderOpen size={20} className="text-violet-600" />
          <h1 className="text-lg font-bold text-slate-800">Projects</h1>
          {data && (
            <span className="text-sm text-slate-400 ml-1">({projectsList.length})</span>
          )}
        </div>
        {!isAnalyst && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}
            style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
            ADD
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <Input prefix={<Search size={16} className="text-slate-400" />} placeholder="Search code / product" allowClear style={{ width: 280 }}
          onChange={e => setQ(e.target.value)} />
        <Select allowClear placeholder="Status" style={{ width: 140 }} value={statusFilter} onChange={setStatusFilter}
          options={[{ value: 'OPEN', label: 'Open' }, { value: 'CLOSED', label: 'Closed' }, { value: 'DEACTIVATED', label: 'Deactivated' }]} />
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={projectsList}
        size="small"
        onRow={(row) => ({
          onClick: () => {
            setSelectedRowId(row.id)
            navigate(`/ard/projects/${row.id}`)
          },
        })}
        rowClassName={(row) =>
          row.id === selectedRowId ? 'bg-indigo-50/80 font-medium cursor-pointer' : 'cursor-pointer hover:bg-slate-50'
        }
        columns={columns}
      />
      </div>

      {/* Create Project Modal */}
      <Modal
        {...glassModalProps}
        title="New Project"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.validateFields().then(v => createMut.mutate(v))}
        confirmLoading={createMut.isPending}
        okText="Create"
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item name="productName" label="Product Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Metformin HCl 500mg" />
          </Form.Item>
          <Form.Item name="code" label="Project Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. PRJ-2025-001" />
          </Form.Item>
          <Form.Item name="customer" label="Customer / Market">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="projectType" label="Project Type" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Analysis, Development, Stability..." />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Project scope, objectives..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Default Notebooks Confirm Modal */}
      <Modal
        {...glassModalProps}
        title={<span className="font-bold text-slate-800 text-base">Add Default Notebooks?</span>}
        open={notebookConfirmOpen}
        onOk={handleNotebookConfirmYes}
        onCancel={handleNotebookConfirmNo}
        okText="Yes, Create 4 Default Notebooks"
        cancelText="No, Go to Project"
        confirmLoading={creatingNotebook}
        maskClosable={false}
        width={540}
        okButtonProps={{ className: 'bg-violet-600 hover:bg-violet-700 border-none font-medium px-4 py-1.5 h-auto text-white shadow-xs' }}
        cancelButtonProps={{ className: 'font-medium px-4 py-1.5 h-auto border-slate-300 text-slate-700' }}
      >
        {creatingNotebook ? (
          <div className="flex items-center gap-3 py-4 text-sm text-slate-700 font-medium">
            <Spin size="small" /> Provisioning 4 default notebooks (STP Template, Method Development, Method Validation, Routine Analysis)…
          </div>
        ) : (
          <p className="text-slate-600 text-sm leading-relaxed py-2">
            Would you like to automatically create the <strong className="text-slate-800 font-semibold">4 default notebooks</strong> (STP Template, Method Development, Method Validation, Routine Analysis) for this project?
          </p>
        )}
      </Modal>
    </div>
  )
}
