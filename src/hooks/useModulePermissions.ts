import { usePrivileges } from '@/common/PrivilegesContext'
import {
  NOTEBOOK_ADMIN_PRIVILEGES,
  PRIV,
  PROJECT_ACCESS_PRIVILEGES,
} from '@/utilities/privileges'

export function useProjectPermissions() {
  const { has, hasAny } = usePrivileges()
  return {
    canAccess:  hasAny(PROJECT_ACCESS_PRIVILEGES),
    canCreate:  has(PRIV.PROJECTS_CREATE),
    canEdit:    has(PRIV.PROJECTS_EDIT),
    canRoutes:  has(PRIV.PROJECTS_ROUTES),
  }
}

export function useNotebookPermissions() {
  const { has } = usePrivileges()
  return {
    canCreate:      has(PRIV.NOTEBOOKS_CREATE),
    canEdit:        has(PRIV.NOTEBOOKS_EDIT),
    canPermissions: has(PRIV.NOTEBOOKS_PERMISSIONS),
    canAdmin:       has(PRIV.NOTEBOOKS_CREATE) || has(PRIV.NOTEBOOKS_EDIT) || has(PRIV.NOTEBOOKS_PERMISSIONS),
  }
}
