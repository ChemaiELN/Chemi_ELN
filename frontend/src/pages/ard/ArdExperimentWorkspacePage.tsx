import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tag, Button, Card, Space, Popconfirm, message, Empty, Spin, Alert, Divider,
  Drawer, Timeline, Select, Table, Input, Form, Modal, Tooltip, Segmented, Dropdown, Upload,
} from 'antd'
import { ArrowLeft, FlaskConical, Save, Download, History, Link, Eye, Trash2, Search, FileText, RotateCcw, Copy, Activity, Database, MessageSquare } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardExperimentApi, ardApi, type ExperimentStatus, type ArdExperimentDoc,
  type VersionsResponse, type VersionCompareResponse, type RefExperiment,
  type ExperimentLockInfo,
} from '../../api/ard'
import type { TemplateSection } from '../../api/ard'
import { ApiError } from '../../api/client'
import ExperimentSectionRenderer from '../../components/ard/ExperimentSectionRenderer'
import type { SectionDef } from '../../components/ard/ExperimentSectionRenderer'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import RichEditor from '../../components/RichEditor'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { inventoryApi } from '../../api/inventory'
import { userApi } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { ardProjectsApi } from '../../api/ard-projects'
import { ardNotebooksApi } from '../../api/ard-notebooks'
import { useBreadcrumbLabel, useBreadcrumbPrefix } from '../../components/layout/ArdShell'

const STATUS_COLOR: Record<string, string> = {
  NEW: 'default', IN_PROGRESS: 'blue', SUBMITTED: 'purple', VERIFICATION_REQUESTED: 'gold',
  VERIFIED: 'cyan', APPROVED: 'green', REWORK: 'red', VERIFICATION_REWORK: 'magenta',
  UNLOCK_REQUESTED: 'volcano', UNLOCKED: 'geekblue', DEACTIVATED: 'default',
}

const STATUS_LABEL: Record<string, string> = {
  NEW: 'New',
  IN_PROGRESS: 'Ongoing',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  VERIFICATION_REQUESTED: 'Verification Requested',
  VERIFICATION_REWORK: 'Verification Rework',
  VERIFIED: 'Verified',
  REWORK: 'Rework',
  UNLOCK_REQUESTED: 'Unlock Requested',
  UNLOCKED: 'Unlocked',
  DEACTIVATED: 'Deactivated',
}

// Correct experiment flow (per Chemia ELN manual):
// NEW → (first save) → IN_PROGRESS → [VERIFICATION_REQUESTED → VERIFIED] → SUBMITTED → APPROVED → UNLOCK_REQUESTED → UNLOCKED → IN_PROGRESS
// NEW -> IN_PROGRESS is NOT a manual transition button — the backend flips
// it automatically the first time PATCH /:experimentId saves anything, so
// NEW only ever offers Discontinue here.
// Verification step is optional (controlled by VerificationRequestFlow ARD setting).
// Both VERIFICATION_REQUESTED and SUBMITTED are offered from IN_PROGRESS; backend enforces the setting.
const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  // NEW normally auto-flips to IN_PROGRESS on its first save (PATCH
  // /:experimentId), but the same submit options must be reachable even
  // before that first save happens — a NEW experiment with nothing yet
  // touched previously offered nothing but Discontinue.
  NEW: ['VERIFICATION_REQUESTED', 'SUBMITTED', 'DEACTIVATED'],
  IN_PROGRESS: ['VERIFICATION_REQUESTED', 'SUBMITTED', 'DEACTIVATED'],
  VERIFICATION_REQUESTED: ['VERIFIED', 'VERIFICATION_REWORK', 'DEACTIVATED'],
  // Backend previously had no exit from VERIFICATION_REWORK at all — every
  // transition attempt 400'd, leaving the experiment permanently stuck.
  // Fixed alongside ardExperiments.routes.ts's EXPERIMENT_TRANSITIONS: same
  // two exits REWORK gets — edit further, or go straight back to review.
  VERIFICATION_REWORK: ['IN_PROGRESS', 'VERIFICATION_REQUESTED', 'DEACTIVATED'],
  VERIFIED: ['SUBMITTED', 'DEACTIVATED'],
  SUBMITTED: ['APPROVED', 'REWORK', 'DEACTIVATED'],
  // Was ['SUBMITTED'] — the backend only ever allowed REWORK -> IN_PROGRESS
  // (the owner has to actually re-enter editing before resubmitting), so this
  // showed a "Submit for Approval" button that 400'd every time it was
  // clicked directly from REWORK. Verified live: SUBMITTED->REWORK->SUBMITTED
  // hit "Transition 'SUBMITTED' not allowed from status 'REWORK'".
  REWORK: ['IN_PROGRESS', 'DEACTIVATED'],
  // DEACTIVATED added to every remaining non-terminal state below — legacy's
  // Discontinue is an administrative override reachable from "most
  // non-terminal states", but this map previously only allowed it from
  // NEW/IN_PROGRESS/VERIFICATION_REQUESTED/SUBMITTED.
  APPROVED: ['UNLOCK_REQUESTED', 'DEACTIVATED'],
  // Backend previously only allowed UNLOCK_REQUESTED -> UNLOCKED — an
  // approver could grant an unlock request but never decline one, leaving it
  // stuck in UNLOCK_REQUESTED forever. 'APPROVED' here is the reject path
  // (stays/returns to Approved unchanged), distinguished from a normal
  // SUBMITTED->APPROVED by its `from` in history and by the dedicated label
  // below.
  UNLOCK_REQUESTED: ['UNLOCKED', 'APPROVED', 'DEACTIVATED'],
  UNLOCKED: ['IN_PROGRESS', 'DEACTIVATED'],
  DEACTIVATED: [],
}

// Which category of user can trigger each target status
const TRANSITION_ROLE: Partial<Record<ExperimentStatus, 'analyst' | 'reviewer' | 'approver' | 'any'>> = {
  VERIFICATION_REQUESTED: 'analyst',  // analyst submits for peer verification
  SUBMITTED: 'analyst',               // analyst submits for approval (direct or after rework); overridden below for VERIFIED state
  IN_PROGRESS: 'analyst',             // analyst resumes after unlock
  VERIFIED: 'reviewer',               // TL/HOD marks verified
  VERIFICATION_REWORK: 'reviewer',    // TL/HOD returns for verification rework
  APPROVED: 'approver',               // HOD/QA final approval
  REWORK: 'reviewer',                 // TL/HOD returns for rework
  UNLOCK_REQUESTED: 'reviewer',       // TL requests unlock (HOD/QA approves)
  UNLOCKED: 'approver',              // HOD/QA approves unlock
  DEACTIVATED: 'any',                // owner or TL/HOD
}

const TRANSITION_LABEL: Record<string, string> = {
  VERIFICATION_REQUESTED: 'Submit for Review',
  VERIFIED: 'Mark Verified',
  VERIFICATION_REWORK: 'Return for Verification Rework',
  SUBMITTED: 'Submit for Approval',
  SUBMITTED_FROM_VERIFIED: 'Send for HOD Approval',
  APPROVED: 'Approve',
  REWORK: 'Return for Rework',
  UNLOCK_REQUESTED: 'Request Unlock',
  UNLOCKED: 'Approve Unlock',
  APPROVED_FROM_UNLOCK_REQUESTED: 'Reject Unlock Request',
  DEACTIVATED: 'Discontinue Experiment',
  IN_PROGRESS: 'Resume Experiment',
}

// ── Version History Drawer ────────────────────────────────────────────────────

function VersionHistoryDrawer({
  experimentId,
  sectionDefs,
  open,
  onClose,
}: {
  experimentId: string
  sectionDefs: SectionDef[]
  open: boolean
  onClose: () => void
}) {
  const [v1Sel, setV1Sel] = useState<number | null>(null)
  const [v2Sel, setV2Sel] = useState<number | null>(null)
  const [compareResult, setCompareResult] = useState<VersionCompareResponse | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareErr, setCompareErr] = useState<string | null>(null)

  const { data: versionsData, isLoading } = useQuery<VersionsResponse>({
    queryKey: ['ard-experiment-versions', experimentId],
    queryFn: () => ardExperimentApi.versions(experimentId),
    enabled: open,
  })

  const handleCompare = async () => {
    if (v1Sel === null || v2Sel === null) return
    setComparing(true)
    setCompareErr(null)
    setCompareResult(null)
    try {
      const res = await ardExperimentApi.compareVersions(experimentId, v1Sel, v2Sel)
      setCompareResult(res)
    } catch (e: any) {
      setCompareErr(e?.detail ?? 'Comparison failed — snapshots only exist for saves made after this feature was enabled.')
    } finally {
      setComparing(false)
    }
  }

  // Unified timeline: snapshots (saves) + status transitions, newest first
  const timeline = useMemo(() => {
    const snaps = (versionsData?.snapshots ?? []).map(s => ({
      type: 'save' as const, version: s.version, at: s.savedAt, by: s.savedBy, status: s.status,
    }))
    const hist = (versionsData?.statusHistory ?? []).map(h => ({
      type: 'status' as const, from: h.from, to: h.to, at: h.at, by: h.by, remarks: h.remarks,
    }))
    return [...snaps, ...hist].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  }, [versionsData])

  const versionOptions = useMemo(() =>
    (versionsData?.snapshots ?? [])
      .slice()
      .sort((a, b) => b.version - a.version)
      .map(s => ({
        value: s.version,
        label: `v${s.version} — ${dayjs(s.savedAt).format('DD MMM YYYY HH:mm')} by ${s.savedBy}`,
      }))
  , [versionsData])

  // Build comparison table rows from sectionDefs + compareResult
  const compareRows = useMemo(() => {
    if (!compareResult) return []
    return sectionDefs.map(sec => {
      const v1sum = compareResult.v1.sectionSummary?.[sec.id]
      const v2sum = compareResult.v2.sectionSummary?.[sec.id]
      const changed = compareResult.changes?.[sec.id] ?? false
      return {
        id: sec.id,
        title: sec.title,
        v1HasData: v1sum?.hasData ?? false,
        v1Count: v1sum?.count ?? 0,
        v2HasData: v2sum?.hasData ?? false,
        v2Count: v2sum?.count ?? 0,
        changed,
      }
    })
  }, [compareResult, sectionDefs])

  return (
    <Drawer
      title={<span className="flex items-center gap-2 text-slate-800 font-bold"><History size={18} className="text-violet-600" /> Version History</span>}
      open={open}
      onClose={onClose}
      width={820}
      styles={{
        header: { background: '#ffffff', borderBottom: '1px solid #f1f5f9', zIndex: 10 },
        body: { padding: '20px 24px', background: '#ffffff' },
      }}
    >
      {isLoading ? (
        <div className="flex justify-center py-10"><Spin /></div>
      ) : (
        <div className="space-y-6">
          {/* Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activity Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No saves recorded yet. Version snapshots are captured on each save.</p>
            ) : (
              <Timeline
                mode="left"
                items={timeline.map(t =>
                  t.type === 'save'
                    ? {
                        color: 'blue',
                        label: <span className="text-xs text-slate-400">{dayjs(t.at).format('DD MMM YYYY HH:mm')}</span>,
                        children: (
                          <span className="text-sm">
                            <span className="font-semibold text-indigo-700">v{t.version}</span> saved by {t.by}
                            <Tag color={STATUS_COLOR[t.status] ?? 'default'} className="ml-2 text-xs">{t.status}</Tag>
                          </span>
                        ),
                      }
                    : {
                        color: 'green',
                        label: <span className="text-xs text-slate-400">{dayjs(t.at).format('DD MMM YYYY HH:mm')}</span>,
                        children: (
                          <span className="text-sm">
                            Status: <Tag color={STATUS_COLOR[t.from] ?? 'default'} className="text-xs">{t.from}</Tag>
                            →
                            <Tag color={STATUS_COLOR[t.to] ?? 'default'} className="ml-1 text-xs">{t.to}</Tag>
                            by {t.by}
                            {t.remarks && <span className="ml-1 text-slate-500 italic text-xs">"{t.remarks}"</span>}
                          </span>
                        ),
                      }
                )}
              />
            )}
          </div>

          <Divider />

          {/* Compare section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Compare Versions</h3>
            {versionOptions.length < 2 ? (
              <p className="text-sm text-slate-400 italic">At least two saved versions are needed to compare. Save the experiment to create version snapshots.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-3 mb-4">
                  <Select
                    placeholder="Base version"
                    style={{ width: 280 }}
                    options={versionOptions}
                    value={v1Sel}
                    onChange={v => { setV1Sel(v); setCompareResult(null) }}
                  />
                  <Select
                    placeholder="Compare to"
                    style={{ width: 280 }}
                    options={versionOptions}
                    value={v2Sel}
                    onChange={v => { setV2Sel(v); setCompareResult(null) }}
                  />
                  <Button
                    type="primary"
                    onClick={handleCompare}
                    loading={comparing}
                    disabled={v1Sel === null || v2Sel === null || v1Sel === v2Sel}
                  >
                    Compare
                  </Button>
                </div>

                {compareErr && <Alert type="warning" showIcon message={compareErr} className="mb-4" />}

                {compareResult && (
                  <Table
                    size="small"
                    rowKey="id"
                    pagination={false}
                    dataSource={compareRows}
                    columns={[
                      {
                        title: 'Section',
                        dataIndex: 'title',
                        render: (v, row) => (
                          <span className={row.changed ? 'font-semibold text-amber-700' : 'text-slate-700'}>
                            {v}
                          </span>
                        ),
                      },
                      {
                        title: `v${v1Sel} (${dayjs(compareResult.v1.savedAt).format('DD MMM HH:mm')})`,
                        render: (_, row) => row.v1HasData
                          ? <Tag color="blue" className="text-xs">{row.v1Count > 1 ? `${row.v1Count} rows` : 'Has data'}</Tag>
                          : <span className="text-slate-300 text-xs">Empty</span>,
                      },
                      {
                        title: `v${v2Sel} (${dayjs(compareResult.v2.savedAt).format('DD MMM HH:mm')})`,
                        render: (_, row) => row.v2HasData
                          ? <Tag color="blue" className="text-xs">{row.v2Count > 1 ? `${row.v2Count} rows` : 'Has data'}</Tag>
                          : <span className="text-slate-300 text-xs">Empty</span>,
                      },
                      {
                        title: 'Diff',
                        width: 90,
                        render: (_, row) => row.changed
                          ? <Tag color="orange" className="text-xs font-semibold">Changed</Tag>
                          : <Tag color="green" className="text-xs">Same</Tag>,
                      },
                    ]}
                    rowClassName={row => row.changed ? 'bg-amber-50/60' : ''}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

// ── Reference Experiments Panel ───────────────────────────────────────────────

function ReferenceExperimentsPanel({
  experimentId,
  currentProjectId,
  refs,
  canEdit,
  onUpdate,
  saving,
}: {
  experimentId: string
  currentProjectId?: string
  refs: RefExperiment[]
  canEdit: boolean
  onUpdate: (refs: RefExperiment[]) => void
  saving: boolean
}) {
  const user = useAppSelector(selectUser)
  const [addOpen, setAddOpen] = useState(false)
  const [linkMode, setLinkMode] = useState<'browse' | 'search'>('browse')
  const [searchCode, setSearchCode] = useState('')
  const [searchResult, setSearchResult] = useState<ArdExperimentDoc | null | 'not_found'>(null)
  const [searching, setSearching] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | undefined>()
  const [selectedExpId, setSelectedExpId] = useState<string | undefined>()

  const { data: previewExp, isLoading: previewLoading } = useQuery<ArdExperimentDoc | null>({
    queryKey: ['ard-exp-by-code', previewCode],
    queryFn: () => ardExperimentApi.getByCode(previewCode!),
    enabled: !!previewCode,
    retry: false,
  })

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['ref-exp-projects'],
    queryFn: () => ardProjectsApi.list({ pageSize: 100 }),
    enabled: addOpen,
  })

  const { data: notebooksData, isLoading: notebooksLoading } = useQuery({
    queryKey: ['ref-exp-notebooks', selectedProjectId],
    queryFn: () => ardNotebooksApi.list({ projectId: selectedProjectId, pageSize: 100 }),
    enabled: addOpen && !!selectedProjectId,
  })

  const { data: expsData, isLoading: expsLoading } = useQuery({
    queryKey: ['ref-exp-experiments', selectedNotebookId],
    queryFn: () => ardNotebooksApi.experiments(selectedNotebookId!),
    enabled: addOpen && !!selectedNotebookId,
  })

  const resetModalState = () => {
    setAddOpen(false)
    setSearchCode('')
    setSearchResult(null)
    setSelectedCode(null)
    setSelectedProjectId(undefined)
    setSelectedNotebookId(undefined)
    setSelectedExpId(undefined)
    setRemarks('')
  }

  const handleSearch = async () => {
    const code = searchCode.trim().toUpperCase()
    if (!code) return
    setSearching(true)
    setSearchResult(null)
    try {
      const res = await ardExperimentApi.getByCode(code)
      if (['DEACTIVATED', 'DISCONTINUED'].includes((res.status || '').toUpperCase())) {
        message.warning('Discontinued / deactivated experiments cannot be linked as a reference.')
        setSearchResult(null)
      } else if (refs.some(r => r.code === res.code)) {
        message.warning('This experiment is already linked.')
        setSearchResult(null)
      } else if (res.id === experimentId) {
        message.warning('Cannot link an experiment to itself.')
        setSearchResult(null)
      } else {
        setSearchResult(res)
        setSelectedCode(res.code)
      }
    } catch {
      setSearchResult('not_found')
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = () => {
    if (!selectedCode) return
    const newRef: RefExperiment = {
      code: selectedCode,
      remarks: remarks.trim() || undefined,
      addedBy: user?.username,
      addedAt: new Date().toISOString(),
    }
    onUpdate([...refs, newRef])
    resetModalState()
  }

  const handleRemove = (code: string) => {
    onUpdate(refs.filter(r => r.code !== code))
  }

  return (
    <Card
      size="small"
      title={
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Link size={14} className="text-violet-500" />
          Reference Experiments
          {refs.length > 0 && <Tag color="default" className="text-xs font-normal ml-1">{refs.length}</Tag>}
        </span>
      }
      extra={
        canEdit && (
          <Button size="small" icon={<Link size={12} />} onClick={() => setAddOpen(true)}>
            Add Reference
          </Button>
        )
      }
      className="rounded-lg"
    >
      {refs.length === 0 ? (
        <p className="text-sm text-slate-400 italic py-1">No reference experiments linked.</p>
      ) : (
        <Table
          rowKey="code"
          size="small"
          pagination={false}
          dataSource={refs}
          columns={[
            {
              title: 'Code',
              dataIndex: 'code',
              width: 160,
              render: (v) => <span className="font-mono text-xs font-semibold text-indigo-700">{v}</span>,
            },
            {
              title: 'Remarks',
              dataIndex: 'remarks',
              render: (v) => v || <span className="text-slate-300 text-xs">—</span>,
            },
            {
              title: 'Linked By',
              dataIndex: 'addedBy',
              width: 120,
              render: (v) => v || '—',
            },
            {
              title: 'Date',
              dataIndex: 'addedAt',
              width: 120,
              render: (v) => v ? dayjs(v).format('DD MMM YYYY') : '—',
            },
            {
              title: '',
              width: 100,
              render: (_, row) => (
                <Space>
                  <Tooltip title="Preview experiment">
                    <Button
                      size="small"
                      type="link"
                      icon={<Eye size={13} />}
                      onClick={() => setPreviewCode(row.code)}
                    />
                  </Tooltip>
                  {canEdit && (
                    <Popconfirm
                      title="Remove this reference link?"
                      onConfirm={() => handleRemove(row.code)}
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" type="link" danger icon={<Trash2 size={13} />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      {/* Add Reference Modal */}
      <Modal
        {...glassModalProps}
        title="Link Reference Experiment"
        open={addOpen}
        onCancel={resetModalState}
        onOk={handleAdd}
        okText="Link Experiment"
        okButtonProps={{ disabled: !selectedCode }}
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          {/* Mode Switcher */}
          <Segmented
            value={linkMode}
            onChange={(v) => {
              setLinkMode(v as 'browse' | 'search')
              setSelectedCode(null)
              setSearchResult(null)
              setSelectedExpId(undefined)
            }}
            options={[
              { label: 'Select by Project / Notebook', value: 'browse' },
              { label: 'Search by Code', value: 'search' },
            ]}
            block
          />

          {linkMode === 'browse' ? (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Project</label>
                <Select
                  placeholder="Select a project..."
                  className="w-full"
                  loading={projectsLoading}
                  value={selectedProjectId}
                  onChange={(val) => {
                    setSelectedProjectId(val)
                    setSelectedNotebookId(undefined)
                    setSelectedExpId(undefined)
                    setSelectedCode(null)
                    setSearchResult(null)
                  }}
                  options={(projectsData?.items ?? [])
                    .filter(p => !currentProjectId || p.id !== currentProjectId)
                    .map(p => ({
                      value: p.id,
                      label: `${p.code} - ${p.productName || p.name || 'Project'}`,
                    }))}
                  showSearch
                  optionFilterProp="label"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Notebook</label>
                <Select
                  placeholder={!selectedProjectId ? 'First select a project' : 'Select a notebook...'}
                  className="w-full"
                  disabled={!selectedProjectId}
                  loading={notebooksLoading}
                  value={selectedNotebookId}
                  onChange={(val) => {
                    setSelectedNotebookId(val)
                    setSelectedExpId(undefined)
                    setSelectedCode(null)
                    setSearchResult(null)
                  }}
                  options={(notebooksData?.items ?? []).map(n => ({
                    value: n.id,
                    label: `${n.code} - ${n.name}`,
                  }))}
                  showSearch
                  optionFilterProp="label"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Select Experiment</label>
                <Select
                  placeholder={!selectedNotebookId ? 'First select a notebook' : 'Select an experiment...'}
                  className="w-full"
                  disabled={!selectedNotebookId}
                  loading={expsLoading}
                  value={selectedExpId}
                  onChange={(val) => {
                    setSelectedExpId(val)
                    const matched = expsData?.items?.find(e => e.id === val)
                    if (matched) {
                      if (refs.some(r => r.code === matched.code)) {
                        message.warning('This experiment is already linked.')
                        setSelectedExpId(undefined)
                        setSelectedCode(null)
                        setSearchResult(null)
                      } else if (matched.id === experimentId) {
                        message.warning('Cannot link an experiment to itself.')
                        setSelectedExpId(undefined)
                        setSelectedCode(null)
                        setSearchResult(null)
                      } else {
                        setSelectedCode(matched.code)
                        setSearchResult({
                          id: matched.id,
                          code: matched.code,
                          templateName: matched.templateName || '',
                          status: matched.status,
                          createdAt: matched.createdAt || '',
                        } as any)
                      }
                    }
                  }}
                  options={(expsData?.items ?? [])
                    .filter(e => !['DEACTIVATED', 'DISCONTINUED'].includes((e.status || '').toUpperCase()))
                    .map(e => ({
                      value: e.id,
                      label: `${e.code} ${e.templateName ? `(${e.templateName})` : ''} - ${STATUS_LABEL[e.status] ?? (e.status ? e.status.replace(/_/g, ' ') : '—')}`,
                    }))}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter experiment code (e.g. EXP-0042)"
                value={searchCode}
                onChange={e => { setSearchCode(e.target.value.toUpperCase()); setSearchResult(null) }}
                onPressEnter={handleSearch}
                allowClear
              />
              <Button
                icon={<Search size={14} />}
                loading={searching}
                onClick={handleSearch}
                disabled={!searchCode.trim()}
              >
                Search
              </Button>
            </div>
          )}

          {searchResult === 'not_found' && (
            <Alert type="error" showIcon message="Experiment not found. Check the code and try again." />
          )}

          {searchResult && searchResult !== 'not_found' && (
            <Card size="small" className="bg-indigo-50/60 border-indigo-200">
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-700">{searchResult.code}</span>
                  <Tag color={STATUS_COLOR[searchResult.status] ?? 'default'} className="text-xs">
                    {STATUS_LABEL[searchResult.status] ?? searchResult.status.replace(/_/g, ' ')}
                  </Tag>
                </div>
                {searchResult.templateName && (
                  <p className="text-slate-500 text-xs">{searchResult.templateName}</p>
                )}
                <p className="text-slate-400 text-xs">
                  Created: {searchResult.createdAt ? dayjs(searchResult.createdAt).format('DD MMM YYYY') : '—'}
                </p>
              </div>
            </Card>
          )}

          <Form.Item label="Remarks (optional)" style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Why is this experiment referenced?"
            />
          </Form.Item>
        </div>
      </Modal>

      {/* Preview Drawer */}
      <Drawer
        title={
          <span className="flex items-center gap-2">
            <Eye size={14} />
            Experiment Preview — {previewCode}
          </span>
        }
        open={!!previewCode}
        onClose={() => setPreviewCode(null)}
        width={680}
        styles={{ body: { backgroundColor: '#ffffff' }, content: { backgroundColor: '#ffffff' } }}
      >
        {previewLoading ? (
          <div className="flex justify-center py-10"><Spin /></div>
        ) : previewExp ? (
          <div className="space-y-4 bg-white">
            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs text-slate-400">Code</p>
                <p className="font-mono font-bold text-indigo-700">{previewExp.code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <Tag color={STATUS_COLOR[previewExp.status] ?? 'default'}>{STATUS_LABEL[previewExp.status] ?? (previewExp.status ? previewExp.status.replace(/_/g, ' ') : '—')}</Tag>
              </div>
              <div>
                <p className="text-xs text-slate-400">Template</p>
                <p>{previewExp.templateName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Version</p>
                <p>v{previewExp.version}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p>{previewExp.createdAt ? dayjs(previewExp.createdAt).format('DD MMM YYYY HH:mm') : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Notebook</p>
                <p className="font-mono text-xs">{previewExp.notebookId || '—'}</p>
              </div>
            </div>
            <Divider className="my-2" />
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sections</p>
              <div className="space-y-1">
                {(previewExp.sectionDefs as SectionDef[]).map(sec => {
                  const secData = previewExp.sections?.[sec.id]
                  const hasData = Array.isArray(secData) ? secData.length > 0 : (secData !== null && secData !== undefined && secData !== '')
                  return (
                    <div key={sec.id} className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 text-xs">
                      <span className="text-slate-700">{sec.title}</span>
                      {hasData
                        ? <Tag color="blue" className="text-xs">Has data</Tag>
                        : <span className="text-slate-300">Empty</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <Alert type="error" message="Could not load experiment preview." />
        )}
      </Drawer>
    </Card>
  )
}

// ── Experiment Events Content (with filters) ──────────────────────────────────
function ExperimentEventsContent({ eventsData }: { eventsData?: { items: { id: string; action: string; detail: string; userName: string; createdAt: string }[] } | undefined }) {
  const [eventType, setEventType] = useState<string | undefined>()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [userFilter, setUserFilter] = useState<string | undefined>()
  const [shown, setShown] = useState(false)

  const allItems = eventsData?.items ?? []
  const uniqueActions = Array.from(new Set(allItems.map(e => e.action).filter(Boolean)))
  const uniqueUsers   = Array.from(new Set(allItems.map(e => e.userName).filter(Boolean)))

  const filtered = shown
    ? allItems.filter(e => {
        if (eventType && e.action !== eventType) return false
        if (userFilter && e.userName !== userFilter) return false
        if (fromDate && e.createdAt && e.createdAt < fromDate) return false
        if (toDate   && e.createdAt && e.createdAt.slice(0,10) > toDate) return false
        return true
      })
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">Event Type</div>
          <Select allowClear placeholder="All" style={{ width: 180 }} value={eventType} onChange={setEventType}
            options={[{ value: undefined as any, label: 'All' }, ...uniqueActions.map(a => ({ value: a, label: a }))]} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">From</div>
          <Input type="date" style={{ width: 140 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">To</div>
          <Input type="date" style={{ width: 140 }} value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">User</div>
          <Select allowClear placeholder="All Users" style={{ width: 150 }} value={userFilter} onChange={setUserFilter}
            options={[{ value: undefined as any, label: 'All Users' }, ...uniqueUsers.map(u => ({ value: u, label: u }))]} />
        </div>
        <Button type="primary" onClick={() => setShown(true)}>Show Events</Button>
      </div>

      {!shown && <p className="text-slate-400 text-sm">Set filters and click "Show Events" to view experiment events.</p>}
      {shown && filtered.length === 0 && <Empty description="No events match the selected filters." />}
      {shown && filtered.length > 0 && (
        <Timeline
          items={filtered.map(ev => ({
            color: ev.action.includes('Status') ? 'blue' : ev.action.includes('Clone') ? 'green' : 'gray',
            children: (
              <div>
                <p className="font-semibold text-sm text-slate-800">{ev.action}</p>
                {ev.detail && <p className="text-xs text-slate-500">{ev.detail}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{ev.userName} · {dayjs(ev.createdAt).format('DD MMM YYYY, HH:mm')}</p>
              </div>
            ),
          }))}
        />
      )}
    </div>
  )
}

const TEST_STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default', ASSIGNED: 'blue', IN_PROGRESS: 'processing',
  VERIFICATION_REQUESTED: 'gold', VERIFICATION_REWORK: 'volcano', VERIFIED: 'green',
  ACCEPTED: 'green', WITHDRAWN: 'default', UNSATISFACTORY: 'red',
}

function LinkedAtrTestsPanel({ experimentId }: { experimentId: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiment-linked-tests', experimentId],
    queryFn: () => import('../../api/client').then((m) => m.apiGet<{ items: any[] }>('/api/ard/tests', { experimentId, pageSize: 50 })),
    enabled: !!experimentId,
  })
  const items = data?.items ?? []
  if (!isLoading && items.length === 0) return null
  return (
    <Card size="small" title="Linked ATR Tests" className="rounded-lg overflow-hidden glass-card">
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={items}
        pagination={false}
        onRow={(row) => ({ onClick: () => navigate(`/ard/tests/${row.atrId}/${row.id}`), className: 'cursor-pointer' })}
        columns={[
          { title: 'ATR Form No.', dataIndex: 'formNo', key: 'formNo', render: (v) => <span className="font-mono text-xs">{v}</span> },
          { title: 'AR Number', dataIndex: 'arNumber', key: 'arNumber', render: (v) => v || '—' },
          { title: 'Test / Technique', key: 'test', render: (_, row: any) => `${row.testType}${row.testSubtype ? ` / ${row.testSubtype}` : ''}` },
          { title: 'Assigned To', dataIndex: 'assignedToName', key: 'assignedToName', render: (v) => v || '—' },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (v) => <Tag color={TEST_STATUS_COLOR[v] ?? 'default'} className="text-xs">{v}</Tag> },
        ]}
      />
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ArdExperimentWorkspacePage() {
  const { experimentId } = useParams()
  const [searchParams] = useSearchParams()
  // "View" from the Notebook's Experiments tab lands here with ?view=1 —
  // forces read-only rendering and trims the action bar down to just
  // Clone/Download PDF, regardless of what the viewer's role/the experiment's
  // status would otherwise allow.
  const viewOnly = searchParams.get('view') === '1'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()
  const [localData, setLocalData] = useState<Record<string, unknown> | null>(null)
  const [downloading, setDownloading] = useState<boolean>(false)
  const [pendingTargetStatus, setPendingTargetStatus] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [cloneLoading, setCloneLoading] = useState(false)
  const [takeoverOpen, setTakeoverOpen] = useState(false)
  const [takeoverAnalystId, setTakeoverAnalystId] = useState<string | undefined>()
  const [takeoverRemarks, setTakeoverRemarks] = useState('')
  const [takeoverPassword, setTakeoverPassword] = useState('')
  const [qaComment, setQaComment] = useState('')
  const [qaRemarkDraft, setQaRemarkDraft] = useState('')
  const [sectionCommentTarget, setSectionCommentTarget] = useState<{ id: string; label: string } | null>(null)
  const [sectionCommentDraft, setSectionCommentDraft] = useState('')
  const [lockedByOther, setLockedByOther] = useState<string | null>(null)
  const lockAcquired = useRef(false)
  const [empowerModalOpen, setEmpowerModalOpen] = useState(false)
  const [empowerCsvText, setEmpowerCsvText] = useState('')
  // B-41: reassign reviewer
  const [reviewerOpen, setReviewerOpen] = useState(false)
  const [reviewerSelectedId, setReviewerSelectedId] = useState<string | undefined>()
  const [reviewerRemarks, setReviewerRemarks] = useState('')
  const [reviewerPassword, setReviewerPassword] = useState('')
  // B-76: reviewer picker on SUBMITTED transition
  const [submitReviewerOpen, setSubmitReviewerOpen] = useState(false)
  const [submitReviewerId, setSubmitReviewerId] = useState<string | undefined>()
  const [submitRemarks, setSubmitRemarks] = useState('')
  const [submitVerifierOpen, setSubmitVerifierOpen] = useState(false)
  const [submitVerifierId, setSubmitVerifierId] = useState<string | undefined>()
  const [submitVerifierRemarks, setSubmitVerifierRemarks] = useState('')
  // B-77: linked ATR IDs for co-submission
  const [linkedAtrIds, setLinkedAtrIds] = useState<string[]>([])
  // "ATR Submission Alert" — Sample Details' "Send for Verif." checkbox marks
  // which linked ATRs should ride along with this experiment's submission;
  // clicking Submit asks Yes/No before opening the approver picker.
  const [atrAlertOpen, setAtrAlertOpen] = useState(false)
  const [checkedAtrIds, setCheckedAtrIds] = useState<string[]>([])
  // B-80: skip verification if disabled
  const [verificationFlowActive, setVerificationFlowActive] = useState(true)
  // B-44: aim achieved pre-modal before approval
  const [aimModalOpen, setAimModalOpen] = useState(false)
  const [aimAchieved, setAimAchieved] = useState<boolean | null>(null)
  const [aimRemarks, setAimRemarks] = useState('')


  const { data: analystUsers } = useQuery({
    queryKey: ['ard-analyst-users'],
    queryFn: () => userApi.list({ role_code: 'ANALYST', limit: 100 }),
    enabled: takeoverOpen,
  })

  const { data: reviewerUsers } = useQuery({
    queryKey: ['ard-reviewer-users'],
    queryFn: () => userApi.list({ limit: 200 }),
    enabled: reviewerOpen || submitVerifierOpen,
  })

  // Resolves who the linked ATR test's assignee actually is, so the modal
  // can pre-fill and lock the verifier picker instead of making the analyst
  // guess and only finding out from a VERIFIER_MISMATCH 400 afterward.
  const { data: expectedVerifier } = useQuery({
    queryKey: ['ard-expected-verifier', experimentId],
    queryFn: () => ardExperimentApi.expectedVerifier(experimentId!),
    enabled: submitVerifierOpen && !!experimentId,
  })

  useEffect(() => {
    if (submitVerifierOpen && expectedVerifier?.userId) {
      setSubmitVerifierId(expectedVerifier.userId)
    }
  }, [submitVerifierOpen, expectedVerifier])

  const { data: exp, isLoading, error } = useQuery({
    queryKey: ['ard-experiment', experimentId],
    queryFn: () => ardExperimentApi.get(experimentId!),
    enabled: !!experimentId,
    refetchOnWindowFocus: false,
  })

  // B-76: notebook members for reviewer picker on SUBMITTED
  const notebookId = exp?.notebookId
  const { data: notebookDetail } = useQuery({
    queryKey: ['ard-notebook-detail', notebookId],
    queryFn: () => ardNotebooksApi.get(notebookId!),
    enabled: !!notebookId,
  })

  // The experiment route is flat (/ard/experiments/:id, not nested under its
  // project/notebook), so without this the breadcrumb only ever showed
  // "ARD > Experiments > <raw id>" — no label override existed here at all,
  // and no way back to the project or notebook the user actually came
  // through. Reuses notebookDetail (already fetched above) for the notebook
  // crumb; fetches the project separately since exp carries projectId but
  // not its name.
  useBreadcrumbLabel(experimentId ?? '', exp?.code ?? null)
  // An experiment reached via its notebook's Experiments tab doesn't always
  // carry its own projectId (only notebookId gets set at creation in that
  // flow) — fall back to the notebook's projectId so the Project crumb still
  // shows. Previously this required BOTH exp.projectId AND notebookId to
  // render anything, so an experiment with only one of the two (either is
  // common) showed no prefix at all — the flat "ARD > Experiments > CODE"
  // breadcrumb the user reported, with no way back to the project/notebook.
  const parentProjectId = exp?.projectId || notebookDetail?.projectId
  const { data: expParentProject } = useQuery({
    queryKey: ['ard-project', parentProjectId],
    queryFn: () => ardProjectsApi.get(parentProjectId!),
    enabled: !!parentProjectId,
  })
  useBreadcrumbPrefix(
    parentProjectId || notebookId
      ? [
          ...(parentProjectId ? [
            { label: 'Projects', href: '/ard/projects' },
            { label: expParentProject?.productName || expParentProject?.code || '…', href: `/ard/projects/${parentProjectId}` },
          ] : []),
          ...(notebookId ? [
            { label: 'Notebooks', href: '/ard/notebooks' },
            { label: notebookDetail?.name || '…', href: `/ard/notebooks/${notebookId}` },
          ] : []),
        ]
      : null,
  )
  const notebookMemberOptions = useMemo(() => {
    const members = (notebookDetail as any)?.assignedUsers ?? []
    if (members.length === 0) return []
    return members
      .filter((m: any) => m.role !== 'VIEWER')
      .map((m: any) => ({ value: m.userId ?? m.id, label: `${m.userName ?? m.username} (${m.role})` }))
  }, [notebookDetail])

  // B-77: list ATRs for co-submit picker
  const { data: atrListData } = useQuery({
    queryKey: ['ard-atrs-for-cosubmit'],
    queryFn: () => import('../../api/ard').then(m => m.ardAtrApi.list({ pageSize: 100 })),
    enabled: submitReviewerOpen,
  })
  const coSubmitAtrOptions = useMemo(() => {
    const items = (atrListData as any)?.items ?? []
    return items
      .filter((a: any) => ['DRAFT', 'SAVED'].includes(a.status ?? ''))
      .map((a: any) => ({ value: a.id, label: `${a.formNo ?? a.id} — ${a.projectCode ?? ''}` }))
  }, [atrListData])

  const { data: settingsMap } = useQuery({
    queryKey: ['ard-settings-map'],
    queryFn: ardApi.settingsMap,
  })

  // B-80: verification flow requires app-level setting AND notebook-level flag
  const verificationEnabled = useMemo(() => {
    const raw = (settingsMap as any)?.['IncludeADVerificationFlow']
    const val = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw
    const appOk = val === undefined || val === null ? true : (typeof val === 'boolean' ? val : String(val).toLowerCase() !== 'false')
    const nbOk = notebookDetail?.includeVerificationFlow ?? true
    return appOk && nbOk
  }, [settingsMap, notebookDetail])

  const patch = useMutation({
    mutationFn: (sections: Record<string, unknown>) => ardExperimentApi.patch(experimentId!, { sections }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setLocalData(null)
      msg.success('Saved.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save.'),
  })

  const patchRefs = useMutation({
    mutationFn: (refs: RefExperiment[]) => ardExperimentApi.patch(experimentId!, { referenceExperiments: refs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      msg.success('Reference experiments updated.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update references.'),
  })

  // Aim/Objective and Conclusion are fixed rich-text blocks every experiment
  // has, regardless of its template's attached sections (mirrors Attachments,
  // which is also not a template-authored section) — see ardExperiments.routes.ts.
  const patchAim = useMutation({
    mutationFn: (aim: string) => ardExperimentApi.patch(experimentId!, { aim }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] }); msg.success('Aim saved.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save Aim.'),
  })
  const patchConclusion = useMutation({
    mutationFn: (conclusion: string) => ardExperimentApi.patch(experimentId!, { conclusion }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] }); msg.success('Conclusion saved.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save Conclusion.'),
  })
  const [aimDraft, setAimDraft] = useState<string | null>(null)
  const [conclusionDraft, setConclusionDraft] = useState<string | null>(null)

  const transition = useMutation({
    mutationFn: ({ to, password, remarks, reason, aimAchieved: aim, aimRemarks: aimR, reviewerId, linkedAtrIds: atrIds }: { to: string; password?: string; remarks?: string; reason?: string; aimAchieved?: boolean | null; aimRemarks?: string; reviewerId?: string; linkedAtrIds?: string[] }) =>
      ardExperimentApi.transition(experimentId!, { to, ...(password ? { password } : {}), ...(remarks ? { remarks } : {}), ...(reason ? { reason } : {}), ...(aim != null ? { aimAchieved: aim } : {}), ...(aimR ? { aimRemarks: aimR } : {}), ...(reviewerId ? { reviewerId } : {}), ...(atrIds?.length ? { linkedAtrIds: atrIds } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setPendingTargetStatus(null)
      msg.success('Status updated.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Transition failed.'),
  })

  const takeover = useMutation({
    mutationFn: ({ analystId, analystName, password }: { analystId: string; analystName?: string; password: string }) =>
      ardExperimentApi.takeover(experimentId!, { analyst_id: analystId, analyst_name: analystName, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setTakeoverOpen(false)
      setTakeoverAnalystId(undefined)
      setTakeoverRemarks('')
      setTakeoverPassword('')
      msg.success('Experiment reassigned.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Takeover failed.'),
  })

  const reassignReviewer = useMutation({
    mutationFn: ({ reviewerId, reviewerName, password }: { reviewerId: string; reviewerName?: string; password: string }) =>
      ardExperimentApi.reassignReviewer(experimentId!, { reviewerId, reviewerName, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setReviewerOpen(false)
      setReviewerSelectedId(undefined)
      setReviewerRemarks('')
      setReviewerPassword('')
      msg.success('Reviewer reassigned.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Reassign reviewer failed.'),
  })

  const stpWeightsMut = useMutation({
    mutationFn: () => ardExperimentApi.stpUpdateSampleWeights(experimentId!),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      msg.success(`Sample weights updated (${res.updatedFields} field(s) populated).`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Update failed.'),
  })

  const stpEmpowerMut = useMutation({
    mutationFn: (csvData: string) => ardExperimentApi.stpImportEmpower(experimentId!, csvData),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setEmpowerModalOpen(false)
      setEmpowerCsvText('')
      msg.success(`Empower data imported: ${res.rowsImported} rows into section.`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Empower import failed.'),
  })

  const stpPushResultsMut = useMutation({
    mutationFn: () => {
      const resultParams = (exp?.resultParameters as Record<string, unknown>[] | undefined) ?? []
      return ardExperimentApi.stpPushResults(experimentId!, resultParams)
    },
    onSuccess: (res) => {
      msg.success(`${res.resultsCount} result(s) pushed to ATR sample.`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Push results failed.'),
  })

  const restoreMut = useMutation({
    mutationFn: (remarks: string) => ardExperimentApi.restore(experimentId!, remarks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      msg.success('Experiment restored to In Progress.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Restore failed.'),
  })

  const addQaComment = useMutation({
    // Displays from exp.clarifications below, so it must write through the
    // matching endpoint — this previously called addComment (which posts to
    // section-comments, a completely different array), so a submitted QA
    // comment vanished from this list the moment the query refetched.
    mutationFn: (message: string) => ardExperimentApi.addClarification(experimentId!, { message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setQaComment('')
      msg.success('QA comment added.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add comment.'),
  })

  // Scenario 25 (persistQaComment) — QA annotations independent of workflow
  // stage, distinct from the clarifications-backed "QA Comments" above.
  const { data: qaRemarks } = useQuery({
    queryKey: ['ard-experiment-qa-remarks', experimentId],
    queryFn: () => ardExperimentApi.getQaRemarks(experimentId!),
    enabled: !!experimentId,
  })
  const addQaRemark = useMutation({
    mutationFn: (remark: string) => ardExperimentApi.addQaRemark(experimentId!, { remark }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment-qa-remarks', experimentId] })
      setQaRemarkDraft('')
      msg.success('QA remark added.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add QA remark.'),
  })
  const deleteQaRemark = useMutation({
    mutationFn: (remarkId: string) => ardExperimentApi.deleteQaRemark(experimentId!, remarkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment-qa-remarks', experimentId] })
      msg.success('QA remark removed.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to remove QA remark.'),
  })

  const addSectionComment = useMutation({
    mutationFn: (comment: string) => ardExperimentApi.addComment(experimentId!, { sectionKey: sectionCommentTarget!.id, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] })
      setSectionCommentDraft('')
      msg.success('Comment added.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add comment.'),
  })

  const deleteSectionComment = useMutation({
    mutationFn: (commentId: string) => ardExperimentApi.deleteComment(experimentId!, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ard-experiment', experimentId] }),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to delete comment.'),
  })

  const { data: eventsData } = useQuery({
    queryKey: ['ard-experiment-events', experimentId],
    queryFn: () => import('../../api/client').then(m => m.apiGet<{ items: { id: string; action: string; detail: string; userName: string; createdAt: string }[] }>(`/api/ard/audit/entity/EXPERIMENT/${experimentId}`)),
    enabled: eventsOpen && !!experimentId,
  })


  const parsedSections = useMemo(() => {
    if (!exp?.sections) return {}
    return Array.isArray(exp.sections)
      ? exp.sections.reduce((acc, item) => {
          if (item && typeof item === 'object' && 'id' in item) {
            acc[(item as any).id] = item
          }
          return acc
        }, {} as Record<string, unknown>)
      : (exp.sections as Record<string, unknown>) ?? {}
  }, [exp?.sections])

  const isDirty = useMemo(() => {
    if (!localData) return false
    return JSON.stringify(localData) !== JSON.stringify(parsedSections)
  }, [localData, parsedSections])

  // B-13: Session-based experiment locking
  useEffect(() => {
    const LOCKABLE = ['IN_PROGRESS', 'REWORK', 'UNLOCKED']
    if (!experimentId || !exp || !LOCKABLE.includes(exp.status)) return
    let active = true

    ardExperimentApi.acquireLock(experimentId)
      .then(() => { if (active) { lockAcquired.current = true; setLockedByOther(null) } })
      .catch((e) => {
        if (active && e instanceof ApiError && e.status === 409) {
          setLockedByOther(e.detail || 'Another user')
        }
      })

    const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'
    const releaseOnUnload = () => {
      if (!lockAcquired.current) return
      const token = localStorage.getItem('access_token')
      fetch(`${apiBase}/api/ard/experiments/${experimentId}/lock`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('beforeunload', releaseOnUnload)

    return () => {
      active = false
      window.removeEventListener('beforeunload', releaseOnUnload)
      if (lockAcquired.current) {
        lockAcquired.current = false
        ardExperimentApi.releaseLock(experimentId).catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experimentId, exp?.status])

  if (isLoading) return <div className="p-8 flex justify-center"><Spin size="large" /></div>
  if (error || !exp) return (
    <div className="p-4 md:p-6">
      <Alert
        type="error"
        message="Unable to load experiment"
        description={error instanceof ApiError ? error.detail : (error as Error)?.message || 'Experiment not found or access restricted.'}
        action={<Button size="small" onClick={() => navigate('/ard/experiments')}>Back to Experiments</Button>}
      />
    </div>
  )

  const data = localData ?? parsedSections
  // B-13: locked by another user → treat as read-only regardless of status.
  // "View" from the Notebook's Experiments tab (?view=1) forces the same
  // read-only rendering regardless of status/role too — see the action bar
  // below, which also drops everything except Clone/Download PDF in this mode.
  const editable = (exp.status === 'NEW' || exp.status === 'IN_PROGRESS' || exp.status === 'REWORK') && !lockedByOther && !viewOnly
  // 'APPROVED' is a reused target here — from UNLOCK_REQUESTED it means
  // reject the unlock request, not a normal approval. Needed by the button
  // label/style above and the e-signature modal further below.
  const isRejectUnlockPending = pendingTargetStatus === 'APPROVED' && exp.status === 'UNLOCK_REQUESTED'

  // B-08: ModifyAfterRework — when setting is 'sections_with_comments_only', only sections
  // that have a reviewer/QA comment attached may be edited during REWORK.
  const modifyAfterRework = (settingsMap as any)?.ModifyAfterRework?.value ?? 'all'
  const sectionsWithComments: Set<string> | null = (() => {
    if (exp.status !== 'REWORK' || modifyAfterRework !== 'sections_with_comments_only') return null
    const scs = (exp.sectionComments as { sectionId?: string; authorRole?: string }[] | undefined) ?? []
    const reviewerRoles = ['TL', 'TEAM_LEAD', 'HOD', 'HEAD_OF_DEPT', 'QA', 'SUPER_ADMIN', 'ADMIN']
    return new Set(
      scs
        .filter(c => c.sectionId && reviewerRoles.includes((c.authorRole ?? '').toUpperCase()))
        .map(c => c.sectionId!)
    )
  })()
  const isSectionReadOnly = (sectionId: string): boolean => {
    if (!editable) return true
    if (sectionsWithComments !== null) return !sectionsWithComments.has(sectionId)
    return false
  }

  const role = ((user as any)?.role?.code || user?.role_code || '').toUpperCase()
  const isAnalyst = role === 'ANALYST' || role === 'ANALYST_ROLE' || (!['TL', 'TEAM_LEAD', 'HOD', 'HEAD_OF_DEPT', 'QA', 'SUPER_ADMIN', 'ADMIN'].includes(role))
  const isHODOrQA = ['HOD', 'HEAD_OF_DEPT', 'SUPER_ADMIN', 'QA'].includes(role)
  const rawNextStates = EXPERIMENT_TRANSITIONS[exp.status as ExperimentStatus] ?? []
  const nextStates = rawNextStates.filter(s => {
    // B-80: hide peer-verification step when disabled at app or notebook level
    if (s === 'VERIFICATION_REQUESTED' && !verificationEnabled) return false
    // Mirror image of the line above: when verification IS required, the
    // direct NEW/IN_PROGRESS -> SUBMITTED shortcut must not be offered
    // either — otherwise an analyst could just click "Submit for Approval"
    // and skip the mandatory peer-verification step entirely.
    if (s === 'SUBMITTED' && ['NEW', 'IN_PROGRESS'].includes(exp.status) && verificationEnabled) return false
    // After TL verifies, only TL/HOD sends the experiment to HOD for approval (not analyst)
    if (s === 'SUBMITTED' && exp.status === 'VERIFIED') return !isAnalyst
    const category = TRANSITION_ROLE[s as ExperimentStatus] ?? 'any'
    if (category === 'any') return true
    if (category === 'analyst') return isAnalyst
    if (category === 'approver') return isHODOrQA
    // 'reviewer' = TL / HOD / SUPER_ADMIN (not analyst)
    return !isAnalyst
  })
  const canTakeover = ['TL', 'TEAM_LEAD', 'HOD', 'HEAD_OF_DEPT', 'SUPER_ADMIN'].includes(role) && editable

  const onChange = (sectionId: string, value: unknown) =>
    setLocalData({ ...data, [sectionId]: value })

  const handleSave = () => {
    if (!localData) return
    patch.mutate(localData)
  }

  const SENSITIVE_TRANSITIONS = [
    'SUBMITTED', 'VERIFICATION_REQUESTED', 'VERIFIED', 'APPROVED',
    'REWORK', 'VERIFICATION_REWORK', 'UNLOCK_REQUESTED', 'UNLOCKED', 'DEACTIVATED',
  ]

  const handleTransitionClick = async (to: string) => {
    if (isDirty && localData) {
      try {
        await patch.mutateAsync(localData)
      } catch {
        return
      }
    }

    // Validate required sections before any analyst-initiated forward submission
    if (['SUBMITTED', 'VERIFICATION_REQUESTED'].includes(to) && isAnalyst) {
      const allDefs = Array.isArray(exp.sectionDefs) ? (exp.sectionDefs as SectionDef[]) : []
      const required = allDefs.filter(s => s.required)
      const missing = required.filter(s => {
        const v = data[s.id]
        if (v === null || v === undefined) return true
        if (typeof v === 'string') return v.trim() === ''
        if (Array.isArray(v)) return v.length === 0
        return false
      })
      if (missing.length > 0) {
        msg.error(`Complete required sections before submitting: ${missing.map(s => s.title).join(', ')}`)
        return
      }

      const equipDefs = allDefs.filter(s => s.type === 'equipment')
      for (const ed of equipDefs) {
        const rows = (data[ed.id] as { instrumentCode?: string; calibrationStatus?: string; maintenanceStatus?: string }[]) || []
        const expired = rows.find(r => r.calibrationStatus === 'EXPIRED' || r.maintenanceStatus === 'OUT_OF_SERVICE')
        if (expired) {
          msg.error(`Calibration Interlock Violation: Instrument ${expired.instrumentCode || 'selected'} is ${expired.calibrationStatus || expired.maintenanceStatus}. Select a calibrated asset before submitting.`)
          return
        }
      }
    }

    // B-44: for APPROVED, show "Is aim achieved?" modal first — except when
    // 'APPROVED' is being used as the reject-unlock target (see
    // isRejectUnlockPending), which isn't an approval at all and shouldn't
    // ask about aim achievement.
    if (to === 'APPROVED' && exp.status !== 'UNLOCK_REQUESTED') {
      setAimAchieved(null)
      setAimRemarks('')
      setAimModalOpen(true)
      return
    }

    // B-76/B-77: for SUBMITTED (by analyst), show pre-submit modal to pick reviewer + linked ATRs.
    // First check whether Sample Details has any rows checked "Send for
    // Verif." — if so, ask via the ATR Submission Alert whether those ATRs
    // should ride along; only their ATRs (not every ATR touched in the
    // experiment) are eligible for co-submission.
    if (to === 'SUBMITTED' && isAnalyst) {
      setSubmitReviewerId(undefined)
      setSubmitRemarks('')
      const sampleSectionIds = (Array.isArray(exp.sectionDefs) ? (exp.sectionDefs as SectionDef[]) : [])
        .filter(s => s.type === 'sample')
        .map(s => s.id)
      const checked = Array.from(new Set(
        sampleSectionIds
          .flatMap(sid => (data[sid] as { atrId?: string; sendForVerification?: boolean }[] | undefined) ?? [])
          .filter(r => r?.sendForVerification && r?.atrId)
          .map(r => String(r.atrId))
      ))
      if (checked.length > 0) {
        setCheckedAtrIds(checked)
        setAtrAlertOpen(true)
      } else {
        setLinkedAtrIds([])
        setSubmitReviewerOpen(true)
      }
      return
    }

    // Pre-submit modal to pick a verifier before signing. The backend
    // resolves the "real" verifier from the linked ATR test's assignee and
    // will reject a mismatched pick — this picker just lets the analyst see
    // and confirm who that's going to, or fall back to a manual choice when
    // nothing's linked.
    if (to === 'VERIFICATION_REQUESTED' && isAnalyst) {
      setSubmitVerifierId(undefined)
      setSubmitVerifierRemarks('')
      setSubmitVerifierOpen(true)
      return
    }

    if (SENSITIVE_TRANSITIONS.includes(to)) {
      setPendingTargetStatus(to)
    } else {
      transition.mutate({ to })
    }
  }

  const handleClone = async (blank: boolean) => {
    setCloneLoading(true)
    try {
      const cloned = blank ? await ardExperimentApi.cloneBlank(experimentId!) : await ardExperimentApi.clone(experimentId!)
      msg.success(`Cloned as ${(cloned as any).code} — opening now.`)
      navigate(`/ard/experiments/${(cloned as any).id}`)
    } catch {
      msg.error('Clone failed.')
    } finally {
      setCloneLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!exp) return
    setDownloading(true)
    try {
      const { blob, filename } = await ardExperimentApi.downloadReport(experimentId!)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || `${exp.code}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      msg.error('Failed to generate PDF report.')
    } finally {
      setDownloading(false)
    }
  }

  const sectionDefs = Array.isArray(exp.sectionDefs) ? (exp.sectionDefs as SectionDef[]) : []

  // Per-section comments (approver feedback tied to one specific section,
  // not the whole experiment) — every section gets this icon in its title.
  const sectionComments = Array.isArray(exp.sectionComments) ? exp.sectionComments : []
  const commentCountFor = (sectionId: string) => sectionComments.filter(c => c.sectionKey === sectionId).length
  const SectionCommentIcon = ({ sectionId, label }: { sectionId: string; label: string }) => {
    const count = commentCountFor(sectionId)
    return (
      <Tooltip title="Section Comments">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSectionCommentTarget({ id: sectionId, label }) }}
          className="relative inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
        >
          <MessageSquare size={14} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {count}
            </span>
          )}
        </button>
      </Tooltip>
    )
  }

  // Section-routing nav — every experiment always renders as one continuous
  // page (no more Tabbed/Single Page toggle); this lets you jump straight to
  // a section instead of scrolling, mirroring the legacy ELN's top nav strip.
  const navSections = [
    { id: 'sec-aim', label: 'Aim / Objective' },
    ...sectionDefs.map((section, idx) => ({ id: `sec-${section?.id || idx}`, label: section?.title || 'Section' })),
    { id: 'sec-attachments', label: 'Attachments' },
    { id: 'sec-experiment-parameters', label: 'Experiment Parameters' },
    { id: 'sec-conclusion', label: 'Conclusion' },
    { id: 'sec-reference-experiments', label: 'Reference Experiments' },
  ]
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {ctx}

      {/* Header */}
      <div className="glass-card flex items-start gap-3 flex-wrap p-4 rounded-lg">
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/ard/experiments')} />
        <FlaskConical size={20} className="text-violet-500 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-800 font-mono">{exp.code}</h1>
            <Tag color={STATUS_COLOR[exp.status] ?? 'blue'}>{STATUS_LABEL[exp.status] ?? (exp.status ? exp.status.replace(/_/g, ' ') : '—')}</Tag>
            {exp.templateName && (
              <span className="text-sm text-slate-400">{exp.templateName}</span>
            )}
            {exp.createdAt && (() => {
              const days = Math.floor((Date.now() - new Date(exp.createdAt).getTime()) / 86_400_000)
              const color = days <= 7 ? 'text-violet-600' : days <= 14 ? 'text-amber-500' : 'text-red-500'
              return <span className={`text-xs font-mono font-semibold ${color}`}>{days}d old</span>
            })()}
          </div>
          {(exp as any).testType && (
            <p className="text-xs text-slate-400 mt-0.5">Test Type: <span className="font-medium text-slate-600">{(exp as any).testType}{(exp as any).testSubType ? ` / ${(exp as any).testSubType}` : ''}</span></p>
          )}
          {exp.notebookId && (
            <p className="text-xs text-slate-400 mt-0.5">Notebook: {(notebookDetail as any)?.name ?? (notebookDetail as any)?.code ?? '—'}</p>
          )}
          {(exp as any).projectName && (
            <p className="text-xs text-slate-400 mt-0.5">Project: <span className="font-medium text-slate-600">{(exp as any).projectName}</span></p>
          )}
          {(exp as any).createdBy && (
            <p className="text-xs text-slate-400 mt-0.5">Started By: <span className="font-medium text-slate-600">{(exp as any).createdBy}</span></p>
          )}
          {(exp.contributors ?? []).length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              Contributors:{' '}
              {(exp.contributors ?? []).map(c => (
                <Tag key={c.userId} className="text-xs ml-0.5">{c.userName}</Tag>
              ))}
            </p>
          )}
          {exp.aimAchieved != null && (
            <p className="text-xs text-slate-400 mt-0.5">
              Aim Achieved:{' '}
              <Tag color={exp.aimAchieved ? 'green' : 'red'} className="text-xs">{exp.aimAchieved ? 'Yes' : 'No'}</Tag>
              {exp.aimRemarks && <span className="text-slate-500 italic ml-1">"{exp.aimRemarks}"</span>}
            </p>
          )}
        </div>

        {/* Action buttons */}
        {viewOnly ? (
          // "View" from the Notebook's Experiments tab — only Clone/Download
          // PDF, regardless of status/role (per product review 2026-08-28).
          <Space wrap>
            <Button.Group>
              <Button icon={<Copy size={14} />} loading={cloneLoading} onClick={() => handleClone(false)}>Clone</Button>
              <Button loading={cloneLoading} onClick={() => handleClone(true)} title="Clone structure only — no data">Blank</Button>
            </Button.Group>
            <Button icon={<Download size={14} />} loading={downloading} onClick={handleDownloadPdf}>
              Download PDF
            </Button>
          </Space>
        ) : (
        <Space wrap>
          <Button icon={<History size={14} />} onClick={() => setHistoryOpen(true)}>History</Button>
          <Button icon={<Activity size={14} />} onClick={() => setEventsOpen(true)}>Events</Button>
          <Button.Group>
            <Button icon={<Copy size={14} />} loading={cloneLoading} onClick={() => handleClone(false)}>Clone</Button>
            <Button loading={cloneLoading} onClick={() => handleClone(true)} title="Clone structure only — no data">Blank</Button>
          </Button.Group>
          <Button icon={<Download size={14} />} loading={downloading} onClick={handleDownloadPdf}>
            Download PDF
          </Button>
          {canTakeover && (
            <Button icon={<RotateCcw size={14} />} onClick={() => setTakeoverOpen(true)}
              className="border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold">
              Reassign Analyst
            </Button>
          )}
          {canTakeover && ['SUBMITTED', 'IN_PROGRESS', 'REWORK'].includes(exp.status) && (
            <Button icon={<RotateCcw size={14} />} onClick={() => setReviewerOpen(true)}
              className="border-violet-400 text-violet-700 bg-violet-50 hover:bg-violet-100 font-semibold">
              Reassign Reviewer
            </Button>
          )}
          {exp.projectStpId && editable && (
            <Dropdown menu={{
              items: [
                {
                  key: 'weights',
                  label: 'Update Sample Weights',
                  icon: <Database size={13} />,
                  onClick: () => stpWeightsMut.mutate(),
                  disabled: stpWeightsMut.isPending,
                },
                {
                  key: 'empower',
                  label: 'Read from Empower (CSV)',
                  icon: <Download size={13} />,
                  onClick: () => setEmpowerModalOpen(true),
                },
                {
                  key: 'results',
                  label: 'Update Results to Sample',
                  icon: <FileText size={13} />,
                  onClick: () => stpPushResultsMut.mutate(),
                  disabled: stpPushResultsMut.isPending,
                },
              ],
            }} trigger={['click']}>
              <Button icon={<Database size={14} />} className="border-violet-500 text-violet-700 bg-violet-50 hover:bg-violet-100">
                STP Actions
              </Button>
            </Dropdown>
          )}
          {exp.status === 'DEACTIVATED' && ['HOD', 'SUPER_ADMIN'].includes(role) && (
            <Button type="primary" icon={<RotateCcw size={14} />}
              loading={restoreMut.isPending}
              onClick={() => restoreMut.mutate('Restored by HOD')}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Restore Experiment
            </Button>
          )}
          {editable && (
            <Button type="primary" icon={<Save size={14} />}
              disabled={!isDirty} loading={patch.isPending} onClick={handleSave}>
              Save
            </Button>
          )}
          {nextStates.map(s => (
            <Button
              key={s}
              loading={transition.isPending}
              type={['SUBMITTED', 'VERIFIED', 'APPROVED', 'UNLOCKED', 'VERIFICATION_REQUESTED'].includes(s) && !(s === 'APPROVED' && exp.status === 'UNLOCK_REQUESTED') ? 'primary' : 'default'}
              danger={['DEACTIVATED', 'REWORK', 'VERIFICATION_REWORK'].includes(s) || (s === 'APPROVED' && exp.status === 'UNLOCK_REQUESTED')}
              onClick={() => handleTransitionClick(s)}
            >
              {s === 'SUBMITTED' && exp.status === 'VERIFIED' ? TRANSITION_LABEL['SUBMITTED_FROM_VERIFIED']
                : s === 'APPROVED' && exp.status === 'UNLOCK_REQUESTED' ? TRANSITION_LABEL['APPROVED_FROM_UNLOCK_REQUESTED']
                : (TRANSITION_LABEL[s] ?? (s ? s.replace(/_/g, ' ') : '—'))}
            </Button>
          ))}
        </Space>
        )}
      </div>

      {/* Unlock Authorization Card */}
      {exp.status === 'UNLOCKED' && (
        <Alert
          type="info"
          showIcon
          message="Experiment Unlocked for Revision"
          description={`Unlocked by ${(exp as any).unlockApprovedBy || (exp as any).unlockedBy || 'Authorized Approver'} on ${(exp as any).unlockedAt ? dayjs((exp as any).unlockedAt).format('DD MMM YYYY, HH:mm') : '—'}. Reason: ${(exp as any).unlockReason || 'Re-opening for corrections'}`}
          className="bg-indigo-50/80 border-indigo-200"
        />
      )}

      {/* "View" from the Notebook's Experiments tab */}
      {viewOnly && !lockedByOther && (
        <Alert
          type="info"
          showIcon
          message="Viewing in read-only mode"
          description="Opened from the Notebook's Experiments tab — Clone and Download PDF are available; editing isn't."
          className="border-indigo-200 bg-indigo-50/80"
        />
      )}

      {/* B-13: locked by another session — view-only mode */}
      {lockedByOther && (
        <Alert
          type="warning"
          showIcon
          message="Viewing in read-only mode"
          description={`This experiment is currently being edited by ${lockedByOther.replace(/^Experiment is currently being edited by /, '').replace(/\. Try again later\.$/, '')}. You can view all sections but cannot make edits until the other session ends.`}
          className="border-amber-300 bg-amber-50"
        />
      )}

      {/* REWORK restricted-sections banner */}
      {exp.status === 'REWORK' && sectionsWithComments !== null && (
        <Alert
          type="warning"
          showIcon
          message={`Rework mode: only sections with reviewer comments (${sectionsWithComments.size}) are editable. All other sections are locked.`}
        />
      )}

      {/* Unsaved changes banner */}
      {isDirty && (
        <Alert type="warning" showIcon
          message="You have unsaved changes."
          action={<Button size="small" onClick={handleSave} loading={patch.isPending}>Save now</Button>}
        />
      )}

      {/* Section routing — sticky jump-nav to every section on this page */}
      <div className="glass-card sticky top-0 z-10 flex items-center gap-1 px-3 py-2 rounded-lg mb-4 overflow-x-auto">
        {navSections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className="shrink-0 text-xs font-medium text-violet-700 hover:text-violet-900 hover:bg-violet-50 px-2.5 py-1 rounded-md whitespace-nowrap"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Linked ATR Tests — tests that pointed their Notebook Reference at this
          experiment (ArdTestExecutePage's "Existing/New Experiment" link
          modes). Read-only here; the link itself is set from the test side. */}
      <LinkedAtrTestsPanel experimentId={experimentId!} />

      {/* Aim/Objective — fixed block, every experiment has this regardless of template */}
      <Card
        id="sec-aim" size="small" className="rounded-lg overflow-hidden glass-card"
        title={
          <div className="flex items-center justify-between">
            <span>Aim / Objective</span>
            <SectionCommentIcon sectionId="sec-aim" label="Aim / Objective" />
          </div>
        }
      >
        <RichEditor
          value={aimDraft ?? exp.aim ?? ''}
          onChange={setAimDraft}
          readOnly={!editable}
          placeholder="State the aim/objective of this experiment..."
          height={220}
        />
        {editable && (
          <div className="pt-2 flex justify-end">
            <Button size="small" type="primary" icon={<Save size={13} />} loading={patchAim.isPending}
              disabled={aimDraft === null || aimDraft === (exp.aim ?? '')}
              onClick={() => { if (aimDraft !== null) patchAim.mutate(aimDraft) }}>
              Save Aim
            </Button>
          </div>
        )}
      </Card>

      {/* Sections — always rendered as one continuous page (no more Tabbed/Single Page toggle) */}
      {sectionDefs.length === 0 ? (
        <Empty description="This template has no sections defined." />
      ) : (
        <div className="space-y-4">
          {sectionDefs.map((section, idx) => (
            <Card
              key={section?.id || `sec-${idx}`}
              id={`sec-${section?.id || idx}`}
              size="small"
              title={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    {section?.title || 'Section'}
                    {section?.required && <Tag color="red" className="text-xs font-normal">Required</Tag>}
                  </span>
                  <SectionCommentIcon sectionId={section?.id || `sec-${idx}`} label={section?.title || 'Section'} />
                </div>
              }
              className="rounded-lg overflow-hidden"
            >
              <ExperimentSectionRenderer
                section={section || { id: `sec-${idx}`, title: 'Section', type: 'richtext' }}
                data={data}
                onChange={onChange}
                readOnly={isSectionReadOnly(section?.id || `sec-${idx}`)}
                projectId={exp.projectId ?? undefined}
                onSave={handleSave}
                isSaving={patch.isPending}
              />
            </Card>
          ))}
        </div>
      )}

      {/* Attachments — fixed block, not a template-authored section */}
      <Card
        id="sec-attachments" size="small" className="rounded-lg overflow-hidden glass-card"
        title={
          <div className="flex items-center justify-between">
            <span>Attachments</span>
            <SectionCommentIcon sectionId="sec-attachments" label="Attachments" />
          </div>
        }
      >
        <ArdAttachmentsPanel entityType="ard_experiment" entityId={exp.id} readOnly={!editable} />
      </Card>

      {/* Experiment Parameters — fixed block, every experiment has this
          regardless of template/STP. Reuses ExperimentSectionRenderer's
          existing 'params' case (same key/value/UOM param table used by
          template-authored sections) with a stable synthetic section id, so
          its data persists through the same sections JSONB/onChange path
          every other section already uses — no new column needed. */}
      <Card
        id="sec-experiment-parameters" size="small" className="rounded-lg overflow-hidden glass-card"
        title={
          <div className="flex items-center justify-between">
            <span>Experiment Parameters</span>
            <SectionCommentIcon sectionId="sec-experiment-parameters" label="Experiment Parameters" />
          </div>
        }
      >
        <ExperimentSectionRenderer
          section={{ id: 'experiment_parameters', title: 'Experiment Parameters', type: 'params' }}
          data={data}
          onChange={onChange}
          readOnly={!editable}
          onSave={handleSave}
          isSaving={patch.isPending}
        />
      </Card>

      {/* Conclusion — fixed block, every experiment has this regardless of template */}
      <Card
        id="sec-conclusion" size="small" className="rounded-lg overflow-hidden glass-card"
        title={
          <div className="flex items-center justify-between">
            <span>Conclusion</span>
            <SectionCommentIcon sectionId="sec-conclusion" label="Conclusion" />
          </div>
        }
      >
        <RichEditor
          value={conclusionDraft ?? exp.conclusion ?? ''}
          onChange={setConclusionDraft}
          readOnly={!editable}
          placeholder="Summarize the outcome and conclusion of this experiment..."
          minHeight={100}
        />
        {editable && (
          <div className="pt-2 flex justify-end">
            <Button size="small" type="primary" icon={<Save size={13} />} loading={patchConclusion.isPending}
              disabled={conclusionDraft === null || conclusionDraft === (exp.conclusion ?? '')}
              onClick={() => { if (conclusionDraft !== null) patchConclusion.mutate(conclusionDraft) }}>
              Save Conclusion
            </Button>
          </div>
        )}
      </Card>

      {/* Reference Experiments */}
      <div id="sec-reference-experiments">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-sm font-semibold text-slate-700">Reference Experiments</span>
        <SectionCommentIcon sectionId="sec-reference-experiments" label="Reference Experiments" />
      </div>
      <ReferenceExperimentsPanel
        experimentId={experimentId!}
        currentProjectId={exp.projectId ?? undefined}
        refs={Array.isArray(exp.referenceExperiments) ? exp.referenceExperiments : []}
        canEdit={editable}
        onUpdate={(refs) => patchRefs.mutate(refs)}
        saving={patchRefs.isPending}
      />
      </div>

      {/* QA Comments */}
      {(() => {
        const clarifications = Array.isArray(exp.clarifications) ? exp.clarifications : []
        if (!['QA', 'HOD', 'SUPER_ADMIN', 'TL', 'TEAM_LEAD'].includes(role) && clarifications.length === 0) return null
        return (
          <Card
            title={<span className="text-sm font-semibold text-slate-700">QA Comments</span>}
            size="small"
            className="rounded-lg"
          >
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {clarifications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No QA comments yet.</p>
              ) : (
                (clarifications as { id: string; message: string; authorName: string; createdAt: string }[]).map(c => (
                  <div key={c.id || Math.random().toString()} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-amber-700">{c.authorName || 'QA'}</span>
                      <span className="text-slate-400">{c.createdAt ? dayjs(c.createdAt).format('DD MMM YYYY HH:mm') : ''}</span>
                    </div>
                    <p className="text-slate-700">{c.message}</p>
                  </div>
                ))
              )}
            </div>
            {['QA', 'HOD', 'SUPER_ADMIN'].includes(role) && (
              <div className="flex gap-2 mt-2">
                <Input.TextArea
                  rows={2}
                  placeholder="Add a QA comment..."
                  value={qaComment}
                  onChange={e => setQaComment(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  loading={addQaComment.isPending}
                  disabled={!qaComment.trim()}
                  onClick={() => addQaComment.mutate(qaComment)}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Post
                </Button>
              </div>
            )}
          </Card>
        )
      })()}

      {/* QA Remarks (Scenario 25) — independent of workflow stage, distinct from QA Comments/clarifications above */}
      {(() => {
        const remarks = Array.isArray(qaRemarks) ? qaRemarks : []
        const canWrite = ['QA', 'HOD', 'SUPER_ADMIN', 'ADMIN'].includes(role)
        if (!canWrite && remarks.length === 0) return null
        return (
          <Card
            title={<span className="text-sm font-semibold text-slate-700">QA Remarks</span>}
            size="small"
            className="rounded-lg"
          >
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
              {remarks.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No QA remarks yet.</p>
              ) : (
                remarks.map(r => (
                  <div key={r.id} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-violet-700">{r.byName || 'QA'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{r.at ? dayjs(r.at).format('DD MMM YYYY HH:mm') : ''}</span>
                        {canWrite && (
                          <a onClick={() => deleteQaRemark.mutate(r.id)} className="text-red-500 hover:text-red-600">Remove</a>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-700">{r.remark}</p>
                  </div>
                ))
              )}
            </div>
            {canWrite && (
              <div className="flex gap-2 mt-2">
                <Input.TextArea
                  rows={2}
                  placeholder="Add a QA remark..."
                  value={qaRemarkDraft}
                  onChange={e => setQaRemarkDraft(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  loading={addQaRemark.isPending}
                  disabled={!qaRemarkDraft.trim()}
                  onClick={() => addQaRemark.mutate(qaRemarkDraft)}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Post
                </Button>
              </div>
            )}
          </Card>
        )
      })()}

      {/* Bottom save bar when dirty */}
      {editable && isDirty && (
        <>
          <Divider />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setLocalData(null)}>Discard changes</Button>
            <Button type="primary" icon={<Save size={14} />}
              loading={patch.isPending} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </>
      )}

      {/* Experiment Takeover Modal (GAP-015) */}
      <Modal
        {...glassModalProps}
        title="Reassign Experiment Analyst"
        open={takeoverOpen}
        onCancel={() => { setTakeoverOpen(false); setTakeoverAnalystId(undefined); setTakeoverRemarks(''); setTakeoverPassword('') }}
        onOk={() => {
          if (!takeoverAnalystId) { msg.warning('Select an analyst.'); return }
          if (!takeoverRemarks.trim()) { msg.warning('Remarks are required.'); return }
          if (!takeoverPassword) { msg.warning('Electronic signature password is required.'); return }
          const analystName = (analystUsers?.items ?? []).find(u => u.id === takeoverAnalystId)?.username
          takeover.mutate({ analystId: takeoverAnalystId, analystName, password: takeoverPassword })
        }}
        confirmLoading={takeover.isPending}
        okText="Reassign"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New Analyst</label>
            <Select
              className="w-full"
              placeholder="Select analyst"
              value={takeoverAnalystId}
              onChange={setTakeoverAnalystId}
              options={(analystUsers?.items ?? []).map(u => ({ value: u.id, label: u.username }))}
              showSearch
              filterOption={(q, opt) => (opt?.label as string ?? '').toLowerCase().includes(q.toLowerCase())}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for Reassignment</label>
            <Input.TextArea
              rows={3}
              placeholder="Business justification required…"
              value={takeoverRemarks}
              onChange={e => setTakeoverRemarks(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Electronic Signature Password</label>
            <Input.Password
              placeholder="Enter your password to confirm"
              value={takeoverPassword}
              onChange={e => setTakeoverPassword(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* B-44: Aim Achieved Modal (shown before approval e-sign) */}
      <Modal
        {...glassModalProps}
        title="Is the Experiment Aim Achieved?"
        open={aimModalOpen}
        onCancel={() => { setAimModalOpen(false); setAimAchieved(null); setAimRemarks('') }}
        onOk={() => {
          if (aimAchieved === null) { msg.warning('Please select Yes or No.'); return }
          setAimModalOpen(false)
          setPendingTargetStatus('APPROVED')
        }}
        okText="Continue to Approve"
        okButtonProps={{ disabled: aimAchieved === null }}
      >
        <div className="space-y-3 pt-2">
          <p className="text-sm text-slate-600">Before approving, confirm whether the scientific aim of this experiment was achieved.</p>
          <div className="flex gap-3">
            <Button
              type={aimAchieved === true ? 'primary' : 'default'}
              style={aimAchieved === true ? { background: '#7c3aed', borderColor: '#7c3aed' } : {}}
              onClick={() => setAimAchieved(true)}
            >
              ✓ Yes — Aim Achieved
            </Button>
            <Button
              danger={aimAchieved === false}
              type={aimAchieved === false ? 'primary' : 'default'}
              onClick={() => setAimAchieved(false)}
            >
              ✗ No — Aim Not Achieved
            </Button>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Remarks (optional)</p>
            <Input.TextArea
              rows={2}
              placeholder="Any notes about the experiment outcome…"
              value={aimRemarks}
              onChange={e => setAimRemarks(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* B-41: Reassign Reviewer Modal */}
      <Modal
        {...glassModalProps}
        title="Reassign Experiment Reviewer"
        open={reviewerOpen}
        onCancel={() => { setReviewerOpen(false); setReviewerSelectedId(undefined); setReviewerRemarks(''); setReviewerPassword('') }}
        onOk={() => {
          if (!reviewerSelectedId) { msg.warning('Select a reviewer.'); return }
          if (!reviewerPassword) { msg.warning('Electronic signature password is required.'); return }
          const reviewerName = ((reviewerUsers?.items ?? []) as any[]).find((u: any) => u.id === reviewerSelectedId)?.username
          reassignReviewer.mutate({ reviewerId: reviewerSelectedId, reviewerName, password: reviewerPassword })
        }}
        confirmLoading={reassignReviewer.isPending}
        okText="Reassign"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New Reviewer</label>
            <Select
              className="w-full"
              placeholder="Select reviewer (TL/HOD)"
              value={reviewerSelectedId}
              onChange={setReviewerSelectedId}
              options={((reviewerUsers?.items ?? []) as any[])
                .filter((u: any) => ['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(u.role_code ?? u.roleCode ?? ''))
                .map((u: any) => ({ value: u.id, label: `${u.username} (${u.role_code ?? u.roleCode ?? ''})` }))}
              showSearch
              filterOption={(q, opt) => (opt?.label as string ?? '').toLowerCase().includes(q.toLowerCase())}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason (optional)</label>
            <Input.TextArea
              rows={2}
              placeholder="Reason for reviewer change…"
              value={reviewerRemarks}
              onChange={e => setReviewerRemarks(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Electronic Signature Password</label>
            <Input.Password
              placeholder="Enter your password to confirm"
              value={reviewerPassword}
              onChange={e => setReviewerPassword(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* "ATR Submission Alert" — shown only when Sample Details has rows
          checked "Send for Verif."; Yes co-submits exactly those linked
          ATRs alongside the experiment, No submits the experiment only. */}
      <Modal
        {...glassModalProps}
        title="ATR Submission Alert"
        open={atrAlertOpen}
        closable
        onCancel={() => setAtrAlertOpen(false)}
        footer={[
          <Button key="no" danger onClick={() => { setLinkedAtrIds([]); setAtrAlertOpen(false); setSubmitReviewerOpen(true) }}>
            No
          </Button>,
          <Button key="yes" type="primary" onClick={() => { setLinkedAtrIds(checkedAtrIds); setAtrAlertOpen(false); setSubmitReviewerOpen(true) }}>
            Yes
          </Button>,
        ]}
      >
        <p className="text-sm text-slate-700">
          ATRs are linked to this experiment. Do you want to submit ATR(s) for verification along with this experiment?
        </p>
      </Modal>

      {/* B-76/B-77: Pre-Submit modal — pick approver + remarks + optional linked ATRs */}
      <Modal
        {...glassModalProps}
        title="Submit Experiment for Approval"
        open={submitReviewerOpen}
        onCancel={() => { setSubmitReviewerOpen(false); setSubmitReviewerId(undefined); setLinkedAtrIds([]); setSubmitRemarks('') }}
        onOk={() => {
          setSubmitReviewerOpen(false)
          setPendingTargetStatus('SUBMITTED')
        }}
        okText="Proceed to Sign"
        okButtonProps={{ disabled: !submitReviewerId && notebookMemberOptions.length > 0 }}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Select Approver <span className="text-red-500">*</span>
            </label>
            <Select
              className="w-full"
              placeholder={notebookMemberOptions.length > 0 ? 'Select a notebook member as approver…' : 'No notebook members — type to search all users'}
              showSearch
              optionFilterProp="label"
              value={submitReviewerId}
              onChange={setSubmitReviewerId}
              options={notebookMemberOptions.length > 0 ? notebookMemberOptions : ((reviewerUsers?.items ?? []) as any[])
                .filter((u: any) => ['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(u.role_code ?? u.roleCode ?? ''))
                .map((u: any) => ({ value: u.id, label: `${u.username} (${u.role_code ?? u.roleCode ?? ''})` }))}
              allowClear
            />
            {notebookMemberOptions.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">Notebook has no assigned members — showing all TL/HOD users.</p>
            )}
          </div>

          {checkedAtrIds.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Linked ATRs</label>
              <p className="text-xs text-slate-500">
                {linkedAtrIds.length > 0
                  ? `Co-submitting ${linkedAtrIds.length} ATR${linkedAtrIds.length !== 1 ? 's' : ''} checked "Send for Verif." in Sample Details.`
                  : 'Not co-submitting the linked ATR(s) — only this experiment will be submitted.'}
                {' '}
                <a onClick={() => setAtrAlertOpen(true)}>Change</a>
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Co-submit ATRs (optional)
              </label>
              <Select
                className="w-full"
                mode="multiple"
                placeholder="Select ATRs to co-submit with this experiment…"
                showSearch
                optionFilterProp="label"
                value={linkedAtrIds}
                onChange={setLinkedAtrIds}
                options={coSubmitAtrOptions}
                allowClear
              />
              <p className="text-xs text-slate-400 mt-1">Only DRAFT or SAVED ATRs are listed. Selected ATRs will be moved to REQUESTED together with this experiment.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
            <Input.TextArea
              rows={3}
              placeholder="Remarks for the approver…"
              value={submitRemarks}
              onChange={(e) => setSubmitRemarks(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Pre-Submit modal for VERIFICATION_REQUESTED — pick verifier + remarks */}
      <Modal
        {...glassModalProps}
        title="Submit Experiment for Verification"
        open={submitVerifierOpen}
        onCancel={() => { setSubmitVerifierOpen(false); setSubmitVerifierId(undefined); setSubmitVerifierRemarks('') }}
        onOk={() => {
          setSubmitVerifierOpen(false)
          setPendingTargetStatus('VERIFICATION_REQUESTED')
        }}
        okText="Proceed to Sign"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Select Verifier</label>
            <Select
              className="w-full"
              placeholder="Select a verifier (TL/HOD)…"
              showSearch
              optionFilterProp="label"
              value={submitVerifierId}
              onChange={setSubmitVerifierId}
              disabled={!!expectedVerifier?.userId}
              options={((reviewerUsers?.items ?? []) as any[])
                .filter((u: any) => ['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(u.role_code ?? u.roleCode ?? ''))
                .map((u: any) => ({ value: u.id, label: `${u.username} (${u.role_code ?? u.roleCode ?? ''})` }))}
              allowClear={!expectedVerifier?.userId}
            />
            <p className="text-xs text-slate-400 mt-1">
              {expectedVerifier?.userId
                ? `This experiment's linked ATR test is assigned to ${expectedVerifier.username} — verification is locked to them.`
                : "If this experiment has a linked ATR test, verification is routed to whoever that test is actually assigned to — this selection is only used when nothing's linked."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Remarks</label>
            <Input.TextArea
              rows={3}
              placeholder="Remarks for the verifier…"
              value={submitVerifierRemarks}
              onChange={(e) => setSubmitVerifierRemarks(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* GxP Electronic Signature Modal */}
      <ESignatureModal
        open={pendingTargetStatus !== null}
        userName={user?.username ?? ''}
        title={`Electronic Signature — ${isRejectUnlockPending ? TRANSITION_LABEL['APPROVED_FROM_UNLOCK_REQUESTED'] : (TRANSITION_LABEL[pendingTargetStatus ?? ''] ?? pendingTargetStatus)}`}
        reasonLabel={`Reason for ${isRejectUnlockPending ? TRANSITION_LABEL['APPROVED_FROM_UNLOCK_REQUESTED'] : (TRANSITION_LABEL[pendingTargetStatus ?? ''] ?? 'action')}`}
        requireReason={isRejectUnlockPending || ['REWORK', 'VERIFICATION_REWORK', 'UNLOCK_REQUESTED', 'DEACTIVATED'].includes(pendingTargetStatus ?? '')}
        loading={transition.isPending}
        onCancel={() => setPendingTargetStatus(null)}
        onConfirm={async ({ password, reason }) => {
          if (pendingTargetStatus) {
            if (['SUBMITTED', 'VERIFICATION_REQUESTED'].includes(pendingTargetStatus) && isAnalyst) {
              const allDefs = Array.isArray(exp.sectionDefs) ? (exp.sectionDefs as SectionDef[]) : []
              const matDefs = allDefs.filter(s => s.type === 'material')
              for (const md of matDefs) {
                const rows = (data[md.id] as { batchId?: number; batchNo?: string; qty?: string }[]) || []
                for (const r of rows) {
                  if (r.batchId && r.qty && !isNaN(Number(r.qty)) && Number(r.qty) > 0) {
                    try {
                      await inventoryApi.batches.issue(r.batchId, {
                        qty: Number(r.qty),
                        purpose: `ARD Experiment ${exp.code} execution`,
                        issuedTo: user?.username || 'Analyst',
                      })
                      msg.success(`Deducted ${r.qty} from Inventory Batch #${r.batchNo || r.batchId}`)
                    } catch {
                      // Handled gracefully if batch stock API is un-seeded
                    }
                  }
                }
              }
            }
            await transition.mutateAsync({
              to: pendingTargetStatus,
              password,
              remarks: pendingTargetStatus === 'SUBMITTED'
                ? submitRemarks
                : pendingTargetStatus === 'VERIFICATION_REQUESTED' ? submitVerifierRemarks : reason,
              reason,
              ...(pendingTargetStatus === 'APPROVED' && !isRejectUnlockPending ? { aimAchieved, aimRemarks } : {}),
              ...(pendingTargetStatus === 'SUBMITTED' ? { reviewerId: submitReviewerId, linkedAtrIds } : {}),
              ...(pendingTargetStatus === 'VERIFICATION_REQUESTED' && submitVerifierId ? { reviewerId: submitVerifierId } : {}),
            })
          }
        }}
      />

      {/* Empower CSV Import Modal */}
      <Modal {...glassModalProps} title="Read from Empower — Import CSV" open={empowerModalOpen}
        onCancel={() => { setEmpowerModalOpen(false); setEmpowerCsvText('') }} footer={null} width={580}>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">
            Paste the CSV export from Waters Empower below, or upload the file. The data will be
            imported into the chromatographic section of this experiment.
          </p>
          <Upload.Dragger
            accept=".csv,.txt"
            showUploadList={false}
            beforeUpload={(file) => {
              const reader = new FileReader()
              reader.onload = (e) => setEmpowerCsvText((e.target?.result as string) || '')
              reader.readAsText(file)
              return false
            }}
            className="mb-2"
          >
            <p className="text-xs text-slate-500">Click or drag Empower CSV file here</p>
          </Upload.Dragger>
          <Input.TextArea
            rows={8}
            value={empowerCsvText}
            onChange={e => setEmpowerCsvText(e.target.value)}
            placeholder={"SampleName,InjectionId,PeakName,Amount,RT,Area,Height\nStd1,1,Peak1,99.8,4.32,1234567,88432\n..."}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setEmpowerModalOpen(false); setEmpowerCsvText('') }}>Cancel</Button>
            <Button type="primary" loading={stpEmpowerMut.isPending}
              disabled={!empowerCsvText.trim()}
              onClick={() => stpEmpowerMut.mutate(empowerCsvText)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Import Data
            </Button>
          </div>
        </div>
      </Modal>

      {/* Section Comment Modal — the approver's per-section feedback, one
          thread per section, matching the legacy ELN's own section-comment
          popup (mirrored here rather than copied pixel-for-pixel). */}
      <Modal
        {...glassModalProps}
        title={`${sectionCommentTarget?.label ?? 'Section'} Comments`}
        open={!!sectionCommentTarget}
        onCancel={() => { setSectionCommentTarget(null); setSectionCommentDraft('') }}
        footer={null}
      >
        <div className="py-2 space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {sectionComments.filter(c => c.sectionKey === sectionCommentTarget?.id).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No comments yet.</p>
            ) : (
              sectionComments
                .filter(c => c.sectionKey === sectionCommentTarget?.id)
                .map(c => (
                  <div key={c.id} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-xs">
                    <div className="flex justify-between items-center mb-0.5 gap-2">
                      <span className="font-semibold text-violet-700">{c.byName || 'User'}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400">{c.at ? dayjs(c.at).format('DD MMM YYYY HH:mm') : ''}</span>
                        <Popconfirm title="Delete this comment?" onConfirm={() => deleteSectionComment.mutate(c.id)}>
                          <button type="button" className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </Popconfirm>
                      </div>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{c.comment}</p>
                  </div>
                ))
            )}
          </div>
          <div className="flex gap-2">
            <Input.TextArea
              rows={2}
              placeholder="Add a comment on this section..."
              value={sectionCommentDraft}
              onChange={(e) => setSectionCommentDraft(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              loading={addSectionComment.isPending}
              disabled={!sectionCommentDraft.trim()}
              onClick={() => addSectionComment.mutate(sectionCommentDraft)}
              style={{ alignSelf: 'flex-end' }}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Version History Drawer */}
      <VersionHistoryDrawer
        experimentId={experimentId!}
        sectionDefs={Array.isArray(exp.sectionDefs) ? (exp.sectionDefs as SectionDef[]) : []}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* Events Drawer */}
      <Drawer
        title={<span className="flex items-center gap-2 font-bold text-slate-800"><Activity size={18} className="text-violet-600" /> Experiment Events</span>}
        open={eventsOpen}
        onClose={() => setEventsOpen(false)}
        width={600}
        styles={{ body: { padding: '20px 24px', background: '#fff' } }}
      >
        <ExperimentEventsContent eventsData={eventsData} />
      </Drawer>
    </div>
  )
}

export default function ArdExperimentWorkspacePageWrapped() {
  return (
    <ErrorBoundary fallbackMessage="Unable to render experiment workspace">
      <ArdExperimentWorkspacePage />
    </ErrorBoundary>
  )
}
