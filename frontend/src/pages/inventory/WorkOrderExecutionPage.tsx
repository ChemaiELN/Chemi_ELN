import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button, Spin, Empty, Table, Modal, Form, Input, Radio, Checkbox, InputNumber, Select,
  message, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, PlayCircle, StopCircle, CheckCircle2, ShieldCheck, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import {
  workOrderApi, sparePartApi, measurementMasterApi,
  type WorkOrderDetail, type ChecklistItem, type SparePart, type MeasurementMaster, type CalibrationReference,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

const STATUS_COLOR: Record<string, string> = {
  RAISED: 'gold', IN_PROGRESS: 'blue', PENDING_VERIFICATION: 'orange', PENDING_APPROVAL: 'purple', APPROVED: 'green',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className="text-[13px] text-slate-800">{value ?? <span className="text-slate-300">—</span>}</p>
    </div>
  )
}

// ── Checklist execution table ─────────────────────────────────────────────────
function ChecklistTable({ wo, editable, onChanged }: { wo: WorkOrderDetail; editable: boolean; onChanged: () => void }) {
  const [values, setValues] = useState<Record<number, { observation?: string; comment?: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const map: Record<number, { observation?: string; comment?: string }> = {}
    wo.results.forEach(r => { if (r.checklist_item_id) map[r.checklist_item_id] = { observation: r.observation ?? undefined, comment: r.comment ?? undefined } })
    setValues(map)
  }, [wo])

  const resultFor = (itemId: number) => wo.results.find(r => r.checklist_item_id === itemId)

  const setVal = (itemId: number, patch: Partial<{ observation: string; comment: string }>) => {
    setValues(v => ({ ...v, [itemId]: { ...v[itemId], ...patch } }))
  }

  const saveRow = async (itemId: number, patch?: Partial<{ observation: string; comment: string }>) => {
    const payload = { ...values[itemId], ...patch }
    setSaving(true)
    try {
      await workOrderApi.saveResults(wo.id, [{ checklist_item_id: itemId, ...payload }])
      onChanged()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const renderObservation = (item: ChecklistItem) => {
    const v = values[item.id]?.observation ?? ''
    if (!editable) return <span className="text-[13px] text-slate-600">{v || '—'}</span>
    if (item.data_type === 'SINGLE_SELECTION' || item.data_type === 'MULTIPLE_SELECTION') {
      const options = item.options ?? []
      return (
        <Radio.Group value={v} onChange={e => { setVal(item.id, { observation: e.target.value }); saveRow(item.id, { observation: e.target.value }) }}>
          {options.map(o => <Radio key={o} value={o}>{o}</Radio>)}
        </Radio.Group>
      )
    }
    if (item.data_type === 'OBSERVATION') {
      return (
        <Radio.Group value={v} onChange={e => { setVal(item.id, { observation: e.target.value }); saveRow(item.id, { observation: e.target.value }) }}>
          <Radio value="SF">SF</Radio><Radio value="NSF">NSF</Radio><Radio value="NA">NA</Radio>
        </Radio.Group>
      )
    }
    return <Input value={v} onChange={e => setVal(item.id, { observation: e.target.value })} onBlur={e => saveRow(item.id, { observation: e.target.value })} style={{ width: 160 }} />
  }

  const columns: ColumnsType<ChecklistItem> = [
    { title: 'Sl No', ellipsis: true, dataIndex: 'seq_no', width: 60 },
    {
      title: 'Checks', ellipsis: true, dataIndex: 'details', render: (v, r) => (
        <span className={r.instruction_type === 'HEADING' ? 'font-bold text-slate-800 text-[13px]' : 'text-[13px] text-slate-700'}>{v}</span>
      ),
    },
    { title: 'Observation', key: 'obs', width: 220, render: (_, r) => r.instruction_type === 'HEADING' ? null : renderObservation(r) },
    {
      title: 'Comments', key: 'comment', width: 160, render: (_, r) => r.instruction_type === 'HEADING' ? null : (
        editable
          ? <Input value={values[r.id]?.comment ?? ''} onChange={e => setVal(r.id, { comment: e.target.value })} onBlur={e => saveRow(r.id, { comment: e.target.value })} />
          : <span className="text-[13px] text-slate-600">{values[r.id]?.comment || '—'}</span>
      ),
    },
    {
      title: 'Done By (Sign & Date)', ellipsis: true, key: 'doneBy', width: 200, render: (_, r) => {
        const res = resultFor(r.id)
        return res?.done_by ? <span className="text-[12px] text-slate-500">{res.done_by} ({new Date(res.done_at!).toLocaleString()})</span> : null
      },
    },
  ]

  return <Table dataSource={wo.checklist_items} columns={columns} rowKey="id" size="small" pagination={false} loading={saving} scroll={{ x: 'max-content' }} />
}

// ── Verify / Approve e-sign modal ─────────────────────────────────────────────
function ESignModal({ open, title, needsMaintenanceType, onClose, onSubmit, saving }: {
  open: boolean; title: string; needsMaintenanceType?: boolean
  onClose: () => void; onSubmit: (v: { password: string; comment: string; maintenance_type?: string }) => void; saving: boolean
}) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.resetFields() }, [open, form])
  return (
    <Modal title={title} open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {needsMaintenanceType && (
          <Form.Item name="maintenance_type" label="Maintenance Type" rules={[{ required: true }]}>
            <Radio.Group><Radio value="MAJOR">Major</Radio><Radio value="MINOR">Minor</Radio></Radio.Group>
          </Form.Item>
        )}
        <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password /></Form.Item>
        <Form.Item name="comment" label="Comments" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}

// ── Breakdown details modal ───────────────────────────────────────────────────
function BreakdownModal({ open, onClose, onSaved, workOrderId }: { open: boolean; onClose: () => void; onSaved: () => void; workOrderId: number }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [parts, setParts] = useState<SparePart[]>([])
  const sparePartsUsed = Form.useWatch('spare_parts_used', form)
  useEffect(() => { if (open) sparePartApi.list({ active_only: true }).then(setParts) }, [open])
  useEffect(() => { if (open) form.resetFields() }, [open, form])

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      await workOrderApi.breakdownDetails(workOrderId, {
        spare_parts_used: v.spare_parts_used === 'yes',
        description: v.description as string,
        part_codes: v.spare_parts_used === 'yes' ? (v.part_codes as string[] ?? []) : [],
      })
      message.success('Breakdown details saved'); onSaved(); onClose()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Breakdown Process" open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} width={560} centered destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="spare_parts_used" label="Spare Parts" rules={[{ required: true }]}>
          <Radio.Group><Radio value="yes">Yes</Radio><Radio value="no">No</Radio></Radio.Group>
        </Form.Item>
        {sparePartsUsed === 'yes' && (
          <Form.Item name="part_codes" label="Part List" rules={[{ required: true, message: 'Select at least one part' }]}>
            <Checkbox.Group options={parts.map(p => ({ value: p.part_code, label: `${p.part_code} — ${p.name}` }))} />
          </Form.Item>
        )}
        <Form.Item name="description" label="Description" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}

// ── Calibration Reference Details ─────────────────────────────────────────────
function CalibrationReferenceTable({ wo, editable, onChanged }: { wo: WorkOrderDetail; editable: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [measurements, setMeasurements] = useState<MeasurementMaster[]>([])

  useEffect(() => { measurementMasterApi.list({ active_only: true }).then(setMeasurements) }, [])

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      await workOrderApi.addCalibrationReference(wo.id, {
        measurement_id: v.measurement_id as number | undefined,
        reference_inst_id: v.reference_inst_id as string | undefined,
        reference_reading: v.reference_reading as number,
        instrument_reading: v.instrument_reading as number,
      })
      message.success('Reference reading added'); setOpen(false); form.resetFields(); onChanged()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const del = (r: CalibrationReference) => Modal.confirm({
    title: 'Delete this reading?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await workOrderApi.deleteCalibrationReference(r.id); onChanged() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const columns: ColumnsType<CalibrationReference> = [
    { title: 'Measurement', ellipsis: true, dataIndex: 'measurement_name', render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Reference Inst. ID', ellipsis: true, dataIndex: 'reference_inst_id', width: 140, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Reference Reading', ellipsis: true, dataIndex: 'reference_reading', width: 130 },
    { title: 'Instrument Reading', ellipsis: true, dataIndex: 'instrument_reading', width: 130 },
    { title: 'Variance (%)', ellipsis: true, dataIndex: 'variance_pct', width: 110, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 90, render: v => v ? <StatusTag color={v === 'PASS' ? 'green' : 'red'}>{v}</StatusTag> : <span className="text-slate-300">—</span> },
    { title: 'Done By (Sign & Date)', ellipsis: true, dataIndex: 'done_by', width: 190, render: (v, r) => v ? <span className="text-[12px] text-slate-500">{v} ({new Date(r.done_at!).toLocaleString()})</span> : null },
    ...(editable ? [{ title: '', key: 'a', width: 50, render: (_: unknown, r: CalibrationReference) => <Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => del(r)} /> }] : []),
  ]

  return (
    <div className="glass-card rounded-lg overflow-hidden p-2">
      <div className="flex items-center px-2 pt-1 pb-2">
        <p className="font-semibold text-sm text-slate-700">Calibration Reference Details</p>
        {editable && <Button className="ml-auto" size="small" type="primary" icon={<Plus size={13} />} onClick={() => setOpen(true)}>Add</Button>}
      </div>
      <Table dataSource={wo.calib_references} columns={columns} rowKey="id" size="small" pagination={false} locale={{ emptyText: 'No readings recorded' }} />

      <Modal title="Add Calibration Reference" open={open} closable={false} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="measurement_id" label="Measurements">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Select a measure…"
              options={measurements.map(m => ({ value: m.id, label: `${m.name}${m.uom ? ` (${m.uom})` : ''}` }))} />
          </Form.Item>
          <Form.Item name="reference_inst_id" label="Reference Inst. Id"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="reference_reading" label="Reference Reading" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="instrument_reading" label="Instrument Reading" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default function WorkOrderExecutionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [wo, setWo] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [esign, setEsign] = useState<null | 'verify' | 'approve'>(null)
  const [esignSaving, setEsignSaving] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [endForm] = Form.useForm()
  const [endSaving, setEndSaving] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    workOrderApi.get(Number(id)).then(setWo).catch(e => message.error((e as Error).message)).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  if (!wo) return <div className="p-6"><Empty description="Work order not found" /></div>

  const start = () => Modal.confirm({
    title: 'Confirmation', content: 'Are you sure you want to start process?', okText: 'Yes', cancelText: 'No',
    centered: true, styles: glassModalStyles,
    onOk: async () => { try { await workOrderApi.start(wo.id); message.success('Maintenance process has started successfully!'); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const isExternalCalibration = wo.log_type === 'CALIBRATION' && wo.calibration_source === 'EXTERNAL'

  const end = () => {
    if (isExternalCalibration) { endForm.resetFields(); setEndOpen(true); return }
    Modal.confirm({
      title: 'Confirmation', content: 'Are you sure you want to end process?', okText: 'Yes', cancelText: 'No',
      centered: true, styles: glassModalStyles,
      onOk: async () => { try { await workOrderApi.end(wo.id, { comment: 'Ended Successfully' }); message.success('Process ended'); load() } catch (e: unknown) { message.error((e as Error).message) } },
    })
  }

  const submitExternalEnd = async (v: { certificate_no: string }) => {
    setEndSaving(true)
    try {
      await workOrderApi.end(wo.id, { comment: 'Ended Successfully', certificate_no: v.certificate_no })
      message.success('Process ended'); setEndOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setEndSaving(false) }
  }

  const doESign = async (v: { password: string; comment: string; maintenance_type?: string }) => {
    setEsignSaving(true)
    try {
      if (esign === 'verify') await workOrderApi.verify(wo.id, v)
      else await workOrderApi.approve(wo.id, v)
      message.success('Done'); setEsign(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setEsignSaving(false) }
  }

  const reinitiate = () => Modal.confirm({
    title: 'Re-Initiate?', content: 'This resets the work order back to Raised.', okText: 'Re-Initiate', okButtonProps: { danger: true },
    centered: true, styles: glassModalStyles,
    onOk: async () => { try { await workOrderApi.reinitiate(wo.id, { comment: 're-initiated' }); message.success('Re-initiated'); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const isBreakdown = wo.kind === 'BREAKDOWN'

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/inventory/work-orders')}>Back</Button> */}
        <div className="min-w-0">
         <div className="flex items-center gap-[5px]">
  <h1 className="text-lg font-bold text-slate-800 leading-tight">
    {wo.workorder_no}
  </h1>

  <StatusTag color={STATUS_COLOR[wo.status] ?? "default"}>
    {wo.status.replace(/_/g, " ")}
  </StatusTag>
</div>
          <p className="text-slate-500 text-sm">{wo.equipment_code} · {wo.kind} · {wo.log_type}{wo.calibration_source ? ` · ${wo.calibration_source}` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          
          {wo.status === 'RAISED' && isBreakdown && <Button onClick={() => setBreakdownOpen(true)}>Breakdown Details</Button>}
          {wo.status === 'RAISED' && <Button type="primary" icon={<PlayCircle size={14} />} onClick={start}>Start Process</Button>}
          {wo.status === 'IN_PROGRESS' && <Button type="primary" icon={<StopCircle size={14} />} onClick={end}>End Process</Button>}
          {wo.status === 'PENDING_VERIFICATION' && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => setEsign('verify')}>Verify</Button>}
          {wo.status === 'PENDING_APPROVAL' && <Button type="primary" icon={<ShieldCheck size={14} />} onClick={() => setEsign('approve')}>Approve</Button>}
          {(wo.status === 'IN_PROGRESS' || wo.status === 'PENDING_VERIFICATION' || wo.status === 'PENDING_APPROVAL') && (
            <Button danger icon={<RotateCcw size={14} />} onClick={reinitiate}>Re-Initiate</Button>
          )}
        </div>
      </div>

      <div className="glass-card rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Raised By" value={wo.raised_by ? `${wo.raised_by} (${wo.raised_at ? new Date(wo.raised_at).toLocaleString() : ''})` : null} />
        <Field label="Started By" value={wo.started_by ? `${wo.started_by} (${wo.started_at ? new Date(wo.started_at).toLocaleString() : ''})` : null} />
        <Field label="Verified By" value={wo.verified_by ? `${wo.verified_by} (${wo.verified_at ? new Date(wo.verified_at).toLocaleString() : ''})` : null} />
        <Field label="Approved By" value={wo.approved_by ? `${wo.approved_by} (${wo.approved_at ? new Date(wo.approved_at).toLocaleString() : ''})` : null} />
        {wo.checklist_name && <Field label="Checklist" value={wo.checklist_name} />}
        {wo.remarks && <Field label="Remarks" value={wo.remarks} />}
        {isBreakdown && wo.breakdown_description && <Field label="Breakdown Description" value={wo.breakdown_description} />}
        {isBreakdown && wo.spares_used.length > 0 && <Field label="Replaced Spare Parts" value={wo.spares_used.map(s => s.part_code).join(', ')} />}
        {wo.certificate_no && <Field label="Certificate No" value={wo.certificate_no} />}
      </div>

      {!isExternalCalibration && (
        <div className="glass-card rounded-lg overflow-hidden p-2">
          <p className="font-semibold text-sm text-slate-700 px-2 pt-1 pb-2">
            {wo.log_type === 'CALIBRATION' ? 'Calibration Log Details (Calibration Checklist)' : 'Maintenance Log Details (Maint. Checklist)'}
          </p>
          {wo.checklist_items.length > 0
            ? <ChecklistTable wo={wo} editable={wo.status === 'IN_PROGRESS'} onChanged={load} />
            : <Empty description="No checklist mapped for this item" className="py-8" />}
        </div>
      )}

      {wo.log_type === 'CALIBRATION' && wo.target_kind === 'INSTRUMENT' && (
        <CalibrationReferenceTable wo={wo} editable={wo.status === 'IN_PROGRESS'} onChanged={load} />
      )}

      {wo.signatures.length > 0 && (
        <div className="glass-card rounded-lg p-4">
          <p className="font-semibold text-sm text-slate-700 mb-2">E-Signature</p>
          <Space orientation="vertical" size={4} className="w-full">
            {wo.signatures.map(s => (
              <p key={s.id} className="text-[13px] text-slate-600">
                <span className="font-medium">{s.signing_for}</span>: {s.name} — {s.comments} <span className="text-slate-400">({new Date(s.completed_on).toLocaleString()})</span>
              </p>
            ))}
          </Space>
        </div>
      )}

      <ESignModal
        open={!!esign} title={esign === 'verify' ? 'Verify Maintenance' : 'Approve Maintenance'}
        needsMaintenanceType={esign === 'verify' && isBreakdown}
        onClose={() => setEsign(null)} onSubmit={doESign} saving={esignSaving}
      />

      <Modal title="End Process — External Calibration" open={endOpen} closable={false} onCancel={() => setEndOpen(false)} onOk={() => endForm.submit()} confirmLoading={endSaving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={endForm} layout="vertical" onFinish={submitExternalEnd}>
          <Form.Item name="certificate_no" label="Certificate No" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <BreakdownModal open={breakdownOpen} onClose={() => setBreakdownOpen(false)} onSaved={load} workOrderId={wo.id} />
    </div>
  )
}
