import { useEffect, useState, useCallback } from 'react'
import { Radio, Table, Button, Modal, Form, Select, InputNumber, message, Dropdown, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { Plus, Pencil, Trash2, Eye, MoreVertical } from 'lucide-react'
import { logMappingApi, checklistApi, type LogMapping, type Checklist, type ChecklistDetail, type ChecklistItem } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { EmptyValue, withEmptyValue } from '../../components/ui/EmptyValue'

type TargetKind = 'EQUIPMENT' | 'INSTRUMENT'

const LOG_TYPES: Record<TargetKind, { value: string; label: string }[]> = {
  EQUIPMENT: [{ value: 'MAINTENANCE', label: 'Maintenance Log' }, { value: 'CLEANING', label: 'Cleaning Log' }],
  // Instruments can need general maintenance in addition to calibration —
  // not just a calibration-only asset.
  INSTRUMENT: [{ value: 'CALIBRATION', label: 'Calibration Log' }, { value: 'MAINTENANCE', label: 'Maintenance Log' }],
}

const DATA_TYPE_COLOR: Record<string, string> = {
  TEXT: 'blue', NUMBER: 'purple', OPTIONS: 'orange', BOOLEAN: 'green', DATE: 'cyan',
}

const INSTRUCTION_TYPE_COLOR: Record<string, string> = {
  CHECKPOINT: 'volcano', INSTRUCTION: 'geekblue', OBSERVATION: 'gold',
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

  const [viewOpen, setViewOpen] = useState(false)
  const [viewDetail, setViewDetail] = useState<ChecklistDetail | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const targetParam = targetKind === 'EQUIPMENT' ? { equipment_id: targetId } : { instrument_id: targetId }

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await logMappingApi.list({ ...targetParam, log_type: logType })) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, logType, targetKind])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    // Show every approved checklist regardless of the target_kind it was
    // authored for — both Equipment and Instrument overview pages list all of
    // them here rather than filtering to just their own kind.
    checklistApi.list({ status: 'APPROVED', active_only: true }).then(setChecklists)
  }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: LogMapping) => {
    setEditing(r)
    form.setFieldsValue({ checklist_id: r.checklist_id, tolerance_days: r.tolerance_days, alert_limit: r.alert_limit, deviation_limit: r.deviation_limit })
    setModalOpen(true)
  }

  const openView = async (r: LogMapping) => {
    if (!r.checklist_id) return
    setViewDetail(null)
    setViewOpen(true)
    setViewLoading(true)
    try {
      const detail = await checklistApi.get(r.checklist_id)
      setViewDetail(detail)
    } catch { message.error('Failed to load checklist details') }
    finally { setViewLoading(false) }
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

  // Alert/Deviation Limit are calibration-tolerance concepts; Tolerance Days is
  // a maintenance/cleaning grace period. Gate on the mapping's actual log type,
  // not the target kind — an instrument's Maintenance Log mapping needs
  // Tolerance Days just like equipment's does.
  const isCalibration = logType === 'CALIBRATION'

  const itemColumns: ColumnsType<ChecklistItem> = [
    {
      title: '#',
      dataIndex: 'seq_no',
      width: 44,
      align: 'center',
      render: (v) => <span className="text-[12px] font-semibold text-slate-500">{v}</span>,
    },
    {
      title: 'Type',
      dataIndex: 'instruction_type',
      width: 130,
      render: (v: string) => (
        <Tag color={INSTRUCTION_TYPE_COLOR[v] ?? 'default'} style={{ whiteSpace: 'normal', fontSize: 11 }}>
          {v?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Details / Instruction',
      dataIndex: 'details',
      width: 260,
      render: (v: string | null) => (
        <span className="text-[13px] text-slate-800" style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {withEmptyValue(v)}
        </span>
      ),
    },
    {
      title: 'Data Type',
      dataIndex: 'data_type',
      width: 130,
      render: (v: string | null) => v
        ? <Tag color={DATA_TYPE_COLOR[v] ?? 'default'} style={{ whiteSpace: 'normal', fontSize: 11 }}>{v}</Tag>
        : <EmptyValue />,
    },
    {
      title: 'Options / Range',
      key: 'range',
      width: 200,
      render: (_, r) => {
        if (r.options?.length) {
          return (
            <span className="text-[12px] text-slate-600" style={{ wordBreak: 'break-word' }}>
              {r.options.join(' | ')}
            </span>
          )
        }
        if (r.lower_limit != null || r.upper_limit != null) {
          return (
            <span className="text-[12px] text-slate-600">
              {withEmptyValue(r.lower_limit)} – {withEmptyValue(r.upper_limit)}
              {r.precision != null ? <span className="text-slate-400"> (±{r.precision})</span> : null}
            </span>
          )
        }
        return <EmptyValue />
      },
    },
    {
      title: 'Frequency',
      dataIndex: 'frequencies',
      width: 160,
      render: (v: string[] | null) => v?.length
        ? (
          <div className="flex flex-wrap gap-1">
            {v.map(f => <Tag key={f} color="default" style={{ fontSize: 10, margin: 0 }}>{f}</Tag>)}
          </div>
        )
        : <EmptyValue />,
    },
  ]

  const columns: ColumnsType<LogMapping> = [
    {
      title: 'Checklist Name', ellipsis: true, dataIndex: 'checklist_name',
      render: (v, r) => v
        ? <span className="text-[13px] text-slate-800">{v} <span className="text-slate-400">({r.checklist_version})</span></span>
        : <span className="text-slate-800">NA</span>,
    },
    ...(isCalibration
      ? [
          { title: 'Alert Limit', ellipsis: true, dataIndex: 'alert_limit', width: 120, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
          { title: 'Deviation Limit', ellipsis: true, dataIndex: 'deviation_limit', width: 130, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
        ]
      : [
          { title: 'Tolerance Days', ellipsis: true, dataIndex: 'tolerance_days', width: 140, render: (v: number | null) => <span className="text-[13px] text-slate-600">{v ?? 'NA'}</span> },
        ]),
    {
      title: 'Actions', key: 'actions', width: 110, align: 'right',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'view', label: <span className="text-[12px]">View Checklist</span>, icon: <Eye size={12} /> },
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'remove', label: <span className="text-[12px]">Remove</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'view') openView(r)
          else if (key === 'edit') openEdit(r)
          else if (key === 'remove') del(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
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

      {/* Map / Edit Mapping Modal */}
      <Modal title={editing ? 'Edit Mapping' : 'Map Checklist'} open={modalOpen} closable={false}
        onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()}
        confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="checklist_id" label="Approved Checklist" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" placeholder="Select an approved checklist"
              options={checklists.map(c => ({ value: c.id, label: `${c.name} (${c.version})` }))} />
          </Form.Item>
          {isCalibration ? (
            <div className="grid grid-cols-2 gap-x-3">
              <Form.Item name="alert_limit" label="Alert Limit"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              <Form.Item name="deviation_limit" label="Deviation Limit"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
            </div>
          ) : (
            <Form.Item name="tolerance_days" label="Tolerance Days"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          )}
        </Form>
      </Modal>

      {/* Checklist Viewer Modal */}
      <Modal
        title={
          viewDetail
            ? <span className="text-slate-800 font-semibold">
                {viewDetail.name}
                <span className="ml-2 text-[12px] font-normal text-violet-600 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                  v{viewDetail.version}
                </span>
                <span className="ml-2 text-[12px] font-normal text-slate-400">{viewDetail.log_type?.replace(/_/g, ' ')}</span>
              </span>
            : 'Checklist Details'
        }
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={<Button onClick={() => setViewOpen(false)}>Close</Button>}
        width={900}
        centered
        closable={false}
        destroyOnHidden
        {...glassModalProps}
        styles={{
          ...glassModalStyles,
          body: { ...glassModalStyles.body, padding: '12px 22px 4px' },
        }}
      >
        {viewLoading ? (
          <div className="flex items-center justify-center py-12">
            <BrandSpinner fullScreen={false} label="Loading checklist details…" />
          </div>
        ) : viewDetail?.items?.length ? (
          <Table
            dataSource={[...viewDetail.items].sort((a, b) => a.seq_no - b.seq_no)}
            columns={itemColumns}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content', y: 420 }}
            className="checklist-view-table"
          />
        ) : (
          <p className="text-center text-slate-400 text-[13px] py-8">No items in this checklist.</p>
        )}
      </Modal>
    </div>
  )
}
