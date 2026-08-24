import { Fragment, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Modal, Form, Select, Input, Checkbox, InputNumber, DatePicker,
  message, Tag, Popconfirm, Spin, Divider,
} from 'antd'
import { FileSearch, Plus, Trash2, Upload as UploadIcon, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { ardApi, ardAtrApi, ardTeamApi, type AtrForm, type AtrSample, type ArdTeamDirectoryItem } from '../../../api/ard'
import { experimentApi, type ExperimentFile } from '../../../api/adc'
import { uomApi, type UomUnit } from '../../../api/inventory'
import TestFinalReportLink from '../../../components/ard/TestFinalReportLink'
import { glassModalProps } from '../../../utils/modalStyles'
import BrandSpinner from '../../../components/ui/BrandSpinner'
import { EmptyValue, EMPTY_VALUE_TEXT, withEmptyValue } from '../../../components/ui/EmptyValue'
import { useAppSelector } from '../../../store'
import { selectUser } from '../../../store/authSlice'

// ── ATR Request advanced element — runtime (CGT + ADC experiment screens) ──
// Creates/edits a REAL app.models.ard_atr.ArdAtrForm via the existing
// /api/ard/atrs endpoints (see backend/app/modules/ard/atr.py), linked back
// to the originating experiment/section via ArdAtrForm's origin_* columns.
// This is entirely separate from the lightweight LOCK_TOGGLE `raisesAtr` /
// experiment_atr_requests snapshot feature — do not conflate the two.
//
// The field's persisted value is just `{ atrId: string }` (stored like any
// other field's value in the screen's data bag); everything else lives on
// the real ArdAtrForm/ArdAtrSample/ArdTestRequest rows, fetched live.

const REPORT_TYPE_OPTIONS = [
  'Routine Analysis', 'Method Validation', 'Method Development', 'Stability Study', 'Investigation', 'Other',
]
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent']

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AtrRequestFieldProps {
  label: string
  helpText?: string
  value: { atrId?: string } | undefined
  onChange: (v: { atrId?: string }) => void
  disabled?: boolean
  originModule: 'ADC' | 'CGT'
  originProjectId?: string | null
  originProjectCode?: string | null
  originProjectName?: string | null
  originNotebookId?: string | null
  originNotebookCode?: string | null
  originExperimentId?: string | null
  originExperimentCode?: string | null
  sectionId?: string | null
  sectionTitle?: string | null
  // Real experiment id (ADC/CGT), used only to scope the Supporting Docs
  // upload via the existing experiment-files mechanism — see AtrDocsUpload.
  experimentId?: string
  // Template Builder authoring/preview only — see readMe at the bottom of
  // this file for the full contract. When true, master-data GETs stay live
  // but every write (create/save/submit/deactivate/upload) is simulated
  // entirely client-side against a local fake AtrForm, never touching the
  // real ard_atr_forms table.
  previewMode?: boolean
  // Per-instance display config, threaded through from the field's own
  // `atrRequestConfig` (see templateBuilder/types.ts). Every flag defaults to
  // true (show everything) so existing callers that don't pass these keep
  // behaving exactly as before.
  showFormAttributes?: boolean
  showSampleDetails?: boolean
  showTestDetails?: boolean
  showSupportingDocs?: boolean
  showQaCertification?: boolean
  // If set, the "Form Type" modal is skipped entirely — RaiseAtrButton
  // creates the ATR straight away using this form type id.
  lockedFormTypeId?: string | null
  // The section's own "Batch Information (table)" screen's already-selected
  // batch (row 0) — the Sample Details "Batch No." column just mirrors
  // this, read-only, rather than offering a separate cross-inventory
  // picker. Derived once per section render in CgtSectionPage.tsx /
  // AdcBuilderExperimentPage.tsx and threaded down through CgtFieldControl.
  // Undefined when nothing's been selected yet upstream, or in contexts
  // with no real Batch Information screen (e.g. Template Builder preview).
  sectionBatchSku?: string
  sectionBatchId?: number
}

// Builds a fake, purely client-side AtrForm for Template Builder preview —
// never sent to or returned by the backend. Only the fields the panel below
// actually reads are meaningfully populated; the rest are harmless defaults.
function buildPreviewAtr(formTypeId: string, formTypeName: string, mandate: boolean, props: AtrRequestFieldProps): AtrForm {
  const now = new Date().toISOString()
  return {
    id: `preview-${Date.now()}`,
    formNo: `PREVIEW-${Date.now().toString().slice(-6)}`,
    formTypeId,
    formTypeName,
    status: 'DRAFT',
    projectCode: props.originProjectCode || 'NA',
    productName: props.originProjectName || props.originProjectCode || 'NA',
    qcRef: null,
    assignedTl: '',
    assignedTlId: null,
    mandateCertification: mandate,
    schemePresent: false,
    schemeMode: null,
    formCategory: null,
    reportType: null,
    associatedExpCodes: null,
    referenceAtrFormId: null,
    originModule: props.originModule,
    originProjectId: props.originProjectId,
    originProjectCode: props.originProjectCode,
    originProjectName: props.originProjectName,
    originNotebookId: props.originNotebookId,
    originNotebookCode: props.originNotebookCode,
    originExperimentId: props.originExperimentId,
    originExperimentCode: props.originExperimentCode,
    originSectionId: props.sectionId,
    originSectionTitle: props.sectionTitle,
    formOpen: true,
    reassignRemarks: null,
    withdrawRemarks: null,
    certificationRemarks: null,
    requestRemarks: '',
    analysisRemarks: null,
    objectives: '',
    clarifiedAt: null,
    createdBy: 'preview',
    createdById: null,
    attributeValues: {},
    clarifications: [],
    certificationAttachment: null,
    raisedAt: now,
    assignedTeamId: null,
    assignedTeamName: '',
    createdAt: now,
    updatedAt: now,
    samples: [],
    testCount: 0,
  }
}

export default function AtrRequestField(props: AtrRequestFieldProps) {
  const { value, onChange, disabled, previewMode } = props
  const atrId = value?.atrId
  // Preview mode never persists a real atrId into the screen's value bag —
  // the "created" ATR only lives in this local state for the life of the
  // Preview modal.
  const [previewAtr, setPreviewAtr] = useState<AtrForm | undefined>(undefined)

  const panelDisplayProps = {
    showFormAttributes: props.showFormAttributes,
    showSampleDetails: props.showSampleDetails,
    showTestDetails: props.showTestDetails,
    showSupportingDocs: props.showSupportingDocs,
    showQaCertification: props.showQaCertification,
  }

  if (previewMode) {
    return previewAtr
      ? <AtrFormPanel atrId={previewAtr.id} disabled={disabled} label={props.label} experimentId={props.experimentId} sectionBatchSku={props.sectionBatchSku} sectionBatchId={props.sectionBatchId} previewMode previewAtr={previewAtr} onPreviewChange={setPreviewAtr} {...panelDisplayProps} />
      : <RaiseAtrButton {...props} onCreated={() => {}} onPreviewCreated={setPreviewAtr} />
  }

  return atrId
    ? <AtrFormPanel atrId={atrId} disabled={disabled} label={props.label} experimentId={props.experimentId} sectionBatchSku={props.sectionBatchSku} sectionBatchId={props.sectionBatchId} {...panelDisplayProps} />
    : <RaiseAtrButton {...props} onCreated={id => onChange({ atrId: id })} />
}

// ── Step 1: button + "Form Type" modal ──────────────────────────────────────

function RaiseAtrButton(props: AtrRequestFieldProps & { onCreated: (id: string) => void; onPreviewCreated?: (atr: AtrForm) => void }) {
  const { disabled, onCreated, previewMode, onPreviewCreated, lockedFormTypeId } = props
  const user = useAppSelector(selectUser)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  // Master data is a read-only GET — safe (and preferred) to keep live even
  // in preview mode, so the Form Type picker shows real options. Also needed
  // when locked to a Form Type, to resolve its display name.
  const { data: masterData, isLoading } = useQuery({
    queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData, enabled: open || !!lockedFormTypeId,
  })

  const create = useMutation({
    mutationFn: (formTypeId: string) => {
      const ft = masterData?.formTypes.find(f => f.id === formTypeId)
      if (previewMode) {
        // Never call the real create endpoint in preview mode — build a
        // local fake ATR instead of persisting an ArdAtrForm row.
        return Promise.resolve(buildPreviewAtr(formTypeId, ft?.name ?? '', !!ft?.mandateCertification, props))
      }
      return ardAtrApi.create({
        formTypeId,
        formTypeName: ft?.name ?? '',
        projectCode: props.originProjectCode || 'NA',
        productName: props.originProjectName || props.originProjectCode || 'NA',
        mandateCertification: !!ft?.mandateCertification,
        createdBy: user?.username,
        originModule: props.originModule,
        originProjectId: props.originProjectId,
        originProjectCode: props.originProjectCode,
        originProjectName: props.originProjectName,
        originNotebookId: props.originNotebookId,
        originNotebookCode: props.originNotebookCode,
        originExperimentId: props.originExperimentId,
        originExperimentCode: props.originExperimentCode,
        originSectionId: props.sectionId,
        originSectionTitle: props.sectionTitle,
      })
    },
    onSuccess: (atr: AtrForm) => {
      if (previewMode) {
        msg.info('Preview mode — nothing is saved.')
        setOpen(false)
        onPreviewCreated?.(atr)
        return
      }
      msg.success(`ATR ${atr.formNo} created.`)
      setOpen(false)
      onCreated(atr.id)
    },
    onError: () => msg.error('Could not create the ATR request.'),
  })

  return (
    <div className="border border-dashed border-slate-200 rounded-lg px-3 py-3">
      {ctx}
      <Button
        icon={<FileSearch size={14} />}
        disabled={disabled || (!!lockedFormTypeId && create.isPending)}
        loading={!!lockedFormTypeId && create.isPending}
        onClick={() => (lockedFormTypeId ? create.mutate(lockedFormTypeId) : setOpen(true))}
      >
        {props.label || 'ATR Request'}
      </Button>
      {props.helpText && <p className="text-[11px] text-slate-400 mt-1">{props.helpText}</p>}

      {!lockedFormTypeId && (
        <Modal
          {...glassModalProps}
          title="Form Type"
          open={open}
          closable={false}
          maskClosable={false}
          onCancel={() => setOpen(false)}
          onOk={() => form.validateFields().then(v => create.mutate(v.formTypeId))}
          okText="Submit"
          confirmLoading={create.isPending}
          destroyOnClose
        >
          <Spin spinning={isLoading}>
            <Form form={form} layout="vertical" className="mt-3">
              <Form.Item name="formTypeId" label="Form Type" rules={[{ required: true, message: 'Form Type is required.' }]}>
                <Select
                  placeholder="Select a Form Type…"
                  showSearch
                  optionFilterProp="label"
                  options={(masterData?.formTypes ?? []).map(f => ({ value: f.id, label: f.name }))}
                />
              </Form.Item>
            </Form>
          </Spin>
        </Modal>
      )}
    </div>
  )
}

// ── Step 2: inline expanded ATR Form panel ──────────────────────────────────

function AtrFormPanel({
  atrId, disabled, label, experimentId, previewMode, previewAtr, onPreviewChange,
  sectionBatchSku, sectionBatchId,
  showFormAttributes = true, showSampleDetails = true, showTestDetails = true,
  showSupportingDocs = true, showQaCertification = true,
}: {
  atrId: string; disabled?: boolean; label: string; experimentId?: string
  previewMode?: boolean
  previewAtr?: AtrForm
  onPreviewChange?: (atr: AtrForm) => void
  sectionBatchSku?: string
  sectionBatchId?: number
  showFormAttributes?: boolean
  showSampleDetails?: boolean
  showTestDetails?: boolean
  showSupportingDocs?: boolean
  showQaCertification?: boolean
}) {
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [samples, setSamples] = useState<Partial<AtrSample>[] | null>(null)
  const [tests, setTests] = useState<TestRow[] | null>(null)
  const [attrValues, setAttrValues] = useState<Record<string, unknown> | null>(null)
  const [reportType, setReportType] = useState<string | undefined>(undefined)
  const [mandate, setMandate] = useState<boolean | undefined>(undefined)
  const [remarks, setRemarks] = useState<string | undefined>(undefined)
  const [objectives, setObjectives] = useState<string | undefined>(undefined)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined)

  // In preview mode `previewAtr` (local, client-only) stands in for the real
  // fetched ATR — no GET to /api/ard/atrs/{id} for a form that was never
  // persisted.
  const { data: fetchedAtr, isLoading: fetchLoading } = useQuery({
    queryKey: ['ard-atr', atrId], queryFn: () => ardAtrApi.get(atrId), enabled: !previewMode,
  })
  const atr = previewMode ? previewAtr : fetchedAtr
  const isLoading = previewMode ? false : fetchLoading
  const { data: masterData } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  // Read-only GET — safe to keep live even in preview mode (same rationale
  // as masterData above): mass-dimension UOM units for the "Unit" picker.
  // Batch No. no longer has its own picker/query — it just mirrors
  // sectionBatchSku (the section's own Batch Information selection).
  const { data: uomDimensions } = useQuery({ queryKey: ['inventory-uom'], queryFn: () => uomApi.list({ active_only: true, limit: 200 }) })
  const massUomUnits: UomUnit[] = ((uomDimensions ?? []).find(d => d.dimension_key === 'mass')?.units ?? []).filter(u => u.is_active)
  const sampleTypeOptions = (masterData?.lookups ?? [])
    .filter(l => l.category === 'Sample Type' && l.active !== false)
    .map(l => ({ value: l.code, label: l.label }))
  const { data: teamDirectory, isLoading: teamsLoading } = useQuery({
    queryKey: ['ard-team-directory'], queryFn: ardTeamApi.listDirectory, enabled: teamModalOpen,
  })
  const teamOptions = ((teamDirectory?.items ?? []) as ArdTeamDirectoryItem[])
    .filter(t => t.active !== false)
    .map(t => ({ value: t.id, label: t.teamName }))

  const formType = masterData?.formTypes.find(f => f.id === atr?.formTypeId)
  const attributeRows = useMemo(() => {
    if (!formType || !masterData) return []
    return [...formType.attributeLinks]
      .sort((a, b) => a.sequence - b.sequence)
      .map(link => masterData.attributes.find(a => a.id === link.attributeId))
      .filter((a): a is NonNullable<typeof a> => !!a)
  }, [formType, masterData])

  // Value = Code (config `code`); label leads with the Technique, then the
  // sub-type/test-type. techniqueName alone is NOT unique across configs
  // (e.g. TC-5649 and TC-8085 are both "assay"), so labelling by technique
  // only would render two different configs as the same, unpickable option.
  const testConfigOptions = (masterData?.testConfigs ?? [])
    .filter(t => t.active && t.code)
    .map(t => ({
      value: t.code as string,
      label: [t.techniqueName, t.testSubtype || t.testType].filter(Boolean).join(' — '),
      id: t.id,
    }))

  const effSamples = samples ?? atr?.samples ?? []
  // Existing (already-persisted) rows carry their real ArdTestRequest id and
  // are shown read-only (test type/technique can't be changed once created
  // in the ARD domain — see ArdTestRequest); only newly-added rows are
  // editable and get turned into a real addTests() call on Save.
  const effTests: TestRow[] = tests ?? (atr?.samples[0]?.tests ?? []).map(t => ({
    id: t.id, existing: true, testType: t.techniqueCode ?? '', testTypeLabel: t.techniqueName ?? t.testType,
    testSubtype: t.testSubtype ?? '', quantity: '', priority: undefined, specification: '', remarks: '',
    status: t.status, testConfigId: t.testConfigId, results: t.results ?? [],
  }))
  const effAttrValues = attrValues ?? atr?.attributeValues ?? {}
  const effReportType = reportType !== undefined ? reportType : (atr?.reportType ?? undefined)
  const effMandate = mandate !== undefined ? mandate : !!atr?.mandateCertification
  const effRemarks = remarks !== undefined ? remarks : (atr?.requestRemarks ?? '')
  const effObjectives = objectives !== undefined ? objectives : (atr?.objectives ?? '')
  const submittedToDisplay = atr?.assignedTeamName || ''

  const invalidate = () => { if (!previewMode) qc.invalidateQueries({ queryKey: ['ard-atr', atrId] }) }

  // Applies the in-flight local edits (samples/tests/attrs/etc.) onto the
  // current preview ATR and pushes it back up via onPreviewChange — this is
  // the entire "save" for preview mode: no network call, just a local merge.
  function buildUpdatedPreviewAtr(): AtrForm {
    return {
      ...(atr as AtrForm),
      reportType: effReportType ?? null,
      mandateCertification: effMandate,
      requestRemarks: effRemarks,
      objectives: effObjectives,
      attributeValues: { ...effAttrValues },
      samples: effSamples.map(s => ({ ...s })) as AtrSample[],
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (previewMode) return buildUpdatedPreviewAtr()
      return ardAtrApi.save(atrId, {
        reportType: effReportType,
        mandateCertification: effMandate,
        requestRemarks: effRemarks,
        objectives: effObjectives,
        attributeValues: { ...effAttrValues },
        samples: effSamples.map(s => ({ ...s })),
      })
    },
    onSuccess: async (updated) => {
      if (previewMode) {
        onPreviewChange?.(updated)
        setSamples(null); setTests(null); setAttrValues(null)
        setReportType(undefined); setMandate(undefined); setRemarks(undefined); setObjectives(undefined)
        msg.info('Preview mode — nothing is saved.')
        return
      }
      // Newly-added test rows (not yet backed by a real ArdTestRequest) get
      // attached to the ATR's first sample via the existing addTests endpoint.
      const firstSampleId = updated.samples[0]?.id
      const newRows = effTests.filter(t => !t.existing && t.testType)
      if (firstSampleId && newRows.length) {
        const configIds = newRows
          .map(t => testConfigOptions.find(o => o.value === t.testType)?.id)
          .filter((v): v is string => !!v)
        if (configIds.length) {
          await ardAtrApi.addTests(atrId, firstSampleId, { testConfigIds: configIds })
        }
      }
      setSamples(null); setTests(null); setAttrValues(null)
      setReportType(undefined); setMandate(undefined); setRemarks(undefined); setObjectives(undefined)
      invalidate()
      msg.success('ATR Request saved.')
    },
    onError: () => msg.error('Could not save the ATR request.'),
  })

  const submit = useMutation({
    mutationFn: async (teamId: string) => {
      if (previewMode) {
        return { ...(atr as AtrForm), status: 'REQUESTED' as const, assignedTeamId: teamId, assignedTeamName: teamOptions.find(t => t.value === teamId)?.label ?? '' }
      }
      return ardAtrApi.transition(atrId, {
        to: atr?.status === 'DRAFT' || atr?.status === 'SAVED' ? 'REQUESTED' : 'NEW',
        teamId,
      })
    },
    onSuccess: (updated) => {
      if (previewMode) {
        onPreviewChange?.(updated as AtrForm)
        setTeamModalOpen(false)
        setSelectedTeamId(undefined)
        msg.info('Preview mode — nothing is saved.')
        return
      }
      qc.setQueryData(['ard-atr', atrId], updated)
      invalidate()
      setTeamModalOpen(false)
      setSelectedTeamId(undefined)
      msg.success('ATR Request submitted to ARD.')
    },
    onError: () => msg.error('Could not submit the ATR request.'),
  })

  const deactivate = useMutation({
    mutationFn: async () => {
      if (previewMode) return { ...(atr as AtrForm), status: 'WITHDRAWN' as const }
      return ardAtrApi.transition(atrId, { to: 'WITHDRAWN', remarks: 'Deactivated from experiment ATR Request element.' })
    },
    onSuccess: (updated) => {
      if (previewMode) {
        onPreviewChange?.(updated as AtrForm)
        msg.info('Preview mode — nothing is saved.')
        return
      }
      invalidate()
      msg.success('ATR Request withdrawn.')
    },
    onError: () => msg.error('Could not withdraw the ATR request.'),
  })

  if (isLoading || !atr) return <div className="border border-dashed border-slate-200 rounded-lg px-3 py-6"><BrandSpinner fullScreen={false} size={48} label="Loading ATR form…" /></div>

  const readOnly = disabled || !['DRAFT', 'SAVED', 'PRE_APPROVAL_REWORK', 'REJECTED', 'PENDING_CLARIFICATION'].includes(atr.status)

  const sampleColumns = [
    { title: 'Sample Code', dataIndex: 'sampleCode', render: (v: string) => v || <span className="text-slate-300 italic">auto</span> },
    { title: 'Sample Type', dataIndex: 'sampleType', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Select size="small" className="w-full" style={{ minWidth: 120 }} value={v || undefined} disabled={readOnly}
        showSearch optionFilterProp="label" options={sampleTypeOptions} allowClear
        onChange={val => patchSample(i, { sampleType: val })} />
    ) },
    { title: 'Batch No.', dataIndex: 'batchNo', render: () => (
      <span className="text-slate-600">{withEmptyValue(sectionBatchSku)}</span>
    ) },
    { title: 'Description', dataIndex: 'sampleDescription', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Input size="small" value={v ?? ''} disabled={readOnly} onChange={e => patchSample(i, { sampleDescription: e.target.value })} />
    ) },
    { title: 'Qty', dataIndex: 'quantity', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Input size="small" value={v ?? ''} disabled={readOnly} style={{ width: 70 }} onChange={e => patchSample(i, { quantity: e.target.value })} />
    ) },
    { title: 'Unit', dataIndex: 'uom', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Select size="small" style={{ width: 80 }} value={v || undefined} disabled={readOnly}
        options={massUomUnits.map(u => ({ value: u.symbol, label: u.name }))}
        onChange={val => patchSample(i, { uom: val })} allowClear />
    ) },
    { title: 'Mfg. Date', dataIndex: 'mfgDate', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <DatePicker size="small" value={v ? dayjs(v) : null} disabled={readOnly} onChange={d => patchSample(i, { mfgDate: d ? d.format('YYYY-MM-DD') : null })} />
    ) },
    { title: 'Expiry Date', dataIndex: 'expDate', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <DatePicker size="small" value={v ? dayjs(v) : null} disabled={readOnly} onChange={d => patchSample(i, { expDate: d ? d.format('YYYY-MM-DD') : null })} />
    ) },
    { title: 'Storage Condition & Period', dataIndex: 'storageCondition', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Input size="small" value={v ?? ''} disabled={readOnly} onChange={e => patchSample(i, { storageCondition: e.target.value })} />
    ) },
    { title: 'Packing', dataIndex: 'packType', render: (v: string, _r: Partial<AtrSample>, i: number) => (
      <Input size="small" value={v ?? ''} disabled={readOnly} onChange={e => patchSample(i, { packType: e.target.value })} />
    ) },
    ...(readOnly ? [] : [{
      title: '', dataIndex: 'x', width: 36,
      render: (_: unknown, _r: Partial<AtrSample>, i: number) => (
        <Popconfirm title="Remove this sample row?" onConfirm={() => removeSample(i)}>
          <button type="button" className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
        </Popconfirm>
      ),
    }]),
  ]

  function patchSample(i: number, patch: Partial<AtrSample>) {
    const next = [...effSamples]
    next[i] = { ...next[i], ...patch }
    setSamples(next)
  }
  function addSample() {
    // No client-side sampleCode guess — the real one only exists once the
    // backend mints it via next_ard_atr_sample_code() on Save (see
    // app/shared/ard_atr_sequence.py). A fake "SMP-1"-style placeholder here
    // would look like a real generated code and never get corrected in the
    // UI until a refetch, which read as "the wrong code" rather than
    // "not saved yet". The Sample Code column already falls back to an
    // "auto" label when this is unset.
    setSamples([...effSamples, {
      id: `new-${Date.now()}`,
      batchNo: sectionBatchSku ?? '', sourceBatchId: sectionBatchId,
    } as Partial<AtrSample>])
  }
  function removeSample(i: number) {
    setSamples(effSamples.filter((_, idx) => idx !== i))
  }

  function patchTest(i: number, patch: Partial<TestRow>) {
    const next = [...effTests]
    next[i] = { ...next[i], ...patch }
    setTests(next)
  }
  function addTest() {
    setTests([...effTests, { id: `new-${Date.now()}`, testType: '', testSubtype: '', quantity: '', priority: undefined, specification: '', remarks: '' }])
  }
  async function removeTest(i: number) {
    const row = effTests[i]
    const sampleId = atr!.samples[0]?.id
    if (!previewMode && sampleId && row.existing) {
      try { await ardAtrApi.removeTest(atrId, sampleId, row.id) } catch { /* best-effort */ }
    }
    setTests(effTests.filter((_, idx) => idx !== i))
    invalidate()
  }

  // No background tint on the panel below — it inherits the experiment
  // screen card's surface so the ATR form reads as part of the section
  // rather than a nested widget.
  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-5">
      {ctx}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch size={16} className="text-violet-500" />
          <span className="font-semibold text-slate-700">{label || 'ATR Form'} — {atr.formNo}</span>
          <Tag color={atr.status === 'WITHDRAWN' ? 'red' : atr.status === 'DRAFT' || atr.status === 'SAVED' ? 'default' : 'blue'}>{atr.status}</Tag>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
        <Field label="ATR Form No."><Input value={atr.formNo} disabled /></Field>
        <Field label="Project Code"><Select className="w-full" value={atr.projectCode || undefined} disabled options={[{ value: atr.projectCode, label: atr.projectCode }]} /></Field>
        <Field label="Product Name"><Input value={atr.productName} disabled /></Field>
        <Field label="Report Type">
          <Select className="w-full" value={effReportType} disabled={readOnly}
            options={REPORT_TYPE_OPTIONS.map(v => ({ value: v, label: v }))}
            onChange={setReportType} placeholder="Select…" allowClear />
        </Field>
        {showQaCertification && (
          <Field label="QA Certification">
            <Checkbox checked={effMandate} disabled={readOnly} onChange={e => setMandate(e.target.checked)}>Mandated</Checkbox>
          </Field>
        )}
        <Field label="Requester Name"><Input value={atr.createdBy || user?.username || ''} disabled /></Field>
        <Field label="Form Type"><Input value={atr.formTypeName} disabled /></Field>
        <Field label="Raised On"><Input value={atr.raisedAt ? dayjs(atr.raisedAt).format('DD/MM/YYYY HH:mm') : EMPTY_VALUE_TEXT} disabled /></Field>
        <Field label="Submitted To">
          <Input value={submittedToDisplay || EMPTY_VALUE_TEXT} disabled />
        </Field>
        <Field label="Status"><Input value={atr.status} disabled /></Field>
      </div>
      <Field label="Form Remarks">
        <Input.TextArea rows={2} value={effRemarks} disabled={readOnly} onChange={e => setRemarks(e.target.value)} />
      </Field>
      <Field label="Objectives">
        <Input.TextArea rows={2} value={effObjectives} disabled={readOnly} onChange={e => setObjectives(e.target.value)} />
      </Field>

      {/* Form Attributes */}
      {showFormAttributes && attributeRows.length > 0 && (
        <div>
          <Divider titlePlacement="left" plain className="!my-2 !text-xs !text-slate-500">Form Attributes</Divider>
          <RowStyledTable
            rowKey={r => r.id} dataSource={attributeRows}
            columns={[
              { title: 'Attribute Name', dataIndex: 'label' },
              { title: 'Attribute Type', dataIndex: 'type' },
              {
                title: 'Attribute Value',
                render: (_, attr) => (
                  <AttributeValueInput
                    attr={attr}
                    value={effAttrValues[attr.id]}
                    disabled={readOnly}
                    onChange={v => setAttrValues({ ...effAttrValues, [attr.id]: v })}
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Sample Details */}
      {showSampleDetails && (
      <div>
        <Divider titlePlacement="left" plain className="!my-2 !text-xs !text-slate-500">Sample Details</Divider>
        <RowStyledTable rowKey={(r, i) => r.id ?? String(i)} dataSource={effSamples} columns={sampleColumns} emptyText="No samples yet." />
        {!readOnly && <Button size="small" className="mt-2" icon={<Plus size={12} />} onClick={addSample}>Add Sample</Button>}
      </div>
      )}

      {/* Test Details */}
      {showTestDetails && (
      <div>
        <Divider titlePlacement="left" plain className="!my-2 !text-xs !text-slate-500">Test Details</Divider>
        <RowStyledTable
          rowKey={(r, i) => r.id ?? String(i)} dataSource={effTests} emptyText="No tests yet."
          expandable={{
            rowExpandable: (r: TestRow) => !!r.existing,
            expandedRowRender: (row: TestRow) => {
              const config = (masterData?.testConfigs ?? []).find(c => c.id === row.testConfigId || c.code === row.testType)
              // The real submitted/verified values (r.results) must win over the
              // test config's static parameter definitions — same rule as the
              // ARD ATR page's own test-parameters view.
              const params = (((row.results && row.results.length ? row.results : config?.resultParams) ?? []) as Record<string, unknown>[])
              if (!params.length) return <p className="text-xs text-slate-400 italic py-1 px-3">No test parameters configured.</p>
              return (
                <RowStyledTable
                  rowKey={(p, i) => (p && typeof p === 'object' && p.id ? String(p.id) : String(i))}
                  dataSource={params}
                  columns={[
                    { title: 'Parameter Name', render: (_, p: any, i) => (
                      <span className="font-medium text-slate-800 text-xs">{p.name || p.parameterName || p.parameter || p.param_name || `Param ${i + 1}`}</span>
                    ) },
                    { title: 'Data Type', width: 110, render: (_, p: any) => {
                      const dt = p.dataType || p.data_type
                      return dt ? <Tag color="blue" className="text-[11px] font-mono uppercase">{dt}</Tag> : <EmptyValue />
                    } },
                    { title: 'UOM', width: 90, render: (_, p: any) => p.uom ? <span className="font-mono text-xs font-semibold text-slate-700">{p.uom}</span> : <EmptyValue /> },
                    { title: 'Result Value', render: (_, p: any) => {
                      const raw = p.value ?? p.resultValue
                      const val = typeof raw === 'string' ? raw.replace(/<[^>]+>/g, '').trim() : raw
                      return (val === undefined || val === null || val === '') ? <EmptyValue /> : (
                        <span className="font-semibold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{String(val)}</span>
                      )
                    } },
                  ]}
                />
              )
            },
          }}
          columns={[
            { title: 'Status', dataIndex: 'status', width: 110, render: (v: string, r: TestRow) =>
              r.existing ? <Tag color={TEST_STATUS_COLOR[v] ?? 'default'} className="text-xs">{(v || 'UNASSIGNED').replace(/_/g, ' ')}</Tag> : <EmptyValue />
            },
            { title: '', dataIndex: 'x2', width: 150, render: (_: unknown, r: TestRow) =>
              r.existing ? <TestFinalReportLink atrId={atrId} testId={r.id} status={r.status} /> : null
            },
            { title: 'Test Type', dataIndex: 'testType', render: (v: string, r: TestRow, i: number) =>
              r.existing
                ? <Input size="small" value={r.testTypeLabel || v} disabled />
                : (
                  <Select size="small" className="w-full" style={{ minWidth: 160 }} value={v || undefined} disabled={readOnly}
                    showSearch optionFilterProp="label" options={testConfigOptions}
                    onChange={val => {
                      const match = (masterData?.testConfigs ?? []).find(t => t.code === val)
                      patchTest(i, { testType: val, testSubtype: match?.testSubtype ?? '' })
                    }} />
                ),
            },
            // Plain text, not a cramped disabled Input — an Input clips
            // longer values ("assay by chiral" reads as "assay") with no way
            // to see the rest. `title` keeps the full value on hover.
            { title: 'SubType', dataIndex: 'testSubtype', width: 150, render: (v: string) => (
              <span className="block truncate text-xs text-slate-600" title={v || ''}>{withEmptyValue(v)}</span>
            ) },
            { title: 'Quantity', dataIndex: 'quantity', render: (v: string, _r: TestRow, i: number) => (
              <Input size="small" value={v ?? ''} disabled={readOnly} style={{ width: 70 }} onChange={e => patchTest(i, { quantity: e.target.value })} />
            ) },
            { title: 'Priority', dataIndex: 'priority', render: (v: string, _r: TestRow, i: number) => (
              <Select size="small" className="w-full" style={{ minWidth: 100 }} value={v} disabled={readOnly}
                options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} onChange={val => patchTest(i, { priority: val })} allowClear />
            ) },
            { title: 'Specification', dataIndex: 'specification', render: (v: string, _r: TestRow, i: number) => (
              <Input size="small" value={v ?? ''} disabled={readOnly} onChange={e => patchTest(i, { specification: e.target.value })} />
            ) },
            { title: 'Remarks', dataIndex: 'remarks', render: (v: string, _r: TestRow, i: number) => (
              <Input size="small" value={v ?? ''} disabled={readOnly} onChange={e => patchTest(i, { remarks: e.target.value })} />
            ) },
            ...(readOnly ? [] : [{
              title: '', dataIndex: 'x', width: 36,
              render: (_: unknown, _r: TestRow, i: number) => (
                <Popconfirm title="Remove this test row?" onConfirm={() => removeTest(i)}>
                  <button type="button" className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                </Popconfirm>
              ),
            }]),
          ]}
        />
        {!readOnly && <Button size="small" className="mt-2" icon={<Plus size={12} />} onClick={addTest}>Add Test</Button>}
      </div>
      )}

      {/* Supporting Docs */}
      {showSupportingDocs && (
      <div>
        <Divider titlePlacement="left" plain className="!my-2 !text-xs !text-slate-500">Supporting Docs &amp; Reports</Divider>
        <AtrDocsUpload atrId={atrId} experimentId={experimentId} disabled={readOnly} previewMode={previewMode} />
      </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={readOnly}>Save</Button>
        <Button
          type="primary"
          // Submit must persist whatever's currently in the Sample/Test tables
          // first — the transition endpoint has no samples/tests in its body,
          // so without this, anything entered but not explicitly Saved is
          // silently dropped when the ATR moves to REQUESTED.
          onClick={() => save.mutate(undefined, { onSuccess: () => setTeamModalOpen(true) })}
          loading={submit.isPending || save.isPending}
          disabled={readOnly || !['DRAFT', 'SAVED'].includes(atr.status)}
        >
          Submit
        </Button>
        <Popconfirm title="Deactivate (withdraw) this ATR request?" onConfirm={() => deactivate.mutate()}>
          <Button danger disabled={disabled || atr.status === 'WITHDRAWN'} loading={deactivate.isPending}>Deactivate</Button>
        </Popconfirm>
      </div>

      <Modal
        {...glassModalProps}
        title="Select ARD Team"
        open={teamModalOpen}
        closable={false}
        maskClosable={false}
        onCancel={() => { setTeamModalOpen(false); setSelectedTeamId(undefined) }}
        onOk={() => { if (selectedTeamId) submit.mutate(selectedTeamId) }}
        okText="Submit"
        okButtonProps={{ disabled: !selectedTeamId }}
        confirmLoading={submit.isPending}
        destroyOnClose
      >
        <Spin spinning={teamsLoading}>
          <Field label="ARD Team">
            <Select
              className="w-full"
              placeholder="Select a Team…"
              showSearch
              optionFilterProp="label"
              value={selectedTeamId}
              options={teamOptions}
              onChange={setSelectedTeamId}
            />
          </Field>
        </Spin>
      </Modal>
    </div>
  )
}

interface TestRow {
  id: string; testType: string; testTypeLabel?: string; existing?: boolean
  testSubtype: string; quantity: string; priority?: string; specification: string; remarks: string
  // Only populated for `existing` rows — the real ArdTestRequest's live
  // status/results, so the chemist can see ARD's progress/verified values
  // right here in the experiment, without leaving to the ARD ATR page.
  status?: string; testConfigId?: string | null; results?: Record<string, unknown>[]
}

const TEST_STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: 'default', ASSIGNED: 'blue', IN_PROGRESS: 'gold', SUBMITTED: 'purple',
  VERIFIED: 'green', REWORK: 'red', WITHDRAWN: 'default',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RowStyledColumn {
  title: string
  dataIndex?: string
  width?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, record: any, index: number) => React.ReactNode
}

// A plain HTML table styled to match the experiment's own table screens
// (see CgtTableField.tsx's per-row table — rounded-lg white card, uppercase
// 10px bold slate headers, subtle row hover) instead of antd's default
// <Table>, whose grey-header/compact look reads as a different design
// language than the rest of the experiment. Column shape intentionally
// mirrors antd's `ColumnType` ({title, dataIndex, render}) — loosely typed
// (`any`) like every existing table column definition elsewhere in this
// file — so existing column arrays drop in unchanged, only the surrounding
// markup differs.
function RowStyledTable({
  columns, dataSource, rowKey, expandable, emptyText = 'No rows yet.',
}: {
  columns: RowStyledColumn[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSource: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowKey: (record: any, index: number) => string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expandable?: { rowExpandable: (record: any) => boolean; expandedRowRender: (record: any) => React.ReactNode }
  emptyText?: string
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setExpandedKeys(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {expandable && <th className="w-6 border-b border-slate-200" />}
            {columns.map((c, ci) => (
              <th
                key={ci}
                className="px-2 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap"
                style={c.width ? { width: c.width } : undefined}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (expandable ? 1 : 0)} className="px-3 py-6 text-center text-slate-400 italic">
                {emptyText}
              </td>
            </tr>
          ) : dataSource.map((record, ri) => {
            const key = rowKey(record, ri)
            const canExpand = !!expandable?.rowExpandable(record)
            const isOpen = expandedKeys.has(key)
            return (
              <Fragment key={key}>
                <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                  {expandable && (
                    <td className="px-1 align-top pt-2.5">
                      {canExpand && (
                        <button type="button" onClick={() => toggle(key)} className="text-slate-400 hover:text-slate-600">
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      )}
                    </td>
                  )}
                  {columns.map((c, ci) => (
                    <td key={ci} className="px-2 py-1.5 align-top">
                      {c.render ? c.render(c.dataIndex ? record[c.dataIndex] : undefined, record, ri) : (c.dataIndex ? String(record[c.dataIndex] ?? '') : null)}
                    </td>
                  ))}
                </tr>
                {expandable && canExpand && isOpen && (
                  <tr className="border-b border-slate-100 last:border-0 bg-slate-50/30">
                    <td colSpan={columns.length + 1} className="px-3 py-2">
                      {expandable.expandedRowRender(record)}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Label styling deliberately mirrors the experiment pages' own field labels
// (see AdcBuilderExperimentPage.tsx / CgtSectionPage.tsx) so the ATR panel's
// Summary fields read as part of the surrounding form, not a nested widget.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function AttributeValueInput({ attr, value, disabled, onChange }: {
  attr: { id: string; type: string; options: { label: string; value: string }[] | null }
  value: unknown; disabled?: boolean; onChange: (v: unknown) => void
}) {
  switch (attr.type) {
    case 'number':
      return <InputNumber size="small" className="w-full" value={value as number | undefined} disabled={disabled} onChange={onChange} />
    case 'date':
      return <DatePicker size="small" className="w-full" value={value ? dayjs(value as string) : null} disabled={disabled} onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)} />
    case 'textarea':
      return <Input.TextArea rows={1} value={(value as string) ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)} />
    case 'select':
    case 'radio':
      return <Select size="small" className="w-full" value={(value as string) || undefined} disabled={disabled} options={attr.options ?? []} onChange={onChange} allowClear />
    case 'checkbox':
    case 'switch':
      return <Checkbox checked={!!value} disabled={disabled} onChange={e => onChange(e.target.checked)} />
    default:
      return <Input size="small" value={(value as string) ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)} />
  }
}

// Reuses the same real experiment file-upload mechanism as ATTACHMENT/IMAGE
// fields (see CgtFieldControl's AttachmentControl and
// backend/app/modules/experiments/router.py's ExperimentFile endpoints) —
// there is no dedicated document sub-resource on ArdAtrForm itself, so
// uploads are attached to the *originating* experiment (a real FK) and
// scoped by an opaque slot key derived from the ATR form's own id, keeping
// this ATR's documents distinguishable from the experiment's own attachments.
function AtrDocsUpload({ atrId, experimentId, disabled, previewMode }: { atrId: string; experimentId?: string; disabled?: boolean; previewMode?: boolean }) {
  const slotKey = `atr-${atrId}`
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [previewFiles, setPreviewFiles] = useState<{ id: string; filename: string; file_size: number }[]>([])
  const queryKey = ['experiment-files', experimentId, slotKey] as const
  const { data: allFiles = [] } = useQuery({
    queryKey, queryFn: () => experimentApi.listFiles(experimentId!), enabled: !!experimentId && !previewMode,
  })
  const files = previewMode ? previewFiles : allFiles.filter(f => f.section_key === slotKey)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (previewMode) {
      // Simulate the upload entirely client-side — never hit the real
      // experiment-files endpoint for a preview ATR with no real experiment.
      setPreviewFiles(prev => [...prev, { id: `preview-${Date.now()}`, filename: file.name, file_size: file.size }])
      message.info('Preview mode — nothing is saved.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (!experimentId) return
    setUploading(true)
    try {
      await experimentApi.uploadFile(experimentId, file, slotKey)
      await qc.invalidateQueries({ queryKey })
    } catch {
      message.error('Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!experimentId && !previewMode) {
    return <span className="text-xs text-slate-400 italic">File upload not available outside an experiment context.</span>
  }

  return (
    <div className="space-y-1.5">
      <Button size="small" icon={<UploadIcon size={12} />} loading={uploading} disabled={disabled} onClick={() => fileRef.current?.click()}>
        Attach file
      </Button>
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} disabled={disabled} />
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-md px-2 py-1">
              <FileText size={12} className="text-violet-400 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-slate-600">{f.filename}</span>
              <span className="text-slate-400 shrink-0">{fileSize(f.file_size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
