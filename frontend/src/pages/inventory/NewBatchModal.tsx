import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Modal, Form, Input, Select, InputNumber, DatePicker, Upload, Button, message, Checkbox,
} from 'antd'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { Upload as UploadIcon } from 'lucide-react'
import {
  batchApi, materialApi, manufacturerApi, mappingApi, uomApi, storageLocationApi,
  type Material, type Manufacturer, type UomUnit, type StorageLocation,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { isSuperAdmin } from '../../utils/privileges'

// Measuring Unit / Measuring Unit Value only apply to materials under this Material Type.
const ANTIBODY_MATERIAL_TYPE = 'Antibody Materials'

// Client-side preview only — the SKU/Pack ID actually persisted is computed
// server-side from the real (sequence-consuming) inhouse batch no, not this
// preview value, so a rare concurrent-creation race can't produce a mismatch.
function packSkuPreview(inhouseBatchNo: string | undefined, packType: string | undefined, index: number): string {
  const base = inhouseBatchNo || 'PENDING'
  const letter = (packType || 'P').trim().charAt(0).toUpperCase() || 'P'
  return `${base}/${letter}${index + 1}`
}

// Departments whose members can see materials across every department (not
// just their own) in the New Batch modal's Material dropdown — QA/QC/
// Inventory work across all departments' materials day-to-day.
const UNRESTRICTED_DEPARTMENT_CODES = ['QA', 'QC', 'INVENTORY']

export type FulfillingRequest = {
  id: number
  request_no: string
  material_id: number
  qty_required: number
  unit: string
}

/** Self-contained "New Batch" creation modal, reused by both the Batches
 * table (plain create) and the Stock Requests table's "Fulfill" action
 * (pre-filled + linked via stock_request_id, which atomically marks the
 * request FULFILLED server-side once the batch is created). */
export default function NewBatchModal({
  open, onClose, onCreated, fulfillingRequest,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  fulfillingRequest?: FulfillingRequest | null
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [coaFile, setCoaFile] = useState<UploadFile | null>(null)

  const [materials, setMaterials] = useState<Material[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [massUnits, setMassUnits] = useState<UomUnit[]>([])
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>([])
  const [materialSearchLoading, setMaterialSearchLoading] = useState(false)
  const materialSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [manufacturerOptions, setManufacturerOptions] = useState<Manufacturer[]>([])
  const [manufacturerSearchLoading, setManufacturerSearchLoading] = useState(false)
  const manufacturerSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | null>(null)
  const [selectedMaterialType, setSelectedMaterialType] = useState<string | null>(null)
  const [inhouseLoading, setInhouseLoading] = useState(false)

  const user = useAppSelector(selectUser)
  const unrestricted = isSuperAdmin(user) ||
    (!!user?.department_code && UNRESTRICTED_DEPARTMENT_CODES.includes(user.department_code))
  // Scope the Material dropdown to the logged-in user's own department,
  // unless they belong to QA/QC/Inventory (or are a super admin) — those
  // roles work across every department's materials.
  const materialDeptId = !unrestricted ? (user?.department_id ?? undefined) : undefined

  useEffect(() => {
    if (!open) return
    materialApi.list({ active_only: true, ...(materialDeptId ? { department_id: materialDeptId } : {}) }).then(setMaterials)
    manufacturerApi.list({ active_only: true }).then(setManufacturers)
    uomApi.get('mass')
      .then(dim => setMassUnits(dim.units.filter(u => u.is_active)))
      .catch(() => setMassUnits([]))
    storageLocationApi.list()
      .then(rows => setStorageLocations(rows.filter(r => r.is_active)))
      .catch(() => setStorageLocations([]))
  }, [open, materialDeptId])

  const handleMaterialSearch = useCallback((value: string) => {
    if (materialSearchTimeout.current) clearTimeout(materialSearchTimeout.current)
    if (!value) return
    materialSearchTimeout.current = setTimeout(async () => {
      setMaterialSearchLoading(true)
      try {
        const results = await materialApi.list({
          active_only: true, search: value, limit: 50,
          ...(materialDeptId ? { department_id: materialDeptId } : {}),
        })
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
  }, [materialDeptId])

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

  const handleMaterialChange = useCallback(async (materialId: number) => {
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
  }, [form, materials, loadMappedManufacturers])

  // Once materials have loaded (needed to resolve the material's type for
  // inhouse-no generation), pre-fill + lock the material/unit fields and
  // stamp stock_request_id so the created batch auto-fulfills the request.
  // Qty Received is left blank/editable — Store Incharge enters the actual
  // quantity received, which may differ from what was originally requested.
  useEffect(() => {
    if (!open || !fulfillingRequest || materials.length === 0) return
    form.setFieldsValue({
      material_id: fulfillingRequest.material_id,
      unit: fulfillingRequest.unit,
      stock_request_id: fulfillingRequest.id,
    })
    handleMaterialChange(fulfillingRequest.material_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fulfillingRequest, materials.length])

  const resetLocalState = () => {
    form.resetFields()
    setCoaFile(null)
    setInhouseLoading(false)
    setSelectedMaterialId(null)
    setSelectedMaterialType(null)
    setManufacturerOptions([])
  }

  const handleClose = () => {
    resetLocalState()
    onClose()
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      const packType = typeof values.pack_type === 'string' ? values.pack_type.trim() : ''
      const packNumber = Number(values.pack_number) || 1
      const payload = {
        ...values,
        // Select mode="tags" (lets the user type a custom storage location
        // not in the master list) always returns an array — unwrap it back
        // to the plain string `location` is stored as on inv_batches.
        location: Array.isArray(values.location) ? (values.location[0] ?? null) : (values.location ?? null),
        // Single vs Multi is derived from Number of Packs (>1 == Multi) —
        // there's no separate mode selector. A Pack Type on its own always
        // produces at least one SKU/Pack ID row: exactly 1 pack, or Number
        // of Packs when >1 — the backend derives the actual pack
        // count/quantities server-side.
        include_pack: !!packType,
        pack_mode: packNumber > 1 ? 'MULTI' : 'SINGLE',
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
      message.success(fulfillingRequest ? `Batch created — ${fulfillingRequest.request_no} marked Fulfilled` : 'Batch created')
      resetLocalState()
      onCreated()
      onClose()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Modal
      title={fulfillingRequest ? `New Batch — Fulfilling ${fulfillingRequest.request_no}` : 'New Batch'}
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      width={740}
      centered
      destroyOnHidden
      closable={false}
      {...glassModalProps}
      styles={{
        ...glassModalStyles,
        body: {
          ...glassModalStyles.body,
          maxHeight: '65vh',
          overflowY: 'auto',
        },
      }}
    >
      {fulfillingRequest && (
        <div className="mb-3 px-3 py-2 rounded-md bg-violet-50 border border-violet-200 text-[13px] text-violet-700">
          This batch will fulfill stock request <span className="font-semibold">{fulfillingRequest.request_no}</span> — it will be marked FULFILLED once this batch is created.
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={handleCreate}>
        <Form.Item name="stock_request_id" hidden><Input type="hidden" /></Form.Item>
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
              disabled={!!fulfillingRequest}
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
          <Form.Item
            name="gr_date"
            label="GR Date"
            initialValue={dayjs().format('YYYY-MM-DD')}
            getValueProps={(v: string | undefined) => ({ value: v ? dayjs(v).format('DD/MM/YYYY') : '' })}
          >
            <Input readOnly className="bg-slate-50 cursor-not-allowed" />
          </Form.Item>
          <Form.Item name="location" label="Storage Location">
            <Select
              placeholder="Select or type a storage location"
              mode="tags"
              maxCount={1}
              showSearch
              allowClear
              optionFilterProp="label"
              options={storageLocations.map(l => ({ value: l.name, label: l.description ? `${l.name} — ${l.description}` : l.name }))}
            />
          </Form.Item>
          <Form.Item name="bin" label="Bin">
            <Input placeholder="e.g. B-12" />
          </Form.Item>
          <Form.Item name="invoice_no" label="Invoice No">
            <Input />
          </Form.Item>
          <Form.Item name="po_no" label="PO No">
            <Input />
          </Form.Item>
          <Form.Item name="pack_type" label="Pack Type" rules={[{ required: true, whitespace: true, message: 'Pack Type is required' }]}>
            <Input placeholder="e.g. Bottle, Drum" />
          </Form.Item>
          <Form.Item name="pack_number" label="Number of Packs" initialValue={1} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} max={500} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.pack_number !== cur.pack_number || prev.same_qty_per_pack !== cur.same_qty_per_pack}>
            {({ getFieldValue }) =>
              Number(getFieldValue('pack_number')) > 1 && getFieldValue('same_qty_per_pack') === false ? null : (
                <Form.Item name="qty_received" label="Qty Received per Pack" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              disabled={!!fulfillingRequest}
              placeholder="Select unit"
              options={massUnits.map(u => ({ value: u.symbol, label: u.name ? `${u.symbol} — ${u.name}` : u.symbol }))}
            />
          </Form.Item>
          <Form.Item name="price" label="Price">
            <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
          </Form.Item>
          <Form.Item name="clone" label="Clone / Variant">
            <Input />
          </Form.Item>
        </div>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.pack_number !== cur.pack_number}>
          {({ getFieldValue }) =>
            Number(getFieldValue('pack_number')) > 1 ? (
              <Form.Item name="same_qty_per_pack" valuePropName="checked" initialValue={true}>
                <Checkbox>Same Qty Received per Pack for every pack</Checkbox>
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) =>
            prev.same_qty_per_pack !== cur.same_qty_per_pack ||
            prev.pack_number !== cur.pack_number || prev.pack_type !== cur.pack_type || prev.inhouse_batch_no !== cur.inhouse_batch_no
          }
        >
          {({ getFieldValue }) => {
            if (Number(getFieldValue('pack_number')) <= 1 || getFieldValue('same_qty_per_pack') !== false) return null
            const count = Math.min(Math.max(Number(getFieldValue('pack_number')) || 0, 0), 500)
            const packType = getFieldValue('pack_type')
            const inhouseBatchNo = getFieldValue('inhouse_batch_no')
            if (count === 0) return <p className="text-[13px] text-slate-400 mb-3">Enter Number of Packs to set individual quantities.</p>
            return (
              <div className="mb-3 glass-card rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 px-3 py-2 text-xs font-medium text-slate-500 border-b border-white/40">
                  <span>SKU / Pack ID</span>
                  <span>Qty Received</span>
                </div>
                {Array.from({ length: count }, (_, i) => (
                  <div key={i} className="grid grid-cols-2 gap-x-3 items-center px-3 py-1.5 border-b border-white/30 last:border-b-0">
                    <span className="text-[13px] text-slate-700 font-mono">{packSkuPreview(inhouseBatchNo, packType, i)}</span>
                    <Form.Item name={['pack_quantities', i]} rules={[{ required: true, message: 'Required' }]} className="!mb-0">
                      <InputNumber style={{ width: '100%' }} min={0} placeholder="Qty" />
                    </Form.Item>
                  </div>
                ))}
              </div>
            )
          }}
        </Form.Item>
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
  )
}
