import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Select, Modal, Form,
  InputNumber, DatePicker, message, Space, Tooltip,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { Plus, CheckCircle2, XCircle, PackageCheck, Search, SignalLow, SignalMedium, SignalHigh, Signal } from 'lucide-react'
import { stockRequestApi, materialApi, type StockRequest, type Material } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'blue', APPROVED: 'cyan', FULFILLED: 'green', REJECTED: 'red', CANCELLED: 'default',
}
const CRIT_ICON: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  LOW:      { icon: <SignalLow  size={20} />, color: '#22c55e', bg: '#f0fdf4' },
  MEDIUM:   { icon: <SignalMedium size={20} />, color: '#f59e0b', bg: '#fffbeb' },
  HIGH:     { icon: <SignalHigh size={20} />, color: '#f97316', bg: '#fff7ed' },
  CRITICAL: { icon: <Signal    size={20} />, color: '#ef4444', bg: '#fef2f2' },
}

export default function StockRequestsPage() {
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remarkAction, setRemarkAction] = useState<{ id: number; action: 'approve' | 'reject' | 'fulfill' | 'cancel' } | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [remarkForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await stockRequestApi.list({})
      if (search) {
        const term = search.toLowerCase()
        setRequests(data.filter(r => {
          const matName = materials.find(m => m.id === r.material_id)?.name ?? ''
          return (
            r.request_no.toLowerCase().includes(term) ||
            matName.toLowerCase().includes(term) ||
            r.criticality.toLowerCase().includes(term) ||
            r.status.toLowerCase().includes(term) ||
            (r.requested_by ?? '').toLowerCase().includes(term) ||
            (r.unit ?? '').toLowerCase().includes(term)
          )
        }))
      } else {
        setRequests(data)
      }
    } finally { setLoading(false) }
  }, [search, materials])

  useEffect(() => { load() }, [load])
  useEffect(() => { materialApi.list({ active_only: true }).then(setMaterials) }, [])

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        required_by_date: values.required_by_date ? dayjs(values.required_by_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      await stockRequestApi.create(payload)
      message.success('Stock request submitted')
      setCreateOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const doAction = async (values: Record<string, unknown>) => {
    if (!remarkAction) return
    setSaving(true)
    try {
      const { id, action } = remarkAction
      if (action === 'approve') await stockRequestApi.approve(id, values)
      else if (action === 'reject') await stockRequestApi.reject(id, values)
      else if (action === 'fulfill') await stockRequestApi.fulfill(id, values)
      else await stockRequestApi.cancel(id, values)
      message.success(`Request ${action}d`)
      setRemarkOpen(false); remarkForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const startAction = (id: number, action: typeof remarkAction!['action']) => {
    setRemarkAction({ id, action })
    setRemarkOpen(true)
  }

  const columns: ColumnsType<StockRequest> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      width: 140,
      render: (v) => <span className="font-mono text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: 'Material',
      key: 'material',
      render: (_, r) => {
        const name = materials.find(m => m.id === r.material_id)?.name
        return <span className="text-[13px] text-slate-800">{name ?? r.material_id}</span>
      },
    },
    {
      title: 'Qty Required',
      key: 'qty',
      width: 120,
      render: (_, r) => <span className="text-[13px] text-slate-600">{r.qty_required} {r.unit}</span>,
    },
    {
      title: 'Criticality',
      dataIndex: 'criticality',
      width: 110,
      align: 'center',
      render: (v: string) => {
        const cfg = CRIT_ICON[v]
        if (!cfg) return <span className="text-[13px] text-slate-500">{v}</span>
        return (
          <Tooltip title={v.charAt(0) + v.slice(1).toLowerCase()}>
            <span className="inline-flex items-center" style={{ color: cfg.color }}>{cfg.icon}</span>
          </Tooltip>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 120,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleDateString()}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.status === 'PENDING' && (
            <>
              <Tooltip title="Approve">
                <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => startAction(r.id, 'approve')} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => startAction(r.id, 'reject')} />
              </Tooltip>
            </>
          )}
          {r.status === 'APPROVED' && (
            <Tooltip title="Fulfill">
              <Button type="text" size="small" icon={<PackageCheck size={13} />} onClick={() => startAction(r.id, 'fulfill')} />
            </Tooltip>
          )}
          {r.status !== 'CANCELLED' && r.status !== 'REJECTED' && r.status !== 'FULFILLED' && (
            <Tooltip title="Cancel">
              <Button type="text" size="small" danger onClick={() => startAction(r.id, 'cancel')}>✕</Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search request no / material / status…"
          style={{ width: 300 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)} className="rounded-md font-medium">
          New Request
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} requests` }}
        />
      </div>

      <Modal
        title="New Stock Request"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={560}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="material_id" label="Material" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={materials.map(m => ({ value: m.id, label: m.name }))} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="qty_required" label="Qty Required" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0.001} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" initialValue="g">
              <Input />
            </Form.Item>
            <Form.Item name="criticality" label="Criticality" initialValue="MEDIUM">
              <Select options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
            </Form.Item>
            <Form.Item name="required_by_date" label="Required By Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="requested_by" label="Requested By">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="purpose" label="Purpose">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`${remarkAction?.action?.charAt(0).toUpperCase()}${remarkAction?.action?.slice(1)} Request`}
        open={remarkOpen}
        onCancel={() => { setRemarkOpen(false); remarkForm.resetFields() }}
        onOk={() => remarkForm.submit()}
        confirmLoading={saving}
        width={360}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={remarkForm} layout="vertical" onFinish={doAction}>
          <Form.Item name="remarks" label="Remarks (optional)">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
