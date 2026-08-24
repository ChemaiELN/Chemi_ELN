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
  // Independent of is_active/Publish: whether this template is offered as an
  // option in the "Create Notebook" modal's Workflow Template picker.
  show_in_notebook_dropdown: boolean
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
  // Present only on responses that requested it (e.g. the HOD dashboard's
  // project list) — a count badge in place of loading every child notebook.
  notebook_count?: number
}

// ── Departments (for dropdowns) ───────────────────────────────────────────────
export interface Department {
  id: string
  name: string
}

export const departmentApi = {
  // Unprivileged {id, name} lookup — any authenticated user can call this,
  // unlike the admin-only GET /api/departments (which requires departments.manage
  // and would 403 for HOD/TL users outside the QA/QC department).
  list: () => apiGet<Department[]>('/api/departments/lookup'),
}

export interface ProjectListResponse {
  total: number
  items: Project[]
}

export interface HodDashboardStats {
  total: number; with_notebooks: number; without_notebooks: number; completed: number
}

export const projectApi = {
  nextCode:      () => apiGet<{ code: string }>('/api/projects/next-code'),
  hodStats:      () => apiGet<HodDashboardStats>('/api/projects/hod-stats'),
  list:          (params?: Record<string, unknown>) => apiGet<ProjectListResponse>('/api/projects', params),
  get:           (id: string) => apiGet<Project>(`/api/projects/${id}`),
  create:        (body: unknown) => apiPost<Project>('/api/projects', body),
  update:        (id: string, body: unknown) => apiPatch<Project>(`/api/projects/${id}`, body),
  close:         (id: string, body: { password: string }) => apiPost<Project>(`/api/projects/${id}/close`, body),
  reopen:        (id: string, body: { password: string }) => apiPost<Project>(`/api/projects/${id}/reopen`, body),
  deactivate:    (id: string, body: { password: string }) => apiPost<Project>(`/api/projects/${id}/deactivate`, body),
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
  role_code?: string
  department_code?: string
  dept_code?: string
}

export const userApi = {
  list: (params?: { search?: string; role_code?: string; dept_code?: string; limit?: number }) =>
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
  // Present only on responses that requested it (e.g. the TL dashboard's
  // notebook list) — a count badge in place of loading every child experiment.
  experiment_count?: number
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

export interface TlDashboardStats {
  total: number; with_experiments: number; without_experiments: number; total_experiments: number
}

export interface TlExperimentSummaryRow {
  user_id: string
  username: string | null
  count: number
  experiments: { id: string; code: string; title: string; status: string; created_at: string }[]
}

// ── Project members ────────────────────────────────────────────────────────────
export interface ProjectMember {
  user_id: string
  username: string | null
  role: string | null
  added_at: string
}

export const notebookApi = {
  listAll: (params?: Record<string, unknown>) =>
    apiGet<NotebookListResponse>('/api/notebooks', params),
  listForProject: (projectId: string, params?: Record<string, unknown>) =>
    apiGet<{ items: Notebook[]; total: number }>(`/api/projects/${projectId}/notebooks`, params),
  create: (projectId: string, body: unknown) =>
    apiPost<Notebook>(`/api/projects/${projectId}/notebooks`, body),
  get:    (id: string) => apiGet<Notebook>(`/api/notebooks/${id}`),
  update: (id: string, body: unknown) => apiPatch<Notebook>(`/api/notebooks/${id}`, body),
  snapshot: (id: string) => apiGet<{ template_snapshot: unknown; template_id: string | null }>(`/api/notebooks/${id}/template-snapshot`),
  getAssignedUsers: (id: string) => apiGet<NotebookAssignedUser[]>(`/api/notebooks/${id}/assigned-users`),
  assignUser:   (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/notebooks/${id}/assign-user`, { user_id: userId }),
  unassignUser: (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/notebooks/${id}/unassign/${userId}`),
  tlStats:  () => apiGet<TlDashboardStats>('/api/notebooks/tl-stats'),
  tlExperimentSummary: (params?: Record<string, unknown>) =>
    apiGet<TlExperimentSummaryRow[]>('/api/notebooks/tl-experiment-summary', params),
  close:      (id: string, body: { password: string }) => apiPost<Notebook>(`/api/notebooks/${id}/close`, body),
  reopen:     (id: string, body: { password: string }) => apiPost<Notebook>(`/api/notebooks/${id}/reopen`, body),
  deactivate: (id: string, body: { password: string }) => apiPost<Notebook>(`/api/notebooks/${id}/deactivate`, body),
}

// ── Experiments ────────────────────────────────────────────────────────────────
export interface SectionSignatureEntry {
  user_id: string
  name: string
  at: string
}
export interface SectionSignature {
  doneBy?: SectionSignatureEntry
  checkedBy?: SectionSignatureEntry
}

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
  frozen_at: string | null
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

export interface ChemDashboardStats {
  total: number; completed: number; pending: number
}

export const experimentApi = {
  listAll: (params?: Record<string, unknown>) =>
    apiGet<{ total: number; items: ExperimentListItem[] }>('/api/experiments', params),
  myStats: () => apiGet<ChemDashboardStats>('/api/experiments/my-stats'),
  listForNotebook: (notebookId: string, sectionKey?: string) =>
    apiGet<Experiment[]>(`/api/notebooks/${notebookId}/experiments`, sectionKey ? { section_key: sectionKey } : undefined),
  createForNotebook: (notebookId: string, body: { title: string; section_key?: string }) =>
    apiPost<Experiment>(`/api/notebooks/${notebookId}/experiments`, body),
  get:     (id: string) => apiGet<Experiment>(`/api/experiments/${id}`),
  update:  (id: string, body: { title?: string; data?: Record<string, unknown>; observations?: string; conclusion?: string; disposition?: string }) =>
    apiPatch<Experiment>(`/api/experiments/${id}`, body),
  getAssignedUsers: (id: string) => apiGet<NotebookAssignedUser[]>(`/api/experiments/${id}/assigned-users`),
  assignUser:   (id: string, userId: string) => apiPost<{ ok: boolean }>(`/api/experiments/${id}/assign-user`, { user_id: userId }),
  unassignUser: (id: string, userId: string) => apiDelete<{ ok: boolean }>(`/api/experiments/${id}/unassign/${userId}`),
  submitToAd: (id: string, body: { screen_key: string; field_key: string; sku_pack_id: string; sample_qty: number | string; sample_unit?: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/submit-to-ad`, body),
  submit:  (id: string, body?: { sign_reason?: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/submit`, body ?? {}),
  approve: (id: string, body?: { sign_reason?: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/approve`, body ?? {}),
  reject:  (id: string, body: { reason: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/reject`, body),
  unlock:  (id: string) =>
    apiPost<Experiment>(`/api/experiments/${id}/unlock`, {}),
  signSection: (id: string, sectionId: string, body: { stage: 'done' | 'checked'; password: string }) =>
    apiPost<Experiment>(`/api/experiments/${id}/sections/${sectionId}/signature`, body),
  listFiles: (id: string) => apiGet<ExperimentFile[]>(`/api/experiments/${id}/files`),
  uploadFile: (id: string, file: File, sectionKey?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    const qs = sectionKey ? `?section_key=${encodeURIComponent(sectionKey)}` : ''
    return apiUpload<{ id: string; filename: string; file_size: number }>(`/api/experiments/${id}/files${qs}`, fd)
  },
  deleteFile: (id: string, fileId: string) => apiDelete<{ ok: boolean }>(`/api/experiments/${id}/files/${fileId}`),
  history:   (id: string) => apiGet<ExperimentHistory[]>(`/api/experiments/${id}/history`),
  downloadReport: (id: string) => apiDownloadBlob(`/api/experiments/${id}/report/docx`),
  raiseAtr: (id: string, body: { section_id: string; section_title: string; data_snapshot?: unknown }) =>
    apiPost<ExperimentAtr>(`/api/experiments/${id}/atr`, body),
  listAtrForExperiment: (id: string) => apiGet<ExperimentAtr[]>(`/api/experiments/${id}/atr`),
}

// ── ATR (Analytical Test Request) ───────────────────────────────────────────
// Raised by a chemist against one section of their CGT/ADC experiment (e.g.
// 1.1 Antibody Info's "Lock Fields Above"). No ARD-side consumption is wired
// up yet — this is purely the "raise" half; `atrApi.listMine` backs the
// chemist's own "ATR" sidebar list.
export interface ExperimentAtr {
  id: string
  experiment_id: string
  atr_no: string
  section_id: string
  section_title: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  raised_by: string
  raised_by_name: string | null
  raised_at: string
  completed_by: string | null
  completed_at: string | null
  result_notes: string | null
  // Present only on listMine (joined in for display, not stored on the row)
  experiment_code?: string
  experiment_title?: string
  project_code?: string
  notebook_id?: string
}

export const atrApi = {
  listMine: (params?: Record<string, unknown>) =>
    apiGet<{ items: ExperimentAtr[]; total: number }>('/api/atr', params),
  get: (id: string) => apiGet<ExperimentAtr>(`/api/atr/${id}`),
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
  // GET /api/inventory/materials returns { items, total } (server-side pagination) — unwrap to the array this module's callers expect.
  list: (params?: { search?: string; material_type?: string; limit?: number }) =>
    apiGet<{ items: Material[]; total: number }>('/api/inventory/materials', { active_only: true, limit: 100, ...params })
      .then(r => r.items),
}
