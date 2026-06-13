import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, DatePicker, Badge,
  Popconfirm, message, Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, CheckOutlined, StopOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { CalibrationSchedule, InstrumentCatalogue } from '../types'
import {
  getCalibrationSchedules, createCalibrationSchedule,
  updateCalibrationSchedule, completeCalibrationSchedule, cancelCalibrationSchedule,
  getInstrumentCatalogue,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

const CALIB_TYPES = ['Internal', 'External', 'OQ', 'IQ', 'PQ', 'Annual', 'Quarterly', 'Other']

export default function CalibrationSchedulesView() {
  const [rows,         setRows]         = useState<CalibrationSchedule[]>([])
  const [loading,      setLoading]      = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [instrFilter,  setInstrFilter]  = useState<number | undefined>()
  const [search,       setSearch]       = useState('')

  const [instruments, setInstruments] = useState<InstrumentCatalogue[]>([])

  const [formOpen,   setFormOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<CalibrationSchedule | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [form]                      = Form.useForm()

  const [completeOpen,   setCompleteOpen]   = useState(false)
  const [completeTarget, setCompleteTarget] = useState<CalibrationSchedule | null>(null)
  const [completeSaving, setCompleteSaving] = useState(false)
  const [completeForm]                      = Form.useForm()

  useEffect(() => {
    getInstrumentCatalogue({ is_active: true }).then(setInstruments).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getCalibrationSchedules({ instrument_id: instrFilter, status: statusFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.instrument_name?.toLowerCase().includes(q) ||
              r.instrument_asset_id?.toLowerCase().includes(q) ||
              r.calibration_type?.toLowerCase().includes(q) ||
              r.certificate_no?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load calibration schedules'))
      .finally(() => setLoading(false))
  }, [instrFilter, statusFilter, search])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    setSearch('')
    setInstrFilter(undefined)
    setStatusFilter(undefined)
  }

  const openCreate = () => {
    setEditTarget(null); form.resetFields(); setFormOpen(true)
  }

  const openEdit = (row: CalibrationSchedule) => {
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
        const updated = await updateCalibrationSchedule(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Schedule updated')
      } else {
        await createCalibrationSchedule(v); message.success('Schedule created'); load()
      }
      setFormOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Save failed') }
    finally { setFormSaving(false) }
  }

  const openComplete = (row: CalibrationSchedule) => {
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
      const updated = await completeCalibrationSchedule(completeTarget!.id, v)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Calibration marked as completed')
      setCompleteOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Complete failed') }
    finally { setCompleteSaving(false) }
  }

  const handleCancel = async (row: CalibrationSchedule) => {
    try {
      const updated = await cancelCalibrationSchedule(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Schedule cancelled')
    } catch { message.error('Cancel failed') }
  }

  const columns: ColumnsType<CalibrationSchedule> = [
    {
      title: 'Instrument', key: 'instrument', width: 180, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.instrument_name || r.instrument_asset_id
            ? [r.instrument_name, r.instrument_asset_id].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmName}
        />
      ),
    },
    {
      title: 'Type', dataIndex: 'calibration_type', key: 'calibration_type', width: 120, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Scheduled', dataIndex: 'scheduled_date', key: 'scheduled_date', width: 120,
      render: v => v ? (
        <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#44403c', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      ) : <span className={styles.dimCell}>—</span>,
      sorter: (a, b) => a.scheduled_date.localeCompare(b.scheduled_date),
    },
    {
      title: 'Technician', dataIndex: 'technician', key: 'technician', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Certificate No.', dataIndex: 'certificate_no', key: 'certificate_no', width: 140, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.codeCell} />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Completed', dataIndex: 'completed_date', key: 'completed_date', width: 110,
      render: v => v ? <span className={styles.batchSmCell}>{dayjs(v).format('DD MMM YYYY')}</span> : <span className={styles.dimCell}>—</span>,
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
        <h2 className={styles.sectionTitle}>Calibration Schedules</h2>
        <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search instrument, type or cert. no…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Instrument" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label"
              value={instrFilter} onChange={setInstrFilter}
              options={instruments.map(i => ({ value: i.id, label: `${i.asset_id} — ${i.name}` }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 140 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['DUE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openCreate}>
            Schedule Calibration
          </Button>
        </div>
        <Table<CalibrationSchedule>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} schedules` }}
          scroll={{ x: 960 }}
        />
      </div>

      <Modal title={editTarget ? 'Edit Calibration Schedule' : 'Schedule Calibration'}
        open={formOpen} onCancel={() => setFormOpen(false)}
        onOk={handleFormSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={formSaving} width={540} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="instrument_id" label="Instrument" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" disabled={!!editTarget}
              options={instruments.map(i => ({ value: i.id, label: `${i.asset_id} — ${i.name}` }))}
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="calibration_type" label="Calibration Type">
              <Select allowClear options={CALIB_TYPES.map(t => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="scheduled_date" label="Scheduled Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="technician" label="Technician">
              <Input />
            </Form.Item>
            <Form.Item name="certificate_no" label="Certificate No.">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Mark Calibration Complete"
        open={completeOpen} onCancel={() => setCompleteOpen(false)}
        onOk={handleComplete} okText="Complete"
        okButtonProps={{ style: { background: '#059669', borderColor: '#059669' } }}
        confirmLoading={completeSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {completeTarget && (
          <div className={styles.modalInfoBanner}>
            <strong>{completeTarget.instrument_asset_id}</strong> — {completeTarget.instrument_name}
            {completeTarget.calibration_type && <span className={styles.dimCell}> · {completeTarget.calibration_type}</span>}
          </div>
        )}
        <Form form={completeForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="completed_date" label="Completed Date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="certificate_no" label="Certificate No.">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Calibration findings, deviations…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
