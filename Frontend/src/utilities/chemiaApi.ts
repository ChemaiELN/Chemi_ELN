/**
 * Chemia ELN API service layer — typed wrappers matching the v2 backend.
 * Backend: FastAPI on port 8002, DB: chemia_eln (PostgreSQL)
 * All list endpoints return PaginatedResponse<T>.
 * All IDs are UUID strings.
 *
 * v2.0.0 additions:
 *  - Dashboard endpoints (counts, queues, SLA alerts, activity)
 *  - Search endpoints (experiments, by-parameters, ATRs, notebooks, projects)
 *  - Master Data (chemicals, instruments, sites)
 *  - Role Privileges CRUD
 *  - Experiment Steps & Equipment CRUD
 *  - ATR Final Reports upload
 *  - PDF Export
 *  - Updated Experiment, ATR, User models (new v2 fields)
 */
import client from './chemiaClient'

// ─── Common ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ─── Auth ─────────────────────────────────────────────────────

export interface MeResponse {
  id: string
  emp_no: string
  username: string
  title: string | null
  first_name: string
  last_name: string
  /** v2: middle initials (optional) */
  middle_initials: string | null
  display_name: string
  email: string
  designation: string | null
  department_id: string | null
  department_name: string | null
  role: string            // QA | TL | CHEM | HOD
  is_active: boolean
  /** v2: contact phone number */
  contact_no: string | null
  /** v2: site code/name this user belongs to */
  site: string | null
  /** v2: optional dashboard reference URL/code */
  dashboard_reference: string | null
  /** v2: whether this user may edit CRD/Global settings */
  allow_settings_update: boolean
  /** v2: force password reset on next login */
  must_reset_password: boolean
  /** Resolved privilege keys from backend (role + DB overrides) */
  privileges?: string[]
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post('/api/auth/login', { username, password })
  return data as TokenResponse
}

export async function getMe(): Promise<MeResponse> {
  const { data } = await client.get('/api/auth/me')
  return data as MeResponse
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await client.post('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('refresh_token') ?? ''
  try {
    await client.post('/api/auth/logout', { refresh_token: refreshToken })
  } finally {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('chemia_user')
  }
}

export async function forgotPassword(email: string): Promise<void> {
  await client.post('/api/auth/forgot-password', { email })
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await client.post('/api/auth/reset-password', { token, new_password: newPassword })
}

// ─── Departments ──────────────────────────────────────────────

export interface Department {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export async function getDepartments(params?: { search?: string; is_active?: boolean }): Promise<Department[]> {
  const { data } = await client.get('/api/departments', { params })
  return (data as PaginatedResponse<Department>).items
}

export async function getDepartment(id: string): Promise<Department> {
  const { data } = await client.get(`/api/departments/${id}`)
  return data as Department
}

export async function createDepartment(body: { code: string; name: string; description?: string }): Promise<Department> {
  const { data } = await client.post('/api/departments', body)
  return data as Department
}

export async function updateDepartment(id: string, body: { name?: string; description?: string; is_active?: boolean }): Promise<Department> {
  const { data } = await client.patch(`/api/departments/${id}`, body)
  return data as Department
}

// ─── Audit Log ────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  user_id: string | null
  username: string
  module: string
  action: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  detail: string | null
  ip_address: string | null
  created_at: string
}

export async function getAuditLog(params?: {
  module?: string
  action?: string
  username?: string
  target_type?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await client.get('/api/admin/audit-logs', { params })
  return data as PaginatedResponse<AuditLogEntry>
}

// ─── Roles ────────────────────────────────────────────────────

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
}

/** v2: lightweight role shape returned by GET /api/roles/ */
export interface RoleShort {
  id: string
  code: string
  name: string
}

export async function getRoles(): Promise<RoleShort[]> {
  const { data } = await client.get('/api/roles')
  if (Array.isArray(data)) return data as RoleShort[]
  return (data as PaginatedResponse<RoleShort>).items ?? []
}

// ─── Role Privileges (v2 new) ─────────────────────────────────

export interface RolePrivilege {
  id: string
  role_id: string
  role: RoleShort | null
  department_id: string | null
  department: { id: string; code: string; name: string } | null
  privilege_key: string
  is_granted: boolean
  updated_by: string | null
  updated_at: string
}

export interface RolePrivilegeCreate {
  role_id: string
  department_id?: string | null
  privilege_key: string
  is_granted: boolean
}

export interface RolePrivilegeUpdate {
  is_granted: boolean
}

export async function getRolePrivileges(params?: {
  role_id?: string
  department_id?: string
  privilege_key?: string
}): Promise<RolePrivilege[]> {
  const { data } = await client.get('/api/role-privileges/', { params })
  return data as RolePrivilege[]
}

export async function getRolePrivilege(id: string): Promise<RolePrivilege> {
  const { data } = await client.get(`/api/role-privileges/${id}`)
  return data as RolePrivilege
}

export async function createRolePrivilege(body: RolePrivilegeCreate): Promise<RolePrivilege> {
  const { data } = await client.post('/api/role-privileges/', body)
  return data as RolePrivilege
}

export async function updateRolePrivilege(id: string, body: RolePrivilegeUpdate): Promise<RolePrivilege> {
  const { data } = await client.patch(`/api/role-privileges/${id}`, body)
  return data as RolePrivilege
}

export async function deleteRolePrivilege(id: string): Promise<void> {
  await client.delete(`/api/role-privileges/${id}`)
}

// ─── Users ────────────────────────────────────────────────────

export interface DepartmentShort {
  id: string
  code: string
  name: string
}

export interface User {
  id: string
  username: string
  emp_no: string
  title: string | null
  first_name: string
  /** v2: middle initials */
  middle_initials: string | null
  last_name: string
  display_name: string
  email: string
  designation: string | null
  role: string              // QA | TL | CHEM | HOD
  department_id: string | null
  department: DepartmentShort | null
  is_active: boolean
  /** v2: contact phone number */
  contact_no: string | null
  /** v2: site assignment */
  site: string | null
  /** v2: dashboard reference URL/code */
  dashboard_reference: string | null
  /** v2: can this user edit settings */
  allow_settings_update: boolean
  /** v2: force password reset on next login */
  must_reset_password: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface UserCreate {
  username: string
  emp_no: string
  title?: string
  first_name: string
  /** v2 */
  middle_initials?: string
  last_name: string
  email: string
  password: string
  role: string
  designation?: string
  department_id?: string
  /** v2 */
  contact_no?: string
  /** v2 */
  site?: string
  /** v2 */
  dashboard_reference?: string
  /** v2 */
  allow_settings_update?: boolean
  /** v2 */
  must_reset_password?: boolean
}

export interface UserUpdate {
  title?: string
  first_name?: string
  /** v2 */
  middle_initials?: string
  last_name?: string
  email?: string
  designation?: string
  department_id?: string
  role?: string
  is_active?: boolean
  /** v2 */
  contact_no?: string
  /** v2 */
  site?: string
  /** v2 */
  dashboard_reference?: string
  /** v2 */
  allow_settings_update?: boolean
  /** v2 */
  must_reset_password?: boolean
}

export async function getUsers(params?: {
  search?: string
  department_id?: string
  role_code?: string
  is_active?: boolean
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<User>> {
  const { data } = await client.get('/api/users', { params })
  return data as PaginatedResponse<User>
}

export async function getUser(userId: string): Promise<User> {
  const { data } = await client.get(`/api/users/${userId}`)
  return data as User
}

export async function createUser(body: UserCreate): Promise<User> {
  const { data } = await client.post('/api/users', body)
  return data as User
}

export async function updateUser(userId: string, body: UserUpdate): Promise<User> {
  const { data } = await client.patch(`/api/users/${userId}`, body)
  return data as User
}

export async function activateUser(userId: string): Promise<{ message: string }> {
  const { data } = await client.post(`/api/users/${userId}/activate`)
  return data as { message: string }
}

export async function deactivateUser(userId: string, password?: string): Promise<{ message: string }> {
  const { data } = await client.post(`/api/users/${userId}/deactivate`, password ? { password } : undefined)
  return data as { message: string }
}

// ─── Projects ─────────────────────────────────────────────────

export interface UserShort {
  id: string
  emp_no: string
  display_name: string
  role?: string | null
}

export interface DeptShort {
  id: string
  code: string
  name: string
}

export interface ProjectSummary {
  id: string
  code: string
  name: string
  product_name: string | null
  project_type: string | null
  market: string | null
  status: string          // ACTIVE | ON HOLD | COMPLETED | CANCELLED
  department_id: string | null
  department_name: string | null
  manager_id: string | null
  manager_name: string | null
  created_by: string
  creator_name: string | null
  notebook_count?: number
  experiment_count?: number
  created_at: string
  updated_at: string
  /** Resolved creator object (available in some response shapes) */
  creator?: UserShort | null
}

export interface ProjectResponse {
  id: string
  code: string
  name: string
  product_name: string | null
  project_type: string | null
  market: string | null
  department_id: string | null
  department: DeptShort | null
  manager_id: string | null
  manager: UserShort | null
  created_by: string
  creator: UserShort | null
  start_date: string | null
  target_date: string | null
  status: string
  description: string | null
  objective: string | null
  observation: string | null
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  code: string
  name: string
  product_name?: string
  project_type?: string
  market?: string
  department_id?: string
  manager_id?: string
  start_date?: string
  target_date?: string
  description?: string
}

export interface ProjectUpdate {
  name?: string
  product_name?: string
  project_type?: string
  market?: string
  department_id?: string
  manager_id?: string
  start_date?: string | null
  target_date?: string | null
  description?: string
  objective?: string | null
  observation?: string | null
  status?: string
}

export interface ProjectUserResponse {
  user_id: string
  user: UserShort | null
  added_at: string
}

export interface MilestoneResponse {
  id: string
  project_id: string
  name: string
  due_date: string | null
  completed_date: string | null
  owner_id: string | null
  owner: UserShort | null
  status: string     // NOT STARTED | ON TRACK | AT RISK | COMPLETED | DELAYED
  pct: number
  created_at: string
}

export interface MilestoneCreate {
  name: string
  due_date?: string
  owner_id?: string
  status?: string
  pct?: number
}

export interface MilestoneUpdate {
  name?: string
  due_date?: string | null
  completed_date?: string | null
  owner_id?: string | null
  status?: string
  pct?: number
}

/** v2: file attachment on a milestone */
export interface MilestoneAttachmentResponse {
  id: string
  milestone_id: string
  filename: string
  file_path: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string
  uploaded_at: string
}

export async function getProjects(params?: {
  status?: string
  search?: string
  department_id?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<ProjectSummary>> {
  const { data } = await client.get('/api/projects', { params })
  return data as PaginatedResponse<ProjectSummary>
}

export async function getProject(id: string): Promise<ProjectResponse> {
  const { data } = await client.get(`/api/projects/${id}`)
  return data as ProjectResponse
}

export async function createProject(body: ProjectCreate): Promise<ProjectResponse> {
  const { data } = await client.post('/api/projects', body)
  return data as ProjectResponse
}

export async function updateProject(id: string, body: ProjectUpdate): Promise<ProjectResponse> {
  const { data } = await client.patch(`/api/projects/${id}`, body)
  return data as ProjectResponse
}

export async function getProjectMembers(projectId: string): Promise<ProjectUserResponse[]> {
  const { data } = await client.get(`/api/projects/${projectId}/members`)
  return data as ProjectUserResponse[]
}

export async function addProjectMembers(projectId: string, userIds: string[]): Promise<{ message: string }> {
  const { data } = await client.post(`/api/projects/${projectId}/members`, { user_ids: userIds })
  return data as { message: string }
}

export async function removeProjectMember(projectId: string, userId: string): Promise<{ message: string }> {
  const { data } = await client.delete(`/api/projects/${projectId}/members/${userId}`)
  return data as { message: string }
}

export async function getMilestones(projectId: string): Promise<MilestoneResponse[]> {
  const { data } = await client.get(`/api/projects/${projectId}/milestones`)
  return data as MilestoneResponse[]
}

export async function createMilestone(projectId: string, body: MilestoneCreate): Promise<MilestoneResponse> {
  const { data } = await client.post(`/api/projects/${projectId}/milestones`, body)
  return data as MilestoneResponse
}

export async function updateMilestone(projectId: string, msId: string, body: MilestoneUpdate): Promise<MilestoneResponse> {
  const { data } = await client.patch(`/api/projects/${projectId}/milestones/${msId}`, body)
  return data as MilestoneResponse
}

export async function deleteMilestone(projectId: string, msId: string): Promise<{ message: string }> {
  const { data } = await client.delete(`/api/projects/${projectId}/milestones/${msId}`)
  return data as { message: string }
}

// ─── Routes & Stages ──────────────────────────────────────────

export interface StageResponse {
  id: string
  route_id: string
  project_id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  status: string   // ACTIVE | DRAFT | ARCHIVED
  created_at: string
  updated_at: string
}

export interface RouteResponse {
  id: string
  project_id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  status: string   // ACTIVE | DRAFT | ARCHIVED
  stages: StageResponse[]
  created_at: string
  updated_at: string
}

export async function getRoutes(projectId: string): Promise<RouteResponse[]> {
  const { data } = await client.get(`/api/routes/${projectId}/routes`)
  return data as RouteResponse[]
}

export async function createRoute(projectId: string, body: { code: string; name: string; description?: string; sort_order?: number }): Promise<RouteResponse> {
  const { data } = await client.post(`/api/routes/${projectId}/routes`, { ...body, stages: [] })
  return data as RouteResponse
}

export async function updateRoute(projectId: string, routeId: string, body: { name?: string; description?: string; sort_order?: number; status?: string }): Promise<RouteResponse> {
  const { data } = await client.patch(`/api/routes/${projectId}/routes/${routeId}`, body)
  return data as RouteResponse
}

export async function createStage(projectId: string, routeId: string, body: { code: string; name: string; description?: string; sort_order?: number }): Promise<StageResponse> {
  const { data } = await client.post(`/api/routes/${projectId}/routes/${routeId}/stages`, body)
  return data as StageResponse
}

export async function updateStage(projectId: string, routeId: string, stageId: string, body: { name?: string; description?: string; sort_order?: number; status?: string }): Promise<StageResponse> {
  const { data } = await client.patch(`/api/routes/${projectId}/routes/${routeId}/stages/${stageId}`, body)
  return data as StageResponse
}

export async function deleteStage(projectId: string, routeId: string, stageId: string): Promise<{ message: string }> {
  const { data } = await client.delete(`/api/routes/${projectId}/routes/${routeId}/stages/${stageId}`)
  return data as { message: string }
}

// ─── Notebooks ────────────────────────────────────────────────

export interface NotebookResponse {
  id: string
  code: string          // e.g. OQ-R1-S1-NB001
  title: string
  description: string | null
  project_id: string
  route_id: string | null
  stage_id: string | null
  template_id: string | null
  template_name: string | null
  template_slug: string | null
  template_snapshot: Record<string, unknown> | null
  created_by: string
  creator: UserShort | null
  status: string        // ACTIVE | ARCHIVED | LOCKED
  created_at: string
  updated_at: string
  preliminary_complete: boolean
}

export interface NotebookCreate {
  title: string
  description?: string
  project_id: string
  route_id?: string
  stage_id?: string
  template_id?: string
}

export interface NotebookUpdate {
  title?: string
  description?: string
  route_id?: string | null
  stage_id?: string | null
  status?: string
}

export interface PermissionResponse {
  id: string
  notebook_id: string
  user_id: string
  user: UserShort | null
  can_view: boolean
  can_edit: boolean
  can_submit: boolean
  can_verify: boolean
  can_approve: boolean
  can_clone: boolean
  can_export: boolean
  can_attach: boolean
  can_comment: boolean
  can_request_unlock: boolean
  can_deactivate: boolean
  granted_by: string | null
  granted_at: string
}

export interface PermissionGrant {
  user_id: string
  can_view?: boolean
  can_edit?: boolean
  can_submit?: boolean
  can_verify?: boolean
  can_approve?: boolean
  can_clone?: boolean
  can_export?: boolean
  can_attach?: boolean
  can_comment?: boolean
  can_request_unlock?: boolean
  can_deactivate?: boolean
}

export type PermissionUpdate = Partial<Omit<PermissionGrant, 'user_id'>>

export async function getNotebooks(params?: {
  project_id?: string
  status?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<NotebookResponse>> {
  const { data } = await client.get('/api/notebooks', { params })
  return data as PaginatedResponse<NotebookResponse>
}

export async function getNotebook(id: string): Promise<NotebookResponse> {
  const { data } = await client.get(`/api/notebooks/${id}`)
  return data as NotebookResponse
}

export async function createNotebook(body: NotebookCreate): Promise<NotebookResponse> {
  const { data } = await client.post('/api/notebooks', body)
  return data as NotebookResponse
}

export async function updateNotebook(id: string, body: NotebookUpdate): Promise<NotebookResponse> {
  const { data } = await client.patch(`/api/notebooks/${id}`, body)
  return data as NotebookResponse
}

export async function getNotebookPermissions(notebookId: string): Promise<PermissionResponse[]> {
  const { data } = await client.get(`/api/notebooks/${notebookId}/permissions`)
  return data as PermissionResponse[]
}

export async function grantNotebookPermission(notebookId: string, body: PermissionGrant): Promise<PermissionResponse> {
  const { data } = await client.post(`/api/notebooks/${notebookId}/permissions`, body)
  return data as PermissionResponse
}

export async function updateNotebookPermission(notebookId: string, userId: string, body: PermissionUpdate): Promise<PermissionResponse> {
  const { data } = await client.patch(`/api/notebooks/${notebookId}/permissions/${userId}`, body)
  return data as PermissionResponse
}

export async function revokeNotebookPermission(notebookId: string, userId: string): Promise<{ message: string }> {
  const { data } = await client.delete(`/api/notebooks/${notebookId}/permissions/${userId}`)
  return data as { message: string }
}

// ─── Experiments ──────────────────────────────────────────────

export type ExperimentStatus =
  | 'DRAFT' | 'SUBMITTED' | 'SIGNED' | 'APPROVED' | 'REJECTED' | 'UNLOCKED' | 'VOID'

export interface ExperimentSummary {
  id: string
  base_code: string
  full_code: string
  version: number
  title: string
  screen_key: string | null
  section_key: string | null
  status: ExperimentStatus | string
  is_latest_version: boolean
  notebook_id?: string
  project_id?: string
  created_by?: string
  creator_name?: string | null
  creator?: { display_name?: string | null } | null
  created_at: string
  updated_at: string
}

/** Resolve experiment creator for display — never falls back to raw user UUID. */
export function experimentCreatorLabel(
  e: Pick<ExperimentSummary, 'creator_name' | 'created_by'> & {
    creator?: { display_name?: string | null } | null
  },
  fallback = '—',
): string {
  return e.creator?.display_name ?? e.creator_name ?? fallback
}

// ─── Experiment Attachments ───────────────────────────────────

export interface ExperimentAttachmentResponse {
  id: string
  experiment_id: string
  section_key: string | null
  filename: string
  file_path: string | null
  file_size: number | null
  file_type: string | null
  uploaded_by: string
  uploaded_at: string
  url?: string
}

// ─── Experiment Comments ──────────────────────────────────────

export interface CommentCreate {
  comment: string
  comment_type?: string   // GENERAL | REVIEW_NOTE | REJECTION_REASON
  parent_id?: string
}

export interface CommentResponse {
  id: string
  experiment_id: string
  comment: string
  comment_type: string
  parent_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  is_deleted: boolean
}

// ─── Experiment History ───────────────────────────────────────

export interface HistoryResponse {
  id: string
  experiment_id: string
  actor_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

// ─── Experiment Create / Update ───────────────────────────────

export interface ExperimentCreate {
  notebook_id: string
  title: string
  screen_key?: string
  section_key?: string
  data?: Record<string, unknown>
  observations?: string
  conclusion?: string
  scheme_mol?: string | null
}

export interface ExperimentUpdate {
  title?: string
  data?: Record<string, unknown>
  observations?: string
  conclusion?: string
  disposition?: string
  scheme_mol?: string | null
}

export interface ExperimentResponse extends ExperimentSummary {
  notebook_id: string
  project_id: string
  created_by: string
  creator: { id: string; username: string; full_name: string | null } | null
  data: Record<string, unknown> | null
  observations: string | null
  conclusion: string | null
  disposition: string | null
  scheme_mol: string | null
  parent_id: string | null
  revision_note: string | null
  linked_preliminary_id: string | null
  linked_preliminary: { id: string; full_code: string; title: string } | null
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
  reviews: ExperimentReviewResponse[]
  files: ExperimentAttachmentResponse[]
}

// ─── Experiment CRUD & Workflow ───────────────────────────────

export async function getExperiments(params?: {
  notebook_id?: string
  project_id?: string
  status?: string
  latest_only?: boolean
  search?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<ExperimentSummary>> {
  if (params?.notebook_id) {
    const { notebook_id, latest_only = true, ...rest } = params
    const { data } = await client.get(`/api/notebooks/${notebook_id}/experiments`, {
      params: { latest_only, ...rest },
    })
    const items = data as ExperimentSummary[]
    return { items, total: items.length, page: 1, page_size: items.length, pages: 1 }
  }
  const { data } = await client.get('/api/search/experiments', { params: { latest_only: true, ...params } })
  return data as PaginatedResponse<ExperimentSummary>
}

export async function getExperiment(id: string): Promise<ExperimentResponse> {
  const { data } = await client.get(`/api/experiments/${id}`)
  return data as ExperimentResponse
}

export async function createExperiment(body: ExperimentCreate): Promise<ExperimentResponse> {
  const { notebook_id, ...rest } = body
  const { data } = await client.post(`/api/notebooks/${notebook_id}/experiments`, rest)
  return data as ExperimentResponse
}

export async function updateExperiment(id: string, body: ExperimentUpdate, password?: string): Promise<ExperimentResponse> {
  const payload = password ? { ...body, password } : body
  const { data } = await client.patch(`/api/experiments/${id}`, payload)
  return data as ExperimentResponse
}

// Workflow actions — password is passed when e-signature (reauth) is required
export async function submitExperiment(id: string, password?: string): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/submit`, password ? { password } : undefined)
  return data as ExperimentResponse
}

export async function signExperiment(id: string, password?: string): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/sign`, password ? { password } : undefined)
  return data as ExperimentResponse
}

export interface WorkflowScreenSignRequest {
  screen_key: string
  sign_role: 'done_by' | 'checked_by'
  password: string
  reason?: string
}

export async function screenSignExperiment(id: string, body: WorkflowScreenSignRequest): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/workflow/screen-sign`, body)
  return data as ExperimentResponse
}

export async function markPreliminaryComplete(id: string): Promise<{ status: string; preliminary_complete: boolean }> {
  const { data } = await client.post(`/api/experiments/${id}/workflow/mark-preliminary-complete`)
  return data
}

export async function checkAdcPreliminaryStatus(projectId: string): Promise<{ complete: boolean }> {
  const { data } = await client.get('/api/experiments/adc-preliminary-status', { params: { project_id: projectId } })
  return data
}

export async function getProjectPreliminaryData(expId: string): Promise<{ data: Record<string, unknown> }> {
  const { data } = await client.get(`/api/experiments/${expId}/project-preliminary-data`)
  return data
}

export async function approveExperiment(id: string): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/approve`)
  return data as ExperimentResponse
}

export async function rejectExperiment(id: string, reason: string): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/reject`, { reason })
  return data as ExperimentResponse
}

export async function newVersionExperiment(id: string, revision_note: string): Promise<ExperimentResponse> {
  const { data } = await client.post(`/api/experiments/${id}/versions`, { revision_note })
  return data as ExperimentResponse
}

// ─── Experiment History ───────────────────────────────────────

export async function getExperimentHistory(expId: string): Promise<HistoryResponse[]> {
  const { data } = await client.get(`/api/experiments/${expId}/history`)
  return data as HistoryResponse[]
}

// ─── Experiment Attachments ───────────────────────────────────

export async function getExperimentAttachments(expId: string): Promise<ExperimentAttachmentResponse[]> {
  const { data } = await client.get(`/api/experiments/${expId}/files`)
  return data as ExperimentAttachmentResponse[]
}

export async function uploadExperimentAttachment(expId: string, file: File, password?: string): Promise<ExperimentAttachmentResponse> {
  const form = new FormData()
  form.append('file', file)
  if (password) form.append('password', password)
  const { data } = await client.post(`/api/experiments/${expId}/files`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as ExperimentAttachmentResponse
}

export async function deleteExperimentAttachment(expId: string, attId: string): Promise<void> {
  await client.delete(`/api/experiments/${expId}/files/${attId}`)
}

// ─── PDF Export (v2 new) ──────────────────────────────────────

export interface ExportPDFParams {
  include_steps?: boolean
  include_inputs?: boolean
  include_parameters?: boolean
  include_equipment?: boolean
  include_tlc?: boolean
  include_comments?: boolean
}

/**
 * Download experiment report as PDF (or plain-text fallback).
 * Returns a Blob — use URL.createObjectURL to trigger browser download.
 */
export async function exportExperimentPDF(expId: string, params?: ExportPDFParams): Promise<Blob> {
  const { data } = await client.get(`/api/experiments/${expId}/pdf`, {
    params,
    responseType: 'blob',
  })
  return data as Blob
}

// ─── ATR ──────────────────────────────────────────────────────

export interface ATRAttachmentResponse {
  id: string
  atr_id: string
  filename: string
  file_size: number | null
  uploaded_by: string
  uploaded_at: string
}

/** v2: final QA/HOD report attached to an ATR */
export interface ATRFinalReportResponse {
  id: string
  atr_id: string
  filename: string
  file_path: string
  file_size: number | null
  uploaded_by: string
  uploaded_at: string
}

export interface ATRCreate {
  experiment_id?: string
  notebook_id?: string
  project_id?: string
  test_type: string
  objectives: string
  due_date?: string
}

export interface ATRUpdate {
  test_type?: string
  objectives?: string
  due_date?: string
}

export interface ATRAssignRequest {
  assigned_to: string
  due_date?: string
}

export interface ATRCompleteRequest {
  result: string
  result_observations?: string
}

export interface ATRSummary {
  id: string
  atr_no: string
  test_type: string
  objectives: string
  status: string        // NEW | SUBMITTED | VERIFIED | COMPLETED | CANCELLED
  experiment_id: string | null
  notebook_id: string | null
  project_id: string | null
  raised_by: string
  raised_at: string
  assigned_to: string | null
  due_date: string | null
  created_at: string
  /** v2 fields */
  version: number
  is_latest_version: boolean
  submitted_to: string | null
}

export interface ATRResponse extends ATRSummary {
  result: string | null
  result_observations: string | null
  completed_at: string | null
  completed_by: string | null
  verified_at: string | null
  verified_by: string | null
  updated_at: string
  /** v2 fields */
  submitted_at: string | null
  assigned_at: string | null
  attachments: ATRAttachmentResponse[]
  /** v2 */
  final_reports: ATRFinalReportResponse[]
}

export async function getATRs(params?: {
  experiment_id?: string
  notebook_id?: string
  project_id?: string
  status?: string
  test_type?: string
  latest_only?: boolean
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<ATRSummary>> {
  const { data } = await client.get('/api/atr', { params })
  return data as PaginatedResponse<ATRSummary>
}

export async function getATR(id: string): Promise<ATRResponse> {
  const { data } = await client.get(`/api/atr/${id}`)
  return data as ATRResponse
}

export async function createATR(body: ATRCreate): Promise<ATRResponse> {
  const { data } = await client.post('/api/atr/', body)
  return data as ATRResponse
}

export async function updateATR(id: string, body: ATRUpdate): Promise<ATRResponse> {
  const { data } = await client.patch(`/api/atr/${id}`, body)
  return data as ATRResponse
}

export async function submitATR(id: string): Promise<ATRResponse> {
  const { data } = await client.post(`/api/atr/${id}/submit`)
  return data as ATRResponse
}

export async function assignATR(id: string, body: ATRAssignRequest): Promise<ATRResponse> {
  const { data } = await client.post(`/api/atr/${id}/assign`, body)
  return data as ATRResponse
}

export async function completeATR(id: string, body: ATRCompleteRequest): Promise<ATRResponse> {
  const { data } = await client.post(`/api/atr/${id}/complete`, body)
  return data as ATRResponse
}

export async function cancelATR(id: string): Promise<ATRResponse> {
  const { data } = await client.post(`/api/atr/${id}/cancel`)
  return data as ATRResponse
}

export async function uploadATRAttachment(atrId: string, file: File): Promise<ATRAttachmentResponse> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(`/api/atr/${atrId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as ATRAttachmentResponse
}

export async function deleteATRAttachment(atrId: string, attId: string): Promise<void> {
  await client.delete(`/api/atr/${atrId}/attachments/${attId}`)
}

// ─── Unlock Requests ──────────────────────────────────────────

export interface UnlockRequestResponse {
  id: string
  experiment_id: string
  experiment_full_code: string | null
  reason: string
  status: string        // PENDING | APPROVED | REJECTED
  requested_by: string
  requester_name: string | null
  requested_at: string
  reviewed_by: string | null
  reviewer_name: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
}

export async function getUnlockRequests(params?: {
  experiment_id?: string
  status?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<UnlockRequestResponse>> {
  const { data } = await client.get('/api/unlock-requests/', { params })
  return data as PaginatedResponse<UnlockRequestResponse>
}

export async function createUnlockRequest(body: { experiment_id: string; reason: string }): Promise<UnlockRequestResponse> {
  const { data } = await client.post('/api/unlock-requests/', body)
  return data as UnlockRequestResponse
}

export async function reviewUnlockRequest(
  id: string,
  action: 'approve' | 'reject',
  review_note?: string,
): Promise<UnlockRequestResponse> {
  const { data } = await client.post(`/api/unlock-requests/${id}/review`, { action, review_note })
  return data as UnlockRequestResponse
}

// ─── Dashboard (v2 new) ───────────────────────────────────────

/** Nested structure returned by GET /api/dashboard/counts */
export interface DashboardCountsExperiments {
  total: number
  by_status: Record<string, number>
  in_progress: number
  verification_requested: number
  submitted: number
  verified: number
  approved: number
  rework: number
  unlocked: number
  void: number
}

export interface DashboardCountsATR {
  pending_assignment: number
  assigned_to_me: number
}

export interface DashboardCounts {
  experiments: DashboardCountsExperiments
  atr: DashboardCountsATR
}

/**
 * Queue endpoints return serialized Experiment rows (all ORM columns, no relationships).
 * Used for verification-queue, approval-queue and rework-inbox.
 */
export interface DashboardQueueItem {
  id: string
  full_code: string
  code: string
  title: string
  status: string
  notebook_id: string
  submitted_by: string | null
  submitted_at: string | null
  submitted_to: string | null
  submitted_to_at: string | null
  verified_by: string | null
  verified_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  improvement_suggestions: string | null
  created_at: string
  updated_at: string
}

/** Flat counts object returned by GET /api/dashboard/sla-alerts (NOT a list) */
export interface SLAAlerts {
  sla_days_for_submission: number
  overdue_in_progress: number
  delayed_verification_requests: number
  delayed_approvals: number
}

/** GET /api/dashboard/my-activity items — serialized ExperimentHistory rows */
export interface MyActivityItem {
  id: string
  experiment_id: string
  action: string        // SUBMITTED | VERIFIED | REJECTED | APPROVED | UNLOCKED | REVISED | SAVED
  action_by: string     // user UUID
  action_at: string     // ISO datetime
}

export interface DashboardQueueResponse {
  total: number
  page: number
  items: DashboardQueueItem[]
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const { data } = await client.get('/api/dashboard/counts')
  return data as DashboardCounts
}

export async function getVerificationQueue(params?: { page?: number; page_size?: number }): Promise<DashboardQueueResponse> {
  const { data } = await client.get('/api/dashboard/verification-queue', { params })
  return data as DashboardQueueResponse
}

export async function getApprovalQueue(params?: { page?: number; page_size?: number }): Promise<DashboardQueueResponse> {
  const { data } = await client.get('/api/dashboard/approval-queue', { params })
  return data as DashboardQueueResponse
}

export async function getReworkInbox(params?: { page?: number; page_size?: number }): Promise<DashboardQueueResponse> {
  const { data } = await client.get('/api/dashboard/rework-inbox', { params })
  return data as DashboardQueueResponse
}

export async function getSLAAlerts(): Promise<SLAAlerts> {
  const { data } = await client.get('/api/dashboard/sla-alerts')
  return data as SLAAlerts
}

export async function getMyActivity(params?: { limit?: number }): Promise<{ items: MyActivityItem[] }> {
  const { data } = await client.get('/api/dashboard/my-activity', { params })
  return data as { items: MyActivityItem[] }
}

// ─── Search (v2 new) ──────────────────────────────────────────

export interface SearchExperimentResult {
  id: string
  full_code: string
  title: string
  status: string
  notebook_id: string
  notebook_code: string | null
  project_id: string
  project_code: string | null
  created_by: string
  creator_name: string | null
  created_at: string
}

export interface SearchATRResult {
  id: string
  atr_no: string
  test_type: string
  status: string
  experiment_id: string | null
  raised_by: string
  raised_at: string
}

export interface SearchNotebookResult {
  id: string
  code: string
  title: string
  status: string
  project_id: string
  project_code: string | null
  created_at: string
}

export interface SearchProjectResult {
  id: string
  code: string
  name: string
  status: string
  department_name: string | null
  created_at: string
}

export async function searchExperiments(params: {
  q?: string
  full_code?: string
  status?: string
  notebook_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<SearchExperimentResult>> {
  const { data } = await client.get('/api/search/experiments', { params })
  return data as PaginatedResponse<SearchExperimentResult>
}

export async function searchATRs(params: {
  q?: string
  status?: string
  test_type?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<SearchATRResult>> {
  const { data } = await client.get('/api/search/atrs', { params })
  return data as PaginatedResponse<SearchATRResult>
}

export async function searchNotebooks(params: {
  q?: string
  project_id?: string
  status?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<SearchNotebookResult>> {
  const { data } = await client.get('/api/search/notebooks', { params })
  return data as PaginatedResponse<SearchNotebookResult>
}

export async function searchProjects(params: {
  q?: string
  status?: string
  department_id?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<SearchProjectResult>> {
  const { data } = await client.get('/api/search/projects', { params })
  return data as PaginatedResponse<SearchProjectResult>
}

// ─── Master Data — Chemicals (v2 new) ─────────────────────────

export interface LookupChemical {
  id: string
  chemical_name: string
  cas_no: string | null
  formula: string | null
  mol_wt: string | null
  vendor_name: string | null
  density: string | null
  purity_pct: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LookupChemicalCreate {
  chemical_name: string
  cas_no?: string
  formula?: string
  mol_wt?: string
  vendor_name?: string
  density?: string
  purity_pct?: string
}

export interface LookupChemicalUpdate {
  chemical_name?: string
  cas_no?: string
  formula?: string
  mol_wt?: string
  vendor_name?: string
  density?: string
  purity_pct?: string
  is_active?: boolean
}

export async function getChemicals(params?: {
  search?: string
  is_active?: boolean
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<LookupChemical>> {
  const { data } = await client.get('/api/master-data/chemicals', { params })
  return data as PaginatedResponse<LookupChemical>
}

export async function getChemical(id: string): Promise<LookupChemical> {
  const { data } = await client.get(`/api/master-data/chemicals/${id}`)
  return data as LookupChemical
}

export async function createChemical(body: LookupChemicalCreate): Promise<LookupChemical> {
  const { data } = await client.post('/api/master-data/chemicals', body)
  return data as LookupChemical
}

export async function updateChemical(id: string, body: LookupChemicalUpdate): Promise<LookupChemical> {
  const { data } = await client.patch(`/api/master-data/chemicals/${id}`, body)
  return data as LookupChemical
}

export async function deleteChemical(id: string): Promise<void> {
  await client.delete(`/api/master-data/chemicals/${id}`)
}

// ─── Master Data — Instruments (v2 new) ──────────────────────

export interface LookupInstrument {
  id: string
  instrument_code: string
  instrument_type: string | null
  instrument_name: string
  maintenance_status: string | null
  calibration_status: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LookupInstrumentCreate {
  instrument_code: string
  instrument_type?: string
  instrument_name: string
  maintenance_status?: string
  calibration_status?: string
}

export interface LookupInstrumentUpdate {
  instrument_type?: string
  instrument_name?: string
  maintenance_status?: string
  calibration_status?: string
  is_active?: boolean
}

export async function getInstruments(params?: {
  search?: string
  is_active?: boolean
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<LookupInstrument>> {
  const { data } = await client.get('/api/master-data/instruments', { params })
  return data as PaginatedResponse<LookupInstrument>
}

export async function getInstrument(id: string): Promise<LookupInstrument> {
  const { data } = await client.get(`/api/master-data/instruments/${id}`)
  return data as LookupInstrument
}

export async function createInstrument(body: LookupInstrumentCreate): Promise<LookupInstrument> {
  const { data } = await client.post('/api/master-data/instruments', body)
  return data as LookupInstrument
}

export async function updateInstrument(id: string, body: LookupInstrumentUpdate): Promise<LookupInstrument> {
  const { data } = await client.patch(`/api/master-data/instruments/${id}`, body)
  return data as LookupInstrument
}

export async function deleteInstrument(id: string): Promise<void> {
  await client.delete(`/api/master-data/instruments/${id}`)
}

// ─── Master Data — Sites (v2 new) ─────────────────────────────

export interface Site {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
}

export interface SiteCreate {
  code: string
  name: string
}

export interface SiteUpdate {
  name?: string
  is_active?: boolean
}

export async function getSites(params?: {
  is_active?: boolean
}): Promise<Site[]> {
  const { data } = await client.get('/api/master-data/sites', { params })
  return data as Site[]
}

export async function createSite(body: SiteCreate): Promise<Site> {
  const { data } = await client.post('/api/master-data/sites', body)
  return data as Site
}

export async function updateSite(id: string, body: SiteUpdate): Promise<Site> {
  const { data } = await client.patch(`/api/master-data/sites/${id}`, body)
  return data as Site
}

export async function deleteSite(id: string): Promise<void> {
  await client.delete(`/api/master-data/sites/${id}`)
}

// ─── Global Settings ──────────────────────────────────────────

export interface GlobalSettings {
  id?: string
  auth_type: string                       // 'local' | 'ldap' | 'sso'
  use_random_password_through_mail: boolean
  default_password: string | null
  lock_user_after_x_attempts: number | null
  password_expiry_days: number | null
  image_file_size_kb: number | null
  attachment_size_kb: number | null
  /** Role whose members have QA privileges (default 'QA') */
  qa_privilege_role: string
  email_notification_enabled: boolean
  experiment_per_limit: number | null
  notebook_experiment_limit: number | null
  experiment_search_result_limit: number | null
  company_logo_path: string | null
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const { data } = await client.get('/api/admin/settings/global')
  return data as GlobalSettings
}

export async function updateGlobalSettings(body: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const { data } = await client.patch('/api/admin/settings/global', body)
  return data as GlobalSettings
}

// ─── SMTP Settings ────────────────────────────────────────────

export interface SMTPSettings {
  id?: string
  host: string | null
  port: number | null
  username: string | null
  password: string | null
  from_email: string | null
  use_tls: boolean
  use_ssl: boolean
  timeout_seconds: number | null
}

export async function getSMTPSettings(): Promise<SMTPSettings> {
  const { data } = await client.get('/api/admin/settings/smtp')
  return data as SMTPSettings
}

export async function updateSMTPSettings(body: Partial<SMTPSettings>): Promise<SMTPSettings> {
  const { data } = await client.patch('/api/admin/settings/smtp', body)
  return data as SMTPSettings
}

export async function testSMTPConnection(): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post('/api/admin/settings/smtp/test')
  return data as { success: boolean; message: string }
}

// ─── CRD Settings (v2) ────────────────────────────────────────

/**
 * CRD (Customisation / Run-time Data) settings returned by
 * GET /api/admin/settings/crd.
 * Only the fields needed by the frontend are listed here;
 * the backend may return additional keys.
 */
export interface CRDSettings {
  id?: string
  // Workflow flags
  verification_request_flow: boolean
  route_and_stage: boolean
  mandate_tl_approval_atr: boolean
  clone_procedure_without_numerical_data: boolean
  include_observation_start_end_time: boolean
  include_reference_for_cloned_experiments: boolean
  // Scheme / TLC
  scheme_type: string | null
  procedure_display: string | null
  tlc_type: string | null
  tlc_row_count: number
  // SLA (days)
  sla_experiments_days: number | null
  sla_delayed_submission_days: number | null
  sla_delayed_approval_days: number | null
  // Stage codes
  closing_stage: string | null
  experiment_report_stage: string | null
  reference_experiment_link_code: string | null
  sample_notebook_code: string | null
  // E-Signature (reauth) gates
  reauth_save: boolean
  reauth_submit_for_verification: boolean
  reauth_verification: boolean
  reauth_deactivate: boolean
  reauth_attachment_upload: boolean
  // Input defaults
  input_default_mol_weight: number | null
  input_default_quantity: number | null
  input_auto_calc_moles: boolean
  input_default_mole_ratio: number | null
}

export async function getCRDSettings(): Promise<CRDSettings> {
  const { data } = await client.get('/api/admin/settings/crd')
  return data as CRDSettings
}

export async function updateCRDSettings(body: Partial<CRDSettings>): Promise<CRDSettings> {
  const { data } = await client.patch('/api/admin/settings/crd', body)
  return data as CRDSettings
}

// ─── Experiment Reviewers ─────────────────────────────────────

export interface ExperimentReviewResponse {
  id: string
  experiment_id: string
  reviewer_id: string
  assigned_by: string | null
  assigned_at: string | null
  signed_at: string | null
  sign_reason: string | null
  decision: 'APPROVED' | 'REJECTED' | null
}

export async function addExperimentReviewer(
  id: string,
  body: { reviewer_id: string },
): Promise<ExperimentReviewResponse> {
  const { data } = await client.post(`/api/experiments/${id}/reviewers`, body)
  return data as ExperimentReviewResponse
}

export async function removeExperimentReviewer(id: string, reviewerId: string): Promise<void> {
  await client.delete(`/api/experiments/${id}/reviewers/${reviewerId}`)
}

// ─── Experiment Link Preliminary ──────────────────────────────

export async function linkPreliminaryExperiment(
  id: string,
  body: { preliminary_experiment_id: string },
): Promise<ExperimentResponse> {
  const { data } = await client.patch(`/api/experiments/${id}/link-preliminary`, body)
  return data as ExperimentResponse
}

// ─── Experiment Files (new names, same URLs as Phase 1) ───────

export async function getExperimentFiles(expId: string): Promise<ExperimentAttachmentResponse[]> {
  const { data } = await client.get(`/api/experiments/${expId}/files`)
  return data as ExperimentAttachmentResponse[]
}

export async function uploadExperimentFile(
  expId: string,
  file: File,
  options?: { password?: string; section_key?: string },
): Promise<ExperimentAttachmentResponse> {
  const form = new FormData()
  form.append('file', file)
  if (options?.password) form.append('password', options.password)
  if (options?.section_key) form.append('section_key', options.section_key)
  const { data } = await client.post(`/api/experiments/${expId}/files`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as ExperimentAttachmentResponse
}

export async function deleteExperimentFile(expId: string, fileId: string): Promise<void> {
  await client.delete(`/api/experiments/${expId}/files/${fileId}`)
}

// ─── Workflow Templates ───────────────────────────────────────

export interface WorkflowTemplateSummary {
  id: string
  name: string
  slug: string
  category?: string
  version: number
  is_active: boolean
}

export interface WorkflowTemplateResponse {
  id: string
  name: string
  slug: string
  description?: string
  category?: string
  version: number
  is_active: boolean
  definition?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WorkflowTemplateCreate {
  name: string
  slug: string
  description?: string
  category?: string
  definition?: Record<string, unknown>
}

export interface WorkflowTemplateUpdate {
  name?: string
  description?: string
  category?: string
  is_active?: boolean
  definition?: Record<string, unknown>
}

export async function getWorkflowTemplates(
  options?: { includeInactive?: boolean },
): Promise<WorkflowTemplateSummary[]> {
  const params = options?.includeInactive ? { is_active: '' } : undefined
  const { data } = await client.get('/api/workflow-templates', { params })
  return data as WorkflowTemplateSummary[]
}

export async function getWorkflowTemplate(id: string): Promise<WorkflowTemplateResponse> {
  const { data } = await client.get(`/api/workflow-templates/${id}`)
  return data as WorkflowTemplateResponse
}

export async function createWorkflowTemplate(
  body: WorkflowTemplateCreate,
): Promise<WorkflowTemplateResponse> {
  const { data } = await client.post('/api/workflow-templates', body)
  return data as WorkflowTemplateResponse
}

export async function updateWorkflowTemplate(
  id: string,
  body: WorkflowTemplateUpdate,
): Promise<WorkflowTemplateResponse> {
  const { data } = await client.patch(`/api/workflow-templates/${id}`, body)
  return data as WorkflowTemplateResponse
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  await client.delete(`/api/workflow-templates/${id}`)
}

export interface WorkflowTemplateVersionSummary {
  id: string
  template_id: string
  version: number
  definition: Record<string, unknown> | null
  saved_by: string | null
  saved_at: string
}

export async function getTemplateVersions(id: string): Promise<WorkflowTemplateVersionSummary[]> {
  const { data } = await client.get(`/api/workflow-templates/${id}/versions`)
  return data as WorkflowTemplateVersionSummary[]
}

// ─── Notification Settings ────────────────────────────────────

export interface NotificationSettingResponse {
  id: string
  key: string
  label?: string
  module?: string
  is_enabled: boolean
  updated_at: string
}

export interface NotificationSettingCreate {
  key: string
  label?: string
  module?: string
  is_enabled?: boolean
}

export interface NotificationSettingUpdate {
  label?: string
  module?: string
  is_enabled?: boolean
}

export async function getNotificationSettings(): Promise<NotificationSettingResponse[]> {
  const { data } = await client.get('/api/notification-settings')
  return data as NotificationSettingResponse[]
}

export async function createNotificationSetting(
  body: NotificationSettingCreate,
): Promise<NotificationSettingResponse> {
  const { data } = await client.post('/api/notification-settings', body)
  return data as NotificationSettingResponse
}

export async function updateNotificationSetting(
  id: string,
  body: NotificationSettingUpdate,
): Promise<NotificationSettingResponse> {
  const { data } = await client.patch(`/api/notification-settings/${id}`, body)
  return data as NotificationSettingResponse
}

export async function toggleNotificationSetting(
  id: string,
): Promise<NotificationSettingResponse> {
  const { data } = await client.post(`/api/notification-settings/${id}/toggle`)
  return data as NotificationSettingResponse
}

// ─── Excel Templates ──────────────────────────────────────────

export interface ExcelTemplateResponse {
  id: string
  name: string
  module: string
  version?: string
  file_size?: string
  uploaded_by: string
  uploaded_at: string
  is_active: boolean
}

export async function getExcelTemplates(): Promise<ExcelTemplateResponse[]> {
  const { data } = await client.get('/api/excel-templates')
  return data as ExcelTemplateResponse[]
}

export async function getExcelTemplate(id: string): Promise<ExcelTemplateResponse> {
  const { data } = await client.get(`/api/excel-templates/${id}`)
  return data as ExcelTemplateResponse
}

export async function downloadExcelTemplate(id: string): Promise<Blob> {
  const { data } = await client.get(`/api/excel-templates/${id}/download`, {
    responseType: 'blob',
  })
  return data as Blob
}

// ─── Company Settings ─────────────────────────────────────────

export interface CompanySettingsResponse {
  id: number
  company_name?: string
  logo_path?: string
  address?: string
  contact_email?: string
  contact_phone?: string
  website?: string
}

export interface CompanySettingsUpdate {
  company_name?: string
  logo_path?: string
  address?: string
  contact_email?: string
  contact_phone?: string
  website?: string
}

export async function getCompanySettings(): Promise<CompanySettingsResponse> {
  const { data } = await client.get('/api/admin/settings/company')
  return data as CompanySettingsResponse
}

export async function updateCompanySettings(
  body: CompanySettingsUpdate,
): Promise<CompanySettingsResponse> {
  const { data } = await client.patch('/api/admin/settings/company', body)
  return data as CompanySettingsResponse
}

// ─── Role Privileges — Bulk ───────────────────────────────────

export interface BulkPrivilegeItem {
  privilege_key: string
  is_granted: boolean
}

export interface BulkPrivilegeCreate {
  role_id: string
  department_id?: string | null
  privileges: BulkPrivilegeItem[]
}

export async function bulkCreateRolePrivileges(
  body: BulkPrivilegeCreate,
): Promise<RolePrivilege[]> {
  const { data } = await client.post('/api/role-privileges/bulk', body)
  return data as RolePrivilege[]
}

// ─── Projects — Close ─────────────────────────────────────────

export async function closeProject(id: string): Promise<ProjectResponse> {
  const { data } = await client.post(`/api/projects/${id}/close`)
  return data as ProjectResponse
}
