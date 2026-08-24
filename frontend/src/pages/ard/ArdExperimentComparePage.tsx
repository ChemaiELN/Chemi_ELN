import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Select, Spin, Alert, Tag, Empty } from 'antd'
import { GitCompareArrows, ChevronDown, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet } from '../../api/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectionField {
  id: string
  label: string
  type?: string
  value?: string | number | null
}

interface Section {
  id: string
  title: string
  fields?: SectionField[]
}

interface SectionDef {
  id: string
  title: string
  fields?: { id: string; label: string; type?: string }[]
}

interface Experiment {
  id: string
  code: string
  status: string
  version: number
  templateName: string
  sectionDefs: SectionDef[]
  sections: Section[]
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

interface ExperimentsListItem {
  id: string
  code: string
  status: string
  version: number
  templateName?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'blue', SUBMITTED: 'gold', APPROVED: 'green',
  REWORK: 'orange', VERIFIED: 'green', DEACTIVATED: 'default',
}

function fieldValue(sections: Section[], sectionId: string, fieldId: string): string {
  const sec = sections.find(s => s.id === sectionId)
  if (!sec) return ''
  const f = sec.fields?.find(f => f.id === fieldId)
  if (f?.value == null || f?.value === '') return ''
  return String(f.value)
}

function sectionRows(sections: Section[], sectionId: string): unknown[] {
  const sec = sections.find(s => s.id === sectionId) as (Section & Record<string, unknown>) | undefined
  if (!sec) return []
  const rows = (sec as Record<string, unknown>).rows ?? (sec as Record<string, unknown>).data ?? (sec as Record<string, unknown>).items
  if (Array.isArray(rows)) return rows
  return []
}

function sectionContent(sections: Section[], sectionId: string): string {
  const sec = sections.find(s => s.id === sectionId) as (Section & Record<string, unknown>) | undefined
  if (!sec) return ''
  return String((sec as Record<string, unknown>).content ?? (sec as Record<string, unknown>).value ?? '')
}

// ── Section diff block ────────────────────────────────────────────────────────

function SectionDiff({ def, expA, expB }: { def: SectionDef; expA: Experiment; expB: Experiment }) {
  const [open, setOpen] = useState(true)
  const fields = def.fields ?? []

  // For row-based sections (weighing, equipment, pH, column, richtext, etc.)
  const rowsA = fields.length === 0 ? sectionRows(expA.sections, def.id) : []
  const rowsB = fields.length === 0 ? sectionRows(expB.sections, def.id) : []
  const contentA = fields.length === 0 && rowsA.length === 0 ? sectionContent(expA.sections, def.id) : ''
  const contentB = fields.length === 0 && rowsB.length === 0 ? sectionContent(expB.sections, def.id) : ''

  const hasDiff = fields.length > 0
    ? fields.some(f => fieldValue(expA.sections, def.id, f.id) !== fieldValue(expB.sections, def.id, f.id))
    : rowsA.length > 0 || rowsB.length > 0
      ? rowsA.length !== rowsB.length || JSON.stringify(rowsA) !== JSON.stringify(rowsB)
      : contentA !== contentB

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-left hover:bg-slate-100 transition-colors">
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <span className="font-semibold text-slate-700 text-sm">{def.title}</span>
        {hasDiff && <Tag color="orange" className="text-xs ml-auto">Has differences</Tag>}
        {!hasDiff && <span className="text-xs text-slate-400 ml-auto">Identical</span>}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {fields.length > 0 ? (
            <table className="w-full text-sm">
              <tbody>
                {fields.map(f => {
                  const a = fieldValue(expA.sections, def.id, f.id)
                  const b = fieldValue(expB.sections, def.id, f.id)
                  const diff = a !== b
                  return (
                    <tr key={f.id} className={`border-b border-slate-50 last:border-0 ${diff ? 'bg-amber-50/60' : ''}`}>
                      <td className="px-4 py-2 text-xs text-slate-500 font-medium w-36 align-top">{f.label}</td>
                      <td className={`px-4 py-2 align-top border-x border-slate-100 ${diff ? 'text-slate-700' : 'text-slate-500'}`}>
                        {a || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className={`px-4 py-2 align-top ${diff ? 'text-slate-700' : 'text-slate-500'}`}>
                        {b || <span className="text-slate-300 italic">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : rowsA.length > 0 || rowsB.length > 0 ? (
            <div className="grid grid-cols-2 gap-0 text-xs">
              <div className={`p-3 border-r border-slate-100 ${rowsA.length !== rowsB.length ? 'bg-amber-50/40' : ''}`}>
                <p className="font-semibold text-slate-500 mb-2">{rowsA.length} row{rowsA.length !== 1 ? 's' : ''}</p>
                {rowsA.map((row, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded p-2 mb-1 font-mono text-slate-600 whitespace-pre-wrap break-all">
                    {Object.entries(row as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </div>
                ))}
                {rowsA.length === 0 && <span className="text-slate-400 italic">No rows</span>}
              </div>
              <div className={`p-3 ${rowsA.length !== rowsB.length ? 'bg-amber-50/40' : ''}`}>
                <p className="font-semibold text-slate-500 mb-2">{rowsB.length} row{rowsB.length !== 1 ? 's' : ''}</p>
                {rowsB.map((row, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded p-2 mb-1 font-mono text-slate-600 whitespace-pre-wrap break-all">
                    {Object.entries(row as Record<string, unknown>)
                      .filter(([, v]) => v !== null && v !== '' && v !== undefined)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')}
                  </div>
                ))}
                {rowsB.length === 0 && <span className="text-slate-400 italic">No rows</span>}
              </div>
            </div>
          ) : contentA || contentB ? (
            <div className={`grid grid-cols-2 gap-0 text-xs ${contentA !== contentB ? 'bg-amber-50/20' : ''}`}>
              <div className="p-3 border-r border-slate-100 text-slate-600 whitespace-pre-wrap">
                {contentA || <span className="text-slate-300 italic">—</span>}
              </div>
              <div className="p-3 text-slate-600 whitespace-pre-wrap">
                {contentB || <span className="text-slate-300 italic">—</span>}
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 text-slate-400 text-xs italic">No data recorded in either experiment</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArdExperimentComparePage() {
  const [params, setParams] = useSearchParams()
  const [idA, setIdA] = useState(params.get('a') ?? '')
  const [idB, setIdB] = useState(params.get('b') ?? '')

  const { data: list } = useQuery<{ items: ExperimentsListItem[] }>({
    queryKey: ['ard-experiments-list'],
    queryFn: () => apiGet('/api/ard/experiments', { pageSize: 200 }),
  })

  const { data: expA, isLoading: loadingA } = useQuery<Experiment>({
    queryKey: ['ard-exp', idA],
    queryFn: () => apiGet(`/api/ard/experiments/${idA}`),
    enabled: !!idA,
  })

  const { data: expB, isLoading: loadingB } = useQuery<Experiment>({
    queryKey: ['ard-exp', idB],
    queryFn: () => apiGet(`/api/ard/experiments/${idB}`),
    enabled: !!idB,
  })

  const options = (list?.items ?? []).map(e => ({
    value: e.id,
    label: `${e.code} — ${e.templateName ?? ''} (v${e.version} · ${e.status})`,
  }))

  function selectA(v: string) {
    setIdA(v)
    setParams(p => { p.set('a', v); return p })
  }
  function selectB(v: string) {
    setIdB(v)
    setParams(p => { p.set('b', v); return p })
  }

  // Build section union from A's defs (fall back to B if A not loaded)
  const sectionDefs = expA?.sectionDefs ?? expB?.sectionDefs ?? []

  const totalDiffs = expA && expB
    ? sectionDefs.reduce((acc, def) => {
        const fields = def.fields ?? []
        if (fields.length > 0) {
          return acc + fields.filter(f => fieldValue(expA.sections, def.id, f.id) !== fieldValue(expB.sections, def.id, f.id)).length
        }
        // For row-based sections count as 1 diff if rows differ
        const rA = sectionRows(expA.sections, def.id)
        const rB = sectionRows(expB.sections, def.id)
        if (rA.length > 0 || rB.length > 0) {
          return acc + (JSON.stringify(rA) !== JSON.stringify(rB) ? 1 : 0)
        }
        const cA = sectionContent(expA.sections, def.id)
        const cB = sectionContent(expB.sections, def.id)
        return acc + (cA !== cB ? 1 : 0)
      }, 0)
    : 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitCompareArrows size={22} className="text-violet-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Experiment Comparison</h1>
          <p className="text-xs text-slate-400">Side-by-side section field comparison between two experiments</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Experiment A</p>
          <Select
            showSearch
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            className="w-full"
            placeholder="Select experiment A"
            options={options}
            value={idA || undefined}
            onChange={selectA}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Experiment B</p>
          <Select
            showSearch
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            className="w-full"
            placeholder="Select experiment B"
            options={options}
            value={idB || undefined}
            onChange={selectB}
          />
        </div>
      </div>

      {/* Loading */}
      {(loadingA || loadingB) && (
        <div className="flex justify-center py-12"><Spin size="large" /></div>
      )}

      {/* Both selected — show comparison */}
      {expA && expB && !loadingA && !loadingB && (
        <>
          {/* Header strip */}
          <div className="grid grid-cols-[144px_1fr_1fr] gap-0 mb-4 glass-card rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-r border-slate-100" />
            {[expA, expB].map((exp, i) => (
              <div key={i} className={`px-4 py-3 ${i === 0 ? 'border-r border-slate-100' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 font-mono">{exp.code}</span>
                  <Tag color={STATUS_COLORS[exp.status] ?? 'default'} className="text-xs">{exp.status}</Tag>
                  <span className="text-xs text-slate-400">v{exp.version}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{exp.templateName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {exp.updatedAt ? `Updated ${dayjs(exp.updatedAt).format('DD MMM YY')}` : `Created ${dayjs(exp.createdAt).format('DD MMM YY')}`}
                </p>
              </div>
            ))}
          </div>

          {/* Diff summary */}
          {totalDiffs > 0 ? (
            <div className="mb-4 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
              <GitCompareArrows size={15} />
              <span><strong>{totalDiffs}</strong> field{totalDiffs !== 1 ? 's' : ''} differ between the two experiments</span>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 text-sm text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-4 py-2.5">
              <GitCompareArrows size={15} />
              <span>All fields are identical</span>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[144px_1fr_1fr] text-xs font-semibold uppercase tracking-wide text-slate-400 px-1 mb-1">
            <span>Field</span>
            <span className="px-4">{expA.code}</span>
            <span className="px-4">{expB.code}</span>
          </div>

          {/* Sections */}
          {sectionDefs.length === 0 ? (
            <Empty description="No sections in template" className="py-8" />
          ) : (
            sectionDefs.map(def => (
              <SectionDiff key={def.id} def={def} expA={expA} expB={expB} />
            ))
          )}
        </>
      )}

      {/* Prompt */}
      {!idA && !idB && !loadingA && !loadingB && (
        <div className="glass-card rounded-lg p-12 text-center text-slate-400">
          Select two experiments above to compare their section data
        </div>
      )}
    </div>
  )
}
