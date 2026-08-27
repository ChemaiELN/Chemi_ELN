// Shared ARD section-type catalog — single source of truth for both
// ardTemplates.routes.ts (structural validation of the legacy JSON `sections` blob,
// kept during the rearchitecture transition) and ardSections.routes.ts (the new
// master-data Section CRUD). Extracted per the rearchitecture prompt §1's note that
// this catalog previously only lived inline in ardTemplates.routes.ts.
//
// Ported originally from backend/app/modules/ard/section_types.py:7 (SECTION_TYPES).
//
// `fixed` marks the 8 standard GxP "Lab Component" blocks (Weighing, pH,
// Sample Details, ...) — they ship with a preset default column set
// (getDefaultGxPColumns on the frontend) and are grouped separately in the
// Template Builder palette ("Fixed Sections To Be Displayed"). It is NOT a
// singleton/uniqueness constraint — any number of independently-configured
// sections of a fixed type may exist (e.g. a project may want its own
// Weighing Details variant with different columns), each reusable across
// multiple templates exactly like a non-fixed section. A per-TEMPLATE
// restriction (at most one section of a given type per template) is a
// separate, existing UI-level rule in ArdTemplateBuilderPage.tsx.
// Previously this categorization only lived as an ad hoc frontend grouping
// (BLOCK_CATALOG `group: 'Lab'`, re-derived by hand) — moving it here makes
// it real data both frontend and backend can read from one place.
export const SECTION_TYPES = [
  { type: 'richtext', label: 'Rich Text', configurable: 'none', fixed: false },
  { type: 'params', label: 'Parameters', configurable: 'none', fixed: false },
  { type: 'table', label: 'Data Table', configurable: 'columns', fixed: false },
  { type: 'combined', label: 'Combined', configurable: 'children', fixed: false },
  { type: 'preconfigured_excel', label: 'Preconfigured Spreadsheet', configurable: 'sheetPreset', fixed: false },
  { type: 'standard_preparation', label: 'Standard Preparation', configurable: 'none', fixed: false },
  { type: 'data_item', label: 'Data Item', configurable: 'dataItemId', fixed: false },
  { type: 'autocomplete_data_item', label: 'Autocomplete Data Item', configurable: 'dataItemId', fixed: false },
  { type: 'content_block', label: 'Content Block', configurable: 'contentBlockId', fixed: false },
  { type: 'weighing', label: 'Weighing Details', configurable: 'none', fixed: true },
  { type: 'ph', label: 'pH Details', configurable: 'none', fixed: true },
  { type: 'equipment', label: 'Equipment Details', configurable: 'none', fixed: true },
  { type: 'column', label: 'Column Details', configurable: 'none', fixed: true },
  { type: 'chemical', label: 'Material / Chemical Details', configurable: 'none', fixed: true },
  { type: 'sample_details', label: 'Sample Details', configurable: 'columns', fixed: true },
  { type: 'quantitative_result', label: 'Quantitative Results', configurable: 'none', fixed: true },
  { type: 'further_actions', label: 'Further Actions', configurable: 'none', fixed: true },
] as const

export type ArdSectionType = (typeof SECTION_TYPES)[number]['type']

export const SECTION_TYPE_ALIASES: Record<string, string> = {
  keyvalue: 'params',
  datatable: 'table',
  sheet: 'preconfigured_excel',
  preconfiguredexcel: 'preconfigured_excel',
  standardprep: 'standard_preparation',
  standardpreparation: 'standard_preparation',
  dataitem: 'data_item',
  autocompletedataitem: 'autocomplete_data_item',
}

export function normalizeSectionType(raw: string): string {
  const key = (raw || '').toLowerCase().replace(/[_ ]/g, '')
  return SECTION_TYPE_ALIASES[key] ?? raw
}

// Derived directly from SECTION_TYPES' own `fixed` flag — see the comment
// above that array for what this actually means and why it exists.
export const FIXED_SECTION_TYPES: Set<string> = new Set(SECTION_TYPES.filter((s) => s.fixed).map((s) => s.type))

// Types whose content lives in a dedicated ard_section_* extension table
// (rearchitecture prompt §1.2-§1.4).
export const RICHTEXT_TYPES = new Set(['richtext', 'standard_preparation'])
// All 8 Lab Component GxP blocks (weighing, ph, equipment, column, chemical,
// sample_details, quantitative_result, further_actions) plus 'table'/'combined'
// carry a datatable of columns. Lab Component columns are old's fixed
// free-text key/title preset (columnKey/columnLabel, no dataItemId — see
// migration 20260825000003); 'table'/'combined' stay governed-Master-Data-
// linked. Restored 2026-08-25 — these previously had no persisted column
// storage at all (rendered from fixed application logic pre-rearchitecture).
export const DATATABLE_TYPES = new Set([
  'table', 'combined', 'weighing', 'ph', 'equipment', 'column', 'chemical',
  'sample_details', 'quantitative_result', 'further_actions',
])
export const EMBEDDED_FILE_TYPES = new Set(['preconfigured_excel'])
export const SINGLE_DATA_ITEM_TYPES = new Set(['data_item', 'autocomplete_data_item'])
// 'combined' = Param block + Data Table block together (product owner review
// 2026-08-20, matching the legacy "Combined" section screen) — it belongs in
// both this set and DATATABLE_TYPES above, not a Data Table alone.
export const MULTI_DATA_ITEM_TYPES = new Set(['params', 'combined'])
// References the pre-existing ard_content_blocks library (Configuration →
// Content Library) — restored 2026-08-25, ported from the old builder's
// content_block section type. Not snapshotted on template publish, matching
// old's behavior (it read masterData.contentBlocks live too).
export const CONTENT_BLOCK_TYPES = new Set(['content_block'])
