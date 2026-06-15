import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Modal, Form, DatePicker,
  Popconfirm, message, Select, Space, Tooltip, Drawer,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { InstrumentCatalogue, InstrumentType } from '../types'
import {
  getInstrumentCatalogue, createInstrument, updateInstrument, toggleInstrument,
  getInstrumentTypes,
} from '@/api/inventoryApi'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '../components/shared/StatusTag'
import styles from './styles.module.less'

const ASSET_STATUSES  = ['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'UNDER_CALIBRATION', 'DECOMMISSIONED']
const SERVICE_STATUSES = ['OK', 'DUE', 'OVERDUE', 'EXPIRED']

export default function InstrumentCatalogueView() {
  const [rows,         setRows]         = useState<InstrumentCatalogue[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [calibFilter,  setCalibFilter]  = useState<string | undefined>()
  const [typeFilter,   setTypeFilter]   = useState<number | undefined>()
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [types, setTypes] = useState<InstrumentType[]>([])

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<InstrumentCatalogue | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow,  setDetailRow]  = useState<InstrumentCatalogue | null>(null)

  useEffect(() => { getInstrumentTypes({ is_active: true }).then(setTypes).catch(() => {}) }, [])

  const load = useCallback(() => {
    setLoading(true)
    getInstrumentCatalogue({
      search: search || undefined,
      status: statusFilter,
      calibration_status: calibFilter,
      instrument_type_id: typeFilter,
      is_active: activeFilter,
    })
      .then(setRows)
      .catch(() => message.error('Failed to load instrument catalogue'))
      .finally(() => setLoading(false))
  }, [search, statusFilter, calibFilter, typeFilter, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null); form.resetFields()
    form.setFieldsValue({ status: 'ACTIVE', calibration_status: 'OK', is_active: true })
    setModalOpen(true)
  }

  const openEdit = (row: InstrumentCatalogue) => {
    setEditTarget(row)
    form.setFieldsValue({
      ...row,
      purchase_date:          row.purchase_date          ? dayjs(row.purchase_date)          : undefined,
      last_calibration_date:  row.last_calibration_date  ? dayjs(row.last_calibration_date)  : undefined,
      calibration_due_date:   row.calibration_due_date   ? dayjs(row.calibration_due_date)   : undefined,
    } as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    let v: Record<string, unknown>
    try { v = await form.validateFields() } catch { return }
    const dateFmt = (k: string) => { if (v[k]) v[k] = (v[k] as ReturnType<typeof dayjs>).format('YYYY-MM-DD') }
    dateFmt('purchase_date'); dateFmt('last_calibration_date'); dateFmt('calibration_due_date')
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateInstrument(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Instrument updated')
      } else { await createInstrument(v); message.success('Instrument added'); load() }
      setModalOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleToggle = async (row: InstrumentCatalogue) => {
    try {
      const updated = await toggleInstrument(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(updated.is_active ? 'Activated' : 'Deactivated')
    } catch { message.error('Toggle failed') }
  }

  const openDetail = (row: InstrumentCatalogue) => { setDetailRow(row); setDetailOpen(true) }

  const columns: ColumnsType<InstrumentCatalogue> = [
    {
      title: 'Asset ID', dataIndex: 'asset_id', key: 'asset_id', width: 120, ellipsis: true,
      render: (v, row) => (
        <button type="button" className={styles.ellipsisLink} onClick={() => openDetail(row)}>
          <EllipsisCell text={v} className={styles.codeCell} />
        </button>
      ),
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 160, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmName} />,
    },
    {
      title: 'Type', dataIndex: 'instrument_type_name', key: 'instrument_type_name', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Model', dataIndex: 'model', key: 'model', width: 110, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Location', dataIndex: 'location', key: 'location', width: 100, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Calib. Status', dataIndex: 'calibration_status', key: 'calibration_status', width: 120,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Calib. Due', dataIndex: 'calibration_due_date', key: 'calibration_due_date', width: 110,
      render: v => v ? (
        <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#44403c', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      ) : <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 68, align: 'center',
      render: (v, row) => (
        <Popconfirm title={`${v ? 'Deactivate' : 'Activate'}?`} onConfirm={() => handleToggle(row)} okText="Yes">
          <Switch size="small" checked={v} />
        </Popconfirm>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 100, align: 'right',
      render: (_, row) => (
        <Space size={3}>
          <Tooltip title="Details">
            <Button size="small" icon={<InfoCircleOutlined />} className={styles.viewBtn} onClick={() => openDetail(row)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Instrument Catalogue</h2>
        <InventoryCountBadge count={rows.length} />
        <InventoryAddButton className={styles.masterPageTitleAction} onClick={openAdd}>
          Add Instrument
        </InventoryAddButton>
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search asset ID or name…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Type" allowClear style={{ width: 160 }}
              value={typeFilter} onChange={setTypeFilter}
              options={types.map(t => ({ value: t.id, label: t.name }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Calib. Status" allowClear style={{ width: 150 }}
              value={calibFilter} onChange={setCalibFilter}
              options={SERVICE_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Asset Status" allowClear style={{ width: 150 }}
              value={statusFilter} onChange={setStatusFilter}
              options={ASSET_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Active" allowClear style={{ width: 110 }}
              value={activeFilter} onChange={setActiveFilter}
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
        </div>
        <Table<InstrumentCatalogue> rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} assets` }}
          scroll={{ x: 1100 }}
        />
      </div>

      <Modal title={editTarget ? `Edit — ${editTarget.asset_id}` : 'Add Instrument'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Add'}
        confirmLoading={saving} width={600} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="asset_id" label="Asset ID" rules={[{ required: true }]}>
              <Input disabled={!!editTarget} placeholder="e.g. INS-2024-001" />
            </Form.Item>
            <Form.Item name="instrument_type_id" label="Instrument Type">
              <Select allowClear showSearch optionFilterProp="label"
                options={types.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="serial_no"    label="Serial No.">    <Input /></Form.Item>
            <Form.Item name="manufacturer" label="Manufacturer">  <Input /></Form.Item>
            <Form.Item name="model"        label="Model">          <Input /></Form.Item>
            <Form.Item name="location"     label="Location">       <Input /></Form.Item>
            <Form.Item name="purchase_date"        label="Purchase Date">       <DatePicker format="DD-MMM-YYYY" /></Form.Item>
            <Form.Item name="last_calibration_date" label="Last Calibration">   <DatePicker format="DD-MMM-YYYY" /></Form.Item>
            <Form.Item name="calibration_due_date"  label="Calibration Due">    <DatePicker format="DD-MMM-YYYY" /></Form.Item>
            <Form.Item name="calibration_status" label="Calibration Status">
              <Select options={SERVICE_STATUSES.map(s => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="status" label="Asset Status">
              <Select options={ASSET_STATUSES.map(s => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch size="small" /></Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title={detailRow ? `${detailRow.asset_id} — ${detailRow.name}` : 'Instrument Detail'}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={440}
      >
        {detailRow && (
          <>
            <div className={styles.drawerSection}>
              <h4>Asset Info</h4>
              <dl className={styles.kv}>
                <dt>Asset ID</dt>     <dd><span className={styles.codeCell}>{detailRow.asset_id}</span></dd>
                <dt>Type</dt>         <dd>{detailRow.instrument_type_name ?? '—'}</dd>
                <dt>Serial No.</dt>   <dd>{detailRow.serial_no ?? '—'}</dd>
                <dt>Manufacturer</dt> <dd>{detailRow.manufacturer ?? '—'}</dd>
                <dt>Model</dt>        <dd>{detailRow.model ?? '—'}</dd>
                <dt>Location</dt>     <dd>{detailRow.location ?? '—'}</dd>
                <dt>Purchase Date</dt><dd>{detailRow.purchase_date ? dayjs(detailRow.purchase_date).format('DD MMM YYYY') : '—'}</dd>
              </dl>
            </div>
            <div className={styles.drawerSection}>
              <h4>Calibration</h4>
              <dl className={styles.kv}>
                <dt>Status</dt>      <dd><StatusTag status={detailRow.calibration_status} /></dd>
                <dt>Last Date</dt>   <dd>{detailRow.last_calibration_date ? dayjs(detailRow.last_calibration_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Due Date</dt>    <dd>{detailRow.calibration_due_date  ? dayjs(detailRow.calibration_due_date).format('DD MMM YYYY')  : '—'}</dd>
              </dl>
            </div>
            <div className={styles.drawerSection}>
              <h4>Status</h4>
              <dl className={styles.kv}>
                <dt>Asset Status</dt><dd><StatusTag status={detailRow.status} /></dd>
                <dt>Active</dt>      <dd><StatusTag status={detailRow.is_active ? 'ACTIVE' : 'INACTIVE'} label={detailRow.is_active ? 'Yes' : 'No'} /></dd>
              </dl>
            </div>
            <Button size="small" icon={<EditOutlined />} className={styles.newBtn}
              onClick={() => { setDetailOpen(false); openEdit(detailRow) }}>
              Edit
            </Button>
          </>
        )}
      </Drawer>
    </div>
  )
}
