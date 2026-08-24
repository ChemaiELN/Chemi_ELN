import { apiGet, apiPost, apiPatch, apiUpload } from './client'
import type { CalcTemplateMetadata } from '../pages/admin/calcTemplates/types'

// ── Calc (Univer) Sheet Templates ────────────────────────────────────────────
// Backed by backend/app/modules/calc_templates/router.py.

export interface CalcTemplateSummary {
  id: string
  name: string
  slug: string
  category: string
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CalcTemplateDetail extends CalcTemplateSummary {
  // Univer's IWorkbookData snapshot — opaque to us, never typed/parsed here.
  workbook_data: Record<string, unknown>
  metadata: CalcTemplateMetadata
}

export interface CalcTemplateVersionSummary {
  id: string
  version: number
  saved_by: string | null
  saved_at: string
}

export interface CalcTemplateVersionDetail extends CalcTemplateVersionSummary {
  workbook_data: Record<string, unknown>
  metadata: CalcTemplateMetadata
}

// Result of converting an uploaded .xlsx — NOT a saved template. The builder
// loads this into its live Univer instance for review; nothing is persisted
// until the admin hits Save/Publish. See backend xlsx_import.py.
export interface CalcTemplateImportResult {
  workbook_data: Record<string, unknown>
  metadata: CalcTemplateMetadata
  stats: {
    sheets: number
    formulas: number
    styles: number
    suggested_fields: number
    fields_truncated: boolean
    // Features knowingly not carried over (charts, images, validation rules,
    // macros) — surfaced so an admin never publishes a silently lossy import.
    dropped: string[]
  }
}

export const calcTemplateApi = {
  // Back-compat: unwraps the paginated response and returns just the page of
  // items (used by pickers/dropdowns elsewhere that don't need a total count
  // — e.g. the active-template Select in SpreadsheetFieldEditorModal).
  list: (params?: Record<string, unknown>) =>
    apiGet<{ items: CalcTemplateSummary[]; total: number }>('/api/calc-templates', params).then(r => r.items),
  // Server-side pagination: returns { items, total } so the caller can size a Table's pagination.
  listPaged: (params?: Record<string, unknown>) =>
    apiGet<{ items: CalcTemplateSummary[]; total: number }>('/api/calc-templates', params),
  get: (id: string) =>
    apiGet<CalcTemplateDetail>(`/api/calc-templates/${id}`),
  create: (body: { name: string; slug: string; category: string; workbook_data: Record<string, unknown>; metadata: CalcTemplateMetadata; is_active?: boolean }) =>
    apiPost<CalcTemplateDetail>('/api/calc-templates', body),
  update: (id: string, body: { name?: string; workbook_data?: Record<string, unknown>; metadata?: CalcTemplateMetadata; is_active?: boolean }) =>
    apiPatch<CalcTemplateDetail>(`/api/calc-templates/${id}`, body),
  importXlsx: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiUpload<CalcTemplateImportResult>('/api/calc-templates/import-xlsx', fd)
  },
  versions: (id: string) =>
    apiGet<CalcTemplateVersionSummary[]>(`/api/calc-templates/${id}/versions`),
  // Full content of ONE pinned version — used by a SPREADSHEET field in the
  // CGT builder that references this template (mode: 'template') rather
  // than embedding its own copy of the sheet.
  getVersion: (id: string, version: number) =>
    apiGet<CalcTemplateVersionDetail>(`/api/calc-templates/${id}/versions/${version}`),
  // Fill Template submission — ONLY {field_key: value} for input fields, never
  // the whole workbook. Backend independently re-applies these onto the
  // stored snapshot and returns the recalculated output field values.
  submit: (id: string, values: Record<string, unknown>) =>
    apiPost<{ outputs: Record<string, unknown> }>(`/api/calc-templates/${id}/submit`, { values }),
}
