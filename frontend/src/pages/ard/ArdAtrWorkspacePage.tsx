import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Tag, Button, Input, InputNumber, Form, Switch, Table, Modal, message, Card,
  Popconfirm, Space, Empty, Select, Dropdown, Row, Col, Divider, Tooltip, DatePicker, Segmented, Spin, Radio, Checkbox,
} from 'antd'
import { FileText, ShieldCheck, Award, RotateCcw, Send, HelpCircle, ArrowLeft, Plus, FlaskConical, LayoutList, Clock, Link2, Edit3, Trash2, Layers } from 'lucide-react'
import dayjs from 'dayjs'
import { ardApi, ardAtrApi, ardUserApi, ardTeamApi, type AtrStatus, type AtrSample, type AtrSupportingDoc } from '../../api/ard'
import { userApi } from '../../api/adc'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import TestFinalReportLink from '../../components/ard/TestFinalReportLink'
import { AtrCertificationPanel } from '../../components/ard/AtrCertificationPanel'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { ArdMetadataBanner } from '../../components/ard/ArdMetadataBanner'
import { ArdWorkflowStepper } from '../../components/ard/ArdWorkflowStepper'
import { ApiError, apiDownloadBlob, apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { inventoryApi, manufacturerApi } from '../../api/inventory'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'
import { useBreadcrumbLabel } from '../../components/layout/ArdShell'

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
      const newTests = ((Array.isArray(res) ? res : res?.created) || []).map((t: any) => ({
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
            options={(masterData?.testConfigs ?? []).filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.code ?? c.techniqueCode} — ${c.testType}` }))}
          />
        </div>
      </div>
      <Button className="mt-2" type="primary" disabled={!testConfigIds.length && !testGroupIds.length} loading={addTests.isPending} onClick={() => addTests.mutate()}>
        Add
      </Button>
    </Modal>
  )
}

function MaterialDetailsForm({ initial, materials, batches, vendors, onSave, onCancel }: {
  initial: any
  materials: any[]
  batches: any[]
  vendors: any[]
  onSave: (chem: any) => void
  onCancel: () => void
}) {
  const [chem, setChem] = useState<any>(initial)
  const patch = (p: any) => setChem((prev: any) => ({ ...prev, ...p }))

  const materialBatches = batches.filter((b: any) => !chem.materialId || String(b.material_id) === String(chem.materialId))

  const handleSelectMaterial = (matId: string) => {
    const mat = materials.find((m: any) => String(m.id) === String(matId))
    patch({
      materialId: String(matId),
      name: mat?.name || '',
      specification: mat?.code || '',
      materialType: mat?.material_type || '',
      batchId: '', lotNo: '', expiryDate: null, qtyAvailable: '',
    })
  }

  const handleSelectBatch = (bId: number) => {
    const b = batches.find((item: any) => item.id === bId)
    if (b) {
      patch({
        batchId: String(b.id),
        lotNo: b.batch_no || '',
        name: b.material_name || chem.name || '',
        uom: b.unit || chem.uom || '',
        vendor: b.manufacturer_name || chem.vendor || '',
        vendorId: b.manufacturer_id ? String(b.manufacturer_id) : chem.vendorId || '',
        expiryDate: b.expiry_date || (b as any).exp_date || chem.expiryDate || null,
        materialId: b.material_id ? String(b.material_id) : chem.materialId || '',
        qtyAvailable: b.qty_available != null ? String(b.qty_available) : '',
      })
    }
  }

  const handleSelectVendor = (vId: string) => {
    const v = vendors.find((item: any) => String(item.id) === String(vId))
    patch({ vendorId: String(vId), vendor: v?.name || '' })
  }

  const canSave = chem.materialId && chem.vendorId && chem.batchId && chem.quantity

  return (
    <Modal {...glassModalProps} title="Material Details" open onCancel={onCancel} footer={null} width={640}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-2">
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Chemical Name <span className="text-red-500">*</span></p>
          <Select showSearch className="w-full" placeholder="Select"
            value={chem.materialId ? String(chem.materialId) : undefined}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            options={materials.map((m: any) => ({ value: String(m.id), label: `${m.code} — ${m.name}${m.cas_no ? ` (${m.cas_no})` : ''}` }))}
            onChange={handleSelectMaterial}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Vendor Name <span className="text-red-500">*</span></p>
          <Select showSearch className="w-full" placeholder="Select"
            value={chem.vendorId ? String(chem.vendorId) : undefined}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            options={vendors.map((v: any) => ({ value: String(v.id), label: v.name }))}
            onChange={handleSelectVendor}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Batch/Lot No. <span className="text-red-500">*</span></p>
          <Select showSearch className="w-full" placeholder="Select"
            value={chem.batchId ? Number(chem.batchId) : undefined}
            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
            options={materialBatches.map((b: any) => ({ value: b.id, label: `Batch #${b.batch_no} (${b.qty_available} ${b.unit})` }))}
            onChange={handleSelectBatch}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Expiry Date</p>
          <DatePicker className="w-full" value={chem.expiryDate ? dayjs(chem.expiryDate) : null} format="YYYY-MM-DD"
            onChange={(date) => patch({ expiryDate: date?.format('YYYY-MM-DD') ?? null })} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Material Type</p>
          <Input value={chem.materialType ?? ''} onChange={(e) => patch({ materialType: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Material Code</p>
          <Input value={chem.specification ?? ''} onChange={(e) => patch({ specification: e.target.value })} />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Specs</p>
          <Input value={chem.specs ?? ''} onChange={(e) => patch({ specs: e.target.value })} />
        </div>
        <div />
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Qty Available</p>
          <div className="flex gap-1">
            <Input disabled value={chem.qtyAvailable ?? ''} />
            <Input disabled style={{ width: 70 }} value={chem.uom ?? ''} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1">Qty Required <span className="text-red-500">*</span></p>
          <div className="flex gap-1">
            <Input value={chem.quantity ?? ''} onChange={(e) => patch({ quantity: e.target.value })} />
            <Input style={{ width: 70 }} value={chem.uom ?? ''} onChange={(e) => patch({ uom: e.target.value })} />
          </div>
        </div>
        <div className="col-span-2">
          <p className="text-xs font-semibold text-slate-600 mb-1">Remarks</p>
          <Input.TextArea rows={2} value={chem.remarks ?? ''} onChange={(e) => patch({ remarks: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" disabled={!canSave} onClick={() => onSave(chem)}>Save</Button>
      </div>
    </Modal>
  )
}

function ManageChemicalsModal({ sample, onSave, onClose, readOnly }: { sample: AtrSample; onSave: (chems: any[]) => void; onClose: () => void; readOnly: boolean }) {
  const [chems, setChems] = useState<any[]>(sample.chemicals || [])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const materialsQuery = useQuery({
    queryKey: ['inv-materials-lookup'],
    queryFn: () => inventoryApi.materials.listPaged({ pageSize: 250 }),
  })

  const batchesQuery = useQuery({
    queryKey: ['inv-batches-lookup'],
    queryFn: () => inventoryApi.batches.list({ pageSize: 250 }),
  })

  const vendorsQuery = useQuery({
    queryKey: ['inv-manufacturers-lookup'],
    queryFn: () => manufacturerApi.list({ pageSize: 250 }),
  })

  const materials = materialsQuery.data?.items || []
  const batches = batchesQuery.data || []
  const vendors = vendorsQuery.data || []

  const openAdd = () => { setEditingIndex(null); setFormOpen(true) }
  const openEdit = (i: number) => { setEditingIndex(i); setFormOpen(true) }
  const removeChem = (i: number) => setChems(chems.filter((_, idx) => idx !== i))

  const handleFormSave = (chem: any) => {
    if (editingIndex == null) {
      setChems([...chems, chem])
    } else {
      const next = chems.slice()
      next[editingIndex] = chem
      setChems(next)
    }
    setFormOpen(false)
    setEditingIndex(null)
  }

  return (
    <Modal {...glassModalProps} title={`Chemicals & Lot Details — ${sample.sampleCode || 'Sample'}`} open onCancel={onClose}
      onOk={() => { onSave(chems); onClose() }} okText={readOnly ? 'Close' : 'Save Details'} width={1150}>
      <Table
        rowKey={(_, i) => String(i)}
        dataSource={chems}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        footer={() => !readOnly && <Button size="small" icon={<Plus size={14} />} onClick={openAdd}>Add Chemical Lot</Button>}
        columns={[
          { title: 'Chemical / Material Name', dataIndex: 'name', render: (v) => v || '—' },
          { title: 'Inventory Stock Batch', dataIndex: 'lotNo', render: (v) => v || '—' },
          {
            title: 'Material Type', dataIndex: 'materialType',
            render: (v) => v ? <Tag className="text-xs">{v}</Tag> : <span className="text-slate-400 text-xs">—</span>,
          },
          {
            title: 'Qty Available', dataIndex: 'qtyAvailable',
            render: (v, row) => v ? <span className="font-mono text-xs font-semibold text-violet-700">{v} {row.uom || ''}</span> : <span className="text-slate-400 text-xs">—</span>,
          },
          { title: 'Qty Required', dataIndex: 'quantity', render: (v, row) => v ? `${v} ${row.uom || ''}` : '—' },
          { title: 'Expiry Date', dataIndex: 'expiryDate', render: (v) => v || '—' },
          { title: 'Vendor / Mfr', dataIndex: 'vendor', render: (v) => v || '—' },
          { title: 'Remarks', dataIndex: 'remarks', render: (v) => v || '—' },
          ...(readOnly ? [] : [{
            title: '', width: 90,
            render: (_: any, __: any, i: number) => (
              <Space size={4}>
                <Button type="text" size="small" icon={<Edit3 size={13} className="text-indigo-500" />} onClick={() => openEdit(i)} />
                <Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => removeChem(i)} />
              </Space>
            ),
          }]),
        ]}
      />
      {formOpen && (
        <MaterialDetailsForm
          initial={editingIndex == null
            ? { name: '', materialId: '', vendorId: '', batchId: '', lotNo: '', quantity: '', expiryDate: null, vendor: '', specification: '', specs: '', uom: '', remarks: '', materialType: '', qtyAvailable: '' }
            : chems[editingIndex]}
          materials={materials}
          batches={batches}
          vendors={vendors}
          onSave={handleFormSave}
          onCancel={() => { setFormOpen(false); setEditingIndex(null) }}
        />
      )}
    </Modal>
  )
}

function SamplesEditor({ atrId, samples, onChange, readOnly, uomOptions, sampleIntegrityOptions = [] }: {
  atrId: string
  samples: AtrSample[]
  onChange: (s: AtrSample[]) => void
  readOnly: boolean
  uomOptions: { value: string; label: string }[]
  sampleIntegrityOptions?: { value: string; label: string }[]
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

  // Inline "Test Details" table state — per-sample draft row for adding a
  // single test, and per-sample selection for adding a whole test group.
  type TestDraft = { testType?: string; testSubtype?: string; quantity?: string; priority?: string; remarks?: string }
  const [testDrafts, setTestDrafts] = useState<Record<string, TestDraft>>({})
  const [addingGroupFor, setAddingGroupFor] = useState<string | null>(null)
  const [groupSelection, setGroupSelection] = useState<string[]>([])

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).filter((c: any) => c.active).map((c: any) => c.testType).filter(Boolean)))
    return types.map((t) => ({ value: t as string, label: t as string }))
  }, [masterData?.testConfigs])

  const testSubtypeOptionsFor = (testType?: string) => {
    const configs = (masterData?.testConfigs ?? []).filter((c: any) => c.active && (!testType || c.testType === testType))
    const subtypes = Array.from(new Set(configs.map((c: any) => c.testSubtype).filter(Boolean)))
    return subtypes.map((s) => ({ value: s as string, label: s as string }))
  }

  const addTestsMutation = useMutation({
    mutationFn: ({ sampleId, body }: { sampleId: string; body: Parameters<typeof ardAtrApi.addTests>[2] }) =>
      ardAtrApi.addTests(atrId, sampleId, body),
    onSuccess: (res: any, { sampleId }) => {
      // Merge the newly created tests into whatever `samples` currently holds
      // (a saved-but-unsent draft, or the server copy) instead of only
      // invalidating the query — invalidating alone leaves an existing draft
      // stale, and hitting "Save Samples & Tests" afterwards would overwrite
      // the server's freshly-added tests with that stale draft, making them
      // "disappear".
      const i = samples.findIndex((s) => s.id === sampleId)
      if (i >= 0) {
        // The backend's successResponse() returns array payloads bare (no
        // `{created: [...]}` wrapper) — reading `res.created` was always
        // undefined, so nothing ever got merged in and the newly added test
        // never appeared until a full page reload.
        const created = (Array.isArray(res) ? res : res?.created ?? []) as AtrSample['tests']
        update(i, { tests: [...(samples[i].tests ?? []), ...created] })
      }
      qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
      msgApi.success('Test(s) added.')
    },
    onError: (e) => msgApi.error(e instanceof ApiError ? e.detail : 'Failed to add test(s).'),
  })

  const submitTestDraft = (sample: AtrSample) => {
    const draft = testDrafts[sample.id] || {}
    if (!draft.testType || !draft.testSubtype) { msgApi.warning('Test Type and Sub Type are required.'); return }
    const config = (masterData?.testConfigs ?? []).find((c: any) => c.testType === draft.testType && c.testSubtype === draft.testSubtype)
    if (!config) { msgApi.warning('No matching test configuration found for this Test Type / Sub Type.'); return }
    addTestsMutation.mutate({
      sampleId: sample.id,
      body: { testConfigIds: [config.id], quantity: draft.quantity, priority: draft.priority, remarks: draft.remarks },
    })
    setTestDrafts((prev) => ({ ...prev, [sample.id]: {} }))
  }

  const submitGroupAdd = (sample: AtrSample) => {
    if (!groupSelection.length) { setAddingGroupFor(null); return }
    addTestsMutation.mutate({ sampleId: sample.id, body: { testGroupIds: groupSelection } })
    setAddingGroupFor(null)
    setGroupSelection([])
  }

  const [selectedTestIds, setSelectedTestIds] = useState<Record<string, string[]>>({})
  const removeTestMutation = useMutation({
    mutationFn: ({ sampleId, testId }: { sampleId: string; testId: string }) => ardAtrApi.removeTest(atrId, sampleId, testId),
  })
  const removeSelectedTests = async (sample: AtrSample) => {
    const ids = selectedTestIds[sample.id] || []
    if (!ids.length) return
    await Promise.all(ids.map((testId) => removeTestMutation.mutateAsync({ sampleId: sample.id, testId })))
    const i = samples.findIndex((s) => s.id === sample.id)
    if (i >= 0) {
      update(i, { tests: (samples[i].tests ?? []).filter((t) => !ids.includes(t.id)) })
    }
    qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
    msgApi.success('Selected test(s) removed.')
    setSelectedTestIds((prev) => ({ ...prev, [sample.id]: [] }))
  }

  const removeOneTest = async (sample: AtrSample, testId: string) => {
    await removeTestMutation.mutateAsync({ sampleId: sample.id, testId })
    const i = samples.findIndex((s) => s.id === sample.id)
    if (i >= 0) {
      update(i, { tests: (samples[i].tests ?? []).filter((t) => t.id !== testId) })
    }
    qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
    msgApi.success('Test removed.')
  }

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
            const canAddTests = !readOnly && !row.id.startsWith('new-')
            const draft = testDrafts[row.id] || {}
            const setDraft = (patch: Partial<TestDraft>) => setTestDrafts((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...patch } }))
            const selectedIds = selectedTestIds[row.id] || []
            return (
              <div className="bg-slate-50/60 border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 border-b border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Test Details ({rowTests.length})</p>
                  {canAddTests && (
                    <Space size={4}>
                      {selectedIds.length > 0 && (
                        <Popconfirm title={`Remove ${selectedIds.length} selected test(s)?`} onConfirm={() => removeSelectedTests(row)}>
                          <Button size="small" danger icon={<Trash2 size={12} />} loading={removeTestMutation.isPending} />
                        </Popconfirm>
                      )}
                      <Tooltip title="Add Test Group">
                        <Button size="small" icon={<Layers size={12} />}
                          onClick={() => { setAddingGroupFor(row.id); setGroupSelection([]) }} />
                      </Tooltip>
                    </Space>
                  )}
                </div>

                {row.id.startsWith('new-') && (
                  <p className="text-xs text-slate-400 italic py-3 px-3">Save this sample first, then add tests.</p>
                )}

                {addingGroupFor === row.id && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border-b border-violet-100">
                    <Select
                      mode="multiple" size="small" style={{ flex: 1 }} showSearch optionFilterProp="label"
                      placeholder="Select test group(s)…" value={groupSelection} onChange={setGroupSelection}
                      options={(masterData?.testGroups ?? []).map((g: any) => ({ value: g.id, label: g.name }))}
                    />
                    <Button size="small" type="primary" loading={addTestsMutation.isPending} onClick={() => submitGroupAdd(row)}>Add</Button>
                    <Button size="small" onClick={() => { setAddingGroupFor(null); setGroupSelection([]) }}>Cancel</Button>
                  </div>
                )}

                {canAddTests && (
                  <table className="w-full text-xs border-b border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="px-2 py-1.5 w-8" />
                        <th className="px-2 py-1.5 font-semibold text-slate-600">Test Type <span className="text-red-500">*</span></th>
                        <th className="px-2 py-1.5 font-semibold text-slate-600">Sub Type <span className="text-red-500">*</span></th>
                        <th className="px-2 py-1.5 font-semibold text-slate-600 w-24">Quantity</th>
                        <th className="px-2 py-1.5 font-semibold text-slate-600 w-32">Priority</th>
                        <th className="px-2 py-1.5 font-semibold text-slate-600">Remarks</th>
                        <th className="px-2 py-1.5 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-2 py-1.5" />
                        <td className="px-2 py-1.5">
                          <Select size="small" className="w-full" showSearch optionFilterProp="label" allowClear
                            placeholder="Select…" value={draft.testType} options={testTypeOptions}
                            onChange={(v) => setDraft({ testType: v, testSubtype: undefined })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select size="small" className="w-full" showSearch optionFilterProp="label" allowClear
                            placeholder="Select…" value={draft.testSubtype} options={testSubtypeOptionsFor(draft.testType)}
                            onChange={(v) => setDraft({ testSubtype: v })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input size="small" value={draft.quantity ?? ''} onChange={(e) => setDraft({ quantity: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select size="small" className="w-full" allowClear placeholder="—" value={draft.priority}
                            options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]}
                            onChange={(v) => setDraft({ priority: v })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input size="small" value={draft.remarks ?? ''} onChange={(e) => setDraft({ remarks: e.target.value })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button size="small" type="primary" icon={<Plus size={12} />} loading={addTestsMutation.isPending}
                            onClick={() => submitTestDraft(row)} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {rowTests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 px-3">No tests added yet.</p>
                ) : (
              <Table
                rowKey="id"
                dataSource={rowTests}
                size="small"
                pagination={false}
                bordered
                className="bg-white overflow-hidden"
                rowSelection={canAddTests ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedTestIds((prev) => ({ ...prev, [row.id]: keys as string[] })),
                  getCheckboxProps: (test: any) => ({ disabled: normalizeTestStatus(test.status) !== 'UNASSIGNED' }),
                } : undefined}
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
                  { title: 'Sub Type', dataIndex: 'testSubtype', render: (v: string | null) => v || '—' },
                  { title: 'Technique', dataIndex: 'techniqueCode' },
                  { title: 'Quantity', dataIndex: 'testQuantity', width: 90, render: (v: string | null) => v || '—' },
                  { title: 'Priority', dataIndex: 'priority', width: 90, render: (v: string | null) => v ? <Tag color={v === 'HIGH' ? 'red' : v === 'MEDIUM' ? 'orange' : 'default'} className="text-xs">{v}</Tag> : '—' },
                  { title: 'Remarks', dataIndex: 'remarks', render: (v: string | null) => v || '—' },
                  { title: 'AR Number', dataIndex: 'arNumber', render: (v: string) => v ? <span className="font-mono text-xs">{v}</span> : <span className="text-slate-400 text-xs">—</span> },
                  {
                    title: 'Status', dataIndex: 'status',
                    render: (v: string) => { const s = normalizeTestStatus(v); return <Tag color={TEST_STATUS_COLOR[s] ?? 'default'} className="text-xs">{s.replace(/_/g, ' ')}</Tag> },
                  },
                  {
                    title: '', key: 'finalReport',
                    render: (_: any, t: any) => <TestFinalReportLink atrId={atrId} testId={t.id} status={normalizeTestStatus(t.status)} />,
                  },
                  ...(canAddTests ? [{
                    title: '', key: 'remove', width: 40,
                    render: (_: any, t: any) => normalizeTestStatus(t.status) === 'UNASSIGNED' ? (
                      <Popconfirm title="Remove this test?" onConfirm={() => removeOneTest(row, t.id)}>
                        <Button type="text" size="small" danger icon={<Trash2 size={13} />} loading={removeTestMutation.isPending} />
                      </Popconfirm>
                    ) : null,
                  }] : []),
                ]}
              />
                )}
              </div>
            )
          },
          rowExpandable: () => true,
        }}
        columns={[
          {
            title: <span>Sample Code <span className="text-red-500">*</span></span>, dataIndex: 'sampleCode', render: (v, row, i) => (
              <div className="flex items-center gap-1.5">
                {readOnly ? <span>{v}</span> : <Input size="small" value={v} onChange={(e) => update(i, { sampleCode: e.target.value })} />}
                {(row as any).hazardWarningFlag && (
                  <Tag color="red" className="text-[10px] px-1 font-bold animate-pulse">HAZARD</Tag>
                )}
              </div>
            )
          },
          {
            title: <span>Sample Type <span className="text-red-500">*</span></span>, dataIndex: 'sampleType',
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
          {
            title: <span>Batch No. <span className="text-red-500">*</span></span>, dataIndex: 'batchNo',
            render: (v, _r, i) => readOnly ? v : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { batchNo: e.target.value })} />,
          },
          {
            title: 'Description', dataIndex: 'sampleDescription',
            render: (v, _r, i) => readOnly ? (v || '—') : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { sampleDescription: e.target.value })} />,
          },
          {
            title: <span>Sample Qty. <span className="text-red-500">*</span></span>, dataIndex: 'quantity',
            render: (v, r: any, i) => readOnly ? (
              <span>{[v, r.uom].filter(Boolean).join(' ') || '—'}</span>
            ) : (
              <div className="flex gap-1">
                <Input size="small" style={{ width: 70 }} value={v ?? ''} onChange={(e) => update(i, { quantity: e.target.value })} />
                <Select
                  size="small" showSearch allowClear style={{ minWidth: 90 }}
                  value={r.uom ?? undefined} placeholder="UOM" options={uomOptions}
                  onChange={(val) => update(i, { uom: val ?? null })}
                  filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                />
              </div>
            ),
          },
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
          {
            title: 'Storage Condition & Period', dataIndex: 'storageCondition',
            render: (v, _r, i) => readOnly ? (v || '—') : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { storageCondition: e.target.value })} />,
          },
          {
            title: 'Packing', dataIndex: 'packType',
            render: (v, _r, i) => readOnly ? (v || '—') : <Input size="small" value={v ?? ''} onChange={(e) => update(i, { packType: e.target.value })} />,
          },
          {
            title: 'Hazardous', dataIndex: 'hazardWarningFlag', render: (v, _r, i) => (
              <Switch size="small" checked={!!v} disabled={readOnly} onChange={(checked) => update(i, { hazardWarningFlag: checked } as any)} />
            )
          },
          {
            title: '', key: 'materialDetails', width: 44, align: 'center' as const,
            render: (_: any, row, i) => (
              <Tooltip title="Material Details">
                <Button
                  shape="circle" size="small"
                  className="bg-slate-800 text-white border-none hover:bg-slate-700"
                  icon={<span className="text-[10px] font-bold italic">i</span>}
                  onClick={() => setManageChems({ sample: row, index: i })}
                />
              </Tooltip>
            ),
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

  // Ad-hoc Form Attributes — user-added key/value pairs on top of whatever
  // the linked Form Type already declares.
  const [addAttrOpen, setAddAttrOpen] = useState(false)
  const [addAttrName, setAddAttrName] = useState('')
  const [addAttrType, setAddAttrType] = useState<'Text' | 'Number' | 'Date'>('Text')
  const [addAttrMaxLength, setAddAttrMaxLength] = useState<number | undefined>(undefined)
  const [addAttrValue, setAddAttrValue] = useState('')
  const submitAddAttr = () => {
    const name = addAttrName.trim()
    if (!name) { msg.warning('Attribute name is required.'); return }
    if (addAttrValue.trim() === '') { msg.warning('Value is required.'); return }
    if (!atr) return
    const attributeValues = (atr.attributeValues as Record<string, unknown>) ?? {}
    if (name in attributeValues) { msg.warning('An attribute with this name already exists.'); return }
    const updated = {
      ...attributeValues,
      [name]: { value: addAttrValue, type: addAttrType, maxLength: addAttrType === 'Text' ? addAttrMaxLength : undefined },
    }
    save.mutate({ attributeValues: updated })
    setAddAttrOpen(false)
    setAddAttrName('')
    setAddAttrType('Text')
    setAddAttrMaxLength(undefined)
    setAddAttrValue('')
  }

  const { data: settingsMap } = useQuery({ queryKey: ['ard-settings-map'], queryFn: ardApi.settingsMap })
  const { data: atr, isLoading } = useQuery({ queryKey: ['ard-atr', atrId], queryFn: () => ardAtrApi.get(atrId!), enabled: !!atrId })
  useBreadcrumbLabel(atrId ?? '', atr?.formNo ?? null)
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
    // Any TL can hand this ATR off to any team's TL (including themselves) —
    // not just their own team — so this always lists every active team's
    // primary TL, regardless of who's viewing.
    const rawTeams = (teamDirectoryData?.items ?? []).filter((t: any) => t.active !== false)
    if (rawTeams.length > 0) {
      const seenIds = new Set<string>()

      const flat = rawTeams
        .map((t: any) => {
          const mainTl = (t.tls || [])[0]
          if (!mainTl || !mainTl.id || seenIds.has(mainTl.id)) return null
          seenIds.add(mainTl.id)
          return { value: mainTl.id, label: `${mainTl.name || mainTl.id} - ${t.teamName}` }
        })
        .filter((o): o is { value: string; label: string } => !!o)

      if (flat.length > 0) return flat
    }

    const seenFallback = new Set<string>()
    return (tlUsers?.items ?? [])
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
  }, [teamDirectoryData, tlUsers])

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

  // Change Owner should only offer this ATR's own assigned team's members
  // (TL + analysts) — not every TL/user across unrelated departments/modules.
  const changeOwnerOptions = useMemo(() => {
    const teams = teamDirectoryData?.items ?? []
    let team = (atr as any)?.assignedTeamId ? teams.find((t: any) => t.id === (atr as any).assignedTeamId) : undefined
    if (!team && (atr as any)?.assignedTlId) {
      team = teams.find((t: any) =>
        (t.tlIds || []).includes((atr as any).assignedTlId) ||
        (t.tls || []).some((tl: any) => tl.id === (atr as any).assignedTlId)
      )
    }
    if (!team) {
      return (tlUsers?.items ?? []).map((u) => ({ value: u.id, label: `${u.username} (${u.role_code})` }))
    }
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    ;(team.tls || []).forEach((tl: any) => {
      if (tl.id && !seen.has(tl.id)) {
        seen.add(tl.id)
        opts.push({ value: tl.id, label: `${tl.name} (TL)` })
      }
      ;(tl.analysts || []).forEach((a: any) => {
        if (a.id && !seen.has(a.id)) {
          seen.add(a.id)
          opts.push({ value: a.id, label: `${a.name} (${a.role || 'Analyst'})` })
        }
      })
    })
    return opts
  }, [teamDirectoryData, atr, tlUsers])

  useEffect(() => {
    if (tlModalOpen) {
      if (!selectedTl && tlIdOptions.length > 0) {
        const firstTl = tlIdOptions[0]?.value || ''
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
  // QA Pre-Approval / QA Reviewer selection is driven solely by this ATR's own
  // "Mandate Certification" toggle (Basic & Business Details tab) — off means
  // submission goes straight to NEW with no QA reviewer prompt; on means QA
  // Pre-Approval with a required QA reviewer. Form-type/global defaults only
  // seed that toggle's initial value at creation, they don't override it here.
  const isQaMandated = !!atr?.mandateCertification

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
      // Segregation of duties: the ATR's own creator/HOD (whoever raised and
      // routed it to QA in the first place) must not also see "Approve QA
      // Pre-Approval" / "Return for Rework" on their own submission — only
      // actual QA can act on this gate.
      const canReviewQaPreApproval = user?.department_code === 'QA' || user?.role_code === 'QA' || (user?.username || '').toLowerCase().includes('qa') || user?.role_code === 'SUPER_ADMIN'
      if (canReviewQaPreApproval) {
        return target === 'NEW' || target === 'PRE_APPROVAL_REWORK' || target === 'WITHDRAWN'
      } else {
        return target === 'WITHDRAWN'
      }
    }

    if (atr.status === 'NEW' && target === 'QA_PRE_APPROVAL') {
      return false
    }

    // Once the ATR is past DRAFT/SAVED, the work belongs to whichever TL it's
    // currently assigned to — not whoever originally raised it. A reassigned
    // ATR must stop offering "Request Clarification" / "Start Testing" /
    // "Reject Request" to the previous TL; the only thing the original
    // requester should still be able to do on someone else's assignment is
    // withdraw their own request.
    const isAssignedTl = atr.assignedTlId === user?.id
    const isPrivileged = ['HOD', 'SUPER_ADMIN'].includes(user?.role_code ?? '') || user?.department_code === 'QA'
    if (!isPrivileged && !isAssignedTl) {
      const isCreator = atr.createdById === user?.id || atr.createdBy === user?.username || atr.raisedBy === user?.username
      return target === 'WITHDRAWN' && isCreator
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
      const defaultTl = tlIdOptions[0]?.value ?? ''
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
      const defaultTlVal = tlIdOptions[0]?.value ?? ''
      setSelectedTl(atr.assignedTlId || defaultTlVal)
      setSelectedQa(atr.qaReviewerId || (qaIdOptions[0]?.value ?? ''))
      setTlModalOpen(true)
      return
    }

    // Prompt to select TL if missing when transitioning to active status
    if (!isExternalRequester && !atr.assignedTlId && ['NEW', 'PENDING_APPROVAL'].includes(to)) {
      setPendingTargetStatus(to)
      const defaultTlVal = tlIdOptions[0]?.value ?? ''
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
                    <Col span={12}>
                      <Form.Item label="Project Code *" className="font-semibold text-xs">
                        <Input value={atr.projectCode} disabled placeholder="e.g. PRJ-2026-001" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Product Name *" className="font-semibold text-xs">
                        <Input value={atr.productName} disabled placeholder="e.g. Paracetamol API" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
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
                    <Col span={12}>
                      <Form.Item label="Mandate Certification" className="font-semibold text-xs">
                        <div className="flex items-center gap-3 pt-1">
                          <Switch checked={atr.mandateCertification} onChange={(v) => save.mutate({ mandateCertification: v })} />
                          <span className="text-xs text-slate-500">Require QA Sign-off prior to ATR closure</span>
                        </div>
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
                  {(() => {
                    const links = selectedFormType?.attributeLinks ?? []
                    const resolved = links
                      .map((l) => ({ link: l, attr: masterData?.attributes?.find((a) => a.id === l.attributeId) }))
                      .filter((r) => !!r.attr)
                      .sort((a, b) => a.link.sequence - b.link.sequence)
                    const resolvedKeys = new Set(resolved.map((r) => r.attr!.id))
                    const attributeValues = (atr.attributeValues as Record<string, unknown>) ?? {}
                    // Ad-hoc attributes the user added on top of the form type's own,
                    // stored as { value, type, maxLength } so type is remembered across reloads.
                    // Any key in attributeValues that isn't one of the form type's linked
                    // attribute IDs is treated as a custom entry.
                    const customEntries = Object.entries(attributeValues)
                      .filter(([k]) => !resolvedKeys.has(k))
                      .map(([name, raw]) => {
                        const rec = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : { value: raw, type: 'Text' }
                        return { name, value: rec.value, type: (rec.type as string) || 'Text', maxLength: rec.maxLength as number | undefined }
                      })

                    const removeCustomAttr = (name: string) => {
                      const updated = { ...attributeValues }
                      delete updated[name]
                      save.mutate({ attributeValues: updated })
                    }

                    const updateCustomAttrValue = (name: string, type: string, maxLength: number | undefined, value: unknown) => {
                      const updated = { ...attributeValues, [name]: { value, type, maxLength } }
                      save.mutate({ attributeValues: updated })
                    }

                    return (
                      <div className="mt-2 mb-4 border border-indigo-100 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 border-b border-indigo-100">
                          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Form Attributes</p>
                          {editable && (
                            <Button type="text" size="small" icon={<Plus size={13} className="text-indigo-600" />}
                              className="text-indigo-600"
                              onClick={() => setAddAttrOpen(true)} />
                          )}
                        </div>

                        {resolved.length > 0 && (
                          <div className="grid grid-cols-3 gap-3 p-3 border-b border-indigo-100">
                            {resolved.map(({ link, attr }) => {
                              const key = attr!.id
                              const value = attributeValues?.[key]
                              const required = link.requiredOverride ?? attr!.required
                              const opts = (attr!.options ?? []).map((o) => ({ label: o.label, value: o.value }))
                              const commit = (v: unknown) => {
                                if (required && (v === '' || v === null || v === undefined)) {
                                  msg.warning(`"${attr!.label}" is required.`)
                                  return
                                }
                                const updated = { ...attributeValues, [key]: v }
                                save.mutate({ attributeValues: updated })
                              }
                              return (
                                <Form.Item key={key} label={`${attr!.label}${required ? ' *' : ''}`} className="mb-0 font-semibold text-xs">
                                  {attr!.type === 'number' ? (
                                    <InputNumber size="small" className="w-full" defaultValue={value as number | undefined}
                                      onBlur={(e) => commit((e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')} />
                                  ) : attr!.type === 'date' ? (
                                    <DatePicker size="small" className="w-full" defaultValue={value ? dayjs(value as string) : undefined}
                                      onChange={(d) => commit(d ? d.format('YYYY-MM-DD') : '')} />
                                  ) : attr!.type === 'textarea' ? (
                                    <Input.TextArea rows={2} defaultValue={(value as string) ?? ''} onBlur={(e) => commit(e.target.value)} placeholder={attr!.label} />
                                  ) : attr!.type === 'select' ? (
                                    <Select size="small" className="w-full" allowClear defaultValue={(value as string) || undefined}
                                      options={opts} onChange={(v) => commit(v ?? '')} placeholder={attr!.label} />
                                  ) : attr!.type === 'radio' ? (
                                    <Radio.Group size="small" defaultValue={(value as string) || undefined}
                                      onChange={(e) => commit(e.target.value)}>
                                      {opts.map((o) => <Radio key={o.value} value={o.value}>{o.label}</Radio>)}
                                    </Radio.Group>
                                  ) : attr!.type === 'checkbox' ? (
                                    <Checkbox.Group defaultValue={Array.isArray(value) ? value as string[] : []}
                                      options={opts} onChange={(v) => commit(v)} />
                                  ) : attr!.type === 'switch' ? (
                                    <Switch checked={!!value} onChange={(v) => commit(v)} />
                                  ) : (
                                    <Input size="small" defaultValue={(value as string) ?? ''} onBlur={(e) => commit(e.target.value)} placeholder={attr!.label} />
                                  )}
                                </Form.Item>
                              )
                            })}
                          </div>
                        )}

                        {customEntries.length === 0 ? (
                          <p className="text-xs text-slate-400 italic px-3 py-3">No custom attributes yet. {editable ? 'Click "+" to add one.' : ''}</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                                <th className="px-3 py-2 font-semibold text-slate-600">Name</th>
                                <th className="px-3 py-2 font-semibold text-slate-600 w-24">Type</th>
                                <th className="px-3 py-2 font-semibold text-slate-600">Value</th>
                                {editable && <th className="w-10" />}
                              </tr>
                            </thead>
                            <tbody>
                              {customEntries.map(({ name, value, type, maxLength }) => (
                                <tr key={name} className="border-b border-slate-100 last:border-0">
                                  <td className="px-3 py-2 font-medium text-slate-700">{name}</td>
                                  <td className="px-3 py-2 text-slate-500">{type}</td>
                                  <td className="px-3 py-2">
                                    {type === 'Number' ? (
                                      <InputNumber size="small" className="w-full" defaultValue={value as number | undefined}
                                        disabled={!editable}
                                        onBlur={(e) => updateCustomAttrValue(name, type, maxLength, (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : '')} />
                                    ) : type === 'Date' ? (
                                      <DatePicker size="small" className="w-full" disabled={!editable}
                                        defaultValue={value ? dayjs(value as string) : undefined}
                                        onChange={(d) => updateCustomAttrValue(name, type, maxLength, d ? d.format('YYYY-MM-DD') : '')} />
                                    ) : (
                                      <Input size="small" defaultValue={(value as string) ?? ''} disabled={!editable} maxLength={maxLength}
                                        onBlur={(e) => updateCustomAttrValue(name, type, maxLength, e.target.value)} />
                                    )}
                                  </td>
                                  {editable && (
                                    <td className="px-2 py-2 text-right">
                                      <Button type="text" size="small" icon={<Trash2 size={13} className="text-red-400" />}
                                        onClick={() => removeCustomAttr(name)} />
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })()}

                  <Modal
                    {...glassModalProps}
                    title="Add New Attribute"
                    open={addAttrOpen}
                    onCancel={() => setAddAttrOpen(false)}
                    footer={null}
                    width={480}
                  >
                    <div className="space-y-3 pt-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1">Name <span className="text-red-500">*</span></p>
                        <Input value={addAttrName} onChange={(e) => setAddAttrName(e.target.value)} placeholder="e.g. Column Type" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1">Type <span className="text-red-500">*</span></p>
                        <Select className="w-full" value={addAttrType} onChange={(v) => setAddAttrType(v)}
                          options={[{ value: 'Text', label: 'Text' }, { value: 'Number', label: 'Number' }, { value: 'Date', label: 'Date' }]} />
                      </div>
                      {addAttrType === 'Text' && (
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-1">Max Length</p>
                          <InputNumber className="w-full" min={1} value={addAttrMaxLength} onChange={(v) => setAddAttrMaxLength(v ?? undefined)} />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1">Value <span className="text-red-500">*</span></p>
                        {addAttrType === 'Number' ? (
                          <InputNumber className="w-full" value={addAttrValue === '' ? undefined : Number(addAttrValue)}
                            onChange={(v) => setAddAttrValue(v == null ? '' : String(v))} />
                        ) : addAttrType === 'Date' ? (
                          <DatePicker className="w-full" value={addAttrValue ? dayjs(addAttrValue) : undefined}
                            onChange={(d) => setAddAttrValue(d ? d.format('YYYY-MM-DD') : '')} />
                        ) : (
                          <Input value={addAttrValue} maxLength={addAttrMaxLength} onChange={(e) => setAddAttrValue(e.target.value)} />
                        )}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button onClick={() => setAddAttrOpen(false)}>Cancel</Button>
                        <Button type="primary" onClick={submitAddAttr}>Submit</Button>
                      </div>
                    </div>
                  </Modal>


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
                    {!!atr.originSnapshot && typeof atr.originSnapshot === 'object' && Object.keys(atr.originSnapshot as Record<string, unknown>).length > 0 && (
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
                <SamplesEditor atrId={atr.id} samples={samples} onChange={setSamplesDraft} readOnly={!editable} uomOptions={uomOptions} sampleIntegrityOptions={sampleIntegrityOptions} />
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
          <div className={isQaMandated ? 'grid grid-cols-2 gap-4' : ''}>
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
            options={changeOwnerOptions}
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
