import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Space, Tooltip, message, Switch } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, Trash2, ShieldCheck, Search } from 'lucide-react'
import { adminApi, type Role } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

export default function RolesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Role | null>(null)
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string | undefined>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles', true],
    queryFn: () => adminApi.listRoles(true),
  })

  const filtered = roles.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.code.toLowerCase().includes(search.toLowerCase())) return false
    if (filterActive !== undefined && String(r.is_active) !== filterActive) return false
    return true
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['roles'] })

  const onCreate = useMutation({
    mutationFn: adminApi.createRole,
    onSuccess: () => { inv(); setCreateOpen(false); createForm.resetFields(); msg.success('Role created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: { name?: string; description?: string } }) =>
      adminApi.updateRole(id, v),
    onSuccess: () => { inv(); setEditTarget(null); msg.success('Role updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateRole(id, { is_active }),
    onSuccess: () => inv(),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Cannot change status.'),
  })

  const onDelete = useMutation({
    mutationFn: adminApi.deleteRole,
    onSuccess: () => { inv(); msg.success('Role deactivated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (r: Role) => {
    setEditTarget(r)
    editForm.setFieldsValue({ name: r.name, description: r.description })
  }

  const confirmDelete = (r: Role) => {
    Modal.confirm({
      title: `Deactivate "${r.name}"?`,
      content: r.user_count > 0
        ? `This role has ${r.user_count} active user(s). Reassign them first.`
        : 'This will deactivate the role.',
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      centered: true,
      styles: glassModalStyles,
      onOk: () => onDelete.mutate(r.id),
    })
  }

  const columns: ColumnsType<Role> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 130,
      render: (v) => (
        <StatusTag color="purple" className="font-mono text-[13px]">{v}</StatusTag>
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
      width: 80,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Deactivate">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={13} />}
              disabled={!record.is_active}
              onClick={() => confirmDelete(record)}
            />
          </Tooltip>
        </Space>
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
          placeholder="Search roles…"
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
          icon={<ShieldCheck size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          New Role
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} roles` }}
        />
      </div>

      {/* Create */}
      <Modal
        open={createOpen}
        title="New Role"
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
            <Input placeholder="e.g. ANALYST" className="uppercase font-mono" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Analyst" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit */}
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
