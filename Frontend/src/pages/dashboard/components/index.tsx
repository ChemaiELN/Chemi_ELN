import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Table, Tabs, Tooltip, Spin, Alert, Badge, message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ExperimentOutlined,
  DotChartOutlined,
  InboxOutlined,
  LineChartOutlined,
  SettingOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import Header from '@/common/Header'
import StatusTag from '@/common/StatusTag'
import { usePrivileges } from '@/common/PrivilegesContext'
import { PRIV, PROJECT_ACCESS_PRIVILEGES } from '@/utilities/privileges'
import {
  getDashboardCounts,
  getVerificationQueue,
  getApprovalQueue,
  getReworkInbox,
  getSLAAlerts,
  getMyActivity,
} from '@/utilities/chemiaApi'
import type {
  DashboardCounts,
  SLAAlerts,
  DashboardQueueItem,
  MyActivityItem,
} from '@/utilities/chemiaApi'
import styles from './styles.module.less'

// ─── Module cards config ──────────────────────────────────────────────────────

interface ModuleCard {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  path: string | null
  module: string | null
  iconColor: string
  iconBg: string
  anyAdmin?: boolean
}

const MODULE_CARDS: ModuleCard[] = [
  {
    id: 'adc',
    path: '/projects',
    module: 'adc',
    icon: <ExperimentOutlined />,
    title: 'ADC',
    subtitle: 'Antibody-drug conjugate experiments',
    iconColor: '#5aa3a1',
    iconBg: '#99f6e4',
  },
  {
    id: 'cgt',
    path: null,
    module: null,
    icon: <DotChartOutlined />,
    title: 'CGT',
    subtitle: 'Cell & gene therapy R&D',
    iconColor: '#7c3aed',
    iconBg: '#ddd6fe',
  },
  {
    id: 'inventory',
    path: '/inventory',
    module: 'inventory',
    icon: <InboxOutlined />,
    title: 'Inventory',
    subtitle: 'Lab materials & consumables',
    iconColor: '#0369a1',
    iconBg: '#bae6fd',
  },
  {
    id: 'stability',
    path: null,
    module: null,
    icon: <LineChartOutlined />,
    title: 'Stability',
    subtitle: 'Long-term stability studies',
    iconColor: '#b45309',
    iconBg: '#fde68a',
  },
  {
    id: 'admin',
    path: '/admin',
    module: 'admin',
    icon: <SettingOutlined />,
    title: 'Admin',
    subtitle: 'Users, roles & settings',
    iconColor: '#be123c',
    iconBg: '#fecdd3',
    anyAdmin: true,
  },
  {
    id: 'reports',
    path: null,
    module: null,
    icon: <BarChartOutlined />,
    title: 'Reports',
    subtitle: 'Analytical reports & exports',
    iconColor: '#059669',
    iconBg: '#a7f3d0',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    SUBMITTED: 'Submitted',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    APPROVED: 'Approved',
    UNLOCKED: 'Unlocked',
    REVISED: 'Revised',
    SAVED: 'Saved',
  }
  return map[action] ?? action
}

// ─── Table columns ────────────────────────────────────────────────────────────

const verificationCols: ColumnsType<DashboardQueueItem> = [
  {
    title: 'Code',
    dataIndex: 'full_code',
    width: 160,
    render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Title',
    dataIndex: 'title',
    ellipsis: true,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 180,
    render: (v) => <StatusTag status={v} />,
  },
  {
    title: 'Submitted At',
    dataIndex: 'submitted_to_at',
    width: 130,
    render: (v) => fmtDate(v),
  },
  {
    title: 'Pending (days)',
    dataIndex: 'submitted_to_at',
    width: 120,
    render: (v) => {
      const d = daysSince(v)
      return (
        <span style={{ color: d > 3 ? '#e11d48' : d > 1 ? '#d97706' : '#059669', fontWeight: 600 }}>
          {d}d
        </span>
      )
    },
  },
]

const approvalCols: ColumnsType<DashboardQueueItem> = [
  {
    title: 'Code',
    dataIndex: 'full_code',
    width: 160,
    render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Title',
    dataIndex: 'title',
    ellipsis: true,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    width: 130,
    render: (v) => <StatusTag status={v} />,
  },
  {
    title: 'Verified At',
    dataIndex: 'verified_at',
    width: 130,
    render: (v) => fmtDate(v),
  },
  {
    title: 'Pending (days)',
    dataIndex: 'verified_at',
    width: 120,
    render: (v) => {
      const d = daysSince(v)
      return (
        <span style={{ color: d > 5 ? '#e11d48' : d > 2 ? '#d97706' : '#059669', fontWeight: 600 }}>
          {d}d
        </span>
      )
    },
  },
]

const reworkCols: ColumnsType<DashboardQueueItem> = [
  {
    title: 'Code',
    dataIndex: 'full_code',
    width: 160,
    render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
  },
  {
    title: 'Title',
    dataIndex: 'title',
    ellipsis: true,
  },
  {
    title: 'Rejection Reason',
    dataIndex: 'rejection_reason',
    ellipsis: true,
    render: (v) => v ?? <span style={{ color: '#a8a29e' }}>—</span>,
  },
  {
    title: 'Rejected At',
    dataIndex: 'rejected_at',
    width: 130,
    render: (v) => fmtDate(v),
  },
]

const activityCols: ColumnsType<MyActivityItem> = [
  {
    title: 'Action',
    dataIndex: 'action',
    width: 130,
    render: (v) => <StatusTag status={v} label={actionLabel(v)} />,
  },
  {
    title: 'Experiment',
    dataIndex: 'experiment_id',
    ellipsis: true,
    render: (v) => <span style={{ fontSize: 12 }}>{v}</span>,
  },
  {
    title: 'Date',
    dataIndex: 'action_at',
    width: 130,
    render: (v) => fmtDate(v),
  },
]

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | undefined
  color: string
  icon: React.ReactNode
  loading?: boolean
}

function StatCard({ label, value, color, icon, loading }: StatCardProps) {
  return (
    <div className={styles.statCard} style={{ borderTop: `3px solid ${color}` }}>
      <div className={styles.statIcon} style={{ color }}>{icon}</div>
      <div className={styles.statBody}>
        <div className={styles.statValue}>
          {loading ? <Spin size="small" /> : (value ?? 0)}
        </div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { has, hasAny, hasAnyAdmin } = usePrivileges()

  const forbiddenShown = useRef(false)

  useEffect(() => {
    const forbidden = (location.state as { forbidden?: string } | null)?.forbidden
    if (!forbidden || forbiddenShown.current) return
    forbiddenShown.current = true
    message.warning('You do not have permission to access that page.')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const canVerify  = has(PRIV.EXPERIMENTS_VERIFY)
  const canApprove = has(PRIV.EXPERIMENTS_APPROVE)

  const visibleModuleCards = MODULE_CARDS.filter(card => {
    if (card.anyAdmin) return hasAnyAdmin()
    return true
  })

  const [counts,   setCounts]   = useState<DashboardCounts | null>(null)
  const [sla,      setSLA]      = useState<SLAAlerts | null>(null)
  const [verQueue, setVerQueue] = useState<DashboardQueueItem[]>([])
  const [appQueue, setAppQueue] = useState<DashboardQueueItem[]>([])
  const [rework,   setRework]   = useState<DashboardQueueItem[]>([])
  const [activity, setActivity] = useState<MyActivityItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [verTotal, setVerTotal] = useState(0)
  const [appTotal, setAppTotal] = useState(0)
  const [rewTotal, setRewTotal] = useState(0)
  const [verPage,  setVerPage]  = useState(1)
  const [appPage,  setAppPage]  = useState(1)
  const [rewPage,  setRewPage]  = useState(1)

  const PAGE_SIZE = 10

  const loadCounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s] = await Promise.all([getDashboardCounts(), getSLAAlerts()])
      setCounts(c)
      setSLA(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadVerQueue = useCallback(async (page: number) => {
    if (!canVerify) return
    try {
      const res = await getVerificationQueue({ page, page_size: PAGE_SIZE })
      setVerQueue(res.items)
      setVerTotal(res.total)
    } catch { /* silently fail */ }
  }, [canVerify])

  const loadAppQueue = useCallback(async (page: number) => {
    if (!canApprove) return
    try {
      const res = await getApprovalQueue({ page, page_size: PAGE_SIZE })
      setAppQueue(res.items)
      setAppTotal(res.total)
    } catch { /* silently fail */ }
  }, [canApprove])

  const loadRework = useCallback(async (page: number) => {
    try {
      const res = await getReworkInbox({ page, page_size: PAGE_SIZE })
      setRework(res.items)
      setRewTotal(res.total)
    } catch { /* silently fail */ }
  }, [])

  const loadActivity = useCallback(async () => {
    try {
      const res = await getMyActivity({ limit: 20 })
      setActivity(res.items)
    } catch { /* silently fail */ }
  }, [])

  useEffect(() => {
    loadCounts()
    loadVerQueue(1)
    loadAppQueue(1)
    loadRework(1)
    loadActivity()
  }, [loadCounts, loadVerQueue, loadAppQueue, loadRework, loadActivity])

  const handleCardClick = (card: ModuleCard) => {
    if (!card.path && card.id !== 'adc') return
    if (card.module) localStorage.setItem('chemia_module', card.module)
    localStorage.setItem('sidebar_collapsed', 'true')
    if (card.id === 'adc') {
      navigate(hasAny(PROJECT_ACCESS_PRIVILEGES) ? '/projects' : '/notebooks')
      return
    }
    if (card.path) navigate(card.path)
  }

  const onRowClick = (record: DashboardQueueItem) => ({
    onClick: () => {
      localStorage.setItem('chemia_module', 'adc')
      navigate(`/experiments/${record.id}`)
    },
    style: { cursor: 'pointer' },
  })

  const tabItems = [
    ...(canVerify ? [{
      key: 'verification',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          Verification Queue
          {verTotal > 0 && <Badge count={verTotal} size="small" style={{ marginLeft: 6, backgroundColor: '#d97706' }} />}
        </span>
      ),
      children: (
        <Table<DashboardQueueItem>
          rowKey="id"
          columns={verificationCols}
          dataSource={verQueue}
          size="small"
          pagination={{
            current: verPage,
            pageSize: PAGE_SIZE,
            total: verTotal,
            showTotal: (t) => `${t} experiments`,
            onChange: (p) => { setVerPage(p); loadVerQueue(p) },
          }}
          onRow={onRowClick}
          locale={{ emptyText: 'No experiments pending verification' }}
        />
      ),
    }] : []),
    ...(canApprove ? [{
      key: 'approval',
      label: (
        <span>
          <CheckCircleOutlined style={{ marginRight: 4 }} />
          Approval Queue
          {appTotal > 0 && <Badge count={appTotal} size="small" style={{ marginLeft: 6, backgroundColor: '#059669' }} />}
        </span>
      ),
      children: (
        <Table<DashboardQueueItem>
          rowKey="id"
          columns={approvalCols}
          dataSource={appQueue}
          size="small"
          pagination={{
            current: appPage,
            pageSize: PAGE_SIZE,
            total: appTotal,
            showTotal: (t) => `${t} experiments`,
            onChange: (p) => { setAppPage(p); loadAppQueue(p) },
          }}
          onRow={onRowClick}
          locale={{ emptyText: 'No experiments pending approval' }}
        />
      ),
    }] : []),
    {
      key: 'rework',
      label: (
        <span>
          <ReloadOutlined style={{ marginRight: 4 }} />
          Rework Inbox
          {rewTotal > 0 && <Badge count={rewTotal} size="small" style={{ marginLeft: 6, backgroundColor: '#e11d48' }} />}
        </span>
      ),
      children: (
        <Table<DashboardQueueItem>
          rowKey="id"
          columns={reworkCols}
          dataSource={rework}
          size="small"
          pagination={{
            current: rewPage,
            pageSize: PAGE_SIZE,
            total: rewTotal,
            showTotal: (t) => `${t} experiments`,
            onChange: (p) => { setRewPage(p); loadRework(p) },
          }}
          onRow={onRowClick}
          locale={{ emptyText: 'No experiments in rework' }}
        />
      ),
    },
    {
      key: 'activity',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 4 }} />
          My Recent Activity
        </span>
      ),
      children: (
        <Table<MyActivityItem>
          rowKey="id"
          columns={activityCols}
          dataSource={activity}
          size="small"
          pagination={false}
          locale={{ emptyText: 'No recent activity' }}
        />
      ),
    },
  ]

  const hasSLAAlerts = sla && (
    sla.overdue_in_progress > 0 ||
    sla.delayed_verification_requests > 0 ||
    sla.delayed_approvals > 0
  )

  const exp = counts?.experiments

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        {/* ── Module cards ── */}
        <section className={styles.moduleSection}>
          <div className={styles.moduleGrid}>
            {visibleModuleCards.map((card) => (
              <div
                key={card.id}
                className={`${styles.moduleCard} ${!card.path && card.id !== 'adc' ? styles.moduleCardDisabled : ''}`}
                onClick={() => handleCardClick(card)}
                role={card.path || card.id === 'adc' ? 'button' : undefined}
                tabIndex={card.path || card.id === 'adc' ? 0 : -1}
                onKeyDown={(e) => e.key === 'Enter' && handleCardClick(card)}
              >
                {!card.path && card.id !== 'adc' && <span className={styles.comingSoon}>Soon</span>}
                <div className={styles.moduleIcon} style={{ color: card.iconColor, background: card.iconBg }}>{card.icon}</div>
                <div className={styles.moduleTitle}>{card.title}</div>
                <div className={styles.moduleSubtitle}>{card.subtitle}</div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
