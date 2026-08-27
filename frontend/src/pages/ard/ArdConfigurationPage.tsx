import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Checkbox,
  Tag, message, Card, Empty, DatePicker, Tooltip, Space, Alert, Segmented, Upload, Popconfirm, Spin,
} from 'antd'
import { Plus, Edit3, Trash2, Search, Users as UsersIcon, Eye, FileText, AlertTriangle, LayoutList, Award, ShieldCheck, Download, Upload as UploadIcon, Settings, Check, X, RotateCcw } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardApi, ardSectionApi, ardDataItemApi, ardTemplateApi,
  type ArdAttribute, type ArdFormType, type FormTypeAttrLink, type ArdLookup, type ArdMasterDataState,
  type ArdQualificationAlert, type ArdSetting, type ArdTechnique, type ArdTestConfiguration,
  type ArdTestGroup, type ArdDataItem, type ArdDataItemType, type ArdDataItemLengthCategory,
  type ArdAnalystQualification, type ResultParam,
  type ArdContentBlock, type ArdMasterSection, type SectionType,
} from '../../api/ard'
import { adminApi, type UserOut } from '../../api/admin'
import { ApiError, apiDownloadBlob, apiPost } from '../../api/client'
import RichEditor from '../../components/RichEditor'
import SpreadsheetFieldRuntime from '../admin/templateBuilder/SpreadsheetFieldRuntime'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const { TextArea } = Input

function useMasterData() {
  return useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
}

// Keep reusable Ant table renderers unopinionated about the row type. Each
// table supplies its concrete data source below; audit fields may be null.
const renderCreatedByOn = (_: unknown, row: any) => (
  <div>
    <div className="font-medium text-slate-700 text-xs">{row.createdBy || 'System'}</div>
    <div className="text-[11px] text-slate-400">
      {row.createdAt || row.created_at ? dayjs(row.createdAt || row.created_at).format('DD-MMM-YYYY HH:mm') : '—'}
    </div>
  </div>
)

const renderUpdatedByOn = (_: unknown, row: any) => (
  <div>
    <div className="font-medium text-slate-700 text-xs">{row.updatedBy || row.createdBy || 'System'}</div>
    <div className="text-[11px] text-slate-400">
      {row.updatedAt || row.updated_at ? dayjs(row.updatedAt || row.updated_at).format('DD-MMM-YYYY HH:mm') : '—'}
    </div>
  </div>
)

// ── Techniques ───────────────────────────────────────────────────────────

function TechniquesTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdTechnique | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: ardApi.saveTechnique,
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save technique.'),
  })

  const toggleActive = (row: ArdTechnique, checked: boolean) => {
    save.mutate({ ...row, active: checked }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(checked ? `"${row.code}" enabled.` : `"${row.code}" disabled.`)
      },
    })
  }

  const submitForm = (values: { code: string; name: string }) => {
    const isEdit = !!editing
    save.mutate({ ...values, id: editing?.id, active: editing ? editing.active : true }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(isEdit ? `"${values.code}" updated.` : `"${values.code}" added.`)
        setOpen(false)
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.techniques
    return data.techniques.filter((t) => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  }, [data.techniques, search])

  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const openModal = (row?: ArdTechnique) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ?? { code: '', name: '' })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search techniques by code or name..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Technique</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{
          current: page, pageSize, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'],
          showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
        columns={[
          { title: 'Technique Name', dataIndex: 'code' },
          { title: 'Description', dataIndex: 'name' },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="small"
                  checked={row.active}
                  onChange={(checked) => toggleActive(row, checked)}
                />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Technique' : 'Add Technique'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => submitForm(v))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Technique Name" rules={[{ required: true }]}><Input className="font-mono" /></Form.Item>
          <Form.Item name="name" label="Description" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Test Configurations ────────────────────────────────────────────────────

function ResultParamsEditor({
  value,
  onChange,
  uomOptions = [],
}: {
  value?: ResultParam[]
  onChange?: (v: ResultParam[]) => void
  uomOptions?: { value: string; label: string }[]
}) {
  const params = value ?? []
  const update = (i: number, patch: Partial<ResultParam>) => {
    const next = params.slice()
    next[i] = { ...next[i], ...patch }
    onChange?.(next)
  }
  const add = () => onChange?.([...params, { id: `p${Date.now()}`, name: '', dataType: 'text', validationType: 'NONE', paramType: 'INPUT' }])
  const remove = (i: number) => onChange?.(params.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      {/* The parent Form.Item's validation error would otherwise cascade a red
          border onto every antd input inside this custom field, not just the
          one that's actually invalid. Neutralize that and mark only the
          Parameter Name input, which is the one field that's truly required. */}
      <style>{`
        .rp-editor.ant-form-item-has-error .ant-input,
        .rp-editor.ant-form-item-has-error .ant-select-selector,
        .rp-editor.ant-form-item-has-error .ant-input-number { border-color: #d9d9d9 !important; box-shadow: none !important; }
        .rp-editor .rp-name-error .ant-input { border-color: #ff4d4f !important; }
      `}</style>
      {params.map((p, i) => (
        <div key={p.id} className="border border-slate-200/90 rounded-lg p-3 bg-slate-50/60 space-y-2.5">
          {/* Row 1: Parameter Name + Data Type + Delete Button */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                Parameter Name <span className="text-red-500">*</span>
              </label>
              <div className={!p.name?.trim() ? 'rp-name-error' : undefined}>
                <Input
                  placeholder="e.g. Assay % or Description"
                  value={p.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </div>
            </div>
            <Select
              style={{ width: 120 }}
              className="shrink-0"
              value={p.dataType ?? 'text'}
              onChange={(v) => {
                if (v === 'text') {
                  update(i, { dataType: v, validationType: 'NONE', upperLimit: null, lowerLimit: null })
                } else {
                  update(i, { dataType: v })
                }
              }}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'number', label: 'Number' },
              ]}
            />
            <Tooltip title="Delete parameter">
              <Button
                type="text"
                danger
                size="small"
                icon={<Trash2 size={15} />}
                onClick={() => remove(i)}
                className="shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50"
              />
            </Tooltip>
          </div>

          {/* Row 2: Specification OR Number Validation Controls */}
          {p.dataType === 'text' ? (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Specification (e.g. Complies / NMT 0.5%)"
                value={p.specification ?? ''}
                onChange={(e) => update(i, { specification: e.target.value })}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
              <div className="w-32 shrink-0">
                <Select
                  showSearch
                  allowClear
                  className="w-full"
                  placeholder="UOM"
                  value={p.uom || undefined}
                  onChange={(v) => update(i, { uom: v ?? '' })}
                  options={uomOptions}
                />
              </div>
              <div className="w-36 shrink-0">
                <Select
                  className="w-full"
                  value={p.validationType ?? 'NONE'}
                  onChange={(v) => update(i, { validationType: v })}
                  options={[
                    { value: 'NONE', label: 'No Limit' },
                    { value: 'NMT', label: 'NMT (Upper)' },
                    { value: 'NLT', label: 'NLT (Lower)' },
                    { value: 'RANGE', label: 'Range (Min-Max)' },
                  ]}
                />
              </div>
              {(p.validationType === 'NLT' || p.validationType === 'RANGE') && (
                <div className="w-32 shrink-0">
                  <InputNumber
                    className="w-full"
                    placeholder="Lower Limit"
                    status={p.validationType === 'RANGE' && p.lowerLimit != null && p.upperLimit != null && p.lowerLimit >= p.upperLimit ? 'error' : undefined}
                    value={p.lowerLimit ?? undefined}
                    onChange={(v) => update(i, { lowerLimit: v ?? null })}
                  />
                </div>
              )}
              {(p.validationType === 'NMT' || p.validationType === 'RANGE') && (
                <div className="w-32 shrink-0">
                  <InputNumber
                    className="w-full"
                    placeholder="Upper Limit"
                    status={p.validationType === 'RANGE' && p.lowerLimit != null && p.upperLimit != null && p.lowerLimit >= p.upperLimit ? 'error' : undefined}
                    value={p.upperLimit ?? undefined}
                    onChange={(v) => update(i, { upperLimit: v ?? null })}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <Button type="dashed" block icon={<Plus size={14} />} onClick={add} className="mt-1">
        Add Result Parameter
      </Button>
    </div>
  )
}

function TestConfigsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdTestConfiguration | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const uomOptions = useMemo(() => {
    const uomLookups = (data.lookups ?? []).filter(
      (l) => l.active && ['UOM', 'UNITS', 'UNIT'].includes((l.category ?? '').toUpperCase())
    )
    return uomLookups.map((l) => ({
      value: l.label || l.code,
      label: l.label === l.code ? l.label : `${l.label} (${l.code})`,
    }))
  }, [data.lookups])

  const save = useMutation({
    mutationFn: ardApi.saveTestConfig,
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save test configuration.'),
  })

  const testConfigLabel = (row: { testType: string; testSubtype?: string | null }) =>
    row.testSubtype ? `${row.testType} - ${row.testSubtype}` : row.testType

  const toggleActive = (row: ArdTestConfiguration, checked: boolean) => {
    save.mutate({ ...row, active: checked } as Record<string, unknown>, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(checked ? `"${testConfigLabel(row)}" enabled.` : `"${testConfigLabel(row)}" disabled.`)
      },
    })
  }

  const submitForm = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    save.mutate({ ...values, id: editing?.id, active: editing ? editing.active : true }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(`"${testConfigLabel(values as any)}" ${isEdit ? 'updated' : 'added'}.`)
        setOpen(false)
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.testConfigs
    return data.testConfigs.filter((c) =>
      (c.code ?? '').toLowerCase().includes(q) ||
      c.testType.toLowerCase().includes(q) ||
      (c.techniqueCode ?? '').toLowerCase().includes(q) ||
      (c.techniqueName ?? '').toLowerCase().includes(q)
    )
  }, [data.testConfigs, search])

  const openModal = (row?: ArdTestConfiguration) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ? {
      ...row,
      techniqueId: data.techniques.find((t) => t.code === row.techniqueCode)?.id,
      analysisCode: (row as any).analysisCode ?? '',
    } : { testType: '', testSubtype: '', resultParams: [], analysisCode: '', techniqueId: undefined })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search test configurations..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <div className="flex gap-2">
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={(file) => {
              const fd = new FormData()
              fd.append('file', file)
              fetch('/api/ard/master-data/test-configs/import-csv', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
                .then((r) => r.json())
                .then((res) => {
                  msg.success(`Imported ${res.created} test config(s)${res.skipped > 0 ? `, ${res.skipped} skipped` : ''}.`)
                  qc.invalidateQueries({ queryKey: ['ard-master-data'] })
                })
                .catch(() => msg.error('CSV import failed. Expected columns: techniqueCode, techniqueName, testType, testSubtype (optional).'))
              return false
            }}
          >
            <Button icon={<UploadIcon size={14} />}>Import CSV</Button>
          </Upload>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Test Configuration</Button>
        </div>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Technique', dataIndex: 'techniqueCode', render: (v) => v ?? '—' },
          { title: 'Test Type', dataIndex: 'testType' },
          { title: 'Sub Type', dataIndex: 'testSubtype' },
          { title: 'Params', dataIndex: 'resultParams', render: (v: ResultParam[]) => <Tag color="blue">{v.length}</Tag> },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="small"
                  checked={row.active}
                  onChange={(checked) => toggleActive(row, checked)}
                />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose width={720} title={editing ? 'Edit Test Configuration' : 'Add Test Configuration'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => submitForm(v))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="techniqueId" label="Test Technique">
            <Select showSearch optionFilterProp="label"
              options={data.techniques.filter((t) => t.active).map((t) => ({ value: t.id, label: t.code }))} />
          </Form.Item>
          <Form.Item name="analysisCode" label="Analysis Technical Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="testType" label="ATR Test Type" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="testSubtype" label="ATR Test Sub Type" rules={[{ required: true, message: 'Sub type is required' }]}><Input /></Form.Item>
          <Form.Item name="resultParams" label="Result Parameters" className="rp-editor"
            rules={[{
              validator: (_, v: ResultParam[]) => {
                if (!v || v.length === 0) return Promise.reject(new Error('At least one result parameter is required'))
                if (v.some((p) => !p.name?.trim())) return Promise.reject(new Error('Every result parameter needs a name'))
                const badRange = v.find((p) =>
                  p.validationType === 'RANGE' && p.lowerLimit != null && p.upperLimit != null && p.lowerLimit >= p.upperLimit
                )
                if (badRange) return Promise.reject(new Error(`"${badRange.name}": Lower Limit must be less than Upper Limit`))
                return Promise.resolve()
              },
            }]}>
            <ResultParamsEditor uomOptions={uomOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Test Groups ─────────────────────────────────────────────────────────

// Per-group override of a result parameter's Specification — scoped to one
// test-group ↔ test-config membership row, never touches the shared Test
// Configuration record other groups may also be linked to.
function SpecOverrideCell({
  groupId, memberId, param, overrideValue,
}: { groupId: string; memberId?: string; param: ResultParam; overrideValue?: string }) {
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const [editing, setEditing] = useState(false)
  const isNumber = param.dataType === 'number'
  const sharedValue = param.specification ?? ''
  const displayValue = overrideValue ?? sharedValue

  const [draftText, setDraftText] = useState(displayValue)
  const [draftValidationType, setDraftValidationType] = useState(param.validationType ?? 'NONE')
  const [draftLower, setDraftLower] = useState<number | null>(param.lowerLimit ?? null)
  const [draftUpper, setDraftUpper] = useState<number | null>(param.upperLimit ?? null)

  const buildNumberSpec = () => {
    if (draftValidationType === 'NMT') return draftUpper != null ? `NMT ${draftUpper}` : ''
    if (draftValidationType === 'NLT') return draftLower != null ? `NLT ${draftLower}` : ''
    if (draftValidationType === 'RANGE') return draftLower != null && draftUpper != null ? `${draftLower} - ${draftUpper}` : ''
    return ''
  }

  const mut = useMutation({
    mutationFn: (v: string) => ardApi.saveTestGroupSpecOverride(groupId, memberId!, param.id, v || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); setEditing(false) },
    onError: () => msgApi.error('Failed to save specification.'),
  })

  if (!memberId) return <span>{displayValue || '—'}</span>

  const startEdit = () => {
    setDraftText(displayValue)
    setDraftValidationType(param.validationType ?? 'NONE')
    setDraftLower(param.lowerLimit ?? null)
    setDraftUpper(param.upperLimit ?? null)
    setEditing(true)
  }

  if (editing) {
    return (
      <Space size={4} wrap>
        {ctx}
        {isNumber ? (
          <>
            <Select
              size="small" style={{ width: 130 }} value={draftValidationType} onChange={setDraftValidationType}
              options={[
                { value: 'NONE', label: 'No Limit' },
                { value: 'NMT', label: 'NMT (Upper)' },
                { value: 'NLT', label: 'NLT (Lower)' },
                { value: 'RANGE', label: 'Range (Min-Max)' },
              ]}
            />
            {(draftValidationType === 'NLT' || draftValidationType === 'RANGE') && (
              <InputNumber
                size="small" style={{ width: 90 }} placeholder="Lower Limit"
                status={draftValidationType === 'RANGE' && draftLower != null && draftUpper != null && draftLower >= draftUpper ? 'error' : undefined}
                value={draftLower ?? undefined} onChange={(v) => setDraftLower(v ?? null)}
              />
            )}
            {(draftValidationType === 'NMT' || draftValidationType === 'RANGE') && (
              <InputNumber
                size="small" style={{ width: 90 }} placeholder="Upper Limit"
                status={draftValidationType === 'RANGE' && draftLower != null && draftUpper != null && draftLower >= draftUpper ? 'error' : undefined}
                value={draftUpper ?? undefined} onChange={(v) => setDraftUpper(v ?? null)}
              />
            )}
          </>
        ) : (
          <Input size="small" value={draftText} onChange={(e) => setDraftText(e.target.value)} style={{ width: 200 }} autoFocus />
        )}
        <Tooltip title={isNumber && draftValidationType === 'RANGE' && draftLower != null && draftUpper != null && draftLower >= draftUpper ? 'Lower Limit must be less than Upper Limit' : 'Save'}>
          <Button
            type="text" size="small" icon={<Check size={14} className="text-emerald-600" />} loading={mut.isPending}
            disabled={isNumber && draftValidationType === 'RANGE' && draftLower != null && draftUpper != null && draftLower >= draftUpper}
            onClick={() => mut.mutate(isNumber ? buildNumberSpec() : draftText)}
          />
        </Tooltip>
        <Tooltip title="Cancel">
          <Button type="text" size="small" icon={<X size={14} className="text-slate-400" />} onClick={() => setEditing(false)} />
        </Tooltip>
      </Space>
    )
  }

  return (
    <Space size={4}>
      {ctx}
      <span>{displayValue || '—'}</span>
      <Tooltip title="Edit specification for this group">
        <Button type="text" size="small" icon={<Edit3 size={12} className="text-indigo-600" />} onClick={startEdit} />
      </Tooltip>
    </Space>
  )
}

function TestGroupsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdTestGroup | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: ardApi.saveTestGroup,
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save test group.'),
  })

  const remove = useMutation({
    mutationFn: ardApi.deleteTestGroup,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      const g = data.testGroups.find((x) => x.id === id)
      msg.success(g ? `"${g.name}" deleted.` : 'Test group deleted.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to delete test group.'),
  })

  const removeTestFromGroup = (row: ArdTestGroup, testConfigId: string, testLabel: string) => {
    const nextIds = (row.testConfigIds ?? []).filter((id) => id !== testConfigId)
    save.mutate({ ...row, testConfigIds: nextIds } as Record<string, unknown>, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(`"${testLabel}" removed from "${row.name}".`)
      },
    })
  }

  const submitForm = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    save.mutate({ ...values, id: editing?.id, active: editing ? editing.active : true }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(`"${(values as any).name}" ${isEdit ? 'updated' : 'added'}.`)
        setOpen(false)
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.testGroups
    return data.testGroups.filter((g) => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))
  }, [data.testGroups, search])

  const openModal = (row?: ArdTestGroup) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ?? { name: '', description: '', testConfigIds: [] })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search test groups..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Test Group</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        expandable={{
          expandedRowRender: (row) => {
            const configs = data.testConfigs.filter((c) => (row.testConfigIds ?? []).includes(c.id))
            return (
              <div className="p-2 bg-slate-50/80 rounded border border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold text-slate-700 m-0">Linked Tests ({configs.length})</p>
                  <Button type="primary" size="small" icon={<Plus size={12} />} onClick={() => openModal(row)}>
                    Link tests
                  </Button>
                </div>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  dataSource={configs}
                  expandable={{
                    expandedRowRender: (test) => {
                      const member = row.members?.find((m) => m.testConfigId === test.id)
                      return (
                        <div className="p-2 bg-white rounded border border-slate-200">
                          <p className="text-xs font-semibold text-slate-700 m-0 mb-2">
                            Result Parameters ({(test.resultParams ?? []).length})
                          </p>
                          {(test.resultParams ?? []).length === 0 ? (
                            <p className="text-xs text-slate-400 italic m-0">No result parameters defined for this test.</p>
                          ) : (
                            <Table
                              size="small"
                              pagination={false}
                              rowKey="id"
                              dataSource={test.resultParams as ResultParam[]}
                              columns={[
                                { title: 'Result Parameter', dataIndex: 'name' },
                                { title: 'Result Data Type', dataIndex: 'dataType', render: (v) => v === 'number' ? 'Number' : 'Text' },
                                {
                                  title: 'Specification', dataIndex: 'specification',
                                  render: (_, param) => (
                                    <SpecOverrideCell
                                      groupId={row.id}
                                      memberId={member?.id}
                                      param={param}
                                      overrideValue={member?.specOverrides?.[param.id]}
                                    />
                                  ),
                                },
                                { title: 'UoM', dataIndex: 'uom', render: (v) => v || '—' },
                              ]}
                            />
                          )}
                          <p className="text-[11px] text-slate-400 mt-2 mb-0">
                            Editing here only overrides the Specification for this group — the shared Test Configuration is unchanged.
                          </p>
                        </div>
                      )
                    },
                  }}
                  columns={[
                    { title: 'Technique', dataIndex: 'techniqueCode', render: (v) => v ?? '—' },
                    { title: 'Test Type', dataIndex: 'testType' },
                    { title: 'Sub Type', dataIndex: 'testSubtype', render: (v) => v || '—' },
                    { title: 'Params', dataIndex: 'resultParams', render: (v: ResultParam[]) => <Tag>{v?.length ?? 0}</Tag> },
                    {
                      title: '', width: 50,
                      render: (_, test) => (
                        <Popconfirm
                          title="Remove this test from the group?"
                          onConfirm={() => removeTestFromGroup(row, test.id, test.code || test.testType)}
                        >
                          <Tooltip title="Remove from group">
                            <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                          </Tooltip>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </div>
            )
          },
        }}
        columns={[
          { title: 'Test Group Name', dataIndex: 'name' },
          { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
          { title: 'Tests', dataIndex: 'testConfigIds', render: (v: string[]) => <Tag color="blue">{v?.length ?? 0}</Tag> },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 100,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
                <Popconfirm
                  title="Delete this test group?"
                  description={`"${row.name}" will be permanently removed.`}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => remove.mutate(row.id)}
                >
                  <Tooltip title="Delete">
                    <Button type="text" size="small" danger icon={<Trash2 size={15} />} onClick={(e) => e.stopPropagation()} />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Test Group' : 'Add Test Group'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => submitForm(v))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
          <Form.Item name="testConfigIds" label="Tests" extra="Optional — you can add or remove tests after the group is created.">
            <Select mode="multiple" optionFilterProp="label" placeholder="Select tests"
              options={data.testConfigs.filter((c) => c.active).map((c) => ({
                value: c.id,
                label: c.testSubtype ? `${c.testType} - ${c.testSubtype}` : c.testType,
              }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Attributes ──────────────────────────────────────────────────────────

const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'switch', 'section']

function AttributesTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdAttribute | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const type = Form.useWatch('type', form)

  const save = useMutation({
    mutationFn: ardApi.saveAttribute,
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save attribute.'),
  })

  const toggleActive = (row: ArdAttribute, checked: boolean) => {
    save.mutate({ ...row, active: checked } as Record<string, unknown>, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(checked ? `"${row.label}" enabled.` : `"${row.label}" disabled.`)
      },
    })
  }

  const submitForm = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    save.mutate({ ...values, id: editing?.id, active: editing ? editing.active : true }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(isEdit ? 'Attribute updated.' : 'Attribute added.')
        setOpen(false)
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.attributes
    return data.attributes.filter((a) => a.label.toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
  }, [data.attributes, search])

  const openModal = (row?: ArdAttribute) => {
    setEditing(row ?? null)
    form.resetFields()
    form.setFieldsValue(row ?? { label: '', type: 'text', required: false })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search attributes..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Attribute</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'ATR Attribute Name', dataIndex: 'label' },
          { title: 'ATR Attribute Type', dataIndex: 'type' },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="small"
                  checked={row.active}
                  onChange={(checked) => toggleActive(row, checked)}
                />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Attribute' : 'Add Attribute'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => submitForm(v))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="label" label="ATR Attribute Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="ATR Attribute Type" rules={[{ required: true }]}>
            <Select options={FIELD_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          {(type === 'text' || type === 'textarea') && (
            <Form.Item name="maxLength" label="Max Length"><InputNumber className="w-full" min={1} /></Form.Item>
          )}
          {(type === 'select' || type === 'radio') && (
            <Form.List name="options">
              {(fields, { add, remove }) => (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.key} className="flex gap-2">
                      <Form.Item {...field} name={[field.name, 'label']} noStyle rules={[{ required: true, message: 'Label required' }]}>
                        <Input placeholder="Label" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'value']} noStyle>
                        <Input placeholder="Value" />
                      </Form.Item>
                      <Button danger size="small" onClick={() => remove(field.name)}>Remove</Button>
                    </div>
                  ))}
                  <Button size="small" icon={<Plus size={12} />} onClick={() => add({ label: '', value: '' })}>Add option</Button>
                </div>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>
    </div>
  )
}

// ── Form Types ──────────────────────────────────────────────────────────

const FORM_MANDATE_FIELDS: { name: string; label: string }[] = [
  { name: 'mandateCertification', label: 'Mandate Certification' },
  { name: 'mandateBatchNo', label: 'Mandate Batch Number' },
  { name: 'mandateQaSubmission', label: 'Mandate QA Submission' },
  { name: 'mandateSampleQty', label: 'Mandate Sample Quantity' },
]

function FormTypesTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [search, setSearch] = useState('')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdFormType | null>(null)
  const [form] = Form.useForm()

  // Attribute links and test group ids are edited locally inside the Add/Edit
  // modal and only persisted when the modal's own Save is clicked.
  const [attributeLinks, setAttributeLinks] = useState<FormTypeAttrLink[]>([])
  const [testGroupIds, setTestGroupIds] = useState<string[]>([])
  const [attrAddSel, setAttrAddSel] = useState<string[]>([])
  const [testGroupSel, setTestGroupSel] = useState<string | undefined>(undefined)

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => ardApi.saveFormType(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ard-master-data'] }),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save form type.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.formTypes
    return data.formTypes.filter((f) => f.name.toLowerCase().includes(q))
  }, [data.formTypes, search])

  const openModal = (row?: ArdFormType) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? { ...row } : {
      name: '', description: '',
      mandateCertification: false, mandateBatchNo: false, mandateSampleQty: false, mandateQaSubmission: false,
    })
    setAttributeLinks(row?.attributeLinks ?? [])
    setTestGroupIds(row?.testGroupIds ?? [])
    setAttrAddSel([])
    setTestGroupSel(undefined)
    setOpen(true)
  }

  const submitFormType = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    save.mutate({
      ...values, id: editing?.id, active: editing ? editing.active : true,
      attributeLinks, testGroupIds,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(`"${values.name}" ${isEdit ? 'updated' : 'added'}.`)
        setOpen(false)
      },
    })
  }

  const toggleActive = (row: ArdFormType, checked: boolean) => {
    save.mutate({ ...row, active: checked }, {
      onSuccess: () => msg.success(checked ? `"${row.name}" enabled.` : `"${row.name}" disabled.`),
    })
  }

  const attributeRows = useMemo(() => {
    return attributeLinks
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((link) => ({ link, attr: data.attributes.find((a) => a.id === link.attributeId) }))
      .filter((r) => !!r.attr)
  }, [attributeLinks, data.attributes])

  const availableAttrOptions = useMemo(() => {
    const linked = new Set(attributeLinks.map((l) => l.attributeId))
    return data.attributes.filter((a) => a.active && !linked.has(a.id)).map((a) => ({ value: a.id, label: a.label }))
  }, [data.attributes, attributeLinks])

  const addAttributes = () => {
    if (attrAddSel.length === 0) return
    setAttributeLinks([
      ...attributeLinks,
      ...attrAddSel.map((aid, i) => ({ attributeId: aid, sequence: attributeLinks.length + i, requiredOverride: false, displayInReport: true })),
    ])
    setAttrAddSel([])
  }

  const updateAttrLink = (attributeId: string, patch: Partial<FormTypeAttrLink>) => {
    setAttributeLinks(attributeLinks.map((l) => l.attributeId === attributeId ? { ...l, ...patch } : l))
  }

  const removeAttrLink = (attributeId: string) => {
    setAttributeLinks(attributeLinks.filter((l) => l.attributeId !== attributeId))
  }

  const availableTestGroupOptions = useMemo(() => {
    const linked = new Set(testGroupIds)
    return data.testGroups.filter((g) => g.active && !linked.has(g.id)).map((g) => ({ value: g.id, label: g.name }))
  }, [data.testGroups, testGroupIds])

  const linkedTestGroups = useMemo(() => {
    return testGroupIds.map((id) => data.testGroups.find((g) => g.id === id)).filter(Boolean) as ArdTestGroup[]
  }, [testGroupIds, data.testGroups])

  const addTestGroup = () => {
    if (!testGroupSel) return
    setTestGroupIds([...testGroupIds, testGroupSel])
    setTestGroupSel(undefined)
  }

  const removeTestGroup = (groupId: string) => {
    setTestGroupIds(testGroupIds.filter((id) => id !== groupId))
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search form types..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Form Type</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Name', dataIndex: 'name', render: (v) => <span className="font-medium text-slate-700">{v}</span> },
          { title: 'Attributes', dataIndex: 'attributeLinks', render: (v: any[]) => <Tag color="blue">{v.length}</Tag> },
          { title: 'Test Groups', dataIndex: 'testGroupIds', render: (v: any[]) => <Tag color="purple">{v?.length ?? 0}</Tag> },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch size="small" checked={row.active} onChange={(checked) => toggleActive(row, checked)} />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />

      {/* Add / Edit Form Type — rules, attributes, and test groups, all in one place. Every
          add/remove/toggle here is a single click; nothing hides behind a nested modal. */}
      <Modal
        {...glassModalProps}
        destroyOnClose
        width="min(880px, 92vw)"
        style={{ top: 24 }}
        styles={{ ...glassModalStyles, body: { ...glassModalStyles.body, maxHeight: '76vh', overflowY: 'auto' } }}
        title={editing ? 'Edit Form Type' : 'Add Form Type'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then(submitFormType)} confirmLoading={save.isPending}
        okText="Save"
      >
        <Form form={form} layout="vertical" className="space-y-1">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input size="large" /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>

          <div className="mb-1 text-[13px] font-medium text-slate-700">Mandatory Checks</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {FORM_MANDATE_FIELDS.map((f) => (
                <Form.Item key={f.name} name={f.name} valuePropName="checked" noStyle>
                  <Checkbox><span className="text-sm text-slate-700">{f.label}</span></Checkbox>
                </Form.Item>
              ))}
            </div>
          </div>
        </Form>

        <div className="rounded-lg border border-slate-200 p-3 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[13px] font-medium text-slate-700">Attributes</span>
            <Tag className="m-0 text-[11px] leading-4">{attributeRows.length}</Tag>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Select
              mode="multiple" showSearch optionFilterProp="label" allowClear
              placeholder="Search and pick attributes..."
              style={{ flex: 1 }}
              value={attrAddSel}
              onChange={setAttrAddSel}
              options={availableAttrOptions}
            />
            <Button type="primary" ghost disabled={attrAddSel.length === 0} onClick={addAttributes}>Add</Button>
          </div>
          {attributeRows.length > 0 ? (
            <Table
              rowKey={(r) => r.link.attributeId}
              dataSource={attributeRows}
              size="small"
              pagination={false}
              className="pt-1 border-t border-slate-100"
              columns={[
                { title: 'Attribute', render: (_, r) => <span className="font-medium text-slate-700">{r.attr!.label}</span> },
                { title: 'Type', render: (_, r) => <span className="text-slate-500">{r.attr!.type}</span>, width: 120 },
                {
                  title: 'Mandatory', width: 90, align: 'center' as const,
                  render: (_, r) => (
                    <Checkbox
                      checked={r.link.requiredOverride ?? r.attr!.required}
                      onChange={(e) => updateAttrLink(r.link.attributeId, { requiredOverride: e.target.checked })}
                    />
                  ),
                },
                {
                  title: 'Show in Report', width: 110, align: 'center' as const,
                  render: (_, r) => (
                    <Checkbox
                      checked={r.link.displayInReport ?? true}
                      onChange={(e) => updateAttrLink(r.link.attributeId, { displayInReport: e.target.checked })}
                    />
                  ),
                },
                {
                  title: '', width: 40,
                  render: (_, r) => <Button type="text" danger size="small" icon={<Trash2 size={14} />} onClick={() => removeAttrLink(r.link.attributeId)} />,
                },
              ]}
            />
          ) : (
            <p className="text-xs text-slate-400 mt-1 mb-0">No attributes linked yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[13px] font-medium text-slate-700">Test Groups</span>
            <Tag className="m-0 text-[11px] leading-4">{linkedTestGroups.length}</Tag>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Select
              showSearch optionFilterProp="label" allowClear
              placeholder="Search and pick a test group..."
              style={{ flex: 1 }}
              value={testGroupSel}
              onChange={setTestGroupSel}
              options={availableTestGroupOptions}
            />
            <Button type="primary" ghost disabled={!testGroupSel} onClick={addTestGroup}>Add</Button>
          </div>
          {linkedTestGroups.length > 0 ? (
            <Table
              rowKey="id"
              dataSource={linkedTestGroups}
              size="small"
              pagination={false}
              className="pt-1 border-t border-slate-100"
              expandable={{
                expandedRowRender: (group) => {
                  const configs = data.testConfigs.filter((c) => (group.testConfigIds ?? []).includes(c.id))
                  const paramRows = configs.flatMap((c) => (c.resultParams ?? []).map((p) => ({ config: c, param: p })))
                  if (paramRows.length === 0) {
                    return <p className="text-xs text-slate-400 italic px-3 py-2 m-0">No result parameters for the tests in this group.</p>
                  }
                  return (
                    <Table
                      size="small"
                      pagination={false}
                      rowKey={(r) => `${r.config.id}-${r.param.id}`}
                      dataSource={paramRows}
                      columns={[
                        { title: 'Test Type', render: (_, r) => r.config.testType },
                        { title: 'Sub Type', render: (_, r) => r.config.testSubtype || '—' },
                        { title: 'Result Type', render: (_, r) => r.param.dataType === 'number' ? 'NUMERIC' : 'TEXT' },
                        { title: 'UoM', render: (_, r) => r.param.uom || '—' },
                        { title: 'Specification', render: (_, r) => r.param.specification || '—' },
                      ]}
                    />
                  )
                },
              }}
              columns={[
                { title: 'Test Group', dataIndex: 'name' },
                { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
                {
                  title: '', width: 40,
                  render: (_, row) => <Button type="text" danger size="small" icon={<Trash2 size={14} />} onClick={() => removeTestGroup(row.id)} />,
                },
              ]}
            />
          ) : (
            <p className="text-xs text-slate-400 mt-1 mb-0">No test groups linked yet.</p>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ── Lookups ─────────────────────────────────────────────────────────────

function LookupsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdLookup | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const { data: categories } = useQuery({ queryKey: ['ard-lookup-categories'], queryFn: ardApi.lookupCategories })

  const save = useMutation({
    mutationFn: ardApi.saveLookup,
    onSuccess: (_, variables: any) => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      msg.success(`"${variables.label}" ${variables.id ? 'updated' : 'added'}.`)
      setOpen(false)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save lookup.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.lookups
    return data.lookups.filter((l) => l.category.toLowerCase().includes(q) || l.code.toLowerCase().includes(q) || l.label.toLowerCase().includes(q))
  }, [data.lookups, search])

  const openModal = (row?: ArdLookup) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ?? { category: undefined, code: '', label: '', description: '' })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search lookups by type, value code or value..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Lookup</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Lookup Type', dataIndex: 'category' },
          { title: 'Lookup Value Code', dataIndex: 'code', render: (v) => <span className="font-mono text-xs">{v}</span> },
          { title: 'Lookup Value', dataIndex: 'label' },
          { title: 'Description', dataIndex: 'description', render: (v) => v ?? '—' },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="small"
                  checked={row.active}
                  onChange={(checked) => save.mutate({ ...row, active: checked })}
                />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Lookup' : 'Add Lookup'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="Lookup Type" rules={[{ required: true }]} extra="Lookup types are defined by the admin module">
            <Select showSearch options={(categories ?? []).map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="code" label="Lookup Value Code" rules={[{ required: true }]}><Input className="font-mono" /></Form.Item>
          <Form.Item name="label" label="Lookup Value" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Lookup Desc" rules={[{ required: true, message: 'Lookup description is required' }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Data Items ("Template DataItems") ───────────────────────────────────
// Matches the legacy "Template DataItems" screen exactly (product owner review
// 2026-08-20): Data Type is Integer | Text | Date | LOV; Length Category is
// server-derived, never entered by the user; the Add modal is just
// Name / Data Type / Description, with a "Select LOV Lookup Type" field that
// appears only for LOV, sourced from the Inventory module's shared lookup
// table. Uses the dedicated ardDataItemApi (§3.2) for real server-side
// validation (duplicate name+lengthCategory, usage-guarded delete).

const DATA_ITEM_TYPES: { value: ArdDataItemType; label: string }[] = [
  { value: 'INTEGER', label: 'Integer' }, { value: 'TEXT', label: 'Text' },
  { value: 'DATE', label: 'Date' }, { value: 'LOV', label: 'LOV' },
]

// Standalone Add/Edit Data Item modal — shared by DataItemsTab (its own
// dedicated screen) and the Params section editor's "Add Item" button, so a
// new Data Item can be created without leaving the section being authored.
function AddDataItemModal({ open, onClose, onSaved, editing, lovLookupTypes }: {
  open: boolean
  onClose: () => void
  onSaved: (item: ArdDataItem) => void
  editing?: ArdDataItem | null
  lovLookupTypes: string[]
}) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [form] = Form.useForm()
  const dataType = Form.useWatch('dataType', form)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(editing ? { ...editing } : { name: '', dataType: 'INTEGER', description: '' })
  }, [open, editing, form])

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => (editing ? ardDataItemApi.save(editing.id, v) : ardDataItemApi.create(v)),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      qc.invalidateQueries({ queryKey: ['ard-data-items-active'] })
      msg.success(`"${saved.name}" ${editing ? 'updated' : 'added'}.`)
      onSaved(saved)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save data item.'),
  })

  return (
    <>
      {ctx}
      <Modal
        {...glassModalProps} destroyOnClose title={editing ? 'Edit Data Item' : 'Add Data Item'}
        open={open} onCancel={onClose}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, active: editing ? editing.active : true }))}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Dataitem Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="dataType" label="Data Type" rules={[{ required: true }]}><Select options={DATA_ITEM_TYPES} /></Form.Item>
          {dataType === 'LOV' && (
            <Form.Item name="lovLookupType" label="Select LOV Lookup Type" rules={[{ required: true, message: 'Select which Inventory lookup type supplies the selectable values' }]}>
              <Select showSearch options={lovLookupTypes.map((t) => ({ value: t, label: t }))} placeholder="Select a lookup type..." />
            </Form.Item>
          )}
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

// One input control per Data Item type — used by the Params section editor's
// live Preview so it shows exactly what the field will look like, without
// needing the real (not yet built) experiment-runtime params renderer.
function DataItemPreviewField({ item }: { item: { name: string; dataType: string } }) {
  return (
    <div className="border border-slate-200 rounded overflow-hidden flex flex-col sm:flex-row">
      <div className="bg-slate-100 text-xs font-medium text-slate-700 px-2.5 py-2 sm:w-1/2 flex items-center">{item.name}</div>
      <div className="p-1.5 sm:w-1/2">
        {item.dataType === 'DATE' ? (
          <DatePicker size="small" style={{ width: '100%' }} disabled />
        ) : item.dataType === 'LOV' ? (
          <Select size="small" style={{ width: '100%' }} placeholder="Select" disabled />
        ) : (
          <Input size="small" disabled type={item.dataType === 'INTEGER' ? 'number' : 'text'} />
        )}
      </div>
    </div>
  )
}

function DataItemsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdDataItem | null>(null)
  const [search, setSearch] = useState('')

  const { data: lovLookupTypes } = useQuery({
    queryKey: ['ard-data-item-lov-lookup-types'],
    queryFn: ardDataItemApi.lovLookupTypes,
  })

  const toggleActive = (row: ArdDataItem, checked: boolean) => {
    ardDataItemApi.save(row.id, { ...row, active: checked }).then(
      () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        qc.invalidateQueries({ queryKey: ['ard-data-items-active'] })
        msg.success(checked ? `"${row.name}" enabled.` : `"${row.name}" disabled.`)
      },
      (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update data item.'),
    )
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.dataItems
    return data.dataItems.filter((d) => d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q))
  }, [data.dataItems, search])

  const openModal = (row?: ArdDataItem) => {
    setEditing(row ?? null)
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search data items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Data Item</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Dataitem Name', dataIndex: 'name' },
          { title: 'Description', dataIndex: 'description', render: (v) => v ?? '—' },
          { title: 'Data Type', dataIndex: 'dataType', render: (v) => DATA_ITEM_TYPES.find((t) => t.value === v)?.label ?? v },
          { title: 'Length Category', dataIndex: 'lengthCategory', render: (v) => v ?? '—' },
          { title: 'Created By (On)', key: 'created', render: renderCreatedByOn },
          { title: 'Last Updated By (On)', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch
                  size="small"
                  checked={row.active}
                  onChange={(checked) => toggleActive(row, checked)}
                />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <AddDataItemModal
        open={open} onClose={() => setOpen(false)} editing={editing}
        lovLookupTypes={lovLookupTypes?.items ?? []}
        onSaved={() => setOpen(false)}
      />
    </div>
  )
}

// ── Sections (reusable master data — rearchitecture prompt §1.1-§1.9) ───────
// Sections authored here become attachable from more than one Template in the
// Template Builder — content authoring moved out of the builder into this tab.

const RICHTEXT_SECTION_TYPES: SectionType[] = ['richtext', 'standard_preparation']
const DATATABLE_SECTION_TYPES: SectionType[] = ['table', 'combined', 'weighing', 'ph', 'equipment', 'column', 'chemical', 'sample_details', 'quantitative_result', 'further_actions']
const SINGLE_DATA_ITEM_SECTION_TYPES: SectionType[] = ['data_item', 'autocomplete_data_item']
// 'combined' = Param block + Data Table block together, matching the legacy
// "Combined" section screen (product owner review 2026-08-20).
const MULTI_DATA_ITEM_SECTION_TYPES: SectionType[] = ['params', 'combined']
const EMBEDDED_FILE_SECTION_TYPES: SectionType[] = ['preconfigured_excel']
const CONTENT_BLOCK_SECTION_TYPES: SectionType[] = ['content_block']
// Lab Component GxP blocks use old's fixed free-text key/title columns, not a
// Master Data link — 'table'/'combined' stay on the governed dataItemId
// editor. Kept in sync with ArdTemplateBuilderPage.tsx's LAB_FREE_TEXT_TYPES.
const LAB_FREE_TEXT_SECTION_TYPES: SectionType[] = ['weighing', 'ph', 'equipment', 'column', 'chemical', 'sample_details', 'quantitative_result', 'further_actions']

function defaultGxPColumnsFor(type: SectionType): { columnKey: string; columnLabel: string }[] {
  if (type === 'sample_details') {
    return [
      { columnKey: 'atr_form_no', columnLabel: 'ATR Form No.' },
      { columnKey: 'project_code', columnLabel: 'Project Code' },
      { columnKey: 'sample_code', columnLabel: 'Sample Code' },
      { columnKey: 'sample_type', columnLabel: 'Sample Type' },
      { columnKey: 'test_subtype', columnLabel: 'Test Sub-type' },
      { columnKey: 'batch_no', columnLabel: 'Batch No.' },
      { columnKey: 'sample_condition', columnLabel: 'Sample Condition' },
      { columnKey: 'qty', columnLabel: 'Quantity / UOM' },
      { columnKey: 'ar_number', columnLabel: 'AR Number' },
      { columnKey: 'status', columnLabel: 'Status' },
    ]
  }
  if (type === 'weighing') {
    return [
      { columnKey: 'substance', columnLabel: 'Substance / Sample Name' },
      { columnKey: 'tare_wt', columnLabel: 'Tare Weight (g)' },
      { columnKey: 'gross_wt', columnLabel: 'Gross Weight (g)' },
      { columnKey: 'net_wt', columnLabel: 'Net Weight (g)' },
      { columnKey: 'balance_id', columnLabel: 'Balance ID' },
    ]
  }
  if (type === 'ph') {
    return [
      { columnKey: 'solution_name', columnLabel: 'Solution Name' },
      { columnKey: 'ph_val', columnLabel: 'Measured pH' },
      { columnKey: 'temperature', columnLabel: 'Temperature (°C)' },
      { columnKey: 'buffer_used', columnLabel: 'Buffer Standard' },
      { columnKey: 'meter_id', columnLabel: 'pH Meter ID' },
    ]
  }
  if (type === 'equipment') {
    return [
      { columnKey: 'equipment_name', columnLabel: 'Equipment Name' },
      { columnKey: 'equipment_id', columnLabel: 'Equipment ID' },
      { columnKey: 'cal_due_date', columnLabel: 'Calibration Due' },
      { columnKey: 'operator', columnLabel: 'Operator' },
    ]
  }
  if (type === 'column') {
    return [
      { columnKey: 'column_name', columnLabel: 'Column Name' },
      { columnKey: 'serial_no', columnLabel: 'Serial No.' },
      { columnKey: 'dimension', columnLabel: 'Dimensions (LxIDxP)' },
      { columnKey: 'inj_count', columnLabel: 'Injections' },
      { columnKey: 'theo_plates', columnLabel: 'Plates (N)' },
      { columnKey: 'tailing_factor', columnLabel: 'Tailing (TF)' },
    ]
  }
  if (type === 'chemical') {
    return [
      { columnKey: 'chemical_name', columnLabel: 'Reagent / Chemical' },
      { columnKey: 'grade', columnLabel: 'Grade' },
      { columnKey: 'batch_no', columnLabel: 'Batch / Lot No.' },
      { columnKey: 'exp_date', columnLabel: 'Expiry Date' },
      { columnKey: 'manufacturer', columnLabel: 'Manufacturer' },
    ]
  }
  if (type === 'quantitative_result') {
    return [
      { columnKey: 'param_code', columnLabel: 'Param Code' },
      { columnKey: 'param_name', columnLabel: 'Parameter Name' },
      { columnKey: 'specification', columnLabel: 'Specification Limit' },
      { columnKey: 'result', columnLabel: 'Observed Result' },
      { columnKey: 'uom', columnLabel: 'UOM' },
      { columnKey: 'compliance', columnLabel: 'Compliance' },
    ]
  }
  if (type === 'further_actions') {
    return [
      { columnKey: 'action_required', columnLabel: 'Action Required' },
      { columnKey: 'assigned_to', columnLabel: 'Assigned To' },
      { columnKey: 'target_date', columnLabel: 'Target Date' },
      { columnKey: 'status', columnLabel: 'Status' },
    ]
  }
  return []
}

// A non-developer author only ever needs to name a column ("Observed PH")
// — the internal storage key (observed_ph) is dev-flavored and meaningless
// to them, so it's derived automatically and hidden by default (see
// columnsAdvanced below). Only exposed for the rare case someone needs to
// match an existing key exactly.
function slugifyColumnKey(label: string): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return base || 'field'
}
function uniqueColumnKey(label: string, existing: { columnKey?: string | null }[], skipIndex: number): string {
  const base = slugifyColumnKey(label)
  const taken = new Set(existing.filter((_, i) => i !== skipIndex).map((c) => c.columnKey))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

function SectionsTab() {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdMasterSection | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const sectionType: SectionType | undefined = Form.useWatch('sectionType', form)
  const editorHeight: number | undefined = Form.useWatch('editorHeight', form)
  const [columns, setColumns] = useState<{ dataItemId?: string | null; columnKey?: string | null; columnLabel?: string | null; relativeWidth: number; isMandatory: boolean }[]>([])
  // Key column hidden by default (auto-derived from Label as the author
  // types) — "Advanced" reveals it for manual editing.
  const [columnsAdvanced, setColumnsAdvanced] = useState(false)
  const [dataItemLinks, setDataItemLinks] = useState<{ dataItemId: string; isMandatory: boolean }[]>([])
  const [singleDataItemId, setSingleDataItemId] = useState<string | undefined>()
  const [contentBlockId, setContentBlockId] = useState<string | undefined>()
  // Embedded spreadsheet — parsed client-side-triggered (server does the real
  // xlsx→Univer conversion) the instant a file is picked, so the preview shows
  // up immediately without requiring the section to be saved first. `pendingSheetFile`
  // is only set when the user picked a NEW file this session — that's what
  // actually gets persisted (re-uploaded for real) once Save succeeds.
  const [pendingSheetFile, setPendingSheetFile] = useState<File | null>(null)
  const [parsedSheet, setParsedSheet] = useState<{ fileName: string; workbookData: Record<string, unknown>; metadata: Record<string, unknown> } | null>(null)
  const [parsingSheet, setParsingSheet] = useState(false)
  const [richContent, setRichContent] = useState('')
  // Params editor — "Add Item" opens the real Add Data Item modal inline so a
  // brand-new data item can be created without leaving the section, and the
  // Preview toggle renders one input per linked item so the author can see
  // what the section will actually look like.
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [showParamsPreview, setShowParamsPreview] = useState(false)
  // Data Table's own name/description — a separate ArdSectionDatatable.name/description
  // pair, distinct from the section's own Name field above.
  const [datatableName, setDatatableName] = useState('')
  const [datatableDescription, setDatatableDescription] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['ard-sections'],
    queryFn: () => ardSectionApi.list({ pageSize: 200 }),
  })
  const { data: sectionTypes } = useQuery({ queryKey: ['ard-section-types'], queryFn: ardTemplateApi.sectionTypes })
  const { data: dataItems } = useQuery({
    queryKey: ['ard-data-items-active'],
    queryFn: () => ardDataItemApi.list({ is_active: 'true', pageSize: 500 }),
  })
  const { data: lovLookupTypes } = useQuery({
    queryKey: ['ard-data-item-lov-lookup-types'],
    queryFn: ardDataItemApi.lovLookupTypes,
  })
  const { data: contentBlocksData } = useQuery({
    queryKey: ['ard-content-blocks'],
    queryFn: () => ardApi.listContentBlocks(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ard-sections'] })
    qc.invalidateQueries({ queryKey: ['ard-data-items-active'] })
  }

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (editing ? ardSectionApi.save(editing.id, body) : ardSectionApi.create(body)),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save section.'),
  })

  const toggleActive = (row: ArdMasterSection, checked: boolean) => {
    ardSectionApi.save(row.id, {
      name: row.name, description: row.description, uniqueIdentifier: row.uniqueIdentifier,
      sectionType: row.sectionType, deptId: row.deptId, active: checked,
    }).then(
      () => { invalidate(); msg.success(checked ? `"${row.name}" enabled.` : `"${row.name}" disabled.`) },
      (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update section.'),
    )
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = data?.items ?? []
    if (!q) return items
    return items.filter((s) => s.name.toLowerCase().includes(q) || s.sectionType.toLowerCase().includes(q))
  }, [data, search])

  const [modalLoading, setModalLoading] = useState(false)

  const populateModal = (row: ArdMasterSection) => {
    setEditing(row)
    form.setFieldsValue({
      name: row.name, description: row.description, uniqueIdentifier: row.uniqueIdentifier,
      sectionType: row.sectionType,
      editorHeight: row.richtext?.editorHeight ?? 200,
    })
    setRichContent(row.richtext?.defaultContent ?? '')
    setColumns((row.datatable?.columns ?? []).map((c) => ({ dataItemId: c.dataItemId, columnKey: c.columnKey, columnLabel: c.columnLabel, relativeWidth: c.relativeWidth, isMandatory: c.isMandatory })))
    setDatatableName(row.datatable?.name ?? '')
    setDatatableDescription(row.datatable?.description ?? '')
    setDataItemLinks((row.dataItemLinks ?? []).map((l) => ({ dataItemId: l.dataItemId, isMandatory: l.isMandatory })))
    setSingleDataItemId(row.dataItemLinks?.[0]?.dataItemId)
    setContentBlockId(row.contentBlockId ?? undefined)
    setPendingSheetFile(null)
    setParsedSheet(row.embeddedFile?.workbookData
      ? { fileName: row.embeddedFile.fileName ?? 'spreadsheet.xlsx', workbookData: row.embeddedFile.workbookData, metadata: row.embeddedFile.metadata ?? {} }
      : null)
  }

  const openModal = (row?: ArdMasterSection) => {
    form.resetFields()
    if (row) {
      // The list row is a lightweight summary (no richtext/datatable/embeddedFile/
      // dataItemLinks — see sectionSummaryOut on the backend) — populating the edit
      // form straight from it would show blank content for an existing section and
      // risk overwriting real data with that blank on save. Fetch the full record.
      setEditing(row)
      setModalLoading(true)
      setOpen(true)
      ardSectionApi.get(row.id).then(
        (full) => { populateModal(full); setModalLoading(false) },
        (e) => { setModalLoading(false); setOpen(false); msg.error(e instanceof ApiError ? e.detail : 'Failed to load section.') },
      )
      return
    }
    setEditing(null)
    form.setFieldsValue({ name: '', description: '', uniqueIdentifier: '', sectionType: 'richtext', editorHeight: 200 })
    setRichContent('')
    setColumns([])
    setDataItemLinks([])
    setSingleDataItemId(undefined)
    setContentBlockId(undefined)
    setPendingSheetFile(null)
    setParsedSheet(null)
    setDatatableName('')
    setDatatableDescription('')
    setOpen(true)
  }

  const submitForm = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    const stype = values.sectionType as SectionType
    const body: Record<string, unknown> = {
      name: values.name, description: values.description ?? null, uniqueIdentifier: values.uniqueIdentifier ?? null,
      sectionType: stype, active: editing ? editing.active : true,
    }
    if (RICHTEXT_SECTION_TYPES.includes(stype)) {
      body.richtext = { defaultContent: richContent || null, editorHeight: values.editorHeight ?? null, editorWidth: 100 }
    }
    if (DATATABLE_SECTION_TYPES.includes(stype)) {
      body.datatable = { name: datatableName || null, description: datatableDescription || null, typicalRowCount: 3, columns: columns.map((c, i) => ({ ...c, sequenceNumber: i })) }
    }
    if (SINGLE_DATA_ITEM_SECTION_TYPES.includes(stype)) {
      if (!singleDataItemId) { msg.error('Select a linked data item.'); return }
      body.dataItemLink = { dataItemId: singleDataItemId, isMandatory: true }
    }
    if (MULTI_DATA_ITEM_SECTION_TYPES.includes(stype)) {
      body.dataItemLinks = dataItemLinks.map((l, i) => ({ ...l, sequenceNumber: i }))
    }
    if (CONTENT_BLOCK_SECTION_TYPES.includes(stype)) {
      if (!contentBlockId) { msg.error('Select a content block.'); return }
      body.contentBlockId = contentBlockId
    }

    save.mutate(body, {
      onSuccess: (saved) => {
        invalidate()
        // The spreadsheet itself was only parsed for preview so far (parse-embedded-file
        // doesn't persist anything) — now that the section has a real id, re-upload the
        // same file for real so it's actually saved.
        if (pendingSheetFile) {
          ardSectionApi.uploadEmbeddedFile(saved.id, pendingSheetFile).then(
            () => { invalidate(); msg.success(`"${values.name}" ${isEdit ? 'updated' : 'added'}.`) },
            (e) => msg.error(e instanceof ApiError ? e.detail : 'Section saved, but the spreadsheet failed to upload — try replacing it from Edit.'),
          )
        } else {
          msg.success(`"${values.name}" ${isEdit ? 'updated' : 'added'}.`)
        }
        setOpen(false)
      },
    })
  }

  const columnWidthSum = columns.reduce((acc, c) => acc + (c.relativeWidth || 0), 0)
  const dataItemOptions = (dataItems?.items ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.dataType})` }))

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search sections..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Section</Button>
      </div>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'sectionType', render: (v) => sectionTypes?.find((t) => t.type === v)?.label ?? v },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_, row) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch size="small" checked={row.active} onChange={(checked) => toggleActive(row, checked)} />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        {...glassModalProps}
        destroyOnClose
        width="min(1400px, 94vw)"
        style={{ top: 24 }}
        styles={{ ...glassModalStyles, body: { ...glassModalStyles.body, maxHeight: '78vh', overflowY: 'auto' } }}
        title={editing ? 'Edit Section' : 'Add Section'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => submitForm(v))} confirmLoading={save.isPending || modalLoading}>
        <Spin spinning={modalLoading}>
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="sectionType" label="Section Type" rules={[{ required: true }]}>
              <Select options={(sectionTypes ?? []).map((t) => ({ value: t.type, label: t.label }))} disabled={!!editing} />
            </Form.Item>
          </div>
          {editing && <p className="text-[11px] text-slate-400 -mt-2 mb-3">Section type cannot be changed after creation.</p>}

          {sectionType === 'combined' && (
            <p className="text-[11px] text-slate-500 bg-indigo-50/60 border border-indigo-100 rounded px-2.5 py-1.5 -mt-1 mb-3">
              Combined sections carry both a Param block and a Data Table block — fill in the ones you need below.
            </p>
          )}

          {sectionType && RICHTEXT_SECTION_TYPES.includes(sectionType) && (
            <div className="border border-slate-200 rounded-lg p-3 mb-4">
              <Form.Item name="editorHeight" label="Height" extra="How tall this rich-text box renders wherever the section is used — content beyond this scrolls inside the box." rules={[{ required: true, message: 'Height is required' }]}>
                <InputNumber min={60} step={20} style={{ width: 160 }} placeholder="e.g. 200" addonAfter="px" />
              </Form.Item>
              <Form.Item label="Default Content" className="mb-0">
                <RichEditor value={richContent} onChange={setRichContent} height={editorHeight || 200} />
              </Form.Item>
            </div>
          )}

          {sectionType && SINGLE_DATA_ITEM_SECTION_TYPES.includes(sectionType) && (
            <div className="border border-slate-200 rounded-lg p-3 mb-4">
              <Form.Item label="Linked Data Item" required className="mb-0">
                <Select showSearch optionFilterProp="label" placeholder="Select a data item..." value={singleDataItemId} onChange={setSingleDataItemId} options={dataItemOptions} />
              </Form.Item>
            </div>
          )}

          {sectionType && MULTI_DATA_ITEM_SECTION_TYPES.includes(sectionType) && (
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">Param</label>
                <div className="flex items-center gap-2">
                  <Select
                    showSearch optionFilterProp="label" placeholder="Add existing..." style={{ width: 240 }}
                    value={null}
                    onChange={(v: string) => { if (!dataItemLinks.some((l) => l.dataItemId === v)) setDataItemLinks([...dataItemLinks, { dataItemId: v, isMandatory: false }]) }}
                    options={dataItemOptions.filter((o) => !dataItemLinks.some((l) => l.dataItemId === o.value))}
                  />
                  <Button icon={<Plus size={14} />} onClick={() => setAddItemOpen(true)}>Add Item</Button>
                </div>
              </div>

              {dataItemLinks.length > 0 && (
                <Table
                  size="small"
                  bordered
                  pagination={false}
                  rowKey="dataItemId"
                  dataSource={dataItemLinks}
                  columns={[
                    {
                      title: 'Name', dataIndex: 'dataItemId',
                      render: (id: string) => (dataItems?.items ?? []).find((d) => d.id === id)?.name ?? id,
                    },
                    {
                      title: 'Description', dataIndex: 'dataItemId',
                      render: (id: string) => (dataItems?.items ?? []).find((d) => d.id === id)?.description || <span className="text-slate-300">—</span>,
                    },
                    {
                      title: 'Data Type', dataIndex: 'dataItemId', width: 110,
                      render: (id: string) => {
                        const t = (dataItems?.items ?? []).find((d) => d.id === id)?.dataType
                        return DATA_ITEM_TYPES.find((x) => x.value === t)?.label ?? t ?? '—'
                      },
                    },
                    {
                      title: 'Length', dataIndex: 'dataItemId', width: 90,
                      render: (id: string) => (dataItems?.items ?? []).find((d) => d.id === id)?.lengthCategory ?? '—',
                    },
                    {
                      title: 'Mandatory', width: 90, align: 'center',
                      render: (_: unknown, l, i) => (
                        <Checkbox checked={l.isMandatory} onChange={(e) => setDataItemLinks(dataItemLinks.map((x, xi) => xi === i ? { ...x, isMandatory: e.target.checked } : x))} />
                      ),
                    },
                    {
                      title: '', width: 40,
                      render: (_: unknown, _l, i) => (
                        <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => setDataItemLinks(dataItemLinks.filter((_, xi) => xi !== i))} />
                      ),
                    },
                  ]}
                />
              )}

              <div className="flex items-center justify-end">
                <Button size="small" onClick={() => setShowParamsPreview((v) => !v)}>
                  {showParamsPreview ? 'Hide Preview' : 'Preview'}
                </Button>
              </div>

              {showParamsPreview && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-teal-700 text-white text-sm font-semibold px-3 py-1.5">Section Preview</div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dataItemLinks.length === 0 ? (
                      <p className="text-xs text-slate-400 col-span-full">No parameters added yet.</p>
                    ) : dataItemLinks.map((l) => {
                      const item = (dataItems?.items ?? []).find((d) => d.id === l.dataItemId)
                      return item ? <DataItemPreviewField key={l.dataItemId} item={item} /> : null
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {sectionType && CONTENT_BLOCK_SECTION_TYPES.includes(sectionType) && (
            <div className="border border-slate-200 rounded-lg p-3 mb-4">
              <Form.Item label="Content Library Block" required extra="Manage the block's own content under the Template Section tab." className="mb-0">
                <Select
                  showSearch optionFilterProp="label" placeholder="Select a content block..."
                  value={contentBlockId} onChange={setContentBlockId}
                  options={(contentBlocksData?.items ?? []).filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.name} (${b.contentType})` }))}
                />
              </Form.Item>
            </div>
          )}

          {sectionType && DATATABLE_SECTION_TYPES.includes(sectionType) && LAB_FREE_TEXT_SECTION_TYPES.includes(sectionType) && (
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">Table Columns</label>
                <div className="flex items-center gap-1">
                  <Button size="small" type="text" className="text-slate-500 hover:text-slate-700 text-xs px-1 h-6"
                    onClick={() => setColumnsAdvanced((v) => !v)}>
                    {columnsAdvanced ? 'Hide key' : 'Advanced'}
                  </Button>
                  <Button
                    size="small" type="text" className="text-indigo-600 hover:text-indigo-700 text-xs px-1 h-6 flex items-center gap-1"
                    icon={<RotateCcw size={12} />}
                    onClick={() => { setColumns(defaultGxPColumnsFor(sectionType).map((c) => ({ ...c, relativeWidth: 20, isMandatory: false }))); msg.info('Reset columns to standard GxP schema.') }}
                  >
                    Reset to GxP schema
                  </Button>
                </div>
              </div>
              {columns.map((c, i) => (
                <div key={`${c.columnKey}-${i}`} className="flex items-center gap-2 bg-slate-50/70 p-2 rounded border border-slate-200">
                  {columnsAdvanced && (
                    <Input size="small" className="font-mono text-xs" placeholder="Key" value={c.columnKey ?? ''} onChange={(e) => setColumns(columns.map((x, xi) => xi === i ? { ...x, columnKey: e.target.value } : x))} />
                  )}
                  <Input size="small" placeholder="Column name" value={c.columnLabel ?? ''} onChange={(e) => {
                    const label = e.target.value
                    setColumns(columns.map((x, xi) => xi === i
                      ? { ...x, columnLabel: label, ...(columnsAdvanced ? {} : { columnKey: uniqueColumnKey(label, columns, i) }) }
                      : x))
                  }} />
                  <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => setColumns(columns.filter((_, xi) => xi !== i))} />
                </div>
              ))}
              <Button block type="dashed" size="small" icon={<Plus size={13} />}
                onClick={() => {
                  const label = `New Column ${columns.length + 1}`
                  setColumns([...columns, { columnKey: uniqueColumnKey(label, columns, -1), columnLabel: label, relativeWidth: 20, isMandatory: false }])
                }}>
                Add Column
              </Button>
            </div>
          )}

          {sectionType && DATATABLE_SECTION_TYPES.includes(sectionType) && !LAB_FREE_TEXT_SECTION_TYPES.includes(sectionType) && (
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Form.Item label="Datatable Name" className="mb-2">
                  <Input value={datatableName} onChange={(e) => setDatatableName(e.target.value)} placeholder="e.g. Purity" />
                </Form.Item>
                <Form.Item label="Datatable Description" className="mb-2">
                  <Input value={datatableDescription} onChange={(e) => setDatatableDescription(e.target.value)} />
                </Form.Item>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="text-xs font-bold tracking-wide text-slate-700 uppercase">Data Table</label>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] ${columnWidthSum > 100 ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>Width total: {columnWidthSum}/100</span>
                  <Select
                    showSearch optionFilterProp="label" placeholder="Add existing..." style={{ width: 220 }}
                    value={null}
                    onChange={(v: string) => { if (!columns.some((c) => c.dataItemId === v)) setColumns([...columns, { dataItemId: v, relativeWidth: 20, isMandatory: false }]) }}
                    options={dataItemOptions.filter((o) => !columns.some((c) => c.dataItemId === o.value))}
                  />
                  <Button icon={<Plus size={14} />} onClick={() => setAddItemOpen(true)}>Add Item</Button>
                </div>
              </div>

              {columns.length > 0 && (
                <Table
                  size="small"
                  bordered
                  pagination={false}
                  rowKey={(c) => c.dataItemId ?? ''}
                  dataSource={columns}
                  columns={[
                    {
                      title: 'Name', dataIndex: 'dataItemId',
                      render: (id: string) => (dataItems?.items ?? []).find((d) => d.id === id)?.name ?? id,
                    },
                    {
                      title: 'Description', dataIndex: 'dataItemId',
                      render: (id: string) => (dataItems?.items ?? []).find((d) => d.id === id)?.description || <span className="text-slate-300">—</span>,
                    },
                    {
                      title: 'Data Type', dataIndex: 'dataItemId', width: 110,
                      render: (id: string) => {
                        const t = (dataItems?.items ?? []).find((d) => d.id === id)?.dataType
                        return DATA_ITEM_TYPES.find((x) => x.value === t)?.label ?? t ?? '—'
                      },
                    },
                    {
                      title: 'Relative Width', width: 130,
                      render: (_: unknown, c, i) => (
                        <InputNumber size="small" min={1} max={100} value={c.relativeWidth} onChange={(v) => setColumns(columns.map((x, xi) => xi === i ? { ...x, relativeWidth: Number(v) || 0 } : x))} style={{ width: 70 }} />
                      ),
                    },
                    {
                      title: 'Is Mandatory', width: 90, align: 'center',
                      render: (_: unknown, c, i) => (
                        <Checkbox checked={c.isMandatory} onChange={(e) => setColumns(columns.map((x, xi) => xi === i ? { ...x, isMandatory: e.target.checked } : x))} />
                      ),
                    },
                    {
                      title: '', width: 40,
                      render: (_: unknown, _c, i) => (
                        <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => setColumns(columns.filter((_, xi) => xi !== i))} />
                      ),
                    },
                  ]}
                />
              )}
              <p className="text-[11px] text-slate-400">At most 10 columns; widths must sum to 100 or less.</p>

              <div className="flex items-center justify-end">
                <Button size="small" onClick={() => setShowParamsPreview((v) => !v)}>
                  {showParamsPreview ? 'Hide Preview' : 'Preview'}
                </Button>
              </div>

              {showParamsPreview && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-teal-700 text-white text-sm font-semibold px-3 py-1.5">Section Preview</div>
                  <Table
                    size="small"
                    bordered
                    pagination={false}
                    dataSource={[]}
                    locale={{ emptyText: 'No records found.' }}
                    columns={[
                      { title: 'Select', width: 60, render: () => <Checkbox disabled /> },
                      { title: 'Sl.No.', width: 70 },
                      ...columns.map((c, i) => ({
                        title: (dataItems?.items ?? []).find((d) => d.id === c.dataItemId)?.name ?? `Column ${i + 1}`,
                        key: c.dataItemId ?? i,
                      })),
                    ]}
                  />
                </div>
              )}
            </div>
          )}

          {sectionType && EMBEDDED_FILE_SECTION_TYPES.includes(sectionType) && (
            <div className="space-y-2 border border-slate-200 rounded-lg p-3 mb-4">
              <label className="text-xs font-semibold text-slate-700">Preconfigured Spreadsheet (.xlsx / .xls)</label>
              <div className="space-y-2">
                <Upload disabled={parsingSheet} beforeUpload={(f) => {
                  setParsingSheet(true)
                  ardSectionApi.parseEmbeddedFile(f).then(
                    (result) => { setPendingSheetFile(f); setParsedSheet(result) },
                    (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to read spreadsheet.'),
                  ).finally(() => setParsingSheet(false))
                  return false
                }}>
                  <Button icon={<UploadIcon size={14} />} size="small" loading={parsingSheet}>
                    {parsedSheet ? 'Replace' : 'Add Excel'}
                  </Button>
                </Upload>
                {parsingSheet && <p className="text-[11px] text-slate-400">Reading spreadsheet…</p>}
                {parsedSheet ? (
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <div className="bg-teal-700 text-white text-sm font-semibold px-3 py-1.5">{parsedSheet.fileName}</div>
                    <SpreadsheetFieldRuntime
                      spreadsheet={{ workbookData: parsedSheet.workbookData, protectedRanges: (parsedSheet.metadata as any)?.protectedRanges } as any}
                      value={{}} onChange={() => {}} disabled
                    />
                  </div>
                ) : !parsingSheet && (
                  <p className="text-[11px] text-slate-400">No spreadsheet uploaded yet.</p>
                )}
              </div>
            </div>
          )}
        </Form>
        </Spin>
      </Modal>
      <AddDataItemModal
        open={addItemOpen} onClose={() => setAddItemOpen(false)}
        lovLookupTypes={lovLookupTypes?.items ?? []}
        onSaved={(item) => {
          // Both Params (dataItemLinks) and Data Table (columns) reuse this same
          // "Add Item" button — route the new item to whichever list applies.
          if (sectionType && MULTI_DATA_ITEM_SECTION_TYPES.includes(sectionType)) {
            setDataItemLinks((links) => links.some((l) => l.dataItemId === item.id) ? links : [...links, { dataItemId: item.id, isMandatory: false }])
          } else {
            setColumns((cols) => cols.some((c) => c.dataItemId === item.id) ? cols : [...cols, { dataItemId: item.id, relativeWidth: 20, isMandatory: false }])
          }
          setAddItemOpen(false)
        }}
      />
    </div>
  )
}

// ── Content Library ───────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: 'richtext', label: 'Rich Text' },
  { value: 'doc', label: 'Document (plain text)' },
]

function ContentLibraryTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdContentBlock | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const [bodyHtml, setBodyHtml] = useState('')
  const contentType = Form.useWatch('contentType', form)

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => ardApi.saveContentBlock({ ...v, body: bodyHtml }),
    onError: (e: unknown) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save content block.'),
  })

  const toggleActive = (row: ArdContentBlock, checked: boolean) => {
    save.mutate({ ...row, id: row.id, active: checked }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(checked ? `"${row.name}" enabled.` : `"${row.name}" disabled.`)
      },
    })
  }

  const submitForm = (values: Record<string, unknown>) => {
    const isEdit = !!editing
    save.mutate({ ...values, id: editing?.id, active: editing ? editing.active : true }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['ard-master-data'] })
        msg.success(isEdit ? 'Template section updated.' : 'Template section added.')
        setOpen(false)
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.contentBlocks ?? []
    return (data.contentBlocks ?? []).filter((b) => b.name.toLowerCase().includes(q))
  }, [data.contentBlocks, search])

  const openModal = (row?: ArdContentBlock) => {
    setEditing(row ?? null)
    setBodyHtml(row?.body ?? '')
    form.resetFields()
    form.setFieldsValue(row ? { name: row.name, contentType: row.contentType, displayHeight: row.displayHeight } : { name: '', contentType: 'richtext', displayHeight: 250 })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search content blocks..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Template Section</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Type', dataIndex: 'contentType', render: (v: string) => CONTENT_TYPES.find((t) => t.value === v)?.label ?? v },
          { title: 'Status', dataIndex: 'active', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
          { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
          { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
          {
            title: 'Actions', width: 120,
            render: (_: unknown, row: ArdContentBlock) => (
              <Space size={8} onClick={(e) => e.stopPropagation()}>
                <Switch size="small" checked={row.active} onChange={(checked) => toggleActive(row, checked)} />
                <Tooltip title={row.active ? 'Edit' : 'Enable this record to edit it'}>
                  <Button type="text" size="small" disabled={!row.active} icon={<Edit3 size={15} className={row.active ? 'text-indigo-600' : 'text-slate-300'} />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        {...glassModalProps}
        destroyOnClose
        title={editing ? 'Edit Template Section' : 'Add Template Section'}
        open={open}
        width={780}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v: Record<string, unknown>) => submitForm(v))}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Section Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Standard Disclaimer, SOP Reference Text" />
          </Form.Item>
          <Form.Item name="contentType" label="Content Type" rules={[{ required: true }]}>
            <Select options={CONTENT_TYPES} />
          </Form.Item>
          <Form.Item
            name="displayHeight"
            label="Display Height (px)"
            rules={[{ required: true, message: 'Height is required' }, { type: 'number', min: 100, max: 1200, message: 'Must be between 100 and 1200' }]}
            extra="Fixed height in pixels — content scrolls inside this area in experiments."
          >
            <InputNumber min={100} max={1200} step={50} placeholder="e.g. 250" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Body Content">
            {contentType === 'richtext' ? (
              <RichEditor value={bodyHtml} onChange={(v) => setBodyHtml(v)} readOnly={false} height={300} />
            ) : (
              <TextArea
                rows={8}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="Enter plain text content..."
              />
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Qualifications ────────────────────────────────────────────────────────

function QualificationsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [viewingQual, setViewingQual] = useState<ArdAnalystQualification | null>(null)
  const [certModal, setCertModal] = useState<{
    qualificationId: string
    analystName: string
    techniqueId: string
    techCode: string
    techName: string
    startDate?: string | null
    endDate?: string | null
    certificationPath?: string | null
  } | null>(null)
  const [certPreviewUrl, setCertPreviewUrl] = useState<string | null>(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const [editing, setEditing] = useState<ArdAnalystQualification | null>(null)
  const [editingAlert, setEditingAlert] = useState<ArdQualificationAlert | null>(null)
  const [form] = Form.useForm()
  const [alertForm] = Form.useForm()

  const currentUser = useAppSelector(selectUser)
  const isHodOrAdmin = ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role_code ?? '')

  const [approvingId, setApprovingId] = useState<string | null>(null)

  const approveQualMut = useMutation({
    mutationFn: (id: string) => apiPost(`/api/ard/master-data/qualifications/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      msg.success('Qualification approved.')
      setApprovingId(null)
    },
    onError: (e) => { msg.error(e instanceof ApiError ? e.detail : 'Failed to approve.'); setApprovingId(null) },
  })

  const { data: evaluation } = useQuery({ queryKey: ['ard-qualification-evaluate'], queryFn: ardApi.evaluateAlerts })
  const { data: analystUsers } = useQuery({
    queryKey: ['ard-analyst-users'],
    queryFn: () => adminApi.listUsers({ role_code: 'ANALYST', page_size: 200 }),
  })
  const qualifiedUserIds = new Set(data.qualifications.map((q) => q.userId))
  const analystOptions = (analystUsers?.items ?? [])
    .filter((u) => !qualifiedUserIds.has(u.id) || u.id === editing?.userId)
    .map((u) => ({ value: u.id, label: `${u.display_name || u.username} (${u.emp_no || u.id})` }))

  const [pendingCertFiles, setPendingCertFiles] = useState<Record<string, File>>({})

  const saveQualification = useMutation({
    mutationFn: async (v: any) => {
      const saved = await ardApi.saveQualification({
        id: v.id,
        userId: v.userId,
        techniqueEntries: (v.techniqueIds ?? []).map((tid: string) => ({
          techniqueId: tid,
          startDate: v[`start_${tid}`] ? v[`start_${tid}`].format('YYYY-MM-DD') : null,
          endDate: v[`end_${tid}`] ? v[`end_${tid}`].format('YYYY-MM-DD') : null,
        })),
        validTill: v.validTill ? v.validTill.format('YYYY-MM-DD') : null,
        remarks: v.remarks || null,
      })
      for (const [tid, file] of Object.entries(pendingCertFiles)) {
        if (file && saved?.id) {
          try {
            await ardApi.uploadCertificate(saved.id, tid, file)
          } catch {
            // ignore partial upload error
          }
        }
      }
      return saved
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      qc.invalidateQueries({ queryKey: ['ard-qualification-evaluate'] })
      msg.success('Qualification saved successfully.')
      setOpen(false)
      setPendingCertFiles({})
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save qualification.'),
  })

  const saveAlert = useMutation({
    mutationFn: ardApi.saveQualificationAlert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); qc.invalidateQueries({ queryKey: ['ard-qualification-evaluate'] }); msg.success('Alert saved.'); setAlertOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save alert.'),
  })

  const uploadCert = useMutation({
    mutationFn: ({ qualificationId, techniqueId, file }: { qualificationId: string; techniqueId: string; file: File }) =>
      ardApi.uploadCertificate(qualificationId, techniqueId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      msg.success('Certificate PDF uploaded successfully.')
      setCertModal(null)
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to upload certificate.'),
  })

  useEffect(() => {
    if (!certModal?.certificationPath) { setCertPreviewUrl(null); return }
    let revoked = false
    apiDownloadBlob(`/api/ard/qualifications/certificate?qualification_id=${certModal.qualificationId}&technique_id=${certModal.techniqueId}`)
      .then(({ blob }) => { if (!revoked) setCertPreviewUrl(URL.createObjectURL(blob)) })
      .catch(() => setCertPreviewUrl(null))
    return () => {
      revoked = true
      setCertPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [certModal?.qualificationId, certModal?.techniqueId, certModal?.certificationPath])

  const downloadCertificate = async (qualificationId: string, techniqueId: string, filename: string) => {
    try {
      const { blob } = await apiDownloadBlob(
        `/api/ard/qualifications/certificate?qualification_id=${qualificationId}&technique_id=${techniqueId}`
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      msg.info('No uploaded PDF certificate file attached yet for this technique record.')
    }
  }

  const openModal = (row?: ArdAnalystQualification) => {
    setEditing(row ?? null)
    setPendingCertFiles({})
    const base: Record<string, unknown> = {
      userId: row ? (row.analystName || row.userId) : undefined,
      techniqueIds: (row?.techniqueEntries ?? []).map((e) => e.techniqueId),
      validTill: (row as any)?.validTill ? dayjs((row as any).validTill) : undefined,
      remarks: (row as any)?.remarks ?? '',
    }
    for (const e of row?.techniqueEntries ?? []) {
      if (e.startDate) base[`start_${e.techniqueId}`] = dayjs(e.startDate)
      if (e.endDate) base[`end_${e.techniqueId}`] = dayjs(e.endDate)
    }
    form.setFieldsValue(base)
    setOpen(true)
  }

  const techniqueIds: string[] = Form.useWatch('techniqueIds', form) ?? []

  return (
    <div className="space-y-6">
      {ctx}
      {evaluation && (evaluation.expired > 0 || evaluation.expiring > 0) && (
        <Card size="small" className="border-amber-200 bg-amber-50/70">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>Qualification Alert:</strong> {evaluation.expired} qualification(s) expired, {evaluation.expiring} expiring within the warning alert window.
            </span>
          </div>
        </Card>
      )}

      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Analyst Qualifications Matrix</h3>
            <p className="text-xs text-slate-400">Technique qualifications, validity periods, and certificate metadata</p>
          </div>
          <div className="flex gap-2">
            <Upload
              accept=".csv"
              showUploadList={false}
              beforeUpload={(file) => {
                const fd = new FormData()
                fd.append('file', file)
                fetch('/api/ard/master-data/qualifications/import-csv', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } })
                  .then((r) => r.json())
                  .then((res) => {
                    const body = res?.data ?? res
                    msg.success(`Imported ${body.created} qualification(s)${body.skipped > 0 ? `, ${body.skipped} skipped` : ''}.`)
                    if (body.errors?.length) msg.warning(`${body.errors.length} row(s) had errors — see console.`)
                    if (body.errors?.length) console.warn('Qualification CSV import errors:', body.errors)
                    qc.invalidateQueries({ queryKey: ['ard-master-data'] })
                  })
                  .catch(() => msg.error('CSV import failed. Expected columns: username (or empNo), techniqueCode, startDate, endDate, validTill.'))
                return false
              }}
            >
              <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
            </Upload>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Analyst Qualification</Button>
          </div>
        </div>
        <Table
          rowKey="id"
          dataSource={data.qualifications}
          size="small"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          expandable={{
            expandedRowRender: (row) => (
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/90 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Qualified Techniques & Validity Status</p>
                <Table
                  size="small"
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                  dataSource={row.techniqueEntries}
                  rowKey="techniqueId"
                  columns={[
                    {
                      title: 'Technique',
                      render: (_, e) => {
                        const tech = data.techniques.find((t) => t.id === e.techniqueId)
                        return tech ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-indigo-600">{tech.code}</span>
                            <span className="text-xs text-slate-600">— {tech.name}</span>
                          </div>
                        ) : e.techniqueId
                      },
                    },
                    { title: 'Valid From', dataIndex: 'startDate', render: (v) => v ?? '—' },
                    {
                      title: 'Valid Until', dataIndex: 'endDate',
                      render: (v) => {
                        if (!v) return '—'
                        const isExpired = dayjs(v).isBefore(dayjs())
                        return (
                          <div className="flex items-center gap-1">
                            <span className={isExpired ? 'text-red-600 font-semibold text-xs' : 'text-slate-700 text-xs'}>{v}</span>
                            {isExpired && <Tag color="error" className="text-[10px] px-1 py-0">Expired</Tag>}
                          </div>
                        )
                      },
                    },
                    {
                      title: 'Certificate',
                      render: (_, e) => {
                        const tech = data.techniques.find((t) => t.id === e.techniqueId)
                        return (
                          <Button
                            type="link"
                            size="small"
                            icon={<FileText size={13} />}
                            onClick={() => {
                              setCertModal({
                                qualificationId: row.id,
                                analystName: row.analystName,
                                techniqueId: e.techniqueId,
                                techCode: tech?.code || e.techniqueId,
                                techName: tech?.name || e.techniqueId,
                                startDate: e.startDate,
                                endDate: e.endDate,
                                certificationPath: e.certificationPath,
                              })
                            }}
                          >
                            View Certificate PDF
                          </Button>
                        )
                      },
                    },
                  ]}
                />
              </div>
            ),
          }}
          columns={[
            { title: 'Analyst Name', dataIndex: 'analystName', render: (v) => <span className="font-semibold text-slate-800">{v}</span> },
            {
              title: 'Techniques Qualified',
              render: (_, row) => {
                const count = (row.techniqueEntries ?? []).length
                const total = data.techniques.length
                return <Tag color="blue" className="font-medium">{count} of {total} qualified</Tag>
              },
            },
            { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
            { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
            {
              title: 'Approval',
              dataIndex: 'approvalStatus',
              width: 130,
              render: (v: string) => {
                if (v === 'PENDING_APPROVAL') return <Tag color="orange" className="text-xs">Pending Approval</Tag>
                if (v === 'APPROVED') return <Tag color="green" className="text-xs">Approved</Tag>
                return <Tag color="default" className="text-xs">{v ?? 'Approved'}</Tag>
              },
            },
            {
              title: 'Actions', width: 160,
              render: (_, row) => (
                <Space size={6} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="View Details">
                    <Button type="text" size="small" icon={<Eye size={15} className="text-slate-600" />} onClick={() => setViewingQual(row)} />
                  </Tooltip>
                  <Tooltip title="Edit Qualification">
                    <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                  </Tooltip>
                  {isHodOrAdmin && (row as any).approvalStatus === 'PENDING_APPROVAL' && (
                    <Button
                      size="small"
                      type="primary"
                      className="bg-emerald-600 hover:bg-emerald-700 border-none"
                      loading={approveQualMut.isPending && approvingId === row.id}
                      onClick={() => { setApprovingId(row.id); approveQualMut.mutate(row.id) }}
                    >
                      Approve
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Qualification Expiry Alerts</h3>
            <p className="text-xs text-slate-400">Automated notification triggers before analyst qualification expiry</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={() => { setEditingAlert(null); alertForm.resetFields(); setAlertOpen(true) }}>Add Alert Trigger</Button>
        </div>
        <Table
          rowKey="id"
          dataSource={data.alerts}
          size="small"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          columns={[
            { title: 'Alert Name', dataIndex: 'name', render: (v) => <span className="font-medium text-slate-800">{v}</span> },
            { title: 'Days Before Expiry', dataIndex: 'daysBeforeExpiry', render: (v) => <Tag color="orange">{v} Days</Tag> },
              { title: 'Created By / On', key: 'created', render: renderCreatedByOn },
            { title: 'Updated By / On', key: 'updated', render: renderUpdatedByOn },
            {
              title: 'Actions', width: 120,
              render: (_, row) => (
                <Space size={8} onClick={(e) => e.stopPropagation()}>
                  <Switch
                    size="small"
                    checked={row.active}
                    onChange={(checked) => saveAlert.mutate({ ...row, active: checked })}
                  />
                  <Tooltip title="Edit">
                    <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => { setEditingAlert(row); alertForm.setFieldsValue(row); setAlertOpen(true) }} />
                  </Tooltip>
                </Space>
              ),
            },
          ]}
        />
      </div>

      {/* Read-only View Modal */}
      <Modal
        {...glassModalProps}
        title={`Analyst Qualification Record — ${viewingQual?.analystName ?? ''}`}
        open={!!viewingQual}
        onCancel={() => setViewingQual(null)}
        footer={[<Button key="close" onClick={() => setViewingQual(null)}>Close</Button>]}
        width={680}
      >
        {viewingQual && (
          <div className="space-y-4 my-2">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs text-slate-400 block">Analyst User</span>
                <span className="text-sm font-semibold text-slate-800">{viewingQual.analystName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Qualified Techniques</span>
                <span className="text-sm font-semibold text-indigo-600">
                  {viewingQual.techniqueEntries.length} of {data.techniques.length} Techniques
                </span>
              </div>
            </div>
            <Table
              size="small"
              pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
              dataSource={viewingQual.techniqueEntries}
              rowKey="techniqueId"
              columns={[
                {
                  title: 'Technique',
                  render: (_, e) => {
                    const tech = data.techniques.find((t) => t.id === e.techniqueId)
                    return tech ? `${tech.code} — ${tech.name}` : e.techniqueId
                  },
                },
                { title: 'Valid From', dataIndex: 'startDate', render: (v) => v || '—' },
                {
                  title: 'Valid Until', dataIndex: 'endDate',
                  render: (v) => v ? <span className={dayjs(v).isBefore(dayjs()) ? 'text-red-500 font-semibold' : ''}>{v}</span> : '—',
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Edit Qualification Modal */}
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Analyst Qualification' : 'Add Analyst Qualification'} width={680} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => saveQualification.mutate({ ...v, id: editing?.id, userId: editing ? editing.userId : v.userId }))} confirmLoading={saveQualification.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="Analyst" rules={[{ required: true, message: 'Analyst is required' }]}>
            {editing ? (
              <Input readOnly value={editing.analystName} className="font-semibold text-slate-800 bg-slate-50" />
            ) : (
              <Select showSearch optionFilterProp="label" options={analystOptions} placeholder="Select analyst user" />
            )}
          </Form.Item>
          <Form.Item name="techniqueIds" label="Qualified Techniques" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one technique' }]}>
            <Select mode="multiple" optionFilterProp="label" placeholder="Select techniques"
              options={data.techniques.map((t) => ({ value: t.id, label: t.code }))} />
          </Form.Item>
          {techniqueIds.map((tid) => {
            const t = data.techniques.find((x) => x.id === tid)
            const existingEntry = editing?.techniqueEntries?.find((e) => e.techniqueId === tid)
            const selectedFile = pendingCertFiles[tid]
            return (
              <div key={tid} className="grid grid-cols-12 gap-2 items-center bg-slate-50/70 p-2.5 rounded-lg border border-slate-200 mb-2">
                <div className="col-span-3">
                  <span className="font-mono text-xs font-semibold text-indigo-600 block">{t?.code}</span>
                  <span className="text-[11px] text-slate-500 truncate block">{t?.name}</span>
                </div>
                <Form.Item name={`start_${tid}`} label="Valid From" className="col-span-3 mb-0"><DatePicker className="w-full" format="YYYY-MM-DD" /></Form.Item>
                <Form.Item name={`end_${tid}`} label="Valid Until" className="col-span-3 mb-0"><DatePicker className="w-full" format="YYYY-MM-DD" /></Form.Item>
                <div className="col-span-3 flex flex-col justify-end pt-5">
                  <Upload
                    showUploadList={false}
                    accept=".pdf"
                    beforeUpload={(file) => {
                      setPendingCertFiles((prev) => ({ ...prev, [tid]: file }))
                      return false
                    }}
                  >
                    <Button
                      size="small"
                      icon={<UploadIcon size={12} />}
                      className={selectedFile || existingEntry?.certificationPath ? 'border-violet-500 text-violet-600 bg-violet-50/50 w-full text-[11px]' : 'w-full text-[11px]'}
                    >
                      {selectedFile ? 'File Selected' : (existingEntry?.certificationPath ? 'Replace PDF' : 'Upload PDF')}
                    </Button>
                  </Upload>
                  {selectedFile && <span className="text-[10px] text-violet-600 font-medium truncate block mt-0.5">{selectedFile.name}</span>}
                </div>
              </div>
            )
          })}
          <Form.Item name="validTill" label="Valid Till (Overall Qualification Expiry)">
            <DatePicker className="w-full" format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} placeholder="Optional remarks about this qualification..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Alert Modal */}
      <Modal {...glassModalProps} destroyOnClose title={editingAlert ? 'Edit Expiry Alert' : 'Add Expiry Alert'} open={alertOpen} onCancel={() => setAlertOpen(false)}
        onOk={() => alertForm.validateFields().then((v) => saveAlert.mutate({ ...v, id: editingAlert?.id, active: editingAlert ? editingAlert.active : true }))} confirmLoading={saveAlert.isPending}>
        <Form form={alertForm} layout="vertical">
          <Form.Item name="name" label="Alert Name" rules={[{ required: true }]}><Input placeholder="e.g. 30-Day Expiry Notification" /></Form.Item>
          <Form.Item name="daysBeforeExpiry" label="Days Before Expiry" rules={[{ required: true, message: 'Please enter days before expiry' }, { type: 'number', min: 1, message: 'Must be at least 1 day' }]}><InputNumber min={1} max={365} placeholder="e.g. 30" className="w-full" /></Form.Item>
        </Form>
      </Modal>

      {/* Certificate Preview Modal */}
      <Modal
        {...glassModalProps}
        title={
          <div className="flex items-center gap-2 text-indigo-900">
            <Award className="text-amber-500" size={20} />
            <span>Analyst Qualification Certificate</span>
          </div>
        }
        open={!!certModal}
        onCancel={() => setCertModal(null)}
        footer={[
          <Upload
            key="upload"
            showUploadList={false}
            accept=".pdf"
            beforeUpload={(file) => {
              if (certModal) {
                uploadCert.mutate({
                  qualificationId: certModal.qualificationId,
                  techniqueId: certModal.techniqueId,
                  file,
                })
              }
              return false
            }}
          >
            <Button icon={<UploadIcon size={14} />} loading={uploadCert.isPending}>
              Upload PDF File
            </Button>
          </Upload>,
          <Button
            key="download"
            type="primary"
            icon={<Download size={14} />}
            onClick={() => {
              if (certModal) {
                downloadCertificate(
                  certModal.qualificationId,
                  certModal.techniqueId,
                  `Cert-${certModal.analystName}-${certModal.techCode}`
                )
              }
            }}
          >
            Download Certificate PDF
          </Button>,
          <Button key="close" onClick={() => setCertModal(null)}>Close</Button>,
        ]}
        width={580}
      >
        {certModal && (
          <div className="space-y-4 my-2">
            <div className="p-5 glass-card rounded-lg relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-10">
                <Award size={120} />
              </div>
              <div className="relative z-10 space-y-3">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">Analytical Testing Department</span>
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">Technique Qualification Certificate</h2>
                  </div>
                  <Tag color={certModal.endDate && dayjs(certModal.endDate).isBefore(dayjs()) ? 'error' : 'success'}>
                    {certModal.endDate && dayjs(certModal.endDate).isBefore(dayjs()) ? 'EXPIRED' : 'ACTIVE / CERTIFIED'}
                  </Tag>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Analyst Name:</span>
                    <span className="font-semibold text-slate-800 text-sm">{certModal.analystName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Technique Code & Name:</span>
                    <span className="font-semibold text-amber-600">{certModal.techCode} — {certModal.techName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Valid From:</span>
                    <span className="font-mono text-slate-700">{certModal.startDate || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Valid Until:</span>
                    <span className="font-mono text-slate-700">{certModal.endDate || '—'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Ref: CERT-{certModal.qualificationId.slice(0, 8).toUpperCase()}-{certModal.techCode}</span>
                  <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-violet-600" /> Verified by ARD Quality Governance</span>
                </div>
              </div>
            </div>

            {certModal.certificationPath ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50/70 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Uploaded Certificate Document</span>
                  {certPreviewUrl && (
                    <Button size="small" type="link" onClick={() => window.open(certPreviewUrl, '_blank', 'noopener')}>
                      Open in new tab
                    </Button>
                  )}
                </div>
                {certPreviewUrl ? (
                  <iframe title="Uploaded certificate PDF" className="w-full" style={{ height: 360, border: 'none' }} src={certPreviewUrl} />
                ) : (
                  <div className="h-24 flex items-center justify-center text-xs text-slate-400">Loading document…</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-2">No uploaded certificate document yet — use "Upload PDF File" below.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Settings ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ['Workflow', 'Test Workflow', 'Authentication', 'Experiments', 'STP', 'SLA', 'Notifications', 'Storage', 'Reporting', 'Users']

function SettingsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const grouped = useMemo(() => {
    const map = new Map<string, ArdSetting[]>()
    for (const s of data.settings) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return map
  }, [data.settings])

  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => grouped.has(c))
    const rest = [...grouped.keys()].filter((c) => !CATEGORY_ORDER.includes(c))
    return [...known, ...rest]
  }, [grouped])

  const [active, setActive] = useState(categories[0])

  const update = useMutation({
    mutationFn: ({ id, value }: { id: string; value: unknown }) => ardApi.updateSetting(id, value),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Setting saved.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save setting.'),
  })

  const currentCategory = active ?? categories[0]
  const settings = grouped.get(currentCategory) ?? []

  return (
    <div>
      {ctx}
      <div className="flex gap-2 flex-wrap mb-4">
        {categories.map((c) => (
          <Button key={c} size="small" type={c === currentCategory ? 'primary' : 'default'} onClick={() => setActive(c)}>
            {c} <Tag className="ml-1">{grouped.get(c)?.length}</Tag>
          </Button>
        ))}
      </div>
      <Card size="small" title={`${currentCategory} Configuration`}>
        <div className="space-y-3">
          {settings.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <div className="text-sm text-slate-700">{s.label}</div>
                <div className="text-[10px] font-mono text-slate-400">{s.key}</div>
                {s.description && <div className="text-xs text-slate-400">{s.description}</div>}
              </div>
              {s.valueType === 'boolean' && (
                <Switch checked={!!s.value} onChange={(v) => update.mutate({ id: s.id, value: v })} />
              )}
              {s.valueType === 'number' && (
                <InputNumber min={0} value={Number(s.value)} onPressEnter={(e) => update.mutate({ id: s.id, value: (e.target as HTMLInputElement).value })}
                  onBlur={(e) => update.mutate({ id: s.id, value: e.target.value })} />
              )}
              {s.valueType === 'text' && (
                <Input style={{ width: 220 }} defaultValue={String(s.value)} onBlur={(e) => update.mutate({ id: s.id, value: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Hub ──────────────────────────────────────────────────────────────────

export default function ArdConfigurationPage() {
  const { data, isLoading } = useMasterData()
  const user = useAppSelector(selectUser)
  const [viewMode, setViewMode] = useState<'tabbed' | 'single'>('tabbed')
  const location = useLocation()
  const initialTab = (location.state as { tab?: string } | null)?.tab
  const [activeKey, setActiveKey] = useState(initialTab ?? 'techniques')

  const isAllowed = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'TL', 'TEAM_LEAD', 'QA', 'QC_MANAGER'].includes(user?.role_code ?? '')

  if (!isAllowed) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Alert
          type="error"
          showIcon
          message="Access Restricted"
          description="System configuration, master data, and GxP settings are restricted to Department Heads, Quality Assurance, and System Administrators."
        />
      </div>
    )
  }

  if (isLoading || !data) return <div className="p-4 md:p-6"><Empty description="Loading configuration…" /></div>

  const items = [
    { key: 'techniques', label: `Techniques (${data.techniques.length})`, children: <TechniquesTab data={data} /> },
    { key: 'configs', label: `Test Configurations (${data.testConfigs.length})`, children: <TestConfigsTab data={data} /> },
    { key: 'groups', label: `Test Groups (${data.testGroups.length})`, children: <TestGroupsTab data={data} /> },
    { key: 'attributes', label: `Attributes (${data.attributes.length})`, children: <AttributesTab data={data} /> },
    { key: 'form-types', label: `Form Types (${data.formTypes.length})`, children: <FormTypesTab data={data} /> },
    { key: 'lookups', label: `Lookups (${data.lookups.length})`, children: <LookupsTab data={data} /> },
    { key: 'data-items', label: `Data Items (${data.dataItems.length})`, children: <DataItemsTab data={data} /> },
    { key: 'sections', label: 'Sections', children: <SectionsTab /> },
    { key: 'content-library', label: `Template Section (${(data.contentBlocks ?? []).length})`, children: <ContentLibraryTab data={data} /> },
    { key: 'qualification', label: `Analyst Qualification (${data.qualifications.length})`, children: <QualificationsTab data={data} /> },
    { key: 'settings', label: 'Settings', children: <SettingsTab data={data} /> },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + View Mode Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center glass-card rounded-lg p-4 gap-3">
        <div className="flex items-center gap-2">
          <Settings size={20} className="text-indigo-600" />
          <h1 className="text-lg font-bold text-slate-800">Configuration</h1>
        </div>
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as 'tabbed' | 'single')}
          options={[
            { label: 'Tabbed View', value: 'tabbed', icon: <LayoutList size={14} className="inline mr-1" /> },
            { label: 'Single Page View', value: 'single', icon: <FileText size={14} className="inline mr-1" /> },
          ]}
        />
      </div>

      {viewMode === 'tabbed' ? (
        <div className="glass-card rounded-lg p-4">
          <Tabs type="card" items={items} activeKey={activeKey} onChange={setActiveKey} />
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((tab) => (
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
    </div>
  )
}
