import { useState, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, InputNumber,
  message, Tabs, Dropdown,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { Plus, Pencil, Trash2, Search, MoreVertical, Power, PowerOff } from 'lucide-react'
import {
  consumableTypeApi, equipmentTypeApi, instrumentTypeApi, columnTypeApi,
  type ConsumableType, type EquipType, type ColumnType,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'
import { useServerTable } from '../../hooks/useServerTable'
import { ApiError } from '../../api/client'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const filterBar = 'glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center'
const tableWrap = 'glass-card rounded-lg overflow-hidden'

// Search, sort and pagination are all server-side (see useServerTable): these
// tables previously fetched every row and narrowed them in the browser, so a
// search only matched what had already been downloaded and a column sorter
// reordered the visible page rather than the whole table.

async function toggleWithToast<T extends { message?: string | null }>(
  call: () => Promise<T>,
  reload: () => void,
) {
  try {
    const res = await call()
    message.success(res.message ?? 'Updated.')
    reload()
  } catch (e: unknown) {
    message.error(e instanceof ApiError ? e.detail : 'Failed to update status.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Consumable Types
// ─────────────────────────────────────────────────────────────────────────────
function ConsumableTypesTab() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConsumableType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => consumableTypeApi.listPaged(params),
    [],
  )
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<ConsumableType>(fetcher)

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: ConsumableType) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await consumableTypeApi.update(editing.id, values); message.success('Updated') }
      else { await consumableTypeApi.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await consumableTypeApi.delete(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const columns: ColumnsType<ConsumableType> = [
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', align: 'center',
      render: (v: boolean) => <StatusTag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</StatusTag>,
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          {
            key: 'toggle',
            label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
            icon: r.is_active ? <PowerOff size={12} /> : <Power size={12} />,
            danger: r.is_active,
          },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'toggle') toggleWithToast(() => consumableTypeApi.toggle(r.id), load)
          else if (key === 'delete') {
            Modal.confirm({
              title: 'Delete this type?',
              okText: 'Delete',
              okButtonProps: { danger: true },
              centered: true,
              onOk: () => handleDelete(r.id),
            })
          }
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]


  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Type</Button>
      </div>
      <div className={tableWrap}>
        <Table {...tableProps} columns={columns} rowKey="id" size="middle" tableLayout="fixed" />
      </div>
      <Modal title={editing ? 'Edit Consumable Type' : 'New Consumable Type'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Equipment/Instrument Type tab (reused for both)
// ─────────────────────────────────────────────────────────────────────────────
function EquipTypeTab({ api, label }: { api: typeof equipmentTypeApi; label: string }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => api.listPaged(params),
    [api],
  )
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<EquipType>(fetcher)

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: EquipType) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await api.update(editing.id, values); message.success('Updated') }
      else { await api.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<EquipType> = [
    { title: 'Code', dataIndex: 'code', ellipsis: true, sorter: true, render: v => <span className="  text-[13px] text-slate-800">{v}</span> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', align: 'center',
      render: (v: boolean) => <StatusTag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</StatusTag>,
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          {
            key: 'toggle',
            label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
            icon: r.is_active ? <PowerOff size={12} /> : <Power size={12} />,
            danger: r.is_active,
          },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'toggle') toggleWithToast(() => api.toggle(r.id), load)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]


  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search code / name…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New {label} Type</Button>
      </div>
      <div className={tableWrap}>
        <Table {...tableProps} columns={columns} rowKey="id" size="middle" tableLayout="fixed" />
      </div>
      <Modal title={editing ? `Edit ${label} Type` : `New ${label} Type`} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editing && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="uppercase  " /></Form.Item>}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Column Types
// ─────────────────────────────────────────────────────────────────────────────
function ColumnTypesTab() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ColumnType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => columnTypeApi.listPaged(params),
    [],
  )
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<ColumnType>(fetcher)

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: ColumnType) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await columnTypeApi.update(editing.id, values); message.success('Updated') }
      else { await columnTypeApi.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<ColumnType> = [
    { title: 'Code', dataIndex: 'code', ellipsis: true, sorter: true, render: v => <StatusTag color="purple" className="  text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Length (mm)', dataIndex: 'length_mm', ellipsis: true, sorter: true, render: v => v != null ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Particle (µm)', dataIndex: 'particle_size_um', ellipsis: true, sorter: true, render: v => v != null ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Pore (Å)', dataIndex: 'pore_size_angstrom', ellipsis: true, sorter: true, render: v => v != null ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    {
      title: 'Active', dataIndex: 'is_active', align: 'center',
      render: (v: boolean) => <StatusTag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</StatusTag>,
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          {
            key: 'toggle',
            label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
            icon: r.is_active ? <PowerOff size={12} /> : <Power size={12} />,
            danger: r.is_active,
          },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'toggle') toggleWithToast(() => columnTypeApi.toggle(r.id), load)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]


  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search code / name…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Column Type</Button>
      </div>
      <div className={tableWrap}>
        <Table {...tableProps} columns={columns} rowKey="id" size="middle" tableLayout="fixed" />
      </div>
      <Modal title={editing ? 'Edit Column Type' : 'New Column Type'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editing && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="uppercase  " /></Form.Item>}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="length_mm" label="Length (mm)"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="particle_size_um" label="Particle (µm)"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="pore_size_angstrom" label="Pore (Å)"><InputNumber style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────
export default function MasterDataTypesPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        tabBarGutter={20}
        tabBarStyle={{ marginBottom: 0 }}
        items={[
          { key: 'consumable-types', label: 'Consumable Types', children: <ConsumableTypesTab /> },
          { key: 'equipment-types',  label: 'Equipment Types',  children: <EquipTypeTab api={equipmentTypeApi} label="Equipment" /> },
          { key: 'instrument-types', label: 'Instrument Types', children: <EquipTypeTab api={instrumentTypeApi} label="Instrument" /> },
          { key: 'column-types',     label: 'Column Types',     children: <ColumnTypesTab /> },
        ]}
      />
    </div>
  )
}
