import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, message, Select, Space, Tooltip, Drawer, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, HistoryOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Batch, Material } from '../types'
import { getBatches, getMaterials } from '@/api/inventoryApi'
import BatchEventsDrawer from '../components/shared/BatchEventsDrawer'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '../components/shared/StatusTag'
import styles from './styles.module.less'

export default function BatchesHistoricView() {
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
    getBatches({ category: 'historic', search: search || undefined, material_id: matFilter, status: statusFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load historic batches'))
      .finally(() => setLoading(false))
  }, [search, matFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const handleClear = () => { setSearch(''); setMatFilter(undefined); setStatusFilter(undefined) }

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
      title: 'Qty Received', key: 'qty', width: 120, align: 'right', ellipsis: true,
      render: (_, r) => (
        <EllipsisCell text={`${r.qty_received} ${r.unit}`} className={styles.batchSmCell} style={{ fontWeight: 500, textAlign: 'right' }} />
      ),
    },
    {
      title: 'Qty Used', key: 'qty_used', width: 110, align: 'right', ellipsis: true,
      render: (_, r) => {
        const used = r.qty_received - r.qty_available
        return <EllipsisCell text={`${used.toFixed(2)} ${r.unit}`} className={styles.batchSmCell} style={{ textAlign: 'right' }} />
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 145,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Location', dataIndex: 'location', key: 'location', width: 110, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Received', dataIndex: 'received_at', key: 'received_at', width: 160, ellipsis: true,
      render: (v, r) => (
        <EllipsisCell
          text={v
            ? [r.received_by, dayjs(v).format('DD MMM YYYY')].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmCell}
        />
      ),
      sorter: (a, b) => (a.received_at ?? '').localeCompare(b.received_at ?? ''),
      defaultSortOrder: 'descend',
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
            Historic Batches
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
              options={['CONSUMED', 'EXPIRED', 'PARTIALLY_CONSUMED'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
        </div>
        <Table<Batch>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} batches` }}
          scroll={{ x: 960 }}
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
              <h4>Batch Summary</h4>
              <dl className={styles.kv}>
                <dt>Batch No.</dt>    <dd><span className={styles.codeCell}>{detailRow.batch_no}</span></dd>
                <dt>Material</dt>     <dd>{detailRow.material_name ?? '—'}</dd>
                <dt>Manufacturer</dt> <dd>{detailRow.manufacturer_name ?? '—'}</dd>
                <dt>Qty Received</dt> <dd>{detailRow.qty_received} {detailRow.unit}</dd>
                <dt>Qty Remaining</dt><dd>{detailRow.qty_available} {detailRow.unit}</dd>
                <dt>Total Used</dt>   <dd>{(detailRow.qty_received - detailRow.qty_available).toFixed(2)} {detailRow.unit}</dd>
                <dt>Status</dt>       <dd><StatusTag status={detailRow.status} /></dd>
                <dt>Location</dt>     <dd>{detailRow.location ?? '—'}</dd>
                <dt>Mfg Date</dt>     <dd>{detailRow.mfg_date ? dayjs(detailRow.mfg_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Expiry Date</dt>  <dd>{detailRow.expiry_date ? dayjs(detailRow.expiry_date).format('DD MMM YYYY') : '—'}</dd>
                <dt>Invoice No.</dt>  <dd>{detailRow.invoice_no ?? '—'}</dd>
                <dt>PO No.</dt>       <dd>{detailRow.po_no ?? '—'}</dd>
                <dt>Received By</dt>  <dd>{detailRow.received_by ?? '—'}</dd>
                <dt>Received At</dt>  <dd>{detailRow.received_at ? dayjs(detailRow.received_at).format('DD MMM YYYY HH:mm') : '—'}</dd>
              </dl>
            </div>
            {detailRow.remarks && (
              <div className={styles.drawerSection}>
                <h4>Remarks</h4>
                <p style={{ fontSize: 13, margin: 0 }}>{detailRow.remarks}</p>
              </div>
            )}
            <Button size="small" icon={<HistoryOutlined />} onClick={() => { setDetailOpen(false); openEvents(detailRow) }}>
              View All Events
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
