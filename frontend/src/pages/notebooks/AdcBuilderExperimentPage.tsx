import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tag, Spin, Modal, Input, Alert, message } from 'antd'
import { Signature, Clock, CheckCircle, ChevronDown, ThumbsUp, ThumbsDown, Unlock, ArrowLeft, ArrowRight, Lock, Menu, X } from 'lucide-react'
import { notebookApi, experimentApi, type Experiment, type SectionSignature } from '../../api/adc'
import { ApiError } from '../../api/client'
import ESignatureModal from '../adc/components/ESignatureModal'
import PasswordSignatureModal from '../cgt/components/PasswordSignatureModal'
import type { TemplateDefinition, TemplateField, TemplateScreen, TemplateSection } from '../admin/templateBuilder/types'
import CgtFieldControl from '../cgt/components/CgtFieldControl'
import CgtTableField from '../cgt/components/CgtTableField'
import CgtExpandableTableField, { type ExpandableTableData } from '../cgt/components/CgtExpandableTableField'
import { applyAutoFill, resolveMappingAutoFills } from '../admin/templateBuilder/useInventoryOptions'
import { useCan } from '../../hooks/usePrivilege'
import { useIsAdcAssignedOnly } from '../../hooks/useAdcLanding'

// Renders a builder-authored (section/screen/field, id-keyed) template inside
// the ADC module's own notebook/experiment tables — same UI/UX as
// CgtSectionPage (pages/cgt/CgtSectionPage.tsx), but backed by the ADC api
// (/api/notebooks, /api/experiments) since notebooks created from an ADC
// project store their data there, not in the separate cgt-* tables. Used for
// any ADC notebook whose workflow template is builder-authored (e.g. the
// CGT_ADC-category "ADC Synthesis" template) instead of the legacy
// hardcoded-screen ExperimentDetailPage.

const isTableScreen = (s: TemplateScreen) => /\(table\)\s*$/i.test(s.title.trim())
const isEntryTableScreen = (s: TemplateScreen) => /\(entry\s+table\)\s*$/i.test(s.title.trim())
const isExpandableTableScreen = (s: TemplateScreen) => /\(expandable\s+table(?:\s+[A-Z])?\)\s*$/i.test(s.title.trim())
const expandableColPrefix = (s: TemplateScreen): string => {
  const m = s.title.match(/\(expandable\s+table(?:\s+([A-Z]))?\)/i)
  return (m?.[1] ?? 'f').toLowerCase()
}
const cleanTitle = (title: string) => title.replace(/\s*\((?:entry\s+|expandable\s+(?:[A-Z]\s+)?)?table\)\s*$/i, '').trim()

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

function groupByPhase(sections: TemplateSection[]) {
  const groups: { phase?: string; sections: TemplateSection[] }[] = []
  for (const s of sections) {
    const last = groups[groups.length - 1]
    if (last && last.phase === s.phase && s.phase !== undefined) last.sections.push(s)
    else groups.push({ phase: s.phase, sections: [s] })
  }
  return groups
}

// SIGNATURE field: "Done By" (chemist) / "Checked By" (TL), each requiring a
// password re-entry (same e-signature convention as CGT's submit/approve —
// see PasswordSignatureModal). Stored at the SECTION level under a reserved
// key (see SIGNATURE_SECTION_KEY in the backend), not tied to any one
// screen, so it reads back correctly regardless of which screen the field
// itself sits on. Whichever section contains this field type has its "Next"
// button gated on both being signed — see `sectionHasSignature` below.
const SIGNATURE_SECTION_KEY = '__section_signature__'

function SectionSignatureControl({ experimentId, sectionId, signature, disabled, canSignDone, canSignChecked, onSigned }: {
  experimentId: string
  sectionId: string
  signature: SectionSignature | undefined
  disabled?: boolean
  canSignDone: boolean
  canSignChecked: boolean
  onSigned: (exp: Experiment) => void
}) {
  const [stage, setStage] = useState<'done' | 'checked' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signMut = useMutation({
    mutationFn: (password: string) => experimentApi.signSection(experimentId, sectionId, { stage: stage!, password }),
    onSuccess: exp => { onSigned(exp); setStage(null); setError(null) },
    onError: (e: unknown) => setError(e instanceof ApiError ? e.detail : 'Could not sign — please try again.'),
  })

  const doneEntry = signature?.doneBy
  const checkedEntry = signature?.checkedBy

  return (
    <div className="flex flex-wrap items-center gap-4 border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <Button
          size="middle"
          icon={<Signature size={13} />}
          disabled={disabled || !!doneEntry || !canSignDone}
          onClick={() => { setStage('done'); setError(null) }}
        >
          Done By
        </Button>
        {doneEntry && (
          <span className="text-xs text-slate-500">
            <CheckCircle size={12} className="inline text-green-500 mr-1" />
            {doneEntry.name} · {new Date(doneEntry.at).toLocaleString()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="middle"
          icon={<Signature size={13} />}
          disabled={disabled || !doneEntry || !!checkedEntry || !canSignChecked}
          onClick={() => { setStage('checked'); setError(null) }}
        >
          Checked By
        </Button>
        {checkedEntry && (
          <span className="text-xs text-slate-500">
            <CheckCircle size={12} className="inline text-green-500 mr-1" />
            {checkedEntry.name} · {new Date(checkedEntry.at).toLocaleString()}
          </span>
        )}
      </div>
      {!doneEntry && !canSignDone && <span className="text-[11px] text-slate-400 italic">Waiting on the performer to sign "Done By".</span>}
      {doneEntry && !checkedEntry && !canSignChecked && <span className="text-[11px] text-slate-400 italic">Waiting on a reviewer to sign "Checked By".</span>}

      <PasswordSignatureModal
        open={stage !== null}
        title={stage === 'done' ? 'Chemist Signature — Done By' : 'Team Lead Signature — Checked By'}
        message={stage === 'done'
          ? 'By signing, you confirm this section is complete and accurate.'
          : 'By signing, you verify this section has been reviewed.'}
        loading={signMut.isPending}
        error={error}
        onSign={password => signMut.mutate(password)}
        onCancel={() => { setStage(null); setError(null) }}
      />
    </div>
  )
}

function RepeatingGroupField({ field, items, onChange, disabled, resolveRowOptions, experimentId }: {
  field: TemplateField
  items: Record<string, unknown>[]
  onChange: (next: Record<string, unknown>[]) => void
  disabled?: boolean
  // DROPDOWN sub-fields with optionsMode 'screenRows' need the same
  // whole-run resolver top-level screen fields use — passed down from the
  // page rather than recomputed here, since it reads every section's saved
  // data, not just this repeating group's own.
  resolveRowOptions: (field: TemplateField) => { value: string; label: string; row: Record<string, unknown> }[]
  experimentId?: string    // ATTACHMENT/IMAGE sub-fields need this for real uploads
}) {
  const { repeatConfig } = field
  if (!repeatConfig) return null
  const { addButtonLabel = 'Add item', itemLabel = 'Item', screens = [] } = repeatConfig

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
                      experimentId={experimentId}
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
                          experimentId={experimentId}
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

export default function AdcBuilderExperimentPage() {
  const { projectId, notebookId, experimentId } = useParams<{
    projectId: string; notebookId: string; experimentId: string
  }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const canEdit         = useCan('adc.experiment.edit')
  const canSubmit       = useCan('adc.experiment.submit')
  const canApprove      = useCan('adc.experiment.approve')
  const canReject       = useCan('adc.experiment.reject')
  const canUnlock       = useCan('adc.experiment.unlock')
  const canSignDone     = useCan('adc.experiment.sign_done')
  const canSignChecked  = useCan('adc.experiment.sign_checked')
  // Users whose home is the assigned-only view go back there rather than to a
  // project browser they can't open.
  const assignedOnly = useIsAdcAssignedOnly()

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [localData, setLocalData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signModal, setSignModal] = useState<'submit' | 'approve' | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: nb } = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn: () => notebookApi.get(notebookId!),
    enabled: !!notebookId,
  })
  const snapshot = nb?.template_snapshot as TemplateDefinition | null | undefined
  const sections: TemplateSection[] = snapshot?.sections ?? []

  const { data: exp, isLoading } = useQuery({
    queryKey: ['experiment', experimentId],
    queryFn: () => experimentApi.get(experimentId!),
    enabled: !!experimentId,
  })

  const section = sections.find(s => s.id === (activeSectionId ?? sections[0]?.id)) ?? sections[0]
  // Privilege says "may you", status says "is it currently changeable".
  const editable = canEdit && (exp ? exp.status === 'DRAFT' || exp.status === 'REJECTED' : false)

  const sectionData: Record<string, unknown> = {
    ...((exp?.data ?? {})[section?.id ?? ''] ?? {}),
    ...((localData ?? {})[section?.id ?? ''] ?? {}),
  }

  const allSectionsData: Record<string, Record<string, unknown>> = {}
  for (const s of sections) {
    allSectionsData[s.id] = { ...((exp?.data ?? {})[s.id] ?? {}), ...((localData ?? {})[s.id] ?? {}) }
  }

  // Chemist Signature (submit) is only enabled once EVERY section that has a
  // Signature field has both "Done By" and "Checked By" signed — not just
  // the section currently being viewed.
  const allSectionsSigned = sections.every(s => {
    const hasSignature = s.screens.some(scr => scr.fields.some(f => f.type === 'SIGNATURE'))
    if (!hasSignature) return true
    const sig = allSectionsData[s.id]?.[SIGNATURE_SECTION_KEY] as SectionSignature | undefined
    return !!sig?.doneBy && !!sig?.checkedBy
  })

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
  // — never a separate cross-inventory picker. Row 0 only. See the matching
  // derivation (with the fuller comment) in CgtSectionPage.tsx.
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

  const lockKey = (fieldId: string) => `__lock__${fieldId}`
  const lockButtons = (section?.screens ?? []).flatMap((scr, screenIdx) =>
    scr.fields.filter(f => f.type === 'LOCK_TOGGLE').map(f => ({ field: f, screenIdx })),
  )
  const isScreenLocked = (screenIdx: number) =>
    lockButtons.some(({ field, screenIdx: buttonIdx }) => screenIdx < buttonIdx && !!sectionData[lockKey(field.id)])
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
    // Track the section's final data locally (not just via handleScreenChange,
    // which updates React state asynchronously) so raiseAtr below can send an
    // accurate snapshot including this same click's own lock flag + mirrored
    // rows, rather than reading stale `sectionData` from before this click.
    let finalSectionData = { ...sectionData, [lockKey(field.id)]: nowLocked }
    handleScreenChange(section.id, lockKey(field.id), nowLocked)
    if (nowLocked) {
      for (const rule of field.mirrorOnLock ?? []) {
        const sourceRows = (finalSectionData[rule.sourceScreenId] as Record<string, unknown>[]) ?? []
        const targetRows = (finalSectionData[rule.targetScreenId] as Record<string, unknown>[]) ?? []
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
        experimentApi.raiseAtr(exp.id, {
          section_id: section.id, section_title: section.title, data_snapshot: finalSectionData,
        })
          .then(atr => message.success(`ATR ${atr.atr_no} raised for ${section.title}`))
          .catch(() => message.error('Failed to raise ATR — the fields are locked, but no ATR was recorded. Please retry.'))
      }
    }
  }

  const scheduleSave = useCallback((sectionId: string, next: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!exp?.id) return
      setSaving(true)
      try {
        await experimentApi.update(exp.id, { data: { [sectionId]: next } })
        qc.setQueryData(['experiment', experimentId], (prev: Experiment) => ({
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
    mutationFn: (reason: string) => experimentApi.submit(exp!.id, { sign_reason: reason }),
    onSuccess: e => {
      qc.setQueryData(['experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const approveMut = useMutation({
    mutationFn: (reason: string) => experimentApi.approve(exp!.id, { sign_reason: reason }),
    onSuccess: e => {
      qc.setQueryData(['experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const rejectMut = useMutation({
    mutationFn: () => experimentApi.reject(exp!.id, { reason: rejectReason }),
    onSuccess: e => {
      qc.setQueryData(['experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setRejectModal(false)
      setRejectReason('')
    },
  })

  const unlockMut = useMutation({
    mutationFn: () => experimentApi.unlock(exp!.id),
    onSuccess: e => {
      qc.setQueryData(['experiment', experimentId], e)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
    },
  })

  if (isLoading || !nb) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
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
            assignedOnly
              ? '/adc/my-notebooks'
              : (projectId ? `/adc/projects/${projectId}/notebooks/${notebookId}` : `/notebooks/${notebookId}/overview`)
          )}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 mb-3 transition-colors px-1"
        >
          <ArrowLeft size={13} /> {assignedOnly ? 'Back' : 'Notebook'}
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
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs text-slate-400">Section {sectionIdx + 1} of {sections.length}</span>
                  <span className="text-xs text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{exp.full_code}</span>
                  <Tag color={STATUS_COLOR[exp.status] ?? 'default'}>{exp.status}</Tag>
                  {saving && <span className="text-xs text-slate-400 animate-pulse flex items-center gap-1"><Clock size={11} /> Saving…</span>}
                  {dirty && !saving && <span className="text-xs text-amber-500">Unsaved changes</span>}
                  {!dirty && !saving && <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle size={11} /> Saved</span>}
                </div>
                <h1 className="text-lg font-bold text-slate-800">{section.title}</h1>
              </div>

              {exp.status === 'DRAFT' && canSubmit && (
                <Button
                  type="primary" size="middle" icon={<Signature size={13} />}
                  onClick={() => setSignModal('submit')} loading={submitMut.isPending}
                  disabled={dirty || !allSectionsSigned}
                  title={!allSectionsSigned ? 'Every section with a Signature field must have both "Done By" and "Checked By" signed first.' : undefined}
                  className="rounded-md font-medium"
                >
                  Chemist Signature
                </Button>
              )}
              {exp.status === 'SUBMITTED' && (canApprove || canReject) && (
                <div className="flex items-center gap-2">
                  {canApprove && (
                    <Button
                      type="primary" size="middle" icon={<ThumbsUp size={13} />}
                      className="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700"
                      onClick={() => setSignModal('approve')}
                    >
                      Approver Signature
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      danger size="middle" icon={<ThumbsDown size={13} />}
                      onClick={() => setRejectModal(true)}
                    >
                      Reject
                    </Button>
                  )}
                </div>
              )}
              {(exp.status === 'APPROVED' || exp.status === 'REJECTED') && canUnlock && (
                <Button
                  size="small" icon={<Unlock size={13} />}
                  onClick={() => unlockMut.mutate()} loading={unlockMut.isPending}
                >
                  Unlock
                </Button>
              )}
            </div>
          </div>

          {/* All of this section's screens, stacked one after another — no tabs */}
          <div className="space-y-4">
            {section.screens.map((screenObj, screenIdx) => {
              const screenDisabled = !editable || isScreenLocked(screenIdx)
              return (
              <div key={screenObj.id} className="glass-card rounded-2xl p-5" style={{ backgroundColor: '#FEFEFA' }}>
                <h2 className="text-base font-semibold text-slate-800 mb-5">{cleanTitle(screenObj.title)}</h2>

                {isTableScreen(screenObj) || isEntryTableScreen(screenObj) || isExpandableTableScreen(screenObj) ? (
                  <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
                    {isExpandableTableScreen(screenObj) ? (
                      <CgtExpandableTableField
                        fixedColumns={screenObj.fields}
                        data={(sectionData[screenObj.id] as ExpandableTableData) ?? { colCount: 1, rows: [] }}
                        onChange={d => handleScreenChange(section.id, screenObj.id, d)}
                        disabled={screenDisabled}
                        colPrefix={expandableColPrefix(screenObj)}
                        experimentId={exp.id}
                      />
                    ) : (
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
                        experimentId={exp.id}
                      />
                    )}
                  </div>
                ) : (
                  <div className={`grid gap-3.5 sm:gap-6 ${screenObj.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {screenObj.fields.map(field => {
                      const screenValues = (sectionData[screenObj.id] as Record<string, unknown>) ?? {}
                      const isFullWidth = field.type === 'SECTION_HEADING' || field.type === 'SPACER' || field.type === 'LOCK_TOGGLE' || field.type === 'MULTI_LINE_TEXT' || field.type === 'RICH_TEXT' || field.type === 'SPREADSHEET' || field.type === 'REPEATING_GROUP' || field.type === 'SIGNATURE' || field.type === 'ATR_REQUEST' || field.colSpan === 2
                      if (field.type === 'SIGNATURE') {
                        return (
                          <div key={field.id} style={{ gridColumn: 'span 2' }}>
                            <SectionSignatureControl
                              experimentId={exp.id}
                              sectionId={section.id}
                              signature={sectionData[SIGNATURE_SECTION_KEY] as SectionSignature | undefined}
                              disabled={!editable}
                              canSignDone={canSignDone}
                              canSignChecked={canSignChecked}
                              onSigned={updated => qc.setQueryData(['experiment', experimentId], updated)}
                            />
                          </div>
                        )
                      }
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
                              experimentId={exp.id}
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
                            experimentId={exp.id}
                            sectionBatchSku={sectionBatchSku}
                            sectionBatchId={sectionBatchId}
                            atrOrigin={{
                              originModule: 'ADC',
                              originProjectId: nb?.project_id,
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

          {sectionIdx < sections.length - 1 && (() => {
            const sectionHasSignature = section.screens.some(scr => scr.fields.some(f => f.type === 'SIGNATURE'))
            const sig = sectionData[SIGNATURE_SECTION_KEY] as SectionSignature | undefined
            const sectionFullySigned = !!sig?.doneBy && !!sig?.checkedBy
            const nextBlocked = sectionHasSignature && !sectionFullySigned
            return (
            <div className="flex flex-col items-end gap-1.5 mt-4">
              {nextBlocked && (
                <span className="text-[11px] text-slate-400 italic">
                  Both "Done By" and "Checked By" must be signed before moving on.
                </span>
              )}
              <Button
                type="primary"
                icon={<ArrowRight size={14} />}
                iconPosition="end"
                className="rounded-md font-medium"
                disabled={nextBlocked}
                onClick={() => selectSection(sections[sectionIdx + 1])}
              >
                Next: {sections[sectionIdx + 1].title}
              </Button>
            </div>
            )
          })()}
        </div>
      </div>

      <ESignatureModal
        open={signModal === 'submit'}
        title="Chemist Signature"
        message="By signing, you confirm all data in this experiment is accurate and complete."
        loading={submitMut.isPending}
        onSign={reason => submitMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      <ESignatureModal
        open={signModal === 'approve'}
        title="Approver Signature"
        message="By approving, you verify and endorse the data recorded in this experiment."
        loading={approveMut.isPending}
        onSign={reason => approveMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      <Modal
        open={rejectModal}
        title="Reject Experiment"
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        onOk={() => rejectMut.mutate()}
        onCancel={() => { setRejectModal(false); setRejectReason('') }}
        confirmLoading={rejectMut.isPending}
        centered
        destroyOnHidden
      >
        <div className="py-2 space-y-3">
          {rejectMut.isError && <Alert type="error" showIcon message="Failed to reject" />}
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
        </div>
      </Modal>
    </div>
  )
}
