import { User } from '../models/User.model'
import { Role } from '../models/Role.model'
import { Department } from '../models/Department.model'
import { RolePrivilege } from '../models/RolePrivilege.model'
import { ForbiddenError } from '../utils/errors'
import { Request, Response, NextFunction } from 'express'

export const PRIVILEGE_CATALOG: Record<string, string> = {
  'admin.settings': 'Manage global settings',
  'admin.excel_templates': 'Manage Excel templates',
  'admin.notifications': 'Manage notifications',
  'admin.role_privileges': 'Manage role privileges',
  'users.manage': 'Manage users',
  'departments.manage': 'Manage departments',
  'labs.manage': 'Manage labs',
  'master_data.manage': 'Manage master data',
  'calc_templates.manage': 'Manage calc templates',
  'project.manage': 'Manage projects',
  'notebook.manage': 'Manage notebooks',
  'experiment.manage': 'Manage experiments',
  'atr.manage': 'Manage ATR forms',
  'ard.manage': 'Manage ARD module',
}

// QA/QC/AD/IT departments always have access; HOD in QA too (legacy bypass)
const PRIVILEGED_DEPT_CODES = ['QA', 'QC', 'AD', 'IT']

export async function resolveAdminPrivileges(user: User): Promise<string[]> {
  const role = user.role as Role | undefined || await Role.findByPk(user.roleId || '')
  if (!role) return []

  if (role.code === 'SUPER_ADMIN' || role.code === 'DQA') {
    return Object.keys(PRIVILEGE_CATALOG)
  }

  const dept = user.department as Department | undefined ||
    (user.departmentId ? await Department.findByPk(user.departmentId) : null)

  if (!dept || !PRIVILEGED_DEPT_CODES.includes(dept.code)) return []

  if (role.code === 'HOD' && dept.code === 'QA') {
    return Object.keys(PRIVILEGE_CATALOG)
  }

  const grants = await RolePrivilege.findAll({
    where: { roleId: user.roleId || '', isGranted: true },
  })
  return grants.map(g => g.privilegeKey)
}

export async function userHasPrivilege(user: User, key: string): Promise<boolean> {
  const role = user.role as Role | undefined || await Role.findByPk(user.roleId || '')
  if (!role) return false

  // Super admin and DQA always have all privileges
  if (role.code === 'SUPER_ADMIN' || role.code === 'DQA') return true

  // Must be in privileged department
  const dept = user.department as Department | undefined ||
    (user.departmentId ? await Department.findByPk(user.departmentId) : null)

  if (!dept || !PRIVILEGED_DEPT_CODES.includes(dept.code)) return false

  // Legacy: HOD in QA has all privileges
  if (role.code === 'HOD' && dept.code === 'QA') return true

  // Check role_privileges table
  const grant = await RolePrivilege.findOne({
    where: { roleId: user.roleId || '', privilegeKey: key, isGranted: true },
  })
  return !!grant
}

export function requirePrivilege(key: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      const has = await userHasPrivilege(user, key)
      if (!has) throw new ForbiddenError()
      next()
    } catch (err) {
      next(err)
    }
  }
}

// Only HOD, TL, SUPER_ADMIN can create projects/notebooks/experiments
export const CREATOR_ROLES = ['HOD', 'TL', 'SUPER_ADMIN']

export async function requireCreatorRole(user: User): Promise<void> {
  const role = user.role as Role | undefined || await Role.findByPk(user.roleId || '')
  if (!role || !CREATOR_ROLES.includes(role.code)) {
    throw new ForbiddenError('Only HOD, TL, or Admin can perform this action.')
  }
  // QA dept users are view-only
  const dept = user.department as Department | undefined ||
    (user.departmentId ? await Department.findByPk(user.departmentId) : null)
  if (dept?.code === 'QA') {
    throw new ForbiddenError('QA department users are view-only for this resource.')
  }
}
