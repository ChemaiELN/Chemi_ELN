import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal, Dropdown } from 'antd'
import { Menu as MenuIcon, ChevronRight, ChevronDown, LogOut, LayoutGrid, ShieldCheck, Package2, Atom, Dna } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { clearAuth, selectUser } from '../../store/authSlice'
import { clearPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { glassModalProps } from '../../utils/modalStyles'

// Mirrors the QA/QC-only gate on the Administration module card in
// ModuleSelectorPage.tsx / app/shared/privileges.py (ADMIN_MODULE_DEPARTMENT_CODES).
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']

const MODULES = [
  { key: 'admin', label: 'Administration', href: '/admin/users', icon: ShieldCheck, color: 'text-purple-500' },
  { key: 'inventory', label: 'Inventory', href: '/inventory', icon: Package2, color: 'text-emerald-500' },
  { key: 'adc', label: 'ADC', href: '/adc/projects', icon: Atom, color: 'text-indigo-500' },
  { key: 'cgt', label: 'CGT', href: '/cgt/projects', icon: Dna, color: 'text-teal-500' },
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

  const handleLogout = async () => {
    setConfirmOpen(false)
    try { await authApi.logout() } catch { /* ignore */ }
    dispatch(clearAuth())
    dispatch(clearPrivileges())
    navigate('/login', { replace: true })
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'U'
  const canSeeAdmin = ADMIN_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const visibleModules = MODULES.filter(m => m.key !== 'admin' || canSeeAdmin)

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
      <div className={breadcrumbs.length > 0 ? 'shrink-0' : 'ml-auto shrink-0'}>
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
