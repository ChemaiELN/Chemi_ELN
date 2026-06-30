import { useState, useMemo } from 'react'
import { InputNumber } from 'antd'

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface CalcInputs {
  scale_mg: number
  mab_stock_conc: number
  mab_rxn_conc: number
  final_total_vol_ml: number
  dar: number
  initial_rxn_vol_ml: number
  final_rxn_vol_ml: number
  mab_mw: number
  tcep_eq: number
  tcep_stock_mM: number
  edta_final_conc_mM: number
  edta_stock_mM: number
  lp_mw: number
  lp_eq: number
  lp_stock_mM: number
  dma_pct_limit: number
}

export interface CalcResults {
  mab_vol_ul: number
  mab_conc_uM: number
  tcep_vol_ul: number
  tcep_conc_uM: number
  edta_vol_ul: number
  buffer1_ul: number
  total_reduction_ul: number
  tff_vol_ml: number
  lp_vol_ul: number
  lp_conc_uM: number
  dma_vol_ul: number
  dma_pct_actual: number
  buffer2_ul: number
  total_conjugation_ul: number
}

interface CalcValue {
  inputs: Partial<CalcInputs>
  results: CalcResults
}

export interface ReactantCalculatorProps {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  contextData?: Record<string, unknown>
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_INPUTS: CalcInputs = {
  scale_mg: 10,
  mab_stock_conc: 5,
  mab_rxn_conc: 4,
  final_total_vol_ml: 2.5,
  dar: 8,
  initial_rxn_vol_ml: 2.25,
  final_rxn_vol_ml: 2.5,
  mab_mw: 150000,
  tcep_eq: 6,
  tcep_stock_mM: 5,
  edta_final_conc_mM: 5,
  edta_stock_mM: 100,
  lp_mw: 1038,
  lp_eq: 12,
  lp_stock_mM: 5,
  dma_pct_limit: 10,
}

// ─── Calculation Engine ────────────────────────────────────────────────────────

function safeDivide(a: number, b: number): number {
  if (!b || !isFinite(b)) return 0
  const r = a / b
  return isFinite(r) ? r : 0
}

function calculate(inputs: CalcInputs): CalcResults {
  const {
    scale_mg,
    mab_stock_conc,
    initial_rxn_vol_ml,
    final_rxn_vol_ml,
    mab_mw,
    tcep_eq,
    tcep_stock_mM,
    edta_final_conc_mM,
    edta_stock_mM,
    lp_eq,
    lp_stock_mM,
  } = inputs

  // REDUCTION
  const mab_moles    = safeDivide(scale_mg, mab_mw * 1000)          // mol
  const mab_vol_ml   = safeDivide(scale_mg, mab_stock_conc)          // mL
  const mab_vol_ul   = mab_vol_ml * 1000
  const mab_conc_uM  = safeDivide(mab_moles, initial_rxn_vol_ml / 1000) * 1e6

  const tcep_moles   = mab_moles * tcep_eq
  const tcep_vol_ml  = safeDivide(tcep_moles, tcep_stock_mM / 1000)
  const tcep_vol_ul  = tcep_vol_ml * 1000
  const tcep_conc_uM = safeDivide(tcep_moles, initial_rxn_vol_ml / 1000) * 1e6

  const edta_vol_ml  = safeDivide(edta_final_conc_mM * initial_rxn_vol_ml, edta_stock_mM)
  const edta_vol_ul  = edta_vol_ml * 1000

  const buffer1_ml   = Math.max(0, initial_rxn_vol_ml - mab_vol_ml - tcep_vol_ml - edta_vol_ml)
  const buffer1_ul   = buffer1_ml * 1000

  const total_reduction_ul = mab_vol_ul + tcep_vol_ul + edta_vol_ul + buffer1_ul
  const tff_vol_ml = initial_rxn_vol_ml

  // CONJUGATION
  const lp_moles    = mab_moles * lp_eq
  const lp_vol_ml   = safeDivide(lp_moles, lp_stock_mM / 1000)
  const lp_vol_ul   = lp_vol_ml * 1000
  const lp_conc_uM  = safeDivide(lp_moles, final_rxn_vol_ml / 1000) * 1e6

  const dma_vol_ml  = Math.max(0, final_rxn_vol_ml - tff_vol_ml - lp_vol_ml)
  const dma_vol_ul  = dma_vol_ml * 1000
  const dma_pct_actual = safeDivide(dma_vol_ml, final_rxn_vol_ml) * 100

  const buffer2_ul  = 0
  const total_conjugation_ul = tff_vol_ml * 1000 + lp_vol_ul + dma_vol_ul

  return {
    mab_vol_ul, mab_conc_uM,
    tcep_vol_ul, tcep_conc_uM,
    edta_vol_ul, buffer1_ul, total_reduction_ul, tff_vol_ml,
    lp_vol_ul, lp_conc_uM,
    dma_vol_ul, dma_pct_actual, buffer2_ul, total_conjugation_ul,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function n(val: number | undefined | null, dec = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '—'
  return val.toFixed(dec)
}

// ─── Styled primitives ─────────────────────────────────────────────────────────

const SH = ({ label }: { label: string }) => (
  <div
    style={{ background: '#1e3a5f', color: '#fff' }}
    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm mb-0"
  >
    {label}
  </div>
)

// Excel-like header cell
const TH = ({ children, w }: { children: React.ReactNode; w?: string }) => (
  <th
    style={{ background: '#c6efce', color: '#276221', border: '1px solid #b0c4b1', whiteSpace: 'nowrap' }}
    className={`px-2.5 py-1.5 text-xs font-semibold text-left ${w ?? ''}`}
  >
    {children}
  </th>
)

// Editable input cell
const TI = ({ children }: { children: React.ReactNode }) => (
  <td style={{ background: '#fff2cc', border: '1px solid #d4c57a' }} className="px-1.5 py-1">
    {children}
  </td>
)

// Calculated result cell
const TC = ({ val, dec = 2, unit, bold, warn }: { val: number; dec?: number; unit?: string; bold?: boolean; warn?: boolean }) => {
  const display = n(val, dec)
  return (
    <td
      style={{
        background: bold ? '#d9ead3' : '#f3f3f3',
        border: '1px solid #c0c0c0',
        color: warn ? '#cc0000' : bold ? '#274e13' : '#333',
        fontFamily: 'monospace',
        fontWeight: bold ? 700 : 400,
      }}
      className="px-2.5 py-1 text-xs text-right"
    >
      {display}{display !== '—' && unit ? <span className="opacity-60 ml-0.5 font-normal">{unit}</span> : null}
    </td>
  )
}

// Plain info cell (no edit, no calc color)
const TP = ({ children }: { children: React.ReactNode }) => (
  <td style={{ background: '#f3f3f3', border: '1px solid #c0c0c0' }} className="px-2.5 py-1 text-xs text-center text-slate-400">
    {children}
  </td>
)

// Label cell (left column in param table)
const TL = ({ children }: { children: React.ReactNode }) => (
  <td style={{ background: '#dce6f1', border: '1px solid #b8cce4', fontWeight: 500 }} className="px-2.5 py-1.5 text-xs text-slate-700 whitespace-nowrap">
    {children}
  </td>
)

function NumInput({
  value, onChange, disabled, step = 0.1, min = 0, precision = 4,
}: {
  value: number; onChange: (v: number) => void; disabled?: boolean; step?: number; min?: number; precision?: number
}) {
  return (
    <InputNumber
      size="small"
      value={value}
      min={min}
      step={step}
      disabled={disabled}
      precision={precision}
      onChange={(v) => { if (v !== null) onChange(v as number) }}
      className="w-full"
      controls={false}
      style={{ fontFamily: 'monospace', fontSize: 12 }}
    />
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReactantCalculatorField({ value, onChange, disabled }: ReactantCalculatorProps) {
  const savedValue = value as CalcValue | undefined
  const [inputs, setInputs] = useState<CalcInputs>(() => ({
    ...DEFAULT_INPUTS,
    ...(savedValue?.inputs ?? {}),
  }))

  const results = useMemo(() => calculate(inputs), [inputs])

  function upd<K extends keyof CalcInputs>(key: K, val: number) {
    const next = { ...inputs, [key]: val }
    setInputs(next)
    onChange({ inputs: next, results: calculate(next) } as CalcValue)
  }

  const I = (key: keyof CalcInputs, step = 0.1, prec = 4) => (
    <NumInput value={inputs[key]} onChange={(v) => upd(key, v)} disabled={disabled} step={step} precision={prec} />
  )

  const dmaOver = results.dma_pct_actual > inputs.dma_pct_limit && results.dma_pct_actual > 0

  return (
    <div className="space-y-4 text-xs" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>

      {/* ── REACTION PARAMETERS ─────────────────────────────────────────────── */}
      <div>
        <SH label="Reaction Parameters" />
        <div style={{ border: '1px solid #c0c0c0', borderTop: 'none' }}>
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <TL>Scale (mAb, mg)</TL>
                <TI>{I('scale_mg', 1, 2)}</TI>
                <TL>mAb Stock Conc (mg/mL)</TL>
                <TI>{I('mab_stock_conc', 0.5, 2)}</TI>
              </tr>
              <tr>
                <TL>mAb Conc in Reaction (mg/mL)</TL>
                <TI>{I('mab_rxn_conc', 0.5, 2)}</TI>
                <TL>Final Total Volume (mL)</TL>
                <TI>{I('final_total_vol_ml', 0.1, 2)}</TI>
              </tr>
              <tr>
                <TL>DAR Target</TL>
                <TI>{I('dar', 1, 0)}</TI>
                <TL>mAb MW (Da)</TL>
                <TI>{I('mab_mw', 1000, 0)}</TI>
              </tr>
              <tr>
                <TL>Initial Rxn Vol – Reduction (mL)</TL>
                <TI>{I('initial_rxn_vol_ml', 0.05, 3)}</TI>
                <TL>Final Rxn Vol – Conjugation (mL)</TL>
                <TI>{I('final_rxn_vol_ml', 0.05, 3)}</TI>
              </tr>
              <tr>
                <TL>LP MW (Da)</TL>
                <TI>{I('lp_mw', 10, 0)}</TI>
                <TL>DMA / DMSO limit (%)</TL>
                <TI>{I('dma_pct_limit', 1, 1)}</TI>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REDUCTION STEP ──────────────────────────────────────────────────── */}
      <div>
        <SH label="Reduction Step" />
        <div className="overflow-x-auto" style={{ border: '1px solid #c0c0c0', borderTop: 'none' }}>
          <table className="border-collapse" style={{ minWidth: 820, width: '100%' }}>
            <thead>
              <tr>
                <TH w="w-44">Chemical</TH>
                <TH>MW (Da)</TH>
                <TH>Equivalents</TH>
                <TH>Stock Conc</TH>
                <TH>Vol (mL)</TH>
                <TH>Vol (µL)</TH>
                <TH>Final Conc (µM)</TH>
              </tr>
            </thead>
            <tbody>
              {/* mAb */}
              <tr>
                <TL>mAb</TL>
                <TI>{I('mab_mw', 1000, 0)}</TI>
                <TP>1.00</TP>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('mab_stock_conc', 0.5, 2)}
                    <span className="text-slate-400 shrink-0">mg/mL</span>
                  </div>
                </TI>
                <TC val={results.mab_vol_ul / 1000} dec={4} />
                <TC val={results.mab_vol_ul} dec={2} />
                <TC val={results.mab_conc_uM} dec={4} />
              </tr>

              {/* TCEP */}
              <tr>
                <TL>TCEP</TL>
                <TP>286.00</TP>
                <TI>{I('tcep_eq', 1, 1)}</TI>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('tcep_stock_mM', 1, 1)}
                    <span className="text-slate-400 shrink-0">mM</span>
                  </div>
                </TI>
                <TC val={results.tcep_vol_ul / 1000} dec={4} />
                <TC val={results.tcep_vol_ul} dec={2} />
                <TC val={results.tcep_conc_uM} dec={4} />
              </tr>

              {/* EDTA */}
              <tr>
                <TL>100 mM EDTA in Buffer</TL>
                <TP>230.00</TP>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('edta_final_conc_mM', 1, 1)}
                    <span className="text-slate-400 shrink-0">mM final</span>
                  </div>
                </TI>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('edta_stock_mM', 10, 0)}
                    <span className="text-slate-400 shrink-0">mM</span>
                  </div>
                </TI>
                <TC val={results.edta_vol_ul / 1000} dec={4} />
                <TC val={results.edta_vol_ul} dec={2} />
                <TP>—</TP>
              </tr>

              {/* Buffer Make-up 1 */}
              <tr>
                <TL>Buffer Make-up 1</TL>
                <TP>—</TP><TP>—</TP><TP>—</TP>
                <TC val={results.buffer1_ul / 1000} dec={4} />
                <TC val={results.buffer1_ul} dec={2} />
                <TP>—</TP>
              </tr>

              {/* TOTAL */}
              <tr style={{ background: '#e2efda' }}>
                <td colSpan={4} style={{ border: '1px solid #b0c4b1', background: '#c6efce', fontWeight: 700, color: '#276221' }} className="px-2.5 py-1.5 text-xs uppercase tracking-wide">
                  TOTAL
                </td>
                <TC val={results.total_reduction_ul / 1000} dec={4} bold />
                <TC val={results.total_reduction_ul} dec={2} bold />
                <TP />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONJUGATION STEP ────────────────────────────────────────────────── */}
      <div>
        <SH label="Conjugation Step" />
        <div className="overflow-x-auto" style={{ border: '1px solid #c0c0c0', borderTop: 'none' }}>
          <table className="border-collapse" style={{ minWidth: 820, width: '100%' }}>
            <thead>
              <tr>
                <TH w="w-44">Chemical</TH>
                <TH>MW (Da)</TH>
                <TH>Equivalents</TH>
                <TH>Stock Conc</TH>
                <TH>Vol (mL)</TH>
                <TH>Vol (µL)</TH>
                <TH>Final Conc (µM)</TH>
              </tr>
            </thead>
            <tbody>
              {/* Reduced mAb (TFF) */}
              <tr>
                <TL>Reduced mAb Mix (TFF)</TL>
                <TP>—</TP>
                <TP>1.00</TP>
                <TP>—</TP>
                <TC val={results.tff_vol_ml} dec={3} />
                <TC val={results.tff_vol_ml * 1000} dec={2} />
                <TP>—</TP>
              </tr>

              {/* LP */}
              <tr>
                <TL>LP (Linker-Payload)</TL>
                <TI>{I('lp_mw', 10, 0)}</TI>
                <TI>{I('lp_eq', 1, 1)}</TI>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('lp_stock_mM', 1, 1)}
                    <span className="text-slate-400 shrink-0">mM</span>
                  </div>
                </TI>
                <TC val={results.lp_vol_ul / 1000} dec={4} />
                <TC val={results.lp_vol_ul} dec={2} />
                <TC val={results.lp_conc_uM} dec={4} />
              </tr>

              {/* DMA / DMSO */}
              <tr>
                <TL>
                  <span>DMA / DMSO</span>
                  {dmaOver && (
                    <span className="ml-2 text-red-600 font-semibold">
                      ⚠ {n(results.dma_pct_actual, 1)}% &gt; limit
                    </span>
                  )}
                </TL>
                <TP>—</TP>
                <TI>
                  <div className="flex items-center gap-1">
                    {I('dma_pct_limit', 1, 1)}
                    <span className="text-slate-400 shrink-0">% max</span>
                  </div>
                </TI>
                <TP>neat</TP>
                <TC val={results.dma_vol_ul / 1000} dec={4} warn={dmaOver} />
                <TC val={results.dma_vol_ul} dec={2} warn={dmaOver} />
                <TP>{n(results.dma_pct_actual, 1)} %</TP>
              </tr>

              {/* Buffer Make-up 2 */}
              <tr>
                <TL>Buffer Make-up 2</TL>
                <TP>—</TP><TP>—</TP><TP>—</TP>
                <TC val={results.buffer2_ul / 1000} dec={4} />
                <TC val={results.buffer2_ul} dec={2} />
                <TP>—</TP>
              </tr>

              {/* TOTAL */}
              <tr style={{ background: '#e2efda' }}>
                <td colSpan={4} style={{ border: '1px solid #b0c4b1', background: '#c6efce', fontWeight: 700, color: '#276221' }} className="px-2.5 py-1.5 text-xs uppercase tracking-wide">
                  TOTAL
                </td>
                <TC val={results.total_conjugation_ul / 1000} dec={4} bold />
                <TC val={results.total_conjugation_ul} dec={2} bold />
                <TP />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── OUTPUTS → 3.4 & 3.5 ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div style={{ border: '2px solid #4472c4', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#4472c4', color: '#fff' }} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
            → 3.4 Reduction Step — Carry-Over Values
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {[
                { label: 'mAb Volume',       val: results.mab_vol_ul,  unit: 'µL' },
                { label: 'TCEP Volume',      val: results.tcep_vol_ul, unit: 'µL' },
                { label: 'EDTA Volume',      val: results.edta_vol_ul, unit: 'µL' },
                { label: 'Buffer Make-up 1', val: results.buffer1_ul,  unit: 'µL' },
                { label: 'Vol after TFF',    val: results.tff_vol_ml,  unit: 'mL', bold: true },
              ].map(r => (
                <tr key={r.label}>
                  <TL>{r.label}</TL>
                  <TC val={r.val} dec={2} unit={r.unit} bold={r.bold} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ border: '2px solid #4472c4', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: '#4472c4', color: '#fff' }} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide">
            → 3.5 Conjugation Step — Carry-Over Values
          </div>
          <table className="w-full border-collapse">
            <tbody>
              {[
                { label: 'Vol after TFF (mAb)',  val: results.tff_vol_ml,         unit: 'mL' },
                { label: 'LP Volume',             val: results.lp_vol_ul,           unit: 'µL' },
                { label: 'DMA / DMSO Volume',     val: results.dma_vol_ul,          unit: 'µL', warn: dmaOver },
                { label: 'Buffer Make-up 2',      val: results.buffer2_ul,          unit: 'µL' },
                { label: 'Total Conjugation Vol', val: results.total_conjugation_ul, unit: 'µL', bold: true },
              ].map(r => (
                <tr key={r.label}>
                  <TL>{r.label}</TL>
                  <TC val={r.val} dec={2} unit={r.unit} bold={r.bold} warn={r.warn} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
