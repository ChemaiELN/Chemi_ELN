import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, Input, Select, Modal, Form, message, Space, Tooltip, Switch } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Search } from 'lucide-react'
import { checklistApi, type Checklist } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

export const CHECKLIST_TYPES = ['MAINTENANCE', 'EQUIPMENT_CLEANING', 'EQUIPMENT_CUSTOM', 'SCHEDULER', 'CALIBRATION']
export const LOG_TYPES = ['CHECKLIST', 'SPREADSHEET']
export const USAGE_TYPES = ['MFG', 'MAINT', 'PM', 'QC', 'COMMON']

export const CHECKLIST_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_VERIFICATION: 'Pending for Manager Review',
  PENDING_APPROVAL: 'Pending for QA Review',
  APPROVED: 'Approved',
}
export const CHECKLIST_STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', PENDING_VERIFICATION: 'gold', PENDING_APPROVAL: 'blue', APPROVED: 'green',
}

const label = (s: string) => s.replace(/_/g, ' ')

export default function ChecklistsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Checklist | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (typeFilter) params.checklist_type = typeFilter
      if (statusFilter) params.status = statusFilter
      setItems(await checklistApi.list(params))
    } finally { setLoading(false) }
  }, [search, typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: Checklist) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await checklistApi.update(editing.id, values)
        message.success('Checklist updated')
      } else {
        const created = await checklistApi.create(values)
        message.success('Checklist created')
        setModalOpen(false); form.resetFields()
        navigate(`/inventory/checklists/${created.id}`)
        return
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const toggle = async (r: Checklist) => {
    try { await checklistApi.toggle(r.id); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const columns: ColumnsType<Checklist> = [
    { title: 'Sl No', ellipsis: true, key: 'sl', width: 60, render: (_, __, i) => <span className="text-[13px] text-slate-500">{i + 1}</span> },
    { title: 'Checklist Name', ellipsis: true, dataIndex: 'name', render: (v, r) => <a className="text-[13px] text-violet-600 hover:text-violet-800 font-medium" onClick={() => navigate(`/inventory/checklists/${r.id}`)}>{v}</a> },
    { title: 'Version', ellipsis: true, dataIndex: 'version', width: 80, render: v => <span className="  text-[13px] text-slate-600">{v}</span> },
    { title: 'Checklist Type', ellipsis: true, dataIndex: 'checklist_type', width: 150, render: v => <span className="text-[13px] text-slate-700">{label(v)}</span> },
    { title: 'Log Type', ellipsis: true, dataIndex: 'log_type', width: 110, render: v => <span className="text-[13px] text-slate-600">{label(v)}</span> },
    { title: 'Target', ellipsis: true, dataIndex: 'target_kind', width: 110, render: v => <span className="text-[13px] text-slate-600">{label(v)}</span> },
    { title: 'Usage Type', ellipsis: true, dataIndex: 'usage_type', width: 100, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-[13px] text-slate-300">—</span> },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 200, render: v => <StatusTag color={CHECKLIST_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{CHECKLIST_STATUS_LABEL[v] ?? v}</StatusTag> },
    {
      title: 'Action', key: 'actions', width: 110, align: 'right', render: (_, r) => (
        <Space size={4}>
          <Tooltip title={r.status === 'DRAFT' ? 'Edit' : 'Only DRAFT can be edited'}>
            <Button type="text" size="small" icon={<Pencil size={13} />} disabled={r.status !== 'DRAFT'} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.is_active ? 'Active' : 'Inactive'}>
            <Switch size="small" checked={r.is_active} onChange={() => toggle(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Types" allowClear style={{ minWidth: 170 }} value={typeFilter} onChange={setTypeFilter} options={CHECKLIST_TYPES.map(s => ({ value: s, label: label(s) }))} />
        <Select placeholder="All Status" allowClear style={{ minWidth: 200 }} value={statusFilter} onChange={setStatusFilter} options={Object.keys(CHECKLIST_STATUS_LABEL).map(s => ({ value: s, label: CHECKLIST_STATUS_LABEL[s] }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">Add Checklist</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={items} columns={columns} rowKey="id" size="middle" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: t => `${t} items` }} />
      </div>

      <Modal title={editing ? 'Edit Checklist' : 'Add Checklist'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={520} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ log_type: 'CHECKLIST', target_kind: 'EQUIPMENT', usage_type: 'PM' }}>
          <Form.Item name="name" label="Checklist Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="checklist_type" label="Checklist Type" rules={[{ required: true }]}>
              <Select options={CHECKLIST_TYPES.map(s => ({ value: s, label: label(s) }))} />
            </Form.Item>
            <Form.Item name="target_kind" label="Applies To" rules={[{ required: true }]}>
              <Select options={[{ value: 'EQUIPMENT', label: 'Equipment' }, { value: 'INSTRUMENT', label: 'Instrument' }]} />
            </Form.Item>
            <Form.Item name="log_type" label="Log Type" rules={[{ required: true }]}>
              <Select options={LOG_TYPES.map(s => ({ value: s, label: label(s) }))} />
            </Form.Item>
            <Form.Item name="usage_type" label="Usage Type">
              <Select allowClear options={USAGE_TYPES.map(s => ({ value: s, label: s }))} />
            </Form.Item>
          </div>
          <Form.Item name="equipment_code" label="Equipment / Instrument Code (optional)"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
