import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Button, Empty, Table, Modal, Form, Input, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, Check, Edit3, CheckCircle2, Truck, RotateCcw, Printer, Package, FileSignature } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { glassModalProps } from '../../utils/modalStyles'
import { gatePassApi, type GatePassDetail, type GatePassItem, type GatePassReturn, type GatePassSignature } from '../../api/inventory'
import { EmptyValue } from '../../components/ui/EmptyValue'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', CREATED: 'blue', APPROVED: 'green', DISPATCHED: 'orange',
  PARTIALLY_RETURNED: 'magenta', CLOSED: 'default', CANCELLED: 'red',
}
const COND_COLOR: Record<string, string> = { OK: 'green', DAMAGED: 'red', REJECTED: 'red' }
const inr = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

// Ordered lifecycle used to render the progress timeline.
const FLOW = ['DRAFT', 'CREATED', 'APPROVED', 'DISPATCHED', 'CLOSED']

function ESignModal({ open, title, onClose, onSubmit, saving }: {
  open: boolean; title: string; onClose: () => void
  onSubmit: (v: { password: string; comment: string }) => void; saving: boolean
}) {
  const [form] = Form.useForm()
  useEffect(() => { if (open) form.resetFields() }, [open, form])
  return (
    <Modal title={title} open={open} closable={false} onCancel={onClose} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password autoComplete="off" /></Form.Item>
        <Form.Item name="comment" label="Comments" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}

const SIG_COLOR: Record<string, string> = { APPROVED: 'green', DISPATCHED: 'orange', REJECTED: 'red' }

// Splits table width evenly across every column (paired with tableLayout="fixed")
// instead of each column picking its own width — keeps columns aligned to a
// consistent grid across all three tables on this page.
function evenWidths<T>(cols: ColumnsType<T>): ColumnsType<T> {
  const width = `${(100 / cols.length).toFixed(4)}%`
  return cols.map(c => ({ ...c, width }))
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-[14px] font-semibold text-slate-700">{title}</span>
      {count != null && (
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 ml-0.5">{count}</span>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-2 px-1">
      <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</p>
      <p className="text-[13px] text-slate-800">{value ?? <span className="text-slate-400">NA</span>}</p>
    </div>
  )
}

function StatusFlow({ status }: { status: string }) {
  // PARTIALLY_RETURNED sits between DISPATCHED and CLOSED on the DISPATCHED node.
  const effective = status === 'PARTIALLY_RETURNED' ? 'DISPATCHED' : status
  const cur = FLOW.indexOf(effective)
  const closed = status === 'CLOSED'
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-3 px-1">
      {FLOW.map((step, i) => {
        const done = closed || i < cur
        const current = !closed && i === cur
        return (
          <div className="flex items-center" key={step}>
            {i > 0 && <div className="h-0.5 w-9 shrink-0" style={{ background: done || current ? '#10b981' : '#e2e8f0' }} />}
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                style={{
                  background: done ? '#10b981' : current ? '#3b82f6' : '#e2e8f0',
                  color: done || current ? '#fff' : '#94a3b8',
                }}
              >
                {done ? <Check size={13} /> : i + 1}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">{step}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function GatePassDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gp, setGp] = useState<GatePassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [esign, setEsign] = useState<null | 'approve' | 'dispatch'>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGp(await gatePassApi.get(Number(id))) }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const doESign = async (v: { password: string; comment: string }) => {
    if (!gp || !esign) return
    setSaving(true)
    try {
      const updated = esign === 'approve'
        ? await gatePassApi.approve(gp.id, v)
        : await gatePassApi.dispatch(gp.id, v)
      setGp(updated)
      message.success(`${updated.gp_number} ${esign === 'approve' ? 'approved' : 'dispatched'}`)
      setEsign(null)
    } catch (e: unknown) {
      message.error((e as Error).message || 'Action failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="p-10 flex justify-center"><BrandSpinner fullScreen={false} label="Loading gate pass details…" /></div>
  if (!gp) return <div className="p-10"><Empty description="Gate pass not found" /></div>

  const isReturnable = gp.doc_type === 'RETURNABLE'

  const itemColBase: ColumnsType<GatePassItem> = [
    { title: 'Code', dataIndex: 'material_code', render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <EmptyValue /> },
    { title: 'Material', dataIndex: 'material_name', ellipsis: true, render: v => <span className="text-[13px] font-medium text-slate-700">{v}</span> },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <EmptyValue /> },
    { title: 'Qty', dataIndex: 'quantity', align: 'right', render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'UOM', dataIndex: 'uom', render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <EmptyValue /> },
    { title: 'Rate (₹)', dataIndex: 'rate', align: 'right', render: v => <span className="text-[13px] text-slate-600">{inr(v)}</span> },
    { title: 'Total (₹)', dataIndex: 'total_value', align: 'right', render: v => <span className="text-[13px] font-semibold text-slate-800">{inr(v)}</span> },
    ...(isReturnable ? [
      { title: 'Returned', dataIndex: 'returned_qty', align: 'right' as const, render: (v: number) => <span className="text-[13px] text-slate-600">{v}</span> },
      { title: 'Balance', key: 'balance', align: 'right' as const, render: (_: unknown, r: GatePassItem) => {
        const bal = Number(r.quantity) - Number(r.returned_qty)
        return (
          <span
            className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
            style={bal > 0 ? { color: '#b45309', background: '#fef3c7' } : { color: '#047857', background: '#d1fae5' }}
          >
            {bal}
          </span>
        )
      } },
    ] : []),
  ]
  const itemCols = evenWidths(itemColBase)

  const itemsTotalValue = gp.items.reduce((s, it) => s + Number(it.total_value ?? 0), 0)
  const itemsTotalQty = gp.items.reduce((s, it) => s + Number(it.quantity ?? 0), 0)

  const returnCols = evenWidths<GatePassReturn>([
    { title: 'Return GP#', dataIndex: 'return_gp_number', render: v => <span className="text-[13px] font-medium text-slate-700">{v}</span> },
    { title: 'Date', dataIndex: 'return_date', render: v => <span className="text-[13px] text-slate-600">{v}</span> },
    { title: 'Item#', dataIndex: 'item_sr_no', align: 'center' },
    { title: 'Qty Received', dataIndex: 'received_qty', align: 'right' },
    { title: 'Condition', dataIndex: 'condition', render: v => v ? <StatusTag color={COND_COLOR[v] ?? 'default'}>{v}</StatusTag> : <EmptyValue /> },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <EmptyValue /> },
    { title: 'Received By', dataIndex: 'received_by', render: v => v ? <span className="text-[13px] text-slate-600">{v}</span> : <EmptyValue /> },
  ])

  const sigCols = evenWidths<GatePassSignature>([
    { title: 'Action', dataIndex: 'signing_for', render: v => <StatusTag color={SIG_COLOR[v] ?? 'default'}>{v}</StatusTag> },
    { title: 'By', dataIndex: 'name', render: v => <span className="text-[13px] font-medium text-slate-700">{v}</span> },
    { title: 'Comments', dataIndex: 'comments', ellipsis: true, render: v => v ? <span className="text-[13px] text-slate-500">{v}</span> : <EmptyValue /> },
    { title: 'Signed On', dataIndex: 'completed_on', render: v => <span className="text-[13px] text-slate-600">{dayjs(v).format('DD/MM/YYYY HH:mm')}</span> },
  ])

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="glass-card rounded-lg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/inventory/gate-passes')}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600 mb-1 transition-colors"
            >
              <ArrowLeft size={13} /> Back to Gate Passes
            </button>
            <div className="text-lg font-bold text-slate-800">{gp.gp_number}</div>
            <div className="flex gap-2 mt-1.5">
              <StatusTag color={isReturnable ? 'blue' : 'gold'}>{isReturnable ? 'RGP' : 'NRGP'}</StatusTag>
              <StatusTag color={STATUS_COLOR[gp.status] ?? 'default'}>{gp.status.replace(/_/g, ' ')}</StatusTag>
            </div>
          </div>
          <div className="flex gap-2">
            {['DRAFT', 'CREATED'].includes(gp.status) && (
              <Button icon={<Edit3 size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}/edit`)}>Edit</Button>
            )}
            {gp.status === 'CREATED' && (
              <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => setEsign('approve')}>Approve</Button>
            )}
            {gp.status === 'APPROVED' && (
              <Button type="primary" icon={<Truck size={14} />} onClick={() => setEsign('dispatch')}>Dispatch</Button>
            )}
            {isReturnable && ['DISPATCHED', 'PARTIALLY_RETURNED'].includes(gp.status) && (
              <Button type="primary" icon={<RotateCcw size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}/return`)}>Return Entry</Button>
            )}
            <Button icon={<Printer size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}/print`)}>Print</Button>
          </div>
        </div>

        <StatusFlow status={gp.status} />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 border-t border-slate-100 pt-2">
          <Field label="Vendor" value={gp.vendor_name ? `${gp.vendor_code ?? ''} – ${gp.vendor_name}` : null} />
          <Field label="Date" value={gp.gp_date} />
          <Field label="PR Number" value={gp.pr_number} />
          <Field label="Work Order" value={gp.work_order_no} />
          <Field label="Total Value" value={<span className="text-violet-600 font-semibold">₹ {inr(gp.total_value)}</span>} />
          <Field label="Created By" value={gp.created_by} />
          {gp.work_order_id && (
            <Field label="Source Work Order" value={
              <a className="text-violet-600" onClick={() => navigate(`/inventory/work-orders/${gp.work_order_id}`)}>{gp.workorder_no ?? `WO #${gp.work_order_id}`}</a>
            } />
          )}
          <div className="col-span-2 md:col-span-3"><Field label="Remarks" value={gp.remarks} /></div>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card rounded-lg overflow-hidden">
        <SectionHeader icon={<Package size={15} />} title="Material Items" count={gp.items.length} />
        <Table
          dataSource={gp.items} columns={itemCols} rowKey="id" size="small" pagination={false} tableLayout="fixed" scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No items on this gate pass' }}
          summary={() => gp.items.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-slate-50">
                {/* Code / Material / Description */}
                <Table.Summary.Cell index={0} colSpan={3}>
                  <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">Total</span>
                </Table.Summary.Cell>
                {/* Qty */}
                <Table.Summary.Cell index={3} align="right">
                  <span className="text-[13px] font-semibold text-slate-700">{itemsTotalQty}</span>
                </Table.Summary.Cell>
                {/* UOM */}
                <Table.Summary.Cell index={4} />
                {/* Rate (₹) */}
                <Table.Summary.Cell index={5} />
                {/* Total (₹) */}
                <Table.Summary.Cell index={6} align="right">
                  <span className="text-[13px] font-bold text-violet-600">₹ {inr(itemsTotalValue)}</span>
                </Table.Summary.Cell>
                {isReturnable && (
                  <>
                    {/* Returned */}
                    <Table.Summary.Cell index={7} />
                    {/* Balance */}
                    <Table.Summary.Cell index={8} />
                  </>
                )}
              </Table.Summary.Row>
            </Table.Summary>
          ) : null}
        />
      </div>

      {/* Return history (returnable only, when present) */}
      {isReturnable && gp.returns.length > 0 && (
        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={<RotateCcw size={15} />} title="Return History" count={gp.returns.length} />
          <Table dataSource={gp.returns} columns={returnCols} rowKey="id" size="small" pagination={false} tableLayout="fixed" scroll={{ x: 'max-content' }} />
        </div>
      )}

      {/* Signature ledger */}
      {gp.signatures.length > 0 && (
        <div className="glass-card rounded-lg overflow-hidden">
          <SectionHeader icon={<FileSignature size={15} />} title="Signatures" count={gp.signatures.length} />
          <Table dataSource={gp.signatures} columns={sigCols} rowKey="id" size="small" pagination={false} tableLayout="fixed" scroll={{ x: 'max-content' }} />
        </div>
      )}

      <ESignModal
        open={esign !== null}
        title={esign === 'approve' ? `Approve ${gp.gp_number}` : `Dispatch ${gp.gp_number}`}
        onClose={() => setEsign(null)}
        onSubmit={doESign}
        saving={saving}
      />
    </div>
  )
}
