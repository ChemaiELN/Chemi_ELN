import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TablePaginationConfig } from 'antd/es/table'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { Button, Input, Select, Table, Tag, Tabs } from 'antd'
import { Search, RefreshCw } from 'lucide-react'
import { reportsApi } from '../../api/inventory'
import { STATUS_COLOR as EQ_STATUS_COLOR, CATALOGUE_STATUSES } from './EquipmentPage'
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
const MAINT_COLOR: Record<string, string> = { OK: 'green', DUE: 'orange', OVERDUE: 'red' }
const WO_STATUS_COLOR: Record<string, string> = { RAISED: 'gold', IN_PROGRESS: 'blue', PENDING_VERIFICATION: 'orange', PENDING_APPROVAL: 'purple', APPROVED: 'green' }

// Sequelize DECIMAL columns serialize as strings over JSON (e.g. "12.5000"),
// not numbers, so `(v as number).toFixed(2)` threw "v.toFixed is not a
// function" on every numeric report column. Coerce through Number first.
const qty = (v: unknown) => Number(v ?? 0).toFixed(2)


// ── Shared report table state ─────────────────────────────────────────────────
// Every tab below is the same shape: a few filter selects, an optional search
// box, and a table. All of it is resolved by the server — the tabs used to pull
// a fixed slice of rows and then filter and paginate it in the browser, which
// silently hid everything past that slice.
function useReportTable(
  fetcher: (params: Record<string, unknown>) => Promise<{ items: unknown[]; total: number }>,
  filters: Record<string, unknown>,
) {
  const [rows, setRows] = useState<unknown[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 300)

  // Filters are rebuilt on every render, so key the effect off their contents.
  const filterKey = JSON.stringify(filters)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        ...JSON.parse(filterKey),
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }
      if (search.trim()) params.search = search.trim()
      const { items, total } = await fetcher(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [fetcher, filterKey, page, pageSize, search])

  useEffect(() => { run() }, [run])
  useEffect(() => { setPage(1) }, [filterKey, search])

  const tableProps = {
    dataSource: rows as Record<string, unknown>[],
    loading,
    pagination: {
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      showTotal: (t: number) => `${t} records`,
    },
    onChange: (pagination: TablePaginationConfig) => {
      if (pagination.current) setPage(pagination.current)
      if (pagination.pageSize) setPageSize(pagination.pageSize)
    },
  }

  return { rows, total, loading, run, searchInput, setSearchInput, tableProps }
}

// ── Batch Inventory Tab ────────────────────────────────────────────────────────
function BatchInventoryTab() {
  const [status, setStatus] = useState<string | undefined>()
  const filters = useMemo(() => (status ? { status } : {}), [status])
  const { total, loading, run, searchInput, setSearchInput, tableProps } =
    useReportTable(reportsApi.batchInventory, filters)

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Batch No', ellipsis: true, dataIndex: 'batch_no', key: 'batch_no', width: 130, render: v => <span className="  text-[13px]">{v as string}</span> },
    { title: 'Inhouse Batch', ellipsis: true, dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140, render: v => <span className="  text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Material ID', ellipsis: true, dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Category', ellipsis: true, dataIndex: 'category', key: 'category', width: 120, render: v => v ? <Tag color="blue" bordered className="text-[13px]">{v as string}</Tag> : 'NA' },
    { title: 'Qty Received', ellipsis: true, dataIndex: 'qty_received', key: 'qty_received', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{qty(v)} {r.unit as string}</span> },
    { title: 'Qty Available', ellipsis: true, dataIndex: 'qty_available', key: 'qty_available', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{qty(v)} {r.unit as string}</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={BATCH_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Mfg Date', ellipsis: true, dataIndex: 'mfg_date', key: 'mfg_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
    { title: 'Expiry Date', ellipsis: true, dataIndex: 'expiry_date', key: 'expiry_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
    { title: 'GR Date', ellipsis: true, dataIndex: 'gr_date', key: 'gr_date', width: 110, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search batch no..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
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
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table
        {...tableProps}
        columns={cols}
        rowKey="id"
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

// ── Expiry Report Tab ─────────────────────────────────────────────────────────
function ExpiryReportTab() {
  const [expiredOnly, setExpiredOnly] = useState<boolean>(false)
  const [daysAhead, setDaysAhead] = useState<number>(90)
  const filters = useMemo(
    () => ({ expired_only: expiredOnly, days_ahead: daysAhead }),
    [expiredOnly, daysAhead],
  )
  const { total, loading, run, tableProps } = useReportTable(reportsApi.expiry, filters)

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Batch No', ellipsis: true, dataIndex: 'batch_no', key: 'batch_no', width: 130, render: v => <span className="  text-[13px]">{v as string}</span> },
    { title: 'Inhouse Batch', ellipsis: true, dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140, render: v => <span className="  text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Material ID', ellipsis: true, dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Qty Available', ellipsis: true, dataIndex: 'qty_available', key: 'qty_available', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{qty(v)} {r.unit as string}</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={BATCH_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    {
      title: 'Expiry Date', ellipsis: true, dataIndex: 'expiry_date', key: 'expiry_date', width: 120,
      render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span>
    },
    {
      title: 'Expired?', ellipsis: true, dataIndex: 'is_expired', key: 'is_expired', width: 100,
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
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table
        {...tableProps}
        columns={cols}
        rowKey="id"
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

// ── Stock Requests Report Tab ─────────────────────────────────────────────────
function StockRequestsReportTab() {
  const [status, setStatus] = useState<string | undefined>()
  const [criticality, setCriticality] = useState<string | undefined>()

  const filters = useMemo(() => ({
    ...(status ? { status } : {}),
    ...(criticality ? { criticality } : {}),
  }), [status, criticality])
  const { total, loading, run, searchInput, setSearchInput, tableProps } =
    useReportTable(reportsApi.stockRequests, filters)


  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Request No', ellipsis: true, dataIndex: 'request_no', key: 'request_no', width: 140, render: v => <span className="  text-[13px]">{v as string}</span> },
    { title: 'Material ID', ellipsis: true, dataIndex: 'material_id', key: 'material_id', width: 100, render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Qty Required', ellipsis: true, dataIndex: 'qty_required', key: 'qty_required', width: 110, align: 'right', render: (v, r) => <span className="text-[13px]">{qty(v)} {r.unit as string}</span> },
    { title: 'Criticality', ellipsis: true, dataIndex: 'criticality', key: 'criticality', width: 110, render: v => <Tag color={CRIT_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 110, render: v => <Tag color={SR_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Created At', ellipsis: true, dataIndex: 'created_at', key: 'created_at', width: 150, render: v => <span className="text-[13px]">{dayjs(v as string).format('DD/MM/YYYY HH:mm')}</span> },
    { title: 'Updated At', ellipsis: true, dataIndex: 'updated_at', key: 'updated_at', width: 150, render: v => <span className="text-[13px]">{dayjs(v as string).format('DD/MM/YYYY HH:mm')}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search request no..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
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
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table
        {...tableProps}
        columns={cols}
        rowKey="id"
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

// ── Equipment Status Report Tab ────────────────────────────────────────────────
function EquipmentStatusTab() {
  const [status, setStatus] = useState<string | undefined>()
  const [maintStatus, setMaintStatus] = useState<string | undefined>()

  const filters = useMemo(() => ({
    ...(status ? { status } : {}),
    ...(maintStatus ? { maintenance_status: maintStatus } : {}),
  }), [status, maintStatus])
  const { total, loading, run, searchInput, setSearchInput, tableProps } =
    useReportTable(reportsApi.equipmentStatus, filters)


  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Asset ID', ellipsis: true, dataIndex: 'asset_id', key: 'asset_id', width: 120, render: v => <Tag color="purple" bordered className="  text-[13px]">{v as string}</Tag> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', key: 'name', width: 180, render: v => <span className="text-[13px]">{v as string}</span> },
    { title: 'Make', ellipsis: true, dataIndex: 'make', key: 'make', width: 120, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Model', ellipsis: true, dataIndex: 'model', key: 'model', width: 120, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Location', ellipsis: true, dataIndex: 'location', key: 'location', width: 130, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 130, render: v => <Tag color={EQ_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Maint. Status', ellipsis: true, dataIndex: 'maintenance_status', key: 'maintenance_status', width: 140, render: v => <Tag color={MAINT_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{(v as string)?.replace(/_/g, ' ')}</Tag> },
    { title: 'Last Maintenance', ellipsis: true, dataIndex: 'last_maintenance_date', key: 'last_maintenance_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
    { title: 'Next Maintenance', ellipsis: true, dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search asset / name..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="w-52"
          allowClear
        />
        <Select
          placeholder="All Statuses"
          value={status}
          onChange={setStatus}
          allowClear
          className="w-40"
          options={CATALOGUE_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
        />
        <Select
          placeholder="All Maint. Statuses"
          value={maintStatus}
          onChange={setMaintStatus}
          allowClear
          className="w-48"
          options={[
            { value: 'OK', label: 'OK' },
            { value: 'DUE', label: 'Due' },
            { value: 'OVERDUE', label: 'Overdue' },
          ]}
        />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">
          Run Report
        </Button>
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table
        {...tableProps}
        columns={cols}
        rowKey="id"
        size="middle"
        scroll={{ x: 'max-content' }}
      />
    </div>
  )
}

// ── Instrument Status Report Tab ───────────────────────────────────────────────
function InstrumentStatusTab() {
  const [status, setStatus] = useState<string | undefined>()
  const [calibStatus, setCalibStatus] = useState<string | undefined>()

  const filters = useMemo(() => ({
    ...(status ? { status } : {}),
    ...(calibStatus ? { calibration_status: calibStatus } : {}),
  }), [status, calibStatus])
  const { total, loading, run, searchInput, setSearchInput, tableProps } =
    useReportTable(reportsApi.instrumentStatus, filters)


  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Asset ID', ellipsis: true, dataIndex: 'asset_id', key: 'asset_id', width: 130, render: v => <Tag color="purple" bordered className="  text-[13px]">{v as string}</Tag> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', key: 'name', width: 180, render: v => <span className="text-[13px]">{v as string}</span> },
    { title: 'Make', ellipsis: true, dataIndex: 'make', key: 'make', width: 120, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Model', ellipsis: true, dataIndex: 'model', key: 'model', width: 120, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Location', ellipsis: true, dataIndex: 'location', key: 'location', width: 130, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 130, render: v => <Tag color={EQ_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{(v as string)?.replace(/_/g, ' ')}</Tag> },
    { title: 'Calib. Status', ellipsis: true, dataIndex: 'calibration_status', key: 'calibration_status', width: 130, render: v => <Tag color={MAINT_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{v as string}</Tag> },
    { title: 'Req. Calibration', ellipsis: true, dataIndex: 'required_calibration', key: 'required_calibration', width: 120, render: v => v ? <Tag color="blue" bordered className="text-[13px]">Yes</Tag> : <Tag bordered className="text-[13px]">No</Tag> },
    { title: 'Last Calibration', ellipsis: true, dataIndex: 'last_calibration_date', key: 'last_calibration_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
    { title: 'Next Calibration', ellipsis: true, dataIndex: 'next_calibration_date', key: 'next_calibration_date', width: 140, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY') : 'NA'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} placeholder="Search asset / name..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-52" allowClear />
        <Select placeholder="All Statuses" value={status} onChange={setStatus} allowClear className="w-44"
          options={CATALOGUE_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        <Select placeholder="All Calib. Statuses" value={calibStatus} onChange={setCalibStatus} allowClear className="w-48"
          options={['OK', 'DUE', 'OVERDUE'].map(s => ({ value: s, label: s }))} />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">Run Report</Button>
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table {...tableProps} columns={cols} rowKey="id" size="middle" scroll={{ x: 'max-content' }} />
    </div>
  )
}

// ── Work Orders Report Tab ──────────────────────────────────────────────────────
function WorkOrdersReportTab() {
  const [targetKind, setTargetKind] = useState<string | undefined>()
  const [status, setStatus] = useState<string | undefined>()

  const filters = useMemo(() => ({
    ...(targetKind ? { target_kind: targetKind } : {}),
    ...(status ? { status } : {}),
  }), [targetKind, status])
  const { total, loading, run, searchInput, setSearchInput, tableProps } =
    useReportTable(reportsApi.workOrders, filters)


  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Workorder No', ellipsis: true, dataIndex: 'workorder_no', key: 'workorder_no', width: 140, render: v => <span className="  text-[13px]">{v as string}</span> },
    { title: 'Code', ellipsis: true, dataIndex: 'equipment_code', key: 'equipment_code', width: 130, render: v => <span className="  text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Kind', ellipsis: true, dataIndex: 'kind', key: 'kind', width: 110, render: v => <span className="text-[13px]">{v as string}</span> },
    { title: 'Log Type', ellipsis: true, dataIndex: 'log_type', key: 'log_type', width: 120, render: v => <span className="text-[13px]">{v as string}</span> },
    { title: 'Source', ellipsis: true, dataIndex: 'calibration_source', key: 'calibration_source', width: 100, render: v => v ? <span className="text-[13px]">{v as string}</span> : 'NA' },
    { title: 'Status', ellipsis: true, dataIndex: 'status', key: 'status', width: 170, render: v => <Tag color={WO_STATUS_COLOR[v as string] ?? 'default'} bordered className="text-[13px]">{(v as string)?.replace(/_/g, ' ')}</Tag> },
    { title: 'Raised By', ellipsis: true, dataIndex: 'raised_by', key: 'raised_by', width: 130, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Raised At', ellipsis: true, dataIndex: 'raised_at', key: 'raised_at', width: 150, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY HH:mm') : 'NA'}</span> },
    { title: 'Approved By', ellipsis: true, dataIndex: 'approved_by', key: 'approved_by', width: 130, render: v => <span className="text-[13px]">{v as string ?? 'NA'}</span> },
    { title: 'Approved At', ellipsis: true, dataIndex: 'approved_at', key: 'approved_at', width: 150, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY HH:mm') : 'NA'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} placeholder="Search workorder no..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="w-52" allowClear />
        <Select placeholder="All Targets" value={targetKind} onChange={setTargetKind} allowClear className="w-40"
          options={[{ value: 'EQUIPMENT', label: 'Equipment' }, { value: 'INSTRUMENT', label: 'Instrument' }]} />
        <Select placeholder="All Statuses" value={status} onChange={setStatus} allowClear className="w-52"
          options={Object.keys(WO_STATUS_COLOR).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">Run Report</Button>
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table {...tableProps} columns={cols} rowKey="id" size="middle" scroll={{ x: 'max-content' }} />
    </div>
  )
}

// ── Usage Summary Report Tab ────────────────────────────────────────────────────
function UsageSummaryTab() {
  const [targetKind, setTargetKind] = useState<string>('EQUIPMENT')

  const filters = useMemo(() => ({ target_kind: targetKind }), [targetKind])
  const { total, loading, run, tableProps } = useReportTable(reportsApi.usageSummary, filters)

  const cols: ColumnsType<Record<string, unknown>> = [
    { title: 'Asset ID', ellipsis: true, dataIndex: 'asset_id', key: 'asset_id', width: 150, render: v => v ? <Tag color="purple" bordered className="text-[13px]">{v as string}</Tag> : 'NA' },
    { title: 'Sessions', ellipsis: true, dataIndex: 'session_count', key: 'session_count', width: 100, align: 'right', render: v => <span className="text-[13px]">{v as number}</span> },
    { title: 'Total Hours', ellipsis: true, dataIndex: 'total_hours', key: 'total_hours', width: 120, align: 'right', render: v => <span className="text-[13px]">{Number(v ?? 0).toFixed(2)}</span> },
    { title: 'Last Used', ellipsis: true, dataIndex: 'last_used_at', key: 'last_used_at', width: 160, render: v => <span className="text-[13px]">{v ? dayjs(v as string).format('DD/MM/YYYY HH:mm') : 'NA'}</span> },
  ]

  return (
    <div>
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Select value={targetKind} onChange={setTargetKind} className="w-40"
          options={[{ value: 'EQUIPMENT', label: 'Equipment' }, { value: 'INSTRUMENT', label: 'Instrument' }]} />
        <Button type="primary" icon={<RefreshCw size={13} />} onClick={run} loading={loading} className="rounded-md font-medium">Run Report</Button>
        <span className="text-slate-400 text-xs ml-2">{total} records</span>
      </div>
      <Table {...tableProps} columns={cols} rowKey="id" size="middle" scroll={{ x: 'max-content' }} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Reports</h1>
          <p className="text-slate-400 text-sm">Run on-demand inventory reports. Select a report type, apply filters and click Run Report.</p>
        </div>
      </div> */}

      <div className="glass-card rounded-xl p-4">
        <Tabs
          defaultActiveKey="batch-inventory"
          items={[
            { key: 'batch-inventory', label: 'Batch Inventory', children: <BatchInventoryTab /> },
            { key: 'expiry', label: 'Expiry', children: <ExpiryReportTab /> },
            { key: 'stock-requests', label: 'Stock Requests', children: <StockRequestsReportTab /> },
            { key: 'equipment-status', label: 'Equipment Status', children: <EquipmentStatusTab /> },
            { key: 'instrument-status', label: 'Instrument Status', children: <InstrumentStatusTab /> },
            { key: 'work-orders', label: 'Work Orders', children: <WorkOrdersReportTab /> },
            { key: 'usage-summary', label: 'Usage Summary', children: <UsageSummaryTab /> },
          ]}
        />
      </div>
    </div>
  )
}
