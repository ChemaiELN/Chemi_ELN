import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Table, Tag, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, message, Typography, Tooltip
} from 'antd'
import { Plus, Trash2, Edit3, Send, ShieldCheck, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardApi, ardProjectSpecsApi, type ArdProjectSpecification, type ArdSpecTestParam, type ArdTestConfiguration
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
  // Tests explicitly linked to this spec — tracked separately from testParams
  // so a test with no parameters yet still shows as a group you can add rows
  // into (rather than only appearing once it has at least one row).
  const [linkedTests, setLinkedTests] = useState<{ testConfigId: string; testType: string | null; testSubtype: string | null; techniqueName: string | null }[]>([])
  const [form] = Form.useForm()

  // Master data for Test Type and Test Subtype dropdowns
  const { data: masterData } = useQuery({
    queryKey: ['ard-master-data'],
    queryFn: ardApi.getMasterData,
  })

  // Test Type -> Test Subtype cascade, sourced from Test Configuration master
  // data — mirrors the legacy "Add New Test" flow (pick Type, then Subtype,
  // then that test's own parameters get pulled in).
  const testTypeOptions = useMemo(() => {
    const types = Array.from(new Set((masterData?.testConfigs ?? []).filter(tc => tc.active).map(tc => tc.testType).filter(Boolean)))
    return types.map(t => ({ value: t, label: t }))
  }, [masterData?.testConfigs])

  const getSubtypeOptions = (testType?: string) => {
    if (!testType) return []
    const subtypes = Array.from(new Set(
      (masterData?.testConfigs ?? [])
        .filter(tc => tc.active && tc.testType === testType)
        .map(tc => tc.testSubtype)
        .filter(Boolean)
    ))
    return (subtypes as string[]).map(st => ({ value: st, label: st }))
  }

  const uomOptions = useMemo(() => {
    const uomLookups = (masterData?.lookups ?? []).filter(
      (l) => l.active && ['UOM', 'UNITS', 'UNIT'].includes((l.category ?? '').toUpperCase())
    )
    return uomLookups.map((l) => ({ value: l.label || l.code, label: l.label || l.code }))
  }, [masterData?.lookups])

  const specTypeOptions = useMemo(() => {
    return (masterData?.lookups ?? [])
      .filter((l) => l.active && (l.category ?? '').toLowerCase() === 'specification type')
      .map((l) => ({ value: l.label || l.code, label: l.label || l.code }))
  }, [masterData?.lookups])

  const [addTestType, setAddTestType] = useState<string | undefined>(undefined)
  const [addTestSubtype, setAddTestSubtype] = useState<string | undefined>(undefined)
  const [addTestTechnique, setAddTestTechnique] = useState<string | undefined>(undefined)

  // Test Type + Subtype can match more than one Test Configuration if
  // different techniques share the same type/subtype pairing.
  const matchingConfigsForAdd = useMemo(() => {
    if (!addTestType || !addTestSubtype) return []
    return (masterData?.testConfigs ?? []).filter(
      tc => tc.active && tc.testType === addTestType && tc.testSubtype === addTestSubtype
    )
  }, [masterData?.testConfigs, addTestType, addTestSubtype])

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
    setLinkedTests([])
    setAddTestType(undefined)
    setAddTestSubtype(undefined)
    setAddTestTechnique(undefined)
    form.setFieldsValue({
      title: '',
      specType: undefined,
      description: '',
    })
    setModalOpen(true)
  }

  const resetAddTestCascade = () => {
    setAddTestType(undefined)
    setAddTestSubtype(undefined)
    setAddTestTechnique(undefined)
  }

  // Pulls in a Test Configuration's own result parameters as spec parameter
  // rows (tagged with testConfigId), pre-filled from master data but editable
  // here without touching the shared Test Configuration — same pattern as the
  // Test Group's per-group Specification override. If the test has no
  // parameters of its own, it still gets linked (as an empty group) so the
  // user can add rows into it manually.
  const addTestToSpec = (tc: ArdTestConfiguration | undefined) => {
    if (!tc) return
    if (linkedTests.some(t => t.testConfigId === tc.id)) {
      msgApi.info('This test is already added to the specification.')
      resetAddTestCascade()
      return
    }
    setLinkedTests([...linkedTests, { testConfigId: tc.id, testType: tc.testType, testSubtype: tc.testSubtype, techniqueName: tc.techniqueName }])
    const params = Array.isArray(tc.resultParams) ? tc.resultParams : []
    if (params.length > 0) {
      const newRows: ArdSpecTestParam[] = params.map(rp => ({
        id: String(Date.now() + Math.random()),
        testConfigId: tc.id,
        testType: tc.testType,
        testSubtype: tc.testSubtype,
        techniqueName: tc.techniqueName,
        parameter: rp.name || tc.testType,
        dataType: rp.dataType || 'text',
        validationType: rp.validationType || 'NONE',
        unit: rp.uom || null,
        precision: null,
        lowerLimit: rp.lowerLimit ?? null,
        upperLimit: rp.upperLimit ?? null,
        specLimit: rp.specification || '',
      }))
      setTestParams([...testParams, ...newRows])
    }
    resetAddTestCascade()
  }

  const handleAddTestClick = () => {
    if (matchingConfigsForAdd.length === 1) {
      addTestToSpec(matchingConfigsForAdd[0])
    } else if (matchingConfigsForAdd.length > 1 && addTestTechnique) {
      addTestToSpec(matchingConfigsForAdd.find(tc => tc.id === addTestTechnique))
    }
  }

  const removeTestFromSpec = (testConfigId: string) => {
    setLinkedTests(linkedTests.filter(t => t.testConfigId !== testConfigId))
    setTestParams(testParams.filter(p => p.testConfigId !== testConfigId))
  }

  const addParamToLinkedTest = (testConfigId: string) => {
    const t = linkedTests.find(lt => lt.testConfigId === testConfigId)
    setTestParams([
      ...testParams,
      { id: String(Date.now()), testConfigId, testType: t?.testType, testSubtype: t?.testSubtype, techniqueName: t?.techniqueName, manualEntry: true, parameter: '', dataType: 'text', validationType: 'NONE', specLimit: '', unit: null },
    ])
  }

  const addCustomParamRow = () => {
    setTestParams([
      ...testParams,
      { id: String(Date.now()), testConfigId: null, testType: null, testSubtype: null, manualEntry: true, parameter: '', dataType: 'text', validationType: 'NONE', specLimit: '', unit: null },
    ])
  }

  const handleOpenEdit = (spec: ArdProjectSpecification) => {
    setEditingSpec(spec)
    const params = spec.testParameters || []
    setTestParams(params)
    // Reconstruct the linked-test groups from whatever testConfigIds are
    // present among the saved parameters.
    const seen = new Set<string>()
    const derivedLinks: typeof linkedTests = []
    params.forEach(p => {
      if (p.testConfigId && !seen.has(p.testConfigId)) {
        seen.add(p.testConfigId)
        derivedLinks.push({ testConfigId: p.testConfigId, testType: p.testType ?? null, testSubtype: p.testSubtype ?? null, techniqueName: p.techniqueName ?? null })
      }
    })
    setLinkedTests(derivedLinks)
    setAddTestType(undefined)
    setAddTestSubtype(undefined)
    setAddTestTechnique(undefined)
    form.setFieldsValue({
      title: spec.title,
      specType: spec.specType || undefined,
      description: spec.description || '',
    })
    setModalOpen(true)
  }

  const handleSaveForm = (values: Record<string, any>) => {
    // H-25: Validate parameter name uniqueness within the same testType + testSubtype group
    const seen = new Set<string>()
    for (const p of testParams) {
      if (!p.parameter?.trim()) continue
      const key = `${p.testConfigId || `${p.testType || ''}|||${p.testSubtype || ''}`}|||${p.parameter.trim()}`
      if (seen.has(key)) {
        msgApi.error(`Duplicate parameter name "${p.parameter.trim()}" within the same test type group. Each parameter name must be unique.`)
        return
      }
      seen.add(key)
    }
    const payload = {
      title: values.title,
      version: editingSpec?.version || '1.0',
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

  const updateParamRow = (index: number, key: keyof ArdSpecTestParam, val: unknown) => {
    const next = [...testParams]
    next[index] = { ...next[index], [key]: val }
    setTestParams(next)
  }

  const STATUS_TAGS: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: 'Draft' },
    SUBMITTED: { color: 'gold', label: 'Submitted for Review' },
    APPROVED: { color: 'green', label: 'Approved (E-signed)' },
    REJECTED: { color: 'red', label: 'Rejected' },
  }

  const columns = [
    {
      title: 'Sr. No',
      key: 'srNo',
      width: 70,
      render: (_: unknown, __: ArdProjectSpecification, index: number) => <span className="text-xs text-slate-500">{index + 1}</span>,
    },
    {
      title: 'Spec. No',
      dataIndex: 'specCode',
      render: (v: string) => (
        <span className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
          <FileText size={13} className="text-indigo-600" /> {v || '—'}
        </span>
      ),
    },
    {
      title: 'Specification Name',
      dataIndex: 'title',
      render: (v: string) => <span className="text-xs font-medium text-slate-700">{v}</span>,
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
      title: 'Version',
      dataIndex: 'version',
      width: 90,
      render: (v: string) => <Tag className="text-[11px] font-medium">v{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const meta = STATUS_TAGS[status] || { color: 'default', label: status }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Created By (On)',
      key: 'createdBy',
      render: (_: unknown, record: ArdProjectSpecification) => (
        <div className="text-xs text-slate-500">
          <div className="font-medium text-slate-700">{record.createdBy}</div>
          {record.createdAt && <div>{dayjs(record.createdAt).format('DD MMM YYYY')}</div>}
        </div>
      ),
    },
    {
      title: 'Updated By (On)',
      key: 'updatedBy',
      render: (_: unknown, record: ArdProjectSpecification) => (
        record.updatedBy ? (
          <div className="text-xs text-slate-500">
            <div className="font-medium text-slate-700">{record.updatedBy}</div>
            {record.updatedAt && <div>{dayjs(record.updatedAt).format('DD MMM YYYY')}</div>}
          </div>
        ) : <span className="text-slate-400 text-xs">—</span>
      ),
    },
    {
      title: 'Approved By (On)',
      key: 'approvedBy',
      render: (_: unknown, record: ArdProjectSpecification) => (
        record.approvedBy ? (
          <div className="text-xs text-violet-600">
            <div className="font-medium flex items-center gap-1"><ShieldCheck size={12} /> {record.approvedBy}</div>
            {record.approvedAt && <div className="text-slate-400">{dayjs(record.approvedAt).format('DD MMM YYYY')}</div>}
          </div>
        ) : <span className="text-slate-400 text-xs">—</span>
      ),
    },
    {
      title: 'Action',
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
            <Form.Item name="title" label="Specification Name" rules={[{ required: true }]} className="col-span-1">
              <Input placeholder="e.g. Release Specification" />
            </Form.Item>
            <Form.Item label="Specification Number" className="col-span-1">
              <Input disabled value={editingSpec?.specCode || 'Auto-generated on save'} />
            </Form.Item>
            <Form.Item name="specType" label="Specification Type" rules={[{ required: true }]} className="col-span-1">
              <Select allowClear placeholder="Select type" options={specTypeOptions} />
            </Form.Item>
            <Form.Item name="description" label="Description" rules={[{ required: true }]} className="col-span-3">
              <Input.TextArea rows={2} placeholder="Brief description of this specification..." />
            </Form.Item>
          </div>

          <div className="mt-2 border-t border-slate-100 pt-3">
            <div className="flex justify-between items-center mb-2">
              <Text strong className="text-xs text-slate-700 uppercase tracking-wide">Test Parameters & Specification Limits</Text>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  showSearch
                  allowClear
                  placeholder="Test Type"
                  style={{ width: 150 }}
                  size="small"
                  value={addTestType}
                  onChange={(v) => { setAddTestType(v); setAddTestSubtype(undefined); setAddTestTechnique(undefined) }}
                  options={testTypeOptions}
                />
                <Select
                  showSearch
                  allowClear
                  placeholder="Test Subtype"
                  style={{ width: 150 }}
                  size="small"
                  disabled={!addTestType}
                  value={addTestSubtype}
                  onChange={(v) => { setAddTestSubtype(v); setAddTestTechnique(undefined) }}
                  options={getSubtypeOptions(addTestType)}
                />
                {matchingConfigsForAdd.length > 1 && (
                  <Select
                    showSearch
                    placeholder="Technique"
                    style={{ width: 140 }}
                    size="small"
                    value={addTestTechnique}
                    onChange={setAddTestTechnique}
                    options={matchingConfigsForAdd.map(tc => ({ value: tc.id, label: tc.techniqueCode ?? tc.techniqueName ?? tc.id }))}
                  />
                )}
                <Button
                  size="small"
                  type="primary"
                  icon={<Plus size={13} />}
                  disabled={matchingConfigsForAdd.length === 0 || (matchingConfigsForAdd.length > 1 && !addTestTechnique)}
                  onClick={handleAddTestClick}
                  className="text-xs"
                >
                  Add Test
                </Button>
                <Button size="small" icon={<Plus size={13} />} onClick={addCustomParamRow} className="text-xs">
                  Add Custom Parameter
                </Button>
              </div>
            </div>

            {linkedTests.length === 0 && testParams.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6 border border-dashed border-slate-200 rounded-lg">
                No parameters yet — pick a Test Type &amp; Subtype above to pull in its parameters, or add a custom one.
              </p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-center font-semibold text-slate-600 w-10">Sr. No.</th>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">Test Parameter</th>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600">Parameter Details</th>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600 w-24">Data Type</th>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600 w-24">Validation</th>
                      <th colSpan={4} className="border-b border-l border-slate-200 px-2 py-1 text-center font-semibold text-slate-600">Specification</th>
                      <th rowSpan={2} className="border-b border-slate-200 px-2 py-1.5 text-center font-semibold text-slate-600 w-16">Action</th>
                    </tr>
                    <tr>
                      <th className="border-b border-l border-slate-200 px-2 py-1 text-center font-medium text-slate-500 w-20">Precision</th>
                      <th className="border-b border-slate-200 px-2 py-1 text-center font-medium text-slate-500 w-20">Lower Limit</th>
                      <th className="border-b border-slate-200 px-2 py-1 text-center font-medium text-slate-500 w-20">Upper Limit</th>
                      <th className="border-b border-slate-200 px-2 py-1 text-center font-medium text-slate-500 w-20">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Group rows by the test they came from; parameters added
                      // without a linked test fall into a "Custom" bucket. Linked
                      // tests with zero rows still get a group so the user can add
                      // parameters into them.
                      const groups: { key: string; testConfigId: string | null; label: string; rows: { param: ArdSpecTestParam; index: number }[] }[] = []
                      const groupByKey = new Map<string, typeof groups[number]>()

                      linkedTests.forEach(t => {
                        groupByKey.set(t.testConfigId, {
                          key: t.testConfigId,
                          testConfigId: t.testConfigId,
                          label: `${t.testType ?? ''}${t.testSubtype ? `/${t.testSubtype}` : ''}`,
                          rows: [],
                        })
                      })
                      linkedTests.forEach(t => groups.push(groupByKey.get(t.testConfigId)!))

                      testParams.forEach((param, index) => {
                        const key = param.testConfigId || '__custom__'
                        let g = groupByKey.get(key)
                        if (!g) {
                          g = { key, testConfigId: param.testConfigId ?? null, label: 'Custom Parameters', rows: [] }
                          groupByKey.set(key, g)
                          groups.push(g)
                        }
                        g.rows.push({ param, index })
                      })

                      let srNo = 0
                      return groups.map(group => {
                        srNo += 1
                        return (
                          <Fragment key={group.key}>
                            <tr className="bg-slate-50/80">
                              <td className="border-b border-slate-100 px-2 py-1.5 text-center font-semibold text-slate-600">{srNo}</td>
                              <td colSpan={7} className="border-b border-slate-100 px-2 py-1.5 font-semibold text-slate-700">{group.label}</td>
                              <td className="border-b border-slate-100 px-2 py-1.5">
                                <Space size={2}>
                                  {group.testConfigId && (
                                    <Tooltip title="Add parameter to this test">
                                      <Button size="small" type="text" icon={<Plus size={13} className="text-indigo-600" />}
                                        onClick={() => addParamToLinkedTest(group.testConfigId!)} />
                                    </Tooltip>
                                  )}
                                  {group.testConfigId && (
                                    <Tooltip title="Remove this test">
                                      <Button size="small" type="text" danger icon={<Trash2 size={13} />}
                                        onClick={() => removeTestFromSpec(group.testConfigId!)} />
                                    </Tooltip>
                                  )}
                                </Space>
                              </td>
                            </tr>
                            {group.rows.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="border-b border-slate-100 px-2 py-2 text-slate-400 italic">
                                  No parameters in master data for this test — use the + above to add one.
                                </td>
                              </tr>
                            ) : group.rows.map(({ param, index }) => {
                              const isCustom = !!param.manualEntry
                              const showLower = param.validationType === 'NLT' || param.validationType === 'RANGE'
                              const showUpper = param.validationType === 'NMT' || param.validationType === 'RANGE'
                              return (
                                <tr key={param.id ?? index} className="hover:bg-slate-50/50">
                                  <td className="border-b border-slate-100 px-2 py-1.5"></td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    {isCustom ? (
                                      <Input size="small" placeholder="Parameter name" value={param.parameter}
                                        onChange={(e) => updateParamRow(index, 'parameter', e.target.value)} />
                                    ) : (
                                      <span className="font-medium text-slate-700">{param.parameter}</span>
                                    )}
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    <Input size="small" placeholder="Details / remarks" value={param.remarks ?? ''}
                                      onChange={(e) => updateParamRow(index, 'remarks', e.target.value)} />
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    {isCustom ? (
                                      <Select size="small" style={{ width: '100%' }} value={param.dataType || 'text'}
                                        onChange={(v) => updateParamRow(index, 'dataType', v)}
                                        options={[{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }]} />
                                    ) : (
                                      <Tag className="text-[10px] uppercase">{param.dataType || 'text'}</Tag>
                                    )}
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    <Select size="small" style={{ width: '100%' }} value={param.validationType || 'NONE'}
                                      onChange={(v) => updateParamRow(index, 'validationType', v)}
                                      options={[
                                        { value: 'NONE', label: 'None' },
                                        { value: 'NMT', label: 'NMT' },
                                        { value: 'NLT', label: 'NLT' },
                                        { value: 'RANGE', label: 'Range' },
                                      ]} />
                                  </td>
                                  <td className="border-b border-l border-slate-100 px-2 py-1.5">
                                    <InputNumber size="small" style={{ width: '100%' }} value={param.precision ?? undefined}
                                      onChange={(v) => updateParamRow(index, 'precision', v ?? null)} />
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    {showLower && (
                                      <InputNumber size="small" style={{ width: '100%' }} value={param.lowerLimit ?? undefined}
                                        onChange={(v) => updateParamRow(index, 'lowerLimit', v ?? null)} />
                                    )}
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    {showUpper && (
                                      <InputNumber size="small" style={{ width: '100%' }} value={param.upperLimit ?? undefined}
                                        onChange={(v) => updateParamRow(index, 'upperLimit', v ?? null)} />
                                    )}
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5">
                                    <Select size="small" showSearch allowClear style={{ width: '100%' }} value={param.unit || undefined}
                                      onChange={(v) => updateParamRow(index, 'unit', v ?? null)} options={uomOptions} />
                                  </td>
                                  <td className="border-b border-slate-100 px-2 py-1.5 text-center">
                                    <Button size="small" danger type="text" icon={<Trash2 size={13} />}
                                      onClick={() => setTestParams(testParams.filter((_, i2) => i2 !== index))} />
                                  </td>
                                </tr>
                              )
                            })}
                          </Fragment>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )}
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
