import { useEffect, useState } from 'react'
import { Card, Statistic, Table, Spin, Alert } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import {
  Package2, FlaskConical, AlertTriangle, Clock, Wrench,
  Activity, ShoppingCart, CheckCircle2,
} from 'lucide-react'
import { dashboardApi, type DashboardKPIs } from '../../api/inventory'

function KpiCard({
  label, value, icon: Icon, bg, iconColor, sub,
}: { label: string; value: number; icon: React.ElementType; bg: string; iconColor: string; sub?: string }) {
  return (
    <div className="glass-card rounded-lg p-4 lg:p-5 flex items-center gap-3 lg:gap-4">
      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
        <Icon size={18} className={`${iconColor} lg:w-5 lg:h-5`} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl lg:text-3xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs lg:text-sm text-slate-500 mt-0.5 leading-tight">{label}</p>
        {sub && <p className="text-[10px] lg:text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function InventoryDashboard() {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [expiring, setExpiring] = useState<unknown[]>([])
  const [pendingActions, setPendingActions] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      dashboardApi.kpis(),
      dashboardApi.expiringSoon(30),
      dashboardApi.pendingActions(),
    ])
      .then(([k, e, p]) => {
        setKpis(k)
        setExpiring(e as unknown[])
        setPendingActions(p)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  if (error) return <Alert type="error" message={error} className="m-6" />
  if (!kpis) return null

  const expiryColumns = [
    { title: 'Batch No', dataIndex: 'batch_no', key: 'batch_no', width: 140 },
    { title: 'Inhouse Batch', dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140 },
    { title: 'Qty Available', dataIndex: 'qty_available', key: 'qty_available', width: 110, render: (v: number, r: Record<string, unknown>) => `${v} ${r.unit}` },
    { title: 'Expiry Date', dataIndex: 'expiry_date', key: 'expiry_date', width: 120 },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_: unknown, r: Record<string, unknown>) => (
        <StatusTag color={r.status === 'AVAILABLE' ? 'green' : 'orange'}>{r.status as string}</StatusTag>
      ),
    },
  ]

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        <KpiCard label="Active Materials" value={kpis.active_materials} icon={FlaskConical} bg="bg-gradient-to-br from-violet-100 to-purple-200" iconColor="text-violet-600" />
        <KpiCard label="Available Batches" value={kpis.available_batches} icon={Package2} bg="bg-gradient-to-br from-emerald-100 to-emerald-200" iconColor="text-emerald-600" />
        <KpiCard label="Low Stock" value={kpis.low_stock} icon={AlertTriangle} bg="bg-gradient-to-br from-amber-100 to-yellow-200" iconColor="text-amber-600" sub="<10% remaining" />
        <KpiCard label="Expiring Soon" value={kpis.expiring_soon} icon={Clock} bg="bg-gradient-to-br from-orange-100 to-amber-200" iconColor="text-orange-600" sub="≤30 days" />
        <KpiCard label="Expired" value={kpis.expired} icon={AlertTriangle} bg="bg-gradient-to-br from-red-100 to-rose-200" iconColor="text-red-600" sub="with stock" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        <KpiCard label="Pending Requests" value={kpis.pending_stock_requests} icon={ShoppingCart} bg="bg-gradient-to-br from-blue-100 to-indigo-200" iconColor="text-blue-600" />
        <KpiCard label="Critical Requests" value={kpis.critical_stock_requests} icon={AlertTriangle} bg="bg-gradient-to-br from-red-100 to-pink-200" iconColor="text-red-600" />
        <KpiCard label="Maintenance Due" value={kpis.maintenance_due} icon={Wrench} bg="bg-gradient-to-br from-yellow-100 to-amber-200" iconColor="text-yellow-700" />
        <KpiCard label="Calibration Due" value={kpis.calibration_due} icon={Activity} bg="bg-gradient-to-br from-cyan-100 to-sky-200" iconColor="text-cyan-600" />
        <KpiCard label="Pending Verifications" value={kpis.pending_verifications} icon={CheckCircle2} bg="bg-gradient-to-br from-purple-100 to-violet-200" iconColor="text-purple-600" />
      </div>

      {/* Expiring Soon */}
      <div className="glass-card rounded-lg overflow-hidden">
        <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-white/40 flex items-center gap-2">
          <Clock size={14} className="text-orange-500" />
          <span className="font-semibold text-sm lg:text-base text-slate-700">Expiring in 30 Days</span>
          <span className="ml-auto text-xs lg:text-sm text-slate-400">{expiring.length} batch{expiring.length !== 1 ? 'es' : ''}</span>
        </div>
        <Table
          dataSource={expiring as Record<string, unknown>[]}
          columns={expiryColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
          locale={{ emptyText: 'No batches expiring soon' }}
        />
      </div>

      {/* Pending Actions */}
      <div className="glass-card rounded-lg p-4 lg:p-6">
        <p className="font-semibold text-sm lg:text-base text-slate-700 mb-3 lg:mb-4">Pending Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:gap-4">
          {Object.entries(pendingActions).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between bg-white/40 rounded-md px-3 lg:px-4 py-2 lg:py-3">
              <span className="text-xs lg:text-sm text-slate-600 capitalize">{k.replaceAll('_', ' ')}</span>
              <span className={`text-sm lg:text-base font-bold ${v > 0 ? 'text-violet-600' : 'text-slate-400'}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
