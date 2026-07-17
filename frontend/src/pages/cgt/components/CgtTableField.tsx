import { useRef } from 'react'
import { Button } from 'antd'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import type { TemplateField } from '../../admin/templateBuilder/types'
import CgtFieldControl from './CgtFieldControl'
import { applyAutoFill, resolveMappingAutoFills } from '../../admin/templateBuilder/useInventoryOptions'

// Repeatable table for a `(table)` / `(entry table)` screen — same title
// convention PreviewModal.tsx uses, but here rows are real, controlled data
// (Record<fieldName, value>[]) with working Add/Delete row, for the CGT
// experiment runtime rather than the builder's static preview.
export default function CgtTableField({ columns, value, onChange, variant, disabled }: {
  columns: TemplateField[]
  value: Record<string, unknown>[]
  onChange: (rows: Record<string, unknown>[]) => void
  variant: 'table' | 'entry'
  disabled?: boolean
}) {
  const qc = useQueryClient()
  const rows = Array.isArray(value) ? value : []
  const cols = columns.filter(c => c.type !== 'SECTION_HEADING' && c.type !== 'SPACER')

  // Latest rows for async patches — a late mapping fetch merges onto current
  // state, not the snapshot captured when the driver cell changed.
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const addRow = () => onChange([...rows, {}])
  const removeRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))
  const patchRow = (idx: number, patch: Record<string, unknown>) =>
    onChange(rowsRef.current.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  // Auto-fill is scoped to the edited row: a driver dropdown only populates
  // dependents in its own row (sync attribute copy + async mapping lookup).
  const updateCell = (idx: number, name: string, v: unknown) => {
    const changed = columns.find(c => c.name === name)
    const merged = changed
      ? applyAutoFill(qc, columns, changed, v, { ...rows[idx], [name]: v })
      : { ...rows[idx], [name]: v }
    onChange(rows.map((r, i) => (i === idx ? merged : r)))
    if (changed) {
      void resolveMappingAutoFills(qc, columns, changed, merged, patch => patchRow(idx, patch))
    }
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
                      <CgtFieldControl field={f} value={row[f.name]} onChange={v => updateCell(ri, f.name, v)} disabled={disabled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {!disabled && (
          <Button size="small" icon={<Plus size={12} />} onClick={addRow}>Add entry</Button>
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
                    <CgtFieldControl field={col} value={row[col.name]} onChange={v => updateCell(ri, col.name, v)} disabled={disabled} />
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
        <Button size="small" icon={<Plus size={12} />} onClick={addRow}>Add row</Button>
      )}
    </div>
  )
}
