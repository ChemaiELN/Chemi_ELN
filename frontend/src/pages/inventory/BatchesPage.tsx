import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form,
  InputNumber, DatePicker, message, Space, Tooltip,
  Drawer, Divider, Upload, Progress,
} from 'antd'
import type { UploadFile } from 'antd/es/upload'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Eye, Zap, Search, Pencil, Upload as UploadIcon, FileCheck, History, MessageSquare } from 'lucide-react'
import dayjs from 'dayjs'
import { batchApi, materialApi, manufacturerApi, mappingApi, uomApi, type Batch, type BatchEvent, type Material, type Manufacturer, type UomUnit } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

const API_BASE =
  (typeof window !== 'undefined' && (window as { __APP_CONFIG__?: { API_URL?: string } }).__APP_CONFIG__?.API_URL) ||
  (import.meta.env.VITE_API_URL as string) ||
  'http://localhost:8000'

async function openCoaFile(batchId: number, batchNo: string, coaFilePath: string) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`${API_BASE}/api/inventory/batches/${batchId}/coa`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) { message.error('Failed to open COA file'); return }

  // Build filename from batch_no + original file extension
  const ext = coaFilePath.split('.').pop() ?? 'pdf'
  const filename = `COA_${batchNo}.${ext}`

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', PARTIALLY_CONSUMED: 'blue', CONSUMED: 'default',
  EXPIRED: 'red', QUARANTINE: 'orange',
}

// Measuring Unit / Measuring Unit Value only apply to materials under this Material Type.
const ANTIBODY_MATERIAL_TYPE = 'Antibody Materials'

type FlatRow = Batch & {
  _packSku: string | null
  _rowKey: string
}

function flattenBatches(batches: Batch[]): FlatRow[] {
  const result: FlatRow[] = []
  for (const b of batches) {
    if (b.packs && b.packs.length > 0) {
      b.packs.forEach((p) => {
        result.push({ ...b, _packSku: p.inhouse_batch_no, _rowKey: `${b.id}-${p.id}` })
      })
    } else {
      const sku = b.inhouse_batch_no && b.pack_type
        ? `${b.inhouse_batch_no}/${b.pack_type[0].toUpperCase()}1`
        : null
      result.push({ ...b, _packSku: sku, _rowKey: `${b.id}` })
    }
  }
  return result
}

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

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [saving, setSaving] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyBatch, setHistoryBatch] = useState<Batch | null>(null)
  const [historyEvents, setHistoryEvents] = useState<BatchEvent[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [inhouseLoading, setInhouseLoading] = useState(false)
  const [massUnits, setMassUnits] = useState<UomUnit[]>([])
  const [coaFile, setCoaFile] = useState<UploadFile | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editBatch, setEditBatch] = useState<Batch | null>(null)
  const [editCoaFile, setEditCoaFile] = useState<UploadFile | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [materialSearchLoading, setMaterialSearchLoading] = useState(false)
  const materialSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Manufacturer options in the New Batch modal are restricted to whatever's
  // actually mapped to the selected Material (via Manufacturer Mapping), not
  // the full manufacturer list.
  const [manufacturerOptions, setManufacturerOptions] = useState<Manufacturer[]>([])
  const [manufacturerSearchLoading, setManufacturerSearchLoading] = useState(false)
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)
  const [selectedMaterialType, setSelectedMaterialType] = useState<string | null>(null)
  const manufacturerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [form] = Form.useForm()
  const [issueForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await batchApi.list({})
      if (search) {
        const term = search.toLowerCase()
        setBatches(data.filter(b => {
          const matName = b.material_name ?? ''
          const mfrName = b.manufacturer_name ?? ''
          return (
            b.batch_no.toLowerCase().includes(term) ||
            (b.inhouse_batch_no ?? '').toLowerCase().includes(term) ||
            matName.toLowerCase().includes(term) ||
            mfrName.toLowerCase().includes(term) ||
            (b.status ?? '').toLowerCase().includes(term) ||
            (b.location ?? '').toLowerCase().includes(term) ||
            (b.gr_date ?? '').toLowerCase().includes(term)
          )
        }))
      } else {
        setBatches(data)
      }
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])
  useEffect(() => { materialApi.list({ active_only: true }).then(setMaterials) }, [])
  useEffect(() => { manufacturerApi.list({ active_only: true }).then(setManufacturers) }, [])

  // Server-side search for the Material picker: the initial load above only fetches the
  // backend's default page (50 rows), so materials past that page never show up locally.
  // Debounce-query the backend as the user types and merge hits into `materials` so both
  // the dropdown options and the id->name lookups elsewhere on this page stay in sync.
  const handleMaterialSearch = useCallback((value: string) => {
    if (materialSearchTimeout.current) clearTimeout(materialSearchTimeout.current)
    if (!value) return
    materialSearchTimeout.current = setTimeout(async () => {
      setMaterialSearchLoading(true)
      try {
        const results = await materialApi.list({ active_only: true, search: value, limit: 50 })
        setMaterials(prev => {
          const merged = [...prev]
          for (const m of results) {
            if (!merged.some(x => x.id === m.id)) merged.push(m)
          }
          return merged
        })
      } finally {
        setMaterialSearchLoading(false)
      }
    }, 300)
  }, [])
  useEffect(() => {
    uomApi.get('mass')
      .then(dim => setMassUnits(dim.units.filter(u => u.is_active)))
      .catch(() => setMassUnits([]))
  }, [])

  const openCreate = () => {
    form.resetFields()
    setCoaFile(null)
    setCreateOpen(true)
    setSelectedMaterialId(null)
    setSelectedMaterialType(null)
    setManufacturerOptions([])
  }

  // Loads the manufacturers actually mapped to `materialId` (via Manufacturer
  // Mapping), optionally narrowed by a name filter. Resolves ids to full
  // Manufacturer records using the already-loaded `manufacturers` list where
  // possible, falling back to a direct fetch for ids outside that page.
  const loadMappedManufacturers = useCallback(async (materialId: number, nameFilter?: string) => {
    setManufacturerSearchLoading(true)
    try {
      const mappings = await mappingApi.list({ material_id: materialId })
      const ids = [...new Set(mappings.map(m => m.manufacturer_id))]
      const known = manufacturers.filter(m => ids.includes(m.id))
      const missingIds = ids.filter(id => !known.some(m => m.id === id))
      const fetched = missingIds.length
        ? (await Promise.all(missingIds.map(id => manufacturerApi.get(id).catch(() => null)))).filter((m): m is Manufacturer => !!m)
        : []
      let opts = [...known, ...fetched]
      if (nameFilter) opts = opts.filter(m => m.name.toLowerCase().includes(nameFilter.toLowerCase()))
      setManufacturerOptions(opts)
    } finally {
      setManufacturerSearchLoading(false)
    }
  }, [manufacturers])

  const handleManufacturerSearch = (value: string) => {
    if (!selectedMaterialId) return
    if (manufacturerSearchTimeout.current) clearTimeout(manufacturerSearchTimeout.current)
    manufacturerSearchTimeout.current = setTimeout(() => {
      loadMappedManufacturers(selectedMaterialId, value)
    }, 300)
  }

  const handleMaterialChange = async (materialId: number) => {
    form.setFieldValue('inhouse_batch_no', '')
    form.setFieldValue('manufacturer_id', undefined)
    setSelectedMaterialId(materialId)
    loadMappedManufacturers(materialId)
    const mat = materials.find(m => m.id === materialId)
    setSelectedMaterialType(mat?.material_type ?? null)
    if (mat?.material_type !== ANTIBODY_MATERIAL_TYPE) {
      form.setFieldValue('measuring_unit', undefined)
      form.setFieldValue('measuring_unit_value', undefined)
    }
    if (!mat?.material_type) return
    setInhouseLoading(true)
    try {
      const res = await batchApi.nextInhouseNo(mat.material_type)
      form.setFieldValue('inhouse_batch_no', res.inhouse_batch_no)
    } catch { /* leave blank */ }
    finally { setInhouseLoading(false) }
  }

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

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        mfg_date: values.mfg_date ? dayjs(values.mfg_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        expiry_date: values.expiry_date ? dayjs(values.expiry_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        retest_date: values.retest_date ? dayjs(values.retest_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        gr_date: values.gr_date ?? null,
        received_at: values.received_at ? dayjs(values.received_at as dayjs.Dayjs).toISOString() : null,
      }
      const created = await batchApi.create(payload)
      if (coaFile?.originFileObj) {
        await batchApi.uploadCoa(created.id, coaFile.originFileObj as File)
      }
      message.success('Batch created')
      setCreateOpen(false); form.resetFields(); setCoaFile(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
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
      invoice_no: batch.invoice_no,
      po_no: batch.po_no,
      price: batch.price,
      iso_type: batch.iso_type,
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
      await batchApi.issue(selectedBatch.id, values)
      message.success('Batch issued')
      setIssueOpen(false); issueForm.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const flatRows = flattenBatches(batches)

  const strSorter = (get: (r: FlatRow) => string | null | undefined) => (a: FlatRow, b: FlatRow) =>
    (get(a) ?? '').localeCompare(get(b) ?? '')
  const numSorter = (get: (r: FlatRow) => number) => (a: FlatRow, b: FlatRow) => get(a) - get(b)

  const columns: ColumnsType<FlatRow> = [
    {
      title: 'MFG Batch No',
      dataIndex: 'batch_no',
      ellipsis: true,
      width: 140,
      sorter: strSorter(r => r.batch_no),
      render: (v) => <span className=" text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Inhouse Batch',
      dataIndex: 'inhouse_batch_no',
      ellipsis: true,
      width: 160,
      sorter: strSorter(r => r.inhouse_batch_no),
      render: (v) => v
        ? <span className=" text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'SKU / Pack ID',
      key: 'sku',
      ellipsis: true,
      width: 200,
      sorter: strSorter(r => r._packSku),
      render: (_, r) => r._packSku
        ? <span className=" text-[12px] text-slate-800">{r._packSku}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Material',
      key: 'material',
      ellipsis: true,
      sorter: strSorter(r => r.material_name ?? String(r.material_id)),
      render: (_, r) => (
        <span className="text-[13px] text-slate-800">{r.material_name ?? r.material_id}</span>
      ),
    },
    {
      title: 'Manufacturer',
      key: 'manufacturer',
      ellipsis: true,
      width: 160,
      sorter: strSorter(r => r.manufacturer_name),
      render: (_: unknown, r: FlatRow) => (
        r.manufacturer_name
          ? <span className="text-[13px] text-slate-800">{r.manufacturer_name}</span>
          : <span className="text-[13px] text-slate-300">—</span>
      ),
    },
    {
      title: 'Qty Available',
      key: 'qty',
      width: 160,
      sorter: numSorter(r => Number(r.qty_available)),
      render: (_, r) => {
        const pct = r.qty_received > 0 ? Math.round((Number(r.qty_available) / Number(r.qty_received)) * 100) : 0
        const color = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444'
        return (
          <div className="w-full">
            <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
              <span>{r.qty_available} {r.unit}</span>
              <span className="text-slate-400">/ {r.qty_received}</span>
            </div>
            <Progress percent={pct} showInfo={false} strokeColor={color} trailColor="#e2e8f0" size={['100%', 5]} />
          </div>
        )
      },
    },
    {
      title: 'COA',
      key: 'coa',
      width: 80,
      render: (_, r) => r.coa_file_path
        ? (
          <Tooltip title="Open COA">
            <Button
              type="text"
              size="small"
              className="text-emerald-600 font-semibold text-[12px]"
              icon={<FileCheck size={13} />}
              onClick={(e) => { e.stopPropagation(); openCoaFile(r.id, r.batch_no, r.coa_file_path!) }}
            >
              Yes
            </Button>
          </Tooltip>
        )
        : <span className="text-[12px] text-slate-300 pl-1">No</span>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      ellipsis: true,
      width: 110,
      sorter: strSorter(r => r.expiry_date),
      render: (v) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Mfg Date',
      dataIndex: 'mfg_date',
      ellipsis: true,
      width: 110,
      sorter: strSorter(r => r.mfg_date),
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'GR Date',
      dataIndex: 'gr_date',
      ellipsis: true,
      width: 110,
      sorter: strSorter(r => r.gr_date),
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      ellipsis: true,
      width: 150,
      sorter: strSorter(r => r.status),
      render: (v: string) => (
        <StatusTag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Detail">
            <Button type="text" size="small" icon={<Eye size={13} />} onClick={() => openDetail(r)} />
          </Tooltip>
          <Tooltip title="Event History">
            <Button type="text" size="small" icon={<History size={13} />} onClick={() => openHistory(r)} />
          </Tooltip>
          {/* <Tooltip title="Issue">
            <Button
              type="text"
              size="small"
              icon={<Zap size={13} />}
              onClick={() => { setSelectedBatch(r); setIssueOpen(true) }}
              disabled={r.status === 'CONSUMED' || r.status === 'EXPIRED' || r.status === 'QUARANTINE'}
            />
          </Tooltip> */}
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
          placeholder="Search batch / inhouse / material / manufacturer / status…"
          style={{ width: 340 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Batch
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={flatRows}
          columns={columns}
          rowKey="_rowKey"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} batches` }}
          onRow={r => ({ onClick: () => openDetail(r), style: { cursor: 'pointer' } })}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title="New Batch"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); setCoaFile(null); setInhouseLoading(false) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={740}
        centered
        destroyOnHidden
         closable={false}
        {...glassModalProps}
        styles={{
          ...glassModalProps.styles,
          body: {
            ...glassModalProps.styles?.body,
            maxHeight: '65vh',
            overflowY: 'auto',
          },
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="batch_no" label="MFG Batch No" rules={[{ required: true, whitespace: true, message: 'MFG Batch No is required' }]}>
              <Input placeholder="e.g. MCE/26/013" />
            </Form.Item>
            <Form.Item name="material_id" label="Material" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                onSearch={handleMaterialSearch}
                loading={materialSearchLoading}
                notFoundContent={materialSearchLoading ? 'Searching…' : undefined}
                options={materials.map(m => ({ value: m.id, label: m.name }))}
                onChange={handleMaterialChange}
              />
            </Form.Item>
            <Form.Item name="manufacturer_id" label="Manufacturer">
              <Select
                allowClear
                showSearch
                filterOption={false}
                onSearch={handleManufacturerSearch}
                loading={manufacturerSearchLoading}
                disabled={!selectedMaterialId}
                placeholder={selectedMaterialId ? 'Select manufacturer' : 'Select a material first'}
                notFoundContent={manufacturerSearchLoading ? 'Searching…' : 'No manufacturers mapped to this material'}
                options={manufacturerOptions.map(m => ({ value: m.id, label: m.name }))}
              />
            </Form.Item>
            <Form.Item name="qty_received" label="Qty Received per Pack" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" initialValue="g" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={massUnits.map(u => ({ value: u.symbol, label: u.name ? `${u.symbol} — ${u.name}` : u.symbol }))}
              />
            </Form.Item>
            <Form.Item name="inhouse_batch_no" label="Inhouse Batch No">
              <Input readOnly disabled={inhouseLoading} placeholder={inhouseLoading ? 'Generating…' : 'Select a material first'} className="bg-slate-50 cursor-not-allowed" />
            </Form.Item>
            {selectedMaterialType === ANTIBODY_MATERIAL_TYPE && (
              <>
                <Form.Item name="measuring_unit" label="Measuring Unit">
                  <Select allowClear options={[
                    { value: 'molarity', label: 'Molarity' },
                    { value: 'concentration', label: 'Concentration' },
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'ipa', label: 'IPA' },
                  ]} />
                </Form.Item>
                <Form.Item name="measuring_unit_value" label="Measuring Unit Value">
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </>
            )}
            <Form.Item name="mfg_date" label="Mfg Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="expiry_date" label="Expiry Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="retest_date" label="Retest Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="gr_date" label="GR Date" initialValue={dayjs().format('YYYY-MM-DD')}>
              <Input readOnly className="bg-slate-50 cursor-not-allowed" />
            </Form.Item>
            <Form.Item name="location" label="Storage Location">
              <Input />
            </Form.Item>
            <Form.Item name="invoice_no" label="Invoice No">
              <Input />
            </Form.Item>
            <Form.Item name="po_no" label="PO No">
              <Input />
            </Form.Item>
            <Form.Item name="pack_type" label="Pack Type">
              <Input placeholder="e.g. Bottle, Drum" />
            </Form.Item>
            <Form.Item name="pack_mode" label="Pack Mode">
              <Select allowClear options={[
                { value: 'SINGLE', label: 'Single' },
                { value: 'MULTI', label: 'Multi' },
              ]} />
            </Form.Item>
            <Form.Item name="price" label="Price">
              <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
            </Form.Item>
            <Form.Item name="iso_type" label="ISO Type">
              <Input />
            </Form.Item>
            <Form.Item name="clone" label="Clone / Variant">
              <Input />
            </Form.Item>
            <Form.Item name="include_pack" label="Generate Packs?" initialValue={false}>
              <Select options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.include_pack !== cur.include_pack}>
              {({ getFieldValue }) =>
                getFieldValue('include_pack') ? (
                  <Form.Item name="pack_number" label="Number of Packs" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={1} max={26} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="COA Attachment">
            <Upload
              maxCount={1}
              beforeUpload={() => false}
              fileList={coaFile ? [coaFile] : []}
              onChange={({ fileList }) => setCoaFile(fileList[fileList.length - 1] ?? null)}
              accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadIcon size={13} />}>Upload COA File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

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
              <Input />
            </Form.Item>
            <Form.Item name="mfg_date" label="Mfg Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="expiry_date" label="Expiry Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="retest_date" label="Retest Date">
              <DatePicker style={{ width: '100%' }} />
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
            <Form.Item name="iso_type" label="ISO Type">
              <Input />
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
        <Form form={issueForm} layout="vertical" onFinish={handleIssue}>
          <Form.Item name="qty" label="Quantity" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0.001} step={0.1} />
          </Form.Item>
          <Form.Item name="issued_to" label="Issued To"><Input /></Form.Item>
          <Form.Item name="purpose" label="Purpose"><Input /></Form.Item>
          <Form.Item name="project_code" label="Project Code"><Input /></Form.Item>
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
                ['Inhouse Batch', selectedBatch.inhouse_batch_no ?? '—'],
                ['Status', selectedBatch.status],
                ['Qty Received', `${selectedBatch.qty_received} ${selectedBatch.unit}`],
                ['Qty Available', `${selectedBatch.qty_available} ${selectedBatch.unit}`],
                ['Expiry Date', selectedBatch.expiry_date ?? '—'],
                ['Mfg Date', selectedBatch.mfg_date ?? '—'],
                ['GR Date', selectedBatch.gr_date ?? '—'],
                ['Packs', String(selectedBatch.packs.length)],
                ['Location', selectedBatch.location ?? '—'],
                ['Invoice No', selectedBatch.invoice_no ?? '—'],
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
          <p className="text-[13px] text-slate-400 text-center py-6">Loading…</p>
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
                        {new Date(e.performed_at).toLocaleString()}
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
