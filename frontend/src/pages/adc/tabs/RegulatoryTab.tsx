import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Select, Tag, message } from 'antd'
import { Save, Pencil } from 'lucide-react'
import { projectApi, type Project } from '../../../api/adc'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import { BTN_32 } from '../../../utils/buttonSize'

interface Props { project: Project; projectId: string }

const OEL_BANDS   = ['OEB 1 (>10 mg/m³)', 'OEB 2 (1–10 mg/m³)', 'OEB 3 (0.1–1 mg/m³)', 'OEB 4 (0.01–0.1 mg/m³)', 'OEB 5 (<0.01 mg/m³)']
const CONTAINMENT = ['Open Handling', 'Level 1 Containment', 'Level 2 Containment', 'Level 3 Containment', 'Isolator']

const GMP_COLOR: Record<string, string> = { GMP: 'green', 'Non-GMP': 'orange', Both: 'blue' }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="text-sm font-medium text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

const hasData = (p: Project) =>
  !!(p.oel_band || p.containment_category || p.gmp_non_gmp || p.regulatory_observations)

export default function RegulatoryTab({ project, projectId }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(!hasData(project))
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      oel_band:                project.oel_band,
      containment_category:    project.containment_category,
      gmp_non_gmp:             project.gmp_non_gmp,
      regulatory_observations: project.regulatory_observations ?? '',
    })
  }, [project, form])

  const saveMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => projectApi.update(projectId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      message.success('Regulatory Classification saved')
      setEditing(false)
    },
  })

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-700">Regulatory Classification</h2>
          {!editing && (
            <Button size="small" style={BTN_32} icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <Form form={form} layout="vertical" onFinish={vals => saveMut.mutate(vals)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
              <Form.Item label="OEL Band" name="oel_band">
                <Select allowClear placeholder="Select OEL Band"
                  options={OEL_BANDS.map(v => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item label="Containment Category" name="containment_category">
                <Select allowClear placeholder="Select containment"
                  options={CONTAINMENT.map(v => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item label="GMP / Non-GMP" name="gmp_non_gmp">
                <Select allowClear placeholder="Select"
                  options={[
                    { value: 'GMP',     label: 'GMP' },
                    { value: 'Non-GMP', label: 'Non-GMP' },
                    { value: 'Both',    label: 'Both' },
                  ]} />
              </Form.Item>
            </div>
            <Form.Item label="Observations" name="regulatory_observations">
              <RichEditor placeholder="Regulatory observations…" minHeight={140} />
            </Form.Item>
            <div className="flex gap-2 mt-2">
              <Button size="small" style={BTN_32} onClick={() => form.resetFields()}>Clear</Button>
              <Button type="primary" size="small" style={BTN_32} icon={<Save size={13} />} loading={saveMut.isPending} onClick={() => form.submit()}>Save</Button>
            </div>
          </Form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
              <Field label="OEL Band" value={project.oel_band} />
              <Field label="Containment Category" value={project.containment_category} />
              <Field label="GMP / Non-GMP" value={
                project.gmp_non_gmp
                  ? <Tag color={GMP_COLOR[project.gmp_non_gmp] ?? 'default'}>{project.gmp_non_gmp}</Tag>
                  : null
              } />
            </div>
            {project.regulatory_observations && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">OBSERVATIONS</p>
                <RichDisplay html={project.regulatory_observations} />
              </div>
            )}
            {!hasData(project) && (
              <p className="text-sm text-slate-400 italic text-center py-6">No regulatory data set yet. Click Edit to add.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
