import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Tooltip, message, Switch } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Pencil, FlaskConical, Search } from 'lucide-react'
import { adminApi, type LabOut } from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useServerTable } from '../../hooks/useServerTable'

export default function LabsPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LabOut | null>(null)
  const [filterDept, setFilterDept] = useState<string | undefined>()
  const [filterActive, setFilterActive] = useState<string | undefined>()
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const { data: depts = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: adminApi.listDepts,
  })

  const deptOptions = depts
    .filter((d) => d.is_active)
    .map((d) => ({ value: d.id, label: d.name }))

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listLabsPaged(params),
    [],
  )
  const filters = useMemo(() => ({
    ...(filterDept && { department_id: filterDept }),
    ...(filterActive !== undefined && { is_active: filterActive }),
  }), [filterDept, filterActive])
  const { loading: isLoading, searchInput: search, setSearchInput: setSearch, tableProps, reload } =
    useServerTable<LabOut>(fetcher, { filters })

  const inv = () => { qc.invalidateQueries({ queryKey: ['labs'] }); reload() }

  const onCreate = useMutation({
    mutationFn: adminApi.createLab,
    onSuccess: () => {
      inv()
      setCreateOpen(false)
      createForm.resetFields()
      msg.success('Lab created.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onEdit = useMutation({
    mutationFn: ({ id, v }: { id: string; v: Record<string, unknown> }) =>
      adminApi.updateLab(id, v as Parameters<typeof adminApi.updateLab>[1]),
    onSuccess: () => {
      inv()
      setEditTarget(null)
      msg.success('Lab updated.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const onToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminApi.updateLab(id, { is_active }),
    onSuccess: () => inv(),
  })

  const openEdit = (l: LabOut) => {
    setEditTarget(l)
    editForm.setFieldsValue({
      code: l.code,
      name: l.name,
      department_id: l.department_id,
      description: l.description,
    })
  }

  const columns: ColumnsType<LabOut> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: '15%',
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{String(v).toUpperCase()}</span>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      width: '25%',
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      width: '25%',
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Users',
      dataIndex: 'user_count',
      width: '10%',
      align: 'center',
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: '10%',
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
      width: '15%',
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Edit">
          <Button
            type="text"
            size="small"
            icon={<Pencil size={13} />}
            onClick={() => openEdit(record)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      {ctx}

      {/* Toolbar */}
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search labs…"
          className="rounded-md"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          value={filterDept}
          onChange={(v) => setFilterDept(v)}
          placeholder="All Departments"
          allowClear
          style={{ minWidth: 160 }}
          options={deptOptions}
        />
        <Select
          value={filterActive}
          onChange={(v) => setFilterActive(v)}
          placeholder="All Status"
          allowClear
          style={{ minWidth: 130 }}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
        />
        <Button
          type="primary"
          icon={<FlaskConical size={14} />}
          onClick={() => { setCreateOpen(true); createForm.resetFields() }}
          className="rounded-md font-medium"
        >
          New Lab
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
          scroll={{ x: 800 }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        closable={false}
        title="New Lab"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Create"
        confirmLoading={onCreate.isPending}
        width={480}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={createForm} layout="vertical" onFinish={(v) => onCreate.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
            <Input
              placeholder="e.g. DS-LAB-01"
              className="uppercase"
              onChange={(e) => createForm.setFieldValue('code', e.target.value.toUpperCase())}
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Drug Substance Conjugation Lab" />
          </Form.Item>
          <Form.Item name="department_id" label="Department" rules={[{ required: true }]}>
            <Select
              placeholder="Select department"
              options={deptOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editTarget !== null}
        closable={false}
        title={`Edit — ${editTarget?.name}`}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save Changes"
        confirmLoading={onEdit.isPending}
        width={480}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(v) => editTarget && onEdit.mutate({ id: editTarget.id, v })}
        >
          <Form.Item
            name="code"
            label="Code"
            extra="Code can't be changed after creation."
          >
            <Input disabled className="uppercase" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department_id" label="Department" rules={[{ required: true }]}>
            <Select
              placeholder="Select department"
              options={deptOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
