import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Table, Tag } from 'antd'
import {
  HomeOutlined,
  TeamOutlined,
  SafetyOutlined,
  ApartmentOutlined,
  BankOutlined,
  SettingOutlined,
  FileExcelOutlined,
  BellOutlined,
  AuditOutlined,
  UserOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import { getUsers, getDepartments, getAuditLog, type AuditLogEntry } from '@/utilities/chemiaApi'

interface StatCard {
  icon: React.ReactNode
  label: string
  value: number
}

interface QuickCard {
  icon: React.ReactNode
  title: string
  description: string
  path: string
}

interface ActivityRow {
  key: string
  performedBy: string
  action: string
  target: string
  dateTime: string
}

const STAT_CARDS_BASE: Omit<StatCard, 'value'>[] = [
  { icon: <TeamOutlined />, label: 'Total Users' },
  { icon: <BankOutlined />, label: 'Departments' },
  { icon: <SafetyOutlined />, label: 'Active Roles' },
  { icon: <AppstoreOutlined />, label: 'Templates' },
]

const QUICK_CARDS: QuickCard[] = [
  { icon: <TeamOutlined />, title: 'User Management', description: 'Manage system users and accounts', path: '/admin/users' },
  { icon: <SafetyOutlined />, title: 'Role Privileges', description: 'Configure module-level permissions', path: '/admin/roles' },
  { icon: <ApartmentOutlined />, title: 'Role Management', description: 'Create and manage user roles', path: '/admin/roles-list' },
  { icon: <BankOutlined />, title: 'Departments', description: 'Manage organizational departments', path: '/admin/departments' },
  { icon: <SettingOutlined />, title: 'Company Settings', description: 'Configure company-wide settings', path: '/admin/company' },
  { icon: <FileExcelOutlined />, title: 'Excel Templates', description: 'Upload and manage ATR templates', path: '/admin/templates' },
  { icon: <BellOutlined />, title: 'Notification Settings', description: 'Set up system notifications', path: '/admin/notifications' },
  { icon: <AuditOutlined />, title: 'System Audit Trail', description: 'View all system activity logs', path: '/admin/audit' },
]

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'User Created': { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  'Role Updated': { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
  'User Disabled': { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  'Template Uploaded': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Dept. Created': { bg: '#f0fdfa', text: '#5aa3a1', border: '#99f6e4' },
}

function mapAuditToActivity(e: AuditLogEntry, idx: number): ActivityRow {
  return {
    key: e.id ?? String(idx),
    performedBy: e.username,
    action: e.action,
    target: e.target_label ?? e.target_id ?? e.target_type ?? '—',
    dateTime: e.created_at ? new Date(e.created_at).toLocaleString() : '—',
  }
}

const ACTIVITY_COLS: ColumnsType<ActivityRow> = [
  {
    title: 'PERFORMED BY',
    dataIndex: 'performedBy',
    key: 'performedBy',
    render: (v: string) => (
      <span className={styles.userCell}>
        <UserOutlined className={styles.userIcon} />
        {v}
      </span>
    ),
  },
  {
    title: 'ACTION',
    dataIndex: 'action',
    key: 'action',
    render: (v: string) => {
      const c = ACTION_COLORS[v]
      return c ? (
        <Tag style={{ background: c.bg, color: c.text, borderColor: c.border, fontWeight: 500 }}>{v}</Tag>
      ) : (
        <Tag>{v}</Tag>
      )
    },
  },
  { title: 'TARGET', dataIndex: 'target', key: 'target' },
  { title: 'DATE & TIME', dataIndex: 'dateTime', key: 'dateTime', className: styles.dateCol },
]

export default function AdminDashboardPage() {
  const navigate = useNavigate()

  // ── Real counts ──────────────────────────────────────────────────────────
  const [statValues, setStatValues] = useState([0, 0, 4, 0])
  const [activityRows, setActivityRows] = useState<ActivityRow[]>([])

  useEffect(() => {
    // user count
    getUsers({ page: 1, page_size: 1 })
      .then(r => setStatValues(prev => { const n = [...prev]; n[0] = r.total; return n }))
      .catch(() => {})
    // department count
    getDepartments()
      .then(list => setStatValues(prev => { const n = [...prev]; n[1] = list.length; return n }))
      .catch(() => {})
    // recent audit activity
    getAuditLog({ page: 1, page_size: 8 })
      .then(r => setActivityRows(r.items.map(mapAuditToActivity)))
      .catch(() => {})
  }, [])

  const STAT_CARDS: StatCard[] = STAT_CARDS_BASE.map((s, i) => ({ ...s, value: statValues[i] }))

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="master-data" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <HomeOutlined className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')} />
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Admin</span>
          </div>

          <h1 className={styles.pageTitle}>Admin Dashboard</h1>

          {/* Stat cards */}
          <div className={styles.statRow}>
            {STAT_CARDS.map((s) => (
              <div key={s.label} className={styles.statCard}>
                <div className={styles.statIcon}>{s.icon}</div>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className={styles.sectionTitle}>Quick Access</div>
          <div className={styles.quickGrid}>
            {QUICK_CARDS.map((c) => (
              <div
                key={c.path}
                className={styles.quickCard}
                onClick={() => navigate(c.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(c.path)}
              >
                <div className={styles.quickIcon}>{c.icon}</div>
                <div className={styles.quickTitle}>{c.title}</div>
                <div className={styles.quickDesc}>{c.description}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <span className={styles.tableCardTitle}>Recent Admin Activity</span>
            </div>
            <Table<ActivityRow>
              columns={ACTIVITY_COLS}
              dataSource={activityRows}
              pagination={false}
              size="small"
              className={styles.table}
              locale={{ emptyText: 'No recent activity' }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
