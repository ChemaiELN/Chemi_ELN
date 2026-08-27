import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Select, DatePicker, Input, Upload, Modal, Form, message, Dropdown } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Download, Upload as UploadIcon, Plus, CheckCircle2, Trash2, Send, CalendarClock, MoreVertical } from 'lucide-react'
import dayjs from 'dayjs'
import { StatusTag } from '../../components/ui/StatusTag'
import { STATUS_COLOR } from './EquipmentPage'
import {
  scheduleApi, workOrderApi, masterTemplateApi, equipmentCatalogueApi, instrumentCatalogueApi,
  type Schedule, type EquipmentCatalogue, type InstrumentCatalogue,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const SCHEDULE_TYPES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']
const label = (s: string) => s.replace(/_/g, ' ')
const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

const STATUS_TAG: Record<string, string> = { DUE: 'gold', PLANNED: 'blue', DONE: 'green', CANCELLED: 'default' }

type Kind = 'EQUIPMENT' | 'INSTRUMENT'

export default function PlannerPage({ targetKind }: { targetKind: Kind }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const logTypes = isEquipment
    ? [{ value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'CLEANING', label: 'Cleaning' }]
    : [{ value: 'CALIBRATION', label: 'Calibration' }, { value: 'MAINTENANCE', label: 'Maintenance' }]
  const templateKey = isEquipment ? 'maintenance-planner' : 'calibration-planner'

  const [rows, setRows] = useState<Schedule[]>([])
  const [items, setItems] = useState<(EquipmentCatalogue | InstrumentCatalogue)[]>([])
  const [loading, setLoading] = useState(false)
  const [logType, setLogType] = useState(logTypes[0].value)
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs().add(30, 'day')])
  const [itemFilter, setItemFilter] = useState<number | undefined>()
  // The picker searches on the server. It used to ask for 500 rows and filter
  // them locally, which silently hid anything past that limit.
  const [itemSearchInput, setItemSearchInput] = useState('')
  const itemSearch = useDebouncedValue(itemSearchInput, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [planTarget, setPlanTarget] = useState<Schedule | null>(null)
  const [raiseTarget, setRaiseTarget] = useState<Schedule | null>(null)
  const [planForm] = Form.useForm()
  const [raiseForm] = Form.useForm()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        target_kind: targetKind, log_type: logType,
        from_date: range[0].format('YYYY-MM-DD'), to_date: range[1].format('YYYY-MM-DD'),
        skip: (page - 1) * pageSize, limit: pageSize,
      }
      if (itemFilter) params[isEquipment ? 'equipment_id' : 'instrument_id'] = itemFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await scheduleApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKind, logType, range, itemFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [targetKind, logType, range, itemFilter])
  useEffect(() => {
    const api = isEquipment ? equipmentCatalogueApi : instrumentCatalogueApi
    api.list({ active_only: true, limit: 50, ...(itemSearch ? { search: itemSearch } : {}) }).then(setItems)
  }, [isEquipment, itemSearch])

  const openCreate = () => { form.resetFields(); setItemSearchInput(''); setCreateOpen(true) }

  // Auto-fill Due Date from the selected asset's own Next Maintenance/
  // Calibration Date — mirrors the same field on its Edit form, kept in sync
  // by the catalogue PATCH handlers (see backend-node catalogue.routes.ts).
  const dueDateFieldOf = (item: EquipmentCatalogue | InstrumentCatalogue) =>
    logType === 'CALIBRATION' ? (item as InstrumentCatalogue).next_calibration_date : item.next_maintenance_date

  const handleItemSelect = (id: number) => {
    const item = items.find(it => it.id === id)
    const nextDue = item ? dueDateFieldOf(item) : null
    form.setFieldsValue({ due_date: nextDue ? dayjs(nextDue) : undefined })
  }

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      const idField = isEquipment ? 'equipment_id' : 'instrument_id'
      await scheduleApi.create({
        [idField]: v[idField], log_type: logType, schedule_type: v.schedule_type,
        due_date: dayjs(v.due_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        planned_date: v.planned_date ? dayjs(v.planned_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
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

  // Schedules with a checklist attached can't be marked done directly — they
  // have to go through a work order so observations + verify/approve
  // e-signatures get recorded (the backend rejects /complete on those too).
  const openPlan = (r: Schedule) => { setPlanTarget(r); planForm.resetFields() }
  const savePlan = async (v: Record<string, unknown>) => {
    if (!planTarget) return
    setSaving(true)
    try {
      await scheduleApi.update(planTarget.id, { planned_date: dayjs(v.planned_date as dayjs.Dayjs).format('YYYY-MM-DD'), status: 'PLANNED' })
      message.success('Planned date saved'); setPlanTarget(null); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const doRaise = async (v: Record<string, unknown>) => {
    if (!raiseTarget) return
    setSaving(true)
    try {
      const wo = await workOrderApi.raise({
        schedule_id: raiseTarget.id, kind: 'PLANNED', log_type: logType,
        deviation: !!v.deviation, remarks: v.remarks,
        calibration_source: logType === 'CALIBRATION' ? v.calibration_source : undefined,
      })
      message.success(`Raised ${wo.workorder_no}`); setRaiseTarget(null); raiseForm.resetFields()
      navigate(`/inventory/work-orders/${wo.id}`)
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const confirmRaise = (r: Schedule) => {
    const isOverdue = (r.days_label ?? '').includes('passed')
    // Overdue or calibration (needs a source picked) both require the remarks/details modal.
    if (isOverdue || logType === 'CALIBRATION') { setRaiseTarget(r); raiseForm.resetFields(); return }
    Modal.confirm({
      title: 'Maintenance Request Confirmation', content: 'Are you sure you want to send maintenance request?',
      okText: 'Yes', cancelText: 'No', centered: true, styles: glassModalStyles,
      onOk: async () => {
        try {
          const wo = await workOrderApi.raise({ schedule_id: r.id, kind: 'PLANNED', log_type: logType })
          message.success(`Raised ${wo.workorder_no}`)
          navigate(`/inventory/work-orders/${wo.id}`)
        } catch (e: unknown) { message.error((e as Error).message) }
      },
    })
  }

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
    { title: isEquipment ? 'Equipment Code' : 'Instrument Code', ellipsis: true, dataIndex: 'equipment_code', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Schedule Type', ellipsis: true, dataIndex: 'schedule_type', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{titleCase(v)}</span> },
    { title: 'Due Date', ellipsis: true, dataIndex: 'due_date', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span> },
    { title: 'Days', ellipsis: true, dataIndex: 'days_label', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Done On', ellipsis: true, dataIndex: 'done_on', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 140, align: 'center', sorter: true, render: v => <StatusTag color={STATUS_TAG[v] ?? 'default'} className="text-[13px]">{titleCase(v)}</StatusTag> },
    { title: 'Current Status', ellipsis: true, dataIndex: 'current_status', width: 140, align: 'center', sorter: true, render: v => v ? <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{titleCase(v)}</StatusTag> : <span className="text-[13px] text-slate-800">NA</span> },
    {
      title: 'Actions', key: 'a', width: 70, align: 'center', render: (_, r) => {
        // Mark Done is only offered for schedules with NO checklist mapped.
        // Anything with a checklist has to be executed through a work order so
        // the observations and Verified/Approved e-signatures get recorded —
        // the backend rejects /complete on those too.
        const items: MenuProps['items'] = [
          ...(r.status !== 'DONE'
            ? (r.checklist_id
                ? [
                    { key: 'plan', label: <span className="text-[12px]">Set Planned Date</span>, icon: <CalendarClock size={12} /> },
                    { key: 'raise', label: <span className="text-[12px]">Raise Work Order</span>, icon: <Send size={12} /> },
                  ]
                : [{ key: 'complete', label: <span className="text-[12px]">Mark Done</span>, icon: <CheckCircle2 size={12} /> }])
            : []),
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'plan') openPlan(r)
          else if (key === 'raise') confirmRaise(r)
          else if (key === 'complete') complete(r)
          else if (key === 'delete') del(r)
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
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        {logTypes.length > 1 && (
          <Select value={logType} onChange={setLogType} style={{ minWidth: 150 }} options={logTypes} />
        )}
        <Select
          placeholder={isEquipment ? 'All Equipment' : 'All Instruments'} allowClear showSearch
          filterOption={false}
          onSearch={setItemSearchInput}
          style={{ minWidth: 200 }} value={itemFilter} onChange={setItemFilter}
          options={items.map(it => ({ value: it.id, label: it.asset_id }))}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          format="DD/MM/YYYY"
        />
        <div className="flex gap-2">
          <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download(templateKey)}>Download Template</Button>
          <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx">
            <Button icon={<UploadIcon size={14} />}>Upload</Button>
          </Upload>
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>New Schedule</Button>
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} schedules`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Schedule>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal title="New Schedule" open={createOpen} closable={false} onCancel={() => { setCreateOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ schedule_type: 'MONTHLY' }}>
          <Form.Item name={isEquipment ? 'equipment_id' : 'instrument_id'} label={isEquipment ? 'Equipment' : 'Instrument'} rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={setItemSearchInput}
              onChange={handleItemSelect}
              options={items.map(it => ({ value: it.id, label: it.asset_id }))}
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="schedule_type" label="Schedule Type" rules={[{ required: true }]}>
              <Select options={SCHEDULE_TYPES.map(s => ({ value: s, label: label(s) }))} />
            </Form.Item>
            <Form.Item name="due_date" label="Due Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="planned_date" label="Planned Date">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                onChange={(v) => {
                  const item = items.find(it => it.id === form.getFieldValue(isEquipment ? 'equipment_id' : 'instrument_id'))
                  const nextDue = item ? dueDateFieldOf(item) : null
                  form.setFieldsValue({ due_date: v ?? (nextDue ? dayjs(nextDue) : undefined) })
                }}
              />
            </Form.Item>
            <Form.Item name="tolerance_days" label="Tolerance Days"><Input type="number" min={0} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal title="Planned Date" open={!!planTarget} closable={false} onCancel={() => setPlanTarget(null)} onOk={() => planForm.submit()} confirmLoading={saving} width={420} centered destroyOnHidden {...glassModalProps}>
        <Form form={planForm} layout="vertical" onFinish={savePlan}>
          <Form.Item name="planned_date" label="Planned Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Raise Work Order" open={!!raiseTarget} closable={false} onCancel={() => setRaiseTarget(null)} onOk={() => raiseForm.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={raiseForm} layout="vertical" onFinish={doRaise}>
          <Form.Item name="deviation" label="Deviation" initialValue={true} hidden><Input /></Form.Item>
          {logType === 'CALIBRATION' && (
            <Form.Item name="calibration_source" label="Calibration Source" rules={[{ required: true }]}>
              <Select options={[{ value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }]} />
            </Form.Item>
          )}
          <Form.Item name="remarks" label="Remarks" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
