import { Request, Response, NextFunction } from 'express'
import { User } from '../models/User.model'
import { Role } from '../models/Role.model'
import { DepartmentRolePrivilege } from '../models/DepartmentRolePrivilege.model'
import { ForbiddenError } from '../utils/errors'
import { ALL_DEPT_PRIVILEGE_KEYS } from './privilegeCatalog'

/**
 * Resolution for the fine-grained (department, role) privileges.
 *
 * Deliberately separate from ./privileges.ts: that module gates the Admin
 * area on coarse role-only keys and applies a PRIVILEGED_DEPT_CODES
 * ('QA'/'QC'/'AD') filter that would deny every ADC_PD user outright. Nothing
 * here inherits that filter — grants are the only source of authority, apart
 * from the SUPER_ADMIN bypass.
 *
 * A user holds exactly one department and one role, so resolution is a single
 * lookup on that pair.
 */

async function roleOf(user: User): Promise<Role | null> {
  const cached = user.role as Role | undefined
  if (cached) return cached
  if (!user.roleId) return null
  return Role.findByPk(user.roleId)
}

async function isSuperAdmin(user: User): Promise<boolean> {
  const role = await roleOf(user)
  return role?.code === 'SUPER_ADMIN'
}

/**
 * Every privilege key granted to this user. SUPER_ADMIN receives the whole
 * catalog; anyone without a department or role receives nothing.
 */
export async function resolveUserPrivileges(user: User): Promise<string[]> {
  if (await isSuperAdmin(user)) return [...ALL_DEPT_PRIVILEGE_KEYS]
  if (!user.departmentId || !user.roleId) return []

  const rows = await DepartmentRolePrivilege.findAll({
    where: { departmentId: user.departmentId, roleId: user.roleId, isGranted: true },
    attributes: ['privilegeKey'],
  })
  return rows.map((r) => r.privilegeKey)
}

export async function userHasDeptPrivilege(user: User, key: string): Promise<boolean> {
  if (await isSuperAdmin(user)) return true
  if (!user.departmentId || !user.roleId) return false

  const grant = await DepartmentRolePrivilege.findOne({
    where: {
      departmentId: user.departmentId,
      roleId: user.roleId,
      privilegeKey: key,
      isGranted: true,
    },
    attributes: ['id'],
  })
  return !!grant
}

/**
 * Express guard. Mirrors requirePrivilege() in ./privileges.ts so route
 * definitions read the same way.
 */
export function requireDeptPrivilege(key: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      if (!(await userHasDeptPrivilege(user, key))) {
        throw new ForbiddenError('You do not have permission to perform this action.')
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Passes if the user holds ANY of the given keys. Used for the `.view` /
 * `.view_all` pairs on Project/Notebook/Experiment list & detail routes:
 * `.view_all` is a strictly stronger permission (unrestricted scope) than
 * `.view` (own/assigned scope only), so granting only `.view_all` must be
 * enough to view at all — requiring both to be checked in Admin would just
 * be a confusing extra step with no real security benefit.
 */
export function requireAnyDeptPrivilege(keys: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      const checks = await Promise.all(keys.map((key) => userHasDeptPrivilege(user, key)))
      if (!checks.some(Boolean)) {
        throw new ForbiddenError('You do not have permission to perform this action.')
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

/**
 * Guard whose privilege key depends on the request body — used by the section
 * signature endpoint, where signing as performer vs reviewer are separate
 * privileges on one route.
 */
export function requireDeptPrivilegeFor(pick: (req: Request) => string | null) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = pick(req)
      // A null key means "this request shape carries no privilege requirement";
      // the handler still validates the payload itself.
      if (key && !(await userHasDeptPrivilege(req.user!, key))) {
        throw new ForbiddenError('You do not have permission to perform this action.')
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
