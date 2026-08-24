import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, InputNumber, Popconfirm, Table, Tag, message } from 'antd'
import { Plus, Save, Trash2, AlertTriangle, Pencil } from 'lucide-react'
import { riskAssessmentApi, type RiskAssessment, type RiskRow } from '../../../api/adc'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import { BTN_32 } from '../../../utils/buttonSize'
import BrandSpinner from '../../../components/ui/BrandSpinner'
import { EmptyValue, withEmptyValue } from '../../../components/ui/EmptyValue'
import dayjs from 'dayjs'

interface Props { projectId: string }

const RISK_LEVEL_COLOR: Record<string, string> = {
  Low: 'green', Medium: 'gold', High: 'orange', Critical: 'red',
}

const STATUS_COLOR: Record<string, string> = {
  Draft: 'default', 'Under Review': 'gold', Approved: 'green', Closed: 'purple',
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="text-sm font-medium text-slate-800">{withEmptyValue(value)}</div>
    </div>
  )
}

const hasHeaderData = (r?: RiskAssessment) =>
  !!(r && (r.assessment_id || r.assessment_type || r.overall_risk_level ||
    r.last_reviewed || r.reviewed_by || r.status || r.additional_notes || r.observations))

function rpnColor(rpn: number) {
  if (rpn <= 50)  return 'green'
  if (rpn <= 100) return 'gold'
  if (rpn <= 200) return 'orange'
  return 'red'
}

export default function RiskAssessmentTab({ projectId }: Props) {
  const qc = useQueryClient()
  const [headerForm] = Form.useForm()
  const [rowForm]    = Form.useForm()
  const [addingRow,  setAddingRow]  = useState(false)
  const [editing,    setEditing]    = useState(false)
  const initRef = useRef(false)

  const { data: ra, isLoading } = useQuery({
    queryKey: ['risk-assessment', projectId],
    queryFn:  () => riskAssessmentApi.get(projectId),
  })

  useEffect(() => {
    if (ra?.exists !== false) {
      headerForm.setFieldsValue({
        assessment_id:      ra?.assessment_id,
        assessment_type:    ra?.assessment_type,
        last_reviewed:      ra?.last_reviewed ? dayjs(ra.last_reviewed).format('YYYY-MM-DD') : undefined,
        reviewed_by:        ra?.reviewed_by,
        overall_risk_level: ra?.overall_risk_level,
        status:             ra?.status,
        additional_notes:   ra?.additional_notes,
        observations:       ra?.observations,
      })
    }
  }, [ra, headerForm])

  // Decide initial mode once data loads: edit if empty, view if data exists
  useEffect(() => {
    if (ra && !initRef.current) {
      initRef.current = true
      setEditing(!hasHeaderData(ra))
    }
  }, [ra])

  const upsertMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => riskAssessmentApi.upsert(projectId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-assessment', projectId] })
      message.success('Risk assessment saved')
      setEditing(false)
    },
  })

  // Auto-save header then open add-row form
  async function handleAddRow() {
    if (!ra || ra.exists === false) {
      try {
        const vals = headerForm.getFieldsValue()
        await riskAssessmentApi.upsert(projectId, vals)
        await qc.invalidateQueries({ queryKey: ['risk-assessment', projectId] })
      } catch {
        message.error('Could not create assessment record')
        return
      }
    }
    setAddingRow(true)
  }

  const addRowMut = useMutation({
    mutationFn: (row: Omit<RiskRow, 'id' | 'rpn' | 'created_at'>) =>
      riskAssessmentApi.addRow(projectId, row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risk-assessment', projectId] })
      setAddingRow(false)
      rowForm.resetFields()
      message.success('Row added')
    },
    onError: () => message.error('Save the assessment header first'),
  })

  const deleteRowMut = useMutation({
    mutationFn: (rowId: string) => riskAssessmentApi.deleteRow(projectId, rowId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risk-assessment', projectId] }),
  })

  const rows = ra?.rows ?? []

  const columns = [
    {
      title: '#', width: 40,
      render: (_: unknown, __: RiskRow, i: number) => (
        <span className="text-xs text-slate-400">{i + 1}</span>
      ),
    },
    {
      title: 'Process Step', dataIndex: 'process_step', key: 'process_step',
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Failure Mode', dataIndex: 'failure_mode', key: 'failure_mode',
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'S', dataIndex: 'severity', key: 'severity', width: 50,
      render: (v: number) => <span className="text-xs   font-bold text-slate-600">{withEmptyValue(v)}</span>,
    },
    {
      title: 'O', dataIndex: 'occurrence', key: 'occurrence', width: 50,
      render: (v: number) => <span className="text-xs   font-bold text-slate-600">{withEmptyValue(v)}</span>,
    },
    {
      title: 'D', dataIndex: 'detection', key: 'detection', width: 50,
      render: (v: number) => <span className="text-xs   font-bold text-slate-600">{withEmptyValue(v)}</span>,
    },
    {
      title: 'RPN', dataIndex: 'rpn', key: 'rpn', width: 70,
      render: (v: number) => <Tag color={rpnColor(v)}>{v}</Tag>,
    },
    {
      title: 'Mitigation', dataIndex: 'mitigation', key: 'mitigation',
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: '', key: 'del', width: 44,
      render: (_: unknown, row: RiskRow) => (
        <Popconfirm
          title="Delete this row?"
          onConfirm={() => deleteRowMut.mutate(row.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <button className="text-slate-300 hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </Popconfirm>
      ),
    },
  ]

  if (isLoading) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading risk assessment…" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-700">Risk Assessment Summary</h2>
          </div>
          {!editing && (
            <Button size="small" style={BTN_32} icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <Form
            form={headerForm}
            layout="vertical"
            onFinish={vals => upsertMut.mutate(vals)}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
              <Form.Item label="Assessment ID" name="assessment_id">
                <Input placeholder="e.g. RA-ADC-001" />
              </Form.Item>
              <Form.Item label="Assessment Type" name="assessment_type">
                <Select
                  allowClear
                  placeholder="Select type"
                  options={['FMEA', 'HACCP', 'PHA', 'What-If', 'Other'].map(v => ({ value: v, label: v }))}
                />
              </Form.Item>
              <Form.Item label="Overall Risk Level" name="overall_risk_level">
                <Select
                  allowClear
                  placeholder="Select level"
                  options={['Low', 'Medium', 'High', 'Critical'].map(v => ({
                    value: v,
                    label: <Tag color={RISK_LEVEL_COLOR[v]}>{v}</Tag>,
                  }))}
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
              <Form.Item label="Last Reviewed" name="last_reviewed">
                <Input type="date" />
              </Form.Item>
              <Form.Item label="Reviewed By" name="reviewed_by">
                <Input placeholder="Name / department" />
              </Form.Item>
              <Form.Item label="Status" name="status">
                <Select
                  allowClear
                  placeholder="Select status"
                  options={['Draft', 'Under Review', 'Approved', 'Closed'].map(v => ({ value: v, label: v }))}
                />
              </Form.Item>
            </div>

            <Form.Item label="Additional Notes" name="additional_notes">
              <RichEditor placeholder="Additional notes…" minHeight={100} />
            </Form.Item>
            <Form.Item label="Observations" name="observations">
              <RichEditor placeholder="Observations…" minHeight={100} />
            </Form.Item>
            <div className="flex gap-2 mt-2">
              <Button size="small" style={BTN_32} onClick={() => headerForm.resetFields()}>Clear</Button>
              <Button type="primary" size="small" style={BTN_32} icon={<Save size={13} />} loading={upsertMut.isPending} onClick={() => headerForm.submit()}>Save</Button>
            </div>
          </Form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
              <Field label="Assessment ID" value={ra?.assessment_id} />
              <Field label="Assessment Type" value={ra?.assessment_type} />
              <Field label="Overall Risk Level" value={
                ra?.overall_risk_level
                  ? <Tag color={RISK_LEVEL_COLOR[ra.overall_risk_level] ?? 'default'}>{ra.overall_risk_level}</Tag>
                  : null
              } />
              <Field label="Last Reviewed" value={ra?.last_reviewed ? dayjs(ra.last_reviewed).format('DD MMM YYYY') : null} />
              <Field label="Reviewed By" value={ra?.reviewed_by} />
              <Field label="Status" value={
                ra?.status
                  ? <Tag color={STATUS_COLOR[ra.status] ?? 'default'}>{ra.status}</Tag>
                  : null
              } />
            </div>
            {ra?.additional_notes && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">ADDITIONAL NOTES</p>
                <RichDisplay html={ra.additional_notes} />
              </div>
            )}
            {ra?.observations && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">OBSERVATIONS</p>
                <RichDisplay html={ra.observations} />
              </div>
            )}
            {!hasHeaderData(ra) && (
              <p className="text-sm text-slate-400 italic text-center py-6">No assessment summary set yet. Click Edit to add.</p>
            )}
          </div>
        )}
      </div>

      {/* FMEA Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-700">FMEA Rows</h2>
            <p className="text-xs text-slate-400">S=Severity · O=Occurrence · D=Detection · RPN=S×O×D</p>
          </div>
          <Button
            size="small"
            style={BTN_32}
            type="primary"
            icon={<Plus size={12} />}
            onClick={handleAddRow}
          >
            Add Row
          </Button>
        </div>

        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'No FMEA rows yet.' }}
        />

        {/* Add row inline form */}
        {addingRow && (
          <div className="border-t border-slate-100 p-4 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 mb-3">New Row</p>
            <Form
              form={rowForm}
              layout="vertical"
              onFinish={vals => addRowMut.mutate({ ...vals, sort_order: rows.length })}
            >
              <div className="grid grid-cols-2 gap-x-4">
                <Form.Item label="Process Step" name="process_step" rules={[{ required: true }]}>
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item label="Failure Mode" name="failure_mode" rules={[{ required: true }]}>
                  <Input.TextArea rows={2} />
                </Form.Item>
              </div>
              <div className="grid grid-cols-4 gap-x-4">
                <Form.Item label="Severity (1–10)" name="severity" rules={[{ required: true }]}>
                  <InputNumber min={1} max={10} className="w-full" />
                </Form.Item>
                <Form.Item label="Occurrence (1–10)" name="occurrence" rules={[{ required: true }]}>
                  <InputNumber min={1} max={10} className="w-full" />
                </Form.Item>
                <Form.Item label="Detection (1–10)" name="detection" rules={[{ required: true }]}>
                  <InputNumber min={1} max={10} className="w-full" />
                </Form.Item>
                <Form.Item label="Mitigation" name="mitigation">
                  <Input />
                </Form.Item>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="small" style={BTN_32} onClick={() => { setAddingRow(false); rowForm.resetFields() }}>
                  Cancel
                </Button>
                <Button size="small" style={BTN_32} type="primary" htmlType="submit" loading={addRowMut.isPending}>
                  Add
                </Button>
              </div>
            </Form>
          </div>
        )}
      </div>
    </div>
  )
}
