import { apiGet, apiPost, apiPatch, apiDelete } from './client'

// ── CGT Projects ────────────────────────────────────────────────────────────
// Mirrors the ADC `Project` shape (frontend/src/api/adc.ts) minus department_id
// / department_name, plus a free-text "process" field.
export interface CgtProject {
  id: string
  code: string
  name: string
  product_name: string | null
  in_house_project_id: string | null
  project_type: string | null
  market: string | null
  process: string | null
  created_by: string
  created_by_name: string | null
  start_date: string | null
  target_date: string | null
  status: string
  description: string | null
  objective?: string | null
  created_at: string
  updated_at: string
}

export interface CgtProjectListResponse {
  total: number
  items: CgtProject[]
}

export const cgtProjectApi = {
  nextCode: () => apiGet<{ code: string }>('/api/cgt-projects/next-code'),
  list:     (params?: Record<string, unknown>) => apiGet<CgtProjectListResponse>('/api/cgt-projects', params),
  get:      (id: string) => apiGet<CgtProject>(`/api/cgt-projects/${id}`),
  create:   (body: unknown) => apiPost<CgtProject>('/api/cgt-projects', body),
  update:   (id: string, body: unknown) => apiPatch<CgtProject>(`/api/cgt-projects/${id}`, body),
  archive:  (id: string) => apiDelete<void>(`/api/cgt-projects/${id}`),
}
