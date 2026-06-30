import { apiGet, apiPost, apiPatch, apiDelete } from './client'
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

export interface LookupSite {
  id: string
  code: string
  name: string
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

export interface UserOut {
  id: string
  username: string
  emp_no: string
  email: string
  role_id: string
  role_code: string
  role_name: string
  department_id: string | null
  department_name: string | null
  is_active: boolean
  must_reset_password: boolean
  site: string | null
  created_at: string
}
export interface UserCreate {
  username: string
  emp_no: string
  email: string
  password: string
  role_id: string
  department_id?: string | null
  site?: string
  is_active?: boolean
}
export interface UserUpdate {
  username?: string
  emp_no?: string
  email?: string
  role_id?: string
  department_id?: string | null
  site?: string
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
  createChemical: (body: Omit<LookupChemical, 'id' | 'is_active' | 'created_at'>) =>
    apiPost<LookupChemical>('/api/master-data/chemicals', body),
  updateChemical: (id: string, body: Partial<Omit<LookupChemical, 'id' | 'created_at'>>) =>
    apiPatch<LookupChemical>(`/api/master-data/chemicals/${id}`, body),
  deleteChemical: (id: string) => apiDelete(`/api/master-data/chemicals/${id}`),

  // Instruments
  listInstruments: (includeInactive = false) =>
    apiGet<LookupInstrument[]>('/api/master-data/instruments', { include_inactive: includeInactive }),
  createInstrument: (body: Omit<LookupInstrument, 'id' | 'is_active' | 'created_at'>) =>
    apiPost<LookupInstrument>('/api/master-data/instruments', body),
  updateInstrument: (id: string, body: Partial<Omit<LookupInstrument, 'id' | 'instrument_code' | 'created_at'>>) =>
    apiPatch<LookupInstrument>(`/api/master-data/instruments/${id}`, body),
  deleteInstrument: (id: string) => apiDelete(`/api/master-data/instruments/${id}`),

  // Sites
  listSites: (includeInactive = false) =>
    apiGet<LookupSite[]>('/api/master-data/sites', { include_inactive: includeInactive }),
  createSite: (body: { code: string; name: string }) =>
    apiPost<LookupSite>('/api/master-data/sites', body),
  updateSite: (id: string, body: { name?: string; is_active?: boolean }) =>
    apiPatch<LookupSite>(`/api/master-data/sites/${id}`, body),
  deleteSite: (id: string) => apiDelete(`/api/master-data/sites/${id}`),
  // Roles
  listRoles: (includeInactive = false) => apiGet<Role[]>('/api/roles', { include_inactive: includeInactive }),
  createRole: (body: { code: string; name: string; description?: string }) => apiPost<Role>('/api/roles', body),
  updateRole: (id: string, body: { name?: string; description?: string; is_active?: boolean }) => apiPatch<Role>(`/api/roles/${id}`, body),
  deleteRole: (id: string) => apiDelete(`/api/roles/${id}`),

  // Departments
  listDepts: () => apiGet<DepartmentOut[]>('/api/departments'),
  createDept: (body: DepartmentCreate) => apiPost<DepartmentOut>('/api/departments', body),
  updateDept: (id: string, body: DepartmentUpdate) => apiPatch<DepartmentOut>(`/api/departments/${id}`, body),
  deleteDept: (id: string) => apiDelete(`/api/departments/${id}`),

  // Users
  listUsers: (params?: Record<string, unknown>) => apiGet<PaginatedResponse<UserOut>>('/api/users', params),
  createUser: (body: UserCreate) => apiPost<UserOut>('/api/users', body),
  getUser: (id: string) => apiGet<UserOut>(`/api/users/${id}`),
  updateUser: (id: string, body: UserUpdate) => apiPatch<UserOut>(`/api/users/${id}`, body),
  resetPassword: (id: string, new_password: string) =>
    apiPost(`/api/users/${id}/reset-password`, { new_password }),
  deactivateUser: (id: string) => apiDelete(`/api/users/${id}`),

}
