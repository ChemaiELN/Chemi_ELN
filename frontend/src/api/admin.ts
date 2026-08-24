import { apiGet, apiPost, apiPatch, apiPut, apiDelete, apiUpload } from './client'
import type { PaginatedResponse } from './types'

// ── A3 types ────────────────────────────────────────────────

export interface GlobalSettings {
  id: number
  auth_type: string
  lock_user_after_x_attempts: number
  password_expiry_days: number
  max_image_kb: number
  max_attachment_kb: number
  experiments_per_notebook: number
  notebooks_per_project: number
  search_limit: number
  qa_role: string | null
  smtp_host: string | null
  smtp_port: number | null
  smtp_from_address: string | null
  smtp_username: string | null
  enable_email_notifications: boolean
}

// ── Admin Master Data types ──────────────────────────────────

export interface LookupChemical {
  id: string
  chemical_name: string
  cas_no: string | null
  formula: string | null
  mol_wt: number | null
  vendor_name: string | null
  density: number | null
  purity_pct: number | null
  is_active: boolean
  created_at: string | null
}

export interface LookupInstrument {
  id: string
  instrument_code: string
  instrument_type: string | null
  instrument_name: string
  maintenance_status: string | null
  calibration_status: string | null
  is_active: boolean
  created_at: string | null
}

export interface Role {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  user_count: number
}

export interface DepartmentOut {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  user_count: number
  created_at: string
}
export interface DepartmentCreate { code: string; name: string; description?: string }
export interface DepartmentUpdate { name?: string; description?: string; is_active?: boolean }

export interface DepartmentRoleMapping { department_id: string; role_ids: string[] }

// ── Department-Role privilege matrix ─────────────────────────
export interface PrivilegeDef {
  key: string
  module: string
  group: string
  name: string
  description: string
}
export interface PrivilegeCatalog {
  module: string
  groups: { group: string; privileges: PrivilegeDef[] }[]
}
export interface DeptRoleGrants {
  department_id: string
  role_id: string
  granted: string[]
}

export interface LabOut {
  id: string
  code: string
  name: string
  department_id: string
  department_name: string
  description: string | null
  is_active: boolean
  user_count: number
  created_at: string
}
export interface LabCreate { code: string; name: string; department_id: string; description?: string }
export interface LabUpdate { name?: string; department_id?: string; description?: string; is_active?: boolean }

export interface UserOut {
  id: string
  username: string
  emp_no: string | null
  email: string | null
  full_name?: string | null
  title: string | null
  first_name: string | null
  middle_initials: string | null
  last_name: string | null
  display_name: string | null
  designation: string | null
  contact_no: string | null
  has_job_description: boolean
  role_id: string | null
  role_code: string | null
  role_name: string | null
  department_id: string | null
  department_name: string | null
  lab_id: string | null
  lab_name: string | null
  lab_ids?: string[]
  labs?: { id: string; code: string; name: string }[]
  is_active: boolean
  is_locked?: boolean
  locked_until?: string | null
  failed_login_count?: number
  must_reset_password: boolean
  created_at: string
}
export interface UserCreate {
  username: string
  email?: string
  title: string
  first_name: string
  middle_initials?: string
  last_name: string
  display_name: string
  designation: string
  contact_no?: string
  job_description?: File
}
export interface UserUpdate {
  username?: string
  display_name?: string
  emp_no?: string
  email?: string
  title?: string
  first_name?: string
  middle_initials?: string
  last_name?: string
  designation?: string
  contact_no?: string
  role_id?: string
  department_id?: string | null
  lab_id?: string | null
  lab_ids?: string[]
  dashboard_reference?: string
  is_active?: boolean
  must_reset_password?: boolean
}


export const adminApi = {
  // Settings (A3)
  getSettings: () => apiGet<GlobalSettings>('/api/admin/settings'),
  updateSettings: (body: Partial<Omit<GlobalSettings, 'id' | 'auth_type'>> & { smtp_password?: string }) =>
    apiPatch<GlobalSettings>('/api/admin/settings', body),

  // Chemicals
  listChemicals: (includeInactive = false) =>
    apiGet<LookupChemical[]>('/api/master-data/chemicals', { include_inactive: includeInactive }),
  // Server-side search/sort/pagination. The route keeps returning a bare array
  // unless page params are sent, so the call above is unaffected.
  listChemicalsPaged: (params?: Record<string, unknown>) =>
    apiGet<{ items: LookupChemical[]; total: number }>('/api/master-data/chemicals', params),
  createChemical: (body: Omit<LookupChemical, 'id' | 'is_active' | 'created_at'>) =>
    apiPost<LookupChemical>('/api/master-data/chemicals', body),
  updateChemical: (id: string, body: Partial<Omit<LookupChemical, 'id' | 'created_at'>>) =>
    apiPatch<LookupChemical>(`/api/master-data/chemicals/${id}`, body),
  deleteChemical: (id: string) => apiDelete(`/api/master-data/chemicals/${id}`),

  // Instruments
  listInstruments: (includeInactive = false) =>
    apiGet<LookupInstrument[]>('/api/master-data/instruments', { include_inactive: includeInactive }),
  listInstrumentsPaged: (params?: Record<string, unknown>) =>
    apiGet<{ items: LookupInstrument[]; total: number }>('/api/master-data/instruments', params),
  createInstrument: (body: Omit<LookupInstrument, 'id' | 'is_active' | 'created_at'>) =>
    apiPost<LookupInstrument>('/api/master-data/instruments', body),
  updateInstrument: (id: string, body: Partial<Omit<LookupInstrument, 'id' | 'instrument_code' | 'created_at'>>) =>
    apiPatch<LookupInstrument>(`/api/master-data/instruments/${id}`, body),
  deleteInstrument: (id: string) => apiDelete(`/api/master-data/instruments/${id}`),

  // Roles
  listRoles: (includeInactive = false) => apiGet<Role[]>('/api/roles', { include_inactive: includeInactive }),
  listRolesPaged: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<Role>>('/api/roles', params),
  createRole: (body: { code: string; name: string; description?: string; department_ids: string[] }) => apiPost<Role>('/api/roles', body),
  updateRole: (id: string, body: { name?: string; description?: string; is_active?: boolean; department_ids?: string[] }) => apiPatch<Role>(`/api/roles/${id}`, body),
  deleteRole: (id: string) => apiDelete(`/api/roles/${id}`),

  // Departments
  listDepts: () => apiGet<DepartmentOut[]>('/api/departments'),
  listDeptsPaged: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<DepartmentOut>>('/api/departments', params),
  createDept: (body: DepartmentCreate) => apiPost<DepartmentOut>('/api/departments', body),
  updateDept: (id: string, body: DepartmentUpdate) => apiPatch<DepartmentOut>(`/api/departments/${id}`, body),
  deleteDept: (id: string) => apiDelete(`/api/departments/${id}`),
  listDeptRoleMapping: () => apiGet<DepartmentRoleMapping[]>('/api/departments/role-mapping'),

  // Department-Role privilege matrix
  getPrivilegeCatalog: (module = 'ADC') =>
    apiGet<PrivilegeCatalog>('/api/department-role-privileges/catalog', { module }),
  getDeptRolePrivileges: (department_id: string, role_id: string) =>
    apiGet<DeptRoleGrants>('/api/department-role-privileges', { department_id, role_id }),
  saveDeptRolePrivileges: (body: {
    department_id: string
    role_id: string
    grants: { privilege_key: string; is_granted: boolean }[]
  }) => apiPut<DeptRoleGrants>('/api/department-role-privileges', body),

  // Labs
  listLabs: () => apiGet<LabOut[]>('/api/labs'),
  listLabsPaged: (params?: Record<string, unknown>) =>
    apiGet<PaginatedResponse<LabOut>>('/api/labs', params),
  listLabsLookup: (departmentId?: string) =>
    apiGet<LabOut[]>('/api/labs/lookup', departmentId ? { department_id: departmentId } : undefined),
  createLab: (body: LabCreate) => apiPost<LabOut>('/api/labs', body),
  updateLab: (id: string, body: LabUpdate) => apiPatch<LabOut>(`/api/labs/${id}`, body),
  deleteLab: (id: string) => apiDelete(`/api/labs/${id}`),

  // Users
  listUsers: (params?: Record<string, unknown>) => apiGet<PaginatedResponse<UserOut>>('/api/users', params),
  createUser: (body: UserCreate) => {
    const { job_description, ...rest } = body
    const fd = new FormData()
    Object.entries(rest).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.set(k, String(v)) })
    if (job_description) fd.set('job_description', job_description)
    return apiUpload<UserOut>('/api/users', fd)
  },
  getUser: (id: string) => apiGet<UserOut>(`/api/users/${id}`),
  updateUser: (id: string, body: UserUpdate) => apiPatch<UserOut>(`/api/users/${id}`, body),
  resetPassword: (id: string, new_password: string) =>
    apiPost(`/api/users/${id}/reset-password`, { new_password }),
  resetToDefaultPassword: (id: string) => apiPost<void>(`/api/users/${id}/reset-to-default`),
  unlockUser: (id: string) => apiPost<void>(`/api/users/${id}/unlock`),
  deactivateUser: (id: string) => apiDelete(`/api/users/${id}`),

}

// ── Admin Dashboard ───────────────────────────────────────────
export interface DepartmentUserCount {
  department_id: string | null
  department_code: string
  department_name: string
  count: number
}

export interface LockedAccount {
  id: string
  username: string
  display_name: string | null
  designation: string | null
  department_name: string | null
  failed_login_count: number
  locked_until: string
}

export const adminDashboardApi = {
  departmentUserCounts: () => apiGet<DepartmentUserCount[]>('/api/admin/dashboard/department-user-counts'),
  lockedAccounts: () => apiGet<LockedAccount[]>('/api/admin/dashboard/locked-accounts'),
}

// ── ID Numbering ("SOP numbering") ──────────────────────────────────────────
// e.g. code='SAMPLE_ID', prefix='SAMPLE' → generates 'SAMPLE/26/00001'.
// `/next` (in idSequenceApi.generate below, NOT gated to admins) is what a
// CGT template's "Generate" button calls at runtime.
export interface IdSequenceConfig {
  id: string
  code: string
  label: string
  prefix: string
  separator: string
  include_year: boolean
  year_digits: number
  sequence_digits: number
  reset_yearly: boolean
  is_active: boolean
}
export type IdSequenceConfigCreate = Omit<IdSequenceConfig, 'id'>
export type IdSequenceConfigUpdate = Partial<Omit<IdSequenceConfig, 'id' | 'code'>>

export const idSequenceApi = {
  list: () => apiGet<IdSequenceConfig[]>('/api/admin/id-sequences'),
  create: (body: IdSequenceConfigCreate) => apiPost<IdSequenceConfig>('/api/admin/id-sequences', body),
  update: (id: string, body: IdSequenceConfigUpdate) => apiPatch<IdSequenceConfig>(`/api/admin/id-sequences/${id}`, body),
  delete: (id: string) => apiDelete(`/api/admin/id-sequences/${id}`),
  generate: (code: string) => apiPost<{ value: string; code: string; sequence: number }>(`/api/id-sequences/${code}/next`, {}),
}

// ── Administration Audit Trail ───────────────────────────────
export interface AdminAuditTrailEntry {
  id: number
  event_type: string
  entity_type: string
  entity_id: string | null
  entity_ref: string | null
  performed_by: string
  performed_at: string
  old_value: string | null
  new_value: string | null
  details: string | null
}

export const adminAuditTrailApi = {
  list: (params?: Record<string, unknown>) => apiGet<PaginatedResponse<AdminAuditTrailEntry>>('/api/admin/audit-trail', params),
  eventTypes: () => apiGet<string[]>('/api/admin/audit-trail/event-types'),
  entityTypes: () => apiGet<string[]>('/api/admin/audit-trail/entity-types'),
}
