import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Tag, message, Select, Space, Tooltip, Switch, Popconfirm, Drawer, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Batch, Material } from '../types'
import { getBatches, toggleBatch, getMaterials } from '@/api/inventoryApi'
import BatchEventsDrawer from '../components/shared/BatchEventsDrawer'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '../components/shared/StatusTag'
import styles from './styles.module.less'

export default function BatchesNonAvailableView() {
  const [rows,      setRows]      = useState<Batch[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [matFilter, setMatFilter] = useState<number | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const [materials, setMaterials] = useState<Material[]>([])

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow,  setDetailRow]  = useState<Batch | null>(null)

  // Events drawer
  const [eventsOpen,    setEventsOpen]    = useState(false)
  const [eventsBatchId, setEventsBatchId] = useState<number | null>(null)
  const [eventsBatchNo, setEventsBatchNo] = useState('')

  useEffect(() => {
    getMaterials({ is_active: true }).then(setMaterials).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getBatches({ category: 'non_available', search: search || undefined, material_id: matFilter, status: statusFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load batches'))
      .finally(() => setLoading(false))
  }, [search, matFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleClear = () => { setSearch(''); setMatFilter(undefined); setStatusFilter(undefined) }

  const handleToggle = async (row: Batch) => {
    try {
      const updated = await toggleBatch(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
      message.success(`Batch ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch {
      message.error('Toggle failed')
    }
  }

  const openEvents = (row: Batch) => {
    setEventsBatchId(row.id)
    setEventsBatchNo(row.batch_no)
    setEventsOpen(true)
  }

  const openDetail = (row: Batch) => { setDetailRow(row); setDetailOpen(true) }

  const columns: ColumnsType<Batch> = [
    {
      title: 'Batch No.', dataIndex: 'batch_no', key: 'batch_no', width: 130, ellipsis: true,
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
      title: 'Manufacturer', dataIndex: 'manufacturer_name', key: 'manufacturer_name', width: 140, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Qty Remaining', key: 'qty', width: 130, align: 'right', ellipsis: true,
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
        ? <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#78716c', fontWeight: 500 }}>{dayjs(v).format('DD MMM YYYY')}</span>
        : <span className={styles.dimCell}>—</span>,
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
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Details">
            <Button size="small" icon={<InfoCircleOutlined />} className={styles.viewBtn} onClick={() => openDetail(row)} />
          </Tooltip>
          <Tooltip title="Events">
            <Button size="small" icon={<HistoryOutlined />} className={styles.viewBtn} onClick={() => openEvents(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Non-Available Batches
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
              options={['PARTIALLY_CONSUMED', 'QUARANTINE', 'EXPIRED'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
        </div>
        <Table<Batch>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} batches` }}
          scroll={{ x: 950 }}
        />
      </div>

      {/* Detail Drawer */}
      <Drawer
        title={detailRow ? `Batch — ${detailRow.batch_no}` : 'Batch Detail'}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={420}
      >
        {detailRow && (
          <>
            <div className={styles.drawerSection}>
              <h4>Batch Info</h4>
              <dl className={styles.kv}>
                <dt>Batch No.</dt>    <dd><span className={styles.codeCell}>{detailRow.batch_no}</span></dd>
                <dt>Material</dt>     <dd>{detailRow.material_name ?? '—'}</dd>
                <dt>Manufacturer</dt> <dd>{detailRow.manufacturer_name ?? '—'}</dd>
                <dt>Qty Received</dt> <dd>{detailRow.qty_received} {detailRow.unit}</dd>
                <dt>Qty Available</dt><dd>{detailRow.qty_available} {detailRow.unit}</dd>
                <dt>Location</dt>     <dd>{detailRow.location ?? '—'}</dd>
                <dt>Mfg Date</dt>     <dd>{detailRow.mfg_date ? dayjs(detailRow.mfg_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Expiry Date</dt>  <dd>{detailRow.expiry_date ? dayjs(detailRow.expiry_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Retest Date</dt>  <dd>{detailRow.retest_date ? dayjs(detailRow.retest_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Status</dt>       <dd><StatusTag status={detailRow.status} /></dd>
                <dt>Invoice No.</dt>  <dd>{detailRow.invoice_no ?? '—'}</dd>
                <dt>PO No.</dt>       <dd>{detailRow.po_no ?? '—'}</dd>
              </dl>
            </div>
            {detailRow.remarks && (
              <div className={styles.drawerSection}>
                <h4>Remarks</h4>
                <p style={{ fontSize: 13, margin: 0 }}>{detailRow.remarks}</p>
              </div>
            )}
            <Button size="small" icon={<HistoryOutlined />} onClick={() => { setDetailOpen(false); openEvents(detailRow) }}>
              View Events
            </Button>
          </>
        )}
      </Drawer>

      <BatchEventsDrawer
        open={eventsOpen}
        batchId={eventsBatchId}
        batchNo={eventsBatchNo}
        onClose={() => setEventsOpen(false)}
      />
    </div>
  )
}
