import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Modal, Dropdown, Badge, Tooltip } from 'antd'
import { Menu as MenuIcon, ChevronRight, ChevronDown, LogOut, LayoutGrid, ShieldCheck, Package2, Atom, Dna, FlaskConical, Bell } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { clearAuth, selectUser, selectLoginTime } from '../../store/authSlice'
import { clearPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { ardOpsApi } from '../../api/ard'
import { glassModalProps } from '../../utils/modalStyles'

// Mirrors the gate in AdminProtectedRoute — QA/QC department users OR SUPER_ADMIN.
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']
// ADC and CGT are each scoped to their own department — a user only ever
// works in one, so the module switcher shouldn't advertise the other.
// QA is included for ADC because QA department users are the ones who create
// ADC projects (see AdcProjectsPage's canCreate check) — they need the module.
const ADC_MODULE_DEPARTMENT_CODES = ['ADC_PD', 'QA']
const CGT_MODULE_DEPARTMENT_CODES = ['CGT', 'QA']

// ARD is backed by the existing AD department; keep this in sync with the
// module selector and backend ARD department gate.
const ARD_MODULE_DEPARTMENT_CODES = ['AD', 'QA']

const MODULES = [
  { key: 'admin', label: 'Administration', href: '/admin/dashboard', icon: ShieldCheck, color: 'text-purple-500' },
  { key: 'inventory', label: 'Inventory', href: '/inventory', icon: Package2, color: 'text-emerald-500' },
  { key: 'adc', label: 'ADC', href: '/adc/projects', icon: Atom, color: 'text-indigo-500' },
  { key: 'cgt', label: 'CGT', href: '/cgt/projects', icon: Dna, color: 'text-teal-500' },
  { key: 'ard', label: 'ARD', href: '/ard', icon: FlaskConical, color: 'text-emerald-500' },
]
// Floating draggable profile pill — replaced by the inline logout at the
// top-right of the header below. Kept mounted only on the module selector page.
// import UserProfileMenu from './UserProfileMenu'

interface BreadcrumbItem {
  label: string
  href?: string
}
interface HeaderProps {
  onToggle: () => void
  isMobile?: boolean
  breadcrumbs?: BreadcrumbItem[]
}

export default function Header({ onToggle, isMobile = false, breadcrumbs = [] }: HeaderProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const loginTime = useAppSelector(selectLoginTime)

  const handleLogout = async () => {
    setConfirmOpen(false)
    try { await authApi.logout() } catch { /* ignore */ }
    dispatch(clearAuth())
    dispatch(clearPrivileges())
    navigate('/login', { replace: true })
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'U'
  const isSuperAdmin = user?.role_code === 'SUPER_ADMIN'
  const canSeeAdmin = isSuperAdmin || ADMIN_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const canSeeAdc   = isSuperAdmin || ADC_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const canSeeCgt   = isSuperAdmin || CGT_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const canSeeArd   = isSuperAdmin || ARD_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const visibleModules = MODULES.filter(m =>
    (m.key !== 'admin' || canSeeAdmin) &&
    (m.key !== 'adc'   || canSeeAdc) &&
    (m.key !== 'cgt'   || canSeeCgt) &&
    (m.key !== 'ard'   || canSeeArd)
  )

  const { data: unreadNotifCount } = useQuery({
    queryKey: ['header-notifications-count'],
    queryFn: async () => {
      try {
        const res = await ardOpsApi.notifications()
        return (res?.items || []).filter((n: any) => !n.read).length
      } catch {
        return 0
      }
    },
    refetchInterval: 60000, // SSE handles immediate updates; this is the fallback poll
  })

  return (
    <header className="flex items-center gap-3 px-4 shrink-0" style={{ height: 52, backgroundColor: '#FEFEFA' }}>
      {isMobile && (
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-white/60 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <MenuIcon size={17} />
        </button>
      )}

      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
          {breadcrumbs.map((bc, i) => {
            const isLast = i === breadcrumbs.length - 1
            return (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                {isLast || !bc.href ? (
                  <span className={isLast ? 'text-violet-700 font-semibold truncate' : 'text-slate-400 truncate hidden sm:block'}>
                    {bc.label}
                  </span>
                ) : (
                  <Link
                    to={bc.href}
                    className="text-slate-400 truncate hidden sm:block hover:text-violet-600 transition-colors"
                  >
                    {bc.label}
                  </Link>
                )}
              </span>
            )
          })}
        </nav>
      )}

      {/* Module switcher — quick navigation between Administration/Inventory/ADC/CGT */}
      <div className={`flex items-center gap-3 ${breadcrumbs.length > 0 ? 'shrink-0' : 'ml-auto shrink-0'}`}>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          dropdownRender={() => (
            <div className="min-w-[190px] rounded-xl bg-white shadow-lg shadow-violet-200/40 border border-slate-100 overflow-hidden py-1">
              {visibleModules.map(m => {
                const Icon = m.icon
                return (
                  <Link
                    key={m.key}
                    to={m.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:text-violet-700 hover:bg-violet-50/60 transition-colors"
                  >
                    <Icon size={15} className={m.color} />
                    {m.label}
                  </Link>
                )
              })}
            </div>
          )}
        >
          <button
            type="button"
            aria-label="Switch module"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-slate-600 text-[13px] font-medium hover:text-violet-600 hover:bg-white/60 transition-colors cursor-pointer"
          >
            <LayoutGrid size={15} />
            Modules
            <ChevronDown size={13} />
          </button>
        </Dropdown>

        {/* Name + Login time */}
        {user && (
          <>
            <div className="hidden sm:block h-5 w-px bg-slate-200" />
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-slate-700">{user.username}</span>
              {loginTime && (
                <span className="text-[10px] text-slate-400">
                  Login At {new Date(loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bell Notification Icon */}
      <div className="shrink-0 flex items-center">
        <Tooltip title="Notifications">
          <button
            type="button"
            onClick={() => navigate('/ard/notifications')}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-all cursor-pointer relative"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {!!unreadNotifCount && unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-xs leading-none">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
        </Tooltip>
      </div>

      {/* Avatar pinned top-right; hover reveals a dropdown with username, dept, logout */}
      <div className="shrink-0">
        <Dropdown
          trigger={['hover']}
          placement="bottomRight"
          dropdownRender={() => (
            <div className="min-w-[190px] rounded-xl bg-white shadow-lg shadow-violet-200/40 border border-slate-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-slate-700 text-sm font-semibold truncate leading-tight">{user?.username}</p>
                <p className="text-slate-400 text-xs truncate">{user?.department_name || user?.role_name}</p>
              </div>
              <button
                onClick={() => setConfirmOpen(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-red-500 hover:bg-red-50/60 transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        >
          <button
            type="button"
            aria-label="Profile menu"
            className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </button>
        </Dropdown>
      </div>

      {/* Floating profile pill — commented out in favour of the inline logout above.
      <UserProfileMenu /> */}

      <Modal
        title="Sign out"
        open={confirmOpen}
        onOk={handleLogout}
        onCancel={() => setConfirmOpen(false)}
        okText="Sign out"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        centered
        closable={false}
        {...glassModalProps}
      >
        <p className="text-sm text-slate-600">Are you sure you want to sign out?</p>
      </Modal>
    </header>
  )
}
