import { useState, useMemo } from 'react'
import { InputNumber } from 'antd'

// ─── Interfaces ────────────────────────────────────────────────────────────────
//
// Mirrors "Making ADCs_2 step" sheet in Pali deruxt ADC Making_RD_Calculations.
// Only cells the sheet actually treats as user inputs are editable here; every
// other cell (C10, B13, B14, and all of columns D–I in the two chemical tables)
// is a formula and is always derived, never typed in directly.

export interface CalcInputs {
  scale_mg: number              // B8
  mab_stock_conc: number        // C9
  final_total_vol_ml: number    // B11
  dar: number                   // B12 — informational only, not used by any formula
  mab_mw: number                // B17 (= B25, reduced mAb MW)
  tcep_eq: number                // C18
  tcep_stock_mM: number          // E18
  edta_final_conc_mM: number     // H19
  edta_stock_mM: number          // E19
  lp_mw: number                  // B26 — informational only, not used by any formula
  lp_eq: number                  // C26
  lp_stock_mM: number            // E26
  dma_pct_limit: number          // C27 × 100 (sheet stores the fraction, e.g. 0.1 = 10%)
  buffer2_manual_ul: number      // F29/G29 "Buffer makeup 2" — no formula in the sheet, manual entry
}

export interface CalcResults {
  mab_rxn_conc: number           // C10
  initial_rxn_vol_ml: number     // B13
  final_rxn_vol_ml: number       // B14

  mab_vol_ml: number             // F17
  mab_vol_ul: number             // G17
  mab_conc_mM: number            // H17
  mab_conc_uM: number            // I17

  tcep_vol_ml: number            // F18
  tcep_vol_ul: number            // G18
  tcep_conc_mM: number           // H18
  tcep_conc_uM: number           // I18

  edta_vol_ml: number            // F19
  edta_vol_ul: number            // G19

  total_reduction_ml: number     // F20
  total_reduction_ul: number     // G20
  buffer1_ml: number             // F21
  buffer1_ul: number             // G21
  tff_vol_ml: number             // F22

  lp_vol_ml: number              // F26
  lp_vol_ul: number              // G26
  lp_conc_mM: number             // H26
  lp_conc_uM: number             // I26

  dma_vol_ml: number             // F27
  dma_vol_ul: number             // G27
  dma_pct_actual: number         // actual DMA % of final volume

  total_conjugation_ml: number   // F28 (mAb + LP + DMA, excludes buffer makeup 2)
  total_conjugation_ul: number
  buffer2_ul: number             // G29
  final_conjugation_vol_ml: number // F30
}

interface CalcValue extends CalcResults {
  inputs: Partial<CalcInputs>
}

export interface ReactantCalculatorProps {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  contextData?: Record<string, unknown>
}

// ─── Placeholder hints ──────────────────────────────────────────────────────────
// Shown as greyed-out placeholder text (typical values from the Excel example) —
// never used to pre-fill an actual value. Every input starts genuinely blank so
// the user enters their own batch's numbers.

export const PLACEHOLDER_HINTS: Record<keyof CalcInputs, string> = {
  scale_mg: '10',
  mab_stock_conc: '5',
  final_total_vol_ml: '2.5',
  dar: '8',
  mab_mw: '150000',
  tcep_eq: '6',
  tcep_stock_mM: '5',
  edta_final_conc_mM: '5',
  edta_stock_mM: '100',
  lp_mw: '1038',
  lp_eq: '12',
  lp_stock_mM: '5',
  dma_pct_limit: '10',
  buffer2_manual_ul: '0',
}

// Only genuinely optional/cosmetic fields (not used by any formula) default to a
// concrete value; everything the calculation depends on starts blank.
const INITIAL_INPUTS: Partial<CalcInputs> = {
  buffer2_manual_ul: 0,
}

const REQUIRED_KEYS: (keyof CalcInputs)[] = [
  'scale_mg', 'mab_stock_conc', 'final_total_vol_ml', 'mab_mw',
  'tcep_eq', 'tcep_stock_mM', 'edta_final_conc_mM', 'edta_stock_mM',
  'lp_eq', 'lp_stock_mM', 'dma_pct_limit',
]

// ─── Calculation Engine (mirrors the Excel formulas cell-for-cell) ─────────────

function num(v: number | undefined | null): number {
  return typeof v === 'number' && !isNaN(v) ? v : NaN
}

// Propagates NaN (incomplete input) through the formula chain instead of
// silently collapsing it to 0, so unfilled cells render as "—" rather than 0.
function safeDivide(a: number, b: number): number {
  if (isNaN(a) || isNaN(b)) return NaN
  if (!b || !isFinite(b)) return 0
  const r = a / b
  return isFinite(r) ? r : 0
}

function calculate(inputs: Partial<CalcInputs>): CalcResults {
  const B8  = num(inputs.scale_mg)
  const C9  = num(inputs.mab_stock_conc)
  const B11 = num(inputs.final_total_vol_ml)
  const B17 = num(inputs.mab_mw)
  const C18 = num(inputs.tcep_eq)
  const E18 = num(inputs.tcep_stock_mM)
  const H19 = num(inputs.edta_final_conc_mM)
  const E19 = num(inputs.edta_stock_mM)
  const C26 = num(inputs.lp_eq)
  const E26 = num(inputs.lp_stock_mM)
  const dma_pct_limit = num(inputs.dma_pct_limit)
  const buffer2_manual_ul = num(inputs.buffer2_manual_ul)

  const B14 = B11                                    // Final reaction vol (conjugation) = Final total vol
  const C10 = safeDivide(B8, B11)                    // mAb conc in reaction (mg/mL)

  // Conjugation quantities that only depend on the final volume (not yet on B13)
  // must be computed first — Excel's own dependency order is: LP/DMA vols → B13 →
  // reduction table → F22 → F25 (reduction table depends on B13, not the reverse).
  const B25 = B17                                     // Reduced mAb MW = mAb MW
  const H25 = safeDivide(B8, B25 * B14) * 1000        // mAb conc in final conj vol (mM)
  const H26 = H25 * C26                               // LP conc (mM)
  const F26 = safeDivide(H26 * B11, E26)              // LP vol (mL)

  const C27 = dma_pct_limit / 100                     // DMA organic fraction (e.g. 0.10)
  const F27 = C27 * B11 - F26                         // DMA vol (mL) — sheet has no floor at 0

  const B13 = B11 - (F26 + F27)                       // Initial reaction vol (reduction)

  // Reduction table (rows 17–22) — all depend on B13
  const F17 = safeDivide(B8, C9)                      // mAb vol (mL)
  const H17 = safeDivide(B8, B17 * B13) * 1000        // mAb conc (mM)
  const H18 = H17 * C18                               // TCEP conc (mM)
  const F18 = safeDivide(H18 * B13, E18)              // TCEP vol (mL)
  const F19 = safeDivide(H19 * B13, E19)              // EDTA vol (mL)

  const F20 = F17 + F18 + F19                         // Total reduction vol (mL)
  const F21 = B13 - F20                               // Buffer makeup 1 (mL)
  const F22 = B13                                     // Vol after TFF = initial reduction vol

  // Conjugation table (rows 25–30)
  const F25 = F22                                     // Reduced mAb mix vol = vol after TFF
  const F28 = F25 + F26 + F27                         // Total conjugation vol (mAb + LP + DMA)
  const F30 = B14                                     // Final vol after conjugation

  return {
    mab_rxn_conc: C10,
    initial_rxn_vol_ml: B13,
    final_rxn_vol_ml: B14,

    mab_vol_ml: F17, mab_vol_ul: F17 * 1000,
    mab_conc_mM: H17, mab_conc_uM: H17 * 1000,

    tcep_vol_ml: F18, tcep_vol_ul: F18 * 1000,
    tcep_conc_mM: H18, tcep_conc_uM: H18 * 1000,

    edta_vol_ml: F19, edta_vol_ul: F19 * 1000,

    total_reduction_ml: F20, total_reduction_ul: F20 * 1000,
    buffer1_ml: F21, buffer1_ul: F21 * 1000,
    tff_vol_ml: F22,

    lp_vol_ml: F26, lp_vol_ul: F26 * 1000,
    lp_conc_mM: H26, lp_conc_uM: H26 * 1000,

    dma_vol_ml: F27, dma_vol_ul: F27 * 1000,
    dma_pct_actual: safeDivide(F27, B11) * 100,

    total_conjugation_ml: F28, total_conjugation_ul: F28 * 1000,
    buffer2_ul: buffer2_manual_ul,
    final_conjugation_vol_ml: F30,
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

// Calculated result cell (read-only, formula-driven)
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
const TP = ({ children }: { children?: React.ReactNode }) => (
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
  value, onChange, disabled, step = 0.1, min = 0, precision = 4, placeholder,
}: {
  value: number | undefined; onChange: (v: number | undefined) => void; disabled?: boolean
  step?: number; min?: number; precision?: number; placeholder?: string
}) {
  return (
    <InputNumber
      size="small"
      value={value ?? null}
      min={min}
      step={step}
      disabled={disabled}
      precision={precision}
      placeholder={placeholder}
      onChange={(v) => onChange(v === null ? undefined : (v as number))}
      className="w-full"
      controls={false}
      style={{ fontFamily: 'monospace', fontSize: 12 }}
    />
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ReactantCalculatorField({ value, onChange, disabled }: ReactantCalculatorProps) {
  const savedValue = value as CalcValue | undefined
  const [inputs, setInputs] = useState<Partial<CalcInputs>>(() => ({
    ...INITIAL_INPUTS,
    ...(savedValue?.inputs ?? {}),
  }))

  const results = useMemo(() => calculate(inputs), [inputs])
  const isReady = REQUIRED_KEYS.every(k => typeof inputs[k] === 'number' && !isNaN(inputs[k] as number))

  function upd<K extends keyof CalcInputs>(key: K, val: number | undefined) {
    const next = { ...inputs, [key]: val }
    setInputs(next)
    // Flatten results onto the saved value (not nested under a "results" key) so
    // downstream screens (3.4/3.5) can read e.g. `mab_vol_ul` directly off the
    // stored 3.3 field value.
    onChange({ inputs: next, ...calculate(next) } as CalcValue)
  }

  const I = (key: keyof CalcInputs, step = 0.1, prec = 4) => (
    <NumInput
      value={inputs[key]}
      onChange={(v) => upd(key, v)}
      disabled={disabled}
      step={step}
      precision={prec}
      placeholder={PLACEHOLDER_HINTS[key]}
    />
  )

  const dmaOver = results.dma_pct_actual > (inputs.dma_pct_limit ?? Infinity) && results.dma_pct_actual > 0
  const dmaNegative = results.dma_vol_ml < 0
  const buffer1Negative = results.buffer1_ml < 0

  return (
    <div className="space-y-4 text-xs" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>

      {!isReady && (
        <div
          style={{ background: '#fff8e6', border: '1px solid #f0d78c', color: '#8a6d1f' }}
          className="rounded-md px-3 py-2"
        >
          Enter the reaction parameters below (Scale, mAb Stock Conc, Final Total Volume, MW/equivalents/stock
          concentrations, DMA limit) to generate the calculation table. Fields you haven't filled in yet show as "—".
        </div>
      )}

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
                <TC val={results.mab_rxn_conc} dec={3} />
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
                <TC val={results.initial_rxn_vol_ml} dec={3} warn={buffer1Negative} />
                <TL>Final Rxn Vol – Conjugation (mL)</TL>
                <TC val={results.final_rxn_vol_ml} dec={3} />
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
                <TC val={results.mab_vol_ml} dec={4} />
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
                <TC val={results.tcep_vol_ml} dec={4} />
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
                <TC val={results.edta_vol_ml} dec={4} />
                <TC val={results.edta_vol_ul} dec={2} />
                <TP>—</TP>
              </tr>

              {/* Buffer Make-up 1 */}
              <tr>
                <TL>
                  Buffer Make-up 1
                  {buffer1Negative && <span className="ml-2 text-red-600 font-semibold">⚠ over budget</span>}
                </TL>
                <TP>—</TP><TP>—</TP><TP>—</TP>
                <TC val={results.buffer1_ml} dec={4} warn={buffer1Negative} />
                <TC val={results.buffer1_ul} dec={2} warn={buffer1Negative} />
                <TP>—</TP>
              </tr>

              {/* TOTAL */}
              <tr style={{ background: '#e2efda' }}>
                <td colSpan={4} style={{ border: '1px solid #b0c4b1', background: '#c6efce', fontWeight: 700, color: '#276221' }} className="px-2.5 py-1.5 text-xs uppercase tracking-wide">
                  TOTAL
                </td>
                <TC val={results.total_reduction_ml} dec={4} bold />
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
                <TC val={results.lp_vol_ml} dec={4} />
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
                <TC val={results.dma_vol_ml} dec={4} warn={dmaOver || dmaNegative} />
                <TC val={results.dma_vol_ul} dec={2} warn={dmaOver || dmaNegative} />
                <TP>{n(results.dma_pct_actual, 1)} %</TP>
              </tr>

              {/* Buffer Make-up 2 — no formula in the sheet, manual entry only */}
              <tr>
                <TL>Buffer Make-up 2 (manual)</TL>
                <TP>—</TP><TP>—</TP><TP>—</TP>
                <TC val={(inputs.buffer2_manual_ul ?? 0) / 1000} dec={4} />
                <TI>{I('buffer2_manual_ul', 1, 1)}</TI>
                <TP>—</TP>
              </tr>

              {/* TOTAL */}
              <tr style={{ background: '#e2efda' }}>
                <td colSpan={4} style={{ border: '1px solid #b0c4b1', background: '#c6efce', fontWeight: 700, color: '#276221' }} className="px-2.5 py-1.5 text-xs uppercase tracking-wide">
                  TOTAL
                </td>
                <TC val={results.total_conjugation_ml} dec={4} bold />
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
                { label: 'Vol after TFF (mAb)',  val: results.tff_vol_ml,           unit: 'mL' },
                { label: 'LP Volume',             val: results.lp_vol_ul,            unit: 'µL' },
                { label: 'DMA / DMSO Volume',     val: results.dma_vol_ul,           unit: 'µL', warn: dmaOver || dmaNegative },
                { label: 'Buffer Make-up 2',      val: results.buffer2_ul,           unit: 'µL' },
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
