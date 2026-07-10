import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Select, Modal, Form, InputNumber,
  message, Space, Tooltip, Switch, Tabs, Popconfirm, Collapse,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2, Search, FlaskConical, Microscope, MapPin } from 'lucide-react'
import {
  consumableTypeApi, equipmentTypeApi, instrumentTypeApi, columnTypeApi,
  lookupApi, uomApi, testMasterApi, storageConditionApi, measurementMasterApi, sparePartApi,
  type ConsumableType, type EquipType, type ColumnType,
  type Lookup, type UomDimension, type UomUnit,
  type TestType, type TestName, type StorageCondition, type MeasurementMaster, type SparePart,
} from '../../api/inventory'
import {
  adminApi,
  type LookupChemical, type LookupInstrument, type LookupSite,
} from '../../api/admin'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'

const STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' }, { value: 'Due', label: 'Due' },
  { value: 'Overdue', label: 'Overdue' }, { value: 'NA', label: 'NA' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const filterBar = 'glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center'
const tableWrap = 'glass-card rounded-lg overflow-hidden'

// ── Chemicals tab ──────────────────────────────────────────────────────────────
function ChemicalsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupChemical | null>(null)

  const { data = [], isLoading } = useQuery({ queryKey: ['chemicals', true], queryFn: () => adminApi.listChemicals(true) })
  const inv = () => qc.invalidateQueries({ queryKey: ['chemicals'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => editTarget ? adminApi.updateChemical(editTarget.id, v as Parameters<typeof adminApi.updateChemical>[1]) : adminApi.createChemical(v as Parameters<typeof adminApi.createChemical>[0]),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateChemical(id, { is_active }),
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteChemical,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (r: LookupChemical) => { setEditTarget(r); form.setFieldsValue(r); setOpen(true) }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupChemical) => Modal.confirm({ title: `Delete "${r.chemical_name}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const columns: ColumnsType<LookupChemical> = [
    { title: 'Chemical Name', dataIndex: 'chemical_name', ellipsis: true, render: v => <span className="font-medium text-slate-800">{v}</span> },
    { title: 'CAS No.', dataIndex: 'cas_no', ellipsis: true, responsive: ['lg'], render: v => <span className="font-mono text-xs text-slate-500">{v ?? '—'}</span> },
    { title: 'Formula', dataIndex: 'formula', ellipsis: true, responsive: ['md'], render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Mol. Wt', dataIndex: 'mol_wt', ellipsis: true, width: 90, align: 'right', responsive: ['lg'], render: v => v != null ? <span>{Number(v).toFixed(2)}</span> : <span className="text-slate-300">—</span> },
    { title: 'Purity%', dataIndex: 'purity_pct', ellipsis: true, width: 80, align: 'right', responsive: ['lg'], render: v => v != null ? <span>{v}%</span> : <span className="text-slate-300">—</span> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, responsive: ['md'], render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={c => toggle.mutate({ id: r.id, is_active: c })} /> },
    { title: '', key: 'actions', width: 70, align: 'right', render: (_, r) => <Space size={4}><Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip><Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip></Space> },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}><Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Chemical</Button></div>
      <div className={tableWrap}><Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} /></div>
      <Modal open={open} closable={false} title={editTarget ? `Edit — ${editTarget.chemical_name}` : 'Add Chemical'} onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()} okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending} width={520} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          <Form.Item name="chemical_name" label="Chemical Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="cas_no" label="CAS No."><Input placeholder="e.g. 75-05-8" /></Form.Item>
            <Form.Item name="formula" label="Formula"><Input /></Form.Item>
            <Form.Item name="mol_wt" label="Mol. Wt (g/mol)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="purity_pct" label="Purity %"><InputNumber min={0} max={100} className="w-full" /></Form.Item>
            <Form.Item name="density" label="Density (g/mL)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="vendor_name" label="Vendor"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instruments (Admin lookup) tab ─────────────────────────────────────────────
function AdminInstrumentsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupInstrument | null>(null)

  const { data = [], isLoading } = useQuery({ queryKey: ['lookup-instruments', true], queryFn: () => adminApi.listInstruments(true) })
  const inv = () => qc.invalidateQueries({ queryKey: ['lookup-instruments'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => editTarget ? adminApi.updateInstrument(editTarget.id, v as Parameters<typeof adminApi.updateInstrument>[1]) : adminApi.createInstrument(v as Parameters<typeof adminApi.createInstrument>[0]),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateInstrument(id, { is_active }),
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteInstrument,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const statusColor = (v: string | null) => ({ OK: 'success', Due: 'warning', Overdue: 'error', NA: 'default' }[v ?? ''] ?? 'default')
  const openEdit = (r: LookupInstrument) => { setEditTarget(r); form.setFieldsValue(r); setOpen(true) }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupInstrument) => Modal.confirm({ title: `Delete "${r.instrument_name}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const columns: ColumnsType<LookupInstrument> = [
    { title: 'Code', dataIndex: 'instrument_code', ellipsis: true, width: 110, render: v => <StatusTag color="purple" className="font-mono text-xs">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'instrument_name', ellipsis: true, render: v => <span className="font-medium text-slate-800">{v}</span> },
    { title: 'Type', dataIndex: 'instrument_type', ellipsis: true, responsive: ['md'], render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Maintenance', dataIndex: 'maintenance_status', ellipsis: true, width: 110, responsive: ['lg'], render: v => v ? <StatusTag color={statusColor(v)}>{v}</StatusTag> : <span className="text-slate-300">—</span> },
    { title: 'Calibration', dataIndex: 'calibration_status', ellipsis: true, width: 110, responsive: ['lg'], render: v => v ? <StatusTag color={statusColor(v)}>{v}</StatusTag> : <span className="text-slate-300">—</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={c => toggle.mutate({ id: r.id, is_active: c })} /> },
    { title: '', key: 'actions', width: 70, align: 'right', render: (_, r) => <Space size={4}><Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip><Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip></Space> },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}><Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Instrument</Button></div>
      <div className={tableWrap}><Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} /></div>
      <Modal open={open} closable={false} title={editTarget ? `Edit — ${editTarget.instrument_name}` : 'Add Instrument'} onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()} okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          {!editTarget && <Form.Item name="instrument_code" label="Code" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>}
          <Form.Item name="instrument_name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="instrument_type" label="Type"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="maintenance_status" label="Maintenance Status"><Select placeholder="Select" allowClear options={STATUS_OPTIONS} /></Form.Item>
            <Form.Item name="calibration_status" label="Calibration Status"><Select placeholder="Select" allowClear options={STATUS_OPTIONS} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Sites tab ──────────────────────────────────────────────────────────────────
function SitesTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupSite | null>(null)

  const { data = [], isLoading } = useQuery({ queryKey: ['sites', true], queryFn: () => adminApi.listSites(true) })
  const inv = () => qc.invalidateQueries({ queryKey: ['sites'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => editTarget ? adminApi.updateSite(editTarget.id, v as Parameters<typeof adminApi.updateSite>[1]) : adminApi.createSite(v as Parameters<typeof adminApi.createSite>[0]),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateSite(id, { is_active }),
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteSite,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (r: LookupSite) => { setEditTarget(r); form.setFieldsValue({ name: r.name }); setOpen(true) }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupSite) => Modal.confirm({ title: `Delete "${r.name}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const columns: ColumnsType<LookupSite> = [
    { title: 'Code', dataIndex: 'code', ellipsis: true, width: 100, render: v => <StatusTag color="purple" className="font-mono text-xs font-bold">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="font-medium text-slate-800">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={c => toggle.mutate({ id: r.id, is_active: c })} /> },
    { title: '', key: 'actions', width: 70, align: 'right', render: (_, r) => <Space size={4}><Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip><Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip></Space> },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}><Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Site</Button></div>
      <div className={tableWrap}><Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} /></div>
      <Modal open={open} closable={false} title={editTarget ? `Edit — ${editTarget.name}` : 'Add Site'} onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()} okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          {!editTarget && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>}
          <Form.Item name="name" label="Site Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Consumable Types
// ─────────────────────────────────────────────────────────────────────────────
function ConsumableTypesTab() {
  const [rows, setRows] = useState<ConsumableType[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ConsumableType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await consumableTypeApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

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
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Sort', dataIndex: 'sort_order', ellipsis: true, width: 70, align: 'center', render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    { title: 'Status', dataIndex: 'is_active', ellipsis: true, width: 90, render: v => <StatusTag color={v ? 'success' : 'default'} className="text-[13px]">{v ? 'Active' : 'Inactive'}</StatusTag> },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="Delete this type?" onConfirm={() => handleDelete(r.id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Type</Button>
      </div>
      <div className={tableWrap}>
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editing ? 'Edit Consumable Type' : 'New Consumable Type'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generic Equipment/Instrument Type tab (reused for both)
// ─────────────────────────────────────────────────────────────────────────────
function EquipTypeTab({ api, label }: { api: typeof equipmentTypeApi; label: string }) {
  const [rows, setRows] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await api.list()) } finally { setLoading(false) }
  }, [api])
  useEffect(() => { load() }, [load])

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
    { title: 'Code', dataIndex: 'code', ellipsis: true, width: 120, render: v => <span className="font-mono text-[13px] text-slate-700">{v}</span> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 80, align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={() => api.toggle(r.id).then(load)} />,
    },
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>,
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New {label} Type</Button>
      </div>
      <div className={tableWrap}>
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editing ? `Edit ${label} Type` : `New ${label} Type`} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editing && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Column Types
// ─────────────────────────────────────────────────────────────────────────────
function ColumnTypesTab() {
  const [rows, setRows] = useState<ColumnType[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ColumnType | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await columnTypeApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

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
    { title: 'Code', dataIndex: 'code', ellipsis: true, width: 120, render: v => <StatusTag color="purple" className="font-mono text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Length (mm)', dataIndex: 'length_mm', ellipsis: true, width: 110, render: v => v != null ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Particle (µm)', dataIndex: 'particle_size_um', ellipsis: true, width: 110, render: v => v != null ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Pore (Å)', dataIndex: 'pore_size_angstrom', ellipsis: true, width: 100, render: v => v != null ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 80, align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={() => columnTypeApi.toggle(r.id).then(load)} />,
    },
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>,
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Column Type</Button>
      </div>
      <div className={tableWrap}>
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editing ? 'Edit Column Type' : 'New Column Type'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {!editing && <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>}
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
// 4. UOM Master
// ─────────────────────────────────────────────────────────────────────────────
function UomTab() {
  const [dims, setDims] = useState<UomDimension[]>([])
  const [loading, setLoading] = useState(false)
  const [dimModal, setDimModal] = useState(false)
  const [unitModal, setUnitModal] = useState(false)
  const [selDim, setSelDim] = useState<UomDimension | null>(null)
  const [saving, setSaving] = useState(false)
  const [dimForm] = Form.useForm()
  const [unitForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setDims(await uomApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleDimSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try { await uomApi.create(values); message.success('Dimension created'); setDimModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleUnitSave = async (values: Record<string, unknown>) => {
    if (!selDim) return
    setSaving(true)
    try { await uomApi.createUnit(selDim.id, values); message.success('Unit added'); setUnitModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const unitColumns: ColumnsType<UomUnit> = [
    { title: 'Symbol', dataIndex: 'symbol', ellipsis: true, width: 90, render: v => <StatusTag color="blue" className="font-mono text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-700">{v}</span> },
    { title: 'Sort', dataIndex: 'sort_order', ellipsis: true, width: 60, align: 'center', render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', width: 80, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => uomApi.toggleUnit(r.id).then(load)} /> },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { dimForm.resetFields(); setDimModal(true) }} className="rounded-md font-medium">New Dimension</Button>
      </div>
      <div className={tableWrap}>
        <Collapse
          ghost
          items={dims.map(d => ({
            key: d.id,
            label: (
              <div className="flex items-center gap-3">
                <StatusTag color="violet" className="font-mono text-[13px]">{d.dimension_key}</StatusTag>
                <span className="text-[13px] text-slate-800 font-medium">{d.display_name}</span>
                <span className="text-[11px] text-slate-400 ml-1">base: {d.base_unit}</span>
                <span onClick={e => e.stopPropagation()} className="ml-auto"><Switch size="small" checked={d.is_active} onChange={() => uomApi.toggle(d.id).then(load)} /></span>
              </div>
            ),
            children: (
              <div className="pl-4">
                <div className="mb-2 flex justify-end">
                  <Button size="small" icon={<Plus size={12} />} onClick={() => { setSelDim(d); unitForm.resetFields(); setUnitModal(true) }}>Add Unit</Button>
                </div>
                <Table dataSource={d.units} columns={unitColumns} rowKey="id" size="small" pagination={false} />
              </div>
            ),
          }))}
        />
      </div>
      <Modal title="New Dimension" open={dimModal} closable={false} onCancel={() => setDimModal(false)} onOk={() => dimForm.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={dimForm} layout="vertical" onFinish={handleDimSave}>
          <Form.Item name="dimension_key" label="Dimension Key" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>
          <Form.Item name="display_name" label="Display Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="base_unit" label="Base Unit" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Unit to ${selDim?.display_name}`} open={unitModal} closable={false} onCancel={() => setUnitModal(false)} onOk={() => unitForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={unitForm} layout="vertical" onFinish={handleUnitSave}>
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}><Input className="font-mono" /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Lookup Master
// ─────────────────────────────────────────────────────────────────────────────
function LookupTab() {
  const [rows, setRows] = useState<Lookup[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lookup | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (typeFilter) params.lookup_type = typeFilter
      setRows(await lookupApi.list(params))
    } finally { setLoading(false) }
  }, [typeFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { lookupApi.types().then(setTypes) }, [])

  const filtered = search ? rows.filter(r => r.lookup_value.toLowerCase().includes(search.toLowerCase()) || r.lookup_code.toLowerCase().includes(search.toLowerCase())) : rows

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: Lookup) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await lookupApi.update(editing.id, values); message.success('Updated') }
      else { await lookupApi.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<Lookup> = [
    { title: 'Type', dataIndex: 'lookup_type', ellipsis: true, width: 160, render: v => <StatusTag color="geekblue" className="text-[13px]">{v}</StatusTag> },
    { title: 'Value', dataIndex: 'lookup_value', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Code', dataIndex: 'lookup_code', ellipsis: true, width: 120, render: v => <span className="font-mono text-[13px] text-slate-600">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', width: 80, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => lookupApi.toggle(r.id).then(load)} /> },
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>,
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search value / code…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Types" allowClear style={{ minWidth: 180 }} value={typeFilter} onChange={setTypeFilter} options={types.map(t => ({ value: t, label: t }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Lookup</Button>
      </div>
      <div className={tableWrap}>
        <Table dataSource={filtered} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20, showTotal: t => `${t} entries` }} />
      </div>
      <Modal title={editing ? 'Edit Lookup' : 'New Lookup'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="lookup_type" label="Type" rules={[{ required: true }]}>
            <Select showSearch allowClear options={types.map(t => ({ value: t, label: t }))} dropdownRender={menu => <>{menu}</>} />
          </Form.Item>
          <Form.Item name="lookup_value" label="Value" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="lookup_code" label="Code" rules={[{ required: true }]}><Input className="font-mono" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Test Master
// ─────────────────────────────────────────────────────────────────────────────
function TestMasterTab() {
  const [types, setTypes] = useState<TestType[]>([])
  const [loading, setLoading] = useState(false)
  const [typeModal, setTypeModal] = useState(false)
  const [nameModal, setNameModal] = useState(false)
  const [methodModal, setMethodModal] = useState(false)
  const [selType, setSelType] = useState<TestType | null>(null)
  const [selName, setSelName] = useState<TestName | null>(null)
  const [saving, setSaving] = useState(false)
  const [typeForm] = Form.useForm()
  const [nameForm] = Form.useForm()
  const [methodForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setTypes(await testMasterApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleTypeSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try { await testMasterApi.create(values); message.success('Test type created'); setTypeModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleNameSave = async (values: Record<string, unknown>) => {
    if (!selType) return
    setSaving(true)
    try { await testMasterApi.createName(selType.type_key, values); message.success('Test name added'); setNameModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleMethodSave = async (values: Record<string, unknown>) => {
    if (!selName) return
    setSaving(true)
    try { await testMasterApi.createMethod(selName.id, values); message.success('Method added'); setMethodModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDeleteName = async (id: number) => {
    try { await testMasterApi.deleteName(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const handleDeleteMethod = async (id: number) => {
    try { await testMasterApi.deleteMethod(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { typeForm.resetFields(); setTypeModal(true) }} className="rounded-md font-medium">New Test Type</Button>
      </div>
      <div className={tableWrap}>
        {loading ? <div className="p-8 text-center text-slate-400 text-[13px]">Loading…</div> : (
          <Collapse ghost items={types.map(tt => ({
            key: tt.id,
            label: (
              <div className="flex items-center gap-3">
                <StatusTag color="cyan" className="font-mono text-[13px]">{tt.type_key}</StatusTag>
                <span className="text-[13px] text-slate-800 font-medium">{tt.name}</span>
                <Button size="small" icon={<Plus size={12} />} className="ml-auto" onClick={e => { e.stopPropagation(); setSelType(tt); nameForm.resetFields(); setNameModal(true) }}>Add Name</Button>
              </div>
            ),
            children: (
              <div className="pl-4 space-y-2">
                {tt.names.length === 0 && <p className="text-[12px] text-slate-400 italic">No test names yet.</p>}
                {tt.names.map(tn => (
                  <div key={tn.id} className="glass-card rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] text-slate-700 font-medium">{tn.name}</span>
                      <div className="ml-auto flex gap-1">
                        <Button size="small" icon={<Plus size={11} />} onClick={() => { setSelName(tn); methodForm.resetFields(); setMethodModal(true) }}>Method</Button>
                        <Popconfirm title="Delete this test name?" onConfirm={() => handleDeleteName(tn.id)}>
                          <Button type="text" size="small" danger icon={<Trash2 size={12} />} />
                        </Popconfirm>
                      </div>
                    </div>
                    {tn.methods.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tn.methods.map(m => (
                          <div key={m.id} className="flex items-center gap-1">
                            <StatusTag className="text-[12px]">{m.method_name}</StatusTag>
                            <Popconfirm title="Delete method?" onConfirm={() => handleDeleteMethod(m.id)}>
                              <button className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            </Popconfirm>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ),
          }))} />
        )}
      </div>
      <Modal title="New Test Type" open={typeModal} closable={false} onCancel={() => setTypeModal(false)} onOk={() => typeForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={typeForm} layout="vertical" onFinish={handleTypeSave}>
          <Form.Item name="type_key" label="Type Key" rules={[{ required: true }]}><Input className="uppercase font-mono" /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Test Name to "${selType?.name}"`} open={nameModal} closable={false} onCancel={() => setNameModal(false)} onOk={() => nameForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={nameForm} layout="vertical" onFinish={handleNameSave}>
          <Form.Item name="name" label="Test Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Method to "${selName?.name}"`} open={methodModal} closable={false} onCancel={() => setMethodModal(false)} onOk={() => methodForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={methodForm} layout="vertical" onFinish={handleMethodSave}>
          <Form.Item name="method_name" label="Method Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Storage Master
// ─────────────────────────────────────────────────────────────────────────────
function StorageMasterTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StorageCondition | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['storage-conditions'],
    queryFn: storageConditionApi.list,
  })
  const inv = () => qc.invalidateQueries({ queryKey: ['storage-conditions'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      editTarget
        ? storageConditionApi.update(editTarget.id, v)
        : storageConditionApi.create(v),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: storageConditionApi.toggle,
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: storageConditionApi.delete,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openCreate = () => { setEditTarget(null); form.resetFields(); form.setFieldsValue({ temperature_unit: '°C' }); setOpen(true) }
  const openEdit = (r: StorageCondition) => {
    setEditTarget(r)
    form.setFieldsValue({
      label: r.label,
      temperature_min: r.temperature_min,
      temperature_max: r.temperature_max,
      temperature_unit: r.temperature_unit,
      description: r.description,
      sort_order: r.sort_order,
    })
    setOpen(true)
  }
  const confirmDel = (r: StorageCondition) =>
    Modal.confirm({ title: `Delete "${r.label}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const tempDisplay = (r: StorageCondition) => {
    if (r.temperature_min == null && r.temperature_max == null) return <span className="text-slate-300">—</span>
    if (r.temperature_min != null && r.temperature_max != null)
      return <span className="font-mono text-[13px] text-slate-700">{r.temperature_min} to {r.temperature_max} {r.temperature_unit}</span>
    if (r.temperature_min != null)
      return <span className="font-mono text-[13px] text-slate-700">≥ {r.temperature_min} {r.temperature_unit}</span>
    return <span className="font-mono text-[13px] text-slate-700">≤ {r.temperature_max} {r.temperature_unit}</span>
  }

  const columns: ColumnsType<StorageCondition> = [
    { title: 'Label', dataIndex: 'label', ellipsis: true, render: v => <span className="font-medium text-slate-800 text-[13px]">{v}</span> },
    { title: 'Temperature Range', key: 'temp', ellipsis: true, width: 220, render: (_, r) => tempDisplay(r) },
    { title: 'Sort', dataIndex: 'sort_order', ellipsis: true, width: 60, align: 'center', render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggle.mutate(r.id)} /> },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Delete">
            <Popconfirm title="Delete this storage condition?" onConfirm={() => confirmDel(r)}>
              <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Storage Condition</Button>
      </div>
      <div className={tableWrap}>
        <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="middle" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }} />
      </div>
      <Modal
        open={open}
        closable={false}
        title={editTarget ? `Edit — ${editTarget.label}` : 'New Storage Condition'}
        onCancel={() => { setOpen(false); setEditTarget(null) }}
        onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'}
        confirmLoading={save.isPending}
        width={460}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Refrigerated, Deep Freeze, Room Temperature" />
          </Form.Item>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="temperature_min" label="Min Temp">
              <InputNumber className="w-full" placeholder="-20" />
            </Form.Item>
            <Form.Item name="temperature_max" label="Max Temp">
              <InputNumber className="w-full" placeholder="8" />
            </Form.Item>
            <Form.Item name="temperature_unit" label="Unit" initialValue="°C">
              <Select options={[{ value: '°C', label: '°C' }, { value: '°F', label: '°F' }, { value: 'K', label: 'K' }]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
            <InputNumber className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement Master (instrument measurements)
// ─────────────────────────────────────────────────────────────────────────────
function MeasurementMasterTab() {
  const [items, setItems] = useState<MeasurementMaster[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MeasurementMaster | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await measurementMasterApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await measurementMasterApi.update(editing.id, v)
      else await measurementMasterApi.create(v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const columns: ColumnsType<MeasurementMaster> = [
    { title: 'Sl No', key: 'sl', ellipsis: true, width: 60, render: (_, __, i) => <span className="text-[13px] text-slate-500">{i + 1}</span> },
    { title: 'Measurement Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Data Type', dataIndex: 'data_type', ellipsis: true, width: 130, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'UOM', dataIndex: 'uom', ellipsis: true, width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-300">—</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={async () => { await measurementMasterApi.toggle(r.id); load() }} /> },
    { title: 'Action', key: 'a', width: 60, align: 'right', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip> },
  ]

  return (
    <div className="pt-3">
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add Measurement</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editing ? 'Edit Measurement' : 'Add Measurement'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ data_type: 'DECIMAL' }}>
          <Form.Item name="name" label="Measurement Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="data_type" label="Data Type" rules={[{ required: true }]}>
              <Select options={[{ value: 'INTEGER', label: 'Integer' }, { value: 'DECIMAL', label: 'Decimal' }]} />
            </Form.Item>
            <Form.Item name="uom" label="UOM"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Spare Parts (breakdown maintenance)
// ─────────────────────────────────────────────────────────────────────────────
function SparePartsTab() {
  const [items, setItems] = useState<SparePart[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SparePart | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await sparePartApi.list()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await sparePartApi.update(editing.id, v)
      else await sparePartApi.create(v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const columns: ColumnsType<SparePart> = [
    { title: 'Part Code', dataIndex: 'part_code', ellipsis: true, width: 140, render: v => <span className="font-mono text-[13px] text-slate-800">{v}</span> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-300">—</span> },
    { title: 'Active', dataIndex: 'is_active', width: 70, align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={async () => { await sparePartApi.toggle(r.id); load() }} /> },
    { title: 'Action', key: 'a', width: 60, align: 'right', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip> },
  ]

  return (
    <div className="pt-3">
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add Spare Part</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="small" loading={loading} pagination={{ pageSize: 15 }} />
      </div>
      <Modal title={editing ? 'Edit Spare Part' : 'Add Spare Part'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={460} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          {!editing && <Form.Item name="part_code" label="Part Code" rules={[{ required: true }]}><Input /></Form.Item>}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryMasterDataPage() {
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
          { key: 'measurement-master', label: 'Measurement Master', children: <MeasurementMasterTab /> },
          { key: 'spare-parts', label: 'Spare Parts', children: <SparePartsTab /> },
          { key: 'uom',              label: 'UOM Master',        children: <UomTab /> },
          { key: 'lookup',           label: 'Lookup Master',     children: <LookupTab /> },
          { key: 'test-master',      label: 'Test Master',       children: <TestMasterTab /> },
          { key: 'storage-master',   label: 'Storage Master',    children: <StorageMasterTab /> },
          { key: 'sites',            label: <span className="flex items-center gap-1"><MapPin size={13} />Sites</span>,                 children: <SitesTab /> },
        ]}
      />
    </div>
  )
}
