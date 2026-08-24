import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { Select, Input, InputNumber, DatePicker, Button, Table, Spin, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Trash2, Save, Send, ArrowLeft } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import {
  gatePassApi, manufacturerApi, materialApi, batchApi,
  type Manufacturer, type Material, type GatePassDetail, type Batch,
} from '../../api/inventory'

const UOM_OPTIONS = ['Nos', 'Kg', 'Ltrs', 'Mtrs', 'Gms', 'Set', 'Box', 'Pair', 'Roll'].map(u => ({ value: u, label: u }))
const DOC_OPTIONS = [
  { value: 'RETURNABLE', label: 'RGP (Returnable Gate Pass)' },
  { value: 'NON_RETURNABLE', label: 'NRGP (Non-Returnable Gate Pass)' },
]
const inr = (n: number) => (n || 0).toLocaleString('en-IN')

interface ItemRow {
  key: number
  material_id: number | null
  material_code: string | null
  material_name: string
  description: string
  quantity: number | null
  uom: string
  rate: number | null
  source_batch_id: number | null
  source_pack_id: number | null
  available_qty: number | null
}

const blankItem = (key: number): ItemRow => ({
  key, material_id: null, material_code: null, material_name: '',
  description: '', quantity: null, uom: 'Nos', rate: null,
  source_batch_id: null, source_pack_id: null, available_qty: null,
})

export default function GatePassFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string>('')       // edit mode only
  const [gpNumber, setGpNumber] = useState<string>('')    // edit mode only

  const [docType, setDocType] = useState<string | undefined>()
  const [manufacturerId, setManufacturerId] = useState<number | undefined>()
  const [gpDate, setGpDate] = useState<Dayjs>(dayjs())
  const [prNumber, setPrNumber] = useState('')
  const [workOrder, setWorkOrder] = useState('')
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState<ItemRow[]>([blankItem(1)])
  const [nextKey, setNextKey] = useState(2)

  const [vendors, setVendors] = useState<Manufacturer[]>([])
  const [matOptions, setMatOptions] = useState<Material[]>([])
  const [matSearching, setMatSearching] = useState(false)
  const [packOptions, setPackOptions] = useState<Record<number, Batch[]>>({})
  const [packLoading, setPackLoading] = useState<Record<number, boolean>>({})

  // Packs (SKUs) with stock left, for the row's currently selected material —
  // picking one auto-fills UOM from the pack's own unit and caps the
  // quantity input to what's actually available, so the qty deducted on
  // submit can never exceed live stock.
  const loadPacksForRow = useCallback((key: number, materialId: number) => {
    setPackLoading(s => ({ ...s, [key]: true }))
    batchApi.list({ material_id: materialId, expand_packs: 1 })
      .then(batches => setPackOptions(s => ({ ...s, [key]: batches.filter(b => Number(b.qty_available) > 0) })))
      .catch(() => setPackOptions(s => ({ ...s, [key]: [] })))
      .finally(() => setPackLoading(s => ({ ...s, [key]: false })))
  }, [])

  // Load vendor master + (edit) existing gate pass.
  useEffect(() => {
    manufacturerApi.list({ limit: 200 }).then(setVendors).catch(() => {})
    materialApi.list({ limit: 50 }).then(setMatOptions).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    gatePassApi.get(Number(id)).then((gp: GatePassDetail) => {
      setStatus(gp.status); setGpNumber(gp.gp_number)
      setDocType(gp.doc_type)
      setManufacturerId(gp.manufacturer_id ?? undefined)
      setGpDate(dayjs(gp.gp_date))
      setPrNumber(gp.pr_number ?? ''); setWorkOrder(gp.work_order_no ?? ''); setRemarks(gp.remarks ?? '')
      const rows = gp.items.map((it, i) => ({
        key: i + 1, material_id: it.material_id, material_code: it.material_code,
        material_name: it.material_name, description: it.description ?? '',
        quantity: Number(it.quantity), uom: it.uom ?? 'Nos', rate: it.rate != null ? Number(it.rate) : null,
        source_batch_id: it.source_batch_id, source_pack_id: it.source_pack_id, available_qty: null,
      }))
      setItems(rows.length ? rows : [blankItem(1)])
      setNextKey((rows.length || 1) + 1)
      rows.forEach(r => { if (r.material_id) loadPacksForRow(r.key, r.material_id) })
    }).finally(() => setLoading(false))
  }, [id, isEdit])

  const searchMaterials = useCallback((term: string) => {
    setMatSearching(true)
    materialApi.list({ search: term, limit: 50 }).then(setMatOptions).finally(() => setMatSearching(false))
  }, [])

  const setItem = (key: number, patch: Partial<ItemRow>) =>
    setItems(rows => rows.map(r => (r.key === key ? { ...r, ...patch } : r)))

  const addItem = () => { setItems(rows => [...rows, blankItem(nextKey)]); setNextKey(k => k + 1) }
  const removeItem = (key: number) => setItems(rows => (rows.length <= 1 ? rows : rows.filter(r => r.key !== key)))

  const grandTotal = useMemo(
    () => items.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0), 0),
    [items],
  )

  const buildPayload = () => ({
    doc_type: docType,
    manufacturer_id: manufacturerId ?? null,
    gp_date: gpDate ? gpDate.format('YYYY-MM-DD') : null,
    pr_number: prNumber || null,
    work_order_no: workOrder || null,
    remarks: remarks || null,
    items: items
      .filter(r => r.material_name.trim() || r.quantity)
      .map(r => ({
        material_id: r.material_id, material_code: r.material_code, material_name: r.material_name.trim(),
        description: r.description || null, quantity: Number(r.quantity) || 0, uom: r.uom, rate: r.rate,
        source_batch_id: r.source_batch_id, source_pack_id: r.source_pack_id,
      })),
  })

  const clientValidate = (): string | null => {
    if (!docType) return 'Document type is required.'
    if (!manufacturerId) return 'Vendor is required.'
    if (!gpDate) return 'Gate pass date is required.'
    const rows = items.filter(r => r.material_name.trim() || r.quantity)
    if (!rows.length) return 'At least one line item is required.'
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].material_name.trim()) return `Item ${i + 1}: material name is required.`
      if (!rows[i].quantity || Number(rows[i].quantity) <= 0) return `Item ${i + 1}: quantity must be greater than zero.`
    }
    return null
  }

  const save = async (submit: boolean) => {
    if (submit) {
      const err = clientValidate()
      if (err) { message.error(err); return }
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      let result: GatePassDetail
      if (isEdit) {
        result = await gatePassApi.update(Number(id), { ...payload, submit })
      } else {
        result = await gatePassApi.create({ ...payload, is_draft: !submit })
      }
      message.success(`Gate Pass ${result.gp_number} ${submit ? (isEdit ? 'submitted' : 'created') : 'saved as draft'}`)
      navigate(`/inventory/gate-passes/${result.id}`)
    } catch (e: unknown) {
      message.error((e as Error).message || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 flex justify-center"><BrandSpinner fullScreen={false} label="Loading gate pass form…" /></div>

  const headerLocked = isEdit  // doc_type / vendor / date fixed after creation
  const showDraft = !isEdit || status === 'DRAFT'
  const submitLabel = isEdit && status !== 'DRAFT' ? 'Save Changes' : 'Submit'

  const cols: ColumnsType<ItemRow> = [
    { title: '#', width: 40, render: (_v, _r, i) => <span className="text-[13px] text-slate-500">{i + 1}</span> },
    {
      title: 'Material Code', width: 190, render: (_v, r) => (
        <Select
          showSearch allowClear placeholder="Select material" style={{ width: '100%' }}
          value={r.material_id ?? undefined} filterOption={false} onSearch={searchMaterials} loading={matSearching}
          notFoundContent={matSearching ? <Spin size="small" /> : null}
          options={matOptions.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))}
          onChange={(val) => {
            const m = matOptions.find(x => x.id === val)
            setItem(r.key, m
              ? { material_id: m.id, material_code: m.code, material_name: m.name, source_batch_id: null, source_pack_id: null, available_qty: null }
              : { material_id: null, material_code: null, source_batch_id: null, source_pack_id: null, available_qty: null })
            if (m) loadPacksForRow(r.key, m.id)
            else setPackOptions(s => ({ ...s, [r.key]: [] }))
          }}
        />
      ),
    },
    {
      title: 'Pack / SKU', width: 190, render: (_v, r) => (
        <Select
          allowClear placeholder={r.material_id ? 'Select pack/SKU' : 'Pick material first'} style={{ width: '100%' }}
          disabled={!r.material_id} loading={packLoading[r.key]}
          value={r.source_pack_id ?? (r.source_batch_id ? `batch-${r.source_batch_id}` : undefined)}
          notFoundContent={packLoading[r.key] ? <Spin size="small" /> : 'No stock available'}
          options={(packOptions[r.key] ?? []).map(b => ({
            value: b.pack_id ?? `batch-${b.id}`,
            label: `${b.pack_sku ?? b.batch_no} — ${b.qty_available} ${b.unit} avail.`,
          }))}
          onChange={(val) => {
            if (val === undefined) {
              setItem(r.key, { source_batch_id: null, source_pack_id: null, available_qty: null })
              return
            }
            const batch = (packOptions[r.key] ?? []).find(b => (b.pack_id ?? `batch-${b.id}`) === val)
            if (!batch) return
            setItem(r.key, {
              source_batch_id: batch.id, source_pack_id: batch.pack_id ?? null,
              uom: batch.unit, available_qty: Number(batch.qty_available),
              quantity: r.quantity != null ? Math.min(Number(r.quantity), Number(batch.qty_available)) : r.quantity,
            })
          }}
        />
      ),
    },
    { title: 'Material Name *', width: 180, render: (_v, r) => <Input value={r.material_name} placeholder="Material name" onChange={e => setItem(r.key, { material_name: e.target.value })} /> },
    { title: 'Description', width: 160, render: (_v, r) => <Input value={r.description} placeholder="Description" onChange={e => setItem(r.key, { description: e.target.value })} /> },
    {
      title: 'Qty *', width: 90, render: (_v, r) => (
        <InputNumber
          min={0} max={r.available_qty ?? undefined} value={r.quantity} style={{ width: '100%' }}
          onChange={val => setItem(r.key, { quantity: val as number | null })}
        />
      ),
    },
    {
      title: 'UOM', width: 90, render: (_v, r) => (
        <Select
          style={{ width: '100%' }} value={r.uom} options={UOM_OPTIONS}
          disabled={r.source_batch_id != null} onChange={val => setItem(r.key, { uom: val })}
        />
      ),
    },
    { title: 'Rate (₹)', width: 110, render: (_v, r) => <InputNumber min={0} value={r.rate} style={{ width: '100%' }} onChange={val => setItem(r.key, { rate: val as number | null })} /> },
    { title: 'Total (₹)', width: 120, align: 'right', render: (_v, r) => <span className="text-[13px] font-medium text-slate-700">{inr((Number(r.quantity) || 0) * (Number(r.rate) || 0))}</span> },
    { title: '', width: 44, render: (_v, r) => <Button type="text" danger icon={<Trash2 size={14} />} disabled={items.length <= 1} onClick={() => removeItem(r.key)} /> },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header card */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-slate-700">{isEdit ? `Edit ${gpNumber}` : 'Gate Pass Header'}</span>
          {isEdit
            ? <StatusTag color="blue">{status.replace(/_/g, ' ')}</StatusTag>
            : docType && <StatusTag color={docType === 'RETURNABLE' ? 'blue' : 'gold'}>{docType === 'RETURNABLE' ? 'RGP' : 'NRGP'}</StatusTag>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Document Type *</label>
            <Select placeholder="Select type" value={docType} disabled={headerLocked} options={DOC_OPTIONS} onChange={setDocType} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Vendor *</label>
            <Select
              showSearch placeholder="Select vendor" value={manufacturerId} disabled={headerLocked}
              optionFilterProp="label" onChange={setManufacturerId}
              options={vendors.map(v => ({ value: v.id, label: `${v.code} — ${v.name}` }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Gate Pass Date *</label>
            <DatePicker value={gpDate} disabled={headerLocked} format="YYYY-MM-DD" allowClear={false} onChange={d => setGpDate(d ?? dayjs())} style={{ width: '100%' }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">PR Number</label>
            <Input placeholder="Optional" value={prNumber} onChange={e => setPrNumber(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Work Order No.</label>
            <Input placeholder="Optional" value={workOrder} onChange={e => setWorkOrder(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 md:col-span-3">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">Remarks</label>
            <Input.TextArea rows={2} placeholder="Reason for sending material…" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[14px] font-semibold text-slate-700">Material Line Items</span>
          <Button size="small" type="primary" icon={<Plus size={14} />} onClick={addItem}>Add Item</Button>
        </div>
        <Table dataSource={items} columns={cols} rowKey="key" size="small" pagination={false} scroll={{ x: 'max-content' }} />
        <div className="flex justify-end gap-6 px-4 py-3 border-t border-slate-100">
          <span className="text-[13px] text-slate-500">Grand Total</span>
          <span className="text-[14px] font-bold text-slate-800">₹ {inr(grandTotal)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(isEdit ? `/inventory/gate-passes/${id}` : '/inventory/gate-passes')}>Cancel</Button>
        {showDraft && <Button icon={<Save size={14} />} loading={saving} onClick={() => save(false)}>Save as Draft</Button>}
        <Button type="primary" icon={<Send size={14} />} loading={saving} onClick={() => save(true)}>{submitLabel}</Button>
      </div>
    </div>
  )
}
