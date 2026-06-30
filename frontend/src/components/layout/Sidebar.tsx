import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import {
  LayoutDashboard,
  FlaskConical, Package2, ClipboardList, Wrench, BarChart3,
  LogOut, LayoutGrid, Factory, Cpu, Database, Link2,
  FileBarChart2, History,
} from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { clearAuth, selectUser } from '../../store/authSlice'
import { clearPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'

type MenuItem = Required<MenuProps>['items'][number]

function makeInventoryItems(): MenuItem[] {
  return [
    { key: '/inventory',                icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
    { key: '/inventory/materials',      icon: <FlaskConical size={15} />,    label: 'Materials' },
    { key: '/inventory/batches',        icon: <Package2 size={15} />,        label: 'Batches' },
    { key: '/inventory/stock-requests', icon: <ClipboardList size={15} />,   label: 'Stock Requests' },
    { key: '/inventory/verifications',  icon: <BarChart3 size={15} />,       label: 'Verifications' },
    { key: '/inventory/schedules',      icon: <Wrench size={15} />,          label: 'Schedules' },
    { key: '/inventory/manufacturers', icon: <Factory size={15} />,         label: 'Manufacturers' },
    { key: '/inventory/mappings',      icon: <Link2 size={15} />,           label: 'Mfr Mappings' },
    { key: '/inventory/equipment',     icon: <Cpu size={15} />,             label: 'Equipment' },
    { key: '/inventory/master-data',   icon: <Database size={15} />,        label: 'Master Data' },
    { key: '/inventory/reports',       icon: <FileBarChart2 size={15} />,   label: 'Reports' },
    { key: '/inventory/audit-trail',   icon: <History size={15} />,         label: 'Audit Trail' },
  ]
}

interface SidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function Sidebar({ collapsed, onItemClick }: SidebarProps) {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = useAppSelector(selectUser)

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    dispatch(clearAuth())
    dispatch(clearPrivileges())
    navigate('/login', { replace: true })
  }

  const handleSelect: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
    onItemClick?.()
  }

  const sidebarW = collapsed ? 'w-[64px]' : 'w-56'

  return (
    <aside
      className={`glass-sidebar flex flex-col ${sidebarW} min-h-screen shrink-0 transition-all duration-200 overflow-hidden`}
      style={{ position: 'relative' }}
    >
      {/* Brand */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} py-4 border-b border-white/40 shrink-0`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-400/30 shrink-0">
          <FlaskConical size={15} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-slate-800 font-bold text-sm leading-none truncate">Laurus ELN</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Chemia ELN v2</p>
          </div>
        )}
      </div>

      {/* Back to modules */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'} py-2.5 mx-2 mt-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-white/50 transition-colors text-xs font-medium`}
        title="All Modules"
      >
        <LayoutGrid size={14} className="shrink-0" />
        {!collapsed && <span>All Modules</span>}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">

        {/* Inventory section */}
        {!collapsed && (
          <p className="text-violet-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">Inventory</p>
        )}
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[location.pathname]}
          items={makeInventoryItems()}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>

      {/* User footer */}
      <div className="border-t border-white/40 px-3 py-2.5 shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">{user?.username?.slice(0, 2).toUpperCase() ?? 'U'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold">{user?.username?.slice(0, 2).toUpperCase() ?? 'U'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-slate-700 text-xs font-semibold truncate leading-tight">{user?.username}</p>
              <p className="text-slate-400 text-[10px] truncate">{user?.role_name}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50/50 shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
