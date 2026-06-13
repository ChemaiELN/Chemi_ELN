import React, { useState, useEffect, useCallback } from 'react'
import { Table, Input, Select, DatePicker, Typography, message, Badge, Button } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { AuditTrailEntry } from '../types'
import { getAuditTrail } from '@/api/inventoryApi'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

const { RangePicker } = DatePicker

const ENTITY_TYPES = [
  'MATERIAL', 'MANUFACTURER', 'MAPPING',
  'BATCH', 'BATCH_VERIFICATION', 'STOCK_REQUEST',
  'EQUIPMENT_TYPE', 'INSTRUMENT_TYPE', 'COLUMN_TYPE',
  'EQUIPMENT', 'INSTRUMENT', 'COLUMN',
  'MAINTENANCE', 'CALIBRATION', 'EQUIP_VERIFICATION', 'INSTR_VERIFICATION',
]

const EVENT_TYPES = [
  'CREATE', 'UPDATE', 'DELETE', 'TOGGLE', 'ISSUE', 'ALLOCATE',
  'VERIFY', 'REJECT', 'APPROVE', 'FULFILL', 'CANCEL', 'COMPLETE',
]

export default function AuditTrailView() {
  const [rows,      setRows]      = useState<AuditTrailEntry[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [page,      setPage]      = useState(1)

  const [entityType,   setEntityType]   = useState<string | undefined>()
  const [eventType,    setEventType]    = useState<string | undefined>()
  const [performedBy,  setPerformedBy]  = useState('')
  const [dateRange,    setDateRange]    = useState<[string, string] | undefined>()

  const PAGE_SIZE = 25

  const load = useCallback(() => {
    setLoading(true)
    getAuditTrail({
      entity_type:  entityType,
      event_type:   eventType,
      performed_by: performedBy || undefined,
      date_from:    dateRange?.[0],
      date_to:      dateRange?.[1],
      page,
      page_size:    PAGE_SIZE,
    })
      .then(r => { setRows(r.items); setTotal(r.total) })
      .catch(() => message.error('Failed to load audit trail'))
      .finally(() => setLoading(false))
  }, [entityType, eventType, performedBy, dateRange, page])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    setEntityType(undefined)
    setEventType(undefined)
    setPerformedBy('')
    setDateRange(undefined)
    setPage(1)
  }

  const columns: ColumnsType<AuditTrailEntry> = [
    {
      title: 'Timestamp', dataIndex: 'performed_at', key: 'performed_at', width: 160,
      render: v => v ? <span className={styles.dimCell}>{dayjs(v).format('DD MMM YYYY HH:mm')}</span> : '—',
    },
    {
      title: 'Event', dataIndex: 'event_type', key: 'event_type', width: 110,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Entity Type', dataIndex: 'entity_type', key: 'entity_type', width: 160,
      render: v => <StatusTag status={v} variant="info" />,
    },
    {
      title: 'Reference', dataIndex: 'entity_ref', key: 'entity_ref', width: 150,
      render: v => <span className={styles.codeCell}>{v ?? '—'}</span>,
    },
    {
      title: 'Performed By', dataIndex: 'performed_by', key: 'performed_by', width: 150,
      render: v => v ?? <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Details', dataIndex: 'details', key: 'details',
      render: (v, row) => {
        const text = v ?? row.new_value ?? '—'
        return (
          <Typography.Text ellipsis={{ tooltip: text }} style={{ fontSize: 12, maxWidth: 280 }}>
            {text}
          </Typography.Text>
        )
      },
    },
  ]

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Audit Trail</h2>
        <Badge count={total} overflowCount={99999}
          style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Select className={styles.filterSelect} size="small" placeholder="Entity type" allowClear style={{ width: 180 }}
              value={entityType} onChange={v => { setEntityType(v); setPage(1) }}
              options={ENTITY_TYPES.map(t => ({ value: t, label: t }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Event type" allowClear style={{ width: 140 }}
              value={eventType} onChange={v => { setEventType(v); setPage(1) }}
              options={EVENT_TYPES.map(t => ({ value: t, label: t }))} />
            <Input className={styles.filterInput} size="small" placeholder="Performed by…"
              prefix={<SearchOutlined />} allowClear
              value={performedBy}
              onChange={e => setPerformedBy(e.target.value)} />
            <RangePicker className={styles.filterDateRange} size="small"
              onChange={(_, s) => { setDateRange(s[0] && s[1] ? [s[0], s[1]] : undefined); setPage(1) }} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
        </div>

        <Table<AuditTrailEntry>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{
            current: page, pageSize: PAGE_SIZE, total,
            size: 'small', showSizeChanger: false,
            onChange: p => setPage(p),
            showTotal: (t, [s, e]) => `${s}–${e} of ${t.toLocaleString()}`,
          }}
          scroll={{ x: 900 }}
        />
      </div>
    </div>
  )
}
