import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Spin } from 'antd'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'

interface TemplateField  { key: string; label: string; type: string; unit?: string }
interface TemplateScreen { key: string; title: string; fields: TemplateField[] }
interface TemplateSection { key: string; title: string; screens: TemplateScreen[] }
interface TemplateSnapshot { sections: TemplateSection[] }

function formatValue(val: unknown, type: string): string {
  if (val === null || val === undefined || val === '') return '—'
  if (type === 'boolean') return val ? 'Yes' : 'No'
  if (type === 'table' && Array.isArray(val)) return `${val.length} row(s)`
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function AdcNotebookPrintPage() {
  const { notebookId } = useParams<{ notebookId: string }>()

  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['adc-notebook-print', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })

  const snapshot   = nb?.template_snapshot as TemplateSnapshot | null | undefined
  const sections   = snapshot?.sections ?? []

  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['adc-experiments-print', notebookId],
    queryFn:  () => experimentApi.listForNotebook(notebookId!),
    enabled:  !!notebookId,
  })

  const expMap = new Map<string, Experiment>(experiments.map((e: Experiment) => [e.section_key, e]))

  // Auto-print when data is ready
  useEffect(() => {
    if (!loadingNb && !loadingExp && nb) {
      setTimeout(() => window.print(), 600)
    }
  }, [loadingNb, loadingExp, nb])

  if (loadingNb || loadingExp) {
    return <div className="flex items-center justify-center h-screen"><Spin size="large" /></div>
  }

  if (!nb) return <div className="p-8 text-slate-500">Notebook not found.</div>

  return (
    <div className="font-sans text-sm text-gray-900 p-8 max-w-4xl mx-auto print:p-0 print:max-w-none">
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 portrait; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Header */}
      <div className="border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Laurus ELN — ADC Module</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{nb.title}</h1>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>Code: <strong>{nb.code}</strong></span>
              <span>Status: <strong>{nb.status}</strong></span>
              <span>Printed: {new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      {sections.map((sec, secIdx) => {
        const exp = expMap.get(sec.key)

        return (
          <div key={sec.key} className={secIdx > 0 ? 'page-break mt-8' : 'mt-4'}>
            {/* Section title */}
            <div className="bg-gray-100 border border-gray-300 rounded px-4 py-2 mb-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{secIdx + 1}.</span>
                <span className="text-base font-bold ml-2">{sec.title}</span>
              </div>
              {exp && (
                <div className="text-xs text-right">
                  <p className="font-mono text-gray-600">{exp.full_code}</p>
                  <p className="font-bold uppercase">{exp.status}</p>
                </div>
              )}
            </div>

            {/* Signature block */}
            {exp?.status === 'APPROVED' && (
              <div className="mb-4 border border-gray-200 rounded p-3 bg-gray-50 text-xs grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Submitted by</p>
                  <p className="font-medium">{exp.submitted_by ?? '—'}</p>
                  <p className="text-gray-400">{exp.submitted_at ? new Date(exp.submitted_at).toLocaleString() : ''}</p>
                </div>
                <div>
                  <p className="text-gray-500">Approved by</p>
                  <p className="font-medium">{exp.approved_by ?? '—'}</p>
                  <p className="text-gray-400">{exp.approved_at ? new Date(exp.approved_at).toLocaleString() : ''}</p>
                </div>
                {exp.scientist_sign_reason && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Scientist statement</p>
                    <p className="font-medium">{exp.scientist_sign_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Screens */}
            {sec.screens.map(screen => {
              const screenData = (exp?.data ?? {})[screen.key] ?? {}
              const nonHeaderFields = screen.fields.filter(f => f.type !== 'section_header')

              return (
                <div key={screen.key} className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1 mb-3">{screen.title}</p>
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      {nonHeaderFields.map(f => {
                        const val = (screenData as Record<string, unknown>)[f.key]
                        const display = formatValue(val, f.type)

                        if (f.type === 'table' && Array.isArray(val) && val.length > 0) {
                          return null // tables rendered separately below
                        }

                        return (
                          <tr key={f.key} className="border-b border-gray-100">
                            <td className="py-1 pr-4 w-48 text-gray-500 font-medium align-top">
                              {f.label}
                              {f.unit ? <span className="text-gray-400"> ({f.unit})</span> : ''}
                            </td>
                            <td className="py-1 text-gray-900 break-words">{display}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Inline tables */}
                  {nonHeaderFields.filter(f => f.type === 'table').map(f => {
                    const rows = (screenData as Record<string, unknown>)[f.key]
                    if (!Array.isArray(rows) || rows.length === 0) return null
                    const cols = Object.keys(rows[0] ?? {})
                    return (
                      <div key={f.key} className="mt-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">{f.label}</p>
                        <table className="w-full border-collapse border border-gray-200 text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              {cols.map(c => (
                                <th key={c} className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(rows as Record<string, unknown>[]).map((row, ri) => (
                              <tr key={ri}>
                                {cols.map(c => (
                                  <td key={c} className="border border-gray-200 px-2 py-1">
                                    {row[c] !== null && row[c] !== undefined ? String(row[c]) : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 flex justify-between no-print">
        <span>Laurus ELN — ADC Module</span>
        <span>{nb.code} — {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  )
}
