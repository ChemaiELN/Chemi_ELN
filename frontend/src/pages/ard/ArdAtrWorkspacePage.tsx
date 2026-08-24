import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Tag, Button, Input, Form, Switch, Table, Modal, message, Card,
  Popconfirm, Space, Empty, Select, Dropdown, Row, Col, Divider, Tooltip, DatePicker, Segmented, Spin,
} from 'antd'
import { FileText, ShieldCheck, Award, RotateCcw, Send, HelpCircle, ArrowLeft, Plus, FlaskConical, LayoutList, Clock, Link2, Edit3, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'
import { ardApi, ardAtrApi, ardUserApi, ardTeamApi, type AtrStatus, type AtrSample, type AtrSupportingDoc } from '../../api/ard'
import { userApi } from '../../api/adc'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import TestFinalReportLink from '../../components/ard/TestFinalReportLink'
import { AtrCertificationPanel } from '../../components/ard/AtrCertificationPanel'
import { AtrExpReferencePicker } from '../../components/ard/AtrExpReferencePicker'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { ArdMetadataBanner } from '../../components/ard/ArdMetadataBanner'
import { ArdWorkflowStepper } from '../../components/ard/ArdWorkflowStepper'
import { ApiError, apiDownloadBlob, apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { inventoryApi } from '../../api/inventory'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'

const { TextArea } = Input

const ATR_TRANSITIONS: Record<AtrStatus, AtrStatus[]> = {
  DRAFT: ['SAVED', 'NEW', 'REQUESTED', 'QA_PRE_APPROVAL', 'WITHDRAWN'],
  SAVED: ['NEW', 'REQUESTED', 'QA_PRE_APPROVAL', 'WITHDRAWN'],
  REQUESTED: ['DEPT_TL_APPROVED', 'WITHDRAWN'],
  DEPT_TL_APPROVED: ['NEW', 'WITHDRAWN'],
  NEW: ['QA_PRE_APPROVAL', 'PENDING_CLARIFICATION', 'PARTIAL', 'REJECTED', 'WITHDRAWN'],
  QA_PRE_APPROVAL: ['NEW', 'PRE_APPROVAL_REWORK', 'WITHDRAWN'],
  PRE_APPROVAL_REWORK: ['QA_PRE_APPROVAL', 'SAVED'],
  PENDING_CLARIFICATION: ['CLARIFIED'],
  CLARIFIED: ['NEW', 'PARTIAL', 'PENDING_CLARIFICATION'],
  PARTIAL: ['PENDING_APPROVAL', 'APPROVED', 'PENDING_CLARIFICATION'],
  PENDING_APPROVAL: ['APPROVED'],
  APPROVED: ['VERIFIED', 'CERTIFICATION_REQUESTED'],
  VERIFIED: ['CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK', 'ACCEPTED', 'ENHANCEMENT_REQUESTED'],
  CERTIFICATION_REQUESTED: ['CERTIFIED', 'CERTIFICATION_REWORK'],
  CERTIFICATION_REWORK: ['CERTIFICATION_REQUESTED'],
  CERTIFIED: [],
  ACCEPTED: [],
  ENHANCEMENT_REQUESTED: ['PARTIAL', 'REJECTED'],
  REJECTED: ['SAVED', 'WITHDRAWN'],
  WITHDRAWN: [],
}

const ACTION_LABELS: Record<string, string> = {
  SAVED: 'Save Draft',
  REQUESTED: 'Submit Request',
  DEPT_TL_APPROVED: 'Approve as Dept TL',
  NEW: 'Submit Request',
  QA_PRE_APPROVAL: 'Submit for QA Pre-Approval',
  PRE_APPROVAL_REWORK: 'Return for Pre-Approval Rework',
  PENDING_CLARIFICATION: 'Request Clarification',
  CLARIFIED: 'Submit Clarification',
  PARTIAL: 'Start Testing / Partial Results',
  PENDING_APPROVAL: 'Submit for Approval',
  APPROVED: 'Approve Results',
  VERIFIED: 'Verify Analytical Results',
  CERTIFICATION_REQUESTED: 'Request QA Certification',
  CERTIFICATION_REWORK: 'Return for Certification Rework',
  CERTIFIED: 'Certify ATR',
  REJECTED: 'Reject Request',
  WITHDRAWN: 'Withdraw Request',
  ENHANCEMENT_REQUESTED: 'Process Enhancement Request',
  ACCEPTED: 'Accept Results',
}

function getActionLabel(s: string) {
  return ACTION_LABELS[s] || s.replace(/_/g, ' ')
}

const STRUCT_EDITABLE: AtrStatus[] = ['DRAFT', 'SAVED', 'PRE_APPROVAL_REWORK', 'REJECTED', 'PENDING_CLARIFICATION']
const ESIGN_FLAGS: Partial<Record<AtrStatus, string>> = {
  NEW: 'ATRSubmitAuthentication', QA_PRE_APPROVAL: 'ATRSubmitAuthentication',
  PENDING_CLARIFICATION: 'ClarificationAuthentication',
  WITHDRAWN: 'WithdrawATRAuthentication', CERTIFIED: 'QACertifyAuthentication', REJECTED: 'QARejectAuthentication',
}

function statusColor(status: AtrStatus) {
  if (status === 'CERTIFIED' || status === 'ACCEPTED') return 'green'
  if (status === 'REJECTED' || status === 'WITHDRAWN') return 'red'
  if (status === 'DRAFT' || status === 'SAVED') return 'default'
  if (status === 'REQUESTED') return 'purple'
  if (status === 'DEPT_TL_APPROVED') return 'cyan'
  if (status === 'NEW' || status === 'PARTIAL') return 'blue'
  if (status === 'ENHANCEMENT_REQUESTED') return 'orange'
  return 'gold'
}

const TEST_STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default', PENDING: 'default', ASSIGNED: 'blue', IN_PROGRESS: 'processing',
  VERIFICATION_REQUESTED: 'gold', VERIFICATION_REWORK: 'orange',
  VERIFIED: 'success', TENTATIVE: 'cyan', ACCEPTED: 'green',
  UNLOCKED: 'cyan', WITHDRAWN: 'default',
}
// PENDING is the server-side equivalent of UNASSIGNED (set when ATR is submitted)
const normalizeTestStatus = (s: string) => s === 'PENDING' ? 'UNASSIGNED' : s

function ManageTestsModal({ atrId, sample, onClose }: { atrId: string; sample: AtrSample; onClose: () => void }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [testConfigIds, setTestConfigIds] = useState<string[]>([])
  const [testGroupIds, setTestGroupIds] = useState<string[]>([])
  const [currentTests, setCurrentTests] = useState<AtrSample['tests']>(sample.tests || [])
  const [handoverTestId, setHandoverTestId] = useState<string | null>(null)
  const [handoverAnalystId, setHandoverAnalystId] = useState<string>('')
  const [handoverRemarks, setHandoverRemarks] = useState<string>('')
  const { data: masterData } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  const { data: usersData } = useQuery({ queryKey: ['ard-users-list'], queryFn: () => userApi.list({ limit: 200 }) })

  const analystOptions = useMemo(() => {
    const ANALYST_ROLES = ['ANALYST', 'CHEMIST', 'CHEM', 'SE', 'TL', 'TEAM_LEAD']
    return (usersData?.items ?? [])
      .filter((u: any) => ANALYST_ROLES.includes(u.role_code ?? u.roleCode ?? ''))
      .map((u: any) => ({ value: u.id, label: `${u.username} (${u.role_code ?? u.roleCode ?? ''})` }))
  }, [usersData])

  const addTests = useMutation({
    mutationFn: () => ardAtrApi.addTests(atrId, sample.id, {
      ...(testGroupIds.length ? { testGroupIds, testGroupId: testGroupIds[0] } : {}),
      ...(testConfigIds.length ? { testConfigIds } : {}),
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
      msg.success('Tests added.')
      setTestConfigIds([])
      setTestGroupIds([])
      const newTests = (res?.created || []).map((t: any) => ({
        id: t.id,
        testType: t.testType || t.test_type,
        techniqueCode: t.techniqueCode || t.technique_code || '—',
        status: t.status || 'UNASSIGNED',
        testConfigId: t.testConfigId || t.test_config_id,
        results: t.results || [],
      }))
      setCurrentTests((prev) => [...prev, ...newTests])
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add tests.'),
  })
  const removeTest = useMutation({
    mutationFn: (testId: string) => ardAtrApi.removeTest(atrId, sample.id, testId),
    onSuccess: (_, testId) => {
      qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
      msg.success('Test removed.')
      setCurrentTests((prev) => prev.filter((t) => t.id !== testId))
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to remove test.'),
  })
  const handoverTest = useMutation({
    mutationFn: () => ardAtrApi.takeoverTest(atrId, handoverTestId!, { targetUserId: handoverAnalystId || undefined, remarks: handoverRemarks || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
      msg.success('Test handed over.')
      setHandoverTestId(null)
      setHandoverAnalystId('')
      setHandoverRemarks('')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Handover failed.'),
  })

  return (
    <Modal {...glassModalProps} title={`Tests — ${sample.sampleCode}`} open onCancel={onClose} footer={null}>
      {ctx}
      <Table
        rowKey="id"
        dataSource={currentTests}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        className="mb-4"
        expandable={{
          expandedRowRender: (row: any) => {
            const config = (masterData?.testConfigs ?? []).find(
              (c: any) => c.id === row.testConfigId || (c.testType === row.testType && c.techniqueCode === row.techniqueCode)
            )
            const params = config?.resultParams ?? row.results ?? []
            if (!params || params.length === 0) {
              return <p className="text-xs text-slate-400 italic py-1 px-3">No test parameters configured.</p>
            }
            return (
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 my-1">
                <p className="font-semibold text-slate-600 uppercase text-[10px] tracking-wider mb-2">
                  Test Parameters ({params.length})
                </p>
                <Table
                  rowKey={(p: any, i) => (p && typeof p === 'object' && p.id ? p.id : String(i))}
                  dataSource={params}
                  size="small"
                  pagination={false}
                  bordered
                  className="bg-white rounded overflow-hidden"
                  columns={[
                    {
                      title: 'Parameter Name',
                      dataIndex: 'name',
                      render: (v, p: any, idx) => (
                        <span className="font-medium text-slate-800 text-xs">
                          {v || p.parameterName || p.parameter || `Param ${idx + 1}`}
                        </span>
                      ),
                    },
                    {
                      title: 'Data Type',
                      dataIndex: 'dataType',
                      width: 110,
                      render: (v) => v ? <Tag color="blue" className="text-[11px] font-mono uppercase">{v}</Tag> : <span className="text-slate-400 text-xs">—</span>,
                    },
                    {
                      title: 'UOM',
                      dataIndex: 'uom',
                      width: 90,
                      render: (v) => v ? <span className="font-mono text-xs font-semibold text-slate-700">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
                    },
                    {
                      title: 'Specification Limits',
                      key: 'limits',
                      render: (_, p: any) => {
                        if (p.lowerLimit == null && p.upperLimit == null) return <span className="text-slate-400 text-xs">—</span>
                        return (
                          <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                            {p.lowerLimit ?? '—'} to {p.upperLimit ?? '—'}
                          </span>
                        )
                      },
                    },
                    {
                      title: 'Result Value',
                      key: 'value',
                      render: (_, p: any) => {
                        const raw = p.value ?? p.resultValue
                        const val = typeof raw === 'string' ? raw.replace(/<[^>]+>/g, '').trim() : raw
                        return (val === undefined || val === null || val === '')
                          ? <span className="text-slate-400 text-xs">—</span>
                          : <span className="font-semibold text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">{String(val)}</span>
                      },
                    },
                  ]}
                />
              </div>
            )
          },
          rowExpandable: () => true,
        }}
        columns={[
          { title: 'Test Type', dataIndex: 'testType' },
          { title: 'Technique', dataIndex: 'techniqueCode' },
          { title: 'AR Number', dataIndex: 'arNumber', render: (v: string) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-slate-400 text-xs">—</span> },
          {
            title: 'Status', dataIndex: 'status',
            render: (v: string) => { const s = normalizeTestStatus(v); return <Tag color={TEST_STATUS_COLOR[s] ?? 'default'} className="text-xs">{s.replace(/_/g, ' ')}</Tag> },
          },
          {
            title: '', width: 160,
            render: (_, row) => {
              const s = normalizeTestStatus(row.status)
              return (
                <Space size="small">
                  {s !== 'UNASSIGNED' && (
                    <Button size="small" type="link" className="p-0"
                      onClick={() => { onClose(); navigate(`/ard/tests/${atrId}/${row.id}`) }}>
                      Open →
                    </Button>
                  )}
                  {s === 'ASSIGNED' && (
                    <Button size="small" type="default" icon={<RotateCcw size={12} className="text-purple-600" />} onClick={() => setHandoverTestId(row.id)}>
                      Hand Over
                    </Button>
                  )}
                  {s === 'UNASSIGNED' && (
                    <Button size="small" danger onClick={() => removeTest.mutate(row.id)}>Remove</Button>
                  )}
                </Space>
              )
            },
          },
        ]}
      />
      <Modal
        {...glassModalProps}
        title="Hand Over Test"
        open={!!handoverTestId}
        onCancel={() => { setHandoverTestId(null); setHandoverAnalystId(''); setHandoverRemarks('') }}
        onOk={() => handoverTest.mutate()}
        confirmLoading={handoverTest.isPending}
        okText="Hand Over"
        okButtonProps={{ disabled: !handoverAnalystId }}
      >
        <div className="space-y-3 mt-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Transfer To</p>
            <Select
              showSearch
              style={{ width: '100%' }}
              placeholder="Select analyst…"
              optionFilterProp="label"
              value={handoverAnalystId || undefined}
              onChange={(v) => setHandoverAnalystId(v ?? '')}
              options={analystOptions}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Remarks (optional)</p>
            <Input.TextArea
              rows={2}
              placeholder="Reason for handover…"
              value={handoverRemarks}
              onChange={(e) => setHandoverRemarks(e.target.value)}
            />
          </div>
        </div>
      </Modal>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Quick-Add by Test Group</p>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select test groups…"
            allowClear
            value={testGroupIds}
            onChange={(v) => { setTestGroupIds(v); if (v.length > 0) setTestConfigIds([]) }}
            options={(masterData?.testGroups ?? []).map((g: any) => ({ value: g.id, label: g.name }))}
          />
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Or pick individual test configs</p>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select test configurations…"
            value={testConfigIds}
            disabled={testGroupIds.length > 0}
            onChange={(v) => { setTestConfigIds(v); if (v.length > 0) setTestGroupIds([]) }}
            options={(masterData?.testConfigs ?? []).filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.code ?? c.techniqueName} — ${c.testType}` }))}
          />
        </div>
      </div>
      <Button className="mt-2" type="primary" disabled={!testConfigIds.length && !testGroupIds.length} loading={addTests.isPending} onClick={() => addTests.mutate()}>
        Add
      </Button>
    </Modal>
  )
}

function ManageChemicalsModal({ sample, onSave, onClose, readOnly }: { sample: AtrSample; onSave: (chems: any[]) => void; onClose: () => void; readOnly: boolean }) {
  const [chems, setChems] = useState<any[]>(sample.chemicals || [])
  
  const materialsQuery = useQuery({
    queryKey: ['inv-materials-lookup'],
    queryFn: () => inventoryApi.materials.listPaged({ pageSize: 250 }),
  })

  const batchesQuery = useQuery({
    queryKey: ['inv-batches-lookup'],
    queryFn: () => inventoryApi.batches.list({ pageSize: 250 }),
  })

  const materials = materialsQuery.data?.items || []
  const batches = batchesQuery.data || []

  const addChem = () => setChems([...chems, { name: '', materialId: '', batchId: '', lotNo: '', quantity: '', expiryDate: null, vendor: '', specification: '', uom: '', remarks: '', materialType: '', qtyAvailable: '' }])
  const updateChem = (i: number, patch: any) => {
    const next = chems.slice()
    next[i] = { ...next[i], ...patch }
    setChems(next)
  }
  const removeChem = (i: number) => setChems(chems.filter((_, idx) => idx !== i))

  const handleSelectMaterial = (i: number, matId: string) => {
    const mat = materials.find((m: any) => String(m.id) === String(matId))
    if (mat) {
      updateChem(i, {
        materialId: String(mat.id),
        name: mat.name,
        specification: mat.code || '',
        materialType: mat.material_type || '',
      })
    }
  }

  const handleSelectBatch = (i: number, bId: number) => {
    const b = batches.find((item: any) => item.id === bId)
    if (b) {
      updateChem(i, {
        batchId: String(b.id),
        lotNo: b.batch_no || '',
        name: b.material_name || chems[i]?.name || '',
        uom: b.unit || chems[i]?.uom || '',
        vendor: b.manufacturer_name || chems[i]?.vendor || '',
        expiryDate: b.expiry_date || (b as any).exp_date || chems[i]?.expiryDate || null,
        materialId: b.material_id ? String(b.material_id) : chems[i]?.materialId || '',
        qtyAvailable: b.qty_available != null ? String(b.qty_available) : '',
      })
    }
  }

  return (
    <Modal {...glassModalProps} title={`Chemicals & Lot Details — ${sample.sampleCode || 'Sample'}`} open onCancel={onClose}
      onOk={() => { onSave(chems); onClose() }} okText={readOnly ? 'Close' : 'Save Details'} width={1150}>
      <Table
        rowKey={(_, i) => String(i)}
        dataSource={chems}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        scroll={{ x: 1100 }}
        footer={() => !readOnly && <Button size="small" icon={<Plus size={14} />} onClick={addChem}>Add Chemical Lot</Button>}
        columns={[
          {
            title: 'Chemical / Material Name',
            dataIndex: 'name',
            width: 220,
            render: (v, row, i) => readOnly ? (v || '—') : (
              <Select
                showSearch
                size="small"
                className="w-full"
                placeholder="Search Inventory Materials..."
                value={row.materialId ? String(row.materialId) : undefined}
                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                options={materials.map((m: any) => ({
                  value: String(m.id),
                  label: `${m.code} — ${m.name}${m.cas_no ? ` (${m.cas_no})` : ''}`,
                }))}
                onChange={(val) => handleSelectMaterial(i, val)}
              />
            ),
          },
          {
            title: 'Inventory Stock Batch',
            dataIndex: 'batchId',
            width: 200,
            render: (v, row, i) => readOnly ? (v || '—') : (
              <Select
                showSearch
                size="small"
                className="w-full"
                placeholder="Select Stock Batch..."
                value={v ? Number(v) : undefined}
                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                options={batches.map(b => ({
                  value: b.id,
                  label: `Batch #${b.batch_no} — ${b.material_name || 'Material'} (${b.qty_available} ${b.unit})`,
                }))}
                onChange={(val) => handleSelectBatch(i, val)}
              />
            ),
          },
          {
            title: 'Material Type', dataIndex: 'materialType', width: 120,
            render: (v) => v ? <Tag className="text-xs">{v}</Tag> : <span className="text-slate-400 text-xs">—</span>,
          },
          {
            title: 'Qty Available', dataIndex: 'qtyAvailable', width: 110,
            render: (v, row) => v ? (
              <span className="font-mono text-xs font-semibold text-violet-700">{v} {row.uom || ''}</span>
            ) : <span className="text-slate-400 text-xs">—</span>,
          },
          { title: 'Lot Number', dataIndex: 'lotNo', width: 110, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { lotNo: e.target.value })} placeholder="Lot No" /> },
          { title: 'Qty Used', dataIndex: 'quantity', width: 80, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { quantity: e.target.value })} placeholder="Qty" /> },
          { title: 'UOM', dataIndex: 'uom', width: 80, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { uom: e.target.value })} placeholder="UOM" /> },
          {
            title: 'Expiry Date', dataIndex: 'expiryDate', width: 120,
            render: (v, _, i) => readOnly
              ? <span>{v || '—'}</span>
              : <DatePicker size="small" value={v ? dayjs(v) : null} format="YYYY-MM-DD"
                  onChange={(date) => updateChem(i, { expiryDate: date?.format('YYYY-MM-DD') ?? null })}
                  style={{ width: '100%' }} placeholder="Expiry" />,
          },
          { title: 'Vendor / Mfr', dataIndex: 'vendor', width: 120, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { vendor: e.target.value })} placeholder="Vendor" /> },
          { title: 'Specification', dataIndex: 'specification', width: 120, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { specification: e.target.value })} placeholder="Spec ref" /> },
          { title: 'Remarks', dataIndex: 'remarks', width: 120, render: (v, _, i) => readOnly ? (v || '—') : <Input size="small" value={v} onChange={(e) => updateChem(i, { remarks: e.target.value })} placeholder="Remarks" /> },
          ...(readOnly ? [] : [{ title: '', width: 70, render: (_: any, __: any, i: number) => <Button size="small" danger onClick={() => removeChem(i)}>Remove</Button> }]),
        ]}
      />
    </Modal>
  )
}

function SamplesEditor({ atrId, samples, onChange, readOnly, uomOptions, sampleIntegrityOptions = [], isQaUser, atrStatus }: {
  atrId: string
  samples: AtrSample[]
  onChange: (s: AtrSample[]) => void
  readOnly: boolean
  uomOptions: { value: string; label: string }[]
  sampleIntegrityOptions?: { value: string; label: string }[]
  isQaUser: boolean
  atrStatus: string
}) {
  const qc = useQueryClient()
  const [manageTests, setManageTests] = useState<AtrSample | null>(null)
  const [manageChems, setManageChems] = useState<{ sample: AtrSample; index: number } | null>(null)
  const [msgApi, contextHolder] = message.useMessage()
  const { data: masterData } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  // Mirrors the same lookup category used for the equivalent Sample Type
  // field in the CGT/ADC "Raise ATR Request" panel (AtrRequestField.tsx) —
  // configured under ARD's Configuration → Lookups, not Test Configurations.
  const sampleTypeOptions = (masterData?.lookups ?? [])
    .filter((l: any) => l.category === 'Sample Type' && l.active !== false)
    .map((l: any) => ({ value: l.code, label: l.label }))

  const patchSample = useMutation({
    mutationFn: ({ sampleId, body }: { sampleId: string; body: { internalSampleNo?: string | null; productName?: string | null } }) =>
      ardAtrApi.patchSample(atrId, sampleId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ard-atr', atrId] }),
    onError: () => msgApi.error('Failed to save QA field.'),
  })

  const qaEditable = isQaUser && atrStatus !== 'DRAFT'

  const update = (i: number, patch: Partial<AtrSample>) => {
    const next = samples.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const add = () => onChange([...samples, {
    id: `new-${Date.now()}`, sampleCode: '', sampleType: null, quantity: null, uom: null, packType: null,
    storageCondition: null, batchNo: null, mfgDate: null, expDate: null, sampleDescription: null, status: 'ACTIVE',
    chemicals: [], manufacturedBy: null, receivedBy: null, preparedBy: null, sampledBy: null, receivedOn: null,
    preparedOn: null, sampledOn: null, totalContainers: null, sampledContainers: null, sampleContent: null,
    sampleIntegrity: null, additionalRemarks: null, internalSampleNo: null, productName: null, tests: [],
  }])
  const remove = (i: number) => onChange(samples.filter((_, idx) => idx !== i))

  return (
    <>
      {contextHolder}
      <Table
        rowKey="id"
        dataSource={samples}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        footer={() => !readOnly && <Button size="small" onClick={add}>Add sample</Button>}
        expandable={{
          expandedRowRender: (row) => {
            const rowTests = row.tests ?? []
            if (!rowTests.length) {
              return <p className="text-xs text-slate-400 italic py-2 px-3">No tests added yet — use the Tests column to add some.</p>
            }
            return (
              <Table
                rowKey="id"
                dataSource={rowTests}
                size="small"
                pagination={false}
                bordered
                className="bg-white rounded overflow-hidden"
                expandable={{
                  expandedRowRender: (test: any) => {
                    const config = (masterData?.testConfigs ?? []).find(
                      (c: any) => c.id === test.testConfigId || (c.testType === test.testType && c.techniqueCode === test.techniqueCode)
                    )
                    // `test.results` (backend `ard_test_requests.results`, snake_case
                    // keys: param_name/data_type/lower_limit/upper_limit/value) holds
                    // the ACTUAL submitted/verified values — it must win over the
                    // test config's static `resultParams` definitions, which never
                    // carry a real entered value. Only fall back to the config's
                    // definitions when no results have been submitted yet at all.
                    const params = (test.results && test.results.length ? test.results : config?.resultParams) ?? []
                    if (!params || params.length === 0) {
                      return <p className="text-xs text-slate-400 italic py-1 px-3">No test parameters configured.</p>
                    }
                    return (
                      <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 my-1">
                        <p className="font-semibold text-slate-600 uppercase text-[10px] tracking-wider mb-2">
                          Test Parameters ({params.length})
                        </p>
                        <Table
                          rowKey={(p: any, i) => (p && typeof p === 'object' && p.id ? p.id : String(i))}
                          dataSource={params}
                          size="small"
                          pagination={false}
                          bordered
                          className="bg-white rounded overflow-hidden"
                          columns={[
                            {
                              title: 'Parameter Name',
                              dataIndex: 'name',
                              render: (v, p: any, i) => (
                                <span className="font-medium text-slate-800 text-xs">
                                  {v || p.parameterName || p.parameter || p.param_name || `Param ${i + 1}`}
                                </span>
                              ),
                            },
                            {
                              title: 'Data Type', dataIndex: 'dataType', width: 110,
                              render: (v, p: any) => {
                                const dt = v || p.data_type
                                return dt ? <Tag color="blue" className="text-[11px] font-mono uppercase">{dt}</Tag> : <span className="text-slate-400 text-xs">—</span>
                              },
                            },
                            {
                              title: 'UOM', dataIndex: 'uom', width: 90,
                              render: (v) => v ? <span className="font-mono text-xs font-semibold text-slate-700">{v}</span> : <span className="text-slate-400 text-xs">—</span>,
                            },
                            {
                              title: 'Specification Limits', key: 'limits',
                              render: (_, p: any) => {
                                const lo = p.lowerLimit ?? p.lower_limit
                                const hi = p.upperLimit ?? p.upper_limit
                                return (lo == null || lo === '') && (hi == null || hi === '') ? <span className="text-slate-400 text-xs">—</span> : (
                                  <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                                    {lo || '—'} to {hi || '—'}
                                  </span>
                                )
                              },
                            },
                            {
                              title: 'Result Value', key: 'value',
                              render: (_, p: any) => {
                                const raw = p.value ?? p.resultValue
                                // Rich-text-captured values (e.g. from a RICH_TEXT
                                // parameter input) come back HTML-wrapped
                                // ("<p>Complies</p>") — strip tags for plain display.
                                const val = typeof raw === 'string' ? raw.replace(/<[^>]+>/g, '').trim() : raw
                                return (val === undefined || val === null || val === '') ? <span className="text-slate-400 text-xs">—</span> : (
                                  <span className="font-semibold text-xs text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100">
                                    {String(val)}
                                  </span>
                                )
                              },
                            },
                          ]}
                        />
                      </div>
                    )
                  },
                  rowExpandable: () => true,
                }}
                columns={[
                  { title: 'Test Type', dataIndex: 'testType' },
                  { title: 'Technique', dataIndex: 'techniqueCode' },
                  { title: 'AR Number', dataIndex: 'arNumber', render: (v: string) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-slate-400 text-xs">—</span> },
                  {
                    title: 'Status', dataIndex: 'status',
                    render: (v: string) => { const s = normalizeTestStatus(v); return <Tag color={TEST_STATUS_COLOR[s] ?? 'default'} className="text-xs">{s.replace(/_/g, ' ')}</Tag> },
                  },
                  {
                    title: '', key: 'finalReport',
                    render: (_: any, t: any) => <TestFinalReportLink atrId={atrId} testId={t.id} status={normalizeTestStatus(t.status)} />,
                  },
                ]}
              />
            )
          },
          rowExpandable: (row) => !!(row.tests ?? []).length,
        }}
        columns={[
          {
            title: 'Sample Code', dataIndex: 'sampleCode', render: (v, row, i) => (
              <div className="flex items-center gap-1.5">
                {readOnly ? <span>{v}</span> : <Input size="small" value={v} onChange={(e) => update(i, { sampleCode: e.target.value })} />}
                {(row as any).hazardWarningFlag && (
                  <Tag color="red" className="text-[10px] px-1 font-bold animate-pulse">HAZARD</Tag>
                )}
              </div>
            )
          },
          {
            title: 'Type', dataIndex: 'sampleType',
            render: (v, _r, i) => readOnly
              ? (sampleTypeOptions.find(o => o.value === v)?.label ?? v)
              : (
                <Select
                  size="small" className="w-full" style={{ minWidth: 130 }}
                  value={v || undefined} placeholder="Select…" allowClear
                  showSearch optionFilterProp="label" options={sampleTypeOptions}
                  onChange={(val) => update(i, { sampleType: val ?? null })}
                />
              ),
          },
          { title: 'Batch No', dataIndex: 'batchNo', render: (v, _r, i) => readOnly ? v : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { batchNo: e.target.value })} /> },
          ...(qaEditable ? [
            {
              title: <Tooltip title="QA only — Internal Sample No."><span className="text-violet-600 font-semibold">Int. Sample No.</span></Tooltip>,
              dataIndex: 'internalSampleNo',
              render: (v: string | null, row: AtrSample) => row.id.startsWith('new-') ? (
                <span className="text-slate-400 text-xs">Save first</span>
              ) : (
                <Input
                  size="small"
                  defaultValue={v ?? ''}
                  placeholder="Internal no."
                  onBlur={(e) => {
                    const val = e.target.value.trim() || null
                    if (val !== (v ?? null)) patchSample.mutate({ sampleId: row.id, body: { internalSampleNo: val } })
                  }}
                />
              ),
            },
            {
              title: <Tooltip title="QA only — Product Name"><span className="text-violet-600 font-semibold">Product Name</span></Tooltip>,
              dataIndex: 'productName',
              render: (v: string | null, row: AtrSample) => row.id.startsWith('new-') ? (
                <span className="text-slate-400 text-xs">Save first</span>
              ) : (
                <Input
                  size="small"
                  defaultValue={v ?? ''}
                  placeholder="Product name"
                  onBlur={(e) => {
                    const val = e.target.value.trim() || null
                    if (val !== (v ?? null)) patchSample.mutate({ sampleId: row.id, body: { productName: val } })
                  }}
                />
              ),
            },
          ] : []),
          {
            title: <span className="text-red-500">Mfg Date *</span>, dataIndex: 'mfgDate', width: 130,
            render: (v, _r: any, i) => readOnly
              ? <span>{v || '—'}</span>
              : <DatePicker size="small" value={v ? dayjs(v) : null} format="YYYY-MM-DD"
                  onChange={(date) => {
                    const mfgStr = date?.format('YYYY-MM-DD') ?? null
                    if (_r.expDate && mfgStr && !dayjs(_r.expDate).isAfter(dayjs(mfgStr), 'day')) {
                      update(i, { mfgDate: mfgStr, expDate: null })
                    } else {
                      update(i, { mfgDate: mfgStr })
                    }
                  }}
                  style={{ width: '100%' }} placeholder="Mfg date" />,
          },
          {
            title: <span className="text-red-500">Exp Date *</span>, dataIndex: 'expDate', width: 130,
            render: (v, _r: any, i) => readOnly
              ? <span>{v || '—'}</span>
              : <DatePicker size="small" value={v ? dayjs(v) : null} format="YYYY-MM-DD"
                  disabledDate={(current) => {
                    if (!current) return false
                    const today = dayjs().startOf('day')
                    if (current.isBefore(today)) return true
                    if (_r.mfgDate) {
                      const mfg = dayjs(_r.mfgDate).startOf('day')
                      if (current.isBefore(mfg) || current.isSame(mfg, 'day')) return true
                    }
                    return false
                  }}
                  onChange={(date) => update(i, { expDate: date?.format('YYYY-MM-DD') ?? null })}
                  style={{ width: '100%' }} placeholder="Exp date" />,
          },
          { title: 'Qty', dataIndex: 'quantity', render: (v, _r, i) => readOnly ? v : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { quantity: e.target.value })} /> },
          {
            title: 'UOM',
            dataIndex: 'uom',
            width: 110,
            render: (v, _r, i) =>
              readOnly ? (
                <span>{v || '—'}</span>
              ) : (
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={v ?? undefined}
                  onChange={(val) => update(i, { uom: val ?? null })}
                  options={uomOptions}
                  style={{ width: '100%' }}
                  placeholder="Select UOM"
                  filterOption={(input, opt) =>
                    (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              ),
          },
          {
            title: 'Hazardous', dataIndex: 'hazardWarningFlag', render: (v, _r, i) => (
              <Switch size="small" checked={!!v} disabled={readOnly} onChange={(checked) => update(i, { hazardWarningFlag: checked } as any)} />
            )
          },
          {
            title: 'Chemical Lots', dataIndex: 'chemicals', render: (chems: any[], row, i) => (
              <Button size="small" onClick={() => setManageChems({ sample: row, index: i })}>
                {(chems || []).length} Lot(s)
              </Button>
            )
          },
          {
            title: 'Tests', dataIndex: 'tests', render: (tests: AtrSample['tests'], row) => (
              !row.id.startsWith('new-') ? (
                <Button size="small" onClick={() => setManageTests(row)}>{tests.length} test(s)</Button>
              ) : <span className="text-slate-400 text-xs">Save sample first</span>
            )
          },
          ...(readOnly ? [] : [{ title: '', render: (_: any, _r: any, i: number) => <Button size="small" danger onClick={() => remove(i)}>Remove</Button> }]),
        ]}
      />
      {manageTests && <ManageTestsModal atrId={atrId} sample={manageTests} onClose={() => setManageTests(null)} />}
      {manageChems && (
        <ManageChemicalsModal
          sample={manageChems.sample}
          readOnly={readOnly}
          onClose={() => setManageChems(null)}
          onSave={(chems) => {
            const totalQty = chems.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0)
            const hasQty = chems.some(c => c.quantity != null && c.quantity !== '')
            update(manageChems.index, {
              chemicals: chems,
              ...(hasQty ? { quantity: String(totalQty) } : {}),
            })
          }}
        />
      )}
    </>
  )
}

interface RawDataAttachment {
  id: string
  name: string
  description: string | null
  filename: string
  fileType: string | null
  attachmentLink: string
  uploadedBy: string
  createdAt: string
}

const RAW_DATA_FILE_TYPES = [
  { value: 'Chromatography Data', label: 'Chromatography Data' },
  { value: 'Spectroscopy Data', label: 'Spectroscopy Data' },
  { value: 'Mass Spec Data', label: 'Mass Spec Data' },
  { value: 'Other', label: 'Other' },
]

function RawDataTab({ atrId, editable }: { atrId: string; editable: boolean }) {
  const qc = useQueryClient()
  const [msgApi, msgCtx] = message.useMessage()
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [editModal, setEditModal] = useState<RawDataAttachment | null>(null)
  const [linkForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['atr-raw-data', atrId],
    queryFn: () =>
      apiGet<{ items: RawDataAttachment[] }>('/api/ard/uploads/attachments', {
        entity_type: 'atr_raw_data',
        entity_id: atrId,
      }),
    select: (res) => res.items ?? [],
  })

  const items = data ?? []

  const linkMutation = useMutation({
    mutationFn: (vals: { name: string; description?: string; attachmentLink: string; fileType?: string }) =>
      apiPost<RawDataAttachment>('/api/ard/uploads/attachments', {
        entityType: 'atr_raw_data',
        entityId: atrId,
        name: vals.name,
        description: vals.description ?? '',
        filename: vals.name,
        fileType: vals.fileType ?? null,
        attachmentLink: vals.attachmentLink,
      }),
    onSuccess: () => {
      msgApi.success('Raw data link added.')
      qc.invalidateQueries({ queryKey: ['atr-raw-data', atrId] })
      setLinkModalOpen(false)
      linkForm.resetFields()
    },
    onError: (e: any) => msgApi.error(e?.message ?? 'Failed to add link.'),
  })

  const editMutation = useMutation({
    mutationFn: (vals: { id: string; name: string; description?: string }) =>
      apiPatch<RawDataAttachment>(`/api/ard/uploads/attachments/${vals.id}`, {
        name: vals.name,
        description: vals.description ?? '',
      }),
    onSuccess: () => {
      msgApi.success('Raw data link updated.')
      qc.invalidateQueries({ queryKey: ['atr-raw-data', atrId] })
      setEditModal(null)
      editForm.resetFields()
    },
    onError: (e: any) => msgApi.error(e?.message ?? 'Failed to update link.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/ard/uploads/attachments/${id}`),
    onSuccess: () => {
      msgApi.success('Raw data link removed.')
      qc.invalidateQueries({ queryKey: ['atr-raw-data', atrId] })
    },
    onError: (e: any) => msgApi.error(e?.message ?? 'Failed to remove link.'),
  })

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v: string, r: RawDataAttachment) =>
        r.attachmentLink ? (
          <a href={r.attachmentLink} target="_blank" rel="noreferrer" className="text-indigo-600 underline flex items-center gap-1">
            <Link2 size={12} />
            {v}
          </a>
        ) : (
          <span>{v}</span>
        ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v: string | null) => v || <span className="text-slate-400">—</span>,
    },
    {
      title: 'File Type',
      dataIndex: 'fileType',
      width: 160,
      render: (v: string | null) => v ? <Tag className="text-xs">{v}</Tag> : <span className="text-slate-400">—</span>,
    },
    {
      title: 'Link / Path',
      dataIndex: 'attachmentLink',
      width: 220,
      render: (v: string) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 underline truncate block max-w-[200px]" title={v}>
            {v}
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      width: 140,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: string) => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—',
    },
    ...(editable
      ? [
          {
            title: '',
            width: 80,
            render: (_: unknown, r: RawDataAttachment) => (
              <Space size={4}>
                <Button
                  size="small"
                  icon={<Edit3 size={13} />}
                  onClick={() => {
                    setEditModal(r)
                    editForm.setFieldsValue({ name: r.name, description: r.description ?? '' })
                  }}
                />
                <Popconfirm
                  title="Remove this raw data link?"
                  onConfirm={() => deleteMutation.mutate(r.id)}
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<Trash2 size={13} />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      {msgCtx}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Raw Data Links ({items.length})
          </p>
          {editable && (
            <Button
              size="small"
              icon={<Link2 size={13} />}
              onClick={() => {
                linkForm.resetFields()
                setLinkModalOpen(true)
              }}
            >
              Link Attachment
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Spin /></div>
        ) : items.length === 0 ? (
          <Empty description="No raw data links attached." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={items}
            columns={columns}
          />
        )}
      </div>

      <Modal
        title="Link Raw Data Attachment"
        open={linkModalOpen}
        onCancel={() => { setLinkModalOpen(false); linkForm.resetFields() }}
        onOk={() => linkForm.submit()}
        okText="Link"
        confirmLoading={linkMutation.isPending}
        {...glassModalProps}
      >
        <Form
          form={linkForm}
          layout="vertical"
          onFinish={(vals) => linkMutation.mutate(vals)}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required.' }]}>
            <Input placeholder="e.g. HPLC Run 1 - Sample A" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Brief description of the raw data file." />
          </Form.Item>
          <Form.Item
            name="attachmentLink"
            label="URL / Path"
            rules={[{ required: true, message: 'A URL or file path is required.' }]}
          >
            <Input placeholder="https://... or \\server\share\file.cdf" />
          </Form.Item>
          <Form.Item name="fileType" label="File Type">
            <Select placeholder="Select file type" allowClear options={RAW_DATA_FILE_TYPES} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Edit Raw Data Link"
        open={editModal !== null}
        onCancel={() => { setEditModal(null); editForm.resetFields() }}
        onOk={() => editForm.submit()}
        okText="Save"
        confirmLoading={editMutation.isPending}
        {...glassModalProps}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(vals) => {
            if (!editModal) return
            editMutation.mutate({ id: editModal.id, ...vals })
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required.' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ArdAtrWorkspacePage() {
  const { atrId } = useParams()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()
  const { tagColor: healthTagColor } = useHealthIndicator()
  const [msg, ctx] = message.useMessage()
  const [viewMode, setViewMode] = useState<'tabbed' | 'single'>('tabbed')
  const [samplesDraft, setSamplesDraft] = useState<AtrSample[] | null>(null)
  const [transitionModal, setTransitionModal] = useState<AtrStatus | null>(null)
  const [password, setPassword] = useState('')
  const [clarifyMsg, setClarifyMsg] = useState('')
  const [certifyEsignOpen, setCertifyEsignOpen] = useState(false)
  const [tlModalOpen, setTlModalOpen] = useState(false)
  const [selectedTl, setSelectedTl] = useState('')
  const [selectedQa, setSelectedQa] = useState('')
  const [pendingTargetStatus, setPendingTargetStatus] = useState<AtrStatus | null>(null)
  const [externalSubmitOpen, setExternalSubmitOpen] = useState(false)
  const [externalSubmitTl, setExternalSubmitTl] = useState('')
  const [externalSubmitPassword, setExternalSubmitPassword] = useState('')
  const [externalSubmitLoading, setExternalSubmitLoading] = useState(false)
  
  // Mandatory Remarks Modal State for Workflow Transitions
  const [remarksModalOpen, setRemarksModalOpen] = useState(false)
  const [remarksModalTargetStatus, setRemarksModalTargetStatus] = useState<AtrStatus | null>(null)
  const [remarksInput, setRemarksInput] = useState('')
  // G-1: QA Approve Remarks (optional, shown when approving)
  const [qaApproveRemarksInput, setQaApproveRemarksInput] = useState('')

  // Certification Rework state
  const [certReworkOpen, setCertReworkOpen] = useState(false)
  const [certReworkRemarks, setCertReworkRemarks] = useState('')

  // Reassign Team Lead state
  const [reassignTlOpen, setReassignTlOpen] = useState(false)
  const [reassignTlId, setReassignTlId] = useState<string | undefined>(undefined)
  const [reassignTlRemarks, setReassignTlRemarks] = useState('')

  // Reassign QA Reviewer state (GAP-025)
  const [reassignQaOpen, setReassignQaOpen] = useState(false)
  const [reassignQaUserId, setReassignQaUserId] = useState<string | undefined>(undefined)

  // Change Owner state
  const [changeOwnerOpen, setChangeOwnerOpen] = useState(false)
  const [changeOwnerUserId, setChangeOwnerUserId] = useState<string | undefined>(undefined)
  const [changeOwnerRemarks, setChangeOwnerRemarks] = useState('')

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'basic')

  const { data: settingsMap } = useQuery({ queryKey: ['ard-settings-map'], queryFn: ardApi.settingsMap })
  const { data: atr, isLoading } = useQuery({ queryKey: ['ard-atr', atrId], queryFn: () => ardAtrApi.get(atrId!), enabled: !!atrId })
  const { data: masterData } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  const { data: auditLogData } = useQuery({
    queryKey: ['ard-atr-audit', atrId],
    queryFn: () => apiGet<{ items: Array<{ id: string; action: string; detail: string | null; actorName: string | null; createdAt: string }> }>(`/api/ard/atrs/${atrId}/audit-log`),
    enabled: !!atrId && activeTab === 'history',
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      setActiveTab(tabParam)
    } else if (atr && ['PARTIAL', 'IN_PROGRESS', 'UNDER_TESTING'].includes(atr.status)) {
      setActiveTab('samples')
    }
  }, [searchParams, atr?.status])
  const { data: tlUsers } = useQuery({ queryKey: ['ard-tl-users'], queryFn: () => userApi.list({ role_code: 'TL', limit: 100 }) })
  const { data: allUsersData } = useQuery({ queryKey: ['ard-all-users'], queryFn: () => userApi.list({ limit: 100 }) })
  const { data: teamDirectoryData } = useQuery({ queryKey: ['ard-team-directory'], queryFn: ardTeamApi.teamDirectory })

  const tlIdOptions = useMemo(() => {
    const rawTeams = (teamDirectoryData?.items ?? []).filter((t: any) => t.active !== false)
    if (rawTeams.length > 0) {
      // Filter teams for regular lab users (Analyst / TL) to their logged-in team
      const isGlobalView = !user || ['HOD', 'SUPER_ADMIN', 'ADMIN'].includes(user.role_code) || user.department_code === 'QA'
      const matchedTeams = isGlobalView
        ? rawTeams
        : rawTeams.filter((t: any) => {
            const isHod = t.hodId === user.id || t.hodName === user.username
            const isTl = (t.tlIds || []).includes(user.id) || (t.tlNames || []).includes(user.username) || (t.tls || []).some((tl: any) => tl.id === user.id || tl.name === user.username)
            const isMember = (t.memberIds || []).includes(user.id) || (t.tls || []).some((tl: any) => (tl.analysts || []).some((a: any) => a.id === user.id || a.name === user.username))
            return isHod || isTl || isMember
          })

      const teamsToUse = matchedTeams.length > 0 ? matchedTeams : rawTeams
      const seenIds = new Set<string>()

      const groups = teamsToUse.map((t: any) => {
        const members: { value: string; label: string }[] = []
        const tlsList = t.tls || []
        const mainTl = tlsList[0]
        if (mainTl && mainTl.id && !seenIds.has(mainTl.id)) {
          seenIds.add(mainTl.id)
          members.push({
            value: mainTl.id,
            label: `${mainTl.name || mainTl.id} (${t.teamName} — Main TL)`,
          })
        }
        return {
          label: `Team: ${t.teamName}`,
          options: members,
        }
      }).filter((g: any) => g.options.length > 0)

      if (groups.length > 0) return groups
    }

    const seenFallback = new Set<string>()
    return [{
      label: 'Team Leads',
      options: (tlUsers?.items ?? [])
        .filter((u) => u.role_code === 'TL')
        .filter((u) => {
          if (seenFallback.has(u.id)) return false
          seenFallback.add(u.id)
          return true
        })
        .map((u) => ({
          value: u.id,
          label: `${u.username} (Team Lead)`,
        }))
    }]
  }, [teamDirectoryData, tlUsers, user])

  const qaIdOptions = useMemo(() => {
    const items = allUsersData?.items ?? []
    // Strictly filter users who belong to the QA department or hold the QA role
    const qaItems = items.filter((u) => u.department_code === 'QA' || u.role_code === 'QA')
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    qaItems.forEach((u) => {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        opts.push({
          value: u.id,
          label: `${u.username} (${u.role_code || 'QA'})`,
        })
      }
    })
    return opts
  }, [allUsersData])

  useEffect(() => {
    if (tlModalOpen) {
      if (!selectedTl && tlIdOptions.length > 0) {
        const firstTl = tlIdOptions[0]?.options?.[0]?.value || (tlIdOptions[0] as any)?.value || ''
        if (firstTl) setSelectedTl(firstTl)
      }
      if (!selectedQa && qaIdOptions.length > 0) {
        const firstQa = qaIdOptions[0]?.value || ''
        if (firstQa) setSelectedQa(firstQa)
      }
    }
  }, [tlModalOpen, tlIdOptions, qaIdOptions, selectedTl, selectedQa])

  // UOM options derived from the canonical ARD 'UOM' lookup category
  const uomOptions = useMemo(() => {
    const lookups = masterData?.lookups ?? []
    const uomLookups = lookups.filter((l) => l.category === 'UOM' && l.active)
    if (uomLookups.length > 0) {
      return uomLookups.map((l) => ({ value: l.code, label: l.label || l.code }))
    }
    // Fallback to common pharmaceutical units if no lookup data yet
    return [
      'mg', 'g', 'kg', 'mL', 'L', '\u03bcL', 'mmol', 'mol', '%', 'ppm', 'ppb', 'IU', 'NMT', 'NLT',
    ].map((u) => ({ value: u, label: u }))
  }, [masterData?.lookups])

  // B-70: Sample Integrity options from lookup category (admin-configurable)
  const sampleIntegrityOptions = useMemo(() => {
    const lookups = masterData?.lookups ?? []
    const si = lookups.filter((l: any) => l.category === 'SampleIntegrity' && l.active !== false)
    if (si.length > 0) return si.map((l: any) => ({ value: l.label || l.code, label: l.label || l.code }))
    return ['Intact', 'Partially damaged', 'Damaged', 'Seal broken', 'Acceptable'].map(v => ({ value: v, label: v }))
  }, [masterData?.lookups])

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['ard-atr', atrId] }); qc.invalidateQueries({ queryKey: ['ard-atrs'] }) }

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => ardAtrApi.save(atrId!, body),
    onSuccess: () => { invalidate(); msg.success('Saved.'); setSamplesDraft(null) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save.'),
  })

  const transition = useMutation({
    mutationFn: (body: Record<string, unknown>) => ardAtrApi.transition(atrId!, body),
    onSuccess: () => { invalidate(); msg.success('Status updated.'); setTransitionModal(null); setPassword(''); setRemarksModalOpen(false); setRemarksInput(''); setQaApproveRemarksInput('') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Transition failed.'),
  })

  const requestCert = useMutation({
    mutationFn: (remarks?: string) => ardAtrApi.requestCertification(atrId!, { remarks }),
    onSuccess: () => { invalidate(); msg.success('Certification requested.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to request certification.'),
  })

  const certifyMut = useMutation({
    mutationFn: (payload: { certificationRemarks?: string; password?: string }) => ardAtrApi.certify(atrId!, payload),
    onSuccess: () => { invalidate(); msg.success('ATR certified with electronic signature!'); setCertifyEsignOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to certify ATR.'),
  })

  const certReworkMut = useMutation({
    mutationFn: (remarks?: string) => ardAtrApi.certificationRework(atrId!, { remarks }),
    onSuccess: () => { invalidate(); msg.success('Returned for certification rework.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to return for rework.'),
  })

  const addClarification = useMutation({
    mutationFn: (body: Record<string, unknown>) => ardAtrApi.addClarification(atrId!, body),
    onSuccess: () => { invalidate(); setClarifyMsg(''); msg.success('Clarification posted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to add clarification.'),
  })

  const raiseEnhancementMut = useMutation({
    mutationFn: (remarks: string) => ardAtrApi.raiseEnhancement(atrId!, { remarks }),
    onSuccess: () => { invalidate(); msg.success('Post-certification enhancement request submitted.'); setRemarksModalOpen(false); setRemarksInput('') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to raise enhancement request.'),
  })

  const clone = useMutation({
    mutationFn: () => ardAtrApi.clone(atrId!, { createdBy: user?.username }),
    onSuccess: (newForm) => navigate(`/ard/atrs/${newForm.id}`),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to clone.'),
  })

  const remove = useMutation({
    mutationFn: () => ardAtrApi.remove(atrId!),
    onSuccess: () => navigate('/ard/atrs'),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to delete.'),
  })

  const assignTlMut = useMutation({
    mutationFn: ({ tlId, remarks }: { tlId: string; remarks: string }) =>
      ardAtrApi.assignTl(atrId!, { tlId, remarks }),
    onSuccess: () => {
      invalidate()
      msg.success('Team Lead reassigned successfully.')
      setReassignTlOpen(false)
      setReassignTlId(undefined)
      setReassignTlRemarks('')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to reassign Team Lead.'),
  })

  const reassignQaMut = useMutation({
    mutationFn: ({ qaUserId }: { qaUserId?: string }) =>
      ardAtrApi.reassignQa(atrId!, { qaUserId }),
    onSuccess: () => {
      invalidate()
      msg.success('QA reviewer updated.')
      setReassignQaOpen(false)
      setReassignQaUserId(undefined)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update QA reviewer.'),
  })

  const changeOwnerMut = useMutation({
    mutationFn: ({ newOwnerId, remarks }: { newOwnerId: string; remarks: string }) =>
      ardAtrApi.changeOwner(atrId!, { newOwnerId, remarks }),
    onSuccess: () => {
      invalidate()
      msg.success('ATR owner updated.')
      setChangeOwnerOpen(false)
      setChangeOwnerUserId(undefined)
      setChangeOwnerRemarks('')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to change owner.'),
  })

  // Supporting docs mutations
  const addSupportingDoc = useMutation({
    mutationFn: (body: { name: string; type?: string; description?: string; url?: string }) =>
      ardAtrApi.addSupportingDoc(atrId!, body),
    onSuccess: (res) => { invalidate(); msg.success((res as any).message || 'Document attached.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to attach document.'),
  })
  const removeSupportingDoc = useMutation({
    mutationFn: (docId: string) => ardAtrApi.removeSupportingDoc(atrId!, docId),
    onSuccess: (res) => { invalidate(); msg.success((res as any).message || 'Document removed.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to remove document.'),
  })

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Spin size="large" />
        <span className="mt-3 text-sm font-semibold text-slate-500">Loading ATR Details...</span>
      </div>
    )
  }

  if (!atr) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center min-h-[300px] m-6 rounded-lg">
        <Empty description="Analytical Test Request not found or access restricted." />
        <Button type="primary" onClick={() => navigate('/ard/atrs')} className="mt-4">
          Back to ATR Requests
        </Button>
      </div>
    )
  }

  const isExternalRequester = user?.department_code === 'ADC_PD' || user?.department_code === 'CGT'
  const canPrepareReceivedRequest = !isExternalRequester && ['REQUESTED', 'DEPT_TL_APPROVED'].includes(atr.status) && (
    ['HOD', 'SUPER_ADMIN'].includes(user?.role_code ?? '') || user?.department_code === 'QA' || atr.assignedTlId === user?.id
  )
  const editable = STRUCT_EDITABLE.includes(atr.status) || canPrepareReceivedRequest
  const selectedFormType = masterData?.formTypes?.find(ft => ft.id === atr.formTypeId)
  const mandatePreApproval = (settingsMap as any)?.qaMandateSubmission?.value === 'Y' || (settingsMap as any)?.qaMandateSubmission?.value === true
  const isQaMandated = atr?.mandateCertification || mandatePreApproval || !!selectedFormType?.mandateCertification || !!selectedFormType?.mandateQaSubmission
  const isQaUser = user?.department_code === 'QA' || user?.role_code === 'QA' || (user?.username || '').toLowerCase().includes('qa') || ['HOD', 'SUPER_ADMIN'].includes(user?.role_code || '')

  const isDeptTl = isExternalRequester && (user?.role_code === 'TL' || user?.role_code === 'TEAM_LEAD')

  const nextStates = (ATR_TRANSITIONS[atr.status] ?? []).filter((target) => {
    if (isExternalRequester) {
      // From VERIFIED: external requester can Accept or Request Enhancement
      if (atr.status === 'VERIFIED') {
        return ['ACCEPTED', 'ENHANCEMENT_REQUESTED'].includes(target)
      }
      // ADC/CGT users submit directly to NEW (same as ARD internal flow)
      return ['SAVED', 'NEW', 'WITHDRAWN'].includes(target)
    }
    // Non-external: hide REQUESTED, DEPT_TL_APPROVED, ACCEPTED (those are external-dept transitions)
    if (target === 'REQUESTED') return false
    if (target === 'DEPT_TL_APPROVED') return false
    if (target === 'ACCEPTED') return false
    // ENHANCEMENT_REQUESTED from VERIFIED is for external requesters only
    if (atr.status === 'VERIFIED' && target === 'ENHANCEMENT_REQUESTED') return false

    if (['DRAFT', 'SAVED'].includes(atr.status)) {
      if (isQaMandated) {
        return target === 'QA_PRE_APPROVAL' || target === 'WITHDRAWN'
      } else {
        return target === 'NEW' || target === 'WITHDRAWN'
      }
    }

    if (atr.status === 'QA_PRE_APPROVAL') {
      if (isQaUser) {
        return target === 'NEW' || target === 'PRE_APPROVAL_REWORK' || target === 'WITHDRAWN'
      } else {
        return target === 'WITHDRAWN'
      }
    }

    if (atr.status === 'NEW' && target === 'QA_PRE_APPROVAL') {
      return false
    }

    return true
  })
  const canDelete = ['DRAFT', 'SAVED'].includes(atr.status)
  const canClone = !isExternalRequester && ['CERTIFIED', 'WITHDRAWN', 'REJECTED', 'PARTIAL', 'PENDING_APPROVAL', 'APPROVED', 'VERIFIED'].includes(atr.status)
  const samples = samplesDraft ?? atr.samples

  const openTransition = (to: AtrStatus) => {
    // External requester submitting to ARD — show TL selector + password auth
    if (isExternalRequester && (to === 'REQUESTED' || to === 'NEW')) {
      const hasSamples = samples && samples.length > 0
      const hasTests = hasSamples && samples.some((s) => s.tests && s.tests.length > 0)
      if (!hasSamples || !hasTests) {
        msg.warning('Please add at least one sample and test before submitting.')
        return
      }
      const defaultTl = tlIdOptions[0]?.options?.[0]?.value ?? (tlIdOptions[0] as any)?.value ?? ''
      setExternalSubmitTl(atr.assignedTlId || defaultTl)
      setExternalSubmitPassword('')
      setExternalSubmitOpen(true)
      return
    }

    // External requester requesting enhancement from VERIFIED — requires a reason
    if (isExternalRequester && to === 'ENHANCEMENT_REQUESTED' && atr.status === 'VERIFIED') {
      setRemarksModalTargetStatus(to)
      setRemarksInput('')
      setRemarksModalOpen(true)
      return
    }

    // Check if transition requires mandatory remarks / justification (e.g., REJECTED, WITHDRAWN, PRE_APPROVAL_REWORK, PENDING_CLARIFICATION)
    if (['REJECTED', 'WITHDRAWN', 'PRE_APPROVAL_REWORK', 'PENDING_CLARIFICATION'].includes(to)) {
      setRemarksModalTargetStatus(to)
      setRemarksInput('')
      setRemarksModalOpen(true)
      return
    }

    // Initial submission from DRAFT / SAVED / REJECTED / PRE_APPROVAL_REWORK
    if (['DRAFT', 'SAVED', 'REJECTED', 'PRE_APPROVAL_REWORK'].includes(atr.status) && ['NEW', 'QA_PRE_APPROVAL'].includes(to)) {
      const hasSamples = samples && samples.length > 0
      const hasTests = hasSamples && samples.some((s) => s.tests && s.tests.length > 0)
      if (!hasSamples || !hasTests) {
        msg.warning('Please add at least one sample and test to the request under the Samples tab before submitting.')
        return
      }
      if (selectedFormType?.mandateBatchNo) {
        const missing = samples.filter(s => !s.batchNo?.trim()).map(s => s.sampleCode || s.id)
        if (missing.length > 0) {
          msg.warning(`Batch number is required for all samples before submitting (missing on: ${missing.join(', ')}).`)
          return
        }
      }
      if (selectedFormType?.mandateSampleQty) {
        const missing = samples.filter(s => s.quantity == null || s.quantity === '').map(s => s.sampleCode || s.id)
        if (missing.length > 0) {
          msg.warning(`Sample quantity is required for all samples before submitting (missing on: ${missing.join(', ')}).`)
          return
        }
      }
      const target = isQaMandated ? 'QA_PRE_APPROVAL' : 'NEW'
      setPendingTargetStatus(target)
      const defaultTlVal = tlIdOptions[0]?.options?.[0]?.value ?? ''
      setSelectedTl(atr.assignedTlId || defaultTlVal)
      setSelectedQa(atr.qaReviewerId || (qaIdOptions[0]?.value ?? ''))
      setTlModalOpen(true)
      return
    }

    // Prompt to select TL if missing when transitioning to active status
    if (!isExternalRequester && !atr.assignedTlId && ['NEW', 'PENDING_APPROVAL'].includes(to)) {
      setPendingTargetStatus(to)
      const defaultTlVal = tlIdOptions[0]?.options?.[0]?.value ?? ''
      setSelectedTl(atr.assignedTlId || defaultTlVal)
      setSelectedQa(atr.qaReviewerId || (qaIdOptions[0]?.value ?? ''))
      setTlModalOpen(true)
      return
    }

    const flag = ESIGN_FLAGS[to]
    const requiresEsign = flag ? !!(settingsMap as any)?.[flag]?.value : false
    if (requiresEsign) { setTransitionModal(to); return }
    transition.mutate({ to })
  }

  const confirmExternalSubmit = async () => {
    if (!externalSubmitTl) { msg.error('Please select an ARD Team Lead.'); return }
    if (!externalSubmitPassword.trim()) { msg.error('Password is required to submit.'); return }
    setExternalSubmitLoading(true)
    try {
      const { authApi } = await import('../../api/auth')
      await authApi.verifyPassword(externalSubmitPassword)
    } catch {
      msg.error('Incorrect password — authentication failed.')
      setExternalSubmitLoading(false)
      return
    }
    try {
      await transition.mutateAsync({ to: 'NEW', assignedTlId: externalSubmitTl, password: externalSubmitPassword })
      setExternalSubmitOpen(false)
    } catch (err: any) {
      msg.error(err?.detail || err?.message || 'Failed to submit request.')
    } finally {
      setExternalSubmitLoading(false)
    }
  }

  const confirmSubmitWithTl = async () => {
    if (!pendingTargetStatus) return
    if (!selectedTl) {
      msg.error('Please select a Team Lead.')
      return
    }
    if (isQaMandated && !selectedQa) {
      msg.error('Please select a QA Reviewer.')
      return
    }
    try {
      await save.mutateAsync({ assignedTlId: selectedTl, qaReviewerId: selectedQa || undefined })
      setTlModalOpen(false)
      const to = pendingTargetStatus
      setPendingTargetStatus(null)
      const flag = ESIGN_FLAGS[to]
      const requiresEsign = flag ? !!(settingsMap as any)?.[flag]?.value : false
      if (requiresEsign) {
        setTransitionModal(to)
      } else {
        transition.mutate({ to })
      }
    } catch {
      msg.error('Failed to submit ATR with assignments.')
    }
  }

  const confirmTransitionWithRemarks = () => {
    if (!remarksModalTargetStatus) return
    if (!remarksInput.trim()) {
      msg.error('Mandatory business justification / remarks required for this status change.')
      return
    }
    const to = remarksModalTargetStatus
    if (to === ('ENHANCEMENT_REQUESTED' as any)) {
      raiseEnhancementMut.mutate(remarksInput)
      return
    }
    const flag = ESIGN_FLAGS[to]
    const requiresEsign = flag ? !!(settingsMap as any)?.[flag]?.value : false
    if (requiresEsign) {
      setRemarksModalOpen(false)
      setTransitionModal(to)
    } else {
      transition.mutate({ to, remarks: remarksInput })
    }
  }

  const confirmTransition = () => {
    if (!transitionModal) return
    const payload: Record<string, unknown> = { to: transitionModal, password, remarks: remarksInput }
    if (transitionModal === 'APPROVED' && qaApproveRemarksInput.trim()) {
      payload.qaApproveRemarks = qaApproveRemarksInput.trim()
    }
    transition.mutate(payload as any)
  }

  const openPdf = async (path: string, filename: string) => {
    try {
      const { blob } = await apiDownloadBlob(path)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      msg.error(`Failed to generate ${filename}.`)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-2 w-full">
      {ctx}
      
      {/* Action Header */}
      <div className="glass-card flex flex-wrap justify-between items-center mb-2 gap-3 p-3 rounded-lg">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              {atr.formNo} <Tag color={statusColor(atr.status)} className="px-2.5 py-0.5 font-semibold text-xs rounded-full border-none">{atr.status.replace(/_/g, ' ')}</Tag>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">{atr.productName || 'Product N/A'} · Project: {atr.projectCode || 'N/A'} · Report: {atr.formTypeName || 'Standard'}</p>
          </div>
        </div>

        <Space wrap>
          {/* Workflow Action Buttons */}
          {nextStates.map((s) => {
            let label = getActionLabel(s)
            if (atr.status === 'REQUESTED' && s === 'NEW') label = 'Receive into ARD Processing'
            if (atr.status === 'QA_PRE_APPROVAL' && s === 'NEW') label = 'Approve QA Pre-Approval'
            if (['DRAFT', 'SAVED'].includes(atr.status) && (s === 'NEW' || s === 'QA_PRE_APPROVAL')) label = 'Submit Request'
            if (s === 'ACCEPTED') label = 'Accept Results'
            if (s === 'ENHANCEMENT_REQUESTED' && atr.status === 'VERIFIED') label = 'Request Enhancement'

            const isDanger = s === 'WITHDRAWN' || s === 'REJECTED'
            const isAccept = s === 'ACCEPTED'
            const isEnhancement = s === 'ENHANCEMENT_REQUESTED' && atr.status === 'VERIFIED'
            return (
              <Button
                key={s}
                type={isDanger || isEnhancement ? 'default' : 'primary'}
                danger={isDanger}
                onClick={() => openTransition(s)}
                loading={transition.isPending}
                className={
                  isAccept ? 'bg-violet-600 hover:bg-violet-700 text-white border-none font-semibold' :
                  isEnhancement ? 'border-orange-400 text-orange-600 hover:bg-orange-50 font-semibold' :
                  isDanger ? '' : 'bg-indigo-600 hover:bg-indigo-700 font-semibold'
                }
              >
                {label}
              </Button>
            )
          })}

          {!isExternalRequester && ['APPROVED', 'VERIFIED'].includes(atr.status) && (
            <Button
              type="primary"
              icon={<Award size={14} />}
              onClick={() => requestCert.mutate(atr.certificationRemarks || '')}
              loading={requestCert.isPending}
              className="bg-indigo-700 hover:bg-indigo-800 font-semibold"
            >
              Request QA Certification
            </Button>
          )}
          {!isExternalRequester && atr.status === 'CERTIFICATION_REQUESTED' && (
            <Button
              type="primary"
              icon={<ShieldCheck size={14} />}
              onClick={() => setCertifyEsignOpen(true)}
              className="border-none text-white font-semibold"
            >
              Certify ATR (E-Signed)
            </Button>
          )}
          {!isExternalRequester && atr.status === 'CERTIFICATION_REQUESTED' && (
            <Button
              danger
              icon={<RotateCcw size={14} />}
              onClick={() => { setCertReworkRemarks(''); setCertReworkOpen(true) }}
              loading={certReworkMut.isPending}
            >
              Return for Certification Rework
            </Button>
          )}
          {!isExternalRequester && atr.status === 'CERTIFIED' && (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => {
                setRemarksModalTargetStatus('ENHANCEMENT_REQUESTED' as any)
                setRemarksInput('')
                setRemarksModalOpen(true)
              }}
              className="bg-amber-600 hover:bg-amber-700 border-none text-white font-medium"
            >
              Raise Post-Certification Enhancement
            </Button>
          )}

          {(() => {
            const postApproval = ['APPROVED', 'VERIFIED', 'CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK', 'CERTIFIED', 'ENHANCEMENT_REQUESTED'].includes(atr.status)
            const printItems = [
              { key: 'summary', label: 'Summary PDF Report' },
              { key: 'labels', label: 'Sample Labels PDF' },
              ...(postApproval ? [
                { key: 'coa', label: 'Certificate of Analysis (COA)' },
                { key: 'detailed', label: 'Detailed Analytical Report' },
              ] : []),
            ]
            return (
              <Dropdown menu={{
                items: printItems,
                onClick: ({ key }) => openPdf(`/api/ard/atrs/${atr.id}/documents/${key}.pdf`, `${atr.formNo}-${key}.pdf`),
              }}>
                <Button type="default" icon={<FileText size={14} className="text-indigo-600" />}>Print / Export</Button>
              </Dropdown>
            )
          })()}
          {canClone && <Button onClick={() => clone.mutate()} loading={clone.isPending}>Clone ATR</Button>}
          {canDelete && (
            <Popconfirm title="Delete this Analytical Test Request?" onConfirm={() => remove.mutate()}>
              <Button danger loading={remove.isPending}>Delete ATR</Button>
            </Popconfirm>
          )}
          {(['NEW', 'CLARIFIED', 'PARTIAL', 'QA_PRE_APPROVAL'] as AtrStatus[]).includes(atr.status) && (
            <Button
              icon={<RotateCcw size={14} className="text-amber-600" />}
              onClick={() => {
                setReassignTlId(undefined)
                setReassignTlRemarks('')
                setReassignTlOpen(true)
              }}
              className="border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 font-semibold"
            >
              Reassign Team Lead
            </Button>
          )}
          {(['HOD', 'SUPER_ADMIN'].includes(user?.role_code ?? '')) && (['QA_PRE_APPROVAL', 'PENDING_APPROVAL'] as AtrStatus[]).includes(atr.status) && (
            <Button
              icon={<RotateCcw size={14} className="text-violet-600" />}
              onClick={() => { setReassignQaUserId(undefined); setReassignQaOpen(true) }}
              className="border-violet-500 text-violet-700 bg-violet-50 hover:bg-violet-100 font-semibold"
            >
              Reassign QA
            </Button>
          )}
          {(['HOD', 'SUPER_ADMIN'].includes(user?.role_code ?? '')) && !(['WITHDRAWN', 'REJECTED', 'CERTIFIED'] as AtrStatus[]).includes(atr.status) && (
            <Button
              onClick={() => { setChangeOwnerUserId(undefined); setChangeOwnerRemarks(''); setChangeOwnerOpen(true) }}
              className="border-slate-400 text-slate-700"
            >
              Change Owner
            </Button>
          )}
        </Space>
      </div>

      {/* 2-Button View Mode Toggle: Tabbed View | Single Page View */}
      {(() => {
        const showClarificationTab = (atr.clarifications && atr.clarifications.length > 0) || ['PENDING_CLARIFICATION', 'PRE_APPROVAL_REWORK', 'CLARIFIED', 'REWORK'].includes(atr.status)
        const showPreApprovalTab = atr.status === 'QA_PRE_APPROVAL' || atr.status === 'PRE_APPROVAL_REWORK' || !!(atr as any).preapprovalNote

        const atrTabItems = [
          {
            key: 'basic', label: '1. Basic & Business Details', children: (
              <Card className="border-none p-0">
                <Form layout="vertical" disabled={!editable}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="Project Code *" className="font-semibold text-xs">
                        <Input defaultValue={atr.projectCode} onBlur={(e) => save.mutate({ projectCode: e.target.value })} placeholder="e.g. PRJ-2026-001" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Product Name *" className="font-semibold text-xs">
                        <Input defaultValue={atr.productName} onBlur={(e) => save.mutate({ productName: e.target.value })} placeholder="e.g. Paracetamol API" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="QC / AR Reference No." className="font-semibold text-xs">
                        <Input defaultValue={atr.qcRef ?? ''} onBlur={(e) => save.mutate({ qcRef: e.target.value })} placeholder="e.g. QC-REF-9921" />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Row gutter={16}>
                    {!isExternalRequester && (user?.role_code !== 'ANALYST' || !!(atr.associatedExpCodes || atr.referenceExperimentCode)) && (
                      <Col span={12}>
                        <Form.Item label="Reference Notebook Experiment" className="font-semibold text-xs">
                          <AtrExpReferencePicker
                            value={atr.associatedExpCodes || atr.referenceExperimentCode || ''}
                            readOnly={!editable}
                            onChange={(val) => save.mutate({ associatedExpCodes: val })}
                            onLink={(exp) => ardAtrApi.linkExperiment(atr.id, { experimentId: exp.id, experimentCode: exp.expCode })}
                          />
                        </Form.Item>
                      </Col>
                    )}
                    <Col span={!isExternalRequester && (user?.role_code !== 'ANALYST' || !!(atr.associatedExpCodes || atr.referenceExperimentCode)) ? 12 : 24}>
                      <Form.Item label="Mandate Certification" className="font-semibold text-xs">
                        <div className="flex items-center gap-3 pt-1">
                          <Switch checked={atr.mandateCertification} onChange={(v) => save.mutate({ mandateCertification: v })} />
                          <span className="text-xs text-slate-500">Require QA Sign-off prior to ATR closure</span>
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="ATR Type" className="font-semibold text-xs">
                        <Select
                          defaultValue={atr.formCategory ?? undefined}
                          allowClear
                          placeholder="Select ATR type..."
                          onChange={(v) => save.mutate({ formCategory: v ?? null })}
                          options={[
                            { value: 'ROUTINE', label: 'Routine Analysis' },
                            { value: 'METHOD_DEV', label: 'Method Development' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="Report Type" className="font-semibold text-xs">
                        <Select
                          defaultValue={atr.reportType ?? undefined}
                          allowClear
                          placeholder="Select report type..."
                          onChange={(v) => save.mutate({ reportType: v ?? null })}
                          options={['COA', 'Detailed Report', 'Summary Report'].map(v => ({ value: v, label: v }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Objectives" className="font-semibold text-xs">
                    <Input.TextArea rows={3} defaultValue={atr.objectives ?? ''}
                      onBlur={(e) => save.mutate({ objectives: e.target.value })}
                      placeholder="Describe the scientific purpose and objective of this ATR..." />
                  </Form.Item>

                  <Form.Item label="Form Remarks" className="font-semibold text-xs">
                    <Input.TextArea rows={2} defaultValue={(atr as any).requestRemarks ?? ''}
                      onBlur={(e) => save.mutate({ requestRemarks: e.target.value })}
                      placeholder="Optional remarks for this ATR form..." />
                  </Form.Item>

                  {/* Form Attributes (custom per form type) */}
                  {selectedFormType && (selectedFormType as any).attributes && Array.isArray((selectedFormType as any).attributes) && (selectedFormType as any).attributes.length > 0 && (
                    <div className="mt-2 mb-4 border border-indigo-100 rounded-lg p-3 bg-indigo-50/40">
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-2">Form Attributes</p>
                      <div className="grid grid-cols-3 gap-3">
                        {((selectedFormType as any).attributes as Array<{key: string; label: string; required?: boolean}>).map((attr) => (
                          <Form.Item key={attr.key} label={attr.label} className="mb-0 font-semibold text-xs">
                            <Input
                              size="small"
                              defaultValue={(atr.attributeValues as any)?.[attr.key] ?? ''}
                              onBlur={(e) => {
                                const updated = { ...((atr.attributeValues as any) ?? {}), [attr.key]: e.target.value }
                                save.mutate({ attributeValues: updated })
                              }}
                              placeholder={attr.label}
                            />
                          </Form.Item>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* System Generated Business Metadata (At bottom of Section 1) */}
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">Raised By</p>
                      <Input value={atr.raisedBy || 'N/A'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">Raised On</p>
                      <Input value={atr.raisedOn ? dayjs(atr.raisedOn).format('DD MMM YYYY, HH:mm') : '—'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">Source Dept</p>
                      <Input value={atr.sourceDept || 'AD'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                    </div>
                    {atr.originModule && atr.originModule !== 'ARD' && (
                      <>
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">Requesting Module</p>
                          <Input value={atr.originModule} disabled className="bg-slate-50 text-slate-700 font-medium" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">Source Project</p>
                          <Input value={[atr.originProjectCode, atr.originProjectName].filter(Boolean).join(' â€” ') || 'â€”'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">Source Notebook / Experiment</p>
                          <Input value={[atr.originNotebookCode, atr.originExperimentCode].filter(Boolean).join(' / ') || 'â€”'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                        </div>
                        {atr.originSectionTitle && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-1">Source Section</p>
                            <Input value={atr.originSectionTitle} disabled className="bg-slate-50 text-slate-700 font-medium" />
                          </div>
                        )}
                      </>
                    )}
                    {Boolean(atr.originSnapshot) && typeof atr.originSnapshot === 'object' && Object.keys(atr.originSnapshot as Record<string, unknown>).length > 0 && (
                      <div className="col-span-full">
                        <p className="text-xs text-slate-500 font-medium mb-2">Origin Experiment Data (snapshot at ATR creation)</p>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {Object.entries(atr.originSnapshot as Record<string, unknown>).map(([key, val]) => (
                            <div key={key} className="flex flex-col">
                              <span className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wide leading-tight">{key.replace(/_/g, ' ')}</span>
                              <span className="text-xs text-slate-700 font-medium mt-0.5 break-words">
                                {val == null ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val as any)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">Current Owner / TL</p>
                      <Input value={atr.currentOwnerName || atr.assignedTl || '—'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">QA Certified By</p>
                      <Input value={atr.certifiedBy ? `${atr.certifiedBy} (${atr.certifiedAt ? dayjs(atr.certifiedAt).format('DD MMM YYYY') : ''})` : 'Pending QA'} disabled className="bg-slate-50 text-slate-700 font-medium" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-1">ATR Age</p>
                      <div className="pt-1">
                        <Tag icon={<Clock size={11} />} color={healthTagColor(atr.dateDiffForAge ?? 0)} className="text-xs font-semibold">
                          {atr.dateDiffForAge ?? 0} Day(s)
                        </Tag>
                      </div>
                    </div>
                  </div>

                  {/* Signatures Section — 21 CFR Part 11 */}
                  <div className="mt-5 pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Signatures</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Requested By</p>
                        <p className="text-xs font-semibold text-slate-800">{atr.raisedBy || atr.createdBy || '—'}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{atr.raisedOn ? dayjs(atr.raisedOn).format('DD MMM YYYY, HH:mm') : '—'}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Analyzed By (TL)</p>
                        <p className="text-xs font-semibold text-slate-800">{atr.assignedTl || '—'}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{atr.status === 'APPROVED' || atr.status === 'VERIFIED' || atr.status === 'CERTIFIED' ? 'Approved' : 'Pending'}</p>
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Verified By (QA)</p>
                        <p className="text-xs font-semibold text-slate-800">{atr.certifiedBy || (atr.status === 'CERTIFIED' ? 'QA Certified' : '—')}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{atr.certifiedAt ? dayjs(atr.certifiedAt).format('DD MMM YYYY, HH:mm') : 'Pending Certification'}</p>
                      </div>
                    </div>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: 'samples', label: `2. Samples & Test Results (${samples.length})`, children: (
              <div>
                <SamplesEditor atrId={atr.id} samples={samples} onChange={setSamplesDraft} readOnly={!editable} uomOptions={uomOptions} sampleIntegrityOptions={sampleIntegrityOptions} isQaUser={isQaUser} atrStatus={atr.status} />
                {editable && samplesDraft && (
                  <div className="mt-3 flex justify-end">
                    <Button type="primary" onClick={() => save.mutate({ samples: samplesDraft })} loading={save.isPending}>
                      Save Samples & Tests
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
          ...(showPreApprovalTab ? [{
            key: 'qa_pre_approval', label: '3. QA Pre-Approval', children: (
              <Card className="border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">QA Pre-Approval Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium mb-1">Submitted To</p>
                    <p className="font-semibold text-slate-700">{atr.assignedTl || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium mb-1">Submitted On</p>
                    <p className="font-semibold text-slate-700">{atr.submittedAt ? dayjs(atr.submittedAt).format('DD MMM YYYY HH:mm') : '—'}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-slate-400 font-medium mb-1 text-xs">Pre-Approval Note / Remarks</p>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm text-slate-700 whitespace-pre-wrap">
                    {(atr as any).preapprovalNote || 'No pre-approval note recorded.'}
                  </div>
                </div>
                {(atr.workflowHistory ?? []).filter((h: any) => h.toStatus === 'QA_PRE_APPROVAL' || h.fromStatus === 'QA_PRE_APPROVAL' || h.toStatus === 'PRE_APPROVAL_REWORK' || h.fromStatus === 'PRE_APPROVAL_REWORK').length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Pre-Approval Workflow History</p>
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={(atr.workflowHistory ?? []).filter((h: any) => h.toStatus === 'QA_PRE_APPROVAL' || h.fromStatus === 'QA_PRE_APPROVAL' || h.toStatus === 'PRE_APPROVAL_REWORK' || h.fromStatus === 'PRE_APPROVAL_REWORK')}
                      columns={[
                        { title: 'Date / Time', dataIndex: 'requestedAt', width: 160, render: (v: string) => v ? <span className="font-mono text-xs">{dayjs(v).format('DD MMM YYYY HH:mm')}</span> : '—' },
                        { title: 'By', dataIndex: 'requestedBy', width: 140, render: (v: string) => <span className="font-semibold">{v || '—'}</span> },
                        {
                          title: 'Transition', key: 'trans', width: 240,
                          render: (_: any, r: any) => (
                            <span className="text-xs">
                              <Tag className="text-[10px]">{(r.fromStatus || '—').replace(/_/g, ' ')}</Tag>
                              <span className="mx-1 text-slate-400">→</span>
                              <Tag color="blue" className="text-[10px]">{(r.toStatus || '—').replace(/_/g, ' ')}</Tag>
                              {r.eSigned && <Tag color="green" className="text-[10px] ml-1">E-Signed</Tag>}
                            </span>
                          ),
                        },
                        { title: 'Remarks', dataIndex: 'remarks', render: (v: string) => v ? <span className="text-xs text-slate-600">{v}</span> : <span className="text-slate-300 text-xs">—</span> },
                      ]}
                    />
                  </>
                )}
              </Card>
            ),
          }] : []),
          ...(showClarificationTab ? [{
            key: 'clarification', label: `${3 + (showPreApprovalTab ? 1 : 0)}. Clarifications (${atr.clarifications.length})`, children: (() => {
              const clarsByRound = atr.clarifications.reduce<Record<number, typeof atr.clarifications>>((acc, c) => {
                const r = c.round ?? 1
                ;(acc[r] ??= []).push(c)
                return acc
              }, {})
              const rounds = Object.keys(clarsByRound).map(Number).sort((a, b) => a - b)
              return (
                <Card className="rounded-lg">
                  <div className="space-y-4 mb-4">
                    {atr.clarifications.length === 0 && <p className="text-slate-400 text-sm italic">No clarification requests logged.</p>}
                    {rounds.map((r) => (
                      <div key={r}>
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1.5">Round {r}</p>
                        <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                          {clarsByRound[r].map((c) => (
                            <div key={c.id} className="border-b border-slate-100 pb-2.5">
                              <div className="text-xs font-semibold text-indigo-700">{c.authorName} ({c.authorRole}) · {dayjs(c.createdAt).format('DD-MMM-YYYY HH:mm')}</div>
                              <div className="text-sm text-slate-700 mt-1">{c.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <TextArea rows={2} value={clarifyMsg} onChange={(e) => setClarifyMsg(e.target.value)} placeholder="Add a clarification message or inquiry..." />
                  <Button className="mt-2" type="primary" onClick={() => addClarification.mutate({ message: clarifyMsg })} disabled={!clarifyMsg} loading={addClarification.isPending}>
                    Post Clarification
                  </Button>
                </Card>
              )
            })(),
          }] : []),
          {
            key: 'remarks', label: `${3 + (showPreApprovalTab ? 1 : 0) + (showClarificationTab ? 1 : 0)}. Action & Analysis Remarks`, children: (
              <Card className="rounded-lg">
                <Form layout="vertical">
                  <Form.Item label="Analysis Remarks">
                    <TextArea rows={3} defaultValue={atr.analysisRemarks ?? ''} onBlur={(e) => save.mutate({ analysisRemarks: e.target.value })} placeholder="General lab analysis notes..." />
                  </Form.Item>
                  <Form.Item label="Certification & QA Remarks"
                    extra={<span className="text-xs text-slate-400">Entered by QA during certification. Read-only.</span>}>
                    <TextArea rows={3} value={atr.certificationRemarks ?? ''} disabled
                      className="bg-slate-50 text-slate-700 cursor-not-allowed"
                      placeholder={atr.certificationRemarks ? '' : 'No certification remarks yet.'} />
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'attachments',
            label: `${4 + (showPreApprovalTab ? 1 : 0) + (showClarificationTab ? 1 : 0)}. Documents & Attachments`,
            children: (
              <div className="pb-4 space-y-4">
                {/* Certification Report Upload — required before requesting QA certification */}
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                  <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">Certification Report</p>
                  <p className="text-xs text-amber-600 mb-3">Upload the Certification Report (PDF) before requesting QA Certification. This is a mandatory prerequisite.</p>
                  <AtrCertificationPanel
                    atrId={atr.id}
                    attachment={(atr as any).certificationAttachment ?? null}
                    onChange={(v) => save.mutate({ certificationAttachment: v })}
                    readOnly={['CERTIFIED', 'WITHDRAWN', 'REJECTED'].includes(atr.status)}
                  />
                </div>
                {/* Supporting Documents */}
                <div className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Supporting Documents ({(atr.supportingDocs ?? []).length})</p>
                    {!['CERTIFIED', 'WITHDRAWN', 'REJECTED'].includes(atr.status) && (
                      <Button size="small" icon={<Plus size={13} />} onClick={() => {
                        const name = window.prompt('Document name / title:')
                        if (name?.trim()) addSupportingDoc.mutate({ name: name.trim() })
                      }}>Attach Document</Button>
                    )}
                  </div>
                  {(atr.supportingDocs ?? []).length === 0
                    ? <p className="text-xs text-slate-400 italic">No supporting documents attached.</p>
                    : <Table
                        rowKey="id"
                        size="small"
                        pagination={false}
                        dataSource={atr.supportingDocs ?? []}
                        columns={[
                          { title: 'Name', dataIndex: 'name', render: (v: string, r: AtrSupportingDoc) => r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline">{v}</a> : <span>{v}</span> },
                          { title: 'Type', dataIndex: 'type', width: 120, render: (v: string) => v ? <Tag className="text-xs">{v}</Tag> : '—' },
                          { title: 'Uploaded By', dataIndex: 'uploadedBy', width: 140 },
                          { title: 'Uploaded At', dataIndex: 'uploadedAt', width: 160, render: (v: string) => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—' },
                          { title: 'Description', dataIndex: 'description', render: (v: string) => v || '—' },
                          ...(!['CERTIFIED', 'WITHDRAWN', 'REJECTED'].includes(atr.status) ? [{
                            title: '', width: 80,
                            render: (_: any, r: AtrSupportingDoc) => (
                              <Popconfirm title="Remove this document?" onConfirm={() => removeSupportingDoc.mutate(r.id)}>
                                <Button size="small" danger>Remove</Button>
                              </Popconfirm>
                            ),
                          }] : []),
                        ]}
                      />
                  }
                </div>
                <ArdAttachmentsPanel
                  entityType="atr_form"
                  entityId={atr.id}
                  readOnly={!editable}
                  folderLinkEnabled={
                    (settingsMap as any)?.['IncludeAttachmentLink']?.value === true ||
                    (settingsMap as any)?.['IncludeAttachmentLink']?.value === 'true'
                  }
                />
              </div>
            ),
          },
          {
            key: 'raw-data',
            label: `${5 + (showPreApprovalTab ? 1 : 0) + (showClarificationTab ? 1 : 0)}. Raw Data`,
            children: <RawDataTab atrId={atr.id} editable={editable} />,
          },
          {
            key: 'history',
            label: `${6 + (showPreApprovalTab ? 1 : 0) + (showClarificationTab ? 1 : 0)}. Audit & Revision History`,
            children: (
              <Card className="rounded-lg space-y-4">
                {/* Origin + QA Approval summary */}
                <div className="flex flex-wrap gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">Origin:</span>
                    <Tag color={atr.raisedStandalone === false ? 'blue' : 'default'} className="text-xs">
                      {atr.raisedStandalone === false ? 'Cross-Module (from TRF)' : 'Standalone'}
                    </Tag>
                  </div>
                  {atr.qaApproveRemarks && (
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-green-700 font-semibold uppercase tracking-wider mb-1">QA Approval Remarks</p>
                      <p className="text-sm text-green-900">{atr.qaApproveRemarks}</p>
                    </div>
                  )}
                </div>

                {/* QA Rework History */}
                {atr.qaReworkHistory && atr.qaReworkHistory.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">QA Rework History</p>
                    <div className="space-y-2">
                      {atr.qaReworkHistory.map((entry: any, idx: number) => (
                        <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-orange-800">{entry.by || '—'}</span>
                            <span className="text-[10px] text-orange-500">{entry.date ? dayjs(entry.date).format('DD MMM YYYY HH:mm') : '—'}</span>
                          </div>
                          <p className="text-xs text-orange-900">{entry.remarks}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
                  Complete Audit Trail — 21 CFR Part 11 Sealed
                </p>
                <Table
                  rowKey="id"
                  size="small"
                  dataSource={auditLogData?.items ?? []}
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                  locale={{ emptyText: 'No audit events recorded yet.' }}
                  columns={[
                    {
                      title: 'Date / Time', dataIndex: 'createdAt', width: 160,
                      render: (v) => v ? <span className="font-mono text-xs text-slate-600">{dayjs(v).format('DD MMM YYYY, HH:mm')}</span> : '—',
                    },
                    {
                      title: 'Changed By', dataIndex: 'actorName', width: 140,
                      render: (v) => <span className="font-semibold text-slate-800">{v || '—'}</span>,
                    },
                    {
                      title: 'Action', dataIndex: 'action', width: 200,
                      render: (v: string) => {
                        const color = v.startsWith('Status →') ? 'purple'
                          : v === 'Created' ? 'green'
                          : v === 'Deleted' ? 'red'
                          : v === 'Updated' ? 'blue'
                          : 'default'
                        const label = v.startsWith('Status →')
                          ? v.replace('Status → ', 'Status changed to ').replace(/_/g, ' ')
                          : v
                        return <Tag color={color} className="text-xs">{label}</Tag>
                      },
                    },
                    {
                      title: 'What Changed / Remarks',
                      dataIndex: 'detail',
                      render: (v: string) => {
                        if (!v) return <span className="text-slate-400 text-xs">—</span>
                        try {
                          const parsed = JSON.parse(v)
                          if (parsed.changes && Array.isArray(parsed.changes)) {
                            return (
                              <div className="space-y-0.5">
                                {parsed.changes.map((c: any, i: number) => (
                                  <div key={i} className="text-xs">
                                    <span className="font-semibold text-slate-700">{c.field}:</span>{' '}
                                    <span className="text-red-500 line-through">{c.from ?? '(empty)'}</span>
                                    {' → '}
                                    <span className="text-violet-600 font-medium">{c.to ?? '(empty)'}</span>
                                  </div>
                                ))}
                                {parsed.remarks && <div className="text-xs text-slate-500 italic mt-1">Remarks: {parsed.remarks}</div>}
                              </div>
                            )
                          }
                        } catch { /* not JSON — fall through */ }
                        return <span className="text-xs text-slate-600 whitespace-pre-wrap">{v}</span>
                      },
                    },
                  ]}
                />
              </Card>
            ),
          },
        ]

        return (
          <>
            {viewMode === 'tabbed' ? (
              <Tabs
                type="card"
                activeKey={activeTab}
                onChange={(k) => { setActiveTab(k); setSearchParams({ tab: k }) }}
                className="glass-card p-3 rounded-lg"
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
                items={atrTabItems}
              />
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
                {atrTabItems.map((tab) => (
                  <Card
                    key={tab.key}
                    title={<span className="font-bold text-slate-800 text-base">{tab.label}</span>}
                    className="rounded-lg overflow-hidden"
                  >
                    {tab.children}
                  </Card>
                ))}
              </div>
            )}
          </>
        )
      })()}

      {/* Mandatory Remarks Modal */}
      <Modal
        {...glassModalProps}
        title={`Mandatory Business Justification: Move to ${remarksModalTargetStatus?.replace(/_/g, ' ')}`}
        open={remarksModalOpen}
        onCancel={() => setRemarksModalOpen(false)}
        onOk={confirmTransitionWithRemarks}
        confirmLoading={transition.isPending}
        okText="Submit Status Change"
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">
            Pharmaceutical compliance standards require a clear business justification and remarks for moving an ATR to <strong>{remarksModalTargetStatus}</strong>.
          </p>
          <label className="block text-xs font-semibold text-slate-700">Remarks / Justification *</label>
          <TextArea
            rows={4}
            value={remarksInput}
            onChange={(e) => setRemarksInput(e.target.value)}
            placeholder="Enter reason for this status change (e.g. pre-approval rework reason, withdrawal justification)..."
          />
        </div>
      </Modal>

      {/* Password Authorization Modal */}
      <Modal {...glassModalProps} title={`Authorization: move to ${transitionModal?.replace(/_/g, ' ')}`} open={!!transitionModal}
        onCancel={() => { setTransitionModal(null); setQaApproveRemarksInput('') }} onOk={confirmTransition} confirmLoading={transition.isPending}>
        <div className="space-y-3 py-1">
          <p className="text-sm text-slate-500">Re-enter your password to authorize this action.</p>
          <Input.Password value={password} onChange={(e) => setPassword(e.target.value)} />
          {transitionModal === 'APPROVED' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">QA Approval Remarks <span className="text-slate-400 font-normal">(optional)</span></label>
              <TextArea
                rows={3}
                value={qaApproveRemarksInput}
                onChange={(e) => setQaApproveRemarksInput(e.target.value)}
                placeholder="Enter any QA approval notes or conditions..."
              />
            </div>
          )}
        </div>
      </Modal>

      {/* External Requester: Submit to ARD with TL + Password */}
      <Modal
        {...glassModalProps}
        title={<div className="flex items-center gap-2 text-indigo-900 font-bold text-base"><ShieldCheck size={18} className="text-indigo-600" /><span>Submit Request to ARD</span></div>}
        open={externalSubmitOpen}
        onCancel={() => setExternalSubmitOpen(false)}
        onOk={confirmExternalSubmit}
        confirmLoading={externalSubmitLoading || save.isPending || transition.isPending}
        okText="Sign & Submit to ARD"
        okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none' }}
        destroyOnClose
      >
        <div className="py-2 space-y-4">
          <p className="text-sm text-slate-500">Select the ARD Team Lead who will handle this request, then authenticate with your password to submit.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ARD Team Lead *</label>
            <Select
              showSearch
              className="w-full"
              placeholder="Select ARD Team Lead..."
              value={externalSubmitTl || undefined}
              onChange={setExternalSubmitTl}
              options={tlIdOptions}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password (Re-authentication) *</label>
            <Input.Password
              value={externalSubmitPassword}
              onChange={(e) => setExternalSubmitPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              onPressEnter={confirmExternalSubmit}
            />
          </div>
        </div>
      </Modal>

      {/* Team Lead Selection Modal on Submit */}
      <Modal
        {...glassModalProps}
        title={pendingTargetStatus === 'QA_PRE_APPROVAL' ? "Submit ATR for QA Pre-Approval" : "Assign Team Lead"}
        open={tlModalOpen}
        onCancel={() => setTlModalOpen(false)}
        onOk={confirmSubmitWithTl}
        confirmLoading={save.isPending || transition.isPending}
        okText={pendingTargetStatus === 'QA_PRE_APPROVAL' ? "Submit for QA Approval" : "Confirm Assignment & Submit"}
      >
        <div className="py-2 space-y-4">
          <p className="text-sm text-slate-600">
            {pendingTargetStatus === 'QA_PRE_APPROVAL'
              ? "This form type mandates QA pre-approval. Select the Team Lead and QA Reviewer. Upon QA approval, it will convert to NEW and move to the Team Lead."
              : "Select the Team Lead who will review and manage this Analytical Test Request."}
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Team Lead (TL) *</label>
            <Select
              showSearch
              className="w-full"
              placeholder="Select Team Lead..."
              value={selectedTl}
              onChange={setSelectedTl}
              options={tlIdOptions}
            />
          </div>
          {isQaMandated && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select QA Reviewer (QA) *</label>
              <Select
                showSearch
                className="w-full"
                placeholder="Select QA Reviewer..."
                value={selectedQa}
                onChange={setSelectedQa}
                options={qaIdOptions}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Reassign Team Lead Modal */}
      <Modal
        {...glassModalProps}
        title="Reassign Team Lead"
        open={reassignTlOpen}
        onCancel={() => setReassignTlOpen(false)}
        onOk={() => {
          if (!reassignTlId) { msg.error('Please select a Team Lead.'); return }
          if (!reassignTlRemarks.trim()) { msg.error('Reassign remarks are required.'); return }
          assignTlMut.mutate({ tlId: reassignTlId, remarks: reassignTlRemarks })
        }}
        confirmLoading={assignTlMut.isPending}
        okText="Reassign"
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">
            Select a new Team Lead for this ATR. A justification remark is mandatory.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Select Team Lead *</label>
          <Select
            showSearch
            className="w-full"
            placeholder="Select team lead..."
            value={reassignTlId}
            onChange={setReassignTlId}
            options={tlIdOptions}
          />
          <label className="block text-xs font-semibold text-slate-700 mt-3 mb-1">Reassign Remarks *</label>
          <Input.TextArea
            rows={3}
            value={reassignTlRemarks}
            onChange={(e) => setReassignTlRemarks(e.target.value)}
            placeholder="Enter reason for reassigning Team Lead..."
          />
        </div>
      </Modal>

      {/* Reassign QA Reviewer Modal */}
      <Modal
        {...glassModalProps}
        title="Reassign QA Reviewer"
        open={reassignQaOpen}
        onCancel={() => setReassignQaOpen(false)}
        onOk={() => {
          reassignQaMut.mutate({ qaUserId: reassignQaUserId })
        }}
        confirmLoading={reassignQaMut.isPending}
        okText="Reassign"
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">
            Select a QA Reviewer for this ATR. Leave blank to clear the current assignment.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Select QA Reviewer</label>
          <Select
            showSearch
            allowClear
            className="w-full"
            placeholder="Select QA reviewer..."
            value={reassignQaUserId}
            onChange={setReassignQaUserId}
            options={qaIdOptions}
          />
        </div>
      </Modal>

      {/* Certification Rework Remarks Modal */}
      <Modal
        {...glassModalProps}
        title="Return for Certification Rework"
        open={certReworkOpen}
        onCancel={() => setCertReworkOpen(false)}
        onOk={() => {
          if (!certReworkRemarks.trim()) { msg.error('Rework remarks are mandatory for GxP traceability.'); return }
          certReworkMut.mutate(certReworkRemarks)
          setCertReworkOpen(false)
        }}
        confirmLoading={certReworkMut.isPending}
        okText="Confirm Rework"
        okButtonProps={{ danger: true }}
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">
            Provide a mandatory justification for returning this ATR for certification rework. This is recorded in the audit log per GxP requirements.
          </p>
          <label className="block text-xs font-semibold text-slate-700">Rework Remarks *</label>
          <TextArea
            rows={4}
            value={certReworkRemarks}
            onChange={(e) => setCertReworkRemarks(e.target.value)}
            placeholder="Describe what needs to be corrected or revised before re-certification..."
          />
        </div>
      </Modal>

      {/* Change Owner Modal */}
      <Modal
        {...glassModalProps}
        title="Change ATR Owner"
        open={changeOwnerOpen}
        onCancel={() => setChangeOwnerOpen(false)}
        onOk={() => {
          if (!changeOwnerUserId) { msg.error('Please select a new owner.'); return }
          if (!changeOwnerRemarks.trim()) { msg.error('Remarks are required.'); return }
          changeOwnerMut.mutate({ newOwnerId: changeOwnerUserId, remarks: changeOwnerRemarks })
        }}
        confirmLoading={changeOwnerMut.isPending}
        okText="Change Owner"
      >
        <div className="py-2 space-y-3">
          <p className="text-xs text-slate-600">
            Transfer ownership of this ATR to another user. This is recorded in the audit trail.
          </p>
          <label className="block text-xs font-semibold text-slate-700 mb-1">New Owner *</label>
          <Select
            showSearch
            className="w-full"
            placeholder="Select new owner..."
            value={changeOwnerUserId}
            onChange={setChangeOwnerUserId}
            optionFilterProp="label"
            options={(tlUsers?.items ?? []).map(u => ({ value: u.id, label: `${u.username} (${u.role_code})` }))}
          />
          <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1">Remarks *</label>
          <TextArea
            rows={3}
            value={changeOwnerRemarks}
            onChange={(e) => setChangeOwnerRemarks(e.target.value)}
            placeholder="Reason for changing ownership..."
          />
        </div>
      </Modal>

      {/* Certification E-Signature Modal */}
      <ESignatureModal
        open={certifyEsignOpen}
        title="ATR Certification (E-Signature)"
        description="Re-authenticate with your password to certify this Analytical Test Request."
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Certification Remarks"
        loading={certifyMut.isPending}
        onCancel={() => setCertifyEsignOpen(false)}
        onConfirm={async (payload) => {
          await certifyMut.mutateAsync({
            certificationRemarks: payload.reason,
            password: payload.password,
          })
        }}
      />
    </div>
  )
}
