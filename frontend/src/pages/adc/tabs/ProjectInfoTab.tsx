import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Select, DatePicker, Tag, message } from 'antd'
import { Save, Pencil, Plus } from 'lucide-react'
import dayjs from 'dayjs'
import { projectApi, departmentApi, type Project } from '../../../api/adc'
import { ApiError } from '../../../api/client'
import { BTN_32 } from '../../../utils/buttonSize'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'

interface Props { project: Project; projectId: string }

const PROJ_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green', ON_HOLD: 'orange', COMPLETED: 'blue', CANCELLED: 'red', ARCHIVED: 'default',
}
const STATUS_OPTIONS = Object.keys(PROJ_STATUS_COLOR)

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <div className="text-sm lg:text-base font-medium text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

export default function ProjectInfoTab({ project, projectId }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [obsEditing, setObsEditing] = useState(false)
  const [obsText, setObsText] = useState(project.observation ?? '')
  const [form] = Form.useForm()

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.list,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    setObsText(project.observation ?? '')
    form.setFieldsValue({
      name:          project.name,
      product_name:  project.product_name,
      project_type:  project.project_type,
      market:        project.market ?? project.customer,
      department_id: project.department_id ?? undefined,
      status:        project.status,
      start_date:    project.start_date  ? dayjs(project.start_date)  : null,
      target_date:   project.target_date ? dayjs(project.target_date) : null,
      description:   project.description,
      objective:     project.objective,
    })
  }, [project, form])

  const saveMut = useMutation({
    mutationFn: (vals: Record<string, unknown>) => projectApi.update(projectId, {
      ...vals,
      start_date:  vals.start_date  ? dayjs(vals.start_date as dayjs.Dayjs).format('YYYY-MM-DD')  : null,
      target_date: vals.target_date ? dayjs(vals.target_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      message.success('Project information saved')
      setEditing(false)
    },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to save project information'),
  })

  const saveObs = useMutation({
    mutationFn: () => projectApi.update(projectId, { observation: obsText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      setObsEditing(false)
      message.success('Observation saved')
    },
    onError: (e) => message.error(e instanceof ApiError ? e.detail : 'Failed to save observation'),
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-7">
      <div className="flex items-center justify-between mb-4 lg:mb-5">
        <h2 className="text-sm lg:text-base font-bold text-slate-700">Project Info</h2>
        {!editing && (
          <Button size="small" style={BTN_32} icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {editing ? (
        <Form form={form} layout="vertical" onFinish={vals => saveMut.mutate(vals)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5">
            <Form.Item label="Project Name" name="name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Omeprazole API Development" />
            </Form.Item>
            <Form.Item label="Product Name" name="product_name">
              <Input placeholder="e.g. Omeprazole" />
            </Form.Item>
            <Form.Item label="Type" name="project_type">
              <Select
                allowClear
                placeholder="Select type"
                options={[
                  { value: 'External', label: 'External' },
                  { value: 'Internal', label: 'Internal' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Market / Customer" name="market">
              <Input placeholder="e.g. Regulated Markets" />
            </Form.Item>
            <Form.Item label="Department" name="department_id">
              <Select
                allowClear
                showSearch
                placeholder="Select department"
                filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={departments.map(d => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
            <Form.Item label="Status" name="status">
              <Select options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item label="Start Date" name="start_date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item label="Target Date" name="target_date">
              <DatePicker className="w-full" />
            </Form.Item>
          </div>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional project description" />
          </Form.Item>
          <Form.Item label="Objective" name="objective">
            <Input.TextArea rows={3} placeholder="Describe the project objective…" />
          </Form.Item>
          <div className="flex gap-2 mt-2">
            <Button size="small" style={BTN_32} onClick={() => form.resetFields()}>Clear</Button>
            <Button type="primary" size="small" style={BTN_32} icon={<Save size={13} />} loading={saveMut.isPending} onClick={() => form.submit()}>Save</Button>
          </div>
        </Form>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-4 lg:gap-y-5">
            <Field label="CODE"        value={project.code} />
            <Field label="NAME"        value={project.name} />
            <Field label="PRODUCT"     value={project.product_name} />
            <Field label="TYPE"        value={project.project_type ? <Tag color={project.project_type === 'External' ? 'red' : 'cyan'}>{project.project_type}</Tag> : null} />
            <Field label="MARKET"      value={project.market || project.customer} />
            <Field label="DEPARTMENT"  value={project.department_name} />
            {/* <Field label="MANAGER"     value={project.manager_id ? '—' : '—'} /> */}
            <Field label="START DATE"  value={project.start_date ? dayjs(project.start_date).format('DD MMM YYYY') : null} />
            <Field label="TARGET DATE" value={project.target_date ? dayjs(project.target_date).format('DD MMM YYYY') : null} />
            <Field label="STATUS"      value={<Tag color={PROJ_STATUS_COLOR[project.status] ?? 'default'}>{project.status}</Tag>} />
          </div>

          {project.description && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">DESCRIPTION</p>
              <p className="text-sm lg:text-base text-slate-700">{project.description}</p>
            </div>
          )}

          {project.objective && (
            <div className="mt-3">
              <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">OBJECTIVE</p>
              <p className="text-sm lg:text-base text-slate-700">{project.objective}</p>
            </div>
          )}
        </>
      )}

      {/* Observation */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest mb-1">OBSERVATION</p>
        {obsEditing ? (
          <div className="space-y-2">
            <RichEditor
              value={obsText}
              onChange={setObsText}
              placeholder="Enter observation…"
              minHeight={100}
            />
            <div className="flex gap-2">
              <Button size="small" style={BTN_32} type="primary" loading={saveObs.isPending} onClick={() => saveObs.mutate()}>
                Save
              </Button>
              <Button size="small" style={BTN_32} onClick={() => { setObsEditing(false); setObsText(project.observation ?? '') }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {project.observation
              ? <RichDisplay html={project.observation} />
              : <p className="text-sm text-slate-400 italic">No observation set yet.</p>
            }
            <button
              onClick={() => setObsEditing(true)}
              className="mt-1.5 text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <Plus size={11} /> {project.observation ? 'Edit' : 'Add'} Observation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
