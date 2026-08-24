import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ardApi, ardProjectSpecsApi } from '../../api/ard'
import { userApi } from '../../api/adc'
import {
  Button, Tabs, Input, Tag, Spin, Alert, Modal, Table, Select,
  Typography, Empty, DatePicker, message, InputNumber
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeft, FileText, Send, CheckCircle2, XCircle, RotateCcw,
  Plus, Trash2, ClipboardList
} from 'lucide-react'
import dayjs, { type Dayjs } from 'dayjs'
import { apiGet, apiPut, apiPost, apiDownloadBlob } from '../../api/client'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'
import ArdAttachmentsPanel from '../../components/ard/ArdAttachmentsPanel'
import { ArdMetadataBanner } from '../../components/ard/ArdMetadataBanner'
import { ardProjectsApi } from '../../api/ard-projects'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { inventoryApi } from '../../api/inventory'

const { TextArea } = Input
const { Text } = Typography

// ── Types ─────────────────────────────────────────────────────────────────────

type TrfStatus = 'DRAFT' | 'SAVED' | 'SUBMITTED' | 'REGISTERED' | 'RECEIVED' | 'SAMPLED' | 'UNDER_TESTING' | 'COMPLETED' | 'REJECTED' | 'WITHDRAWN'

interface TestRequestRow {
  id?: string
  testType: string
  testSubType?: string
  parameters?: string
  lowerLimit?: string
  upperLimit?: string
  uom?: string
}

interface SampleLine {
  containerId: string
  description: string
  qty: string
  uom: string
  storageCondition: string
  storageLocationId?: number
}

interface SampleAttribute {
  key: string
  attrType?: string
  value: string
}

interface TrfDetail {
  id: string
  formNo: string
  status: TrfStatus
  projectCode: string
  projectName: string
  sampleCode: string
  sampleType?: string
  batchNo: string
  batchId?: number
  sampleQty?: string
  sampleQtyUom?: string
  mfgDate?: string
  expDate?: string
  storageCondition?: string
  sampleDescription?: string
  totalContainers?: number
  sampledContainers?: number
  sampleContent?: string
  preparedBy?: string
  preparedOn?: string
  sampledBy?: string
  sampledOn?: string
  specificationName?: string
  specificationId?: string
  specificationVersion?: string
  submittedBy?: string
  submittedOn?: string
  registeredBy?: string
  registeredOn?: string
  rejectedBy?: string
  rejectedOn?: string
  rejectRemarks?: string
  receivedBy?: string
  receivedAt?: string
  sampleIntegrity?: string
  receivingRemarks?: string
  assignedTl?: string
  qcRefNum?: string
  remarks?: string
  testRequests: TestRequestRow[]
  sampleLines: SampleLine[]
  sampleAttributes: SampleAttribute[]
  createdBy: string
  createdById?: string
  createdAt: string
  updatedAt: string
  // G-9: TRF approval fields
  approvedBy?: string
  approvedAt?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<TrfStatus, string> = {
  DRAFT: 'default',
  SAVED: 'blue',
  SUBMITTED: 'gold',
  REGISTERED: 'cyan',
  RECEIVED: 'geekblue',
  SAMPLED: 'purple',
  UNDER_TESTING: 'processing',
  COMPLETED: 'green',
  REJECTED: 'red',
  WITHDRAWN: 'volcano',
}

const STATUS_LABEL: Record<TrfStatus, string> = {
  DRAFT: 'Draft',
  SAVED: 'Saved',
  SUBMITTED: 'Submitted',
  REGISTERED: 'Registered',
  RECEIVED: 'Sample Received',
  SAMPLED: 'Sampled',
  UNDER_TESTING: 'Under Testing',
  COMPLETED: 'Completed & Released',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

const INTEGRITY_OPTIONS = [
  'Intact', 'Partially damaged', 'Damaged', 'Seal broken', 'Acceptable',
].map(v => ({ value: v, label: v }))

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArdQcTrfWorkspacePage() {
  const { trfId = '' } = useParams<{ trfId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()

  // ── Draft fields ──────────────────────────────────────────────────────────
  const [projectCode, setProjectCode] = useState('')
  const [projectName, setProjectName] = useState('')
  const [specName, setSpecName] = useState('')
  const [specId, setSpecId] = useState('')
  const [specVersion, setSpecVersion] = useState('')

  const [sampleCode, setSampleCode] = useState('')
  const [sampleType, setSampleType] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [sampleQty, setSampleQty] = useState('')
  const [sampleQtyUom, setSampleQtyUom] = useState('')
  const [mfgDate, setMfgDate] = useState<Dayjs | null>(null)
  const [expDate, setExpDate] = useState<Dayjs | null>(null)
  const [storageCondition, setStorageCondition] = useState('')
  const [sampleDescription, setSampleDescription] = useState('')

  const [totalContainers, setTotalContainers] = useState<number | null>(null)
  const [sampledContainers, setSampledContainers] = useState<number | null>(null)
  const [sampleContent, setSampleContent] = useState('')
  const [preparedBy, setPreparedBy] = useState('')
  const [preparedOn, setPreparedOn] = useState<Dayjs | null>(null)
  const [sampledBy, setSampledBy] = useState('')
  const [sampledOn, setSampledOn] = useState<Dayjs | null>(null)

  const [testRequests, setTestRequests] = useState<TestRequestRow[]>([])
  const [sampleLines, setSampleLines] = useState<SampleLine[]>([])
  const [sampleAttributes, setSampleAttributes] = useState<SampleAttribute[]>([])

  // Receiving (editable when SUBMITTED for QA/TL/HOD)
  const [receivedBy, setReceivedBy] = useState('')
  const [receivedAt, setReceivedAt] = useState<Dayjs | null>(null)
  const [sampleIntegrity, setSampleIntegrity] = useState('')
  const [receivingRemarks, setReceivingRemarks] = useState('')

  // Modals
  const [submitTlModalOpen, setSubmitTlModalOpen] = useState(false)
  const [submitTlId, setSubmitTlId] = useState<string | undefined>()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveEsignOpen, setReceiveEsignOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  const [submitEsignOpen, setSubmitEsignOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawRemarks, setWithdrawRemarks] = useState('')
  const [withdrawEsignOpen, setWithdrawEsignOpen] = useState(false)
  const [registerEsignOpen, setRegisterEsignOpen] = useState(false)

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data, isLoading, error } = useQuery<TrfDetail>({
    queryKey: ['ard-qc-trf', trfId],
    queryFn: () => apiGet(`/api/ard/qc-trf/${trfId}`),
    enabled: !!trfId,
    refetchOnWindowFocus: false,
  })

  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  const { data: projectsData } = useQuery({
    queryKey: ['ard-projects-list'],
    queryFn: () => ardProjectsApi.list({ pageSize: 100 }),
  })

  const projectOptions = useMemo(() => {
    return (projectsData?.items ?? []).map((p) => ({
      value: p.name || p.productName || p.code,
      label: `${p.name || p.productName || p.code} (${p.code})`,
      code: p.code,
      id: p.id,
      projectName: p.name || p.productName || p.code,
    }))
  }, [projectsData?.items])

  const selectedProjectId = useMemo(
    () => projectOptions.find(p => p.code === projectCode)?.id ?? '',
    [projectOptions, projectCode],
  )

  const { data: specsData } = useQuery({
    queryKey: ['ard-project-specs', selectedProjectId],
    queryFn: () => ardProjectSpecsApi.list(selectedProjectId),
    enabled: !!selectedProjectId,
  })

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).filter(tc => tc.active).map(tc => tc.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const { data: tlUsersData } = useQuery({
    queryKey: ['tl-users-trf'],
    queryFn: () => userApi.list({ role_code: 'TL', limit: 100 }),
    enabled: submitTlModalOpen,
  })

  // Hydrate local state from server
  useEffect(() => {
    if (!data) return
    setProjectCode(data.projectCode ?? '')
    setProjectName(data.projectName ?? '')
    setSpecName(data.specificationName ?? '')
    setSpecId(data.specificationId ?? '')
    setSpecVersion(data.specificationVersion ?? '')
    setSampleCode(data.sampleCode ?? '')
    setSampleType(data.sampleType ?? '')
    setBatchNo(data.batchNo ?? '')
    setSampleQty(data.sampleQty ?? '')
    setSampleQtyUom(data.sampleQtyUom ?? '')
    setMfgDate(data.mfgDate ? dayjs(data.mfgDate) : null)
    setExpDate(data.expDate ? dayjs(data.expDate) : null)
    setStorageCondition(data.storageCondition ?? '')
    setSampleDescription(data.sampleDescription ?? '')
    setTotalContainers(data.totalContainers ?? null)
    setSampledContainers(data.sampledContainers ?? null)
    setSampleContent(data.sampleContent ?? '')
    setPreparedBy(data.preparedBy ?? '')
    setPreparedOn(data.preparedOn ? dayjs(data.preparedOn) : null)
    setSampledBy(data.sampledBy ?? '')
    setSampledOn(data.sampledOn ? dayjs(data.sampledOn) : null)
    setTestRequests(data.testRequests ?? [])
    setSampleLines(data.sampleLines ?? [])
    setSampleAttributes(data.sampleAttributes ?? [])
    setReceivedBy(data.receivedBy ?? '')
    setReceivedAt(data.receivedAt ? dayjs(data.receivedAt) : null)
    setSampleIntegrity(data.sampleIntegrity ?? '')
    setReceivingRemarks(data.receivingRemarks ?? '')

    if (data.status === 'SUBMITTED') {
      setActiveTab('receiving')
    } else if (data.status === 'REGISTERED') {
      setActiveTab('specs')
    } else {
      setActiveTab('form')
    }
  }, [data])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ard-qc-trf', trfId] })

  function buildBody() {
    return {
      projectCode, projectName,
      specificationName: specName, specificationId: specId, specificationVersion: specVersion,
      sampleCode, sampleType, batchNo, sampleQty, sampleQtyUom,
      mfgDate: mfgDate?.format('YYYY-MM-DD') ?? '',
      expDate: expDate?.format('YYYY-MM-DD') ?? '',
      storageCondition, sampleDescription,
      totalContainers: totalContainers ?? undefined,
      sampledContainers: sampledContainers ?? undefined,
      sampleContent, preparedBy,
      preparedOn: preparedOn?.format('YYYY-MM-DD') ?? '',
      sampledBy,
      sampledOn: sampledOn?.format('YYYY-MM-DD') ?? '',
      testRequests, sampleLines, sampleAttributes,
    }
  }

  function validateForSubmit(): string | null {
    if (!projectCode.trim()) return 'Project code is required.'
    if (!projectName.trim()) return 'Project name is required.'
    if (!sampleCode.trim()) return 'Sample code is required.'
    if (!batchNo.trim()) return 'Batch no. is required.'
    if (!sampleQty?.trim()) return 'Sample quantity is required.'
    if (!mfgDate) return 'Manufacturing date is required.'
    if (!expDate) return 'Expiry date is required.'
    if (!storageCondition?.trim()) return 'Storage condition is required.'
    if (!preparedBy?.trim()) return 'Prepared by is required.'
    if (!sampledBy?.trim()) return 'Sampled by is required.'
    if (testRequests.length === 0) return 'At least one test request is required.'
    return null
  }

  function validateForRegister(): string | null {
    if (!receivedBy.trim()) return 'Received by is required.'
    if (!receivedAt) return 'Received at is required.'
    if (!sampleIntegrity.trim()) return 'Sample integrity is required.'
    if (!receivingRemarks.trim()) return 'Receiving remarks are required.'
    return null
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: () => apiPut(`/api/ard/qc-trf/${trfId}`, {
      ...buildBody(),
      ...(data?.status === 'DRAFT' ? { status: 'SAVED' } : {}),
    }),
    onSuccess: () => { msgApi.success('Saved.'); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Save failed.'),
  })

  const submitMut = useMutation({
    mutationFn: async (esig: { password: string; reason?: string }) => {
      await apiPut(`/api/ard/qc-trf/${trfId}`, buildBody())
      await apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
        to: 'SUBMITTED',
        password: esig.password,
        reason: esig.reason,
        ...(submitTlId ? { assignedTlId: submitTlId } : {}),
      })
    },
    onSuccess: () => { msgApi.success('Submitted to ARD.'); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Submit failed.'),
  })

  // Inventory lookups
  const { data: invBatches } = useQuery({
    queryKey: ['inv-batches-trf'],
    queryFn: () => inventoryApi.batches.list({ expand_packs: 1 }),
  })

  const { data: storageLocs } = useQuery({
    queryKey: ['inv-storage-locations-trf'],
    queryFn: inventoryApi.storageLocations.list,
  })

  const [workflowEsignTarget, setWorkflowEsignTarget] = useState<TrfStatus | null>(null)

  // Add Additional Tests modal
  const [addTestsOpen, setAddTestsOpen] = useState(false)
  const [newTestRows, setNewTestRows] = useState<TestRequestRow[]>([{ testType: '', testSubType: '', parameters: '', lowerLimit: '', upperLimit: '', uom: '' }])

  const addTestsMut = useMutation({
    mutationFn: (rows: TestRequestRow[]) => apiPost(`/api/ard/qc-trf/${trfId}/add-tests`, { testRequests: rows }),
    onSuccess: () => {
      msgApi.success('Additional tests added.')
      setAddTestsOpen(false)
      setNewTestRows([{ testType: '', testSubType: '', parameters: '', lowerLimit: '', upperLimit: '', uom: '' }])
      invalidate()
    },
    onError: (e: Error) => msgApi.error(e.message || 'Failed to add tests.'),
  })

  const transitionMut = useMutation({
    mutationFn: async ({ to, password, reason }: { to: TrfStatus; password?: string; reason?: string }) => {
      await apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
        to,
        password,
        reason,
      })
    },
    onSuccess: (_, vars) => {
      msgApi.success(`TRF transitioned to ${STATUS_LABEL[vars.to] ?? vars.to}.`)
      setWorkflowEsignTarget(null)
      invalidate()
    },
    onError: (e: Error) => msgApi.error(e.message || 'Status transition failed.'),
  })

  const registerMut = useMutation({
    mutationFn: (esig: { password: string; reason?: string }) => apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
      to: 'REGISTERED',
      password: esig.password, reason: esig.reason,
    }),
    onSuccess: () => { msgApi.success('TRF registered.'); setRegisterOpen(false); setRegisterEsignOpen(false); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Registration failed.'),
  })

  const receiveMut = useMutation({
    mutationFn: (esig: { password: string; reason?: string }) => apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
      to: 'RECEIVED',
      receivedBy, receivedAt: receivedAt?.format('YYYY-MM-DD HH:mm') ?? '', sampleIntegrity, receivingRemarks,
      password: esig.password, reason: esig.reason,
    }),
    onSuccess: () => { msgApi.success('Sample receipt confirmed.'); setReceiveOpen(false); setReceiveEsignOpen(false); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Receipt confirmation failed.'),
  })

  const rejectMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
      to: 'REJECTED', rejectRemarks,
    }),
    onSuccess: () => { msgApi.success('Form rejected.'); setRejectOpen(false); setRejectRemarks(''); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Rejection failed.'),
  })

  const resubmitMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/qc-trf/${trfId}/transition`, { to: 'SUBMITTED' }),
    onSuccess: () => { msgApi.success('Resubmitted.'); invalidate() },
    onError: (e: Error) => msgApi.error(e.message || 'Resubmit failed.'),
  })

  const withdrawMut = useMutation({
    mutationFn: async (esig: { password: string; reason?: string }) => {
      await apiPost(`/api/ard/qc-trf/${trfId}/transition`, {
        to: 'WITHDRAWN',
        withdrawRemarks,
        password: esig.password,
        reason: esig.reason || withdrawRemarks,
      })
    },
    onSuccess: () => {
      msgApi.success('QC-TRF withdrawn.')
      setWithdrawEsignOpen(false)
      setWithdrawOpen(false)
      setWithdrawRemarks('')
      invalidate()
    },
    onError: (e: Error) => msgApi.error(e.message || 'Withdrawal failed.'),
  })

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ items: Array<{ id: string; eventType: string; eventTimeFormatted: string | null; user: string; eventDetails: string }> }>({
    queryKey: ['ard-trf-events', trfId],
    queryFn: () => apiGet(`/api/ard/qc-trf/${trfId}/events`),
    enabled: !!trfId && activeTab === 'events',
  })

  const handleSelectInventoryBatch = (batchId: number) => {
    const found = invBatches?.find(b => b.id === batchId)
    if (!found) return
    setSampleCode(found.material_name || '')
    setBatchNo(found.batch_no)
    setSampleQtyUom(found.unit || 'g')
    if (found.mfg_date) setMfgDate(dayjs(found.mfg_date))
    if (found.expiry_date) setExpDate(dayjs(found.expiry_date))
    if (found.location) setStorageCondition(found.location)
    msgApi.success(`Populated details from Inventory Batch #${found.batch_no}`)
  }

  const downloadPdf = async () => {
    try {
      const { blob } = await apiDownloadBlob(`/api/ard/qc-trf/${trfId}/documents/summary.pdf`)
      window.open(URL.createObjectURL(blob), '_blank')
    } catch {
      msgApi.error('Failed to generate PDF.')
    }
  }

  // ── Role / status guards ──────────────────────────────────────────────────

  const role = user?.role_code ?? ''
  const status = data?.status ?? 'DRAFT'
  const isOwner = data?.createdById === user?.id || data?.createdBy === user?.username

  const canEditRoles = ['CHEM', 'TL', 'SUPER_ADMIN']
  const canRegisterRoles = ['TL', 'HOD', 'QA', 'SUPER_ADMIN']

  const isEditable = canEditRoles.includes(role) && (isOwner || role === 'SUPER_ADMIN')
    && ['DRAFT', 'SAVED', 'REJECTED'].includes(status)
  const canRegister = canRegisterRoles.includes(role)

  const anyBusy = saveMut.isPending || submitMut.isPending || registerMut.isPending || receiveMut.isPending
    || rejectMut.isPending || resubmitMut.isPending

  // ── Columns for nested tables ─────────────────────────────────────────────

  const testReqCols: ColumnsType<TestRequestRow> = [
    {
      title: 'Test Type',
      dataIndex: 'testType',
      width: 160,
      render: (v, _, i) => (
        <Select size="small" showSearch optionFilterProp="label" allowClear className="w-full"
          value={v || undefined} disabled={!isEditable} placeholder="Type"
          options={testTypeOptions}
          onChange={val => { const u = [...testRequests]; u[i] = { ...u[i], testType: val }; setTestRequests(u) }} />
      ),
    },
    {
      title: 'Test Sub Type',
      dataIndex: 'testSubType',
      width: 120,
      render: (v, _, i) => (
        <Input size="small" value={v ?? ''} disabled={!isEditable} placeholder="Sub type"
          onChange={e => { const u = [...testRequests]; u[i] = { ...u[i], testSubType: e.target.value }; setTestRequests(u) }} />
      ),
    },
    {
      title: 'Parameters',
      dataIndex: 'parameters',
      render: (v, _, i) => (
        <Input size="small" value={v ?? ''} disabled={!isEditable} placeholder="Parameters"
          onChange={e => { const u = [...testRequests]; u[i] = { ...u[i], parameters: e.target.value }; setTestRequests(u) }} />
      ),
    },
    {
      title: 'Lower Limit',
      dataIndex: 'lowerLimit',
      width: 100,
      render: (v, _, i) => (
        <Input size="small" value={v ?? ''} disabled={!isEditable} placeholder="≥" className="font-mono"
          onChange={e => { const u = [...testRequests]; u[i] = { ...u[i], lowerLimit: e.target.value }; setTestRequests(u) }} />
      ),
    },
    {
      title: 'Upper Limit',
      dataIndex: 'upperLimit',
      width: 100,
      render: (v, _, i) => (
        <Input size="small" value={v ?? ''} disabled={!isEditable} placeholder="≤" className="font-mono"
          onChange={e => { const u = [...testRequests]; u[i] = { ...u[i], upperLimit: e.target.value }; setTestRequests(u) }} />
      ),
    },
    {
      title: 'UoM',
      dataIndex: 'uom',
      width: 70,
      render: (v, _, i) => (
        <Input size="small" value={v ?? ''} disabled={!isEditable} placeholder="UoM"
          onChange={e => { const u = [...testRequests]; u[i] = { ...u[i], uom: e.target.value }; setTestRequests(u) }} />
      ),
    },
    ...(isEditable ? [{
      title: '',
      width: 40,
      render: (_: unknown, __: unknown, i: number) => (
        <button onClick={() => setTestRequests(testRequests.filter((_, j) => j !== i))}
          className="text-red-400 hover:text-red-600 transition-colors">
          <Trash2 size={14} />
        </button>
      ),
    }] : []),
  ]

  const sampleLineCols: ColumnsType<SampleLine> = [
    { title: 'Container ID', dataIndex: 'containerId', width: 120,
      render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], containerId: e.target.value }; setSampleLines(u) }} /> },
    { title: 'Description', dataIndex: 'description',
      render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], description: e.target.value }; setSampleLines(u) }} /> },
    { title: 'Gross Wt', dataIndex: 'grossWeight', width: 85,
      render: (v, _, i) => <Input size="small" value={(v as string) ?? ''} disabled={!isEditable} placeholder="Gross" className="font-mono"
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], grossWeight: e.target.value } as any; setSampleLines(u) }} /> },
    { title: 'Tare Wt', dataIndex: 'tareWeight', width: 85,
      render: (v, _, i) => <Input size="small" value={(v as string) ?? ''} disabled={!isEditable} placeholder="Tare" className="font-mono"
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], tareWeight: e.target.value } as any; setSampleLines(u) }} /> },
    { title: 'Net Wt', dataIndex: 'netWeight', width: 85,
      render: (v, _, i) => <Input size="small" value={(v as string) ?? ''} disabled={!isEditable} placeholder="Net" className="font-mono font-semibold"
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], netWeight: e.target.value } as any; setSampleLines(u) }} /> },
    { title: 'UOM', dataIndex: 'uom', width: 70,
      render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], uom: e.target.value }; setSampleLines(u) }} /> },
    { title: 'Storage Condition', dataIndex: 'storageCondition',
      render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
        onChange={e => { const u = [...sampleLines]; u[i] = { ...u[i], storageCondition: e.target.value }; setSampleLines(u) }} /> },
    ...(isEditable ? [{
      title: '', width: 40,
      render: (_: unknown, __: unknown, i: number) => (
        <button onClick={() => setSampleLines(sampleLines.filter((_, j) => j !== i))}
          className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
      ),
    }] : []),
  ]

  // ── Loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (error || !data) {
    return (
      <div className="p-4 md:p-6">
        <Alert type="error" message="Failed to load QC-TRF form" showIcon
          action={<Button size="small" onClick={() => navigate('/ard/qc-trf')}>Back to List</Button>} />
      </div>
    )
  }

  // ── Field row helper ──────────────────────────────────────────────────────
  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
        {children}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {ctx}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/ard/qc-trf')}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-violet-500 mb-2 transition-colors">
            <ArrowLeft size={14} /> Back to QC-TRF
          </button>
          <div className="flex items-center gap-3">
            <ClipboardList size={22} className="text-violet-500 shrink-0 mt-0.5" />
            <div>
              <h1 className="text-xl font-bold text-slate-800 leading-tight font-mono">{data.formNo}</h1>
              <p className="text-sm text-slate-500">{data.projectName || data.projectCode}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Save (DRAFT or SAVED or REJECTED owner) */}
          {isEditable && (
            <Button icon={<CheckCircle2 size={14} />} loading={saveMut.isPending} disabled={anyBusy}
              onClick={() => saveMut.mutate()}>
              Save
            </Button>
          )}

          {/* Submit */}
          {isEditable && ['DRAFT', 'SAVED', 'REJECTED'].includes(status) && (
            <Button type="primary" icon={<Send size={14} />} loading={submitMut.isPending} disabled={anyBusy}
              onClick={() => {
                const err = validateForSubmit()
                if (err) { msgApi.warning(err); return }
                setSubmitTlId(undefined)
                setSubmitTlModalOpen(true)
              }}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Submit
            </Button>
          )}

          {/* Register receipt (TL/HOD/QA when SUBMITTED) */}
          {canRegister && status === 'SUBMITTED' && (
            <Button type="primary" icon={<CheckCircle2 size={14} />} disabled={anyBusy}
              onClick={() => setRegisterOpen(true)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Register Receipt
            </Button>
          )}

          {/* Confirm sample receipt (TL/HOD/QA when REGISTERED) */}
          {canRegister && status === 'REGISTERED' && (
            <Button type="primary" icon={<CheckCircle2 size={14} />} disabled={anyBusy}
              onClick={() => setReceiveOpen(true)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Confirm Sample Receipt
            </Button>
          )}

          {/* Reject (TL/HOD/QA when SUBMITTED, REGISTERED, or RECEIVED) */}
          {canRegister && ['SUBMITTED', 'REGISTERED', 'RECEIVED'].includes(status) && (
            <Button danger icon={<XCircle size={14} />} disabled={anyBusy}
              onClick={() => setRejectOpen(true)}>
              Reject
            </Button>
          )}

          {/* Withdraw (owner when DRAFT/SAVED/SUBMITTED) */}
          {isEditable && ['DRAFT', 'SAVED', 'SUBMITTED'].includes(status) && (
            <Button icon={<RotateCcw size={14} />} disabled={anyBusy}
              onClick={() => setWithdrawOpen(true)}
              className="border-orange-400 text-orange-600 hover:border-orange-500 hover:text-orange-700">
              Withdraw
            </Button>
          )}

          {/* Add Additional Tests — on SUBMITTED or REGISTERED forms */}
          {['SUBMITTED', 'REGISTERED'].includes(status) && (
            <Button icon={<Plus size={14} />} onClick={() => {
              setNewTestRows([{ testType: '', testSubType: '', parameters: '', lowerLimit: '', upperLimit: '', uom: '' }])
              setAddTestsOpen(true)
            }}>
              Add Tests
            </Button>
          )}

          {status !== 'DRAFT' && (
            <Button icon={<FileText size={14} />} onClick={downloadPdf}>
              Summary PDF
            </Button>
          )}

          <Tag color={STATUS_COLOR[status]} className="text-sm px-3 py-1.5 h-auto font-semibold rounded-md m-0">
            {STATUS_LABEL[status]}
          </Tag>
        </div>
      </div>

      {/* Rejection alert */}
      {status === 'REJECTED' && data.rejectRemarks && (
        <Alert type="error" showIcon icon={<XCircle size={16} />}
          message="Form rejected" description={data.rejectRemarks} />
      )}

      {/* Tabs */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Tabs className="px-4" activeKey={activeTab} onChange={setActiveTab} destroyInactiveTabPane={false} items={[

          // ── Tab 1: Form Details ───────────────────────────────────────────
          {
            key: 'form',
            label: 'Form Details',
            children: (
              <div className="pb-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Form No.">
                    <Input value={data.formNo} disabled className="font-mono" />
                  </Field>
                  <Field label="Project Name">
                    {isEditable ? (
                      <Select
                        showSearch
                        className="w-full"
                        optionFilterProp="label"
                        placeholder="Select project..."
                        value={projectName || undefined}
                        options={projectOptions}
                        onChange={(val, opt: any) => {
                          setProjectName(opt?.projectName || val)
                          if (opt?.code) setProjectCode(opt.code)
                        }}
                      />
                    ) : (
                      <Input value={projectName} disabled />
                    )}
                  </Field>
                  <Field label="Project Code">
                    <Input value={projectCode} disabled className="font-mono bg-slate-50" placeholder="Project code" />
                  </Field>
                  <Field label="Specification">
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder={selectedProjectId ? 'Select specification…' : 'Select a project first'}
                      disabled={!isEditable || !selectedProjectId}
                      value={specId || undefined}
                      style={{ width: '100%' }}
                      onChange={(val, opt: any) => {
                        setSpecId(val)
                        setSpecName(opt?.specTitle ?? val)
                        setSpecVersion(opt?.version ?? '')
                        const spec = (specsData ?? []).find(s => s.id === val)
                        if (spec?.testParameters?.length) {
                          setTestRequests(spec.testParameters.map(tp => ({
                            testType: tp.testType || tp.parameter || '',
                            testSubType: '',
                            parameters: tp.parameter || '',
                            lowerLimit: tp.specLimit ?? '',
                            upperLimit: '',
                            uom: '',
                          })))
                        }
                      }}
                      options={(specsData ?? []).filter(s => s.status === 'APPROVED').map(s => ({
                        value: s.id,
                        label: `${s.specCode} v${s.version} – ${s.title}`,
                        specTitle: s.title,
                        version: s.version,
                      }))}
                    />
                  </Field>
                  <Field label="Specification Version">
                    <Input value={specVersion} onChange={e => setSpecVersion(e.target.value)} disabled={!isEditable}
                      placeholder="Auto-filled from spec selection" className="bg-slate-50" />
                  </Field>
                </div>

                {/* Bottom Metadata Summary Cards */}
                <div className="space-y-4 pt-3 border-t border-slate-100">
                  <ArdMetadataBanner
                    formNo={data.formNo}
                    status={data.status}
                    raisedBy={data.createdBy}
                    raisedOn={data.createdAt}
                    sourceDept="QC / Stability"
                    currentOwnerName={data.assignedTl || 'QC Queue'}
                    assignedTl={data.assignedTl}
                    statusColor={STATUS_COLOR[status]}
                  />

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {[
                      ['Created By', data.createdBy],
                      ['Created At', dayjs(data.createdAt).format('DD MMM YYYY')],
                      ['Submitted By', data.submittedBy || '—'],
                      ['Submitted On', data.submittedOn ? dayjs(data.submittedOn).format('DD MMM YYYY') : '—'],
                      ...(data.registeredBy ? [['Registered By', data.registeredBy], ['Registered On', data.registeredOn ? dayjs(data.registeredOn).format('DD MMM YYYY') : '—']] : []),
                      ...(data.approvedBy ? [['Approved By', data.approvedBy], ['Approved At', data.approvedAt ? dayjs(data.approvedAt).format('DD MMM YYYY') : '—']] : []),
                      ...(data.rejectedBy ? [['Rejected By', data.rejectedBy]] : []),
                    ].map(([label, value], i) => (
                      <div key={i}>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                        <p className="font-semibold text-slate-700">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },

          // ── Tab 2: Sample ─────────────────────────────────────────────────
          {
            key: 'sample',
            label: 'Sample',
            children: (
              <div className="pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Field label="Inventory Stock Lot Lookup (Auto-fill)">
                    <Select
                      showSearch
                      disabled={!isEditable}
                      className="w-full"
                      placeholder="Select from Inventory Stock Lots..."
                      options={(invBatches ?? []).map(b => ({
                        value: b.id,
                        label: `${b.material_name || 'Material'} — Batch #${b.batch_no} (${b.qty_available} ${b.unit})`,
                      }))}
                      onChange={handleSelectInventoryBatch}
                    />
                  </Field>
                </div>
                <Field label="Sample Code">
                  <Input value={sampleCode} onChange={e => setSampleCode(e.target.value)} disabled={!isEditable}
                    placeholder="Sample identifier" />
                </Field>
                <Field label="Batch No.">
                  <Input value={batchNo} onChange={e => setBatchNo(e.target.value)} disabled={!isEditable}
                    placeholder="Batch / Lot number" />
                </Field>
                <Field label="Sample Type">
                  <Select className="w-full" allowClear disabled={!isEditable}
                    placeholder="Select sample type" value={sampleType || undefined}
                    onChange={v => setSampleType(v ?? '')}
                    options={[
                      { value: 'API', label: 'API' },
                      { value: 'Drug Product', label: 'Drug Product' },
                      { value: 'Drug Substance', label: 'Drug Substance' },
                      { value: 'Intermediate', label: 'Intermediate' },
                      { value: 'Raw Material', label: 'Raw Material' },
                      { value: 'Reference Standard', label: 'Reference Standard' },
                      { value: 'Stability Sample', label: 'Stability Sample' },
                      { value: 'Other', label: 'Other' },
                    ]}
                  />
                </Field>
                <Field label="Storage Condition">
                  <Input value={storageCondition} onChange={e => setStorageCondition(e.target.value)} disabled={!isEditable}
                    placeholder="e.g. 2–8°C, RT" />
                </Field>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Sample Quantity</p>
                  <div className="flex gap-2">
                    <Input value={sampleQty} onChange={e => setSampleQty(e.target.value)} disabled={!isEditable}
                      placeholder="Amount" className="flex-1 font-mono" />
                    <Input value={sampleQtyUom} onChange={e => setSampleQtyUom(e.target.value)} disabled={!isEditable}
                      placeholder="UOM" style={{ width: 80 }} />
                  </div>
                </div>
                <Field label="Mfg. Date">
                  <DatePicker value={mfgDate}
                    onChange={v => {
                      setMfgDate(v)
                      if (v && expDate && !expDate.isAfter(v, 'day')) {
                        setExpDate(null)
                      }
                    }}
                    disabled={!isEditable}
                    className="w-full" format="YYYY-MM-DD" />
                </Field>
                <Field label="Expiry Date">
                  <DatePicker value={expDate}
                    disabledDate={(current) => {
                      if (!current) return false
                      const today = dayjs().startOf('day')
                      if (current.isBefore(today)) return true
                      if (mfgDate) {
                        const mfg = mfgDate.startOf('day')
                        if (current.isBefore(mfg) || current.isSame(mfg, 'day')) return true
                      }
                      return false
                    }}
                    onChange={v => setExpDate(v)} disabled={!isEditable}
                    className="w-full" format="YYYY-MM-DD" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Sample Description">
                    <TextArea rows={3} value={sampleDescription} onChange={e => setSampleDescription(e.target.value)}
                      disabled={!isEditable} placeholder="Physical description of the sample..." />
                  </Field>
                </div>
              </div>
            ),
          },

          // ── Tab 3: Preparation ────────────────────────────────────────────
          {
            key: 'prep',
            label: 'Preparation',
            children: (
              <div className="pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Total Containers">
                  <InputNumber value={totalContainers} onChange={v => setTotalContainers(v)} disabled={!isEditable}
                    min={0} className="w-full" />
                </Field>
                <Field label="Sampled Containers">
                  <InputNumber value={sampledContainers} onChange={v => setSampledContainers(v)} disabled={!isEditable}
                    min={0} className="w-full" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Sample Content">
                    <TextArea rows={2} value={sampleContent} onChange={e => setSampleContent(e.target.value)}
                      disabled={!isEditable} placeholder="Contents of sample containers..." />
                  </Field>
                </div>
                <Field label="Prepared By">
                  <Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} disabled={!isEditable}
                    placeholder="Name" />
                </Field>
                <Field label="Prepared On">
                  <DatePicker value={preparedOn} onChange={v => setPreparedOn(v)} disabled={!isEditable}
                    className="w-full" format="YYYY-MM-DD" />
                </Field>
                <Field label="Sampled By">
                  <Input value={sampledBy} onChange={e => setSampledBy(e.target.value)} disabled={!isEditable}
                    placeholder="Name" />
                </Field>
                <Field label="Sampled On">
                  <DatePicker value={sampledOn} onChange={v => setSampledOn(v)} disabled={!isEditable}
                    className="w-full" format="YYYY-MM-DD" />
                </Field>
              </div>
            ),
          },

          // ── Tab 4: Test Requests ──────────────────────────────────────────
          {
            key: 'tests',
            label: `Test Requests (${testRequests.length})`,
            children: (
              <div className="pb-5">
                {testRequests.length === 0 ? (
                  <Empty description="No test requests added yet" className="py-8" />
                ) : (
                  <Table dataSource={testRequests} columns={testReqCols}
                    rowKey={(_, i) => String(i)} pagination={false} size="small" className="mb-3" />
                )}
                {isEditable && (
                  <Button type="dashed" size="small" icon={<Plus size={13} />}
                    onClick={() => setTestRequests([...testRequests, { testType: '', testSubType: '', parameters: '', lowerLimit: '', upperLimit: '', uom: '' }])}>
                    Add test request
                  </Button>
                )}
              </div>
            ),
          },

          // ── Tab 5: Containers ─────────────────────────────────────────────
          {
            key: 'containers',
            label: `Containers (${sampleLines.length})`,
            children: (
              <div className="pb-5">
                {sampleLines.length === 0 ? (
                  <Empty description="No containers listed" className="py-8" />
                ) : (
                  <Table dataSource={sampleLines} columns={sampleLineCols}
                    rowKey={(_, i) => String(i)} pagination={false} size="small" className="mb-3" />
                )}
                {isEditable && (
                  <Button type="dashed" size="small" icon={<Plus size={13} />}
                    onClick={() => setSampleLines([...sampleLines, { containerId: '', description: '', qty: '', uom: '', storageCondition: '' }])}>
                    Add container
                  </Button>
                )}
              </div>
            ),
          },

          // ── Tab 6: Receiving ──────────────────────────────────────────────
          {
            key: 'receiving',
            label: 'Receiving',
            children: (
              <div className="pb-5">
                {!['SUBMITTED', 'REGISTERED', 'REJECTED'].includes(status) ? (
                  <Empty description="Receiving details are filled after the form is submitted to ARD" className="py-10" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Received By">
                      <Input value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                        disabled={!canRegister || status !== 'SUBMITTED'}
                        placeholder="Name of receiver" />
                    </Field>
                    <Field label="Received At">
                      <DatePicker showTime value={receivedAt} onChange={v => setReceivedAt(v)}
                        disabled={!canRegister || status !== 'SUBMITTED'}
                        className="w-full" format="YYYY-MM-DD HH:mm" />
                    </Field>
                    <Field label="Sample Integrity">
                      <Select value={sampleIntegrity || undefined}
                        onChange={v => setSampleIntegrity(v)}
                        disabled={!canRegister || status !== 'SUBMITTED'}
                        options={INTEGRITY_OPTIONS} placeholder="Select integrity status"
                        className="w-full" />
                    </Field>
                    <Field label="Assigned TL">
                      <Input value={data.assignedTl || '—'} disabled />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Receiving Remarks">
                        <TextArea rows={2} value={receivingRemarks} onChange={e => setReceivingRemarks(e.target.value)}
                          disabled={!canRegister || status !== 'SUBMITTED'}
                          placeholder="Conditions on receipt, observations..." />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            ),
          },

          // ── Tab 7: Attributes ─────────────────────────────────────────────
          {
            key: 'attributes',
            label: `Attributes (${sampleAttributes.length})`,
            children: (
              <div className="pb-5">
                {sampleAttributes.length === 0 ? (
                  <Empty description="No custom attributes" className="py-8" />
                ) : (
                  <Table
                    dataSource={sampleAttributes}
                    rowKey={(_, i) => String(i)}
                    pagination={false}
                    size="small"
                    className="mb-3"
                    columns={[
                      { title: 'Name / Key', dataIndex: 'key',
                        render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
                          onChange={e => { const u = [...sampleAttributes]; u[i] = { ...u[i], key: e.target.value }; setSampleAttributes(u) }} /> },
                      { title: 'Type', dataIndex: 'attrType', width: 110,
                        render: (v, _, i) => (
                          <Select size="small" className="w-full" value={v || undefined} disabled={!isEditable}
                            placeholder="Type" allowClear
                            onChange={val => { const u = [...sampleAttributes]; u[i] = { ...u[i], attrType: val }; setSampleAttributes(u) }}
                            options={[{ value: 'Text', label: 'Text' }, { value: 'Number', label: 'Number' }, { value: 'Date', label: 'Date' }]} />
                        ) },
                      { title: 'Value', dataIndex: 'value',
                        render: (v, _, i) => <Input size="small" value={v} disabled={!isEditable}
                          onChange={e => { const u = [...sampleAttributes]; u[i] = { ...u[i], value: e.target.value }; setSampleAttributes(u) }} /> },
                      ...(isEditable ? [{
                        title: '', width: 40,
                        render: (_: unknown, __: unknown, i: number) => (
                          <button onClick={() => setSampleAttributes(sampleAttributes.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                        ),
                      }] : []),
                    ]}
                  />
                )}
                {isEditable && (
                  <Button type="dashed" size="small" icon={<Plus size={13} />}
                    onClick={() => setSampleAttributes([...sampleAttributes, { key: '', attrType: 'Text', value: '' }])}>
                    Add attribute
                  </Button>
                )}
              </div>
            ),
          },

          // ── Tab 8: Attachments ────────────────────────────────────────────
          {
            key: 'attachments',
            label: 'Attachments',
            children: (
              <div className="pb-4">
                <ArdAttachmentsPanel
                  entityType="qc_trf"
                  entityId={trfId}
                  readOnly={!isEditable}
                  label="TRF Attachments"
                />
              </div>
            ),
          },

          // ── Tab 9: Events / Audit Trail ───────────────────────────────────
          {
            key: 'events',
            label: 'Events',
            children: (
              <div className="pb-4">
                <Table
                  rowKey="id"
                  loading={eventsLoading}
                  dataSource={eventsData?.items ?? []}
                  size="small"
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'] }}
                  columns={[
                    {
                      title: 'Event Type',
                      dataIndex: 'eventType',
                      width: 220,
                      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
                    },
                    {
                      title: 'Event Time',
                      dataIndex: 'eventTimeFormatted',
                      width: 190,
                      render: (v: string) => <span className="font-mono text-xs text-slate-500">{v || '—'}</span>,
                    },
                    {
                      title: 'User',
                      dataIndex: 'user',
                      width: 130,
                      render: (v: string) => <span className="font-semibold">{v}</span>,
                    },
                    {
                      title: 'Event Details',
                      dataIndex: 'eventDetails',
                    },
                  ]}
                />
              </div>
            ),
          },

        ]} />
      </div>



      {/* TL Selector — pre-submit step */}
      <Modal {...glassModalProps} title="Submit TRF — Select Team Lead" open={submitTlModalOpen}
        onCancel={() => setSubmitTlModalOpen(false)}
        onOk={() => { setSubmitTlModalOpen(false); setSubmitEsignOpen(true) }}
        okText="Continue to E-Signature"
        okButtonProps={{ disabled: !submitTlId }}
        width={420}>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">Select the Team Lead to assign this TRF to for review.</p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Team Lead <span className="text-red-400">*</span></label>
            <Select showSearch optionFilterProp="label" className="w-full" placeholder="Select TL..."
              value={submitTlId} onChange={setSubmitTlId}
              options={((tlUsersData as any)?.items ?? []).map((u: any) => ({
                value: u.id,
                label: `${u.fullName || u.username} (${u.role_code ?? 'TL'})`,
              }))} />
          </div>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal {...glassModalProps} title="Reject QC-TRF Form" open={rejectOpen}
        onCancel={() => { setRejectOpen(false); setRejectRemarks('') }} footer={null} width={460}>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">Provide a reason for rejecting this form.</p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Rejection Remarks <span className="text-red-400">*</span>
            </label>
            <TextArea rows={3} value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)}
              placeholder="Describe the issue..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setRejectOpen(false); setRejectRemarks('') }}>Cancel</Button>
            <Button danger loading={rejectMut.isPending} disabled={!rejectRemarks.trim() || anyBusy}
              onClick={() => rejectMut.mutate()}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Register receipt modal — Step 1: QA logs acknowledgment */}
      <Modal {...glassModalProps} title="Register Receipt — Step 1 of 2" open={registerOpen}
        onCancel={() => setRegisterOpen(false)} footer={null} width={460}>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">Register that this TRF has been received by the QA lab. Physical sample integrity will be confirmed in the next step.</p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button type="primary" loading={registerMut.isPending} disabled={anyBusy}
              onClick={() => setRegisterEsignOpen(true)}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Register
            </Button>
          </div>
        </div>
      </Modal>

      {/* E-Signature Modal for Register Receipt */}
      <ESignatureModal
        open={registerEsignOpen}
        title="Register Receipt (E-Signature)"
        description="Re-authenticate with your password to register receipt of this TRF."
        userName={user?.username || 'Current User'}
        requireReason={false}
        loading={registerMut.isPending}
        onCancel={() => setRegisterEsignOpen(false)}
        onConfirm={async (payload) => { await registerMut.mutateAsync(payload) }}
      />

      {/* Confirm sample receipt modal — Step 2: physical integrity check */}
      <Modal {...glassModalProps} title="Confirm Sample Receipt — Step 2 of 2" open={receiveOpen}
        onCancel={() => setReceiveOpen(false)} footer={null} width={500}>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">Record the physical condition of the sample on receipt.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Received By *</label>
              <Input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Received At *</label>
              <DatePicker showTime value={receivedAt} onChange={v => setReceivedAt(v)}
                format="YYYY-MM-DD HH:mm" className="w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Sample Integrity *</label>
              <Select value={sampleIntegrity || undefined} onChange={v => setSampleIntegrity(v)}
                options={INTEGRITY_OPTIONS} placeholder="Select integrity status" className="w-full" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Receiving Remarks</label>
              <TextArea rows={2} value={receivingRemarks} onChange={e => setReceivingRemarks(e.target.value)}
                placeholder="Conditions on receipt, container status..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button type="primary" loading={receiveMut.isPending} disabled={anyBusy}
              onClick={() => {
                if (!receivedBy.trim()) { msgApi.warning('Received By is required.'); return }
                if (!receivedAt) { msgApi.warning('Received At date is required.'); return }
                if (!sampleIntegrity) { msgApi.warning('Sample Integrity is required.'); return }
                setReceiveEsignOpen(true)
              }}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
              Confirm Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* E-Signature Modal for Confirm Sample Receipt */}
      <ESignatureModal
        open={receiveEsignOpen}
        title="Confirm Sample Receipt (E-Signature)"
        description="Re-authenticate with your password to confirm physical sample receipt."
        userName={user?.username || 'Current User'}
        requireReason={false}
        loading={receiveMut.isPending}
        onCancel={() => setReceiveEsignOpen(false)}
        onConfirm={async (payload) => { await receiveMut.mutateAsync(payload) }}
      />

      {/* E-Signature Modal for TRF Submission */}
      <ESignatureModal
        open={submitEsignOpen}
        title="Submit QC-TRF (E-Signature)"
        description="Re-authenticate with your password to submit this Quality Control Transfer Request Form to ARD."
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Submission Remarks"
        loading={submitMut.isPending}
        onCancel={() => setSubmitEsignOpen(false)}
        onConfirm={async (payload) => {
          await submitMut.mutateAsync(payload)
          setSubmitEsignOpen(false)
        }}
      />

      {/* E-Signature Modal for Post-Registration Workflow Steps */}
      <ESignatureModal
        open={workflowEsignTarget !== null}
        title={`QC-TRF — ${STATUS_LABEL[workflowEsignTarget ?? 'DRAFT']} (E-Signature)`}
        description={`Re-authenticate with your password to transition this form to ${STATUS_LABEL[workflowEsignTarget ?? 'DRAFT']}.`}
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Action Remarks"
        loading={transitionMut.isPending}
        onCancel={() => setWorkflowEsignTarget(null)}
        onConfirm={async (payload) => {
          if (workflowEsignTarget) {
            await transitionMut.mutateAsync({
              to: workflowEsignTarget,
              password: payload.password,
              reason: payload.reason,
            })
          }
        }}
      />

      {/* Withdraw confirmation modal */}
      <Modal {...glassModalProps} title="Withdraw QC-TRF Form" open={withdrawOpen}
        onCancel={() => { setWithdrawOpen(false); setWithdrawRemarks('') }} footer={null} width={460}>
        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            Withdrawing this form will cancel the submission. Provide a reason.
          </p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Withdrawal Remarks <span className="text-red-400">*</span>
            </label>
            <TextArea rows={3} value={withdrawRemarks}
              onChange={e => setWithdrawRemarks(e.target.value)}
              placeholder="Reason for withdrawal..." />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button onClick={() => { setWithdrawOpen(false); setWithdrawRemarks('') }}>Cancel</Button>
            <Button
              className="border-orange-400 text-orange-600"
              disabled={!withdrawRemarks.trim()}
              onClick={() => { setWithdrawOpen(false); setWithdrawEsignOpen(true) }}>
              Continue to E-Signature
            </Button>
          </div>
        </div>
      </Modal>

      {/* E-Signature for withdrawal */}
      <ESignatureModal
        open={withdrawEsignOpen}
        title="Withdraw QC-TRF (E-Signature)"
        description="Re-authenticate with your password to withdraw this QC-TRF form."
        userName={user?.username || 'Current User'}
        requireReason={false}
        loading={withdrawMut.isPending}
        onCancel={() => setWithdrawEsignOpen(false)}
        onConfirm={async (payload) => {
          await withdrawMut.mutateAsync(payload)
        }}
      />

      {/* Add Additional Tests Modal */}
      <Modal
        {...glassModalProps}
        title="Add Additional Tests"
        open={addTestsOpen}
        onCancel={() => setAddTestsOpen(false)}
        onOk={() => {
          const valid = newTestRows.filter(r => r.testType.trim())
          if (!valid.length) { msgApi.warning('Add at least one test type.'); return }
          addTestsMut.mutate(valid)
        }}
        okText="Add Tests"
        confirmLoading={addTestsMut.isPending}
        width={680}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-500">Select additional tests to append to this TRF. These will be queued for lab execution.</p>
          <Table
            dataSource={newTestRows}
            rowKey={(_, i) => String(i)}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Test Type',
                dataIndex: 'testType',
                render: (v, _, i) => (
                  <Select size="small" showSearch optionFilterProp="label" className="w-full"
                    value={v || undefined} placeholder="Type"
                    options={testTypeOptions}
                    onChange={val => { const u = [...newTestRows]; u[i] = { ...u[i], testType: val }; setNewTestRows(u) }} />
                ),
              },
              {
                title: 'Sub Type',
                dataIndex: 'testSubType',
                width: 120,
                render: (v, _, i) => (
                  <Input size="small" value={v ?? ''} placeholder="Sub type"
                    onChange={e => { const u = [...newTestRows]; u[i] = { ...u[i], testSubType: e.target.value }; setNewTestRows(u) }} />
                ),
              },
              {
                title: 'Parameters',
                dataIndex: 'parameters',
                render: (v, _, i) => (
                  <Input size="small" value={v ?? ''} placeholder="Parameters / remarks"
                    onChange={e => { const u = [...newTestRows]; u[i] = { ...u[i], parameters: e.target.value }; setNewTestRows(u) }} />
                ),
              },
              {
                title: '',
                width: 36,
                render: (_: unknown, __: unknown, i: number) => (
                  <button onClick={() => setNewTestRows(newTestRows.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 size={13} />
                  </button>
                ),
              },
            ]}
          />
          <Button type="dashed" size="small" icon={<Plus size={13} />}
            onClick={() => setNewTestRows([...newTestRows, { testType: '', testSubType: '', parameters: '', lowerLimit: '', upperLimit: '', uom: '' }])}>
            Add row
          </Button>
        </div>
      </Modal>
    </div>
  )
}
