import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Select, Modal, Form, DatePicker, Input, message, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { StatusTag } from '../../components/ui/StatusTag'
import { scheduleApi, workOrderApi, type RequestItem } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

type Kind = 'EQUIPMENT' | 'INSTRUMENT'

function PlannedTab({ targetKind, calibrationSource }: { targetKind: Kind; calibrationSource?: 'INTERNAL' | 'EXTERNAL' }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const logTypes = isEquipment
    ? [{ value: 'MAINTENANCE', label: 'Maintenance' }, { value: 'CLEANING', label: 'Cleaning' }]
    : [{ value: 'CALIBRATION', label: 'Calibration' }]
  const [logType, setLogType] = useState(logTypes[0].value)
  const [rows, setRows] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const [planTarget, setPlanTarget] = useState<RequestItem | null>(null)
  const [raiseTarget, setRaiseTarget] = useState<RequestItem | null>(null)
  const [form] = Form.useForm()
  const [raiseForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await workOrderApi.requests({ kind: 'PLANNED', target_kind: targetKind, log_type: logType })) }
    finally { setLoading(false) }
  }, [targetKind, logType])
  useEffect(() => { load() }, [load])

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
        deviation: !!v.deviation, remarks: v.remarks, calibration_source: calibrationSource,
      })
      message.success(`Raised ${wo.workorder_no}`); setRaiseTarget(null); raiseForm.resetFields()
      navigate(`/inventory/work-orders/${wo.id}`)
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const confirmRaise = (r: RequestItem) => {
    const isOverdue = (r.days_label ?? '').includes('passed')
    if (isOverdue) { setRaiseTarget(r); return }
    Modal.confirm({
      title: 'Maintenance Request Confirmation', content: 'Are you sure you want to send maintenance request?',
      okText: 'Yes', cancelText: 'No', centered: true, styles: glassModalStyles,
      onOk: async () => {
        try {
          const wo = await workOrderApi.raise({ schedule_id: r.id, kind: 'PLANNED', log_type: logType, calibration_source: calibrationSource })
          message.success(`Raised ${wo.workorder_no}`)
          navigate(`/inventory/work-orders/${wo.id}`)
        } catch (e: unknown) { message.error((e as Error).message) }
      },
    })
  }

  const columns: ColumnsType<RequestItem> = [
    { title: isEquipment ? 'Equipment Code' : 'Instrument Code', dataIndex: 'equipment_code', ellipsis: true, width: 150, render: v => <span className="font-mono text-[13px] text-slate-700">{v}</span> },
    { title: 'Schedule Type', dataIndex: 'schedule_type', ellipsis: true, width: 120, render: v => <span className="text-[13px] text-slate-600">{String(v).replace(/_/g, ' ')}</span> },
    { title: 'Due Date', dataIndex: 'due_date', ellipsis: true, width: 110 },
    { title: 'Planned Date', dataIndex: 'planned_date', ellipsis: true, width: 120, render: v => v ?? <span className="text-slate-300">—</span> },
    ...(isEquipment
      ? [{ title: 'Tolerance Days', dataIndex: 'tolerance_days', ellipsis: true, width: 120, render: (v: number | null) => v ?? <span className="text-slate-300">—</span> }]
      : [
          { title: 'Alert Limit', dataIndex: 'alert_limit', ellipsis: true, width: 110, render: (v: number | null) => v ?? <span className="text-slate-300">—</span> },
          { title: 'Deviation Limit', dataIndex: 'deviation_limit', ellipsis: true, width: 120, render: (v: number | null) => v ?? <span className="text-slate-300">—</span> },
        ]),
    { title: 'No. of Days', dataIndex: 'days_label', ellipsis: true, width: 140 },
    { title: 'Current Status', dataIndex: 'current_status', ellipsis: true, width: 150, render: v => v ? <StatusTag color="default">{String(v).replace(/_/g, ' ')}</StatusTag> : '—' },
    {
      title: 'Action', key: 'a', width: 140, render: (_, r) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => { setPlanTarget(r); form.resetFields() }}>Plan</Button>
          <Button size="small" type="primary" onClick={() => confirmRaise(r)}>Raise</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex gap-2 items-center">
        {logTypes.length > 1 && <Select value={logType} onChange={setLogType} style={{ minWidth: 150 }} options={logTypes} />}
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20 }} locale={{ emptyText: 'No pending requests' }} />
      </div>

      <Modal title="Planned Request" open={!!planTarget} closable={false} onCancel={() => setPlanTarget(null)} onOk={() => form.submit()} confirmLoading={saving} width={420} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={savePlan}>
          <Form.Item name="planned_date" label="Planned Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Add Remarks" open={!!raiseTarget} closable={false} onCancel={() => setRaiseTarget(null)} onOk={() => raiseForm.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={raiseForm} layout="vertical" onFinish={doRaise}>
          <Form.Item name="deviation" label="Deviation" initialValue={true} hidden><Input /></Form.Item>
          <Form.Item name="remarks" label="Remarks" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function DirectPickTab({ targetKind, kind }: { targetKind: Kind; kind: 'UNPLANNED' | 'BREAKDOWN' }) {
  const isEquipment = targetKind === 'EQUIPMENT'
  const [rows, setRows] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await workOrderApi.requests({ kind, target_kind: targetKind })) } finally { setLoading(false) }
  }, [kind, targetKind])
  useEffect(() => { load() }, [load])

  const raise = (r: RequestItem) => Modal.confirm({
    title: `${kind === 'BREAKDOWN' ? 'Breakdown' : 'Maintenance'} Request Confirmation`,
    content: 'Are you sure you want to send maintenance request?',
    okText: 'Yes', cancelText: 'No', centered: true, styles: glassModalStyles,
    onOk: async () => {
      try {
        const body = isEquipment ? { equipment_id: r.id } : { instrument_id: r.id }
        const wo = await workOrderApi.raise({ ...body, kind, log_type: isEquipment ? 'MAINTENANCE' : 'CALIBRATION' })
        message.success(`Raised ${wo.workorder_no}`)
        navigate(`/inventory/work-orders/${wo.id}`)
      } catch (e: unknown) { message.error((e as Error).message) }
    },
  })

  const columns: ColumnsType<RequestItem> = [
    { title: isEquipment ? 'Equipment Code' : 'Instrument Code', dataIndex: 'asset_id', ellipsis: true, width: 160, render: v => <span className="font-mono text-[13px] text-slate-700">{v}</span> },
    { title: 'Name', dataIndex: 'name', ellipsis: true },
    { title: 'Status', dataIndex: 'status', ellipsis: true, width: 150, render: v => <StatusTag color="default">{String(v).replace(/_/g, ' ')}</StatusTag> },
    {
      title: 'Action', key: 'a', width: 100, render: (_, r) => (
        <Button size="small" type="primary" disabled={r.has_open_request} onClick={() => raise(r)}>
          {r.has_open_request ? 'Pending' : 'Raise'}
        </Button>
      ),
    },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 20 }} />
      </div>
    </div>
  )
}

export default function RequestsPage({ targetKind }: { targetKind: Kind }) {
  const isInstrument = targetKind === 'INSTRUMENT'
  return (
    <div className="p-4 md:p-6">
      <Tabs
        items={isInstrument ? [
          { key: 'internal', label: 'Internal', children: <PlannedTab targetKind={targetKind} calibrationSource="INTERNAL" /> },
          { key: 'external', label: 'External', children: <PlannedTab targetKind={targetKind} calibrationSource="EXTERNAL" /> },
        ] : [
          { key: 'planned', label: 'Planned', children: <PlannedTab targetKind={targetKind} /> },
          { key: 'unplanned', label: 'Unplanned', children: <DirectPickTab targetKind={targetKind} kind="UNPLANNED" /> },
          { key: 'breakdown', label: 'Breakdown', children: <DirectPickTab targetKind={targetKind} kind="BREAKDOWN" /> },
        ]}
      />
    </div>
  )
}
