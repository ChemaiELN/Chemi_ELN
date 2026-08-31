import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Alert } from 'antd'
import { Column, Pie } from '@ant-design/plots'
import dayjs from 'dayjs'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import {
  Package2, FlaskConical, AlertTriangle, Clock, PackageX,
  ShoppingCart, ClipboardCheck, Wrench, CalendarCheck2,
} from 'lucide-react'
import {
  dashboardApi,
  type DashboardKPIs, type PendingApproval, type MaintenanceCalibrationDue,
  type EquipmentStatusBreakdown, type ExpiryTimelinePoint, type ExpiringBatch,
} from '../../api/inventory'

function KpiCard({
  label, value, icon: Icon, bg, iconColor, sub, onClick,
}: { label: string; value: number; icon: React.ElementType; bg: string; iconColor: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      className={`group relative overflow-hidden glass-card rounded-lg p-4 lg:p-5 flex items-center gap-3 lg:gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out ${bg}`} />
      <div className={`relative w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out"
          style={{ backgroundColor: '#FEFEFA' }}
        />
        <Icon size={18} className={`relative ${iconColor} lg:w-5 lg:h-5`} />
      </div>
      <div className="relative min-w-0">
        <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
        <p className="text-xs lg:text-sm text-slate-500 mt-0.5 leading-tight truncate">
          {label}
          {sub && <span className="text-[10px] lg:text-xs text-slate-400"> · {sub}</span>}
        </p>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, iconColor, title, count }: { icon: React.ElementType; iconColor: string; title: string; count?: number }) {
  return (
    <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-white/40 flex items-center gap-2">
      <Icon size={14} className={iconColor} />
      <span className="font-semibold text-sm lg:text-base text-slate-700">{title}</span>
      {count != null && <span className="ml-auto text-xs lg:text-sm text-slate-400">{count} item{count !== 1 ? 's' : ''}</span>}
    </div>
  )
}

export default function InventoryDashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null)
  const [expiring, setExpiring] = useState<ExpiringBatch[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [dueItems, setDueItems] = useState<MaintenanceCalibrationDue[]>([])
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatusBreakdown | null>(null)
  const [expiryTimeline, setExpiryTimeline] = useState<ExpiryTimelinePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      dashboardApi.kpis(),
      dashboardApi.expiringSoon(30),
      dashboardApi.pendingApprovals(),
      dashboardApi.maintenanceCalibrationDue(7),
      dashboardApi.equipmentStatus(),
      dashboardApi.expiryTimeline(6),
    ])
      .then(([k, e, pa, due, es, et]) => {
        setKpis(k)
        setExpiring(e)
        setPendingApprovals(pa)
        setDueItems(due)
        setEquipmentStatus(es)
        setExpiryTimeline(et)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><BrandSpinner fullScreen={false} label="Loading inventory dashboard…" /></div>
  if (error) return <Alert type="error" message={error} className="m-6" />
  if (!kpis) return null

  const expiryColumns = [
    { title: 'Batch No', ellipsis: true, dataIndex: 'batch_no', key: 'batch_no', width: 140 },
    { title: 'Inhouse Batch', ellipsis: true, dataIndex: 'inhouse_batch_no', key: 'inhouse_batch_no', width: 140 },
    { title: 'Qty Available', ellipsis: true, dataIndex: 'qty_available', key: 'qty_available', width: 110, render: (v: number, r: ExpiringBatch) => `${v} ${r.unit}` },
    { title: 'Expiry Date', ellipsis: true, dataIndex: 'expiry_date', key: 'expiry_date', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Days Remaining',
      ellipsis: true,
      key: 'days_remaining',
      width: 130,
      render: (_: unknown, r: ExpiringBatch) => {
        const days = dayjs(r.expiry_date).diff(dayjs().startOf('day'), 'day')
        return <StatusTag color={days <= 7 ? 'red' : days <= 15 ? 'orange' : 'green'}>{days} day{days !== 1 ? 's' : ''}</StatusTag>
      },
    },
  ]

  const approvalColumns = [
    { title: 'Type', ellipsis: true, dataIndex: 'type', key: 'type', width: 120 },
    { title: 'Reference No', ellipsis: true, dataIndex: 'reference_no', key: 'reference_no', width: 160 },
    { title: 'Raised By', ellipsis: true, dataIndex: 'raised_by', key: 'raised_by', width: 140, render: (v: string | null) => v ?? 'NA' },
    { title: 'Age', ellipsis: true, dataIndex: 'age_days', key: 'age_days', width: 100, render: (v: number | null) => v != null ? `${v} day${v !== 1 ? 's' : ''}` : 'NA' },
  ]

  const dueColumns = [
    { title: 'Type', ellipsis: true, dataIndex: 'type', key: 'type', width: 110, render: (v: string) => <StatusTag color={v === 'Calibration' ? 'blue' : 'purple'}>{v}</StatusTag> },
    { title: 'Asset Code', ellipsis: true, dataIndex: 'asset_code', key: 'asset_code', width: 130 },
    { title: 'Asset Name', ellipsis: true, dataIndex: 'asset_name', key: 'asset_name', width: 180 },
    { title: 'Due Date', ellipsis: true, dataIndex: 'due_date', key: 'due_date', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    {
      title: 'Days Until Due', ellipsis: true, dataIndex: 'days_until_due', key: 'days_until_due', width: 130,
      render: (v: number) => <StatusTag color={v <= 0 ? 'red' : v <= 3 ? 'orange' : 'green'}>{v <= 0 ? 'Overdue' : `${v} day${v !== 1 ? 's' : ''}`}</StatusTag>,
    },
  ]

  const statusPieData = [
    ...(equipmentStatus?.equipment ?? []).map(s => ({ status: s.status, count: s.count, kind: 'Equipment' })),
  ]
  const instrumentPieData = [
    ...(equipmentStatus?.instruments ?? []).map(s => ({ status: s.status, count: s.count, kind: 'Instrument' })),
  ]

  return (
    <div className="p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Section 1 — KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
  <KpiCard
    label="Active Materials"
    value={kpis.active_materials}
    icon={FlaskConical}
    bg="bg-gradient-to-br from-violet-50 to-violet-100"
    iconColor="text-violet-600"
    onClick={() => navigate('/inventory/materials')}
  />

  <KpiCard
    label="Available Batches"
    value={kpis.available_batches}
    icon={Package2}
    bg="bg-gradient-to-br from-blue-50 to-blue-100"
    iconColor="text-blue-600"
    onClick={() => navigate('/inventory/batches')}
  />

  <KpiCard
    label="Out of Stock"
    value={kpis.out_of_stock}
    icon={PackageX}
    bg="bg-gradient-to-br from-red-50 to-red-100"
    iconColor="text-red-600"
    onClick={() => navigate('/inventory/materials')}
  />

  <KpiCard
    label="Expiring Soon"
    value={kpis.expiring_soon}
    icon={Clock}
    bg="bg-gradient-to-br from-yellow-50 to-yellow-100"
    iconColor="text-yellow-600"
    sub="≤30 days"
    onClick={() => navigate('/inventory/batches')}
  />

  {/* <KpiCard
    label="Expired"
    value={kpis.expired}
    icon={AlertTriangle}
    bg="bg-gradient-to-br from-rose-50 to-rose-100"
    iconColor="text-rose-600"
    sub="with stock"
    onClick={() => navigate('/inventory/batches')}
  /> */}
</div>

      {/* Section 2 — Compliance & approval strip */}
   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
  <KpiCard
    label="Pending Requests"
    value={kpis.pending_stock_requests}
    icon={ShoppingCart}
    bg="bg-gradient-to-br from-blue-50 to-blue-100"
    iconColor="text-blue-600"
    onClick={() => navigate('/inventory/stock-requests')}
  />

  <KpiCard
    label="Pending Approvals"
    value={kpis.pending_approvals_total}
    icon={ClipboardCheck}
    bg="bg-gradient-to-br from-violet-50 to-violet-100"
    iconColor="text-violet-600"
    sub="requests + orders + checklists"
  />

  <KpiCard
    label="Maintenance Due"
    value={kpis.maintenance_due}
    icon={Wrench}
    bg="bg-gradient-to-br from-amber-50 to-amber-100"
    iconColor="text-amber-600"
    sub="≤7 days"
    onClick={() => navigate('/inventory/planner?tab=maintenance')}
  />

  <KpiCard
    label="Calibration Due"
    value={kpis.calibration_due}
    icon={CalendarCheck2}
    bg="bg-gradient-to-br from-emerald-50 to-emerald-100"
    iconColor="text-emerald-600"
    sub="≤7 days"
    onClick={() => navigate('/inventory/planner?tab=calibration')}
  />
</div>

      {/* Section 3 — Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={Clock} iconColor="text-orange-500" title="Expiry Timeline" />
          <div className="p-4">
            {expiryTimeline.length === 0
              ? <p className="text-[13px] text-slate-400 text-center py-10">No batches expiring in the next 6 months</p>
              : (
                <Column
                  data={expiryTimeline}
                  xField="month"
                  yField="count"
                  height={260}
                  label={{ position: 'top' }}
                  axis={{ y: { title: 'Batches expiring' } }}
                  style={{ fill: '#b9a0f3', fillOpacity: 0.75, radiusTopLeft: 4, radiusTopRight: 4 }}
                />
              )}
          </div>
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={Wrench} iconColor="text-fuchsia-500" title="Equipment & Instrument Status" />
          <div className="p-4 grid grid-cols-2 gap-2">
            {statusPieData.length === 0
              ? <p className="text-[13px] text-slate-400 text-center py-10 col-span-2">No equipment records</p>
              : (
                <div>
                  <p className="text-center text-xs text-slate-500 mb-1">Equipment</p>
                  <Pie data={statusPieData} angleField="count" colorField="status" innerRadius={0.6} height={220} label={false} legend={{ color: { position: 'bottom' } }} />
                </div>
              )}
            {instrumentPieData.length === 0
              ? <p className="text-[13px] text-slate-400 text-center py-10">No instrument records</p>
              : (
                <div>
                  <p className="text-center text-xs text-slate-500 mb-1">Instruments</p>
                  <Pie data={instrumentPieData} angleField="count" colorField="status" innerRadius={0.6} height={220} label={false} legend={{ color: { position: 'bottom' } }} />
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Section 4 — Action tables */}
      <div className="glass-card rounded-lg overflow-hidden">
        <SectionHeader icon={Clock} iconColor="text-orange-500" title="Expiring in 30 Days" count={expiring.length} />
        <Table
          dataSource={expiring}
          columns={expiryColumns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600 }}
          locale={{ emptyText: 'No batches expiring soon' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={ClipboardCheck} iconColor="text-indigo-500" title="Pending Approvals" count={pendingApprovals.length} />
          <Table
            dataSource={pendingApprovals}
            columns={approvalColumns}
            rowKey={(r) => `${r.type}-${r.reference_no}`}
            size="small"
            pagination={false}
            scroll={{ x: 500, y: 320 }}
            locale={{ emptyText: 'No pending approvals' }}
          />
        </div>

        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={Wrench} iconColor="text-fuchsia-500" title="Upcoming Maintenance & Calibration" count={dueItems.length} />
          <Table
            dataSource={dueItems}
            columns={dueColumns}
            rowKey={(r) => `${r.type}-${r.asset_code}`}
            size="small"
            pagination={false}
            scroll={{ x: 550, y: 320 }}
            locale={{ emptyText: 'Nothing due in the next 7 days' }}
          />
        </div>
      </div>
    </div>
  )
}
