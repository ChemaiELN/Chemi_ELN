import { useState } from 'react'
import { Modal, Tooltip, Button } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { glassModalProps } from '../../../utils/modalStyles'
import FieldPreview from './FieldPreview'
import { applyAutoFill, resolveMappingAutoFills } from './useInventoryOptions'
import { INVENTORY_SOURCES, type InventorySourceKey } from './inventorySources'
import type { TemplateDefinition, TemplateField, TemplateScreen, TemplateSection } from './types'

// A screen whose title ends with "(table)" is a repeatable data table at
// runtime (its fields are the table's columns). Match that here so the preview
// looks like the scientist runtime, not a flat field form.
const isTableScreen = (screen: TemplateScreen) => /\(table\)\s*$/i.test(screen.title.trim())

// A screen titled "… (entry table)" is a repeatable single-record card rendered
// transposed — fields listed vertically as PARAMETER | ENTRY rows, "Add …" adds
// another card (e.g. pH Probe 1, pH Probe 2). Used for probe calibration blocks.
const isEntryTableScreen = (screen: TemplateScreen) => /\(entry\s+table\)\s*$/i.test(screen.title.trim())

// A screen titled "… (expandable table)" has fixed left columns (from screen.fields)
// plus user-addable Fn formulation columns at runtime.
const isExpandableTableScreen = (screen: TemplateScreen) => /\(expandable\s+table(?:\s+[A-Z])?\)\s*$/i.test(screen.title.trim())
const expandableColPrefix = (screen: TemplateScreen): string => {
  const m = screen.title.match(/\(expandable\s+table(?:\s+([A-Z]))?\)/i)
  return (m?.[1] ?? 'f').toLowerCase()
}
// Drop the trailing table-type marker from a screen title for display.
const cleanTitle = (title: string) => title.replace(/\s*\((?:entry\s+|expandable\s+(?:[A-Z]\s+)?)?table\)\s*$/i, '').trim()

// Group consecutive sections that share a `phase` into one block, preserving
// order. Sections without a phase form their own single-section groups.
function groupByPhase(sections: TemplateSection[]): { phase?: string; sections: TemplateSection[] }[] {
  const groups: { phase?: string; sections: TemplateSection[] }[] = []
  for (const s of sections) {
    const last = groups[groups.length - 1]
    if (last && last.phase === s.phase && s.phase !== undefined) last.sections.push(s)
    else groups.push({ phase: s.phase, sections: [s] })
  }
  return groups
}

// Data shape mirrors the real runtime (CgtSectionPage.tsx): one value map per
// section, keyed by screen id — a plain-field screen's own field map, or a
// table screen's array of rows. Lifted to the section so a driver dropdown on
// one screen (e.g. a material) can filter/fill a dependent on ANOTHER screen
// (e.g. a batch table), exactly like the live experiment form.
type ScreenData = Record<string, unknown> | Record<string, unknown>[]

function SectionCard({ section }: { section: TemplateSection }) {
  const [data, setData] = useState<Record<string, ScreenData>>({})

  const setScreenData = (screenId: string, next: ScreenData) =>
    setData(prev => ({ ...prev, [screenId]: next }))

  // Flattened values of every plain (non-table) screen's fields in this
  // section — for cross-screen inventorySource.filterByField lookups.
  const sectionFieldValues: Record<string, unknown> = {}
  for (const scr of section.screens) {
    if (isTableScreen(scr) || isEntryTableScreen(scr) || isExpandableTableScreen(scr)) continue
    Object.assign(sectionFieldValues, (data[scr.id] as Record<string, unknown>) ?? {})
  }

  // When `changedName` (a driver field on `changedScreenId`) gets a new value,
  // clear any dependent field defined on ANOTHER screen that filters by it.
  const cascadeClearCrossScreenDependents = (changedScreenId: string, changedName: string) => {
    for (const otherScreen of section.screens) {
      if (otherScreen.id === changedScreenId) continue
      const dependentCols = otherScreen.fields.filter(f => f.inventorySource?.filterByField === changedName)
      if (dependentCols.length === 0) continue
      const clearPatchFor = () => {
        const patch: Record<string, unknown> = {}
        for (const col of dependentCols) {
          patch[col.name] = ''
          for (const dep of otherScreen.fields) {
            if (dep.autoFill?.sourceFieldName === col.name) patch[dep.name] = ''
          }
        }
        return patch
      }
      if (isTableScreen(otherScreen) || isEntryTableScreen(otherScreen) || isExpandableTableScreen(otherScreen)) {
        const rows = (data[otherScreen.id] as Record<string, unknown>[]) ?? []
        if (rows.length === 0) continue
        setScreenData(otherScreen.id, rows.map(r => ({ ...r, ...clearPatchFor() })))
      } else {
        const vals = (data[otherScreen.id] as Record<string, unknown>) ?? {}
        setScreenData(otherScreen.id, { ...vals, ...clearPatchFor() })
      }
    }
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">{section.title}</p>
      <div className="space-y-4">
        {section.screens.map(screen => (
          <div key={screen.id}>
            <p className="text-[13px] font-semibold text-slate-500 mb-2">{cleanTitle(screen.title)}</p>
            {isExpandableTableScreen(screen) ? (
              <ExpandableTableScreenPreview screen={screen} colPrefix={expandableColPrefix(screen)} />
            ) : isEntryTableScreen(screen) ? (
              <EntryTableScreenPreview screen={screen} />
            ) : isTableScreen(screen) ? (
              <TableScreenPreview
                screen={screen}
                rows={(data[screen.id] as Record<string, unknown>[]) ?? []}
                onChange={rows => setScreenData(screen.id, rows)}
                externalValues={sectionFieldValues}
                onDriverChange={name => cascadeClearCrossScreenDependents(screen.id, name)}
              />
            ) : (
              <ScreenFieldsPreview
                screen={screen}
                values={(data[screen.id] as Record<string, unknown>) ?? {}}
                onChange={vals => setScreenData(screen.id, vals)}
                sectionFieldValues={sectionFieldValues}
                onDriverChange={name => cascadeClearCrossScreenDependents(screen.id, name)}
              />
            )}
          </div>
        ))}
        {section.screens.length === 0 && <p className="text-xs text-slate-300">No screens in this section.</p>}
      </div>
    </div>
  )
}

// Flat (non-table) screen: fields are controlled and wired through the same
// applyAutoFill / resolveMappingAutoFills used by the real CGT runtime form
// (CgtSectionPage.tsx), so picking a driver dropdown here actually copies
// into its dependent fields — same as scientists see, not a static mock.
function ScreenFieldsPreview({ screen, values, onChange, sectionFieldValues, onDriverChange }: {
  screen: TemplateScreen
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  sectionFieldValues: Record<string, unknown>
  onDriverChange: (fieldName: string) => void
}) {
  const qc = useQueryClient()

  const resolveFilterValue = (filterByField: string | undefined): unknown => {
    if (!filterByField) return undefined
    if (Object.prototype.hasOwnProperty.call(values, filterByField)) return values[filterByField]
    return sectionFieldValues[filterByField]
  }

  const handleChange = (field: TemplateField, v: unknown) => {
    let merged = applyAutoFill(qc, screen.fields, field, v, { ...values, [field.name]: v })
    // Same-screen cascading dropdowns filtered by this field go stale — clear them.
    for (const f of screen.fields) {
      if (f.inventorySource?.filterByField === field.name) merged = { ...merged, [f.name]: '' }
    }
    onChange(merged)
    void resolveMappingAutoFills(qc, screen.fields, field, merged,
      patch => onChange({ ...merged, ...patch }))
    onDriverChange(field.name)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: screen.columns === 2 ? '1fr 1fr' : '1fr', gap: '14px' }}>
      {screen.fields.map(field => (
        <div key={field.id} style={{ gridColumn: field.colSpan === 2 ? 'span 2' : undefined }}>
          <FieldPreview
            field={field}
            interactive
            value={values[field.name]}
            onChange={v => handleChange(field, v)}
            filterValue={resolveFilterValue(field.inventorySource?.filterByField)}
          />
        </div>
      ))}
      {screen.fields.length === 0 && <p className="text-xs text-slate-300 col-span-full">No fields.</p>}
    </div>
  )
}

// Repeatable table: real controlled rows (add/remove), wired through the same
// applyAutoFill used elsewhere so picking a row's driver dropdown fills its
// dependent columns, matching the live experiment runtime (CgtTableField.tsx).
function TableScreenPreview({ screen, rows, onChange, externalValues, onDriverChange }: {
  screen: TemplateScreen
  rows: Record<string, unknown>[]
  onChange: (rows: Record<string, unknown>[]) => void
  externalValues: Record<string, unknown>
  onDriverChange: (fieldName: string) => void
}) {
  const qc = useQueryClient()
  const cols = screen.fields.filter(f => f.type !== 'SECTION_HEADING' && f.type !== 'SPACER')

  const resolveFilterValue = (row: Record<string, unknown>, filterByField: string | undefined): unknown => {
    if (!filterByField) return undefined
    if (Object.prototype.hasOwnProperty.call(row, filterByField)) return row[filterByField]
    return externalValues[filterByField]
  }

  // Columns backed by a "unique physical item" source (e.g. Batches) — the
  // same pack can't sensibly be picked in two rows, and once every available
  // one is already used, adding another row would have nothing left to offer.
  // Excludes columns filtered by ANOTHER column of this same table (e.g. 1.3
  // Reagents & Salts' per-row Chemical -> Lot No) — see CgtTableField.tsx for
  // why a single shared "total" is wrong once the filter driver varies per row.
  const uniqueCols = cols.filter(c => {
    const src = c.inventorySource?.source as InventorySourceKey | undefined
    const isRowLevelDriver = cols.some(other => other.name === c.inventorySource?.filterByField)
    return c.optionsMode === 'inventory' && !!src && !!INVENTORY_SOURCES[src]?.filterByMaterial && !isRowLevelDriver
  })
  const [totalOptionsByCol, setTotalOptionsByCol] = useState<Record<string, number | undefined>>({})
  const usedValuesFor = (colName: string, excludeIdx?: number) =>
    rows
      .filter((_, i) => i !== excludeIdx)
      .map(r => r[colName])
      .filter(v => v != null && v !== '')
  const allOptionsExhausted = uniqueCols.some(c => {
    const total = totalOptionsByCol[c.name]
    return total !== undefined && usedValuesFor(c.name).length >= total
  })

  const addRow = () => onChange([...rows, {}])
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

  const updateCell = (idx: number, name: string, v: unknown) => {
    const changed = cols.find(c => c.name === name)
    let merged = changed
      ? applyAutoFill(qc, cols, changed, v, { ...rows[idx], [name]: v })
      : { ...rows[idx], [name]: v }
    for (const c of cols) {
      if (c.inventorySource?.filterByField === name) merged = { ...merged, [c.name]: '' }
    }
    const nextRows = rows.map((r, i) => (i === idx ? merged : r))
    onChange(nextRows)
    if (changed) {
      void resolveMappingAutoFills(qc, cols, changed, merged,
        patch => onChange(nextRows.map((r, i) => (i === idx ? { ...r, ...patch } : r))))
    }
    onDriverChange(name)
  }

  if (cols.length === 0) return <p className="text-xs text-slate-300">No columns.</p>
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-8">#</th>
              {cols.map(col => (
                <th key={col.id} className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  {col.label}
                  {col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
              <th className="w-8 border-b border-slate-200" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 2} className="px-3 py-4 text-center text-slate-400 text-xs">No rows yet.</td>
              </tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 align-middle text-slate-400">{ri + 1}</td>
                {cols.map(col => (
                  <td key={col.id} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 140 }}>
                    <FieldPreview
                      field={col} bare interactive
                      value={row[col.name]}
                      onChange={v => updateCell(ri, col.name, v)}
                      filterValue={resolveFilterValue(row, col.inventorySource?.filterByField)}
                      excludeValues={uniqueCols.includes(col) ? usedValuesFor(col.name, ri) : undefined}
                      onTotalCount={n => setTotalOptionsByCol(prev => (prev[col.name] === n ? prev : { ...prev, [col.name]: n }))}
                    />
                  </td>
                ))}
                <td className="px-1.5 py-1.5 align-middle">
                  <button onClick={() => removeRow(ri)} className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Tooltip title={allOptionsExhausted ? 'Every available option has already been used in a row above.' : undefined}>
        <button
          type="button"
          onClick={addRow}
          disabled={allOptionsExhausted}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 border border-dashed border-slate-300 rounded-md px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-500"
        >
          <Plus size={12} /> Add row
        </button>
      </Tooltip>
    </div>
  )
}

// Expandable-column table: fixed left columns (from screen.fields) + user-addable
// Fn formulation columns. Interactive in the preview — rows can be added/deleted,
// columns can be added/removed, and fixed-column cells are fully editable.
function ExpandableTableScreenPreview({ screen, colPrefix = 'f' }: { screen: TemplateScreen; colPrefix?: string }) {
  const fixedCols = screen.fields.filter(f => f.type !== 'SECTION_HEADING' && f.type !== 'SPACER')
  const [colCount, setColCount] = useState(1)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const pfx = colPrefix.toLowerCase()
  const hdr = colPrefix.toUpperCase()

  const dynKeys = Array.from({ length: colCount }, (_, i) => `${pfx}${i + 1}`)

  const addRow = () => setRows(r => [...r, {}])
  const removeRow = (idx: number) => setRows(r => r.filter((_, i) => i !== idx))
  const addCol = () => setColCount(n => n + 1)
  const removeCol = () => {
    if (colCount <= 1) return
    const lastKey = `f${colCount}`
    setColCount(n => n - 1)
    setRows(r => r.map(row => { const next = { ...row }; delete next[lastKey]; return next }))
  }
  const updateCell = (ri: number, key: string, v: unknown) =>
    setRows(r => r.map((row, i) => i === ri ? { ...row, [key]: v } : row))

  if (fixedCols.length === 0) return <p className="text-xs text-slate-300">No fixed columns defined.</p>
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-8">#</th>
              {fixedCols.map(col => (
                <th key={col.id} className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  {col.label}{col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
              {dynKeys.map((key, i) => (
                <th key={key} className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap min-w-[90px]">
                  <span className="flex items-center gap-1">
                    {hdr}{i + 1}
                    {i === colCount - 1 && (
                      <button type="button" onClick={removeCol} className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none">×</button>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 border-b border-slate-200">
                <button type="button" onClick={addCol} className="text-[10px] font-bold text-violet-600 hover:text-violet-800 whitespace-nowrap transition-colors">+ Col</button>
              </th>
              <th className="w-8 border-b border-slate-200" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={fixedCols.length + colCount + 3} className="px-3 py-4 text-center text-slate-400 text-xs italic">No rows yet — click "Add Row" to start</td></tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                <td className="px-2 py-1.5 align-middle text-slate-400">{ri + 1}</td>
                {fixedCols.map(col => (
                  <td key={col.id} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 130 }}>
                    <FieldPreview field={col} interactive value={row[col.name]} onChange={v => updateCell(ri, col.name, v)} bare />
                  </td>
                ))}
                {dynKeys.map(key => (
                  <td key={key} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 90 }}>
                    <input type="text" className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-violet-400 bg-white" value={(row[key] as string) ?? ''} onChange={e => updateCell(ri, key, e.target.value)} />
                  </td>
                ))}
                <td className="px-1.5 py-1.5 align-middle">
                  <button onClick={() => removeRow(ri)} className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded"><Trash2 size={11} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="small" icon={<Plus size={12} />} onClick={addRow}>Add Row</Button>
    </div>
  )
}

// Transposed table: one card per record, fields listed vertically as
// PARAMETER | ENTRY rows. Preview shows a single card ("… 1") + an Add button.
function EntryTableScreenPreview({ screen }: { screen: TemplateScreen }) {
  const rows = screen.fields.filter(f => f.type !== 'SECTION_HEADING' && f.type !== 'SPACER')
  if (rows.length === 0) return <p className="text-xs text-slate-300">No parameters.</p>
  const base = cleanTitle(screen.title)
  return (
    <div className="space-y-2">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-3 py-2 bg-indigo-50/60 border-b border-slate-200 text-xs font-semibold text-indigo-700">{base} 1</div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-2/5">Parameter</th>
              <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Entry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(f => (
              <tr key={f.id} className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-1.5 align-middle text-slate-600 whitespace-nowrap">
                  {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                </td>
                <td className="px-1.5 py-1.5 align-middle">
                  <FieldPreview field={f} bare interactive />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 text-xs text-slate-400 border border-dashed border-slate-300 rounded-md px-3 py-1.5"
      >
        <Plus size={12} /> Add {base.toLowerCase()} table
      </button>
    </div>
  )
}

// Renders the template exactly as an end user would see it — respects
// required/readOnly/hidden, shows dropdown values, renders attachments/images.
export default function PreviewModal({ open, onClose, definition, title }: {
  open: boolean
  onClose: () => void
  definition: TemplateDefinition
  title: string
}) {
  return (
    <Modal
      title={`Preview — ${title}`}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      {...glassModalProps}
      width={1100}
    >
      <div className="max-h-[72vh] overflow-y-auto space-y-5 pr-1 -mr-1">
        {definition.sections.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">This template has no sections yet.</p>
        )}
        {groupByPhase(definition.sections).map((group, gi) => (
          group.phase ? (
            <div key={`phase-${gi}`} className="space-y-3">
              <div className="flex items-baseline gap-2 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">{group.phase}</span>
                <span className="text-[11px] text-slate-400">
                  {group.sections.length} screen{group.sections.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-4 pl-3  border-indigo-100">
                {group.sections.map(section => <SectionCard key={section.id} section={section} />)}
              </div>
            </div>
          ) : (
            group.sections.map(section => <SectionCard key={section.id} section={section} />)
          )
        ))}
      </div>
    </Modal>
  )
}
