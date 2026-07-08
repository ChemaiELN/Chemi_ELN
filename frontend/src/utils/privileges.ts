import type { PrivilegeKey } from '../store/privilegesSlice'
import type { MeResponse } from '../api/auth'

type PrivilegeUser = Pick<MeResponse, 'role_code' | 'department_code'> | null | undefined

const ROLE_GRANTS: Record<string, PrivilegeKey[]> = {
  HOD: ['master_data.manage'],
}

// There is no dedicated "QA" role anymore — a HOD in the QA department carries
// the same full-admin authority the old role_code === 'QA' check used to grant.
// Mirrors the backend bypass in app/shared/privileges.py::user_has_privilege.
export function isSuperAdmin(user: PrivilegeUser): boolean {
  return user?.role_code === 'HOD' && user?.department_code === 'QA'
}

export function resolveGrants(user: PrivilegeUser): PrivilegeKey[] {
  return ROLE_GRANTS[user?.role_code ?? ''] ?? []
}
