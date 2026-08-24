import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Select, Tag, message, Tabs } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { TestTubes, Plus, Inbox, CheckSquare, ArrowRight } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet, apiPost } from '../../api/client'
import { ardProjectsApi } from '../../api/ard-projects'
import { projectApi } from '../../api/adc'
import { cgtProjectApi } from '../../api/cgt'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { glassModalProps } from '../../utils/modalStyles'

interface AtrSummary {
  id: string
  formNo: string
  status: string
  productName: string
  projectCode: string
  formTypeName: string
  assignedTl: string
  createdAt: string
  updatedAt: string
  originModule?: 'ARD' | 'ADC' | 'CGT'
  originProjectCode?: string | null
}

interface TestQueueItem {
  id: string
  atrId: string
  formNo: string
  productName: string
  sampleCode: string
  techniqueCode: string
  testType: string
  status: string
  assignedAnalyst: string
  updatedAt: string
}

interface FormType {
  id: string
  name: string
  code: string
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SAVED: 'blue', REQUESTED: 'purple', NEW: 'cyan', QA_PRE_APPROVAL: 'gold',
  PRE_APPROVAL_REWORK: 'orange', PENDING_CLARIFICATION: 'orange', CLARIFIED: 'lime',
  PARTIAL: 'geekblue', PENDING_APPROVAL: 'gold', APPROVED: 'green',
  VERIFIED: 'green', CERTIFICATION_REQUESTED: 'purple', CERTIFIED: 'success',
  ACCEPTED: 'success', ENHANCEMENT_REQUESTED: 'orange',
  REJECTED: 'error', WITHDRAWN: 'default',
}

export default function MyArdAtrsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)

  const baseRoute = location.pathname.startsWith('/adc')
    ? '/adc'
    : location.pathname.startsWith('/cgt')
    ? '/cgt'
    : '/ard'
  const externalModule = baseRoute === '/adc' ? 'ADC' : baseRoute === '/cgt' ? 'CGT' : null
  const isExternalRequester = externalModule !== null

  const { data: atrsData, isLoading: atrsLoading } = useQuery<{ items: AtrSummary[] }>({
    queryKey: ['my-ard-atrs', baseRoute],
    queryFn: () => apiGet('/api/ard/atrs', { pageSize: 100 }),
  })

  const { data: testsData, isLoading: testsLoading } = useQuery<{ items: TestQueueItem[] }>({
    queryKey: ['my-ard-tests-queue', baseRoute],
    queryFn: () => apiGet('/api/ard/tests', { pageSize: 100 }),
    enabled: !isExternalRequester,
  })

  const { data: formTypes } = useQuery<{ items: FormType[] }>({
    queryKey: ['ard-form-types'],
    queryFn: () => apiGet('/api/ard/master-data/form-types', { pageSize: 100 }),
  })

  // When raised FROM an external module (ADC/CGT), the project picker must
  // list THAT module's own projects — not ARD's internal project list, which
  // has no relationship to a CGT/ADC project code at all.
  const { data: projectsData } = useQuery({
    queryKey: ['atr-request-projects', baseRoute],
    queryFn: async (): Promise<{ items: unknown[] }> => {
      if (baseRoute === '/adc') return projectApi.list({ limit: 200 })
      if (baseRoute === '/cgt') return cgtProjectApi.list({ limit: 200 })
      return ardProjectsApi.list({ pageSize: 100 })
    },
  })

  const projectOptions = [
    { value: 'NA', label: 'N/A — No project', code: 'NA', productName: '' },
    ...(projectsData?.items ?? []).map((p: any) => ({
      value: p.id ?? p.code,
      label: `${p.code} — ${p.productName || p.product_name || p.name || ''}`,
      code: p.code,
      productName: p.productName || p.product_name || p.name || '',
    })),
  ]

  const create = useMutation({
    mutationFn: (vals: Record<string, string>) =>
      apiPost<AtrSummary>('/api/ard/atrs', {
        formTypeId: vals.formTypeId,
        formTypeName: formTypes?.items.find(f => f.id === vals.formTypeId)?.name ?? '',
        projectCode: vals.projectCode ?? '',
        productName: vals.productName ?? '',
        createdBy: user?.username ?? '',
        originModule: externalModule ?? undefined,
        originProjectId: isExternalRequester ? vals.projectId : undefined,
        originProjectCode: isExternalRequester ? vals.projectCode : undefined,
        originProjectName: isExternalRequester ? vals.productName : undefined,
      }),
    onSuccess: (atr: AtrSummary) => {
      qc.invalidateQueries({ queryKey: ['my-ard-atrs'] })
      message.success(isExternalRequester ? 'Draft request created. Complete it, then submit it to ARD.' : 'Test request created')
      setOpen(false)
      form.resetFields()
      navigate(`${baseRoute}/atrs/${atr.id}`)
    },
    onError: () => message.error('Failed to create test request'),
  })

  const atrColumns: ColumnsType<AtrSummary> = [
    {
      title: 'ATR No', dataIndex: 'formNo', key: 'formNo', width: 160,
      sorter: (a, b) => a.formNo.localeCompare(b.formNo),
      render: v => <span className="font-mono text-xs font-semibold text-violet-600">{v}</span>,
    },
    {
      title: 'Product / Sample', dataIndex: 'productName', key: 'productName', width: 200,
      sorter: (a, b) => a.productName.localeCompare(b.productName),
    },
    {
      title: 'Project Code', dataIndex: 'projectCode', key: 'projectCode', width: 140,
      sorter: (a, b) => (a.projectCode ?? '').localeCompare(b.projectCode ?? ''),
    },
    ...(isExternalRequester ? [{
      title: 'Source', dataIndex: 'originModule', key: 'originModule', width: 100,
      sorter: (a: AtrSummary, b: AtrSummary) => (a.originModule ?? '').localeCompare(b.originModule ?? ''),
      render: (v: string) => <Tag color={v === 'ADC' ? 'blue' : 'purple'}>{v || externalModule}</Tag>,
    }] : []),
    {
      title: 'Form Type', dataIndex: 'formTypeName', key: 'formTypeName', width: 160,
      sorter: (a, b) => (a.formTypeName ?? '').localeCompare(b.formTypeName ?? ''),
    },
    {
      title: 'Assigned TL', dataIndex: 'assignedTl', key: 'assignedTl', width: 140,
      sorter: (a, b) => (a.assignedTl ?? '').localeCompare(b.assignedTl ?? ''),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 160,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'} className="text-xs">{v.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Raised On', dataIndex: 'createdAt', key: 'createdAt', width: 130,
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
  ]

  const testColumns: ColumnsType<TestQueueItem> = [
    {
      title: 'ATR No', dataIndex: 'formNo', key: 'formNo', width: 160,
      sorter: (a, b) => a.formNo.localeCompare(b.formNo),
      render: v => <span className="font-mono text-xs font-semibold text-violet-600">{v}</span>,
    },
    {
      title: 'Sample Code', dataIndex: 'sampleCode', key: 'sampleCode', width: 150,
      sorter: (a, b) => (a.sampleCode ?? '').localeCompare(b.sampleCode ?? ''),
    },
    {
      title: 'Test Type', dataIndex: 'testType', key: 'testType', width: 160,
      sorter: (a, b) => (a.testType ?? '').localeCompare(b.testType ?? ''),
    },
    {
      title: 'Technique', dataIndex: 'techniqueCode', key: 'techniqueCode', width: 130,
      sorter: (a, b) => (a.techniqueCode ?? '').localeCompare(b.techniqueCode ?? ''),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 160,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'blue'} className="text-xs">{v.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Action', key: 'action', width: 110,
      render: (_, r) => (
        <Button size="small" type="link" icon={<ArrowRight size={13} />} onClick={() => navigate(`${baseRoute}/atrs/${r.atrId}/tests/${r.id}`)}>
          Process
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Inbox size={18} className="text-violet-600" />
          <h1 className="text-lg font-bold text-slate-800">{isExternalRequester ? 'My Requests to ARD' : 'My Queue'}</h1>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => setOpen(true)}
          className="rounded-md font-medium ml-auto"
        >
          {isExternalRequester ? 'New Request to ARD' : 'New Test Request'}
        </Button>
      </div>

      <Tabs
        items={[
          {
            key: 'atrs',
            label: (
              <span className="flex items-center gap-2">
                <TestTubes size={15} />
                {isExternalRequester ? 'Requests to ARD' : 'Test Requests (ATR)'}
              </span>
            ),
            children: (
              <div className="glass-card rounded-lg overflow-hidden">
                <Table
                  rowKey="id"
                  columns={atrColumns}
                  dataSource={atrsData?.items ?? []}
                  loading={atrsLoading}
                  scroll={{ x: 'max-content' }}
                  onRow={r => ({ onClick: () => navigate(`${baseRoute}/atrs/${r.id}`), className: 'cursor-pointer' })}
                  pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                  locale={{ emptyText: isExternalRequester ? 'No ATR requests sent to ARD yet.' : 'No test requests raised yet.' }}
                />
              </div>
            ),
          },
          ...(!isExternalRequester ? [{
            key: 'tests',
            label: (
              <span className="flex items-center gap-2">
                <CheckSquare size={15} />
                Assigned Tests Queue
              </span>
            ),
            children: (
              <div className="glass-card rounded-lg overflow-hidden">
                <Table
                  rowKey="id"
                  columns={testColumns}
                  dataSource={testsData?.items ?? []}
                  loading={testsLoading}
                  scroll={{ x: 'max-content' }}
                  pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                  locale={{ emptyText: 'No assigned tests in queue.' }}
                />
              </div>
            ),
          }] : []),
        ]}
      />

      <Modal
        {...glassModalProps}
        title={isExternalRequester ? `New ${externalModule} Request to ARD (ATR)` : 'New Test Request (ATR)'}
        open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Create Request"
      >
        <Form form={form} layout="vertical" onFinish={create.mutate} className="mt-2">
          <Form.Item name="formTypeId" label="ATR Form Type" rules={[{ required: true, message: 'Form Type is required' }]}>
            <Select
              placeholder="Select form type"
              options={(formTypes?.items ?? []).map(f => ({ value: f.id, label: f.name }))}
            />
          </Form.Item>
          <Form.Item name={isExternalRequester ? 'projectId' : 'projectCode'} label={isExternalRequester ? `${externalModule} Project` : 'Project'}>
            <Select
              showSearch
              placeholder="Select project"
              optionFilterProp="label"
              options={projectOptions /*
                value: p.code,
                label: `${p.code} — ${p.productName}`,
              */}
              onChange={(val) => {
                if (val === 'NA') {
                  form.setFieldValue('projectCode', 'NA')
                  form.setFieldValue('projectId', undefined)
                } else {
                  const proj = projectOptions.find((p: any) => p.value === val)
                  if (proj) {
                    form.setFieldValue('projectCode', proj.code)
                    form.setFieldValue('productName', proj.productName)
                  }
                }
              }}
            />
          </Form.Item>
          {isExternalRequester && <Form.Item name="projectCode" hidden><Input /></Form.Item>}
          <Form.Item name="productName" label="Product / Sample Name" rules={[{ required: true, message: 'Product name is required' }]}>
            <Input placeholder="e.g. Compound X Batch 001" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
