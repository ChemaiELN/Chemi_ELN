import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Form, Input, Select, Button, message, Card, Spin, Checkbox } from 'antd'
import { ardApi, ardAtrApi } from '../../api/ard'
import { ardProjectsApi } from '../../api/ard-projects'
import { AtrExpReferencePicker } from '../../components/ard/AtrExpReferencePicker'
import { ApiError } from '../../api/client'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

export default function ArdAtrNewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const locState = (location.state ?? {}) as { projectCode?: string; sampleCode?: string; batchNo?: string; sampleType?: string }
  const user = useAppSelector(selectUser)
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()

  const [selectedFormTypeId, setSelectedFormTypeId] = useState<string>('')
  const [mandateChecked, setMandateChecked] = useState<boolean>(false)

  const { data: masterData, isLoading: loadingMaster } = useQuery({ queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData })
  const { data: projectsData } = useQuery({ queryKey: ['ard-projects-list'], queryFn: () => ardProjectsApi.list({ pageSize: 100 }) })

  const projectOptions = useMemo(() => {
    const items = (projectsData?.items ?? []).map((p) => ({
      value: p.productName || p.code,
      label: `${p.productName || p.code} (${p.code})`,
      code: p.code,
      productName: p.productName || p.code,
    }))
    // B-73: include an explicit "Not Applicable" option for standalone ATRs
    items.push({ value: 'NA', label: 'Not Applicable (NA)', code: 'NA', productName: 'NA' })
    return items
  }, [projectsData?.items])

  useEffect(() => {
    if (!locState.projectCode && !locState.sampleCode) return
    if (locState.projectCode) {
      form.setFieldValue('projectCode', locState.projectCode)
      const match = projectOptions.find(p => p.code === locState.projectCode)
      if (match) form.setFieldValue('productName', match.value)
    }
    if (locState.sampleCode) form.setFieldValue('qcRef', locState.sampleCode)
  }, [locState.projectCode, locState.sampleCode, projectOptions])

  const create = useMutation({
    mutationFn: ardAtrApi.create,
    onSuccess: (form) => navigate(`/ard/atrs/${form.id}`),
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to create ATR.'),
  })

  const onFinish = (values: Record<string, unknown>) => {
    create.mutate({ ...values, createdBy: user?.username })
  }

  if (loadingMaster) {
    return (
      <div className="p-12 flex justify-center items-center">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {ctx}
      <h1 className="text-xl font-bold text-slate-800 mb-4">New Analytical Test Request</h1>
      <Card className="rounded-lg">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={(changed) => {
            if ('formTypeId' in changed) setSelectedFormTypeId(String(changed.formTypeId || ''))
            if ('mandateCertification' in changed) setMandateChecked(!!changed.mandateCertification)
          }}
        >
          <Form.Item name="formTypeId" label="Form Type" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={(masterData?.formTypes ?? []).filter((f) => f.active).map((f) => ({ value: f.id, label: f.name }))}
              onChange={(val, opt: any) => {
                setSelectedFormTypeId(val)
                form.setFieldValue('formTypeName', opt?.label)
              }} />
          </Form.Item>
          <Form.Item name="formTypeName" hidden><Input /></Form.Item>
          <Form.Item name="reportType" label="Report Type" rules={[{ required: true, message: 'Please select a report type' }]}>
            <Select placeholder="Select report type..."
              options={['COA', 'Detailed Report', 'Summary Report'].map(v => ({ value: v, label: v }))} />
          </Form.Item>

          <Form.Item name="formCategory" label="ATR Type">
            <Select placeholder="Select ATR type..." allowClear
              options={[
                { value: 'ROUTINE', label: 'Routine Analysis' },
                { value: 'METHOD_DEV', label: 'Method Development' },
              ]} />
          </Form.Item>

          <Form.Item name="mandateCertification" label="Mandate Certification" valuePropName="checked">
            <Checkbox onChange={(e) => setMandateChecked(e.target.checked)}>Require QA Approval before closure</Checkbox>
          </Form.Item>

          <Form.Item name="productName" label="Product Name" rules={[{ required: true, message: 'Please select a product' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select project..."
              options={projectOptions}
              onChange={(val, opt: any) => {
                if (opt?.code) {
                  form.setFieldValue('projectCode', opt.code)
                }
              }}
            />
          </Form.Item>
          <Form.Item name="projectCode" label="Project Code" rules={[{ required: true }]}>
            <Input placeholder="Auto-populated from selected project" className="font-mono" />
          </Form.Item>
          <Form.Item name="qcRef" label="QC Reference No.">
            <Input placeholder="e.g. QC/2024/001" />
          </Form.Item>
          <Form.Item name="objectives" label="Objectives">
            <Input.TextArea rows={3} placeholder="Describe the objectives of this analytical test request..." />
          </Form.Item>
          <Form.Item name="requestRemarks" label="Form Remarks">
            <Input.TextArea rows={2} placeholder="Optional remarks for this ATR form..." />
          </Form.Item>
          {user?.role_code !== 'ANALYST' && (
            <Form.Item name="associatedExpCodes" label="Reference Notebook Experiment">
              <AtrExpReferencePicker
                onChange={(val) => form.setFieldValue('associatedExpCodes', val)}
              />
            </Form.Item>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => navigate('/ard/atrs')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={create.isPending}>Create</Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
