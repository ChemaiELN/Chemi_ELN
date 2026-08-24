import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Button, Modal, Form, Input, Select, message, Popconfirm, Dropdown, Card } from 'antd'
import {
  Plus, FileText, Search, ClipboardList, Send, CheckCircle2, Clock,
  XCircle, MoreVertical, Eye, Edit, Trash2, Download
} from 'lucide-react'
import dayjs from 'dayjs'
import { ardQcTrfApi, type QcTrfForm, type QcTrfStatus } from '../../api/ard'
import { ardProjectsApi } from '../../api/ard-projects'
import { ApiError, apiDownloadBlob } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const { TextArea } = Input

const TRANSITIONS: Record<QcTrfStatus, QcTrfStatus[]> = {
  DRAFT: ['SAVED', 'SUBMITTED'],
  SAVED: ['SUBMITTED', 'DRAFT'],
  SUBMITTED: ['REGISTERED', 'REJECTED'],
  REGISTERED: ['REJECTED'],
  REJECTED: ['SAVED', 'SUBMITTED'],
}

function statusTag(status: QcTrfStatus) {
  switch (status) {
    case 'REGISTERED':
      return <Tag color="green" className="font-semibold px-2.5 py-0.5 rounded-full border-none">REGISTERED</Tag>
    case 'SUBMITTED':
      return <Tag color="gold" className="font-semibold px-2.5 py-0.5 rounded-full border-none">SUBMITTED</Tag>
    case 'REJECTED':
      return <Tag color="red" className="font-semibold px-2.5 py-0.5 rounded-full border-none">REJECTED</Tag>
    case 'SAVED':
      return <Tag color="blue" className="font-semibold px-2.5 py-0.5 rounded-full border-none">SAVED</Tag>
    default:
      return <Tag color="default" className="font-semibold px-2.5 py-0.5 rounded-full border-none">DRAFT</Tag>
  }
}

export default function ArdQcTrfPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<QcTrfForm | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [form] = Form.useForm()

  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const isScopedUser = !isUnscopedAdmin
  const canCreateTrf = ['ANALYST', 'CHEM', 'TL', 'TEAM_LEAD', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role_code ?? '') && user?.department_code !== 'QA'

  const { data, isLoading } = useQuery({ queryKey: ['ard-qc-trf', isUnscopedAdmin], queryFn: () => ardQcTrfApi.list({ pageSize: 100, ...(isUnscopedAdmin ? { view: 'all' } : {}) }) })
  const { data: projectsData } = useQuery({ queryKey: ['ard-projects-list'], queryFn: () => ardProjectsApi.list({ pageSize: 100 }) })

  const accessibleProjects = useMemo(() => {
    const raw = projectsData?.items ?? []
    if (!isScopedUser || !user) return raw
    return raw.filter(p => {
      const isOwner = p.ownerName === user.username || p.ownerId === user.id || (p as any).createdById === user.id || p.createdBy === user.username
      const isTl = (p as any).assignedTl === user.username || (p as any).assignedTl === user.id || (p as any).assignedTlId === user.id
      const teamList = (p as any).team ?? (p as any).teamMembers ?? []
      const isMember = teamList.some((m: any) => m.username === user.username || m.userName === user.username || m.userId === user.id || m.id === user.id || m.name === user.username)
      return isOwner || isTl || isMember
    })
  }, [projectsData?.items, isScopedUser, user])

  const accessibleProjectCodes = useMemo(() => new Set(accessibleProjects.map(p => p.code)), [accessibleProjects])

  const projectOptions = useMemo(() => {
    return accessibleProjects.map((p) => ({
      value: p.name || p.productName || p.code,
      label: `${p.name || p.productName || p.code} (${p.code})`,
      code: p.code,
      projectName: p.name || p.productName || p.code,
    }))
  }, [accessibleProjects])

  const items = data?.items ?? []

  const scopedItems = useMemo(() => {
    if (!isScopedUser || !user) return items
    return items.filter(item => {
      const isCreator = item.createdBy === user.username || (item as any).createdById === user.id
      const isProjectAssigned = item.projectCode ? accessibleProjectCodes.has(item.projectCode) : false
      return isCreator || isProjectAssigned
    })
  }, [items, accessibleProjectCodes, isScopedUser, user])

  const filteredItems = useMemo(() => {
    return scopedItems.filter((item) => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter
      const q = searchQuery.toLowerCase().trim()
      const matchSearch =
        !q ||
        (item.formNo && item.formNo.toLowerCase().includes(q)) ||
        (item.projectName && item.projectName.toLowerCase().includes(q)) ||
        (item.projectCode && item.projectCode.toLowerCase().includes(q)) ||
        (item.sampleCode && item.sampleCode.toLowerCase().includes(q)) ||
        (item.batchNo && item.batchNo.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [scopedItems, statusFilter, searchQuery])

  const create = useMutation({
    mutationFn: ardQcTrfApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-qc-trf'] })
      msg.success('QC-TRF created successfully.')
      setOpen(false)
      form.resetFields()
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create.'),
  })

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => ardQcTrfApi.save(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-qc-trf'] })
      msg.success('QC-TRF details updated.')
      setEditing(null)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save.'),
  })

  const transition = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => ardQcTrfApi.transition(id, { to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-qc-trf'] })
      msg.success('QC-TRF status updated.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Transition failed.'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => ardQcTrfApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-qc-trf'] })
      msg.success('QC-TRF deleted.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to delete.'),
  })

  const openEdit = (row: QcTrfForm) => {
    setEditing(row)
    form.setFieldsValue(row)
  }

  const printSummary = async (row: QcTrfForm) => {
    try {
      const { blob } = await apiDownloadBlob(`/api/ard/qc-trf/${row.id}/documents/summary.pdf`)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      msg.error('Failed to generate summary PDF.')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      {ctx}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-indigo-600" />
          <h1 className="text-lg font-bold text-slate-800">TRF Forms</h1>
          <Tag color="blue" className="font-semibold rounded-full px-2.5">{filteredItems.length}</Tag>
        </div>
        {canCreateTrf && (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => { form.resetFields(); setOpen(true) }}
          >
            ADD
          </Button>
        )}
      </div>



      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 glass-card rounded-lg p-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <Input
            prefix={<Search size={16} className="text-slate-400 mr-1" />}
            placeholder="Search by Form No, Project, Sample or Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="max-w-md"
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SAVED', label: 'Saved' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'RECEIVED', label: 'Received' },
              { value: 'REGISTERED', label: 'Registered' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'WITHDRAWN', label: 'Withdrawn' },
            ]}
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-semibold">{filteredItems.length}</span> of {items.length} TRFs
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={filteredItems}
          size="middle"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'] }}
          onRow={(row) => ({ onClick: () => navigate(`/ard/qc-trf/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-slate-50/80 transition-colors'}
          columns={[
            {
              title: 'Form No',
              dataIndex: 'formNo',
              key: 'formNo',
              width: 220,
              render: (v) => (
                <div className="flex items-center gap-2 font-mono font-semibold text-indigo-600 hover:text-indigo-700">
                  <FileText size={16} className="shrink-0 text-indigo-500" />
                  <span>{v}</span>
                </div>
              ),
            },
            {
              title: 'Project',
              dataIndex: 'projectName',
              key: 'projectName',
              render: (v, row) => (
                <div>
                  <p className="font-semibold text-slate-800 text-sm leading-snug">{v || '—'}</p>
                  {row.projectCode && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 inline-block mt-0.5">
                      {row.projectCode}
                    </span>
                  )}
                </div>
              ),
            },
            {
              title: 'Sample Code',
              dataIndex: 'sampleCode',
              key: 'sampleCode',
              render: (v) => v ? <span className="font-mono text-xs text-slate-700 font-medium">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
            },
            {
              title: 'Batch No',
              dataIndex: 'batchNo',
              key: 'batchNo',
              render: (v) => v ? <span className="font-mono text-xs text-slate-700">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
            },
            {
              title: 'Sample Type',
              dataIndex: 'sampleType',
              key: 'sampleType',
              render: (v) => v ? <span className="text-xs text-slate-600">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
            },
            {
              title: 'Specification',
              dataIndex: 'specificationName',
              key: 'specificationName',
              render: (v) => v ? <span className="text-xs text-slate-600">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              width: 140,
              render: (v: QcTrfStatus) => statusTag(v),
            },
            {
              title: 'Created By',
              dataIndex: 'createdBy',
              key: 'createdBy',
              render: (v, row) => (
                <div>
                  <p className="text-xs font-medium text-slate-700">{v || '—'}</p>
                  <p className="text-[11px] text-slate-400">
                    {row.createdAt ? dayjs(row.createdAt).format('DD MMM YYYY') : '—'}
                  </p>
                </div>
              ),
            },
            {
              title: 'Action',
              key: 'action',
              width: 110,
              render: (_, row: QcTrfForm) => {
                const availableTransitions = TRANSITIONS[row.status] ?? []
                const menuItems = [
                  {
                    key: 'view',
                    icon: <Eye size={14} />,
                    label: 'Open Workspace',
                    onClick: () => navigate(`/ard/qc-trf/${row.id}`),
                  },
                  {
                    key: 'pdf',
                    icon: <Download size={14} />,
                    label: 'Download Summary PDF',
                    onClick: () => void printSummary(row),
                  },
                  ...(['DRAFT', 'SAVED'].includes(row.status)
                    ? [
                        {
                          key: 'edit',
                          icon: <Edit size={14} />,
                          label: 'Edit Info',
                          onClick: () => openEdit(row),
                        },
                      ]
                    : []),
                  ...availableTransitions.map((t) => ({
                    key: `transition-${t}`,
                    icon: <Send size={14} />,
                    label: `Move to ${t.replace(/_/g, ' ')}`,
                    onClick: () => transition.mutate({ id: row.id, to: t }),
                  })),
                  ...(['DRAFT', 'SAVED'].includes(row.status)
                    ? [
                        { type: 'divider' as const },
                        {
                          key: 'delete',
                          icon: <Trash2 size={14} className="text-red-500" />,
                          label: <span className="text-red-600 font-medium">Delete TRF</span>,
                          onClick: () => {
                            Modal.confirm({
                              title: `Delete ${row.formNo}?`,
                              content: 'This action cannot be undone.',
                              okType: 'danger',
                              onOk: () => remove.mutate(row.id),
                            })
                          },
                        },
                      ]
                    : []),
                ]

                return (
                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                    <Button
                      size="small"
                      type="text"
                      className="text-indigo-600 font-medium hover:bg-indigo-50"
                      onClick={() => navigate(`/ard/qc-trf/${row.id}`)}
                    >
                      Open
                    </Button>
                    <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                      <Button size="small" type="text" icon={<MoreVertical size={15} className="text-slate-500" />} />
                    </Dropdown>
                  </div>
                )
              },
            },
          ]}
        />
      </div>

      {/* New QC-TRF Modal */}
      <Modal
        {...glassModalProps}
        title="New QC-TRF"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => create.mutate(v))}
        confirmLoading={create.isPending}
      >
        <Form form={form} layout="vertical" className="mt-3">
          <Form.Item
            name="projectName"
            label="Project Name"
            rules={[{ required: true, message: 'Please select a project' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select project..."
              options={projectOptions}
              onChange={(val, opt: any) => {
                if (opt?.code) {
                  form.setFieldValue('projectCode', opt.code)
                  form.setFieldValue('projectName', opt.projectName || val)
                }
              }}
            />
          </Form.Item>
          <Form.Item name="projectCode" label="Project Code" rules={[{ required: true }]}>
            <Input placeholder="Auto-populated from selected project" readOnly className="bg-slate-50 font-mono" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        {...glassModalProps}
        title={`Edit ${editing?.formNo}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.validateFields().then((v) => save.mutate({ id: editing!.id, body: v }))}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical" className="mt-3">
          <Form.Item name="sampleCode" label="Sample Code"><Input placeholder="Sample code" /></Form.Item>
          <Form.Item name="batchNo" label="Batch No"><Input placeholder="Batch number" /></Form.Item>
          <Form.Item name="sampleQty" label="Quantity"><Input placeholder="Sample quantity" /></Form.Item>
          <Form.Item name="sampleQtyUom" label="UOM"><Input placeholder="Unit of measure" /></Form.Item>
          <Form.Item name="specificationName" label="Specification Name"><Input placeholder="Specification name" /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><TextArea rows={2} placeholder="Remarks..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
