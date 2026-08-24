// Shared ARD section-type catalog — single source of truth for both
// ardTemplates.routes.ts (structural validation of the legacy JSON `sections` blob,
// kept during the rearchitecture transition) and ardSections.routes.ts (the new
// master-data Section CRUD). Extracted per the rearchitecture prompt §1's note that
// this catalog previously only lived inline in ardTemplates.routes.ts.
//
// Ported originally from backend/app/modules/ard/section_types.py:7 (SECTION_TYPES).
export const SECTION_TYPES = [
  { type: 'richtext', label: 'Rich Text', configurable: 'none' },
  { type: 'params', label: 'Parameters', configurable: 'none' },
  { type: 'table', label: 'Data Table', configurable: 'columns' },
  { type: 'combined', label: 'Combined', configurable: 'children' },
  { type: 'preconfigured_excel', label: 'Preconfigured Spreadsheet', configurable: 'sheetPreset' },
  { type: 'standard_preparation', label: 'Standard Preparation', configurable: 'none' },
  { type: 'data_item', label: 'Data Item', configurable: 'dataItemId' },
  { type: 'autocomplete_data_item', label: 'Autocomplete Data Item', configurable: 'dataItemId' },
  { type: 'weighing', label: 'Weighing Details', configurable: 'none' },
  { type: 'ph', label: 'pH Details', configurable: 'none' },
  { type: 'equipment', label: 'Equipment Details', configurable: 'none' },
  { type: 'column', label: 'Column Details', configurable: 'none' },
  { type: 'chemical', label: 'Material / Chemical Details', configurable: 'none' },
  { type: 'quantitative_result', label: 'Quantitative Results', configurable: 'none' },
  { type: 'further_actions', label: 'Further Actions', configurable: 'none' },
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

// Types whose content lives in a dedicated ard_section_* extension table
// (rearchitecture prompt §1.2-§1.4). Types not in any of these buckets carry no
// type-specific detail beyond the base ard_sections row (e.g. weighing, ph-as-a-
// fixed-block, equipment, column, chemical, quantitative_result, further_actions —
// those are rendered from fixed application logic, not authored content).
export const RICHTEXT_TYPES = new Set(['richtext', 'standard_preparation'])
export const DATATABLE_TYPES = new Set(['table', 'combined'])
export const EMBEDDED_FILE_TYPES = new Set(['preconfigured_excel'])
export const SINGLE_DATA_ITEM_TYPES = new Set(['data_item', 'autocomplete_data_item'])
// 'combined' = Param block + Data Table block together (product owner review
// 2026-08-20, matching the legacy "Combined" section screen) — it belongs in
// both this set and DATATABLE_TYPES above, not a Data Table alone.
export const MULTI_DATA_ITEM_TYPES = new Set(['params', 'combined'])
