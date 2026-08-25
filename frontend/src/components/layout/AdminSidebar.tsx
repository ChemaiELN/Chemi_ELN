import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  Users, Building2, ShieldCheck, Settings,
  Database, FlaskConical, Hash, UsersRound, KeyRound, History, LayoutDashboard, LayoutTemplate,
} from 'lucide-react'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'

type MenuItem = Required<MenuProps>['items'][number]

function makeItems(): MenuItem[] {
  return [
    {
      key: '/admin/dashboard',
      icon: <LayoutDashboard size={15} />,
      label: 'Dashboard',
    },
    {
      key: '/admin/users',
      icon: <Users size={15} />,
      label: 'Users',
    },
    {
      key: 'admin-department-role',
      icon: <Building2 size={15} />,
      label: 'Department/Role',
      children: [
        {
          key: '/admin/departments',
          icon: <Building2 size={15} />,
          label: 'Departments',
        },
        {
          key: '/admin/roles',
          icon: <ShieldCheck size={15} />,
          label: 'Roles',
        },
        {
          key: '/admin/department-users',
          icon: <UsersRound size={15} />,
          label: 'Department Users',
        },
        {
          key: '/admin/department-role-privileges',
          icon: <KeyRound size={15} />,
          label: 'Role Privileges',
        },
        {
          key: '/admin/labs',
          icon: <FlaskConical size={15} />,
          label: 'Labs',
        },
      ],
    },
    {
      key: '/admin/master-data',
      icon: <Database size={15} />,
      label: 'Master Data',
    },
    {
      key: '/admin/template-settings',
      icon: <LayoutTemplate size={15} />,
      label: 'Template Settings',
    },
    {
      key: '/admin/id-sequences',
      icon: <Hash size={15} />,
      label: 'ID Numbering',
    },
    {
      key: '/admin/audit-trail',
      icon: <History size={15} />,
      label: 'Audit Trail',
    },
    { type: 'divider' } as MenuItem,
    {
      key: '/admin/settings',
      icon: <Settings size={15} />,
      label: 'Settings',
    },
  ]
}

interface AdminSidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

const DEPT_ROLE_CHILD_KEYS = [
  '/admin/departments',
  '/admin/roles',
  '/admin/department-users',
  '/admin/department-role-privileges',
  '/admin/labs',
]

export default function AdminSidebar({ collapsed, onItemClick }: AdminSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  const defaultOpenKeys = DEPT_ROLE_CHILD_KEYS.includes(location.pathname) ? ['admin-department-role'] : []

  const sidebarW = collapsed ? 'w-[64px]' : 'w-56'

  return (
    <aside className={`glass-sidebar flex flex-col ${sidebarW} min-h-screen shrink-0 transition-all duration-200 overflow-hidden`}>

      {/* Brand */}
      <div
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} border-b border-white/40 shrink-0`}
        style={{ height: 52, backgroundColor: '#FEFEFA' }}
      >
        <img
          src={collapsed ? smallLogo : logo}
          alt="Logo"
          className={collapsed ? 'h-8 w-8 object-contain' : 'h-9 w-auto object-contain'}
        />
      </div>

      {/* Section label */}
      {!collapsed && (
        <p className="text-purple-300 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">Admin</p>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[location.pathname]}
          defaultOpenKeys={defaultOpenKeys}
          items={makeItems()}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>
    </aside>
  )
}
