/**
 * ArdTestProcessPage — Full test execution & result-entry window.
 * Mirrors the Angular ARD "test-process" module.
 * Route: /ard/atrs/:atrId/tests/:testId
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Button, Card, Collapse, Descriptions, Divider, Form, Input,
  Modal, Popconfirm, Select, Space, Spin, Table, Tabs, Tag, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, CheckCircle2, ClipboardList, FileText, Plus, RotateCcw, Save, Trash2, XCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet, apiPost } from '../../api/client'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import RichEditor from '../../components/RichEditor'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ResultParam {
  id: string
  parameterName: string
  specification: string
  value: string
  uom: string
  passFail: 'COMPLIES' | 'NOT_COMPLIES' | ''
}

interface RawAttachment {
  id: string
  name: string
  description: string
  attachmentType: string
  uploadedAt: string
  uploadedBy: string
}

interface VersionEntry {
  version: number
  priorStatus: string
  submittedAt: string
  submittedBy: string
  submitRemarks: string
  results: ResultParam[]
  resultRemarks: string
  adRemarks: string | null
  instrumentCode: string | null
  lowerLimit: string | null
  upperLimit: string | null
  limitsUom: string | null
}

interface TestDoc {
  id: string
  atrId: string
  status: string
  testType: string
  testSubtype: string
  techniqueCode: string
  techniqueName: string
  arNumber: string | null
  instrumentCode: string | null
  lowerLimit: string | null
  upperLimit: string | null
  limitsUom: string | null
  results: ResultParam[]
  resultRemarks: string | null
  adRemarks: string | null
  submitRemarks: string | null
  rawDataAttachments: RawAttachment[]
  finalReportAttachments: RawAttachment[]
  history: VersionEntry[]
  experimentId: string | null
  assignedToName: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  verifyRemarks: string | null
  submittedAt: string | null
  startedAt: string | null
  version: number
  // ATR context
  formNo: string
  productName: string
  sampleCode: string
  sampleType: string
  batchNo: string | null
  assignedTl: string | null
  qcRef: string | null
  atrStatus: string
  formCreatedById: string | null
  formCreatedBy: string | null
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default', PENDING: 'default',
  ASSIGNED: 'blue', IN_PROGRESS: 'processing', VERIFICATION_REQUESTED: 'gold',
  VERIFICATION_REWORK: 'orange', VERIFIED: 'success', UNLOCKED: 'cyan',
  TENTATIVE: 'cyan', ACCEPTED: 'green', PUBLISHED: 'geekblue',
  UNSATISFACTORY: 'red', ENHANCEMENT_REQUESTED: 'magenta',
  WITHDRAWN: 'volcano', DELEGATED: 'purple', CANCELLED: 'red',
}

const EXEC_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION_REWORK', 'UNLOCKED'])
const VERIFY_STATUSES = new Set(['VERIFICATION_REQUESTED'])

function uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) }

// ── OOS auto-detection ────────────────────────────────────────────────────────
function parseSpecLimits(specStr: string, fallback?: { lower: string; upper: string }): { lower: number | null; upper: number | null } {
  const str = (specStr || '').trim()
  // Range: "98.0 – 102.0" or "98.0-102.0" (dash variants)
  const range = str.match(/^([\d.]+)\s*[–\-—]\s*([\d.]+)/)
  if (range) return { lower: parseFloat(range[1]), upper: parseFloat(range[2]) }
  // NMT / ≤
  const nmt = str.match(/^(?:NMT|not more than|≤)\s*([\d.]+)/i)
  if (nmt) return { lower: null, upper: parseFloat(nmt[1]) }
  // NLT / ≥
  const nlt = str.match(/^(?:NLT|not less than|≥)\s*([\d.]+)/i)
  if (nlt) return { lower: parseFloat(nlt[1]), upper: null }
  // Fallback from spec prop
  if (fallback) {
    const lo = parseFloat(fallback.lower)
    const hi = parseFloat(fallback.upper)
    return { lower: isNaN(lo) ? null : lo, upper: isNaN(hi) ? null : hi }
  }
  return { lower: null, upper: null }
}

function autoPassFail(value: string, limits: { lower: number | null; upper: number | null }): 'COMPLIES' | 'NOT_COMPLIES' | '' {
  const num = parseFloat(value)
  if (isNaN(num)) return ''
  const { lower, upper } = limits
  if (lower !== null && num < lower) return 'NOT_COMPLIES'
  if (upper !== null && num > upper) return 'NOT_COMPLIES'
  if (lower !== null || upper !== null) return 'COMPLIES'
  return ''
}

// ── Result params table ───────────────────────────────────────────────────────
function ResultParamsTable({ rows, onChange, readOnly, spec }: {
  rows: ResultParam[]; onChange: (v: ResultParam[]) => void
  readOnly: boolean; spec?: { lower: string; upper: string; uom: string }
}) {
  const upd = (i: number, patch: Partial<ResultParam>) => {
    const next = rows.slice()
    const updated = { ...next[i], ...patch }
    // Auto-compute pass/fail when value or specification changes
    if ('value' in patch || 'specification' in patch) {
      const limits = parseSpecLimits(updated.specification, spec)
      const computed = autoPassFail(updated.value, limits)
      if (computed) updated.passFail = computed
    }
    next[i] = updated
    onChange(next)
  }
  const cols: ColumnsType<ResultParam> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Parameter Name', dataIndex: 'parameterName',
      render: (v, _, i) => readOnly ? <span>{v}</span> :
        <Input size="small" value={v ?? ''} onChange={e => upd(i, { parameterName: e.target.value })} placeholder="e.g. Assay" />,
    },
    {
      title: 'Specification', dataIndex: 'specification',
      render: (v, _, i) => readOnly ? <span className="text-slate-500 text-xs">{v || (spec ? `${spec.lower}–${spec.upper} ${spec.uom}` : '—')}</span> :
        <Input size="small" value={v ?? ''} onChange={e => upd(i, { specification: e.target.value })} placeholder="e.g. 98.0–102.0 %" />,
    },
    {
      title: 'Value *', dataIndex: 'value', width: 120,
      render: (v, _, i) => readOnly ? <span className="font-semibold">{v}</span> :
        <Input size="small" value={v ?? ''} onChange={e => upd(i, { value: e.target.value })} placeholder="Result" />,
    },
    {
      title: 'UOM', dataIndex: 'uom', width: 80,
      render: (v, _, i) => readOnly ? <span>{v}</span> :
        <Input size="small" value={v ?? ''} onChange={e => upd(i, { uom: e.target.value })} placeholder="%" />,
    },
    {
      title: 'Complies?', dataIndex: 'passFail', width: 140,
      render: (v: string, _, i) => readOnly
        ? <Tag color={v === 'COMPLIES' ? 'green' : v === 'NOT_COMPLIES' ? 'red' : 'default'}>
            {v === 'COMPLIES' ? 'Complies' : v === 'NOT_COMPLIES' ? 'Not Complies' : '—'}
          </Tag>
        : <Select size="small" value={v || undefined} onChange={val => upd(i, { passFail: val as ResultParam['passFail'] })}
            className="w-full" options={[
              { value: 'COMPLIES', label: 'Complies' },
              { value: 'NOT_COMPLIES', label: 'Not Complies' },
            ]} allowClear />,
    },
    {
      title: '', key: 'del', width: 40,
      render: (_, __, i) => readOnly ? null : (
        <Popconfirm title="Remove row?" onConfirm={() => onChange(rows.filter((_, j) => j !== i))}>
          <Button type="text" danger size="small" icon={<Trash2 size={12} />} />
        </Popconfirm>
      ),
    },
  ]
  return (
    <Table
      rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false}
      rowClassName={r => r.passFail === 'NOT_COMPLIES' ? 'bg-red-50' : ''}
      footer={() => readOnly ? undefined : (
        <Button size="small" icon={<Plus size={12} />}
          onClick={() => onChange([...rows, { id: uid(), parameterName: '', specification: '', value: '', uom: '', passFail: '' }])}>
          Add parameter
        </Button>
      )}
    />
  )
}

// ── Version history ────────────────────────────────────────────────────────────
function VersionHistory({ history }: { history: VersionEntry[] }) {
  if (!history.length) return <p className="text-slate-400 text-sm">No prior versions.</p>
  return (
    <Collapse
      items={[...history].reverse().map((v, i) => ({
        key: i,
        label: (
          <span className="flex items-center gap-3 text-sm">
            <Tag>v{v.version}</Tag>
            <Tag color="default">{v.priorStatus?.replace(/_/g, ' ')}</Tag>
            <span className="text-slate-400">{v.submittedBy} · {v.submittedAt ? dayjs(v.submittedAt).format('DD MMM YYYY HH:mm') : '—'}</span>
          </span>
        ),
        children: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
              {v.instrumentCode && <span><strong>Instrument:</strong> {v.instrumentCode}</span>}
              {(v.lowerLimit || v.upperLimit) && (
                <span><strong>Spec Limits:</strong> {v.lowerLimit ?? '—'} – {v.upperLimit ?? '—'} {v.limitsUom ?? ''}</span>
              )}
              {v.resultRemarks && <span className="col-span-2"><strong>Result Remarks:</strong> {v.resultRemarks}</span>}
              {v.adRemarks && <span className="col-span-2"><strong>AD Remarks:</strong> {v.adRemarks}</span>}
              {v.submitRemarks && <span className="col-span-2"><strong>Submit Remarks:</strong> {v.submitRemarks}</span>}
            </div>
            {v.results?.length > 0 && (
              <ResultParamsTable rows={v.results} onChange={() => {}} readOnly={true} />
            )}
          </div>
        ),
      }))}
    />
  )
}

// ── Action modal ───────────────────────────────────────────────────────────────
function ActionModal({ title, open, onOk, onCancel, loading, remarksLabel, remarksRequired }: {
  title: string; open: boolean; onOk: (remarks: string) => void; onCancel: () => void
  loading: boolean; remarksLabel?: string; remarksRequired?: boolean
}) {
  const [remarks, setRemarks] = useState('')
  return (
    <Modal {...glassModalProps} title={title} open={open} onCancel={() => { setRemarks(''); onCancel() }}
      onOk={() => { if (remarksRequired && !remarks.trim()) { message.warning('Remarks are required.'); return } onOk(remarks); setRemarks('') }}
      confirmLoading={loading} okText="Confirm">
      <div className="mt-3">
        <p className="text-xs text-slate-400 mb-1">{remarksLabel ?? 'Remarks'}{remarksRequired ? ' *' : ''}</p>
        <Input.TextArea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Enter remarks..." />
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ArdTestProcessPage() {
  const { atrId = '', testId = '' } = useParams<{ atrId: string; testId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()

  // Local draft state
  const [results, setResults] = useState<ResultParam[]>([])
  const [resultRemarks, setResultRemarks] = useState('')
  const [adRemarks, setAdRemarks] = useState('')
  const [instrumentCode, setInstrumentCode] = useState('')
  const [notebookReference, setNotebookReference] = useState('')
  const [notebookRefLink, setNotebookRefLink] = useState(false)
  const [testQty, setTestQty] = useState('')
  const [testQtyUom, setTestQtyUom] = useState('')
  const [isAdditionalTest, setIsAdditionalTest] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Modal state
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitEsignOpen, setSubmitEsignOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyEsignOpen, setVerifyEsignOpen] = useState(false)
  const [reworkOpen, setReworkOpen] = useState(false)
  const [delegateOpen, setDelegateOpen] = useState(false)
  const [delegateForm] = Form.useForm<{ toName: string; remarks: string }>()
  const [unsatisfactoryOpen, setUnsatisfactoryOpen] = useState(false)
  const [unsatisfactoryRemarks, setUnsatisfactoryRemarks] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [acceptAnalystId, setAcceptAnalystId] = useState<string | undefined>()
  const [acceptAnalystName, setAcceptAnalystName] = useState<string | undefined>()
  const [takeoverOpen, setTakeoverOpen] = useState(false)
  const [takeoverAnalystId, setTakeoverAnalystId] = useState<string | undefined>()
  const [takeoverRemarks, setTakeoverRemarks] = useState('')

  const { data: test, isLoading, error } = useQuery<TestDoc>({
    queryKey: ['ard-test', atrId, testId],
    queryFn: () => apiGet(`/api/ard/tests/${atrId}/${testId}`),
    enabled: !!atrId && !!testId,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!test) return
    setResults(test.results ?? [])
    setResultRemarks(test.resultRemarks ?? '')
    setAdRemarks(test.adRemarks ?? '')
    setInstrumentCode(test.instrumentCode ?? '')
    setNotebookReference((test as any).notebookReference ?? '')
    setNotebookRefLink(!!(test as any).notebookRefLink)
    setTestQty((test as any).testQty ?? '')
    setTestQtyUom((test as any).testQtyUom ?? '')
    setIsAdditionalTest(!!(test as any).isAdditionalTest)
    setIsDirty(false)
  }, [test])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ard-test', atrId, testId] })

  const _execPayload = () => ({
    results, resultRemarks, adRemarks, instrumentCode,
    notebookReference: notebookReference || undefined,
    notebookRefLink,
    testQty: testQty || undefined,
    testQtyUom: testQtyUom || undefined,
    isAdditionalTest,
  })

  const saveResultsMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/save-results`, _execPayload()),
    onSuccess: () => { invalidate(); setIsDirty(false); msgApi.success('Results saved.') },
    onError: () => msgApi.error('Save failed.'),
  })

  const submitMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/submit`, {
      ..._execPayload(), submitRemarks: remarks,
    }),
    onSuccess: () => { invalidate(); setSubmitOpen(false); msgApi.success('Test submitted for verification.') },
    onError: () => msgApi.error('Submission failed.'),
  })

  const verifyMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/verify`, { remarks }),
    onSuccess: () => { invalidate(); setVerifyOpen(false); msgApi.success('Test verified.') },
    onError: () => msgApi.error('Verification failed.'),
  })

  const reworkMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/rework`, { remarks }),
    onSuccess: () => { invalidate(); setReworkOpen(false); msgApi.success('Sent back for rework.') },
    onError: () => msgApi.error('Rework action failed.'),
  })

  const delegateMut = useMutation({
    mutationFn: (body: { tlId: string; tlName: string; actionRemarks?: string }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/delegate`, body),
    onSuccess: () => { invalidate(); setDelegateOpen(false); delegateForm.resetFields(); msgApi.success('Test delegated.') },
    onError: () => msgApi.error('Delegation failed.'),
  })

  const acceptTestMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/accept-test`, {}),
    onSuccess: () => { invalidate(); msgApi.success('Test accepted.') },
    onError: () => msgApi.error('Accept failed.'),
  })

  const cancelMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/cancel`, { remarks }),
    onSuccess: () => { invalidate(); setCancelOpen(false); msgApi.success('Test cancelled.') },
    onError: () => msgApi.error('Cancel failed.'),
  })

  const withdrawMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/withdraw`, { remarks }),
    onSuccess: () => { invalidate(); setWithdrawOpen(false); msgApi.success('Test withdrawn.') },
    onError: () => msgApi.error('Withdraw failed.'),
  })

  const { data: qualifiedAnalysts } = useQuery<{ items: { userId: string; userName: string }[] }>({
    queryKey: ['ard-test-qualified-analysts', atrId, testId],
    queryFn: () => apiGet(`/api/ard/tests/${atrId}/${testId}/qualified-analysts`),
    enabled: (acceptOpen || takeoverOpen) && !!atrId && !!testId,
  })

  const acceptTestRequestMut = useMutation({
    mutationFn: ({ analystId, analystName }: { analystId: string; analystName: string }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/assign`, { analystId, analystName }),
    onSuccess: () => { invalidate(); setAcceptOpen(false); setAcceptAnalystId(undefined); setAcceptAnalystName(undefined); msgApi.success('Test accepted and assigned.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Accept failed.'),
  })

  const takeoverMut = useMutation({
    mutationFn: ({ targetUserId, remarks }: { targetUserId: string; remarks: string }) =>
      apiPost(`/api/ard/tests/${atrId}/${testId}/takeover`, { targetUserId, remarks }),
    onSuccess: () => { invalidate(); setTakeoverOpen(false); setTakeoverAnalystId(undefined); setTakeoverRemarks(''); msgApi.success('Test reassigned.') },
    onError: (e: any) => msgApi.error(e?.detail ?? 'Takeover failed.'),
  })

  const publishMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/publish`, {}),
    onSuccess: () => { invalidate(); msgApi.success('Test results published.') },
    onError: () => msgApi.error('Publish failed.'),
  })

  const unsatisfactoryMut = useMutation({
    mutationFn: (remarks: string) => apiPost(`/api/ard/tests/${atrId}/${testId}/unsatisfactory`, { remarks }),
    onSuccess: () => { invalidate(); setUnsatisfactoryOpen(false); setUnsatisfactoryRemarks(''); msgApi.success('Test marked unsatisfactory.') },
    onError: () => msgApi.error('Action failed.'),
  })

  const mark = (fn: () => void) => { fn(); setIsDirty(true) }

  if (isLoading) return <div className="p-8 flex justify-center"><Spin size="large" /></div>
  if (error || !test) return (
    <div className="p-4 md:p-6">
      <Alert type="error" message="Test not found."
        action={<Button size="small" onClick={() => navigate(`/ard/atrs/${atrId}`)}>Back to ATR</Button>} />
    </div>
  )

  const canExec = EXEC_STATUSES.has(test.status)
  const canVerify = VERIFY_STATUSES.has(test.status)
  const role = user?.role_code ?? ''
  const isLead = ['TL', 'HOD', 'SUPER_ADMIN'].includes(role)
  // Unassigned tests may only be executed by TL/HOD/SUPER_ADMIN; assigned tests require the named analyst or SUPER_ADMIN.
  const isAssignedAnalyst = !test.assignedToName
    ? ['TL', 'HOD', 'SUPER_ADMIN'].includes(role)
    : (test.assignedToName === user?.username || role === 'SUPER_ADMIN')
  // ATR raiser is the person who created the ATR form — they accept/reject analytical results
  const isAtrRaiser = !!user?.id && user.id === test.formCreatedById
  const canAcceptResult = isAtrRaiser || role === 'SUPER_ADMIN'

  return (
    <>
      {ctx}
      <div className="p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(`/ard/atrs/${atrId}`)} />
          <ClipboardList size={20} className="text-violet-500 mt-1 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-800">Test Process</h1>
              <Tag color={STATUS_COLOR[test.status] ?? 'default'}>{test.status.replace(/_/g, ' ')}</Tag>
              {test.version > 1 && <Tag color="purple">v{test.version}</Tag>}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{test.formNo} · {test.arNumber ?? 'AR not generated'}</p>
          </div>
          <Space wrap>
            {/* Accept Test Request — TL/HOD formally assigns an UNASSIGNED test */}
            {isLead && test.status === 'UNASSIGNED' && (
              <Button type="primary" icon={<CheckCircle2 size={14} />}
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                onClick={() => setAcceptOpen(true)}>
                Accept Test Request
              </Button>
            )}
            {/* Takeover / Reassign Analyst */}
            {isLead && ['ASSIGNED', 'IN_PROGRESS', 'VERIFICATION_REQUESTED', 'VERIFICATION_REWORK'].includes(test.status) && (
              <Button icon={<RotateCcw size={14} />}
                className="border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100"
                onClick={() => { setTakeoverAnalystId(undefined); setTakeoverRemarks(''); setTakeoverOpen(true) }}>
                Reassign Analyst
              </Button>
            )}
            {canExec && isDirty && (
              <Button icon={<Save size={14} />} loading={saveResultsMut.isPending}
                onClick={() => saveResultsMut.mutate()}>
                Save Results
              </Button>
            )}
            {canExec && isAssignedAnalyst && (
              <Button type="primary" icon={<CheckCircle2 size={14} />}
                onClick={() => setSubmitEsignOpen(true)}>
                Submit for Verification (E-Sign)
              </Button>
            )}
            {isLead && canExec && (
              <Button onClick={() => setDelegateOpen(true)}>Delegate</Button>
            )}
            {canVerify && isLead && (
              <>
                <Button type="primary" icon={<CheckCircle2 size={14} />}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  onClick={() => setVerifyEsignOpen(true)}>
                  Verify (E-Sign)
                </Button>
                <Button icon={<RotateCcw size={14} />} onClick={() => setReworkOpen(true)}>
                  Rework
                </Button>
              </>
            )}
            {/* Accept / Publish / Unsatisfactory — ATR raiser accepts/rejects verified analytical results */}
            {canAcceptResult && test.status === 'VERIFIED' && (
              <>
                <Button type="primary" icon={<CheckCircle2 size={14} />}
                  style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  loading={acceptTestMut.isPending}
                  onClick={() => acceptTestMut.mutate()}>
                  Accept Test
                </Button>
                <Button icon={<CheckCircle2 size={14} />}
                  loading={publishMut.isPending}
                  onClick={() => publishMut.mutate()}>
                  Publish Results
                </Button>
                <Button danger icon={<XCircle size={14} />}
                  onClick={() => setUnsatisfactoryOpen(true)}>
                  Unsatisfactory
                </Button>
              </>
            )}
            {/* Accept also applies to TENTATIVE */}
            {canAcceptResult && test.status === 'TENTATIVE' && (
              <Button type="primary" icon={<CheckCircle2 size={14} />}
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                loading={acceptTestMut.isPending}
                onClick={() => acceptTestMut.mutate()}>
                Accept Test
              </Button>
            )}
            {/* Cancel — TL/HOD/Admin can cancel any non-terminal test */}
            {isLead && !['VERIFIED', 'ACCEPTED', 'PUBLISHED', 'CANCELLED', 'WITHDRAWN'].includes(test.status) && (
              <Button danger onClick={() => setCancelOpen(true)} loading={cancelMut.isPending}>
                Cancel Test
              </Button>
            )}
            {/* Withdraw — Analyst/TL can withdraw their own test */}
            {(isAssignedAnalyst || isLead) && !['VERIFIED', 'ACCEPTED', 'PUBLISHED', 'CANCELLED', 'WITHDRAWN'].includes(test.status) && (
              <Button onClick={() => setWithdrawOpen(true)} loading={withdrawMut.isPending}>
                Withdraw
              </Button>
            )}
          </Space>
        </div>

        {isDirty && (
          <Alert type="warning" showIcon message="You have unsaved result changes."
            action={<Button size="small" onClick={() => saveResultsMut.mutate()} loading={saveResultsMut.isPending}>Save now</Button>} />
        )}

        {/* Result Summary */}
        <Card title={<span className="text-sm font-semibold text-slate-700">Result Summary</span>} size="small">
          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
            <Descriptions.Item label="ATR Form No">{test.formNo}</Descriptions.Item>
            <Descriptions.Item label="Product / Sample">{test.productName}</Descriptions.Item>
            <Descriptions.Item label="Sample Code">{test.sampleCode || '—'}</Descriptions.Item>
            <Descriptions.Item label="Sample Type">{test.sampleType || '—'}</Descriptions.Item>
            <Descriptions.Item label="Batch No">{test.batchNo || '—'}</Descriptions.Item>
            <Descriptions.Item label="QC Ref">{test.qcRef || '—'}</Descriptions.Item>
            <Descriptions.Item label="Test Type">{test.testType}</Descriptions.Item>
            <Descriptions.Item label="Test Sub-type">{test.testSubtype || '—'}</Descriptions.Item>
            <Descriptions.Item label="Technique">{test.techniqueName || test.techniqueCode || '—'}</Descriptions.Item>
            <Descriptions.Item label="Assigned Analyst">{test.assignedToName || '—'}</Descriptions.Item>
            <Descriptions.Item label="AR Number">
              {test.arNumber
                ? <span className="font-mono text-sm font-semibold text-violet-700">{test.arNumber}</span>
                : <span className="text-slate-400 text-xs">Generated when the test is started</span>}
            </Descriptions.Item>
            <Descriptions.Item label="Instrument / Equipment Code">
              {canExec ? (
                <Input
                  size="small"
                  placeholder="e.g. HPLC-01 / GC-03"
                  value={instrumentCode}
                  onChange={e => { setInstrumentCode(e.target.value); setIsDirty(true) }}
                  style={{ width: 160 }}
                />
              ) : (
                <span className="font-mono text-xs font-semibold">{instrumentCode || '—'}</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Specification">
              {test.lowerLimit || test.upperLimit
                ? `${test.lowerLimit ?? ''}–${test.upperLimit ?? ''} ${test.limitsUom ?? ''}`
                : '—'}
            </Descriptions.Item>
            {test.verifiedBy && (
              <Descriptions.Item label="Verified By">
                {test.verifiedBy} · {test.verifiedAt ? dayjs(test.verifiedAt).format('DD MMM YYYY HH:mm') : ''}
              </Descriptions.Item>
            )}
            {test.verifyRemarks && (
              <Descriptions.Item label="Verify Remarks" span={2}>{test.verifyRemarks}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Test Results */}
        <Card
          title={<span className="text-sm font-semibold text-slate-700">Test Results</span>}
          size="small"
          extra={canExec && (
            <span className="text-xs text-slate-400">Enter result values for each parameter</span>
          )}
        >
          <ResultParamsTable
            rows={results}
            onChange={v => { setResults(v); setIsDirty(true) }}
            readOnly={!canExec}
            spec={test.lowerLimit ? { lower: test.lowerLimit, upper: test.upperLimit ?? '', uom: test.limitsUom ?? '' } : undefined}
          />
        </Card>

        {/* Result Remarks */}
        <Card title={<span className="text-sm font-semibold text-slate-700">Result Remarks</span>} size="small">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">Result Remarks</p>
              <RichEditor
                value={resultRemarks}
                onChange={v => mark(() => setResultRemarks(v))}
                readOnly={!canExec}
              />
            </div>
            <Divider className="my-2" />
            <div>
              <p className="text-xs text-slate-400 mb-1 font-medium">AD Remarks</p>
              <RichEditor
                value={adRemarks}
                onChange={v => mark(() => setAdRemarks(v))}
                readOnly={!canExec}
              />
            </div>
          </div>
        </Card>

        {/* Raw Data Attachments */}
        <Card title={<span className="text-sm font-semibold text-slate-700">Raw Data Attachments</span>} size="small">
          <ArdAttachmentsPanel entityType="test_request" entityId={testId} readOnly={!canExec} />
        </Card>

        {/* Version History */}
        {test.history?.length > 0 && (
          <Card title={<span className="text-sm font-semibold text-slate-700">Version History</span>} size="small">
            <VersionHistory history={test.history} />
          </Card>
        )}

        {/* Bottom save bar */}
        {canExec && isDirty && (
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => { if (test) { setResults(test.results ?? []); setResultRemarks(test.resultRemarks ?? ''); setAdRemarks(test.adRemarks ?? ''); setIsDirty(false) } }}>
              Discard
            </Button>
            <Button type="primary" icon={<Save size={14} />}
              loading={saveResultsMut.isPending} onClick={() => saveResultsMut.mutate()}>
              Save Results
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <ActionModal title="Submit for Verification" open={submitOpen}
        onOk={r => submitMut.mutate(r)} onCancel={() => setSubmitOpen(false)}
        loading={submitMut.isPending} remarksLabel="Submit Remarks" />

      <ActionModal title="Verify Test Results" open={verifyOpen}
        onOk={r => verifyMut.mutate(r)} onCancel={() => setVerifyOpen(false)}
        loading={verifyMut.isPending} remarksLabel="Verification Remarks" />

      <ActionModal title="Send for Rework" open={reworkOpen}
        onOk={r => reworkMut.mutate(r)} onCancel={() => setReworkOpen(false)}
        loading={reworkMut.isPending} remarksLabel="Rework Remarks" remarksRequired />

      <ESignatureModal
        open={verifyEsignOpen}
        title="Verify Test Execution (E-Signature)"
        description="Re-authenticate with your password to verify these analytical test results."
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Verification Remarks"
        loading={verifyMut.isPending}
        onCancel={() => setVerifyEsignOpen(false)}
        onConfirm={async (payload) => {
          await verifyMut.mutateAsync(payload.reason ?? '')
          setVerifyEsignOpen(false)
        }}
      />

      <ESignatureModal
        open={submitEsignOpen}
        title="Submit Test Results (E-Signature)"
        description="Re-authenticate with your password to submit these analytical test results for verification."
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Submission Remarks"
        loading={submitMut.isPending}
        onCancel={() => setSubmitEsignOpen(false)}
        onConfirm={async (payload) => {
          await submitMut.mutateAsync(payload.reason || '')
          setSubmitEsignOpen(false)
        }}
      />

      {/* Delegate modal */}
      <Modal
        {...glassModalProps}
        title="Delegate Test"
        open={delegateOpen}
        onCancel={() => { setDelegateOpen(false); delegateForm.resetFields() }}
        onOk={() => delegateForm.validateFields().then(v =>
          delegateMut.mutate({ tlId: v.toName, tlName: v.toName, actionRemarks: v.remarks })
        )}
        confirmLoading={delegateMut.isPending}
        okText="Delegate"
      >
        <p className="text-xs text-slate-400 mb-3">
          Transfer this test to another team member. They will be notified and can start executing it.
        </p>
        <Form form={delegateForm} layout="vertical">
          <Form.Item name="toName" label="Delegate To (username)" rules={[{ required: true, message: 'Username is required.' }]}>
            <Input placeholder="Enter analyst username" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} placeholder="Reason for delegation..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Accept Test Request modal (#65) */}
      <Modal {...glassModalProps} title="Accept Test Request" open={acceptOpen}
        onCancel={() => { setAcceptOpen(false); setAcceptAnalystId(undefined); setAcceptAnalystName(undefined) }}
        onOk={() => {
          if (!acceptAnalystId || !acceptAnalystName) { message.warning('Select an analyst.'); return }
          acceptTestRequestMut.mutate({ analystId: acceptAnalystId, analystName: acceptAnalystName })
        }}
        confirmLoading={acceptTestRequestMut.isPending}
        okText="Accept & Assign">
        <div className="space-y-3 py-2">
          <p className="text-xs text-slate-500">
            Formally accept this test request and assign it to a qualified analyst to begin execution.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Qualified Analyst *</label>
          <Select
            showSearch className="w-full" placeholder="Select analyst..."
            value={acceptAnalystId}
            onChange={(id, opt: any) => { setAcceptAnalystId(id); setAcceptAnalystName(opt?.label?.split(' (')[0] ?? id) }}
            optionFilterProp="label"
            options={(qualifiedAnalysts?.items ?? []).map(a => ({
              value: a.userId,
              label: `${a.userName}`,
            }))}
          />
          {(qualifiedAnalysts as any)?.isRestricted && (qualifiedAnalysts?.items ?? []).length === 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <strong>Assignment blocked:</strong> No analyst holds a valid certification for this technique. Update qualification records first.
            </div>
          )}
          {!(qualifiedAnalysts as any)?.isRestricted && (qualifiedAnalysts?.items ?? []).length === 0 && (
            <p className="text-xs text-slate-500">No qualification records configured for this technique — any analyst may be assigned.</p>
          )}
        </div>
      </Modal>

      {/* Test Takeover modal (#100) */}
      <Modal {...glassModalProps} title="Reassign Analyst (Takeover)" open={takeoverOpen}
        onCancel={() => { setTakeoverOpen(false); setTakeoverAnalystId(undefined); setTakeoverRemarks('') }}
        onOk={() => {
          if (!takeoverAnalystId) { message.warning('Select an analyst.'); return }
          if (!takeoverRemarks.trim()) { message.warning('Remarks are required.'); return }
          takeoverMut.mutate({ targetUserId: takeoverAnalystId, remarks: takeoverRemarks })
        }}
        confirmLoading={takeoverMut.isPending}
        okText="Reassign">
        <div className="space-y-3 py-2">
          <p className="text-xs text-slate-500">
            Transfer ownership of this test to another analyst. The previous analyst's work is preserved in the ownership history.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1">New Analyst *</label>
          <Select
            showSearch className="w-full" placeholder="Select analyst..."
            value={takeoverAnalystId}
            onChange={setTakeoverAnalystId}
            optionFilterProp="label"
            options={(qualifiedAnalysts?.items ?? []).map(a => ({
              value: a.userId,
              label: a.userName,
            }))}
          />
          <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1">Reason *</label>
          <Input.TextArea rows={3} value={takeoverRemarks}
            onChange={e => setTakeoverRemarks(e.target.value)}
            placeholder="Business justification for reassignment..." />
        </div>
      </Modal>

      {/* Cancel Test modal */}
      <ActionModal
        title="Cancel Test"
        open={cancelOpen}
        onOk={(remarks) => cancelMut.mutate(remarks)}
        onCancel={() => setCancelOpen(false)}
        loading={cancelMut.isPending}
        remarksLabel="Reason for cancellation"
        remarksRequired
      />

      {/* Withdraw Test modal */}
      <ActionModal
        title="Withdraw Test"
        open={withdrawOpen}
        onOk={(remarks) => withdrawMut.mutate(remarks)}
        onCancel={() => setWithdrawOpen(false)}
        loading={withdrawMut.isPending}
        remarksLabel="Reason for withdrawal"
        remarksRequired
      />

      {/* Unsatisfactory modal */}
      <Modal {...glassModalProps} title="Mark as Unsatisfactory" open={unsatisfactoryOpen}
        onCancel={() => { setUnsatisfactoryOpen(false); setUnsatisfactoryRemarks('') }} footer={null} width={460}>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">Provide a reason for marking this test as unsatisfactory.</p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Remarks <span className="text-red-400">*</span>
            </label>
            <Input.TextArea rows={3} value={unsatisfactoryRemarks} onChange={e => setUnsatisfactoryRemarks(e.target.value)}
              placeholder="Describe what was unsatisfactory..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setUnsatisfactoryOpen(false); setUnsatisfactoryRemarks('') }}>Cancel</Button>
            <Button danger loading={unsatisfactoryMut.isPending} disabled={!unsatisfactoryRemarks.trim()}
              onClick={() => unsatisfactoryMut.mutate(unsatisfactoryRemarks)}>
              Confirm Unsatisfactory
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
