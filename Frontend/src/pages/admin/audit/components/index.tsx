import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Tag, Button, Input, Select, DatePicker, message,
} from 'antd'
import {
  HomeOutlined, SearchOutlined, ExportOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import { getAuditLog, type AuditLogEntry } from '@/utilities/chemiaApi'

const { RangePicker } = DatePicker

// ── Row shape ─────────────────────────────────────────────────────────────────

interface AuditRow {
  key: string
  id: string
  timestamp: string
  username: string
  module: string
  action: string
  targetType: string
  targetLabel: string
  detail: string
  ipAddress: string
}

function mapEntry(e: AuditLogEntry): AuditRow {
  return {
    key:         e.id,
    id:          e.id,
    timestamp:   e.created_at,
    username:    e.username,
    module:      e.module,
    action:      e.action,
    targetType:  e.target_type ?? '—',
    targetLabel: e.target_label ?? e.target_id ?? '—',
    detail:      e.detail ?? '—',
    ipAddress:   e.ip_address ?? '—',
  }
}

// ── Options ───────────────────────────────────────────────────────────────────

const MODULE_OPTIONS = [
  'AUTH', 'USER', 'DEPARTMENT', 'PROJECT', 'NOTEBOOK', 'EXPERIMENT', 'ATR', 'ADMIN',
].map(v => ({ value: v, label: v }))

const ACTION_OPTIONS = [
  'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE',
  'SUBMIT', 'VERIFY', 'APPROVE', 'REJECT', 'UNLOCK', 'VOID',
].map(v => ({ value: v, label: v }))

// ── Tag colours ───────────────────────────────────────────────────────────────

const MODULE_STYLE: Record<string, React.CSSProperties> = {
  AUTH:       { background: '#eff6ff', color: '#1d4ed8', border: 'none' },
  USER:       { background: '#ecfeff', color: '#0e7490', border: 'none' },
  DEPARTMENT: { background: '#eef2ff', color: '#4338ca', border: 'none' },
  PROJECT:    { background: '#faf5ff', color: '#7e22ce', border: 'none' },
  NOTEBOOK:   { background: '#fdf4ff', color: '#a21caf', border: 'none' },
  EXPERIMENT: { background: '#fff7ed', color: '#c2410c', border: 'none' },
  ATR:        { background: '#fefce8', color: '#a16207', border: 'none' },
  ADMIN:      { background: '#fff1f2', color: '#be123c', border: 'none' },
}

const ACTION_STYLE: Record<string, React.CSSProperties> = {
  LOGIN:       { background: '#f0fdf4', color: '#15803d', border: 'none' },
  LOGOUT:      { background: '#f5f5f4', color: '#57534e', border: 'none' },
  CREATE:      { background: '#f0fdf4', color: '#15803d', border: 'none' },
  UPDATE:      { background: '#eff6ff', color: '#1d4ed8', border: 'none' },
  DELETE:      { background: '#fff1f2', color: '#be123c', border: 'none' },
  ACTIVATE:    { background: '#f0fdf4', color: '#15803d', border: 'none' },
  DEACTIVATE:  { background: '#fefce8', color: '#a16207', border: 'none' },
  SUBMIT:      { background: '#eff6ff', color: '#1d4ed8', border: 'none' },
  VERIFY:      { background: '#ecfeff', color: '#0e7490', border: 'none' },
  APPROVE:     { background: '#f0fdf4', color: '#15803d', border: 'none' },
  REJECT:      { background: '#fff1f2', color: '#be123c', border: 'none' },
  UNLOCK:      { background: '#fff7ed', color: '#c2410c', border: 'none' },
  VOID:        { background: '#f5f5f4', color: '#57534e', border: 'none' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const navigate = useNavigate()

  const [rows, setRows]       = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const pageSize = 20


  // Filters
  const [module_, setModule]     = useState<string | undefined>()
  const [action_, setAction]     = useState<string | undefined>()
  const [search, setSearch]      = useState('')
  const [targetType, setTargetType] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null)

  const loadLog = useCallback((p = page) => {
    setLoading(true)
    const params: Record<string, string | number | undefined> = {
      page: p,
      page_size: pageSize,
    }
    if (module_)         params.module      = module_
    if (action_)         params.action      = action_
    if (search)          params.username    = search
    if (targetType)      params.target_type = targetType
    if (dateRange?.[0])  params.date_from   = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1])  params.date_to     = dateRange[1].format('YYYY-MM-DD')

    getAuditLog(params as Parameters<typeof getAuditLog>[0])
      .then(resp => {
        setRows(resp.items.map(mapEntry))
        setTotal(resp.total)
      })
      .catch(() => message.error('Failed to load audit log'))
      .finally(() => setLoading(false))
  }, [page, module_, action_, search, targetType, dateRange])

  useEffect(() => { loadLog(1); setPage(1) }, [module_, action_, targetType, dateRange])
  useEffect(() => { loadLog(page) }, [page])

  const handleSearch = () => { setPage(1); loadLog(1) }

  const handleClear = () => {
    setModule(undefined)
    setAction(undefined)
    setSearch('')
    setTargetType(undefined)
    setDateRange(null)
    setPage(1)
  }

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnsType<AuditRow> = [
    {
      title: '#', key: 'idx', width: 44,
      render: (_: unknown, __: AuditRow, i: number) => (page - 1) * pageSize + i + 1,
    },
    {
      title: 'Timestamp', dataIndex: 'timestamp', key: 'timestamp', width: 155,
      render: (v: string) => (
        <span className={styles.monoCell}>
          {new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })}
        </span>
      ),
    },
    {
      title: 'User', dataIndex: 'username', key: 'username', width: 130,
      render: (v: string) => <span className={styles.userCell}>{v}</span>,
    },
    {
      title: 'Module', dataIndex: 'module', key: 'module', width: 110,
      render: (v: string) => (
        <Tag style={{ ...MODULE_STYLE[v] ?? {}, fontWeight: 600, fontSize: 11, borderRadius: 4 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Action', dataIndex: 'action', key: 'action', width: 120,
      render: (v: string) => (
        <Tag style={{ ...ACTION_STYLE[v] ?? {}, fontWeight: 500, fontSize: 11, borderRadius: 4 }}>
          {v}
        </Tag>
      ),
    },
    { title: 'Target Type',  dataIndex: 'targetType',  key: 'targetType',  width: 110,
      render: (v: string) => <span className={styles.dimCell}>{v}</span> },
    { title: 'Target',       dataIndex: 'targetLabel', key: 'targetLabel',
      render: (v: string) => <span className={styles.targetCell}>{v}</span> },
    { title: 'Detail',       dataIndex: 'detail',      key: 'detail', ellipsis: true,
      render: (v: string) => <span className={styles.detailCell}>{v}</span> },
    { title: 'IP Address',   dataIndex: 'ipAddress',   key: 'ipAddress', width: 135,
      render: (v: string) => <span className={styles.monoCell}>{v}</span> },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="admin" />
        <main className={styles.main}>

          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <HomeOutlined
              className={styles.breadHome}
              onClick={() => navigate('/dashboard')}
            />
            <span className={styles.breadSep}>/</span>
            <span
              className={styles.breadLink}
              onClick={() => navigate('/admin')}
            >
              Admin
            </span>
            <span className={styles.breadSep}>/</span>
            <span className={styles.breadCurrent}>Audit Log</span>
          </div>

          {/* Filter card */}
          <div className={styles.filterCard}>
            <div className={styles.filterGrid}>
              <div>
                <div className={styles.filterLabel}>Username / Keyword</div>
                <Input
                  placeholder="Search user or keyword"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onPressEnter={handleSearch}
                  size="small"
                  allowClear
                />
              </div>
              <div>
                <div className={styles.filterLabel}>Module</div>
                <Select
                  placeholder="All modules"
                  options={MODULE_OPTIONS}
                  value={module_}
                  onChange={setModule}
                  allowClear
                  style={{ width: '100%' }}
                  size="small"
                />
              </div>
              <div>
                <div className={styles.filterLabel}>Action</div>
                <Select
                  placeholder="All actions"
                  options={ACTION_OPTIONS}
                  value={action_}
                  onChange={setAction}
                  allowClear
                  style={{ width: '100%' }}
                  size="small"
                />
              </div>
            </div>

            <div className={styles.filterGrid} style={{ marginTop: '0.625rem' }}>
              <div>
                <div className={styles.filterLabel}>Target Type</div>
                <Input
                  placeholder="e.g. experiment"
                  value={targetType ?? ''}
                  onChange={e => setTargetType(e.target.value || undefined)}
                  size="small"
                  allowClear
                />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <div className={styles.filterLabel}>Date Range</div>
                <RangePicker
                  value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
                  onChange={v => setDateRange(v as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
                  size="small"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className={styles.filterActions}>
              <Button
                size="small"
                icon={<SearchOutlined />}
                className={styles.searchBtn}
                onClick={handleSearch}
              >
                Search
              </Button>
              <Button
                size="small"
                className={styles.clearBtn}
                onClick={handleClear}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>

            {/* Card header */}
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                <span>Audit Log</span>
                <span className={styles.countBadge}>{total} entries</span>
              </div>

              <div className={styles.tableCardActions}>
                <Button
                  size="small"
                  icon={<ExportOutlined />}
                  className={styles.exportBtn}
                >
                  Export
                </Button>
              </div>
            </div>

            {/* Table */}
            <Table<AuditRow>
              className={styles.table}
              columns={columns}
              dataSource={rows}
              loading={loading}
              size="small"
              scroll={{ x: 1200 }}
              pagination={{
                current: page,
                total,
                pageSize,
                showSizeChanger: false,
                showTotal: t => `${t} log entries`,
                onChange: p => setPage(p),
              }}
            />
          </div>

        </main>
      </div>
    </div>
  )
}
