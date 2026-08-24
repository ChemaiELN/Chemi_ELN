import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tag, Modal, Input, Alert, message } from 'antd'
import { Send, Clock, CheckCircle, ChevronDown, ThumbsUp, ThumbsDown, Unlock, ArrowLeft, ArrowRight, Lock, Menu, X } from 'lucide-react'
import { cgtNotebookApi, cgtExperimentApi, type CgtExperiment } from '../../api/cgt'
import { ApiError } from '../../api/client'
import PasswordSignatureModal from './components/PasswordSignatureModal'
import type { TemplateDefinition, TemplateField, TemplateScreen, TemplateSection } from '../admin/templateBuilder/types'
import CgtFieldControl from './components/CgtFieldControl'
import CgtTableField from './components/CgtTableField'
import CgtExpandableTableField, { type ExpandableTableData } from './components/CgtExpandableTableField'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { applyAutoFill, resolveMappingAutoFills } from '../admin/templateBuilder/useInventoryOptions'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { isQaViewOnly } from '../../utils/privileges'

const isTableScreen = (s: TemplateScreen) => /\(table\)\s*$/i.test(s.title.trim())
const isEntryTableScreen = (s: TemplateScreen) => /\(entry\s+table\)\s*$/i.test(s.title.trim())
const isExpandableTableScreen = (s: TemplateScreen) => /\(expandable\s+table(?:\s+[A-Z])?\)\s*$/i.test(s.title.trim())
const expandableColPrefix = (s: TemplateScreen): string => {
  const m = s.title.match(/\(expandable\s+table(?:\s+([A-Z]))?\)/i)
  return (m?.[1] ?? 'f').toLowerCase()
}
const cleanTitle = (title: string) => title.replace(/\s*\((?:entry\s+|expandable\s+(?:[A-Z]\s+)?)?table\)\s*$/i, '').trim()

// ── Repeating Group renderer ─────────────────────────────────────────────────
// Renders a REPEATING_GROUP field as a list of collapsible item cards, each
// containing the sub-screens defined in field.repeatConfig.screens. Items are
// stored as an array of { [subScreenId]: values | rows[] } — the same shape
// as a section's top-level screen data, scoped to the item index.
function RepeatingGroupField({ field, items, onChange, disabled, resolveRowOptions }: {
  field: TemplateField
  items: Record<string, unknown>[]
  onChange: (next: Record<string, unknown>[]) => void
  disabled?: boolean
  // DROPDOWN sub-fields with optionsMode 'screenRows' (e.g. Buffer Preparation's
  // Chemical / Reagent pulling from 1.3 Reagents & Salts) need the SAME
  // whole-run resolver top-level screen fields use — passed down from
  // CgtSectionPage rather than recomputed here, since it reads every
  // section's saved data, not just this repeating group's own.
  resolveRowOptions: (field: TemplateField) => { value: string; label: string; row: Record<string, unknown> }[]
}) {
  const { repeatConfig } = field
  if (!repeatConfig) return null
  const { addButtonLabel = 'Add item', itemLabel = 'Item', screens = [] } = repeatConfig

  // Auto-initialize with one empty item so the section is never blank
  useEffect(() => {
    if (items.length === 0) onChange([{}])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addItem = () => onChange([...items, {}])
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  const updateSubScreen = (itemIdx: number, screenId: string, value: unknown) => {
    onChange(items.map((item, i) => i === itemIdx ? { ...item, [screenId]: value } : item))
  }

  const isFullWidth = (f: TemplateField) =>
    f.type === 'SECTION_HEADING' || f.type === 'SPACER' || f.type === 'LOCK_TOGGLE' ||
    f.type === 'MULTI_LINE_TEXT' || f.type === 'RICH_TEXT' || f.type === 'SPREADSHEET' ||
    f.colSpan === 2

  return (
    <div className="space-y-4">
      {items.map((itemData, itemIdx) => (
        <div key={itemIdx} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Item header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-violet-50 border-b border-slate-200">
            <span className="text-sm font-semibold text-violet-700">{itemLabel} {itemIdx + 1}</span>
            {!disabled && (
              <button
                type="button"
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
                onClick={() => removeItem(itemIdx)}
              >
                Remove {itemLabel}
              </button>
            )}
          </div>

          {/* Sub-screens */}
          <div className="p-4 space-y-5">
            {/* A field's altGroupSource reads a sibling field of EARLIER items
                only (e.g. Buffer 3's Chemical/Reagent "Add Buffer" button
                offering Buffer 1 / Buffer 2, not itself or later ones). */}
            {(() => {
              const resolveAltGroupOptions = (f: TemplateField) => {
                const src = f.altGroupSource
                if (!src) return []
                return items.slice(0, itemIdx).flatMap((it, i) => {
                  const sub = (it[src.subScreenId] as Record<string, unknown>) ?? {}
                  const v = sub[src.valueField]
                  if (v == null || v === '') return []
                  return [{ value: String(v), label: String(sub[src.labelField] ?? v ?? `Item ${i + 1}`) }]
                })
              }
              return screens.map(subScreen => {
              if (isTableScreen(subScreen) || isEntryTableScreen(subScreen)) {
                const rows = (itemData[subScreen.id] as Record<string, unknown>[]) ?? []
                return (
                  <div key={subScreen.id}>
                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      {cleanTitle(subScreen.title)}
                    </h4>
                    <CgtTableField
                      columns={subScreen.fields}
                      value={rows}
                      onChange={rows => updateSubScreen(itemIdx, subScreen.id, rows)}
                      variant={isEntryTableScreen(subScreen) ? 'entry' : 'table'}
                      disabled={disabled}
                      lockedColumns={new Set()}
                      resolveRowOptions={resolveRowOptions}
                      resolveAltGroupOptions={resolveAltGroupOptions}
                    />
                  </div>
                )
              }
              const subValues = (itemData[subScreen.id] as Record<string, unknown>) ?? {}
              return (
                <div key={subScreen.id}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: subScreen.columns === 2 ? '1fr 1fr' : '1fr',
                      gap: '14px 24px',
                    }}
                  >
                    {subScreen.fields.map(subField => (
                      <div key={subField.id} style={{ gridColumn: isFullWidth(subField) ? 'span 2' : undefined }}>
                        {subField.type !== 'SECTION_HEADING' && subField.type !== 'SPACER' && (
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            {subField.label}
                            {subField.required && <span className="text-red-500 ml-0.5">*</span>}
                          </label>
                        )}
                        <CgtFieldControl
                          field={subField}
                          value={subValues[subField.name]}
                          rowOptions={subField.optionsMode === 'screenRows' ? resolveRowOptions(subField) : undefined}
                          onChange={v =>
                            updateSubScreen(itemIdx, subScreen.id, { ...subValues, [subField.name]: v })
                          }
                          disabled={disabled}
                        />
                        {subField.helpText && (
                          <p className="text-[11px] text-slate-400 mt-1">{subField.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
            })()}
          </div>
        </div>
      ))}

      {/* Add item button */}
      {!disabled && (
        <button
          type="button"
          className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
          onClick={addItem}
        >
          + {addButtonLabel}
        </button>
      )}
      {disabled && items.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No {itemLabel.toLowerCase()}s entered.</p>
      )}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

// Chemist signs to submit; CGT HOD then signs to approve (or rejects).
const isChemistRole = (roleCode: string | undefined) => roleCode === 'CHEM'
const isApproverRole = (roleCode: string | undefined) => roleCode === 'HOD'

function groupByPhase(sections: TemplateSection[]) {
  const groups: { phase?: string; sections: TemplateSection[] }[] = []
  for (const s of sections) {
    const last = groups[groups.length - 1]
    if (last && last.phase === s.phase && s.phase !== undefined) last.sections.push(s)
    else groups.push({ phase: s.phase, sections: [s] })
  }
  return groups
}

// The one experiment for this notebook. All 22+ template sections live
// inside it — the sidebar just switches which section's fields are shown
// (client-side state, no navigation, no per-section experiment). Data is
// keyed data[section.id][screen.id] = field values (form) or rows (table).
export default function CgtSectionPage() {
  const { projectId, notebookId, experimentId } = useParams<{
    projectId: string; notebookId: string; experimentId: string
  }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const isChemist = isChemistRole(user?.role_code)
  const isApprover = isApproverRole(user?.role_code)
  const isTl = user?.role_code === 'TL'

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [localData, setLocalData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signModal, setSignModal] = useState<'submit' | 'approve' | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectPassword, setRejectPassword] = useState('')
  const [signError, setSignError] = useState<string | null>(null)
  const [rejectError, setRejectError] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: nb } = useQuery({
    queryKey: ['cgt-notebook', notebookId],
    queryFn: () => cgtNotebookApi.get(notebookId!),
    enabled: !!notebookId,
  })
  const snapshot = nb?.template_snapshot as TemplateDefinition | null | undefined
  const sections: TemplateSection[] = snapshot?.sections ?? []

  const { data: exp, isLoading } = useQuery({
    queryKey: ['cgt-experiment', experimentId],
    queryFn: () => cgtExperimentApi.get(experimentId!),
    enabled: !!experimentId,
  })

  const section = sections.find(s => s.id === (activeSectionId ?? sections[0]?.id)) ?? sections[0]
  // `frozen_at` is set when this experiment's Notebook is closed (while not
   // yet Approved) or deactivated — overrides status entirely.
  const editable = !isQaViewOnly(user) && !exp?.frozen_at && (exp ? exp.status === 'DRAFT' : false)

  const sectionData: Record<string, unknown> = {
    ...((exp?.data ?? {})[section?.id ?? ''] ?? {}),
    ...((localData ?? {})[section?.id ?? ''] ?? {}),
  }

  // Every section's data (not just the active one) — lets a DROPDOWN with
  // optionsMode 'screenRows' read rows entered into a table screen defined
  // in a DIFFERENT section (e.g. a Filters table in "3.1" picking from rows
  // already logged in "1.4 Consumables").
  const allSectionsData: Record<string, Record<string, unknown>> = {}
  for (const s of sections) {
    allSectionsData[s.id] = { ...((exp?.data ?? {})[s.id] ?? {}), ...((localData ?? {})[s.id] ?? {}) }
  }

  const resolveRowOptions = (field: TemplateField): { value: string; label: string; row: Record<string, unknown> }[] => {
    const src = field.rowSource
    if (!src) return []
    // A REPEATING_GROUP source (e.g. "2. Buffer Preparation") stores an array
    // of items shaped {[subScreenId]: {fieldName: value, ...}}, not a flat
    // row array — read valueField/labelField from each item's sub-screen.
    if (src.repeatingGroupFieldName && src.subScreenId) {
      const screenValues = (allSectionsData[src.sectionId]?.[src.screenId] as Record<string, unknown>) ?? {}
      const items = (screenValues[src.repeatingGroupFieldName] as Record<string, unknown>[]) ?? []
      const rows = items.map(it => (it[src.subScreenId!] as Record<string, unknown>) ?? {})
      return rows
        .filter(r => !src.filterField || String(r[src.filterField] ?? '') === String(src.filterValue ?? ''))
        .map(r => ({ value: String(r[src.valueField] ?? ''), label: String(r[src.labelField] ?? r[src.valueField] ?? ''), row: r }))
        .filter(o => o.value !== '')
    }
    const rows = (allSectionsData[src.sectionId]?.[src.screenId] as Record<string, unknown>[]) ?? []
    return rows
      .filter(r => !src.filterField || String(r[src.filterField] ?? '') === String(src.filterValue ?? ''))
      .map(r => ({ value: String(r[src.valueField] ?? ''), label: String(r[src.labelField] ?? r[src.valueField] ?? ''), row: r }))
      .filter(o => o.value !== '')
  }

  // A 'screenRows' driver's dependents (autoFill.mode === 'row') copy an
  // attribute from the matching row of the SOURCE screen — same shape as
  // CgtTableField's applyRowAutoFill, for a plain (non-table) field on a
  // regular screen (e.g. 3.3's TCEP lot, driven by Reducing agent).
  const applyRowAutoFill = (
    changed: TemplateField, newValue: unknown, values: Record<string, unknown>, siblings: TemplateField[],
  ): Record<string, unknown> => {
    if (changed.optionsMode !== 'screenRows') return values
    const dependents = siblings.filter(f => f.autoFill?.mode === 'row' && f.autoFill?.sourceFieldName === changed.name)
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

  // A field with autoFill.mode 'spreadsheet' is a live, read-only computed
  // display — its value is re-derived from a SPREADSHEET field's own current
  // (possibly cross-section) output values on every render, never stored or
  // copied on an event like the other autoFill modes.
  const resolveSpreadsheetAutoFill = (field: TemplateField): unknown => {
    const af = field.autoFill
    if (!af || af.mode !== 'spreadsheet' || !af.sectionId || !af.screenId || !af.sourceFieldName || !af.attribute) return undefined
    const screenValues = allSectionsData[af.sectionId]?.[af.screenId] as Record<string, unknown> | undefined
    const spreadsheetValue = screenValues?.[af.sourceFieldName] as Record<string, unknown> | undefined
    return spreadsheetValue?.[af.attribute]
  }

  // A field with autoFill.mode 'field' mirrors another (possibly cross-
  // section) plain scalar field's current value live, unlike 'spreadsheet'
  // which drills into a sub-attribute of a JSON blob field.
  const resolveCrossFieldAutoFill = (field: TemplateField): unknown => {
    const af = field.autoFill
    if (!af || af.mode !== 'field' || !af.sectionId || !af.screenId || !af.sourceFieldName) return undefined
    const screenValues = allSectionsData[af.sectionId]?.[af.screenId] as Record<string, unknown> | undefined
    return screenValues?.[af.sourceFieldName]
  }

  // Flattened values of every plain (non-table) screen's fields in this
  // section, keyed by field name — lets a cascading dropdown on one screen
  // (e.g. a batch table) filter by a driver field defined on a SIBLING screen
  // (e.g. the antibody dropdown on "Antibody Identity"). Field names are
  // unique across the template, so a flat merge is unambiguous.
  const sectionFieldValues: Record<string, unknown> = {}
  for (const scr of section?.screens ?? []) {
    if (isTableScreen(scr) || isEntryTableScreen(scr) || isExpandableTableScreen(scr)) continue
    Object.assign(sectionFieldValues, (sectionData[scr.id] as Record<string, unknown>) ?? {})
  }

  const resolveFilterValue = (filterByField: string | undefined, localValues: Record<string, unknown>): unknown => {
    if (!filterByField) return undefined
    if (Object.prototype.hasOwnProperty.call(localValues, filterByField)) return localValues[filterByField]
    return sectionFieldValues[filterByField]
  }

  // ATR Request's Sample Details "Batch No." column mirrors the SAME batch
  // already picked on this section's own "Batch Information (table)" screen
  // — never a separate cross-inventory picker. Row 0 only: Sample Details is
  // meant to follow the section's single primary batch. `sectionBatchSku` is
  // the auto-filled "SKU / Pack ID" text; `sectionBatchId` is the real
  // InvBatch.id parsed out of the "Batch (select from stock)" dropdown's
  // stored row_key ("<batchId>-<packId>" or just "<batchId>" — see
  // backend/app/modules/inventory/batches.py's row_key construction).
  const batchInfoScreen = (section?.screens ?? []).find(s => s.title.trim().startsWith('Batch Information'))
  const batchInfoRow0 = (batchInfoScreen ? ((sectionData[batchInfoScreen.id] as Record<string, unknown>[]) ?? [])[0] : undefined) ?? {}
  const batchSelectField = batchInfoScreen?.fields.find(f => f.label === 'Batch (select from stock)')
  const skuField = batchInfoScreen?.fields.find(f => f.label === 'SKU / Pack ID')
  const sectionBatchSku = skuField ? (batchInfoRow0[skuField.name] as string | undefined) : undefined
  const rawBatchRowKey = batchSelectField ? (batchInfoRow0[batchSelectField.name] as string | undefined) : undefined
  const sectionBatchId = (() => {
    if (!rawBatchRowKey) return undefined
    const idPart = String(rawBatchRowKey).split('-')[0]
    const parsed = parseInt(idPart, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  })()

  // When `changedName` (a driver field) gets a new value, any dropdown ELSEWHERE
  // in the section filtered by it (inventorySource.filterByField) now points at
  // a stale list — clear its value (and, within a table screen, its own
  // autoFilled dependent columns) so a wrong-material batch can't linger.
  const cascadeClearCrossScreenDependents = (changedScreenId: string, changedName: string) => {
    for (const otherScreen of section?.screens ?? []) {
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
      if (isTableScreen(otherScreen) || isEntryTableScreen(otherScreen)) {
        const rows = (sectionData[otherScreen.id] as Record<string, unknown>[]) ?? []
        if (rows.length === 0) continue
        handleScreenChange(section!.id, otherScreen.id, rows.map(r => ({ ...r, ...clearPatchFor() })))
      } else {
        const vals = (sectionData[otherScreen.id] as Record<string, unknown>) ?? {}
        handleScreenChange(section!.id, otherScreen.id, { ...vals, ...clearPatchFor() })
      }
    }
  }

  // A NUMBER field with `computation` set adds/subtracts its committed value
  // into another NUMBER field anywhere in the section (row 0 if the target is
  // a table column). One-shot on blur — not continuously recomputed, so
  // re-committing the source field applies the operation again.
  const applyFieldComputation = (field: TemplateField, rawValue: unknown) => {
    const comp = field.computation
    if (!comp || !section) return
    const delta = Number(rawValue)
    if (!Number.isFinite(delta)) return
    const targetScreen = section.screens.find(scr => scr.fields.some(f => f.name === comp.targetFieldName))
    if (!targetScreen) return
    const targetField = targetScreen.fields.find(f => f.name === comp.targetFieldName)!
    if (isTableScreen(targetScreen) || isEntryTableScreen(targetScreen)) {
      const rows = (sectionData[targetScreen.id] as Record<string, unknown>[]) ?? []
      if (rows.length === 0) return
      const base = Number(rows[0][targetField.name] ?? 0)
      const next = comp.operation === 'subtract' ? base - delta : base + delta
      handleScreenChange(section.id, targetScreen.id, rows.map((r, i) => (i === 0 ? { ...r, [targetField.name]: next } : r)))
    } else {
      const vals = (sectionData[targetScreen.id] as Record<string, unknown>) ?? {}
      const base = Number(vals[targetField.name] ?? 0)
      const next = comp.operation === 'subtract' ? base - delta : base + delta
      handleScreenChange(section.id, targetScreen.id, { ...vals, [targetField.name]: next })
    }
  }

  // LOCK_TOGGLE fields: a button that, once clicked, makes every screen
  // ABOVE its own screen (earlier in this section) read-only. State is a
  // plain boolean stashed in sectionData under a synthetic key (not a real
  // screen id), so it autosaves/persists via the normal screen-change path.
  const lockKey = (fieldId: string) => `__lock__${fieldId}`
  const lockButtons = (section?.screens ?? []).flatMap((scr, screenIdx) =>
    scr.fields.filter(f => f.type === 'LOCK_TOGGLE').map(f => ({ field: f, screenIdx })),
  )
  const isScreenLocked = (screenIdx: number) =>
    lockButtons.some(({ field, screenIdx: buttonIdx }) => screenIdx < buttonIdx && !!sectionData[lockKey(field.id)])
  // Target-table columns currently locked read-only by a mirror rule whose
  // driving LOCK_TOGGLE is engaged — independent of isScreenLocked, since the
  // target screen (e.g. Sample Analysis Results) sits AFTER the button and
  // stays otherwise editable; only the mirrored columns themselves lock.
  const mirrorLockedColumns = (screenId: string): Set<string> => {
    const names = new Set<string>()
    for (const { field } of lockButtons) {
      if (!sectionData[lockKey(field.id)]) continue
      for (const rule of field.mirrorOnLock ?? []) {
        if (rule.targetScreenId !== screenId) continue
        for (const c of rule.columns) names.add(c.targetFieldName)
      }
    }
    return names
  }
  const toggleLock = (field: TemplateField) => {
    if (!section) return
    const nowLocked = !sectionData[lockKey(field.id)]
    // Keep a synchronous snapshot for the ATR handoff. React state updates
    // below are asynchronous, so reading sectionData after them could send
    // ARD stale data from immediately before the lock was clicked.
    let finalSectionData = { ...sectionData, [lockKey(field.id)]: nowLocked }
    handleScreenChange(section.id, lockKey(field.id), nowLocked)
    // Mirror rows into their target table(s) once, at the moment of locking
    // (not on unlock) — the source screen becomes read-only right after this,
    // so its rows can't drift from what just got copied.
    if (nowLocked) {
      for (const rule of field.mirrorOnLock ?? []) {
        const sourceRows = (sectionData[rule.sourceScreenId] as Record<string, unknown>[]) ?? []
        const targetRows = (sectionData[rule.targetScreenId] as Record<string, unknown>[]) ?? []
        const mirroredRows = sourceRows.map((srcRow, i) => {
          const patch: Record<string, unknown> = {}
          for (const c of rule.columns) patch[c.targetFieldName] = srcRow[c.sourceFieldName] ?? ''
          return { ...(targetRows[i] ?? {}), ...patch }
        })
        const extraExistingRows = targetRows.slice(sourceRows.length)
        const nextTargetRows = [...mirroredRows, ...extraExistingRows]
        handleScreenChange(section.id, rule.targetScreenId, nextTargetRows)
        finalSectionData = { ...finalSectionData, [rule.targetScreenId]: nextTargetRows }
      }
      if (field.raisesAtr && exp?.id) {
        cgtExperimentApi.raiseAtr(exp.id, {
          section_id: section.id,
          section_title: section.title,
          data_snapshot: finalSectionData,
        })
          .then(atr => message.success(`ATR ${atr.formNo} submitted to ARD for ${section.title}`))
          .catch(() => message.error('The fields were locked, but the ATR could not be submitted to ARD. Please retry.'))
      }
    }
  }

  const scheduleSave = useCallback((sectionId: string, next: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!exp?.id) return
      setSaving(true)
      try {
        await cgtExperimentApi.update(exp.id, { data: { [sectionId]: next } })
        qc.setQueryData(['cgt-experiment', experimentId], (prev: CgtExperiment) => ({
          ...prev,
          data: { ...(prev.data ?? {}), [sectionId]: { ...((prev.data ?? {})[sectionId] ?? {}), ...next } },
        }))
        setDirty(false)
      } finally {
        setSaving(false)
      }
    }, 1200)
  }, [exp?.id, experimentId, qc])

  const handleScreenChange = (sectionId: string, screenId: string, next: unknown) => {
    setLocalData(prev => {
      const prevSection = { ...((exp?.data ?? {})[sectionId] ?? {}), ...((prev ?? {})[sectionId] ?? {}) }
      const nextSection = { ...prevSection, [screenId]: next }
      const merged = { ...(prev ?? {}), [sectionId]: nextSection }
      scheduleSave(sectionId, nextSection)
      return merged
    })
    setDirty(true)
  }

  // Functional partial merge into a screen's value map — used by async mapping
  // autofill so a late fetch result merges onto the latest state, not a stale
  // snapshot captured when the driver changed.
  const patchScreenValues = (sectionId: string, screenId: string, patch: Record<string, unknown>) => {
    setLocalData(prev => {
      const prevSection = { ...((exp?.data ?? {})[sectionId] ?? {}), ...((prev ?? {})[sectionId] ?? {}) }
      const prevScreen = (prevSection[screenId] as Record<string, unknown>) ?? {}
      const nextSection = { ...prevSection, [screenId]: { ...prevScreen, ...patch } }
      scheduleSave(sectionId, nextSection)
      return { ...(prev ?? {}), [sectionId]: nextSection }
    })
    setDirty(true)
  }

  const submitMut = useMutation({
    mutationFn: (password: string) => cgtExperimentApi.submit(exp!.id, { password }),
    onSuccess: e => {
      qc.setQueryData(['cgt-experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      setSignModal(null)
      setSignError(null)
    },
    onError: (err: unknown) => setSignError(err instanceof ApiError ? err.detail : 'Failed to sign'),
  })

  const approveMut = useMutation({
    mutationFn: (password: string) => cgtExperimentApi.approve(exp!.id, { password }),
    onSuccess: e => {
      qc.setQueryData(['cgt-experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      setSignModal(null)
      setSignError(null)
    },
    onError: (err: unknown) => setSignError(err instanceof ApiError ? err.detail : 'Failed to sign'),
  })

  const rejectMut = useMutation({
    mutationFn: () => cgtExperimentApi.reject(exp!.id, { reason: rejectReason, password: rejectPassword }),
    onSuccess: e => {
      qc.setQueryData(['cgt-experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
      setRejectModal(false)
      setRejectReason('')
      setRejectPassword('')
      setRejectError(null)
    },
    onError: (err: unknown) => setRejectError(err instanceof ApiError ? err.detail : 'Failed to reject'),
  })

  const unlockMut = useMutation({
    mutationFn: () => cgtExperimentApi.unlock(exp!.id),
    onSuccess: e => {
      qc.setQueryData(['cgt-experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['cgt-experiments', notebookId] })
    },
  })

  if (isLoading || !nb) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading experiment…" /></div>
  }
  if (!exp) {
    return <div className="p-6 text-slate-500">Experiment not found.</div>
  }
  if (!section) {
    return <div className="p-6 text-slate-500">This notebook's template has no sections.</div>
  }

  const sectionIdx = sections.findIndex(s => s.id === section.id)

  const selectSection = (s: TemplateSection) => {
    setActiveSectionId(s.id)
    setSidebarOpen(false)
  }

  return (
    <div className="relative flex h-full min-h-0">
      {/* ── Mobile top bar: section picker toggle ── */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-2 left-2 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white shadow border border-slate-200 text-xs text-slate-600"
      >
        <Menu size={14} /> Sections
      </button>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar: every section, grouped by phase ── */}
      <div
        className={`w-72 shrink-0 border-r border-slate-200 bg-[#FEFEFA] overflow-y-auto p-3 fixed md:static inset-y-0 left-0 z-50 md:z-auto ${
          sidebarOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
        <button
          onClick={() => navigate(
            isChemist
              ? '/cgt/my-notebooks'
              : isTl
                ? '/cgt/projects'
                : `/cgt/projects/${projectId}/notebooks/${notebookId}`
          )}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 mb-3 transition-colors px-1"
        >
          <ArrowLeft size={13} /> {isChemist || isTl ? 'Back' : 'Notebook'}
        </button>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide px-1 mb-2 truncate" title={nb.template_name ?? ''}>
          {nb.template_name ?? 'Template'}
        </p>

        {groupByPhase(sections).map((group, gi) => (
          <div key={gi} className="mb-2">
            {group.phase && (
              <div className="flex items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-500">
                <ChevronDown size={11} /> {group.phase}
              </div>
            )}
            {group.sections.map(s => {
              const idx = sections.findIndex(x => x.id === s.id)
              const isCurrent = s.id === section.id
              const hasData = Object.keys((exp.data ?? {})[s.id] ?? {}).length > 0
              return (
                <button
                  key={s.id}
                  onClick={() => selectSection(s)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs mb-0.5 transition-colors flex items-center gap-1.5 ${
                    isCurrent ? 'bg-violet-100 text-violet-800 font-semibold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="opacity-50 shrink-0">{idx + 1}.</span>
                  <span className="truncate flex-1">{s.title}</span>
                  {!hasData && <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" title="Not started" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4 pt-14 sm:p-6 md:pt-6">
        <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
          <div className="glass-card rounded-2xl p-4 mb-4" style={{ backgroundColor: '#FEFEFA' }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400">Section {sectionIdx + 1} of {sections.length}</span>
                  <span className="  text-xs text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{exp.full_code}</span>
                  <Tag color={STATUS_COLOR[exp.status] ?? 'default'}>{exp.status}</Tag>
                  {saving && <span className="text-xs text-slate-400 animate-pulse flex items-center gap-1"><Clock size={11} /> Saving…</span>}
                  {dirty && !saving && <span className="text-xs text-amber-500">Unsaved changes</span>}
                  {!dirty && !saving && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle size={11} /> Saved</span>}
                </div>
                <h1 className="text-lg font-bold text-slate-800">{section.title}</h1>
              </div>

              {exp.status === 'DRAFT' && isChemist && !exp.frozen_at && (
                <Button
                  type="primary" size="small" icon={<Send size={13} />}
                  onClick={() => { setSignError(null); setSignModal('submit') }} loading={submitMut.isPending} disabled={dirty}
                >
                  Chemist Signature
                </Button>
              )}
              {exp.status === 'SUBMITTED' && isApprover && !exp.frozen_at && (
                <>
                  <Button
                    type="primary" size="small" icon={<ThumbsUp size={13} />}
                    className="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700"
                    onClick={() => { setSignError(null); setSignModal('approve') }}
                  >
                    HOD Signature
                  </Button>
                  <Button
                    danger size="small" icon={<ThumbsDown size={13} />}
                    onClick={() => { setRejectError(null); setRejectModal(true) }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {(exp.status === 'APPROVED' || exp.status === 'REJECTED') && isApprover && !exp.frozen_at && (
                <Button
                  size="small" icon={<Unlock size={13} />}
                  onClick={() => unlockMut.mutate()} loading={unlockMut.isPending}
                >
                  Unlock
                </Button>
              )}
            </div>
          </div>

          {exp.rejection_reason && exp.status === 'REJECTED' && (
            <Alert
              type="error"
              showIcon
              className="mb-4"
              message="Rejected"
              description={exp.rejection_reason}
            />
          )}

          {exp.frozen_at && (
            <Alert
              type="warning"
              showIcon
              className="mb-4"
              message="Frozen"
              description="This experiment is frozen — its Notebook is closed or deactivated, so it can no longer be edited, submitted, or reviewed."
            />
          )}

          {/* All of this section's screens, stacked one after another — no tabs */}
          <div className="space-y-4">
            {section.screens.map((screenObj, screenIdx) => {
              const screenDisabled = !editable || isScreenLocked(screenIdx)
              return (
              <div key={screenObj.id} className="glass-card rounded-2xl p-5" style={{ backgroundColor: '#FEFEFA' }}>
                <h2 className="text-base font-semibold text-slate-800 mb-5">{cleanTitle(screenObj.title)}</h2>

                {isExpandableTableScreen(screenObj) ? (
                  <CgtExpandableTableField
                    fixedColumns={screenObj.fields}
                    data={(sectionData[screenObj.id] as ExpandableTableData) ?? { colCount: 1, rows: [] }}
                    onChange={d => handleScreenChange(section.id, screenObj.id, d)}
                    disabled={screenDisabled}
                    colPrefix={expandableColPrefix(screenObj)}
                  />
                ) : isTableScreen(screenObj) || isEntryTableScreen(screenObj) ? (
                  <CgtTableField
                    columns={screenObj.fields}
                    value={(sectionData[screenObj.id] as Record<string, unknown>[]) ?? []}
                    onChange={rows => handleScreenChange(section.id, screenObj.id, rows)}
                    onDriverChange={name => cascadeClearCrossScreenDependents(screenObj.id, name)}
                    externalValues={sectionFieldValues}
                    variant={isEntryTableScreen(screenObj) ? 'entry' : 'table'}
                    disabled={screenDisabled}
                    lockedColumns={mirrorLockedColumns(screenObj.id)}
                    resolveRowOptions={resolveRowOptions}
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: screenObj.columns === 2 ? '1fr 1fr' : '1fr', gap: '14px 24px' }}>
                    {/* Hidden fields (e.g. a mirrored catalogue id feeding a
                        Usage Log field's usageLogConfig.idFieldName) are
                        skipped here but stay in screenObj.fields, which is
                        what autoFill below reads — so they still compute and
                        hold a value without ever being shown. */}
                    {screenObj.fields.filter(field => !field.hidden).map(field => {
                      const screenValues = (sectionData[screenObj.id] as Record<string, unknown>) ?? {}
                      const isFullWidth = field.type === 'SECTION_HEADING' || field.type === 'SPACER' || field.type === 'LOCK_TOGGLE' || field.type === 'MULTI_LINE_TEXT' || field.type === 'RICH_TEXT' || field.type === 'SPREADSHEET' || field.type === 'REPEATING_GROUP' || field.type === 'ATR_REQUEST' || field.colSpan === 2
                      if (field.type === 'REPEATING_GROUP') {
                        const items = (screenValues[field.name] as Record<string, unknown>[]) ?? []
                        return (
                          <div key={field.id} style={{ gridColumn: 'span 2' }}>
                            <RepeatingGroupField
                              field={field}
                              items={items}
                              onChange={next =>
                                handleScreenChange(section.id, screenObj.id, { ...screenValues, [field.name]: next })
                              }
                              disabled={screenDisabled}
                              resolveRowOptions={resolveRowOptions}
                            />
                          </div>
                        )
                      }
                      if (field.type === 'LOCK_TOGGLE') {
                        const locked = !!sectionData[lockKey(field.id)]
                        return (
                          <div key={field.id} style={{ gridColumn: 'span 2' }}>
                            <Button
                              icon={locked ? <Unlock size={13} /> : <Lock size={13} />}
                              danger={locked}
                              disabled={!editable}
                              onClick={() => toggleLock(field)}
                            >
                              {locked ? `Unlock ${field.label || 'Fields Above'}` : (field.label || 'Lock Fields Above')}
                            </Button>
                            {field.helpText && <p className="text-[11px] text-slate-400 mt-1">{field.helpText}</p>}
                          </div>
                        )
                      }
                      return (
                        <div key={field.id} style={{ gridColumn: isFullWidth ? 'span 2' : undefined }}>
                          {field.type !== 'SECTION_HEADING' && field.type !== 'SPACER' && field.type !== 'ATR_REQUEST' && (
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                          )}
                          <CgtFieldControl
                            field={field}
                            value={
                              field.autoFill?.mode === 'spreadsheet' ? resolveSpreadsheetAutoFill(field)
                              : field.autoFill?.mode === 'field' ? resolveCrossFieldAutoFill(field)
                              : screenValues[field.name]
                            }
                            filterValue={resolveFilterValue(field.inventorySource?.filterByField, screenValues)}
                            rowOptions={field.optionsMode === 'screenRows' ? resolveRowOptions(field) : undefined}
                            onChange={v => {
                              let merged = applyRowAutoFill(field, v,
                                applyAutoFill(qc, screenObj.fields, field, v, { ...screenValues, [field.name]: v }),
                                screenObj.fields)
                              // Changing a material invalidates any cascading batch dropdown
                              // filtered by it (same screen) — clear those so a stale batch
                              // can't linger. Cross-screen dependents (e.g. a batch table on
                              // a sibling screen) are cleared separately, below.
                              for (const f of screenObj.fields) {
                                if (f.inventorySource?.filterByField === field.name) merged = { ...merged, [f.name]: '' }
                              }
                              handleScreenChange(section.id, screenObj.id, merged)
                              void resolveMappingAutoFills(qc, screenObj.fields, field, merged,
                                patch => patchScreenValues(section.id, screenObj.id, patch))
                              cascadeClearCrossScreenDependents(screenObj.id, field.name)
                            }}
                            onBlur={field.computation ? () => applyFieldComputation(field, screenValues[field.name]) : undefined}
                            disabled={screenDisabled}
                            experimentId={exp?.id}
                            sectionBatchSku={sectionBatchSku}
                            sectionBatchId={sectionBatchId}
                            atrOrigin={{
                              originModule: 'CGT',
                              originProjectId: nb?.cgt_project_id,
                              originProjectCode: nb?.project_code,
                              originProjectName: nb?.project_name,
                              originNotebookId: nb?.id,
                              originNotebookCode: nb?.code,
                              originExperimentCode: exp?.full_code,
                              sectionId: section.id,
                              sectionTitle: section.title,
                            }}
                          />
                          {field.helpText && <p className="text-[11px] text-slate-400 mt-1">{field.helpText}</p>}
                        </div>
                      )
                    })}
                    {screenObj.fields.length === 0 && <p className="text-xs text-slate-300 col-span-full">No fields on this screen.</p>}
                  </div>
                )}
              </div>
              )
            })}
            {section.screens.length === 0 && <p className="text-xs text-slate-300">No screens in this section.</p>}
          </div>

          {sectionIdx < sections.length - 1 && (
            <div className="flex justify-end mt-4">
              <Button
                type="primary"
                icon={<ArrowRight size={14} />}
                iconPosition="end"
                className="rounded-md font-medium"
                onClick={() => selectSection(sections[sectionIdx + 1])}
              >
                Next: {sections[sectionIdx + 1].title}
              </Button>
            </div>
          )}
        </div>
      </div>

      <PasswordSignatureModal
        open={signModal === 'submit'}
        title="Chemist Signature"
        message="By signing, you confirm all data in this experiment is accurate and complete."
        loading={submitMut.isPending}
        error={signError}
        onSign={password => submitMut.mutate(password)}
        onCancel={() => setSignModal(null)}
      />

      <PasswordSignatureModal
        open={signModal === 'approve'}
        title="HOD Signature"
        message="By approving, you verify and endorse the data recorded in this experiment."
        loading={approveMut.isPending}
        error={signError}
        onSign={password => approveMut.mutate(password)}
        onCancel={() => setSignModal(null)}
      />

      <Modal
        open={rejectModal}
        title="Reject Experiment"
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() || !rejectPassword }}
        onOk={() => rejectMut.mutate()}
        onCancel={() => { setRejectModal(false); setRejectReason(''); setRejectPassword(''); setRejectError(null) }}
        confirmLoading={rejectMut.isPending}
        centered
        destroyOnHidden
      >
        <div className="py-2 space-y-3">
          {rejectError && <Alert type="error" showIcon message={rejectError} />}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Reason for rejection</label>
            <Input.TextArea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this experiment is being rejected."
              maxLength={500}
              showCount
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Password</label>
            <Input.Password
              value={rejectPassword}
              onChange={e => setRejectPassword(e.target.value)}
              placeholder="Enter your password to sign"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
