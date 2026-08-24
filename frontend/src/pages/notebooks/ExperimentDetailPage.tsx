import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tag, Spin, Alert, Modal, Input, Tooltip } from 'antd'
import {
  ArrowLeft, Save, ChevronRight, ChevronDown,
  Clock, CheckCircle, AlertCircle,
  Send, ThumbsUp, ThumbsDown, Unlock, History, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'
import FieldRenderer, { type TemplateField } from '../adc/components/FieldRenderer'
import ESignatureModal from '../adc/components/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import { BTN_32 } from '../../utils/buttonSize'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

// Chemists submit for review; leads/HOD approve or reject (HOD already covers
// the old QA-role admin, now modeled as HOD + QA department).
const APPROVER_ROLES = new Set(['TL', 'HOD'])

interface TemplateScreen  { key: string; title: string; fields: TemplateField[] }
interface TemplateSection { key: string; title: string; screens: TemplateScreen[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:     <Clock size={13} className="text-slate-400" />,
  SUBMITTED: <Clock size={13} className="text-amber-500" />,
  APPROVED:  <CheckCircle size={13} className="text-emerald-500" />,
  REJECTED:  <AlertCircle size={13} className="text-red-500" />,
}
const EDITABLE = new Set(['DRAFT', 'REJECTED'])

export default function ExperimentDetailPage() {
  const { notebookId, experimentId } = useParams<{ notebookId: string; experimentId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null)
  const [activeScreenKey,  setActiveScreenKey]  = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [localData,   setLocalData]  = useState<Record<string, Record<string, unknown>> | null>(null)
  const [dirty,       setDirty]      = useState(false)
  const [saving,      setSaving]     = useState(false)
  const [signModal,   setSignModal]  = useState<'submit' | 'approve' | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Notebook (for template_snapshot + name)
  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })

  // Experiment
  const { data: exp, isLoading: loadingExp } = useQuery({
    queryKey: ['experiment', experimentId],
    queryFn:  () => experimentApi.get(experimentId!),
    enabled:  !!experimentId,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['exp-history', experimentId],
    queryFn:  () => experimentApi.history(experimentId!),
    enabled:  !!experimentId && historyOpen,
  })

  useBreadcrumbLabel(notebookId ?? '', nb?.title ?? null)
  useBreadcrumbLabel(experimentId ?? '', exp?.title ?? exp?.full_code ?? null)

  const snapshot = nb?.template_snapshot as TemplateSnapshot | null | undefined
  const sections: TemplateSection[] = snapshot?.sections ?? []

  // Flatten all screens for STEP X OF Y
  const allScreens = sections.flatMap(sec =>
    sec.screens.map(scr => ({ ...scr, sectionKey: sec.key }))
  )

  // Init: expand first section, select first screen
  useEffect(() => {
    if (sections.length > 0 && !activeSectionKey) {
      const first = sections[0]
      setActiveSectionKey(first.key)
      setActiveScreenKey(first.screens[0]?.key ?? null)
      setExpandedSections(new Set([first.key]))
    }
  }, [sections.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const editable = exp ? EDITABLE.has(exp.status) : false
  const user       = useAppSelector(selectUser)
  const isChemist  = user?.role_code === 'CHEM'
  const isApprover = APPROVER_ROLES.has(user?.role_code ?? '')

  const _effectiveData: Record<string, Record<string, unknown>> = {
    ...(exp?.data ?? {}),
    ...(localData ?? {}),
  }

  // ── Intermediate ID lineage chain ────────────────────────────────────────────
  // 3.1 → 3.4 → 3.5 → 3.6 → 4.1 → 4.2. Each step's input ID carries the previous
  // step's generated output ID; each output ID is deterministic from the exp code.
  // Derived inline so the fields display instantly (never blank) on every render.
  const _code = exp?.full_code ?? ''
  const _asText = (v: unknown): string =>
    Array.isArray(v) ? (v as string[]).join(', ') : ((v as string) ?? '')

  const _tpf  = _effectiveData['mfg_thaw_pool_filter'] ?? {}
  const _red  = _effectiveData['mfg_reduction']        ?? {}
  const _conj = _effectiveData['mfg_conjugation']      ?? {}
  const _qnch = _effectiveData['mfg_quench']           ?? {}
  const _pur  = _effectiveData['pur_purification']     ?? {}
  const _ufdf = _effectiveData['pur_ufdf']             ?? {}

  // Generated output IDs (stored value wins; otherwise deterministic)
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
        intermediate_input_id:  (_red['intermediate_input_id'] as string) || _tpfOut,
        parent_lots:            parentLots,
        red_available_volume_ul: _red['red_available_volume_ul'] ?? _tpf['volume_registered_ul'] ?? '',
        output_id:              _redOut,
        parent_sample:          (_red['parent_sample'] as string) || parentLots,
        reagent_lot_linked:     (_red['reagent_lot_linked'] as string) || _asText(_red['tcep_lot']),
      }
    })(),
    mfg_conjugation: {
      ..._conj,
      intermediate_input_id:    (_conj['intermediate_input_id'] as string) || _redOut,
      parent_lineage:           (_conj['parent_lineage'] as string) || _redOut,
      conj_available_volume_ul: _conj['conj_available_volume_ul'] ?? _red['red_volume_registered_ul'] ?? '',
      output_id:                _conjOut,
      parent_sample:            (_conj['parent_sample'] as string) || _redOut,
      reagent_lots_linked:      (_conj['reagent_lots_linked'] as string) || _asText(_conj['lp_lot']),
    },
    mfg_quench: {
      ..._qnch,
      intermediate_input_id: (_qnch['intermediate_input_id'] as string) || _conjOut,
      parent_lineage:        (_qnch['parent_lineage'] as string) || _conjOut,
      output_id:             _qnchOut,
      parent_sample:         (_qnch['parent_sample'] as string) || _conjOut,
      reagent_lots_linked:   (_qnch['reagent_lots_linked'] as string) || _asText(_qnch['nac_lot']),
    },
    pur_purification: {
      ..._pur,
      intermediate_input_id: (_pur['intermediate_input_id'] as string) || _qnchOut,
      parent_lineage:        (_pur['parent_lineage'] as string) || _qnchOut,
      output_id:             _purOut,
      parent_sample:         (_pur['parent_sample'] as string) || _qnchOut,
      resin_lot_linked:      (_pur['resin_lot_linked'] as string) || _asText(_pur['resin_lot']),
    },
    pur_ufdf: {
      ..._ufdf,
      intermediate_input_id: (_ufdf['intermediate_input_id'] as string) || _purOut,
      parent_lineage:        (_ufdf['parent_lineage'] as string) || _purOut,
      output_id:             _ufdfOut,
      parent_sample:         (_ufdf['parent_sample'] as string) || _purOut,
      membrane_lot_linked:   (_ufdf['membrane_lot_linked'] as string) || _asText(_ufdf['membrane_lot']),
    },
  }

  // Auto-populate 3.1 fields: mab_lots (from 1.1), parent_samples (from vial IDs), intermediate_output_id
  useEffect(() => {
    if (activeScreenKey !== 'mfg_thaw_pool_filter') return
    if (!exp) return   // wait for experiment to load

    const screen = effectiveData['mfg_thaw_pool_filter'] ?? {}
    const updates: Record<string, unknown> = {}

    // 1. Populate mab_lots from 1.1 batch info (only if empty)
    let lots = (screen['mab_lots'] as Record<string, unknown>[]) ?? []
    if (lots.length === 0) {
      const ab = effectiveData['mat_antibody'] ?? {}
      const batchRows = (ab['mab_batch_info'] as Record<string, unknown>[] | undefined) ?? []
      if (batchRows.length > 0) {
        const matCode = ab['mab_mat_id_code']
        const matId   = matCode || ab['mab_mat_id']
        const matName = String(ab['mab_name'] ?? '')
        const storage = String(ab['mab_storage_condition'] ?? '')
        lots = batchRows.map(b => ({
          material_id:       matId ?? '',
          material_name:     matName,
          lot_no:            String(b['in_house_lot_batch_no'] ?? ''),
          vial_id:           String(b['pack_type'] ?? ''),
          initial_volume_ul: String(b['qty'] ?? ''),
          concentration_um:  '',
          storage:           storage,
        }))
        updates['mab_lots'] = lots
      }
    }

    // 2. Always sync parent_samples from vial IDs (current or freshly computed lots)
    const vialIds = lots.map(r => String(r['vial_id'] ?? '')).filter(Boolean)
    if (vialIds.length > 0) {
      const joined = vialIds.join(', ')
      if (String(screen['parent_samples'] ?? '') !== joined) {
        updates['parent_samples'] = joined
      }
    }

    // 3. Generate intermediate_output_id (replace if missing or was set before exp loaded)
    const existingId = String(screen['intermediate_output_id'] ?? '')
    if (!existingId || existingId.startsWith('undefined') || existingId === 'null') {
      updates['intermediate_output_id'] = `${exp.full_code}-TPF`
    }

    if (Object.keys(updates).length > 0) {
      handleBulkFieldChange('mfg_thaw_pool_filter', updates)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreenKey, exp?.full_code])

  // Keep parent_samples in sync when mab_lots table is edited mid-session
  useEffect(() => {
    if (activeScreenKey !== 'mfg_thaw_pool_filter') return
    const lots = (effectiveData['mfg_thaw_pool_filter']?.['mab_lots'] as Record<string, unknown>[] | undefined) ?? []
    const vialIds = lots.map(r => String(r['vial_id'] ?? '')).filter(Boolean)
    if (vialIds.length === 0) return
    const joined = vialIds.join(', ')
    if (String(effectiveData['mfg_thaw_pool_filter']?.['parent_samples'] ?? '') !== joined) {
      handleFieldChange('mfg_thaw_pool_filter', 'parent_samples', joined)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effectiveData['mfg_thaw_pool_filter']?.['mab_lots'])])

  // Persist the derived intermediate-ID lineage chain to storage so reports/exports
  // and downstream steps have the resolved values. Display is already handled inline
  // in effectiveData above — this only writes values that differ from what's stored.
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
    effectiveData['mfg_reduction']?.['tcep_lot'],
    effectiveData['mfg_reduction']?.['red_volume_registered_ul'],
    effectiveData['mfg_conjugation']?.['lp_lot'],
    effectiveData['mfg_quench']?.['nac_lot'],
    effectiveData['pur_purification']?.['resin_lot'],
    effectiveData['pur_ufdf']?.['membrane_lot'],
  ])

  // Propagate ReactantCalculator results (3.3) → 3.4 and 3.5
  useEffect(() => {
    const r = effectiveData['mfg_reactant_calc']?.['reactant_calc_sheet'] as Record<string, unknown> | undefined
    if (!r) return

    const reductionUpdates: Record<string, unknown> = {
      calc_mab_vol_ul:  r['mab_vol_ul']  ?? '',
      calc_tcep_vol_ul: r['tcep_vol_ul'] ?? '',
      calc_edta_vol_ul: r['edta_vol_ul'] ?? '',
      calc_buffer1_ul:  r['buffer1_ul']  ?? '',
      calc_tff_vol_ml:  r['tff_vol_ml']  ?? '',
    }
    const conjugationUpdates: Record<string, unknown> = {
      calc_tff_vol_ml:  r['tff_vol_ml']  ?? '',
      calc_lp_vol_ul:   r['lp_vol_ul']   ?? '',
      calc_dmso_vol_ul: r['dma_vol_ul']  ?? '',
      calc_buffer2_ul:  r['buffer2_ul']  ?? '',
    }
    // Default the actual "LP Volume added" from the calc sheet — only while the
    // user hasn't entered their own value, since the actual addition can differ.
    const lpAdded = effectiveData['mfg_conjugation']?.['lp_added_ul']
    if ((lpAdded === undefined || lpAdded === null || lpAdded === '') && r['lp_vol_ul'] != null) {
      conjugationUpdates['lp_added_ul'] = r['lp_vol_ul']
    }

    handleBulkFieldChange('mfg_reduction',    reductionUpdates)
    handleBulkFieldChange('mfg_conjugation',  conjugationUpdates)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effectiveData['mfg_reactant_calc']?.['reactant_calc_sheet'])])

  // Auto-save
  const scheduleSave = useCallback((data: Record<string, Record<string, unknown>>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!exp?.id) return
      setSaving(true)
      try {
        await experimentApi.update(exp.id, { data })
        qc.setQueryData(['experiment', experimentId], (prev: Experiment) =>
          prev ? { ...prev, data } : prev
        )
        setDirty(false)
      } finally {
        setSaving(false)
      }
    }, 1500)
  }, [exp?.id, experimentId, qc])

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

  const handleBulkFieldChange = (screenKey: string, updates: Record<string, unknown>) => {
    setLocalData(prev => {
      const merged = { ...(exp?.data ?? {}), ...(prev ?? {}) }
      const screenMerged = { ...(merged[screenKey] ?? {}), ...updates }
      const next = { ...merged, [screenKey]: screenMerged }
      scheduleSave(next)
      return { ...(prev ?? {}), [screenKey]: { ...((prev ?? {})[screenKey] ?? {}), ...updates } }
    })
    setDirty(true)
  }

  const handleManualSave = async () => {
    if (!exp?.id || !localData) return
    setSaving(true)
    try {
      const data = { ...(exp.data ?? {}), ...localData }
      await experimentApi.update(exp.id, { data })
      qc.setQueryData(['experiment', experimentId], (prev: Experiment) =>
        prev ? { ...prev, data } : prev
      )
      setDirty(false)
      setLocalData(null)
    } finally {
      setSaving(false)
    }
  }

  const submitMut = useMutation({
    mutationFn: (reason: string) => experimentApi.submit(exp!.id, { sign_reason: reason }),
    onSuccess: updated => {
      qc.setQueryData(['experiment', experimentId], updated)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const approveMut = useMutation({
    mutationFn: (reason: string) => experimentApi.approve(exp!.id, { sign_reason: reason }),
    onSuccess: updated => {
      qc.setQueryData(['experiment', experimentId], updated)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setSignModal(null)
    },
  })

  const rejectMut = useMutation({
    mutationFn: () => experimentApi.reject(exp!.id, { reason: rejectReason }),
    onSuccess: updated => {
      qc.setQueryData(['experiment', experimentId], updated)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
      setRejectModal(false)
      setRejectReason('')
    },
  })

  const unlockMut = useMutation({
    mutationFn: () => experimentApi.unlock(exp!.id),
    onSuccess: updated => {
      qc.setQueryData(['experiment', experimentId], updated)
      qc.invalidateQueries({ queryKey: ['notebook-experiments', notebookId] })
    },
  })

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectScreen = (sectionKey: string, screenKey: string) => {
    setActiveSectionKey(sectionKey)
    setActiveScreenKey(screenKey)
    if (!expandedSections.has(sectionKey)) {
      setExpandedSections(prev => new Set([...prev, sectionKey]))
    }
  }

  if (loadingNb || loadingExp) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!exp) return <div className="p-6 text-slate-500">Experiment not found.</div>

  const currentSection = sections.find(s => s.key === activeSectionKey) ?? sections[0]
  const currentScreen  = currentSection?.screens.find(s => s.key === activeScreenKey) ?? currentSection?.screens[0]
  const stepIdx    = allScreens.findIndex(s => s.key === currentScreen?.key)
  const stepNumber = stepIdx >= 0 ? stepIdx + 1 : 1
  const totalSteps = allScreens.length

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-white">

      {/* ── Left Sidebar ── */}
      <aside
        className={`${sidebarCollapsed ? 'w-14' : 'w-64'} transition-all duration-200 border-r border-slate-200 flex flex-col shrink-0 bg-white overflow-hidden`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 min-h-[48px]">
          {!sidebarCollapsed && (
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
              {nb?.template_name ?? 'Template'}
            </p>
          )}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="text-slate-400 hover:text-violet-600 transition-colors shrink-0 ml-auto"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Sections + screens */}
        <div className="flex-1 overflow-y-auto py-1">
          {sections.map((sec, secIdx) => {
            const isExpanded = expandedSections.has(sec.key)
            const isActiveSection = sec.key === activeSectionKey
            return (
              <div key={sec.key}>
                {/* Section row */}
                <button
                  onClick={() => toggleSection(sec.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-50 transition-colors ${isActiveSection ? 'bg-violet-50/60' : ''}`}
                  title={sidebarCollapsed ? `${secIdx + 1}. ${sec.title}` : undefined}
                >
                  {sidebarCollapsed ? (
                    <div className="w-6 h-6 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {secIdx + 1}
                    </div>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                        {secIdx + 1}
                      </div>
                      <span className={`flex-1 text-xs font-semibold truncate ${isActiveSection ? 'text-violet-700' : 'text-slate-700'}`}>
                        {sec.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{sec.screens.length}</span>
                      {isExpanded
                        ? <ChevronDown size={11} className="text-slate-400 shrink-0" />
                        : <ChevronRight size={11} className="text-slate-400 shrink-0" />}
                    </>
                  )}
                </button>

                {/* Screens */}
                {!sidebarCollapsed && isExpanded && sec.screens.map(scr => {
                  const isActive = scr.key === activeScreenKey && sec.key === activeSectionKey
                  return (
                    <button
                      key={scr.key}
                      onClick={() => selectScreen(sec.key, scr.key)}
                      className={`w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left transition-colors ${
                        isActive
                          ? 'bg-violet-100 text-violet-700'
                          : 'hover:bg-slate-50 text-slate-500'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-violet-500' : 'bg-slate-300'}`} />
                      <span className={`text-xs truncate ${isActive ? 'font-semibold' : ''}`}>{scr.title}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/notebooks/${notebookId}/overview`)}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-violet-600 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Notebook</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                STEP {stepNumber} OF {totalSteps}
              </p>
            </div>
            <span className="  text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
              {exp.full_code}
            </span>
            <Tag color={STATUS_COLOR[exp.status] ?? 'default'} className="flex items-center gap-1">
              {STATUS_ICON[exp.status]}
              {exp.status}
            </Tag>
            {dirty && <span className="text-xs text-amber-500">Unsaved changes</span>}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {editable && (
              <>
                <Button
                  size="small"
                  style={BTN_32}
                  icon={<Save size={13} />}
                  loading={saving}
                  onClick={handleManualSave}
                  disabled={!dirty}
                >
                  Save
                </Button>
                {isChemist && (
                  <Button
                    size="small"
                    style={BTN_32}
                    type="primary"
                    icon={<Send size={13} />}
                    onClick={() => setSignModal('submit')}
                  >
                    Submit
                  </Button>
                )}
              </>
            )}
            {exp.status === 'SUBMITTED' && isApprover && (
              <>
                <Button
                  size="small"
                  style={BTN_32}
                  type="primary"
                  icon={<ThumbsUp size={13} />}
                  onClick={() => setSignModal('approve')}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  style={BTN_32}
                  danger
                  icon={<ThumbsDown size={13} />}
                  onClick={() => setRejectModal(true)}
                >
                  Reject
                </Button>
              </>
            )}
            {(exp.status === 'APPROVED' || exp.status === 'REJECTED') && (
              <Button
                size="small"
                style={BTN_32}
                icon={<Unlock size={13} />}
                loading={unlockMut.isPending}
                onClick={() => unlockMut.mutate()}
              >
                Unlock
              </Button>
            )}
            <Tooltip title="History">
              <Button
                size="small"
                style={BTN_32}
                icon={<History size={13} />}
                onClick={() => setHistoryOpen(true)}
              />
            </Tooltip>
          </div>
        </div>

        {/* Screen title + form */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentScreen ? (
            <>
              <h1 className="text-xl font-bold text-slate-800 mb-6">{currentScreen.title}</h1>

              {!editable && (
                <Alert
                  message={`This experiment is ${exp.status.toLowerCase()} and cannot be edited.`}
                  type="info"
                  showIcon
                  className="mb-4"
                />
              )}

              <div className="grid grid-cols-3 gap-x-5 gap-y-4">
                {(() => {
                  const screenData = effectiveData[currentScreen.key] ?? {}
                  // Fields before a *submitted* "Submit to AD" action button are
                  // frozen — the action itself always stays interactive so its
                  // "Submitted" state remains visible.
                  const lockIdx = currentScreen.fields.findIndex(f =>
                    f.type === 'action' && f.action_type === 'submit_to_ad' &&
                    !!(screenData[f.key] as { submitted?: boolean } | undefined)?.submitted
                  )
                  return currentScreen.fields.map((field, idx) => {
                  const fullWidth = [
                    'table', 'textarea', 'test_results_tabs', 'time_recorder', 'section_header', 'buffer_group', 'js_sheet',
                    'done_reviewed_signature',
                  ].includes(field.type)
                  const showLabel = field.type !== 'section_header' && !!field.label
                  const lockedByAction = lockIdx !== -1 && idx < lockIdx
                  return (
                  <div key={field.key} className={fullWidth ? 'col-span-3' : ''}>
                    {showLabel && (
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        {field.read_only && (
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">(auto-filled)</span>
                        )}
                      </label>
                    )}
                    <FieldRenderer
                      field={field}
                      value={screenData[field.key]}
                      onChange={v => handleFieldChange(currentScreen.key, field.key, v)}
                      onBulkChange={updates => handleBulkFieldChange(currentScreen.key, updates)}
                      disabled={!editable || lockedByAction}
                      contextData={{ ...screenData, __full_data__: effectiveData }}
                      screenFields={currentScreen.fields}
                      screenKey={currentScreen.key}
                      experimentId={exp?.id}
                      onActionComplete={() => qc.invalidateQueries({ queryKey: ['experiment', experimentId] })}
                      experimentCode={exp?.full_code}
                    />
                  </div>
                  )
                  })
                })()}
              </div>

              {/* Next screen navigation */}
              {stepIdx < totalSteps - 1 && (
                <div className="mt-8 flex justify-end">
                  <Button
                    type="default"
                    icon={<ChevronRight size={14} />}
                    iconPosition="end"
                    onClick={() => {
                      const next = allScreens[stepIdx + 1]
                      if (next) selectScreen(next.sectionKey, next.key)
                    }}
                  >
                    Next: {allScreens[stepIdx + 1]?.title}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <p>Select a section from the sidebar to begin.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}

      <ESignatureModal
        open={signModal === 'submit'}
        title="Submit Experiment for Review"
        message="By signing, you confirm all data in this experiment is accurate and complete."
        loading={submitMut.isPending}
        onSign={reason => submitMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      <ESignatureModal
        open={signModal === 'approve'}
        title="Approve Experiment"
        message="By approving, you verify and endorse all data recorded in this experiment."
        loading={approveMut.isPending}
        onSign={reason => approveMut.mutate(reason)}
        onCancel={() => setSignModal(null)}
      />

      <Modal
        open={rejectModal}
        title="Reject Experiment"
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

      <Modal
        open={historyOpen}
        title="Experiment History"
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={480}
        centered
        {...glassModalProps}
      >
        <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
          {history.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-4">No history yet.</p>
          )}
          {history.map((h, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-2 bg-slate-50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <ChevronRight size={10} className="text-violet-500" />
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-700">{h.action}</span>
                <span className="text-slate-400 ml-2">{new Date(h.created_at).toLocaleString()}</span>
                {h.details && Object.keys(h.details).length > 0 && (
                  <pre className="text-slate-400 text-[10px] mt-1 whitespace-pre-wrap">
                    {JSON.stringify(h.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
