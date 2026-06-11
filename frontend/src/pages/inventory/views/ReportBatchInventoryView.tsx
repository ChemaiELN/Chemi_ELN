import React, { useState } from 'react'
import {
  Table, Button, Input, Tag, Select, message, Badge,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { BatchInventoryRow } from '../types'
import {
  reportBatchInventory,
  type BatchInventoryReportParams,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import styles from './styles.module.less'

const MATERIAL_TYPES = [
  'Raw Material', 'Reagent', 'Solvent', 'Standard', 'Reference Standard',
  'Media', 'Buffer', 'Excipient', 'API', 'Intermediate', 'Consumable', 'Other',
]

const BATCH_STATUSES = [
  'AVAILABLE', 'PARTIALLY_CONSUMED', 'CONSUMED', 'EXPIRED', 'QUARANTINE',
]

const CATEGORIES = [
  { value: 'available',     label: 'Available' },
  { value: 'non_available', label: 'Non-Available' },
  { value: 'historic',      label: 'Historic' },
]

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'green', PARTIALLY_CONSUMED: 'blue',
  CONSUMED: 'default', EXPIRED: 'red', QUARANTINE: 'orange',
}

function downloadCsv(rows: BatchInventoryRow[]) {
  if (!rows.length) { message.warning('No data to export'); return }
  const cols: (keyof BatchInventoryRow)[] = [
    'batch_no', 'material_code', 'material_name', 'material_type',
    'manufacturer', 'qty_received', 'qty_available', 'unit', 'location',
    'mfg_date', 'expiry_date', 'retest_date', 'status', 'category',
    'received_by', 'received_at',
  ]
  const lines = [
    cols.join(','),
    ...rows.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `batch-inventory-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
}

const columns: ColumnsType<BatchInventoryRow> = [
  {
    title: 'Batch No.', dataIndex: 'batch_no', key: 'batch_no', width: 130, fixed: 'left', ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.codeCell} />,
  },
  {
    title: 'Material', key: 'material', width: 200, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell
        text={[r.material_name, r.material_code, r.material_type].filter(Boolean).join(' · ')}
        className={styles.batchSmName}
      />
    ),
  },
  {
    title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer', width: 140, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Received', dataIndex: 'qty_received', key: 'qty_received', width: 90, align: 'right',
    render: (v, r) => <EllipsisCell text={`${v} ${r.unit}`} className={styles.batchSmCell} style={{ textAlign: 'right' }} />,
  },
  {
    title: 'Available', dataIndex: 'qty_available', key: 'qty_available', width: 90, align: 'right',
    render: (v, r) => <EllipsisCell text={`${v} ${r.unit}`} className={styles.batchSmCell} style={{ fontWeight: 500, textAlign: 'right' }} />,
  },
  {
    title: 'Location', dataIndex: 'location', key: 'location', width: 110, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Mfg Date', dataIndex: 'mfg_date', key: 'mfg_date', width: 110,
    render: v => v ? <span className={styles.batchSmCell}>{dayjs(v).format('DD MMM YYYY')}</span> : <span className={styles.dimCell}>—</span>,
  },
  {
    title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', width: 115,
    render: v => v
      ? <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#d97706', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      : <span className={styles.dimCell}>—</span>,
    sorter: (a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''),
  },
  {
    title: 'Status', dataIndex: 'status', key: 'status', width: 130,
    render: v => <Tag color={STATUS_COLOR[v] ?? 'default'} className={styles.statusTag}>{v}</Tag>,
  },
  {
    title: 'Category', dataIndex: 'category', key: 'category', width: 120,
    render: v => <Tag color="blue" className={styles.statusTag}>{v}</Tag>,
  },
  {
    title: 'Received By', key: 'received_by', width: 160, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell
        text={r.received_by || r.received_at
          ? [r.received_by, r.received_at ? dayjs(r.received_at).format('DD MMM YYYY') : null].filter(Boolean).join(' · ')
          : null}
        className={styles.batchSmCell}
      />
    ),
  },
]

export default function ReportBatchInventoryView() {
  const [rows,     setRows]     = useState<BatchInventoryRow[]>([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [matType,  setMatType]  = useState<string | undefined>()
  const [status,   setStatus]   = useState<string | undefined>()
  const [location, setLocation] = useState('')
  const [ran,      setRan]      = useState(false)

  const runReport = () => {
    const p: BatchInventoryReportParams = {}
    if (category) p.category = category
    if (matType)  p.material_type = matType
    if (status)   p.status  = status
    if (location) p.location = location
    setLoading(true)
    reportBatchInventory(p)
      .then(data => { setRows(data); setRan(true) })
      .catch(() => message.error('Failed to run report'))
      .finally(() => setLoading(false))
  }

  const handleClear = () => {
    setSearch('')
    setCategory(undefined)
    setMatType(undefined)
    setStatus(undefined)
    setLocation('')
  }

  const displayed = search
    ? rows.filter(r =>
        r.batch_no.toLowerCase().includes(search.toLowerCase()) ||
        r.material_name.toLowerCase().includes(search.toLowerCase()) ||
        r.material_code.toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Batch Inventory Report</h2>
        {ran && (
          <Badge count={displayed.length} overflowCount={99999}
            style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
        )}
        <Button size="small" icon={<DownloadOutlined />} disabled={!ran}
          className={`${styles.clearBtn} ${styles.masterPageTitleAction}`}
          onClick={() => downloadCsv(displayed)}>
          Export CSV
        </Button>
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search batch no. or material…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)}
              disabled={!ran} />
            <Select className={styles.filterSelect} size="small" placeholder="Category" allowClear style={{ width: 140 }}
              value={category} onChange={setCategory} options={CATEGORIES} />
            <Select className={styles.filterSelect} size="small" placeholder="Material Type" allowClear style={{ width: 170 }}
              value={matType} onChange={setMatType}
              options={MATERIAL_TYPES.map(t => ({ value: t, label: t }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 165 }}
              value={status} onChange={setStatus}
              options={BATCH_STATUSES.map(s => ({ value: s, label: s }))} />
            <Input className={styles.filterInput} size="small" placeholder="Location…" style={{ width: 120 }}
              value={location} allowClear onChange={e => setLocation(e.target.value)} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}
              onClick={runReport} loading={loading}>
              Run Report
            </Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
        </div>

        <Table<BatchInventoryRow>
          rowKey="batch_id" size="small" loading={loading}
          dataSource={displayed} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} rows` }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: ran ? 'No results match the selected filters' : 'Set filters and click Run Report' }}
        />
      </div>
    </div>
  )
}
