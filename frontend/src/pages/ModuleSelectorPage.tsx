import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Package2, ChevronRight, Atom, FileText, Dna, FlaskConical } from 'lucide-react'
import { useAppSelector } from '../store'
import { selectUser } from '../store/authSlice'
import { useCan } from '../hooks/usePrivilege'
import { useIsAdcAssignedOnly } from '../hooks/useAdcLanding'

// Administration is visible to QA/QC department users and SUPER_ADMIN — mirrors
// AdminProtectedRoute and app/shared/privileges.py.
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']
// CGT and ARD are still department-scoped. ADC has moved to the configurable
// department-role privilege matrix ('adc.module.access'); these follow once
// their privilege catalogs are added.
const CGT_MODULE_DEPARTMENT_CODES = ['CGT', 'QA']
// ARD (Analytical R&D) reuses the existing "AD" department (see
// backend/seeds/migrate_department_roles.py) rather than introducing a new one.
const ARD_MODULE_DEPARTMENT_CODES = ['AD', 'QA']

export default function ModuleSelectorPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const isSuperAdmin = user?.role_code === 'SUPER_ADMIN'
  const canSeeAdmin = isSuperAdmin || ADMIN_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const canSeeAdc   = useCan('adc.module.access')
  // Landing follows the dashboard privileges — see useAdcLanding.
  const adcAssignedOnly = useIsAdcAssignedOnly()
  const canSeeCgt   = isSuperAdmin || CGT_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')
  const canSeeArd   = isSuperAdmin || ARD_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Background */}
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: '#f4f4f8' }} />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">

        {/* Welcome */}
        <div className="text-center mb-6">
          <p className="text-slate-500 text-sm mb-1">Welcome back,</p>
          <h1 className="text-3xl font-bold text-slate-800">{user?.username ?? 'User'}</h1>
          <p className="text-slate-400 text-sm mt-1.5">Select a module to continue</p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">

          {/* Admin — QA/QC department only */}
          {canSeeAdmin && (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="glass-card rounded-3xl p-5 text-left hover:shadow-2xl hover:shadow-purple-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer flex items-center gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-300 to-purple-400 flex items-center justify-center shadow-lg shadow-purple-300/30 shrink-0">
                <ShieldCheck size={26} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Administration</h2>
                <p className="text-slate-500 text-sm">Manage users, roles, departments, settings and master data</p>
              </div>

              <span className="text-xs font-semibold text-purple-600 flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
                Open <ChevronRight size={12} />
              </span>
            </button>
          )}

          {/* Inventory */}
          <button
            onClick={() => navigate('/inventory')}
            className="glass-card rounded-3xl p-5 text-left hover:shadow-2xl hover:shadow-emerald-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer flex items-center gap-5"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-300/30 shrink-0">
              <Package2 size={26} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-800 mb-1">Inventory</h2>
              <p className="text-slate-500 text-sm">Track materials, batches, equipment and instruments</p>
            </div>

            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
              Open <ChevronRight size={12} />
            </span>
          </button>

          {/* ADC — gated on the 'adc.module.access' privilege */}
          {canSeeAdc && (
            <button
              onClick={() => navigate(adcAssignedOnly ? '/adc/my-notebooks' : '/adc/projects')}
              className="glass-card rounded-3xl p-5 text-left hover:shadow-2xl hover:shadow-indigo-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer flex items-center gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-300 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-300/30 shrink-0">
                <Atom size={26} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 mb-1">ADC</h2>
                <p className="text-slate-500 text-sm">Manage ADC projects, notebooks and experiments</p>
              </div>

              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
                Open <ChevronRight size={12} />
              </span>
            </button>
          )}

          {/* CGT — CGT department only */}
          {canSeeCgt && (
            <button
              onClick={() => navigate('/cgt/projects')}
              className="glass-card rounded-3xl p-5 text-left hover:shadow-2xl hover:shadow-teal-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer flex items-center gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-300 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-300/30 shrink-0">
                <Dna size={26} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 mb-1">CGT</h2>
                <p className="text-slate-500 text-sm">Manage Cell and Gene Therapy projects, notebooks and experiments</p>
              </div>

              <span className="text-xs font-semibold text-teal-600 flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
                Open <ChevronRight size={12} />
              </span>
            </button>
          )}

          {/* ARD — AD department only */}
          {canSeeArd && (
            <button
              onClick={() => navigate('/ard')}
              className="glass-card rounded-3xl p-5 text-left hover:shadow-2xl hover:shadow-amber-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer flex items-center gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-300/30 shrink-0">
                <FlaskConical size={26} className="text-white" />
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-800 mb-1">ARD</h2>
                <p className="text-slate-500 text-sm">Analytical R&amp;D testing, ATRs, experiments and reports</p>
              </div>

              <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
                Open <ChevronRight size={12} />
              </span>
            </button>
          )}

          {/* Reports */}
          {/* <button
            onClick={() => navigate('/adc/reports')}
            className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-rose-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-300 to-rose-400 flex items-center justify-center shadow-lg shadow-rose-300/30">
                <FileText size={26} className="text-white" />
              </div>
              <ChevronRight size={18} className="text-rose-300 group-hover:text-rose-500 mt-1 transition-colors" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-1">Reports</h2>
            <p className="text-slate-500 text-sm mb-5">Download approved experiment reports as Word documents</p>

            <div className="space-y-1.5">
              {['Approved Experiments', 'Word (.docx) Export', 'Full Experiment Data', 'Audit Trail'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/50">
              <span className="text-xs font-semibold text-rose-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Open Reports <ChevronRight size={12} />
              </span>
            </div>
          </button> */}

        </div>
      </main>
    </div>
  )
}
