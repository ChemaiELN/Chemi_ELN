import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  Users, Building2, ShieldCheck, Settings,
  LayoutGrid, GitBranch, Database,
} from 'lucide-react'
import logo from '../../assets/logo.svg'
import smallLogo from '../../assets/small-logo.png'

type MenuItem = Required<MenuProps>['items'][number]

function makeItems(): MenuItem[] {
  return [
    {
      key: '/admin/users',
      icon: <Users size={15} />,
      label: 'Users',
    },
    {
      key: '/admin/departments',
      icon: <Building2 size={15} />,
      label: 'Departments',
    },
    {
      key: '/admin/role-privileges',
      icon: <ShieldCheck size={15} />,
      label: 'Roles',
    },
    {
      key: '/admin/workflow-templates',
      icon: <GitBranch size={15} />,
      label: 'Workflow Templates',
    },
    {
      key: '/admin/master-data',
      icon: <Database size={15} />,
      label: 'Master Data',
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

export default function AdminSidebar({ collapsed, onItemClick }: AdminSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

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

      {/* Back to modules */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'} py-2.5 mx-2 mt-2 rounded-xl text-slate-500 hover:text-purple-500 hover:bg-white/50 transition-colors text-xs font-medium`}
        title="All Modules"
      >
        <LayoutGrid size={14} className="shrink-0" />
        {!collapsed && <span>All Modules</span>}
      </button>

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
          items={makeItems()}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>
    </aside>
  )
}
