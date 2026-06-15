import React, { useState } from 'react'
import {
  Table, Button, Input, Select, message, Badge, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { EquipmentStatusRow } from '../types'
import {
  reportEquipmentStatus,
  type EquipmentStatusReportParams,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import { InventoryCountBadge } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

const ASSET_TYPES = [
  { value: 'EQUIPMENT',  label: 'Equipment' },
  { value: 'INSTRUMENT', label: 'Instrument' },
  { value: 'COLUMN',     label: 'Column' },
]

const ASSET_STATUSES = [
  'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'UNDER_CALIBRATION',
  'DECOMMISSIONED', 'EXHAUSTED',
]

const SERVICE_STATUSES = ['OK', 'DUE', 'OVERDUE', 'EXPIRED', 'EXHAUSTED']

function downloadCsv(rows: EquipmentStatusRow[]) {
  if (!rows.length) { message.warning('No data to export'); return }
  const cols: (keyof EquipmentStatusRow)[] = [
    'asset_type', 'asset_id', 'name', 'type_name', 'manufacturer', 'model',
    'location', 'status', 'service_status', 'last_service_date',
    'next_service_due', 'is_active',
  ]
  const lines = [
    cols.join(','),
    ...rows.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `equipment-status-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
}

const columns: ColumnsType<EquipmentStatusRow> = [
  {
    title: 'Asset ID', dataIndex: 'asset_id', key: 'asset_id', width: 130, fixed: 'left', ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.codeCell} />,
  },
  {
    title: 'Name', dataIndex: 'name', key: 'name', width: 200, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmName} />,
  },
  {
    title: 'Type', key: 'type', width: 130, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell
        text={[r.asset_type, r.type_name].filter(Boolean).join(' · ')}
        className={styles.batchSmCell}
      />
    ),
  },
  {
    title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer', width: 130, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Model', dataIndex: 'model', key: 'model', width: 120, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Location', dataIndex: 'location', key: 'location', width: 110, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Asset Status', dataIndex: 'status', key: 'status', width: 140,
    render: v => <StatusTag status={v} />,
  },
  {
    title: 'Service Status', dataIndex: 'service_status', key: 'service_status', width: 130,
    render: v => <StatusTag status={v} />,
  },
  {
    title: 'Last Service', dataIndex: 'last_service_date', key: 'last_service_date', width: 115,
    render: v => v ? <span className={styles.batchSmCell}>{dayjs(v).format('DD MMM YYYY')}</span> : <span className={styles.dimCell}>—</span>,
    sorter: (a, b) => (a.last_service_date ?? '').localeCompare(b.last_service_date ?? ''),
  },
  {
    title: 'Next Due', dataIndex: 'next_service_due', key: 'next_service_due', width: 115,
    render: v => v
      ? <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#d97706', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      : <span className={styles.dimCell}>—</span>,
    sorter: (a, b) => (a.next_service_due ?? '').localeCompare(b.next_service_due ?? ''),
  },
  {
    title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 70, align: 'center',
    render: v => <Badge status={v ? 'success' : 'default'} text={v ? 'Yes' : 'No'} />,
  },
]

export default function ReportEquipmentStatusView() {
  const [rows,      setRows]      = useState<EquipmentStatusRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [assetType, setAssetType] = useState<string | undefined>()
  const [statusFlt, setStatusFlt] = useState<string | undefined>()
  const [svcFlt,    setSvcFlt]    = useState<string | undefined>()
  const [ran,       setRan]       = useState(false)

  const runReport = () => {
    const p: EquipmentStatusReportParams = {}
    if (assetType) p.asset_type     = assetType
    if (statusFlt) p.status         = statusFlt
    if (svcFlt)    p.service_status = svcFlt
    setLoading(true)
    reportEquipmentStatus(p)
      .then(data => { setRows(data); setRan(true) })
      .catch(() => message.error('Failed to run report'))
      .finally(() => setLoading(false))
  }

  const displayed = search
    ? rows.filter(r =>
        r.asset_id.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.manufacturer ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Equipment Status Report</h2>
        {ran && (
          <InventoryCountBadge count={displayed.length} />
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
            <Input className={styles.filterInput} size="small" placeholder="Search asset ID, name or manufacturer…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)}
              disabled={!ran} />
            <Select className={styles.filterSelect} size="small" placeholder="Asset Type" allowClear style={{ width: 140 }}
              value={assetType} onChange={setAssetType} options={ASSET_TYPES} />
            <Select className={styles.filterSelect} size="small" placeholder="Asset Status" allowClear style={{ width: 170 }}
              value={statusFlt} onChange={setStatusFlt}
              options={ASSET_STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Service Status" allowClear style={{ width: 150 }}
              value={svcFlt} onChange={setSvcFlt}
              options={SERVICE_STATUSES.map(s => ({ value: s, label: s }))} />
            <Tooltip title="Search">
              <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}
                onClick={runReport} loading={loading} />
            </Tooltip>
          </div>
        </div>

        <Table<EquipmentStatusRow>
          rowKey={r => `${r.asset_type}-${r.asset_id}`}
          size="small" loading={loading}
          dataSource={displayed} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} assets` }}
          scroll={{ x: 1280 }}
          locale={{ emptyText: ran ? 'No results match the selected filters' : 'Set filters and click Run Report' }}
          rowClassName={r =>
            (r.service_status === 'OVERDUE' || r.service_status === 'EXPIRED') ? styles.criticalRow ?? '' : ''
          }
        />
      </div>
    </div>
  )
}
