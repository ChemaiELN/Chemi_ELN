import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Select, DatePicker, Modal, Form, Input, message, Tabs, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Plus, StopCircle } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import {
  usageLogApi, equipmentCatalogueApi, instrumentCatalogueApi,
  type UsageLog, type StatusHistoryRow, type CalendarSegment,
  type EquipmentCatalogue, type InstrumentCatalogue,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

type Kind = 'EQUIPMENT' | 'INSTRUMENT'

const STATUS_COLOR: Record<string, string> = {
  IN_USE: 'blue', AVAILABLE: 'default', UNDER_MAINTENANCE: 'orange', UNDER_CLEANING: 'gold', UNDER_CALIBRATION: 'purple',
}
const CAL_BG: Record<string, string> = {
  IN_USE: 'bg-blue-400', AVAILABLE: 'bg-slate-200', UNDER_MAINTENANCE: 'bg-orange-400', UNDER_CLEANING: 'bg-amber-300', UNDER_CALIBRATION: 'bg-purple-400',
}

// ── Log Entries (Add / End) ────────────────────────────────────────────────────
function LogEntriesTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [rows, setRows] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [endTarget, setEndTarget] = useState<UsageLog | null>(null)
  const [form] = Form.useForm()
  const [endForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!itemId) { setRows([]); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { target_kind: targetKind }
      params[isEquipment ? 'equipment_id' : 'instrument_id'] = itemId
      setRows(await usageLogApi.list(params))
    } finally { setLoading(false) }
  }, [targetKind, itemId, isEquipment])
  useEffect(() => { load() }, [load])

  const openAdd = () => { form.resetFields(); setAddOpen(true) }
  const save = async (v: Record<string, unknown>) => {
    if (!itemId) return
    setSaving(true)
    try {
      const idField = isEquipment ? 'equipment_id' : 'instrument_id'
      await usageLogApi.create({
        [idField]: itemId, started_at: dayjs(v.started_at as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss'),
        previous_product_code: v.previous_product_code, previous_batch_no: v.previous_batch_no,
        reference_no: v.reference_no, usage_remarks: v.usage_remarks,
      })
      message.success('Usage log added'); setAddOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const doEnd = async (v: Record<string, unknown>) => {
    if (!endTarget) return
    setSaving(true)
    try {
      await usageLogApi.end(endTarget.id, { ended_at: dayjs(v.ended_at as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss'), usage_remarks: v.usage_remarks as string })
      message.success('Usage log ended'); setEndTarget(null); endForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const columns: ColumnsType<UsageLog> = [
    { title: 'Sl No', key: 'sl', ellipsis: true, width: 60, render: (_, __, i) => i + 1 },
    { title: 'Previous Product Code', dataIndex: 'previous_product_code', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Previous Batch No.', dataIndex: 'previous_batch_no', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Started By/On', key: 'started', ellipsis: true, render: (_, r) => r.started_by ? <span className="text-[13px]">{r.started_by} <span className="text-slate-400">({r.started_at ? new Date(r.started_at).toLocaleString() : ''})</span></span> : '—' },
    { title: 'Ended By/On', key: 'ended', ellipsis: true, render: (_, r) => r.ended_by ? <span className="text-[13px]">{r.ended_by} <span className="text-slate-400">({r.ended_at ? new Date(r.ended_at).toLocaleString() : ''})</span></span> : <span className="text-slate-300">—</span> },
    { title: 'Reference No.', dataIndex: 'reference_no', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
    {
      title: 'Action', key: 'a', width: 90, render: (_, r) => !r.ended_at && (
        <Tooltip title="End"><Button type="text" size="small" icon={<StopCircle size={14} />} onClick={() => { setEndTarget(r); endForm.resetFields() }} /></Tooltip>
      ),
    },
  ]

  return (
    <div className="pt-3">
      <div className="flex justify-end mb-3">
        <Button type="primary" icon={<Plus size={14} />} disabled={!itemId} onClick={openAdd}>Add</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10 }} locale={{ emptyText: itemId ? 'No usage logs' : 'Select an item first' }} />
      </div>

      <Modal title={`Add ${isEquipment ? 'Equipment' : 'Instrument'} Usage Log`} open={addOpen} closable={false} onCancel={() => setAddOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ started_at: dayjs() }}>
          <Form.Item name="started_at" label="Start Time" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="previous_batch_no" label="Batch No."><Input /></Form.Item>
          <Form.Item name="previous_product_code" label="Product Name/Code"><Input /></Form.Item>
          <Form.Item name="reference_no" label="Reference No"><Input /></Form.Item>
          <Form.Item name="usage_remarks" label="Usage Remarks" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="End Equipment Usage Log" open={!!endTarget} closable={false} onCancel={() => setEndTarget(null)} onOk={() => endForm.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={endForm} layout="vertical" onFinish={doEnd} initialValues={{ ended_at: dayjs() }}>
          <Form.Item name="ended_at" label="Ended On" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="usage_remarks" label="Usage Remarks" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Tabular View (status history) ─────────────────────────────────────────────
function TabularViewTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [rows, setRows] = useState<StatusHistoryRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!itemId) { setRows([]); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { target_kind: targetKind, from_date: range[0].format('YYYY-MM-DD'), to_date: range[1].format('YYYY-MM-DD') }
      params[isEquipment ? 'equipment_id' : 'instrument_id'] = itemId
      setRows(await usageLogApi.statusHistory(params))
    } finally { setLoading(false) }
  }, [targetKind, itemId, isEquipment, range])
  useEffect(() => { load() }, [load])

  const columns: ColumnsType<StatusHistoryRow> = [
    { title: 'Sl No', key: 'sl', ellipsis: true, width: 60, render: (_, __, i) => i + 1 },
    { title: 'Previous Product Code', dataIndex: 'previous_product_code', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Previous Batch No.', dataIndex: 'previous_batch_no', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
    { title: 'Status', dataIndex: 'status', ellipsis: true, width: 160, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{v.replace(/_/g, ' ')}</StatusTag> },
    { title: 'Started By/On', key: 'started', ellipsis: true, render: (_, r) => r.started_by ? <span className="text-[13px]">{r.started_by} <span className="text-slate-400">({new Date(r.started_at).toLocaleString()})</span></span> : <span className="text-[13px] text-slate-500">{new Date(r.started_at).toLocaleString()}</span> },
    { title: 'Ended By/On', key: 'ended', ellipsis: true, render: (_, r) => r.ended_by ? <span className="text-[13px]">{r.ended_by} <span className="text-slate-400">({r.ended_at ? new Date(r.ended_at).toLocaleString() : ''})</span></span> : (r.ended_at ? <span className="text-[13px] text-slate-500">{new Date(r.ended_at).toLocaleString()}</span> : <span className="text-slate-300">—</span>) },
    { title: 'Duration', dataIndex: 'duration', ellipsis: true, width: 130 },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true, render: v => v ?? <span className="text-slate-300">—</span> },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-2 items-center">
        <DatePicker.RangePicker value={range} onChange={v => v && v[0] && v[1] && setRange([v[0], v[1]])} />
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey={r => `${r.status}-${r.started_at}`} size="small" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10 }} locale={{ emptyText: itemId ? 'No history' : 'Select an item first' }} />
      </div>
    </div>
  )
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarViewTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [month, setMonth] = useState(dayjs())
  const [data, setData] = useState<Record<string, CalendarSegment[]>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!itemId) { setData({}); return }
    setLoading(true)
    try {
      const params: Record<string, unknown> = { target_kind: targetKind, month: month.format('YYYY-MM') }
      params[isEquipment ? 'equipment_id' : 'instrument_id'] = itemId
      setData(await usageLogApi.calendar(params))
    } finally { setLoading(false) }
  }, [targetKind, itemId, isEquipment, month])
  useEffect(() => { load() }, [load])

  const daysInMonth = month.daysInMonth()
  const startWeekday = month.startOf('month').day()
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-3 items-center">
        <DatePicker picker="month" value={month} onChange={v => v && setMonth(v)} allowClear={false} />
        <div className="flex gap-3 text-[12px] text-slate-600">
          {Object.entries(CAL_BG).map(([k, cls]) => (
            <span key={k} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${cls}`} />{k.replace(/_/g, ' ')}</span>
          ))}
        </div>
      </div>
      <div className="glass-card rounded-lg p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const key = month.date(d).format('YYYY-MM-DD')
            const segs = data[key] ?? []
            return (
              <div key={i} className="border border-slate-100 rounded p-1 min-h-[70px]">
                <p className="text-[11px] text-slate-400">{d}</p>
                <div className="space-y-0.5 mt-0.5">
                  {segs.map((s, j) => (
                    <Tooltip key={j} title={`${s.status.replace(/_/g, ' ')} — ${s.duration}`}>
                      <div className={`h-2 rounded ${CAL_BG[s.status] ?? 'bg-slate-200'}`} />
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {loading && <p className="text-center text-slate-400 text-xs mt-2">Loading…</p>}
      </div>
    </div>
  )
}

export default function UsageLogsPage({ targetKind }: { targetKind: Kind }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [items, setItems] = useState<(EquipmentCatalogue | InstrumentCatalogue)[]>([])
  const [itemId, setItemId] = useState<number | undefined>()

  useEffect(() => {
    if (isEquipment) equipmentCatalogueApi.list({ active_only: true, limit: 500 }).then(setItems)
    else instrumentCatalogueApi.list({ active_only: true, limit: 500 }).then(setItems)
  }, [isEquipment])

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-2 items-center">
        <span className="text-[13px] font-medium text-slate-600">{isEquipment ? 'Equipment Code' : 'Instrument Code'}:</span>
        <Select
          style={{ minWidth: 240 }} showSearch optionFilterProp="label" placeholder="Select an item"
          value={itemId} onChange={setItemId}
          options={items.map(it => ({ value: it.id, label: it.asset_id }))}
        />
      </div>
      <Tabs
        items={[
          { key: 'log', label: 'Usage Log', children: <LogEntriesTab targetKind={targetKind} itemId={itemId} /> },
          { key: 'tabular', label: 'Tabular View', children: <TabularViewTab targetKind={targetKind} itemId={itemId} /> },
          { key: 'calendar', label: 'Calendar View', children: <CalendarViewTab targetKind={targetKind} itemId={itemId} /> },
        ]}
      />
    </div>
  )
}
