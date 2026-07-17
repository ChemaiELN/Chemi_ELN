import { apiGet, apiPost, apiPatch, apiDelete, apiDownloadBlob } from './client'

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

// Maps CgtProject.process -> the workflow_template category offered when
// creating a notebook under that project. Mirrors backend
// app/modules/cgt/process_map.py — keep the two in sync.
export const PROCESS_TO_TEMPLATE_CATEGORY: Record<string, string> = {
  'Molecular Biology': 'CGT_MOLBIO',
  'Plasmid': 'CGT_PLASMID',
  'AAV': 'CGT_AAV',
}

// ── CGT Notebooks ────────────────────────────────────────────────────────────
export interface CgtNotebook {
  id: string
  code: string
  title: string
  description: string | null
  cgt_project_id: string
  project_code: string | null
  project_name: string | null
  template_id: string | null
  template_name: string | null
  template_version: number | null
  created_by: string
  created_by_name: string | null
  status: string
  created_at: string
  updated_at: string
  template_snapshot?: unknown
}

export interface CgtNotebookListResponse {
  total: number
  items: CgtNotebook[]
}

export interface CgtNotebookAssignedUser {
  user_id: string
  username: string | null
  emp_no: string | null
  granted_at: string
}

export const cgtNotebookApi = {
  listAll:        (params?: { search?: string; status?: string; project_id?: string; assigned_to_me?: boolean; page?: number; limit?: number }) =>
    apiGet<CgtNotebookListResponse>('/api/cgt-notebooks', params as Record<string, unknown>),
  listForProject: (projectId: string, params?: Record<string, unknown>) =>
    apiGet<CgtNotebook[]>(`/api/cgt-projects/${projectId}/notebooks`, params),
  create:   (projectId: string, body: unknown) => apiPost<CgtNotebook>(`/api/cgt-projects/${projectId}/notebooks`, body),
  get:      (id: string) => apiGet<CgtNotebook>(`/api/cgt-notebooks/${id}`),
  update:   (id: string, body: unknown) => apiPatch<CgtNotebook>(`/api/cgt-notebooks/${id}`, body),
  snapshot: (id: string) => apiGet<{ template_snapshot: unknown; template_id: string | null }>(`/api/cgt-notebooks/${id}/template-snapshot`),
  getAssignedUsers: (id: string) => apiGet<CgtNotebookAssignedUser[]>(`/api/cgt-notebooks/${id}/assigned-users`),
  assignUser:       (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/cgt-notebooks/${id}/assign-user`, { user_id: userId }),
  unassignUser:     (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/cgt-notebooks/${id}/unassign/${userId}`),
}

// ── CGT Experiments ───────────────────────────────────────────────────────────
export interface CgtExperiment {
  id: string
  cgt_notebook_id: string
  cgt_project_id: string
  base_code: string
  version: number
  full_code: string
  title: string
  section_key: string | null
  screen_key: string | null
  status: string
  observations: string | null
  conclusion: string | null
  is_latest_version: boolean
  created_by: string
  submitted_by: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  scientist_signed_by: string | null
  scientist_signed_at: string | null
  scientist_sign_reason: string | null
  created_at: string
  updated_at: string
  data?: Record<string, Record<string, unknown>>
}

export interface CgtExperimentListItem extends CgtExperiment {
  notebook_code: string | null
  notebook_title: string | null
  project_code: string | null
  project_name: string | null
  created_by_name: string | null
}

export interface CgtExperimentListResponse {
  total: number
  items: CgtExperimentListItem[]
}

export const cgtExperimentApi = {
  listAll: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    apiGet<CgtExperimentListResponse>('/api/cgt-experiments', params as Record<string, unknown>),
  listForNotebook: (notebookId: string, sectionKey?: string) =>
    apiGet<CgtExperiment[]>(`/api/cgt-notebooks/${notebookId}/experiments`, sectionKey ? { section_key: sectionKey } : undefined),
  createForNotebook: (notebookId: string, body: { title?: string; section_key?: string }) =>
    apiPost<CgtExperiment>(`/api/cgt-notebooks/${notebookId}/experiments`, body),
  get:    (id: string) => apiGet<CgtExperiment>(`/api/cgt-experiments/${id}`),
  update: (id: string, body: { data?: Record<string, unknown>; observations?: string; conclusion?: string }) =>
    apiPatch<CgtExperiment>(`/api/cgt-experiments/${id}`, body),
  submit:  (id: string, body: { password: string; sign_reason?: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/submit`, body),
  approve: (id: string, body: { password: string; sign_reason?: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/approve`, body),
  reject:  (id: string, body: { reason: string; password: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/reject`, body),
  unlock:  (id: string) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/unlock`),
  downloadReport: (id: string) => apiDownloadBlob(`/api/cgt-experiments/${id}/report/docx`),
}
