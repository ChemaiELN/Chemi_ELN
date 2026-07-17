import { useEffect, useState, useCallback } from 'react'
import { Radio, Table, Button, Modal, Form, Select, InputNumber, message, Space, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { logMappingApi, checklistApi, type LogMapping, type Checklist } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'

type TargetKind = 'EQUIPMENT' | 'INSTRUMENT'

const LOG_TYPES: Record<TargetKind, { value: string; label: string }[]> = {
  EQUIPMENT: [{ value: 'MAINTENANCE', label: 'Maintenance Log' }, { value: 'CLEANING', label: 'Cleaning Log' }],
  INSTRUMENT: [{ value: 'CALIBRATION', label: 'Calibration Log' }],
}

export default function LogMappingTab({ targetKind, targetId }: { targetKind: TargetKind; targetId: number }) {
  const types = LOG_TYPES[targetKind]
  const [logType, setLogType] = useState(types[0].value)
  const [rows, setRows] = useState<LogMapping[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LogMapping | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const targetParam = targetKind === 'EQUIPMENT' ? { equipment_id: targetId } : { instrument_id: targetId }

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await logMappingApi.list({ ...targetParam, log_type: logType })) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, logType, targetKind])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    checklistApi.list({ status: 'APPROVED', target_kind: targetKind, active_only: true }).then(setChecklists)
  }, [targetKind])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: LogMapping) => {
    setEditing(r)
    form.setFieldsValue({ checklist_id: r.checklist_id, tolerance_days: r.tolerance_days, alert_limit: r.alert_limit, deviation_limit: r.deviation_limit })
    setModalOpen(true)
  }

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await logMappingApi.update(editing.id, v)
        message.success('Mapping updated')
      } else {
        await logMappingApi.create({ ...targetParam, log_type: logType, ...v })
        message.success('Mapping created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const del = (r: LogMapping) => Modal.confirm({
    title: 'Remove this mapping?', okText: 'Remove', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles,
    onOk: async () => { try { await logMappingApi.delete(r.id); load() } catch (e: unknown) { message.error((e as Error).message) } },
  })

  const isInstrument = targetKind === 'INSTRUMENT'
  const columns: ColumnsType<LogMapping> = [
    { title: 'Checklist Name', ellipsis: true, dataIndex: 'checklist_name', render: (v, r) => v ? <span className="text-[13px] text-slate-800">{v} <span className="text-slate-400">({r.checklist_version})</span></span> : <span className="text-slate-800">NA</span> },
    ...(isInstrument
      ? [
          { title: 'Alert Limit', ellipsis: true, dataIndex: 'alert_limit', width: 120, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
          { title: 'Deviation Limit', ellipsis: true, dataIndex: 'deviation_limit', width: 130, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
        ]
      : [
          { title: 'Tolerance Days', ellipsis: true, dataIndex: 'tolerance_days', width: 140, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
        ]),
    {
      title: 'Actions', key: 'actions', width: 90, align: 'right', render: (_, r) => (
        <Space size={2}>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>
          <Tooltip title="Remove"><Button type="text" size="small" danger icon={<Trash2 size={13} />} onClick={() => del(r)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[13px] font-medium text-slate-600">Log Type:</span>
        <Radio.Group value={logType} onChange={e => setLogType(e.target.value)} optionType="button" buttonStyle="solid" options={types} />
        <Button className="ml-auto" type="primary" icon={<Plus size={14} />} onClick={openCreate} disabled={rows.length > 0}>Map Checklist</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table dataSource={rows} columns={columns} rowKey="id" size="small" loading={loading} pagination={false}
          locale={{ emptyText: 'No checklist mapped for this log type' }} />
      </div>

      <Modal title={editing ? 'Edit Mapping' : 'Map Checklist'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="checklist_id" label="Approved Checklist" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select an approved checklist"
              options={checklists.map(c => ({ value: c.id, label: `${c.name} (${c.version})` }))} />
          </Form.Item>
          {isInstrument ? (
            <div className="grid grid-cols-2 gap-x-3">
              <Form.Item name="alert_limit" label="Alert Limit"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              <Form.Item name="deviation_limit" label="Deviation Limit"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </div>
          ) : (
            <Form.Item name="tolerance_days" label="Tolerance Days"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
