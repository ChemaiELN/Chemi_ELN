import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Tag, Modal, Form, InputNumber, Badge,
  Popconfirm, message, Select, Space, Tooltip, Switch, DatePicker,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, SearchOutlined,
  ArrowDownOutlined, AppstoreOutlined, HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Batch, Material, Manufacturer } from '../types'
import {
  getBatches, createBatch, updateBatch, toggleBatch,
  issueBatch, allocateBatch,
  getMaterials, getManufacturers,
} from '@/api/inventoryApi'
import BatchEventsDrawer from '../components/shared/BatchEventsDrawer'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '../components/shared/StatusTag'
import styles from './styles.module.less'

// ─── helpers ─────────────────────────────────────────────────────────────────

function expiryColor(dateStr?: string | null): string {
  if (!dateStr) return ''
  const d = dayjs(dateStr)
  const diff = d.diff(dayjs(), 'day')
  if (diff < 0)  return '#e11d48'
  if (diff < 30) return '#d97706'
  if (diff < 90) return '#0d9488'
  return '#44403c'
}

const UNITS = ['g', 'mg', 'kg', 'mL', 'L', 'units', 'vials', 'pcs', 'µg', 'µL']

// ─── component ───────────────────────────────────────────────────────────────

export default function BatchesAvailableView() {
  const [rows,     setRows]     = useState<Batch[]>([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [matFilter, setMatFilter] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const [materials,     setMaterials]     = useState<Material[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])

  // Receive (create) modal
  const [recvOpen,  setRecvOpen]  = useState(false)
  const [recvSaving, setRecvSaving] = useState(false)
  const [recvForm]                  = Form.useForm()

  // Edit modal
  const [editOpen,   setEditOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Batch | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm]                  = Form.useForm()

  // Issue modal
  const [issueOpen,   setIssueOpen]   = useState(false)
  const [issueTarget, setIssueTarget] = useState<Batch | null>(null)
  const [issueSaving, setIssueSaving] = useState(false)
  const [issueForm]                   = Form.useForm()

  // Allocate modal
  const [allocOpen,   setAllocOpen]   = useState(false)
  const [allocTarget, setAllocTarget] = useState<Batch | null>(null)
  const [allocSaving, setAllocSaving] = useState(false)
  const [allocForm]                   = Form.useForm()

  // Events drawer
  const [eventsOpen,   setEventsOpen]   = useState(false)
  const [eventsBatchId, setEventsBatchId] = useState<number | null>(null)
  const [eventsBatchNo, setEventsBatchNo] = useState('')

  // Load lookups once
  useEffect(() => {
    getMaterials({ is_active: true }).then(setMaterials).catch(() => {})
    getManufacturers({ is_active: true }).then(setManufacturers).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getBatches({ category: 'available', search: search || undefined, material_id: matFilter, status: statusFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load batches'))
      .finally(() => setLoading(false))
  }, [search, matFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleClear = () => { setSearch(''); setMatFilter(undefined); setStatusFilter(undefined) }

  // ── Receive ──────────────────────────────────────────────────────────────────

  const openReceive = () => {
    recvForm.resetFields()
    setRecvOpen(true)
  }

  const handleReceive = async () => {
    let v: Record<string, unknown>
    try { v = await recvForm.validateFields() } catch { return }
    // Convert DatePicker values to ISO date strings
    if (v.mfg_date)    v.mfg_date    = (v.mfg_date    as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    if (v.expiry_date) v.expiry_date = (v.expiry_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    if (v.retest_date) v.retest_date = (v.retest_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    // qty_available defaults to qty_received on creation
    if (v.qty_received) v.qty_available = v.qty_received
    setRecvSaving(true)
    try {
      await createBatch(v)
      message.success('Batch received')
      setRecvOpen(false)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to receive batch')
    } finally {
      setRecvSaving(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const openEdit = (row: Batch) => {
    setEditTarget(row)
    editForm.setFieldsValue({
      ...row,
      mfg_date:    row.mfg_date    ? dayjs(row.mfg_date)    : undefined,
      expiry_date: row.expiry_date ? dayjs(row.expiry_date) : undefined,
      retest_date: row.retest_date ? dayjs(row.retest_date) : undefined,
    } as Record<string, unknown>)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    let v: Record<string, unknown>
    try { v = await editForm.validateFields() } catch { return }
    if (v.mfg_date)    v.mfg_date    = (v.mfg_date    as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    if (v.expiry_date) v.expiry_date = (v.expiry_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    if (v.retest_date) v.retest_date = (v.retest_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    setEditSaving(true)
    try {
      const updated = await updateBatch(editTarget!.id, v)
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      message.success('Batch updated')
      setEditOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  // ── Issue ────────────────────────────────────────────────────────────────────

  const openIssue = (row: Batch) => {
    setIssueTarget(row)
    issueForm.resetFields()
    setIssueOpen(true)
  }

  const handleIssue = async () => {
    let v: Record<string, unknown>
    try { v = await issueForm.validateFields() } catch { return }
    setIssueSaving(true)
    try {
      const updated = await issueBatch(issueTarget!.id, v)
      setRows(prev => prev
        .map(r => r.id === updated.id ? { ...r, ...updated } : r)
        .filter(r => r.category === 'available')
      )
      message.success('Batch issued')
      setIssueOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Issue failed')
    } finally {
      setIssueSaving(false)
    }
  }

  // ── Allocate ─────────────────────────────────────────────────────────────────

  const openAllocate = (row: Batch) => {
    setAllocTarget(row)
    allocForm.resetFields()
    setAllocOpen(true)
  }

  const handleAllocate = async () => {
    let v: Record<string, unknown>
    try { v = await allocForm.validateFields() } catch { return }
    setAllocSaving(true)
    try {
      const updated = await allocateBatch(allocTarget!.id, v)
      setRows(prev => prev
        .map(r => r.id === updated.id ? { ...r, ...updated } : r)
        .filter(r => r.category === 'available')
      )
      message.success('Qty allocated')
      setAllocOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Allocate failed')
    } finally {
      setAllocSaving(false)
    }
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────

  const handleToggle = async (row: Batch) => {
    try {
      const updated = await toggleBatch(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      message.success(`Batch ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch {
      message.error('Toggle failed')
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  const openEvents = (row: Batch) => {
    setEventsBatchId(row.id)
    setEventsBatchNo(row.batch_no)
    setEventsOpen(true)
  }

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<Batch> = [
    {
      title: 'Batch No.', dataIndex: 'batch_no', key: 'batch_no', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.codeCell} />,
    },
    {
      title: 'Material', key: 'material', width: 200, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.material_name ? [r.material_name, r.material_code].filter(Boolean).join(' · ') : null}
          className={styles.batchSmName}
        />
      ),
    },
    {
      title: 'Manufacturer', dataIndex: 'manufacturer_name', key: 'manufacturer_name', width: 140, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Qty Available', key: 'qty', width: 130, align: 'right', ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={`${r.qty_available} / ${r.qty_received} ${r.unit}`}
          className={styles.batchSmCell}
          style={{ fontWeight: 600, textAlign: 'right' }}
        />
      ),
    },
    {
      title: 'Location', dataIndex: 'location', key: 'location', width: 110, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 110,
      render: v => v
        ? <span className={styles.batchSmCell} style={{ color: expiryColor(v), fontWeight: 500 }}>{dayjs(v).format('DD MMM YYYY')}</span>
        : <span className={styles.dimCell}>—</span>,
      sorter: (a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 145,
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
      title: '', key: 'actions', width: 130, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Events">
            <Button size="small" icon={<HistoryOutlined />} className={styles.viewBtn} onClick={() => openEvents(row)} />
          </Tooltip>
          <Tooltip title="Issue">
            <Button size="small" icon={<ArrowDownOutlined />} className={styles.viewBtn} onClick={() => openIssue(row)} />
          </Tooltip>
          <Tooltip title="Allocate">
            <Button size="small" icon={<AppstoreOutlined />} className={styles.viewBtn} onClick={() => openAllocate(row)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Available Batches
            <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search batch no. or material…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Material" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label" value={matFilter} onChange={setMatFilter}
              options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 160 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['AVAILABLE', 'PARTIALLY_CONSUMED', 'QUARANTINE'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openReceive}>Receive Batch</Button>
        </div>
        <Table<Batch>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} batches` }}
          scroll={{ x: 1020 }}
        />
      </div>

      <Modal
        title="Receive Batch" open={recvOpen}
        onCancel={() => setRecvOpen(false)}
        onOk={handleReceive} okText="Receive"
        confirmLoading={recvSaving} width={680} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={recvForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="material_id" label="Material" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Select showSearch optionFilterProp="label"
                options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Form.Item>
            <Form.Item name="manufacturer_id" label="Manufacturer">
              <Select allowClear showSearch optionFilterProp="label"
                options={manufacturers.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Form.Item>
            <Form.Item name="batch_no" label="Batch No." rules={[{ required: true }]}>
              <Input placeholder="e.g. BN-2024-001" />
            </Form.Item>
            <Form.Item name="qty_received" label="Qty Received" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
              <Select options={UNITS.map(u => ({ value: u, label: u }))} />
            </Form.Item>
            <Form.Item name="location" label="Storage Location">
              <Input />
            </Form.Item>
            <Form.Item name="mfg_date" label="Mfg Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="expiry_date" label="Expiry Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="retest_date" label="Retest Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="invoice_no" label="Invoice No.">
              <Input />
            </Form.Item>
            <Form.Item name="po_no" label="PO No." style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`Edit Batch — ${editTarget?.batch_no}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit} okText="Update"
        confirmLoading={editSaving} width={620} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="location" label="Storage Location" style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="expiry_date" label="Expiry Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="retest_date" label="Retest Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="invoice_no" label="Invoice No.">
              <Input />
            </Form.Item>
            <Form.Item name="po_no" label="PO No.">
              <Input />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`Issue from Batch — ${issueTarget?.batch_no}`}
        open={issueOpen}
        onCancel={() => setIssueOpen(false)}
        onOk={handleIssue} okText="Issue"
        confirmLoading={issueSaving} width={520} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {issueTarget && (
          <div className={styles.modalInfoBanner}>
            Available: <strong>{issueTarget.qty_available} {issueTarget.unit}</strong>
          </div>
        )}
        <Form form={issueForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="qty" label="Qty to Issue" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <InputNumber min={0.001} step={0.1} style={{ width: '100%' }} max={issueTarget?.qty_available ?? undefined} />
            </Form.Item>
            <Form.Item name="issued_to" label="Issued To">
              <Input />
            </Form.Item>
            <Form.Item name="purpose" label="Purpose">
              <Input />
            </Form.Item>
            <Form.Item name="project_code" label="Project Code">
              <Input />
            </Form.Item>
            <Form.Item name="ref_no" label="Reference No.">
              <Input />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`Allocate from Batch — ${allocTarget?.batch_no}`}
        open={allocOpen}
        onCancel={() => setAllocOpen(false)}
        onOk={handleAllocate} okText="Allocate"
        confirmLoading={allocSaving} width={520} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {allocTarget && (
          <div className={styles.modalInfoBanner}>
            Available: <strong>{allocTarget.qty_available} {allocTarget.unit}</strong>
          </div>
        )}
        <Form form={allocForm} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="qty" label="Qty to Allocate" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <InputNumber min={0.001} step={0.1} style={{ width: '100%' }} max={allocTarget?.qty_available ?? undefined} />
            </Form.Item>
            <Form.Item name="module" label="Module">
              <Input placeholder="e.g. SYNTHESIS, QC" />
            </Form.Item>
            <Form.Item name="ref_no" label="Reference No.">
              <Input />
            </Form.Item>
            <Form.Item name="purpose" label="Purpose">
              <Input />
            </Form.Item>
            <Form.Item name="project_code" label="Project Code">
              <Input />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* ── Events Drawer ────────────────────────────────────────────────────── */}
      <BatchEventsDrawer
        open={eventsOpen}
        batchId={eventsBatchId}
        batchNo={eventsBatchNo}
        onClose={() => setEventsOpen(false)}
      />
    </div>
  )
}
