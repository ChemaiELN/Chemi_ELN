import { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Button, Select, DatePicker, Modal, Form, Input, message, Tabs, Tooltip } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import dayjs from 'dayjs'
import { Plus, StopCircle } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { useServerTable } from '../../hooks/useServerTable'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import {
  usageLogApi, equipmentCatalogueApi, instrumentCatalogueApi, columnCatalogueApi,
  type UsageLog, type StatusHistoryRow, type CalendarSegment,
  type EquipmentCatalogue, type InstrumentCatalogue, type ColumnCatalogue,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

type Kind = 'EQUIPMENT' | 'INSTRUMENT' | 'COLUMN'
type CatalogueItem = EquipmentCatalogue | InstrumentCatalogue | ColumnCatalogue

const ID_FIELD: Record<Kind, 'equipment_id' | 'instrument_id' | 'column_id'> = {
  EQUIPMENT: 'equipment_id', INSTRUMENT: 'instrument_id', COLUMN: 'column_id',
}
const KIND_LABEL: Record<Kind, string> = { EQUIPMENT: 'Equipment', INSTRUMENT: 'Instrument', COLUMN: 'Column' }
// Equipment/Instrument are identified by `asset_id`; Columns by `column_id`.
const itemCode = (kind: Kind, item: CatalogueItem): string =>
  kind === 'COLUMN' ? (item as ColumnCatalogue).column_id : (item as EquipmentCatalogue | InstrumentCatalogue).asset_id

const STATUS_COLOR: Record<string, string> = {
  IN_USE: 'blue', AVAILABLE: 'default', UNDER_MAINTENANCE: 'orange', UNDER_CLEANING: 'gold', UNDER_CALIBRATION: 'purple',
}
const CAL_BG: Record<string, string> = {
  IN_USE: 'bg-blue-400', AVAILABLE: 'bg-slate-200', UNDER_MAINTENANCE: 'bg-orange-400', UNDER_CLEANING: 'bg-amber-300', UNDER_CALIBRATION: 'bg-purple-400',
}

// ── Log Entries (Add / End) ────────────────────────────────────────────────────
function LogEntriesTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const idField = ID_FIELD[targetKind]
  const [rows, setRows] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [endTarget, setEndTarget] = useState<UsageLog | null>(null)
  const [form] = Form.useForm()
  const [endForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { target_kind: targetKind, skip: (page - 1) * pageSize, limit: pageSize }
      if (itemId) params[idField] = itemId
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await usageLogApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [targetKind, itemId, idField, page, pageSize, sortBy, sortDir])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [itemId, targetKind])

  const openAdd = () => { form.resetFields(); setAddOpen(true) }
  const save = async (v: Record<string, unknown>) => {
    if (!itemId) return
    setSaving(true)
    try {
      await usageLogApi.create({
        [idField]: itemId, started_at: dayjs(v.started_at as dayjs.Dayjs).format('YYYY-MM-DDTHH:mm:ss'),
        previous_product_code: v.previous_product_code as string | undefined,
        previous_batch_no: v.previous_batch_no as string | undefined,
        reference_no: v.reference_no as string | undefined, usage_remarks: v.usage_remarks as string,
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
    { title: 'Sl No', key: 'sl', ellipsis: true, width: 150, render: (_, __, i) => <span className="text-[13px] text-slate-800">{(page - 1) * pageSize + i + 1}</span> },
    { title: KIND_LABEL[targetKind], dataIndex: 'asset_code', ellipsis: true, width: 150, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Previous Product Code', dataIndex: 'previous_product_code', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Previous Batch No.', dataIndex: 'previous_batch_no', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Started By/On', dataIndex: 'started_by', key: 'started', ellipsis: true, width: 150, sorter: true, render: (_, r) => r.started_by ? <span className="text-[13px] text-slate-800">{r.started_by} <span className="text-slate-400">({r.started_at ? dayjs(r.started_at).format('DD/MM/YYYY HH:mm') : ''})</span></span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Ended By/On', dataIndex: 'ended_by', key: 'ended', ellipsis: true, width: 150, sorter: true, render: (_, r) => r.ended_by ? <span className="text-[13px] text-slate-800">{r.ended_by} <span className="text-slate-400">({r.ended_at ? dayjs(r.ended_at).format('DD/MM/YYYY HH:mm') : ''})</span></span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Reference No.', dataIndex: 'reference_no', ellipsis: true, width: 150, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Experiment Code', dataIndex: 'experiment_code', ellipsis: true, width: 150, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Project Code', dataIndex: 'project_code', ellipsis: true, width: 150, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    {
      title: 'Actions', key: 'a', width: 90, align: 'center', render: (_, r) => !r.ended_at && (
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
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          tableLayout="fixed"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} usage logs`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<UsageLog>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No usage logs' }}
        />
      </div>

      <Modal title={`Add ${KIND_LABEL[targetKind]} Usage Log`} open={addOpen} closable={false} onCancel={() => setAddOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ started_at: dayjs() }}>
          <Form.Item name="started_at" label="Start Time" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm:ss" /></Form.Item>
          <Form.Item name="previous_batch_no" label="Batch No."><Input /></Form.Item>
          <Form.Item name="previous_product_code" label="Product Name/Code"><Input /></Form.Item>
          <Form.Item name="reference_no" label="Reference No"><Input /></Form.Item>
          <Form.Item name="usage_remarks" label="Usage Remarks" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`End ${KIND_LABEL[targetKind]} Usage Log`} open={!!endTarget} closable={false} onCancel={() => setEndTarget(null)} onOk={() => endForm.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={endForm} layout="vertical" onFinish={doEnd} initialValues={{ ended_at: dayjs() }}>
          <Form.Item name="ended_at" label="Ended On" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm:ss" /></Form.Item>
          <Form.Item name="usage_remarks" label="Usage Remarks" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Tabular View (status history) ─────────────────────────────────────────────
function TabularViewTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const idField = ID_FIELD[targetKind]
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()])

  // This tab used to load the asset's entire status history unpaged, and the
  // date range it sends was ignored by the route.
  const fetcher = useCallback(
    (params: Record<string, unknown>) => usageLogApi.statusHistoryPaged(params),
    [],
  )
  const filters = useMemo(() => ({
    target_kind: targetKind,
    from_date: range[0].format('YYYY-MM-DD'),
    to_date: range[1].format('YYYY-MM-DD'),
    ...(itemId ? { [idField]: itemId } : {}),
  }), [targetKind, itemId, idField, range])
  const { tableProps } = useServerTable<StatusHistoryRow>(fetcher, { filters })

  const columns: ColumnsType<StatusHistoryRow> = [
    { title: 'Sl No', key: 'sl', ellipsis: true, width: 140, render: (_, __, i) => <span className="text-[13px] text-slate-800">{i + 1}</span> },
    { title: KIND_LABEL[targetKind], dataIndex: 'asset_code', ellipsis: true, width: 140, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Previous Product Code', dataIndex: 'previous_product_code', ellipsis: true, width: 140, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Previous Batch No.', dataIndex: 'previous_batch_no', ellipsis: true, width: 140, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Status', dataIndex: 'status', ellipsis: true, width: 140, render: v => <StatusTag color={STATUS_COLOR[v] ?? 'default'}>{v.replace(/_/g, ' ')}</StatusTag> },
    { title: 'Started By/On', key: 'started', ellipsis: true, width: 140, render: (_, r) => r.started_by ? <span className="text-[13px] text-slate-800">{r.started_by} <span className="text-slate-400">({dayjs(r.started_at).format('DD/MM/YYYY HH:mm')})</span></span> : <span className="text-[13px] text-slate-800">{dayjs(r.started_at).format('DD/MM/YYYY HH:mm')}</span> },
    { title: 'Ended By/On', key: 'ended', ellipsis: true, width: 140, render: (_, r) => r.ended_by ? <span className="text-[13px] text-slate-800">{r.ended_by} <span className="text-slate-400">({r.ended_at ? dayjs(r.ended_at).format('DD/MM/YYYY HH:mm') : ''})</span></span> : (r.ended_at ? <span className="text-[13px] text-slate-800">{dayjs(r.ended_at).format('DD/MM/YYYY HH:mm')}</span> : <span className="text-[13px] text-slate-800">NA</span>) },
    { title: 'Duration', dataIndex: 'duration', ellipsis: true, width: 140, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true, width: 140, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-2 items-center">
        <DatePicker.RangePicker value={range} onChange={v => v && v[0] && v[1] && setRange([v[0], v[1]])} format="DD/MM/YYYY" />
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table {...tableProps} columns={columns} rowKey={r => `${r.asset_code ?? ''}-${r.status}-${r.started_at}`} size="middle" scroll={{ x: 'max-content' }} tableLayout="fixed" locale={{ emptyText: 'No history' }} />
      </div>
    </div>
  )
}

// ── Calendar View ──────────────────────────────────────────────────────────────
function CalendarViewTab({ targetKind, itemId }: { targetKind: Kind; itemId: number | undefined }) {
  const idField = ID_FIELD[targetKind]
  const [month, setMonth] = useState(dayjs())
  const [data, setData] = useState<Record<string, CalendarSegment[]>>({})
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { target_kind: targetKind, month: month.format('YYYY-MM') }
      if (itemId) params[idField] = itemId
      setData(await usageLogApi.calendar(params))
    } finally { setLoading(false) }
  }, [targetKind, itemId, idField, month])
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
              <div key={i} className="border border-slate-100 rounded p-1 min-h-[90px]">
                <p className="text-[11px] text-slate-400">{d}</p>
                <div className="space-y-0.5 mt-0.5">
                  {segs.slice(0, 5).map((s, j) => (
                    <Tooltip key={j} title={`${s.asset_code ? s.asset_code + ' — ' : ''}${s.status.replace(/_/g, ' ')} — ${s.duration}`}>
                      <div>
                        {s.asset_code && <div className="text-[9px] truncate leading-tight text-slate-600">{s.asset_code}</div>}
                        <div className={`h-2 rounded ${CAL_BG[s.status] ?? 'bg-slate-200'}`} />
                      </div>
                    </Tooltip>
                  ))}
                  {segs.length > 5 && <p className="text-[9px] text-slate-400">+{segs.length - 5} more</p>}
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
  const [items, setItems] = useState<CatalogueItem[]>([])
  const [itemId, setItemId] = useState<number | undefined>()
  // The picker searches on the server. It used to ask for 500 rows and filter
  // them locally, which silently hid anything past that limit.
  const [itemSearchInput, setItemSearchInput] = useState('')
  const itemSearch = useDebouncedValue(itemSearchInput, 300)

  useEffect(() => { setItemId(undefined) }, [targetKind])
  useEffect(() => {
    const api = targetKind === 'EQUIPMENT' ? equipmentCatalogueApi
      : targetKind === 'INSTRUMENT' ? instrumentCatalogueApi
        : columnCatalogueApi
    api.list({ active_only: true, limit: 50, ...(itemSearch ? { search: itemSearch } : {}) }).then(setItems)
  }, [targetKind, itemSearch])

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-2 items-center">
        <span className="text-[13px] font-medium text-slate-600">{KIND_LABEL[targetKind]} Code:</span>
        <Select
          style={{ minWidth: 280 }} showSearch filterOption={false} onSearch={setItemSearchInput} allowClear
          placeholder="All (leave blank to see every item)"
          value={itemId} onChange={setItemId}
          options={items.map(it => ({ value: it.id, label: itemCode(targetKind, it) }))}
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
