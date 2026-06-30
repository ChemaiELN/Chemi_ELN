import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Select, Modal, Form, Input, DatePicker, message, Space, Tooltip, Tabs } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import {
  maintenanceApi, calibrationApi,
  type MaintenanceSchedule, type CalibrationSchedule,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

const STATUS_COLOR: Record<string, string> = { DUE: 'orange', COMPLETED: 'green', CANCELLED: 'default', IN_PROGRESS: 'blue' }

function MaintenanceTab() {
  const [rows, setRows] = useState<MaintenanceSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [completeForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      setRows(await maintenanceApi.list(params))
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await maintenanceApi.create({ ...values, scheduled_date: dayjs(values.scheduled_date as dayjs.Dayjs).format('YYYY-MM-DD') })
      message.success('Schedule created')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleComplete = async (values: Record<string, unknown>) => {
    if (!selectedId) return
    setSaving(true)
    try {
      await maintenanceApi.complete(selectedId, { ...values, completed_date: dayjs(values.completed_date as dayjs.Dayjs).format('YYYY-MM-DD') })
      message.success('Marked complete')
      setCompleteOpen(false); completeForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<MaintenanceSchedule> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (v) => <span className="font-mono text-[13px] text-slate-500">{v}</span>,
    },
    {
      title: 'Equipment ID',
      dataIndex: 'equipment_id',
      width: 120,
      render: (v) => <span className="font-mono text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduled_date',
      width: 120,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Completed',
      dataIndex: 'completed_date',
      width: 120,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      ellipsis: true,
      render: (v) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'right',
      render: (_, r) => r.status === 'DUE' ? (
        <Space size={4}>
          <Tooltip title="Complete">
            <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => { setSelectedId(r.id); setCompleteOpen(true) }} />
          </Tooltip>
          <Tooltip title="Cancel">
            <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={async () => { await maintenanceApi.cancel(r.id); load() }} />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['DUE', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Schedule
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </div>

      <Modal
        title="New Maintenance Schedule"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={400}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="equipment_id" label="Equipment ID" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Complete Maintenance"
        open={completeOpen}
        onCancel={() => { setCompleteOpen(false); completeForm.resetFields() }}
        onOk={() => completeForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="completed_date" label="Completed Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function CalibrationTab() {
  const [rows, setRows] = useState<CalibrationSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [completeForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      setRows(await calibrationApi.list(params))
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await calibrationApi.create({ ...values, scheduled_date: dayjs(values.scheduled_date as dayjs.Dayjs).format('YYYY-MM-DD') })
      message.success('Calibration schedule created')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleComplete = async (values: Record<string, unknown>) => {
    if (!selectedId) return
    setSaving(true)
    try {
      await calibrationApi.complete(selectedId, { ...values, completed_date: dayjs(values.completed_date as dayjs.Dayjs).format('YYYY-MM-DD') })
      message.success('Marked complete')
      setCompleteOpen(false); completeForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<CalibrationSchedule> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (v) => <span className="font-mono text-[13px] text-slate-500">{v}</span>,
    },
    {
      title: 'Instrument ID',
      dataIndex: 'instrument_id',
      width: 130,
      render: (v) => <span className="font-mono text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduled_date',
      width: 120,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Completed',
      dataIndex: 'completed_date',
      width: 120,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Certificate No',
      dataIndex: 'certificate_no',
      width: 140,
      render: (v: string | null) => v
        ? <span className="font-mono text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'right',
      render: (_, r) => r.status === 'DUE' ? (
        <Space size={4}>
          <Tooltip title="Complete">
            <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => { setSelectedId(r.id); setCompleteOpen(true) }} />
          </Tooltip>
          <Tooltip title="Cancel">
            <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={async () => { await calibrationApi.cancel(r.id); load() }} />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div className="pt-3">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['DUE', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Schedule
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </div>

      <Modal
        title="New Calibration Schedule"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={400}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="instrument_id" label="Instrument ID" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="certificate_no" label="Certificate No"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Complete Calibration"
        open={completeOpen}
        onCancel={() => { setCompleteOpen(false); completeForm.resetFields() }}
        onOk={() => completeForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="completed_date" label="Completed Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="certificate_no" label="Certificate No"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function SchedulesPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        items={[
          { key: 'maintenance', label: 'Maintenance Schedules', children: <MaintenanceTab /> },
          { key: 'calibration', label: 'Calibration Schedules', children: <CalibrationTab /> },
        ]}
        tabBarStyle={{ marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.4)' }}
        tabBarGutter={24}
      />
    </div>
  )
}
