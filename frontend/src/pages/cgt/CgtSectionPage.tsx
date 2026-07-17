import { useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Tag, Spin, Modal, Input, Alert } from 'antd'
import { Send, Clock, CheckCircle, ChevronDown, ThumbsUp, ThumbsDown, Unlock, ArrowLeft } from 'lucide-react'
import { cgtNotebookApi, cgtExperimentApi, type CgtExperiment } from '../../api/cgt'
import { ApiError } from '../../api/client'
import PasswordSignatureModal from './components/PasswordSignatureModal'
import type { TemplateDefinition, TemplateScreen, TemplateSection } from '../admin/templateBuilder/types'
import CgtFieldControl from './components/CgtFieldControl'
import CgtTableField from './components/CgtTableField'
import { applyAutoFill, resolveMappingAutoFills } from '../admin/templateBuilder/useInventoryOptions'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const isTableScreen = (s: TemplateScreen) => /\(table\)\s*$/i.test(s.title.trim())
const isEntryTableScreen = (s: TemplateScreen) => /\(entry\s+table\)\s*$/i.test(s.title.trim())
const cleanTitle = (title: string) => title.replace(/\s*\((?:entry\s+)?table\)\s*$/i, '').trim()

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

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [localData, setLocalData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signModal, setSignModal] = useState<'submit' | 'approve' | null>(null)
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
  const editable = exp ? exp.status === 'DRAFT' : false

  const sectionData: Record<string, unknown> = {
    ...((exp?.data ?? {})[section?.id ?? ''] ?? {}),
    ...((localData ?? {})[section?.id ?? ''] ?? {}),
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
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar: every section, grouped by phase ── */}
      <div className="w-72 shrink-0 border-r border-slate-200 bg-white/60 overflow-y-auto p-3">
        <button
          onClick={() => navigate(`/cgt/projects/${projectId}/notebooks/${notebookId}`)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 mb-3 transition-colors px-1"
        >
          <ArrowLeft size={13} /> Notebook
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
      <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl">
          <div className="glass-card rounded-2xl p-4 mb-4">
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

              {exp.status === 'DRAFT' && isChemist && (
                <Button
                  type="primary" size="small" icon={<Send size={13} />}
                  onClick={() => { setSignError(null); setSignModal('submit') }} loading={submitMut.isPending} disabled={dirty}
                >
                  Chemist Signature
                </Button>
              )}
              {exp.status === 'SUBMITTED' && isApprover && (
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
              {(exp.status === 'APPROVED' || exp.status === 'REJECTED') && isApprover && (
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

          {/* All of this section's screens, stacked one after another — no tabs */}
          <div className="space-y-4">
            {section.screens.map(screenObj => (
              <div key={screenObj.id} className="glass-card rounded-2xl p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-5">{cleanTitle(screenObj.title)}</h2>

                {isTableScreen(screenObj) || isEntryTableScreen(screenObj) ? (
                  <CgtTableField
                    columns={screenObj.fields}
                    value={(sectionData[screenObj.id] as Record<string, unknown>[]) ?? []}
                    onChange={rows => handleScreenChange(section.id, screenObj.id, rows)}
                    variant={isEntryTableScreen(screenObj) ? 'entry' : 'table'}
                    disabled={!editable}
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: screenObj.columns === 2 ? '1fr 1fr' : '1fr', gap: '14px 24px' }}>
                    {screenObj.fields.map(field => {
                      const screenValues = (sectionData[screenObj.id] as Record<string, unknown>) ?? {}
                      const isFullWidth = field.type === 'SECTION_HEADING' || field.type === 'SPACER' || field.type === 'MULTI_LINE_TEXT' || field.colSpan === 2
                      return (
                        <div key={field.id} style={{ gridColumn: isFullWidth ? 'span 2' : undefined }}>
                          {field.type !== 'SECTION_HEADING' && field.type !== 'SPACER' && (
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </label>
                          )}
                          <CgtFieldControl
                            field={field}
                            value={screenValues[field.name]}
                            onChange={v => {
                              const merged = applyAutoFill(qc, screenObj.fields, field, v, { ...screenValues, [field.name]: v })
                              handleScreenChange(section.id, screenObj.id, merged)
                              void resolveMappingAutoFills(qc, screenObj.fields, field, merged,
                                patch => patchScreenValues(section.id, screenObj.id, patch))
                            }}
                            disabled={!editable}
                          />
                          {field.helpText && <p className="text-[11px] text-slate-400 mt-1">{field.helpText}</p>}
                        </div>
                      )
                    })}
                    {screenObj.fields.length === 0 && <p className="text-xs text-slate-300 col-span-full">No fields on this screen.</p>}
                  </div>
                )}
              </div>
            ))}
            {section.screens.length === 0 && <p className="text-xs text-slate-300">No screens in this section.</p>}
          </div>
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
