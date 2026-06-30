import { useNavigate, useLocation } from 'react-router-dom'
import { Menu } from 'antd'
import type { MenuProps } from 'antd'
import { Atom, FolderOpen, LayoutGrid, LogOut, BookOpen, FlaskConical, FileText } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { clearAuth, selectUser } from '../../store/authSlice'

const CHEMIST_ROLE = 'CHEM'
import { clearPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'

type MenuItem = Required<MenuProps>['items'][number]

function makeAdcItems(roleCode?: string): MenuItem[] {
  const isChemist = roleCode === CHEMIST_ROLE
  const items: MenuItem[] = []
  if (isChemist) {
    items.push({ key: '/adc/my-notebooks', icon: <BookOpen size={15} />, label: 'My Notebooks' })
  } else {
    items.push(
      { key: '/adc/projects',    icon: <FolderOpen size={15} />,   label: 'Projects' },
      { key: '/notebooks',       icon: <BookOpen size={15} />,     label: 'Notebooks' },
      { key: '/adc/experiments', icon: <FlaskConical size={15} />, label: 'Experiments' },
      { key: '/adc/reports',     icon: <FileText size={15} />,     label: 'Reports' },
    )
  }
  return items
}

interface AdcSidebarProps {
  collapsed: boolean
  onItemClick?: () => void
}

export default function AdcSidebar({ collapsed, onItemClick }: AdcSidebarProps) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user     = useAppSelector(selectUser)

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

  // Highlight active nav item based on current path
  const selectedKey = location.pathname.startsWith('/adc/my-notebooks')
    ? '/adc/my-notebooks'
    : location.pathname.startsWith('/notebooks')
      ? '/notebooks'
      : location.pathname.startsWith('/adc/reports')
        ? '/adc/reports'
        : location.pathname.startsWith('/adc/experiments')
          ? '/adc/experiments'
          : location.pathname.startsWith('/adc/projects')
            ? '/adc/projects'
            : '/adc'

  const sidebarW = collapsed ? 'w-[64px]' : 'w-56'

  return (
    <aside
      className={`glass-sidebar flex flex-col ${sidebarW} min-h-screen shrink-0 transition-all duration-200 overflow-hidden`}
      style={{ position: 'relative' }}
    >
      {/* Brand */}
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'} py-4 border-b border-white/40 shrink-0`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-500 shadow-md shadow-indigo-500/30 shrink-0">
          <Atom size={15} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-slate-800 font-bold text-sm leading-none truncate">ADC Module</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Laurus ELN</p>
          </div>
        )}
      </div>

      {/* Back to modules */}
      <button
        onClick={() => navigate('/')}
        className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'} py-2.5 mx-2 mt-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-white/50 transition-colors text-xs font-medium`}
        title="All Modules"
      >
        <LayoutGrid size={14} className="shrink-0" />
        {!collapsed && <span>All Modules</span>}
      </button>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {!collapsed && (
          <p className="text-indigo-500/80 text-[10px] font-bold uppercase tracking-widest px-5 mb-1 mt-3">ADC</p>
        )}
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={makeAdcItems(user?.role_code)}
          onClick={handleSelect}
          style={{ background: 'transparent', border: 'none', fontSize: 13, width: '100%' }}
          inlineIndent={12}
        />
      </div>

      {/* User footer */}
      <div className="border-t border-white/40 px-3 py-2.5 shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center">
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
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center shrink-0">
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
