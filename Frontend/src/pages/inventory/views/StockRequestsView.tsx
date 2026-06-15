import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, InputNumber,
  message, Select, Space, Tooltip, Popconfirm, DatePicker, Drawer,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  EditOutlined, SearchOutlined,
  CheckCircleOutlined, CloseCircleOutlined, CheckOutlined,
  StopOutlined, HistoryOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { StockRequest, Material } from '../types'
import {
  getStockRequests, createStockRequest, updateStockRequest,
  approveStockRequest, rejectStockRequest,
  fulfillStockRequest, cancelStockRequest,
  getMaterials,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StockRequestEventsDrawer from '../components/shared/StockRequestEventsDrawer'
import StatusTag from '../components/shared/StatusTag'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

// ─── constants ────────────────────────────────────────────────────────────────

const UNITS = ['g', 'mg', 'kg', 'mL', 'L', 'units', 'vials', 'pcs', 'µg', 'µL']

// ─── component ───────────────────────────────────────────────────────────────

export default function StockRequestsView() {
  const [rows,            setRows]            = useState<StockRequest[]>([])
  const [loading,         setLoading]         = useState(false)
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState<string | undefined>()
  const [critFilter,      setCritFilter]      = useState<string | undefined>()
  const [matFilter,       setMatFilter]       = useState<number | undefined>()

  const [materials, setMaterials] = useState<Material[]>([])

  // Create / Edit modal
  const [formOpen,   setFormOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<StockRequest | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [form]                      = Form.useForm()

  // Remarks modal (approve / reject / fulfill)
  const [remarksOpen,   setRemarksOpen]   = useState(false)
  const [remarksTarget, setRemarksTarget] = useState<StockRequest | null>(null)
  const [remarksAction, setRemarksAction] = useState<'approve' | 'reject' | 'fulfill'>('approve')
  const [remarksSaving, setRemarksSaving] = useState(false)
  const [remarksForm]                     = Form.useForm()

  // Events drawer
  const [eventsOpen,     setEventsOpen]     = useState(false)
  const [eventsRequestId, setEventsRequestId] = useState<number | null>(null)
  const [eventsRequestNo, setEventsRequestNo] = useState('')

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow,  setDetailRow]  = useState<StockRequest | null>(null)

  useEffect(() => {
    getMaterials({ is_active: true }).then(setMaterials).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getStockRequests({ search: search || undefined, status: statusFilter, criticality: critFilter, material_id: matFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load stock requests'))
      .finally(() => setLoading(false))
  }, [search, statusFilter, critFilter, matFilter])

  useEffect(() => { load() }, [load])

  // ── Create / Edit ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('criticality', 'MEDIUM')
    setFormOpen(true)
  }

  const openEdit = (row: StockRequest) => {
    setEditTarget(row)
    form.setFieldsValue({
      ...row,
      required_by_date: row.required_by_date ? dayjs(row.required_by_date) : undefined,
    } as Record<string, unknown>)
    setFormOpen(true)
  }

  const handleFormSave = async () => {
    let v: Record<string, unknown>
    try { v = await form.validateFields() } catch { return }
    if (v.required_by_date) {
      v.required_by_date = (v.required_by_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    }
    setFormSaving(true)
    try {
      if (editTarget) {
        const updated = await updateStockRequest(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Stock request updated')
      } else {
        await createStockRequest(v)
        message.success('Stock request submitted')
        load()
      }
      setFormOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setFormSaving(false)
    }
  }

  // ── Approve / Reject / Fulfill ────────────────────────────────────────────

  const openRemarks = (row: StockRequest, action: 'approve' | 'reject' | 'fulfill') => {
    setRemarksTarget(row)
    setRemarksAction(action)
    remarksForm.resetFields()
    setRemarksOpen(true)
  }

  const handleRemarks = async () => {
    let v: Record<string, unknown>
    try { v = await remarksForm.validateFields() } catch { return }
    const remarks = v.remarks as string | undefined
    setRemarksSaving(true)
    try {
      let updated: StockRequest
      switch (remarksAction) {
        case 'approve': updated = await approveStockRequest(remarksTarget!.id, remarks); break
        case 'reject':  updated = await rejectStockRequest(remarksTarget!.id, remarks);  break
        case 'fulfill': updated = await fulfillStockRequest(remarksTarget!.id, remarks); break
      }
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success({
        approve: 'Request approved',
        reject:  'Request rejected',
        fulfill: 'Request fulfilled',
      }[remarksAction])
      setRemarksOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setRemarksSaving(false)
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  const handleCancel = async (row: StockRequest) => {
    try {
      const updated = await cancelStockRequest(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success('Request cancelled')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Cancel failed')
    }
  }

  // ── Events / Detail ───────────────────────────────────────────────────────

  const openEvents = (row: StockRequest) => {
    setEventsRequestId(row.id)
    setEventsRequestNo(row.request_no)
    setEventsOpen(true)
  }

  const openDetail = (row: StockRequest) => { setDetailRow(row); setDetailOpen(true) }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: ColumnsType<StockRequest> = [
    {
      title: 'Request No.', dataIndex: 'request_no', key: 'request_no', width: 140, ellipsis: true,
      render: (v, row) => (
        <button type="button" className={styles.ellipsisLink} onClick={() => openDetail(row)}>
          <EllipsisCell text={v} className={styles.codeCell} />
        </button>
      ),
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
      title: 'Qty', key: 'qty', width: 100, align: 'right', ellipsis: true,
      render: (_, r) => (
        <EllipsisCell text={`${r.qty_required} ${r.unit}`} className={styles.batchSmCell} style={{ fontWeight: 500, textAlign: 'right' }} />
      ),
    },
    {
      title: 'Criticality', dataIndex: 'criticality', key: 'criticality', width: 110,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Required By', dataIndex: 'required_by_date', key: 'required_by_date', width: 110,
      render: v => v ? (
        <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#44403c', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      ) : <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Requested By', key: 'req_by', width: 160, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.requested_by || r.requested_at
            ? [r.requested_by, r.requested_at ? dayjs(r.requested_at).format('DD MMM YYYY') : null].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmCell}
        />
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 140, align: 'right',
      render: (_, row) => (
        <Space size={3}>
          <Tooltip title="Events">
            <Button size="small" icon={<HistoryOutlined />} className={styles.viewBtn} onClick={() => openEvents(row)} />
          </Tooltip>
          {row.status === 'PENDING' && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
              </Tooltip>
              <Tooltip title="Approve">
                <Button size="small" icon={<CheckCircleOutlined />} className={styles.viewBtnSuccess}
                  onClick={() => openRemarks(row, 'approve')}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" icon={<CloseCircleOutlined />} className={styles.viewBtnDanger}
                  onClick={() => openRemarks(row, 'reject')}
                />
              </Tooltip>
              <Popconfirm title="Cancel this request?" onConfirm={() => handleCancel(row)} okText="Yes">
                <Tooltip title="Cancel">
                  <Button size="small" icon={<StopOutlined />} className={styles.viewBtn} />
                </Tooltip>
              </Popconfirm>
            </>
          )}
          {row.status === 'APPROVED' && (
            <>
              <Tooltip title="Reject">
                <Button size="small" icon={<CloseCircleOutlined />} className={styles.viewBtnDanger}
                  onClick={() => openRemarks(row, 'reject')}
                />
              </Tooltip>
              <Tooltip title="Fulfill">
                <Button size="small" icon={<CheckOutlined />} className={styles.viewBtnPurple}
                  onClick={() => openRemarks(row, 'fulfill')}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  const pendingCount = rows.filter(r => r.status === 'PENDING').length

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Stock Requests</h2>
        <InventoryCountBadge count={rows.length} />
        {pendingCount > 0 && (
          <InventoryCountBadge count={pendingCount} label="pending" />
        )}
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search request no. or material…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'].map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Criticality" allowClear style={{ width: 130 }}
              value={critFilter} onChange={setCritFilter}
              options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(c => ({ value: c, label: c }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Material" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label" value={matFilter} onChange={setMatFilter}
              options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
          </div>
          <InventoryAddButton onClick={openCreate}>New Request</InventoryAddButton>
        </div>

        <Table<StockRequest>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          rowClassName={row => row.criticality === 'CRITICAL' && row.status === 'PENDING' ? styles.criticalRow ?? '' : ''}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} requests` }}
          scroll={{ x: 1060 }}
        />
      </div>

      <Modal
        title={editTarget ? `Edit Request — ${editTarget.request_no}` : 'New Stock Request'}
        open={formOpen} onCancel={() => setFormOpen(false)}
        onOk={handleFormSave} okText={editTarget ? 'Update' : 'Submit'}
        confirmLoading={formSaving} width={600} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="material_id" label="Material" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Select showSearch optionFilterProp="label" disabled={!!editTarget}
                options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Form.Item>
            <Form.Item name="qty_required" label="Qty Required" rules={[{ required: true }]}>
              <InputNumber min={0.001} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
              <Select options={UNITS.map(u => ({ value: u, label: u }))} />
            </Form.Item>
            <Form.Item name="criticality" label="Criticality" rules={[{ required: true }]}>
              <Select options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(c => ({ value: c, label: c }))} />
            </Form.Item>
            <Form.Item name="required_by_date" label="Required By Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="purpose" label="Purpose" style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={{
          approve: 'Approve Stock Request',
          reject:  'Reject Stock Request',
          fulfill: 'Mark as Fulfilled',
        }[remarksAction]}
        open={remarksOpen} onCancel={() => setRemarksOpen(false)}
        onOk={handleRemarks}
        okText={{ approve: 'Approve', reject: 'Reject', fulfill: 'Fulfill' }[remarksAction]}
        okButtonProps={
          remarksAction === 'reject'
            ? { danger: true }
            : remarksAction === 'fulfill'
            ? { style: { background: '#7c3aed', borderColor: '#7c3aed' } }
            : { style: { background: '#059669', borderColor: '#059669' } }
        }
        confirmLoading={remarksSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {remarksTarget && (
          <div className={styles.modalInfoBannerNeutral}>
            <strong>{remarksTarget.request_no}</strong> · {remarksTarget.material_name} · {remarksTarget.qty_required} {remarksTarget.unit}
            <span style={{ marginLeft: 8 }}><StatusTag status={remarksTarget.criticality} /></span>
          </div>
        )}
        <Form form={remarksForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="remarks" label="Remarks"
            rules={remarksAction === 'reject' ? [{ required: true, message: 'Remarks required for rejection' }] : []}
          >
            <Input.TextArea rows={2}
              placeholder={
                remarksAction === 'reject' ? 'Reason for rejection (required)…' :
                remarksAction === 'fulfill' ? 'Fulfillment notes (optional)…' :
                'Approval notes (optional)…'
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Detail Drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={detailRow ? `Request — ${detailRow.request_no}` : 'Request Detail'}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={440}
      >
        {detailRow && (
          <>
            <div className={styles.drawerSection}>
              <h4>Request Info</h4>
              <dl className={styles.kv}>
                <dt>Request No.</dt>   <dd><span className={styles.codeCell}>{detailRow.request_no}</span></dd>
                <dt>Material</dt>      <dd>{detailRow.material_name ?? '—'}</dd>
                <dt>Qty Required</dt>  <dd>{detailRow.qty_required} {detailRow.unit}</dd>
                <dt>Criticality</dt>   <dd><StatusTag status={detailRow.criticality} /></dd>
                <dt>Status</dt>        <dd><StatusTag status={detailRow.status} /></dd>
                <dt>Required By</dt>   <dd>{detailRow.required_by_date ? dayjs(detailRow.required_by_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Purpose</dt>       <dd>{detailRow.purpose ?? '—'}</dd>
              </dl>
            </div>
            <div className={styles.drawerSection}>
              <h4>Lifecycle</h4>
              <dl className={styles.kv}>
                <dt>Requested By</dt>  <dd>{detailRow.requested_by ?? '—'}</dd>
                <dt>Requested At</dt>  <dd>{detailRow.requested_at ? dayjs(detailRow.requested_at).format('DD MMM YYYY HH:mm') : '—'}</dd>
                <dt>Approved By</dt>   <dd>{detailRow.approved_by ?? '—'}</dd>
                <dt>Approved At</dt>   <dd>{detailRow.approved_at ? dayjs(detailRow.approved_at).format('DD MMM YYYY HH:mm') : '—'}</dd>
              </dl>
            </div>
            {detailRow.remarks && (
              <div className={styles.drawerSection}>
                <h4>Remarks</h4>
                <p style={{ fontSize: 13, margin: 0 }}>{detailRow.remarks}</p>
              </div>
            )}
            <Space>
              <Button size="small" icon={<HistoryOutlined />}
                onClick={() => { setDetailOpen(false); openEvents(detailRow) }}>
                View Events
              </Button>
              {detailRow.status === 'PENDING' && (
                <>
                  <Button size="small" icon={<CheckCircleOutlined />}
                    style={{ color: '#059669', borderColor: '#059669' }}
                    onClick={() => { setDetailOpen(false); openRemarks(detailRow, 'approve') }}>
                    Approve
                  </Button>
                  <Button size="small" danger icon={<CloseCircleOutlined />}
                    onClick={() => { setDetailOpen(false); openRemarks(detailRow, 'reject') }}>
                    Reject
                  </Button>
                </>
              )}
              {detailRow.status === 'APPROVED' && (
                <Button size="small" icon={<CheckOutlined />}
                  style={{ color: '#7c3aed', borderColor: '#7c3aed' }}
                  onClick={() => { setDetailOpen(false); openRemarks(detailRow, 'fulfill') }}>
                  Fulfill
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>

      {/* ── Events Drawer ────────────────────────────────────────────────────── */}
      <StockRequestEventsDrawer
        open={eventsOpen}
        requestId={eventsRequestId}
        requestNo={eventsRequestNo}
        onClose={() => setEventsOpen(false)}
      />
    </div>
  )
}
