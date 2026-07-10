import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Input, Select, Modal, Form, InputNumber, DatePicker, Switch, message, Space, Tooltip, Tabs } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Search, QrCode, RefreshCw, Eye } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import dayjs from 'dayjs'
import {
  equipmentCatalogueApi, instrumentCatalogueApi, columnCatalogueApi,
  equipmentTypeApi, instrumentTypeApi, columnTypeApi,
  type EquipmentCatalogue, type InstrumentCatalogue, type ColumnCatalogue,
  type EquipType, type ColumnType,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

// Shared status vocab / colours (covers both new lifecycle values and legacy ACTIVE/INACTIVE)
export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', ACTIVE: 'green', IN_USE: 'blue', INSTALLED: 'cyan',
  CLEANING_PENDING: 'gold', UNDER_CLEANING: 'orange', UNDER_MAINTENANCE: 'orange',
  UNDER_CALIBRATION: 'orange', IDLE: 'default', INACTIVE: 'default', DECOMMISSIONED: 'red',
}
const MAINT_COLOR: Record<string, string> = { OK: 'green', DUE: 'orange', OVERDUE: 'red' }
const COL_STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', EXHAUSTED: 'red', RETIRED: 'default' }

const MAINT_STATUS_OPTIONS = ['OK', 'DUE', 'OVERDUE'].map(s => ({ value: s, label: s }))
const EQUIP_STATUSES = ['AVAILABLE', 'IN_USE', 'CLEANING_PENDING', 'UNDER_CLEANING', 'UNDER_MAINTENANCE', 'INSTALLED', 'DECOMMISSIONED']
const INSTR_STATUSES = ['AVAILABLE', 'IN_USE', 'UNDER_CALIBRATION', 'IDLE', 'DECOMMISSIONED']
const EQUIP_STATUS_OPTIONS = EQUIP_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))
const INSTR_STATUS_OPTIONS = INSTR_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))

// ── QR modal ─────────────────────────────────────────────────────────────────
function QrModal({ open, onClose, code, name }: { open: boolean; onClose: () => void; code: string | null; name?: string }) {
  return (
    <Modal open={open} closable={false} onCancel={onClose} footer={null} centered width={320} destroyOnHidden {...glassModalProps}>
      <div className="flex flex-col items-center gap-3 py-2">
        {code && <QRCodeSVG value={code} size={200} level="M" includeMargin />}
        <div className="text-center">
          <p className="font-mono font-semibold text-slate-800">{code}</p>
          {name && <p className="text-slate-500 text-sm">{name}</p>}
        </div>
      </div>
    </Modal>
  )
}

// ── Change-status modal ──────────────────────────────────────────────────────
function StatusModal({ open, onClose, current, options, onSave, saving }: {
  open: boolean; onClose: () => void; current: string | null
  options: { value: string; label: string }[]
  onSave: (status: string, remarks?: string) => void; saving: boolean
}) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.setFieldsValue({ status: current, remarks: undefined }) }, [open, current, form])
  return (
    <Modal title="Change Status" open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} centered width={420} destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={(v) => onSave(v.status, v.remarks)}>
        <Form.Item name="status" label="New Status" rules={[{ required: true }]}><Select options={options} /></Form.Item>
        <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}

// ── Equipment Tab ──────────────────────────────────────────────────────────────
function EquipmentTab() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EquipmentCatalogue[]>([])
  const [equipTypes, setEquipTypes] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [qr, setQr] = useState<EquipmentCatalogue | null>(null)
  const [statusTarget, setStatusTarget] = useState<EquipmentCatalogue | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

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

  const saveStatus = async (status: string, remarks?: string) => {
    if (!statusTarget) return
    setStatusSaving(true)
    try {
      await equipmentCatalogueApi.changeStatus(statusTarget.id, { status, remarks })
      message.success('Status updated')
      setStatusTarget(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setStatusSaving(false) }
  }

  const columns: ColumnsType<EquipmentCatalogue> = [
    { title: 'Equipment Code', ellipsis: true, dataIndex: 'asset_id', width: 150, render: (v, r) => <a className=" text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/equipment/${r.id}`)}>{v}</a> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Type', ellipsis: true, dataIndex: 'equipment_type_id', width: 130, render: v => { const t = equipTypes.find(x => x.id === v); return t ? <span className="text-[13px] text-slate-600">{t.name}</span> : <span className="text-[13px] text-slate-300">—</span> } },
    { title: 'Location', ellipsis: true, dataIndex: 'location', width: 130, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 110, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Make', ellipsis: true, dataIndex: 'make', width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 150, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{String(v).replace(/_/g, ' ')}</StatusTag> },
    {
      title: 'Action', key: 'actions', width: 140, align: 'right', render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View"><Button type="text" size="small" icon={<Eye size={14} />} onClick={() => navigate(`/inventory/equipment/${r.id}`)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Change Status"><Button type="text" size="small" icon={<RefreshCw size={13} />} onClick={() => setStatusTarget(r)} /></Tooltip>
          {/* <Tooltip title="QR Code"><Button type="text" size="small" icon={<QrCode size={14} />} onClick={() => setQr(r)} /></Tooltip> */}
        </Space>
      ),
    },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code / name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Status" allowClear style={{ minWidth: 190 }} value={statusFilter} onChange={setStatusFilter} options={EQUIP_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Equipment</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title={editing ? 'Edit Equipment' : 'New Equipment'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={640} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ movable: false }}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Equipment Code" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="equipment_type_id" label="Equipment Type">
              <Select allowClear showSearch optionFilterProp="label" options={equipTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="usage_type" label="Usage Type"><Input placeholder="e.g. MFG" /></Form.Item>
            <Form.Item name="make" label="Manufacturer / Make"><Input /></Form.Item>
            <Form.Item name="model" label="Model Name"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Location"><Input /></Form.Item>
            <Form.Item name="gross_capacity" label="Gross Capacity"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <Form.Item name="capacity_unit" label="Capacity Unit"><Input placeholder="e.g. Litres" /></Form.Item>
            <Form.Item name="movable" label="Movable" valuePropName="checked"><Switch /></Form.Item>
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
            <Form.Item name="description" label="Description" className="col-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <QrModal open={!!qr} onClose={() => setQr(null)} code={qr?.asset_id ?? null} name={qr?.name} />
      <StatusModal open={!!statusTarget} onClose={() => setStatusTarget(null)} current={statusTarget?.status ?? null} options={EQUIP_STATUS_OPTIONS} onSave={saveStatus} saving={statusSaving} />
    </div>
  )
}

// ── Instrument Tab ─────────────────────────────────────────────────────────────
function InstrumentTab() {
  const navigate = useNavigate()
  const [items, setItems] = useState<InstrumentCatalogue[]>([])
  const [instrTypes, setInstrTypes] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [qr, setQr] = useState<InstrumentCatalogue | null>(null)
  const [statusTarget, setStatusTarget] = useState<InstrumentCatalogue | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

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

  const saveStatus = async (status: string, remarks?: string) => {
    if (!statusTarget) return
    setStatusSaving(true)
    try {
      await instrumentCatalogueApi.changeStatus(statusTarget.id, { status, remarks })
      message.success('Status updated')
      setStatusTarget(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setStatusSaving(false) }
  }

  const columns: ColumnsType<InstrumentCatalogue> = [
    { title: 'Instrument Code', ellipsis: true, dataIndex: 'asset_id', width: 150, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/instruments/${r.id}`)}>{v}</a> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Type', ellipsis: true, dataIndex: 'instrument_type_id', width: 140, render: v => { const t = instrTypes.find(x => x.id === v); return t ? <span className="text-[13px] text-slate-600">{t.name}</span> : <span className="text-[13px] text-slate-300">—</span> } },
    { title: 'Make', ellipsis: true, dataIndex: 'make', width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 110, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Calibration', ellipsis: true, dataIndex: 'calibration_status', width: 110, render: v => <StatusTag color={MAINT_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 150, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{String(v).replace(/_/g, ' ')}</StatusTag> },
    {
      title: 'Action', key: 'actions', width: 140, align: 'right', render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View"><Button type="text" size="small" icon={<Eye size={14} />} onClick={() => navigate(`/inventory/instruments/${r.id}`)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Change Status"><Button type="text" size="small" icon={<RefreshCw size={13} />} onClick={() => setStatusTarget(r)} /></Tooltip>
          {/* <Tooltip title="QR Code"><Button type="text" size="small" icon={<QrCode size={14} />} onClick={() => setQr(r)} /></Tooltip> */}
        </Space>
      ),
    },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code / name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Status" allowClear style={{ minWidth: 190 }} value={statusFilter} onChange={setStatusFilter} options={INSTR_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Instrument</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title={editing ? 'Edit Instrument' : 'New Instrument'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={680} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ movable: false, required_calibration: false }}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Instrument Code" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="instrument_type_id" label="Instrument Type">
              <Select allowClear showSearch optionFilterProp="label" options={instrTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="usage_type" label="Usage Type"><Input placeholder="e.g. Common" /></Form.Item>
            <Form.Item name="make" label="Manufacturer / Make"><Input /></Form.Item>
            <Form.Item name="model" label="Model Name"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Location"><Input /></Form.Item>
            <Form.Item name="gross_capacity" label="Gross Capacity"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <Form.Item name="capacity_unit" label="Capacity Unit"><Input /></Form.Item>
            <Form.Item name="lower_operating_range" label="Lower Operating Range"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="lower_uom" label="Lower UOM"><Input /></Form.Item>
            <Form.Item name="upper_operating_range" label="Upper Operating Range"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="upper_uom" label="Upper UOM"><Input /></Form.Item>
            <Form.Item name="movable" label="Movable" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="required_calibration" label="Required Calibration" valuePropName="checked"><Switch /></Form.Item>
            {editing && (
              <>
                <Form.Item name="calibration_status" label="Calibration Status">
                  <Select options={MAINT_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="status" label="Instrument Status">
                  <Select options={INSTR_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="last_calibration_date" label="Last Calibration Date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
            <Form.Item name="next_calibration_date" label="Next Calibration Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="description" label="Description" className="col-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <QrModal open={!!qr} onClose={() => setQr(null)} code={qr?.asset_id ?? null} name={qr?.name} />
      <StatusModal open={!!statusTarget} onClose={() => setStatusTarget(null)} current={statusTarget?.status ?? null} options={INSTR_STATUS_OPTIONS} onSave={saveStatus} saving={statusSaving} />
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
    { title: 'Column ID', ellipsis: true, dataIndex: 'column_id', width: 130, render: v => <StatusTag color="cyan" className="font-mono text-[13px]">{v}</StatusTag> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Serial No', ellipsis: true, dataIndex: 'serial_no', width: 130, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Lot No', ellipsis: true, dataIndex: 'lot_no', width: 120, render: v => v ? <span className="font-mono text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Max Inj.', ellipsis: true, dataIndex: 'max_injections', width: 100, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Used', ellipsis: true, dataIndex: 'cumulative_injections', width: 80, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Remaining', ellipsis: true, dataIndex: 'injections_remaining', width: 100, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 110, render: v => <StatusTag color={COL_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
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

      <Modal title={editing ? 'Edit Column' : 'New Column'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
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
