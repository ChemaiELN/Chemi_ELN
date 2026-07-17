import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Tabs, Tag, Select, Space, Tooltip, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2, FlaskConical, Microscope, MapPin } from 'lucide-react'
import {
  adminApi,
  type LookupChemical, type LookupInstrument, type LookupSite,
} from '../../api/admin'
import { ApiError } from '../../api/client'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

const STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'Due', label: 'Due' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'NA', label: 'NA' },
]

// ── Chemicals tab ─────────────────────────────────────────────

function ChemicalsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupChemical | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['chemicals', true],
    queryFn: () => adminApi.listChemicals(true),
  })
  const inv = () => qc.invalidateQueries({ queryKey: ['chemicals'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      editTarget
        ? adminApi.updateChemical(editTarget.id, v as Parameters<typeof adminApi.updateChemical>[1])
        : adminApi.createChemical(v as Parameters<typeof adminApi.createChemical>[0]),
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

  const openEdit = (r: LookupChemical) => {
    setEditTarget(r)
    form.setFieldsValue(r)
    setOpen(true)
  }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupChemical) => Modal.confirm({
    title: `Delete "${r.chemical_name}"?`, content: 'This cannot be undone.', okText: 'Delete',
    okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: () => del.mutate(r.id),
  })

  const columns: ColumnsType<LookupChemical> = [
    { title: 'Chemical Name', dataIndex: 'chemical_name', render: (v) => <span className="font-medium text-slate-800 text-sm">{v}</span> },
    { title: 'CAS No.', dataIndex: 'cas_no', responsive: ['lg'], render: (v) => <span className="  text-xs text-slate-500">{v ?? '—'}</span> },
    { title: 'Formula', dataIndex: 'formula', responsive: ['md'], render: (v) => v ?? <span className="text-slate-300">—</span> },
    { title: 'Mol. Wt', dataIndex: 'mol_wt', width: 90, align: 'right', responsive: ['lg'], render: (v) => v != null ? <span className="text-slate-600 text-sm">{Number(v).toFixed(2)}</span> : <span className="text-slate-300">—</span> },
    { title: 'Purity %', dataIndex: 'purity_pct', width: 85, align: 'right', responsive: ['lg'], render: (v) => v != null ? <span className="text-slate-600 text-sm">{v}%</span> : <span className="text-slate-300">—</span> },
    { title: 'Vendor', dataIndex: 'vendor_name', responsive: ['md'], render: (v) => v ?? <span className="text-slate-300">—</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 70, align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={(c) => toggle.mutate({ id: r.id, is_active: c })} />,
    },
    {
      title: '', key: 'actions', width: 70, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {ctx}
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Chemical</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `${t} items` }} scroll={{ x: 'max-content' }} />

      <Modal open={open} title={editTarget ? `Edit — ${editTarget.chemical_name}` : 'Add Chemical'}
        onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending}
        width={520} centered destroyOnHidden {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          <Form.Item name="chemical_name" label="Chemical Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Acetonitrile" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="cas_no" label="CAS No."><Input placeholder="e.g. 75-05-8" /></Form.Item>
            <Form.Item name="formula" label="Formula"><Input placeholder="e.g. CH₃CN" /></Form.Item>
            <Form.Item name="mol_wt" label="Mol. Wt (g/mol)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="purity_pct" label="Purity %"><InputNumber min={0} max={100} className="w-full" /></Form.Item>
            <Form.Item name="density" label="Density (g/mL)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="vendor_name" label="Vendor"><Input placeholder="e.g. Sigma-Aldrich" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instruments tab ───────────────────────────────────────────

function InstrumentsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupInstrument | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['instruments', true],
    queryFn: () => adminApi.listInstruments(true),
  })
  const inv = () => qc.invalidateQueries({ queryKey: ['instruments'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      editTarget
        ? adminApi.updateInstrument(editTarget.id, v as Parameters<typeof adminApi.updateInstrument>[1])
        : adminApi.createInstrument(v as Parameters<typeof adminApi.createInstrument>[0]),
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
  const confirmDel = (r: LookupInstrument) => Modal.confirm({
    title: `Delete "${r.instrument_name}"?`, content: 'This cannot be undone.', okText: 'Delete',
    okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: () => del.mutate(r.id),
  })

  const columns: ColumnsType<LookupInstrument> = [
    { title: 'Code', dataIndex: 'instrument_code', width: 110, render: (v) => <Tag color="purple" className="  text-xs">{v}</Tag> },
    { title: 'Name', dataIndex: 'instrument_name', render: (v) => <span className="font-medium text-slate-800 text-sm">{v}</span> },
    { title: 'Type', dataIndex: 'instrument_type', responsive: ['md'], render: (v) => v ?? <span className="text-slate-300">—</span> },
    { title: 'Maintenance', dataIndex: 'maintenance_status', width: 110, responsive: ['lg'], render: (v) => v ? <Tag color={statusColor(v)}>{v}</Tag> : <span className="text-slate-300">—</span> },
    { title: 'Calibration', dataIndex: 'calibration_status', width: 110, responsive: ['lg'], render: (v) => v ? <Tag color={statusColor(v)}>{v}</Tag> : <span className="text-slate-300">—</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 70, align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={(c) => toggle.mutate({ id: r.id, is_active: c })} />,
    },
    {
      title: '', key: 'actions', width: 70, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {ctx}
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Instrument</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `${t} items` }} scroll={{ x: 'max-content' }} />

      <Modal open={open} title={editTarget ? `Edit — ${editTarget.instrument_name}` : 'Add Instrument'}
        onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending}
        width={480} centered destroyOnHidden {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editTarget && (
            <Form.Item name="instrument_code" label="Code" rules={[{ required: true, max: 50 }]}>
              <Input placeholder="e.g. HPLC-001" className="uppercase  " />
            </Form.Item>
          )}
          <Form.Item name="instrument_name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Agilent 1260 HPLC" />
          </Form.Item>
          <Form.Item name="instrument_type" label="Type">
            <Input placeholder="e.g. Chromatography" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="maintenance_status" label="Maintenance Status">
              <Select placeholder="Select" allowClear options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="calibration_status" label="Calibration Status">
              <Select placeholder="Select" allowClear options={STATUS_OPTIONS} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Sites tab ─────────────────────────────────────────────────

function SitesTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupSite | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['sites', true],
    queryFn: () => adminApi.listSites(true),
  })
  const inv = () => qc.invalidateQueries({ queryKey: ['sites'] })

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      editTarget
        ? adminApi.updateSite(editTarget.id, v as Parameters<typeof adminApi.updateSite>[1])
        : adminApi.createSite(v as Parameters<typeof adminApi.createSite>[0]),
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
  const confirmDel = (r: LookupSite) => Modal.confirm({
    title: `Delete "${r.name}"?`, content: 'This cannot be undone.', okText: 'Delete',
    okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: () => del.mutate(r.id),
  })

  const columns: ColumnsType<LookupSite> = [
    { title: 'Code', dataIndex: 'code', width: 100, render: (v) => <Tag color="purple" className="  text-xs font-bold">{v}</Tag> },
    { title: 'Name', dataIndex: 'name', render: (v) => <span className="font-medium text-slate-800 text-sm">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', width: 70, align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={(c) => toggle.mutate({ id: r.id, is_active: c })} />,
    },
    {
      title: '', key: 'actions', width: 70, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => confirmDel(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {ctx}
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Site</Button>
      </div>
      <Table dataSource={data} columns={columns} rowKey="id" loading={isLoading} size="small"
        pagination={{ pageSize: 10, showTotal: (t) => `${t} sites` }} scroll={{ x: 'max-content' }} />

      <Modal open={open} title={editTarget ? `Edit — ${editTarget.name}` : 'Add Site'}
        onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending}
        width={400} centered destroyOnHidden {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
          {!editTarget && (
            <Form.Item name="code" label="Code" rules={[{ required: true, max: 20 }]}>
              <Input placeholder="e.g. HYD-1" className="uppercase  " />
            </Form.Item>
          )}
          <Form.Item name="name" label="Site Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Hyderabad Lab 1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

const TABS = [
  { key: 'chemicals',   label: <span className="flex items-center gap-1.5"><FlaskConical size={13} />Chemicals</span>,  children: <ChemicalsTab /> },
  { key: 'instruments', label: <span className="flex items-center gap-1.5"><Microscope size={13} />Instruments</span>, children: <InstrumentsTab /> },
  { key: 'sites',       label: <span className="flex items-center gap-1.5"><MapPin size={13} />Sites</span>,           children: <SitesTab /> },
]

export default function MasterDataPage() {
  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Master Data</h1>
        <p className="text-slate-500 text-sm mt-0.5">Reference catalogues — chemicals, instruments and lab sites</p>
      </div>
      <div className="glass-card rounded-2xl p-4 md:p-5">
        <Tabs
          items={TABS}
          type="line"
          tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.4)' }}
          tabBarGutter={24}
        />
      </div>
    </div>
  )
}
