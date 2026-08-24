import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Tag, Button, Modal, Form, Input, Select, Popconfirm, message, Space, Tooltip,
} from 'antd'
import { Plus, Search, ChevronDown, ChevronRight, FileCode2 } from 'lucide-react'
import dayjs from 'dayjs'
import { ardTemplateApi, ardApi, type ArdTemplateDoc, type TemplateStatus } from '../../api/ard'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

function statusTag(status: TemplateStatus) {
  const color =
    status === 'PUBLISHED'
      ? 'green'
      : status === 'PENDING_APPROVAL'
        ? 'gold'
        : status === 'REWORK'
          ? 'red'
          : status === 'SUPERSEDED'
            ? 'default'
            : 'default'
  const label = status ? status.replace(/_/g, ' ') : status
  return <Tag color={color}>{label}</Tag>
}

interface TemplateGroupedRow extends ArdTemplateDoc {
  isNested?: boolean
  otherVersions?: ArdTemplateDoc[]
}

export default function ArdTemplatesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({})
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['ard-templates', search, statusFilter],
    queryFn: () => ardTemplateApi.list({ q: search || undefined, status: statusFilter || undefined, pageSize: 200 }),
  })

  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  const templateTypeOptions = useMemo(() => {
    const fromLookup = (masterData?.lookups ?? [])
      .filter((l) => l.category === 'Template Type' && l.active)
      .map((l) => ({ value: l.code, label: l.label }))
    return fromLookup.length > 0
      ? fromLookup
      : [
          { value: 'EXPERIMENT', label: 'Experiment' },
          { value: 'ANALYTICAL', label: 'Analytical' },
          { value: 'STP', label: 'STP Document' },
          { value: 'STABILITY', label: 'Stability Study' },
        ]
  }, [masterData?.lookups])

  const create = useMutation({
    mutationFn: (values: any) =>
      ardTemplateApi.create({
        name: values.name,
        templateType: values.templateType,
        description: values.description,
        sections: [
          {
            id: `sec-${Date.now().toString(36)}`,
            type: 'richtext',
            title: 'Objective',
            sequence: 1,
            required: true,
          },
        ],
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['ard-templates'] })
      msg.success('Template draft created')
      setOpen(false)
      form.resetFields()
      navigate(`/ard/templates/${t.id}`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create template.'),
  })

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => ardTemplateApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-templates'] })
      msg.success('Template deleted.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to delete template.'),
  })

  const clone = useMutation({
    mutationFn: ardTemplateApi.clone,
    onSuccess: (copy) => {
      qc.invalidateQueries({ queryKey: ['ard-templates'] })
      msg.success('Template cloned successfully')
      navigate(`/ard/templates/${copy.id}`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to clone template.'),
  })

  const newVersion = useMutation({
    mutationFn: ardTemplateApi.newVersion,
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ['ard-templates'] })
      msg.success(`Version v${next.version} draft created`)
      navigate(`/ard/templates/${next.id}`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create new version.'),
  })

  // Group templates by familyId
  const groupedRows = useMemo(() => {
    const rawItems = data?.items ?? []
    const familyMap = new Map<string, ArdTemplateDoc[]>()

    for (const item of rawItems) {
      const famKey = item.familyId || item.id
      if (!familyMap.has(famKey)) familyMap.set(famKey, [])
      familyMap.get(famKey)!.push(item)
    }

    const rows: TemplateGroupedRow[] = []
    for (const [, versions] of familyMap.entries()) {
      // Sort descending by version number
      const sorted = [...versions].sort((a, b) => b.version - a.version)
      const primary = sorted[0]
      const otherVersions = sorted.slice(1)
      rows.push({ ...primary, otherVersions })
    }
    rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return rows
  }, [data?.items])

  const flatRows = useMemo(() => {
    const rows: TemplateGroupedRow[] = []
    for (const row of groupedRows) {
      rows.push(row)
      const familyKey = row.familyId || row.id
      if (row.otherVersions?.length && expandedFamilies[familyKey]) {
        for (const v of row.otherVersions) {
          rows.push({ ...v, isNested: true })
        }
      }
    }
    return rows
  }, [groupedRows, expandedFamilies])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {ctx}
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode2 size={20} className="text-violet-600" />
          <h1 className="text-lg font-bold text-slate-800">Templates</h1>
          <Tag color="blue" className="font-semibold rounded-full px-2.5">
            {groupedRows.length} template families
          </Tag>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
          ADD
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input
          prefix={<Search size={14} className="text-slate-400 mr-1" />}
          allowClear
          placeholder="Search templates by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
        <Select
          allowClear
          placeholder="Filter Status"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 180 }}
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PENDING_APPROVAL', label: 'Pending approval' },
            { value: 'PUBLISHED', label: 'Published' },
            { value: 'REWORK', label: 'Rework' },
            { value: 'SUPERSEDED', label: 'Superseded' },
          ]}
        />
      </div>

      {/* Templates Table */}
      <div className="glass-card rounded-lg overflow-hidden">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={flatRows}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        onRow={(row) => ({
          onClick: () => navigate(`/ard/templates/${row.id}`),
          className: 'cursor-pointer',
        })}
        columns={[
          {
            title: 'Code',
            dataIndex: 'id',
            width: 140,
            render: (_, row) => <span className="font-mono text-xs font-semibold text-indigo-600">TPL-{row.id.slice(0, 8).toUpperCase()}</span>,
          },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (v, row) => (
              <div className="flex items-center gap-1.5">
                {!row.isNested && row.otherVersions && row.otherVersions.length > 0 ? (
                  <Button
                    type="text"
                    size="small"
                    className="p-0 h-5 w-5 text-slate-400 hover:text-indigo-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      const famKey = row.familyId || row.id
                      setExpandedFamilies((prev) => ({ ...prev, [famKey]: !prev[famKey] }))
                    }}
                  >
                    {expandedFamilies[row.familyId || row.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </Button>
                ) : row.isNested ? (
                  <span className="w-5" />
                ) : null}
                <span className={row.isNested ? 'text-slate-500 text-xs pl-2' : 'font-semibold text-slate-800'}>{v}</span>
                {row.isNested && <Tag className="text-[10px] px-1 py-0">Superseded</Tag>}
              </div>
            ),
          },
          {
            title: 'Type',
            dataIndex: 'templateType',
            render: (v) => v ? <Tag color="geekblue">{v}</Tag> : '—',
          },
          {
            title: 'Version',
            dataIndex: 'version',
            render: (v) => <span className="font-mono text-xs font-semibold">v{v}</span>,
          },
          {
            title: 'Sections',
            dataIndex: 'sections',
            render: (v: any[]) => <Tag>{v?.length ?? 0}</Tag>,
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (v: TemplateStatus) => statusTag(v),
          },
          {
            title: 'Created By / On',
            key: 'created',
            render: (_, row) => (
              <div>
                <div className="font-medium text-slate-700 text-xs">{row.createdBy || 'System'}</div>
                <div className="text-[11px] text-slate-400">{row.createdAt ? dayjs(row.createdAt).format('DD-MMM-YYYY HH:mm') : '—'}</div>
              </div>
            ),
          },
          {
            title: 'Actions',
            width: 200,
            render: (_, row) => (
              <Space size={6} onClick={(e) => e.stopPropagation()}>
                <Button
                  type="link"
                  size="small"
                  loading={clone.isPending}
                  onClick={(e) => {
                    e.stopPropagation()
                    clone.mutate(row.id)
                  }}
                >
                  Clone
                </Button>
                {row.status === 'PUBLISHED' && (
                  <Popconfirm
                    title="Create new version?"
                    description="This creates a new draft version under the same template family."
                    onConfirm={() => newVersion.mutate(row.id)}
                  >
                    <Button type="link" size="small" loading={newVersion.isPending} onClick={(e) => e.stopPropagation()}>
                      New version
                    </Button>
                  </Popconfirm>
                )}
                <Button
                  type="link"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/ard/templates/${row.id}`)
                  }}
                >
                  {['DRAFT', 'REWORK'].includes(row.status) ? 'Edit' : 'View'}
                </Button>
                {['DRAFT', 'REWORK'].includes(row.status) && (
                  <Popconfirm
                    title="Delete template?"
                    description="This action cannot be undone."
                    onConfirm={() => deleteTemplate.mutate(row.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="link" size="small" danger loading={deleteTemplate.isPending} onClick={(e) => e.stopPropagation()}>
                      Delete
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
      </div>

      {/* New Template Modal */}
      <Modal
        {...glassModalProps}
        destroyOnClose
        title="New Template"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => create.mutate(v))}
        confirmLoading={create.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Template Name" rules={[{ required: true, message: 'Template name is required' }]}>
            <Input placeholder="e.g. Assay Test Protocol Template" />
          </Form.Item>
          <Form.Item name="templateType" label="Template Type">
            <Select allowClear placeholder="Select template type" options={templateTypeOptions} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description of template purpose..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
