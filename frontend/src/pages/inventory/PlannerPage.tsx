import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Select, DatePicker, Input, Upload, Modal, Form, message, Space, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Download, Upload as UploadIcon, Plus, CheckCircle2, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { StatusTag } from '../../components/ui/StatusTag'
import {
  scheduleApi, masterTemplateApi, equipmentCatalogueApi, instrumentCatalogueApi,
  type Schedule, type EquipmentCatalogue, type InstrumentCatalogue,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

const SCHEDULE_TYPES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']
const label = (s: string) => s.replace(/_/g, ' ')

const STATUS_TAG: Record<string, string> = { DUE: 'gold', PLANNED: 'blue', DONE: 'green', CANCELLED: 'default' }

type Kind = 'EQUIPMENT' | 'INSTRUMENT'

export default function PlannerPage({ targetKind }: { targetKind: Kind }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const logTypes = isEquipment
    ? [{ value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'CLEANING', label: 'Cleaning' }]
    : [{ value: 'CALIBRATION', label: 'Calibration' }]
  const templateKey = isEquipment ? 'maintenance-planner' : 'calibration-planner'

  const [rows, setRows] = useState<Schedule[]>([])
  const [items, setItems] = useState<(EquipmentCatalogue | InstrumentCatalogue)[]>([])
  const [loading, setLoading] = useState(false)
  const [logType, setLogType] = useState(logTypes[0].value)
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs().add(30, 'day')])
  const [itemFilter, setItemFilter] = useState<number | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        target_kind: targetKind, log_type: logType,
        from_date: range[0].format('YYYY-MM-DD'), to_date: range[1].format('YYYY-MM-DD'),
      }
      if (itemFilter) params[isEquipment ? 'equipment_id' : 'instrument_id'] = itemFilter
      setRows(await scheduleApi.list(params))
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKind, logType, range, itemFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (isEquipment) equipmentCatalogueApi.list({ active_only: true, limit: 500 }).then(setItems)
    else instrumentCatalogueApi.list({ active_only: true, limit: 500 }).then(setItems)
  }, [isEquipment])

  const openCreate = () => { form.resetFields(); setCreateOpen(true) }
  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      const idField = isEquipment ? 'equipment_id' : 'instrument_id'
      await scheduleApi.create({
        [idField]: v[idField], log_type: logType, schedule_type: v.schedule_type,
        due_date: dayjs(v.due_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        tolerance_days: v.tolerance_days,
      })
      message.success('Schedule created'); setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const complete = (r: Schedule) => Modal.confirm({
    title: `Mark ${r.equipment_code} as done?`,
    content: 'This will record today as the completion date and auto-generate the next occurrence.',
    okText: 'Mark Done', centered: true, styles: glassModalStyles,
    onOk: async () => {
      try {
        await scheduleApi.complete(r.id, { done_on: dayjs().format('YYYY-MM-DD'), generate_next: true })
        message.success('Marked done — next occurrence generated'); load()
      } catch (e: unknown) { message.error((e as Error).message) }
    },
  })

  const del = (r: Schedule) => Modal.confirm({
    title: 'Delete this schedule?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await scheduleApi.delete(r.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const handleUpload = async (file: File) => {
    try {
      const res = await scheduleApi.upload(targetKind, logType, file)
      if (res.errors.length) {
        message.warning(`${res.created} created, ${res.skipped} skipped. See console for row errors.`)
        console.warn('Schedule upload errors:', res.errors)
      } else {
        message.success(`${res.created} schedule(s) created`)
      }
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
    return false
  }

  const columns: ColumnsType<Schedule> = [
    { title: isEquipment ? 'Equipment Code' : 'Instrument Code', ellipsis: true, dataIndex: 'equipment_code', width: 150, render: v => <span className="  text-[13px] text-slate-700">{v}</span> },
    { title: 'Schedule Type', ellipsis: true, dataIndex: 'schedule_type', width: 120, render: v => <span className="text-[13px] text-slate-600">{label(v)}</span> },
    { title: 'Due Date', ellipsis: true, dataIndex: 'due_date', width: 110, render: v => <span className="text-[13px] text-slate-700">{v}</span> },
    { title: 'Days', ellipsis: true, dataIndex: 'days_label', width: 130, render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    { title: 'Done On', ellipsis: true, dataIndex: 'done_on', width: 110, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-300">—</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 100, render: v => <StatusTag color={STATUS_TAG[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Current Status', ellipsis: true, dataIndex: 'current_status', width: 140, render: v => v ? <span className="text-[13px] text-slate-600">{String(v).replace(/_/g, ' ')}</span> : <span className="text-slate-300">—</span> },
    {
      title: 'Action', key: 'a', width: 100, align: 'right', render: (_, r) => (
        <Space size={2}>
          {r.status !== 'DONE' && <Tooltip title="Mark Done"><Button type="text" size="small" icon={<CheckCircle2 size={14} className="text-emerald-600" />} onClick={() => complete(r)} /></Tooltip>}
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => del(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        {logTypes.length > 1 && (
          <Select value={logType} onChange={setLogType} style={{ minWidth: 150 }} options={logTypes} />
        )}
        <Select
          placeholder={isEquipment ? 'All Equipment' : 'All Instruments'} allowClear showSearch optionFilterProp="label"
          style={{ minWidth: 200 }} value={itemFilter} onChange={setItemFilter}
          options={items.map(it => ({ value: it.id, label: it.asset_id }))}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
        />
        <div className="ml-auto flex gap-2">
          <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download(templateKey)}>Download Template</Button>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx">
            <Button icon={<UploadIcon size={14} />}>Upload</Button>
          </Upload>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>New Schedule</Button>
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title="New Schedule" open={createOpen} closable={false} onCancel={() => { setCreateOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ schedule_type: 'MONTHLY' }}>
          <Form.Item name={isEquipment ? 'equipment_id' : 'instrument_id'} label={isEquipment ? 'Equipment' : 'Instrument'} rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={items.map(it => ({ value: it.id, label: it.asset_id }))} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="schedule_type" label="Schedule Type" rules={[{ required: true }]}>
              <Select options={SCHEDULE_TYPES.map(s => ({ value: s, label: label(s) }))} />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="tolerance_days" label="Tolerance Days"><Input type="number" min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
