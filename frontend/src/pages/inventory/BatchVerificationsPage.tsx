import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Select, Modal, Form, Input, message, Space, Tooltip, Tabs, InputNumber } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, CheckCircle2, XCircle } from 'lucide-react'
import {
  batchVerifApi, batchApi, equipVerifApi, instrVerifApi,
  type BatchVerification, type Batch, type EquipVerification, type InstrVerification,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

const STATUS_COLOR: Record<string, string> = { PENDING: 'blue', VERIFIED: 'green', REJECTED: 'red' }

// ── Batch Verifications Tab ────────────────────────────────────────────────────
function BatchVerifTab() {
  const [verifs, setVerifs] = useState<BatchVerification[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ id: number; type: 'verify' | 'reject' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      setVerifs(await batchVerifApi.list(params))
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { batchApi.list({ limit: 200 }).then(setBatches) }, [])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await batchVerifApi.create(values)
      message.success('Verification request created')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const doAction = async (values: Record<string, unknown>) => {
    if (!actionTarget) return
    setSaving(true)
    try {
      if (actionTarget.type === 'verify') await batchVerifApi.verify(actionTarget.id, values)
      else await batchVerifApi.reject(actionTarget.id, values)
      message.success(`Verification ${actionTarget.type === 'verify' ? 'verified' : 'rejected'}`)
      setActionOpen(false); actionForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<BatchVerification> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      width: 150,
      render: (v) => <span className="font-mono text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: 'Batch',
      key: 'batch',
      width: 160,
      render: (_, r) => {
        const bno = batches.find(b => b.id === r.batch_id)?.batch_no
        return <span className="font-mono text-[13px] text-slate-600">{bno ?? r.batch_id}</span>
      },
    },
    {
      title: 'Requested By',
      dataIndex: 'requested_by',
      width: 140,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Requested At',
      dataIndex: 'requested_at',
      width: 160,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Verified By',
      dataIndex: 'verified_by',
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => r.status === 'PENDING' ? (
        <Space size={4}>
          <Tooltip title="Verify">
            <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'verify' }); setActionOpen(true) }} />
          </Tooltip>
          <Tooltip title="Reject">
            <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'reject' }); setActionOpen(true) }} />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['PENDING', 'VERIFIED', 'REJECTED'].map(s => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Verification
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={verifs}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} records` }}
        />
      </div>

      <Modal
        title="New Batch Verification"
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
          <Form.Item name="batch_id" label="Batch" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={batches.map(b => ({ value: b.id, label: b.batch_no }))} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionTarget?.type === 'verify' ? 'Verify Batch' : 'Reject Verification'}
        open={actionOpen}
        onCancel={() => { setActionOpen(false); actionForm.resetFields() }}
        onOk={() => actionForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={actionForm} layout="vertical" onFinish={doAction}>
          <Form.Item name="remarks" label="Remarks (optional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Equipment Verifications Tab ────────────────────────────────────────────────
function EquipVerifTab() {
  const [verifs, setVerifs] = useState<EquipVerification[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ id: number; type: 'verify' | 'reject' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      setVerifs(await equipVerifApi.list(params))
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await equipVerifApi.create(values)
      message.success('Equipment verification request created')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const doAction = async (values: Record<string, unknown>) => {
    if (!actionTarget) return
    setSaving(true)
    try {
      if (actionTarget.type === 'verify') await equipVerifApi.verify(actionTarget.id, values)
      else await equipVerifApi.reject(actionTarget.id, values)
      message.success(`Verification ${actionTarget.type === 'verify' ? 'verified' : 'rejected'}`)
      setActionOpen(false); actionForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<EquipVerification> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      width: 150,
      render: (v) => <span className="font-mono text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: 'Equipment ID',
      dataIndex: 'equipment_id',
      width: 130,
      render: (v: number) => <span className="font-mono text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Requested By',
      dataIndex: 'requested_by',
      width: 140,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Requested At',
      dataIndex: 'requested_at',
      width: 160,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Verified By',
      dataIndex: 'verified_by',
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => r.status === 'PENDING' ? (
        <Space size={4}>
          <Tooltip title="Verify">
            <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'verify' }); setActionOpen(true) }} />
          </Tooltip>
          <Tooltip title="Reject">
            <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'reject' }); setActionOpen(true) }} />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['PENDING', 'VERIFIED', 'REJECTED'].map(s => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Verification
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={verifs}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} records` }}
        />
      </div>

      <Modal
        title="New Equipment Verification"
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
          <Form.Item name="equipment_id" label="Equipment ID" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionTarget?.type === 'verify' ? 'Verify Equipment' : 'Reject Verification'}
        open={actionOpen}
        onCancel={() => { setActionOpen(false); actionForm.resetFields() }}
        onOk={() => actionForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={actionForm} layout="vertical" onFinish={doAction}>
          <Form.Item name="remarks" label="Remarks (optional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instrument Verifications Tab ───────────────────────────────────────────────
function InstrVerifTab() {
  const [verifs, setVerifs] = useState<InstrVerification[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createOpen, setCreateOpen] = useState(false)
  const [actionOpen, setActionOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ id: number; type: 'verify' | 'reject' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [actionForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (statusFilter) params.status = statusFilter
      setVerifs(await instrVerifApi.list(params))
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      await instrVerifApi.create(values)
      message.success('Instrument verification request created')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const doAction = async (values: Record<string, unknown>) => {
    if (!actionTarget) return
    setSaving(true)
    try {
      if (actionTarget.type === 'verify') await instrVerifApi.verify(actionTarget.id, values)
      else await instrVerifApi.reject(actionTarget.id, values)
      message.success(`Verification ${actionTarget.type === 'verify' ? 'verified' : 'rejected'}`)
      setActionOpen(false); actionForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<InstrVerification> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      width: 150,
      render: (v) => <span className="font-mono text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: 'Instrument ID',
      dataIndex: 'instrument_id',
      width: 130,
      render: (v: number) => <span className="font-mono text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Requested By',
      dataIndex: 'requested_by',
      width: 140,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Requested At',
      dataIndex: 'requested_at',
      width: 160,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Verified By',
      dataIndex: 'verified_by',
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      align: 'right',
      render: (_, r) => r.status === 'PENDING' ? (
        <Space size={4}>
          <Tooltip title="Verify">
            <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'verify' }); setActionOpen(true) }} />
          </Tooltip>
          <Tooltip title="Reject">
            <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => { setActionTarget({ id: r.id, type: 'reject' }); setActionOpen(true) }} />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div className="pt-4">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          placeholder="All Status"
          allowClear
          style={{ minWidth: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={['PENDING', 'VERIFIED', 'REJECTED'].map(s => ({ value: s, label: s }))}
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Verification
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={verifs}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} records` }}
        />
      </div>

      <Modal
        title="New Instrument Verification"
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
          <Form.Item name="instrument_id" label="Instrument ID" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={actionTarget?.type === 'verify' ? 'Verify Instrument' : 'Reject Verification'}
        open={actionOpen}
        onCancel={() => { setActionOpen(false); actionForm.resetFields() }}
        onOk={() => actionForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={actionForm} layout="vertical" onFinish={doAction}>
          <Form.Item name="remarks" label="Remarks (optional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BatchVerificationsPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        items={[
          { key: 'batch', label: 'Batch Verifications', children: <BatchVerifTab /> },
          { key: 'equipment', label: 'Equipment Verifications', children: <EquipVerifTab /> },
          { key: 'instrument', label: 'Instrument Verifications', children: <InstrVerifTab /> },
        ]}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarGutter={24}
      />
    </div>
  )
}
