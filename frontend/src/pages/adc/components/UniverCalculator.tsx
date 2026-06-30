// CSS must be a static import so it loads before Univer initialises
import '@univerjs/preset-sheets-core/lib/index.css'
import { useEffect, useRef } from 'react'
import type { IWorkbookData } from '@univerjs/presets'

export interface UniverCalcProps {
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  contextData?: Record<string, unknown>
}

// ── Style IDs ──────────────────────────────────────────────────────────────────
const S = {
  TITLE:       '1',
  SEC_HDR:     '2',
  COL_HDR:     '3',
  PARAM_LABEL: '4',
  PARAM_INPUT: '5',
  PARAM_CALC:  '6',
  ROW_LABEL:   '7',
  INPUT:       '8',
  CALC:        '9',
  TOTAL:       '10',
  WARN:        '11',
}

function thin(color = '#C0C0C0') {
  const b = { s: 1, cl: { rgb: color } }
  return { t: b, b, l: b, r: b }
}

// ── Build IWorkbookData matching the Excel structure ───────────────────────────
//
// Rows (0-indexed / A1-notation):
//   0  / 1  : Title
//   2–9 / 3–10 : Parameter section (2-column layout via A-B left, D-E right)
//   11 / 12 : "REDUCTION STEP" section header
//   12 / 13 : Reduction column headers
//   13 / 14 : mAb row
//   14 / 15 : TCEP row
//   15 / 16 : EDTA row
//   16 / 17 : Subtotal
//   17 / 18 : Buffer Makeup 1
//   18 / 19 : Vol after TFF
//   20 / 21 : "CONJUGATION STEP" section header
//   21 / 22 : Conjugation column headers
//   22 / 23 : Reduced mAb (TFF) row
//   23 / 24 : LP row
//   24 / 25 : DMA row
//   25 / 26 : Subtotal
//   26 / 27 : Buffer Makeup 2
//   27 / 28 : TOTAL row

function buildWorkbookData(savedInputs?: Record<string, number>): IWorkbookData {
  const i = {
    scale_mg:     10,
    mab_stock:     5,
    final_vol:     2.5,
    dar:           8,
    mab_mw:        150000,
    red_vol:       2.25,
    tcep_eq:       6,
    tcep_stock:    5,
    edta_target:   5,
    edta_stock:    100,
    lp_mw:         1038,
    lp_eq:         12,
    lp_stock:      5,
    dma_pct:       10,
    ...savedInputs,
  }

  type Cell = { v?: string | number | null; f?: string; s?: string; t?: number }
  const cd: Record<number, Record<number, Cell>> = {}
  const c = (row: number, col: number, cell: Cell) => {
    if (!cd[row]) cd[row] = {}
    cd[row][col] = cell
  }

  // ── Row 0: Title ─────────────────────────────────────────────────────────
  c(0, 0, { v: 'ADC REACTANT CALCULATION WORKSHEET', s: S.TITLE })

  // ── Rows 2–9: Parameters ─────────────────────────────────────────────────
  // Layout: A=label | B=value | C=spacer | D=label | E=value
  // A1 notation: row 2 → row 3, row 3 → row 4, etc.
  const params: [number, string, Cell, string, Cell][] = [
    [2, 'Scale (mAb, mg)',            { v: i.scale_mg,    s: S.PARAM_INPUT },
        'mAb Stock Conc (mg/mL)',     { v: i.mab_stock,   s: S.PARAM_INPUT }],
    [3, 'mAb Conc in Rxn (mg/mL)',   { f: '=B3/B6',      s: S.PARAM_CALC  },
        'Final Total Volume (mL)',    { v: i.final_vol,   s: S.PARAM_INPUT }],
    [4, 'DAR Target',                 { v: i.dar,         s: S.PARAM_INPUT },
        'mAb MW (Da)',                { v: i.mab_mw,      s: S.PARAM_INPUT }],
    [5, 'Reduction Vol (mL)',         { v: i.red_vol,     s: S.PARAM_INPUT },
        'Conjugation Vol (mL)',       { f: '=E4',         s: S.PARAM_CALC  }],
    [6, 'TCEP Equivalents',           { v: i.tcep_eq,     s: S.PARAM_INPUT },
        'TCEP Stock (mM)',            { v: i.tcep_stock,  s: S.PARAM_INPUT }],
    [7, 'EDTA Target Final (mM)',     { v: i.edta_target, s: S.PARAM_INPUT },
        'EDTA Stock (mM)',            { v: i.edta_stock,  s: S.PARAM_INPUT }],
    [8, 'LP MW (Da)',                 { v: i.lp_mw,       s: S.PARAM_INPUT },
        'LP Equivalents',             { v: i.lp_eq,       s: S.PARAM_INPUT }],
    [9, 'LP Stock (mM)',              { v: i.lp_stock,    s: S.PARAM_INPUT },
        'DMA / DMSO Limit (%)',       { v: i.dma_pct,     s: S.PARAM_INPUT }],
  ]
  for (const [row, lA, vA, lD, vE] of params) {
    c(row, 0, { v: lA, s: S.PARAM_LABEL })
    c(row, 1, vA)
    c(row, 3, { v: lD, s: S.PARAM_LABEL })
    c(row, 4, vE)
  }

  // ── Row 11: Reduction section header ─────────────────────────────────────
  c(11, 0, { v: 'REDUCTION STEP', s: S.SEC_HDR })
  for (let col = 1; col <= 7; col++) c(11, col, { v: '', s: S.SEC_HDR })

  // ── Row 12: Column headers ────────────────────────────────────────────────
  const tblHdrs = ['Chemical', 'MW (Da)', 'Equivalents', 'Stock Conc', 'Vol (mL)', 'Vol (µL)', 'Conc (mM)', 'Conc (µM)']
  tblHdrs.forEach((h, col) => c(12, col, { v: h, s: S.COL_HDR }))

  // ── Row 13 (A14): mAb ────────────────────────────────────────────────────
  // E14 = B3 / D14  (Vol mL = Scale / Stock)
  // G14 = B3 / (B14 * B6) * 1000  (Conc mM = Scale / (MW * RedVol) * 1000)
  c(13, 0, { v: 'mAb',                    s: S.ROW_LABEL })
  c(13, 1, { f: '=E5',                    s: S.CALC })  // MW = mAb MW param
  c(13, 2, { v: 1,                         s: S.CALC })  // Equiv = 1
  c(13, 3, { f: '=E3',                    s: S.CALC })  // Stock = mAb stock conc
  c(13, 4, { f: '=B3/D14',               s: S.CALC })  // Vol mL
  c(13, 5, { f: '=E14*1000',             s: S.CALC })  // Vol µL
  c(13, 6, { f: '=B3/(E5*B6)*1000',     s: S.CALC })  // Conc mM
  c(13, 7, { f: '=G14*1000',             s: S.CALC })  // Conc µM

  // ── Row 14 (A15): TCEP ───────────────────────────────────────────────────
  // G15 = G14 * C15  (TCEP mM = mAb mM * equiv)
  // E15 = G15 * B6 / D15  (Vol mL = TCEP_mM * RedVol / Stock_mM)
  c(14, 0, { v: 'TCEP',                   s: S.ROW_LABEL })
  c(14, 1, { v: 286,                       s: S.CALC })
  c(14, 2, { f: '=B7',                    s: S.INPUT })  // TCEP equiv (editable via param)
  c(14, 3, { f: '=E7',                    s: S.INPUT })  // TCEP stock mM
  c(14, 4, { f: '=G15*B6/D15',           s: S.CALC })  // Vol mL
  c(14, 5, { f: '=E15*1000',             s: S.CALC })  // Vol µL
  c(14, 6, { f: '=G14*C15',             s: S.CALC })  // Conc mM = mAb_mM * equiv
  c(14, 7, { f: '=G15*1000',             s: S.CALC })  // Conc µM

  // ── Row 15 (A16): 100 mM EDTA in Buffer ──────────────────────────────────
  // E16 = B8 * B6 / D16  (Vol = target_mM * RedVol / stock_mM)
  c(15, 0, { v: '100 mM EDTA in Buffer', s: S.ROW_LABEL })
  c(15, 1, { v: 230,                       s: S.CALC })
  c(15, 2, { v: '',                         s: S.CALC })
  c(15, 3, { f: '=E8',                    s: S.INPUT })  // EDTA stock mM
  c(15, 4, { f: '=B8*B6/D16',            s: S.CALC })  // Vol mL
  c(15, 5, { f: '=E16*1000',             s: S.CALC })  // Vol µL
  c(15, 6, { f: '=B8',                   s: S.INPUT })  // Conc mM = EDTA target
  c(15, 7, { f: '=G16*1000',             s: S.CALC })  // Conc µM

  // ── Row 16 (A17): Subtotal ────────────────────────────────────────────────
  c(16, 0, { v: 'Subtotal',              s: S.ROW_LABEL })
  for (let col = 1; col <= 3; col++) c(16, col, { v: '', s: S.CALC })
  c(16, 4, { f: '=E14+E15+E16',         s: S.CALC })  // Vol mL sum
  c(16, 5, { f: '=F14+F15+F16',         s: S.CALC })  // Vol µL sum
  for (let col = 6; col <= 7; col++) c(16, col, { v: '', s: S.CALC })

  // ── Row 17 (A18): Buffer Makeup 1 ────────────────────────────────────────
  c(17, 0, { v: 'Buffer Makeup 1',       s: S.ROW_LABEL })
  for (let col = 1; col <= 3; col++) c(17, col, { v: '', s: S.CALC })
  c(17, 4, { f: '=MAX(0,B6-E17)',        s: S.CALC })  // Remaining vol
  c(17, 5, { f: '=E18*1000',             s: S.CALC })
  for (let col = 6; col <= 7; col++) c(17, col, { v: '', s: S.CALC })

  // ── Row 18 (A19): Vol after TFF ───────────────────────────────────────────
  c(18, 0, { v: 'Vol after TFF  →  Reduction output', s: S.TOTAL })
  for (let col = 1; col <= 3; col++) c(18, col, { v: '', s: S.TOTAL })
  c(18, 4, { f: '=B6',                   s: S.TOTAL })  // = Reduction vol
  c(18, 5, { f: '=E19*1000',             s: S.TOTAL })
  for (let col = 6; col <= 7; col++) c(18, col, { v: '', s: S.TOTAL })

  // ── Row 20 (A21): Conjugation section header ─────────────────────────────
  c(20, 0, { v: 'CONJUGATION STEP',      s: S.SEC_HDR })
  for (let col = 1; col <= 7; col++) c(20, col, { v: '', s: S.SEC_HDR })

  // ── Row 21 (A22): Column headers ─────────────────────────────────────────
  tblHdrs.forEach((h, col) => c(21, col, { v: h, s: S.COL_HDR }))

  // ── Row 22 (A23): Reduced mAb Mix (TFF) ──────────────────────────────────
  // G23 = B3 / (E5 * E6) * 1000  (mAb mM in conjugation vol)
  c(22, 0, { v: 'Reduced mAb Mix (TFF)', s: S.ROW_LABEL })
  c(22, 1, { f: '=E5',                   s: S.CALC })  // MW
  c(22, 2, { v: 1,                        s: S.CALC })
  c(22, 3, { f: '=B4',                   s: S.CALC })  // mAb rxn conc (=B3/B6)
  c(22, 4, { f: '=E19',                  s: S.CALC })  // Vol = TFF output
  c(22, 5, { f: '=E23*1000',             s: S.CALC })
  c(22, 6, { f: '=B3/(E5*E6)*1000',     s: S.CALC })  // Conc mM in conjugation vol
  c(22, 7, { f: '=G23*1000',             s: S.CALC })

  // ── Row 23 (A24): LP (Linker-Payload) ────────────────────────────────────
  // G24 = G23 * C24  (LP mM = mAb_conj_mM * LP_equiv)
  // E24 = G24 * E4 / D24  (Vol mL = LP_mM * TotalVol / Stock_mM)
  c(23, 0, { v: 'LP (Linker-Payload)',   s: S.ROW_LABEL })
  c(23, 1, { f: '=B9',                   s: S.INPUT })  // LP MW
  c(23, 2, { f: '=E9',                   s: S.INPUT })  // LP equiv
  c(23, 3, { f: '=B10',                  s: S.INPUT })  // LP stock mM
  c(23, 4, { f: '=G24*E4/D24',          s: S.CALC })   // Vol mL
  c(23, 5, { f: '=E24*1000',             s: S.CALC })   // Vol µL
  c(23, 6, { f: '=G23*C24',             s: S.CALC })   // Conc mM
  c(23, 7, { f: '=G24*1000',             s: S.CALC })

  // ── Row 24 (A25): DMA / DMSO ─────────────────────────────────────────────
  // C25 = E10/100  (fraction)
  // E25 = MAX(0, C25 * E4 - E24)  (DMA vol = fraction*total - LP vol)
  // G25 = actual DMA %
  c(24, 0, { v: 'DMA / DMSO',            s: S.ROW_LABEL })
  c(24, 1, { v: '',                        s: S.CALC })
  c(24, 2, { f: '=E10/100',              s: S.CALC })   // fraction (e.g. 0.1)
  c(24, 3, { v: 'neat',                   s: S.CALC })
  c(24, 4, { f: '=MAX(0,C25*E4-E24)',    s: S.CALC })   // Vol mL
  c(24, 5, { f: '=E25*1000',             s: S.CALC })   // Vol µL
  c(24, 6, { f: '=IF(E4>0,E25/E4*100,0)', s: S.CALC }) // DMA % actual
  c(24, 7, { v: '',                        s: S.CALC })

  // ── Row 25 (A26): Subtotal ────────────────────────────────────────────────
  c(25, 0, { v: 'Subtotal',              s: S.ROW_LABEL })
  for (let col = 1; col <= 3; col++) c(25, col, { v: '', s: S.CALC })
  c(25, 4, { f: '=E23+E24+E25',         s: S.CALC })
  c(25, 5, { f: '=F23+F24+F25',         s: S.CALC })
  for (let col = 6; col <= 7; col++) c(25, col, { v: '', s: S.CALC })

  // ── Row 26 (A27): Buffer Makeup 2 ────────────────────────────────────────
  c(26, 0, { v: 'Buffer Makeup 2',       s: S.ROW_LABEL })
  for (let col = 1; col <= 3; col++) c(26, col, { v: '', s: S.CALC })
  c(26, 4, { v: 0,                        s: S.CALC })
  c(26, 5, { v: 0,                        s: S.CALC })
  for (let col = 6; col <= 7; col++) c(26, col, { v: '', s: S.CALC })

  // ── Row 27 (A28): TOTAL ───────────────────────────────────────────────────
  c(27, 0, { v: 'TOTAL',                 s: S.TOTAL })
  for (let col = 1; col <= 3; col++) c(27, col, { v: '', s: S.TOTAL })
  c(27, 4, { f: '=E4',                   s: S.TOTAL })  // Final conj vol mL
  c(27, 5, { f: '=E28*1000',             s: S.TOTAL })  // µL
  for (let col = 6; col <= 7; col++) c(27, col, { v: '', s: S.TOTAL })

  // ── Styles ────────────────────────────────────────────────────────────────
  // IColorStyle.rgb requires full '#RRGGBB' format
  const styles: Record<string, unknown> = {
    [S.TITLE]: {
      bl: 1, fs: 13, cl: { rgb: '#1E3A5F' },
    },
    [S.SEC_HDR]: {
      bg: { rgb: '#1E3A5F' }, cl: { rgb: '#FFFFFF' }, bl: 1, fs: 11,
      bd: thin('#1E3A5F'),
    },
    [S.COL_HDR]: {
      bg: { rgb: '#C6EFCE' }, cl: { rgb: '#276221' }, bl: 1, fs: 10, ht: 2,
      bd: thin('#A0C4A8'),
    },
    [S.PARAM_LABEL]: {
      bg: { rgb: '#DCE6F1' }, cl: { rgb: '#1E3A5F' }, bl: 1, fs: 10,
      bd: thin('#B8CCE4'),
    },
    [S.PARAM_INPUT]: {
      bg: { rgb: '#FFF2CC' }, cl: { rgb: '#333333' }, fs: 10,
      bd: thin('#D4C57A'),
    },
    [S.PARAM_CALC]: {
      bg: { rgb: '#EEF2F7' }, cl: { rgb: '#555555' }, fs: 10, it: 1,
      bd: thin('#C0CCDD'),
    },
    [S.ROW_LABEL]: {
      bg: { rgb: '#DCE6F1' }, cl: { rgb: '#1E3A5F' }, bl: 1, fs: 10,
      bd: thin('#B8CCE4'),
    },
    [S.INPUT]: {
      bg: { rgb: '#FFF2CC' }, cl: { rgb: '#333333' }, fs: 10,
      bd: thin('#D4C57A'),
    },
    [S.CALC]: {
      bg: { rgb: '#F3F3F3' }, cl: { rgb: '#444444' }, fs: 10,
      bd: thin('#C0C0C0'),
    },
    [S.TOTAL]: {
      bg: { rgb: '#C6EFCE' }, cl: { rgb: '#276221' }, bl: 1, fs: 10,
      bd: thin('#A0C4A8'),
    },
    [S.WARN]: {
      bg: { rgb: '#FFC7CE' }, cl: { rgb: '#9C0006' }, fs: 10,
      bd: thin('#FF8A80'),
    },
  }

  return {
    id: 'adc-calc-wb',
    name: 'ADC Calc',
    locale: 'en-US',
    styles,
    sheets: {
      sheet1: {
        id: 'sheet1',
        name: 'ADC Calculation',
        cellData: cd as IWorkbookData['sheets'][string]['cellData'],
        rowCount: 30,
        columnCount: 10,
        mergeData: [
          // Title spans all 8 cols
          { startRow: 0, startColumn: 0, endRow: 0, endColumn: 7 },
          // Section headers span all 8 cols
          { startRow: 11, startColumn: 0, endRow: 11, endColumn: 7 },
          { startRow: 20, startColumn: 0, endRow: 20, endColumn: 7 },
          // TFF and Total row label spans 4 cols
          { startRow: 18, startColumn: 0, endRow: 18, endColumn: 3 },
          { startRow: 27, startColumn: 0, endRow: 27, endColumn: 3 },
        ],
        rowData: {
          0:  { h: 30, hd: 0 },
          1:  { h: 8,  hd: 0 },
          10: { h: 8,  hd: 0 },
          11: { h: 22, hd: 0 },
          12: { h: 22, hd: 0 },
          19: { h: 8,  hd: 0 },
          20: { h: 22, hd: 0 },
          21: { h: 22, hd: 0 },
          27: { h: 24, hd: 0 },
        },
        columnData: {
          0: { w: 210, hd: 0 },
          1: { w: 85,  hd: 0 },
          2: { w: 85,  hd: 0 },
          3: { w: 85,  hd: 0 },
          4: { w: 85,  hd: 0 },
          5: { w: 85,  hd: 0 },
          6: { w: 85,  hd: 0 },
          7: { w: 85,  hd: 0 },
        },
        showGridlines: 1,
        rightToLeft: 0,
        tabColor: '',
        hidden: 0,
        freeze: { xSplit: 1, ySplit: 13, startRow: 13, startColumn: 1 },
      },
    },
  } as unknown as IWorkbookData
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UniverCalculatorField({ value, onChange, disabled }: UniverCalcProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef  = useRef<{ dispose: () => void } | null>(null)
  const onChangeRef  = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current || instanceRef.current) return
    let mounted = true

    ;(async () => {
      try {
        const { createUniver, LocaleType, mergeLocales } = await import('@univerjs/presets')
        const { UniverSheetsCorePreset }                  = await import('@univerjs/preset-sheets-core')
        const { default: enUS }                           = await import(
          '@univerjs/preset-sheets-core/locales/en-US'
        )

        if (!mounted || !containerRef.current) return

        const savedInputs = (value as { inputs?: Record<string, number> } | undefined)?.inputs
        const workbookData = buildWorkbookData(savedInputs)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(enUS),
          },
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
            }),
          ],
        }) as { univerAPI: any; univer: any }

        univerAPI.createWorkbook(workbookData)

        // Read key output cell values and emit
        const emit = () => {
          try {
            const ws = univerAPI?.getActiveWorkbook?.()?.getActiveSheet?.()
            if (!ws) return
            const g = (row: number, col: number): number => {
              const v = ws.getRange?.(row, col)?.getValue?.()
              return typeof v === 'number' && isFinite(v) ? v : 0
            }
            onChangeRef.current({
              results: {
                mab_vol_ul:          g(13, 5),  // F14
                tcep_vol_ul:         g(14, 5),  // F15
                edta_vol_ul:         g(15, 5),  // F16
                buffer1_ul:          g(17, 5),  // F18
                tff_vol_ml:          g(18, 4),  // E19
                lp_vol_ul:           g(23, 5),  // F24
                dma_vol_ul:          g(24, 5),  // F25
                buffer2_ul:          g(26, 5),  // F27
                total_reduction_ul:  g(16, 5),  // F17
                total_conjugation_ul:g(25, 5),  // F26
              },
            })
          } catch {
            // silent
          }
        }

        // Listen for any command (cell edit, etc.)
        let disposable: { dispose?: () => void } | null = null
        try {
          disposable = univerAPI.onCommandExecuted?.(() => {
            setTimeout(emit, 200)
          }) ?? null
        } catch {
          // fallback: poll every 3s
          const id = setInterval(emit, 3000)
          disposable = { dispose: () => clearInterval(id) }
        }

        // Set read-only if disabled
        if (disabled) {
          try {
            univerAPI.getActiveWorkbook?.()?.setEditable?.(false)
          } catch { /* not available */ }
        }

        instanceRef.current = {
          dispose() {
            disposable?.dispose?.()
            try { univerAPI?.getActiveWorkbook?.()?.dispose?.() } catch { /* silent */ }
          },
        }
      } catch (err) {
        console.error('UniverCalculator init error:', err)
      }
    })()

    return () => {
      mounted = false
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ width: '100%', height: 680, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
