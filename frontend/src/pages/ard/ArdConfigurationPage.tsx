import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Switch,
  Tag, message, Card, Empty, DatePicker, Tooltip, Space, Alert, Segmented, Upload,
} from 'antd'
import { Plus, Edit3, Trash2, Search, Users as UsersIcon, Eye, FileText, AlertTriangle, LayoutList, Award, ShieldCheck, Download, Upload as UploadIcon, Settings } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardApi, type ArdAttribute, type ArdFormType, type ArdLookup, type ArdMasterDataState,
  type ArdQualificationAlert, type ArdSetting, type ArdTechnique, type ArdTestConfiguration,
  type ArdTestGroup, type ArdDataItem, type ArdAnalystQualification, type ResultParam,
  type ArdContentBlock,
} from '../../api/ard'
import { adminApi, type UserOut } from '../../api/admin'
import { ApiError, apiDownloadBlob, apiPost } from '../../api/client'
import RichEditor from '../../components/RichEditor'
import { glassModalProps } from '../../utils/modalStyles'
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Technique saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save technique.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.techniques
    return data.techniques.filter((t) => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  }, [data.techniques, search])

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
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Technique Name', dataIndex: 'code', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-600">{v}</span> },
          { title: 'Description', dataIndex: 'name' },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Technique' : 'Add Technique'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
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
      {params.map((p, i) => (
        <div key={p.id} className="border border-slate-200/90 rounded-lg p-3 bg-slate-50/60 space-y-2.5">
          {/* Row 1: Parameter Name + Data Type + Delete Button */}
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              placeholder="Parameter name (e.g. Assay % or Description)"
              value={p.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
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

          {/* Row 2: Text Placeholder + Specification OR Number Validation Controls */}
          {p.dataType === 'text' ? (
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="Placeholder text (e.g. Off-white to pale yellow powder)"
                value={p.placeholder ?? ''}
                onChange={(e) => update(i, { placeholder: e.target.value })}
              />
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Test configuration saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save test configuration.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.testConfigs
    return data.testConfigs.filter((c) =>
      (c.code ?? '').toLowerCase().includes(q) ||
      c.testType.toLowerCase().includes(q) ||
      (c.techniqueName ?? '').toLowerCase().includes(q)
    )
  }, [data.testConfigs, search])

  const openModal = (row?: ArdTestConfiguration) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? {
      ...row,
      techniqueId: data.techniques.find((t) => t.code === row.techniqueCode)?.id,
      analysisCode: (row as any).analysisCode ?? '',
    } : { testType: '', testSubtype: '', resultParams: [], analysisCode: '', methodReference: '' })
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
                .catch(() => msg.error('CSV import failed.'))
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
          { title: 'Code', dataIndex: 'code', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-600">{v ?? '—'}</span> },
          { title: 'Technique', dataIndex: 'techniqueName' },
          { title: 'Test Type', dataIndex: 'testType' },
          { title: 'Sub Type', dataIndex: 'testSubtype' },
          { title: 'Params', dataIndex: 'resultParams', render: (v: ResultParam[]) => <Tag color="blue">{v.length}</Tag> },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose width={720} title={editing ? 'Edit Test Configuration' : 'Add Test Configuration'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="techniqueId" label="Test Technique" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={data.techniques.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="analysisCode" label="Analysis Technical Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="testType" label="ATR Test Type" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="testSubtype" label="ATR Test Sub Type"><Input /></Form.Item>
          <Form.Item name="methodReference" label="Method Reference / SOP No."><Input placeholder="e.g. SOP-HPLC-001, ICH Q1A" /></Form.Item>
          <Form.Item name="resultParams" label="Result Parameters"><ResultParamsEditor uomOptions={uomOptions} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Test Groups ─────────────────────────────────────────────────────────

function TestGroupsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdTestGroup | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()

  const save = useMutation({
    mutationFn: ardApi.saveTestGroup,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Test group saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save test group.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.testGroups
    return data.testGroups.filter((g) => g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q))
  }, [data.testGroups, search])

  const openModal = (row?: ArdTestGroup) => {
    setEditing(row ?? null)
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
                <p className="text-xs font-semibold text-slate-700 mb-2">Linked Test Configurations ({configs.length})</p>
                <Table
                  size="small"
                  pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                  rowKey="id"
                  dataSource={configs}
                  columns={[
                    { title: 'Code', dataIndex: 'code', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-600">{v ?? '—'}</span> },
                    { title: 'Technique', dataIndex: 'techniqueName' },
                    { title: 'Test Type', dataIndex: 'testType' },
                    { title: 'Sub Type', dataIndex: 'testSubtype', render: (v) => v || '—' },
                    { title: 'Params', dataIndex: 'resultParams', render: (v: ResultParam[]) => <Tag>{v?.length ?? 0}</Tag> },
                    { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
                  ]}
                />
              </div>
            )
          },
        }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Test Configs', dataIndex: 'testConfigIds', render: (v: string[]) => <Tag color="blue">{v?.length ?? 0}</Tag> },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Test Group' : 'Add Test Group'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
          <Form.Item name="testConfigIds" label="Test Configurations" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one test' }]}>
            <Select mode="multiple" optionFilterProp="label"
              options={data.testConfigs.map((c) => ({ value: c.id, label: `${c.code ?? c.id} — ${c.testType}` }))} />
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Attribute saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save attribute.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.attributes
    return data.attributes.filter((a) => a.label.toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
  }, [data.attributes, search])

  const openModal = (row?: ArdAttribute) => {
    setEditing(row ?? null)
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
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Attribute' : 'Add Attribute'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
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

function FormTypesTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdFormType | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const attributeIds: string[] = Form.useWatch('attributeIds', form) ?? []

  const save = useMutation({
    mutationFn: (v: any) => ardApi.saveFormType({
      ...v,
      attributeLinks: (v.attributeIds ?? []).map((aid: string, i: number) => ({
        attributeId: aid, sequence: i, requiredOverride: null, displayInReport: true,
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Form type saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save form type.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.formTypes
    return data.formTypes.filter((f) => f.name.toLowerCase().includes(q) || (f.code ?? '').toLowerCase().includes(q))
  }, [data.formTypes, search])

  const openModal = (row?: ArdFormType) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? {
      ...row,
      attributeIds: (row.attributeLinks ?? []).sort((a, b) => a.sequence - b.sequence).map((l) => l.attributeId),
    } : {
      name: '', description: '', category: undefined, attributeIds: [], testGroupIds: [],
      mandateCertification: false, mandateBatchNo: false, mandateSampleQty: false, mandateQaSubmission: false, allowPostApprovalChanges: false,
    })
    setOpen(true)
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
          { title: 'Name', dataIndex: 'name' },
          { title: 'Code', dataIndex: 'code', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-600">{v}</span> },
          { title: 'Attributes', dataIndex: 'attributeLinks', render: (v: any[]) => <Tag color="blue">{v.length}</Tag> },
          {
            title: 'Flags', render: (_, row) => (
              <div className="flex gap-1 flex-wrap">
                {row.mandateQaSubmission && <Tag color="purple">QA pre-approval</Tag>}
                {row.mandateBatchNo && <Tag color="blue">Batch required</Tag>}
                {row.mandateSampleQty && <Tag color="cyan">Sample Qty</Tag>}
                {row.mandateCertification && <Tag color="gold">Cert</Tag>}
              </div>
            )
          },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose width={640} title={editing ? 'Edit Form Type' : 'Add Form Type'} open={open} onCancel={() => setOpen(false)}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
          <Form.Item name="category" label="Category (ATR Type)">
            <Select allowClear placeholder="e.g. Method Development, Routine, Stability..."
              options={['Method Development', 'Routine Analysis', 'Stability', 'Validation', 'Transfer', 'Other'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="mandateQaSubmission" label="Mandate QA pre-approval submission" valuePropName="checked"
            extra="Routes new ATRs through QA before team lead assignment"><Switch /></Form.Item>
          <Form.Item name="mandateBatchNo" label="Mandate batch number on samples" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="mandateCertification" label="Mandate certification" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="mandateSampleQty" label="Mandate sample quantity" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="allowPostApprovalChanges" label="Allow adding samples/tests after approval" valuePropName="checked"
            extra="When enabled, new test requests can be added to an APPROVED ATR"><Switch /></Form.Item>
          <Form.Item name="attributeIds" label="Attributes" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one attribute' }]}>
            <Select mode="multiple" optionFilterProp="label"
              options={data.attributes.filter((a) => a.active).map((a) => ({ value: a.id, label: a.label }))} />
          </Form.Item>
          {attributeIds.length > 0 && (
            <div className="mb-4 text-xs text-slate-500">
              Sequence follows selection order — {attributeIds.length} attribute(s) linked.
            </div>
          )}
          <Form.Item name="testGroupIds" label="Test Groups">
            <Select mode="multiple" optionFilterProp="label"
              options={data.testGroups.filter((g) => g.active).map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <p className="text-xs text-slate-400">Changes are versioned in the audit trail when saved.</p>
        </Form>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Lookup saved.'); setOpen(false) },
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
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search lookups by category, code or label..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Lookup</Button>
      </div>
      <Table
        rowKey="id"
        dataSource={filtered}
        size="small"
        pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        columns={[
          { title: 'Category', dataIndex: 'category' },
          { title: 'Code', dataIndex: 'code', render: (v) => <span className="font-mono text-xs font-semibold text-indigo-600">{v}</span> },
          { title: 'Label', dataIndex: 'label' },
          { title: 'Description', dataIndex: 'description', render: (v) => v ?? '—' },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Lookup' : 'Add Lookup'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="Category" rules={[{ required: true }]} extra="Categories are defined by the admin module">
            <Select showSearch options={(categories ?? []).map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="code" label="Lookup Code" rules={[{ required: true }]}><Input className="font-mono" /></Form.Item>
          <Form.Item name="label" label="Lookup Value" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Lookup Desc" rules={[{ required: true, message: 'Lookup description is required' }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Data Items ──────────────────────────────────────────────────────────

const DATA_ITEM_TYPES = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' }, { value: 'radio', label: 'Radio group' }, { value: 'checkbox', label: 'Checkbox' },
]

function DataItemsTab({ data }: { data: ArdMasterDataState }) {
  const qc = useQueryClient()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArdDataItem | null>(null)
  const [search, setSearch] = useState('')
  const [form] = Form.useForm()
  const dataType = Form.useWatch('dataType', form)

  const save = useMutation({
    mutationFn: (v: any) => ardApi.saveDataItem({
      ...v,
      options: v.optionsText
        ? v.optionsText.split(',').map((tok: string) => {
            const [label, value] = tok.includes(':') ? tok.split(':') : [tok, tok]
            return { label: label.trim(), value: (value ?? label).trim() }
          })
        : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Data item saved.'); setOpen(false) },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save data item.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.dataItems
    return data.dataItems.filter((d) => d.name.toLowerCase().includes(q) || d.dataType.toLowerCase().includes(q))
  }, [data.dataItems, search])

  const openModal = (row?: ArdDataItem) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? {
      ...row,
      optionsText: (row.options ?? []).map((o) => `${o.label}:${o.value}`).join(', '),
    } : { name: '', dataType: 'text' })
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
          { title: 'Name', dataIndex: 'name' },
          { title: 'Data Type', dataIndex: 'dataType', render: (v) => DATA_ITEM_TYPES.find((t) => t.value === v)?.label ?? v },
          { title: 'UOM', dataIndex: 'uom', render: (v) => v ?? '—' },
          { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal {...glassModalProps} destroyOnClose title={editing ? 'Edit Data Item' : 'Add Data Item'} open={open} onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))} confirmLoading={save.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="dataType" label="Data Type" rules={[{ required: true }]}><Select options={DATA_ITEM_TYPES} /></Form.Item>
          <Form.Item name="uom" label="UOM"><Input /></Form.Item>
          {(dataType === 'select' || dataType === 'radio') && (
            <Form.Item name="optionsText" label="Options" rules={[{ required: true, message: 'Provide at least one option' }]}
              extra="Comma-separated. Use Label:value to set a distinct value.">
              <Input placeholder="Pass, Fail  or  Pass:P, Fail:F" />
            </Form.Item>
          )}
          <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ard-master-data'] }); msg.success('Content block saved.'); setOpen(false) },
    onError: (e: unknown) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save content block.'),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.contentBlocks ?? []
    return (data.contentBlocks ?? []).filter((b) => b.name.toLowerCase().includes(q))
  }, [data.contentBlocks, search])

  const openModal = (row?: ArdContentBlock) => {
    setEditing(row ?? null)
    setBodyHtml(row?.body ?? '')
    form.setFieldsValue(row ? { name: row.name, contentType: row.contentType, displayHeight: row.displayHeight } : { name: '', contentType: 'richtext', displayHeight: 250 })
    setOpen(true)
  }

  return (
    <div>
      {ctx}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
        <Input prefix={<Search size={16} className="text-slate-400" />} allowClear placeholder="Search content blocks..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 300 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Content Block</Button>
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
                <Switch size="small" checked={row.active} onChange={(checked) => save.mutate({ ...row, id: row.id, active: checked })} />
                <Tooltip title="Edit">
                  <Button type="text" size="small" icon={<Edit3 size={15} className="text-indigo-600" />} onClick={() => openModal(row)} />
                </Tooltip>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        {...glassModalProps}
        destroyOnClose
        title={editing ? 'Edit Content Block' : 'Add Content Block'}
        open={open}
        width={780}
        onCancel={() => setOpen(false)}
        onOk={() => form.validateFields().then((v: Record<string, unknown>) => save.mutate({ ...v, id: editing?.id, active: editing ? editing.active : true }))}
        confirmLoading={save.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Block Name" rules={[{ required: true, message: 'Name is required' }]}>
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
  const [alertOpen, setAlertOpen] = useState(false)
  const [editing, setEditing] = useState<ArdAnalystQualification | null>(null)
  const [editingAlert, setEditingAlert] = useState<ArdQualificationAlert | null>(null)
  const [form] = Form.useForm()
  const [alertForm] = Form.useForm()

  const currentUser = useAppSelector(selectUser)
  const isHodOrAdmin = ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(currentUser?.role_code ?? '')

  const [approvingId, setApprovingId] = useState<string | null>(null)

  const approveQualMut = useMutation({
    mutationFn: (id: string) => apiPost(`/api/ard/qualifications/${id}/approve`, {}),
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
    .map((u) => ({ value: u.id, label: `${u.username} — ${u.full_name || u.email}` }))

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
          <Button type="primary" icon={<Plus size={14} />} onClick={() => openModal()}>Add Analyst</Button>
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
            { title: 'Status', dataIndex: 'active', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
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
              options={data.techniques.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` }))} />
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

  const isAllowed = ['ADMIN', 'SUPER_ADMIN', 'HOD', 'QA', 'QC_MANAGER'].includes(user?.role_code ?? '')

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
    { key: 'content-library', label: `Content Library (${(data.contentBlocks ?? []).length})`, children: <ContentLibraryTab data={data} /> },
    { key: 'qualification', label: `Qualifications (${data.qualifications.length})`, children: <QualificationsTab data={data} /> },
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
          <Tabs type="card" items={items} />
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
