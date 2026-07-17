import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tag, Spin, Tabs, Alert, Modal, Input, Tooltip, message } from 'antd'
import {
  ArrowLeft, CheckCircle, Clock, AlertCircle, Send, ThumbsUp, ThumbsDown,
  Unlock, History, Save, ChevronRight,
} from 'lucide-react'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import FieldRenderer, { type TemplateField } from './components/FieldRenderer'
import ESignatureModal from './components/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import { BTN_32 } from '../../utils/buttonSize'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

// Chemists submit for review; leads/HOD approve or reject (HOD already covers
// the old QA-role admin, now modeled as HOD + QA department).
const APPROVER_ROLES = new Set(['TL', 'HOD'])

// Only HOD/Team Lead can create Projects/Notebooks/Experiments — this also
// gates the auto-create-on-first-visit below, since that's still "creating".
const CREATOR_ROLES = new Set(['HOD', 'TL'])

interface TemplateScreen  { key: string; title: string; fields: TemplateField[] }
interface TemplateSection { key: string; title: string; screens: TemplateScreen[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const STATUS_COLOR: Record<string, string>   = { DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red' }
const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:     <Clock size={14} />,
  SUBMITTED: <Clock size={14} className="text-amber-500" />,
  APPROVED:  <CheckCircle size={14} className="text-emerald-500" />,
  REJECTED:  <AlertCircle size={14} className="text-red-500" />,
}

const EDITABLE_STATUSES = new Set(['DRAFT', 'REJECTED'])

export default function AdcSectionPage() {
  const { projectId, notebookId, sectionKey } = useParams<{
    projectId: string; notebookId: string; sectionKey: string
  }>()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const user     = useAppSelector(selectUser)
  const canCreateExperiment = CREATOR_ROLES.has(user?.role_code ?? '')

  const [activeScreen, setActiveScreen] = useState<string | null>(null)
  const [localData,    setLocalData]    = useState<Record<string, Record<string, unknown>> | null>(null)
  const [dirty,        setDirty]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [signModal,    setSignModal]    = useState<'submit' | 'approve' | null>(null)
  const [rejectModal,  setRejectModal]  = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [historyOpen,  setHistoryOpen]  = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch notebook for template snapshot
  const { data: nb } = useQuery({
    queryKey: ['adc-notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })
  const snapshot = nb?.template_snapshot as TemplateSnapshot | null | undefined
  const section  = snapshot?.sections?.find(s => s.key === sectionKey)

  useBreadcrumbLabel(notebookId ?? '', nb?.title ?? nb?.code ?? null)
  useBreadcrumbLabel(sectionKey ?? '', section?.title ?? null)

  // Fetch or create experiment for this section
  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['adc-experiments', notebookId, sectionKey],
    queryFn:  async () => {
      const list = await experimentApi.listForNotebook(notebookId!, sectionKey)
      // Chemists/Analysts can't create experiments — only work on ones already
      // created (by HOD/TL) and assigned to them. Leave the list empty rather
      // than attempting a create the backend would 403 on anyway.
      if (list.length === 0 && canCreateExperiment) {
        const created = await experimentApi.createForNotebook(notebookId!, {
          section_key: sectionKey!,
          title: section?.title ?? '',
        })
        qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId] })
        return [created]
      }
      return list
    },
    enabled: !!notebookId && !!sectionKey && !!section,
  })
  const exp: Experiment | undefined = experiments[0]

  // Merge local overrides onto server data
  const _effectiveData: Record<string, Record<string, unknown>> = {
    ...(exp?.data ?? {}),
    ...(localData ?? {}),
  }

  // ── Intermediate ID lineage chain ────────────────────────────────────────────
  // 3.1 → 3.4 → 3.5 → 3.6 → 4.1 → 4.2. Each step's input ID carries the previous
  // step's generated output ID; each output ID is deterministic from the exp code.
  // Derived inline so the fields display instantly (never blank) on every render.
  // NOTE: in this per-section page, screens 4.x live in a different experiment, so
  // the 3.6→4.1 link only resolves when both are present in this experiment's data.
  const _code = exp?.full_code ?? ''
  const _asText = (v: unknown): string =>
    Array.isArray(v) ? (v as string[]).join(', ') : ((v as string) ?? '')

  const _tpf  = _effectiveData['mfg_thaw_pool_filter'] ?? {}
  const _red  = _effectiveData['mfg_reduction']        ?? {}
  const _conj = _effectiveData['mfg_conjugation']      ?? {}
  const _qnch = _effectiveData['mfg_quench']           ?? {}
  const _pur  = _effectiveData['pur_purification']     ?? {}
  const _ufdf = _effectiveData['pur_ufdf']             ?? {}

  const _tpfOut  = (_tpf['intermediate_output_id'] as string) || (_code ? `${_code}-TPF`   : '')
  const _redOut  = (_red['output_id']  as string) || (_code ? `${_code}-RED`   : '')
  const _conjOut = (_conj['output_id'] as string) || (_code ? `${_code}-CRUDE` : '')
  const _qnchOut = (_qnch['output_id'] as string) || (_code ? `${_code}-ADC`   : '')
  const _purOut  = (_pur['output_id']  as string) || (_code ? `${_code}-PUR`   : '')
  const _ufdfOut = (_ufdf['output_id'] as string) || (_code ? `${_code}-UFDF`  : '')

  const effectiveData: Record<string, Record<string, unknown>> = {
    ..._effectiveData,
    mfg_thaw_pool_filter: {
      ..._tpf,
      intermediate_output_id: _tpfOut,
    },
    mfg_reduction: (() => {
      const parentLots = (_red['parent_lots'] as string) || _asText(_tpf['parent_samples'])
      return {
        ..._red,
        intermediate_input_id:   (_red['intermediate_input_id'] as string) || _tpfOut,
        parent_lots:             parentLots,
        red_available_volume_ul: _red['red_available_volume_ul'] ?? _tpf['volume_registered_ul'] ?? '',
        output_id:               _redOut,
        parent_sample:           (_red['parent_sample'] as string) || parentLots,
        reagent_lot_linked:      (_red['reagent_lot_linked'] as string) || _asText(_red['tcep_lot']),
      }
    })(),
    mfg_conjugation: {
      ..._conj,
      intermediate_input_id:     (_conj['intermediate_input_id'] as string) || _redOut,
      parent_lineage:            (_red['parent_sample'] as string) || _redOut,
      conj_available_volume_ul:  _conj['conj_available_volume_ul'] ?? _red['red_volume_registered_ul'] ?? '',
      output_id:                 _conjOut,
      parent_sample:             (_red['parent_sample'] as string) || _redOut,
      reagent_lots_linked:       (_conj['reagent_lots_linked'] as string) || _asText(_conj['lp_lot']),
    },
    mfg_quench: {
      ..._qnch,
      intermediate_input_id: (_qnch['intermediate_input_id'] as string) || _conjOut,
      parent_lineage:        (_red['parent_sample'] as string) || _conjOut,
      output_id:             _qnchOut,
      parent_sample:         (_red['parent_sample'] as string) || _conjOut,
      reagent_lots_linked:   (_qnch['reagent_lots_linked'] as string) || _asText(_qnch['nac_lot']),
    },
    pur_purification: {
      ..._pur,
      intermediate_input_id: (_pur['intermediate_input_id'] as string) || _qnchOut,
      parent_lineage:        (_red['parent_sample'] as string) || _qnchOut,
      output_id:             _purOut,
      parent_sample:         (_red['parent_sample'] as string) || _qnchOut,
      resin_lot_linked:      (_pur['resin_lot_linked'] as string) || _asText(_pur['resin_lot']),
    },
    pur_ufdf: {
      ..._ufdf,
      intermediate_input_id: (_ufdf['intermediate_input_id'] as string) || _purOut,
      parent_lineage:        (_red['parent_sample'] as string) || _purOut,
      output_id:             _ufdfOut,
      parent_sample:         (_red['parent_sample'] as string) || _purOut,
      membrane_lot_linked:   (_ufdf['membrane_lot_linked'] as string) || _asText(_ufdf['membrane_lot']),
    },
  }

  const editable = exp ? EDITABLE_STATUSES.has(exp.status) : false
  const isChemist  = user?.role_code === 'CHEM'
  const isApprover = APPROVER_ROLES.has(user?.role_code ?? '')

  // Auto-save after 1.5s idle
  const scheduleSave = useCallback((data: Record<string, Record<string, unknown>>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!exp?.id) return
      setSaving(true)
      try {
        await experimentApi.update(exp.id, { data })
        qc.setQueryData(['adc-experiments', notebookId, sectionKey], (prev: Experiment[]) =>
          prev.map(e => e.id === exp.id ? { ...e, data } : e)
        )
        setDirty(false)
      } finally {
        setSaving(false)
      }
    }, 1500)
  }, [exp?.id, notebookId, sectionKey, qc])

  const handleFieldChange = (screenKey: string, fieldKey: string, val: unknown) => {
    setLocalData(prev => {
      const next = {
        ...(exp?.data ?? {}),
        ...(prev ?? {}),
        [screenKey]: {
          ...((exp?.data ?? {})[screenKey] ?? {}),
          ...((prev ?? {})[screenKey] ?? {}),
          [fieldKey]: val,
        },
      }
      scheduleSave(next)
      return next
    })
    setDirty(true)
  }

  const handleFileUpload = async (screenKey: string, fieldKey: string, file: File) => {
    if (!exp?.id) return
    try {
      const uploaded = await experimentApi.uploadFile(exp.id, file, screenKey)
      handleFieldChange(screenKey, fieldKey, { filename: uploaded.filename, file_id: uploaded.id })
    } catch (e: unknown) {
      message.error((e as Error).message || 'Upload failed')
    }
  }

  const handleBulkFieldChange = (screenKey: string, updates: Record<string, unknown>) => {
    setLocalData(prev => {
      const merged = { ...(exp?.data ?? {}), ...(prev ?? {}) }
      const next = { ...merged, [screenKey]: { ...(merged[screenKey] ?? {}), ...updates } }
      scheduleSave(next)
      return { ...(prev ?? {}), [screenKey]: { ...((prev ?? {})[screenKey] ?? {}), ...updates } }
    })
    setDirty(true)
  }

  // Persist the derived intermediate-ID lineage chain to storage. Display is already
  // handled inline in effectiveData above — this only writes values that differ.
  useEffect(() => {
    if (!exp) return
    const chain: Array<[string, string[]]> = [
      ['mfg_thaw_pool_filter', ['intermediate_output_id']],
      ['mfg_reduction',        ['intermediate_input_id', 'parent_lots', 'red_available_volume_ul', 'output_id', 'parent_sample', 'reagent_lot_linked']],
      ['mfg_conjugation',      ['intermediate_input_id', 'parent_lineage', 'conj_available_volume_ul', 'output_id', 'parent_sample', 'reagent_lots_linked']],
      ['mfg_quench',           ['intermediate_input_id', 'parent_lineage', 'output_id', 'parent_sample', 'reagent_lots_linked']],
      ['pur_purification',     ['intermediate_input_id', 'parent_lineage', 'output_id', 'parent_sample', 'resin_lot_linked']],
      ['pur_ufdf',             ['intermediate_input_id', 'parent_lineage', 'output_id', 'parent_sample', 'membrane_lot_linked']],
    ]
    for (const [screenKey, fields] of chain) {
      const stored  = _effectiveData[screenKey] ?? {}
      const derived = effectiveData[screenKey]  ?? {}
      const updates: Record<string, unknown> = {}
      for (const f of fields) {
        const v = derived[f]
        if (v !== '' && v != null && v !== stored[f]) updates[f] = v
      }
      if (Object.keys(updates).length > 0) handleBulkFieldChange(screenKey, updates)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    exp?.full_code,
    _tpfOut, _redOut, _conjOut, _qnchOut, _purOut, _ufdfOut,
    effectiveData['mfg_thaw_pool_filter']?.['parent_samples'],
    effectiveData['mfg_thaw_pool_filter']?.['volume_registered_ul'],
    effectiveData['mfg_reduction']?.['parent_sample'],
    effectiveData['mfg_reduction']?.['tcep_lot'],
    effectiveData['mfg_reduction']?.['red_volume_registered_ul'],
    effectiveData['mfg_conjugation']?.['lp_lot'],
    effectiveData['mfg_quench']?.['nac_lot'],
    effectiveData['pur_purification']?.['resin_lot'],
    effectiveData['pur_ufdf']?.['membrane_lot'],
  ])

  // Propagate 3.3 calculator results → 3.4 and 3.5
  useEffect(() => {
    const r = effectiveData['mfg_reactant_calc']?.['reactant_calc_sheet'] as Record<string, unknown> | undefined
    if (!r) return
    handleBulkFieldChange('mfg_reduction', {
      calc_mab_vol_ul:  r['mab_vol_ul']   ?? '',
      calc_tcep_vol_ul: r['tcep_vol_ul']  ?? '',
      calc_edta_vol_ul: r['edta_vol_ul']  ?? '',
      calc_buffer1_ul:  r['buffer1_ul']   ?? '',
      calc_tff_vol_ml:  r['tff_vol_ml']   ?? '',
    })
    const conjUpdates: Record<string, unknown> = {
      calc_tff_vol_ml:  r['tff_vol_ml']   ?? '',
      calc_lp_vol_ul:   r['lp_vol_ul']    ?? '',
      calc_dmso_vol_ul: r['dma_vol_ul']   ?? '',
      calc_buffer2_ul:  r['buffer2_ul']   ?? '',
    }
    // Default the actual "LP Volume added" from the calc sheet — only while the
    // user hasn't entered their own value, since the actual addition can differ.
    const lpAdded = effectiveData['mfg_conjugation']?.['lp_added_ul']
    if ((lpAdded === undefined || lpAdded === null || lpAdded === '') && r['lp_vol_ul'] != null) {
      conjUpdates['lp_added_ul'] = r['lp_vol_ul']
    }
    handleBulkFieldChange('mfg_conjugation', conjUpdates)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effectiveData['mfg_reactant_calc']?.['reactant_calc_sheet'])])

  const handleManualSave = async () => {
    if (!exp?.id || !localData) return
    setSaving(true)
    try {
      const data = { ...(exp.data ?? {}), ...localData }
      await experimentApi.update(exp.id, { data })
      qc.setQueryData(['adc-experiments', notebookId, sectionKey], (prev: Experiment[]) =>
        prev.map(e => e.id === exp.id ? { ...e, data } : e)
      )
      setDirty(false)
      setLocalData(null)
    } finally {
      setSaving(false)
    }
  }

  const submitMut = useMutation({
    mutationFn: (reason: string) => experimentApi.submit(exp!.id, { sign_reason: reason }),
    onSuccess: e => {
      qc.setQueryData(['adc-experiments', notebookId, sectionKey], [e])
      qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const approveMut = useMutation({
    mutationFn: (reason: string) => experimentApi.approve(exp!.id, { sign_reason: reason }),
    onSuccess: e => {
      qc.setQueryData(['adc-experiments', notebookId, sectionKey], [e])
      qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const rejectMut = useMutation({
    mutationFn: () => experimentApi.reject(exp!.id, { reason: rejectReason }),
    onSuccess: e => {
      qc.setQueryData(['adc-experiments', notebookId, sectionKey], [e])
      qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId] })
      setRejectModal(false)
      setRejectReason('')
    },
  })

  const unlockMut = useMutation({
    mutationFn: () => experimentApi.unlock(exp!.id),
    onSuccess: e => {
      qc.setQueryData(['adc-experiments', notebookId, sectionKey], [e])
      qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId] })
    },
  })

  const { data: history = [] } = useQuery({
    queryKey: ['adc-exp-history', exp?.id],
    queryFn:  () => experimentApi.history(exp!.id),
    enabled:  !!exp?.id && historyOpen,
  })

  if (isLoading || !nb) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!section) {
    return (
      <div className="p-6 text-slate-500">
        Section "{sectionKey}" not found in template.
      </div>
    )
  }
  if (!exp && !canCreateExperiment) {
    return (
      <div className="p-6 text-slate-500">
        This section hasn't been set up yet. Ask your Team Lead or HOD to open it once to initialize it before you can start work here.
      </div>
    )
  }

  const currentScreen = activeScreen ?? section.screens[0]?.key
  const screenObj = section.screens.find(s => s.key === currentScreen) ?? section.screens[0]

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(`/notebooks/${notebookId}/overview`)}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Notebook
      </button>

      {/* Section header */}
      <div className="glass-card rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {exp && (
                <>
                  <span className=" text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{exp.full_code}</span>
                  <Tag color={STATUS_COLOR[exp.status]}>{exp.status}</Tag>
                </>
              )}
              {saving && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
              {dirty && !saving && <span className="text-xs text-amber-500">Unsaved changes</span>}
            </div>
            <h1 className="text-lg font-bold text-slate-800">{section.title}</h1>
          </div>

          {/* Workflow actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {dirty && (
              <Button size="small" style={BTN_32} icon={<Save size={13} />} onClick={handleManualSave} loading={saving}>
                Save
              </Button>
            )}
            <Button
              size="small"
              style={BTN_32}
              icon={<History size={13} />}
              onClick={() => setHistoryOpen(true)}
              type="text"
            />
            {exp?.status === 'DRAFT' && isChemist && (
              <Button
                type="primary"
                size="small"
                style={BTN_32}
                icon={<Send size={13} />}
                onClick={() => setSignModal('submit')}
                disabled={dirty}
              >
                Submit
              </Button>
            )}
            {exp?.status === 'SUBMITTED' && isApprover && (
              <>
                <Button
                  type="primary"
                  size="small"
                  style={BTN_32}
                  icon={<ThumbsUp size={13} />}
                  className="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700"
                  onClick={() => setSignModal('approve')}
                >
                  Approve
                </Button>
                <Button
                  danger
                  size="small"
                  style={BTN_32}
                  icon={<ThumbsDown size={13} />}
                  onClick={() => setRejectModal(true)}
                >
                  Reject
                </Button>
              </>
            )}
            {(exp?.status === 'APPROVED' || exp?.status === 'REJECTED') && (
              <Button
                size="small"
                style={BTN_32}
                icon={<Unlock size={13} />}
                onClick={() => unlockMut.mutate()}
                loading={unlockMut.isPending}
              >
                Unlock
              </Button>
            )}
          </div>
        </div>

        {exp?.rejection_reason && (
          <Alert
            message={`Rejected: ${exp.rejection_reason}`}
            type="error"
            showIcon
            className="mt-3"
          />
        )}
      </div>

      {/* Breadcrumb screens */}
      {section.screens.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-4">
          {section.screens.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActiveScreen(s.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                s.key === currentScreen
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/60'
              }`}
            >
              <span className="opacity-60">{i + 1}.</span> {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Field grid */}
      {screenObj && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-5">{screenObj.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {(() => {
              const screenData = effectiveData[screenObj.key] ?? {}
              // Fields before a *submitted* "Submit to AD" action button are
              // frozen — the action itself stays interactive so its
              // "Submitted" state remains visible.
              const lockIdx = screenObj.fields.findIndex(f =>
                f.type === 'action' && f.action_type === 'submit_to_ad' &&
                !!(screenData[f.key] as { submitted?: boolean } | undefined)?.submitted
              )
              return screenObj.fields.map((field, idx) => {
              const isTable  = field.type === 'table'
              const val = screenData[field.key] ?? (isTable ? [] : '')
              const isHeader = field.type === 'section_header'
              const isTA     = field.type === 'textarea'
              const isBufGrp = field.type === 'buffer_group' || field.type === 'js_sheet' || field.type === 'done_reviewed_signature'
              const lockedByAction = lockIdx !== -1 && idx < lockIdx

              return (
                <div
                  key={field.key}
                  className={isHeader || isTable || isTA || isBufGrp ? 'col-span-full' : ''}
                >
                  {field.type !== 'section_header' && (
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                  )}
                  <FieldRenderer
                    field={field}
                    value={val}
                    onChange={v => handleFieldChange(screenObj.key, field.key, v)}
                    onBulkChange={updates => handleBulkFieldChange(screenObj.key, updates)}
                    onFileUpload={file => handleFileUpload(screenObj.key, field.key, file)}
                    disabled={!editable || lockedByAction}
                    contextData={{ ...screenData, __full_data__: effectiveData }}
                    screenFields={screenObj.fields}
                    screenKey={screenObj.key}
                    experimentId={exp?.id}
                    onActionComplete={() => qc.invalidateQueries({ queryKey: ['adc-experiments', notebookId, sectionKey] })}
                    experimentCode={exp?.full_code}
                  />
                </div>
              )
              })
            })()}
          </div>
        </div>
      )}

      {/* E-signature modal — submit */}
      <ESignatureModal
        open={signModal === 'submit'}
        title="Submit for Review"
        message="By signing, you confirm all data in this section is accurate and complete."
        loading={submitMut.isPending}
        onSign={reason => submitMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      {/* E-signature modal — approve */}
      <ESignatureModal
        open={signModal === 'approve'}
        title="Approve Section"
        message="By approving, you verify and endorse the data recorded in this section."
        loading={approveMut.isPending}
        onSign={reason => approveMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      {/* Reject modal */}
      <Modal
        open={rejectModal}
        title="Reject Section"
        okText="Reject"
        okButtonProps={{ danger: true }}
        onOk={() => rejectMut.mutate()}
        onCancel={() => { setRejectModal(false); setRejectReason('') }}
        confirmLoading={rejectMut.isPending}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <div className="py-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Reason for rejection</label>
          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Describe what needs to be corrected…"
            maxLength={500}
            showCount
          />
        </div>
      </Modal>

      {/* History modal */}
      <Modal
        open={historyOpen}
        title="Section History"
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={480}
        centered
        {...glassModalProps}
      >
        <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
          {history.length === 0 && <p className="text-slate-400 text-sm text-center py-4">No history yet.</p>}
          {history.map((h, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2 bg-slate-50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <ChevronRight size={10} className="text-indigo-500" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-700">{h.action}</span>
                <span className="text-slate-400 ml-2">{new Date(h.created_at).toLocaleString()}</span>
                {h.details && Object.keys(h.details).length > 0 && (
                  <pre className="text-slate-400 text-[10px] mt-1">{JSON.stringify(h.details, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
