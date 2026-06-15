import { useState, useMemo, useCallback } from 'react'
import { Tooltip, Modal, Form, Input, message, Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import {
  AppstoreOutlined,
  FolderOutlined,
  SettingOutlined,
  AuditOutlined,
  BookOutlined,
  HddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExperimentOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  RightOutlined,
  DownOutlined,
  AppstoreAddOutlined,
  ApartmentOutlined,
  HomeOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePrivileges } from '@/common/PrivilegesContext'
import { PRIV, PROJECT_ACCESS_PRIVILEGES, type PrivilegeKey } from '@/utilities/privileges'
import { useAppDispatch } from '@/store/hooks'
import { logout as logoutAction } from '@/pages/login/redux/slice'
import { logout as logoutAPI, changePassword } from '@/utilities/chemiaApi'
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

// Tree items are rendered separately with connecting lines
const ADC_TREE_ITEMS = [
  { key: 'project',     icon: <FolderOutlined />,     label: 'Project',     path: '/projects', privileges: [...PROJECT_ACCESS_PRIVILEGES] },
  { key: 'lookup2',     icon: <BookOutlined />,        label: 'Notebook',    path: '/notebooks' },
  { key: 'experiments', icon: <ExperimentOutlined />,  label: 'Experiments', path: '/experiments', hideForRoles: ['CHEM'] },
] as const

const ADC_OTHER_ITEMS: SidebarItem[] = [
  { key: 'audit-trail', icon: <AuditOutlined />, label: 'Audit Trail', path: '/admin/audit' },
]

const ADMIN_ITEMS: SidebarItem[] = [
  { key: 'admin-home',  icon: <AppstoreOutlined />, label: 'Admin Home', path: '/admin', anyAdmin: true },
  { key: 'admin-users', icon: <ProfileOutlined />,  label: 'Users',      path: '/admin/users', privileges: [PRIV.USERS_MANAGE] },
  { key: 'admin-departments', icon: <ApartmentOutlined />, label: 'Departments', path: '/admin/departments', anyAdmin: true },
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
      if (children.length > 0) acc.push({ ...item, children })
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
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // ── Change password modal ──────────────────────────────────────────────────
  const [cpOpen, setCpOpen]     = useState(false)
  const [cpLoading, setCpLoading] = useState(false)
  const [form] = Form.useForm()

  const handleCPSubmit = async (values: { current_password: string; new_password: string; confirm_password: string }) => {
    setCpLoading(true)
    try {
      await changePassword(values.current_password, values.new_password)
      message.success('Password changed successfully')
      setCpOpen(false)
      form.resetFields()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password'
      form.setFields([{ name: 'current_password', errors: [msg] }])
    } finally {
      setCpLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await logoutAPI() } catch { /* clear session anyway */ }
    dispatch(logoutAction())
    navigate('/login')
  }

  // ── User info ──────────────────────────────────────────────────────────────
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}') } catch { return {} }
  })()
  const displayName: string = storedUser?.display_name ?? storedUser?.username ?? 'User'
  const userRole: string    = storedUser?.role ?? ''

  const profileMenu: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '2px 0', cursor: 'default' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1c1917' }}>{displayName}</div>
          {userRole && <div style={{ fontSize: 11, color: '#78716c', marginTop: 1 }}>{userRole}</div>}
        </div>
      ),
    },
    { type: 'divider' },
    { key: 'change-password', label: 'Change Password' },
    { type: 'divider' },
    { key: 'logout', label: <span style={{ color: '#e11d48' }}><LogoutOutlined style={{ marginRight: 6 }} />Logout</span> },
  ]
  const handleProfileMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'change-password') setCpOpen(true)
    if (key === 'logout') handleLogout()
  }

  const setCollapsed = (val: boolean) => {
    localStorage.setItem('sidebar_collapsed', String(val))
    setCollapsedState(val)
  }

  const activeModule = localStorage.getItem('chemia_module') ?? 'adc'
  const sourceItems  = activeModule === 'admin' ? ADMIN_ITEMS : ADC_OTHER_ITEMS
  const items = useMemo(
    () => filterSidebarItems(sourceItems, hasAny, hasAnyAdmin, role),
    [sourceItems, hasAny, hasAnyAdmin, role],
  )

  // Resolve active key across tree items + regular items
  const allPaths = [
    ...ADC_TREE_ITEMS.map(i => ({ key: i.key, path: i.path })),
    ...items.map(i => ({ key: i.key, path: i.path })),
  ]
  const currentKey = activeKey ?? allPaths.find(i => location.pathname.startsWith(i.path) && i.path !== '/')?.key

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

  const handleNavigate = (path: string) => {
    if (path === '/dashboard') localStorage.removeItem('chemia_module')
    navigate(path)
    setCollapsed(true)
  }

  const expandAndOpen = (key: string) => {
    setCollapsed(false)
    setOpenParents(prev => ({ ...prev, [key]: true }))
  }

  const wrapWithTooltip = (label: string, node: React.ReactNode) => (
    <Tooltip title={label} placement="right" mouseEnterDelay={0.25}>
      <span className={styles.tooltipTrigger}>{node}</span>
    </Tooltip>
  )

  // ── Tree item visibility ───────────────────────────────────────────────────
  const visibleTreeItems = ADC_TREE_ITEMS.filter(i =>
    canSeeNav(i as NavAccess, hasAny, hasAnyAdmin, role)
  )
  const showProject     = visibleTreeItems.some(i => i.key === 'project')
  const showNotebook    = visibleTreeItems.some(i => i.key === 'lookup2')
  const showExperiments = visibleTreeItems.some(i => i.key === 'experiments')

  return (
    <>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        {/* Collapse toggle */}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>

        <nav className={styles.nav}>
          {/* ── Home ── */}
          {(() => {
            const btn = (
              <button
                className={`${styles.topItem} ${location.pathname === '/dashboard' ? styles.active : ''}`}
                onClick={() => handleNavigate('/dashboard')}
              >
                <span className={styles.groupIcon}><HomeOutlined /></span>
                {!collapsed && <span className={styles.navLabel}>Home</span>}
              </button>
            )
            return collapsed ? wrapWithTooltip('Home', btn) : btn
          })()}

          {/* ── Project → Notebook → Experiments tree ── */}
          {activeModule !== 'admin' && (
            collapsed ? (
              // Collapsed: show as plain icon buttons
              <>
                {showProject && wrapWithTooltip('Project',
                  <button className={`${styles.topItem} ${currentKey === 'project' ? styles.active : ''}`}
                    onClick={() => handleNavigate('/projects')}>
                    <span className={styles.groupIcon}><FolderOutlined /></span>
                  </button>
                )}
                {showNotebook && wrapWithTooltip('Notebook',
                  <button className={`${styles.topItem} ${currentKey === 'lookup2' ? styles.active : ''}`}
                    onClick={() => handleNavigate('/notebooks')}>
                    <span className={styles.groupIcon}><BookOutlined /></span>
                  </button>
                )}
                {showExperiments && wrapWithTooltip('Experiments',
                  <button className={`${styles.topItem} ${currentKey === 'experiments' ? styles.active : ''}`}
                    onClick={() => handleNavigate('/experiments')}>
                    <span className={styles.groupIcon}><ExperimentOutlined /></span>
                  </button>
                )}
              </>
            ) : (
              // Expanded: tree view with connecting lines
              <div className={styles.treeGroup}>
                {showProject && (
                  <button
                    className={`${styles.topItem} ${currentKey === 'project' ? styles.active : ''}`}
                    onClick={() => handleNavigate('/projects')}
                  >
                    <span className={styles.groupIcon}><FolderOutlined /></span>
                    <span className={styles.navLabel}>Project</span>
                  </button>
                )}

                {(showNotebook || showExperiments) && (
                  <div className={styles.treeBranch}>
                    {showNotebook && (
                      <div className={styles.treeRow}>
                        <button
                          className={`${styles.treeChildBtn} ${currentKey === 'lookup2' ? styles.active : ''}`}
                          onClick={() => handleNavigate('/notebooks')}
                        >
                          <span className={styles.groupIcon}><BookOutlined /></span>
                          <span className={styles.navLabel}>Notebook</span>
                        </button>
                      </div>
                    )}

                    {showExperiments && (
                      <div className={styles.treeBranch}>
                        <div className={styles.treeRow}>
                          <button
                            className={`${styles.treeChildBtn} ${currentKey === 'experiments' ? styles.active : ''}`}
                            onClick={() => handleNavigate('/experiments')}
                          >
                            <span className={styles.groupIcon}><ExperimentOutlined /></span>
                            <span className={styles.navLabel}>Experiments</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* ── Other items (Audit Trail etc.) ── */}
          {items.map(item => {
            const hasChildren = !!item.children?.length
            const parentActive = isParentActive(item)

            if (!hasChildren) {
              const btn = (
                <button
                  key={item.key}
                  className={`${styles.topItem} ${parentActive ? styles.active : ''}`}
                  onClick={() => handleNavigate(item.path)}
                  title={item.label}
                >
                  <span className={styles.groupIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </button>
              )
              if (collapsed) return <div key={item.key} className={styles.group}>{wrapWithTooltip(item.label, btn)}</div>
              return btn
            }

            const isOpen = !!openParents[item.key]
            if (collapsed) {
              return (
                <div key={item.key} className={styles.group}>
                  {wrapWithTooltip(item.label, (
                    <button
                      className={`${styles.groupHeader} ${parentActive ? styles.groupHeaderActive : ''}`}
                      onClick={() => expandAndOpen(item.key)}
                    >
                      <span className={styles.groupIcon}>{item.icon}</span>
                    </button>
                  ))}
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

        {/* ── Profile section at bottom ── */}
        <div className={styles.profileSection}>
          <Dropdown
            menu={{ items: profileMenu, onClick: handleProfileMenu }}
            trigger={['click']}
            placement="topRight"
          >
            <button className={styles.profileBtn} title={displayName}>
              <span className={styles.profileAvatar}><UserOutlined /></span>
              {!collapsed && (
                <span className={styles.profileInfo}>
                  <span className={styles.profileName}>{displayName}</span>
                  {userRole && <span className={styles.profileRole}>{userRole}</span>}
                </span>
              )}
              {!collapsed && <DownOutlined className={styles.profileChevron} />}
            </button>
          </Dropdown>
        </div>
      </aside>

      {/* Change Password Modal */}
      <Modal
        title="Change Password"
        open={cpOpen}
        onCancel={() => { setCpOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Update Password"
        confirmLoading={cpLoading}
        width={440}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCPSubmit} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="current_password" label="Current Password" rules={[{ required: true, message: 'Enter your current password' }]}>
            <Input.Password placeholder="Current password" />
          </Form.Item>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true }, { min: 8, message: 'At least 8 characters' }]}>
            <Input.Password placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirm_password" label="Confirm New Password"
            dependencies={['new_password']}
            rules={[{ required: true }, ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('new_password') === value) return Promise.resolve()
                return Promise.reject(new Error('Passwords do not match'))
              },
            })]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
