import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Form, Input, Select, Space, Tooltip, message, Switch } from 'antd'
import { AdminModal } from '../../components/ui/AdminModal'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, Building2, Search } from 'lucide-react'
import { adminApi, type DepartmentOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { useServerTable } from '../../hooks/useServerTable'

export default function DepartmentsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DepartmentOut | null>(null)
  const [filterActive, setFilterActive] = useState<string | undefined>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listDeptsPaged(params),
    [],
  )
  const filters = useMemo(
    () => (filterActive !== undefined ? { is_active: filterActive } : {}),
    [filterActive],
  )
  const { loading: isLoading, searchInput: search, setSearchInput: setSearch, tableProps, reload } =
    useServerTable<DepartmentOut>(fetcher, { filters })

  const inv = () => { qc.invalidateQueries({ queryKey: ['departments'] }); reload() }

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
      width: '20%',
      sorter: true,
      render: (v) => (
        <span className=" text-[13px] text-slate-800">
          {String(v).toUpperCase()}
        </span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      width: '20%',
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      width: '20%',
      align: 'center',
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: '20%',
      align: 'center',
      render: (v, record) => (
        <Tooltip title={v && record.user_count > 0 ? `Cannot deactivate — ${record.user_count} active user(s) in this department.` : undefined}>
          <Switch
            size="small"
            checked={v}
            disabled={v && record.user_count > 0}
            onChange={(checked) => onToggle.mutate({ id: record.id, is_active: checked })}
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: '20%',
      align: 'center',
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
          {...tableProps}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="middle"
          scroll={{ x: 700 }}
        />
      </div>

      {/* Create Modal */}
      <AdminModal
        open={createOpen}
        closable={false}
        title="New Department"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create"
        confirmLoading={onCreate.isPending}
        width={440}
        centered
        destroyOnHidden
        >
        <Form form={createForm} layout="vertical" onFinish={(v) => onCreate.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
            <Input placeholder="e.g. QC" className="uppercase  " onChange={e => createForm.setFieldValue('code', e.target.value.toUpperCase())} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Quality Control" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </AdminModal>

      {/* Edit Modal */}
      <AdminModal
        open={editTarget !== null}
        closable={false}
        title={`Edit — ${editTarget?.name}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={440}
        centered
        destroyOnHidden
        >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editTarget && onEdit.mutate({ id: editTarget.id, v })}
         
        >
          <Form.Item name="code" label="Code" extra="Code can't be changed after creation — it's used across access & workflow rules.">
            <Input disabled className="uppercase" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </AdminModal>
    </div>
  )
}
