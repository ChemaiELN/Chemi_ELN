/** Pali deruxt ADC Making RD Calculations — ported from Making_ADCs_2 step sheet. */

export const CALC_SOURCE = 'Pali deruxt ADC Making_RD_Calculations_07-05-2026.xlsx';

export const DEFAULT_INPUTS = {
  scale: 10,
  mabStock: 5,
  finalVol: 2.5,
  dar: 8,
  lpMW: 1038,
  tcepEq: 6,
  lpEq: 12,
  organic: 10,
};

const MAB_MW = 150000;
const TCEP_STOCK_MM = 5;
const LP_STOCK_MM = 5;
const EDTA_STOCK_MM = 100;
const EDTA_FINAL_MM = 5;

export function computePaliDeruxtAdcCalculations(raw = {}) {
  const scale = num(raw.scale, DEFAULT_INPUTS.scale);
  const mabStock = num(raw.mabStock, DEFAULT_INPUTS.mabStock);
  const finalVol = num(raw.finalVol, DEFAULT_INPUTS.finalVol);
  const dar = num(raw.dar, DEFAULT_INPUTS.dar);
  const lpMW = num(raw.lpMW, DEFAULT_INPUTS.lpMW);
  const tcepEq = num(raw.tcepEq, DEFAULT_INPUTS.tcepEq);
  const lpEq = num(raw.lpEq, DEFAULT_INPUTS.lpEq);
  const organicPct = num(raw.organic, DEFAULT_INPUTS.organic);
  const organicFraction = organicPct / 100;

  const mabRxnConc = scale / finalVol;
  const mabMmFinal = (scale / (MAB_MW * finalVol)) * 1000;
  const mabUmFinal = mabMmFinal * 1000;

  const lpMmFinal = mabMmFinal * lpEq;
  const lpVol = (lpMmFinal * finalVol) / LP_STOCK_MM;
  const dmaVol = organicFraction * finalVol - lpVol;
  const initialVol = finalVol - lpVol - dmaVol;

  const mabMmInitial = (scale / (MAB_MW * initialVol)) * 1000;
  const mabUmInitial = mabMmInitial * 1000;
  const mabVol = scale / mabStock;

  const tcepMmFinal = mabMmInitial * tcepEq;
  const tcepUmFinal = mabUmInitial * tcepEq;
  const tcepVol = (tcepMmFinal * initialVol) / TCEP_STOCK_MM;

  const edtaMmFinal = EDTA_FINAL_MM;
  const edtaUmFinal = edtaMmFinal * 1000;
  const edtaVol = (edtaMmFinal * initialVol) / EDTA_STOCK_MM;

  const reductionTotal = mabVol + tcepVol + edtaVol;
  const buffer1 = initialVol - reductionTotal;
  const tffVol = initialVol;

  const lpUmFinal = lpMmFinal * 1000;
  const conjugationTotal = tffVol + lpVol + dmaVol;
  const buffer2 = finalVol - conjugationTotal;

  return {
    inputs: { scale, mabStock, finalVol, dar, lpMW, tcepEq, lpEq, organic: organicPct },
    mabRxnConc,
    initialVol,
    finalVol,
    reduction: {
      mab: row('mAb', MAB_MW, 1, scale, mabStock, mabVol, mabMmInitial, mabUmInitial, 'mg/mL'),
      tcep: row('TCEP', 286, tcepEq, null, TCEP_STOCK_MM, tcepVol, tcepMmFinal, tcepUmFinal, 'mM'),
      edta: row('100 mM EDTA in Buffer', 230, null, null, EDTA_STOCK_MM, edtaVol, edtaMmFinal, edtaUmFinal, 'mM'),
      buffer: { label: 'Buffer makeup 1 (FLEXIBILITY)', vol: buffer1 },
      total: reductionTotal,
      tffVol,
    },
    conjugation: {
      reducedMab: row('Reduced mAb mix (post-TFF)', MAB_MW, 1, scale, mabRxnConc, tffVol, mabMmFinal, mabUmFinal, 'mg/mL'),
      lp: row('LP', lpMW, lpEq, null, LP_STOCK_MM, lpVol, lpMmFinal, lpUmFinal, 'mM'),
      dma: { label: `DMA (${organicPct}%)`, vol: dmaVol, eq: `${organicPct}%` },
      buffer: { label: 'Buffer makeup 2 (FLEXIBILITY)', vol: buffer2 },
      total: conjugationTotal,
    },
    stockPrep: {
      tcepSecondaryUl: ul(tcepVol),
      lpSecondaryUl: ul(lpVol),
      edtaSecondaryUl: ul(edtaVol),
    },
    summary: {
      mabUmInitial,
      tcepUmFinal,
      lpUmFinal,
      organicPct,
      dar,
    },
  };
}

function num(value, fallback) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function row(label, mw, eq, weightMg, stock, volMl, mm, um, stockUnit) {
  return { label, mw, eq, weightMg, stock, stockUnit, volMl, mm, um };
}

export function ul(volMl) {
  if (!Number.isFinite(volMl)) return null;
  return volMl * 1000;
}

export function formatUl(volMl) {
  const value = ul(volMl);
  if (value == null) return '—';
  return `${value.toFixed(1)} µL`;
}

export function formatMm(mm) {
  if (!Number.isFinite(mm)) return '—';
  return `${mm.toFixed(4)} mM`;
}

export function formatUm(um) {
  if (!Number.isFinite(um)) return '—';
  return `${um.toFixed(1)} µM`;
}

export function formatMl(volMl) {
  if (!Number.isFinite(volMl)) return '—';
  return `${(volMl * 1000).toFixed(0)} µL`;
}
