import { useState } from 'react'
import { Modal } from 'antd'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { glassModalProps } from '../../../utils/modalStyles'
import FieldPreview from './FieldPreview'
import { applyAutoFill, resolveMappingAutoFills } from './useInventoryOptions'
import type { TemplateDefinition, TemplateField, TemplateScreen, TemplateSection } from './types'

// A screen whose title ends with "(table)" is a repeatable data table at
// runtime (its fields are the table's columns). Match that here so the preview
// looks like the scientist runtime, not a flat field form.
const isTableScreen = (screen: TemplateScreen) => /\(table\)\s*$/i.test(screen.title.trim())

// A screen titled "… (entry table)" is a repeatable single-record card rendered
// transposed — fields listed vertically as PARAMETER | ENTRY rows, "Add …" adds
// another card (e.g. pH Probe 1, pH Probe 2). Used for probe calibration blocks.
const isEntryTableScreen = (screen: TemplateScreen) => /\(entry\s+table\)\s*$/i.test(screen.title.trim())

// Drop the trailing "(table)" / "(entry table)" marker from a screen title for display.
const cleanTitle = (title: string) => title.replace(/\s*\((?:entry\s+)?table\)\s*$/i, '').trim()

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

function SectionCard({ section }: { section: TemplateSection }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-sm font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200">{section.title}</p>
      <div className="space-y-4">
        {section.screens.map(screen => (
          <div key={screen.id}>
            <p className="text-[13px] font-semibold text-slate-500 mb-2">{cleanTitle(screen.title)}</p>
            {isEntryTableScreen(screen) ? (
              <EntryTableScreenPreview screen={screen} />
            ) : isTableScreen(screen) ? (
              <TableScreenPreview screen={screen} />
            ) : (
              <ScreenFieldsPreview screen={screen} />
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
function ScreenFieldsPreview({ screen }: { screen: TemplateScreen }) {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})

  const handleChange = (field: TemplateField, v: unknown) => {
    const merged = applyAutoFill(qc, screen.fields, field, v, { ...values, [field.name]: v })
    setValues(merged)
    void resolveMappingAutoFills(qc, screen.fields, field, merged,
      patch => setValues(prev => ({ ...prev, ...patch })))
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
          />
        </div>
      ))}
      {screen.fields.length === 0 && <p className="text-xs text-slate-300 col-span-full">No fields.</p>}
    </div>
  )
}

function TableScreenPreview({ screen }: { screen: TemplateScreen }) {
  const cols = screen.fields.filter(f => f.type !== 'SECTION_HEADING' && f.type !== 'SPACER')
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
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-2 py-1.5 align-middle text-slate-400">1</td>
              {cols.map(col => (
                <td key={col.id} className="px-1.5 py-1.5 align-middle" style={{ minWidth: 140 }}>
                  <FieldPreview field={col} bare interactive />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled
        className="flex items-center gap-1.5 text-xs text-slate-400 border border-dashed border-slate-300 rounded-md px-3 py-1.5"
      >
        <Plus size={12} /> Add row
      </button>
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
      width={820}
      centered
      destroyOnHidden
      {...glassModalProps}
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
              <div className="space-y-4 pl-3 border-l-2 border-indigo-100">
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
