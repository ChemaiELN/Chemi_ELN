import { useEffect, useState } from 'react'
import { Drawer, Timeline, Tag, Typography, Spin, Empty, Select } from 'antd'
import {
  InboxOutlined, ArrowDownOutlined, AppstoreOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { BatchEvent } from '../../types'
import { getBatchEvents } from '@/api/inventoryApi'

const EVENT_ICON: Record<string, React.ReactNode> = {
  RECEIVED:  <InboxOutlined style={{ color: '#0d9488' }} />,
  ISSUED:    <ArrowDownOutlined style={{ color: '#d97706' }} />,
  ALLOCATED: <AppstoreOutlined style={{ color: '#7c3aed' }} />,
  VERIFIED:  <CheckCircleOutlined style={{ color: '#059669' }} />,
  REJECTED:  <CloseCircleOutlined style={{ color: '#e11d48' }} />,
  UPDATED:   <EditOutlined style={{ color: '#0369a1' }} />,
}

const EVENT_COLOR: Record<string, string> = {
  RECEIVED:  'cyan',
  ISSUED:    'orange',
  ALLOCATED: 'purple',
  VERIFIED:  'green',
  REJECTED:  'red',
  UPDATED:   'blue',
}

interface BatchEventsDrawerProps {
  batchId:  number | null
  batchNo:  string
  open:     boolean
  onClose:  () => void
}

export default function BatchEventsDrawer({ batchId, batchNo, open, onClose }: BatchEventsDrawerProps) {
  const [events,       setEvents]       = useState<BatchEvent[]>([])
  const [loading,      setLoading]      = useState(false)
  const [eventFilter,  setEventFilter]  = useState<string | undefined>()

  useEffect(() => {
    if (!open || batchId == null) return
    setLoading(true)
    getBatchEvents(batchId, eventFilter)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, batchId, eventFilter])

  const filtered = eventFilter ? events.filter(e => e.event_type === eventFilter) : events

  return (
    <Drawer
      title={`Events — ${batchNo}`}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Select
          size="small" allowClear placeholder="Filter type" style={{ width: 130 }}
          value={eventFilter} onChange={setEventFilter}
          options={['RECEIVED', 'ISSUED', 'ALLOCATED', 'VERIFIED', 'REJECTED', 'UPDATED']
            .map(t => ({ value: t, label: t }))}
        />
      }
    >
      <Spin spinning={loading}>
        {filtered.length === 0 && !loading ? (
          <Empty description="No events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={filtered.map(ev => ({
              dot: EVENT_ICON[ev.event_type] ?? <InboxOutlined />,
              children: (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={EVENT_COLOR[ev.event_type] ?? 'default'} style={{ margin: 0, fontSize: 11 }}>
                      {ev.event_type}
                    </Tag>
                    {ev.qty != null && (
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {ev.qty} units
                      </Typography.Text>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.7 }}>
                    {ev.issued_to   && <div><span style={{ color: '#a8a29e' }}>Issued to: </span>{ev.issued_to}</div>}
                    {ev.purpose     && <div><span style={{ color: '#a8a29e' }}>Purpose: </span>{ev.purpose}</div>}
                    {ev.project_code && <div><span style={{ color: '#a8a29e' }}>Project: </span>{ev.project_code}</div>}
                    {ev.ref_no      && <div><span style={{ color: '#a8a29e' }}>Ref: </span><span style={{ fontFamily: 'monospace' }}>{ev.ref_no}</span></div>}
                    {ev.module      && <div><span style={{ color: '#a8a29e' }}>Module: </span>{ev.module}</div>}
                    {ev.remarks     && <div><span style={{ color: '#a8a29e' }}>Remarks: </span>{ev.remarks}</div>}
                    <div style={{ color: '#a8a29e', marginTop: 2 }}>
                      {ev.performed_by ?? 'system'} · {ev.performed_at ? dayjs(ev.performed_at).format('DD MMM YYYY HH:mm') : '—'}
                    </div>
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Spin>
    </Drawer>
  )
}
