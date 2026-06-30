import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Select, Modal, Form, message, Space, Tooltip, Popconfirm } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, PowerOff, Search, Building2 } from 'lucide-react'
import { manufacturerApi, type Manufacturer } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Manufacturer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (statusFilter === 'ACTIVE') params.active_only = true
      if (statusFilter === 'INACTIVE') params.inactive_only = true
      setManufacturers(await manufacturerApi.list(params))
    } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (m: Manufacturer) => { setEditing(m); form.setFieldsValue(m); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await manufacturerApi.update(editing.id, values)
        message.success('Manufacturer updated')
      } else {
        await manufacturerApi.create(values)
        message.success('Manufacturer created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id: number) => {
    try {
      await manufacturerApi.deactivate(id)
      message.success('Manufacturer deactivated')
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
  }

  const columns: ColumnsType<Manufacturer> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 110,
      render: (v) => <StatusTag color="purple" className="font-mono text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      width: 120,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      width: 150,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 200,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      width: 140,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 90,
      render: (v: boolean) => (
        <StatusTag color={v ? 'success' : 'default'} className="text-[13px]">{v ? 'Active' : 'Inactive'}</StatusTag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} />
          </Tooltip>
          {r.is_active && (
            <Popconfirm title="Deactivate this manufacturer?" onConfirm={() => handleDeactivate(r.id)}>
              <Tooltip title="Deactivate">
                <Button type="text" size="small" danger icon={<PowerOff size={13} />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search code / name…"
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
        <Button type="primary" icon={<Building2 size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Manufacturer
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={manufacturers}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} manufacturers` }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Manufacturer' : 'New Manufacturer'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={560}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="country" label="Country">
              <Input />
            </Form.Item>
            <Form.Item name="contact_person" label="Contact Person">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input type="email" />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="website" label="Website">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
