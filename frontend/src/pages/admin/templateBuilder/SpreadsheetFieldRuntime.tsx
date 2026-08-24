import { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import { EmptyValue } from '../../../components/ui/EmptyValue'
import { useQuery } from '@tanstack/react-query'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import type { IUniverSheetsCorePresetConfig } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { FUniver } from '@univerjs/core/lib/facade'
import type { IWorkbookData } from '@univerjs/core'
import type { TemplateField } from './types'
import type { ProtectedRangeMeta } from '../calcTemplates/types'
import { calcTemplateApi } from '../../../api/calcTemplates'

// Shared live-rendering for a SPREADSHEET field's `spreadsheet` config — used
// by both FieldPreview.tsx (builder's interactive Preview modal, so the admin
// can test the sheet before publishing) and CgtFieldControl.tsx (the real CGT
// experiment runtime). See the protection setup below (and
// FillCalcTemplatePage.tsx, same pattern) for how formula/output ranges are
// genuinely locked while input ranges stay editable both via the form panel
// AND by typing directly into the canvas — the SheetValueChanged listener is
// what makes direct typing persist; without it, a canvas edit would recalc
// visually but never reach `onChange`, silently losing the entry on reload.
//
// `value` is this TemplateField's stored value: {[fieldKey]: input or
// computed-output value}, so it round-trips through experiment data like any
// other field, and a saved/reloaded experiment shows the last-computed
// outputs without needing to re-open Univer (only re-opens/recalculates
// live once the user changes an input again).
export default function SpreadsheetFieldRuntime({ spreadsheet, value, onChange, disabled }: {
  spreadsheet: TemplateField['spreadsheet']
  value: Record<string, unknown> | undefined
  onChange: (value: Record<string, unknown>) => void
  disabled?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ univer: import('@univerjs/core').Univer; univerAPI: FUniver } | null>(null)
  const [ready, setReady] = useState(false)

  // The canvas-edit listener below is registered once per mount (effect deps
  // are just `resolved?.workbookData`), but `value`/`onChange` can change
  // every keystroke without remounting Univer — keep refs so the listener
  // always reads/writes the LATEST ones instead of closing over stale props.
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Set true for the duration of applyInput()'s own programmatic setValue,
  // so the SheetValueChanged listener below doesn't redundantly re-sync the
  // exact same edit applyInput already synced itself.
  const suppressListenerRef = useRef(false)
  // Formula recalculation fires SheetValueChanged in multiple waves per
  // edit, and most input cells start at their AUTHORED template default
  // rather than an explicitly-saved backend value — comparing straight
  // against the (possibly never-matching) saved `value` on every wave would
  // treat every one of those fields as "changed" forever, perpetually
  // resetting the parent's autosave debounce. Tracking the sheet's own
  // last-seen value per field lets the listener detect a REAL change once
  // and then go quiet, independent of backend round-trip timing.
  const lastSheetValuesRef = useRef<Record<string, unknown>>({})

  const isTemplateMode = spreadsheet?.mode === 'template' && !!spreadsheet.calcTemplateId && spreadsheet.calcTemplateVersion != null
  // 'template' mode: fetch the PINNED version's content (never "latest") —
  // publishing a newer version of the referenced Calc Template must not
  // change what an already-configured field renders; see types.ts.
  const { data: pinnedVersion, isLoading: pinnedLoading } = useQuery({
    queryKey: ['calc-template-version', spreadsheet?.calcTemplateId, spreadsheet?.calcTemplateVersion],
    queryFn: () => calcTemplateApi.getVersion(spreadsheet!.calcTemplateId!, spreadsheet!.calcTemplateVersion!),
    enabled: isTemplateMode,
    staleTime: 5 * 60 * 1000,
  })

  const resolved = isTemplateMode
    ? (pinnedVersion ? { workbookData: pinnedVersion.workbook_data, fields: pinnedVersion.metadata.fields, protectedRanges: pinnedVersion.metadata.protectedRanges } : null)
    : (spreadsheet?.workbookData ? { workbookData: spreadsheet.workbookData, fields: spreadsheet.fields, protectedRanges: spreadsheet.protectedRanges } : null)

  const inputFields = (resolved?.fields ?? []).filter(f => f.role === 'input')
  const outputFields = (resolved?.fields ?? []).filter(f => f.role === 'output')

  useEffect(() => {
    if (!containerRef.current || !resolved?.workbookData) return

    const mountEl = document.createElement('div')
    mountEl.id = `spreadsheet-field-runtime-${Math.random().toString(36).slice(2)}`
    mountEl.style.position = 'absolute'
    mountEl.style.inset = '0'
    containerRef.current.appendChild(mountEl)

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({ container: mountEl.id, toolbar: false, header: false } as Partial<IUniverSheetsCorePresetConfig>)],
    })
    univerRef.current = { univer, univerAPI }

    const workbook = univerAPI.createWorkbook(resolved.workbookData as Partial<IWorkbookData>)

    let disposed = false
    void (async () => {
      // Re-apply, at runtime, the SAME range locks the admin already set while
      // authoring (resolved.protectedRanges — see CalcTemplateBuilderPage.tsx's
      // lockSelectedRange()). Locking the WHOLE WORKSHEET instead (the
      // previous approach here) turned out to override any per-range "allow"
      // rule unconditionally — verified live: a range explicitly re-opened
      // with RangePermissionPoint.Edit=true still rejected edits while the
      // worksheet stayed protected. Per-range protection with no worksheet
      // lock is the one combination that actually blocks just the intended
      // (formula/output) cells while leaving input cells freely editable.
      // Note: `.protect()` alone defaults to an "OnlyMe" edit state, which
      // the CURRENT session satisfies as the rule's own creator — it does
      // NOT block that session's edits by itself; the explicit
      // `setPoint(Edit, false)` is what actually denies it. The saved
      // workbook snapshot already embeds a "protected" rule for each of
      // these ranges from CalcTemplateBuilderPage's own protect() call
      // (also never followed by setPoint) — so `isProtected()` is already
      // true on load, and every rule must still be walked to force Edit
      // false, not skipped as "already handled".
      const protectedRanges: ProtectedRangeMeta[] = resolved.protectedRanges ?? []
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
      if (disposed) return

      // Restore any previously-entered input values (e.g. reopening a
      // saved-in-progress experiment) so the sheet reflects them immediately.
      for (const f of inputFields) {
        const v = value?.[f.key]
        if (v != null) workbook.getSheetBySheetId(f.sheetId)?.getRange(f.range).setValue(v as never)
      }
      await univerAPI.getFormula().onCalculationResultApplied()
      if (disposed) return

      // Baseline for the change-detection below — read AFTER restoring saved
      // values, so a field that's never been touched starts at its authored
      // template default rather than `undefined`.
      for (const f of inputFields) {
        lastSheetValuesRef.current[f.key] = workbook.getSheetBySheetId(f.sheetId)?.getRange(f.range).getValue() ?? null
      }

      // Direct typing into an unlocked input cell recalculates the canvas
      // fine on its own, but nothing else here would ever call `onChange` for
      // it — this listener is what makes a canvas edit persist exactly like
      // the side-panel inputs do. `effectedRanges` reports cells that
      // RECALCULATED as a result of the edit (formula dependents) — it does
      // NOT include the originally-typed cell itself (verified live), so
      // overlap-matching against it can't detect "which input changed".
      // Instead, on any value-changed event, re-read every input field's
      // current cell value against the last-seen value FROM THE SHEET
      // itself (not the saved/backend value — see lastSheetValuesRef above)
      // so a formula-recalc storm of several waves per edit only reports
      // (and persists) a real change once, instead of resetting the parent's
      // autosave debounce indefinitely.
      //
      // syncAllFieldsFromSheet (not a per-field sync) is what actually runs
      // on a detected change — editing several input cells in quick
      // succession (e.g. tabbing through B8/C9/B11/...) fires this listener
      // once per edit, and each firing used to kick off its own async
      // "merge my one changed key onto valueRef.current" — those merges race
      // (each starts from whatever valueRef.current was BEFORE any of the
      // earlier ones had round-tripped back through React), so all but the
      // last-resolving edit silently vanished from the saved value. Reading
      // every declared field's CURRENT value straight from the live sheet
      // (the sheet itself, not our own cached snapshot) makes each firing
      // self-contained and race-free — whichever one resolves last simply
      // reflects the sheet's true state at that time, superseding earlier
      // (now-stale) snapshots rather than clobbering them.
      univerAPI.addEvent(univerAPI.Event.SheetValueChanged, () => {
        if (suppressListenerRef.current) return
        let changed = false
        for (const f of inputFields) {
          const sheet = workbook.getSheetBySheetId(f.sheetId)
          const current = sheet?.getRange(f.range).getValue() ?? null
          if (current === lastSheetValuesRef.current[f.key]) continue
          lastSheetValuesRef.current[f.key] = current
          changed = true
        }
        if (changed) void syncAllFieldsFromSheet(workbook, univerAPI)
      })

      if (!disposed) setReady(true)
    })()

    return () => {
      disposed = true
      univer.dispose()
      mountEl.remove()
      univerRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.workbookData])

  // Reads EVERY declared field's (input and output) current cell value
  // straight from the live sheet and persists that full snapshot via
  // onChange — race-free by construction, since it never depends on a
  // previous call's result (see the SheetValueChanged listener above).
  const syncAllFieldsFromSheet = async (workbook: NonNullable<ReturnType<FUniver['getActiveWorkbook']>>, api: FUniver) => {
    await api.getFormula().onCalculationResultApplied()
    const next: Record<string, unknown> = {}
    for (const f of (resolved?.fields ?? [])) {
      const sheet = workbook.getSheetBySheetId(f.sheetId)
      next[f.key] = sheet?.getRange(f.range).getValue() ?? null
    }
    onChangeRef.current(next)
  }

  if (isTemplateMode && pinnedLoading) {
    return <div className="flex items-center justify-center border border-dashed border-slate-200 rounded-lg py-8"><Spin size="small" /></div>
  }
  if (isTemplateMode && !pinnedVersion) {
    return <p className="text-xs text-red-400 border border-dashed border-red-200 rounded-lg px-3 py-4 text-center">Referenced Calc Template version {spreadsheet?.calcTemplateVersion} (id {spreadsheet?.calcTemplateId}) could not be loaded — it may have been deleted.</p>
  }
  if (!resolved?.workbookData) {
    return <p className="text-xs text-slate-300 border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">No spreadsheet authored yet — edit this field to create one.</p>
  }

  return (
    <div className="flex border border-slate-200 rounded-lg overflow-hidden" style={{ height: 420 }}>
      <div className="flex-1 min-w-0 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Spin size="small" />
          </div>
        )}
      </div>
      {outputFields.length > 0 && (
        <div className="w-64 shrink-0 border-l border-slate-200 bg-white/60 overflow-y-auto p-3 space-y-1.5">
          {outputFields.map(f => (
            <div key={f.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{f.label}</span>
              {value?.[f.key] != null ? <span className="font-medium text-slate-800">{String(value[f.key])}</span> : <EmptyValue />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
