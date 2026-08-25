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
  manager_id: string | null
  manager_name: string | null
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

export interface CgtProjectNotebookRef {
  id: string
  code: string
  title: string
}

export interface CgtProjectWithNotebooks extends CgtProject {
  notebooks: CgtProjectNotebookRef[]
}

export interface CgtHodDashboardResponse {
  stats: { total: number; with_notebooks: number; without_notebooks: number; completed: number }
  recent_projects: CgtProjectWithNotebooks[]
  with_notebooks: CgtProjectWithNotebooks[]
  without_notebooks: CgtProjectWithNotebooks[]
}

export interface CgtHodDashboardStats {
  total: number
  with_notebooks: number
  without_notebooks: number
  completed: number
}

export interface CgtProjectWithNotebooksListResponse {
  total: number
  items: CgtProjectWithNotebooks[]
}

export const cgtProjectApi = {
  nextCode:     () => apiGet<{ code: string }>('/api/cgt-projects/next-code'),
  hodDashboard: () => apiGet<CgtHodDashboardResponse>('/api/cgt-projects/hod-dashboard'),
  hodDashboardStats: () => apiGet<CgtHodDashboardStats>('/api/cgt-projects/hod-dashboard-stats'),
  list:     (params?: Record<string, unknown>) => apiGet<CgtProjectWithNotebooksListResponse>('/api/cgt-projects', params),
  get:      (id: string) => apiGet<CgtProject>(`/api/cgt-projects/${id}`),
  create:   (body: unknown) => apiPost<CgtProject>('/api/cgt-projects', body),
  update:   (id: string, body: unknown) => apiPatch<CgtProject>(`/api/cgt-projects/${id}`, body),
  close:      (id: string, body: { password: string }) => apiPost<CgtProject>(`/api/cgt-projects/${id}/close`, body),
  reopen:     (id: string, body: { password: string }) => apiPost<CgtProject>(`/api/cgt-projects/${id}/reopen`, body),
  deactivate: (id: string, body: { password: string }) => apiPost<CgtProject>(`/api/cgt-projects/${id}/deactivate`, body),
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

export interface CgtNotebookExperimentRef {
  id: string
  full_code: string
  title: string
  status: string
  created_at: string
}

export interface CgtNotebookWithExperiments extends CgtNotebook {
  experiments: CgtNotebookExperimentRef[]
}

export interface CgtTlDashboardResponse {
  stats: { total: number; with_experiments: number; without_experiments: number; total_experiments: number }
  with_experiments: CgtNotebookWithExperiments[]
  without_experiments: CgtNotebookWithExperiments[]
}

export interface CgtTlDashboardStats {
  total: number
  with_experiments: number
  without_experiments: number
  total_experiments: number
}

export interface CgtNotebookWithExperimentsListResponse {
  total: number
  items: CgtNotebookWithExperiments[]
}

export const cgtNotebookApi = {
  listAll:        (params?: { search?: string; status?: string; project_id?: string; assigned_to_me?: boolean; page?: number; limit?: number; sortBy?: string; sortDir?: 'asc' | 'desc'; has_experiment?: boolean }) =>
    apiGet<CgtNotebookWithExperimentsListResponse>('/api/cgt-notebooks', params as Record<string, unknown>),
  tlDashboardStats: () => apiGet<CgtTlDashboardStats>('/api/cgt-notebooks/tl-dashboard-stats'),
  listForProject: (projectId: string, params?: Record<string, unknown>) =>
    apiGet<CgtNotebook[]>(`/api/cgt-projects/${projectId}/notebooks`, params),
  create:   (projectId: string, body: unknown) => apiPost<CgtNotebook>(`/api/cgt-projects/${projectId}/notebooks`, body),
  get:      (id: string) => apiGet<CgtNotebook>(`/api/cgt-notebooks/${id}`),
  update:   (id: string, body: unknown) => apiPatch<CgtNotebook>(`/api/cgt-notebooks/${id}`, body),
  snapshot: (id: string) => apiGet<{ template_snapshot: unknown; template_id: string | null }>(`/api/cgt-notebooks/${id}/template-snapshot`),
  getAssignedUsers: (id: string) => apiGet<CgtNotebookAssignedUser[]>(`/api/cgt-notebooks/${id}/assigned-users`),
  assignUser:       (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/cgt-notebooks/${id}/assign-user`, { user_id: userId }),
  unassignUser:     (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/cgt-notebooks/${id}/unassign/${userId}`),
  tlDashboard:      () => apiGet<CgtTlDashboardResponse>('/api/cgt-notebooks/tl-dashboard'),
  close:      (id: string, body: { password: string }) => apiPost<CgtNotebook>(`/api/cgt-notebooks/${id}/close`, body),
  reopen:     (id: string, body: { password: string }) => apiPost<CgtNotebook>(`/api/cgt-notebooks/${id}/reopen`, body),
  deactivate: (id: string, body: { password: string }) => apiPost<CgtNotebook>(`/api/cgt-notebooks/${id}/deactivate`, body),
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
  frozen_at: string | null
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

export interface CgtChemDashboardResponse {
  stats: { total: number; completed: number; pending: number }
  items: CgtExperimentListItem[]
}

export const cgtExperimentApi = {
  listAll: (params?: { search?: string; status?: string; page?: number; limit?: number; sortBy?: string; sortDir?: 'asc' | 'desc' }) =>
    apiGet<CgtExperimentListResponse>('/api/cgt-experiments', params as Record<string, unknown>),
  myDashboard: () => apiGet<CgtChemDashboardResponse>('/api/cgt-experiments/my-dashboard'),
  listForNotebook: (notebookId: string, sectionKey?: string) =>
    apiGet<CgtExperiment[]>(`/api/cgt-notebooks/${notebookId}/experiments`, sectionKey ? { section_key: sectionKey } : undefined),
  createForNotebook: (notebookId: string, body: { title?: string; section_key?: string }) =>
    apiPost<CgtExperiment>(`/api/cgt-notebooks/${notebookId}/experiments`, body),
  get:    (id: string) => apiGet<CgtExperiment>(`/api/cgt-experiments/${id}`),
  update: (id: string, body: { title?: string; data?: Record<string, unknown>; observations?: string; conclusion?: string }) =>
    apiPatch<CgtExperiment>(`/api/cgt-experiments/${id}`, body),
  raiseAtr: (id: string, body: { section_id: string; section_title: string; data_snapshot?: unknown }) =>
    apiPost<{ id: string; formNo: string; status: string; originModule: 'CGT' }>(`/api/cgt-experiments/${id}/atr`, body),
  getAssignedUsers: (id: string) => apiGet<CgtNotebookAssignedUser[]>(`/api/cgt-experiments/${id}/assigned-users`),
  assignUser:       (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/cgt-experiments/${id}/assign-user`, { user_id: userId }),
  unassignUser:     (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/cgt-experiments/${id}/unassign/${userId}`),
  submit:  (id: string, body: { password: string; sign_reason?: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/submit`, body),
  approve: (id: string, body: { password: string; sign_reason?: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/approve`, body),
  reject:  (id: string, body: { reason: string; password: string }) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/reject`, body),
  unlock:  (id: string) => apiPost<CgtExperiment>(`/api/cgt-experiments/${id}/unlock`),
  downloadReport: (id: string) => apiDownloadBlob(`/api/cgt-experiments/${id}/report/docx`),
}
