// ── Calc (Univer) Template Builder data model ───────────────────────────────
// The Univer workbook snapshot (IWorkbookData) is the source of truth for
// cell content/formulas/formatting and is opaque to us — we never parse or
// hardcode it. This file only shapes the metadata WE own alongside it: which
// ranges are named input/output fields, and which ranges got locked via the
// Permission Facade API. See CalcTemplateBuilderPage.tsx for how these are
// populated from live Univer Facade calls (fRange.getRange(), .protect()).

export type CalcFieldRole = 'input' | 'output'

// A cell/range range address, in Univer's own 0-indexed row/column form (not
// an A1 string) — exact and unambiguous for backend re-validation later.
// Mirrors Univer's own `IRange` shape (facade `FRange.getRange()`).
export interface CellRangeRef {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

// An admin-labeled cell/range — the field "key" is what the backend will use
// to extract output values / accept input values (Phase 3), independent of
// Univer's own (formula-authoring-oriented) named-range feature.
export interface CalcField {
  key: string          // stable identifier, e.g. "dose_input" — must be unique within the template
  label: string         // shown to the end user in Fill mode
  role: CalcFieldRole
  sheetId: string
  range: CellRangeRef
  display: string       // e.g. "A1:B2" — human-readable, for the admin UI only; not authoritative
}

// A range locked via the Permission Facade API (`fRange.getRangePermission().protect()`).
// `ruleId`/`permissionId` are Univer's own identifiers for the created rule —
// kept here so we can reference/revoke it, though the actual protection state
// lives in the workbook snapshot itself once published.
export interface ProtectedRangeMeta {
  ruleId: string
  permissionId: string
  sheetId: string
  range: CellRangeRef
  display: string
}

export interface CalcTemplateMetadata {
  fields: CalcField[]
  protectedRanges: ProtectedRangeMeta[]
}
