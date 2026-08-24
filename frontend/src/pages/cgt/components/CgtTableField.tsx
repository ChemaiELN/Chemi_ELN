import { useRef, useState } from 'react'
import { Button, Tooltip } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import type { TemplateField } from '../../admin/templateBuilder/types'
import CgtFieldControl from './CgtFieldControl'
import { applyAutoFill, resolveMappingAutoFills } from '../../admin/templateBuilder/useInventoryOptions'
import { INVENTORY_SOURCES, type InventorySourceKey } from '../../admin/templateBuilder/inventorySources'

// Marks a row as added via a column's `altGroupSource` button (e.g. "Add
// Buffer") rather than the table's normal "Add row" — read only by
// `rowOptionsFor` below to decide which option list that column's dropdown
// shows for this specific row. Not a real template field, never rendered.
const ALT_SOURCE_ROW_FLAG = '__viaAltGroupSource'

// Repeatable table for a `(table)` / `(entry table)` screen — same title
// convention PreviewModal.tsx uses, but here rows are real, controlled data
// (Record<fieldName, value>[]) with working Add/Delete row, for the CGT
// experiment runtime rather than the builder's static preview.
export default function CgtTableField({ columns, value, onChange, variant, disabled, externalValues, onDriverChange, lockedColumns, resolveRowOptions, resolveAltGroupOptions, experimentId }: {
  columns: TemplateField[]
  value: Record<string, unknown>[]
  onChange: (rows: Record<string, unknown>[]) => void
  variant: 'table' | 'entry'
  disabled?: boolean
  // Values of fields defined on OTHER screens in the same section — a column's
  // inventorySource.filterByField may name a driver that isn't itself a column
  // of this table (e.g. a material dropdown on a separate "Identity" screen).
  externalValues?: Record<string, unknown>
  // Notifies the parent when a column acting as a cross-screen filter driver
  // changes, so it can clear any dependent field defined on ANOTHER screen.
  onDriverChange?: (fieldName: string) => void
  // Column names locked read-only by a "mirror rows on lock" rule targeting
  // this table — independent of `disabled`, since the rest of the table (and
  // Add/Delete row) stays usable.
  lockedColumns?: Set<string>
  // Resolves a DROPDOWN column's optionsMode 'screenRows' options — needs the
  // whole run's data (possibly a different section), so the parent resolves
  // it rather than this component fetching anything itself.
  resolveRowOptions?: (field: TemplateField) => { value: string; label: string; row: Record<string, unknown> }[]
  // Resolves a column's `altGroupSource` options (e.g. earlier Buffer names
  // in the same repeating-group instance) — only used for rows added via
  // that column's alt "Add X" button (see ALT_SOURCE_ROW_FLAG below).
  resolveAltGroupOptions?: (field: TemplateField) => { value: string; label: string }[]
  experimentId?: string    // ATTACHMENT/IMAGE columns only — real upload needs the owning experiment
}) {
  const qc = useQueryClient()
  const rows = Array.isArray(value) ? value : []
  // `hidden` fields are excluded from `cols` (the rendered header/cell set)
  // but stay in `columns` (passed to applyAutoFill/resolveMappingAutoFills
  // below), so a hidden field still computes and holds its value — e.g. the
  // Equipment/Instrument Catalogue ID a Usage Log field reads via
  // usageLogConfig.idFieldName, kept out of view without breaking Start/End.
  const cols = columns.filter(c => c.type !== 'SECTION_HEADING' && c.type !== 'SPACER' && !c.hidden)
  const altCol = cols.find(c => c.altGroupSource)

  // Latest rows for async patches — a late mapping fetch merges onto current
  // state, not the snapshot captured when the driver cell changed.
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const addRow = () => onChange([...rows, {}])
  const addAltRow = () => onChange([...rows, { [ALT_SOURCE_ROW_FLAG]: true }])
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const rowOptionsFor = (col: TemplateField, row: Record<string, unknown>) =>
    col.altGroupSource && row[ALT_SOURCE_ROW_FLAG]
      ? resolveAltGroupOptions?.(col)
      : col.optionsMode === 'screenRows' ? resolveRowOptions?.(col) : undefined
  const patchRow = (idx: number, patch: Record<string, unknown>) =>
    onChange(rowsRef.current.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  // Columns backed by a "unique physical item" source (e.g. Batches) — the
  // same pack can't sensibly be picked in two rows, and once every available
  // one is already used, adding another row would have nothing left to offer.
  // Excludes columns filtered by ANOTHER column of this same table (e.g. 1.3
  // Reagents & Salts' per-row Chemical -> Lot No): the "total options"
  // tracked below is a single number per column, valid only when every row
  // shares the same filter driver (e.g. one antibody selected once on a
  // separate Identity screen, filtering the whole Batch Information table).
  // When the driver varies per row, that single total is really "however
  // many batches the LAST-rendered row's material happens to have" — far
  // smaller than what's truly still available across every material — so
  // "every row filled -> Add Row disabled" fires long before it's actually
  // true.
  // Also gates which columns get `excludeValues` passed to their dropdown at
  // all: a category/name column (e.g. Consumable Type, Chemical) can
  // legitimately repeat across rows — two rows can both be "Filter", just
  // different Consumable Names — so hiding an already-used value there would
  // wrongly make it unpickable a second time. Only genuinely unique physical
  // items (uniqueCols) should ever be excluded once used.
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

  // A filterByField driver may be a column of THIS table (per-row) or a field
  // on a sibling screen (section-wide) — row values win when the name collides.
  const resolveFilterValue = (row: Record<string, unknown>, filterByField: string | undefined): unknown => {
    if (!filterByField) return undefined
    if (Object.prototype.hasOwnProperty.call(row, filterByField)) return row[filterByField]
    return externalValues?.[filterByField]
  }

  // A 'screenRows' driver's dependents (autoFill.mode === 'row') copy an
  // attribute from the matching row of the SOURCE screen (resolved by the
  // parent, since it may live in a different section) — same shape as
  // applyAutoFill's inventory-backed 'attribute' mode, just a different row source.
  const applyRowAutoFill = (changed: TemplateField, newValue: unknown, values: Record<string, unknown>) => {
    if (changed.optionsMode !== 'screenRows' || !resolveRowOptions) return values
    const dependents = columns.filter(f => f.autoFill?.mode === 'row' && f.autoFill?.sourceFieldName === changed.name)
    if (dependents.length === 0) return values
    const opt = resolveRowOptions(changed).find(o => o.value === String(newValue))
    const next = { ...values }
    for (const dep of dependents) {
      const attr = dep.autoFill!.attribute
      const raw = opt && attr ? opt.row[attr] : undefined
      next[dep.name] = raw == null ? '' : raw
    }
    return next
  }

  // Auto-fill is scoped to the edited row: a driver dropdown only populates
  // dependents in its own row (sync attribute copy + async mapping lookup).
  const updateCell = (idx: number, name: string, v: unknown) => {
    const changed = columns.find(c => c.name === name)
    let merged = changed
      ? applyRowAutoFill(changed, v, applyAutoFill(qc, columns, changed, v, { ...rows[idx], [name]: v }))
      : { ...rows[idx], [name]: v }
    // Changing a material column clears cascading batch columns filtered by it.
    for (const c of columns) {
      if (c.inventorySource?.filterByField === name) merged = { ...merged, [c.name]: '' }
    }
    const nextRows = rows.map((r, i) => (i === idx ? merged : r))
    // Keep the ref in sync IMMEDIATELY (not just on next render): a
    // mapping-mode dependent with only ONE of its two drivers set so far
    // (e.g. Chemical picked, Make not yet) resolves synchronously to a
    // "clear to empty" patch with no real network await in between — that
    // patch's patchRow() call could otherwise land before React re-renders
    // and refreshes rowsRef from props, so it would merge onto the STALE
    // pre-edit rows array and silently drop the very key just set here.
    rowsRef.current = nextRows
    onChange(nextRows)
    if (changed) {
      void resolveMappingAutoFills(qc, columns, changed, merged, patch => patchRow(idx, patch))
    }
    onDriverChange?.(name)
  }

  if (cols.length === 0) return <p className="text-xs text-slate-300">No columns defined.</p>

  if (variant === 'entry') {
    return (
      <div className="space-y-3">
        {rows.map((row, ri) => (
          <div key={ri} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 border-b border-slate-200">
              <span className="text-xs font-semibold text-indigo-700">Entry {ri + 1}</span>
              {!disabled && (
                <button onClick={() => removeRow(ri)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
              )}
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-2/5">Parameter</th>
                  <th className="px-2 py-1.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Entry</th>
                </tr>
              </thead>
              <tbody>
                {cols.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5 align-middle text-slate-600 whitespace-nowrap">
                      {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
                    </td>
                    <td className="px-1.5 py-1.5 align-middle">
                      <CgtFieldControl
                        field={f} value={row[f.name]} onChange={v => updateCell(ri, f.name, v)} disabled={disabled || lockedColumns?.has(f.name)}
                        filterValue={resolveFilterValue(row, f.inventorySource?.filterByField)}
                        excludeValues={uniqueCols.includes(f) ? usedValuesFor(f.name, ri) : undefined}
                        onTotalCount={n => setTotalOptionsByCol(prev => (prev[f.name] === n ? prev : { ...prev, [f.name]: n }))}
                        rowOptions={rowOptionsFor(f, row)}
                        experimentId={experimentId}
                        slotKey={`${f.id}:${ri}`}
                        row={row}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!disabled && (
          <div className="flex items-center gap-2">
            <Tooltip title={allOptionsExhausted ? 'Every available option has already been used in a row above.' : undefined}>
              <Button size="small" icon={<Plus size={12} />} onClick={addRow} disabled={allOptionsExhausted}>Add entry</Button>
            </Tooltip>
            {altCol && (
              <Button size="small" icon={<Plus size={12} />} onClick={addAltRow}>{altCol.altGroupSource!.addButtonLabel}</Button>
            )}
          </div>
        )}
        {rows.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No entries yet.</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 w-8">#</th>
              {cols.map(col => (
                <th key={col.id} className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  {col.label}{col.required && <span className="text-red-500 ml-0.5">*</span>}
                </th>
              ))}
              {!disabled && <th className="w-8 border-b border-slate-200" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 2} className="px-3 py-4 text-center text-slate-400 text-xs">No rows yet.</td>
              </tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                <td className="px-2 py-1.5 align-middle text-slate-400">{ri + 1}</td>
                {cols.map(col => (
                  <td key={col.id} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 140 }}>
                    <CgtFieldControl
                      field={col} value={row[col.name]} onChange={v => updateCell(ri, col.name, v)} disabled={disabled || lockedColumns?.has(col.name)}
                      filterValue={resolveFilterValue(row, col.inventorySource?.filterByField)}
                      excludeValues={uniqueCols.includes(col) ? usedValuesFor(col.name, ri) : undefined}
                      onTotalCount={n => setTotalOptionsByCol(prev => (prev[col.name] === n ? prev : { ...prev, [col.name]: n }))}
                      rowOptions={rowOptionsFor(col, row)}
                      experimentId={experimentId}
                      slotKey={`${col.id}:${ri}`}
                      row={row}
                    />
                  </td>
                ))}
                {!disabled && (
                  <td className="px-1.5 py-1.5 align-middle">
                    <button onClick={() => removeRow(ri)} className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded"><Trash2 size={11} /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <div className="flex items-center gap-2">
          <Tooltip title={allOptionsExhausted ? 'Every available option has already been used in a row above.' : undefined}>
            <Button size="small" icon={<Plus size={12} />} onClick={addRow} disabled={allOptionsExhausted}>Add row</Button>
          </Tooltip>
          {altCol && (
            <Button size="small" icon={<Plus size={12} />} onClick={addAltRow}>{altCol.altGroupSource!.addButtonLabel}</Button>
          )}
        </div>
      )}
    </div>
  )
}
