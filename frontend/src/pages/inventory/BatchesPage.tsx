import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form,
  InputNumber, DatePicker, message, Tooltip, Dropdown,
  Drawer, Divider, Upload, Pagination,
} from 'antd'
import type { UploadFile } from 'antd/es/upload'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Eye, Zap, Search, Pencil, Upload as UploadIcon, FileCheck, History, MessageSquare, Download, X, Send, ClipboardList, MoreVertical } from 'lucide-react'
import dayjs from 'dayjs'
import { batchApi, manufacturerApi, storageLocationApi, uomApi, stockRequestApi, type Batch, type BatchEvent, type Manufacturer, type StorageLocation, type UomDimension } from '../../api/inventory'
import { departmentApi, type Department } from '../../api/adc'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import NewBatchModal from './NewBatchModal'
import { useDepartmentFilterLock } from '../../hooks/useDepartmentFilterLock'
import { useColumnSearch } from '../../hooks/useColumnSearch'

const API_BASE =
  (typeof window !== 'undefined' && (window as { __APP_CONFIG__?: { API_URL?: string } }).__APP_CONFIG__?.API_URL) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:8000'

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
}

async function fetchCoaBlob(batchId: number, batchNo: string, coaFilePath: string) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`${API_BASE}/api/inventory/batches/${batchId}/coa`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Failed to load COA file')
  const ext = coaFilePath.split('.').pop()?.toLowerCase() ?? 'pdf'
  const filename = `COA_${batchNo}.${ext}`
  const rawBlob = await res.blob()
  // Force the correct MIME type so the browser renders the blob inline
  // instead of triggering a Save-As dialog (the server sends octet-stream).
  const mime = MIME_MAP[ext] ?? rawBlob.type
  const blob = new Blob([rawBlob], { type: mime })
  return { blob, filename, ext }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', PARTIALLY_CONSUMED: 'blue', CONSUMED: 'default',
  EXPIRED: 'red', QUARANTINE: 'orange', RETEST: 'gold',
}

// Rows come back pre-expanded one-per-pack from the backend
// (?expand_packs=1): `pack_sku`/`row_key` are populated per row, so no
// client-side flattening is needed here.
type FlatRow = Batch

const EVENT_STYLES: Record<string, { background: string; color: string }> = {
  RECEIVED: { background: '#d1fae5', color: '#065f46' },
  BATCH_CREATED: { background: '#d1fae5', color: '#065f46' },
  ISSUED: { background: '#fef3c7', color: '#92400e' },
  BATCH_ISSUED: { background: '#fef3c7', color: '#92400e' },
  STOCK_ALLOCATION: { background: '#D9E5FF', color: '#2563EB' },
  BATCH_ALLOCATED: { background: '#D9E5FF', color: '#2563EB' },
  BATCH_UPDATED: { background: '#FFF5E9', color: '#F59E0B' },
  BATCH_TOGGLED: { background: '#f3f4f6', color: '#4b5563' },
  ADJUSTMENT: { background: '#FFDAF4', color: '#B13588' },
}

function getEventStyle(eventType: string) {
  return EVENT_STYLES[eventType] ?? { background: '#E5E7EB', color: '#374151' }
}

function formatEventLabel(eventType: string) {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// statusFilter narrows the list to a fixed subset, powering the "Non
// Available Batches" (RETEST/EXPIRED) and "Historic Batches" (CONSUMED)
// pages — both otherwise identical views of the same table.
export default function BatchesPage({ statusFilter }: { statusFilter?: 'non_available' | 'historic' } = {}) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([])
  const [uomDimensions, setUomDimensions] = useState<UomDimension[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const { isLocked: deptFilterLocked, lockedDepartmentId } = useDepartmentFilterLock()
  useEffect(() => { if (lockedDepartmentId) setDeptFilter(lockedDepartmentId) }, [lockedDepartmentId])
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [createOpen, setCreateOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBatch, setHistoryBatch] = useState<Batch | null>(null)
  const [historyEvents, setHistoryEvents] = useState<BatchEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editBatch, setEditBatch] = useState<Batch | null>(null)
  const [editCoaFile, setEditCoaFile] = useState<UploadFile | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [coaViewerOpen, setCoaViewerOpen] = useState(false)
  const [coaViewerUrl, setCoaViewerUrl] = useState<string | null>(null)
  const [coaViewerFilename, setCoaViewerFilename] = useState('')
  const [coaViewerExt, setCoaViewerExt] = useState('')
  const [coaViewerBlob, setCoaViewerBlob] = useState<Blob | null>(null)
  const [coaViewerLoading, setCoaViewerLoading] = useState(false)
  const [form] = Form.useForm()
  const [issueForm] = Form.useForm()
  const [allocateForm] = Form.useForm()
  const [requestForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const { columnFilters, getColumnSearchProps, handleTableFilters } = useColumnSearch()

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current)
    searchDebounceTimer.current = setTimeout(() => setSearch(value), 300)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (deptFilter) params.department_id = deptFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      if (statusFilter === 'non_available') params.status_group = 'non_available'
      else if (statusFilter === 'historic') params.status = 'CONSUMED'
      Object.assign(params, columnFilters)
      await batchApi.exportXlsx(params)
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setExporting(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize, expand_packs: 1 }
      if (search) params.search = search
      if (deptFilter) params.department_id = deptFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      if (statusFilter === 'non_available') params.status_group = 'non_available'
      else if (statusFilter === 'historic') params.status = 'CONSUMED'
      Object.assign(params, columnFilters)
      const { items, total } = await batchApi.listPaged(params)
      setBatches(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, deptFilter, page, pageSize, sortBy, sortDir, statusFilter, columnFilters])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, deptFilter, statusFilter, columnFilters])
  useEffect(() => () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current) }, [])
  useEffect(() => { manufacturerApi.list({ active_only: true }).then(setManufacturers) }, [])
  useEffect(() => { departmentApi.list().then(setDepartments).catch(() => setDepartments([])) }, [])
  useEffect(() => { storageLocationApi.list().then(rows => setStorageLocations(rows.filter(r => r.is_active))).catch(() => setStorageLocations([])) }, [])
  useEffect(() => { uomApi.list({ active_only: true }).then(setUomDimensions).catch(() => setUomDimensions([])) }, [])

  const openCreate = () => setCreateOpen(true)

  const openDetail = (batch: Batch) => {
    setSelectedBatch(batch)
    setDetailOpen(true)
  }

  const openHistory = async (batch: Batch) => {
    setHistoryBatch(batch)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const evts = await batchApi.events(batch.id)
      setHistoryEvents(evts)
    } finally { setHistoryLoading(false) }
  }

  const openCoaViewer = async (r: FlatRow) => {
    setCoaViewerLoading(true)
    setCoaViewerOpen(true)
    setCoaViewerUrl(null)
    setCoaViewerBlob(null)
    setCoaViewerFilename('')
    setCoaViewerExt('')
    try {
      const { blob, filename, ext } = await fetchCoaBlob(r.id, r.batch_no, r.coa_file_path!)
      const url = URL.createObjectURL(blob)
      setCoaViewerUrl(url)
      setCoaViewerFilename(filename)
      setCoaViewerExt(ext)
      setCoaViewerBlob(blob)
    } catch { message.error('Failed to load COA file') }
    finally { setCoaViewerLoading(false) }
  }

  const closeCoaViewer = () => {
    setCoaViewerOpen(false)
    if (coaViewerUrl) URL.revokeObjectURL(coaViewerUrl)
    setCoaViewerUrl(null)
    setCoaViewerBlob(null)
  }

  const openEdit = (batch: Batch) => {
    setEditBatch(batch)
    setEditCoaFile(null)
    editForm.setFieldsValue({
      manufacturer_id: batch.manufacturer_id,
      mfg_date: batch.mfg_date ? dayjs(batch.mfg_date) : null,
      expiry_date: batch.expiry_date ? dayjs(batch.expiry_date) : null,
      retest_date: batch.retest_date ? dayjs(batch.retest_date) : null,
      location: batch.location,
      bin: batch.bin,
      invoice_no: batch.invoice_no,
      po_no: batch.po_no,
      price: batch.price,
      clone: batch.clone,
      remarks: batch.remarks,
    })
    setEditOpen(true)
  }

  const handleEditSave = async (values: Record<string, unknown>) => {
    if (!editBatch) return
    setEditSaving(true)
    try {
      const payload = {
        ...values,
        mfg_date: values.mfg_date ? dayjs(values.mfg_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        expiry_date: values.expiry_date ? dayjs(values.expiry_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        retest_date: values.retest_date ? dayjs(values.retest_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      await batchApi.update(editBatch.id, payload)
      if (editCoaFile?.originFileObj) {
        await batchApi.uploadCoa(editBatch.id, editCoaFile.originFileObj as File)
      }
      message.success('Batch updated')
      setEditOpen(false); editForm.resetFields(); setEditCoaFile(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setEditSaving(false) }
  }

  const handleIssue = async (values: Record<string, unknown>) => {
    if (!selectedBatch) return
    setSaving(true)
    try {
      // pack_id targets the exact SKU/Pack ID row that was clicked — batches
      // with no packs at all (pack_id null) deduct from the batch directly.
      // The backend expects issued_qty (-> issuedQty), not the form's plain
      // "qty" field name.
      await batchApi.issue(selectedBatch.id, {
        issued_qty: values.qty,
        issued_to: values.issued_to,
        purpose: values.purpose,
        project_code: values.project_code,
        remarks: values.remarks,
        pack_id: selectedBatch.pack_id,
      })
      message.success('Batch issued')
      setIssueOpen(false); issueForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleAllocate = async (values: Record<string, unknown>) => {
    if (!selectedBatch) return
    setSaving(true)
    try {
      await batchApi.allocate(selectedBatch.id, { ...values, pack_id: selectedBatch.pack_id })
      message.success('Stock allocated to department')
      setAllocateOpen(false); allocateForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleRequest = async (values: Record<string, unknown>) => {
    if (!selectedBatch) return
    setSaving(true)
    try {
      // Raised directly against this row's specific SKU/Pack ID — routed via
      // the criticality-based flow (sourceBatchId set), distinct from the
      // plain "+ New Request" flow on the Stock Indent page.
      await stockRequestApi.create({
        material_id: selectedBatch.material_id,
        qty_required: values.qty_required,
        unit: selectedBatch.unit,
        criticality: values.criticality,
        purpose: values.purpose,
        remarks: values.remarks,
        source_batch_id: selectedBatch.id,
        source_pack_id: selectedBatch.pack_id,
      })
      message.success('Stock request raised')
      setRequestOpen(false); requestForm.resetFields()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const flatRows: FlatRow[] = batches

  const columns: ColumnsType<FlatRow> = [
    {
      title: 'MFG Batch No',
      dataIndex: 'batch_no',
      ellipsis: true,
      width: 140,
      sorter: true,
      ...getColumnSearchProps('batch_no', 'MFG Batch No'),
      render: (v) => <span className=" text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Inhouse Batch',
      dataIndex: 'inhouse_batch_no',
      ellipsis: true,
      width: 160,
      sorter: true,
      ...getColumnSearchProps('inhouse_batch_no', 'Inhouse Batch'),
      render: (v) => v
        ? <span className=" text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'SKU / Pack ID',
      key: 'sku',
      ellipsis: true,
      width: 200,
      // No sorter: packs are fetched as a separate one-to-many query, so the
      // server has no single pack row to order a batch by, and sorting here
      // would only reorder the current page.
      render: (_, r) => r.pack_sku
        ? <span className=" text-[12px] text-slate-800">{r.pack_sku}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Material',
      dataIndex: 'material_name',
      ellipsis: true,
      // Sorted through the joined material association server-side.
      sorter: true,
      ...getColumnSearchProps('material_name', 'Material'),
      render: (_, r) => (
        <span className="text-[13px] text-slate-800">{r.material_name ?? r.material_id}</span>
      ),
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer_name',
      ellipsis: true,
      width: 160,
      // Sorted through the joined manufacturer association server-side.
      sorter: true,
      ...getColumnSearchProps('manufacturer_name', 'Manufacturer'),
      render: (_: unknown, r: FlatRow) => (
        r.manufacturer_name
          ? <span className="text-[13px] text-slate-800">{r.manufacturer_name}</span>
          : <span className="text-[13px] text-slate-800">NA</span>
      ),
    },
    {
      title: 'Available Qty',
      dataIndex: 'qty_available',
      width: 120,
      sorter: true,
      render: (_, r) => <span className="text-[13px] text-slate-800">{r.qty_available} {r.unit}</span>,
    },
    {
      title: 'Total Qty',
      dataIndex: 'qty_received',
      width: 120,
      sorter: true,
      render: (_, r) => <span className="text-[13px] text-slate-800">{r.qty_received} {r.unit}</span>,
    },
    {
      title: 'Bin',
      dataIndex: 'bin',
      ellipsis: true,
      width: 100,
      sorter: true,
      ...getColumnSearchProps('bin', 'Bin'),
      render: (v) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'COA',
      key: 'coa',
      width: 80,
      render: (_, r) => r.coa_file_path
        ? (
          <Tooltip title="View COA">
            <Button
              type="text"
              size="small"
              className="text-emerald-600 font-semibold text-[12px]"
              icon={<FileCheck size={13} />}
              onClick={(e) => { e.stopPropagation(); openCoaViewer(r) }}
            >
              Yes
            </Button>
          </Tooltip>
        )
        : <span className="text-[12px] text-slate-800 pl-1">No</span>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      ellipsis: true,
      width: 110,
      sorter: true,
      render: (v) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Mfg Date',
      dataIndex: 'mfg_date',
      ellipsis: true,
      width: 110,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'GR Date',
      dataIndex: 'gr_date',
      ellipsis: true,
      width: 110,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      ellipsis: true,
      width: 150,
      align: 'center',
      sorter: true,
      render: (v: string) => (
        <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 70,
      align: 'center',
      render: (_, r) => {
        const disabledForStatus = r.status === 'CONSUMED' || r.status === 'EXPIRED' || r.status === 'QUARANTINE' || r.status === 'RETEST'
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'detail', label: <span className="text-[12px]">Detail</span>, icon: <Eye size={12} /> },
          { key: 'history', label: <span className="text-[12px]">Event History</span>, icon: <History size={12} /> },
          { key: 'issue', label: <span className="text-[12px]">Issue</span>, icon: <Zap size={12} />, disabled: disabledForStatus },
          { key: 'allocate', label: <span className="text-[12px]">Allocate to Department</span>, icon: <Send size={12} />, disabled: disabledForStatus },
          { key: 'request', label: <span className="text-[12px]">Request Stock</span>, icon: <ClipboardList size={12} /> },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'edit') openEdit(r)
          else if (key === 'detail') openDetail(r)
          else if (key === 'history') openHistory(r)
          else if (key === 'issue') { setSelectedBatch(r); setIssueOpen(true) }
          else if (key === 'allocate') { setSelectedBatch(r); setAllocateOpen(true) }
          else if (key === 'request') { setSelectedBatch(r); setRequestOpen(true) }
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
      {/* {statusFilter && (
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">
            {statusFilter === 'non_available' ? 'Non Available Batches' : 'Historic Batches'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {statusFilter === 'non_available'
              ? 'Batches currently overdue for retest, or expired.'
              : 'Batches that have been fully consumed.'}
          </p>
        </div>
      )} */}
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search batch / inhouse / material / manufacturer / status…"
          style={{ width: 340 }}
          allowClear
        />
        <Select
          value={deptFilter ?? undefined}
          onChange={v => setDeptFilter(v ?? null)}
          options={departments.map(d => ({ value: d.id, label: d.name }))}
          placeholder="Filter by department"
          style={{ width: 200 }}
          allowClear={!deptFilterLocked}
          showSearch
          optionFilterProp="label"
          disabled={deptFilterLocked}
        />
        {!statusFilter && (
          <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
            New Batch
          </Button>
        )}
        <Button icon={<Download size={14} />} loading={exporting} onClick={handleExport} className="rounded-md font-medium">
          Export
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={flatRows}
          columns={columns}
          rowKey="row_key"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          // Pagination is server-driven (one batch can expand into several
          // pack rows, so the row count returned per page is variable and
          // rarely equals `pageSize`). antd's built-in pagination re-slices
          // `dataSource` client-side whenever its length differs from both
          // `pageSize` and `total` — which corrupts an already-correct server
          // page down to a single row. Render pagination manually below
          // instead and let the Table show exactly what the server sent.
          pagination={false}
          onChange={(_pagination: TablePaginationConfig, filters, sorter) => {
            const s = sorter as SorterResult<FlatRow>
            if (s.order && typeof s.field === 'string') {
              setSortBy(s.field)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
            handleTableFilters(filters)
          }}
          onRow={r => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
        />
        <div className="flex justify-end px-4 py-3 border-t border-white/40">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            showTotal={t => `${t} batches`}
            onChange={(p, ps) => { setPage(p); setPageSize(ps) }}
          />
        </div>
      </div>

      <NewBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={load}
      />

      {/* Edit Modal */}
      <Modal
        title={`Edit Batch — ${editBatch?.batch_no}`}
        open={editOpen}
        closable={false}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); setEditCoaFile(null) }}
        onOk={() => editForm.submit()}
        confirmLoading={editSaving}
        width={640}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSave}>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="manufacturer_id" label="Manufacturer">
              <Select allowClear showSearch optionFilterProp="label" options={manufacturers.map(m => ({ value: m.id, label: m.name }))} />
            </Form.Item>
            <Form.Item name="location" label="Storage Location">
              <Select
                placeholder="Select storage location"
                showSearch
                allowClear
                optionFilterProp="label"
                options={storageLocations.map(l => ({ value: l.name, label: l.description ? `${l.name} — ${l.description}` : l.name }))}
              />
            </Form.Item>
            <Form.Item name="bin" label="Bin">
              <Input placeholder="e.g. B-12" />
            </Form.Item>
            <Form.Item name="mfg_date" label="Mfg Date">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current.isAfter(dayjs().endOf('day'))}
              />
            </Form.Item>
            <Form.Item name="expiry_date" label="Expiry Date">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
              />
            </Form.Item>
            <Form.Item name="retest_date" label="Retest Date">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
              />
            </Form.Item>
            <Form.Item name="invoice_no" label="Invoice No">
              <Input />
            </Form.Item>
            <Form.Item name="po_no" label="PO No">
              <Input />
            </Form.Item>
            <Form.Item name="price" label="Price">
              <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
            </Form.Item>
            <Form.Item name="clone" label="Clone / Variant">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="COA Attachment">
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              fileList={editCoaFile ? [editCoaFile] : []}
              onChange={({ fileList }) => setEditCoaFile(fileList[fileList.length - 1] ?? null)}
              accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadIcon size={13} />}>
                {editBatch?.coa_file_path ? 'Replace COA File' : 'Upload COA File'}
              </Button>
            </Upload>
            {editBatch?.coa_file_path && !editCoaFile && (
              <p className="text-[12px] text-emerald-600 mt-1 flex items-center gap-1">
                <FileCheck size={12} /> COA already attached
              </p>
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* Issue Modal */}
      <Modal
        title={`Issue from ${selectedBatch?.batch_no}`}
        open={issueOpen}
        closable={false}
        onCancel={() => { setIssueOpen(false); issueForm.resetFields() }}
        onOk={() => issueForm.submit()}
        confirmLoading={saving}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        {selectedBatch?.pack_sku && (
          <p className="text-[13px] text-slate-500 mb-3">
            SKU / Pack ID: <span className="font-mono text-slate-700">{selectedBatch.pack_sku}</span>
            {' '}(available: {selectedBatch.qty_available} {selectedBatch.unit})
          </p>
        )}
        <Form form={issueForm} layout="vertical" onFinish={handleIssue}>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} max={selectedBatch?.qty_available ?? undefined} />
          </Form.Item>
          <Form.Item name="issued_to" label="Issued To"><Input /></Form.Item>
          <Form.Item name="purpose" label="Purpose"><Input /></Form.Item>
          <Form.Item name="project_code" label="Project Code"><Input /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Allocate Modal */}
      <Modal
        title={`Allocate from ${selectedBatch?.batch_no}`}
        open={allocateOpen}
        closable={false}
        onCancel={() => { setAllocateOpen(false); allocateForm.resetFields() }}
        onOk={() => allocateForm.submit()}
        confirmLoading={saving}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        {selectedBatch?.pack_sku && (
          <p className="text-[13px] text-slate-500 mb-3">
            SKU / Pack ID: <span className="font-mono text-slate-700">{selectedBatch.pack_sku}</span>
            {' '}(available: {selectedBatch.qty_available} {selectedBatch.unit})
          </p>
        )}
        <Form form={allocateForm} layout="vertical" onFinish={handleAllocate}>
          <Form.Item name="target_department_id" label="Target Department" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select department"
              options={departments.map(d => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item name="batch_no" label="MFG Batch No (destination)" rules={[{ required: true, whitespace: true, message: 'MFG Batch No is required' }]}>
            <Input placeholder="e.g. MCE/26/013" />
          </Form.Item>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} max={selectedBatch?.qty_available ?? undefined} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Request Stock Modal */}
      <Modal
        title={`Request Stock — ${selectedBatch?.batch_no}`}
        open={requestOpen}
        closable={false}
        onCancel={() => { setRequestOpen(false); requestForm.resetFields() }}
        onOk={() => requestForm.submit()}
        confirmLoading={saving}
        width={440}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        {selectedBatch?.pack_sku && (
          <p className="text-[13px] text-slate-500 mb-3">
            SKU / Pack ID: <span className="font-mono text-slate-700">{selectedBatch.pack_sku}</span>
            {' '}(currently available: {selectedBatch.qty_available} {selectedBatch.unit})
          </p>
        )}
        <Form form={requestForm} layout="vertical" onFinish={handleRequest} initialValues={{ criticality: 'GENERAL' }}>
          <Form.Item
            name="qty_required"
            label="Quantity Required"
            rules={[{ required: true }]}
            extra="You may request more than the amount currently available."
          >
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} />
          </Form.Item>
          <Form.Item name="criticality" label="Criticality" rules={[{ required: true }]}>
            <Select options={['GENERAL', 'CRITICAL'].map(s => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))} />
          </Form.Item>
          <Form.Item name="purpose" label="Purpose"><Input /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Batch Details</span>
            <span className="  text-sm text-violet-600 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">{selectedBatch?.batch_no}</span>
          </div>
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={480}
        styles={{ body: { padding: '16px', background: '#f8fafc' }, header: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' } }}
      >
        {selectedBatch && (
          <div className="space-y-4">
            {/* Info grid */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ['Inhouse Batch', selectedBatch.inhouse_batch_no ?? 'NA'],
                ['Status', selectedBatch.status],
                ['Qty Received', `${selectedBatch.qty_received} ${selectedBatch.unit}`],
                ['Qty Available', `${selectedBatch.qty_available} ${selectedBatch.unit}`],
                ['Expiry Date', selectedBatch.expiry_date ? dayjs(selectedBatch.expiry_date).format('DD/MM/YYYY') : 'NA'],
                ['Mfg Date', selectedBatch.mfg_date ? dayjs(selectedBatch.mfg_date).format('DD/MM/YYYY') : 'NA'],
                ['GR Date', selectedBatch.gr_date ? dayjs(selectedBatch.gr_date).format('DD/MM/YYYY') : 'NA'],
                ['Packs', String(selectedBatch.packs.length)],
                ['Location', selectedBatch.location ?? 'NA'],
                ['Invoice No', selectedBatch.invoice_no ?? 'NA'],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{k}</p>
                  <p className="text-[13px] text-slate-700 font-medium">{v}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* COA Viewer Modal */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-2">
            <span className="text-slate-800 font-semibold">COA Document — {coaViewerFilename}</span>
            <div className="flex items-center gap-2">
              {/* PDFs render via the browser's native viewer (iframe), which
                  already has its own download control in its toolbar — this
                  button would just be a redundant second one. */}
              {coaViewerBlob && coaViewerExt !== 'pdf' && (
                <Button
                  size="small"
                  icon={<Download size={13} />}
                  onClick={() => coaViewerBlob && triggerDownload(coaViewerBlob, coaViewerFilename)}
                >
                  Download
                </Button>
              )}
            </div>
          </div>
        }
        open={coaViewerOpen}
        onCancel={closeCoaViewer}
        footer={null}
        width="80vw"
        centered
        destroyOnHidden
        closable
        styles={{
          ...glassModalStyles,
          body: { ...glassModalStyles.body, padding: 0 },
        }}
      >
        {coaViewerLoading && (
          <div className="flex items-center justify-center" style={{ height: '75vh' }}>
            <span className="text-slate-500 text-[13px]">Loading document…</span>
          </div>
        )}
        {!coaViewerLoading && coaViewerUrl && (() => {
          const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(coaViewerExt)
          const isPdf = coaViewerExt === 'pdf'
          if (isPdf) return (
            <iframe
              src={coaViewerUrl}
              title="COA Document"
              style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
            />
          )
          if (isImage) return (
            <div className="flex items-center justify-center p-4" style={{ minHeight: '40vh' }}>
              <img src={coaViewerUrl} alt="COA" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
            </div>
          )
          return (
            <div className="flex flex-col items-center justify-center gap-3" style={{ height: '30vh' }}>
              <p className="text-slate-600 text-[13px]">Preview is not available for this file type.</p>
              <Button
                icon={<Download size={14} />}
                onClick={() => coaViewerBlob && triggerDownload(coaViewerBlob, coaViewerFilename)}
              >
                Download to view
              </Button>
            </div>
          )
        })()}
      </Modal>

      {/* Event History Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>Event History</span>
            {historyBatch && (
              <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">{historyBatch.batch_no}</span>
            )}
          </div>
        }
        open={historyOpen}
        closable={false}
        onCancel={() => setHistoryOpen(false)}
        footer={<Button onClick={() => setHistoryOpen(false)}>Close</Button>}
        width={480}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        {historyLoading ? (
          <div className="py-6"><BrandSpinner fullScreen={false} label="Loading batch history…" /></div>
        ) : historyEvents.length === 0 ? (
          <p className="text-[13px] text-slate-400 text-center py-6">No events recorded</p>
        ) : (
          <div className="space-y-8 py-2 max-h-[320px] overflow-y-auto pr-2">
            {historyEvents.slice().reverse().map((e, idx, arr) => {
              const eventStyle = getEventStyle(e.event_type)
              const label = formatEventLabel(e.event_type) + (e.qty != null ? ` — ${e.qty} ${historyBatch?.unit ?? ''}` : '')
              const comment = e.remarks
              const isLast = idx === arr.length - 1
              return (
                <div key={e.id} className="relative">
                  <div className="flex items-start gap-4">
                    {/* Circle with dashed connector */}
                    <div className="relative flex flex-col items-center">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 mt-1 relative z-20"
                        style={{ backgroundColor: 'white', border: '2px solid #F0F0F0' }}
                      />
                      {!isLast && (
                        <div
                          className={`absolute top-5 w-0.5 ${comment ? 'h-28' : 'h-20'} z-10`}
                          style={{ borderLeft: '1px dashed #D4D4D4', left: '50%', transform: 'translateX(-50%)' }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 mt-0 mb-3">
                      <div className="font-semibold -mb-1 flex justify-between" style={{ color: '#344054', fontSize: 12 }}>
                        {e.performed_by}
                        <span
                          className="font-normal ml-[20px] rounded-[4px] pt-[2px] pb-[3px] pr-[7px] pl-[7px]"
                          style={{ color: eventStyle.color, backgroundColor: eventStyle.background, fontSize: 9, border: `1px solid ${eventStyle.color}` }}
                        >
                          {label}
                        </span>
                      </div>

                      <div className="font-normal leading-3 text-left mt-[4px]" style={{ color: '#344054', fontSize: 8 }}>
                        {dayjs(e.performed_at).format('DD/MM/YYYY HH:mm')}
                      </div>

                      {comment && (
                        <div className="flex items-start gap-0 mt-1">
                          <MessageSquare size={10} className="mt-0.5 shrink-0 mr-1" style={{ color: '#667085' }} />
                          {comment.split(' ').length > 3 ? (
                            <Tooltip title={comment} placement="bottom">
                              <span className="leading-relaxed cursor-pointer" style={{ color: '#667085', fontSize: 10 }}>
                                {comment.split(' ').slice(0, 3).join(' ') + '...'}
                              </span>
                            </Tooltip>
                          ) : (
                            <span className="leading-relaxed" style={{ color: '#667085', fontSize: 10 }}>
                              {comment}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!isLast && (
                    <div
                      className="absolute left-0 right-0 h-0.5 z-0 mt-4"
                      // style={{ borderTop: '1px dashed #D4D4D4', bottom: comment ? '-16px' : '-8px' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
