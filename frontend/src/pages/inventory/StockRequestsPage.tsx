import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form,
  InputNumber, DatePicker, message, Space, Tooltip,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { Plus, CheckCircle2, XCircle, PackageCheck, Search, SignalLow, SignalMedium, SignalHigh, Signal } from 'lucide-react'
import { stockRequestApi, materialApi, uomApi, dashboardApi, type StockRequest, type Material, type UomUnit } from '../../api/inventory'
import { userApi, type UserSummary } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'blue', APPROVED: 'cyan', FULFILLED: 'green', REJECTED: 'red', CANCELLED: 'default',
}

// Two-stage approval, mirrored from the backend gate in stock_requests.py:
// HOD/TL approve or reject a PENDING request; Store Incharge then rejects,
// cancels, or fulfills an APPROVED one. Nobody else sees action buttons.
const APPROVER_ROLES = ['HOD', 'TL']
const STORE_INCHARGE_ROLE = 'STORE_INCHARGE'
const CRIT_ICON: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  LOW:      { icon: <SignalLow  size={20} />, color: '#22c55e', bg: '#f0fdf4' },
  MEDIUM:   { icon: <SignalMedium size={20} />, color: '#f59e0b', bg: '#fffbeb' },
  HIGH:     { icon: <SignalHigh size={20} />, color: '#f97316', bg: '#fff7ed' },
  CRITICAL: { icon: <Signal    size={20} />, color: '#ef4444', bg: '#fef2f2' },
}

export default function StockRequestsPage() {
  const user = useAppSelector(selectUser)
  const isApprover = APPROVER_ROLES.includes(user?.role_code ?? '')
  const isStoreIncharge = user?.role_code === STORE_INCHARGE_ROLE

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

  // Server-side search for the Material dropdown in the create modal — the
  // materials fetched for table-name lookups are capped at 200 (backend max),
  // so the picker needs its own live search instead of filtering that list.
  const [materialOptions, setMaterialOptions] = useState<Material[]>([])
  const [materialSearchLoading, setMaterialSearchLoading] = useState(false)
  const materialSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Server-side search for the "Requested By" dropdown — same live-search
  // pattern as Material, backed by the shared user-lookup endpoint.
  const [userOptions, setUserOptions] = useState<UserSummary[]>([])
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Unit dropdown — sourced from the UOM master's "Mass" dimension.
  const [unitOptions, setUnitOptions] = useState<UomUnit[]>([])

  // Available-qty hint under Qty Required — sums qty_available across
  // batches for the selected material.
  const [availableQty, setAvailableQty] = useState<{ qty: number; batchCount: number } | null>(null)
  const [availableQtyLoading, setAvailableQtyLoading] = useState(false)
  const selectedMaterialId = Form.useWatch('material_id', form)
  const qtyRequiredValue = Form.useWatch('qty_required', form)

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
  useEffect(() => { materialApi.list({ active_only: true, limit: 200 }).then(setMaterials) }, [])
  useEffect(() => {
    uomApi.get('mass').then(dim => setUnitOptions(dim.units.filter(u => u.is_active)))
  }, [])

  useEffect(() => {
    if (!selectedMaterialId) { setAvailableQty(null); return }
    setAvailableQtyLoading(true)
    dashboardApi.availableStock({ material_id: selectedMaterialId })
      .then(rows => {
        const row = rows[0]
        setAvailableQty(row ? { qty: row.total_qty_available, batchCount: row.batch_count } : { qty: 0, batchCount: 0 })
      })
      .finally(() => setAvailableQtyLoading(false))
  }, [selectedMaterialId])

  const searchMaterials = useCallback((term: string) => {
    if (materialSearchTimer.current) clearTimeout(materialSearchTimer.current)
    materialSearchTimer.current = setTimeout(async () => {
      setMaterialSearchLoading(true)
      try {
        const items = await materialApi.list({ active_only: true, search: term || undefined, limit: 50 })
        setMaterialOptions(items)
      } finally {
        setMaterialSearchLoading(false)
      }
    }, 300)
  }, [])

  const searchUsers = useCallback((term: string) => {
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current)
    userSearchTimer.current = setTimeout(async () => {
      setUserSearchLoading(true)
      try {
        const { items } = await userApi.list({ search: term || undefined, limit: 30 })
        setUserOptions(items)
      } finally {
        setUserSearchLoading(false)
      }
    }, 300)
  }, [])

  const openCreate = () => {
    setCreateOpen(true)
    searchMaterials('')
    searchUsers('')
  }

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

  const startAction = (id: number, action: 'approve' | 'reject' | 'fulfill' | 'cancel') => {
    setRemarkAction({ id, action })
    setRemarkOpen(true)
  }

  const columns: ColumnsType<StockRequest> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      ellipsis: true,
      width: 140,
      render: (v) => <span className=" text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: 'Material',
      key: 'material',
      ellipsis: true,
      render: (_, r) => {
        const name = materials.find(m => m.id === r.material_id)?.name
        return <span className="text-[13px] text-slate-800">{name ?? r.material_id}</span>
      },
    },
    {
      title: 'Qty Required',
      key: 'qty',
      ellipsis: true,
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
      ellipsis: true,
      width: 110,
      render: (v: string) => <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      ellipsis: true,
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
          {r.status === 'PENDING' && isApprover && (
            <>
              <Tooltip title="Approve">
                <Button type="text" size="small" icon={<CheckCircle2 size={13} />} onClick={() => startAction(r.id, 'approve')} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => startAction(r.id, 'reject')} />
              </Tooltip>
            </>
          )}
          {r.status === 'APPROVED' && isStoreIncharge && (
            <>
              <Tooltip title="Fulfill">
                <Button type="text" size="small" icon={<PackageCheck size={13} />} onClick={() => startAction(r.id, 'fulfill')} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" size="small" danger icon={<XCircle size={13} />} onClick={() => startAction(r.id, 'reject')} />
              </Tooltip>
              <Tooltip title="Cancel">
                <Button type="text" size="small" danger onClick={() => startAction(r.id, 'cancel')}>✕</Button>
              </Tooltip>
            </>
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
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
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
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} requests` }}
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
         closable={false}
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="material_id" label="Material" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchMaterials}
              loading={materialSearchLoading}
              notFoundContent={materialSearchLoading ? 'Searching…' : 'No materials found'}
              options={materialOptions.map(m => ({ value: m.id, label: `${m.name} (${m.code})` }))}
              placeholder="Search materials by name or code…"
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item
              name="qty_required"
              label="Qty Required"
              rules={[{ required: true }]}
              extra={
                qtyRequiredValue && selectedMaterialId ? (
                  availableQtyLoading ? (
                    <span className="text-xs text-slate-400">Checking available stock…</span>
                  ) : availableQty && availableQty.qty > 0 ? (
                    <span className="text-xs text-amber-600">
                      Qty required is already present in stock — {availableQty.qty} available across {availableQty.batchCount} batch{availableQty.batchCount !== 1 ? 'es' : ''}.
                    </span>
                  ) : null
                ) : null
              }
            >
              <InputNumber style={{ width: '100%' }} min={0.001} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" initialValue="g">
              <Select
                showSearch
                optionFilterProp="label"
                options={unitOptions.map(u => ({ value: u.symbol, label: `${u.name} (${u.symbol})` }))}
                placeholder="Select unit"
              />
            </Form.Item>
            <Form.Item name="criticality" label="Criticality" initialValue="MEDIUM">
              <Select options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
            </Form.Item>
            <Form.Item name="required_by_date" label="Required By Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="requested_by" label="Requested By">
              <Select
                showSearch
                filterOption={false}
                onSearch={searchUsers}
                loading={userSearchLoading}
                notFoundContent={userSearchLoading ? 'Searching…' : 'No users found'}
                options={userOptions.map(u => ({ value: u.username, label: `${u.username}${u.emp_no ? ` (${u.emp_no})` : ''}` }))}
                placeholder="Search users…"
                allowClear
              />
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
        closable={false}
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
