import { useState, useMemo, useCallback } from 'react'
import { Tooltip } from 'antd'
import {
  AppstoreOutlined,
  FolderOutlined,
  SettingOutlined,
  AuditOutlined,
  BookOutlined,
  UnlockOutlined,
  HddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExperimentOutlined,
  ProfileOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  RightOutlined,
  DownOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePrivileges } from '@/common/PrivilegesContext'
import { PRIV, PROJECT_ACCESS_PRIVILEGES, type PrivilegeKey } from '@/utilities/privileges'
import styles from './styles.module.less'

interface NavAccess {
  privileges?: PrivilegeKey[]
  anyAdmin?: boolean
  hideForRoles?: string[]
}

interface SubItem extends NavAccess {
  key: string
  label: string
  path: string
}

interface SidebarItem extends NavAccess {
  key: string
  icon: React.ReactNode
  label: string
  path: string
  children?: SubItem[]
}

const ADC_ITEMS: SidebarItem[] = [
  { key: 'project',      icon: <FolderOutlined />,     label: 'Project',         path: '/projects', privileges: [...PROJECT_ACCESS_PRIVILEGES] },
  { key: 'lookup2',      icon: <BookOutlined />,       label: 'Notebook',        path: '/notebooks' },
  { key: 'experiments',  icon: <ExperimentOutlined />, label: 'Experiments',     path: '/experiments', hideForRoles: ['CHEM'] },
  // { key: 'unlock',       icon: <UnlockOutlined />,     label: 'Unlock Requests', path: '/experiments/unlock' },
  // {
  //   key: 'atr',
  //   icon: <ProfileOutlined />,
  //   label: 'ATR',
  //   path: '/atr',
  //   children: [
  //     { key: 'atr-project', label: 'Project ATRs',          path: '/atr/project-atrs',          privileges: [PRIV.ATR_ASSIGN] },
  //     { key: 'atr-pending', label: 'Pending Clarification', path: '/atr/pending-clarification', privileges: [PRIV.ATR_ASSIGN] },
  //     { key: 'atr-my',      label: 'My ATRs',               path: '/atr/my-atrs' },
  //   ],
  // },
  { key: 'audit-trail', icon: <AuditOutlined />,      label: 'Audit Trail', path: '/admin/audit' },
  // { key: 'reports',     icon: <BarChartOutlined />,   label: 'Reports',     path: '/reports' },
  // { key: 'lookup',      icon: <SettingOutlined />,    label: 'Settings',    path: '/settings' },
]

const ADMIN_ITEMS: SidebarItem[] = [
  { key: 'admin-home',  icon: <AppstoreOutlined />, label: 'Admin Home', path: '/admin', anyAdmin: true },
  { key: 'admin-users', icon: <ProfileOutlined />,  label: 'Users',      path: '/admin/users', privileges: [PRIV.USERS_MANAGE] },
  {
    key: 'master-data',
    icon: <HddOutlined />,
    label: 'Master Data',
    path: '/admin/master-data/chemicals',
    privileges: [PRIV.MASTER_DATA_MANAGE],
    children: [
      { key: 'master-chemicals',   label: 'Chemicals',   path: '/admin/master-data/chemicals',   privileges: [PRIV.MASTER_DATA_MANAGE] },
      { key: 'master-instruments', label: 'Instruments', path: '/admin/master-data/instruments', privileges: [PRIV.MASTER_DATA_MANAGE] },
      { key: 'master-sites',       label: 'Sites',       path: '/admin/master-data/sites',       privileges: [PRIV.MASTER_DATA_MANAGE] },
    ],
  },
  {
    key: 'role-privileges',
    icon: <SafetyCertificateOutlined />,
    label: 'Role Privileges',
    path: '/admin/role-privileges',
    privileges: [PRIV.ADMIN_ROLE_PRIVS],
  },
  {
    key: 'workflow-templates',
    icon: <AppstoreAddOutlined />,
    label: 'Experiment Templates',
    path: '/admin/workflow-templates',
    privileges: [PRIV.ADMIN_SETTINGS],
  },
  { key: 'audit-trail-admin', icon: <AuditOutlined />,   label: 'Audit Trail', path: '/admin/audit' },
  { key: 'lookup',            icon: <SettingOutlined />, label: 'Settings',    path: '/settings' },
]

function canSeeNav(
  item: NavAccess,
  hasAny: (keys: (PrivilegeKey | string)[]) => boolean,
  hasAnyAdmin: () => boolean,
  role: string,
): boolean {
  if (item.hideForRoles?.includes(role)) return false
  if (item.anyAdmin) return hasAnyAdmin()
  if (item.privileges?.length) return hasAny(item.privileges)
  return true
}

function filterSidebarItems(
  items: SidebarItem[],
  hasAny: (keys: (PrivilegeKey | string)[]) => boolean,
  hasAnyAdmin: () => boolean,
  role: string,
): SidebarItem[] {
  return items.reduce<SidebarItem[]>((acc, item) => {
    if (item.children?.length) {
      const children = item.children.filter(c => canSeeNav(c, hasAny, hasAnyAdmin, role))
      if (children.length === 0) return acc
      if (!canSeeNav(item, hasAny, hasAnyAdmin, role) && children.every(c => c.privileges?.length)) {
        acc.push({ ...item, children })
        return acc
      }
      if (children.length > 0) {
        acc.push({ ...item, children })
      }
      return acc
    }
    if (canSeeNav(item, hasAny, hasAnyAdmin, role)) acc.push(item)
    return acc
  }, [])
}

interface SidebarProps {
  activeKey?: string
}

function resolveCurrentKey(items: SidebarItem[], pathname: string, activeKey?: string): string | undefined {
  if (activeKey) return activeKey
  for (const item of items) {
    if (item.children) {
      const sub = item.children.find(c => pathname.startsWith(c.path))
      if (sub) return sub.key
    }
    if (pathname.startsWith(item.path) && item.path !== '/') return item.key
  }
  return undefined
}

export default function Sidebar({ activeKey }: SidebarProps) {
  const [collapsed, setCollapsedState] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true')
  const { hasAny, hasAnyAdmin, role } = usePrivileges()

  const setCollapsed = (val: boolean) => {
    localStorage.setItem('sidebar_collapsed', String(val))
    setCollapsedState(val)
  }
  const navigate = useNavigate()
  const location = useLocation()

  const activeModule = localStorage.getItem('chemia_module') ?? 'adc'
  const sourceItems = activeModule === 'admin' ? ADMIN_ITEMS : ADC_ITEMS
  const items = useMemo(
    () => filterSidebarItems(sourceItems, hasAny, hasAnyAdmin, role),
    [sourceItems, hasAny, hasAnyAdmin, role],
  )

  const currentKey = resolveCurrentKey(items, location.pathname, activeKey)

  const initialOpen = useMemo(() => {
    return items.reduce<Record<string, boolean>>((acc, item) => {
      if (item.children) {
        acc[item.key] = item.children.some(
          c => c.key === currentKey || location.pathname.startsWith(c.path),
        )
      }
      return acc
    }, {})
  }, [items, currentKey, location.pathname])

  const [openParents, setOpenParents] = useState<Record<string, boolean>>(initialOpen)

  const isParentActive = useCallback((item: SidebarItem) => {
    if (currentKey === item.key) return true
    if (item.children) return item.children.some(c => c.key === currentKey)
    return location.pathname.startsWith(item.path)
  }, [currentKey, location.pathname])

  const toggleParent = (key: string) => {
    setOpenParents(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleNavigate = (item: SidebarItem) => {
    if (item.path === '/dashboard') localStorage.removeItem('chemia_module')
    navigate(item.path)
    setCollapsed(true)
  }

  const expandAndOpen = (key: string) => {
    setCollapsed(false)
    setOpenParents(prev => ({ ...prev, [key]: true }))
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <button
        className={styles.collapseBtn}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </button>

      <nav className={styles.nav}>
        {items.map(item => {
          const hasChildren = !!item.children?.length
          const parentActive = isParentActive(item)

          if (!hasChildren) {
            const btn = (
              <button
                key={item.key}
                className={`${styles.topItem} ${parentActive ? styles.active : ''}`}
                onClick={() => handleNavigate(item)}
              >
                <span className={styles.groupIcon}>{item.icon}</span>
                {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
              </button>
            )

            if (collapsed) {
              return (
                <div key={item.key} className={styles.group}>
                  <Tooltip title={item.label} placement="right">
                    {btn}
                  </Tooltip>
                </div>
              )
            }
            return btn
          }

          const isOpen = !!openParents[item.key]

          if (collapsed) {
            return (
              <div key={item.key} className={styles.group}>
                <Tooltip title={item.label} placement="right">
                  <button
                    className={`${styles.groupHeader} ${parentActive ? styles.groupHeaderActive : ''}`}
                    onClick={() => expandAndOpen(item.key)}
                  >
                    <span className={styles.groupIcon}>{item.icon}</span>
                  </button>
                </Tooltip>
              </div>
            )
          }

          return (
            <div key={item.key} className={styles.group}>
              <button
                className={`${styles.groupHeader} ${parentActive ? styles.groupHeaderActive : ''}`}
                onClick={() => toggleParent(item.key)}
              >
                <span className={styles.groupIcon}>{item.icon}</span>
                <span className={styles.groupTitle}>{item.label}</span>
                <span className={styles.groupArrow}>
                  {isOpen ? <DownOutlined /> : <RightOutlined />}
                </span>
              </button>

              {isOpen && (
                <div className={styles.subItems}>
                  {item.children!.map(sub => {
                    const isActive = currentKey === sub.key
                    return (
                      <button
                        key={sub.key}
                        className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        onClick={() => { navigate(sub.path); setCollapsed(true) }}
                      >
                        <RightOutlined className={styles.subArrow} />
                        <span className={styles.navLabel}>{sub.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
