import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Modal, Form, Select, DatePicker, Checkbox, message, Dropdown, Tag, Tooltip } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, CheckCircle2, Trash2, MoreVertical } from 'lucide-react'
import dayjs from 'dayjs'
import { scheduleApi, type Schedule } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { StatusTag } from '../../components/ui/StatusTag'

type TargetKind = 'EQUIPMENT' | 'INSTRUMENT'
type LogType = 'MAINTENANCE' | 'CLEANING' | 'CALIBRATION'

const SCHEDULE_TYPE_COLOR: Record<string, string> = {
  MONTHLY: 'blue', QUARTERLY: 'green', HALF_YEARLY: 'orange', YEARLY: 'red',
}

// inv_schedules.status vocabulary (see backend schedules.py).
const STATUS_COLOR: Record<string, string> = {
  DONE: 'green', DUE: 'orange', PLANNED: 'blue', CANCELLED: 'default',
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const SCHEDULE_TYPES = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half Yearly' },
  { value: 'YEARLY', label: 'Yearly' },
]

interface Props {
  targetKind: TargetKind
  targetId: number
  logType: LogType
  /** The asset's own Next Maintenance/Calibration Date (whichever matches
   * `logType`), used to auto-populate Due Date on the New Schedule form. */
  assetNextDueDate?: string | null
}

export default function ScheduleTab({ targetKind, targetId, logType, assetNextDueDate }: Props) {
  const [rows, setRows] = useState<Schedule[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [sortBy, setSortBy] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm] = Form.useForm()

  const [completeOpen, setCompleteOpen] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<Schedule | null>(null)
  const [completeForm] = Form.useForm()

  const targetParam = targetKind === 'EQUIPMENT'
    ? { equipment_id: targetId }
    : { instrument_id: targetId }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items, total } = await scheduleApi.listPaged({
        ...targetParam,
        log_type: logType,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
      })
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [targetId, targetKind, logType, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])

  const openComplete = (r: Schedule) => {
    setCompleteTarget(r)
    completeForm.resetFields()
    completeForm.setFieldsValue({ done_on: dayjs(), generate_next: true })
    setCompleteOpen(true)
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreating(true)
    try {
      // checklist_id is NOT sent — the backend always resolves it from this
      // asset's Log Mapping for the log type, so it can't be silently skipped
      // by leaving a form field blank (see schedules.routes.ts POST /).
      await scheduleApi.create({
        ...targetParam,
        log_type: logType,
        target_kind: targetKind,
        schedule_type: values.schedule_type,
        due_date: dayjs(values.due_date as dayjs.Dayjs).format('YYYY-MM-DD'),
        planned_date: values.planned_date ? dayjs(values.planned_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
      })
      message.success('Schedule created')
      setCreateOpen(false)
      createForm.resetFields()
      setPage(1)
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setCreating(false) }
  }

  const handleComplete = async (values: Record<string, unknown>) => {
    if (!completeTarget) return
    setCompleting(true)
    try {
      await scheduleApi.complete(completeTarget.id, {
        done_on: dayjs(values.done_on as dayjs.Dayjs).format('YYYY-MM-DD'),
        generate_next: values.generate_next as boolean,
      })
      message.success('Schedule marked complete')
      setCompleteOpen(false)
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setCompleting(false) }
  }

  const handleDelete = (r: Schedule) => Modal.confirm({
    title: 'Delete this schedule entry?',
    okText: 'Delete',
    okButtonProps: { danger: true },
    centered: true,
    styles: glassModalStyles,
    onOk: async () => {
      try { await scheduleApi.delete(r.id); load() }
      catch (e: unknown) { message.error((e as Error).message) }
    },
  })

  const columns: ColumnsType<Schedule> = [
    {
      title: 'Schedule Type',
      dataIndex: 'schedule_type',
      width: 140,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{titleCase(v)}</span>,
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      width: 110,
      sorter: true,
      render: (v: string) => v ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span> : <EmptyValue />,
    },
    {
      title: 'Planned Date',
      dataIndex: 'planned_date',
      width: 120,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      sorter: true,
      // r.status is the SCHEDULE's status; r.current_status is the asset's own
      // status (AVAILABLE / IN_USE / …) — a different vocabulary, so don't mix them.
      render: (_, r) => {
        const tag = (
          <StatusTag color={STATUS_COLOR[r.status] ?? 'default'} className="text-[13px] w-fit">
            {r.status?.replace(/_/g, ' ')}
          </StatusTag>
        )
        return r.days_label ? <Tooltip title={r.days_label}>{tag}</Tooltip> : tag
      },
    },
    {
      title: 'Done On',
      dataIndex: 'done_on',
      width: 110,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{dayjs(v).format('DD/MM/YYYY')}</span>
        : <EmptyValue />,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      width: 90,
      render: (v: string) => <span className="text-[12px] text-slate-500">{titleCase(v)}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      align: 'center',
      render: (_, r) => {
        // Only checklist-less schedules may be completed directly. Anything with
        // a checklist must run through a work order so the observations and the
        // Verified/Approved e-signatures are captured — the backend enforces this
        // too, so an enabled item here would just surface a 409.
        const items: MenuProps['items'] = [
          ...(r.status !== 'DONE'
            ? [{
                key: 'complete',
                label: <span className="text-[12px]">{r.checklist_id ? 'Has a checklist — complete via a work order' : 'Mark Complete'}</span>,
                icon: <CheckCircle2 size={12} />,
                disabled: !!r.checklist_id,
              }]
            : []),
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'complete') openComplete(r)
          else if (key === 'delete') handleDelete(r)
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
      <div className="flex items-center justify-end">
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => {
            createForm.resetFields()
            createForm.setFieldsValue({ due_date: assetNextDueDate ? dayjs(assetNextDueDate) : undefined })
            setCreateOpen(true)
          }}
        >
          New Schedule
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: t => `${t} schedules`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<Schedule>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy('due_date')
              setSortDir('asc')
            }
          }}
          locale={{ emptyText: `No ${logType.toLowerCase()} schedules found` }}
        />
      </div>

      {/* Create Schedule Modal */}
      <Modal
        title="New Schedule"
        open={createOpen}
        closable={false}
        onCancel={() => { setCreateOpen(false); createForm.resetFields() }}
        onOk={() => createForm.submit()}
        okText="Schedule"
        confirmLoading={creating}
        width={480}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="schedule_type" label="Schedule Type" rules={[{ required: true }]}>
            <Select options={SCHEDULE_TYPES} placeholder="Select frequency" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="due_date" label="Due Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" disabled />
            </Form.Item>
            <Form.Item name="planned_date" label="Planned Date">
              <DatePicker
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                onChange={(v) => createForm.setFieldsValue({
                  due_date: v ?? (assetNextDueDate ? dayjs(assetNextDueDate) : undefined),
                })}
              />
            </Form.Item>
          </div>
          <p className="text-[12px] text-slate-400">
            Due Date follows this asset's Next Maintenance/Calibration Date automatically — set a Planned Date to use that date instead.
            If this asset has a checklist mapped for this log type (see the Log Mapping tab), it's attached to
            the schedule automatically — completing it will then require a work order instead of a direct Mark Complete.
          </p>
        </Form>
      </Modal>

      {/* Complete Schedule Modal */}
      <Modal
        title={
          <span>
            Mark Complete —{' '}
            <Tag color={SCHEDULE_TYPE_COLOR[completeTarget?.schedule_type ?? ''] ?? 'default'} className="text-[11px]">
              {completeTarget?.schedule_type?.replace(/_/g, ' ')}
            </Tag>
            <span className="text-slate-400 text-[13px] ml-1">
              Due {completeTarget?.due_date ? dayjs(completeTarget.due_date).format('DD/MM/YYYY') : ''}
            </span>
          </span>
        }
        open={completeOpen}
        closable={false}
        onCancel={() => { setCompleteOpen(false); completeForm.resetFields() }}
        onOk={() => completeForm.submit()}
        confirmLoading={completing}
        width={400}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
          <Form.Item name="done_on" label="Done On" rules={[{ required: true }]}>
            {/* Backend rejects a future done_on — mirror that here. */}
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(current) => current && current.isAfter(dayjs().endOf('day'))}
            />
          </Form.Item>
          <Form.Item name="generate_next" valuePropName="checked">
            <Checkbox>Auto-generate next occurrence</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
