/**
 * Converts an .xlsx/.xlsm file buffer into Univer IWorkbookData format.
 * Mirrors the logic in backend/app/modules/calc_templates/xlsx_import.py.
 */
import ExcelJS from 'exceljs'
import { v4 as uuidv4 } from 'uuid'

// ── Univer cell value types ───────────────────────────────────────────────────
const CELL_TYPE_STRING = 1
const CELL_TYPE_NUMBER = 2
const CELL_TYPE_BOOLEAN = 3

const MIN_ROWS = 50
const MIN_COLS = 20
const PADDING_ROWS = 20
const PADDING_COLS = 5
const DEFAULT_COL_WIDTH_PX = 88
const DEFAULT_ROW_HEIGHT_PX = 24
const PX_PER_CHAR = 7.0
const CELL_PADDING_PX = 5.0
const MAX_SUGGESTED_OUTPUTS = 200
const NOISE_FORMATS = new Set(['General', 'general', '@', ''])

const H_ALIGN: Record<string, number> = { left: 1, center: 2, right: 3, fill: 4, justify: 6 }
const V_ALIGN: Record<string, number> = { top: 1, middle: 2, bottom: 3 }

// ── Style table ───────────────────────────────────────────────────────────────
class StyleTable {
  private map = new Map<string, string>()
  private counter = 0
  readonly styles: Record<string, Record<string, unknown>> = {}

  intern(style: Record<string, unknown>): string | null {
    if (Object.keys(style).length === 0) return null
    const key = JSON.stringify(Object.fromEntries(Object.entries(style).sort()))
    if (!this.map.has(key)) {
      this.counter++
      const id = `s${this.counter}`
      this.map.set(key, id)
      this.styles[id] = style
    }
    return this.map.get(key)!
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function argbToHex(argb: string | undefined): string | null {
  if (!argb || argb === '00000000' || argb === 'FF000000') return null
  const hex = argb.slice(-6)
  return `#${hex}`
}

function colorObj(argb: string | undefined): Record<string, string> | null {
  const hex = argbToHex(argb)
  return hex ? { rgb: hex } : null
}

function cellStyle(cell: ExcelJS.Cell): Record<string, unknown> {
  const s: Record<string, unknown> = {}

  // Font
  const f = cell.font as any
  if (f) {
    if (f.name) s.ff = f.name
    if (f.size) s.fs = f.size
    if (f.bold) s.bl = 1
    if (f.italic) s.it = 1
    if (f.underline) s.ul = { s: 1 }
    if (f.strike) s.st = { s: 1 }
    const fc = colorObj(f.color?.argb)
    if (fc) s.cl = fc
  }

  // Fill
  const fill = cell.fill as any
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = colorObj(fill.fgColor?.argb)
    if (bg) s.bg = bg
  }

  // Alignment
  const al = cell.alignment as any
  if (al) {
    if (al.horizontal && H_ALIGN[al.horizontal]) s.ht = H_ALIGN[al.horizontal]
    if (al.vertical && V_ALIGN[al.vertical]) s.vt = V_ALIGN[al.vertical]
    if (al.wrapText) s.tb = 3
  }

  // Border
  const bd: Record<string, unknown> = {}
  const border = cell.border as any
  const BORDER_STYLE: Record<string, number> = {
    thin: 1, medium: 2, thick: 3, dotted: 4, dashed: 5, double: 6,
    dashDot: 7, dashDotDot: 8, slantDashDot: 9, mediumDashed: 10,
    mediumDashDot: 11, mediumDashDotDot: 12, hair: 13,
  }
  for (const [side, key] of [['left','l'],['right','r'],['top','t'],['bottom','b']] as [string,string][]) {
    const b = border?.[side]
    if (b?.style) {
      const entry: any = { s: BORDER_STYLE[b.style] ?? 1 }
      const bc = colorObj(b.color?.argb)
      if (bc) entry.cl = bc
      bd[key] = entry
    }
  }
  if (Object.keys(bd).length) s.bd = bd

  // Number format
  const fmt = (cell.numFmt || '') as string
  if (fmt && !NOISE_FORMATS.has(fmt)) s.n = { pattern: fmt }

  return s
}

// ── Cell protection ─────────────────────────────────────────────────────────
// Excel's own default is every cell LOCKED once sheet protection is turned
// on — the author only sets `protection.locked = false` on the specific
// entry cells they colored and want the user to type into. So "locked" here
// means "not explicitly unlocked", matching Excel's actual semantics, not
// "explicitly marked locked".
//
// Fallback: several real STP templates color their entry cells (light
// green) but never actually unchecked "Locked" in Format Cells before
// turning on sheet protection — the file's own protection data says
// everything is locked, contradicting the visual intent. A cell filled with
// green is treated as unlocked even when its protection flag says otherwise.
// Originally an exact-match against one hardcoded shade (EBF1DE, from the
// first reference file this was built against) — confirmed too strict: a
// second real upload marked its editable cells CCFF99, a visibly-different
// green the exact match silently rejected, locking that file's entire sheet
// (102 rows, every cell) with no way to tell from the UI why. Detecting
// "green" by RGB channel dominance instead of one fixed hex handles any
// shade of green uniformly. This workbook's own header bands are colored
// too (orange/blue/red) and must stay locked — verified the channel check
// rejects those: orange/red have R >= G, blue has B > G, so only genuinely
// green-family fills (G clearly the highest channel) ever qualify.
function hasEditableFillMarker(cell: ExcelJS.Cell): boolean {
  const fill = cell.fill as any
  if (fill?.type !== 'pattern' || fill.pattern !== 'solid') return false
  const argb = fill.fgColor?.argb as string | undefined
  const hex = argb?.slice(-6).toUpperCase()
  if (!hex || hex.length !== 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return false
  if (r === 255 && g === 255 && b === 255) return false // white/no-fill is never a marker
  return g > r && g >= b && g - Math.min(r, b) >= 15
}

function colLetter(c0: number): string {
  let n = c0 + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function rangeDisplay(r: { startRow: number; startColumn: number; endRow: number; endColumn: number }): string {
  const a1 = `${colLetter(r.startColumn)}${r.startRow + 1}`
  const a2 = `${colLetter(r.endColumn)}${r.endRow + 1}`
  return a1 === a2 ? a1 : `${a1}:${a2}`
}

// Merges horizontally-contiguous locked cells per row into single ranges,
// so a mostly-locked sheet doesn't produce one protection rule per cell.
function computeLockedRanges(
  ws: ExcelJS.Worksheet,
  sheetId: string,
  maxRow: number,
  maxCol: number
): { sheetId: string; range: { startRow: number; startColumn: number; endRow: number; endColumn: number }; display: string }[] {
  if (!(ws as any).sheetProtection?.sheet) return []

  const ranges: { sheetId: string; range: { startRow: number; startColumn: number; endRow: number; endColumn: number }; display: string }[] = []
  for (let r = 0; r <= maxRow; r++) {
    let runStart: number | null = null
    for (let c = 0; c <= maxCol + 1; c++) {
      let locked = false
      if (c <= maxCol) {
        const cell = ws.getCell(r + 1, c + 1)
        const explicitlyUnlocked = (cell.style as any)?.protection?.locked === false
        locked = !explicitlyUnlocked && !hasEditableFillMarker(cell)
      }
      if (locked) {
        if (runStart === null) runStart = c
      } else if (runStart !== null) {
        const range = { startRow: r, startColumn: runStart, endRow: r, endColumn: c - 1 }
        ranges.push({ sheetId, range, display: rangeDisplay(range) })
        runStart = null
      }
    }
  }
  return ranges
}

// ── Sheet conversion ──────────────────────────────────────────────────────────
function convertSheet(
  ws: ExcelJS.Worksheet,
  sheetId: string,
  styleTable: StyleTable
): { sheet: Record<string, unknown>; lockedRanges: ReturnType<typeof computeLockedRanges> } {
  const cellData: Record<string, Record<string, unknown>> = {}
  const mergeData: unknown[] = []
  const rowData: Record<string, { h: number }> = {}
  const columnData: Record<string, { w: number }> = {}

  let maxRow = MIN_ROWS
  let maxCol = MIN_COLS

  ws.eachRow({ includeEmpty: false }, (row, rowIdx) => {
    const r0 = rowIdx - 1
    ;(row as any).eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colIdx: number) => {
      const c0 = colIdx - 1
      if (r0 > maxRow) maxRow = r0
      if (c0 > maxCol) maxCol = c0

      // A merged cell's non-anchor members mirror the anchor's value via
      // ExcelJS (cell.master !== cell), so without this guard every cell in
      // a merge range — e.g. the A1:AZ1 title band — got the same text
      // duplicated into it instead of being blank, which then rendered
      // wrong/duplicated content once mergeData was applied on top.
      if ((cell as any).isMerged && cell.master !== cell) return

      const raw = cell.value
      // ExcelJS represents a formula two ways: the master cell of a fill has
      // `.formula`, but every OTHER cell in a shared-formula fill (very
      // common in real calc templates) only carries `.sharedFormula` (the
      // master's address) + `.result` — it has no `.formula` at all. Treating
      // only `.formula` as "this is a formula cell" silently dropped the `f`
      // (and, worse, could fall through to the plain-value branch below with
      // `cached` still pointing at the raw `{sharedFormula, result}` object)
      // for most cells in any sheet that uses fill-down formulas.
      const isFormulaLike = raw !== null && typeof raw === 'object' && ('formula' in (raw as any) || 'sharedFormula' in (raw as any))
      const formula = isFormulaLike ? ((raw as any).formula || null) : null
      // Only fall back to the raw value when it's NOT one of these formula
      // wrapper objects — otherwise a formula cell with no cached result
      // (`result` undefined) would fall back to `raw` itself and get
      // stringified into garbage like "[object Object]" below.
      const cached = isFormulaLike ? (raw as any).result : raw
      const isFormula = !!formula

      let v: unknown = null
      let t: number = CELL_TYPE_STRING

      if (cached === null || cached === undefined) {
        if (!isFormulaLike) return
        v = null
        t = CELL_TYPE_STRING
      } else if (typeof cached === 'boolean') {
        v = cached ? 1 : 0
        t = CELL_TYPE_BOOLEAN
      } else if (typeof cached === 'number') {
        v = cached
        t = CELL_TYPE_NUMBER
      } else if (cached instanceof Date) {
        v = cached.toISOString()
        t = CELL_TYPE_STRING
      } else if (typeof cached === 'object' && (cached as any).richText) {
        v = (cached as any).richText.map((rt: any) => rt.text || '').join('')
        t = CELL_TYPE_STRING
      } else {
        v = String(cached)
        t = CELL_TYPE_STRING
      }

      const style = cellStyle(cell)
      const sId = styleTable.intern(style)
      const entry: Record<string, unknown> = {}
      if (v !== null) entry.v = v
      if (v !== null) entry.t = t
      if (isFormula) entry.f = `=${formula}`
      if (sId) entry.s = sId

      if (Object.keys(entry).length === 0) return
      if (!cellData[r0]) cellData[r0] = {}
      cellData[r0][c0] = entry
    })

    const rh = (row as any).height
    if (rh) rowData[r0] = { h: Math.round(rh * 96 / 72) }
  })

  // Merged cells. ExcelJS exposes these as an array of range strings on
  // ws.model.merges (e.g. 'A1:AZ1') — there is no `ws.merges` property, so
  // reading that always silently produced zero merges regardless of the file.
  for (const range of (ws.model as any)?.merges ?? []) {
    const [start, end] = (range as string).split(':')
    if (!start || !end) continue
    const toRC = (addr: string) => {
      const m = addr.match(/([A-Z]+)(\d+)/)
      if (!m) return null
      const col = m[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const row = parseInt(m[2], 10) - 1
      return { row, col }
    }
    const s = toRC(start)
    const e = toRC(end)
    if (s && e) mergeData.push({ startRow: s.row, startColumn: s.col, endRow: e.row, endColumn: e.col })
  }

  // Column widths
  ;(ws.columns || []).forEach((col, idx) => {
    if ((col as any).width) {
      columnData[idx] = { w: Math.round((col as any).width * PX_PER_CHAR + CELL_PADDING_PX) }
    }
  })

  const rowCount = maxRow + PADDING_ROWS + 1
  const columnCount = maxCol + PADDING_COLS + 1

  // Freeze panes
  let freeze: Record<string, number> = { xSplit: 0, ySplit: 0, startRow: -1, startColumn: -1 }
  const fp = (ws as any).views?.[0]?.state === 'frozen' ? (ws as any).views[0] : null
  if (fp) {
    freeze = { xSplit: fp.xSplit || 0, ySplit: fp.ySplit || 0, startRow: fp.ySplit || 0, startColumn: fp.xSplit || 0 }
  }

  const lockedRanges = computeLockedRanges(ws, sheetId, maxRow, maxCol)

  return { sheet: {
    id: sheetId,
    name: ws.name,
    tabColor: null,
    hidden: 0,
    rowCount,
    columnCount,
    defaultColumnWidth: DEFAULT_COL_WIDTH_PX,
    defaultRowHeight: DEFAULT_ROW_HEIGHT_PX,
    cellData,
    mergeData,
    rowData,
    columnData,
    freeze,
    showGridlines: 1,
    rowHeader: { width: 46 },
    columnHeader: { height: 20 },
    rightToLeft: 0,
  }, lockedRanges }
}

// ── Field suggestion ──────────────────────────────────────────────────────────
function slugifyKey(label: string, taken: Set<string>): string {
  let key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^[^a-z]+/, '').slice(0, 40)
  if (!key) key = 'field'
  let candidate = key
  let i = 2
  while (taken.has(candidate)) { candidate = `${key}_${i++}` }
  taken.add(candidate)
  return candidate
}

function suggestFields(
  wb: ExcelJS.Workbook,
  sheetIds: Record<string, string>
): { fields: unknown[]; protectedRanges: unknown[]; truncated: boolean } {
  const fields: unknown[] = []
  const taken = new Set<string>()
  let truncated = false

  // Named ranges → inputs
  ;(wb as any).definedNames?.model?.forEach((dn: any) => {
    const name = dn.name as string
    if (!name || name.startsWith('_')) return
    const ranges = Array.isArray(dn.ranges) ? dn.ranges : []
    for (const rangeStr of ranges) {
      const m = (rangeStr as string).match(/^'?([^'!]+)'?!(.+)$/)
      if (!m) continue
      const sheetName = m[1].replace(/'/g, '')
      const rangeRef = m[2]
      const ws = wb.getWorksheet(sheetName)
      if (!ws) continue
      const sheetId = sheetIds[ws.id as unknown as string] || sheetIds[sheetName]
      if (!sheetId) continue

      const clean = rangeRef.replace(/\$/g, '')
      const parts = clean.split(':')
      const toCoords = (addr: string) => {
        const pm = addr.match(/([A-Z]+)(\d+)/)
        if (!pm) return null
        const col = pm[1].split('').reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0) - 1
        const row = parseInt(pm[2], 10) - 1
        return { row, col }
      }
      const start = toCoords(parts[0])
      const end = toCoords(parts[parts.length - 1] || parts[0])
      if (!start || !end) continue
      const range = { startRow: start.row, startColumn: start.col, endRow: end.row, endColumn: end.col }
      const key = slugifyKey(name, taken)
      fields.push({ key, label: name, role: 'input', sheetId, range, display: clean })
    }
  })

  // Formula cells → outputs
  const inputCovered = new Set<string>()
  for (const f of fields as any[]) {
    for (let r = f.range.startRow; r <= f.range.endRow; r++) {
      for (let c = f.range.startColumn; c <= f.range.endColumn; c++) {
        inputCovered.add(`${f.sheetId}:${r}:${c}`)
      }
    }
  }

  let formulaCount = 0
  wb.eachSheet((ws) => {
    const sheetId = sheetIds[ws.id as unknown as string] || sheetIds[ws.name]
    if (!sheetId) return
    ws.eachRow({ includeEmpty: false }, (row, rowIdx) => {
      ;(row as any).eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colIdx: number) => {
        const raw = cell.value as any
        if (!raw?.formula) return
        const r0 = rowIdx - 1
        const c0 = colIdx - 1
        const cellKey = `${sheetId}:${r0}:${c0}`
        if (inputCovered.has(cellKey)) {
          const input = (fields as any[]).find(f => f.sheetId === sheetId && f.range.startRow === r0 && f.range.startColumn === c0)
          if (input) input.role = 'output'
          return
        }
        if (formulaCount >= MAX_SUGGESTED_OUTPUTS) { truncated = true; return }
        const addr = cell.address
        const key = slugifyKey(`output_${addr}`, taken)
        const range = { startRow: r0, startColumn: c0, endRow: r0, endColumn: c0 }
        fields.push({ key, label: addr, role: 'output', sheetId, range, display: addr })
        formulaCount++
      })
    })
  })

  return { fields, protectedRanges: [], truncated }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export interface XlsxConvertResult {
  workbook_data: Record<string, unknown>
  metadata: Record<string, unknown>
  stats: {
    sheets: number
    formulas: number
    styles: number
    suggested_fields: number
    fields_truncated: boolean
    dropped: string[]
  }
}

export async function convertXlsx(data: Buffer | ArrayBuffer, workbookName: string): Promise<XlsxConvertResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(data as any)

  if (wb.worksheets.length === 0) {
    throw new Error('Workbook has no worksheets')
  }

  const styleTable = new StyleTable()
  const sheetOrder: string[] = []
  const sheets: Record<string, unknown> = {}
  const sheetIds: Record<string, string> = {}
  let lockedRanges: ReturnType<typeof computeLockedRanges> = []

  wb.eachSheet((ws, id) => {
    const sheetId = `sheet-${String(sheetOrder.length + 1).padStart(2, '0')}`
    sheetOrder.push(sheetId)
    sheetIds[String(id)] = sheetId
    sheetIds[ws.name] = sheetId
    const converted = convertSheet(ws, sheetId, styleTable)
    sheets[sheetId] = converted.sheet
    lockedRanges = lockedRanges.concat(converted.lockedRanges)
  })

  let formulaCount = 0
  wb.eachSheet(ws => {
    ws.eachRow({ includeEmpty: false }, row => {
      ;(row as any).eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell) => {
        if ((cell.value as any)?.formula) formulaCount++
      })
    })
  })

  const fieldSuggestion = suggestFields(wb, sheetIds)

  const workbook_data: Record<string, unknown> = {
    id: uuidv4(),
    name: workbookName,
    appVersion: '0.25.1',
    locale: 'enUS',
    sheetOrder,
    sheets,
    styles: styleTable.styles,
    resources: [],
  }

  return {
    workbook_data,
    metadata: { fields: fieldSuggestion.fields, protectedRanges: lockedRanges },
    stats: {
      sheets: sheetOrder.length,
      formulas: formulaCount,
      styles: Object.keys(styleTable.styles).length,
      suggested_fields: fieldSuggestion.fields.length,
      fields_truncated: fieldSuggestion.truncated,
      dropped: [],
    },
  }
}
