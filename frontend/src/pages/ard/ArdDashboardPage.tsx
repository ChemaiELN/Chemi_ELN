import { useState, useMemo } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Tag, Spin, Table, Badge, Tabs } from 'antd'
import { Column } from '@ant-design/plots'
import {
  FlaskConical, FileText, Activity, Award, ClipboardCheck,
  Plus, CheckCircle2, AlertCircle, ArrowUpRight, Clock,
  RefreshCw, ShieldCheck, User, Users, TestTube, LayoutDashboard,
} from 'lucide-react'
import { ardApi, type ArdDashboardMetrics, type ArdMyDashboardMetrics } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import dayjs from 'dayjs'

// Workflow enums arrive raw (QA_PRE_APPROVAL). Left as-is they're long enough
// that the chart rotates the axis labels 90°, and those rotated labels then eat
// the plot's fixed height — squashing the bars flat and spilling out past the
// bottom of the card. Title-casing them (keeping 2-letter acronyms like QA)
// shortens them and, with the taller plot below, keeps them inside the card.
const prettyLabel = (s: string) =>
  String(s ?? '')
    .replace(/_/g, ' ')
    .replace(/\b[A-Za-z]{3,}\b/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())

const STATUS_COLORS: Record<string, string> = {
  // ATR statuses
  DRAFT: 'default', SAVED: 'default', NEW: 'processing',
  REQUESTED: 'purple', DEPT_TL_APPROVED: 'cyan',
  QA_PRE_APPROVAL: 'purple', PRE_APPROVAL_REWORK: 'orange',
  PENDING_CLARIFICATION: 'warning', CLARIFIED: 'cyan',
  PARTIAL: 'gold', PENDING_APPROVAL: 'blue',
  APPROVED: 'green', VERIFIED: 'success',
  CERTIFICATION_REQUESTED: 'lime', CERTIFICATION_REWORK: 'volcano', CERTIFIED: 'success',
  ENHANCEMENT_REQUESTED: 'orange', ACCEPTED: 'green',
  REJECTED: 'error', WITHDRAWN: 'default',
  // Experiment statuses
  IN_PROGRESS: 'processing', SUBMITTED: 'gold', REWORK: 'orange',
  VERIFICATION_REQUESTED: 'purple', VERIFICATION_REWORK: 'magenta',
  UNLOCKED: 'geekblue',
  DEACTIVATED: 'default', OBSOLETE: 'volcano',
  // Test statuses
  UNASSIGNED: 'default', PENDING: 'default', ASSIGNED: 'blue', DELEGATED: 'geekblue',
  TENTATIVE: 'cyan', PUBLISHED: 'purple',
  UNSATISFACTORY: 'red', CANCELED: 'default', CANCELLED: 'default',
}

function KpiCard({ title, value, subtitle, icon: Icon, gradient, shadow, onClick }: {
  title: string; value: number; subtitle: string; icon: React.ElementType
  gradient: string; shadow: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className="glass-card rounded-lg p-5 transition-all duration-200 cursor-pointer group flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-lg ${gradient} ${shadow} flex items-center justify-center text-white shrink-0`}>
          <Icon size={22} />
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
          <ArrowUpRight size={14} />
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-1">{value}</h3>
        <p className="text-xs font-semibold text-slate-600 mb-0.5">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
      </div>
    </div>
  )
}

function DashboardHeader({ title, onRefetch, children }: {
  title: string; subtitle?: string; onRefetch: () => void; children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <LayoutDashboard size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button icon={<RefreshCw size={14} />} onClick={onRefetch} />
      </div>
    </div>
  )
}

// ── HOD / Admin view ──────────────────────────────────────────────────────────
function HodDashboard({ username }: { username: string }) {
  const navigate = useNavigate()
  const { data: metrics, isLoading, refetch } = useQuery<ArdDashboardMetrics>({
    queryKey: ['ard-dashboard-metrics'],
    queryFn: ardApi.dashboardMetrics,
    refetchInterval: 30000,
  })

  const kpis = metrics?.kpis
  // Memoised so the 30s refetch doesn't hand the chart a brand-new array each
  // poll and restart its bar animation.
  const atrStatusData = useMemo(
    () => (metrics?.atrStatusBreakdown ?? []).map(d => ({ ...d, status: prettyLabel(d.status) })),
    [metrics?.atrStatusBreakdown])
  const testTechData = metrics?.testTechniqueBreakdown ?? []
  const pendingQueue = metrics?.pendingQueue ?? []
  const recentEvents = metrics?.recentEvents ?? []

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="ARD Operational Dashboard"
        subtitle={`Welcome, ${username}. Full department view — ATRs, experiments, test workloads, and qualification alerts.`}
        onRefetch={refetch}
      >
        <Button icon={<FlaskConical size={15} />} onClick={() => navigate('/ard/experiments')}>
          Experiments
        </Button>
      </DashboardHeader>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center glass-card rounded-lg">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="ATR Requests" value={kpis?.totalAtrs ?? 0}
            subtitle={`${kpis?.pendingAtrs ?? 0} Pending · ${kpis?.approvedAtrs ?? 0} Approved`}
            icon={FileText} gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            shadow="shadow-lg shadow-blue-500/25" onClick={() => navigate('/ard/atrs')} />
          <KpiCard title="Active Experiments" value={kpis?.totalExperiments ?? 0}
            subtitle={`${kpis?.inProgressExperiments ?? 0} In Progress · ${kpis?.submittedExperiments ?? 0} Submitted`}
            icon={FlaskConical} gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            shadow="shadow-lg shadow-amber-500/25" onClick={() => navigate('/ard/experiments')} />
          <KpiCard title="Test Requests" value={kpis?.totalTests ?? 0}
            subtitle={`${kpis?.pendingVerificationTests ?? 0} Pending Verify · ${kpis?.reworkTests ?? 0} Rework`}
            icon={Activity} gradient="bg-gradient-to-br from-purple-500 to-violet-600"
            shadow="shadow-lg shadow-purple-500/25" onClick={() => navigate('/ard/tests')} />
          <KpiCard title="Qualification Alerts" value={kpis?.expiringQuals ?? 0}
            subtitle="Analyst expiries within window"
            icon={Award} gradient={kpis?.expiringQuals ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-violet-500 to-violet-600'}
            shadow={kpis?.expiringQuals ? 'shadow-lg shadow-rose-500/25' : 'shadow-lg shadow-violet-500/25'}
            onClick={() => navigate('/ard/qualifications')} />
          <KpiCard title="QC-TRF Forms" value={kpis?.totalTrfs ?? 0}
            subtitle="Transfer request forms" icon={ClipboardCheck}
            gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
            shadow="shadow-lg shadow-cyan-500/25" onClick={() => navigate('/ard/qc-trf')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><FileText size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">ATR Workflow Status</h2>
              <p className="text-xs text-slate-400">Forms by workflow stage</p>
            </div>
          </div>
          {atrStatusData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-400 text-xs">No ATR data</div>
          ) : (
            <Column data={atrStatusData} xField="status" yField="count" height={320}
              label={{ text: 'count', position: 'inside', style: { fill: '#fff', fontSize: 11, fontWeight: 600 } }}
              style={{ fill: '#3b82f6', fillOpacity: 0.85, radiusTopLeft: 6, radiusTopRight: 6 }} />
          )}
        </div>

        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><Activity size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Tests by Technique</h2>
              <p className="text-xs text-slate-400">Workload by analytical method</p>
            </div>
          </div>
          {testTechData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-slate-400 text-xs">No test data</div>
          ) : (
            <Column data={testTechData} xField="technique" yField="count" height={320}
              label={{ text: 'count', position: 'inside', style: { fill: '#fff', fontSize: 11, fontWeight: 600 } }}
              style={{ fill: '#8b5cf6', fillOpacity: 0.85, radiusTopLeft: 6, radiusTopRight: 6 }} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Clock size={18} /></div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Pending Action Queue</h2>
                <p className="text-xs text-slate-400">Verification, approval, clarification</p>
              </div>
            </div>
            <Tag color="gold" className="rounded-full px-2.5 font-semibold">{pendingQueue.length} pending</Tag>
          </div>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {pendingQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-violet-400 opacity-60" />
                All clear — no pending items.
              </div>
            ) : pendingQueue.map(item => (
              <div key={item.id} onClick={() => navigate(item.href)}
                className="p-3.5 rounded-lg bg-slate-50 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-100 transition-all cursor-pointer flex items-center justify-between gap-3 group">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-500 shadow-sm shrink-0">
                    <AlertCircle size={16} className={item.tone === 'warning' ? 'text-amber-500' : 'text-blue-500'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600">{item.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Tag color={item.tone === 'warning' ? 'gold' : 'blue'} className="text-[10px] rounded-full mr-0">{item.type}</Tag>
                  {item.at && <p className="text-[10px] text-slate-400 mt-1">{dayjs(item.at).format('MMM D · HH:mm')}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><ShieldCheck size={18} /></div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Recent Activity</h2>
                <p className="text-xs text-slate-400">Latest audit log events</p>
              </div>
            </div>
            <Button size="small" type="text" onClick={() => navigate('/ard/audit')} className="text-xs text-blue-600 font-medium">
              View Audit Log →
            </Button>
          </div>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {recentEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No recent activity</div>
            ) : recentEvents.map(evt => (
              <div key={evt.id} className="p-3 rounded-lg bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Tag color="cyan" className="text-[10px] font-bold rounded-md px-1.5 shrink-0">{evt.entityType}</Tag>
                  <div className="truncate">
                    <span className="font-semibold text-slate-700">{evt.action}</span>
                    {evt.detail && <span className="text-slate-500"> — {evt.detail}</span>}
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-400 shrink-0">
                  <p className="font-medium text-slate-600">{evt.by}</p>
                  <p>{evt.at ? dayjs(evt.at).format('MMM D, HH:mm') : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TL view ───────────────────────────────────────────────────────────────────
function TlDashboard({ username }: { username: string }) {
  const navigate = useNavigate()
  const [tlTab, setTlTab] = useState<'my_atrs' | 'team_queue'>('my_atrs')
  const { data, isLoading, refetch } = useQuery<ArdMyDashboardMetrics>({
    queryKey: ['ard-my-dashboard'],
    queryFn: ardApi.myDashboardMetrics,
    refetchInterval: 30000,
  })

  const kpis = data?.kpis ?? {}
  const myAtrs = data?.myAtrs ?? []
  const teamTests = data?.teamTests ?? []
  const atrStatusData = useMemo(
    () => (data?.atrStatusBreakdown ?? []).map(d => ({ ...d, status: prettyLabel(d.status) })),
    [data?.atrStatusBreakdown])

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Team Lead Dashboard"
        subtitle={`Welcome, ${username}. Your ATR assignments and team's test queue.`}
        onRefetch={refetch}
      >
        <Button type="primary" icon={<Plus size={15} />} onClick={() => navigate('/ard/atrs/new')}
          className="bg-indigo-600 hover:bg-indigo-700 border-none shadow-sm font-medium">
          New ATR
        </Button>
        <Button icon={<FlaskConical size={15} />} onClick={() => navigate('/ard/experiments')}>
          Experiments
        </Button>
      </DashboardHeader>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center glass-card rounded-lg"><Spin size="large" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="My ATRs" value={kpis.myAtrs ?? 0}
            subtitle={`${kpis.pendingAtrs ?? 0} Pending action`}
            icon={FileText} gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            shadow="shadow-lg shadow-blue-500/25" onClick={() => navigate('/ard/atrs')} />
          <KpiCard title="Team Tests" value={kpis.teamTests ?? 0}
            subtitle={`${kpis.pendingVerification ?? 0} Pending verify`}
            icon={TestTube} gradient="bg-gradient-to-br from-purple-500 to-violet-600"
            shadow="shadow-lg shadow-purple-500/25" onClick={() => navigate('/ard/tests')} />
          <KpiCard title="Pending Verification" value={kpis.pendingVerification ?? 0}
            subtitle="Tests awaiting verification"
            icon={Clock} gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            shadow="shadow-lg shadow-amber-500/25" />
          <KpiCard title="Rework" value={kpis.reworkTests ?? 0}
            subtitle="Tests sent for rework"
            icon={Activity}
            gradient={(kpis.reworkTests ?? 0) > 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-violet-500 to-violet-600'}
            shadow={(kpis.reworkTests ?? 0) > 0 ? 'shadow-lg shadow-rose-500/25' : 'shadow-lg shadow-violet-500/25'} />
        </div>
      )}

      {/* B-81: TL Team Queue tab panel */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Tabs
          activeKey={tlTab}
          onChange={k => setTlTab(k as 'my_atrs' | 'team_queue')}
          className="px-6 pt-4"
          items={[
            {
              key: 'my_atrs',
              label: (
                <span className="flex items-center gap-1.5">
                  <FileText size={14} />
                  My ATR Assignments
                  {myAtrs.length > 0 && (
                    <Badge count={myAtrs.length} size="small" color="#3b82f6" />
                  )}
                </span>
              ),
              children: (
                <div className="pb-4">
                  {atrStatusData.length > 0 && (
                    <Column data={atrStatusData} xField="status" yField="count" height={240}
                      label={{ text: 'count', position: 'inside', style: { fill: '#fff', fontSize: 11, fontWeight: 600 } }}
                      style={{ fill: '#3b82f6', fillOpacity: 0.85, radiusTopLeft: 6, radiusTopRight: 6 }} />
                  )}
                  <Table
                    dataSource={myAtrs}
                    rowKey="id"
                    size="small"
                    pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                    className="mt-3"
                    onRow={row => ({ onClick: () => navigate(`/ard/atrs/${row.id}`) })}
                    rowClassName={() => 'cursor-pointer'}
                    columns={[
                      { title: 'Form No', dataIndex: 'formNo', render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
                      { title: 'Product', dataIndex: 'productName', ellipsis: true },
                      { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] ?? 'default'} className="text-[10px]">{v.replace(/_/g,' ')}</Tag> },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'team_queue',
              label: (
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  Team Test Queue
                  {teamTests.length > 0 && (
                    <Badge count={teamTests.length} size="small" color="#8b5cf6" />
                  )}
                </span>
              ),
              children: (
                <div className="pb-4">
                  {teamTests.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">No team tests yet</div>
                  ) : (
                    <Table
                      dataSource={teamTests}
                      rowKey="id"
                      size="small"
                      pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
                      columns={[
                        { title: 'Test Type', dataIndex: 'testType', ellipsis: true },
                        { title: 'Assigned To', dataIndex: 'assignedTo', render: v => v ?? '—' },
                        { title: 'AR No', dataIndex: 'arNumber', render: v => v ?? '—' },
                        { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] ?? 'default'} className="text-[10px]">{v.replace(/_/g,' ')}</Tag> },
                      ]}
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}

// ── Analyst (CHEMIST) personal view ──────────────────────────────────────────
function AnalystDashboard({ username }: { username: string }) {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useQuery<ArdMyDashboardMetrics>({
    queryKey: ['ard-my-dashboard'],
    queryFn: ardApi.myDashboardMetrics,
    refetchInterval: 30000,
  })

  const kpis = data?.kpis ?? {}
  const myTests = data?.myTests ?? []
  const myExperiments = data?.myExperiments ?? []

  const inProgressTests = myTests.filter(t => t.status === 'IN_PROGRESS')
  const needsSubmitTests = myTests.filter(t => t.status === 'ASSIGNED')
  const reworkTests = myTests.filter(t => ['REWORK', 'VERIFICATION_REWORK'].includes(t.status))

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="My Work Dashboard"
        subtitle={`Welcome, ${username}. Your assigned tests and experiments.`}
        onRefetch={refetch}
      >
        <Button type="primary" icon={<Plus size={15} />} onClick={() => navigate('/ard/atrs/new')}
          className="bg-indigo-600 hover:bg-indigo-700 border-none shadow-sm font-medium">
          New ATR
        </Button>
        <Button icon={<FlaskConical size={15} />} onClick={() => navigate('/ard/experiments')}>
          Experiments
        </Button>
      </DashboardHeader>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center glass-card rounded-lg"><Spin size="large" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="My Tests" value={kpis.totalMyTests ?? 0}
            subtitle="Total assigned to me"
            icon={TestTube} gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            shadow="shadow-lg shadow-blue-500/25" onClick={() => navigate('/ard/tests')} />
          <KpiCard title="In Progress" value={kpis.inProgressTests ?? 0}
            subtitle="Currently executing"
            icon={Activity} gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            shadow="shadow-lg shadow-amber-500/25" />
          <KpiCard title="Pending Verification" value={kpis.pendingVerification ?? 0}
            subtitle="Submitted, awaiting verify"
            icon={Clock} gradient="bg-gradient-to-br from-purple-500 to-violet-600"
            shadow="shadow-lg shadow-purple-500/25" />
          <KpiCard title="Rework" value={kpis.reworkTests ?? 0}
            subtitle="Needs revision"
            icon={AlertCircle}
            gradient={(kpis.reworkTests ?? 0) > 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-violet-500 to-violet-600'}
            shadow={(kpis.reworkTests ?? 0) > 0 ? 'shadow-lg shadow-rose-500/25' : 'shadow-lg shadow-violet-500/25'} />
        </div>
      )}

      {reworkTests.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-rose-700">{reworkTests.length} test{reworkTests.length > 1 ? 's' : ''} sent back for rework</p>
            <p className="text-xs text-rose-500 mt-0.5">Review and resubmit: {reworkTests.map(t => t.testType).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><TestTube size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">My Assigned Tests</h2>
              <p className="text-xs text-slate-400">{myTests.length} tests assigned to you</p>
            </div>
          </div>
          {myTests.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-violet-400 opacity-60" />
              No tests assigned.
            </div>
          ) : (
            <Table
              dataSource={myTests}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8, size: 'small' }}
              onRow={row => ({ onClick: () => row.atrId && navigate(`/ard/atrs/${row.atrId}/tests/${row.id}`) })}
              columns={[
                { title: 'Test', dataIndex: 'testType', ellipsis: true,
                  render: (v, r) => <div><div className="text-xs font-semibold">{v}</div>{r.subtype && <div className="text-[10px] text-slate-400">{r.subtype}</div>}</div> },
                { title: 'ATR', dataIndex: 'atrFormNo', render: v => <span className="font-mono text-xs">{v ?? '—'}</span> },
                { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] ?? 'default'} className="text-[10px]">{v.replace(/_/g,' ')}</Tag> },
              ]}
            />
          )}
        </div>

        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><FlaskConical size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">My Experiments</h2>
              <p className="text-xs text-slate-400">{myExperiments.length} experiments created by you</p>
            </div>
          </div>
          {myExperiments.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No experiments yet.</div>
          ) : (
            <Table
              dataSource={myExperiments}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8, size: 'small' }}
              onRow={row => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
              columns={[
                { title: 'Code', dataIndex: 'code', render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
                { title: 'Template', dataIndex: 'templateName', ellipsis: true, render: v => v ?? '—' },
                { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] ?? 'default'} className="text-[10px]">{v.replace(/_/g,' ')}</Tag> },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── QA view ───────────────────────────────────────────────────────────────────
function QaDashboard({ username }: { username: string }) {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useQuery<ArdMyDashboardMetrics>({
    queryKey: ['ard-my-dashboard'],
    queryFn: ardApi.myDashboardMetrics,
    refetchInterval: 30000,
  })

  const kpis = data?.kpis ?? {}
  const qaQueue = data?.qaQueue ?? []

  const preApproval = qaQueue.filter(a => ['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK'].includes(a.status))
  const certification = qaQueue.filter(a => ['CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK'].includes(a.status))

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="QA Dashboard"
        subtitle={`Welcome, ${username}. Pre-approval queue, certification requests, and TRF oversight.`}
        onRefetch={refetch}
      >
        <Button icon={<FlaskConical size={15} />} onClick={() => navigate('/ard/experiments')}>
          Experiments
        </Button>
      </DashboardHeader>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center glass-card rounded-lg"><Spin size="large" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Total QA Queue" value={kpis.qaQueueCount ?? 0}
            subtitle="ATRs needing QA action"
            icon={ShieldCheck} gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            shadow="shadow-lg shadow-blue-500/25" onClick={() => navigate('/ard/atrs')} />
          <KpiCard title="Pre-Approval" value={kpis.preApproval ?? 0}
            subtitle="Awaiting QA pre-approval"
            icon={Clock} gradient="bg-gradient-to-br from-purple-500 to-violet-600"
            shadow="shadow-lg shadow-purple-500/25" />
          <KpiCard title="Certification Requests" value={kpis.certRequested ?? 0}
            subtitle="Pending certification"
            icon={Award} gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            shadow="shadow-lg shadow-amber-500/25" />
          <KpiCard title="QC-TRF Forms" value={kpis.totalTrfs ?? 0}
            subtitle="Transfer request forms"
            icon={ClipboardCheck} gradient="bg-gradient-to-br from-cyan-500 to-blue-600"
            shadow="shadow-lg shadow-cyan-500/25" onClick={() => navigate('/ard/qc-trf')} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><ShieldCheck size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Pre-Approval Queue</h2>
              <p className="text-xs text-slate-400">{preApproval.length} ATRs awaiting QA pre-approval</p>
            </div>
          </div>
          {preApproval.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-violet-400 opacity-60" />
              No items pending pre-approval.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {preApproval.map(a => (
                <div key={a.id} onClick={() => navigate(`/ard/atrs/${a.id}`)}
                  className="p-3 rounded-lg bg-slate-50 hover:bg-purple-50 border border-slate-100 cursor-pointer flex justify-between items-center group transition-colors">
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-purple-700">{a.formNo}</p>
                    <p className="text-[11px] text-slate-500">{a.productName}</p>
                  </div>
                  <div className="text-right">
                    <Tag color={STATUS_COLORS[a.status] ?? 'default'} className="text-[10px]">{a.status.replace(/_/g,' ')}</Tag>
                    {a.at && <p className="text-[10px] text-slate-400 mt-0.5">{dayjs(a.at).format('MMM D')}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Award size={18} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Certification Queue</h2>
              <p className="text-xs text-slate-400">{certification.length} ATRs awaiting certification</p>
            </div>
          </div>
          {certification.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              <CheckCircle2 size={28} className="mx-auto mb-2 text-violet-400 opacity-60" />
              No certification requests.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {certification.map(a => (
                <div key={a.id} onClick={() => navigate(`/ard/atrs/${a.id}`)}
                  className="p-3 rounded-lg bg-slate-50 hover:bg-amber-50 border border-slate-100 cursor-pointer flex justify-between items-center group transition-colors">
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-amber-700">{a.formNo}</p>
                    <p className="text-[11px] text-slate-500">{a.productName}</p>
                  </div>
                  <div className="text-right">
                    <Tag color={STATUS_COLORS[a.status] ?? 'default'} className="text-[10px]">{a.status.replace(/_/g,' ')}</Tag>
                    {a.at && <p className="text-[10px] text-slate-400 mt-0.5">{dayjs(a.at).format('MMM D')}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── External requester (ADC_PD / CGT) view ───────────────────────────────────
function ExternalDashboard({ username, deptCode }: { username: string; deptCode: string }) {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useQuery<ArdMyDashboardMetrics>({
    queryKey: ['ard-my-dashboard'],
    queryFn: ardApi.myDashboardMetrics,
    refetchInterval: 30000,
  })

  const kpis = data?.kpis ?? {}
  const myAtrs = data?.myAtrs ?? []

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="My ATR Requests"
        subtitle={`Welcome, ${username}. Track your department's (${deptCode}) ATR submissions.`}
        onRefetch={refetch}
      >
        <Button type="primary" icon={<Plus size={15} />} onClick={() => navigate('/ard/atrs/new')}
          className="bg-indigo-600 hover:bg-indigo-700 border-none shadow-sm font-medium">
          New ATR
        </Button>
        <Button icon={<FlaskConical size={15} />} onClick={() => navigate('/ard/experiments')}>
          Experiments
        </Button>
      </DashboardHeader>

      {isLoading ? (
        <div className="h-32 flex items-center justify-center glass-card rounded-lg"><Spin size="large" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Total Submitted" value={kpis.total ?? 0}
            subtitle="ATRs raised by my department"
            icon={FileText} gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
            shadow="shadow-lg shadow-blue-500/25" onClick={() => navigate('/ard/atrs')} />
          <KpiCard title="In Progress" value={kpis.inProgress ?? 0}
            subtitle="Being processed by ARD"
            icon={Activity} gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            shadow="shadow-lg shadow-amber-500/25" />
          <KpiCard title="Completed" value={kpis.completed ?? 0}
            subtitle="Certified / Verified"
            icon={CheckCircle2} gradient="bg-gradient-to-br from-violet-500 to-violet-600"
            shadow="shadow-lg shadow-violet-500/25" />
        </div>
      )}

      <div className="glass-card rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><FileText size={18} /></div>
          <div>
            <h2 className="text-base font-bold text-slate-800">My ATR Submissions</h2>
            <p className="text-xs text-slate-400">{myAtrs.length} ATRs raised by you</p>
          </div>
        </div>
        {myAtrs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            No ATRs submitted yet.
            <div className="mt-3">
              <Button type="primary" size="small" onClick={() => navigate('/ard/atrs/new')}>Submit your first ATR</Button>
            </div>
          </div>
        ) : (
          <Table
            dataSource={myAtrs}
            rowKey="id"
            size="small"
            pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], size: 'small', showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
            onRow={row => ({ onClick: () => navigate(`/ard/atrs/${row.id}`) })}
            columns={[
              { title: 'Form No', dataIndex: 'formNo', render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
              { title: 'Product / Sample', dataIndex: 'productName', ellipsis: true },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color={STATUS_COLORS[v] ?? 'default'} className="text-[10px]">{v.replace(/_/g,' ')}</Tag> },
              { title: 'Date', dataIndex: 'at', render: v => v ? dayjs(v).format('MMM D, YYYY') : '—' },
            ]}
          />
        )}
      </div>
    </div>
  )
}

// ── Root — role router ────────────────────────────────────────────────────────
export default function ArdDashboardPage() {
  const user = useAppSelector(selectUser)
  const roleCode = user?.role_code ?? ''
  const deptCode = user?.department_code ?? ''
  const username = user?.username ?? 'User'

  const EXTERNAL_DEPTS = ['ADC_PD', 'CGT']

  if (roleCode === 'SE') {
    return <Navigate to="/ard/se-dashboard" replace />
  }
  if (roleCode === 'HOD' || roleCode === 'SUPER_ADMIN') {
    return <div className="p-4 md:p-6 space-y-4 w-full"><HodDashboard username={username} /></div>
  }
  if (roleCode === 'TL') {
    return <div className="p-4 md:p-6 space-y-4 w-full"><TlDashboard username={username} /></div>
  }
  if (deptCode === 'QA') {
    return <div className="p-4 md:p-6 space-y-4 w-full"><QaDashboard username={username} /></div>
  }
  if (EXTERNAL_DEPTS.includes(deptCode)) {
    return <div className="p-4 md:p-6 space-y-4 w-full"><ExternalDashboard username={username} deptCode={deptCode} /></div>
  }
  // Default: ANALYST / CHEMIST
  return <div className="p-4 md:p-6 space-y-4 w-full"><AnalystDashboard username={username} /></div>
}
