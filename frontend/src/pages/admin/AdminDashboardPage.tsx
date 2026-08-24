import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pie } from '@ant-design/plots'
import { Table, Tag, Button, message, Popconfirm, Tooltip } from 'antd'
import { KeyRound, LockKeyholeOpen, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { adminApi, adminDashboardApi, type LockedAccount } from '../../api/admin'
import { loginIssueAdminApi, type LoginIssueEntry } from '../../api/loginIssues'
import { ApiError } from '../../api/client'
import type { ColumnsType } from 'antd/es/table'

// AntV G2's default categorical palette, each blended toward white so every
// segment keeps its original hue but renders as a lighter/brighter tint
// instead of the bold saturated default.
const G2_DEFAULT_COLORS = ['#5B8FF9', '#61DDAA', '#65789B', '#F6BD16', '#7262FD', '#78D3F8', '#9661BC', '#F6903D', '#008685', '#F08BB4']
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount)
  const r = mix((n >> 16) & 0xff)
  const g = mix((n >> 8) & 0xff)
  const b = mix(n & 0xff)
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
const PIE_COLORS = G2_DEFAULT_COLORS.map((c) => lighten(c, 0.4))

type IssueFilter = 'UNLOCK' | 'PASSWORD_RESET'

function Th({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{children}</span>
}

function MaintenanceCard({
  icon: Icon, title, description, onClick, active, accent, count,
}: {
  icon: React.ElementType
  title: string
  description: string
  onClick: () => void
  active: boolean
  accent: 'violet' | 'teal'
  count: number
}) {
  const iconBg = accent === 'violet' ? 'bg-gradient-to-br from-violet-200 to-purple-300' : 'bg-gradient-to-br from-teal-200 to-cyan-300'
  const iconColor = accent === 'violet' ? 'text-violet-600' : 'text-teal-600'
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer flex-1 border shadow-sm ${
        active ? 'border-violet-300 shadow-md' : 'border-slate-100 hover:shadow-lg hover:-translate-y-0.5'
      }`}
      style={{ backgroundColor: '#FEFEFA' }}
    >
      <Tag color="#c084fc" className="absolute top-3 right-3 text-[11px] font-semibold m-0 border-0">{count}</Tag>
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center`}>
        <Icon size={26} className={iconColor} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

export default function AdminDashboardPage() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<IssueFilter>('UNLOCK')
  const [msg, ctx] = message.useMessage()

  const { data: deptCounts = [], isLoading: countsLoading } = useQuery({
    queryKey: ['admin-dashboard-dept-counts'],
    queryFn: () => adminDashboardApi.departmentUserCounts(),
  })

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['login-issues', 'PENDING'],
    queryFn: () => loginIssueAdminApi.list('PENDING'),
  })
  const requests = (issuesData?.items ?? []).filter((r) => r.issue_type === filter)
  const passwordResetCount = (issuesData?.items ?? []).filter((r) => r.issue_type === 'PASSWORD_RESET').length
  const unlockCount = (issuesData?.items ?? []).filter((r) => r.issue_type === 'UNLOCK').length

  const resolveMut = useMutation({
    mutationFn: (id: string) => loginIssueAdminApi.resolve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['login-issues'] }); msg.success('Request resolved.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to resolve request.'),
  })

  // Every account currently locked out — automatic backend lockouts never
  // create a login-issue request on their own, so this is the only place an
  // admin sees them without the user having to self-report.
  const { data: lockedAccounts = [], isLoading: lockedLoading } = useQuery({
    queryKey: ['locked-accounts'],
    queryFn: () => adminDashboardApi.lockedAccounts(),
    refetchInterval: 60_000,
  })

  const unlockMut = useMutation({
    mutationFn: (id: string) => adminApi.unlockUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locked-accounts'] }); msg.success('Account unlocked.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to unlock account.'),
  })

  const pieData = deptCounts
    .map((d) => ({ type: d.department_code, value: d.count, name: d.department_name }))
    .sort((a, b) => b.value - a.value)
  const totalUsers = deptCounts.reduce((a, d) => a + d.count, 0)

  const lockedColumns: ColumnsType<LockedAccount> = [
    {
      title: <Th>User</Th>,
      key: 'user',
      render: (_, r) => (
        <div>
          <p className="text-[13px] text-slate-800 font-medium">{r.display_name || r.username}</p>
          <p className="text-[12px] text-slate-400">{r.username}{r.department_name ? ` · ${r.department_name}` : ''}</p>
        </div>
      ),
    },
    {
      title: <Th>Failed Attempts</Th>,
      dataIndex: 'failed_login_count',
      key: 'failed_login_count',
      width: 130,
      render: (v: number) => <span className="text-[13px] text-slate-700">{v}</span>,
    },
    {
      title: <Th>Locked Until</Th>,
      dataIndex: 'locked_until',
      key: 'locked_until',
      width: 180,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: <Th>Action</Th>,
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Popconfirm title="Unlock this account?" okText="Unlock" onConfirm={() => unlockMut.mutate(r.id)}>
          <Button size="small" type="primary" className="rounded-full" loading={unlockMut.isPending}>Unlock</Button>
        </Popconfirm>
      ),
    },
  ]

  const columns: ColumnsType<LoginIssueEntry> = [
    {
      title: <Th>User</Th>,
      key: 'user',
      render: (_, r) => (
        <div>
          <p className="text-[13px] text-slate-800 font-medium">{r.display_name || r.username}</p>
          <p className="text-[12px] text-slate-400">{r.username}{r.department_name ? ` · ${r.department_name}` : ''}</p>
        </div>
      ),
    },
    {
      title: <Th>Locked?</Th>,
      dataIndex: 'is_locked',
      key: 'is_locked',
      width: 90,
      render: (v: boolean) => v ? <Tag color="red" className="text-[11px]">Locked</Tag> : <EmptyValue />,
    },
    {
      title: <Th>Description</Th>,
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) => v
        ? <Tooltip title={v}><span className="text-[13px] text-slate-700 truncate block max-w-[220px]">{v}</span></Tooltip>
        : <EmptyValue />,
    },
    {
      title: <Th>Submitted</Th>,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <span className="text-[13px] text-slate-600">{new Date(v).toLocaleString()}</span>,
    },
    {
      title: <Th>Action</Th>,
      key: 'actions',
      width: 140,
      render: (_, r) => (
        <Popconfirm
          title={r.issue_type === 'UNLOCK' ? 'Unlock this account and resolve the request?' : 'Reset password to default and resolve the request?'}
          okText="Confirm"
          onConfirm={() => resolveMut.mutate(r.id)}
        >
          <Button size="small" type="primary" className="rounded-full" loading={resolveMut.isPending}>
            {r.issue_type === 'UNLOCK' ? 'Unlock' : 'Reset Password'}
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      {ctx}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Users by department — donut with a centered total and a count-ranked legend beside it */}
        <div className="rounded-lg p-4" style={{ backgroundColor: '#FEFEFA' }}>
          <p className="text-sm font-semibold text-slate-800">Users by Department</p>
          <p className="text-xs text-slate-400 mb-2">
            {totalUsers ? `${totalUsers} active users across ${pieData.length} department${pieData.length === 1 ? '' : 's'}` : 'No active users found.'}
          </p>
          {countsLoading ? (
            <p className="text-[13px] text-slate-400 text-center py-16">Loading…</p>
          ) : pieData.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-16">No active users found.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative shrink-0" style={{ width: 220, height: 220 }}>
                <Pie
                  data={pieData}
                  angleField="value"
                  colorField="type"
                  scale={{ color: { range: PIE_COLORS } }}
                  innerRadius={0.65}
                  height={220}
                  width={220}
                  label={false}
                  legend={false}
                  tooltip={{ title: 'name' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-2xl font-bold text-slate-800 leading-tight">{totalUsers}</p>
                  <p className="text-[11px] text-slate-400 leading-tight">Active<br />Users</p>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {pieData.map((d, i) => (
                  <div key={d.type} className="flex items-center gap-2 text-[13px]">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-600 truncate">{d.type}</span>
                    <span className="ml-auto font-semibold text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Maintenance */}
        <div className="rounded-lg p-4" style={{ backgroundColor: '#FEFEFA' }}>
          <p className="text-sm font-semibold text-slate-700 mb-4">User Maintenance</p>
          <div className="flex gap-4 h-[calc(100%-28px)]">
            <MaintenanceCard
              icon={KeyRound}
              title="Password Reset"
              description="Show pending password reset requests"
              accent="violet"
              active={filter === 'PASSWORD_RESET'}
              onClick={() => setFilter('PASSWORD_RESET')}
              count={passwordResetCount}
            />
            <MaintenanceCard
              icon={LockKeyholeOpen}
              title="Unlock Account"
              description="Show pending account unlock requests"
              accent="teal"
              active={filter === 'UNLOCK'}
              onClick={() => setFilter('UNLOCK')}
              count={unlockCount}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Currently locked accounts — automatic lockouts, independent of self-reported requests */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <ShieldAlert size={14} className="text-slate-400" />
          <span className="text-[13px] font-semibold text-slate-700">Currently Locked Accounts</span>
          <Tag className="ml-1 text-[11px]">{lockedAccounts.length}</Tag>
        </div>
        {!lockedLoading && lockedAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14">
            <div className="w-11 h-11 rounded-full bg-emerald-50 flex items-center justify-center">
              <ShieldCheck size={20} className="text-emerald-500" />
            </div>
            <p className="text-[13px] font-semibold text-slate-700">All accounts unlocked</p>
            <p className="text-[12px] text-slate-400">No login lockouts to review right now</p>
          </div>
        ) : (
          <Table
            dataSource={lockedAccounts}
            columns={lockedColumns}
            rowKey="id"
            size="middle"
            loading={lockedLoading}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
          />
        )}
      </div>

      {/* Pending login issue requests — filtered by whichever Maintenance card is active */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Search size={14} className="text-slate-400" />
          <span className="text-[13px] font-semibold text-slate-700">
            {filter === 'UNLOCK' ? 'Pending Unlock Requests' : 'Pending Password Reset Requests'}
          </span>
          <Tag color={requests.length > 0 ? 'red' : undefined} className="ml-1 text-[11px]">{requests.length}</Tag>
        </div>
        <Table
          dataSource={requests}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={issuesLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
          locale={{ emptyText: filter === 'UNLOCK' ? 'No pending unlock requests' : 'No pending password reset requests' }}
        />
      </div>
      </div>
    </div>
  )
}
