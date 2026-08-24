import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse } from '../utils/response'
import { BadRequestError } from '../utils/errors'
import { sequelize } from '../database/connection'
import { DepartmentRolePrivilege } from '../models/DepartmentRolePrivilege.model'
import { Department } from '../models/Department.model'
import { Role } from '../models/Role.model'
import { catalogByModule, isKnownPrivilegeKey, type PrivilegeModule } from '../shared/privilegeCatalog'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

const MODULES = ['ADC', 'CGT', 'ARD', 'INVENTORY'] as const

// GET /api/department-role-privileges/catalog?module=ADC
// Grouped catalog that drives the admin matrix UI.
router.get('/catalog', authenticate, requirePrivilege('admin.role_privileges'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const mod = (req.query.module as string | undefined)?.toUpperCase() ?? 'ADC'
    if (!MODULES.includes(mod as PrivilegeModule)) {
      throw new BadRequestError(`Unknown module. Expected one of: ${MODULES.join(', ')}`)
    }
    res.json(successResponse('Privilege catalog retrieved successfully.', {
      module: mod,
      groups: catalogByModule(mod as PrivilegeModule),
    }))
  } catch (err) {
    next(err)
  }
})

const ListQuerySchema = z.object({
  department_id: z.string().uuid(),
  role_id: z.string().uuid(),
})

// GET /api/department-role-privileges?department_id=&role_id=
// Returns the granted keys for one (department, role) pair.
router.get('/', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = ListQuerySchema.parse(req.query)

    const rows = await DepartmentRolePrivilege.findAll({
      where: { departmentId: q.department_id, roleId: q.role_id, isGranted: true },
      attributes: ['privilegeKey'],
    })

    res.json(successResponse('Department role privileges retrieved successfully.', {
      department_id: q.department_id,
      role_id: q.role_id,
      granted: rows.map((r) => r.privilegeKey),
    }))
  } catch (err) {
    next(err)
  }
})

const SaveSchema = z.object({
  department_id: z.string().uuid(),
  role_id: z.string().uuid(),
  grants: z.array(z.object({
    privilege_key: z.string().min(1),
    is_granted: z.boolean(),
  })),
})

// PUT /api/department-role-privileges — bulk save one (department, role) matrix.
router.put('/', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SaveSchema.parse(req.body)

    const unknown = body.grants.map((g) => g.privilege_key).filter((k) => !isKnownPrivilegeKey(k))
    if (unknown.length) {
      throw new BadRequestError(`Unknown privilege key(s): ${unknown.join(', ')}`)
    }

    const before = await DepartmentRolePrivilege.findAll({
      where: { departmentId: body.department_id, roleId: body.role_id },
      attributes: ['privilegeKey', 'isGranted'],
    })
    const beforeGranted = new Set(before.filter((r) => r.isGranted).map((r) => r.privilegeKey))

    // One transaction so a partial save can never leave a half-applied matrix.
    // Note: bulkCreate with updateOnDuplicate relies on the composite unique
    // constraint (department_id, role_id, privilege_key) — unlike the older
    // role_privileges table, which has no unique constraint and therefore
    // duplicates rows on every "upsert".
    await sequelize.transaction(async (tx) => {
      if (!body.grants.length) return
      await DepartmentRolePrivilege.bulkCreate(
        body.grants.map((g) => ({
          departmentId: body.department_id,
          roleId: body.role_id,
          privilegeKey: g.privilege_key,
          isGranted: g.is_granted,
          updatedBy: req.user!.id,
          updatedAt: new Date(),
        })),
        {
          transaction: tx,
          updateOnDuplicate: ['isGranted', 'updatedBy', 'updatedAt'],
        },
      )
    })

    const rows = await DepartmentRolePrivilege.findAll({
      where: { departmentId: body.department_id, roleId: body.role_id, isGranted: true },
      attributes: ['privilegeKey'],
    })

    const afterGranted = new Set(rows.map((r) => r.privilegeKey))
    const added = [...afterGranted].filter((k) => !beforeGranted.has(k))
    const removed = [...beforeGranted].filter((k) => !afterGranted.has(k))

    const [dept, role] = await Promise.all([
      Department.findByPk(body.department_id, { attributes: ['name'] }),
      Role.findByPk(body.role_id, { attributes: ['name'] }),
    ])
    const label = `${role?.name ?? body.role_id} in ${dept?.name ?? body.department_id}`
    const parts: string[] = []
    if (added.length) parts.push(`granted: ${added.join(', ')}`)
    if (removed.length) parts.push(`revoked: ${removed.join(', ')}`)

    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'DEPT_ROLE_PRIVILEGE',
      entityId: `${body.department_id}:${body.role_id}`, entityRef: label,
      newValue: { granted: [...afterGranted] },
      details: parts.length ? `${label} — ${parts.join('; ')}` : `${label} — no privilege changes`,
    })

    res.json(successResponse('Department role privileges updated successfully.', {
      department_id: body.department_id,
      role_id: body.role_id,
      granted: rows.map((r) => r.privilegeKey),
    }))
  } catch (err) {
    next(err)
  }
})

export default router
