/**
 * Privilege keys — kept in sync with backend/app/utils/privileges.py
 */
export const PRIV = {
  ADMIN_SETTINGS:       'admin.settings',
  ADMIN_TEMPLATES:      'admin.excel_templates',
  ADMIN_NOTIFICATIONS:  'admin.notifications',
  ADMIN_ROLE_PRIVS:     'admin.role_privileges',
  USERS_MANAGE:         'users.manage',
  DEPARTMENTS_MANAGE:   'departments.manage',
  MASTER_DATA_MANAGE:   'master_data.manage',
  PROJECTS_CREATE:      'projects.create',
  PROJECTS_EDIT:        'projects.edit',
  PROJECTS_ROUTES:      'projects.routes',
  NOTEBOOKS_CREATE:     'notebooks.create',
  NOTEBOOKS_EDIT:       'notebooks.edit',
  NOTEBOOKS_PERMISSIONS:'notebooks.permissions',
  EXPERIMENTS_VERIFY:   'experiments.verify',
  EXPERIMENTS_APPROVE:  'experiments.approve',
  EXPERIMENTS_UNLOCK:   'experiments.unlock',
  EXPERIMENTS_VOID:     'experiments.void',
  ATR_ASSIGN:           'atr.assign',
  ATR_UNLOCK:           'atr.unlock',
} as const

export type PrivilegeKey = typeof PRIV[keyof typeof PRIV]

export function isChemRole(role: string | undefined | null): boolean {
  return role === 'CHEM'
}

/** Privileges that unlock any admin-module navigation */
export const ADMIN_MODULE_PRIVILEGES: PrivilegeKey[] = [
  PRIV.USERS_MANAGE,
  PRIV.DEPARTMENTS_MANAGE,
  PRIV.MASTER_DATA_MANAGE,
  PRIV.ADMIN_ROLE_PRIVS,
  PRIV.ADMIN_SETTINGS,
  PRIV.ADMIN_TEMPLATES,
  PRIV.ADMIN_NOTIFICATIONS,
]

/** Any of these grants access to the Projects module (list + detail pages). */
export const PROJECT_ACCESS_PRIVILEGES: PrivilegeKey[] = [
  PRIV.PROJECTS_CREATE,
  PRIV.PROJECTS_EDIT,
  PRIV.PROJECTS_ROUTES,
]

/** Notebook list is visible to all authenticated users; these gate create/edit/admin actions. */
export const NOTEBOOK_ADMIN_PRIVILEGES: PrivilegeKey[] = [
  PRIV.NOTEBOOKS_CREATE,
  PRIV.NOTEBOOKS_EDIT,
  PRIV.NOTEBOOKS_PERMISSIONS,
]

export function hasPrivilege(
  privileges: Set<string> | string[] | undefined,
  key: PrivilegeKey | string,
): boolean {
  if (!privileges) return false
  const set = privileges instanceof Set ? privileges : new Set(privileges)
  return set.has(key)
}

export function hasAnyPrivilege(
  privileges: Set<string> | string[] | undefined,
  keys: (PrivilegeKey | string)[],
): boolean {
  return keys.some(k => hasPrivilege(privileges, k))
}

export function hasAnyAdminPrivilege(privileges: Set<string> | string[] | undefined): boolean {
  return hasAnyPrivilege(privileges, ADMIN_MODULE_PRIVILEGES)
}

/** Fallback when /me has not yet returned privileges (legacy cached user) */
export const DEFAULT_GRANTS: Record<string, readonly string[]> = {
  [PRIV.ADMIN_SETTINGS]:       ['QA'],
  [PRIV.ADMIN_TEMPLATES]:      ['QA'],
  [PRIV.ADMIN_NOTIFICATIONS]:  ['QA'],
  [PRIV.ADMIN_ROLE_PRIVS]:     ['QA'],
  [PRIV.USERS_MANAGE]:         ['QA'],
  [PRIV.DEPARTMENTS_MANAGE]:   ['QA'],
  [PRIV.MASTER_DATA_MANAGE]:   ['QA', 'HOD'],
  [PRIV.PROJECTS_CREATE]:      ['HOD'],
  [PRIV.PROJECTS_EDIT]:        ['QA', 'HOD', 'TL'],
  [PRIV.PROJECTS_ROUTES]:      ['QA', 'HOD', 'TL'],
  [PRIV.NOTEBOOKS_CREATE]:     ['QA', 'HOD', 'TL'],
  [PRIV.NOTEBOOKS_EDIT]:       ['QA', 'HOD', 'TL'],
  [PRIV.NOTEBOOKS_PERMISSIONS]:['QA', 'HOD', 'TL'],
  [PRIV.EXPERIMENTS_VERIFY]:   ['QA', 'HOD', 'TL'],
  [PRIV.EXPERIMENTS_APPROVE]:  ['QA', 'HOD'],
  [PRIV.EXPERIMENTS_UNLOCK]:   ['QA'],
  [PRIV.EXPERIMENTS_VOID]:     ['QA'],
  [PRIV.ATR_ASSIGN]:           ['QA', 'TL'],
  [PRIV.ATR_UNLOCK]:           ['QA'],
}

export function privilegesFromRole(roleCode: string): Set<string> {
  if (roleCode === 'QA') {
    return new Set(Object.keys(DEFAULT_GRANTS))
  }
  const granted = new Set<string>()
  for (const [key, roles] of Object.entries(DEFAULT_GRANTS)) {
    if (roles.includes(roleCode)) granted.add(key)
  }
  return granted
}

export function readStoredPrivileges(): Set<string> {
  try {
    const raw = localStorage.getItem('chemia_user')
    if (!raw) return new Set()
    const user = JSON.parse(raw) as { role?: string; privileges?: string[] }
    if (Array.isArray(user.privileges) && user.privileges.length > 0) {
      return new Set(user.privileges)
    }
    if (user.role) return privilegesFromRole(user.role)
  } catch { /* ignore */ }
  return new Set()
}
