import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Table, Tag, Modal, Form, Input, Select, Space, Popconfirm, message, Typography, Tooltip
} from 'antd'
import { Plus, Trash2, Edit3, Send, CheckCircle2, ShieldCheck, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardApi, ardProjectSpecsApi, type ArdProjectSpecification, type ArdSpecTestParam
} from '../../api/ard'
import { ESignatureModal } from '../common/ESignatureModal'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const { Text } = Typography

export interface ProjectSpecificationsPanelProps {
  projectId: string
  readOnly?: boolean
}

export default function ProjectSpecificationsPanel({
  projectId,
  readOnly = false,
}: ProjectSpecificationsPanelProps) {
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msgApi, ctx] = message.useMessage()

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSpec, setEditingSpec] = useState<ArdProjectSpecification | null>(null)
  const [testParams, setTestParams] = useState<ArdSpecTestParam[]>([])
  const [form] = Form.useForm()

  // Master data for Test Type and Test Subtype dropdowns
  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).map(tc => tc.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const getSubtypeOptions = (selectedType?: string | null) => {
    const filtered = selectedType
      ? (masterData?.testConfigs ?? []).filter(tc => tc.testType === selectedType)
      : (masterData?.testConfigs ?? [])
    const subtypes = Array.from(new Set(filtered.map(tc => tc.testSubtype).filter(Boolean)))
    return (subtypes as string[]).map(st => ({ value: st, label: st }))
  }

  // E-Signature modal state
  const [esignModalOpen, setEsignModalOpen] = useState(false)
  const [approvingSpecId, setApprovingSpecId] = useState<string | null>(null)

  // Query specifications
  const { data: specs = [], isLoading } = useQuery({
    queryKey: ['ard-project-specs', projectId],
    queryFn: () => ardProjectSpecsApi.list(projectId),
    enabled: !!projectId,
  })

  // Mutations
  const createMut = useMutation({
    mutationFn: (body: { specCode?: string; version?: string; title?: string; testParameters?: ArdSpecTestParam[] }) =>
      ardProjectSpecsApi.create(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-project-specs', projectId] })
      msgApi.success('Project Specification created successfully.')
      setModalOpen(false)
      form.resetFields()
    },
    onError: () => msgApi.error('Failed to create specification.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ specId, body }: { specId: string; body: Partial<ArdProjectSpecification> }) =>
      ardProjectSpecsApi.update(projectId, specId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-project-specs', projectId] })
      msgApi.success('Specification updated.')
      setModalOpen(false)
      form.resetFields()
    },
    onError: () => msgApi.error('Failed to update specification.'),
  })

  const submitMut = useMutation({
    mutationFn: (specId: string) => ardProjectSpecsApi.submit(projectId, specId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-project-specs', projectId] })
      msgApi.success('Specification submitted for review.')
    },
    onError: () => msgApi.error('Failed to submit specification.'),
  })

  const approveMut = useMutation({
    mutationFn: ({ specId, password }: { specId: string; password?: string }) =>
      ardProjectSpecsApi.approve(projectId, specId, { password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-project-specs', projectId] })
      msgApi.success('Specification approved with electronic signature!')
      setEsignModalOpen(false)
      setApprovingSpecId(null)
    },
    onError: () => msgApi.error('Failed to approve specification.'),
  })

  const deleteMut = useMutation({
    mutationFn: (specId: string) => ardProjectSpecsApi.remove(projectId, specId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-project-specs', projectId] })
      msgApi.success('Specification deleted.')
    },
    onError: () => msgApi.error('Failed to delete specification.'),
  })

  const handleOpenAdd = () => {
    setEditingSpec(null)
    setTestParams([])
    form.setFieldsValue({
      specCode: '',
      version: '1.0',
      title: '',
      shortName: '',
      specType: '',
      description: '',
    })
    setModalOpen(true)
  }

  const uomOptions = [
    { value: '%', label: '%' },
    { value: '% w/w', label: '% w/w' },
    { value: 'ppm', label: 'ppm' },
    { value: 'mg/g', label: 'mg/g' },
    { value: 'mL', label: 'mL' },
    { value: 'pH', label: 'pH' },
    { value: 'min', label: 'min' },
    { value: '°C', label: '°C' },
    { value: 'Abs', label: 'Abs' },
  ]

  const loadPresetTemplate = () => {
    const configs = masterData?.testConfigs ?? []
    if (configs.length > 0) {
      const loadedParams: ArdSpecTestParam[] = []
      for (const tc of configs) {
        if (Array.isArray(tc.resultParams) && tc.resultParams.length > 0) {
          for (const rp of tc.resultParams) {
            loadedParams.push({
              id: String(Date.now() + Math.random()),
              testType: tc.testType,
              testSubtype: tc.testSubtype,
              parameter: rp.name || tc.testType,
              dataType: rp.dataType || 'text',
              unit: rp.uom || '%',
              testMethod: tc.techniqueName || 'HPLC',
              specLimit: rp.lowerLimit != null && rp.upperLimit != null
                ? `${rp.lowerLimit}% – ${rp.upperLimit}%`
                : rp.placeholder || 'Conforms to Specification',
            })
          }
        } else {
          loadedParams.push({
            id: String(Date.now() + Math.random()),
            testType: tc.testType,
            testSubtype: tc.testSubtype,
            parameter: tc.techniqueName || tc.testType,
            dataType: 'text',
            unit: '%',
            testMethod: tc.techniqueName || 'HPLC',
            specLimit: 'Conforms to Specification',
          })
        }
      }
      if (loadedParams.length > 0) {
        setTestParams(loadedParams)
        msgApi.success(`Loaded ${loadedParams.length} parameter(s) from Master Data test configurations.`)
        return
      }
    }

    setTestParams([
      { id: '1', testType: 'Assay', testSubtype: 'HPLC', parameter: 'Assay (% w/w)', dataType: 'range', specLimit: '98.0% – 102.0%', unit: '%', testMethod: 'HPLC' },
      { id: '2', testType: 'Related Substances', testSubtype: 'HPLC', parameter: 'Individual Impurity', dataType: 'number', specLimit: 'NMT 0.2%', unit: '%', testMethod: 'HPLC' },
      { id: '3', testType: 'Related Substances', testSubtype: 'HPLC', parameter: 'Total Impurities', dataType: 'number', specLimit: 'NMT 1.0%', unit: '%', testMethod: 'HPLC' },
      { id: '4', testType: 'Water Content', testSubtype: 'Karl Fischer', parameter: 'Water Content (% w/w)', dataType: 'number', specLimit: 'NMT 0.5%', unit: '%', testMethod: 'KF Titrator' },
    ])
    msgApi.success('Loaded standard preset specification template.')
  }

  const handleOpenEdit = (spec: ArdProjectSpecification) => {
    setEditingSpec(spec)
    setTestParams(spec.testParameters || [])
    form.setFieldsValue({
      specCode: spec.specCode,
      version: spec.version,
      title: spec.title,
      shortName: spec.shortName || '',
      specType: spec.specType || '',
      description: spec.description || '',
    })
    setModalOpen(true)
  }

  const handleSaveForm = (values: Record<string, any>) => {
    // H-25: Validate parameter name uniqueness within the same testType + testSubtype group
    const seen = new Set<string>()
    for (const p of testParams) {
      if (!p.parameter?.trim()) continue
      const key = `${p.testType || ''}|||${p.testSubtype || ''}|||${p.parameter.trim()}`
      if (seen.has(key)) {
        msgApi.error(`Duplicate parameter name "${p.parameter.trim()}" within the same test type group. Each parameter name must be unique.`)
        return
      }
      seen.add(key)
    }
    const payload = {
      specCode: values.specCode,
      title: values.title,
      version: values.version,
      shortName: values.shortName || undefined,
      specType: values.specType || undefined,
      description: values.description || undefined,
      testParameters: testParams,
    }
    if (editingSpec) {
      updateMut.mutate({ specId: editingSpec.id, body: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const addParamRow = () => {
    setTestParams([
      ...testParams,
      { id: String(Date.now()), testType: null, testSubtype: null, parameter: '', dataType: 'text', validationType: '', specLimit: '', unit: '%', testMethod: '' },
    ])
  }

  const updateParamRow = (index: number, key: keyof ArdSpecTestParam, val: string) => {
    const next = [...testParams]
    next[index] = { ...next[index], [key]: val }
    setTestParams(next)
  }

  const removeParamRow = (index: number) => {
    setTestParams(testParams.filter((_, i) => i !== index))
  }

  const STATUS_TAGS: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: 'Draft' },
    SUBMITTED: { color: 'gold', label: 'Submitted for Review' },
    APPROVED: { color: 'green', label: 'Approved (E-signed)' },
    REJECTED: { color: 'red', label: 'Rejected' },
  }

  const columns = [
    {
      title: 'Spec Code / Title',
      key: 'specCode',
      render: (_: unknown, record: ArdProjectSpecification) => (
        <div>
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-indigo-600" />
            <span className="font-semibold text-slate-800">{record.specCode}</span>
            <Tag className="text-[11px] font-medium">v{record.version}</Tag>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{record.title}</p>
        </div>
      ),
    },
    {
      title: 'Specification Test Parameters',
      key: 'testParameters',
      render: (_: unknown, record: ArdProjectSpecification) => (
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {(record.testParameters || []).map((p, idx) => (
            <div key={idx} className="text-xs text-slate-600 flex items-center gap-1.5 flex-wrap">
              {p.testType && <Tag color="blue" className="text-[10px] py-0 px-1 font-semibold">{p.testType}</Tag>}
              {p.testSubtype && <Tag color="cyan" className="text-[10px] py-0 px-1 font-semibold">{p.testSubtype}</Tag>}
              {p.dataType && <Tag color="purple" className="text-[10px] py-0 px-1 font-medium uppercase">{p.dataType}</Tag>}
              {p.validationType && <Tag color="geekblue" className="text-[10px] py-0 px-1 font-medium">{p.validationType}</Tag>}
              <span className="font-semibold text-slate-700">{p.parameter || '—'}:</span>
              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px]">{p.specLimit || '—'}</span>
              {p.unit && <span className="text-slate-400">({p.unit})</span>}
              {p.testMethod && <span className="text-xs text-slate-400 italic">[{p.testMethod}]</span>}
            </div>
          ))}
          {(!record.testParameters || record.testParameters.length === 0) && (
            <span className="text-xs text-slate-400 italic">No parameters defined</span>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'specType',
      width: 140,
      render: (v: string | null) => v ? <Tag className="text-xs">{v}</Tag> : <span className="text-slate-400">—</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v: string | null) => v ? <span className="text-xs text-slate-600">{v}</span> : <span className="text-slate-400">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ArdProjectSpecification) => {
        const meta = STATUS_TAGS[status] || { color: 'default', label: status }
        return (
          <div>
            <Tag color={meta.color}>{meta.label}</Tag>
            {record.approvedBy && (
              <p className="text-[11px] text-violet-600 mt-1 flex items-center gap-1 font-medium">
                <ShieldCheck size={12} /> Approved by {record.approvedBy}
              </p>
            )}
          </div>
        )
      },
    },
    {
      title: 'Created / Updated',
      key: 'createdAt',
      render: (_: unknown, record: ArdProjectSpecification) => (
        <div className="text-xs text-slate-500">
          <div>By: <span className="font-medium text-slate-700">{record.createdBy}</span></div>
          {record.createdAt && <div>{dayjs(record.createdAt).format('DD MMM YYYY')}</div>}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ArdProjectSpecification) => (
        <Space size="small">
          {record.status === 'DRAFT' && !readOnly && (
            <>
              <Button
                size="small"
                icon={<Edit3 size={13} />}
                onClick={() => handleOpenEdit(record)}
              >
                Edit
              </Button>
              <Button
                size="small"
                type="primary"
                icon={<Send size={13} />}
                onClick={() => submitMut.mutate(record.id)}
                loading={submitMut.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Submit
              </Button>
            </>
          )}
          {record.status === 'SUBMITTED' && !readOnly && (() => {
            const isSelf = record.createdById && user?.id && record.createdById === user.id
            return (
              <Tooltip title={isSelf ? 'You cannot approve a specification you created' : undefined}>
                <Button
                  size="small"
                  type="primary"
                  icon={<ShieldCheck size={13} />}
                  disabled={!!isSelf}
                  onClick={() => {
                    setApprovingSpecId(record.id)
                    setEsignModalOpen(true)
                  }}
                >
                  Approve (E-Sign)
                </Button>
              </Tooltip>
            )
          })()}
          {record.status !== 'APPROVED' && !readOnly && (
            <Popconfirm title="Delete this specification?" onConfirm={() => deleteMut.mutate(record.id)}>
              <Button size="small" danger icon={<Trash2 size={13} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {ctx}

      <div className="flex justify-between items-center glass-card p-4 rounded-lg">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Project Analytical Specifications</h3>
          <p className="text-xs text-slate-400">Manage specification codes, versioning, parameter limits, and E-signature approval workflow.</p>
        </div>
        {!readOnly && (
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none shadow-sm"
          >
            New Specification
          </Button>
        )}
      </div>

      <div className="glass-card rounded-lg overflow-hidden p-2">
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={specs}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </div>

      {/* Add / Edit Specification Modal */}
      <Modal
        {...glassModalProps}
        title={editingSpec ? `Edit Specification — ${editingSpec.specCode}` : 'Create New Project Specification'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending || updateMut.isPending}
        width={980}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveForm} className="pt-2">
          <div className="grid grid-cols-3 gap-x-4">
            <Form.Item name="specCode" label="Spec Code" rules={[{ required: true }]} className="col-span-1">
              <Input placeholder="e.g. SPEC-PRJ-001" />
            </Form.Item>
            <Form.Item name="version" label="Version" initialValue="1.0" rules={[{ required: true }]} className="col-span-1">
              <Input placeholder="1.0" />
            </Form.Item>
            <Form.Item name="title" label="Specification Name" rules={[{ required: true }]} className="col-span-1">
              <Input placeholder="e.g. Release Specification" />
            </Form.Item>
            <Form.Item name="shortName" label="Short Name" className="col-span-1">
              <Input placeholder="e.g. REL-SPEC" />
            </Form.Item>
            <Form.Item name="specType" label="Specification Type" className="col-span-1">
              <Select allowClear placeholder="Select type"
                options={['Release', 'In-Process', 'Stability', 'Raw Material', 'Finished Product', 'Reference Standard'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="description" label="Description" className="col-span-3">
              <Input.TextArea rows={2} placeholder="Brief description of this specification..." />
            </Form.Item>
          </div>

          <div className="mt-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center mb-2">
              <Text strong className="text-xs text-slate-700 uppercase tracking-wide">Test Parameters & Specification Limits</Text>
              <div className="flex items-center gap-2">
                <Button size="small" type="dashed" onClick={loadPresetTemplate} className="text-xs">
                  Load Preset Template
                </Button>
                <Button size="small" icon={<Plus size={13} />} onClick={addParamRow} className="text-xs">
                  Add Parameter
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {testParams.map((param, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                  <Select
                    placeholder="Test Type"
                    value={param.testType || undefined}
                    onChange={(v) => {
                      const next = [...testParams]
                      next[i] = { ...next[i], testType: v, testSubtype: null }
                      setTestParams(next)
                    }}
                    options={testTypeOptions}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    className="col-span-2 text-xs"
                  />
                  <Select
                    placeholder="Subtype"
                    value={param.testSubtype || undefined}
                    onChange={(v) => updateParamRow(i, 'testSubtype', v)}
                    options={getSubtypeOptions(param.testType)}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    className="col-span-2 text-xs"
                  />
                  <Input
                    placeholder="Parameter (e.g. Assay)"
                    value={param.parameter}
                    onChange={(e) => updateParamRow(i, 'parameter', e.target.value)}
                    className="col-span-2 text-xs"
                  />
                  <Select
                    placeholder="Data Type"
                    value={param.dataType || 'text'}
                    onChange={(v) => updateParamRow(i, 'dataType', v)}
                    options={[
                      { value: 'text', label: 'Text' },
                      { value: 'number', label: 'Number' },
                      { value: 'range', label: 'Range' },
                    ]}
                    className="col-span-1 text-xs"
                  />
                  <Select
                    placeholder="Validation Type"
                    value={param.validationType || undefined}
                    onChange={(v) => updateParamRow(i, 'validationType', v)}
                    allowClear
                    options={['Single', 'Duplicate', 'Triplicate', 'Bracketing', 'Matrixing'].map(v => ({ value: v, label: v }))}
                    className="col-span-1 text-xs"
                  />
                  <Input
                    placeholder="Limit (98.0% - 102.0%)"
                    value={param.specLimit}
                    onChange={(e) => updateParamRow(i, 'specLimit', e.target.value)}
                    className="col-span-2 text-xs"
                  />
                  <Select
                    placeholder="UOM"
                    value={param.unit || undefined}
                    onChange={(v) => updateParamRow(i, 'unit', v)}
                    options={uomOptions}
                    allowClear
                    showSearch
                    className="col-span-1 text-xs"
                  />
                  <Input
                    placeholder="Method"
                    value={param.testMethod || ''}
                    onChange={(e) => updateParamRow(i, 'testMethod', e.target.value)}
                    className="col-span-1 text-xs"
                  />
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<Trash2 size={13} />}
                    onClick={() => removeParamRow(i)}
                    className="col-span-0.5 flex justify-center"
                  />
                </div>
              ))}
            </div>
          </div>
        </Form>
      </Modal>

      {/* E-Signature Approval Modal */}
      <ESignatureModal
        open={esignModalOpen}
        title="Approve Specification (E-Signature)"
        description="Re-authenticate with your password to approve this project analytical specification."
        userName={user?.username || 'Current User'}
        requireReason={true}
        reasonLabel="Reason for Approval"
        loading={approveMut.isPending}
        onCancel={() => {
          setEsignModalOpen(false)
          setApprovingSpecId(null)
        }}
        onConfirm={async (payload) => {
          if (approvingSpecId) {
            await approveMut.mutateAsync({ specId: approvingSpecId, password: payload.password })
          }
        }}
      />
    </div>
  )
}
