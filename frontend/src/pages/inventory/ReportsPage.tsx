import { useState } from 'react'
import { Button, Input, Select, Table, Tag, Tabs } from 'antd'
import { Search, RefreshCw } from 'lucide-react'
import { reportsApi } from '../../api/inventory'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

// ── colour maps ────────────────────────────────────────────────────────────────
const BATCH_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', QUARANTINE: 'orange', REJECTED: 'red',
  CONSUMED: 'default', EXPIRED: 'volcano',
}
const SR_STATUS_COLOR: Record<string, string> = {
  PENDING: 'blue', APPROVED: 'cyan', REJECTED: 'red',
  FULFILLED: 'green', CANCELLED: 'default',
}
const CRIT_COLOR: Record<string, string> = { LOW: 'default', MEDIUM: 'orange', HIGH: 'red', CRITICAL: 'volcano' }
const EQ_STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', UNDER_MAINTENANCE: 'orange', DECOMMISSIONED: 'red' }
const MAINT_COLOR: Record<string, string> = { OK: 'green', DUE_SOON: 'orange', OVERDUE: 'red', UNDER_MAINTENANCE: 'blue' }

// ── Batch Inventory Tab ────────────────────────────────────────────────────────
function BatchInventoryTab() {
  const [rows, setRows] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const run = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (status) params.status = status
      const data = await reportsApi.batchInventory(params)
      setRows(data)
    } finally { setLoading(false) }
  }

  const filtered = (rows as Record<string, unknown>[]).filter(r => {
    const q = search.toLowerCase()
    return !q || String(r.batch_no ?? '').toLowerCase().includes(q) || String(r.inhouse_batch_no ?? '').toLowerCase().includes(q)
  })

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no', width: 130, render: v => <span className="font-mono text-[13px]">{v as string}</span> },
    { title: 'Inhouse Batch', dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140, render: v => <span className="font-mono text-[13px]">{v as string ?? '—'}</span> },
    { title: 'Material ID', dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 120, render: v => v ? <Tag color="blue" bordered className="text-[13px]">{v as string}</Tag> : '—' },
    { title: 'Qty Received', dataIndex: 'qty_received', key: 'qty_received', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{(v as number).toFixed(2)} {r.unit as string}</span> },
    { title: 'Qty Available', dataIndex: 'qty_available', key: 'qty_available', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{(v as number).toFixed(2)} {r.unit as string}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={BATCH_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Mfg Date', dataIndex: 'mfg_date', key: 'mfg_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YY') : '—'}</span> },
    { title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YY') : '—'}</span> },
    { title: 'GR Date', dataIndex: 'gr_date', key: 'gr_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YY') : '—'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search batch no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52"
          allowClear
        />
        <Select
          placeholder="All Statuses"
          value={status}
          onChange={setStatus}
          allowClear
          className="w-40"
          options={[
            { value: 'AVAILABLE', label: 'Available' },
            { value: 'QUARANTINE', label: 'Quarantine' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'CONSUMED', label: 'Consumed' },
            { value: 'EXPIRED', label: 'Expired' },
          ]}
        />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">
          Run Report
        </Button>
        <span className="text-slate-400 text-xs ml-2">{filtered.length} records</span>
      </div>
      <Table
        dataSource={filtered}
        columns={cols}
        rowKey="id"
        size="middle"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
      />
    </div>
  )
}

// ── Expiry Report Tab ─────────────────────────────────────────────────────────
function ExpiryReportTab() {
  const [rows, setRows] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [expiredOnly, setExpiredOnly] = useState<boolean>(false)
  const [daysAhead, setDaysAhead] = useState<number>(90)

  const run = async () => {
    setLoading(true)
    try {
      const data = await reportsApi.expiry({ expired_only: expiredOnly, days_ahead: daysAhead })
      setRows(data)
    } finally { setLoading(false) }
  }

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no', width: 130, render: v => <span className="font-mono text-[13px]">{v as string}</span> },
    { title: 'Inhouse Batch', dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140, render: v => <span className="font-mono text-[13px]">{v as string ?? '—'}</span> },
    { title: 'Material ID', dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Qty Available', dataIndex: 'qty_available', key: 'qty_available', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{(v as number).toFixed(2)} {r.unit as string}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={BATCH_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    {
      title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', width: 120,
      render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YYYY') : '—'}</span>
    },
    {
      title: 'Expired?', dataIndex: 'is_expired', key: 'is_expired', width: 100,
      render: v => v ? <Tag color="red" bordered className="text-[13px]">Expired</Tag> : <Tag color="green" bordered className="text-[13px]">Valid</Tag>
    },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select
          value={expiredOnly ? 'expired' : 'upcoming'}
          onChange={v => setExpiredOnly(v === 'expired')}
          className="w-44"
          options={[
            { value: 'upcoming', label: 'Expiring Soon' },
            { value: 'expired', label: 'Expired Only' },
          ]}
        />
        {!expiredOnly && (
          <Select
            value={daysAhead}
            onChange={setDaysAhead}
            className="w-36"
            options={[
              { value: 30, label: 'Next 30 days' },
              { value: 60, label: 'Next 60 days' },
              { value: 90, label: 'Next 90 days' },
              { value: 180, label: 'Next 180 days' },
            ]}
          />
        )}
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">
          Run Report
        </Button>
        <span className="text-slate-400 text-xs ml-2">{(rows as unknown[]).length} records</span>
      </div>
      <Table
        dataSource={rows as Record<string, unknown>[]}
        columns={cols}
        rowKey="id"
        size="middle"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
      />
    </div>
  )
}

// ── Stock Requests Report Tab ─────────────────────────────────────────────────
function StockRequestsReportTab() {
  const [rows, setRows] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [criticality, setCriticality] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const run = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (status) params.status = status
      if (criticality) params.criticality = criticality
      const data = await reportsApi.stockRequests(params)
      setRows(data)
    } finally { setLoading(false) }
  }

  const filtered = (rows as Record<string, unknown>[]).filter(r => {
    const q = search.toLowerCase()
    return !q || String(r.request_no ?? '').toLowerCase().includes(q)
  })

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Request No', dataIndex: 'request_no', key: 'request_no', width: 140, render: v => <span className="font-mono text-[13px]">{v as string}</span> },
    { title: 'Material ID', dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Qty Required', dataIndex: 'qty_required', key: 'qty_required', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{(v as number).toFixed(2)} {r.unit as string}</span> },
    { title: 'Criticality', dataIndex: 'criticality', key: 'criticality', width: 110, render: v => <Tag color={CRIT_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={SR_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 150, render: v => <span className="text-[13px]">{dayjs(v as string).format('DD-MMM-YY HH:mm')}</span> },
    { title: 'Updated At', dataIndex: 'updated_at', key: 'updated_at', width: 150, render: v => <span className="text-[13px]">{dayjs(v as string).format('DD-MMM-YY HH:mm')}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search request no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-48"
          allowClear
        />
        <Select
          placeholder="All Statuses"
          value={status}
          onChange={setStatus}
          allowClear
          className="w-40"
          options={[
            { value: 'PENDING', label: 'Pending' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'FULFILLED', label: 'Fulfilled' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
        <Select
          placeholder="All Criticalities"
          value={criticality}
          onChange={setCriticality}
          allowClear
          className="w-44"
          options={[
            { value: 'LOW', label: 'Low' },
            { value: 'MEDIUM', label: 'Medium' },
            { value: 'HIGH', label: 'High' },
            { value: 'CRITICAL', label: 'Critical' },
          ]}
        />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">
          Run Report
        </Button>
        <span className="text-slate-400 text-xs ml-2">{filtered.length} records</span>
      </div>
      <Table
        dataSource={filtered}
        columns={cols}
        rowKey="id"
        size="middle"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
      />
    </div>
  )
}

// ── Equipment Status Report Tab ────────────────────────────────────────────────
function EquipmentStatusTab() {
  const [rows, setRows] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [maintStatus, setMaintStatus] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const run = async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (status) params.status = status
      if (maintStatus) params.maintenance_status = maintStatus
      const data = await reportsApi.equipmentStatus(params)
      setRows(data)
    } finally { setLoading(false) }
  }

  const filtered = (rows as Record<string, unknown>[]).filter(r => {
    const q = search.toLowerCase()
    return !q || String(r.asset_id ?? '').toLowerCase().includes(q) || String(r.name ?? '').toLowerCase().includes(q)
  })

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Asset ID', dataIndex: 'asset_id', key: 'asset_id', width: 120, render: v => <Tag color="purple" bordered className="font-mono text-[13px]">{v as string}</Tag> },
    { title: 'Name', dataIndex: 'name', key: 'name', width: 180, render: v => <span className="text-[13px]">{v as string}</span> },
    { title: 'Make', dataIndex: 'make', key: 'make', width: 120, render: v => <span className="text-[13px]">{v as string ?? '—'}</span> },
    { title: 'Model', dataIndex: 'model', key: 'model', width: 120, render: v => <span className="text-[13px]">{v as string ?? '—'}</span> },
    { title: 'Location', dataIndex: 'location', key: 'location', width: 130, render: v => <span className="text-[13px]">{v as string ?? '—'}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 130, render: v => <Tag color={EQ_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Maint. Status', dataIndex: 'maintenance_status', key: 'maintenance_status', width: 140, render: v => <Tag color={MAINT_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{(v as string)?.replace(/_/g, ' ')}</Tag> },
    { title: 'Last Maintenance', dataIndex: 'last_maintenance_date', key: 'last_maintenance_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YYYY') : '—'}</span> },
    { title: 'Next Maintenance', dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD-MMM-YYYY') : '—'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search asset / name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-52"
          allowClear
        />
        <Select
          placeholder="All Statuses"
          value={status}
          onChange={setStatus}
          allowClear
          className="w-40"
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
            { value: 'DECOMMISSIONED', label: 'Decommissioned' },
          ]}
        />
        <Select
          placeholder="All Maint. Statuses"
          value={maintStatus}
          onChange={setMaintStatus}
          allowClear
          className="w-48"
          options={[
            { value: 'OK', label: 'OK' },
            { value: 'DUE_SOON', label: 'Due Soon' },
            { value: 'OVERDUE', label: 'Overdue' },
            { value: 'UNDER_MAINTENANCE', label: 'Under Maintenance' },
          ]}
        />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">
          Run Report
        </Button>
        <span className="text-slate-400 text-xs ml-2">{filtered.length} records</span>
      </div>
      <Table
        dataSource={filtered}
        columns={cols}
        rowKey="id"
        size="middle"
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: ['25', '50', '100'] }}
      />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-400 text-sm">Run on-demand inventory reports. Select a report type, apply filters and click Run Report.</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4">
        <Tabs
          defaultActiveKey="batch-inventory"
          items={[
            { key: 'batch-inventory', label: 'Batch Inventory', children: <BatchInventoryTab /> },
            { key: 'expiry', label: 'Expiry', children: <ExpiryReportTab /> },
            { key: 'stock-requests', label: 'Stock Requests', children: <StockRequestsReportTab /> },
            { key: 'equipment-status', label: 'Equipment Status', children: <EquipmentStatusTab /> },
          ]}
        />
      </div>
    </div>
  )
}
