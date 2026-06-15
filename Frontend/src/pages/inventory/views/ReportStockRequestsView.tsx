import React, { useState } from 'react'
import {
  Table, Button, Input, Select, DatePicker, message, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { StockRequestReportRow } from '../types'
import {
  reportStockRequests,
  type StockRequestReportParams,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import { InventoryCountBadge } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

const { RangePicker } = DatePicker

const SR_STATUSES    = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED']
const CRITICALITIES  = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function downloadCsv(rows: StockRequestReportRow[]) {
  if (!rows.length) { message.warning('No data to export'); return }
  const cols: (keyof StockRequestReportRow)[] = [
    'request_no', 'material_code', 'material_name', 'qty_required', 'unit',
    'criticality', 'status', 'requested_by', 'requested_at',
    'approved_by', 'approved_at', 'required_by_date', 'purpose', 'remarks',
  ]
  const lines = [
    cols.join(','),
    ...rows.map(r => cols.map(k => JSON.stringify(r[k] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `stock-requests-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
}

const columns: ColumnsType<StockRequestReportRow> = [
  {
    title: 'Request No.', dataIndex: 'request_no', key: 'request_no', width: 140, fixed: 'left', ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.codeCell} />,
  },
  {
    title: 'Material', key: 'material', width: 200, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell text={[r.material_name, r.material_code].filter(Boolean).join(' · ')} className={styles.batchSmName} />
    ),
  },
  {
    title: 'Qty Required', key: 'qty', width: 110, align: 'right',
    render: (_, r) => <EllipsisCell text={`${r.qty_required} ${r.unit}`} className={styles.batchSmCell} style={{ fontWeight: 500, textAlign: 'right' }} />,
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
    title: 'Requested By', key: 'requested', width: 170, ellipsis: true,
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
    title: 'Approved By', key: 'approved', width: 160, ellipsis: true,
    render: (_, r) => (
      <EllipsisCell
        text={r.approved_by || r.approved_at
          ? [r.approved_by, r.approved_at ? dayjs(r.approved_at).format('DD MMM YYYY') : null].filter(Boolean).join(' · ')
          : null}
        className={styles.batchSmCell}
      />
    ),
  },
  {
    title: 'Required By', dataIndex: 'required_by_date', key: 'required_by_date', width: 110,
    render: v => v
      ? <span className={styles.batchSmCell} style={{ color: dayjs(v).isBefore(dayjs()) ? '#e11d48' : '#44403c', fontWeight: 500 }}>
          {dayjs(v).format('DD MMM YYYY')}
        </span>
      : <span className={styles.dimCell}>—</span>,
    sorter: (a, b) => (a.required_by_date ?? '').localeCompare(b.required_by_date ?? ''),
  },
  {
    title: 'Purpose', dataIndex: 'purpose', key: 'purpose', width: 160, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
  {
    title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 160, ellipsis: true,
    render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
  },
]

export default function ReportStockRequestsView() {
  const [rows,      setRows]      = useState<StockRequestReportRow[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [statusFlt, setStatusFlt] = useState<string | undefined>()
  const [critFlt,   setCritFlt]   = useState<string | undefined>()
  const [reqBy,     setReqBy]     = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)
  const [ran,       setRan]       = useState(false)

  const runReport = () => {
    const p: StockRequestReportParams = {}
    if (statusFlt)      p.status       = statusFlt
    if (critFlt)        p.criticality  = critFlt
    if (reqBy)          p.requested_by = reqBy
    if (dateRange?.[0]) p.date_from    = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) p.date_to      = dateRange[1].format('YYYY-MM-DD')
    setLoading(true)
    reportStockRequests(p)
      .then(data => { setRows(data); setRan(true) })
      .catch(() => message.error('Failed to run report'))
      .finally(() => setLoading(false))
  }

  const displayed = search
    ? rows.filter(r =>
        r.request_no.toLowerCase().includes(search.toLowerCase()) ||
        r.material_name.toLowerCase().includes(search.toLowerCase()) ||
        r.material_code.toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Stock Requests Report</h2>
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
            <Input className={styles.filterInput} size="small" placeholder="Search request no. or material…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)}
              disabled={!ran} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 140 }}
              value={statusFlt} onChange={setStatusFlt}
              options={SR_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Criticality" allowClear style={{ width: 130 }}
              value={critFlt} onChange={setCritFlt}
              options={CRITICALITIES.map(c => ({ value: c, label: c }))} />
            <Input className={styles.filterInput} size="small" placeholder="Requested by…" style={{ width: 150 }}
              value={reqBy} allowClear onChange={e => setReqBy(e.target.value)} />
            <RangePicker className={styles.filterDateRange} size="small" format="DD-MMM-YYYY"
              style={{ width: 240 }}
              placeholder={['Requested from', 'Requested to']}
              value={dateRange}
              onChange={v => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            />
            <Tooltip title="Search">
              <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}
                onClick={runReport} loading={loading} />
            </Tooltip>
          </div>
        </div>

        <Table<StockRequestReportRow>
          rowKey="request_id" size="small" loading={loading}
          dataSource={displayed} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} requests` }}
          scroll={{ x: 1320 }}
          locale={{ emptyText: ran ? 'No results match the selected filters' : 'Set filters and click Run Report' }}
          rowClassName={r =>
            r.criticality === 'CRITICAL' && r.status === 'PENDING' ? styles.criticalRow ?? '' : ''
          }
        />
      </div>
    </div>
  )
}
