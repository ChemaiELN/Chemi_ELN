import type { PrivilegeKey } from '../store/privilegesSlice'
import type { MeResponse } from '../api/auth'

type PrivilegeUser = Pick<MeResponse, 'role_code' | 'department_code'> | null | undefined

const ROLE_GRANTS: Record<string, PrivilegeKey[]> = {
  HOD: ['master_data.manage'],
}

// SUPER_ADMIN role has unconditional full access regardless of department.
// Legacy: a HOD in the QA department retains admin authority during migration.
// Mirrors the backend bypass in app/shared/privileges.py::user_has_privilege.
export function isSuperAdmin(user: PrivilegeUser): boolean {
  return user?.role_code === 'SUPER_ADMIN' ||
    (user?.role_code === 'HOD' && user?.department_code === 'QA')
}

export function resolveGrants(user: PrivilegeUser): PrivilegeKey[] {
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
