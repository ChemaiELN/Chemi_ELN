import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  Button, Empty, Table, Modal, Form, Input, Select, Radio, Checkbox,
  InputNumber, message, Dropdown,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { ArrowLeft, Plus, Pencil, Trash2, Send, CheckCircle2, RotateCcw, Copy, MoreVertical } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { checklistApi, type ChecklistDetail, type ChecklistItem } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { CHECKLIST_STATUS_LABEL, CHECKLIST_STATUS_COLOR } from './ChecklistsPage'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

const DATA_TYPES = ['OBSERVATION', 'TEXT', 'INPUT', 'SINGLE_SELECTION', 'MULTIPLE_SELECTION']
const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']
const label = (s: string) => s.replace(/_/g, ' ')
const freqLabel = (f: string) => ({ MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half Yearly', YEARLY: 'Yearly' }[f] ?? f)

// ── Item editor modal ─────────────────────────────────────────────────────────
function ItemModal({ open, onClose, onSaved, checklistId, editing }: {
  open: boolean; onClose: () => void; onSaved: () => void; checklistId: number; editing: ChecklistItem | null
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const instructionType = Form.useWatch('instruction_type', form)
  const dataType = Form.useWatch('data_type', form)

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        instruction_type: editing.instruction_type,
        data_type: editing.data_type ?? undefined,
        frequencies: editing.frequencies ?? [],
        precision: editing.precision ?? undefined,
        lower_limit: editing.lower_limit ?? undefined,
        upper_limit: editing.upper_limit ?? undefined,
        options: editing.options ?? [],
        details: editing.details ?? '',
      })
    } else {
      form.setFieldsValue({ instruction_type: 'INSTRUCTION', data_type: undefined, frequencies: [], options: [], details: '' })
    }
  }, [open, editing, form])

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      const isHeading = v.instruction_type === 'HEADING'
      const dt = isHeading ? undefined : (v.data_type as string | undefined)
      const isInput = dt === 'INPUT'
      const hasOptions = dt === 'SINGLE_SELECTION' || dt === 'MULTIPLE_SELECTION'
      const payload = {
        instruction_type: v.instruction_type,
        data_type: dt ?? null,
        frequencies: (v.frequencies as string[]) ?? [],
        precision: isInput ? v.precision ?? null : null,
        lower_limit: isInput ? v.lower_limit ?? null : null,
        upper_limit: isInput ? v.upper_limit ?? null : null,
        options: hasOptions ? ((v.options as string[]) ?? []).filter(Boolean) : null,
        details: v.details ?? null,
      }
      if (editing) await checklistApi.updateItem(editing.id, payload)
      else await checklistApi.addItem(checklistId, payload)
      message.success(editing ? 'Item updated' : 'Item added')
      onSaved(); onClose()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Checklist Details" open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} width={620} centered destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item name="instruction_type" label="Instruction Type" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio value="INSTRUCTION">Instruction</Radio>
            <Radio value="HEADING">Heading</Radio>
          </Radio.Group>
        </Form.Item>

        {instructionType === 'INSTRUCTION' && (
          <Form.Item name="data_type" label="Data Type" rules={[{ required: true, message: 'Select a data type' }]}>
            <Select placeholder="Select" options={DATA_TYPES.map(s => ({ value: s, label: label(s) }))} />
          </Form.Item>
        )}

        <Form.Item name="frequencies" label="Frequency">
          <Checkbox.Group options={FREQUENCIES.map(f => ({ value: f, label: freqLabel(f) }))} />
        </Form.Item>

        {instructionType === 'INSTRUCTION' && dataType === 'INPUT' && (
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="precision" label="Precision"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="lower_limit" label="Lower Limit"><InputNumber style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="upper_limit" label="Upper Limit"><InputNumber style={{ width: '100%' }} /></Form.Item>
          </div>
        )}

        {instructionType === 'INSTRUCTION' && (dataType === 'SINGLE_SELECTION' || dataType === 'MULTIPLE_SELECTION') && (
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <div className="mb-3">
                <p className="text-[13px] font-medium text-slate-600 mb-1">Options</p>
                {fields.map((field) => (
                  <div key={field.key} className="flex gap-2 mb-2">
                    <Form.Item {...field} noStyle rules={[{ required: true, message: 'Option required' }]}>
                      <Input placeholder={`Option ${field.name + 1}`} />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>Remove</Button>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<Plus size={13} />}>Add Option</Button>
              </div>
            )}
          </Form.List>
        )}

        <Form.Item name="details" label="Checklist Details" rules={[{ required: true }]}>
          <Input.TextArea rows={4} placeholder="Instruction / heading text…" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ── Workflow comment modal ────────────────────────────────────────────────────
function CommentModal({ open, title, onClose, onSubmit, saving }: {
  open: boolean; title: string; onClose: () => void; onSubmit: (comment: string) => void; saving: boolean
}) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.resetFields() }, [open, form])
  return (
    <Modal title={title} open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={(v) => onSubmit(v.comment ?? '')}>
        <Form.Item name="comment" label="Comments" rules={[{ required: true, message: 'Enter a comment' }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default function ChecklistBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  // Verify/Approve are QA-only — backend enforces this too; hiding the
  // buttons here just avoids a confusing 403 click for everyone else.
  const isQa = user?.department_code === 'QA'
  const [cl, setCl] = useState<ChecklistDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null)
  const [wf, setWf] = useState<null | 'submit' | 'verify' | 'approve' | 'reinitiate'>(null)
  const [wfSaving, setWfSaving] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    checklistApi.get(Number(id)).then(setCl).catch(e => message.error((e as Error).message)).finally(() => setLoading(false))
  }, [id])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-64"><BrandSpinner fullScreen={false} label="Loading checklist…" /></div>
  if (!cl) return <div className="p-6"><Empty description="Checklist not found" /></div>

  const isDraft = cl.status === 'DRAFT'

  const deleteItem = (item: ChecklistItem) => Modal.confirm({
    title: 'Delete this item?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await checklistApi.deleteItem(item.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const runWorkflow = async (comment: string) => {
    if (!wf) return
    setWfSaving(true)
    try {
      if (wf === 'submit') await checklistApi.submit(cl.id, { comment })
      else if (wf === 'verify') await checklistApi.verify(cl.id, { comment })
      else if (wf === 'approve') await checklistApi.approve(cl.id, { comment })
      else if (wf === 'reinitiate') await checklistApi.reinitiate(cl.id, { comment })
      message.success('Done')
      setWf(null); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setWfSaving(false) }
  }

  const newVersion = async () => {
    try { const nv = await checklistApi.newVersion(cl.id); message.success('New version created'); navigate(`/inventory/checklists/${nv.id}`) }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const itemColumns: ColumnsType<ChecklistItem> = [
    { title: 'Sl No', ellipsis: true, dataIndex: 'seq_no', width: 60, render: v => <span className="text-[13px] text-slate-500">{v}</span> },
    {
      title: 'Checklist Details', dataIndex: 'details', render: (v, r) => (
        <div>
          <span className={`text-[13px] ${r.instruction_type === 'HEADING' ? 'font-bold text-slate-800' : 'text-slate-700'}`}>{v}</span>
          {r.options && r.options.length > 0 && <div className="text-[12px] text-slate-400 mt-0.5">{r.options.join(', ')}</div>}
          {r.data_type === 'INPUT' && (r.lower_limit != null || r.upper_limit != null) && <div className="text-[12px] text-slate-400 mt-0.5">({r.lower_limit} to {r.upper_limit})</div>}
        </div>
      ),
    },
    { title: 'Data Type', ellipsis: true, dataIndex: 'data_type', width: 150, render: v => v ? <span className="text-[13px] text-slate-600">{label(v)}</span> : <span className="text-[13px] text-slate-600">NA</span> },
    { title: 'Frequencies', ellipsis: true, dataIndex: 'frequencies', width: 200, render: (v: string[] | null) => v && v.length ? <span className="text-[12px] text-slate-500">{v.map(freqLabel).join(', ')}</span> : <span className="text-[12px] text-slate-500">NA</span> },
    ...(isDraft ? [{
      title: 'Actions', key: 'actions', width: 60, align: 'right' as const, render: (_: unknown, r: ChecklistItem) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') { setEditingItem(r); setItemModal(true) }
          else if (key === 'delete') deleteItem(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    }] : []),
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/inventory/checklists')}>Back</Button> */}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{cl.name} <span className="text-slate-400 font-normal">({cl.version})</span></h1>
          <p className="text-slate-500 text-sm truncate">{label(cl.checklist_type)} · {label(cl.target_kind)} · {label(cl.log_type)}{cl.usage_type ? ` · ${cl.usage_type}` : ''}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusTag color={CHECKLIST_STATUS_COLOR[cl.status] ?? 'default'}>{CHECKLIST_STATUS_LABEL[cl.status] ?? cl.status}</StatusTag>
          {isDraft && <Button icon={<Plus size={14} />} onClick={() => { setEditingItem(null); setItemModal(true) }}>Add Item</Button>}
          {isDraft && <Button type="primary" icon={<Send size={14} />} onClick={() => setWf('submit')}>Submit</Button>}
          {cl.status === 'PENDING_VERIFICATION' && isQa && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => setWf('verify')}>Verify</Button>}
          {cl.status === 'PENDING_APPROVAL' && isQa && <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => setWf('approve')}>Approve</Button>}
          {(cl.status === 'PENDING_VERIFICATION' || cl.status === 'PENDING_APPROVAL') && <Button danger icon={<RotateCcw size={14} />} onClick={() => setWf('reinitiate')}>Re-Initiate</Button>}
          {cl.status === 'APPROVED' && <Button icon={<Copy size={14} />} onClick={newVersion}>Create New Version</Button>}
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={cl.items} columns={itemColumns} rowKey="id" size="middle" pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: 'No checklist items yet' }} />
      </div>

      {cl.approvals.length > 0 && (
        <div className="glass-card rounded-lg p-4">
          <p className="font-semibold text-sm text-slate-700 mb-2">Approval History</p>
          <div className="space-y-1.5">
            {cl.approvals.map(a => (
              <p key={a.id} className="text-[13px] text-slate-600">
                <span className="font-medium">{label(a.action)}</span> by <span className="font-medium">{a.performed_by}</span> on {dayjs(a.performed_at).format('DD/MM/YYYY HH:mm')}
                {a.comment ? <> — <span className="italic">{a.comment}</span></> : null}
              </p>
            ))}
          </div>
        </div>
      )}

      <ItemModal open={itemModal} onClose={() => setItemModal(false)} onSaved={load} checklistId={cl.id} editing={editingItem} />
      <CommentModal
        open={!!wf}
        title={wf === 'submit' ? 'Submit for Review' : wf === 'verify' ? 'Verify Checklist' : wf === 'approve' ? 'Approve Checklist' : 'Re-Initiate to Draft'}
        onClose={() => setWf(null)} onSubmit={runWorkflow} saving={wfSaving}
      />
    </div>
  )
}
