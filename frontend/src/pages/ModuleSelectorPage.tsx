import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Package2, ChevronRight, FlaskConical, Atom, FileText, Dna } from 'lucide-react'
import { useAppSelector } from '../store'
import { selectUser } from '../store/authSlice'
import UserProfileMenu from '../components/layout/UserProfileMenu'

// The Administration module (Users & Roles, Role Privileges, Settings, Master
// Data) is only visible to QA/QC department users — mirrors the backend gate
// in app/shared/privileges.py (ADMIN_MODULE_DEPARTMENT_CODES).
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']

export default function ModuleSelectorPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)
  const canSeeAdmin = ADMIN_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">

      {/* Background */}
      <div className="fixed inset-0 -z-20 bg-gradient-to-br from-slate-100 via-purple-50 to-indigo-100" />
      <div className="fixed top-[-80px] left-[-80px] -z-10 w-[480px] h-[480px] bg-purple-200/50 rounded-full blur-3xl animate-blob" />
      <div className="fixed bottom-[-60px] right-[-60px] -z-10 w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 w-[350px] h-[350px] bg-indigo-200/30 rounded-full blur-3xl animate-blob animation-delay-4000" />

      {/* Top bar */}
      <header className="glass-header px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/30">
            <FlaskConical size={15} className="text-white" />
          </div>
          <div>
            <p className="text-slate-800 font-bold text-sm leading-none">Laurus ELN</p>
            <p className="text-slate-400 text-[10px]">Chemia ELN v2</p>
          </div>
        </div>

      </header>
      <UserProfileMenu />

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        {/* Welcome */}
        <div className="text-center mb-10">
          <p className="text-slate-500 text-sm mb-1">Welcome back,</p>
          <h1 className="text-3xl font-bold text-slate-800">{user?.username ?? 'User'}</h1>
          <p className="text-slate-400 text-sm mt-1.5">Select a module to continue</p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-5xl">

          {/* Admin — QA/QC department only */}
          {canSeeAdmin && (
            <button
              onClick={() => navigate('/admin/users')}
              className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-purple-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-300 to-purple-400 flex items-center justify-center shadow-lg shadow-purple-300/30">
                  <ShieldCheck size={26} className="text-white" />
                </div>
                <ChevronRight size={18} className="text-purple-300 group-hover:text-purple-500 mt-1 transition-colors" />
              </div>

              <h2 className="text-xl font-bold text-slate-800 mb-1">Administration</h2>
              <p className="text-slate-500 text-sm mb-5">Manage users, roles, departments, settings and master data</p>

              <div className="space-y-1.5">
                {['Users & Roles', 'Departments', 'Role Privileges', 'Settings', 'Master Data'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                    <div className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-white/50">
                <span className="text-xs font-semibold text-purple-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Open Administration <ChevronRight size={12} />
                </span>
              </div>
            </button>
          )}

          {/* Inventory */}
          <button
            onClick={() => navigate('/inventory')}
            className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-emerald-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-400 flex items-center justify-center shadow-lg shadow-teal-300/30">
                <Package2 size={26} className="text-white" />
              </div>
              <ChevronRight size={18} className="text-emerald-300 group-hover:text-emerald-500 mt-1 transition-colors" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-1">Inventory</h2>
            <p className="text-slate-500 text-sm mb-5">Track materials, batches, equipment and instruments</p>

            <div className="space-y-1.5">
              {['Materials', 'Batches', 'Equipment', 'Instruments', 'Reports'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/50">
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Open Inventory <ChevronRight size={12} />
              </span>
            </div>
          </button>

          {/* ADC */}
          <button
            onClick={() => navigate(
              ['CHEM', 'ANALYST'].includes(user?.role_code ?? '') ? '/adc/my-notebooks' : '/adc/projects'
            )}
            className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-indigo-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-300 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-300/30">
                <Atom size={26} className="text-white" />
              </div>
              <ChevronRight size={18} className="text-indigo-300 group-hover:text-indigo-500 mt-1 transition-colors" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-1">ADC</h2>
            <p className="text-slate-500 text-sm mb-5">Manage ADC projects, notebooks and experiments</p>

            <div className="space-y-1.5">
              {['Projects', 'Notebooks', 'Preliminary Experiments', 'Synthesis Experiments', 'Reports'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/50">
              <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Open ADC <ChevronRight size={12} />
              </span>
            </div>
          </button>

          {/* CGT */}
          <button
            onClick={() => navigate('/cgt/projects')}
            className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-teal-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-300 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-300/30">
                <Dna size={26} className="text-white" />
              </div>
              <ChevronRight size={18} className="text-teal-300 group-hover:text-teal-500 mt-1 transition-colors" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-1">CGT</h2>
            <p className="text-slate-500 text-sm mb-5">Manage Cell and Gene Therapy projects, notebooks and experiments</p>

            <div className="space-y-1.5">
              {['Projects', 'Notebooks', 'Experiments', 'Reports'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="w-1 h-1 rounded-full bg-teal-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-white/50">
              <span className="text-xs font-semibold text-teal-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                Open CGT <ChevronRight size={12} />
              </span>
            </div>
          </button>

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
