import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Empty, message } from 'antd'
import { ArrowLeft, Printer, FileSpreadsheet } from 'lucide-react'
import { gatePassApi, type GatePassDetail } from '../../api/inventory'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { EMPTY_VALUE_TEXT } from '../../components/ui/EmptyValue'

const inr = (n: number | string | null) => Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

// Print CSS: hide the whole app chrome and show only the challan when printing.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .gp-print-area, .gp-print-area * { visibility: visible !important; }
  .gp-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .gp-no-print { display: none !important; }
  @page { margin: 16mm; }
}
.gp-challan { max-width: 720px; margin: 0 auto; color: #1a202c; font-size: 13px; }
.gp-challan h2 { text-align: center; font-size: 18px; font-weight: 700; margin-bottom: 2px; }
.gp-challan .company { text-align: center; color: #64748b; font-size: 12px; margin-bottom: 16px; }
.gp-challan .challan-head { display: flex; justify-content: space-between; border: 1px solid #334155; padding: 10px; margin-bottom: 12px; font-size: 12px; gap: 12px; }
.gp-challan table { width: 100%; border-collapse: collapse; border: 1px solid #334155; }
.gp-challan th, .gp-challan td { border: 1px solid #94a3b8; padding: 6px 8px; font-size: 12px; }
.gp-challan th { background: #f1f5f9; text-align: left; }
.gp-challan .num { text-align: right; }
.gp-challan .sig { display: flex; justify-content: space-between; margin-top: 48px; font-size: 12px; }
.gp-challan .sig > div { text-align: center; width: 30%; border-top: 1px solid #334155; padding-top: 6px; }
`

export default function GatePassPrintPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [gp, setGp] = useState<GatePassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setGp(await gatePassApi.get(Number(id))) }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const exportExcel = async () => {
    if (!gp) return
    setExporting(true)
    try { await gatePassApi.exportExcel(gp.id) }
    catch (e: unknown) { message.error((e as Error).message || 'Export failed') }
    finally { setExporting(false) }
  }

  if (loading) return <div className="p-10 flex justify-center"><BrandSpinner fullScreen={false} label="Loading gate pass challan…" /></div>
  if (!gp) return <div className="p-10"><Empty description="Gate pass not found" /></div>

  const returnable = gp.doc_type === 'RETURNABLE'
  const total = gp.items.reduce((s, i) => s + Number(i.total_value || 0), 0)

  return (
    <div className="p-4 md:p-6">
      <style>{PRINT_CSS}</style>

      <div className="gp-no-print flex gap-2 mb-4">
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate(`/inventory/gate-passes/${gp.id}`)}>Back</Button>
        <Button type="primary" icon={<Printer size={14} />} onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button icon={<FileSpreadsheet size={14} />} loading={exporting} onClick={exportExcel}>Download Excel</Button>
      </div>

      <div className="gp-print-area">
        <div className="gp-challan glass-card" style={{ background: '#fff', padding: 30, borderRadius: 8 }}>
          <h2>{returnable ? 'ZECR – RETURNABLE GATE PASS (RGP)' : 'ZED – NON-RETURNABLE GATE PASS (NRGP)'}</h2>
          <div className="company">Laurus Labs</div>

          <div className="challan-head">
            <div>
              <strong>GP No:</strong> {gp.gp_number}<br />
              <strong>Date:</strong> {gp.gp_date}<br />
              <strong>Type:</strong> {returnable ? 'ZECR – RGP' : 'ZED – NRGP'}<br />
              <strong>Status:</strong> {gp.status.replace(/_/g, ' ')}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>Vendor:</strong> {gp.vendor_name || EMPTY_VALUE_TEXT}<br />
              <strong>Code:</strong> {gp.vendor_code || EMPTY_VALUE_TEXT}<br />
              <strong>PR No:</strong> {gp.pr_number || EMPTY_VALUE_TEXT}<br />
              <strong>Work Order:</strong> {gp.work_order_no || EMPTY_VALUE_TEXT}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th><th>Code</th><th>Material</th><th>Description</th>
                <th className="num">Qty</th><th>UOM</th><th className="num">Rate</th><th className="num">Total</th>
                {returnable && <th className="num">Returned</th>}
                {returnable && <th className="num">Balance</th>}
              </tr>
            </thead>
            <tbody>
              {gp.items.map(i => (
                <tr key={i.sr_no}>
                  <td>{i.sr_no}</td>
                  <td>{i.material_code || EMPTY_VALUE_TEXT}</td>
                  <td>{i.material_name}</td>
                  <td>{i.description || EMPTY_VALUE_TEXT}</td>
                  <td className="num">{i.quantity}</td>
                  <td>{i.uom || EMPTY_VALUE_TEXT}</td>
                  <td className="num">{inr(i.rate)}</td>
                  <td className="num">{inr(i.total_value)}</td>
                  {returnable && <td className="num">{i.returned_qty}</td>}
                  {returnable && <td className="num">{Number(i.quantity) - Number(i.returned_qty)}</td>}
                </tr>
              ))}
              <tr>
                <td className="num" colSpan={7} style={{ fontWeight: 700 }}>Grand Total (₹)</td>
                <td className="num" style={{ fontWeight: 700 }}>{inr(total)}</td>
                {returnable && <><td /><td /></>}
              </tr>
            </tbody>
          </table>

          {gp.remarks && <div style={{ marginTop: 12, fontSize: 12 }}><strong>Remarks:</strong> {gp.remarks}</div>}

          <div className="sig">
            <div>Prepared By</div>
            <div>Security</div>
            <div>Authorized By</div>
          </div>
        </div>
      </div>
    </div>
  )
}
