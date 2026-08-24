import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Tabs, Button, Empty, Table, Modal, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { useServerTable } from '../../hooks/useServerTable'
import {
  equipmentCatalogueApi, equipmentTypeApi, auditTrailApi,
  type EquipmentCatalogue, type EquipType, type AuditTrailEntry,
} from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'
import { STATUS_COLOR } from './EquipmentPage'
import LogMappingTab from './LogMappingTab'
import ScheduleTab from './ScheduleTab'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2 px-1">
      <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className="text-[13px] text-slate-800">{value ?? <span className="text-slate-800">NA</span>}</p>
    </div>
  )
}

function AuditTab({ entityId }: { entityId: number }) {
  // Paged by the server. This used to fetch a fixed 200 rows and paginate them
  // in the browser, so an asset with a longer history simply lost the rest.
  const fetcher = useCallback(
    (params: Record<string, unknown>) => auditTrailApi.listPaged(params),
    [],
  )
  const filters = useMemo(
    () => ({ entity_type: 'inv_equipment_catalogue', entity_id: entityId }),
    [entityId],
  )
  const { tableProps } = useServerTable<AuditTrailEntry>(fetcher, { filters })
  const columns: ColumnsType<AuditTrailEntry> = [
    { title: 'Event', ellipsis: true, dataIndex: 'event_type', width: 210, render: v => <span className="text-[13px] font-medium text-slate-700">{v.replace(/_/g, ' ')}</span> },
    { title: 'By', ellipsis: true, dataIndex: 'performed_by', width: 140, render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'When', ellipsis: true, dataIndex: 'performed_at', width: 170, render: v => <span className="text-[13px] text-slate-600">{dayjs(v).format('DD/MM/YYYY HH:mm')}</span> },
    { title: 'Old', ellipsis: true, dataIndex: 'old_value', render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <span className="text-slate-500">NA</span> },
    { title: 'New', ellipsis: true, dataIndex: 'new_value', render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <span className="text-slate-500">NA</span> },
    { title: 'Details', ellipsis: true, dataIndex: 'details', render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <span className="text-slate-500">NA</span> },
  ]
  return <Table {...tableProps} columns={columns} rowKey="id" size="small" scroll={{ x: 'max-content' }} />
}

export default function EquipmentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<EquipmentCatalogue | null>(null)
  const [types, setTypes] = useState<EquipType[]>([])
  const [loading, setLoading] = useState(true)
  const [qrOpen, setQrOpen] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    equipmentCatalogueApi.get(Number(id))
      .then(setItem)
      .catch(e => message.error((e as Error).message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])
  useEffect(() => { equipmentTypeApi.list().then(setTypes) }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><BrandSpinner fullScreen={false} label="Loading equipment details…" /></div>
  if (!item) return <div className="p-6"><Empty description="Equipment not found" /></div>

  const typeName = types.find(t => t.id === item.equipment_type_id)?.name ?? null

  const summary = (
    <div className="glass-card rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
      <Field label="Equipment Code" value={<span className="">{item.asset_id}</span>} />
      <Field label="Equipment Type" value={typeName} />
      <Field label="Status" value={(() => { const s = item.effective_status ?? item.status; return <StatusTag color={STATUS_COLOR[s] ?? 'default'}>{s.replace(/_/g, ' ')}</StatusTag> })()} />
      <Field label="Maintenance Status" value={item.maintenance_status} />
      <Field label="Name" value={item.name} />
      <Field label="Usage Type" value={item.usage_type} />
      <Field label="Manufacturer / Make" value={item.make} />
      <Field label="Model Name" value={item.model} />
      <Field label="Serial No" value={item.serial_no} />
      <Field label="Location" value={item.location} />
      <Field label="Movable" value={item.movable ? 'Yes' : 'No'} />
      <Field label="Gross Capacity" value={item.gross_capacity != null ? `${item.gross_capacity} ${item.capacity_unit ?? ''}`.trim() : null} />
      <Field label="Last Maintenance" value={item.last_maintenance_date} />
      <Field label="Next Maintenance" value={item.next_maintenance_date} />
      <div className="col-span-2 md:col-span-4"><Field label="Description" value={item.description} /></div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        {/* <Button icon={<ArrowLeft size={15} />} onClick={() => navigate('/inventory/equipment')}>Back</Button> */}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{item.asset_id}</h1>
          <p className="text-slate-500 text-sm truncate">{item.name}</p>
        </div>
        {/* <Button className="ml-auto" icon={<QrCode size={15} />} onClick={() => setQrOpen(true)}>QR Code</Button> */}
      </div>

      <Tabs
        items={[
          { key: 'summary', label: 'Summary', children: summary },
          { key: 'log-mapping', label: 'Log Mapping', children: <LogMappingTab targetKind="EQUIPMENT" targetId={item.id} /> },
          { key: 'maintenance-schedule', label: 'Maintenance Schedule', children: <ScheduleTab targetKind="EQUIPMENT" targetId={item.id} logType="MAINTENANCE" /> },
          { key: 'audit', label: 'Audit Trail', children: <div className="glass-card rounded-lg overflow-hidden"><AuditTab entityId={item.id} /></div> },
        ]}
      />

      <Modal open={qrOpen} closable={false} onCancel={() => setQrOpen(false)} footer={null} centered width={320} destroyOnHidden {...glassModalProps}>
        <div className="flex flex-col items-center gap-3 py-2">
          <QRCodeSVG value={item.asset_id} size={200} level="M" includeMargin />
          <div className="text-center">
            <p className="  font-semibold text-slate-800">{item.asset_id}</p>
            <p className="text-slate-500 text-sm">{item.name}</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
