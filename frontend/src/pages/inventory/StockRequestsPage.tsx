import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form,
  InputNumber, DatePicker, message, Tooltip, Dropdown,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import dayjs from 'dayjs'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, CheckCircle2, XCircle, PackageCheck, Search, SignalLow, SignalMedium, SignalHigh, Signal, PackagePlus, Hourglass, X, MoreVertical } from 'lucide-react'
import { stockRequestApi, materialApi, uomApi, dashboardApi, type StockRequest, type Material, type UomUnit } from '../../api/inventory'
import { userApi, type UserSummary } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { isSuperAdmin } from '../../utils/privileges'
import NewBatchModal, { type FulfillingRequest } from './NewBatchModal'

// Departments whose members can see materials across every department (not
// just their own) in the Material dropdown — QA/QC/Inventory work across
// all departments' materials day-to-day. Mirrors NewBatchModal.tsx.
const UNRESTRICTED_DEPARTMENT_CODES = ['QA', 'QC', 'INVENTORY']

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'blue', APPROVED: 'cyan', IN_PROGRESS: 'gold', FULFILLED: 'green', REJECTED: 'red', CANCELLED: 'default',
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
  const unrestricted = isSuperAdmin(user) ||
    (!!user?.department_code && UNRESTRICTED_DEPARTMENT_CODES.includes(user.department_code))
  // Scope the New Stock Request modal's Material dropdown to the logged-in
  // user's own department, unless they belong to QA/QC/Inventory (or are a
  // super admin) — those roles work across every department's materials.
  const materialDeptId = !unrestricted ? (user?.department_id ?? undefined) : undefined

  const [fulfillTarget, setFulfillTarget] = useState<FulfillingRequest | null>(null)
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [createOpen, setCreateOpen] = useState(false)
  const [remarkOpen, setRemarkOpen] = useState(false)
  const [remarkAction, setRemarkAction] = useState<{ id: number; action: 'approve' | 'reject' | 'cancel' | 'fulfill' | 'in_progress' } | null>(null)
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

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current)
    searchDebounceTimer.current = setTimeout(() => setSearch(value), 300)
  }

  // Rows the current user needs to act on are surfaced at the top of the list.
  // Only the client knows the user's privileges, so it sends the statuses that
  // count as actionable and the server does the ordering — reordering here
  // would only shuffle the page already fetched, leaving an actionable row on
  // page 2 stranded on page 2.
  const actionableStatuses = useMemo(() => {
    const statuses: string[] = []
    if (isApprover) statuses.push('PENDING')
    if (isStoreIncharge) statuses.push('APPROVED', 'IN_PROGRESS')
    return statuses.join(',')
  }, [isApprover, isStoreIncharge])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      else if (actionableStatuses) params.actionable_statuses = actionableStatuses
      const { items, total } = await stockRequestApi.listPaged(params)
      setRequests(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, page, pageSize, sortBy, sortDir, actionableStatuses])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current) }, [])
  useEffect(() => {
    materialApi.list({ active_only: true, limit: 200, ...(materialDeptId ? { department_id: materialDeptId } : {}) }).then(setMaterials)
  }, [materialDeptId])
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
        const items = await materialApi.list({
          active_only: true, search: term || undefined, limit: 50,
          ...(materialDeptId ? { department_id: materialDeptId } : {}),
        })
        setMaterialOptions(items)
      } finally {
        setMaterialSearchLoading(false)
      }
    }, 300)
  }, [materialDeptId])

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
    if (user?.username) {
      setUserOptions([{ username: user.username, emp_no: user.emp_no } as UserSummary])
      form.setFieldValue('requested_by', user.username)
    }
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
      else if (action === 'cancel') await stockRequestApi.cancel(id, values)
      else if (action === 'fulfill') await stockRequestApi.fulfill(id, values)
      else await stockRequestApi.inProgress(id, values)
      message.success(
        action === 'fulfill' ? 'Request fulfilled — stock replenished' :
        action === 'in_progress' ? 'Request marked in progress' :
        `Request ${action}d`,
      )
      setRemarkOpen(false); remarkForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const startAction = (id: number, action: 'approve' | 'reject' | 'cancel' | 'fulfill' | 'in_progress') => {
    setRemarkAction({ id, action })
    setRemarkOpen(true)
  }

  const columns: ColumnsType<StockRequest> = [
    {
      title: 'Request No',
      dataIndex: 'request_no',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v) => <span className=" text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Material',
      key: 'material',
      ellipsis: true,
      width: 150,
      render: (_, r) => {
        // Prefer the material joined by the backend (always present, regardless
        // of the 200-row cap on the client-side `materials` lookup list below).
        const name = r.material?.name ?? materials.find(m => m.id === r.material_id)?.name
        return <span className="text-[13px] text-slate-800">{name ?? r.material_id}</span>
      },
    },
    {
      title: 'Qty Required',
      dataIndex: 'qty_required',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (_, r) => <span className="text-[13px] text-slate-800">{r.qty_required} {r.unit}</span>,
    },
    {
      title: 'Criticality',
      dataIndex: 'criticality',
      width: 150,
      align: 'center',
      sorter: true,
      render: (v: string) => {
        const cfg = CRIT_ICON[v]
        if (!cfg) return <span className="text-[13px] text-slate-800">{v}</span>
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
      width: 150,
      sorter: true,
      render: (v: string, r) => {
        const tag = <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>
        if (v === 'IN_PROGRESS' && r.remarks) {
          return <Tooltip title={r.remarks}>{tag}</Tooltip>
        }
        return tag
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 70,
      align: 'center',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          ...(r.status === 'PENDING' && isApprover
            ? [
                { key: 'approve', label: <span className="text-[12px]">Approve</span>, icon: <CheckCircle2 size={12} /> },
                { key: 'reject', label: <span className="text-[12px]">Reject</span>, icon: <XCircle size={12} />, danger: true },
              ]
            : []),
          ...((r.status === 'APPROVED' || r.status === 'IN_PROGRESS') && isStoreIncharge
            ? [
                r.source_batch_id
                  ? { key: 'fulfill', label: <span className="text-[12px]">Fulfill (restock this SKU/Pack)</span>, icon: <PackagePlus size={12} /> }
                  : { key: 'fulfill', label: <span className="text-[12px]">Fulfill (create batch)</span>, icon: <PackageCheck size={12} /> },
                ...(r.status === 'APPROVED'
                  ? [{ key: 'in_progress', label: <span className="text-[12px]">Mark In Progress</span>, icon: <Hourglass size={12} /> }]
                  : []),
                { key: 'reject', label: <span className="text-[12px]">Reject</span>, icon: <XCircle size={12} />, danger: true },
                { key: 'cancel', label: <span className="text-[12px]">Cancel</span>, icon: <X size={12} />, danger: true },
              ]
            : []),
        ]
        if (!items.length) return null
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'approve') startAction(r.id, 'approve')
          else if (key === 'reject') startAction(r.id, 'reject')
          else if (key === 'in_progress') startAction(r.id, 'in_progress')
          else if (key === 'cancel') startAction(r.id, 'cancel')
          else if (key === 'fulfill') {
            if (r.source_batch_id) startAction(r.id, 'fulfill')
            else setFulfillTarget({
              id: r.id,
              material_id: r.material_id,
              qty_required: r.qty_required,
              unit: r.unit,
              request_no: r.request_no,
            })
          }
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
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
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
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} requests`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<StockRequest>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <NewBatchModal
        open={!!fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        onCreated={load}
        fulfillingRequest={fulfillTarget}
      />

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
            <Form.Item name="unit" label="Unit" rules={[{ required: true, message: 'Please select a unit' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={unitOptions.map(u => ({ value: u.symbol, label: `${u.name} (${u.symbol})` }))}
                placeholder="Select unit"
              />
            </Form.Item>
            <Form.Item name="criticality" label="Criticality" initialValue="GENERAL">
              <Select options={['GENERAL', 'CRITICAL'].map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
            </Form.Item>
            <Form.Item name="required_by_date" label="Required By Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
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
        title={
          remarkAction?.action === 'in_progress' ? 'Mark In Progress' :
          remarkAction?.action === 'fulfill' ? 'Fulfill Request' :
          `${remarkAction?.action?.charAt(0).toUpperCase()}${remarkAction?.action?.slice(1)} Request`
        }
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
