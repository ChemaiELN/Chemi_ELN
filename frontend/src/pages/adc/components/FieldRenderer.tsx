import { useState, useEffect } from 'react'
import { Input, InputNumber, DatePicker, Select, Switch, Upload, Button, TimePicker, message, Modal } from 'antd'
import { UploadCloud, Send, PenLine, UserCheck, CheckCircle2 } from 'lucide-react'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import {
  materialApi, batchApi, equipmentCatalogueApi, instrumentCatalogueApi,
  consumableTypeApi, uomApi,
  type Material, type EquipmentCatalogue, type InstrumentCatalogue,
  type ConsumableType, type UomDimension,
} from '../../../api/inventory'
import { experimentApi } from '../../../api/adc'
import { authApi } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import TableField, { type TableColumn } from './TableField'
import ReactantCalculatorField from './ReactantCalculator'
import { BTN_32 } from '../../../utils/buttonSize'
import RichEditor from '../../../components/RichEditor'
import { useAppSelector } from '../../../store'
import { selectUser } from '../../../store/authSlice'

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface TemplateField {
  key: string
  label: string
  type: string
  required?: boolean
  unit?: string
  options?: string[]
  placeholder?: string
  formula?: string
  columns?: TableColumn[]
  min?: number
  max?: number
  decimal_places?: number
  // Inventory-specific
  dimension?: string                     // uom_select: UOM dimension key e.g. 'volume'
  material_types?: string | string[]     // material_select: inventory type filter(s)
  test_type_key?: string                 // (table col) test_master_select: test type key
  add_row_label?: string                 // table: custom "Add row" button label
  fixed_rows?: boolean                   // table: hide Add/Delete row (row count is fixed)
  source_field?: string                  // carried_id: source field key
  read_only?: boolean                    // render as disabled input (auto-filled by another field)
  // autofill_map: override which field keys get the auto-filled values
  // keys: name | lot | concentration | storage_condition | expiry_date | cas_no | iso_type
  autofill_map?: Record<string, string>
  // batch_table_field: key of a sibling table field to auto-populate with batches on selection
  batch_table_field?: string
  // action: action_type identifies which workflow action a button field triggers
  action_type?: string
}

export interface FieldRendererProps {
  field: TemplateField
  value: unknown
  onChange: (val: unknown) => void
  onBulkChange?: (updates: Record<string, unknown>) => void
  disabled?: boolean
  contextData?: Record<string, unknown>  // current screen's full field values
  onFileUpload?: (file: File) => Promise<void>
  // Only needed by 'action' fields (e.g. Submit to AD) to validate sibling
  // required fields and to call the workflow API against the right experiment.
  screenFields?: TemplateField[]
  screenKey?: string
  experimentId?: string
  onActionComplete?: () => void
  // experimentCode: used to auto-generate the 'sample_id' column in table fields
  experimentCode?: string
}

// ── Material Select ───────────────────────────────────────────────────────────

function MaterialSelectField({
  field, value, disabled, onChange, onBulkChange,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'onBulkChange'>) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)

  const typeKey = Array.isArray(field.material_types)
    ? field.material_types.join(',')
    : (field.material_types ?? '')

  useEffect(() => {
    setLoading(true)
    const types = typeKey ? typeKey.split(',').map(t => t.trim()).filter(Boolean) : []
    const fetch = types.length > 0
      ? Promise.all(types.map(t => materialApi.list({ material_type: t, active_only: true, limit: 200 })))
          .then(results => {
            const seen = new Set<number>()
            return results.flat().filter(m => {
              if (seen.has(m.id)) return false
              seen.add(m.id)
              return true
            })
          })
      : materialApi.list({ active_only: true, limit: 200 }).then(r => Array.isArray(r) ? r : [])
    fetch
      .then(setMaterials)
      .catch(() => {})
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeKey])

  const handleChange = async (matId: number | undefined) => {
    onChange(matId ?? null)
    if (!onBulkChange) return
    if (!matId) {
      // Clear auto-filled fields and batch table on clear
      const t = (k: string) => field.autofill_map?.[k] ?? `${field.key}_${k}`
      const cleared: Record<string, unknown> = {
        [field.key]: null,
        [t('code')]: '', [t('name')]: '', [t('lot')]: '', [t('concentration')]: '',
        [t('storage_condition')]: '', [t('expiry_date')]: '', [t('cas_no')]: '', [t('iso_type')]: '',
      }
      if (field.batch_table_field) cleared[field.batch_table_field] = []
      onBulkChange(cleared)
      return
    }
    try {
      const [mat, batches] = await Promise.all([
        materialApi.get(matId),
        batchApi.list({ material_id: matId, category: 'available', limit: 200 }),
      ])
      const batchList = Array.isArray(batches) ? batches : []
      const first = batchList[0] ?? null
      const inhouseNo = first?.include_pack && first.packs?.length
        ? first.packs.map(p => p.inhouse_batch_no).join(', ')
        : (first?.inhouse_batch_no ?? '')

      const t = (k: string) => field.autofill_map?.[k] ?? `${field.key}_${k}`
      const bulk: Record<string, unknown> = {
        [field.key]:              matId,
        [t('code')]:              mat.code ?? '',
        [t('name')]:              mat.name,
        [t('lot')]:               inhouseNo,
        [t('concentration')]:     first?.measuring_unit_value ?? '',
        [t('storage_condition')]: mat.storage_condition ?? '',
        [t('expiry_date')]:       first?.expiry_date ?? '',
        [t('cas_no')]:            mat.cas_no ?? '',
        [t('iso_type')]:          first?.iso_type ?? '',
      }

      // Auto-populate the sibling batch table if configured
      if (field.batch_table_field && batchList.length > 0) {
        const tableRows: Record<string, unknown>[] = []
        let slNo = 1
        for (const b of batchList) {
          if (b.include_pack && b.packs?.length) {
            for (const pack of b.packs) {
              tableRows.push({
                sl_no:                String(slNo++),
                in_house_lot_batch_no: b.inhouse_batch_no ?? '',
                pack_type:            pack.inhouse_batch_no ?? pack.pack_no ?? '',
                mfg_lot_no:           b.batch_no ?? '',
                manufacturer:         (b as unknown as Record<string, unknown>).manufacturer_name as string ?? '',
                exp_date:             b.expiry_date ?? null,
                qty:                  String(pack.qty_available ?? ''),
              })
            }
          } else {
            tableRows.push({
              sl_no:                String(slNo++),
              in_house_lot_batch_no: b.inhouse_batch_no ?? '',
              pack_type:            b.pack_type ?? '',
              mfg_lot_no:           b.batch_no ?? '',
              manufacturer:         (b as unknown as Record<string, unknown>).manufacturer_name as string ?? '',
              exp_date:             b.expiry_date ?? null,
              qty:                  String(b.qty_available ?? ''),
            })
          }
        }
        bulk[field.batch_table_field] = tableRows
      }

      onBulkChange(bulk)
    } catch { /* silently ignore */ }
  }

  return (
    <Select
      size="small" style={{ width: '100%' }}
      loading={loading} disabled={disabled}
      showSearch allowClear optionFilterProp="label"
      placeholder={field.placeholder || 'Select material…'}
      value={(value as number) ?? undefined}
      options={materials.map(m => ({
        value: m.id,
        label: `${m.name}${m.code ? ` (${m.code})` : ''}`,
      }))}
      onChange={handleChange}
    />
  )
}

// ── UOM Select (API-driven) ───────────────────────────────────────────────────

function UomSelectField({
  field, value, disabled, onChange,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange'>) {
  const [units, setUnits] = useState<string[]>([])

  useEffect(() => {
    if (!field.dimension) {
      setUnits(field.options ?? ['mg', 'g', 'µg', 'mL', 'L', 'µL', 'mg/mL', 'nM', 'µM', 'mM'])
      return
    }
    uomApi.get(field.dimension)
      .then((dim: UomDimension) => setUnits(dim.units.filter(u => u.is_active).map(u => u.symbol)))
      .catch(() => setUnits(field.options ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.dimension])

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear
      placeholder={field.placeholder || 'Select unit…'}
      value={(value as string) ?? undefined}
      options={units.map(u => ({ value: u, label: u }))}
      onChange={v => onChange(v ?? null)}
    />
  )
}

// ── Equipment Select (auto-fills related fields) ───────────────────────────────

function EquipmentSelectField({
  field, value, disabled, onChange, onBulkChange,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'onBulkChange'>) {
  const [items, setItems] = useState<EquipmentCatalogue[]>([])

  useEffect(() => {
    equipmentCatalogueApi.list({ is_active: true, limit: 500 }).then(r => setItems(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const handleChange = (id: string | undefined) => {
    onChange(id ?? null)
    if (!id || !onBulkChange) return
    const eq = items.find(e => String(e.id) === id)
    if (!eq) return
    onBulkChange({
      [field.key]: id,
      equipment_id:  eq.asset_id ?? '',
      log_book_no:   eq.asset_id ?? '',
      last_pv_date:  eq.last_maintenance_date ?? '',
      pv_due:        eq.next_maintenance_date ?? '',
    })
  }

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear optionFilterProp="label"
      placeholder={field.placeholder || 'Select equipment…'}
      value={(value as string) ?? undefined}
      options={items.map(e => ({ value: String(e.id), label: `${e.name}${e.asset_id ? ` [${e.asset_id}]` : ''}` }))}
      onChange={handleChange}
    />
  )
}

// ── Instrument Select (auto-fills calibration fields) ─────────────────────────

function InstrumentSelectField({
  field, value, disabled, onChange, onBulkChange,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'onBulkChange'>) {
  const [items, setItems] = useState<InstrumentCatalogue[]>([])

  useEffect(() => {
    instrumentCatalogueApi.list({ is_active: true, limit: 500 }).then(r => setItems(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])

  const handleChange = (id: string | undefined) => {
    onChange(id ?? null)
    if (!id || !onBulkChange) return
    const instr = items.find(i => String(i.id) === id)
    if (!instr) return
    onBulkChange({
      [field.key]:        id,
      instrument_id:      instr.asset_id ?? '',
      log_book_no:        instr.asset_id ?? '',
      calibration_status: instr.calibration_status ?? '',
      calibration_due:    instr.next_calibration_date ?? '',
    })
  }

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear optionFilterProp="label"
      placeholder={field.placeholder || 'Select instrument…'}
      value={(value as string) ?? undefined}
      options={items.map(i => ({ value: String(i.id), label: `${i.name}${i.asset_id ? ` [${i.asset_id}]` : ''}` }))}
      onChange={handleChange}
    />
  )
}

// ── Consumable Type Select ─────────────────────────────────────────────────────

function ConsumableTypeSelectField({
  field, value, disabled, onChange,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange'>) {
  const [types, setTypes] = useState<ConsumableType[]>([])

  useEffect(() => {
    consumableTypeApi.list()
      .then(r => setTypes(Array.isArray(r) ? r : []))
      .catch(() => {})
  }, [])

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear optionFilterProp="label"
      placeholder={field.placeholder || 'Select category…'}
      value={(value as string) ?? undefined}
      options={types.map(ct => ({ value: ct.name, label: ct.name }))}
      onChange={v => onChange(v ?? null)}
    />
  )
}

// ── Reducing Agent Select (multi-select, reads from 1.3 rs_chemicals) ────────

function ReducingAgentSelectField({
  field, value, disabled, onChange, contextData,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'contextData'>) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([])

  // Read from 1.3 via __full_data__ (falls back to current screen's rs_chemicals)
  const fullData = (contextData?.['__full_data__'] as Record<string, Record<string, unknown>> | undefined)
  const rsRows = (
    (fullData?.['mat_reagents']?.['rs_chemicals'] as Record<string, unknown>[] | undefined) ??
    (contextData?.['rs_chemicals'] as Record<string, unknown>[] | undefined) ??
    []
  )
  const idKey = rsRows.map(r => String(r['chemical'] ?? '')).filter(Boolean).join(',')

  useEffect(() => {
    const ids = idKey.split(',').map(Number).filter(id => id > 0)
    if (ids.length === 0) { setOptions([]); return }
    Promise.all(ids.map(id => materialApi.get(id).catch(() => null)))
      .then(mats => {
        const seen = new Set<string>()
        const opts: { label: string; value: string }[] = []
        for (const m of mats) {
          if (m?.name && !seen.has(m.name)) {
            seen.add(m.name)
            opts.push({ label: m.name, value: m.name })
          }
        }
        setOptions(opts)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey])

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear
      placeholder={field.placeholder || 'Select reagent…'}
      value={(value as string) ?? undefined}
      options={options}
      onChange={v => onChange(v ?? null)}
    />
  )
}

// ── Reducing Agent Lot Select (SKU/Pack IDs from 1.3 for selected agent(s)) ───

function ReducingAgentLotSelectField({
  field, value, disabled, onChange, contextData,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'contextData'>) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([])

  // Selected agents may now be an array (multi-select)
  const rawAgents = contextData?.['reducing_agent']
  const selectedAgents: string[] = Array.isArray(rawAgents)
    ? (rawAgents as string[])
    : rawAgents ? [String(rawAgents)] : []

  // 1.3 reagent rows
  const fullData = (contextData?.['__full_data__'] as Record<string, Record<string, unknown>> | undefined)
  const rsRows: Record<string, unknown>[] = (
    (fullData?.['mat_reagents']?.['rs_chemicals'] as Record<string, unknown>[] | undefined) ??
    (contextData?.['rs_chemicals'] as Record<string, unknown>[] | undefined) ??
    []
  )

  const agentKey = selectedAgents.slice().sort().join('|')
  const rsKey    = rsRows.map(r => String(r['chemical'] ?? '')).filter(Boolean).join(',')

  useEffect(() => {
    if (selectedAgents.length === 0) { setOptions([]); return }

    const ids = [...new Set(rsRows.map(r => Number(r['chemical'])).filter(id => id > 0))]
    if (ids.length === 0) { setOptions([]); return }

    let cancelled = false
    ;(async () => {
      try {
        // Resolve material names for all IDs in rs_chemicals
        const mats = await Promise.all(ids.map(id => materialApi.get(id).catch(() => null)))
        const matchedIds: number[] = []
        for (let i = 0; i < ids.length; i++) {
          if (mats[i]?.name && selectedAgents.includes(mats[i]!.name)) {
            matchedIds.push(ids[i])
          }
        }
        if (matchedIds.length === 0) { if (!cancelled) setOptions([]); return }

        // Fetch packs from batch registry for each matched material ID
        const seen = new Set<string>()
        const opts: { label: string; value: string }[] = []
        for (const matId of matchedIds) {
          const batches = await batchApi.list({ material_id: matId, limit: 200 })
          for (const b of Array.isArray(batches) ? batches : []) {
            const packList: string[] = b.packs?.length
              ? b.packs.map((p: { inhouse_batch_no: string }) => p.inhouse_batch_no).filter(Boolean)
              : b.inhouse_batch_no ? [b.inhouse_batch_no] : []
            for (const sku of packList) {
              if (!seen.has(sku)) {
                seen.add(sku)
                opts.push({ label: sku, value: sku })
              }
            }
          }
        }
        if (!cancelled) setOptions(opts)
      } catch {
        if (!cancelled) setOptions([])
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey, rsKey])

  const selected = Array.isArray(value) ? (value as string[]) : value ? [value as string] : []
  const hasAgents = selectedAgents.length > 0

  return (
    <Select
      mode="multiple"
      size="small" style={{ width: '100%' }}
      disabled={disabled || !hasAgents} allowClear showSearch
      placeholder={hasAgents ? 'Select SKU / Pack ID…' : 'Select reducing agent first'}
      value={selected}
      options={options}
      onChange={(v: string[]) => onChange(v ?? [])}
    />
  )
}

// ── LP Lot Select (reads SKU/Pack IDs from 1.2 lp_batch_info, auto-fills expiry) ─

function LpLotSelectField({
  field, value, disabled, onChange, onBulkChange, contextData,
}: Pick<FieldRendererProps, 'field' | 'value' | 'disabled' | 'onChange' | 'onBulkChange' | 'contextData'>) {
  const fullData = contextData?.['__full_data__'] as Record<string, Record<string, unknown>> | undefined
  const lpRows = (fullData?.['mat_linker_payload']?.['lp_batch_info'] as Record<string, unknown>[] | undefined) ?? []

  // Build options from pack_type (SKU/Pack ID); fall back to in_house_lot_batch_no
  const options = lpRows
    .map(r => ({
      packType:  String(r['pack_type']           ?? ''),
      lotNo:     String(r['in_house_lot_batch_no'] ?? ''),
      expDate:   String(r['exp_date']            ?? ''),
    }))
    .filter(r => r.packType || r.lotNo)
    .map(r => ({
      value: r.packType || r.lotNo,
      label: r.packType
        ? `${r.packType}${r.lotNo ? ` — ${r.lotNo}` : ''}`
        : r.lotNo,
      expDate: r.expDate,
    }))

  const handleChange = (v: string | undefined) => {
    const opt = options.find(o => o.value === v)
    if (onBulkChange) {
      onBulkChange({
        [field.key]:       v ?? '',
        lp_expiry_retest:  opt?.expDate ?? '',
      })
    } else {
      onChange(v ?? '')
    }
  }

  return (
    <Select
      size="small" style={{ width: '100%' }}
      disabled={disabled} showSearch allowClear optionFilterProp="label"
      placeholder={options.length ? 'Select lot…' : 'Add batches in 1.2 first'}
      value={(value as string) || undefined}
      options={options}
      onChange={handleChange}
    />
  )
}

// ── Done By / Reviewed By electronic signature ──────────────────────────────────
// Replaces the old username+password+reason+timestamp field block. The performer
// (Chemist/Analyst) signs "Done By" with their password; once done, the reviewer
// (Team Lead/HOD) can sign "Reviewed By" the same way. Both are re-authentications
// of the CURRENT session's user (no arbitrary username entry) and are timestamped.

interface SignatureEntry { username: string; user_id: string; role_code: string; signed_at: string }
interface DoneReviewedValue { done_by?: SignatureEntry | null; reviewed_by?: SignatureEntry | null }

const SIGN_PERFORMER_ROLES = new Set(['CHEM', 'ANALYST'])
const SIGN_REVIEWER_ROLES  = new Set(['TL', 'HOD'])

function DoneReviewedSignatureField({
  value, onChange, disabled,
}: Pick<FieldRendererProps, 'value' | 'onChange' | 'disabled'>) {
  const user = useAppSelector(selectUser)
  const v = (value as DoneReviewedValue) ?? {}
  const doneBy     = v.done_by ?? null
  const reviewedBy = v.reviewed_by ?? null

  const [modalFor, setModalFor]   = useState<'done' | 'reviewed' | null>(null)
  const [password, setPassword]   = useState('')
  const [verifying, setVerifying] = useState(false)

  const canSignDone     = !disabled && !doneBy && SIGN_PERFORMER_ROLES.has(user?.role_code ?? '')
  const canSignReviewed = !disabled && !!doneBy && !reviewedBy && SIGN_REVIEWER_ROLES.has(user?.role_code ?? '')

  const openModal  = (which: 'done' | 'reviewed') => { setPassword(''); setModalFor(which) }
  const closeModal = () => { setModalFor(null); setPassword('') }

  const handleConfirm = async () => {
    if (!password) { message.error('Enter your password.'); return }
    setVerifying(true)
    try {
      const res = await authApi.verifyPassword(password)
      const entry: SignatureEntry = {
        username: res.username, user_id: res.user_id, role_code: res.role_code,
        signed_at: new Date().toISOString(),
      }
      onChange(modalFor === 'done' ? { ...v, done_by: entry } : { ...v, reviewed_by: entry })
      message.success(modalFor === 'done' ? 'Signed as Done By.' : 'Signed as Reviewed By.')
      closeModal()
    } catch (e) {
      message.error(e instanceof ApiError ? e.detail : 'Incorrect password.')
    } finally {
      setVerifying(false)
    }
  }

  const fmt = (iso?: string) => (iso ? dayjs(iso).format('DD MMM YYYY, HH:mm') : '')

  return (
    <div className="flex flex-wrap gap-3">
      {/* Done By */}
      <div className="flex-1 min-w-[220px] border border-slate-200 rounded-lg p-3">
        {doneBy ? (
          <div>
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold mb-1">
              <CheckCircle2 size={14} /> Done By
            </div>
            <p className="text-sm text-slate-700 font-medium">{doneBy.username}</p>
            <p className="text-xs text-slate-400">{fmt(doneBy.signed_at)}</p>
          </div>
        ) : (
          <>
            <Button icon={<PenLine size={13} />} disabled={!canSignDone} onClick={() => openModal('done')} style={BTN_32}>
              Done By
            </Button>
            {!disabled && !canSignDone && (
              <p className="text-[11px] text-slate-400 mt-1.5">Only the Chemist/Analyst performing this experiment can sign here.</p>
            )}
          </>
        )}
      </div>

      {/* Reviewed By */}
      <div className="flex-1 min-w-[220px] border border-slate-200 rounded-lg p-3">
        {reviewedBy ? (
          <div>
            <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold mb-1">
              <CheckCircle2 size={14} /> Reviewed By
            </div>
            <p className="text-sm text-slate-700 font-medium">{reviewedBy.username}</p>
            <p className="text-xs text-slate-400">{fmt(reviewedBy.signed_at)}</p>
          </div>
        ) : (
          <>
            <Button icon={<UserCheck size={13} />} disabled={!canSignReviewed} onClick={() => openModal('reviewed')} style={BTN_32}>
              Reviewed By
            </Button>
            {!disabled && !doneBy && (
              <p className="text-[11px] text-slate-400 mt-1.5">Available once "Done By" is signed.</p>
            )}
            {!disabled && !!doneBy && !SIGN_REVIEWER_ROLES.has(user?.role_code ?? '') && (
              <p className="text-[11px] text-slate-400 mt-1.5">Only Team Lead/HOD can review.</p>
            )}
          </>
        )}
      </div>

      <Modal
        open={modalFor !== null}
        title={modalFor === 'done' ? 'Confirm — Done By' : 'Confirm — Reviewed By'}
        onOk={handleConfirm}
        onCancel={closeModal}
        okText="Confirm"
        confirmLoading={verifying}
        destroyOnHidden
        width={380}
        centered
      >
        <p className="text-xs text-slate-500 mb-3">
          Enter your password to confirm this electronic signature as <b>{user?.username}</b>.
        </p>
        {/* Hidden username field so the browser's autofill has a correct target to
            associate with the password field below, instead of guessing and
            injecting the saved username into some unrelated visible input on the
            page behind this modal (e.g. a nearby Select's search box). */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.username ?? ''}
          readOnly
          hidden
        />
        <Input.Password
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter your password"
          onPressEnter={handleConfirm}
          autoComplete="new-password"
          autoFocus
        />
      </Modal>
    </div>
  )
}

// ── Buffer Group ──────────────────────────────────────────────────────────────

import { Beaker, Trash2 } from 'lucide-react'

interface BufferComponent { name: string; pack_type: string; qty: string }
interface BufferEntry {
  buffer_id: string
  buffer_name: string
  description: string
  required_volume: string
  required_volume_unit: string
  required_concentration: string
  required_concentration_unit: string
  components: BufferComponent[]
  prep_date: string
  expiry_date: string
  ph_before: string
  conductivity_before: string
  ph_after: string
  conductivity_after: string
  storage_temp: string
  volume: string
  volume_unit: string
  procedure: string
}

const VOL_UNITS = ['mL', 'L', 'µL']
const CONC_UNITS = ['mM', 'µM', 'nM', 'M', 'mg/mL', 'µg/mL', '%']

function nextBufferId(entries: BufferEntry[]): string {
  const nums = entries.map(e => {
    const m = (e.buffer_id ?? '').match(/BUF-(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  })
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `BUF-${String(next).padStart(3, '0')}`
}

function emptyBuffer(entries: BufferEntry[]): BufferEntry {
  const today = new Date().toISOString().slice(0, 10)
  return {
    buffer_id: '', buffer_name: '', description: '',
    required_volume: '100', required_volume_unit: 'mL',
    required_concentration: '50', required_concentration_unit: 'mM',
    components: [],
    prep_date: today, expiry_date: '',
    ph_before: '', conductivity_before: '',
    ph_after: '', conductivity_after: '',
    storage_temp: '', volume: '0', volume_unit: 'mL',
    procedure: '',
    // buffer_id assigned separately after list update
    _placeholder_idx: entries.length,
  } as unknown as BufferEntry
}

function BufferGroupField({ value, onChange, disabled, contextData }: { value: unknown; onChange: (v: unknown) => void; disabled?: boolean; contextData?: Record<string, unknown> }) {
  const entries: BufferEntry[] = Array.isArray(value) ? (value as BufferEntry[]) : []

  // ── Load chemical options from 1.3 Reagents & Salts (screen key: mat_reagents, field: rs_chemicals) ──
  const [chemOptions, setChemOptions] = useState<{ value: string; label: string }[]>([])
  const [chemMaterials, setChemMaterials] = useState<Material[]>([])
  const fullData = contextData?.__full_data__ as Record<string, Record<string, unknown>> | undefined
  const rsRows = (fullData?.['mat_reagents']?.['rs_chemicals'] as Record<string, unknown>[] | undefined) ?? []
  const rsIdKey = rsRows.map(r => String(r['chemical'] ?? '')).filter(Boolean).join(',')

  useEffect(() => {
    const ids = rsIdKey.split(',').map(Number).filter(id => id > 0)
    if (ids.length === 0) { setChemOptions([]); setChemMaterials([]); return }
    Promise.all(ids.map(id => materialApi.get(id).catch(() => null)))
      .then(mats => {
        const valid = mats.filter((m): m is Material => !!m && !!m.name)
        const seen = new Set<string>()
        const opts: { value: string; label: string }[] = []
        for (const m of valid) {
          if (!seen.has(m.name)) {
            seen.add(m.name)
            opts.push({ value: m.name, label: m.name })
          }
        }
        setChemMaterials(valid)
        setChemOptions(opts)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsIdKey])

  const handleComponentChemChange = async (ei: number, ci: number, name: string) => {
    updateComponent(ei, ci, { name, pack_type: '' })
    const mat = chemMaterials.find(m => m.name === name)
    if (!mat) return
    try {
      const batches = await batchApi.list({ material_id: mat.id, category: 'available', limit: 50 })
      const batchList = Array.isArray(batches) ? batches : []

      // Collect one row per SKU/pack with quantity
      const rows: { pack_type: string; qty: string }[] = []
      for (const b of batchList) {
        if (b.include_pack && b.packs?.length) {
          for (const p of b.packs) {
            const sku = p.inhouse_batch_no ?? p.pack_no ?? ''
            if (sku) rows.push({ pack_type: sku, qty: String(p.qty_available ?? '') })
          }
        } else {
          const sku = b.inhouse_batch_no ?? ''
          if (sku) rows.push({ pack_type: sku, qty: String(b.qty_available ?? '') })
        }
      }

      if (rows.length === 0) return

      // Replace the current row with one row per SKU
      onChange(
        entries.map((e, idx) => {
          if (idx !== ei) return e
          const before = e.components.slice(0, ci)
          const after  = e.components.slice(ci + 1)
          const newRows = rows.map(r => ({
            name,
            pack_type: r.pack_type,
            qty: r.qty,
          }))
          return { ...e, components: [...before, ...newRows, ...after] }
        })
      )
    } catch { /* ignore */ }
  }

  const update = (idx: number, patch: Partial<BufferEntry>) =>
    onChange(entries.map((e, i) => i === idx ? { ...e, ...patch } : e))

  const addBuffer = () => {
    const newEntry = emptyBuffer(entries)
    onChange([...entries, newEntry])
  }

  const removeBuffer = (idx: number) => onChange(entries.filter((_, i) => i !== idx))

  const generateId = (idx: number) => {
    const id = nextBufferId(entries.filter((_, i) => i !== idx || entries[idx].buffer_id))
    update(idx, { buffer_id: id })
  }

  const updateComponent = (ei: number, ci: number, patch: Partial<BufferComponent>) =>
    update(ei, { components: entries[ei].components.map((c, i) => i === ci ? { ...c, ...patch } : c) })

  const addComponent = (ei: number) =>
    update(ei, { components: [...entries[ei].components, { name: '', pack_type: '', qty: '' }] })

  const removeComponent = (ei: number, ci: number) =>
    update(ei, { components: entries[ei].components.filter((_, i) => i !== ci) })

  const thCls = 'px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200'
  const tdCls = 'px-2 py-1 border-b border-slate-100 align-middle'
  const labelCls = 'block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5'
  const sectionCls = 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-3'

  return (
    <div className="space-y-4">
      {entries.length === 0 && (
        <p className="text-sm text-slate-400 py-2">No buffers added — click &quot;+ Add Buffer&quot; below.</p>
      )}
      {entries.map((buf, ei) => (
        <div key={ei} className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
          {/* ── Card header ── */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <Beaker size={16} className="text-slate-400 flex-shrink-0" />
            <Input
              size="small" value={buf.buffer_name} disabled={disabled}
              placeholder="Buffer Name (e.g. Reduction Buffer)"
              className="flex-1 font-medium"
              style={{ border: 'none', background: 'transparent', boxShadow: 'none', fontWeight: 500 }}
              onChange={e => update(ei, { buffer_name: e.target.value })}
            />
            <Input
              size="small" value={buf.description} disabled={disabled}
              placeholder="Description / subtitle (e.g. Sodium phosphate 50 mM pH 8.0 — Working / Reaction)"
              className="flex-[2]"
              style={{ border: 'none', background: 'transparent', boxShadow: 'none', fontSize: 12, color: '#64748b' }}
              onChange={e => update(ei, { description: e.target.value })}
            />
            {!disabled && (
              <button className="text-slate-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0" onClick={() => removeBuffer(ei)}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* ── Based on Buffer (shown from 2nd buffer onwards) ── */}
          {ei > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Based on Buffer</span>
              <Select
                size="small" allowClear showSearch optionFilterProp="label"
                placeholder="Select previous buffer (optional)…"
                style={{ minWidth: 220 }}
                disabled={disabled}
                value={(buf as BufferEntry & { based_on?: string }).based_on || undefined}
                options={entries.slice(0, ei).filter(e => e.buffer_id).map(e => ({
                  value: e.buffer_id,
                  label: `${e.buffer_id}${e.buffer_name ? ` — ${e.buffer_name}` : ''}`,
                }))}
                onChange={v => update(ei, { based_on: v ?? '' } as Partial<BufferEntry>)}
              />
            </div>
          )}

          {/* ── Body: 2-column layout ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">

            {/* ── LEFT COLUMN ── */}
            <div className="p-4 space-y-4">

              {/* Composition & Quantity */}
              <div>
                <div className={sectionCls}>Composition &amp; Quantity</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Required Volume</label>
                    <div className="flex">
                      <InputNumber
                        size="small" min={0} value={buf.required_volume ? Number(buf.required_volume) : undefined}
                        disabled={disabled} placeholder="100" className="flex-1"
                        style={{ borderRadius: '4px 0 0 4px' }}
                        onChange={v => update(ei, { required_volume: v != null ? String(v) : '' })}
                      />
                      <Select
                        size="small" value={buf.required_volume_unit || 'mL'} disabled={disabled}
                        options={VOL_UNITS.map(u => ({ value: u, label: u }))}
                        style={{ width: 70, borderRadius: '0 4px 4px 0' }}
                        onChange={v => update(ei, { required_volume_unit: v })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Required Concentration</label>
                    <div className="flex">
                      <InputNumber
                        size="small" min={0} value={buf.required_concentration ? Number(buf.required_concentration) : undefined}
                        disabled={disabled} placeholder="50" className="flex-1"
                        style={{ borderRadius: '4px 0 0 4px' }}
                        onChange={v => update(ei, { required_concentration: v != null ? String(v) : '' })}
                      />
                      <Select
                        size="small" value={buf.required_concentration_unit || 'mM'} disabled={disabled}
                        options={CONC_UNITS.map(u => ({ value: u, label: u }))}
                        style={{ width: 80, borderRadius: '0 4px 4px 0' }}
                        onChange={v => update(ei, { required_concentration_unit: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Components */}
              <div>
                <div className={sectionCls}>Components</div>
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className={thCls}>Chemical / Reagent</th>
                        <th className={thCls} style={{ width: '22%' }}>SKU / Pack ID</th>
                        <th className={thCls} style={{ width: '18%' }}>Qty (g)</th>
                        {!disabled && <th className={thCls} style={{ width: 28 }} />}
                      </tr>
                    </thead>
                    <tbody>
                      {buf.components.length === 0 && (
                        <tr><td colSpan={4} className="text-center py-3 text-slate-400 text-xs">No components yet.</td></tr>
                      )}
                      {buf.components.map((comp, ci) => (
                        <tr key={ci}>
                          <td className={tdCls}>
                            {chemOptions.length > 0 || ei > 0 ? (
                              <Select
                                size="small" style={{ width: '100%' }}
                                showSearch allowClear optionFilterProp="label"
                                placeholder="Select chemical or buffer…"
                                value={comp.name || undefined}
                                options={[
                                  ...(chemOptions.length > 0 ? [{ label: '— Chemicals / Reagents —', options: chemOptions }] : []),
                                  ...(ei > 0 && entries.slice(0, ei).some(e => e.buffer_id) ? [{
                                    label: '— Previous Buffers —',
                                    options: entries.slice(0, ei)
                                      .filter(e => e.buffer_id)
                                      .map(e => ({
                                        value: e.buffer_id,
                                        label: `${e.buffer_id}${e.buffer_name ? ` — ${e.buffer_name}` : ''}`,
                                      })),
                                  }] : []),
                                ]}
                                disabled={disabled}
                                onChange={v => v ? handleComponentChemChange(ei, ci, v) : updateComponent(ei, ci, { name: '', pack_type: '' })}
                              />
                            ) : (
                              <Input size="small" value={comp.name} disabled={disabled}
                                placeholder="Chemical name"
                                onChange={e => updateComponent(ei, ci, { name: e.target.value })} />
                            )}
                          </td>
                          <td className={tdCls}>
                            <Input size="small" value={comp.pack_type} disabled={disabled}
                              placeholder="e.g. 500g"
                              onChange={e => updateComponent(ei, ci, { pack_type: e.target.value })} />
                          </td>
                          <td className={tdCls}>
                            <Input size="small" value={comp.qty} disabled={disabled}
                              placeholder="0"
                              onChange={e => updateComponent(ei, ci, { qty: e.target.value })} />
                          </td>
                          {!disabled && (
                            <td className={tdCls}>
                              <button className="text-slate-300 hover:text-red-500 text-xs" onClick={() => removeComponent(ei, ci)}>✕</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!disabled && (
                  <Button size="small" style={BTN_32} type="dashed" className="mt-1.5 text-xs" onClick={() => addComponent(ei)}>
                    + Add component
                  </Button>
                )}
              </div>

              {/* Preparation Details */}
              <div>
                <div className={sectionCls}>Preparation Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prep Date</label>
                    <DatePicker
                      size="small" className="w-full" format="DD-MM-YYYY"
                      value={buf.prep_date ? dayjs(buf.prep_date) : null}
                      disabled={disabled}
                      onChange={d => update(ei, { prep_date: d ? d.format('YYYY-MM-DD') : '' })}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Expiry Date</label>
                    <DatePicker
                      size="small" className="w-full" format="DD-MM-YYYY"
                      value={buf.expiry_date ? dayjs(buf.expiry_date) : null}
                      disabled={disabled}
                      placeholder="dd-mm-yyyy"
                      onChange={d => update(ei, { expiry_date: d ? d.format('YYYY-MM-DD') : '' })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="p-4 space-y-4">

              {/* Measurements */}
              <div>
                <div className={sectionCls}>Measurements</div>

                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Before Adjustment</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>pH (Before Adjustment)</label>
                    <Input size="small" value={buf.ph_before} disabled={disabled}
                      placeholder="e.g. 8.12"
                      onChange={e => update(ei, { ph_before: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Conductivity Before (mS/cm)</label>
                    <Input size="small" value={buf.conductivity_before} disabled={disabled}
                      placeholder="e.g. 6.42"
                      onChange={e => update(ei, { conductivity_before: e.target.value })} />
                  </div>
                </div>

                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">After Adjustment / Final</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>pH (After / Final)</label>
                    <Input size="small" value={buf.ph_after} disabled={disabled}
                      placeholder="e.g. 8.00"
                      onChange={e => update(ei, { ph_after: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Conductivity After (mS/cm)</label>
                    <Input size="small" value={buf.conductivity_after} disabled={disabled}
                      placeholder="e.g. 6.38"
                      onChange={e => update(ei, { conductivity_after: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Storage */}
              <div>
                <div className={sectionCls}>Storage</div>
                <div className="mb-3">
                  <label className={labelCls}>Storage Temperature</label>
                  <Input size="small" value={buf.storage_temp} disabled={disabled}
                    placeholder="e.g. 2-8 °C"
                    onChange={e => update(ei, { storage_temp: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Volume</label>
                    <div className="flex">
                      <InputNumber
                        size="small" min={0} value={buf.volume ? Number(buf.volume) : 0}
                        disabled={disabled} className="flex-1"
                        style={{ borderRadius: '4px 0 0 4px' }}
                        onChange={v => update(ei, { volume: v != null ? String(v) : '0' })}
                      />
                      <Select
                        size="small" value={buf.volume_unit || 'mL'} disabled={disabled}
                        options={VOL_UNITS.map(u => ({ value: u, label: u }))}
                        style={{ width: 70, borderRadius: '0 4px 4px 0' }}
                        onChange={v => update(ei, { volume_unit: v })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Buffer ID</label>
                    <div className="flex gap-1">
                      <Input
                        size="small" value={buf.buffer_id} disabled={disabled}
                        placeholder="Click Generate"
                        readOnly
                        className="flex-1 font-mono"
                        style={{ background: '#f8fafc' }}
                      />
                      {!disabled && (
                        <Button
                          size="small" type="primary"
                          style={{ background: '#1e293b', borderColor: '#1e293b', ...BTN_32 }}
                          onClick={() => generateId(ei)}
                        >Generate</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Procedure (full width) ── */}
          <div className="px-4 pb-4 border-t border-slate-100 pt-3">
            <div className={sectionCls}>Procedure</div>
            <RichEditor
              value={buf.procedure}
              readOnly={disabled}
              minHeight={90}
              placeholder="Describe the preparation procedure for this buffer…"
              onChange={v => update(ei, { procedure: v })}
            />
          </div>
        </div>
      ))}

      {!disabled && (
        <Button type="dashed" className="w-full" onClick={addBuffer}>
          + Add Buffer
        </Button>
      )}
    </div>
  )
}

// ── Test Results Tabs ─────────────────────────────────────────────────────────

interface TestResultRow { attribute: string; result: string; acceptance_criteria: string; status: string }
interface TestTab { test_name: string; rows: TestResultRow[]; observations: string }

const STATUS_OPTIONS = ['Pending', 'Pass', 'Fail', 'N/A']
const DEFAULT_TESTS = [
  'LC-MS', 'SEC-HPLC', 'HIC DAR', 'CE-SDS', 'icIEF',
  'Binding Assays', 'In-vivo Assays', 'Endotoxin (LAL)', 'Bioburden',
]

function TestResultsTabsField({
  value, onChange, disabled,
}: { value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) {
  const tabs: TestTab[] = (value as TestTab[] | undefined) ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const [addingTest, setAddingTest] = useState(false)
  const [newTestName, setNewTestName] = useState('')

  const safeIdx = Math.min(activeIdx, Math.max(0, tabs.length - 1))
  const activeTab = tabs[safeIdx]

  const updateTab = (idx: number, patch: Partial<TestTab>) =>
    onChange(tabs.map((t, i) => i === idx ? { ...t, ...patch } : t))

  const updateRow = (ti: number, ri: number, patch: Partial<TestResultRow>) =>
    updateTab(ti, { rows: tabs[ti].rows.map((r, i) => i === ri ? { ...r, ...patch } : r) })

  const addRow = (ti: number) =>
    updateTab(ti, { rows: [...tabs[ti].rows, { attribute: '', result: '', acceptance_criteria: '', status: 'Pending' }] })

  const removeRow = (ti: number, ri: number) =>
    updateTab(ti, { rows: tabs[ti].rows.filter((_, i) => i !== ri) })

  const addTab = (name: string) => {
    onChange([...tabs, { test_name: name, rows: [], observations: '' }])
    setActiveIdx(tabs.length)
    setAddingTest(false)
    setNewTestName('')
  }

  const removeTab = (idx: number) => {
    onChange(tabs.filter((_, i) => i !== idx))
    setActiveIdx(Math.max(0, idx - 1))
  }

  const thCls = 'px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 whitespace-nowrap'
  const tdCls = 'px-2 py-1 border-b border-slate-100 align-middle'

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center flex-wrap gap-0.5 border-b border-slate-200 mb-3">
        {tabs.map((tab, idx) => (
          <div
            key={idx}
            onClick={() => setActiveIdx(idx)}
            className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs border-b-2 -mb-px transition-colors ${
              idx === safeIdx
                ? 'border-indigo-500 text-indigo-700 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.test_name}
            {!disabled && (
              <span
                className="text-[10px] text-slate-400 hover:text-red-500"
                onClick={e => { e.stopPropagation(); removeTab(idx) }}
              >✕</span>
            )}
          </div>
        ))}
        {!disabled && !addingTest && (
          <Button size="small" style={BTN_32} type="dashed" className="ml-1 text-xs" onClick={() => setAddingTest(true)}>
            + Add test
          </Button>
        )}
        {!disabled && addingTest && (
          <div className="flex items-center gap-1 ml-1">
            <Select
              size="small" showSearch allowClear placeholder="Test name" style={{ width: 190 }}
              options={DEFAULT_TESTS.filter(t => !tabs.find(tab => tab.test_name === t)).map(t => ({ value: t, label: t }))}
              value={newTestName || undefined}
              onChange={v => setNewTestName(v ?? '')}
              onSearch={v => setNewTestName(v)}
            />
            <Button size="small" style={BTN_32} type="primary" disabled={!newTestName.trim()} onClick={() => addTab(newTestName.trim())}>Add</Button>
            <Button size="small" style={BTN_32} onClick={() => { setAddingTest(false); setNewTestName('') }}>Cancel</Button>
          </div>
        )}
      </div>

      {activeTab ? (
        <>
          <div className="overflow-x-auto mb-2 rounded border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={thCls} style={{ width: '28%' }}>Attribute</th>
                  <th className={thCls} style={{ width: '20%' }}>Result</th>
                  <th className={thCls} style={{ width: '30%' }}>Acceptance Criteria</th>
                  <th className={thCls} style={{ width: '16%' }}>Status</th>
                  {!disabled && <th className={thCls} style={{ width: 28 }} />}
                </tr>
              </thead>
              <tbody>
                {activeTab.rows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-3 text-slate-400 text-xs">No rows yet</td></tr>
                )}
                {activeTab.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className={tdCls}><Input size="small" value={row.attribute} disabled={disabled} onChange={e => updateRow(safeIdx, ri, { attribute: e.target.value })} /></td>
                    <td className={tdCls}><Input size="small" value={row.result} disabled={disabled} onChange={e => updateRow(safeIdx, ri, { result: e.target.value })} /></td>
                    <td className={tdCls}><Input size="small" value={row.acceptance_criteria} disabled={disabled} onChange={e => updateRow(safeIdx, ri, { acceptance_criteria: e.target.value })} /></td>
                    <td className={tdCls}>
                      <Select size="small" style={{ width: '100%' }} value={row.status} disabled={disabled}
                        options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
                        onChange={v => updateRow(safeIdx, ri, { status: v })} />
                    </td>
                    {!disabled && (
                      <td className={tdCls}>
                        <button className="text-slate-300 hover:text-red-500 text-xs" onClick={() => removeRow(safeIdx, ri)}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!disabled && (
            <Button size="small" style={BTN_32} type="dashed" className="text-xs mb-3" onClick={() => addRow(safeIdx)}>
              + Add row
            </Button>
          )}
          <div className="text-xs text-slate-500 mb-1">Observations / Notes</div>
          <Input.TextArea rows={3} disabled={disabled}
            placeholder={`Observations for ${activeTab.test_name}…`}
            value={activeTab.observations}
            onChange={e => updateTab(safeIdx, { observations: e.target.value })}
          />
        </>
      ) : (
        <p className="text-sm text-slate-400 py-3">No tests added — click &quot;+ Add test&quot; above.</p>
      )}
    </div>
  )
}

// ── Main FieldRenderer ────────────────────────────────────────────────────────

export default function FieldRenderer({
  field, value, onChange, onBulkChange, disabled, contextData, onFileUpload,
  screenFields, screenKey, experimentId, onActionComplete, experimentCode,
}: FieldRendererProps) {
  const { type, placeholder, unit, options, columns, min, max, decimal_places } = field
  const isReadOnly = field.read_only

  // Section divider — must span full grid width (caller sets col-span-full)
  if (type === 'section_header') {
    return (
      <div className="col-span-full mt-2 mb-1">
        <div className="border-b border-slate-200 pb-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{field.label}</p>
        </div>
      </div>
    )
  }

  // Workflow action button (e.g. "Submit to AD") — validates required sibling
  // fields + SKU/Pack ID + sample quantity, then deducts inventory and locks
  // every field above it in this screen.
  if (type === 'done_reviewed_signature') {
    return <DoneReviewedSignatureField value={value} onChange={onChange} disabled={disabled} />
  }

  if (type === 'action' && field.action_type === 'submit_to_ad') {
    const submission = value as { submitted?: boolean; submitted_at?: string; sample_qty?: string; sku_pack_id?: string } | undefined
    const submitted = !!submission?.submitted

    const handleSubmitToAd = async () => {
      if (submitted || disabled) return
      if (!experimentId) { message.error('Cannot submit — experiment not loaded.'); return }

      const ownIdx = (screenFields ?? []).findIndex(f => f.key === field.key)
      const fieldsAbove = ownIdx === -1 ? (screenFields ?? []) : (screenFields ?? []).slice(0, ownIdx)
      const missing = fieldsAbove
        .filter(f => f.required)
        .filter(f => {
          const v = contextData?.[f.key]
          return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
        })
      if (missing.length > 0) {
        message.error(`Please complete required field(s): ${missing.map(f => f.label).join(', ')}`)
        return
      }

      // Batch Information table + Sample Qty field are identified structurally
      // (SKU/Pack ID column key, and a number field key ending in _sample_qty)
      // rather than by a hardcoded field key, so this works for any screen that
      // follows the same pattern (e.g. 1.1 Antibody Info, 1.2 Linker-Payload Info).
      const batchTableKey = (screenFields ?? []).find(f =>
        f.type === 'table' && f.columns?.some(c => c.key === 'pack_type')
      )?.key
      const batchRows = (batchTableKey ? contextData?.[batchTableKey] : undefined) as Record<string, unknown>[] | undefined ?? []
      const skuPackId = (batchRows[0]?.['pack_type'] as string) || ''
      if (!skuPackId) {
        message.error('Select a SKU/Pack ID in Batch Information before submitting.')
        return
      }
      const sampleQtyKey = (screenFields ?? []).find(f => f.type === 'number' && f.key.endsWith('_sample_qty'))?.key
      const sampleQty = sampleQtyKey ? contextData?.[sampleQtyKey] : undefined
      const qtyNum = Number(sampleQty)
      if (!sampleQty || !Number.isFinite(qtyNum) || qtyNum <= 0) {
        message.error('Enter a Sample Qty greater than zero before submitting.')
        return
      }

      try {
        if (!screenKey) { message.error('Cannot submit — screen not identified.'); return }
        await experimentApi.submitToAd(experimentId, {
          screen_key:  screenKey,
          field_key:   field.key,
          sku_pack_id: skuPackId,
          sample_qty:  qtyNum,
        })
        message.success('Submitted to AD — sample quantity deducted from inventory.')
        // Refresh from the server (source of truth) rather than setting local
        // state directly — this avoids re-triggering the generic dirty/autosave
        // path for a change that's already persisted.
        onActionComplete?.()
      } catch (e) {
        message.error(e instanceof ApiError ? e.detail : 'Failed to submit to AD.')
      }
    }

    return (
      <div className="col-span-3">
        <Button
          type="primary"
          style={BTN_32}
          icon={<Send size={13} />}
          disabled={submitted || disabled}
          onClick={handleSubmitToAd}
        >
          {submitted ? 'Submitted to AD' : field.label || 'Submit to AD'}
        </Button>
        {submitted && submission?.submitted_at && (
          <p className="text-xs text-slate-400 mt-1.5">
            Submitted {dayjs(submission.submitted_at).format('DD MMM YYYY, HH:mm')}
            {submission.sample_qty ? ` — Qty ${submission.sample_qty} deducted from ${submission.sku_pack_id}` : ''}
          </p>
        )}
      </div>
    )
  }

  // Read-only auto/carried IDs
  if (type === 'auto_id' || type === 'carried_id') {
    return (
      <span className="font-mono text-sm text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
        {(value as string) || <span className="text-slate-300 italic text-xs">auto-assigned</span>}
      </span>
    )
  }

  // Computed formula display
  if (type === 'formula') {
    return (
      <span className="font-mono text-sm text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
        {(value as string | number) ?? <span className="text-slate-300 italic text-xs">calculated</span>}
        {unit && <span className="text-slate-400 ml-1 text-xs">{unit}</span>}
      </span>
    )
  }

  if (type === 'boolean') {
    return <Switch checked={!!value} onChange={checked => onChange(checked)} disabled={disabled} size="small" />
  }

  if (type === 'number') {
    return (
      <InputNumber
        value={value as number} onChange={val => onChange(val)}
        disabled={disabled} placeholder={placeholder}
        min={min} max={max} precision={decimal_places}
        size="small" className="w-full" addonAfter={unit || undefined}
      />
    )
  }

  if (type === 'date') {
    return (
      <DatePicker
        value={value ? dayjs(value as string) : null}
        onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)}
        disabled={disabled} placeholder={placeholder || 'Select date'}
        size="small" className="w-full" format="DD MMM YYYY"
      />
    )
  }

  if (type === 'datetime') {
    return (
      <DatePicker
        showTime value={value ? dayjs(value as string) : null}
        onChange={d => onChange(d ? d.toISOString() : null)}
        disabled={disabled} placeholder={placeholder || 'Select date & time'}
        size="small" className="w-full" format="DD MMM YYYY HH:mm"
      />
    )
  }

  if (type === 'time') {
    return (
      <TimePicker
        value={value ? dayjs(value as string, 'HH:mm') : null}
        onChange={t => onChange(t ? t.format('HH:mm') : null)}
        disabled={disabled} format="HH:mm" size="small" className="w-full"
      />
    )
  }

  if (type === 'time_recorder') {
    const iso = value as string | undefined
    const formatted = iso ? dayjs(iso).format('DD MMM YYYY · HH:mm') : ''
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {iso ? (
          <>
            <Input size="small" value={formatted} readOnly
              style={{ width: 210, background: '#f0fdf4', borderColor: '#86efac', fontSize: 12 }} />
            {!disabled && (
              <Button size="small" style={BTN_32} type="text" danger onClick={() => onChange('')}>Clear</Button>
            )}
          </>
        ) : (
          <>
            {!disabled && (
              <Button size="small" style={BTN_32} onClick={() => onChange(new Date().toISOString())}>Record now</Button>
            )}
            <span className="text-xs text-slate-400">click to stamp current time</span>
          </>
        )}
      </div>
    )
  }

  if (type === 'select') {
    return (
      <Select
        value={value as string} onChange={val => onChange(val)}
        disabled={disabled} placeholder={placeholder || 'Select…'}
        size="small" className="w-full"
        options={(options ?? []).map(o => ({ value: o, label: o }))}
        allowClear showSearch
        filterOption={(input, opt) =>
          String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
      />
    )
  }

  if (type === 'multiselect') {
    return (
      <Select
        mode="multiple" value={value as string[]} onChange={val => onChange(val)}
        disabled={disabled} placeholder={placeholder || 'Select…'}
        size="small" className="w-full"
        options={(options ?? []).map(o => ({ value: o, label: o }))}
      />
    )
  }

  // UOM select — fetches units from API by dimension key
  if (type === 'uom_select') {
    return <UomSelectField field={field} value={value} disabled={disabled} onChange={onChange} />
  }

  // Inventory: material picker
  if (type === 'material_select') {
    return (
      <MaterialSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} onBulkChange={onBulkChange}
      />
    )
  }

  // Inventory: equipment catalogue picker
  if (type === 'equipment_select') {
    return (
      <EquipmentSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} onBulkChange={onBulkChange}
      />
    )
  }

  // Inventory: instrument catalogue picker
  if (type === 'instrument_select') {
    return (
      <InstrumentSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} onBulkChange={onBulkChange}
      />
    )
  }

  // Inventory: consumable category picker
  if (type === 'consumable_type_select') {
    return <ConsumableTypeSelectField field={field} value={value} disabled={disabled} onChange={onChange} />
  }

  // ADC: reducing agent derived from rs_chemicals table
  if (type === 'reducing_agent_select') {
    return (
      <ReducingAgentSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} contextData={contextData}
      />
    )
  }

  // ADC: lots for the selected reducing agent
  if (type === 'reducing_agent_lot_select') {
    return (
      <ReducingAgentLotSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} contextData={contextData}
      />
    )
  }

  // ADC: LP lot select — reads SKU/Pack IDs from 1.2 lp_batch_info, auto-fills expiry
  if (type === 'lp_lot_select') {
    return (
      <LpLotSelectField
        field={field} value={value} disabled={disabled}
        onChange={onChange} onBulkChange={onBulkChange} contextData={contextData}
      />
    )
  }

  if (type === 'password') {
    return (
      <Input.Password
        value={value as string ?? ''} onChange={e => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder} size="small" className="w-full"
      />
    )
  }

  if (type === 'textarea') {
    return (
      <Input.TextArea
        value={value as string ?? ''} onChange={e => onChange(e.target.value)}
        disabled={disabled} placeholder={placeholder} rows={3} className="w-full"
      />
    )
  }

  if (type === 'file') {
    return (
      <Upload
        beforeUpload={file => { onFileUpload?.(file); return false }}
        disabled={disabled}
        fileList={
          value
            ? [{ uid: '-1', name: (value as { filename?: string })?.filename || String(value), status: 'done' } as UploadFile]
            : []
        }
        maxCount={1}
      >
        {!disabled && <Button icon={<UploadCloud size={14} />} size="small" style={BTN_32}>Upload</Button>}
      </Upload>
    )
  }

  if (type === 'table') {
    // Batch Information tables (1.1 Antibody Info, 1.2 Linker-Payload Info, ...)
    // are entirely auto-filled from the selected material's batches/packs —
    // identified by their SKU/Pack ID ('pack_type') column, not a hardcoded
    // field key, so this applies to any screen following the same pattern.
    // Cell values must never be hand-edited, but users still need to be able
    // to remove/restore rows.
    const isBatchInfoTable = (columns ?? []).some(c => c.key === 'pack_type')
    // Sample IDs must stay unique across the whole experiment, not just within
    // one table — screens share the same experiment code, so tag the prefix
    // with a short tag derived from this table's own field key (e.g.
    // 'mab_analysis_results' → 'MAB', 'lp_analysis_results' → 'LP').
    const sampleIdTag = field.key.split('_')[0].toUpperCase()
    const autoIdPrefix = experimentCode ? `${experimentCode}-${sampleIdTag}` : undefined
    return (
      <TableField
        columns={columns ?? []}
        value={value as Record<string, unknown>[] ?? []}
        onChange={rows => onChange(rows)}
        disabled={disabled || isReadOnly || isBatchInfoTable}
        allowRowOps={isBatchInfoTable && !disabled}
        hideRowOps={field.fixed_rows}
        layout={(field as { layout?: string }).layout}
        contextData={contextData}
        dynamicColPrefix={(field as { dynamic_col_prefix?: string }).dynamic_col_prefix}
        autoIdPrefix={autoIdPrefix}
      />
    )
  }

  if (type === 'test_results_tabs') {
    return <TestResultsTabsField value={value} onChange={onChange} disabled={disabled} />
  }

  if (type === 'buffer_group') {
    return <BufferGroupField value={value} onChange={onChange} disabled={disabled} contextData={contextData} />
  }

  if (type === 'js_sheet') {
    return <ReactantCalculatorField value={value} onChange={onChange} disabled={disabled} contextData={contextData} />
  }

  // Default: plain text input (also used for read_only auto-filled fields)
  return (
    <Input
      value={value as string ?? ''} onChange={e => onChange(e.target.value)}
      disabled={disabled || isReadOnly} placeholder={placeholder} size="small"
      addonAfter={unit || undefined} className="w-full"
      style={isReadOnly ? { background: '#f8fafc', color: '#64748b' } : undefined}
    />
  )
}
