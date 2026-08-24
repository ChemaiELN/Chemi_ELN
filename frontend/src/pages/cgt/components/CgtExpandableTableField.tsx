import { Button } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { TemplateField } from '../../admin/templateBuilder/types'
import CgtFieldControl from './CgtFieldControl'

// Data shape for an (expandable table) screen — stored as a plain object
// (not a bare array like regular table screens) so both the row data and the
// dynamic column count survive the round-trip through JSON.
export interface ExpandableTableData {
  colCount: number                     // how many Fn columns the user has added
  rows: Record<string, unknown>[]      // row data: fixed-col keys + f1/f2/f3...fn keys
}

// Table whose column set can grow at runtime: fixed left columns (FACTOR, RANGE,
// UOM — whatever the template defines) plus user-addable dynamic columns whose
// prefix is determined by the screen title suffix, e.g.:
//   "(expandable table)"   → F1, F2, F3 … (formulation columns)
//   "(expandable table R)" → R1, R2, R3 … (run columns)
// The last column shows a × to remove it; a "+ Col" button in the header adds one.
export default function CgtExpandableTableField({ fixedColumns, data, onChange, disabled, colPrefix = 'f', experimentId }: {
  fixedColumns: TemplateField[]
  data: ExpandableTableData
  onChange: (data: ExpandableTableData) => void
  disabled?: boolean
  colPrefix?: string   // lowercase key prefix, e.g. 'f' or 'r'
  experimentId?: string    // ATTACHMENT/IMAGE columns only — real upload needs the owning experiment
}) {
  const cols = fixedColumns.filter(c => c.type !== 'SECTION_HEADING' && c.type !== 'SPACER' && !c.hidden)
  const colCount = data.colCount ?? 1
  const rows = data.rows ?? []
  const pfx = colPrefix.toLowerCase()
  const hdr = colPrefix.toUpperCase()

  const addCol = () => onChange({ ...data, colCount: colCount + 1 })
  const removeCol = () => {
    if (colCount <= 1) return
    const lastKey = `${pfx}${colCount}`
    onChange({
      colCount: colCount - 1,
      rows: rows.map(r => {
        const next = { ...r }
        delete next[lastKey]
        return next
      }),
    })
  }
  const addRow = () => onChange({ ...data, rows: [...rows, {}] })
  const removeRow = (idx: number) => onChange({ ...data, rows: rows.filter((_, i) => i !== idx) })
  const updateCell = (rowIdx: number, key: string, v: unknown) =>
    onChange({
      ...data,
      rows: rows.map((r, i) => i === rowIdx ? { ...r, [key]: v } : r),
    })

  const dynKeys = Array.from({ length: colCount }, (_, i) => `${pfx}${i + 1}`)

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
              {dynKeys.map((key, i) => (
                <th key={key} className="px-2 py-2 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap min-w-[100px]">
                  <span className="flex items-center gap-1">
                    {hdr}{i + 1}
                    {!disabled && i === colCount - 1 && (
                      <button
                        type="button"
                        onClick={removeCol}
                        title="Remove this column"
                        className="text-slate-300 hover:text-red-500 transition-colors text-sm leading-none"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </th>
              ))}
              {!disabled && (
                <th className="px-2 py-2 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={addCol}
                    title="Add formulation column"
                    className="text-[10px] font-bold text-violet-600 hover:text-violet-800 whitespace-nowrap transition-colors"
                  >
                    + Col
                  </button>
                </th>
              )}
              {!disabled && <th className="w-8 border-b border-slate-200" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + colCount + 3} className="px-3 py-4 text-center text-slate-400 text-xs italic">
                  No rows yet — click "Add Row" to start
                </td>
              </tr>
            ) : rows.map((row, ri) => (
              <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                <td className="px-2 py-1.5 align-middle text-slate-400">{ri + 1}</td>
                {cols.map(col => (
                  <td key={col.id} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 140 }}>
                    <CgtFieldControl
                      field={col}
                      value={row[col.name]}
                      onChange={v => updateCell(ri, col.name, v)}
                      disabled={disabled}
                      experimentId={experimentId}
                      slotKey={`${col.id}:${ri}`}
                    />
                  </td>
                ))}
                {dynKeys.map(key => (
                  <td key={key} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 100 }}>
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:border-violet-400 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                      value={(row[key] as string) ?? ''}
                      onChange={e => updateCell(ri, key, e.target.value)}
                      disabled={disabled}
                    />
                  </td>
                ))}
                {!disabled && (
                  <td className="px-1.5 py-1.5 align-middle">
                    <button
                      onClick={() => removeRow(ri)}
                      className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <Button size="small" icon={<Plus size={12} />} onClick={addRow}>Add Row</Button>
      )}
    </div>
  )
}
