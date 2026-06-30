import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Space, Tooltip, message, Switch } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, Building2, Search } from 'lucide-react'
import { adminApi, type DepartmentOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

export default function DepartmentsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DepartmentOut | null>(null)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string | undefined>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data: depts = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: adminApi.listDepts,
  })

  const filtered = depts.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.code.toLowerCase().includes(search.toLowerCase())) return false
    if (filterActive !== undefined && String(d.is_active) !== filterActive) return false
    return true
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['departments'] })

  const onCreate = useMutation({
    mutationFn: adminApi.createDept,
    onSuccess: () => { inv(); setCreateOpen(false); createForm.resetFields(); msg.success('Department created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Record<string, unknown> }) => adminApi.updateDept(id, v as Parameters<typeof adminApi.updateDept>[1]),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('Department updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateDept(id, { is_active }),
    onSuccess: () => inv(),
  })

  const openEdit = (d: DepartmentOut) => {
    setEditTarget(d)
    editForm.setFieldsValue({ code: d.code, name: d.name, description: d.description })
  }

  const columns: ColumnsType<DepartmentOut> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 110,
      render: (v) => (
        <span className="font-mono text-[13px] font-semibold text-purple-600 border border-purple-300 rounded px-1.5 py-0.5 bg-purple-50">
          {String(v).toUpperCase()}
        </span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      width: 70,
      align: 'center',
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 80,
      align: 'center',
      render: (v, record) => (
        <Switch
          size="small"
          checked={v}
          onChange={(checked) => onToggle.mutate({ id: record.id, is_active: checked })}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(record)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      {ctx}

      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search departments…"
          className="rounded-md"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={filterActive}
          onChange={(v) => setFilterActive(v)}
          placeholder="All Status"
          allowClear
          style={{ minWidth: 130 }}
          options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
        />
        <Button
          type="primary"
          icon={<Building2 size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          New Department
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} departments` }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        title="New Department"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create"
        confirmLoading={onCreate.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => onCreate.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
            <Input placeholder="e.g. QC" className="uppercase font-mono" onChange={e => createForm.setFieldValue('code', e.target.value.toUpperCase())} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Quality Control" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editTarget !== null}
        title={`Edit — ${editTarget?.name}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editTarget && onEdit.mutate({ id: editTarget.id, v })}
         
        >
          <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
            <Input className="uppercase font-mono" onChange={e => editForm.setFieldValue('code', e.target.value.toUpperCase())} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
