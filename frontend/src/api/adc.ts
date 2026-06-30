import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload, apiDownloadBlob } from './client'

// ── Workflow Templates ────────────────────────────────────────────────────────
export interface WorkflowTemplate {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  definition?: unknown
}

export interface WorkflowTemplateVersion {
  id: string
  version: number
  saved_by: string | null
  saved_at: string
  definition: unknown
}

export const workflowTemplateApi = {
  list:       (params?: Record<string, unknown>) => apiGet<WorkflowTemplate[]>('/api/workflow-templates', params),
  get:        (id: string) => apiGet<WorkflowTemplate>(`/api/workflow-templates/${id}`),
  create:     (body: unknown) => apiPost<WorkflowTemplate>('/api/workflow-templates', body),
  update:     (id: string, body: unknown) => apiPatch<WorkflowTemplate>(`/api/workflow-templates/${id}`, body),
  delete:     (id: string) => apiDelete<void>(`/api/workflow-templates/${id}`),
  versions:   (id: string) => apiGet<WorkflowTemplateVersion[]>(`/api/workflow-templates/${id}/versions`),
}

// ── Projects ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string
  code: string
  name: string
  product_name: string | null
  in_house_project_id: string | null
  project_type: string | null
  market: string | null
  department_id: string | null
  department_name: string | null
  manager_id: string | null
  created_by: string
  created_by_name: string | null
  start_date: string | null
  target_date: string | null
  status: string
  description: string | null
  objective: string | null
  observation: string | null
  remarks: string | null
  related_docs_comments: string | null
  related_docs_observations: string | null
  regulatory_observations: string | null
  scheme_data: string | null
  customer: string | null
  adc_code: string | null
  target_antigen: string | null
  antibody_clone: string | null
  payload: string | null
  linker: string | null
  target_dar: string | null
  project_stage: string | null
  qa_review_required: boolean | null
  oel_band: string | null
  containment_category: string | null
  gmp_non_gmp: string | null
  created_at: string
  updated_at: string
}

// ── Departments (for dropdowns) ───────────────────────────────────────────────
export interface Department {
  id: string
  code: string
  name: string
  is_active: boolean
}

export const departmentApi = {
  list: () => apiGet<Department[]>('/api/departments'),
}

export interface ProjectListResponse {
  total: number
  items: Project[]
}

export const projectApi = {
  list:          (params?: Record<string, unknown>) => apiGet<ProjectListResponse>('/api/projects', params),
  get:           (id: string) => apiGet<Project>(`/api/projects/${id}`),
  create:        (body: unknown) => apiPost<Project>('/api/projects', body),
  update:        (id: string, body: unknown) => apiPatch<Project>(`/api/projects/${id}`, body),
  archive:       (id: string) => apiDelete<void>(`/api/projects/${id}`),
  routes:        (id: string) => apiGet<unknown[]>(`/api/projects/${id}/routes`),
  listMembers:   (id: string) => apiGet<ProjectMember[]>(`/api/projects/${id}/members`),
  addMember:     (id: string, body: { user_id: string; role?: string }) =>
                   apiPost<{ ok: boolean }>(`/api/projects/${id}/members`, body),
  removeMember:  (id: string, userId: string) =>
                   apiDelete<{ ok: boolean }>(`/api/projects/${id}/members/${userId}`),
}

// ── Users (for member picker) ─────────────────────────────────────────────────
export interface UserSummary {
  id: string
  username: string
  emp_no: string
  role_name?: string
}

export const userApi = {
  list: (params?: { search?: string; limit?: number }) =>
    apiGet<{ items: UserSummary[]; total: number }>('/api/users/lookup', params),
}

// ── Notebooks ─────────────────────────────────────────────────────────────────
export interface Notebook {
  id: string
  code: string
  title: string
  description: string | null
  project_id: string
  project_code: string | null
  project_name: string | null
  route_id: string | null
  stage_id: string | null
  type: string | null
  parent_notebook_id: string | null
  linked_notebook_id: string | null
  template_id: string | null
  template_name: string | null
  template_version: number | null
  preliminary_complete: boolean
  created_by: string
  created_by_name: string | null
  status: string
  created_at: string
  updated_at: string
  template_snapshot?: unknown
}

export interface NotebookListResponse {
  total: number
  items: Notebook[]
}

export interface NotebookAssignedUser {
  user_id: string
  username: string | null
  emp_no: string | null
  granted_at: string
}

// ── Project members ────────────────────────────────────────────────────────────
export interface ProjectMember {
  user_id: string
  username: string | null
  role: string | null
  added_at: string
}

export const notebookApi = {
  listAll: (params?: { search?: string; status?: string; project_id?: string; assigned_to_me?: boolean; page?: number; limit?: number }) =>
    apiGet<NotebookListResponse>('/api/notebooks', params as Record<string, unknown>),
  listForProject: (projectId: string, params?: Record<string, unknown>) =>
    apiGet<Notebook[]>(`/api/projects/${projectId}/notebooks`, params),
  create: (projectId: string, body: unknown) =>
    apiPost<Notebook>(`/api/projects/${projectId}/notebooks`, body),
  get:    (id: string) => apiGet<Notebook>(`/api/notebooks/${id}`),
  update: (id: string, body: unknown) => apiPatch<Notebook>(`/api/notebooks/${id}`, body),
  snapshot: (id: string) => apiGet<{ template_snapshot: unknown; template_id: string | null }>(`/api/notebooks/${id}/template-snapshot`),
  getAssignedUsers: (id: string) => apiGet<NotebookAssignedUser[]>(`/api/notebooks/${id}/assigned-users`),
  assignUser:   (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/notebooks/${id}/assign-user`, { user_id: userId }),
  unassignUser: (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/notebooks/${id}/unassign/${userId}`),
}

// ── Experiments ────────────────────────────────────────────────────────────────
export interface Experiment {
  id: string
  notebook_id: string
  project_id: string
  base_code: string
  version: number
  full_code: string
  title: string
  section_key: string
  screen_key: string | null
  status: string
  disposition: string | null
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

export interface ExperimentFile {
  id: string
  filename: string
  file_size: number
  file_type: string
  section_key: string
  uploaded_by: string
  uploaded_at: string
}

export interface ExperimentHistory {
  action: string
  actor_id: string
  details: Record<string, unknown>
  created_at: string
}

export interface ExperimentListItem extends Experiment {
  notebook_code: string
  notebook_title: string
  project_code: string
  project_name: string
  created_by_name: string | null
}

export const experimentApi = {
  listAll: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    apiGet<{ total: number; items: ExperimentListItem[] }>('/api/experiments', params as Record<string, unknown>),
  listForNotebook: (notebookId: string, sectionKey?: string) =>
    apiGet<Experiment[]>(`/api/notebooks/${notebookId}/experiments`, sectionKey ? { section_key: sectionKey } : undefined),
  createForNotebook: (notebookId: string, body: { title: string; section_key?: string }) =>
    apiPost<Experiment>(`/api/notebooks/${notebookId}/experiments`, body),
  get:     (id: string) => apiGet<Experiment>(`/api/experiments/${id}`),
  update:  (id: string, body: { data?: Record<string, unknown>; observations?: string; conclusion?: string; disposition?: string }) =>
    apiPatch<Experiment>(`/api/experiments/${id}`, body),
  submit:  (id: string, body?: { sign_reason?: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/submit`, body ?? {}),
  approve: (id: string, body?: { sign_reason?: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/approve`, body ?? {}),
  reject:  (id: string, body: { reason: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/reject`, body),
  unlock:  (id: string) =>
    apiPost<Experiment>(`/api/experiments/${id}/unlock`, {}),
  listFiles: (id: string) => apiGet<ExperimentFile[]>(`/api/experiments/${id}/files`),
  history:   (id: string) => apiGet<ExperimentHistory[]>(`/api/experiments/${id}/history`),
  downloadReport: (id: string) => apiDownloadBlob(`/api/experiments/${id}/report/docx`),
}

// ── Project Attachments ────────────────────────────────────────────────────────
export interface ProjectAttachment {
  id: string
  filename: string
  file_size: number | null
  file_type: string | null
  comments: string | null
  uploaded_by: string
  uploaded_at: string
}

export const attachmentApi = {
  list:   (projectId: string) =>
    apiGet<ProjectAttachment[]>(`/api/projects/${projectId}/attachments`),
  upload: (projectId: string, file: File, comments?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (comments) fd.append('comments', comments)
    return apiUpload<ProjectAttachment>(`/api/projects/${projectId}/attachments`, fd)
  },
  delete: (projectId: string, attachId: string) =>
    apiDelete<{ ok: boolean }>(`/api/projects/${projectId}/attachments/${attachId}`),
}

// ── Risk Assessment ────────────────────────────────────────────────────────────
export interface RiskRow {
  id: string
  sort_order: number
  process_step: string | null
  failure_mode: string | null
  severity: number | null
  occurrence: number | null
  detection: number | null
  rpn: number
  mitigation: string | null
  created_at: string
}

export interface RiskAssessment {
  exists: boolean
  id?: string
  assessment_id?: string | null
  assessment_type?: string | null
  last_reviewed?: string | null
  reviewed_by?: string | null
  overall_risk_level?: string | null
  status?: string | null
  additional_notes?: string | null
  observations?: string | null
  rows?: RiskRow[]
  created_at?: string
  updated_at?: string
}

export const riskAssessmentApi = {
  get:       (projectId: string) =>
    apiGet<RiskAssessment>(`/api/projects/${projectId}/risk-assessment`),
  upsert:    (projectId: string, body: Partial<RiskAssessment>) =>
    apiPut<RiskAssessment>(`/api/projects/${projectId}/risk-assessment`, body),
  addRow:    (projectId: string, row: Omit<RiskRow, 'id' | 'rpn' | 'created_at'>) =>
    apiPost<RiskRow>(`/api/projects/${projectId}/risk-assessment/rows`, row),
  updateRow: (projectId: string, rowId: string, row: Partial<RiskRow>) =>
    apiPatch<RiskRow>(`/api/projects/${projectId}/risk-assessment/rows/${rowId}`, row),
  deleteRow: (projectId: string, rowId: string) =>
    apiDelete<{ ok: boolean }>(`/api/projects/${projectId}/risk-assessment/rows/${rowId}`),
}

// ── Inventory Materials (for ADC material selects) ────────────────────────────
export interface Material {
  id: number
  name: string
  code: string
  material_type: string | null
}

export const materialApi = {
  list: (params?: { search?: string; material_type?: string; limit?: number }) =>
    apiGet<Material[]>('/api/inventory/materials', { active_only: true, limit: 100, ...params }),
}
