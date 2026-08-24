import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { Button, Empty, Table, InputNumber, Select, Input, DatePicker, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, Save } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { gatePassApi, type GatePassDetail } from '../../api/inventory'

const COND_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'REJECTED', label: 'Rejected' },
]

interface EntryRow {
  sr_no: number
  material_name: string
  issued: number
  prev_returned: number
  balance: number
  received_qty: number | null
  condition: string
  remarks: string
}

export default function ReturnEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gp, setGp] = useState<GatePassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [returnDate, setReturnDate] = useState<Dayjs>(dayjs())
  const [rows, setRows] = useState<EntryRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await gatePassApi.get(Number(id))
      setGp(d)
      setRows(d.items.map(it => {
        const balance = Number(it.quantity) - Number(it.returned_qty)
        return {
          sr_no: it.sr_no, material_name: it.material_name,
          issued: Number(it.quantity), prev_returned: Number(it.returned_qty), balance,
          received_qty: null, condition: 'OK', remarks: '',
        }
      }))
    } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-10 flex justify-center"><BrandSpinner fullScreen={false} label="Loading return entry…" /></div>
  if (!gp) return <div className="p-10"><Empty description="Gate pass not found" /></div>

  const hasPendingBalance = rows.some(r => r.balance > 0)
  if (!hasPendingBalance) {
    return (
      <div className="p-10">
        <Empty description={`All items on ${gp.gp_number} have already been returned.`}>
          <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}`)}>Back to Gate Pass</Button>
        </Empty>
      </div>
    )
  }

  const setRow = (sr: number, patch: Partial<EntryRow>) =>
    setRows(rs => rs.map(r => (r.sr_no === sr ? { ...r, ...patch } : r)))

  const save = async () => {
    const active = rows.filter(r => r.received_qty && Number(r.received_qty) > 0)
    if (!active.length) { message.error('Enter a received quantity for at least one item.'); return }
    const over = active.find(r => Number(r.received_qty) > r.balance)
    if (over) { message.error(`Item ${over.sr_no}: received qty exceeds balance (${over.balance}).`); return }
    setSaving(true)
    try {
      const updated = await gatePassApi.processReturn(gp.id, {
        return_date: returnDate.format('YYYY-MM-DD'),
        entries: active.map(r => ({ item_sr_no: r.sr_no, received_qty: Number(r.received_qty), condition: r.condition, remarks: r.remarks || null })),
      })
      message.success(`Return recorded — ${gp.gp_number} is now ${updated.status.replace(/_/g, ' ')}`)
      navigate(`/inventory/gate-passes/${gp.id}`)
    } catch (e: unknown) {
      message.error((e as Error).message || 'Return failed')
    } finally { setSaving(false) }
  }

  const cols: ColumnsType<EntryRow> = [
    { title: '#', dataIndex: 'sr_no', width: 44 },
    { title: 'Material', dataIndex: 'material_name', ellipsis: true, width: 200, render: v => <span className="text-[13px] font-medium text-slate-700">{v}</span> },
    { title: 'Issued', dataIndex: 'issued', width: 90, align: 'right', render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Prev. Returned', dataIndex: 'prev_returned', width: 120, align: 'right', render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Balance', dataIndex: 'balance', width: 90, align: 'right', render: v => <span className="text-[13px] font-semibold" style={{ color: v > 0 ? '#d97706' : '#059669' }}>{v}</span> },
    {
      title: 'Received Qty', width: 120, render: (_v, r) => (
        <InputNumber size="small" min={0} max={r.balance} value={r.received_qty} disabled={r.balance <= 0}
          style={{ width: '100%' }} onChange={val => setRow(r.sr_no, { received_qty: val as number | null })} />
      ),
    },
    {
      title: 'Condition', width: 120, render: (_v, r) => (
        <Select size="small" style={{ width: '100%' }} value={r.condition} options={COND_OPTIONS} disabled={r.balance <= 0}
          onChange={val => setRow(r.sr_no, { condition: val })} />
      ),
    },
    {
      title: 'Remarks', width: 180, render: (_v, r) => (
        <Input size="small" value={r.remarks} placeholder="Notes" disabled={r.balance <= 0}
          onChange={e => setRow(r.sr_no, { remarks: e.target.value })} />
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="glass-card rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-slate-800">Return Entry — {gp.gp_number}</div>
            <div className="flex gap-2 mt-1.5 items-center">
              <StatusTag color="blue">RGP</StatusTag>
              <StatusTag color="magenta">{gp.status.replace(/_/g, ' ')}</StatusTag>
              <span className="text-[13px] text-slate-500">{gp.vendor_code} – {gp.vendor_name}</span>
            </div>
          </div>
          <Button size="small" icon={<ArrowLeft size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}`)}>Back</Button>
        </div>
        <div className="flex items-center gap-2 mt-3 border-t border-slate-100 pt-3">
          <span className="text-[12px] uppercase tracking-wide text-slate-400">Return Date</span>
          <DatePicker value={returnDate} format="YYYY-MM-DD" allowClear={false} onChange={d => setReturnDate(d ?? dayjs())} />
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-[14px] font-semibold text-slate-700">Enter Return Quantities</div>
        <Table dataSource={rows} columns={cols} rowKey="sr_no" size="small" pagination={false} scroll={{ x: 'max-content' }} />
      </div>

      <div className="flex justify-end gap-2">
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}`)}>Cancel</Button>
        <Button type="primary" icon={<Save size={14} />} loading={saving} onClick={save}>Save Return Entry</Button>
      </div>
    </div>
  )
}
