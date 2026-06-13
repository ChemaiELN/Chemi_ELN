import React, { useState } from 'react'
import {
  Table, Button, Input, Switch, DatePicker, message, Badge, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ExpiryReportRow } from '../types'
import {
  reportExpiry,
  type ExpiryReportParams,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

const { RangePicker } = DatePicker

function daysColor(d: number): string {
  if (d < 0)  return '#e11d48'
  if (d < 30) return '#e11d48'
  if (d < 90) return '#d97706'
  return '#059669'
}

function downloadCsv(rows: ExpiryReportRow[]) {
  if (!rows.length) { message.warning('No data to export'); return }
  const cols: (keyof ExpiryReportRow)[] = [
    'batch_no', 'material_code', 'material_name', 'manufacturer',
    'qty_available', 'unit', 'location', 'mfg_date', 'expiry_date',
    'retest_date', 'status', 'days_to_expiry',
  ]
  const lines = [
    cols.join(','),
    ...rows.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `expiry-report-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
}

const columns: ColumnsType<ExpiryReportRow> = [
  {
    title: 'Batch No.', dataIndex: 'batch_no', key: 'batch_no', width: 130, fixed: 'left', ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.codeCell} />,
  },
  {
    title: 'Material', key: 'material', width: 210, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell text={[r.material_name, r.material_code].filter(Boolean).join(' · ')} className={styles.batchSmName} />
    ),
  },
  {
    title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer', width: 130, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Qty Available', key: 'qty', width: 110, align: 'right',
    render: (_, r) => <EllipsisCell text={`${r.qty_available} ${r.unit}`} className={styles.batchSmCell} style={{ fontWeight: 500, textAlign: 'right' }} />,
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
    render: (v, r) => (
      <span className={styles.batchSmCell} style={{ color: daysColor(r.days_to_expiry), fontWeight: 600 }}>
        {dayjs(v).format('DD MMM YYYY')}
      </span>
    ),
    sorter: (a, b) => a.expiry_date.localeCompare(b.expiry_date),
    defaultSortOrder: 'ascend',
  },
  {
    title: 'Retest Date', dataIndex: 'retest_date', key: 'retest_date', width: 115,
    render: v => v ? <span className={styles.batchSmCell}>{dayjs(v).format('DD MMM YYYY')}</span> : <span className={styles.dimCell}>—</span>,
  },
  {
    title: 'Days Left', dataIndex: 'days_to_expiry', key: 'days_to_expiry', width: 90, align: 'center',
    render: v => (
      <strong className={styles.batchSmCell} style={{ color: daysColor(v) }}>
        {v < 0 ? `${Math.abs(v)}d ago` : `${v}d`}
      </strong>
    ),
    sorter: (a, b) => a.days_to_expiry - b.days_to_expiry,
  },
  {
    title: 'Status', dataIndex: 'status', key: 'status', width: 130,
    render: v => <StatusTag status={v} />,
  },
]

export default function ReportExpiryView() {
  const [rows,        setRows]        = useState<ExpiryReportRow[]>([])
  const [loading,     setLoading]     = useState(false)
  const [search,      setSearch]      = useState('')
  const [dateRange,   setDateRange]   = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [inclExpired, setInclExpired] = useState(true)
  const [ran,         setRan]         = useState(false)

  const runReport = () => {
    const p: ExpiryReportParams = { include_expired: inclExpired }
    if (dateRange?.[0]) p.date_from = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) p.date_to   = dateRange[1].format('YYYY-MM-DD')
    setLoading(true)
    reportExpiry(p)
      .then(data => { setRows(data); setRan(true) })
      .catch(() => message.error('Failed to run report'))
      .finally(() => setLoading(false))
  }

  const handleClear = () => {
    setSearch('')
    setDateRange(null)
    setInclExpired(true)
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
        <h2 className={styles.sectionTitle}>Expiry Report</h2>
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
            <RangePicker className={styles.filterDateRange} size="small" format="DD-MMM-YYYY"
              style={{ width: 240 }}
              placeholder={['Expiry from', 'Expiry to']}
              value={dateRange}
              onChange={v => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            />
            <Space size={6} style={{ alignItems: 'center' }}>
              <Switch size="small" checked={inclExpired} onChange={setInclExpired} />
              <span style={{ fontSize: 12, color: '#57534e', whiteSpace: 'nowrap' }}>Include expired</span>
            </Space>
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}
              onClick={runReport} loading={loading}>
              Run Report
            </Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
        </div>

        <Table<ExpiryReportRow>
          rowKey="batch_id" size="small" loading={loading}
          dataSource={displayed} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} rows` }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: ran ? 'No results match the selected filters' : 'Set filters and click Run Report' }}
          rowClassName={r => r.days_to_expiry < 0 ? styles.criticalRow ?? '' : ''}
        />
      </div>
    </div>
  )
}
