import { useEffect, useState } from 'react'
import { Drawer, Timeline, Tag, Spin, Empty } from 'antd'
import {
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  CheckOutlined, StopOutlined, EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { StockRequestEvent } from '../../types'
import { getStockRequestEvents } from '@/api/inventoryApi'

const EVENT_ICON: Record<string, React.ReactNode> = {
  SUBMITTED: <SendOutlined      style={{ color: '#4a9290' }} />,
  APPROVED:  <CheckCircleOutlined style={{ color: '#059669' }} />,
  REJECTED:  <CloseCircleOutlined style={{ color: '#e11d48' }} />,
  FULFILLED: <CheckOutlined     style={{ color: '#7c3aed' }} />,
  CANCELLED: <StopOutlined      style={{ color: '#78716c' }} />,
  UPDATED:   <EditOutlined      style={{ color: '#0369a1' }} />,
}

const EVENT_COLOR: Record<string, string> = {
  SUBMITTED: 'cyan',
  APPROVED:  'green',
  REJECTED:  'red',
  FULFILLED: 'purple',
  CANCELLED: 'default',
  UPDATED:   'blue',
}

interface StockRequestEventsDrawerProps {
  requestId:  number | null
  requestNo:  string
  open:       boolean
  onClose:    () => void
}

export default function StockRequestEventsDrawer({
  requestId, requestNo, open, onClose,
}: StockRequestEventsDrawerProps) {
  const [events,  setEvents]  = useState<StockRequestEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || requestId == null) return
    setLoading(true)
    getStockRequestEvents(requestId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, requestId])

  return (
    <Drawer
      title={`Events — ${requestNo}`}
      open={open} onClose={onClose} width={420}
    >
      <Spin spinning={loading}>
        {events.length === 0 && !loading ? (
          <Empty description="No events" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={events.map(ev => ({
              dot: EVENT_ICON[ev.event_type] ?? <SendOutlined />,
              children: (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Tag color={EVENT_COLOR[ev.event_type] ?? 'default'} style={{ margin: 0, fontSize: 11 }}>
                      {ev.event_type}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#57534e', lineHeight: 1.7 }}>
                    {ev.remarks && <div><span style={{ color: '#a8a29e' }}>Remarks: </span>{ev.remarks}</div>}
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
