/**
 * Renders any ARD experiment section based on section.type.
 * Section types mirror the Angular ARD experiment editor:
 *   richtext, params, table, combined, sample, weighing, ph,
 *   equipment, column, material, quantitative, further-action, dataitem, conclusion
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Table, Input, Button, Select, Tag, DatePicker, Popconfirm, Empty, Alert, Modal, Spin, Tooltip, message, Checkbox, Radio, Divider,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Trash2, Package, ShieldAlert, FileText, Edit2, ClipboardCheck, Save } from 'lucide-react'
import dayjs from 'dayjs'
import RichEditor from '../RichEditor'
import { inventoryApi } from '../../api/inventory'
import SpreadsheetFieldRuntime from '../../pages/admin/templateBuilder/SpreadsheetFieldRuntime'
import type { TemplateField } from '../../pages/admin/templateBuilder/types'
import { ardApi } from '../../api/ard'
import { adminApi } from '../../api/admin'
import { apiPost, apiPatch, apiUpload, apiGet, BASE_URL } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

export interface SectionDef {
  id: string
  title: string
  type: string
  columns?: { key: string; label: string }[]
  children?: SectionDef[]
  required?: boolean
  spreadsheet?: TemplateField['spreadsheet']
  editorHeight?: number | null
  dataItemLinks?: { dataItemId: string; name: string; dataType: string; isMandatory: boolean }[]
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// ── Generic editable cell helpers ─────────────────────────────────────────────
function Cell({ value, onChange, readOnly, placeholder }: {
  value: any; onChange: (v: string) => void; readOnly: boolean; placeholder?: string
}) {
  const strVal = typeof value === 'object' && value !== null
    ? (value.value ?? value.name ?? value.label ?? value.text ?? '')
    : (value ?? '')
  if (readOnly) return <span className="text-sm">{String(strVal) || '—'}</span>
  return <Input size="small" value={String(strVal)} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

function SelectCell({ value, onChange, readOnly, options, placeholder }: {
  value: any; onChange: (v: string) => void; readOnly: boolean
  options: { value: string; label: string }[]; placeholder?: string
}) {
  const strVal = typeof value === 'object' && value !== null ? (value.value ?? value.name ?? '') : (value ?? '')
  if (readOnly) return <span className="text-sm">{String(strVal) || '—'}</span>
  return (
    <Select size="small" value={strVal || undefined} onChange={onChange} placeholder={placeholder}
      options={options} className="w-full" allowClear />
  )
}

function DateCell({ value, onChange, readOnly }: {
  value: any; onChange: (v: string) => void; readOnly: boolean
}) {
  const strVal = typeof value === 'object' && value !== null ? (value.value ?? value.date ?? '') : (value ?? '')
  if (readOnly) return <span className="text-sm">{String(strVal) || '—'}</span>
  return (
    <DatePicker size="small" showTime value={strVal ? dayjs(strVal) : undefined}
      onChange={d => onChange(d ? d.toISOString() : '')} className="w-full" />
  )
}

function RowActions({ onDelete, readOnly }: { onDelete: () => void; readOnly: boolean }) {
  if (readOnly) return null
  return (
    <Popconfirm title="Delete row?" onConfirm={onDelete}>
      <Button type="text" danger size="small" icon={<Trash2 size={12} />} />
    </Popconfirm>
  )
}

function AddRowFooter({ label, onAdd, readOnly }: { label?: string; onAdd: () => void; readOnly: boolean }) {
  if (readOnly) return null
  return (
    <Button size="small" icon={<Plus size={12} />} onClick={onAdd} className="mt-1">
      {label ?? 'Add row'}
    </Button>
  )
}

// ── Section: richtext / conclusion ────────────────────────────────────────────
function RichtextSection({ value, onChange, readOnly, height }: {
  value: string; onChange: (v: string) => void; readOnly: boolean; height?: number
}) {
  return <RichEditor value={value ?? ''} onChange={onChange} readOnly={readOnly} height={height} />
}

// ── Section: params ───────────────────────────────────────────────────────────
// Two distinct callers share this 'params' case:
//  1. Template-authored Params/Combined sections (Configuration → Sections) —
//     `section.dataItemLinks` is always an array (possibly empty) once built by
//     buildExperimentSectionDefs. One labeled input per configured Data Item.
//  2. The fixed "Experiment Parameters" block every experiment has regardless
//     of template (ArdExperimentWorkspacePage.tsx) — never sets dataItemLinks
//     at all, and always meant free-form arbitrary parameter entry.
// Distinguish by whether dataItemLinks is defined, not by its length.
function ParamsSection({ section, value, onChange, readOnly }: {
  section: SectionDef
  value: Record<string, string> | { id: string; parameter: string; value: string; uom: string }[] | undefined
  onChange: (v: unknown) => void; readOnly: boolean
}) {
  if (section.dataItemLinks === undefined) {
    return <FreeformParamsSection value={Array.isArray(value) ? value : []} onChange={onChange} readOnly={readOnly} />
  }

  const items = section.dataItemLinks
  const values = (value && !Array.isArray(value) ? value : {}) as Record<string, string>
  const setField = (dataItemId: string, v: string) => onChange({ ...values, [dataItemId]: v })

  if (items.length === 0) {
    return <p className="text-slate-400 text-sm italic">No parameters configured for this section.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(item => (
        <div key={item.dataItemId} className="border border-slate-200 rounded overflow-hidden flex flex-col sm:flex-row">
          <div className="bg-slate-50 text-xs font-medium text-slate-700 px-2.5 py-2 sm:w-1/2 flex items-center">
            {item.name}{item.isMandatory && <span className="text-red-500 ml-0.5">*</span>}
          </div>
          <div className="p-1.5 sm:w-1/2">
            {item.dataType === 'DATE' ? (
              <DatePicker
                size="small" style={{ width: '100%' }} disabled={readOnly}
                value={values[item.dataItemId] ? dayjs(values[item.dataItemId]) : null}
                onChange={d => setField(item.dataItemId, d ? d.format('YYYY-MM-DD') : '')}
              />
            ) : (
              <Input
                size="small" disabled={readOnly} type={item.dataType === 'INTEGER' ? 'number' : 'text'}
                value={values[item.dataItemId] ?? ''}
                onChange={e => setField(item.dataItemId, e.target.value)}
                placeholder={item.dataType === 'LOV' ? 'Select / enter value' : undefined}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Original free-form Parameter/Value/UOM add-row grid — preserved verbatim for
// the fixed "Experiment Parameters" block (see ParamsSection above).
function FreeformParamsSection({ value, onChange, readOnly }: {
  value: { id: string; parameter: string; value: string; uom: string }[]
  onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const upd = (i: number, patch: Record<string, string>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  const cols: ColumnsType<typeof rows[0]> = [
    { title: 'Parameter', dataIndex: 'parameter', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { parameter: val })} readOnly={readOnly} /> },
    { title: 'Value', dataIndex: 'value', width: 140, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { value: val })} readOnly={readOnly} /> },
    { title: 'UOM', dataIndex: 'uom', width: 100, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { uom: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false}
    footer={() => <AddRowFooter onAdd={() => onChange([...rows, { id: uid(), parameter: '', value: '', uom: '' }])} readOnly={readOnly} />} />
}

// ── Section: table ────────────────────────────────────────────────────────────
function TableSection({ section, value, onChange, readOnly }: {
  section: SectionDef; value: Record<string, string>[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const columns = section.columns ?? []
  const rows = value ?? []
  const upd = (i: number, key: string, v: string) => {
    const next = rows.slice(); next[i] = { ...next[i], [key]: v }; onChange(next)
  }
  const cols: ColumnsType<typeof rows[0]> = [
    ...columns.map(c => ({
      title: c.label, dataIndex: c.key,
      render: (v: string, _: unknown, i: number) => <Cell value={v ?? ''} onChange={val => upd(i, c.key, val)} readOnly={readOnly} />,
    })),
    { title: '', key: 'del', width: 40, render: (_: unknown, __: unknown, i: number) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey={(_, i) => String(i)} dataSource={rows} columns={cols} size="small" pagination={false}
    footer={() => <AddRowFooter onAdd={() => onChange([...rows, {}])} readOnly={readOnly} />} />
}

// ── Section: sample / sample_details ──────────────────────────────────────────
interface AtrTestRow {
  id: string
  atrId: string
  testType: string
  testSubtype: string
  arNumber: string
  status: string
  techniqueName: string
  techniqueCode: string
  instrumentCode: string
  assignedToName: string
  lowerLimit?: string
  upperLimit?: string
  limitsUom?: string
  resultValue?: string
  resultUom?: string
  resultStatus?: string
}

interface TestReport {
  id: string
  name: string
  filename: string
  downloadUrl: string
  uploadedBy: string
  createdAt: string
}
interface AtrResultParam {
  id: string
  paramName: string
  resultType: 'NUMBER' | 'TEXT'
  textSpec: string
  lowerLimit: string
  upperLimit: string
  paramValue: string
  paramUom: string
  complies: string
}

interface SampleRow {
  id: string
  atrId?: string
  atrFormNo: string
  projectCode: string
  sampleCode: string
  sampleType: string
  testSubtype: string
  batchNo: string
  sampleCondition: string
  qty: string
  arNumber: string
  status: string
  remarks: string
  tests?: AtrTestRow[]
  resultParams?: AtrResultParam[]
  resultRemarks?: string
  adRemarks?: string
  sendForVerification?: boolean
}
const SAMPLE_TYPES = ['Raw Material', 'Intermediate', 'Finished Product', 'Reference Standard', 'Reagent', 'Other'].map(v => ({ value: v, label: v }))

function SampleSection({ value, onChange, readOnly, projectId }: {
  value: SampleRow[]; onChange: (v: unknown) => void; readOnly: boolean; projectId?: string
}) {
  const rows = value ?? []
  const navigate = useNavigate()
  const currentUser = useAppSelector(selectUser)
  const isAnalyst = ['ANALYST', 'CHEMIST', 'CHEM'].includes(currentUser?.role_code ?? '')
  const [atrModalOpen, setAtrModalOpen] = useState(false)
  const [msgApi, msgCtx] = message.useMessage()
  const [testReports, setTestReports] = useState<Record<string, TestReport[]>>({})

  // ATR result submission modal
  const [submissionOpen, setSubmissionOpen] = useState(false)
  const [submissionIdx, setSubmissionIdx] = useState<number>(0)
  const [submForm, setSubmForm] = useState<{
    resultParams: AtrResultParam[]
    resultRemarks: string
    adRemarks: string
    sendForVerification: boolean
  }>({ resultParams: [], resultRemarks: '', adRemarks: '', sendForVerification: false })

  // Add/Edit result parameter dialog (inside submission modal)
  const [rParamDlgOpen, setRParamDlgOpen] = useState(false)
  const [editingRParamIdx, setEditingRParamIdx] = useState<number | null>(null)
  const [rParamForm, setRParamForm] = useState<Omit<AtrResultParam, 'id'>>({
    paramName: '', resultType: 'NUMBER', textSpec: '', lowerLimit: '', upperLimit: '', paramValue: '', paramUom: '', complies: '',
  })

  const fetchReports = async (testId: string) => {
    try {
      const data = await apiGet<TestReport[]>('/api/ard/uploads', { entity_type: 'atr_test', entity_id: testId })
      setTestReports(prev => ({ ...prev, [testId]: data }))
    } catch { /* ignore */ }
  }

  const { data: atrsData, isLoading: atrsLoading } = useQuery({
    queryKey: ['sample-sec-atrs'],
    queryFn: () => import('../../api/client').then(m => m.apiGet<{ items: any[]; total: number }>('/api/ard/atrs', { pageSize: 100 })),
    enabled: atrModalOpen,
  })

  const { data: projectData } = useQuery({
    queryKey: ['ard-project', projectId],
    queryFn: () => import('../../api/ard-projects').then(m => m.ardProjectsApi.get(projectId!)),
    enabled: !!projectId,
  })

  const { data: analystsData } = useQuery({
    queryKey: ['ard-dept-analysts'],
    queryFn: () => adminApi.listUsers({ pageSize: 200 }),
  })

  const analystOptions = (() => {
    const allAnalysts = (analystsData?.items ?? [])
      .filter((u: any) => ['ANALYST', 'CHEMIST', 'CHEM'].includes(u.role_code ?? ''))
    if (projectId && projectData) {
      const teamUserIds = new Set(
        (projectData.team ?? []).map((m: any) => m.userId).filter(Boolean)
      )
      const teamUserNames = new Set(
        (projectData.team ?? []).map((m: any) => m.userName).filter(Boolean)
      )
      const projectAnalysts = allAnalysts.filter((u: any) =>
        teamUserIds.has(u.id) || teamUserNames.has(u.username)
      )
      if (projectAnalysts.length > 0) return projectAnalysts.map((u: any) => ({ value: u.id, label: u.username }))
    }
    return allAnalysts.map((u: any) => ({ value: u.id, label: u.username }))
  })()

  const openSubmission = (idx: number) => {
    const row = rows[idx]
    setSubmissionIdx(idx)
    setSubmForm({
      resultParams: row.resultParams ?? [],
      resultRemarks: row.resultRemarks ?? '',
      adRemarks: row.adRemarks ?? '',
      sendForVerification: row.sendForVerification ?? false,
    })
    setSubmissionOpen(true)
  }

  const handleSaveSubmission = () => {
    const next = rows.slice()
    next[submissionIdx] = { ...next[submissionIdx], ...submForm }
    onChange(next)
    setSubmissionOpen(false)
    msgApi.success('Results saved.')
  }

  const openAddRParam = () => {
    setEditingRParamIdx(null)
    setRParamForm({ paramName: '', resultType: 'NUMBER', textSpec: '', lowerLimit: '', upperLimit: '', paramValue: '', paramUom: '', complies: '' })
    setRParamDlgOpen(true)
  }

  const openEditRParam = (idx: number) => {
    const p = submForm.resultParams[idx]
    setEditingRParamIdx(idx)
    setRParamForm({ paramName: p.paramName, resultType: p.resultType, textSpec: p.textSpec, lowerLimit: p.lowerLimit, upperLimit: p.upperLimit, paramValue: p.paramValue, paramUom: p.paramUom, complies: p.complies })
    setRParamDlgOpen(true)
  }

  const handleSaveRParam = () => {
    if (!rParamForm.paramName.trim()) { msgApi.warning('Parameter name is required.'); return }
    if (editingRParamIdx !== null) {
      const params = submForm.resultParams.slice()
      params[editingRParamIdx] = { ...params[editingRParamIdx], ...rParamForm }
      setSubmForm(f => ({ ...f, resultParams: params }))
    } else {
      setSubmForm(f => ({ ...f, resultParams: [...f.resultParams, { id: uid(), ...rParamForm }] }))
    }
    setRParamDlgOpen(false)
  }

  const removeRParam = (idx: number) => {
    setSubmForm(f => ({ ...f, resultParams: f.resultParams.filter((_, i) => i !== idx) }))
  }

  const upd = (i: number, patch: Partial<SampleRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }

  const updateTest = (sampleIdx: number, testId: string, patch: Partial<AtrTestRow>) => {
    const next = rows.slice()
    const sample = { ...next[sampleIdx] }
    sample.tests = (sample.tests ?? []).map(t => t.id === testId ? { ...t, ...patch } : t)
    next[sampleIdx] = sample
    onChange(next)
  }

  const handleAddAtr = async (atr: any) => {
    // Fetch the full ATR detail so result_params (LL/UL/UOM) are always present
    let fullAtr = atr
    try {
      fullAtr = await import('../../api/client').then(m => m.apiGet<any>(`/api/ard/atrs/${atr.id}`))
    } catch { /* fall back to list item data */ }

    const newRows: SampleRow[] = (fullAtr.samples ?? []).map((s: any) => {
      const tests: AtrTestRow[] = (s.tests ?? []).map((t: any) => {
        const firstResult = (t.results ?? [])[0] ?? {}
        return {
          id: String(t.id ?? uid()),
          atrId: String(fullAtr.id ?? ''),
          testType: t.testType || '',
          testSubtype: t.testSubtype || '',
          arNumber: t.arNumber || '',
          status: t.status || 'UNASSIGNED',
          techniqueName: t.techniqueName || '',
          techniqueCode: t.techniqueCode || '',
          instrumentCode: t.instrumentCode || '',
          assignedToName: t.assignedToName || '',
          lowerLimit: t.lowerLimit || firstResult.lower_limit || '',
          upperLimit: t.upperLimit || firstResult.upper_limit || '',
          limitsUom: t.limitsUom || firstResult.uom || '',
          resultValue: t.resultValue || '',
          resultUom: t.resultUom || '',
          resultStatus: t.resultStatus || '',
        }
      })
      const qty = [s.quantity, s.uom].filter(Boolean).join(' ')
      return {
        id: uid(),
        atrId: String(fullAtr.id ?? ''),
        atrFormNo: fullAtr.formNo || '',
        projectCode: fullAtr.projectCode || '',
        sampleCode: s.sampleCode || s.internalSampleNo || '',
        sampleType: s.sampleType || '',
        testSubtype: fullAtr.formTypeName || '',
        batchNo: s.batchNo || '',
        sampleCondition: s.storageCondition || s.sampleIntegrity || '',
        qty,
        status: s.status || 'UNASSIGNED',
        remarks: s.additionalRemarks || '',
        tests,
      }
    })
    onChange([...rows, ...newRows])
    setAtrModalOpen(false)
    const allTests = newRows.flatMap(r => r.tests ?? [])
    if (fullAtr.id && allTests.some((t: AtrTestRow) => !t.arNumber)) {
      try {
        const res: any = await apiPost(`/api/ard/atrs/${fullAtr.id}/generate-ar`, {})
        const arMap: Record<string, string> = {}
        for (const item of (res.items ?? [])) {
          if (item.testId && item.arNumber) arMap[item.testId] = item.arNumber
        }
        if (Object.keys(arMap).length > 0) {
          const patchedRows = newRows.map(r => ({
            ...r,
            tests: r.tests?.map((t: AtrTestRow) => arMap[t.id] ? { ...t, arNumber: arMap[t.id] } : t),
          }))
          onChange([...rows, ...patchedRows])
        }
        msgApi.success('AR numbers generated for each test')
      } catch {
        msgApi.warning('ATR added — AR number generation failed, generate manually from ATR')
      }
    }
  }

  const makeTestCols = (sampleIdx: number, rowAtrId?: string) => [
    { title: 'Test Type', dataIndex: 'testType', key: 'testType', width: 130 },
    { title: 'Test Sub-type', dataIndex: 'testSubtype', key: 'testSubtype', width: 130 },
    { title: 'AR Number', dataIndex: 'arNumber', key: 'arNumber', width: 120, render: (v: string) => <span className="font-mono text-xs">{v || '—'}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: (v: string) => { const label = (v === 'PENDING' || !v) ? 'UNASSIGNED' : v; return label ? <Tag color={label === 'ASSIGNED' ? 'green' : 'orange'} className="text-xs">{label}</Tag> : '—' } },
    { title: 'Technique', dataIndex: 'techniqueName', key: 'techniqueName', width: 150, render: (v: string, row: AtrTestRow) => v || row.techniqueCode || '—' },
    {
      title: 'Assigned To', key: 'assignedTo', width: 180,
      render: (_: unknown, testRow: AtrTestRow) => {
        if (testRow.assignedToName) {
          return <span className="text-sm text-slate-700">{testRow.assignedToName}</span>
        }
        if (isAnalyst) {
          return (
            <Button
              size="small"
              type="primary"
              ghost
              onClick={async () => {
                const atrId = testRow.atrId || rowAtrId
                if (!atrId) { msgApi.error('ATR ID missing — cannot assign'); return }
                try {
                  const res: any = await apiPost(`/api/ard/atrs/${atrId}/tests/${testRow.id}/assign`, {})
                  updateTest(sampleIdx, testRow.id, { assignedToName: res.assignedToName, status: res.status })
                  msgApi.success('Test claimed')
                } catch {
                  msgApi.error('Failed to claim test')
                }
              }}
            >
              Claim
            </Button>
          )
        }
        return (
          <Select
            size="small"
            placeholder="Assign analyst"
            style={{ width: 150 }}
            options={analystOptions}
            onChange={async (val: string) => {
              const atrId = testRow.atrId || rowAtrId
              if (!atrId) { msgApi.error('ATR ID missing — cannot assign'); return }
              const opt = analystOptions.find((o: any) => o.value === val)
              try {
                const res: any = await apiPost(`/api/ard/atrs/${atrId}/tests/${testRow.id}/assign`, {
                  assignedToId: val, assignedToName: opt?.label,
                })
                updateTest(sampleIdx, testRow.id, { assignedToName: res.assignedToName, status: res.status })
                msgApi.success(`Assigned to ${res.assignedToName}`)
              } catch {
                msgApi.error('Failed to assign test')
              }
            }}
          />
        )
      },
    },
  ]

  const cols: ColumnsType<SampleRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    { title: 'ATR Form No.', dataIndex: 'atrFormNo', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { atrFormNo: val })} readOnly={readOnly} placeholder="ATR-..." /> },
    { title: 'Project Code', dataIndex: 'projectCode', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { projectCode: val })} readOnly={readOnly} /> },
    { title: 'Sample Code', dataIndex: 'sampleCode', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { sampleCode: val })} readOnly={readOnly} /> },
    { title: 'Sample Type', dataIndex: 'sampleType', width: 150, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { sampleType: val })} readOnly={readOnly} options={SAMPLE_TYPES} /> },
    { title: 'Test Sub-type', dataIndex: 'testSubtype', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { testSubtype: val })} readOnly={readOnly} /> },
    { title: 'Batch No.', dataIndex: 'batchNo', width: 110, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { batchNo: val })} readOnly={readOnly} /> },
    { title: 'Sample Condition', dataIndex: 'sampleCondition', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { sampleCondition: val })} readOnly={readOnly} placeholder="e.g. Intact" /> },
    { title: 'Qty / UOM', dataIndex: 'qty', width: 100, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { qty: val })} readOnly={readOnly} /> },
    { title: 'Status', dataIndex: 'status', width: 110, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { status: val })} readOnly={readOnly} /> },
    { title: 'Remarks', dataIndex: 'remarks', width: 140, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { remarks: val })} readOnly={readOnly} /> },
    {
      title: 'Tests', key: 'tests', width: 70,
      render: (_: unknown, row: SampleRow) => {
        const unassigned = (row.tests ?? []).filter(t => !t.assignedToName)
        const count = unassigned.length
        return count > 0
          ? <Tag color="orange" className="cursor-pointer">{count} pending</Tag>
          : (row.tests?.length ?? 0) > 0
            ? <Tag color="green">all assigned</Tag>
            : <span className="text-slate-400 text-xs">—</span>
      },
    },
    {
      title: 'Result',
      key: 'result',
      width: 90,
      render: (_: unknown, row: SampleRow, i: number) => {
        const hasParams = (row.resultParams?.length ?? 0) > 0
        return (
          <Tooltip title="Enter test results">
            <Button
              size="small"
              type={hasParams ? 'primary' : 'default'}
              ghost={hasParams}
              icon={<Edit2 size={12} />}
              onClick={() => openSubmission(i)}
            >
              {hasParams ? 'View' : 'Enter'}
            </Button>
          </Tooltip>
        )
      },
    },
    {
      title: (
        <span className="flex items-center gap-1">
          <ClipboardCheck size={13} className="text-violet-600" />
          <span>Send for Verif.</span>
        </span>
      ),
      key: 'sfv',
      width: 110,
      render: (_: unknown, row: SampleRow, i: number) => {
        if (!row.atrId && !row.atrFormNo) return null
        return (
          <Checkbox
            checked={row.sendForVerification}
            disabled={readOnly}
            onChange={e => upd(i, { sendForVerification: e.target.checked })}
          />
        )
      },
    },
    {
      title: '', key: 'del', width: 70,
      render: (_: unknown, row: SampleRow, i: number) => (
        <div className="flex items-center gap-1">
          <Tooltip title="Raise ATR from this sample">
            <Button
              type="text"
              size="small"
              icon={<FileText size={12} />}
              className="text-indigo-500 hover:text-indigo-700"
              onClick={() => navigate('/ard/atrs/new', {
                state: { projectCode: row.projectCode, sampleCode: row.sampleCode, batchNo: row.batchNo, sampleType: row.sampleType }
              })}
            />
          </Tooltip>
          <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} />
        </div>
      ),
    },
  ]

  return (
    <>
      {msgCtx}
      <Table
        rowKey="id"
        dataSource={rows}
        columns={cols}
        size="small"
        pagination={false}
        scroll={{ x: 1450 }}
        expandable={{
          onExpand: (_expanded, row) => {
            (row.tests ?? []).forEach(t => { if (t.id) fetchReports(t.id) })
          },
          expandedRowRender: (row: SampleRow, sampleIdx: number) => {
            const allTests = row.tests ?? []
            const assignedTests = allTests.filter(t => t.assignedToName)
            const unassignedTests = allTests.filter(t => !t.assignedToName)
            const testCols = makeTestCols(sampleIdx, row.atrId)
            const saveResult = async (testRow: AtrTestRow, patch: Partial<AtrTestRow>) => {
              const atrId = testRow.atrId || row.atrId
              if (!atrId) return
              const merged = { ...testRow, ...patch }
              updateTest(sampleIdx, testRow.id, patch)
              try {
                await apiPatch(`/api/ard/atrs/${atrId}/tests/${testRow.id}`, {
                  lowerLimit: merged.lowerLimit || '',
                  upperLimit: merged.upperLimit || '',
                  limitsUom: merged.limitsUom || '',
                  resultValue: merged.resultValue || '',
                  resultUom: merged.resultUom || '',
                  resultStatus: merged.resultStatus || '',
                })
              } catch { /* ignore — local state already updated */ }
            }
            const assignedCols: ColumnsType<AtrTestRow> = [
              { title: 'Test Type', dataIndex: 'testType', key: 'testType', width: 110 },
              { title: 'Test Sub-type', dataIndex: 'testSubtype', key: 'testSubtype', width: 120 },
              { title: 'AR Number', dataIndex: 'arNumber', key: 'arNumber', width: 130, render: (v: string) => <span className="font-mono text-xs text-slate-700">{v || '—'}</span> },
              { title: 'Assigned To', dataIndex: 'assignedToName', key: 'assignedToName', width: 110, render: (v: string) => <span className="text-xs font-medium text-slate-700">{v}</span> },
              {
                title: 'Lower Limit', key: 'lowerLimit', width: 90,
                render: (_: unknown, r: AtrTestRow) => readOnly
                  ? <span className="text-xs text-slate-700">{r.lowerLimit || '—'}</span>
                  : <Input size="small" value={r.lowerLimit || ''} placeholder="LL"
                      onChange={e => updateTest(sampleIdx, r.id, { lowerLimit: e.target.value })}
                      onBlur={e => saveResult(r, { lowerLimit: e.target.value })} style={{ width: 80 }} />,
              },
              {
                title: 'Value', key: 'resultValue', width: 100,
                render: (_: unknown, r: AtrTestRow) => readOnly
                  ? <span className="text-xs text-slate-700">{r.resultValue || '—'}</span>
                  : <Input size="small" value={r.resultValue || ''} placeholder="Value"
                      onChange={e => updateTest(sampleIdx, r.id, { resultValue: e.target.value })}
                      onBlur={e => saveResult(r, { resultValue: e.target.value })} style={{ width: 88 }} />,
              },
              {
                title: 'Upper Limit', key: 'upperLimit', width: 90,
                render: (_: unknown, r: AtrTestRow) => readOnly
                  ? <span className="text-xs text-slate-700">{r.upperLimit || '—'}</span>
                  : <Input size="small" value={r.upperLimit || ''} placeholder="UL"
                      onChange={e => updateTest(sampleIdx, r.id, { upperLimit: e.target.value })}
                      onBlur={e => saveResult(r, { upperLimit: e.target.value })} style={{ width: 80 }} />,
              },
              {
                title: 'UOM', key: 'limitsUom', width: 70,
                render: (_: unknown, r: AtrTestRow) => readOnly
                  ? <span className="text-xs text-slate-700">{r.limitsUom || '—'}</span>
                  : <Input size="small" value={r.limitsUom || ''} placeholder="UOM"
                      onChange={e => updateTest(sampleIdx, r.id, { limitsUom: e.target.value })}
                      onBlur={e => saveResult(r, { limitsUom: e.target.value })} style={{ width: 60 }} />,
              },
              {
                title: 'Result', key: 'resultStatus', width: 110,
                render: (_: unknown, r: AtrTestRow) => readOnly
                  ? <span className="text-xs text-slate-700">{r.resultStatus || '—'}</span>
                  : <Select size="small" value={r.resultStatus || undefined} placeholder="Pass/Fail"
                      style={{ width: 100 }}
                      options={[{ value: 'Pass', label: '✓ Pass' }, { value: 'Fail', label: '✗ Fail' }, { value: 'NA', label: 'N/A' }]}
                      onChange={val => saveResult(r, { resultStatus: val })}
                    />,
              },
              {
                title: 'Final Report', key: 'report', width: 200,
                render: (_: unknown, r: AtrTestRow) => {
                  const reports = testReports[r.id] ?? []
                  return (
                    <div className="flex flex-col gap-1">
                      {reports.map(rep => (
                        <a
                          key={rep.id}
                          href={`${BASE_URL}/api${rep.downloadUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-[180px]"
                          title={rep.filename}
                          download={rep.filename}
                        >
                          <FileText size={10} />
                          <span className="truncate">{rep.name || rep.filename}</span>
                        </a>
                      ))}
                      {reports.length === 0 && readOnly && (
                        <span className="text-xs text-slate-400">No report</span>
                      )}
                      {!readOnly && (
                        <>
                          <input
                            id={`report-file-${r.id}`}
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xlsx,.png,.jpg"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file || !r.id) return
                              const fd = new FormData()
                              fd.append('entity_type', 'atr_test')
                              fd.append('entity_id', r.id)
                              fd.append('name', `Report: ${r.arNumber || r.testType}`)
                              fd.append('file', file)
                              try {
                                await apiUpload('/api/ard/uploads', fd)
                                msgApi.success('Report uploaded')
                                await fetchReports(r.id)
                              } catch (err: any) {
                                msgApi.error(err?.message || 'Upload failed')
                              }
                              e.target.value = ''
                            }}
                          />
                          <Button
                            size="small"
                            icon={<FileText size={11} />}
                            type="dashed"
                            onClick={() => document.getElementById(`report-file-${r.id}`)?.click()}
                          >
                            Upload
                          </Button>
                        </>
                      )}
                    </div>
                  )
                },
              },
            ]
            return (
              <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 space-y-3">
                {assignedTests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-violet-700 mb-2">Assigned Tests ({assignedTests.length})</p>
                    <div style={{ maxWidth: 1200, overflowX: 'auto' }}>
                      <Table rowKey="id" dataSource={assignedTests} columns={assignedCols} size="small" pagination={false} scroll={{ x: 1020 }} />
                    </div>
                  </div>
                )}
                {unassignedTests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-2">Unassigned Tests ({unassignedTests.length})</p>
                    <div style={{ maxWidth: 820, overflowX: 'auto' }}>
                      <Table rowKey="id" dataSource={unassignedTests} columns={testCols} size="small" pagination={false} />
                    </div>
                  </div>
                )}
                {allTests.length === 0 && (
                  <span className="text-xs text-slate-400">No tests linked to this sample.</span>
                )}
              </div>
            )
          },
          rowExpandable: (row: SampleRow) => (row.tests?.length ?? 0) > 0,
        }}
        footer={() => (
          !readOnly && (
            <div className="flex items-center gap-2 p-1">
              <Button
                size="small"
                type="primary"
                ghost
                icon={<Plus size={13} />}
                onClick={() => setAtrModalOpen(true)}
              >
                Add ATR Test
              </Button>
              <Button
                size="small"
                type="dashed"
                icon={<Plus size={13} />}
                onClick={() => onChange([...rows, {
                  id: uid(), atrFormNo: '', projectCode: '', sampleCode: '', sampleType: 'Raw Material',
                  testSubtype: '', batchNo: '', sampleCondition: 'Good', qty: '', arNumber: '', status: 'PENDING', remarks: ''
                }])}
              >
                Add Sample
              </Button>
            </div>
          )
        )}
      />

      <Modal
        {...glassModalProps}
        title="Add ATR to Sample Details"
        open={atrModalOpen}
        onCancel={() => setAtrModalOpen(false)}
        footer={null}
        destroyOnClose
        width={680}
      >
        <div className="space-y-3 pt-2">
          {atrsLoading ? (
            <div className="flex justify-center py-6"><Spin /></div>
          ) : (atrsData?.items ?? []).length === 0 ? (
            <Empty description="No ATR forms available" />
          ) : (
            <div className="max-h-[520px] overflow-y-auto space-y-3">
              {(atrsData?.items ?? []).map((atr: any) => {
                const allTests = (atr.samples ?? []).flatMap((s: any) => s.tests ?? [])
                const unassignedCount = allTests.filter((t: any) => !t.assignedToName).length
                return (
                  <div key={atr.id} className="rounded-lg border border-slate-200 hover:border-violet-400 hover:shadow-sm transition overflow-hidden">
                    <div className="flex items-start justify-between px-3 py-2.5 bg-slate-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-indigo-700">{atr.formNo || atr.code}</span>
                          <Tag color="default" className="text-xs !m-0">{atr.formTypeName || atr.testSubtype || 'ATR'}</Tag>
                          {atr.status && <Tag color={atr.status === 'CERTIFIED' ? 'green' : atr.status === 'NEW' ? 'orange' : 'blue'} className="text-xs !m-0">{atr.status}</Tag>}
                        </div>
                        <div className="mt-0.5 flex gap-3 text-xs text-slate-500 flex-wrap">
                          {atr.projectCode && <span>Project: <span className="font-mono">{atr.projectCode}</span></span>}
                          {atr.productName && <span>{atr.productName}</span>}
                          {atr.qcRef && <span>QC Ref: {atr.qcRef}</span>}
                        </div>
                      </div>
                      <Button size="small" type="primary" icon={<Plus size={12} />} onClick={() => handleAddAtr(atr)} className="ml-2 shrink-0">
                        Add
                      </Button>
                    </div>
                    {allTests.length > 0 && (
                      <div className="px-3 py-2 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 mb-1.5">
                          Tests ({allTests.length}) — {unassignedCount} unassigned
                        </p>
                        <div className="divide-y divide-slate-100 rounded-md border border-slate-100 overflow-hidden">
                          {allTests.map((t: any, ti: number) => (
                            <div key={ti} className="flex items-center justify-between gap-3 text-xs bg-white px-2 py-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                <span className="font-medium text-slate-700 truncate">
                                  {t.testType || t.techniqueCode || `Test ${ti + 1}`}
                                </span>
                                {t.testSubtype && <span className="text-slate-400 truncate">· {t.testSubtype}</span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {t.assignedToName && <span className="text-slate-400">→ {t.assignedToName}</span>}
                                {t.arNumber
                                  ? <span className="font-mono text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">{t.arNumber}</span>
                                  : <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">No AR#</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ── ATR Result Submission Modal ─────────────────────────────────────── */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-violet-600" />
            <span>ATR Test Results — {rows[submissionIdx]?.atrFormNo || rows[submissionIdx]?.sampleCode || 'Sample'}</span>
          </div>
        }
        open={submissionOpen}
        onCancel={() => setSubmissionOpen(false)}
        onOk={handleSaveSubmission}
        okText="Save Results"
        okButtonProps={{ className: 'bg-violet-600 hover:bg-violet-700 border-none' }}
        width={820}
        destroyOnClose
      >
        <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 rounded-lg text-xs">
          <div>
            <span className="font-semibold text-slate-500 block">ATR Form No.</span>
            <span className="font-mono text-slate-800">{rows[submissionIdx]?.atrFormNo || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block">Sample Code</span>
            <span className="text-slate-800">{rows[submissionIdx]?.sampleCode || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block">Test Type / Sub-type</span>
            <span className="text-slate-800">{rows[submissionIdx]?.testSubtype || '—'}</span>
          </div>
        </div>

        <Divider className="my-3" />

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Test Result Parameters</span>
            <Button size="small" icon={<Plus size={12} />} onClick={openAddRParam} type="dashed">
              Add Parameter
            </Button>
          </div>
          {submForm.resultParams.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-2">No parameters added yet. Click "Add Parameter" to begin.</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="text-left p-2 border border-slate-200 font-semibold">Parameter</th>
                  <th className="text-left p-2 border border-slate-200 font-semibold">Specification</th>
                  <th className="text-left p-2 border border-slate-200 font-semibold">Value</th>
                  <th className="text-left p-2 border border-slate-200 font-semibold">UOM</th>
                  <th className="text-left p-2 border border-slate-200 font-semibold">P / F</th>
                  <th className="p-2 border border-slate-200 font-semibold w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {submForm.resultParams.map((p, pi) => (
                  <tr key={p.id} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2 border border-slate-200 font-medium text-slate-800">{p.paramName}</td>
                    <td className="p-2 border border-slate-200">
                      {p.resultType === 'TEXT'
                        ? <span>{p.textSpec || '—'}</span>
                        : <span>{p.lowerLimit && p.upperLimit ? `${p.lowerLimit} – ${p.upperLimit}` : p.lowerLimit ? `> ${p.lowerLimit}` : p.upperLimit ? `< ${p.upperLimit}` : '—'}</span>
                      }
                    </td>
                    <td className="p-2 border border-slate-200">{p.paramValue || '—'}</td>
                    <td className="p-2 border border-slate-200">{p.paramUom || '—'}</td>
                    <td className="p-2 border border-slate-200">
                      {p.resultType === 'TEXT' ? (
                        <Radio.Group
                          size="small"
                          value={p.complies}
                          onChange={e => {
                            const ps = submForm.resultParams.slice()
                            ps[pi] = { ...ps[pi], complies: e.target.value }
                            setSubmForm(f => ({ ...f, resultParams: ps }))
                          }}
                        >
                          <Radio value="P" className="text-xs">P</Radio>
                          <Radio value="F" className="text-xs">F</Radio>
                        </Radio.Group>
                      ) : (
                        <Select
                          size="small"
                          style={{ width: 70 }}
                          value={p.complies || undefined}
                          allowClear
                          options={[{ value: 'P', label: 'Pass' }, { value: 'F', label: 'Fail' }]}
                          onChange={val => {
                            const ps = submForm.resultParams.slice()
                            ps[pi] = { ...ps[pi], complies: val ?? '' }
                            setSubmForm(f => ({ ...f, resultParams: ps }))
                          }}
                        />
                      )}
                    </td>
                    <td className="p-2 border border-slate-200">
                      <div className="flex items-center gap-1 justify-center">
                        <Button type="text" size="small" icon={<Edit2 size={11} />} className="text-blue-500" onClick={() => openEditRParam(pi)} />
                        <Popconfirm title="Remove this parameter?" onConfirm={() => removeRParam(pi)}>
                          <Button type="text" size="small" danger icon={<Trash2 size={11} />} />
                        </Popconfirm>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Divider className="my-3" />

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Result Remarks</label>
            <Input.TextArea
              rows={3}
              value={submForm.resultRemarks}
              onChange={e => setSubmForm(f => ({ ...f, resultRemarks: e.target.value }))}
              placeholder="Enter result remarks..."
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">AD Remarks</label>
            <Input.TextArea
              rows={2}
              value={submForm.adRemarks}
              onChange={e => setSubmForm(f => ({ ...f, adRemarks: e.target.value }))}
              placeholder="Additional remarks..."
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={submForm.sendForVerification}
              onChange={e => setSubmForm(f => ({ ...f, sendForVerification: e.target.checked }))}
            >
              <span className="text-sm font-medium text-violet-700">Send for Verification</span>
            </Checkbox>
          </div>
        </div>
      </Modal>

      {/* ── Add / Edit Result Parameter Dialog ─────────────────────────── */}
      <Modal
        title={editingRParamIdx !== null ? 'Edit Parameter' : 'Add Result Parameter'}
        open={rParamDlgOpen}
        onCancel={() => setRParamDlgOpen(false)}
        onOk={handleSaveRParam}
        okText="Save"
        destroyOnClose
        width={460}
      >
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Parameter Name <span className="text-red-500">*</span></label>
            <Input
              placeholder="e.g. Assay, Water Content"
              value={rParamForm.paramName}
              disabled={editingRParamIdx !== null}
              onChange={e => setRParamForm(f => ({ ...f, paramName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Result Type</label>
            <Select
              style={{ width: '100%' }}
              value={rParamForm.resultType}
              options={[{ value: 'NUMBER', label: 'Numeric' }, { value: 'TEXT', label: 'Text' }]}
              onChange={v => setRParamForm(f => ({ ...f, resultType: v as 'NUMBER' | 'TEXT', textSpec: '', lowerLimit: '', upperLimit: '', paramUom: '' }))}
            />
          </div>
          {rParamForm.resultType === 'TEXT' ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Specification</label>
              <Input placeholder="Text specification" value={rParamForm.textSpec} onChange={e => setRParamForm(f => ({ ...f, textSpec: e.target.value }))} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Lower Limit</label>
                <Input type="number" placeholder="e.g. 98.0" value={rParamForm.lowerLimit} onChange={e => setRParamForm(f => ({ ...f, lowerLimit: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Upper Limit</label>
                <Input type="number" placeholder="e.g. 102.0" value={rParamForm.upperLimit} onChange={e => setRParamForm(f => ({ ...f, upperLimit: e.target.value }))} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Value</label>
              <Input placeholder="Observed value" value={rParamForm.paramValue} onChange={e => setRParamForm(f => ({ ...f, paramValue: e.target.value }))} />
            </div>
            {rParamForm.resultType === 'NUMBER' && (
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">UOM</label>
                <Input placeholder="e.g. %, mg/mL" value={rParamForm.paramUom} onChange={e => setRParamForm(f => ({ ...f, paramUom: e.target.value }))} />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

// ── Section: weighing ─────────────────────────────────────────────────────────
interface WeighingRow { id: string; particulars: string; netWt: string; netUom: string; tareWt: string; tareUom: string; grossWt: string; grossUom: string; startDate: string; endDate: string; instrumentId: string; weighedBy: string; remarks: string }
const WT_UOM = ['mg', 'g', 'kg', 'µg'].map(v => ({ value: v, label: v }))

function WeighingSection({ value, onChange, readOnly }: {
  value: WeighingRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const upd = (i: number, patch: Partial<WeighingRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  const cols: ColumnsType<WeighingRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    { title: 'Particulars *', dataIndex: 'particulars', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { particulars: val })} readOnly={readOnly} placeholder="Required" /> },
    {
      title: 'Net Wt', key: 'net', width: 160,
      render: (_, r, i) => (
        <div className="flex gap-1">
          <Input size="small" value={r.netWt ?? ''} onChange={e => upd(i, { netWt: e.target.value })} className="w-20" disabled={readOnly} />
          {readOnly ? <span className="text-xs">{r.netUom}</span> :
            <Select size="small" value={r.netUom || undefined} onChange={v => upd(i, { netUom: v })} options={WT_UOM} className="w-16" />}
        </div>
      ),
    },
    {
      title: 'Tare Wt', key: 'tare', width: 160,
      render: (_, r, i) => (
        <div className="flex gap-1">
          <Input size="small" value={r.tareWt ?? ''} onChange={e => upd(i, { tareWt: e.target.value })} className="w-20" disabled={readOnly} />
          {readOnly ? <span className="text-xs">{r.tareUom}</span> :
            <Select size="small" value={r.tareUom || undefined} onChange={v => upd(i, { tareUom: v })} options={WT_UOM} className="w-16" />}
        </div>
      ),
    },
    {
      title: 'Gross Wt', key: 'gross', width: 160,
      render: (_, r, i) => (
        <div className="flex gap-1">
          <Input size="small" value={r.grossWt ?? ''} onChange={e => upd(i, { grossWt: e.target.value })} className="w-20" disabled={readOnly} />
          {readOnly ? <span className="text-xs">{r.grossUom}</span> :
            <Select size="small" value={r.grossUom || undefined} onChange={v => upd(i, { grossUom: v })} options={WT_UOM} className="w-16" />}
        </div>
      ),
    },
    { title: 'Start Date', dataIndex: 'startDate', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { startDate: val })} readOnly={readOnly} /> },
    { title: 'End Date', dataIndex: 'endDate', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { endDate: val })} readOnly={readOnly} /> },
    { title: 'Instrument ID', dataIndex: 'instrumentId', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { instrumentId: val })} readOnly={readOnly} /> },
    { title: 'Weighed By', dataIndex: 'weighedBy', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { weighedBy: val })} readOnly={readOnly} /> },
    { title: 'Remarks', dataIndex: 'remarks', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { remarks: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 1200 }}
    footer={() => <AddRowFooter label="Add weighing entry" onAdd={() => onChange([...rows, { id: uid(), particulars: '', netWt: '', netUom: 'g', tareWt: '', tareUom: 'g', grossWt: '', grossUom: 'g', startDate: '', endDate: '', instrumentId: '', weighedBy: '', remarks: '' }])} readOnly={readOnly} />} />
}

// ── Section: ph ───────────────────────────────────────────────────────────────
interface PhRow { id: string; particulars: string; observedPh: string; temperature: string; dateTime: string; instrumentId: string; readBy: string; electrodeUsed: string }

function PhSection({ value, onChange, readOnly }: {
  value: PhRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const upd = (i: number, patch: Partial<PhRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  const cols: ColumnsType<PhRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    { title: 'Particulars *', dataIndex: 'particulars', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { particulars: val })} readOnly={readOnly} placeholder="Required" /> },
    { title: 'Observed pH', dataIndex: 'observedPh', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { observedPh: val })} readOnly={readOnly} placeholder="e.g. 7.2" /> },
    { title: 'Temperature (°C)', dataIndex: 'temperature', width: 140, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { temperature: val })} readOnly={readOnly} placeholder="e.g. 25" /> },
    { title: 'Date/Time', dataIndex: 'dateTime', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { dateTime: val })} readOnly={readOnly} /> },
    { title: 'Instrument ID', dataIndex: 'instrumentId', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { instrumentId: val })} readOnly={readOnly} /> },
    { title: 'Read By', dataIndex: 'readBy', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { readBy: val })} readOnly={readOnly} /> },
    { title: 'Electrode Used', dataIndex: 'electrodeUsed', width: 120, render: (v, _, i) => (
      <SelectCell value={v} onChange={val => upd(i, { electrodeUsed: val })} readOnly={readOnly}
        options={[{ value: 'YES', label: 'YES' }, { value: 'NO', label: 'NO' }]} placeholder="YES/NO" />
    ) },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 900 }}
    footer={() => <AddRowFooter label="Add pH entry" onAdd={() => onChange([...rows, { id: uid(), particulars: '', observedPh: '', temperature: '', dateTime: '', instrumentId: '', readBy: '', electrodeUsed: '' }])} readOnly={readOnly} />} />
}

// ── Section: equipment ────────────────────────────────────────────────────────
interface EquipRow { id: string; instrumentType: string; instrumentName: string; instrumentCode: string; maintenanceStatus: string; calibrationStatus: string; startTime: string; endTime: string; remarks: string }
const CAL_STATUSES = ['CALIBRATED', 'DUE', 'EXPIRED', 'NOT_REQUIRED'].map(v => ({ value: v, label: v.replace(/_/g, ' ') }))

function EquipmentSection({ value, onChange, readOnly }: {
  value: EquipRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const { data: instruments } = useQuery({
    queryKey: ['inv-instruments-catalogue'],
    queryFn: inventoryApi.catalogues.instruments.list,
  })

  const upd = (i: number, patch: Partial<EquipRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }

  const handleSelectInstrument = (i: number, assetId: string) => {
    const found = instruments?.find(ins => ins.asset_id === assetId)
    if (!found) return
    upd(i, {
      instrumentCode: found.asset_id,
      instrumentName: found.name,
      instrumentType: found.make || found.usage_type || 'Instrument',
      calibrationStatus: found.calibration_status || 'CALIBRATED',
      maintenanceStatus: found.status || 'ACTIVE',
    })
  }

  const cols: ColumnsType<EquipRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Inventory Asset Select', width: 220,
      render: (_, r, i) => (
        readOnly ? <span className="text-xs font-mono">{r.instrumentCode || '—'}</span> : (
          <Select
            size="small"
            showSearch
            placeholder="Select from Inventory..."
            className="w-full"
            value={r.instrumentCode || undefined}
            onChange={val => handleSelectInstrument(i, val)}
            options={(instruments ?? []).map(ins => ({
              value: ins.asset_id,
              label: `${ins.asset_id} — ${ins.name} (${ins.calibration_status || 'Active'})`,
            }))}
          />
        )
      ),
    },
    { title: 'Type', dataIndex: 'instrumentType', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { instrumentType: val })} readOnly={readOnly} placeholder="e.g. HPLC" /> },
    { title: 'Name', dataIndex: 'instrumentName', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { instrumentName: val })} readOnly={readOnly} /> },
    { title: 'Code / ID', dataIndex: 'instrumentCode', width: 110, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { instrumentCode: val })} readOnly={readOnly} /> },
    { title: 'Maintenance', dataIndex: 'maintenanceStatus', width: 120, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { maintenanceStatus: val })} readOnly={readOnly} options={CAL_STATUSES} /> },
    {
      title: 'Calibration', dataIndex: 'calibrationStatus', width: 130,
      render: (v, _, i) => (
        <div className="flex items-center gap-1">
          <SelectCell value={v} onChange={val => upd(i, { calibrationStatus: val })} readOnly={readOnly} options={CAL_STATUSES} />
          {v === 'EXPIRED' && <Tag color="error" icon={<ShieldAlert size={10} className="inline mr-1" />}>EXPIRED</Tag>}
          {v === 'DUE' && <Tag color="warning">DUE</Tag>}
        </div>
      ),
    },
    { title: 'Start Time', dataIndex: 'startTime', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { startTime: val })} readOnly={readOnly} /> },
    { title: 'End Time', dataIndex: 'endTime', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { endTime: val })} readOnly={readOnly} /> },
    { title: 'Remarks', dataIndex: 'remarks', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { remarks: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 1250 }}
    footer={() => <AddRowFooter label="Add equipment" onAdd={() => onChange([...rows, { id: uid(), instrumentType: '', instrumentName: '', instrumentCode: '', maintenanceStatus: '', calibrationStatus: '', startTime: '', endTime: '', remarks: '' }])} readOnly={readOnly} />} />
}

// ── Section: column ───────────────────────────────────────────────────────────
interface ColumnRow { id: string; columnNumber: string; columnName: string; description: string; dimension: string; manufacturer: string; noOfInjections: string; cumulativeInjections: string; startTime: string; endTime: string }

function ColumnSection({ value, onChange, readOnly }: {
  value: ColumnRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const { data: columnsData } = useQuery({
    queryKey: ['inv-columns-catalogue'],
    queryFn: inventoryApi.catalogues.columns.list,
  })

  const upd = (i: number, patch: Partial<ColumnRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }

  const handleSelectColumn = (i: number, colId: string) => {
    const found = columnsData?.find(c => c.column_id === colId)
    if (!found) return
    upd(i, {
      columnNumber: found.column_id,
      columnName: found.name,
      cumulativeInjections: String(found.cumulative_injections ?? 0),
    })
  }

  const cols: ColumnsType<ColumnRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Inventory Column Select', width: 200,
      render: (_, r, i) => (
        readOnly ? <span className="text-xs font-mono">{r.columnNumber || '—'}</span> : (
          <Select
            size="small"
            showSearch
            placeholder="Select column..."
            className="w-full"
            value={r.columnNumber || undefined}
            onChange={val => handleSelectColumn(i, val)}
            options={(columnsData ?? []).map(col => ({
              value: col.column_id,
              label: `${col.column_id} — ${col.name}`,
            }))}
          />
        )
      ),
    },
    { title: 'Column No.', dataIndex: 'columnNumber', width: 110, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { columnNumber: val })} readOnly={readOnly} /> },
    { title: 'Column Name', dataIndex: 'columnName', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { columnName: val })} readOnly={readOnly} /> },
    { title: 'Description', dataIndex: 'description', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { description: val })} readOnly={readOnly} /> },
    { title: 'Dimension', dataIndex: 'dimension', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { dimension: val })} readOnly={readOnly} placeholder="e.g. 150×4.6mm" /> },
    { title: 'Manufacturer', dataIndex: 'manufacturer', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { manufacturer: val })} readOnly={readOnly} /> },
    { title: 'No. of Injections', dataIndex: 'noOfInjections', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { noOfInjections: val })} readOnly={readOnly} /> },
    { title: 'Cumulative', dataIndex: 'cumulativeInjections', width: 110, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { cumulativeInjections: val })} readOnly={readOnly} /> },
    { title: 'Start Time', dataIndex: 'startTime', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { startTime: val })} readOnly={readOnly} /> },
    { title: 'End Time', dataIndex: 'endTime', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { endTime: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 1350 }}
    footer={() => <AddRowFooter label="Add column" onAdd={() => onChange([...rows, { id: uid(), columnNumber: '', columnName: '', description: '', dimension: '', manufacturer: '', noOfInjections: '', cumulativeInjections: '', startTime: '', endTime: '' }])} readOnly={readOnly} />} />
}

// ── Section: material ─────────────────────────────────────────────────────────
interface MaterialRow { id: string; batchId?: number; chemicalName: string; specs: string; vendor: string; batchNo: string; materialType: string; materialCode: string; expiryDate: string; qty: string; uom: string; remarks: string }
const MAT_UOMS = ['mg', 'g', 'kg', 'ml', 'L', 'µg', 'µL'].map(v => ({ value: v, label: v }))
const MAT_TYPES = ['Reference Standard', 'Reagent', 'Solvent', 'API', 'Excipient', 'Other'].map(v => ({ value: v, label: v }))

function MaterialSection({ value, onChange, readOnly }: {
  value: MaterialRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const { data: batchStock } = useQuery({
    queryKey: ['inv-available-batches'],
    queryFn: () => inventoryApi.batches.list({ expand_packs: 1 }),
  })

  const upd = (i: number, patch: Partial<MaterialRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }

  const handleSelectBatch = (i: number, batchId: number) => {
    const found = batchStock?.find(b => b.id === batchId)
    if (!found) return
    upd(i, {
      batchId: found.id,
      chemicalName: found.material_name || '',
      batchNo: found.batch_no,
      materialCode: found.inhouse_batch_no || String(found.material_id),
      vendor: found.manufacturer_name || '',
      expiryDate: found.expiry_date || '',
      uom: found.unit || 'g',
    })
  }

  const cols: ColumnsType<MaterialRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    {
      title: 'Inventory Stock Lot Select', width: 220,
      render: (_, r, i) => (
        readOnly ? <span className="text-xs font-mono">{r.batchNo ? `Batch #${r.batchNo}` : '—'}</span> : (
          <Select
            size="small"
            showSearch
            placeholder="Select Inventory Lot..."
            className="w-full"
            value={r.batchId}
            onChange={val => handleSelectBatch(i, val)}
            options={(batchStock ?? []).map(b => ({
              value: b.id,
              label: `${b.material_name || 'Material'} — Batch #${b.batch_no} (${b.qty_available} ${b.unit})`,
            }))}
          />
        )
      ),
    },
    { title: 'Chemical Name *', dataIndex: 'chemicalName', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { chemicalName: val })} readOnly={readOnly} placeholder="Required" /> },
    { title: 'Specs / Grade', dataIndex: 'specs', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { specs: val })} readOnly={readOnly} placeholder="e.g. AR grade" /> },
    { title: 'Vendor', dataIndex: 'vendor', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { vendor: val })} readOnly={readOnly} /> },
    { title: 'Batch/Lot No.', dataIndex: 'batchNo', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { batchNo: val })} readOnly={readOnly} /> },
    { title: 'Material Type', dataIndex: 'materialType', width: 140, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { materialType: val })} readOnly={readOnly} options={MAT_TYPES} /> },
    { title: 'Material Code', dataIndex: 'materialCode', width: 120, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { materialCode: val })} readOnly={readOnly} /> },
    { title: 'Expiry Date', dataIndex: 'expiryDate', width: 130, render: (v, _, i) => (
      readOnly ? <span>{v || '—'}</span> :
      <DatePicker size="small" value={v ? dayjs(v) : undefined} onChange={d => upd(i, { expiryDate: d ? d.format('YYYY-MM-DD') : '' })} format="DD MMM YYYY" className="w-full" />
    )},
    {
      title: 'Qty', key: 'qty', width: 140,
      render: (_, r, i) => (
        <div className="flex gap-1">
          <Input size="small" value={r.qty ?? ''} onChange={e => upd(i, { qty: e.target.value })} className="w-16" disabled={readOnly} />
          {readOnly ? <span className="text-xs">{r.uom}</span> :
            <Select size="small" value={r.uom || undefined} onChange={v => upd(i, { uom: v })} options={MAT_UOMS} className="w-16" />}
        </div>
      ),
    },
    { title: 'Remarks', dataIndex: 'remarks', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { remarks: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 1450 }}
    footer={() => <AddRowFooter label="Add material" onAdd={() => onChange([...rows, { id: uid(), chemicalName: '', specs: '', vendor: '', batchNo: '', materialType: '', materialCode: '', expiryDate: '', qty: '', uom: 'g', remarks: '' }])} readOnly={readOnly} />} />
}

// ── Section: quantitative ─────────────────────────────────────────────────────
interface QuantRow { id: string; code: string; parameterName: string; inputOutput: string; valueType: string; formula: string; resultType: string; value: string; uom: string }
const IO_OPT = [{ value: 'INPUT', label: 'Input' }, { value: 'OUTPUT', label: 'Output' }]
const VAL_TYPES = [{ value: 'USER_ENTERED', label: 'User Entered' }, { value: 'FORMULA', label: 'Formula' }]
const RESULT_TYPES = ['NUMERIC', 'TEXT', 'PASS_FAIL', 'COMPLIES_NC'].map(v => ({ value: v, label: v.replace(/_/g, '/') }))

function QuantitativeSection({ value, onChange, readOnly }: {
  value: QuantRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const upd = (i: number, patch: Partial<QuantRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  const cols: ColumnsType<QuantRow> = [
    { title: 'Code *', dataIndex: 'code', width: 80,
      render: (v, _, i) => readOnly ? <span className="font-mono text-xs">{v}</span> :
        <Input size="small" value={v ?? ''} onChange={e => upd(i, { code: e.target.value.toUpperCase().slice(0, 3) })} maxLength={3} placeholder="A1" /> },
    { title: 'Parameter Name *', dataIndex: 'parameterName', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { parameterName: val })} readOnly={readOnly} placeholder="Required" /> },
    { title: 'Input/Output', dataIndex: 'inputOutput', width: 120, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { inputOutput: val })} readOnly={readOnly} options={IO_OPT} /> },
    { title: 'Value Type', dataIndex: 'valueType', width: 140, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { valueType: val })} readOnly={readOnly} options={VAL_TYPES} /> },
    { title: 'Formula', dataIndex: 'formula', width: 160,
      render: (v, r, i) => {
        if (readOnly) return <span className="font-mono text-xs">{v || '—'}</span>
        if (r.valueType !== 'FORMULA') return <span className="text-slate-300 text-xs">—</span>
        return <Input size="small" value={v ?? ''} onChange={e => upd(i, { formula: e.target.value })} placeholder="e.g. A1/A2*100" />
      }
    },
    { title: 'Result Type', dataIndex: 'resultType', width: 140, render: (v, _, i) => <SelectCell value={v} onChange={val => upd(i, { resultType: val })} readOnly={readOnly} options={RESULT_TYPES} /> },
    { title: 'Result Value *', dataIndex: 'value', width: 130, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { value: val })} readOnly={readOnly} placeholder="Enter result" /> },
    { title: 'UOM', dataIndex: 'uom', width: 90, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { uom: val })} readOnly={readOnly} placeholder="%" /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false} scroll={{ x: 1100 }}
    footer={() => <AddRowFooter label="Add parameter" onAdd={() => onChange([...rows, { id: uid(), code: '', parameterName: '', inputOutput: 'OUTPUT', valueType: 'USER_ENTERED', formula: '', resultType: 'NUMERIC', value: '', uom: '' }])} readOnly={readOnly} />} />
}

// ── Section: further-action ───────────────────────────────────────────────────
interface FurtherActionRow { id: string; observation: string; createdBy: string; createdOn: string }

function FurtherActionSection({ value, onChange, readOnly }: {
  value: FurtherActionRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows = value ?? []
  const upd = (i: number, patch: Partial<FurtherActionRow>) => {
    const next = rows.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  const cols: ColumnsType<FurtherActionRow> = [
    { title: '#', key: 'sl', width: 40, render: (_, __, i) => i + 1 },
    { title: 'Observation *', dataIndex: 'observation', render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { observation: val })} readOnly={readOnly} placeholder="Describe observation / further action" /> },
    { title: 'Created By', dataIndex: 'createdBy', width: 150, render: (v, _, i) => <Cell value={v} onChange={val => upd(i, { createdBy: val })} readOnly={readOnly} /> },
    { title: 'Created On', dataIndex: 'createdOn', width: 160, render: (v, _, i) => <DateCell value={v} onChange={val => upd(i, { createdOn: val })} readOnly={readOnly} /> },
    { title: '', key: 'del', width: 40, render: (_, __, i) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false}
    footer={() => <AddRowFooter label="Add observation" onAdd={() => onChange([...rows, { id: uid(), observation: '', createdBy: '', createdOn: new Date().toISOString() }])} readOnly={readOnly} />} />
}

// ── Section: dataitem ─────────────────────────────────────────────────────────
interface DataItem { id: string; label: string; value: string; fieldType: string }

function DataItemSection({ value, onChange, readOnly }: {
  value: DataItem[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const items = value ?? []
  const upd = (i: number, patch: Partial<DataItem>) => {
    const next = items.slice(); next[i] = { ...next[i], ...patch }; onChange(next)
  }
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-start gap-3">
          {!readOnly && <Cell value={item.label} onChange={val => upd(i, { label: val })} readOnly={false} placeholder="Field label" />}
          {readOnly && <span className="text-sm font-medium text-slate-600 w-40 shrink-0">{item.label}</span>}
          {item.fieldType === 'long' ? (
            <Input.TextArea rows={3} value={item.value ?? ''} onChange={e => upd(i, { value: e.target.value })} disabled={readOnly} className="flex-1" />
          ) : (
            <Input value={item.value ?? ''} onChange={e => upd(i, { value: e.target.value })} disabled={readOnly} className="flex-1" />
          )}
          {!readOnly && (
            <Popconfirm title="Remove field?" onConfirm={() => onChange(items.filter((_, j) => j !== i))}>
              <Button type="text" danger size="small" icon={<Trash2 size={12} />} />
            </Popconfirm>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex gap-2">
          <Button size="small" icon={<Plus size={12} />} onClick={() => onChange([...items, { id: uid(), label: '', value: '', fieldType: 'short' }])}>Short field</Button>
          <Button size="small" icon={<Plus size={12} />} onClick={() => onChange([...items, { id: uid(), label: '', value: '', fieldType: 'long' }])}>Long field</Button>
        </div>
      )}
    </div>
  )
}

// ── Section: preconfigured-excel ──────────────────────────────────────────────
interface ExcelRow { id: string; [col: string]: string }

function PreconfiguredExcelSection({ section, value, onChange, readOnly }: {
  section: SectionDef; value: ExcelRow[]; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const rows: ExcelRow[] = value ?? []
  const colDefs: string[] = (section as unknown as { columns?: string[] }).columns ?? ['Value']
  const upd = (i: number, col: string, val: string) => {
    const n = rows.slice(); n[i] = { ...n[i], [col]: val }; onChange(n)
  }
  const cols: ColumnsType<ExcelRow> = [
    { title: '#', key: 'sl', width: 36, render: (_, __, i) => i + 1 },
    ...colDefs.map(col => ({
      title: col, dataIndex: col,
      render: (v: string, _: ExcelRow, i: number) => <Cell value={v ?? ''} onChange={val => upd(i, col, val)} readOnly={readOnly} />,
    })),
    { title: '', key: 'del', width: 40, render: (_: unknown, __: ExcelRow, i: number) => <RowActions onDelete={() => onChange(rows.filter((_, j) => j !== i))} readOnly={readOnly} /> },
  ]
  const emptyRow = (): ExcelRow => ({ id: uid(), ...Object.fromEntries(colDefs.map(c => [c, ''])) })
  return <Table rowKey="id" dataSource={rows} columns={cols} size="small" pagination={false}
    footer={() => <AddRowFooter label="Add row" onAdd={() => onChange([...rows, emptyRow()])} readOnly={readOnly} />} />
}

import { ErrorBoundary } from '../ErrorBoundary'

// ── Section: content_block ────────────────────────────────────────────────────
function ContentBlockSection({ section, value, onChange, readOnly }: {
  section: SectionDef; value: unknown; onChange: (v: unknown) => void; readOnly: boolean
}) {
  const contentBlockId = (section as any).contentBlockId as string | undefined
  const allowEdit = (section as any).allowEdit !== false
  const editable = !readOnly && allowEdit

  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
    staleTime: 5 * 60 * 1000,
  })

  const block = masterData?.contentBlocks?.find(b => b.id === contentBlockId)

  // Seed from library body on first render when section has no saved value yet
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    if (!seeded && block?.body && (value === undefined || value === null || value === '')) {
      onChange(block.body)
      setSeeded(true)
    }
  }, [block?.body, seeded, value, onChange])

  const html = typeof value === 'string' && value ? value : (block?.body ?? '')
  const displayHeight = block?.displayHeight ?? 250

  if (!contentBlockId) {
    return (
      <div className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded border border-slate-200">
        No content block linked to this section.
      </div>
    )
  }

  return (
    <RichEditor
      value={html}
      onChange={editable ? onChange : () => {}}
      readOnly={!editable}
      height={displayHeight}
    />
  )
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
export default function ExperimentSectionRenderer({ section, data, onChange, readOnly, projectId, onSave, isSaving }: {
  section: SectionDef
  data: Record<string, unknown>
  onChange: (sectionId: string, value: unknown) => void
  readOnly: boolean
  projectId?: string
  onSave?: () => void
  isSaving?: boolean
}) {
  if (!section) return null
  const sectionId = section.id || 'sec-default'
  const value = data ? data[sectionId] : undefined
  const change = (v: unknown) => onChange(sectionId, v)
  const secType = (section.type || '').toLowerCase().replace(/-/g, '_')

  const renderSectionContent = () => {
    switch (secType) {
      case 'text':
      case 'free_text':
      case 'freetext':
        return (
          <Input.TextArea
            rows={5}
            disabled={readOnly}
            placeholder="Enter observations, notes, or free text…"
            value={typeof value === 'string' ? value : (value == null ? '' : JSON.stringify(value))}
            onChange={e => change(e.target.value)}
            className="font-mono text-sm"
          />
        )

      case 'richtext':
      case 'conclusion':
      // Authored identically to richtext in the Sections library (Configuration
      // → Sections groups both under RICHTEXT_TYPES, same defaultContent/
      // editorHeight shape) — rendering it as an unrelated structured
      // component/CAS-No./purity table here discarded whatever was actually
      // authored. See StandardPrepSection below, now unused by this path.
      case 'standard_preparation':
        return (
          <RichtextSection
            value={typeof value === 'string' ? value : (value == null ? '' : JSON.stringify(value))}
            onChange={change}
            readOnly={readOnly}
            height={section.editorHeight ?? undefined}
          />
        )

      case 'params':
        return <ParamsSection section={section} value={value as Record<string, string> | { id: string; parameter: string; value: string; uom: string }[] | undefined} onChange={change} readOnly={readOnly} />

      case 'table':
        return <TableSection section={section} value={Array.isArray(value) ? (value as Record<string, string>[]) : []} onChange={change} readOnly={readOnly} />

      case 'combined':
        return (
          <div className="space-y-4">
            {(section.children ?? []).map(child => (
              <div key={child.id}>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{child.title}</p>
                <ExperimentSectionRenderer section={child} data={data} onChange={onChange} readOnly={readOnly} projectId={projectId} />
              </div>
            ))}
          </div>
        )

      case 'sample':
      case 'sample_details':
        return <SampleSection value={Array.isArray(value) ? (value as SampleRow[]) : []} onChange={change} readOnly={readOnly} projectId={projectId} />

      case 'weighing':
      case 'weighing_electronic':
        return <WeighingSection value={Array.isArray(value) ? (value as WeighingRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'ph':
      case 'ph_electronic':
        return <PhSection value={Array.isArray(value) ? (value as PhRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'equipment':
        return <EquipmentSection value={Array.isArray(value) ? (value as EquipRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'column':
        return <ColumnSection value={Array.isArray(value) ? (value as ColumnRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'material':
      case 'chemical':
        return <MaterialSection value={Array.isArray(value) ? (value as MaterialRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'quantitative':
      case 'quantitative_result':
      case 'results':
        return <QuantitativeSection value={Array.isArray(value) ? (value as QuantRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'further_action':
      case 'further_actions':
        return <FurtherActionSection value={Array.isArray(value) ? (value as FurtherActionRow[]) : []} onChange={change} readOnly={readOnly} />

      case 'dataitem':
      case 'data_item':
      case 'autocomplete_data_item':
        return <DataItemSection value={Array.isArray(value) ? (value as DataItem[]) : []} onChange={change} readOnly={readOnly} />

      case 'spreadsheet':
      case 'excel':
      case 'excel_embed':
      case 'preconfigured_excel':
        // Genuine two-way persistence via `value`/`change` (same round-trip
        // every other section type uses) — the previous UniverSheetField
        // here had no value/onChange at all, so anything typed into it was
        // lost the moment the component unmounted.
        return (
          <SpreadsheetFieldRuntime
            spreadsheet={section.spreadsheet}
            value={value as Record<string, unknown> | undefined}
            onChange={change}
            disabled={readOnly}
          />
        )

      case 'content_block':
        return <ContentBlockSection section={section} value={value} onChange={change} readOnly={readOnly} />

      default:
        return (
          <div className="text-slate-400 text-sm italic space-y-1">
            <p>Section type <code className="bg-slate-100 px-1 rounded">{section.type || 'unknown'}</code> — raw JSON editor:</p>
            <Input.TextArea rows={3} disabled={readOnly}
              value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
              onChange={e => { try { change(JSON.parse(e.target.value)) } catch { /* ignore until valid */ } }}
            />
          </div>
        )
    }
  }

  return (
    <ErrorBoundary fallbackMessage={`Error rendering section "${section.title || 'Section'}"`}>
      {renderSectionContent()}
      {/* Parent already passes onSave/isSaving down to every section (Tabbed
          and Single Page View both wire this up) — previously declared here
          but never rendered, so there was no per-section save affordance,
          only the page-wide "unsaved changes" banner. Matches the explicit
          Save button every fixed block (Aim, Conclusion) already has. */}
      {!readOnly && onSave && (
        <div className="pt-2 flex justify-end">
          <Button size="small" type="primary" icon={<Save size={13} />} loading={!!isSaving} onClick={onSave}>
            Save Section
          </Button>
        </div>
      )}
    </ErrorBoundary>
  )
}
