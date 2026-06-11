import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Tag, Modal, Form, DatePicker, Badge,
  Popconfirm, message, Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, CheckOutlined, StopOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { MaintenanceSchedule, EquipmentCatalogue } from '../types'
import {
  getMaintenanceSchedules, createMaintenanceSchedule,
  updateMaintenanceSchedule, completeMaintenanceSchedule, cancelMaintenanceSchedule,
  getEquipmentCatalogue,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import styles from './styles.module.less'

const STATUS_COLOR: Record<string, string> = {
  DUE:         'orange',
  IN_PROGRESS: 'processing',
  COMPLETED:   'green',
  CANCELLED:   'default',
}

const MAINT_TYPES = ['Preventive', 'Corrective', 'Predictive', 'Annual', 'Quarterly', 'Monthly', 'Other']

export default function MaintenanceSchedulesView() {
  const [rows,         setRows]         = useState<MaintenanceSchedule[]>([])
  const [loading,      setLoading]      = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [equipFilter,  setEquipFilter]  = useState<number | undefined>()
  const [search,       setSearch]       = useState('')

  const [equipment, setEquipment] = useState<EquipmentCatalogue[]>([])

  // Create / Edit modal
  const [formOpen,   setFormOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<MaintenanceSchedule | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [form]                      = Form.useForm()

  // Complete modal
  const [completeOpen,   setCompleteOpen]   = useState(false)
  const [completeTarget, setCompleteTarget] = useState<MaintenanceSchedule | null>(null)
  const [completeSaving, setCompleteSaving] = useState(false)
  const [completeForm]                      = Form.useForm()

  useEffect(() => {
    getEquipmentCatalogue({ is_active: true })
      .then(setEquipment)
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getMaintenanceSchedules({ equipment_id: equipFilter, status: statusFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.equipment_name?.toLowerCase().includes(q) ||
              r.equipment_asset_id?.toLowerCase().includes(q) ||
              r.maintenance_type?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load maintenance schedules'))
      .finally(() => setLoading(false))
  }, [equipFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    setSearch('')
    setEquipFilter(undefined)
    setStatusFilter(undefined)
  }

  // ── Create / Edit ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    setFormOpen(true)
  }

  const openEdit = (row: MaintenanceSchedule) => {
    setEditTarget(row)
    form.setFieldsValue({
      ...row,
      scheduled_date: row.scheduled_date ? dayjs(row.scheduled_date) : undefined,
    } as Record<string, unknown>)
    setFormOpen(true)
  }

  const handleFormSave = async () => {
    let v: Record<string, unknown>
    try { v = await form.validateFields() } catch { return }
    if (v.scheduled_date) v.scheduled_date = (v.scheduled_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    setFormSaving(true)
    try {
      if (editTarget) {
        const updated = await updateMaintenanceSchedule(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Schedule updated')
      } else {
        await createMaintenanceSchedule(v)
        message.success('Schedule created')
        load()
      }
      setFormOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally { setFormSaving(false) }
  }

  // ── Complete ─────────────────────────────────────────────────────────────

  const openComplete = (row: MaintenanceSchedule) => {
    setCompleteTarget(row)
    completeForm.resetFields()
    completeForm.setFieldValue('completed_date', dayjs())
    setCompleteOpen(true)
  }

  const handleComplete = async () => {
    let v: Record<string, unknown>
    try { v = await completeForm.validateFields() } catch { return }
    v.completed_date = (v.completed_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    setCompleteSaving(true)
    try {
      const updated = await completeMaintenanceSchedule(completeTarget!.id, v)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Maintenance marked as completed')
      setCompleteOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Complete failed')
    } finally { setCompleteSaving(false) }
  }

  // ── Cancel ───────────────────────────────────────────────────────────────

  const handleCancel = async (row: MaintenanceSchedule) => {
    try {
      const updated = await cancelMaintenanceSchedule(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Schedule cancelled')
    } catch { message.error('Cancel failed') }
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<MaintenanceSchedule> = [
    {
      title: 'Equipment', key: 'equipment', width: 180, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.equipment_name || r.equipment_asset_id
            ? [r.equipment_name, r.equipment_asset_id].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmName}
        />
      ),
    },
    {
      title: 'Type', dataIndex: 'maintenance_type', key: 'maintenance_type', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Scheduled', dataIndex: 'scheduled_date', key: 'scheduled_date', width: 120,
      render: v => v ? (
        <span className={styles.batchSmCell} style={{
          color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#44403c',
          fontWeight: 500,
        }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      ) : <span className={styles.dimCell}>—</span>,
      sorter: (a, b) => a.scheduled_date.localeCompare(b.scheduled_date),
    },
    {
      title: 'Technician', dataIndex: 'technician', key: 'technician', width: 140, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: v => <Tag color={STATUS_COLOR[v] ?? 'default'} className={styles.statusTag}>{v}</Tag>,
    },
    {
      title: 'Completed', dataIndex: 'completed_date', key: 'completed_date', width: 120,
      render: v => v ? <span className={styles.batchSmCell}>{dayjs(v).format('DD MMM YYYY')}</span> : <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Actions', key: 'actions', width: 120, align: 'right',
      render: (_, row) => (
        <Space size={3}>
          {(row.status === 'DUE' || row.status === 'IN_PROGRESS') && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
              </Tooltip>
              <Tooltip title="Mark Complete">
                <Button size="small" icon={<CheckOutlined />} className={styles.viewBtnSuccess}
                  onClick={() => openComplete(row)}
                />
              </Tooltip>
              <Popconfirm title="Cancel this schedule?" onConfirm={() => handleCancel(row)} okText="Yes">
                <Tooltip title="Cancel">
                  <Button size="small" icon={<StopOutlined />} className={styles.viewBtn} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Maintenance Schedules</h2>
        <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search equipment or type…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Equipment" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label"
              value={equipFilter} onChange={setEquipFilter}
              options={equipment.map(e => ({ value: e.id, label: `${e.asset_id} — ${e.name}` }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 140 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['DUE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openCreate}>
            Schedule Maintenance
          </Button>
        </div>
        <Table<MaintenanceSchedule>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} schedules` }}
          scroll={{ x: 920 }}
        />
      </div>

      <Modal
        title={editTarget ? 'Edit Maintenance Schedule' : 'Schedule Maintenance'}
        open={formOpen} onCancel={() => setFormOpen(false)}
        onOk={handleFormSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={formSaving} width={520} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" disabled={!!editTarget}
              options={equipment.map(e => ({ value: e.id, label: `${e.asset_id} — ${e.name}` }))}
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="maintenance_type" label="Maintenance Type">
              <Select allowClear options={MAINT_TYPES.map(t => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="technician" label="Technician" style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Mark Maintenance Complete"
        open={completeOpen} onCancel={() => setCompleteOpen(false)}
        onOk={handleComplete} okText="Complete"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
        confirmLoading={completeSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {completeTarget && (
          <div className={styles.modalInfoBanner}>
            <strong>{completeTarget.equipment_asset_id}</strong> — {completeTarget.equipment_name}
            {completeTarget.maintenance_type && <span className={styles.dimCell}> · {completeTarget.maintenance_type}</span>}
          </div>
        )}
        <Form form={completeForm} layout="vertical" requiredMark={false}>
          <Form.Item name="completed_date" label="Completed Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Completion notes, findings…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
