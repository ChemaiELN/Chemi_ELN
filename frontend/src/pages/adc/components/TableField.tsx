import { useState, useEffect, useRef } from 'react'
import { Button, Input, Select, DatePicker, Checkbox, InputNumber, Popover } from 'antd'
import { Plus, Trash2, CheckCircle, ExternalLink } from 'lucide-react'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import dayjs from 'dayjs'
import {
  materialApi, batchApi, equipmentCatalogueApi, instrumentCatalogueApi,
  consumableTypeApi, testMasterApi, mappingApi, manufacturerApi,
  type Material, type Batch, type EquipmentCatalogue, type InstrumentCatalogue,
  type ConsumableType, type TestType, type Mapping,
} from '../../../api/inventory'
import { BTN_32 } from '../../../utils/buttonSize'
import { EmptyValue } from '../../../components/ui/EmptyValue'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TableColumn {
  key: string
  label: string
  type: string
  required?: boolean
  unit?: string
  options?: string[]
  material_types?: string | string[]  // material_select: inventory type filter(s)
  test_type_key?: string              // test_master_select: test type key
  width?: number
  read_only?: boolean
  restrict_to_screen?: string         // material_select: only offer materials chosen in this screen's table
  restrict_to_table?: string          // material_select: field key of the table on restrict_to_screen
  restrict_to_column?: string         // material_select: row column on that table holding the material id
}

interface TableFieldProps {
  columns: TableColumn[]
  value?: Record<string, unknown>[]
  onChange?: (rows: Record<string, unknown>[]) => void
  disabled?: boolean
  layout?: string                         // 'stacked' = vertical card layout per row
  contextData?: Record<string, unknown>  // current screen's field values (for cross-field lookups)
  dynamicColPrefix?: string              // e.g. "f" — enables Add Column button; extra cols inferred from row keys
  allowRowOps?: boolean                  // keep Add/Delete row available even while `disabled` locks cell editing
  hideRowOps?: boolean                   // force-hide Add/Delete row regardless of `disabled` (fixed row count)
  autoIdPrefix?: string                  // e.g. experiment full_code — used to auto-generate the 'sample_id' column
}

// ── Shared inventory data cache (module-level, avoids re-fetching per instance) ─

let _equipCache: EquipmentCatalogue[] | null = null
let _instrCache: InstrumentCatalogue[] | null = null
let _conTypeCache: ConsumableType[] | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

function lotOptionsFrom(batches: Batch[]): { label: string; value: string }[] {
  const seen = new Set<string>()
  const opts: { label: string; value: string }[] = []
  for (const b of batches) {
    const push = (no: string | null | undefined) => {
      if (!no) return
      const parts = no.split('/')
      const key = parts.length > 1 ? parts.slice(0, -1).join('/') : no
      if (!seen.has(key)) { seen.add(key); opts.push({ label: key, value: key }) }
    }
    if (b.include_pack && b.packs?.length) b.packs.forEach(p => push(p.inhouse_batch_no))
    else push(b.inhouse_batch_no)
  }
  return opts
}

// ── RichTextCell — popover editor for long-form detail columns ────────────────

function RichTextCell({
  value, onChange, disabled, placeholder,
}: {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState('')

  const html = (value as string) ?? ''
  const preview = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(html)
    } else {
      onChange(draft)
    }
    setOpen(next)
  }

  if (disabled) {
    return (
      <div className="text-xs py-0.5">
        <RichDisplay html={html} />
      </div>
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      trigger="click"
      placement="bottomLeft"
      overlayStyle={{ maxWidth: 460 }}
      content={
        <div style={{ width: 420 }}>
          <RichEditor
            value={draft}
            onChange={setDraft}
            placeholder={placeholder || 'Enter details…'}
            minHeight={110}
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="small" onClick={() => { setOpen(false); onChange(draft) }}>Done</Button>
          </div>
        </div>
      }
    >
      <div className="cursor-pointer min-h-[26px] text-xs text-slate-600 hover:bg-violet-50/60 rounded px-1.5 py-1 transition-colors leading-relaxed line-clamp-2">
        {preview
          ? <span>{preview}</span>
          : <span className="text-slate-300 italic">{placeholder || 'Click to edit…'}</span>
        }
      </div>
    </Popover>
  )
}

// ── CellEditor ────────────────────────────────────────────────────────────────

interface CellEditorProps {
  col: TableColumn
  columns: TableColumn[]
  value: unknown
  row: Record<string, unknown>
  disabled?: boolean
  onChange: (v: unknown) => void
  onRowUpdate: (patch: Record<string, unknown>) => void
  // Shared inventory lists (pre-fetched by the parent table)
  equipList: EquipmentCatalogue[]
  instrList: InstrumentCatalogue[]
  conTypeList: ConsumableType[]
  testTypeMap: Record<string, TestType>  // col.test_type_key → TestType
  // Per-row lazy caches
  matCache: Record<number, Material>
  batchCache: Record<number, Batch[]>
  conMatCache: Record<string, Material[]>   // category name → material list
  batchLotCache: Record<string, Batch[]>    // item name → batch list
  mappingCache: Record<number, Mapping[]>   // material_id → mappings
  onLoadMaterial: (matId: number) => void
  onLoadConMats: (categoryName: string, typeId?: number) => void
  onLoadItemLots: (itemName: string) => void
  onLoadMappings: (matId: number) => void
  contextData?: Record<string, unknown>
  stackedMode?: boolean
}

function CellEditor({
  col, columns, value, row, disabled,
  onChange, onRowUpdate,
  equipList, instrList, conTypeList, testTypeMap,
  matCache, batchCache, conMatCache, batchLotCache, mappingCache,
  onLoadMaterial, onLoadConMats, onLoadItemLots, onLoadMappings,
  contextData, stackedMode,
}: CellEditorProps) {
  const isDisabled = disabled || !!col.read_only || col.key === 'sample_id' || col.key === 'sl_no' || col.key === 'sr_no'
  const sz = 'small' as const

  // ── Static types ───────────────────────────────────────────────────────────
  if (col.type === 'number') {
    return (
      <InputNumber
        value={value as number} onChange={onChange}
        disabled={isDisabled} size={sz} style={{ width: '100%' }}
        addonAfter={col.unit || undefined}
      />
    )
  }

  if (col.type === 'date') {
    return (
      <DatePicker
        value={value ? dayjs(value as string) : null}
        onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)}
        disabled={isDisabled} size={sz} style={{ width: '100%' }}
        format="DD MMM YYYY"
      />
    )
  }

  if (col.type === 'select') {
    return (
      <Select
        value={value as string} onChange={onChange}
        disabled={isDisabled} size={sz} style={{ width: '100%' }}
        options={(col.options ?? []).map(o => ({ value: o, label: o }))}
        allowClear placeholder="Select…"
      />
    )
  }

  if (col.type === 'boolean') {
    return <Checkbox checked={!!value} onChange={e => onChange(e.target.checked)} disabled={isDisabled} />
  }

  // ── Material select ────────────────────────────────────────────────────────
  if (col.type === 'material_select') {
    const types = col.material_types
      ? (Array.isArray(col.material_types) ? col.material_types : [col.material_types])
      : []

    // Restrict options to materials chosen in another screen's table (e.g. 3.5 DMSO ← 1.3 rs_chemicals)
    const restrictScreen = col.restrict_to_screen
    const restrictTable  = col.restrict_to_table
    const restrictColumn = col.restrict_to_column ?? 'chemical'
    const fullData = contextData?.__full_data__ as Record<string, Record<string, unknown>> | undefined
    const restrictRows = (restrictScreen && restrictTable)
      ? (fullData?.[restrictScreen]?.[restrictTable] as Record<string, unknown>[] | undefined) ?? []
      : null
    const restrictIdsKey = restrictRows
      ? [...new Set(restrictRows.map(r => Number(r[restrictColumn])).filter(id => id > 0))].join(',')
      : ''

    const [mats, setMats] = useState<Material[]>([])
    useEffect(() => {
      if (restrictRows) {
        const ids = restrictIdsKey ? restrictIdsKey.split(',').map(Number) : []
        if (ids.length === 0) { setMats([]); return }
        Promise.all(ids.map(id => materialApi.get(id).catch(() => null)))
          .then(res => setMats(res.filter((m): m is Material => !!m)))
          .catch(() => {})
        return
      }
      const f = types.length > 0
        ? Promise.all(types.map(t => materialApi.list({ material_type: t, active_only: true, limit: 200 })))
            .then(res => {
              const seen = new Set<number>()
              return res.flat().filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
            })
        : materialApi.list({ active_only: true, limit: 200 }).then(r => Array.isArray(r) ? r : [])
      f.then(setMats).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [col.material_types?.toString(), restrictIdsKey])

    const handleChange = async (matId: number | undefined) => {
      onRowUpdate({ [col.key]: matId ?? '', material_name: '', grade: '', mfg_lot_no: '' })
      if (!matId) return
      try {
        const [mat, batches, mappings] = await Promise.all([
          materialApi.get(matId),
          batchApi.list({ material_id: matId, category: 'available', limit: 50 }),
          mappingApi.list({ material_id: matId }),
        ])
        const first = Array.isArray(mappings) ? mappings[0] : null
        onRowUpdate({
          [col.key]:     matId,
          material_name: mat.name,
          grade:         first?.technical_grade ?? '',
          cas_no:        mat.cas_no ?? '',
          cat_no:        first?.catalogue_no ?? '',
        })
        onLoadMaterial(matId)
      } catch { /* user can fill manually */ }
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder={restrictRows && mats.length === 0 ? `Add reagents in ${restrictScreen === 'mat_reagents' ? '1.3' : restrictScreen} first` : 'Select material…'}
        value={(value as number) ?? undefined}
        options={mats.map(m => ({ value: m.id, label: `${m.name}${m.code ? ` (${m.code})` : ''}` }))}
        onChange={handleChange}
      />
    )
  }

  // ── Batch select (depends on material_id in the same row) ──────────────────
  if (col.type === 'batch_select') {
    const matId = Number(row['material_id'] ?? 0)
    const batches = matId > 0 ? (batchCache[matId] ?? []) : []
    useEffect(() => {
      if (matId > 0) onLoadMaterial(matId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matId])

    const handleChange = (batchNo: string | undefined) => {
      onChange(batchNo ?? '')
      if (!batchNo || !matId) return
      const b = batches.find(x => x.batch_no === batchNo)
      if (!b) return
      const mappings = mappingCache[matId] ?? []
      const mapping = mappings.find(m => m.manufacturer_id === b.manufacturer_id)
      onRowUpdate({ [col.key]: batchNo, mfg_lot_no: batchNo, grade: mapping?.technical_grade ?? '' })
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 140 }}
        disabled={isDisabled || !matId} showSearch allowClear optionFilterProp="label"
        placeholder={matId ? 'Select lot…' : 'Select material first'}
        value={(value as string) || undefined}
        options={batches.map(b => ({ value: b.batch_no, label: b.batch_no }))}
        onChange={handleChange}
      />
    )
  }

  // ── Pack / SKU select (depends on material_id, shows inhouse pack SKUs) ──────
  if (col.type === 'pack_select') {
    const matId = Number(row['material_id'] ?? 0)
    const batches = matId > 0 ? (batchCache[matId] ?? []) : []
    useEffect(() => {
      if (matId > 0) { onLoadMaterial(matId); onLoadMappings(matId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matId])

    // Build SKU options from packs (include_pack=true) or fall back to batch inhouse_batch_no
    const packOpts: { label: string; value: string; manufacturerId?: number }[] = []
    for (const b of batches) {
      if (b.include_pack && b.packs?.length) {
        for (const p of b.packs) {
          if (p.inhouse_batch_no) packOpts.push({ label: p.inhouse_batch_no, value: p.inhouse_batch_no, manufacturerId: b.manufacturer_id ?? undefined })
        }
      } else if (b.inhouse_batch_no) {
        packOpts.push({ label: b.inhouse_batch_no, value: b.inhouse_batch_no, manufacturerId: b.manufacturer_id ?? undefined })
      }
    }

    const handleChange = (sku: string | undefined) => {
      onRowUpdate({ [col.key]: sku ?? '' })
      if (!sku || !matId) return
      const opt = packOpts.find(o => o.value === sku)
      if (!opt?.manufacturerId) return
      const mappings = mappingCache[matId] ?? []
      const mapping = mappings.find(m => m.manufacturer_id === opt.manufacturerId)
      if (mapping?.technical_grade) onRowUpdate({ [col.key]: sku, grade: mapping.technical_grade })
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 160 }}
        disabled={isDisabled || !matId} showSearch allowClear optionFilterProp="label"
        placeholder={matId ? (packOpts.length ? 'Select SKU…' : 'No packs found') : 'Select material first'}
        value={(value as string) || undefined}
        options={packOpts.map(o => ({ value: o.value, label: o.label }))}
        onChange={handleChange}
      />
    )
  }

  // ── Equipment select ───────────────────────────────────────────────────────
  if (col.type === 'equipment_select') {
    const handleChange = (id: string | undefined) => {
      const eq = equipList.find(e => String(e.id) === id)
      onRowUpdate({
        [col.key]:         id ?? '',
        equipment_id:      eq?.asset_id ?? '',
        last_pv_date:      eq?.last_maintenance_date ?? '',
        pv_due:            eq?.next_maintenance_date ?? '',
      })
    }
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 200 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder="Select equipment…"
        value={(value as string) || undefined}
        options={equipList.map(e => ({ value: String(e.id), label: `${e.name}${e.asset_id ? ` [${e.asset_id}]` : ''}` }))}
        onChange={handleChange}
      />
    )
  }

  // ── Instrument select ──────────────────────────────────────────────────────
  if (col.type === 'instrument_select') {
    const handleChange = (id: string | undefined) => {
      const instr = instrList.find(i => String(i.id) === id)
      onRowUpdate({
        [col.key]:          id ?? '',
        instrument_id:      instr?.asset_id ?? '',
        calibration_status: instr?.calibration_status ?? '',
        calibration_due:    instr?.next_calibration_date ?? '',
      })
    }
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 200 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder="Select instrument…"
        value={(value as string) || undefined}
        options={instrList.map(i => ({ value: String(i.id), label: `${i.name}${i.asset_id ? ` [${i.asset_id}]` : ''}` }))}
        onChange={handleChange}
      />
    )
  }

  // ── Consumable type select ─────────────────────────────────────────────────
  if (col.type === 'consumable_type_select') {
    const handleChange = (categoryName: string | undefined) => {
      onRowUpdate({
        [col.key]: categoryName ?? '',
        item_description: '', make_brand: '', cat_no: '', lot_no: '',
      })
      if (categoryName) {
        const ct = conTypeList.find(t => t.name === categoryName)
        onLoadConMats(categoryName, ct?.id)
      }
    }
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 150 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder="Select category…"
        value={(value as string) || undefined}
        options={conTypeList.map(ct => ({ value: ct.name, label: ct.name }))}
        onChange={handleChange}
      />
    )
  }

  // ── Consumable item select (depends on category in same row) ───────────────
  if (col.type === 'consumable_item_select') {
    const category = String(row['category'] ?? row[col.key.replace('item_description', 'category')] ?? '')
    const mats = category ? (conMatCache[category] ?? []) : []
    useEffect(() => {
      if (category) {
        const ct = conTypeList.find(t => t.name === category)
        onLoadConMats(category, ct?.id)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category])

    const handleChange = async (matName: string | undefined) => {
      onRowUpdate({ [col.key]: matName ?? '', make_brand: '', cat_no: '', lot_no: '' })
      if (!matName) return
      const mat = mats.find(m => m.name === matName)
      if (!mat) return
      try {
        const [mappings, batches] = await Promise.all([
          mappingApi.list({ material_id: mat.id }),
          batchApi.list({ material_id: mat.id, category: 'available', limit: 50 }),
        ])
        onLoadItemLots(matName)
        const batchList = Array.isArray(batches) ? batches : []
        const firstMap = Array.isArray(mappings) ? mappings[0] : null
        const firstLot = lotOptionsFrom(batchList)[0]

        // Manufacturer/make: prefer the mapping's manufacturer, else fall back
        // to the first available batch's manufacturer (mirrors chemical_select).
        const manufacturerId = firstMap?.manufacturer_id ?? batchList[0]?.manufacturer_id ?? null
        let makeName = ''
        if (manufacturerId) {
          try {
            const mfr = await manufacturerApi.get(manufacturerId)
            makeName = mfr.name ?? ''
          } catch { /* leave blank */ }
        }

        onRowUpdate({
          [col.key]: matName,
          make_brand: makeName,
          cat_no:     firstMap?.catalogue_no ?? '',
          lot_no:     firstLot?.value ?? '',
        })
      } catch { /* user can fill manually */ }
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled || !category} showSearch allowClear optionFilterProp="label"
        placeholder={category ? 'Select item…' : 'Select category first'}
        value={(value as string) || undefined}
        options={mats.map(m => ({ value: m.name, label: m.name }))}
        onChange={handleChange}
      />
    )
  }

  // ── Consumable lot select (depends on item_description in same row) ─────────
  if (col.type === 'consumable_lot_select') {
    const itemName = String(row['item_description'] ?? '')
    const batches = itemName ? (batchLotCache[itemName] ?? []) : []
    const lotOpts = lotOptionsFrom(batches)
    useEffect(() => {
      if (itemName) onLoadItemLots(itemName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemName])
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 160 }}
        disabled={isDisabled || !itemName} showSearch allowClear optionFilterProp="label"
        placeholder={!itemName ? 'Select item first' : lotOpts.length ? 'Select lot…' : 'No batches'}
        value={(value as string) || undefined}
        options={lotOpts}
        onChange={v => onChange(v ?? '')}
      />
    )
  }

  // ── Consumable filter select (reads from 1.4 con_consumables in contextData) ─
  if (col.type === 'consumable_filter_select') {
    const fullData = contextData?.__full_data__ as Record<string, Record<string, unknown>> | undefined
    const conRows = (fullData?.['mat_consumables']?.['con_consumables'] as Record<string, unknown>[] | undefined) ?? []

    // Build options: one entry per unique item_description with its lot info
    const filterOpts = conRows
      .filter(r => r['item_description'])
      .map(r => ({
        value:    String(r['item_description']),
        label:    String(r['item_description']),
        lot_no:   String(r['lot_no'] ?? ''),
      }))
    // Deduplicate by value, keeping first lot
    const seen = new Set<string>()
    const dedupedOpts = filterOpts.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true })

    const handleFilterChange = (itemDesc: string | undefined) => {
      if (!itemDesc) { onRowUpdate({ [col.key]: '' }); return }
      const match = filterOpts.find(o => o.value === itemDesc)
      onRowUpdate({ [col.key]: itemDesc, filter_lot: match?.lot_no ?? '' })
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder={dedupedOpts.length ? 'Select filter…' : 'Add consumables in 1.4 first'}
        value={(value as string) || undefined}
        options={dedupedOpts}
        onChange={handleFilterChange}
      />
    )
  }

  // ── Chemical select (material_select for rs_chemicals, auto-fills SDS cols) ─
  if (col.type === 'chemical_select') {
    const types = ['Reagents and Salts', 'Chemical & Solvents']
    const [mats, setMats] = useState<Material[]>([])
    useEffect(() => {
      Promise.all(types.map(t => materialApi.list({ material_type: t, active_only: true, limit: 200 })))
        .then(results => {
          const seen = new Set<number>()
          setMats(results.flat().filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true }))
        })
        .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleChange = async (matId: number | undefined) => {
      onRowUpdate({ [col.key]: matId ? String(matId) : '', make: '', cat_no: '', cas_no: '' })
      if (!matId) return
      try {
        const [mat, mappings] = await Promise.all([
          materialApi.get(matId),
          mappingApi.list({ material_id: matId }),
        ])
        const first = Array.isArray(mappings) ? mappings[0] : null
        let makeName = ''
        if (first?.manufacturer_id) {
          const mfr = await manufacturerApi.get(first.manufacturer_id)
          makeName = mfr.name ?? ''
        }
        onRowUpdate({
          [col.key]: String(matId),
          make: makeName,
          cat_no: first?.catalogue_no ?? '',
          cas_no: mat.cas_no ?? '',
        })
        onLoadMappings(matId)
      } catch { /* user can fill manually */ }
    }

    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder="Select chemical…"
        value={value ? Number(value) || undefined : undefined}
        options={mats.map(m => ({ value: m.id, label: `${m.name}${m.cas_no ? ` (${m.cas_no})` : ''}` }))}
        onChange={handleChange}
      />
    )
  }

  // ── SDS from mapping (shows link if DSD on file, else status picker) ───────
  if (col.type === 'sds_from_mapping') {
    const matId = Number(row['chemical'] ?? 0)
    const mappings = matId > 0 ? (mappingCache[matId] ?? null) : []
    useEffect(() => {
      if (matId > 0) onLoadMappings(matId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matId])

    if (!matId) return <EmptyValue />
    if (mappings === null) return <span className="text-slate-400 text-xs">…</span>
    const sdsMapping = mappings.find(m => m.dsd_file_path)
    if (sdsMapping) {
      return (
        <a
          href={`/api/inventory/mappings/${sdsMapping.id}/dsd/download`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-emerald-600 text-xs font-medium"
        >
          <CheckCircle size={11} />
          SDS
          <ExternalLink size={10} />
        </a>
      )
    }
    return (
      <Select
        size={sz} style={{ width: '100%' }} disabled={isDisabled}
        value={(value as string) || undefined} placeholder="SDS status…" allowClear
        options={[{ label: 'Pending', value: 'Pending' }, { label: 'N/A', value: 'N/A' }]}
        onChange={v => onChange(v ?? '')}
      />
    )
  }

  // ── Test master select ─────────────────────────────────────────────────────
  if (col.type === 'test_master_select') {
    const tt = col.test_type_key ? testTypeMap[col.test_type_key] : undefined
    const names = (tt?.names ?? []).map(n => ({ value: n.name, label: n.name }))
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled} showSearch allowClear optionFilterProp="label"
        placeholder="Select test…"
        value={(value as string) || undefined}
        options={names}
        onChange={v => onChange(v ?? '')}
      />
    )
  }

  // ── Test method select (depends on test name in same row) ──────────────────
  if (col.type === 'test_method_select') {
    // Find the sibling test_master_select column to get the selected test name and test_type_key
    const testMasterCol = columns.find(c => c.type === 'test_master_select')
    const selectedTestName = testMasterCol ? String(row[testMasterCol.key] ?? '') : ''
    const testTypeKey = testMasterCol?.test_type_key ?? col.test_type_key
    const tt = testTypeKey ? testTypeMap[testTypeKey] : undefined
    const matchedName = (tt?.names ?? []).find(n => n.name === selectedTestName)
    const methods = (matchedName?.methods ?? []).map(m => ({ value: m.method_name, label: m.method_name }))
    return (
      <Select
        size={sz} style={{ width: '100%', minWidth: 180 }}
        disabled={isDisabled || !selectedTestName} showSearch allowClear optionFilterProp="label"
        placeholder={selectedTestName ? 'Select method…' : 'Select test first'}
        value={(value as string) || undefined}
        options={methods}
        onChange={v => onChange(v ?? '')}
      />
    )
  }

  // ── Rich text ──────────────────────────────────────────────────────────────
  if (col.type === 'rich_text') {
    if (stackedMode) {
      // Inline editor — no popover, renders directly in the stacked card
      return (
        <RichEditor
          value={(value as string) ?? ''}
          onChange={v => onChange(v)}
          placeholder={col.label}
          minHeight={90}
          readOnly={isDisabled}
        />
      )
    }
    return (
      <RichTextCell
        value={value}
        onChange={onChange}
        disabled={isDisabled}
        placeholder={col.label}
      />
    )
  }

  // ── Default: text input ────────────────────────────────────────────────────
  return (
    <Input
      value={value as string ?? ''} onChange={e => onChange(e.target.value)}
      disabled={isDisabled} size={sz} placeholder={col.label}
      addonAfter={col.unit || undefined}
    />
  )
}

// ── TableField ────────────────────────────────────────────────────────────────

export default function TableField({ columns, value = [], onChange, disabled, layout, contextData, dynamicColPrefix, allowRowOps, hideRowOps, autoIdPrefix }: TableFieldProps) {
  // `value` can arrive as '' (the generic empty-field default upstream) instead of
  // [] before any row has ever been added — guard so a stray '' doesn't crash
  // every array operation below (.forEach/.map/.length all behave differently on a string).
  const rows = Array.isArray(value) ? value : []
  const hasSampleIdCol = columns.some(c => c.key === 'sample_id')
  // Cells stay locked by `disabled`, but Add/Delete Row can remain available
  // (e.g. the auto-filled Batch Information table: cells are never hand-edited,
  // but users still need to remove/restore rows).
  const rowOpsEnabled = !hideRowOps && (!disabled || !!allowRowOps)

  // ── Dynamic extra columns (derived from row keys matching the prefix) ─────
  const extraCols: TableColumn[] = (() => {
    if (!dynamicColPrefix) return []
    const staticKeys = new Set(columns.map(c => c.key))
    const pattern = new RegExp(`^${dynamicColPrefix}(\\d+)$`, 'i')
    const dynKeys = new Set<string>()
    rows.forEach(row => Object.keys(row).forEach(k => { if (!staticKeys.has(k) && pattern.test(k)) dynKeys.add(k) }))
    return Array.from(dynKeys)
      .sort((a, b) => parseInt(a.replace(new RegExp(`^${dynamicColPrefix}`, 'i'), '')) - parseInt(b.replace(new RegExp(`^${dynamicColPrefix}`, 'i'), '')))
      .map(k => ({ key: k, label: k.toUpperCase(), type: 'text', width: 80 }))
  })()
  const allColumns = dynamicColPrefix ? [...columns, ...extraCols] : columns

  // ── Shared inventory lists ─────────────────────────────────────────────────
  const [equipList,   setEquipList]   = useState<EquipmentCatalogue[]>(_equipCache ?? [])
  const [instrList,   setInstrList]   = useState<InstrumentCatalogue[]>(_instrCache ?? [])
  const [conTypeList, setConTypeList] = useState<ConsumableType[]>(_conTypeCache ?? [])
  const [testTypeMap, setTestTypeMap] = useState<Record<string, TestType>>({})

  const hasEquip   = columns.some(c => c.type === 'equipment_select')
  const hasInstr   = columns.some(c => c.type === 'instrument_select')
  const hasConType = columns.some(c => ['consumable_type_select', 'consumable_item_select', 'consumable_lot_select'].includes(c.type))

  useEffect(() => {
    if (hasEquip && !_equipCache) {
      equipmentCatalogueApi.list({ active_only: true, limit: 200 })
        .then(r => { _equipCache = Array.isArray(r) ? r : []; setEquipList(_equipCache) })
        .catch(() => {})
    }
  }, [hasEquip])

  useEffect(() => {
    if (hasInstr && !_instrCache) {
      instrumentCatalogueApi.list({ active_only: true, limit: 200 })
        .then(r => { _instrCache = Array.isArray(r) ? r : []; setInstrList(_instrCache) })
        .catch(() => {})
    }
  }, [hasInstr])

  useEffect(() => {
    if (hasConType && !_conTypeCache) {
      consumableTypeApi.list()
        .then(r => { _conTypeCache = Array.isArray(r) ? r : []; setConTypeList(_conTypeCache) })
        .catch(() => {})
    }
  }, [hasConType])

  useEffect(() => {
    const keys = columns.filter(c => c.test_type_key && (c.type === 'test_master_select' || c.type === 'test_method_select')).map(c => c.test_type_key!)
    const unique = [...new Set(keys)].filter(k => !testTypeMap[k])
    if (unique.length === 0) return
    unique.forEach(key => {
      testMasterApi.get(key)
        .then(tt => setTestTypeMap(prev => ({ ...prev, [key]: tt })))
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  // ── Per-row lazy caches ────────────────────────────────────────────────────
  const [matCache,    setMatCache]    = useState<Record<number, Material>>({})
  const [batchCache,  setBatchCache]  = useState<Record<number, Batch[]>>({})
  const [mappingCache, setMappingCache] = useState<Record<number, Mapping[]>>({})
  const [conMatCache,  setConMatCache]  = useState<Record<string, Material[]>>({})
  const [batchLotCache, setBatchLotCache] = useState<Record<string, Batch[]>>({})

  const fetchedMat  = useRef<Set<number>>(new Set())
  const fetchedConMat = useRef<Set<string>>(new Set())
  const fetchedLot  = useRef<Set<string>>(new Set())
  const fetchedMap  = useRef<Set<number>>(new Set())

  const handleLoadMaterial = (matId: number) => {
    if (!matId || fetchedMat.current.has(matId)) return
    fetchedMat.current.add(matId)
    Promise.all([
      materialApi.get(matId),
      batchApi.list({ material_id: matId, category: 'available', limit: 100 }),
      mappingApi.list({ material_id: matId }),
    ]).then(([mat, batches, mappings]) => {
      setMatCache(prev => ({ ...prev, [matId]: mat }))
      setBatchCache(prev => ({ ...prev, [matId]: Array.isArray(batches) ? batches : [] }))
      setMappingCache(prev => ({ ...prev, [matId]: Array.isArray(mappings) ? mappings : [] }))
      fetchedMap.current.add(matId)
    }).catch(() => fetchedMat.current.delete(matId))
  }

  const handleLoadConMats = (categoryName: string, typeId?: number) => {
    if (!categoryName || fetchedConMat.current.has(categoryName)) return
    fetchedConMat.current.add(categoryName)
    materialApi.list({ active_only: true, material_type: 'Consumables', consumable_type_id: typeId, limit: 200 })
      .then(mats => setConMatCache(prev => ({ ...prev, [categoryName]: Array.isArray(mats) ? mats : [] })))
      .catch(() => fetchedConMat.current.delete(categoryName))
  }

  const handleLoadItemLots = (itemName: string) => {
    if (!itemName || fetchedLot.current.has(itemName)) return
    fetchedLot.current.add(itemName)
    materialApi.list({ active_only: true, search: itemName, limit: 20 })
      .then(mats => {
        const mat = (Array.isArray(mats) ? mats : []).find(m => m.name === itemName)
        if (!mat) return
        return batchApi.list({ material_id: mat.id, category: 'available', limit: 100 })
      })
      .then(batches => {
        if (batches) setBatchLotCache(prev => ({ ...prev, [itemName]: Array.isArray(batches) ? batches : [] }))
      })
      .catch(() => fetchedLot.current.delete(itemName))
  }

  const handleLoadMappings = (matId: number) => {
    if (!matId || fetchedMap.current.has(matId)) return
    fetchedMap.current.add(matId)
    mappingApi.list({ material_id: matId })
      .then(mappings => setMappingCache(prev => ({ ...prev, [matId]: Array.isArray(mappings) ? mappings : [] })))
      .catch(() => fetchedMap.current.delete(matId))
  }

  // Pre-load caches for existing rows on mount
  useEffect(() => {
    const hasMat  = columns.some(c => ['material_select', 'batch_select'].includes(c.type))
    const hasChem = columns.some(c => ['chemical_select', 'sds_from_mapping'].includes(c.type))
    const hasCon  = columns.some(c => ['consumable_item_select', 'consumable_lot_select'].includes(c.type))

    rows.forEach(row => {
      if (hasMat) {
        const matId = Number(row['material_id'] ?? 0)
        if (matId > 0) handleLoadMaterial(matId)
      }
      if (hasChem) {
        const matId = Number(row['chemical'] ?? 0)
        if (matId > 0) handleLoadMappings(matId)
      }
      if (hasCon) {
        const cat = String(row['category'] ?? '')
        const item = String(row['item_description'] ?? '')
        if (cat) { const ct = conTypeList.find(t => t.name === cat); handleLoadConMats(cat, ct?.id) }
        if (item) handleLoadItemLots(item)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Row mutations ──────────────────────────────────────────────────────────
  const commit = (newRows: Record<string, unknown>[]) => onChange?.(newRows)

  // Batch Information-style tables (SKU/Pack ID column keyed 'pack_type') are
  // pre-populated with one row per available SKU/Pack ID for the selected
  // material. For these, "Add Row" must not create a blank placeholder row —
  // it should only bring back a SKU that was previously removed. Deleting a
  // row returns its SKU to this pool instead of discarding it.
  const isPackPoolTable = columns.some(c => c.key === 'pack_type')
  const [removedPackRows, setRemovedPackRows] = useState<Record<string, unknown>[]>([])
  const canAddRow = !isPackPoolTable || removedPackRows.length > 0

  // Serial-number column — different screens spell the key differently
  // ('sl_no' vs 'sr_no'), so auto-number whichever one this table has.
  const serialCol = columns.find(c => c.key === 'sl_no' || c.key === 'sr_no')

  const addRow = () => {
    if (isPackPoolTable) {
      if (removedPackRows.length === 0) return
      const [restored, ...rest] = removedPackRows
      setRemovedPackRows(rest)
      const row = serialCol ? { ...restored, [serialCol.key]: String(rows.length + 1) } : restored
      commit([...rows, row])
      return
    }
    const blank: Record<string, unknown> = {}
    allColumns.forEach(c => { blank[c.key] = c.type === 'number' ? null : '' })
    if (serialCol) blank[serialCol.key] = String(rows.length + 1)
    if (hasSampleIdCol && autoIdPrefix) blank['sample_id'] = `${autoIdPrefix}-S${rows.length + 1}`
    commit([...rows, blank])
  }

  const removeRow = (idx: number) => {
    if (isPackPoolTable) setRemovedPackRows(prev => [...prev, rows[idx]])
    commit(rows.filter((_, i) => i !== idx))
  }

  const addColumn = () => {
    if (!dynamicColPrefix) return
    const pattern = new RegExp(`^${dynamicColPrefix}(\\d+)$`, 'i')
    let maxN = 0
    allColumns.forEach(c => { const m = c.key.match(pattern); if (m) maxN = Math.max(maxN, parseInt(m[1])) })
    const newKey = `${dynamicColPrefix.toLowerCase()}${maxN + 1}`
    commit(rows.length > 0 ? rows.map(r => ({ ...r, [newKey]: '' })) : [{ [newKey]: '' }])
  }

  const removeExtraCol = (colKey: string) => {
    commit(rows.map(r => { const nr = { ...r }; delete nr[colKey]; return nr }))
  }

  const updateCell = (rowIdx: number, colKey: string, val: unknown) =>
    commit(rows.map((r, i) => i === rowIdx ? { ...r, [colKey]: val } : r))

  const updateRow = (rowIdx: number, patch: Record<string, unknown>) =>
    commit(rows.map((r, i) => i === rowIdx ? { ...r, ...patch } : r))

  // ── Shared CellEditor props (used by both layouts) ────────────────────────
  const cellProps = (ri: number, col: TableColumn, row: Record<string, unknown>) => ({
    col, columns: allColumns,
    value: row[col.key],
    row,
    disabled,
    onChange: (v: unknown) => updateCell(ri, col.key, v),
    onRowUpdate: (patch: Record<string, unknown>) => updateRow(ri, patch),
    equipList, instrList, conTypeList, testTypeMap,
    matCache, batchCache, conMatCache, batchLotCache, mappingCache,
    onLoadMaterial: handleLoadMaterial,
    onLoadConMats: handleLoadConMats,
    onLoadItemLots: handleLoadItemLots,
    onLoadMappings: handleLoadMappings,
    contextData,
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  if (columns.length === 0) {
    return (
      <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center text-sm text-slate-400">
        No columns defined for this table.
      </div>
    )
  }

  // ── Stacked layout ─────────────────────────────────────────────────────────
  if (layout === 'stacked') {
    // 'details' columns (Process Steps tables) always drop to their own full-width
    // row below the step name, whether they're plain text or a rich_text editor.
    const isFullWidthCol = (c: TableColumn) => c.type === 'rich_text' || c.key === 'details'
    const inlineCols = columns.filter(c => !isFullWidthCol(c))
    const richCols   = columns.filter(isFullWidthCol)

    return (
      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-xs text-slate-400 py-2 text-center">
            No rows yet{rowOpsEnabled && ' — click "Add Row" to start'}
          </p>
        )}
        {rows.map((row, ri) => (
          <div key={ri} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {/* ── Top row: non-rich columns + delete ── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
              {inlineCols.map(col => (
                <div key={col.key} className="flex-1 min-w-0">
                  <CellEditor {...cellProps(ri, col, row)} stackedMode />
                </div>
              ))}
              {rowOpsEnabled && (
                <button
                  onClick={() => removeRow(ri)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded ml-1"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            {/* ── Rich text rows ── */}
            {richCols.map(col => (
              <div key={col.key} className="px-3 py-2">
                <CellEditor {...cellProps(ri, col, row)} stackedMode />
              </div>
            ))}
          </div>
        ))}
        {rowOpsEnabled && canAddRow && (
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 border border-dashed border-slate-300 hover:border-violet-400 rounded-lg px-3 py-2 w-full justify-center transition-colors"
          >
            <Plus size={12} /> Add Row
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {allColumns.map(col => {
                const isDynamic = dynamicColPrefix && extraCols.some(e => e.key === col.key)
                return (
                  <th
                    key={col.key}
                    className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap"
                    style={col.width ? { width: col.width } : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.required && <span className="text-red-500 ml-0.5">*</span>}
                      {col.unit && <span className="text-slate-400 font-normal ml-1">({col.unit})</span>}
                      {isDynamic && !disabled && (
                        <button
                          onClick={() => removeExtraCol(col.key)}
                          className="ml-0.5 text-slate-300 hover:text-red-500 transition-colors"
                          title={`Remove column ${col.label}`}
                        >
                          <Trash2 size={9} />
                        </button>
                      )}
                    </span>
                  </th>
                )
              })}
              {rowOpsEnabled && (
                <th className="px-2 py-2 border-b border-slate-200 w-7">
                  {dynamicColPrefix && !disabled && (
                    <button
                      onClick={addColumn}
                      className="flex items-center gap-0.5 text-[10px] font-semibold text-violet-500 hover:text-violet-700 whitespace-nowrap transition-colors"
                      title="Add column"
                    >
                      <Plus size={10} /> Col
                    </button>
                  )}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={allColumns.length + (disabled ? 0 : 1)}
                  className="px-3 py-4 text-center text-slate-400 text-xs"
                >
                  No rows yet{rowOpsEnabled && ' — click "Add Row" to start'}
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                  {allColumns.map(col => (
                    <td key={col.key} className="px-1.5 py-1 align-middle">
                      <CellEditor
                        col={col}
                        columns={columns}
                        value={row[col.key]}
                        row={row}
                        disabled={disabled}
                        onChange={v => updateCell(ri, col.key, v)}
                        onRowUpdate={patch => updateRow(ri, patch)}
                        equipList={equipList}
                        instrList={instrList}
                        conTypeList={conTypeList}
                        testTypeMap={testTypeMap}
                        matCache={matCache}
                        batchCache={batchCache}
                        conMatCache={conMatCache}
                        batchLotCache={batchLotCache}
                        mappingCache={mappingCache}
                        onLoadMaterial={handleLoadMaterial}
                        onLoadConMats={handleLoadConMats}
                        onLoadItemLots={handleLoadItemLots}
                        onLoadMappings={handleLoadMappings}
                        contextData={contextData}
                      />
                    </td>
                  ))}
                  {rowOpsEnabled && (
                    <td className="px-1.5 py-1 align-middle">
                      <button
                        onClick={() => removeRow(ri)}
                        className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rowOpsEnabled && (
        <Button
          size="small" style={BTN_32} icon={<Plus size={12} />}
          onClick={addRow} className="text-xs"
          disabled={!canAddRow}
          title={!canAddRow && isPackPoolTable ? 'All available SKU/Pack IDs are already assigned' : undefined}
        >
          Add Row
        </Button>
      )}
    </div>
  )
}
