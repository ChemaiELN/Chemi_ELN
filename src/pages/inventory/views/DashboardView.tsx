import React, { useState, useEffect, useCallback } from 'react'
import { Table, Tag, Badge, Spin, Button, Select, Alert, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ReloadOutlined, ExperimentOutlined, InboxOutlined,
  AlertOutlined, ClockCircleOutlined, SafetyCertificateOutlined,
  ToolOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { DashboardKpis, Batch, ExpiringBatch, PendingAction } from '../types'
import {
  getInventoryKpis, getBatches, getExpiringSoon, getPendingActions,
} from '@/api/inventoryApi'
import styles from './styles.module.less'

// ─── Summary section config ───────────────────────────────────────────────────

interface MiniStat {
  key: keyof DashboardKpis
  label: string
  icon: React.ReactNode
  danger?: boolean
  warn?: boolean
}

interface SummarySection {
  title: string
  stats: MiniStat[]
}

const SUMMARY_SECTIONS: SummarySection[] = [
  {
    title: 'INVENTORY SUMMARY',
    stats: [
      { key: 'batches_low_stock',     label: 'Low Stock',      icon: <AlertOutlined />,       warn: true  },
      { key: 'batches_expired',       label: 'Batch Expired',  icon: <WarningOutlined />,     danger: true },
      { key: 'batches_expiring_30d',  label: 'Due To Expire',  icon: <ClockCircleOutlined />, warn: true  },
      { key: 'stock_requests_critical', label: 'Critical Stock', icon: <ExperimentOutlined />, danger: true },
    ],
  },
  {
    title: 'EQUIPMENT SUMMARY',
    stats: [
      { key: 'maintenance_due',  label: 'Maint. Due',     icon: <ToolOutlined />,             warn: true },
      { key: 'calibration_due',  label: 'Calib. Due',     icon: <ToolOutlined />,             warn: true },
      { key: 'stock_requests_pending', label: 'Pending Requests', icon: <InboxOutlined />,    warn: true },
    ],
  },
  {
    title: 'VERIFICATION REQUESTS',
    stats: [
      { key: 'verifications_pending', label: 'Pending',     icon: <SafetyCertificateOutlined />, warn: true },
      { key: 'batches_available',     label: 'Batches OK',  icon: <InboxOutlined />             },
      { key: 'materials',             label: 'Materials',   icon: <ExperimentOutlined />         },
    ],
  },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
    AVAILABLE:         { label: 'AVAILABLE',          color: '#059669', bg: '#f0fdf4', border: '#6ee7b7' },
    PARTIALLY_CONSUMED:{ label: 'PARTIALLY CONSUMED', color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
    CONSUMED:          { label: 'CONSUMED',            color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
    EXPIRED:           { label: 'EXPIRED',             color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
    QUARANTINE:        { label: 'QUARANTINE',          color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd' },
  }
  const s = cfg[status] ?? { label: status, color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.03em',
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ─── Available stock table columns ────────────────────────────────────────────

const stockCols: ColumnsType<Batch> = [
  {
    title: 'MATERIAL NAME',
    dataIndex: 'material_name',
    render: (v) => <span style={{ fontWeight: 500, color: '#1c1917' }}>{v ?? '—'}</span>,
  },
  {
    title: 'MANUFACTURER',
    dataIndex: 'manufacturer_name',
    width: 150,
    render: (v) => <span style={{ color: '#44403c' }}>{v ?? <span style={{ color: '#a8a29e' }}>—</span>}</span>,
  },
  {
    title: 'BATCH #',
    dataIndex: 'batch_no',
    width: 160,
    render: (v) => <span style={{ fontSize: 12, color: '#57534e' }}>{v}</span>,
  },
  {
    title: 'STATUS',
    dataIndex: 'status',
    width: 185,
    render: (v) => <StatusBadge status={v} />,
  },
  {
    title: 'AVAILABLE QTY',
    key: 'qty',
    width: 140,
    align: 'right',
    render: (_, r) => (
      <span>
        <strong style={{ color: '#1c1917' }}>{Number(r.qty_available).toFixed(3)}</strong>
        {' '}
        <span style={{ fontSize: 11, color: '#78716c', fontStyle: 'italic' }}>{r.unit}</span>
      </span>
    ),
  },
  {
    title: 'EXPIRY',
    dataIndex: 'expiry_date',
    width: 120,
    render: (v) => {
      if (!v) return <span style={{ color: '#a8a29e' }}>—</span>
      const diff = dayjs(v).diff(dayjs(), 'day')
      const color = diff < 0 ? '#e11d48' : diff < 90 ? '#d97706' : '#44403c'
      return <span style={{ color, fontWeight: 500 }}>{dayjs(v).format('DD-MMM-YYYY')}</span>
    },
  },
]

// ─── Expiring table columns ───────────────────────────────────────────────────

const expiringCols: ColumnsType<ExpiringBatch> = [
  {
    title: 'BATCH #',
    dataIndex: 'batch_no',
    width: 120,
    render: (v) => <span style={{ fontSize: 12 }}>{v}</span>,
  },
  {
    title: 'MATERIAL',
    dataIndex: 'material_name',
    render: (v) => <strong>{v}</strong>,
  },
  {
    title: 'QTY',
    key: 'qty',
    width: 90,
    align: 'right',
    render: (_, r) => `${r.qty_available} ${r.unit}`,
  },
  {
    title: 'EXPIRY',
    dataIndex: 'expiry_date',
    width: 120,
    render: (v) => <span style={{ color: '#d97706', fontWeight: 500 }}>{dayjs(v).format('DD-MMM-YYYY')}</span>,
  },
  {
    title: 'DAYS LEFT',
    dataIndex: 'days_to_expiry',
    width: 90,
    align: 'center',
    render: (v) => <Badge count={v} color={v <= 14 ? '#e11d48' : '#d97706'} overflowCount={999} />,
  },
]

// ─── Priority / category colours ──────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = { HIGH: 'red', MEDIUM: 'orange', LOW: 'blue' }
const CATEGORY_TAG: Record<string, string> = {
  STOCK_REQUEST: 'gold', BATCH_VERIFICATION: 'blue',
  EQUIP_VERIFICATION: 'purple', INSTR_VERIFICATION: 'geekblue',
  MAINTENANCE: 'orange', CALIBRATION: 'cyan',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardView() {
  const [kpis,     setKpis]     = useState<DashboardKpis | null>(null)
  const [stock,    setStock]    = useState<Batch[]>([])
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([])
  const [actions,  setActions]  = useState<PendingAction[]>([])
  const [loading,  setLoading]  = useState(false)
  const [expiryDays, setExpiryDays] = useState(60)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      getInventoryKpis(),
      getBatches({ category: 'available', is_active: true }),
      getExpiringSoon(expiryDays),
      getPendingActions(),
    ])
      .then(([k, s, e, a]) => { setKpis(k); setStock(s); setExpiring(e); setActions(a) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [expiryDays])

  useEffect(() => { load() }, [load])

  const statColor = (stat: MiniStat, value: number) => {
    if (stat.danger && value > 0) return '#e11d48'
    if (stat.warn   && value > 0) return '#d97706'
    return '#5aa3a1'
  }

  return (
    <Spin spinning={loading}>
      <div className={styles.dashWrap}>

        {/* ── Page header ── */}
        <div className={styles.dashHeader}>
          <span className={styles.dashTitle}>Dashboard</span>
          <Button size="small" className={styles.refreshBtn} icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
        </div>

        {/* ── Three summary sections ── */}
        {kpis && (
          <div className={styles.summaryRow}>
            {SUMMARY_SECTIONS.map((section) => (
              <div key={section.title} className={styles.summaryCard}>
                <div className={styles.summaryCardTitle}>{section.title}</div>
                <div className={styles.miniStatsGrid}>
                  {section.stats.map((stat) => {
                    const card  = kpis[stat.key]
                    const color = statColor(stat, card.value)
                    return (
                      <div key={stat.key} className={styles.miniStat}>
                        <span className={styles.miniStatIcon} style={{ color }}>{stat.icon}</span>
                        <span className={styles.miniStatValue} style={{ color }}>{card.value}</span>
                        <span className={styles.miniStatLabel}>{stat.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Available Stock Overview ── */}
        <div className={`${styles.tableCard} ${styles.stockTable}`}>
          <div className={styles.tableCardHeader}>
            <span className={styles.tableCardTitle}>
              <InboxOutlined style={{ marginRight: 6, color: '#5aa3a1' }} />
              Available Stock Overview
            </span>
            <span className={styles.tableCardCount}>{stock.length} record{stock.length !== 1 ? 's' : ''}</span>
          </div>
          <Table<Batch>
            rowKey="id"
            size="small"
            dataSource={stock}
            columns={stockCols}
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
            scroll={{ x: 800 }}
          />
        </div>

        {/* ── Bottom row: Pending Actions + Expiring Batches ── */}
        <div className={styles.bottomRow}>
          {/* Pending actions */}
          <div className={styles.tableCard} style={{ flex: '0 0 35%' }}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>
                <AlertOutlined style={{ marginRight: 6, color: '#d97706' }} />
                Pending Actions
              </span>
              <Tag>{actions.length} items</Tag>
            </div>
            {actions.length === 0 ? (
              <Empty description="No pending actions" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div className={styles.actionList}>
                {actions.map((a, i) => {
                  const priorityBorder: Record<string, string> = {
                    HIGH: '#e11d48', MEDIUM: '#d97706', LOW: '#0369a1',
                  }
                  const border = priorityBorder[a.priority] ?? '#a8a29e'
                  return (
                    <div key={i} className={styles.actionItem} style={{ borderLeft: `3px solid ${border}` }}>
                      <div className={styles.actionTop}>
                        <span className={styles.actionDesc}>{a.description}</span>
                        <span className={styles.actionPriority} style={{ color: border }}>{a.priority}</span>
                      </div>
                      <div className={styles.actionMeta}>
                        <Tag color={CATEGORY_TAG[a.category] ?? 'default'} style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>
                          {a.category.replace(/_/g, ' ')}
                        </Tag>
                        <span className={styles.actionRef}>{a.ref_no}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Expiring batches */}
          <div className={styles.tableCard} style={{ flex: 1 }}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>
                <ClockCircleOutlined style={{ marginRight: 6, color: '#d97706' }} />
                Expiring Batches
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  size="small"
                  value={expiryDays}
                  onChange={setExpiryDays}
                  style={{ width: 120 }}
                  options={[
                    { value: 30,  label: 'Next 30 days' },
                    { value: 60,  label: 'Next 60 days' },
                    { value: 90,  label: 'Next 90 days' },
                    { value: 180, label: 'Next 6 months' },
                  ]}
                />
                <Tag>{expiring.length} batches</Tag>
              </div>
            </div>
            {expiring.length === 0 ? (
              <Alert type="success" message="No batches expiring in this window" showIcon />
            ) : (
              <Table<ExpiringBatch>
                rowKey="batch_id"
                size="small"
                dataSource={expiring}
                columns={expiringCols}
                pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                scroll={{ x: 540 }}
              />
            )}
          </div>
        </div>

      </div>
    </Spin>
  )
}
