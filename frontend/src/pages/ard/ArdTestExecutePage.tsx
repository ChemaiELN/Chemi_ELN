import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Tabs, Input, InputNumber, Table, Tag, Spin, Alert, Modal, Popover,
  Typography, Empty, Collapse, Segmented, Card, Form, Select, message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeft, FlaskConical, Play, Save, Send, ShieldCheck, RotateCcw,
  AlertTriangle, CheckCircle2, LayoutList, FileText, Eye, UserCheck, Edit3, Type
} from 'lucide-react'

function RichTextValueCell({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  if (disabled) {
    return (
      <div className="text-xs py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-200/80 min-h-[36px] flex items-center text-slate-700">
        {value ? <RichDisplay html={value} /> : <span className="text-slate-400 italic">—</span>}
      </div>
    )
  }

  return (
    <div className="min-w-[320px] h-[110px] my-1 rounded-lg border border-slate-200 bg-white overflow-hidden">
      <RichEditor
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder || 'Enter value / observation...'}
        minHeight={60}
      />
    </div>
  )
}
import dayjs from 'dayjs'
import { apiGet, apiPost, ApiError } from '../../api/client'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import RichEditor, { RichDisplay } from '../../components/RichEditor'
import { ardUploadsApi } from '../../api/ard-uploads'
import { ardProjectsApi } from '../../api/ard-projects'
import { ardNotebooksApi } from '../../api/ard-notebooks'
import { ardTemplateApi } from '../../api/ard'
import { Upload as UploadIcon, BookOpen } from 'lucide-react'

// One shared "Final Report" upload slot for the whole test (not per-parameter)
// — reuses the generic ARD attachments backend with its own entity type so it
// stays distinct from the test-level Attachments/Chromatographic tabs.
function FinalReportUpload({ testId, readOnly }: { testId: string; readOnly?: boolean }) {
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const entityType = 'test_final_report'
  const queryKey = ['ard-attachments', entityType, testId]

  const { data: files = [] } = useQuery({
    queryKey,
    queryFn: () => ardUploadsApi.list(entityType, testId),
    enabled: !!testId,
  })

  const uploadMut = useMutation({
    mutationFn: (file: File) => ardUploadsApi.upload(entityType, testId, file, 'Final Report'),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); msgApi.success('Final report uploaded.') },
    onError: () => msgApi.error('Upload failed.'),
  })

  const latest = files[files.length - 1]

  return (
    <>
      {ctx}
      {latest && (
        <a href={latest.downloadUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline mr-1">
          {latest.filename}
        </a>
      )}
      {!readOnly && (
        <Button icon={<UploadIcon size={14} />} loading={uploadMut.isPending} onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file) uploadMut.mutate(file)
          }
          input.click()
        }}>
          Final Report
        </Button>
      )}
    </>
  )
}

// Links this test's "Notebook Reference" to real ELN data instead of a plain
// text box no one could act on. Three modes, matching how a test actually
// relates to notebook work: (1) a free-text note when there's nothing to
// link yet, (2) point at an experiment that already exists, (3) spin up a
// brand-new experiment (project + notebook + template) and link it in one
// step. Existing/new both narrow Project/Notebook choices to ones the
// current user can actually see, mirroring ArdNotebooksPage's own
// accessibility filter so this picker can't offer something they'd 404 on.
function NotebookReferencePicker({
  testId, atrId, data, isEditable, onLinked,
}: {
  testId: string
  atrId: string
  data: TestDetail
  isEditable: boolean
  onLinked: () => void
}) {
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()
  const [mode, setMode] = useState<'manual' | 'existing' | 'new'>(data.notebookRefLink ? 'existing' : 'manual')
  const [manualText, setManualText] = useState(data.notebookRefLink ? '' : (data.notebookReference ?? ''))
  const [projectId, setProjectId] = useState<string | undefined>()
  const [notebookId, setNotebookId] = useState<string | undefined>()
  // Deliberately NOT pre-filled from data.experimentId: the Experiment
  // select's options only populate once a Notebook is chosen, so seeding a
  // value with no matching option renders as a bare, meaningless UUID. The
  // "Linked to experiment {code}" badge above already shows the current
  // link — these selects are for picking a *new* one, not displaying the old.
  const [experimentId, setExperimentId] = useState<string | undefined>()
  const [newName, setNewName] = useState('')
  const [newTemplateId, setNewTemplateId] = useState<string | undefined>()
  // C1 (create-from-ATR-test) must support STP-clone creation, not just
  // Via-Template — mirrors ArdExperimentsPage's own "Creation Mode" toggle.
  const [newCreationMode, setNewCreationMode] = useState<'template' | 'stp'>('template')
  const [newProjectStpId, setNewProjectStpId] = useState<string | undefined>()

  const isUnscopedAdmin = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER', 'TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')

  const { data: projectsData } = useQuery({
    queryKey: ['ard-projects-list'],
    queryFn: () => ardProjectsApi.list({ pageSize: 200 }),
    enabled: mode !== 'manual',
  })
  const { data: notebooksData } = useQuery({
    queryKey: ['ard-notebooks-list'],
    queryFn: () => ardNotebooksApi.list({ pageSize: 200 }),
    enabled: mode !== 'manual',
  })
  const { data: templatesData } = useQuery({
    queryKey: ['ard-templates-published'],
    queryFn: () => ardTemplateApi.published(),
    enabled: mode === 'new' && newCreationMode === 'template',
  })
  const { data: newProjectDetail } = useQuery({
    queryKey: ['ard-project-detail-newexp', projectId],
    queryFn: () => ardProjectsApi.get(projectId!),
    enabled: mode === 'new' && newCreationMode === 'stp' && !!projectId,
  })
  const stpOptions = useMemo(() => {
    const docs = (newProjectDetail as any)?.stpDocuments ?? []
    return docs
      .filter((s: any) => s.status === 'APPROVED')
      .map((s: any) => ({ value: s.id, label: `${s.documentNo} v${s.version} — ${s.title}` }))
  }, [newProjectDetail])

  // Same "am I on this project's team" check ArdNotebooksPage uses — keeps
  // this picker's notion of "my projects" consistent with the rest of ARD.
  const accessibleProjects = useMemo(() => {
    const raw = projectsData?.items ?? []
    if (isUnscopedAdmin || !user) return raw
    return raw.filter((p) => {
      const isOwner = p.ownerName === user.username || p.ownerId === user.id || p.createdById === user.id
      const isTl = (p as any).assignedTl === user.username || (p as any).assignedTl === user.id
      const isMember = ((p as any).team ?? p.teamMembers ?? []).some((m: any) =>
        m.userName === user.username || m.username === user.username || m.userId === user.id || m.id === user.id
      )
      return isOwner || isTl || isMember
    })
  }, [projectsData?.items, isUnscopedAdmin, user])
  const accessibleProjectIds = useMemo(() => new Set(accessibleProjects.map((p) => p.id)), [accessibleProjects])

  const accessibleNotebooks = useMemo(() => {
    const raw = notebooksData?.items ?? []
    const scoped = isUnscopedAdmin || !user ? raw : raw.filter((nb) => {
      const isCreator = nb.createdBy === user.username || nb.createdById === user.id
      const isAssigned = ((nb as any).assignedUsers ?? []).some((u: any) => u.userId === user.id || u.userName === user.username)
      const isProjectAssigned = nb.projectId ? accessibleProjectIds.has(nb.projectId) : false
      return isCreator || isAssigned || isProjectAssigned
    })
    return projectId ? scoped.filter((nb) => nb.projectId === projectId) : scoped
  }, [notebooksData?.items, accessibleProjectIds, isUnscopedAdmin, user, projectId])

  const { data: experimentsData } = useQuery({
    queryKey: ['ard-notebook-experiments', notebookId],
    queryFn: () => ardNotebooksApi.experiments(notebookId!),
    enabled: mode === 'existing' && !!notebookId,
  })

  const linkMut = useMutation({
    mutationFn: (body: { experimentId?: string | null; notebookReference?: string | null }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/link-notebook`, body),
    onSuccess: () => {
      msgApi.success('Notebook reference updated.')
      onLinked()
    },
    onError: (e: any) => msgApi.error(e?.detail || e?.message || 'Failed to update notebook reference.'),
  })

  const createAndLinkMut = useMutation({
    // Single atomic call — previously two separate requests (create the
    // experiment, then link-notebook), so a failure in between left an
    // orphaned, unlinked experiment behind with no trace on the test side.
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/create-and-link-experiment`, {
      ...(newCreationMode === 'stp'
        ? { projectStpId: newProjectStpId }
        : { templateId: newTemplateId }),
      notebookId, projectId, name: newName || undefined,
    }),
    onSuccess: () => {
      msgApi.success('Experiment created and linked.')
      setNewName('')
      setNewTemplateId(undefined)
      setNewProjectStpId(undefined)
      onLinked()
    },
    onError: (e: any) => msgApi.error(e?.detail || e?.message || 'Failed to create experiment.'),
  })

  const busy = linkMut.isPending || createAndLinkMut.isPending

  return (
    <div className="sm:col-span-2">
      {ctx}
      <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
        Notebook Reference
      </label>

      {data.notebookRefLink && data.experimentId && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 w-fit">
          <BookOpen size={12} />
          Linked to experiment <span className="font-mono font-semibold">{data.notebookReference}</span>
        </div>
      )}

      {isEditable ? (
        <div className="space-y-2">
          <Segmented
            size="small"
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
            options={[
              { label: 'Manual Note', value: 'manual' },
              { label: 'Existing Experiment', value: 'existing' },
              { label: 'New Experiment', value: 'new' },
            ]}
          />

          {mode === 'manual' && (
            <div className="flex gap-2">
              <Input
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="e.g. EXP-2024-001 — link to lab notebook experiment"
              />
              <Button size="small" loading={linkMut.isPending} disabled={busy}
                onClick={() => linkMut.mutate({ notebookReference: manualText || null, experimentId: null })}>
                Save
              </Button>
            </div>
          )}

          {mode === 'existing' && (
            <div className="flex flex-wrap gap-2">
              <Select
                size="small" style={{ minWidth: 160 }} placeholder="Project"
                allowClear showSearch optionFilterProp="label"
                value={projectId}
                onChange={(v) => { setProjectId(v); setNotebookId(undefined); setExperimentId(undefined) }}
                options={accessibleProjects.map((p) => ({ value: p.id, label: `${p.code} — ${p.productName}` }))}
              />
              <Select
                size="small" style={{ minWidth: 160 }} placeholder="Notebook"
                allowClear showSearch optionFilterProp="label"
                value={notebookId}
                onChange={(v) => { setNotebookId(v); setExperimentId(undefined) }}
                options={accessibleNotebooks.map((nb) => ({ value: nb.id, label: nb.name }))}
              />
              <Select
                size="small" style={{ minWidth: 180 }} placeholder="Experiment"
                showSearch optionFilterProp="label" disabled={!notebookId}
                value={experimentId}
                onChange={setExperimentId}
                options={(experimentsData?.items ?? []).map((e) => ({ value: e.id, label: `${e.code}${e.templateName ? ` — ${e.templateName}` : ''}` }))}
              />
              <Button size="small" type="primary" loading={linkMut.isPending} disabled={busy || !experimentId}
                onClick={() => linkMut.mutate({ experimentId })}>
                Link
              </Button>
            </div>
          )}

          {mode === 'new' && (
            <div className="flex flex-col gap-2">
              <Segmented
                size="small"
                value={newCreationMode}
                onChange={(v) => { setNewCreationMode(v as 'template' | 'stp'); setNewTemplateId(undefined); setNewProjectStpId(undefined) }}
                options={[{ label: 'Via Template', value: 'template' }, { label: 'Via Project STP', value: 'stp' }]}
              />
              <div className="flex flex-wrap gap-2">
                <Select
                  size="small" style={{ minWidth: 160 }} placeholder="Project"
                  allowClear showSearch optionFilterProp="label"
                  value={projectId}
                  onChange={(v) => { setProjectId(v); setNotebookId(undefined); setNewProjectStpId(undefined) }}
                  options={accessibleProjects.map((p) => ({ value: p.id, label: `${p.code} — ${p.productName}` }))}
                />
                <Select
                  size="small" style={{ minWidth: 160 }} placeholder="Notebook"
                  allowClear showSearch optionFilterProp="label"
                  value={notebookId}
                  onChange={setNotebookId}
                  options={accessibleNotebooks.map((nb) => ({ value: nb.id, label: nb.name }))}
                />
                <Input
                  size="small" style={{ minWidth: 160, width: 200 }} placeholder="Experiment name"
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                />
                {newCreationMode === 'template' ? (
                  <Select
                    size="small" style={{ minWidth: 180 }} placeholder="Template"
                    showSearch optionFilterProp="label"
                    value={newTemplateId}
                    onChange={setNewTemplateId}
                    options={(templatesData?.items ?? []).map((t) => ({ value: t.id, label: t.name }))}
                  />
                ) : (
                  <Select
                    size="small" style={{ minWidth: 220 }}
                    placeholder={!projectId ? 'Select a project first' : stpOptions.length === 0 ? 'No approved STPs for this project' : 'Project STP'}
                    showSearch optionFilterProp="label"
                    disabled={!projectId || stpOptions.length === 0}
                    value={newProjectStpId}
                    onChange={setNewProjectStpId}
                    options={stpOptions}
                  />
                )}
                <Button
                  size="small" type="primary" loading={createAndLinkMut.isPending}
                  disabled={busy || !notebookId || (newCreationMode === 'template' ? !newTemplateId : !newProjectStpId)}
                  onClick={() => createAndLinkMut.mutate()}
                >
                  Create &amp; Link
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Input value={data.notebookReference ?? ''} disabled placeholder="No notebook reference set" />
      )}
      <p className="text-[10px] text-slate-400 mt-0.5">Link this test to a notebook experiment for traceability.</p>
    </div>
  )
}

const { TextArea } = Input
const { Text } = Typography

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResultRow {
  param_name?: string
  param_label?: string
  parameterId?: string
  parameterName?: string
  param_type?: 'INPUT' | 'OUTPUT'
  data_type?: string   // 'TEXT' | 'NUMBER' — set by backend from test config
  value: any
  formula?: string
  lower_limit?: string
  upper_limit?: string
  uom?: string
  specification?: string
}

interface RefStandard {
  name: string
  lot_no: string
  value: string
  uom: string
}

interface VersionRecord {
  version: number
  submittedAt?: string
  submittedBy?: string
  verifyRemarks?: string
  status?: string
}

interface EnhancementRequest {
  id: string
  requestedBy: string
  reason: string
  additionalTestType?: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy?: string
  reviewRemarks?: string
  createdAt: string
}

interface TestDetail {
  id: string
  atrId: string
  testType: string
  testSubtype?: string
  techniqueCode?: string
  techniqueName?: string
  status: string
  arNumber?: string
  formNo: string
  projectCode: string
  productName: string
  sampleCode: string
  sampleType?: string
  batchNo?: string
  assignedToName?: string
  assignedToId?: string
  lowerLimit?: string
  upperLimit?: string
  limitsUom?: string
  certifiedBy?: string
  analyzedBy?: string
  results: ResultRow[]
  resultRemarks?: string
  adRemarks?: string
  submitRemarks?: string
  referenceStandards: RefStandard[]
  enhancementRequests: EnhancementRequest[]
  versions: VersionRecord[]
  ownershipHistory: object[]
  startedAt?: string
  submittedAt?: string
  verifiedAt?: string
  verifiedBy?: string
  verifyRemarks?: string
  updatedAt: string
  version: number
  atrStatus: string
  // G-4/G-5: accept/reject tracking
  acceptRejectBy?: string | null
  acceptRejectAt?: string | null
  // G-6: AR generation timestamp
  arGeneratedAt?: string | null
  // G-7: source department
  sourceDept?: string | null
  // G-8: originating TRF form reference
  trfFormId?: string | null
  // Reassignment remarks
  testReassignRemarks?: string | null
  formCreatedById?: string | null
  priority?: string | null
  experimentId?: string | null
  notebookReference?: string | null
  notebookRefLink?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default',
  ASSIGNED: 'blue',
  PENDING: 'default',
  IN_PROGRESS: 'processing',
  VERIFICATION_REQUESTED: 'gold',
  VERIFICATION_REWORK: 'orange',
  VERIFIED: 'green',
  TENTATIVE: 'cyan',
  ACCEPTED: 'green',
  PUBLISHED: 'geekblue',
  UNSATISFACTORY: 'red',
  ENHANCEMENT_REQUESTED: 'magenta',
  UNLOCKED: 'gold',
  DELEGATED: 'purple',
  WITHDRAWN: 'volcano',
  CANCELLED: 'red',
}

const STATUS_LABEL: Record<string, string> = {
  UNASSIGNED: 'Unassigned',
  ASSIGNED: 'Assigned',
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  VERIFICATION_REQUESTED: 'Pending Verification',
  VERIFICATION_REWORK: 'Verification Rework',
  VERIFIED: 'Verified',
  TENTATIVE: 'Tentative',
  ACCEPTED: 'Accepted',
  PUBLISHED: 'Published',
  UNSATISFACTORY: 'Unsatisfactory',
  ENHANCEMENT_REQUESTED: 'Enhancement Requested',
  UNLOCKED: 'Unlocked',
  DELEGATED: 'Delegated',
  WITHDRAWN: 'Withdrawn',
  CANCELLED: 'Cancelled',
}

function evalPassFail(value: any, lower?: string, upper?: string): 'PASS' | 'FAIL' | 'PENDING' {
  if (value === null || value === undefined) return 'PENDING'
  const rawStr = String(value).replace(/<[^>]+>/g, ' ').trim().toLowerCase()
  if (!rawStr) return 'PENDING'

  if (rawStr.includes('does not comply') || rawStr.includes('does not conform') || rawStr.includes('fails') || rawStr.includes('out of spec') || rawStr.includes('not complies')) {
    return 'FAIL'
  }
  if (rawStr.includes('complies') || rawStr.includes('conforms') || rawStr.includes('pass') || rawStr.includes('acceptable')) {
    return 'PASS'
  }

  const numVal = parseFloat(rawStr.replace(/[^0-9.-]/g, ''))
  if (isNaN(numVal)) return 'PENDING'

  if (lower && upper) {
    const lo = parseFloat(lower), hi = parseFloat(upper)
    if (!isNaN(lo) && !isNaN(hi)) return numVal >= lo && numVal <= hi ? 'PASS' : 'FAIL'
  } else if (lower) {
    const lo = parseFloat(lower)
    if (!isNaN(lo)) return numVal >= lo ? 'PASS' : 'FAIL'
  } else if (upper) {
    const hi = parseFloat(upper)
    if (!isNaN(hi)) return numVal <= hi ? 'PASS' : 'FAIL'
  }
  return 'PENDING'
}

function evalFormula(formula: string, inputVals: Record<string, string>): string {
  try {
    let expr = formula
    for (const [k, v] of Object.entries(inputVals)) {
      const strV = String(v ?? '').trim()
      expr = expr.replaceAll(`\${${k}}`, strV || '0')
    }
    if (expr.includes('${')) return ''
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${expr})`)()
    return typeof result === 'number' && isFinite(result)
      ? parseFloat(result.toFixed(6)).toString()
      : ''
  } catch {
    return ''
  }
}

function applyFormulas(rows: ResultRow[]): ResultRow[] {
  if (!rows || !Array.isArray(rows)) return []
  const inputVals: Record<string, string> = {}
  for (const r of rows) {
    if (!r) continue
    const key = r.param_name || r.parameterId || r.parameterName || ''
    if (r.param_type === 'INPUT' && key) inputVals[key] = String(r.value ?? '')
  }
  return rows.map(r => {
    if (!r) return { value: '' }
    return r.param_type === 'OUTPUT' && r.formula
      ? { ...r, value: evalFormula(r.formula, inputVals) }
      : r
  })
}

function PassFailTag({ value, lower, upper }: { value: any; lower?: string; upper?: string }) {
  const pf = evalPassFail(value, lower, upper)
  if (pf === 'PASS') return <Tag color="success" icon={<CheckCircle2 size={11} />}>Complies</Tag>
  if (pf === 'FAIL') return <Tag color="error" icon={<AlertTriangle size={11} />}>Does Not Comply</Tag>
  return <Tag color="default">—</Tag>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ArdTestExecutePage() {
  const { atrId = '', testId = '' } = useParams<{ atrId: string; testId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)

  // Editable state
  const [results, setResults] = useState<ResultRow[]>([])
  const [resultRemarks, setResultRemarks] = useState('')
  const [adRemarks, setAdRemarks] = useState('')
  const [submitRemarks, setSubmitRemarks] = useState('')
  const [analyzedBy, setAnalyzedBy] = useState('')
  const [certifiedBy, setCertifiedBy] = useState('')
  const [refStandards, setRefStandards] = useState<RefStandard[]>([])

  // Modal state
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [oosOpen, setOosOpen] = useState(false)
  const [esignTargetAction, setEsignTargetAction] = useState<'SUBMIT' | 'VERIFY' | 'WITHDRAW' | null>(null)

  // Enhancement modal
  const [enhOpen, setEnhOpen] = useState(false)
  const [enhReason, setEnhReason] = useState('')
  const [enhTestType, setEnhTestType] = useState('')
  const [viewMode, setViewMode] = useState<'tabbed' | 'single'>('tabbed')

  // Assign modal state
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedAssignAnalystId, setSelectedAssignAnalystId] = useState('')
  const [assignPassword, setAssignPassword] = useState('')

  // Delegate modal state
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [selectedDelegateUserId, setSelectedDelegateUserId] = useState('')
  const [delegateRemarks, setDelegateRemarks] = useState('')

  // Withdraw modal state
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawRemarks, setWithdrawRemarks] = useState('')

  // Unsatisfactory modal state
  const [unsatOpen, setUnsatOpen] = useState(false)
  const [unsatRemarks, setUnsatRemarks] = useState('')

  // Rework analyst reassignment
  const [reworkAnalystId, setReworkAnalystId] = useState('')

  const { data: teamUsersData } = useQuery({
    queryKey: ['ard-team-users'],
    queryFn: () => apiGet<{ items: { id: string; username: string; full_name?: string; role_code: string; department_code?: string }[] }>('/api/ard/team/users'),
  })

  const { data: teamDirectoryData } = useQuery({
    queryKey: ['ard-team-directory'],
    queryFn: () => apiGet<{ items: any[] }>('/api/ard/team/directory'),
  })

  const delegateOptions = useMemo(() => {
    const rawTeams = teamDirectoryData?.items ?? []
    const allUsers = teamUsersData?.items ?? []

    const mainTlMap = new Map<string, string>()
    const otherTlMap = new Map<string, string>()

    rawTeams.forEach((t) => {
      const tls = t.tls || []
      if (tls.length > 0) {
        if (tls[0]?.id) mainTlMap.set(tls[0].id, t.teamName)
        for (let i = 1; i < tls.length; i++) {
          if (tls[i]?.id) otherTlMap.set(tls[i].id, t.teamName)
        }
      } else if (t.tlIds?.length > 0) {
        mainTlMap.set(t.tlIds[0], t.teamName)
        for (let i = 1; i < t.tlIds.length; i++) {
          otherTlMap.set(t.tlIds[i], t.teamName)
        }
      }
    })

    const mainTlOpts: { value: string; label: string }[] = []
    const otherOpts: { value: string; label: string }[] = []
    const seen = new Set<string>()

    allUsers.forEach((u) => {
      if (u.id === user?.id) return
      if (mainTlMap.has(u.id)) {
        seen.add(u.id)
        const teamName = mainTlMap.get(u.id)
        mainTlOpts.push({ value: u.id, label: `⭐ ${u.username} (${teamName} — Main TL)` })
      }
    })

    allUsers.forEach((u) => {
      if (u.id === user?.id || seen.has(u.id)) return
      if (otherTlMap.has(u.id) || u.role_code === 'TL') {
        seen.add(u.id)
        const teamName = otherTlMap.get(u.id)
        otherOpts.push({ value: u.id, label: `${u.username} (${teamName ? `${teamName} — ` : ''}TL Member)` })
      } else if (['ANALYST', 'CHEM', 'SE'].includes(u.role_code)) {
        seen.add(u.id)
        otherOpts.push({ value: u.id, label: `${u.username} (ANALYST)` })
      }
    })

    return [
      ...(mainTlOpts.length ? [{ label: 'Main Team Leaders', options: mainTlOpts }] : []),
      ...(otherOpts.length ? [{ label: 'Analysts & Team Leads', options: otherOpts }] : []),
    ]
  }, [teamDirectoryData, teamUsersData, user?.id])

  const { data: qualifiedData, isLoading: qualifiedLoading } = useQuery({
    queryKey: ['ard-qualified-analysts', atrId, testId],
    queryFn: () => apiGet<{ techniqueKey: string; items: { userId: string; userName: string; roleCode: string }[]; isRestricted: boolean }>(`/api/ard/tests/${atrId}/${testId}/qualified-analysts`),
    enabled: !!atrId && !!testId,
  })

  const isUserQualifiedForTest = useMemo(() => {
    if (!qualifiedData) return true
    if (qualifiedData.isRestricted && qualifiedData.items) {
      return qualifiedData.items.some((u) => u.userId === user?.id || u.userName === user?.username)
    }
    return true
  }, [qualifiedData, user?.id, user?.username])

  // Member ids of only the team(s) the current user actually LEADS (as HOD
  // or TL) — scopes the analyst picker's fallback branch to "my team" only,
  // matching the backend's ledTeamMemberIds. Deliberately excludes teams
  // where this user is merely a plain member (e.g. a TL seconded onto
  // another team's roster) — that team's analysts aren't theirs to assign.
  // HOD/QA/Admin get the unscoped list from the backend directly
  // (qualifiedData already reflects that), so this only narrows things for
  // a plain TL/analyst.
  const myTeamMemberIds = useMemo(() => {
    const rawTeams = teamDirectoryData?.items ?? []
    const myTeams = rawTeams.filter((t: any) =>
      t.hodId === user?.id || (t.tlIds ?? []).includes(user?.id)
    )
    const ids = new Set<string>()
    myTeams.forEach((t: any) => (t.memberIds ?? []).forEach((id: string) => ids.add(id)))
    return ids
  }, [teamDirectoryData, user?.id])

  const analystOptions = useMemo(() => {
    if (qualifiedData?.items && qualifiedData.items.length > 0) {
      return qualifiedData.items.map((u) => ({
        value: u.userId,
        label: `${u.userName} (${u.roleCode || 'ANALYST'})`,
      }))
    }
    return (teamUsersData?.items ?? [])
      .filter((u) => ['ANALYST', 'CHEM'].includes(u.role_code) && u.department_code !== 'QA')
      .filter((u) => myTeamMemberIds.size === 0 || myTeamMemberIds.has(u.id))
      .map((u) => ({
        value: u.id,
        label: `${u.username} (${u.role_code})`,
      }))
  }, [qualifiedData, teamUsersData, myTeamMemberIds])

  const { data, isLoading, error } = useQuery<TestDetail>({
    queryKey: ['ard-test', atrId, testId],
    queryFn: () => apiGet(`/api/ard/tests/${atrId}/${testId}`),
    enabled: !!atrId && !!testId,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!data) return
    setResults(data.results ?? [])
    setResultRemarks(data.resultRemarks ?? '')
    setAdRemarks(data.adRemarks ?? '')
    setSubmitRemarks(data.submitRemarks ?? '')
    setAnalyzedBy(data.analyzedBy ?? user?.username ?? '')
    setCertifiedBy(data.certifiedBy ?? '')
    setRefStandards(data.referenceStandards ?? [])
  }, [data, user?.username])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ard-test', atrId, testId] })

  // Mutations
  const claimMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/claim`, {}),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
    },
    onError: (e: any) => message.error(e?.detail || e?.message || 'Failed to claim test.'),
  })

  const assignMut = useMutation({
    mutationFn: (targetUser: { id: string; username: string }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/assign`, {
        analystId: targetUser.id,
        analystName: targetUser.username,
        password: assignPassword,
      }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      setAssignOpen(false)
      setAssignPassword('')
    },
  })

  const delegateMut = useMutation({
    mutationFn: (targetUser: { id: string; username: string }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/delegate`, {
        tlId: targetUser.id,
        tlName: targetUser.username,
        actionRemarks: delegateRemarks,
      }),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      setDelegateOpen(false)
      setDelegateRemarks('')
    },
    onError: (e: any) => {
      const errDetail = e?.response?.data?.detail || e?.detail || e?.message || 'Failed to delegate test.'
      message.error(errDetail)
    },
  })

  const startMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/start`, {}),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['ard-tests'] })
      message.success('Test started successfully!')
    },
    onError: (e: any) => {
      const errDetail = e?.response?.data?.detail || e?.detail || e?.message || 'Failed to start test.'
      message.error(errDetail)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/save-results`, {
      results: applyFormulas(results),
      resultRemarks, adRemarks, referenceStandards: refStandards,
      analyzedBy, certifiedBy,
    }),
    onSuccess: invalidate,
  })

  const submitMut = useMutation({
    mutationFn: (password?: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/submit`, {
      results: applyFormulas(results),
      resultRemarks, adRemarks, submitRemarks, referenceStandards: refStandards,
      analyzedBy, certifiedBy,
      password,
    }),
    onSuccess: invalidate,
  })

  const handleSubmitClick = () => {
    // Check for OOS parameters
    const computed = applyFormulas(results)
    const oosItems = computed.filter(r => evalPassFail(r.value, r.lower_limit, r.upper_limit) === 'FAIL')
    if (oosItems.length > 0) {
      setOosOpen(true)
    } else {
      setEsignTargetAction('SUBMIT')
    }
  }

  const verifyMut = useMutation({
    mutationFn: (password?: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/verify`, {
      verifiedBy: user?.username ?? '',
      password,
    }),
    onSuccess: () => { setReviewOpen(false); invalidate() },
  })

  const reworkMut = useMutation({
    mutationFn: () => {
      const target = reworkAnalystId ? teamUsersData?.items?.find(u => u.id === reworkAnalystId) : null
      return apiPost(`/api/ard/tests/${atrId}/${testId}/rework`, {
        remarks: reviewRemarks,
        ...(target ? { reworkAnalystId: target.id, reworkAnalystName: target.username } : {}),
      })
    },
    onSuccess: () => { setReviewOpen(false); setReviewRemarks(''); setReworkAnalystId(''); invalidate() },
  })

  const enhMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/enhancement-requests`, {
      reason: enhReason,
      additionalTestType: enhTestType,
    }),
    onSuccess: () => { setEnhOpen(false); setEnhReason(''); setEnhTestType(''); invalidate() },
  })

  const publishTentativeMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/publish-tentative`, {}),
    onSuccess: invalidate,
  })

  const acceptTestMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/accept-test`, {}),
    onSuccess: invalidate,
  })

  const withdrawMut = useMutation({
    mutationFn: (password?: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/withdraw`, {
      actorUserName: user?.username, actionRemarks: withdrawRemarks, password,
    }),
    onSuccess: () => { setWithdrawOpen(false); setWithdrawRemarks(''); invalidate() },
    onError: (e: any) => message.error(e?.detail || e?.message || 'Failed to withdraw test.'),
  })

  const unsatMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/unsatisfactory`, {
      remarks: unsatRemarks,
    }),
    onSuccess: () => { setUnsatOpen(false); setUnsatRemarks(''); invalidate() },
    onError: (e: any) => message.error(e?.detail || e?.message || 'Failed to mark unsatisfactory.'),
  })

  // ── Loading / error states ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-12 flex justify-center items-center">
        <Spin size="large" />
      </div>
    )
  }

  if (error || !data) {
    const errDetail = error ? (error instanceof ApiError ? error.detail : error.message) : null
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Alert
          type="error"
          message="Failed to load test details"
          description={errDetail || "The requested test was not found, or you do not have permission to view it."}
          showIcon
          className="rounded-lg"
          action={
            <Button size="small" type="primary" onClick={() => navigate('/ard/tests')}>Back to Tests</Button>
          }
        />
      </div>
    )
  }

  // Role + status guards
  const role = user?.role_code ?? ''
  const status = data.status ?? ''
  const isAnalystRole = ['ANALYST', 'CHEM'].includes(role)
  const canExecuteRoles = ['ANALYST', 'CHEM', 'TL', 'HOD', 'SUPER_ADMIN']
  const canVerifyRoles = ['TL', 'HOD', 'QA', 'SUPER_ADMIN']
  const canExecute = canExecuteRoles.includes(role)
  const canVerify = canVerifyRoles.includes(role)
  const isAssignedAnalyst =
    (data.assignedToId != null && data.assignedToId === user?.id) ||
    (data.assignedToName != null && data.assignedToName === user?.username) ||
    role === 'SUPER_ADMIN'

  const canPublishTentative = ['ANALYST', 'CHEM', 'TL'].includes(role)
  const canAcceptTest = ['HOD', 'QA', 'SUPER_ADMIN'].includes(role) || data.formCreatedById === user?.id
  // Withdrawing a test is the requester's call, not the analyst executing
  // it — pulling one's own assignment mid-test would drop work with no
  // oversight, so this deliberately excludes isAssignedAnalyst.
  const canWithdrawTest = data.formCreatedById === user?.id || canVerify

  const executingStatuses = ['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION_REWORK', 'UNLOCKED']
  const isEditable = executingStatuses.includes(status) && canExecute && isAssignedAnalyst
  // Notebook Reference is frozen until the test is actually started (AR
  // number is generated on Start too — both happen together, not before).
  const notebookRefEditable = isEditable && status !== 'ASSIGNED'
  const showEnhancementTab = (data.enhancementRequests?.length ?? 0) > 0 || ['ENHANCEMENT_REQUESTED', 'ENHANCEMENT_APPROVED'].includes(status)



  // Computed result rows (with formula evaluation)
  const computedRows = applyFormulas(results)

  // Columns for results table
  const resultCols: ColumnsType<ResultRow> = [
    {
      title: '#',
      width: 44,
      render: (_, __, i) => <span className="text-slate-400 text-xs">{i + 1}</span>,
    },
    {
      title: 'Parameter',
      dataIndex: 'param_label',
      width: 220,
      render: (v, r) => (
        <div>
          <span className="font-medium text-slate-700">{v || r.param_name || r.parameterName || r.parameterId || 'Parameter'}</span>
          {r.param_type === 'OUTPUT' && (
            <span className="ml-1.5 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">calc</span>
          )}
        </div>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      minWidth: 240,
      render: (_, r, i) => {
        const computed = computedRows[i] ?? r
        if (r.param_type === 'OUTPUT') {
          return (
            <span className="font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded text-sm block min-h-[32px]">
              {computed.value || '—'}
            </span>
          )
        }
        const isNumber = (r.data_type ?? '').toUpperCase() === 'NUMBER'
        if (isNumber) {
          return (
            <InputNumber
              value={r.value === '' || r.value == null ? undefined : Number(r.value)}
              disabled={!isEditable}
              placeholder="Enter value..."
              className="w-full"
              onChange={val => {
                const next = [...results]
                next[i] = { ...next[i], value: val == null ? '' : String(val) }
                setResults(next)
              }}
            />
          )
        }
        return (
          <RichTextValueCell
            value={r.value ?? ''}
            disabled={!isEditable}
            placeholder="Enter observation or description..."
            onChange={val => {
              const next = [...results]
              next[i] = { ...next[i], value: val }
              setResults(next)
            }}
          />
        )
      },
    },
    {
      title: 'Limits',
      width: 160,
      render: (_, r) =>
        r.lower_limit || r.upper_limit ? (
          <span className="text-xs text-slate-500 font-mono">
            {r.lower_limit ?? '—'} – {r.upper_limit ?? '—'}{r.uom ? ` ${r.uom}` : ''}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      title: 'Specification',
      dataIndex: 'specification',
      width: 180,
      render: (v) => v ? <span className="text-xs text-slate-600">{v}</span> : <span className="text-slate-300">—</span>,
    },
    {
      title: 'Result',
      width: 130,
      render: (_, r, i) => {
        const isNumber = (r.data_type ?? '').toUpperCase() === 'NUMBER'
        if (isNumber) {
          return (
            <PassFailTag
              value={(computedRows[i] ?? r).value}
              lower={r.lower_limit}
              upper={r.upper_limit}
            />
          )
        }
        return <span className="text-slate-300">—</span>
      },
    },
  ]

  const anyBusy = startMut.isPending || saveMut.isPending || submitMut.isPending
    || verifyMut.isPending || reworkMut.isPending
    || publishTentativeMut.isPending || acceptTestMut.isPending
    || withdrawMut.isPending || unsatMut.isPending

  // ── Tab items definition ──────────────────────────────────────────────────
  const testTabItems = [
    // ── Details tab ──────────────────────────────────────────────────
    {
      key: 'details',
      label: '1. Details',
      children: (
        <div className="pb-5 space-y-5">
          {/* Metadata grid card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-6">
            {[
              ['ATR Form No.', <span className="font-mono text-slate-700">{data.formNo}</span>],
              ['Sample Code', data.sampleCode],
              ['Batch No.', data.batchNo || '—'],
              ['AR Number', <span className="font-mono font-semibold text-violet-600">{data.arNumber || '—'}</span>],
              ['Product', data.productName || data.projectCode],
              ['Technique', data.techniqueName || data.techniqueCode || '—'],
              ['Assigned To', data.assignedToName || '—'],
              ['Version', `v${data.version}`],
              ['Priority', data.priority ? <Tag color={data.priority === 'HIGH' ? 'red' : data.priority === 'MEDIUM' ? 'orange' : 'default'} className="text-xs">{data.priority}</Tag> : '—'],
              ['Test Remarks', (data as any).remarks || '—'],
              ['Lower Limit', data.lowerLimit || '—'],
              ['Upper Limit', data.upperLimit || '—'],
            ].map(([label, value], i) => (
              <div key={i}>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label as string}</p>
                <p className="font-semibold text-slate-700 truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Remarks + analysis fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <NotebookReferencePicker
              testId={testId}
              atrId={atrId}
              data={data}
              isEditable={notebookRefEditable}
              onLinked={invalidate}
            />
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
                Analyzed By
              </label>
              <Input
                value={analyzedBy}
                onChange={e => setAnalyzedBy(e.target.value)}
                disabled={!isEditable}
                placeholder="Analyst name"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
                Certified By
              </label>
              <Input
                value={certifiedBy}
                onChange={e => setCertifiedBy(e.target.value)}
                disabled={!isEditable}
                placeholder="Certifier name"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
                Result Remarks
              </label>
              <TextArea
                rows={2}
                value={resultRemarks}
                onChange={e => setResultRemarks(e.target.value)}
                disabled={!isEditable}
                placeholder="Observations, anomalies, notes..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
                AD Remarks
              </label>
              <TextArea
                rows={2}
                value={adRemarks}
                onChange={e => setAdRemarks(e.target.value)}
                disabled={!isEditable}
                placeholder="Analytical department remarks..."
              />
            </div>
          </div>

          {/* Signatures — read-only acceptance record */}
          {(data.acceptRejectBy || data.verifiedBy) && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Signatures</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data.verifiedBy && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wider mb-1">Verified By</p>
                    <p className="font-semibold text-slate-800 text-sm">{data.verifiedBy}</p>
                    {data.verifiedAt && <p className="text-xs text-slate-400 mt-0.5">{dayjs(data.verifiedAt).format('DD MMM YYYY HH:mm')}</p>}
                  </div>
                )}
                {data.acceptRejectBy && (
                  <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
                    <p className="text-[10px] text-violet-600 font-semibold uppercase tracking-wider mb-1">Accepted By</p>
                    <p className="font-semibold text-slate-800 text-sm">{data.acceptRejectBy}</p>
                    {data.acceptRejectAt && <p className="text-xs text-slate-400 mt-0.5">{dayjs(data.acceptRejectAt).format('DD MMM YYYY HH:mm')}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info — cross-module traceability */}
          {(data.arGeneratedAt || data.sourceDept || data.trfFormId || data.testReassignRemarks) && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Additional Info</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data.arGeneratedAt && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">AR Generated At</p>
                    <p className="font-semibold text-slate-700 text-sm">{dayjs(data.arGeneratedAt).format('DD MMM YYYY HH:mm')}</p>
                  </div>
                )}
                {data.sourceDept && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Source Dept</p>
                    <p className="font-semibold text-slate-700 text-sm">{data.sourceDept}</p>
                  </div>
                )}
                {data.trfFormId && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">TRF Form Ref</p>
                    <p className="font-mono text-slate-700 text-xs">{data.trfFormId}</p>
                  </div>
                )}
                {data.testReassignRemarks && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Reassign Remarks</p>
                    <p className="text-slate-700 text-sm">{data.testReassignRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    },

    // ── Results tab ──────────────────────────────────────────────────
    {
      key: 'results',
      label: '2. Results',
      children: (
        <div className="pb-5 space-y-4">
          {results.length === 0 ? (
            <Empty
              description={
                <span className="text-slate-500">
                  No result parameters defined for this test type.
                  Configure them in <strong>ARD → Configuration → Test Types</strong>.
                </span>
              }
              className="py-10"
            />
          ) : (
            <Table
              dataSource={results}
              columns={resultCols}
              rowKey="param_name"
              pagination={false}
              size="small"
              className="rounded-lg overflow-hidden"
            />
          )}
        </div>
      ),
    },

    // ── Reference Standards tab ──────────────────────────────────────
    {
      key: 'ref-standards',
      label: '3. Reference Standards',
      children: (
        <div className="pb-5">
          <Table
            dataSource={refStandards}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Standard Name',
                dataIndex: 'name',
                render: (v, _, i) => (
                  <Input size="small" value={v} disabled={!isEditable}
                    onChange={e => {
                      const u = [...refStandards]; u[i] = { ...u[i], name: e.target.value }
                      setRefStandards(u)
                    }} />
                ),
              },
              {
                title: 'Lot No.',
                dataIndex: 'lot_no',
                width: 130,
                render: (v, _, i) => (
                  <Input size="small" value={v} disabled={!isEditable}
                    onChange={e => {
                      const u = [...refStandards]; u[i] = { ...u[i], lot_no: e.target.value }
                      setRefStandards(u)
                    }} />
                ),
              },
              {
                title: 'Value',
                dataIndex: 'value',
                width: 110,
                render: (v, _, i) => (
                  <Input size="small" value={v} disabled={!isEditable}
                    className="font-mono"
                    onChange={e => {
                      const u = [...refStandards]; u[i] = { ...u[i], value: e.target.value }
                      setRefStandards(u)
                    }} />
                ),
              },
              {
                title: 'UOM',
                dataIndex: 'uom',
                width: 80,
                render: (v, _, i) => (
                  <Input size="small" value={v} disabled={!isEditable}
                    onChange={e => {
                      const u = [...refStandards]; u[i] = { ...u[i], uom: e.target.value }
                      setRefStandards(u)
                    }} />
                ),
              },
              ...(isEditable ? [{
                title: '',
                width: 40,
                render: (_: unknown, __: unknown, i: number) => (
                  <button
                    onClick={() => setRefStandards(refStandards.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 transition-colors text-base leading-none"
                  >
                    ✕
                  </button>
                ),
              }] : []),
            ]}
            footer={() =>
              isEditable ? (
                <Button
                  type="dashed"
                  size="small"
                  onClick={() => setRefStandards([...refStandards, { name: '', lot_no: '', value: '', uom: '' }])}
                >
                  + Add standard
                </Button>
              ) : undefined
            }
          />
        </div>
      ),
    },

    // ── Enhancement Requests tab (shown conditionally) ─────────────────────
    ...(showEnhancementTab ? [{
      key: 'enhancements',
      label: `4. Enhancements (${data.enhancementRequests?.length ?? 0})`,
      children: (
        <div className="pb-5 space-y-3">
          {data.enhancementRequests?.length === 0 ? (
            <Empty description="No enhancement requests" className="py-8" />
          ) : (
            data.enhancementRequests?.map((er, i) => (
              <div key={er.id ?? i} className="border border-slate-100 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-700">{er.additionalTestType || 'Enhancement'}</span>
                  <Tag color={er.status === 'APPROVED' ? 'green' : er.status === 'REJECTED' ? 'red' : 'gold'}>
                    {er.status}
                  </Tag>
                </div>
                <p className="text-slate-600">{er.reason}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Requested by {er.requestedBy} · {dayjs(er.createdAt).format('DD MMM YYYY')}
                </p>
                {er.reviewRemarks && (
                  <p className="text-xs text-slate-500 italic mt-1">Review: {er.reviewRemarks}</p>
                )}
              </div>
            ))
          )}
          {(isEditable || (status === 'VERIFIED' && canAcceptTest)) && (
            <Button
              type="dashed"
              size="small"
              onClick={() => setEnhOpen(true)}
            >
              + Request enhancement
            </Button>
          )}
        </div>
      ),
    }] : []),

    // ── Chromatographic Section tab ──────────────────────────────────
    {
      key: 'chromatographic',
      label: '5. Chromatographic Data',
      children: (
        <div className="pb-5 space-y-3">
          <p className="text-xs text-slate-500">Upload chromatographic data files (raw data, integration reports, etc.) separately from general attachments.</p>
          <ArdAttachmentsPanel
            entityType="test_request"
            entityId={testId}
            readOnly={!isEditable}
            label="Chromatographic Data Files"
          />
        </div>
      ),
    },

    // ── Attachments tab ──────────────────────────────────────────────
    {
      key: 'attachments',
      label: '6. Attachments',
      children: (
        <div className="pb-4">
          <ArdAttachmentsPanel
            entityType="test_request"
            entityId={testId}
            readOnly={!isEditable}
            label="Test Attachments"
          />
        </div>
      ),
    },

    // ── History tab ─────────────────────────────────────────────────
    {
      key: 'history',
      label: `7. History (v${data.version})`,
      children: (
        <div className="pb-5">
          {!data.versions?.length ? (
            <Empty description="No submission history yet" className="py-8" />
          ) : (
            <Collapse
              size="small"
              ghost
              items={[...data.versions].reverse().map((v, i) => ({
                key: i,
                label: (
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">Version {v.version}</span>
                    {v.status && (
                      <Tag color={STATUS_COLOR[v.status] ?? 'default'} className="text-xs">
                        {STATUS_LABEL[v.status] ?? v.status}
                      </Tag>
                    )}
                    <span className="text-xs text-slate-400">
                      {v.submittedAt ? dayjs(v.submittedAt).format('DD MMM YYYY HH:mm') : ''}
                    </span>
                  </span>
                ),
                children: (
                  <div className="text-sm text-slate-600 space-y-1 pl-2">
                    {v.submittedBy && <p>Submitted by: <strong>{v.submittedBy}</strong></p>}
                    {v.verifyRemarks && <p>Remarks: <em>{v.verifyRemarks}</em></p>}
                  </div>
                ),
              }))}
            />
          )}
        </div>
      ),
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between glass-card rounded-lg p-4">
        <div>
          <button
            onClick={() => navigate('/ard/tests')}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-violet-500 mb-2 transition-colors font-medium"
          >
            <ArrowLeft size={14} /> Back to Tests
          </button>
          <div className="flex items-center gap-3">
            <FlaskConical size={22} className="text-violet-500 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">{data.testType}</h1>
              {data.testSubtype && <p className="text-sm text-slate-500">{data.testSubtype}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Claim Test for Analysts */}
          {isAnalystRole && (!data.assignedToName || status === 'UNASSIGNED') && (
            isUserQualifiedForTest ? (
              <Button
                type="primary"
                icon={<UserCheck size={14} />}
                loading={claimMut.isPending}
                disabled={anyBusy}
                onClick={() => claimMut.mutate()}
                style={{ background: '#2563eb', borderColor: '#2563eb' }}
              >
                Claim Test / Assign to Me
              </Button>
            ) : (
              <Tag color="volcano" className="px-2.5 py-1 text-xs font-semibold rounded-md border-none flex items-center gap-1">
                Not Qualified for {qualifiedData?.techniqueKey || 'Technique'}
              </Tag>
            )
          )}

          {/* Assign Analyst for Team Leads / HODs */}
          {(canVerify || role === 'TL' || role === 'HOD' || role === 'SUPER_ADMIN') && (
            <Button
              icon={<UserCheck size={14} className="text-violet-600" />}
              disabled={anyBusy}
              onClick={() => {
                setSelectedAssignAnalystId(data.assignedToId || '')
                setAssignOpen(true)
              }}
              className="border-violet-500 text-violet-700 bg-violet-50 hover:bg-violet-100 font-semibold"
            >
              Assign Analyst
            </Button>
          )}

          {/* Delegate Test */}
          {status === 'ASSIGNED' && (isAssignedAnalyst || role === 'TL' || role === 'SUPER_ADMIN') && (
            <Button
              icon={<RotateCcw size={14} className="text-purple-600" />}
              disabled={anyBusy}
              onClick={() => setDelegateOpen(true)}
              className="border-purple-500 text-purple-700 bg-purple-50 hover:bg-purple-100 font-semibold"
            >
              Delegate Test
            </Button>
          )}

          {/* Start Test — AR number is generated as part of this action, not before */}
          {status === 'ASSIGNED' && canExecute && isAssignedAnalyst && (
            <Button
              type="primary"
              icon={<Play size={14} />}
              loading={startMut.isPending}
              disabled={anyBusy}
              onClick={() => startMut.mutate()}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              Start Test
            </Button>
          )}

          {/* Save Results */}
          {executingStatuses.includes(status) && canExecute && isAssignedAnalyst && (
            <Button
              icon={<Save size={14} />}
              loading={saveMut.isPending}
              disabled={anyBusy}
              onClick={() => saveMut.mutate()}
            >
              Save Results
            </Button>
          )}

          {/* Final Report — one shared upload slot for the whole test */}
          <FinalReportUpload testId={testId} readOnly={!isEditable} />

          {/* Submit for Verification */}
          {executingStatuses.includes(status) && canExecute && isAssignedAnalyst && (
            <Button
              type="primary"
              icon={<Send size={14} />}
              loading={submitMut.isPending}
              disabled={anyBusy}
              onClick={handleSubmitClick}
            >
              Submit for Verification
            </Button>
          )}

          {/* Review (Verify / Rework) */}
          {status === 'VERIFICATION_REQUESTED' && canVerify && (
            <Button
              type="primary"
              icon={<ShieldCheck size={14} />}
              disabled={anyBusy}
              onClick={() => setReviewOpen(true)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              Review Result
            </Button>
          )}

          {/* Publish Tentative — available from IN_PROGRESS (early visibility) or VERIFIED */}
          {(status === 'IN_PROGRESS' || status === 'VERIFIED') && canPublishTentative && (
            <Button
              icon={<Eye size={14} />}
              loading={publishTentativeMut.isPending}
              disabled={anyBusy}
              onClick={() => publishTentativeMut.mutate()}
              className="border-cyan-500 text-cyan-700 hover:border-cyan-600 hover:text-cyan-800"
            >
              Publish Tentative
            </Button>
          )}

          {/* Unsatisfactory — HOD/QA/Admin or requester marks results unsatisfactory */}
          {(status === 'VERIFIED' || status === 'TENTATIVE' || status === 'ACCEPTED') && canAcceptTest && (
            <Button
              icon={<AlertTriangle size={14} />}
              loading={unsatMut.isPending}
              disabled={anyBusy}
              onClick={() => setUnsatOpen(true)}
              danger
            >
              Unsatisfactory
            </Button>
          )}

          {/* Withdraw Test */}
          {['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION_REWORK', 'UNASSIGNED'].includes(status) && canWithdrawTest && (
            <Button
              icon={<RotateCcw size={14} />}
              loading={withdrawMut.isPending}
              disabled={anyBusy}
              onClick={() => setWithdrawOpen(true)}
              danger
              ghost
            >
              Withdraw Test
            </Button>
          )}

          {/* Accept Test */}
          {(status === 'TENTATIVE' || status === 'VERIFIED') && canAcceptTest && (
            <Button
              type="primary"
              icon={<CheckCircle2 size={14} />}
              loading={acceptTestMut.isPending}
              disabled={anyBusy}
              onClick={() => acceptTestMut.mutate()}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              Accept Test
            </Button>
          )}

          <Tag
            color={STATUS_COLOR[status] ?? 'default'}
            className="text-sm px-3 py-1.5 h-auto font-semibold rounded-md m-0"
          >
            {STATUS_LABEL[status] ?? status}
          </Tag>
        </div>
      </div>

      {/* ── Rework / unlock alert ── */}
      {(status === 'VERIFICATION_REWORK' || status === 'UNLOCKED') && data.verifyRemarks && (
        <Alert
          type="warning"
          showIcon
          icon={<RotateCcw size={16} />}
          message={status === 'UNLOCKED' ? 'Test unlocked for re-submission' : 'Returned for rework'}
          description={data.verifyRemarks}
        />
      )}

      {/* View mode container */}
      {viewMode === 'tabbed' ? (
        <div className="glass-card rounded-lg overflow-hidden p-4">
          <Tabs
            type="card"
            destroyInactiveTabPane={false}
            tabBarExtraContent={
              <Segmented
                value={viewMode}
                onChange={(v) => setViewMode(v as 'tabbed' | 'single')}
                options={[
                  { label: 'Tabbed View', value: 'tabbed', icon: <LayoutList size={14} className="inline mr-1" /> },
                  { label: 'Single Page View', value: 'single', icon: <FileText size={14} className="inline mr-1" /> },
                ]}
              />
            }
            items={testTabItems}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end mb-2">
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as 'tabbed' | 'single')}
              options={[
                { label: 'Tabbed View', value: 'tabbed', icon: <LayoutList size={14} className="inline mr-1" /> },
                { label: 'Single Page View', value: 'single', icon: <FileText size={14} className="inline mr-1" /> },
              ]}
            />
          </div>
          {testTabItems.map((tab) => (
            <Card
              key={tab.key}
              title={<span className="font-bold text-slate-800 text-base">{tab.label}</span>}
              className="glass-card rounded-lg overflow-hidden"
            >
              {tab.children}
            </Card>
          ))}
        </div>
      )}



      {/* ── OOS Interlocking Warning Dialog ── */}
      <Modal
        {...glassModalProps}
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold">
            <AlertTriangle size={20} />
            <span>Mandatory OOS (Out-of-Specification) Warning</span>
          </div>
        }
        open={oosOpen}
        onCancel={() => setOosOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOosOpen(false)}>
            Cancel & Correct Data
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger
            onClick={() => {
              setOosOpen(false)
              setEsignTargetAction('SUBMIT')
            }}
          >
            Acknowledge OOS & Proceed to Sign
          </Button>,
        ]}
      >
        <div className="space-y-3 py-2">
          <Alert
            type="error"
            showIcon
            message="Out-of-Specification Results Detected"
            description="One or more test parameters fall outside configured specification limits. Continuing will flag this submission as OOS in the laboratory audit log."
          />
          <div className="bg-red-50/50 p-3 rounded-lg border border-red-200">
            <p className="text-xs font-semibold uppercase text-red-700 tracking-wide mb-2">Out-of-Specification Parameters:</p>
            {applyFormulas(results)
              .filter(r => evalPassFail(r.value, r.lower_limit, r.upper_limit) === 'FAIL')
              .map((r, i) => (
                <div key={i} className="text-xs text-red-800 flex justify-between py-1 border-b border-red-100 last:border-0">
                  <span className="font-semibold">{r.param_label || r.param_name}: {r.value}</span>
                  <span className="font-mono">Spec Limits: {r.lower_limit ?? '—'} to {r.upper_limit ?? '—'} {r.uom}</span>
                </div>
              ))}
          </div>
          <p className="text-xs text-slate-500">
            Please confirm that you have double-checked all calculations, equipment calibrations, and weighings before proceeding.
          </p>
        </div>
      </Modal>

      {/* ── GxP Electronic Signature Modal ── */}
      <ESignatureModal
        open={esignTargetAction !== null}
        userName={user?.username ?? ''}
        title={`Electronic Signature — ${esignTargetAction === 'SUBMIT' ? 'Submit Test Results' : esignTargetAction === 'VERIFY' ? 'Verify Test' : 'Withdraw Test'}`}
        reasonLabel={esignTargetAction === 'WITHDRAW' ? 'Reason for Withdrawal' : 'Reason for signing'}
        loading={submitMut.isPending || verifyMut.isPending || reworkMut.isPending || withdrawMut.isPending}
        onCancel={() => setEsignTargetAction(null)}
        onConfirm={async (payload) => {
          if (esignTargetAction === 'SUBMIT') {
            await submitMut.mutateAsync(payload.password)
          } else if (esignTargetAction === 'VERIFY') {
            await verifyMut.mutateAsync(payload.password)
          } else if (esignTargetAction === 'WITHDRAW') {
            await withdrawMut.mutateAsync(payload.password)
          }
          setEsignTargetAction(null)
        }}
      />

      {/* ── Review modal ── */}
      <Modal
        {...glassModalProps}
        title="Review Test Result"
        open={reviewOpen}
        onCancel={() => { setReviewOpen(false); setReviewRemarks('') }}
        footer={null}
        width={500}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Review the submitted results and enter remarks before verifying or requesting rework.
          </p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Remarks <span className="text-red-400">(required for rework)</span>
            </label>
            <TextArea
              rows={3}
              value={reviewRemarks}
              onChange={e => setReviewRemarks(e.target.value)}
              placeholder="Describe what needs to be corrected, or leave blank if verifying."
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Reassign Analyst for Rework <span className="text-slate-400">(optional)</span>
            </label>
            <Select
              className="w-full"
              allowClear
              placeholder="Keep current analyst or select replacement"
              value={reworkAnalystId || undefined}
              onChange={(v) => setReworkAnalystId(v ?? '')}
              options={(teamUsersData?.items ?? [])
                .filter((u) => ['ANALYST', 'CHEM', 'TL'].includes(u.role_code))
                .map((u) => ({ value: u.id, label: u.full_name || u.username }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setReviewOpen(false); setReviewRemarks('') }}>
              Cancel
            </Button>
            <Button
              danger
              icon={<RotateCcw size={14} />}
              loading={reworkMut.isPending}
              disabled={!reviewRemarks.trim() || anyBusy}
              onClick={() => reworkMut.mutate()}
            >
              Request Rework
            </Button>
            <Button
              type="primary"
              icon={<ShieldCheck size={14} />}
              loading={verifyMut.isPending}
              disabled={anyBusy}
              onClick={() => {
                setReviewOpen(false)
                setEsignTargetAction('VERIFY')
              }}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              Verify
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Enhancement request modal ── */}
      <Modal
        {...glassModalProps}
        title="Request Enhancement Test"
        open={enhOpen}
        onCancel={() => { setEnhOpen(false); setEnhReason(''); setEnhTestType('') }}
        footer={null}
        width={460}
      >
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Additional Test Type
            </label>
            <Input
              value={enhTestType}
              onChange={e => setEnhTestType(e.target.value)}
              placeholder="e.g. Impurity Profile"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <TextArea
              rows={3}
              value={enhReason}
              onChange={e => setEnhReason(e.target.value)}
              placeholder="Explain why this enhancement test is needed..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setEnhOpen(false); setEnhReason(''); setEnhTestType('') }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={enhMut.isPending}
              disabled={!enhReason.trim()}
              onClick={() => enhMut.mutate()}
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Withdraw Test modal ── */}
      <Modal
        {...glassModalProps}
        title="Withdraw Test"
        open={withdrawOpen}
        onCancel={() => { setWithdrawOpen(false); setWithdrawRemarks('') }}
        footer={null}
        width={460}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">
            Withdraw this test from the current analyst and return it to unassigned status.
          </p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Remarks <span className="text-red-400">*</span>
            </label>
            <TextArea
              rows={3}
              value={withdrawRemarks}
              onChange={e => setWithdrawRemarks(e.target.value)}
              placeholder="State reason for withdrawal..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setWithdrawOpen(false); setWithdrawRemarks('') }}>Cancel</Button>
            <Button
              danger
              icon={<RotateCcw size={14} />}
              loading={withdrawMut.isPending}
              disabled={!withdrawRemarks.trim() || anyBusy}
              onClick={() => { setWithdrawOpen(false); setEsignTargetAction('WITHDRAW') }}
            >
              Confirm Withdraw
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Unsatisfactory modal ── */}
      <Modal
        {...glassModalProps}
        title="Mark as Unsatisfactory"
        open={unsatOpen}
        onCancel={() => { setUnsatOpen(false); setUnsatRemarks('') }}
        footer={null}
        width={460}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">
            Mark this test result as unsatisfactory. This will flag it for HOD review and update the ATR status accordingly.
          </p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <TextArea
              rows={3}
              value={unsatRemarks}
              onChange={e => setUnsatRemarks(e.target.value)}
              placeholder="Describe why the results are unsatisfactory..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setUnsatOpen(false); setUnsatRemarks('') }}>Cancel</Button>
            <Button
              danger
              loading={unsatMut.isPending}
              disabled={!unsatRemarks.trim() || anyBusy}
              onClick={() => unsatMut.mutate()}
            >
              Mark Unsatisfactory
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Assign Analyst modal ── */}
      <Modal
        {...glassModalProps}
        title="Assign Analyst to Test"
        open={assignOpen}
        onCancel={() => { setAssignOpen(false); setAssignPassword('') }}
        onOk={() => {
          const target = teamUsersData?.items.find((u) => u.id === selectedAssignAnalystId)
          if (target) assignMut.mutate(target)
        }}
        confirmLoading={assignMut.isPending}
        okText="Assign Analyst"
        okButtonProps={{ disabled: !selectedAssignAnalystId || !assignPassword }}
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <p className="text-xs text-slate-600">
            Select an analyst from your team to perform test: <strong>{data.testType}</strong>.
          </p>
          <Form.Item label="Select Analyst *" required style={{ marginBottom: 0 }}>
            <Select
              showSearch
              placeholder={qualifiedLoading ? "Loading qualified analysts..." : "Select team analyst..."}
              loading={qualifiedLoading}
              value={selectedAssignAnalystId}
              onChange={setSelectedAssignAnalystId}
              options={analystOptions}
            />
          </Form.Item>
          <Form.Item label="Your Password (e-signature) *" required style={{ marginBottom: 0 }}>
            <Input.Password
              placeholder="Re-enter your password to confirm"
              value={assignPassword}
              onChange={(e) => setAssignPassword(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Delegate Test modal ── */}
      <Modal
        {...glassModalProps}
        title="Delegate Test"
        open={delegateOpen}
        onCancel={() => setDelegateOpen(false)}
        onOk={() => {
          const target = teamUsersData?.items.find((u) => u.id === selectedDelegateUserId)
          if (!target) {
            message.error('Please select an analyst to delegate to.')
            return
          }
          delegateMut.mutate(target)
        }}
        confirmLoading={delegateMut.isPending}
        okText="Delegate Test"
        destroyOnClose
      >
        <Form layout="vertical" className="pt-2 space-y-3">
          <p className="text-xs text-slate-600">
            Delegate execution of test (<strong>{data.testType}</strong>) to another analyst or team lead.
          </p>
          <Form.Item label="Delegate To (Main TL / Analyst) *" required style={{ marginBottom: 12 }}>
            <Select
              showSearch
              placeholder="Select Main TL or Analyst to delegate to..."
              value={selectedDelegateUserId}
              onChange={setSelectedDelegateUserId}
              options={delegateOptions}
            />
          </Form.Item>
          <Form.Item label="Remarks / Reason for Delegation" style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={3}
              placeholder="Enter reason for delegating..."
              value={delegateRemarks}
              onChange={(e) => setDelegateRemarks(e.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
