import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button, Input, InputNumber, message } from 'antd'
import { ArrowLeft, Send } from 'lucide-react'
import { EmptyValue } from '../../../components/ui/EmptyValue'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import type { IUniverSheetsCorePresetConfig } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { FUniver } from '@univerjs/core/lib/facade'
import type { IWorkbookData } from '@univerjs/core'
import { calcTemplateApi } from '../../../api/calcTemplates'
import type { CalcField, ProtectedRangeMeta } from './types'
import BrandSpinner from '../../../components/ui/BrandSpinner'

// Regular-user "Fill Template" view — loads a PUBLISHED calc template and
// lets the user enter values only for admin-marked input fields.
//
// Locked/output ranges are made genuinely read-only by re-applying, at
// runtime, the SAME per-range locks the admin set while authoring
// (template.metadata.protectedRanges — see CalcTemplateBuilderPage.tsx's
// lockSelectedRange()). Locking the WHOLE WORKSHEET instead (the previous
// approach here, `getWorksheetPermission().setMode('readOnly')`) turned out
// to override any per-range "allow" rule unconditionally, which would have
// blocked the input fields too — verified live against a running instance.
// Per-range protection with the worksheet left unprotected is the one
// combination that blocks just the intended (formula/output) cells while
// leaving input cells (typed directly OR set via the form panel below)
// editable. `.protect()` alone defaults to an "OnlyMe" edit state, which the
// CURRENT session satisfies as the rule's own creator and does NOT block
// that session's edits by itself — the explicit `setPoint(Edit, false)` is
// what actually denies it (also true of the rule CalcTemplateBuilderPage
// already saved into the snapshot, so every locked range must still be
// walked here, not skipped just because `isProtected()` is already true).
export default function FillCalcTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ univer: import('@univerjs/core').Univer; univerAPI: FUniver } | null>(null)

  const [ready, setReady] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [outputs, setOutputs] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null)

  const { data: template, isLoading } = useQuery({
    queryKey: ['calc-template', id],
    queryFn: () => calcTemplateApi.get(id!),
    enabled: !!id,
  })

  const inputFields = (template?.metadata.fields ?? []).filter(f => f.role === 'input')
  const outputFields = (template?.metadata.fields ?? []).filter(f => f.role === 'output')

  useEffect(() => {
    if (!containerRef.current || !template) return

    const mountEl = document.createElement('div')
    mountEl.id = `calc-template-fill-${Math.random().toString(36).slice(2)}`
    mountEl.style.position = 'absolute'
    mountEl.style.inset = '0'
    containerRef.current.appendChild(mountEl)

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({
        container: mountEl.id,
        toolbar: false,
        header: false,
      } as Partial<IUniverSheetsCorePresetConfig>)],
    })
    univerRef.current = { univer, univerAPI }

    const workbook = univerAPI.createWorkbook((template.workbook_data as Partial<IWorkbookData>) ?? {})

    let disposed = false
    void (async () => {
      const protectedRanges: ProtectedRangeMeta[] = template.metadata.protectedRanges ?? []
      for (const pr of protectedRanges) {
        const sheet = workbook.getSheetBySheetId(pr.sheetId)
        const range = sheet?.getRange(pr.range)
        const rangePerm = range?.getRangePermission()
        if (!rangePerm) continue
        const rules = rangePerm.isProtected()
          ? await rangePerm.listRules()
          : [await rangePerm.protect({ name: pr.display, allowViewByOthers: true })]
        for (const rule of rules) {
          await rule.setPoint(univerAPI.Enum.RangePermissionPoint.Edit, false)
        }
      }
      if (!disposed) setReady(true)
    })()

    return () => {
      disposed = true
      univer.dispose()
      mountEl.remove()
      univerRef.current = null
      setReady(false)
    }
    // Keyed on version as well as id — this page shares the
    // ['calc-template', id] cache entry with the builder, so on mount React
    // Query serves the previously cached snapshot synchronously and refetches
    // in the background. Without version in the deps the sheet was built from
    // that stale entry and the fresh snapshot was never painted, so a template
    // edited in the builder still opened here showing its pre-edit values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, template?.version])

  const applyInputAndRecalculate = async (field: CalcField, value: unknown) => {
    const univerAPI = univerRef.current?.univerAPI
    const workbook = univerAPI?.getActiveWorkbook()
    const sheet = workbook?.getSheetBySheetId(field.sheetId)
    if (!univerAPI || !sheet) return
    sheet.getRange(field.range).setValue(value as never)
    await univerAPI.getFormula().onCalculationResultApplied()
    setOutputs(prev => {
      const next = { ...prev }
      for (const out of outputFields) {
        const outSheet = workbook!.getSheetBySheetId(out.sheetId)
        next[out.key] = outSheet?.getRange(out.range).getValue() ?? null
      }
      return next
    })
  }

  const submitMut = useMutation({
    mutationFn: () => calcTemplateApi.submit(id!, values),
    onSuccess: res => {
      setSubmitted(res.outputs)
      message.success('Submitted — values re-validated on the server.')
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : 'Submission failed.')
      console.error(err)
    },
  })

  if (isLoading || !template) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading template…" /></div>
  }
  if (!template.is_active) {
    return <div className="p-6 text-sm text-slate-400">This template isn't published yet.</div>
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white/60 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-violet-600">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-base font-semibold text-slate-800">{template.name}</h1>
        </div>
        <Button
          type="primary" icon={<Send size={13} />}
          loading={submitMut.isPending}
          disabled={inputFields.some(f => values[f.key] == null || values[f.key] === '')}
          onClick={() => submitMut.mutate()}
        >
          Submit
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative">
          <div ref={containerRef} className="absolute inset-0" />
        </div>

        <div className="w-96 shrink-0 border-l border-slate-200 bg-white/60 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Enter Values</p>
            <div className="space-y-3">
              {inputFields.map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                  <InputNumber
                    className="w-full" disabled={!ready}
                    value={typeof values[f.key] === 'number' ? (values[f.key] as number) : undefined}
                    onChange={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                    onBlur={() => { if (values[f.key] != null) void applyInputAndRecalculate(f, values[f.key]) }}
                  />
                </div>
              ))}
              {inputFields.length === 0 && <p className="text-xs text-slate-300">This template has no input fields.</p>}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Computed (preview)</p>
            <div className="space-y-1.5">
              {outputFields.map(f => (
                <div key={f.key} className="flex items-center justify-between text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
                  <span className="text-slate-500">{f.label}</span>
                  {outputs[f.key] != null ? <span className="font-medium text-slate-800">{String(outputs[f.key])}</span> : <EmptyValue />}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Preview only — the value used downstream is the server's own recalculation after Submit.</p>
          </div>

          {submitted && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 mb-2">Submitted &amp; Re-validated</p>
              <div className="space-y-1.5">
                {Object.entries(submitted).map(([key, val]) => {
                  const label = outputFields.find(f => f.key === key)?.label ?? key
                  return (
                    <div key={key} className="flex items-center justify-between text-xs rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-800">{String(val)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
