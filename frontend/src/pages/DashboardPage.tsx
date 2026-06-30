import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Package2, Users, Building2, Database, Settings, FlaskConical, ChevronRight, Lock } from 'lucide-react'
import { useAppSelector } from '../store'
import { selectUser } from '../store/authSlice'
import { selectCan } from '../store/privilegesSlice'

const ADMIN_ITEMS = [
  { icon: <Users size={13} />, label: 'Users' },
  { icon: <Building2 size={13} />, label: 'Departments' },
  { icon: <ShieldCheck size={13} />, label: 'Role Privileges' },
  { icon: <Settings size={13} />, label: 'Settings' },
  { icon: <Database size={13} />, label: 'Master Data' },
]

const INVENTORY_ITEMS = [
  { icon: <FlaskConical size={13} />, label: 'Materials' },
  { icon: <Package2 size={13} />, label: 'Batches' },
  { icon: <Database size={13} />, label: 'Equipment' },
  { icon: <FlaskConical size={13} />, label: 'Instruments' },
  { icon: <ShieldCheck size={13} />, label: 'Reports' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const canAdmin = useAppSelector(selectCan('users.manage'))

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">

      {/* Welcome banner */}
      <div className="glass-card rounded-2xl px-5 py-4 mb-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30 shrink-0">
          <FlaskConical size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-500 text-xs">{greeting}</p>
          <h1 className="text-slate-800 font-bold text-lg leading-tight truncate">{user?.username ?? '—'}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs bg-purple-100/80 text-purple-700 border border-purple-200/50 rounded-full px-2 py-0.5 font-medium">
              {user?.role_name ?? '—'}
            </span>
            {user?.department_name && (
              <span className="text-xs text-slate-400">{user.department_name}</span>
            )}
          </div>
        </div>
        <div className="ml-auto text-right hidden sm:block">
          <p className="text-xs text-slate-400">Phase</p>
          <p className="text-sm font-bold text-purple-600">A3 Active</p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

        {/* Admin card */}
        <div
          onClick={() => canAdmin && navigate('/admin/users')}
          className={`glass-card rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 ${
            canAdmin
              ? 'cursor-pointer hover:shadow-2xl hover:shadow-purple-300/40 hover:-translate-y-0.5 hover:bg-white/60'
              : 'opacity-70'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/30 shrink-0">
                <ShieldCheck size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base leading-tight">Administration</h2>
                <p className="text-xs text-slate-500 mt-0.5">Phase A1 – A3</p>
              </div>
            </div>
            {canAdmin ? (
              <ChevronRight size={16} className="text-purple-400 mt-0.5" />
            ) : (
              <Lock size={14} className="text-slate-300 mt-0.5" />
            )}
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {ADMIN_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-600 text-xs">
                <span className="text-purple-400 shrink-0">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-2 border-t border-white/50">
            {canAdmin ? (
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/admin/users') }}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors"
              >
                Open Admin <ChevronRight size={12} />
              </button>
            ) : (
              <p className="text-xs text-slate-400 italic">No admin privileges</p>
            )}
          </div>
        </div>

        {/* Inventory card */}
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 opacity-70">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
                <Package2 size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-base leading-tight">Inventory</h2>
                <p className="text-xs text-slate-500 mt-0.5">Phase B2 – B5</p>
              </div>
            </div>
            <span className="text-[10px] bg-amber-100 text-amber-600 border border-amber-200/60 rounded-full px-2 py-0.5 font-medium shrink-0">
              Coming Soon
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {INVENTORY_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="text-emerald-400 shrink-0">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-2 border-t border-white/50">
            <p className="text-xs text-slate-400 italic">Available in Phase B</p>
          </div>
        </div>
      </div>

      {/* Quick links row */}
      {canAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Users', path: '/admin/users', icon: <Users size={16} />, color: 'from-purple-500 to-purple-600' },
            { label: 'Departments', path: '/admin/departments', icon: <Building2 size={16} />, color: 'from-purple-500 to-indigo-600' },
            { label: 'Settings', path: '/admin/settings', icon: <Settings size={16} />, color: 'from-indigo-500 to-blue-600' },
            { label: 'Master Data', path: '/admin/master-data', icon: <Database size={16} />, color: 'from-fuchsia-500 to-pink-600' },
          ].map((q) => (
            <button
              key={q.path}
              onClick={() => navigate(q.path)}
              className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/60 hover:shadow-lg transition-all duration-150 text-center"
            >
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${q.color} flex items-center justify-center shadow-sm`}>
                <span className="text-white">{q.icon}</span>
              </div>
              <span className="text-xs font-medium text-slate-600">{q.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
