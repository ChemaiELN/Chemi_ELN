import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Space, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  instrumentParameterApi, instrumentSpecDetailApi, measurementMasterApi,
  type InstrumentParameter, type InstrumentSpecDetail, type MeasurementMaster,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

// ── Specification Details (generic key/value/uom) ─────────────────────────────
function SpecDetails({ instrumentId }: { instrumentId: number }) {
  const [rows, setRows] = useState<InstrumentSpecDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentSpecDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await instrumentSpecDetailApi.list(instrumentId)) } finally { setLoading(false) }
  }, [instrumentId])
  useEffect(() => { load() }, [load])

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await instrumentSpecDetailApi.update(editing.id, v)
      else await instrumentSpecDetailApi.create(instrumentId, v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }
  const del = (r: InstrumentSpecDetail) => Modal.confirm({
    title: 'Delete this specification?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await instrumentSpecDetailApi.delete(r.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const columns: ColumnsType<InstrumentSpecDetail> = [
    { title: 'Specification', dataIndex: 'specification', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Value', dataIndex: 'value', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-600">NA</span> },
    { title: 'UOM', dataIndex: 'uom', ellipsis: true, width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-600">NA</span> },
    { title: 'Actions', key: 'a', width: 90, align: 'right', render: (_, r) => (
      <Space size={2}>
        <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip>
        <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => del(r)} /></Tooltip>
      </Space>
    ) },
  ]

  return (
    <div>
      <div className="flex items-center mb-2">
        <p className="font-semibold text-sm text-slate-700">Specification Details</p>
        <Button className="ml-auto" size="small" type="primary" icon={<Plus size={13} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={loading} pagination={false} locale={{ emptyText: 'No specifications' }} />
      </div>
      <Modal title={editing ? 'Edit Specification' : 'Add Specification'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="specification" label="Specification" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="value" label="Value"><Input /></Form.Item>
            <Form.Item name="uom" label="UOM"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instrument Parameters (measurement calibration config) ────────────────────
function Parameters({ instrumentId }: { instrumentId: number }) {
  const [rows, setRows] = useState<InstrumentParameter[]>([])
  const [measurements, setMeasurements] = useState<MeasurementMaster[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentParameter | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await instrumentParameterApi.list(instrumentId)) } finally { setLoading(false) }
  }, [instrumentId])
  useEffect(() => { load() }, [load])
  useEffect(() => { measurementMasterApi.list({ active_only: true }).then(setMeasurements) }, [])

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await instrumentParameterApi.update(editing.id, v)
      else await instrumentParameterApi.create(instrumentId, v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }
  const del = (r: InstrumentParameter) => Modal.confirm({
    title: 'Delete this parameter?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await instrumentParameterApi.delete(r.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const columns: ColumnsType<InstrumentParameter> = [
    { title: 'Sl No', dataIndex: 'seq_no', ellipsis: true, width: 60, render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    { title: 'Measurement Name', dataIndex: 'measurement_name', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v ?? 'NA'}</span> },
    { title: 'Precision', dataIndex: 'precision', ellipsis: true, width: 90, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Lower Unit', dataIndex: 'lower_unit', ellipsis: true, width: 100, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Lower UOM', dataIndex: 'lower_uom', ellipsis: true, width: 100, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Upper Unit', dataIndex: 'upper_unit', ellipsis: true, width: 100, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Upper UOM', dataIndex: 'upper_uom', ellipsis: true, width: 100, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Calib. Tolerance (%)', dataIndex: 'calibration_tolerance_pct', ellipsis: true, width: 150, render: v => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
    { title: 'Actions', key: 'a', width: 90, align: 'right', render: (_, r) => (
      <Space size={2}>
        <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip>
        <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => del(r)} /></Tooltip>
      </Space>
    ) },
  ]

  return (
    <div>
      <div className="flex items-center mb-2">
        <p className="font-semibold text-sm text-slate-700">Instrument Parameters</p>
        <Button className="ml-auto" size="small" type="primary" icon={<Plus size={13} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={loading} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: 'No parameters' }} />
      </div>
      <Modal title={editing ? 'Edit Parameter' : 'Add Parameter'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={560} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="measurement_id" label="Measurement" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select measurement"
              options={measurements.map(m => ({ value: m.id, label: `${m.name}${m.uom ? ` (${m.uom})` : ''}` }))} />
          </Form.Item>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="precision" label="Precision"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <Form.Item name="calibration_tolerance_pct" label="Calib. Tolerance (%)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <div />
            <Form.Item name="lower_unit" label="Lower Unit"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="lower_uom" label="Lower UOM"><Input /></Form.Item>
            <div />
            <Form.Item name="upper_unit" label="Upper Unit"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="upper_uom" label="Upper UOM"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default function InstrumentSpecTab({ instrumentId }: { instrumentId: number }) {
  return (
    <div className="space-y-5">
      <SpecDetails instrumentId={instrumentId} />
      <Parameters instrumentId={instrumentId} />
    </div>
  )
}
