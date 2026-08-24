import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Input, Select, Modal, Form, InputNumber, DatePicker, Switch, message, Space, Tabs, Upload, Dropdown } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Search, QrCode, RefreshCw, Eye, Download, Upload as UploadIcon, MoreVertical } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import dayjs from 'dayjs'
import {
  equipmentCatalogueApi, instrumentCatalogueApi, masterTemplateApi,
  equipmentTypeApi, instrumentTypeApi, manufacturerApi, storageLocationApi,
  type EquipmentCatalogue, type InstrumentCatalogue,
  type EquipType, type Manufacturer, type StorageLocation,
} from '../../api/inventory'
import { adminApi, type LabOut } from '../../api/admin'
import { departmentApi, type Department } from '../../api/adc'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useDepartmentFilterLock } from '../../hooks/useDepartmentFilterLock'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

// Canonical equipment/instrument lifecycle status vocabulary. Most of these are
// driven automatically off the Work Order lifecycle (see workOrders.routes.ts
// applyWorkOrderCatalogueStatus) or computed at read-time (DUE_MAINTENANCE) —
// they're still selectable manually here as an override (e.g. BREAKDOWN,
// DECOMMISSIONED can also be set by hand).
export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', IN_USE: 'blue',
  UNDER_MAINTENANCE: 'orange', REVIEW_MAINTENANCE: 'gold', DUE_MAINTENANCE: 'volcano',
  UNDER_CALIBRATION: 'orange', REVIEW_CALIBRATION: 'gold',
  UNDER_CLEANING: 'orange', CLEANING_PENDING: 'gold',
  BREAKDOWN: 'red', DECOMMISSIONED: 'default',
}
const MAINT_COLOR: Record<string, string> = { OK: 'green', DUE: 'orange', OVERDUE: 'red' }

const MAINT_STATUS_OPTIONS = ['OK', 'DUE', 'OVERDUE'].map(s => ({ value: s, label: s }))
export const CATALOGUE_STATUSES = [
  'AVAILABLE', 'IN_USE',
  'UNDER_MAINTENANCE', 'REVIEW_MAINTENANCE', 'DUE_MAINTENANCE',
  'UNDER_CALIBRATION', 'REVIEW_CALIBRATION',
  'UNDER_CLEANING', 'CLEANING_PENDING',
  'BREAKDOWN', 'DECOMMISSIONED',
]
const EQUIP_STATUSES = CATALOGUE_STATUSES
const INSTR_STATUSES = CATALOGUE_STATUSES
const EQUIP_STATUS_OPTIONS = EQUIP_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))
const INSTR_STATUS_OPTIONS = INSTR_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))

// ── QR modal ─────────────────────────────────────────────────────────────────
function QrModal({ open, onClose, code, name }: { open: boolean; onClose: () => void; code: string | null; name?: string }) {
  return (
    <Modal open={open} closable={false} onCancel={onClose} footer={null} centered width={320} destroyOnHidden {...glassModalProps}>
      <div className="flex flex-col items-center gap-3 py-2">
        {code && <QRCodeSVG value={code} size={200} level="M" includeMargin />}
        <div className="text-center">
          <p className="  font-semibold text-slate-800">{code}</p>
          {name && <p className="text-slate-500 text-sm">{name}</p>}
        </div>
      </div>
    </Modal>
  )
}

// ── Change-status modal ──────────────────────────────────────────────────────
function StatusModal({ open, onClose, current, options, onSave, saving }: {
  open: boolean; onClose: () => void; current: string | null
  options: { value: string; label: string }[]
  onSave: (status: string, remarks?: string) => void; saving: boolean
}) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.setFieldsValue({ status: current, remarks: undefined }) }, [open, current, form])
  return (
    <Modal title="Change Status" open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} centered width={420} destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={(v) => onSave(v.status, v.remarks)}>
        <Form.Item name="status" label="New Status" rules={[{ required: true }]}><Select options={options} /></Form.Item>
        <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}

// ── Equipment Tab ──────────────────────────────────────────────────────────────
function EquipmentTab() {
  const navigate = useNavigate()
  const [items, setItems] = useState<EquipmentCatalogue[]>([])
  const [equipTypes, setEquipTypes] = useState<EquipType[]>([])
  const [labs, setLabs] = useState<LabOut[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const { isLocked: deptFilterLocked, lockedDepartmentId } = useDepartmentFilterLock()
  useEffect(() => { if (lockedDepartmentId) setDeptFilter(lockedDepartmentId) }, [lockedDepartmentId])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [qr, setQr] = useState<EquipmentCatalogue | null>(null)
  const [statusTarget, setStatusTarget] = useState<EquipmentCatalogue | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (deptFilter) params.department_id = deptFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await equipmentCatalogueApi.listPaged(params)
      setItems(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, statusFilter, deptFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, deptFilter])
  useEffect(() => { equipmentTypeApi.list().then(setEquipTypes) }, [])
  useEffect(() => { adminApi.listLabs().then(setLabs) }, [])
  useEffect(() => { manufacturerApi.list({ active_only: true }).then(setManufacturers) }, [])
  useEffect(() => { departmentApi.list().then(setDepartments).catch(() => setDepartments([])) }, [])
  useEffect(() => { storageLocationApi.list().then(rows => setStorageLocations(rows.filter(r => r.is_active))).catch(() => setStorageLocations([])) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: EquipmentCatalogue) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      last_maintenance_date: r.last_maintenance_date ? dayjs(r.last_maintenance_date) : null,
      next_maintenance_date: r.next_maintenance_date ? dayjs(r.next_maintenance_date) : null,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        last_maintenance_date: values.last_maintenance_date
          ? dayjs(values.last_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        next_maintenance_date: values.next_maintenance_date
          ? dayjs(values.next_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await equipmentCatalogueApi.update(editing.id, payload)
        message.success('Equipment updated')
      } else {
        await equipmentCatalogueApi.create(payload)
        message.success('Equipment created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const saveStatus = async (status: string, remarks?: string) => {
    if (!statusTarget) return
    setStatusSaving(true)
    try {
      await equipmentCatalogueApi.changeStatus(statusTarget.id, { status, remarks })
      message.success('Status updated')
      setStatusTarget(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setStatusSaving(false) }
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const res = await equipmentCatalogueApi.upload(file)
      if (res.errors.length) {
        Modal.warning({
          title: <span className="text-slate-800">{res.created} created, {res.skipped} skipped</span>,
          content: <ul className="mt-2 space-y-1 text-sm text-slate-700 max-h-64 overflow-y-auto">{res.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>,
          styles: glassModalStyles,
          width: 780,
        })
      } else {
        message.success(`${res.created} equipment record(s) created`)
      }
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
    return false
  }

  const columns: ColumnsType<EquipmentCatalogue> = [
    { title: 'Equipment Code', ellipsis: true, dataIndex: 'asset_id', width: 140, sorter: true, render: (v, r) => <a className=" text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/equipment/${r.id}`)}>{v}</a> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Type', ellipsis: true, dataIndex: 'equipment_type_id', width: 140, sorter: true, render: v => { const t = equipTypes.find(x => x.id === v); return t ? <span className="text-[13px] text-slate-800">{t.name}</span> : <span className="text-[13px] text-slate-800">NA</span> } },
    { title: 'Lab', ellipsis: true, dataIndex: 'location', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Storage Location', ellipsis: true, key: 'storage_location', width: 150, render: (_, r) => r.storage_location?.name ? <span className="text-[13px] text-slate-800">{r.storage_location.name}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Make', ellipsis: true, dataIndex: 'make', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Department', ellipsis: true, dataIndex: 'department_id', width: 140, render: v => { const d = departments.find(x => x.id === v); return d ? <span className="text-[13px] text-slate-800">{d.name}</span> : <span className="text-[13px] text-slate-800">NA</span> } },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 140, sorter: true, render: (v, r) => { const s = r.effective_status ?? v; return <StatusTag color={STATUS_COLOR[s] ?? 'default'} className="text-[13px]">{String(s).replace(/_/g, ' ')}</StatusTag> } },
    {
      title: 'Actions', key: 'actions', width: 70, align: 'center', render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'view', label: <span className="text-[12px]">View</span>, icon: <Eye size={12} /> },
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'status', label: <span className="text-[12px]">Change Status</span>, icon: <RefreshCw size={12} /> },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'view') navigate(`/inventory/equipment/${r.id}`)
          else if (key === 'edit') openEdit(r)
          else if (key === 'status') setStatusTarget(r)
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
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search code / name…" style={{ width: 200 }} allowClear />
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
        <Select placeholder="All Status" allowClear style={{ minWidth: 190 }} value={statusFilter} onChange={setStatusFilter} options={EQUIP_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Equipment</Button>
        <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download('equipment-catalogue')}>Download Template</Button>
        <Upload beforeUpload={handleBulkUpload} showUploadList={false} accept=".xlsx">
          <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
        </Upload>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={items}
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
            showTotal: t => `${t} equipment`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<EquipmentCatalogue>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal title={editing ? 'Edit Equipment' : 'New Equipment'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={640} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ movable: false }}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Equipment Code" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="equipment_type_id" label="Equipment Type">
              <Select allowClear showSearch optionFilterProp="label" options={equipTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="usage_type" label="Usage Type"><Input placeholder="e.g. MFG" /></Form.Item>
            <Form.Item name="make" label="Manufacturer / Make">
              <Select
                placeholder="Select manufacturer"
                allowClear
                showSearch
                optionFilterProp="label"
                options={manufacturers.map(m => ({ value: m.name, label: m.name }))}
              />
            </Form.Item>
            <Form.Item name="model" label="Model Name"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Lab">
              <Select
                placeholder="Select lab"
                allowClear
                showSearch
                optionFilterProp="label"
                options={labs.map(l => ({ value: l.name, label: `${l.name} (${l.code})` }))}
              />
            </Form.Item>
            <Form.Item name="storage_location_id" label="Storage Location">
              <Select
                placeholder="Select storage location"
                allowClear
                showSearch
                optionFilterProp="label"
                options={storageLocations.map(s => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="gross_capacity" label="Gross Capacity"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <Form.Item name="capacity_unit" label="Capacity Unit"><Input placeholder="e.g. Litres" /></Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select department"
              />
            </Form.Item>
            <Form.Item name="movable" label="Movable" valuePropName="checked"><Switch /></Form.Item>
            {editing && (
              <>
                <Form.Item name="maintenance_status" label="Maintenance Status">
                  <Select options={MAINT_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="status" label="Equipment Status">
                  <Select options={EQUIP_STATUS_OPTIONS} />
                </Form.Item>
              </>
            )}
            <Form.Item name="last_maintenance_date" label="Last Maintenance Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="next_maintenance_date" label="Next Maintenance Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="maintenance_type" label="Maintenance Type">
              <Select
                allowClear
                options={[{ value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }]}
              />
            </Form.Item>
            <Form.Item label="Maintenance Frequency" className="!mb-2">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="maintenance_frequency_value" noStyle>
                  <InputNumber style={{ width: '65%' }} min={1} placeholder="Value" />
                </Form.Item>
                <Form.Item name="maintenance_frequency_unit" noStyle>
                  <Select
                    style={{ width: '35%' }}
                    placeholder="Unit"
                    options={['DAYS', 'WEEKS', 'MONTHS', 'YEARS', 'HOURS'].map(u => ({ value: u, label: u.charAt(0) + u.slice(1).toLowerCase() }))}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="description" label="Description" className="col-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <QrModal open={!!qr} onClose={() => setQr(null)} code={qr?.asset_id ?? null} name={qr?.name} />
      <StatusModal open={!!statusTarget} onClose={() => setStatusTarget(null)} current={statusTarget?.status ?? null} options={EQUIP_STATUS_OPTIONS} onSave={saveStatus} saving={statusSaving} />
    </div>
  )
}

// ── Instrument Tab ─────────────────────────────────────────────────────────────
function InstrumentTab() {
  const navigate = useNavigate()
  const [items, setItems] = useState<InstrumentCatalogue[]>([])
  const [instrTypes, setInstrTypes] = useState<EquipType[]>([])
  const [labs, setLabs] = useState<LabOut[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const { isLocked: deptFilterLocked, lockedDepartmentId } = useDepartmentFilterLock()
  useEffect(() => { if (lockedDepartmentId) setDeptFilter(lockedDepartmentId) }, [lockedDepartmentId])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [qr, setQr] = useState<InstrumentCatalogue | null>(null)
  const [statusTarget, setStatusTarget] = useState<InstrumentCatalogue | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (deptFilter) params.department_id = deptFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await instrumentCatalogueApi.listPaged(params)
      setItems(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, statusFilter, deptFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, deptFilter])
  useEffect(() => { instrumentTypeApi.list().then(setInstrTypes) }, [])
  useEffect(() => { adminApi.listLabs().then(setLabs) }, [])
  useEffect(() => { manufacturerApi.list({ active_only: true }).then(setManufacturers) }, [])
  useEffect(() => { departmentApi.list().then(setDepartments).catch(() => setDepartments([])) }, [])
  useEffect(() => { storageLocationApi.list().then(rows => setStorageLocations(rows.filter(r => r.is_active))).catch(() => setStorageLocations([])) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: InstrumentCatalogue) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      last_calibration_date: r.last_calibration_date ? dayjs(r.last_calibration_date) : null,
      next_calibration_date: r.next_calibration_date ? dayjs(r.next_calibration_date) : null,
      last_maintenance_date: r.last_maintenance_date ? dayjs(r.last_maintenance_date) : null,
      next_maintenance_date: r.next_maintenance_date ? dayjs(r.next_maintenance_date) : null,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        last_calibration_date: values.last_calibration_date
          ? dayjs(values.last_calibration_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        next_calibration_date: values.next_calibration_date
          ? dayjs(values.next_calibration_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        last_maintenance_date: values.last_maintenance_date
          ? dayjs(values.last_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        next_maintenance_date: values.next_maintenance_date
          ? dayjs(values.next_maintenance_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await instrumentCatalogueApi.update(editing.id, payload)
        message.success('Instrument updated')
      } else {
        await instrumentCatalogueApi.create(payload)
        message.success('Instrument created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const saveStatus = async (status: string, remarks?: string) => {
    if (!statusTarget) return
    setStatusSaving(true)
    try {
      await instrumentCatalogueApi.changeStatus(statusTarget.id, { status, remarks })
      message.success('Status updated')
      setStatusTarget(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setStatusSaving(false) }
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const res = await instrumentCatalogueApi.upload(file)
      if (res.errors.length) {
        Modal.warning({
          title: <span className="text-slate-800">{res.created} created, {res.skipped} skipped</span>,
          content: <ul className="mt-2 space-y-1 text-sm text-slate-700 max-h-64 overflow-y-auto">{res.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>,
          styles: glassModalStyles,
          width: 780,
        })
      } else {
        message.success(`${res.created} instrument record(s) created`)
      }
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
    return false
  }

  const columns: ColumnsType<InstrumentCatalogue> = [
    { title: 'Instrument Code', ellipsis: true, dataIndex: 'asset_id', width: 140, sorter: true, render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800" onClick={() => navigate(`/inventory/instruments/${r.id}`)}>{v}</a> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Type', ellipsis: true, dataIndex: 'instrument_type_id', width: 140, sorter: true, render: v => { const t = instrTypes.find(x => x.id === v); return t ? <span className="text-[13px] text-slate-800">{t.name}</span> : <span className="text-[13px] text-slate-800">NA</span> } },
    { title: 'Make', ellipsis: true, dataIndex: 'make', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Storage Location', ellipsis: true, key: 'storage_location', width: 150, render: (_, r) => r.storage_location?.name ? <span className="text-[13px] text-slate-800">{r.storage_location.name}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Calibration', ellipsis: true, dataIndex: 'calibration_status', width: 140, sorter: true, render: v => <StatusTag color={MAINT_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Department', ellipsis: true, dataIndex: 'department_id', width: 140, render: v => { const d = departments.find(x => x.id === v); return d ? <span className="text-[13px] text-slate-800">{d.name}</span> : <span className="text-[13px] text-slate-800">NA</span> } },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 140, sorter: true, render: (v, r) => { const s = r.effective_status ?? v; return <StatusTag color={STATUS_COLOR[s] ?? 'default'} className="text-[13px]">{String(s).replace(/_/g, ' ')}</StatusTag> } },
    {
      title: 'Actions', key: 'actions', width: 70, align: 'center', render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'view', label: <span className="text-[12px]">View</span>, icon: <Eye size={12} /> },
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'status', label: <span className="text-[12px]">Change Status</span>, icon: <RefreshCw size={12} /> },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'view') navigate(`/inventory/instruments/${r.id}`)
          else if (key === 'edit') openEdit(r)
          else if (key === 'status') setStatusTarget(r)
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
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search code / name…" style={{ width: 200 }} allowClear />
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
        <Select placeholder="All Status" allowClear style={{ minWidth: 190 }} value={statusFilter} onChange={setStatusFilter} options={INSTR_STATUS_OPTIONS} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Instrument</Button>
        <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download('instrument-catalogue')}>Download Template</Button>
        <Upload beforeUpload={handleBulkUpload} showUploadList={false} accept=".xlsx">
          <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
        </Upload>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={items}
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
            showTotal: t => `${t} instruments`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<InstrumentCatalogue>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal title={editing ? 'Edit Instrument' : 'New Instrument'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={680} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ movable: false, required_calibration: false }}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="asset_id" label="Instrument Code" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="instrument_type_id" label="Instrument Type">
              <Select allowClear showSearch optionFilterProp="label" options={instrTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="usage_type" label="Usage Type"><Input placeholder="e.g. Common" /></Form.Item>
            <Form.Item name="make" label="Manufacturer / Make">
              <Select
                placeholder="Select manufacturer"
                allowClear
                showSearch
                optionFilterProp="label"
                options={manufacturers.map(m => ({ value: m.name, label: m.name }))}
              />
            </Form.Item>
            <Form.Item name="model" label="Model Name"><Input /></Form.Item>
            <Form.Item name="serial_no" label="Serial No"><Input /></Form.Item>
            <Form.Item name="location" label="Lab">
              <Select
                placeholder="Select lab"
                allowClear
                showSearch
                optionFilterProp="label"
                options={labs.map(l => ({ value: l.name, label: `${l.name} (${l.code})` }))}
              />
            </Form.Item>
            <Form.Item name="storage_location_id" label="Storage Location">
              <Select
                placeholder="Select storage location"
                allowClear
                showSearch
                optionFilterProp="label"
                options={storageLocations.map(s => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
            <Form.Item name="gross_capacity" label="Gross Capacity"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            <Form.Item name="capacity_unit" label="Capacity Unit"><Input /></Form.Item>
            <Form.Item name="lower_operating_range" label="Lower Operating Range"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="lower_uom" label="Lower UOM"><Input /></Form.Item>
            <Form.Item name="upper_operating_range" label="Upper Operating Range"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="upper_uom" label="Upper UOM"><Input /></Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select department"
              />
            </Form.Item>
            <Form.Item name="movable" label="Movable" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="required_calibration" label="Required Calibration" valuePropName="checked"><Switch /></Form.Item>
            {editing && (
              <>
                <Form.Item name="calibration_status" label="Calibration Status">
                  <Select options={MAINT_STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="status" label="Instrument Status">
                  <Select options={INSTR_STATUS_OPTIONS} />
                </Form.Item>
              </>
            )}
            <Form.Item name="last_calibration_date" label="Last Calibration Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="next_calibration_date" label="Next Calibration Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="calibration_type" label="Calibration Type">
              <Select
                allowClear
                options={[{ value: 'INTERNAL', label: 'Internal' }, { value: 'EXTERNAL', label: 'External' }]}
              />
            </Form.Item>
            <Form.Item label="Calibration Frequency" className="!mb-2">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="calibration_frequency_value" noStyle>
                  <InputNumber style={{ width: '65%' }} min={1} placeholder="Value" />
                </Form.Item>
                <Form.Item name="calibration_frequency_unit" noStyle>
                  <Select
                    style={{ width: '35%' }}
                    placeholder="Unit"
                    options={['HOURS', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS'].map(u => ({ value: u, label: u.charAt(0) + u.slice(1).toLowerCase() }))}
                  />
                </Form.Item>
              </Space.Compact>
            </Form.Item>
            <Form.Item name="last_maintenance_date" label="Last Maintenance Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="next_maintenance_date" label="Next Maintenance Date">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="description" label="Description" className="col-span-2"><Input.TextArea rows={2} /></Form.Item>
          </div>
        </Form>
      </Modal>

      <QrModal open={!!qr} onClose={() => setQr(null)} code={qr?.asset_id ?? null} name={qr?.name} />
      <StatusModal open={!!statusTarget} onClose={() => setStatusTarget(null)} current={statusTarget?.status ?? null} options={INSTR_STATUS_OPTIONS} onSave={saveStatus} saving={statusSaving} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function EquipmentPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        items={[
          { key: 'equipment', label: 'Equipment', children: <EquipmentTab /> },
          { key: 'instruments', label: 'Instruments', children: <InstrumentTab /> },
        ]}
        tabBarStyle={{ marginBottom: 0 }}
        tabBarGutter={24}
      />
    </div>
  )
}
