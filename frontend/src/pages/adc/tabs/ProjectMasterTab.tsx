import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, Switch, Tag, message } from 'antd'
import { Save, Pencil, X } from 'lucide-react'
import { projectApi, materialApi, type Project } from '../../../api/adc'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'

interface Props { project: Project; projectId: string }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="text-sm font-medium text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

// Loads all materials for a given type on mount; supports local + remote search
function useMaterialSelect(materialType: string) {
  const [search, setSearch] = useState('')
  const { data = [], isFetching } = useQuery({
    queryKey: ['materials-by-type', materialType, search],
    queryFn:  () => materialApi.list({ material_type: materialType, search: search || undefined }),
    staleTime: 60_000,
  })
  const options = data.map(m => ({ value: m.name, label: `${m.name} (${m.code})` }))
  return { options, isFetching, setSearch }
}

const hasData = (p: Project) =>
  !!(p.adc_code || p.target_antigen || p.antibody_clone || p.payload || p.linker || p.target_dar || p.project_stage || p.remarks)

export default function ProjectMasterTab({ project, projectId }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(!hasData(project))
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      adc_code:           project.adc_code,
      target_antigen:     project.target_antigen,
      antibody_clone:     project.antibody_clone,
      payload:            project.payload,
      linker:             project.linker,
      target_dar:         project.target_dar,
      project_stage:      project.project_stage,
      qa_review_required: project.qa_review_required ?? false,
      remarks:            project.remarks,
    })
  }, [project, form])

  const antigen = useMaterialSelect('Antibody Materials')
  const payload = useMaterialSelect('Linker-Payload')
  const linker  = useMaterialSelect('Linker-Payload')

  const saveMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => projectApi.update(projectId, vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      message.success('Project Master saved')
      setEditing(false)
    },
  })

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-slate-700">ADC Project Details</h2>
          {editing ? (
            <div className="flex gap-2">
              <Button size="small" icon={<X size={13} />} onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="primary" size="small" icon={<Save size={13} />} loading={saveMut.isPending} onClick={() => form.submit()}>Save</Button>
            </div>
          ) : (
            <Button size="small" icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <Form form={form} layout="vertical" onFinish={vals => saveMut.mutate(vals)}>
            {/* Row 1: ADC Code + Target Antigen (Antibody material dropdown) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5">
              <Form.Item label="ADC Code" name="adc_code">
                <Input placeholder="e.g. ADC-001" />
              </Form.Item>
              <Form.Item label="Target Antigen" name="target_antigen">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select from Antibody materials…"
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onSearch={antigen.setSearch}
                  loading={antigen.isFetching}
                  options={antigen.options}
                  notFoundContent={antigen.isFetching ? 'Loading…' : 'No antibody materials found'}
                />
              </Form.Item>
            </div>

            {/* Row 2: Antibody Clone (text input) + Payload + Linker (Linker-Payload dropdowns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
              <Form.Item label="Antibody Clone" name="antibody_clone">
                <Input placeholder="e.g. Trastuzumab" />
              </Form.Item>
              <Form.Item label="Payload" name="payload">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select from Linker-Payload…"
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onSearch={payload.setSearch}
                  loading={payload.isFetching}
                  options={payload.options}
                  notFoundContent={payload.isFetching ? 'Loading…' : 'No linker-payload materials found'}
                />
              </Form.Item>
              <Form.Item label="Linker" name="linker">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select from Linker-Payload…"
                  filterOption={(input, opt) =>
                    String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  onSearch={linker.setSearch}
                  loading={linker.isFetching}
                  options={linker.options}
                  notFoundContent={linker.isFetching ? 'Loading…' : 'No linker-payload materials found'}
                />
              </Form.Item>
            </div>

            {/* Row 3: DAR + Stage + QA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
              <Form.Item label="Target DAR" name="target_dar">
                <Input placeholder="e.g. 4" />
              </Form.Item>
              <Form.Item label="Project Stage" name="project_stage">
                <Select allowClear placeholder="Select stage"
                  options={['Discovery','Pre-clinical','Phase I','Phase II','Phase III','Registration','Commercial'].map(v => ({ value: v, label: v }))} />
              </Form.Item>
              <Form.Item label="QA Review Required" name="qa_review_required" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>

            <Form.Item label="Remarks" name="remarks">
              <RichEditor placeholder="Any additional remarks…" minHeight={140} />
            </Form.Item>
          </Form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-4">
              <Field label="ADC Code"       value={project.adc_code} />
              <Field label="Target Antigen" value={project.target_antigen} />
              <Field label="Antibody Clone" value={project.antibody_clone} />
              <Field label="Payload"        value={project.payload} />
              <Field label="Linker"         value={project.linker} />
              <Field label="Target DAR"     value={project.target_dar} />
              <Field label="Project Stage"  value={project.project_stage} />
              <Field label="QA Review" value={
                project.qa_review_required == null ? null :
                <Tag color={project.qa_review_required ? 'green' : 'default'}>
                  {project.qa_review_required ? 'Required' : 'Not Required'}
                </Tag>
              } />
            </div>
            {project.remarks && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">REMARKS</p>
                <RichDisplay html={project.remarks} />
              </div>
            )}
            {!hasData(project) && (
              <p className="text-sm text-slate-400 italic text-center py-6">No ADC details set yet. Click Edit to add.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
