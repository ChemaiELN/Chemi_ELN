import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Spin } from 'antd'
import {
  BarChart3, Clock, AlertCircle, FlaskConical, Search,
  FileText, Bell, TrendingDown, Activity,
} from 'lucide-react'
import { ardApi } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

interface ReportCard {
  title: string
  subtitle: string
  icon: React.ElementType
  color: string
  href: string
}

const REPORT_CARDS: ReportCard[] = [
  {
    title: 'Inactive Experiments',
    subtitle: 'Experiments with no activity past SLA',
    icon: Activity,
    color: 'from-slate-400 to-slate-500',
    href: '/ard/reports',
  },
  {
    title: 'Delayed Submission',
    subtitle: 'Experiments not submitted within SLA',
    icon: Clock,
    color: 'from-orange-400 to-amber-500',
    href: '/ard/reports',
  },
  {
    title: 'Delayed Approval',
    subtitle: 'Submitted experiments awaiting approval',
    icon: AlertCircle,
    color: 'from-rose-400 to-red-500',
    href: '/ard/reports',
  },
  {
    title: 'Delayed ATRs',
    subtitle: 'ATR forms past their SLA threshold',
    icon: TrendingDown,
    color: 'from-violet-400 to-purple-500',
    href: '/ard/reports',
  },
  {
    title: 'Batch Number Summary',
    subtitle: 'All ATRs by batch number cross-reference',
    icon: FileText,
    color: 'from-violet-400 to-violet-500',
    href: '/ard/reports',
  },
]

export default function ArdSeDashboardPage() {
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['ard-dashboard-metrics'],
    queryFn: ardApi.dashboardMetrics,
  })

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={20} className="text-violet-600" />
            <h1 className="text-lg font-bold text-slate-800">Senior Executive Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500">
            Read-only view — Reports, Search, and Notifications only
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Search size={14} />} onClick={() => navigate('/ard/search')}>
            Search
          </Button>
          <Button icon={<Bell size={14} />} onClick={() => navigate('/ard/notifications')}>
            Notifications
          </Button>
        </div>
      </div>

      {/* Welcome card */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-lg p-5">
        <p className="text-sm font-semibold text-violet-700">Welcome, {user?.username}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          You have <span className="font-semibold text-violet-600">read-only</span> access to ARD reports and analytical search.
        </p>
      </div>

      {/* Quick stats */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Spin /></div>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total ATRs', value: (metrics as any).totalAtrs ?? 0, color: 'text-blue-600 bg-blue-50' },
            { label: 'Active Experiments', value: (metrics as any).activeExperiments ?? 0, color: 'text-violet-600 bg-violet-50' },
            { label: 'Delayed ATRs', value: (metrics as any).delayedAtrs ?? 0, color: 'text-rose-600 bg-rose-50' },
            { label: 'Pending Certifications', value: (metrics as any).pendingCertifications ?? 0, color: 'text-amber-600 bg-amber-50' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-lg p-4 ${color.split(' ')[1]} border border-slate-100`}>
              <p className={`text-2xl font-extrabold ${color.split(' ')[0]}`}>{value}</p>
              <p className="text-xs font-medium text-slate-600 mt-1">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Report cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-500" />
          Available Reports
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORT_CARDS.map(card => {
            const Icon = card.icon
            return (
              <button
                key={card.title}
                onClick={() => navigate(card.href)}
                className="text-left glass-card rounded-lg p-4 hover:border-violet-200 transition-all group"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-white mb-3`}>
                  <Icon size={18} />
                </div>
                <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{card.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{card.subtitle}</p>
              </button>
            )
          })}

          {/* Analytical Search */}
          <button
            onClick={() => navigate('/ard/search')}
            className="text-left glass-card rounded-lg p-4 hover:border-indigo-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white mb-3">
              <Search size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">Analytical Search</p>
            <p className="text-xs text-slate-400 mt-0.5">Search ATRs, experiments, tests, TRFs</p>
          </button>

          {/* Experiment List (read-only) */}
          <button
            onClick={() => navigate('/ard/experiments')}
            className="text-left glass-card rounded-lg p-4 hover:border-violet-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-400 to-cyan-500 flex items-center justify-center text-white mb-3">
              <FlaskConical size={18} />
            </div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">Experiments</p>
            <p className="text-xs text-slate-400 mt-0.5">View all experiments across projects</p>
          </button>
        </div>
      </div>
    </div>
  )
}
