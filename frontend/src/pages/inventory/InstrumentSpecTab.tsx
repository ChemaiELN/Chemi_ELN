import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Modal, Form, Input, Select, message, Dropdown } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { Plus, Pencil, Trash2, MoreVertical } from 'lucide-react'
import {
  instrumentSpecDetailApi, uomApi,
  type InstrumentSpecDetail, type UomUnit,
} from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

// ── Specification Details (generic key/value/uom) ─────────────────────────────
function SpecDetails({ instrumentId }: { instrumentId: number }) {
  const [rows, setRows] = useState<InstrumentSpecDetail[]>([])
  const [massUnits, setMassUnits] = useState<UomUnit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<InstrumentSpecDetail | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await instrumentSpecDetailApi.list(instrumentId)) } finally { setLoading(false) }
  }, [instrumentId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    uomApi.get('mass').then(dim => setMassUnits(dim.units.filter(u => u.is_active))).catch(() => setMassUnits([]))
  }, [])

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await instrumentSpecDetailApi.update(editing.id, v)
      else await instrumentSpecDetailApi.create(instrumentId, v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }
  const del = (r: InstrumentSpecDetail) => Modal.confirm({
    title: 'Delete this specification?', okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await instrumentSpecDetailApi.delete(r.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const columns: ColumnsType<InstrumentSpecDetail> = [
    { title: 'Specification', dataIndex: 'specification', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Value', dataIndex: 'value', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-600">NA</span> },
    { title: 'UOM', dataIndex: 'uom', ellipsis: true, width: 120, render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <span className="text-slate-600">NA</span> },
    { title: 'Actions', key: 'a', width: 60, align: 'right', render: (_, r) => {
      const items: MenuProps['items'] = [
        { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
        { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
      ]
      const onMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (key === 'edit') { setEditing(r); form.setFieldsValue(r); setOpen(true) }
        else if (key === 'delete') del(r)
      }
      return (
        <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
          <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      )
    } },
  ]

  return (
    <div>
      <div className="flex items-center mb-2">
        <p className="font-semibold text-sm text-slate-700">Specification Details</p>
        <Button className="ml-auto" size="small" type="primary" icon={<Plus size={13} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={loading} pagination={false} locale={{ emptyText: 'No specifications' }} />
      </div>
      <Modal title={editing ? 'Edit Specification' : 'Add Specification'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="specification" label="Specification" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="value" label="Value"><Input /></Form.Item>
            <Form.Item name="uom" label="UOM">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select unit"
                options={massUnits.map(u => ({ value: u.symbol, label: `${u.name} (${u.symbol})` }))}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default function InstrumentSpecTab({ instrumentId }: { instrumentId: number }) {
  return (
    <div className="space-y-5">
      <SpecDetails instrumentId={instrumentId} />
    </div>
  )
}
