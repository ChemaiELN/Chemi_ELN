import type { PrivilegeKey } from '../store/privilegesSlice'
import type { MeResponse } from '../api/auth'

type PrivilegeUser = Pick<MeResponse, 'role_code' | 'department_code' | 'admin_privileges'> | null | undefined

const ROLE_GRANTS: Record<string, PrivilegeKey[]> = {
  HOD: ['master_data.manage'],
}

const ALL_ADMIN_KEYS: PrivilegeKey[] = [
  'admin.settings',
  'admin.excel_templates',
  'admin.notifications',
  'admin.role_privileges',
  'users.manage',
  'departments.manage',
  'master_data.manage',
]

export function isSuperAdmin(user: PrivilegeUser): boolean {
  return user?.role_code === 'SUPER_ADMIN' ||
    user?.role_code === 'DQA' ||
    (user?.role_code === 'HOD' && user?.department_code === 'QA')
}

export function isAdminPrivilegedRole(roleCode: string | null | undefined): boolean {
  return roleCode === 'SUPER_ADMIN' || roleCode === 'DQA'
}

export function resolveGrants(user: PrivilegeUser): PrivilegeKey[] {
  if (isSuperAdmin(user)) return ALL_ADMIN_KEYS
  const fromApi = (user?.admin_privileges ?? []) as PrivilegeKey[]
  if (fromApi.length > 0) return fromApi
  return ROLE_GRANTS[user?.role_code ?? ''] ?? []
}

// QA department users have view-only access to experiments — they can see
// everything but never edit a field. Mirrors the backend enforcement in
// app/shared/privileges.py::is_qa_view_only (which the experiment PATCH
// endpoint already 403s on); this lets the UI disable inputs up front instead
// of letting a QA user type and only find out via a failed save.
export function isQaViewOnly(user: PrivilegeUser): boolean {
  if (user?.role_code === 'SUPER_ADMIN') return false
  return user?.department_code === 'QA'
}
