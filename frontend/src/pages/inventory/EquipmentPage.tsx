import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Select, Modal, Form, InputNumber, DatePicker, message, Space, Tooltip, Tabs } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Search } from 'lucide-react'
import dayjs from 'dayjs'
import {
  equipmentCatalogueApi, instrumentCatalogueApi, columnCatalogueApi,
  equipmentTypeApi, instrumentTypeApi, columnTypeApi,
  type EquipmentCatalogue, type InstrumentCatalogue, type ColumnCatalogue,
  type EquipType, type ColumnType,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

const EQUIP_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', INACTIVE: 'default', UNDER_MAINTENANCE: 'orange', DECOMMISSIONED: 'red',
}
const MAINT_COLOR: Record<string, string> = { OK: 'green', DUE: 'orange', OVERDUE: 'red' }
const COL_STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', EXHAUSTED: 'red', RETIRED: 'default' }

const MAINT_STATUS_OPTIONS = ['OK', 'DUE', 'OVERDUE'].map(s => ({ value: s, label: s }))
const EQUIP_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'DECOMMISSIONED'].map(s => ({ value: s, label: s }))

// ── Equipment Tab ──────────────────────────────────────────────────────────────
function EquipmentTab() {
  const [items, setItems] = useState<EquipmentCatalogue[]>([])
  const [equipTypes, setEquipTypes] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      setItems(await equipmentCatalogueApi.list(params))
    } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { equipmentTypeApi.list().then(setEquipTypes) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: EquipmentCatalogue) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      last_maintenance_date: r.last_maintenance_date ? dayjs(r.last_maintenance_date) : null,
      next_maintenance_date: r.next_maintenance_date ? dayjs(r.next_maintenance_date) : null,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        last_maintenance_date: values.last_maintenance_date
          ? dayjs(values.last_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        next_maintenance_date: values.next_maintenance_date
          ? dayjs(values.next_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await equipmentCatalogueApi.update(editing.id, payload)
        message.success('Equipment updated')
      } else {
        await equipmentCatalogueApi.create(payload)
        message.success('Equipment created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<EquipmentCatalogue> = [
    { title: 'Asset ID', dataIndex: 'asset_id', width: 130, render: v => <span className="font-mono text-[13px] text-slate-700">{v}</span> },
    { title: 'Name', dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Make', dataIndex: 'make', width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Model', dataIndex: 'model', width: 130, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Serial No', dataIndex: 'serial_no', width: 130, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Location', dataIndex: 'location', width: 130, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Maintenance', dataIndex: 'maintenance_status', width: 120, render: v => <span className="text-[13px] text-slate-700">{v ?? '—'}</span> },
    { title: 'Status', dataIndex: 'status', width: 110, render: v => <StatusTag color={EQUIP_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Next Maintenance', dataIndex: 'next_maintenance_date', width: 140, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: '', key: 'actions', width: 60, align: 'right', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip> },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset ID / name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Status" allowClear style={{ minWidth: 180 }} value={statusFilter} onChange={setStatusFilter} options={EQUIP_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Equipment</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title={editing ? 'Edit Equipment' : 'New Equipment'} open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={580} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Asset ID" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="equipment_type_id" label="Equipment Type">
              <Select allowClear showSearch optionFilterProp="label" options={equipTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="make" label="Make"><Input /></Form.Item>
            <Form.Item name="model" label="Model"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Location"><Input /></Form.Item>
            {editing && (
              <>
                <Form.Item name="maintenance_status" label="Maintenance Status">
                  <Select options={MAINT_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="status" label="Equipment Status">
                  <Select options={EQUIP_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="last_maintenance_date" label="Last Maintenance Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
            <Form.Item name="next_maintenance_date" label="Next Maintenance Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instrument Tab ─────────────────────────────────────────────────────────────
function InstrumentTab() {
  const [items, setItems] = useState<InstrumentCatalogue[]>([])
  const [instrTypes, setInstrTypes] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      setItems(await instrumentCatalogueApi.list(params))
    } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { instrumentTypeApi.list().then(setInstrTypes) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: InstrumentCatalogue) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      last_calibration_date: r.last_calibration_date ? dayjs(r.last_calibration_date) : null,
      next_calibration_date: r.next_calibration_date ? dayjs(r.next_calibration_date) : null,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        last_calibration_date: values.last_calibration_date
          ? dayjs(values.last_calibration_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        next_calibration_date: values.next_calibration_date
          ? dayjs(values.next_calibration_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await instrumentCatalogueApi.update(editing.id, payload)
        message.success('Instrument updated')
      } else {
        await instrumentCatalogueApi.create(payload)
        message.success('Instrument created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<InstrumentCatalogue> = [
    { title: 'Asset ID', dataIndex: 'asset_id', width: 130, render: v => <StatusTag color="blue" className="font-mono text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Make', dataIndex: 'make', width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Model', dataIndex: 'model', width: 130, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Serial No', dataIndex: 'serial_no', width: 130, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Location', dataIndex: 'location', width: 130, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Calibration', dataIndex: 'calibration_status', width: 120, render: v => <StatusTag color={MAINT_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Status', dataIndex: 'status', width: 110, render: v => <StatusTag color={EQUIP_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Next Calibration', dataIndex: 'next_calibration_date', width: 140, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: '', key: 'actions', width: 60, align: 'right', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip> },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search asset ID / name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Status" allowClear style={{ minWidth: 180 }} value={statusFilter} onChange={setStatusFilter} options={EQUIP_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Instrument</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title={editing ? 'Edit Instrument' : 'New Instrument'} open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={580} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Asset ID" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="instrument_type_id" label="Instrument Type">
              <Select allowClear showSearch optionFilterProp="label" options={instrTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="make" label="Make"><Input /></Form.Item>
            <Form.Item name="model" label="Model"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Location"><Input /></Form.Item>
            {editing && (
              <>
                <Form.Item name="calibration_status" label="Calibration Status">
                  <Select options={MAINT_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="status" label="Instrument Status">
                  <Select options={EQUIP_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="last_calibration_date" label="Last Calibration Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
            <Form.Item name="next_calibration_date" label="Next Calibration Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Column Tab ─────────────────────────────────────────────────────────────────
function ColumnTab() {
  const [items, setItems] = useState<ColumnCatalogue[]>([])
  const [colTypes, setColTypes] = useState<ColumnType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ColumnCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      setItems(await columnCatalogueApi.list(params))
    } finally { setLoading(false) }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { columnTypeApi.list().then(setColTypes) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: ColumnCatalogue) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await columnCatalogueApi.update(editing.id, values)
        message.success('Column updated')
      } else {
        await columnCatalogueApi.create(values)
        message.success('Column created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<ColumnCatalogue> = [
    { title: 'Column ID', dataIndex: 'column_id', width: 130, render: v => <StatusTag color="cyan" className="font-mono text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Serial No', dataIndex: 'serial_no', width: 130, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Lot No', dataIndex: 'lot_no', width: 120, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Max Inj.', dataIndex: 'max_injections', width: 100, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Used', dataIndex: 'cumulative_injections', width: 80, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Remaining', dataIndex: 'injections_remaining', width: 100, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Status', dataIndex: 'status', width: 110, render: v => <StatusTag color={COL_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: '', key: 'actions', width: 60, align: 'right', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip> },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search column ID / name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Status" allowClear style={{ minWidth: 140 }} value={statusFilter} onChange={setStatusFilter} options={['ACTIVE', 'EXHAUSTED', 'RETIRED'].map(s => ({ value: s, label: s }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Column</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} columns` }} />
      </div>

      <Modal title={editing ? 'Edit Column' : 'New Column'} open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="column_id" label="Column ID" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="column_type_id" label="Column Type">
              <Select allowClear showSearch optionFilterProp="label" options={colTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="lot_no" label="Lot No"><Input /></Form.Item>
            <Form.Item name="max_injections" label="Max Injections" initialValue={500}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            {editing && (
              <Form.Item name="status" label="Status">
                <Select options={['ACTIVE', 'EXHAUSTED', 'RETIRED'].map(s => ({ value: s, label: s }))} />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        items={[
          { key: 'equipment', label: 'Equipment', children: <EquipmentTab /> },
          { key: 'instruments', label: 'Instruments', children: <InstrumentTab /> },
          { key: 'columns', label: 'Columns', children: <ColumnTab /> },
        ]}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarGutter={24}
      />
    </div>
  )
}
