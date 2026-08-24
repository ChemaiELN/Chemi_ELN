import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../utils/response'
import { NotFoundError, BadRequestError } from '../utils/errors'
import { Role } from '../models/Role.model'
import { User } from '../models/User.model'
import { RolePrivilege, DepartmentRoleMapping } from '../models/RolePrivilege.model'
import { PRIVILEGE_CATALOG } from '../shared/privileges'
import { logAdminAudit } from '../utils/adminAudit'
import { sequelize } from '../database/connection'

const router = Router()

// GET /api/roles
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, is_active } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (req.query.include_inactive !== 'true') where.isActive = true
    if (is_active !== undefined) where.isActive = is_active === 'true'
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
      ]
    }
    const order = parseSort(req.query as Record<string, unknown>, Role, [['createdAt', 'DESC']])

    // The admin Roles table (and the active-user guards on PATCH/DELETE below)
    // depend on a `user_count` per role — compute it in one grouped query
    // rather than N+1, mirroring departments.routes.ts's withUserCounts.
    const withUserCounts = async (roles: Role[]) => {
      const counts = await User.findAll({
        attributes: ['roleId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        where: { isActive: true },
        group: ['roleId'],
        raw: true,
      }) as unknown as Array<{ roleId: string | null; count: string }>
      const countByRole = new Map(counts.map((c) => [String(c.roleId), Number(c.count)]))
      return roles.map((r: any) => ({
        ...r.toJSON(),
        user_count: countByRole.get(String(r.id)) ?? 0,
      }))
    }

    if (!wantsPagination(req.query)) {
      const roles = await Role.findAll({ where, order })
      res.json(successResponse('Roles retrieved successfully.', await withUserCounts(roles)))
      return
    }

    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 10)
    const { rows, count } = await Role.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Roles retrieved successfully.', await withUserCounts(rows), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

const RoleSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  department_ids: z.array(z.string().uuid()).min(1),
  // Only meaningful on PATCH (the table's Active switch sends this) — POST
  // always creates a role active, per Role.create above.
  is_active: z.boolean().optional(),
})

// POST /api/roles
router.post('/', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RoleSchema.parse(req.body)
    const role = await Role.create({
      code: body.code.toUpperCase(),
      name: body.name,
      description: body.description || null,
      isActive: true,
    })
    await DepartmentRoleMapping.bulkCreate(
      body.department_ids.map((departmentId) => ({ departmentId, roleId: role.id })),
    )
    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'ROLE', entityId: role.id, entityRef: role.name,
      newValue: { code: role.code, name: role.name, description: role.description },
    })
    res.status(201).json(successResponse('Role created successfully.', role))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/roles/:role_id
router.patch('/:roleId', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findByPk(req.params.roleId as string)
    if (!role) throw new NotFoundError('Role')
    const before = { code: role.code, name: role.name, description: role.description }

    // A role with active users holding it can still be renamed/re-described
    // (cosmetic, nothing else depends on those values), but its identity
    // (code) and department scoping are structural — changing them out from
    // under active users would silently change what those users can access.
    const activeUsers = await User.count({ where: { roleId: role.id, isActive: true } })
    if (activeUsers > 0) {
      if (req.body.code !== undefined && String(req.body.code).toUpperCase() !== role.code) {
        throw new BadRequestError(
          `Cannot change the code for this role because it has ${activeUsers} active user(s). Reassign them first.`,
          'ROLE_HAS_ACTIVE_USERS',
        )
      }
      if (req.body.department_ids !== undefined) {
        throw new BadRequestError(
          `Cannot change the department scoping for this role because it has ${activeUsers} active user(s). Reassign them first.`,
          'ROLE_HAS_ACTIVE_USERS',
        )
      }
      if (req.body.is_active === false) {
        throw new BadRequestError(
          `Cannot deactivate this role because it has ${activeUsers} active user(s) assigned.`,
          'ROLE_HAS_ACTIVE_USERS',
        )
      }
    }

    const body = RoleSchema.partial().parse(req.body)
    await role.update({
      ...(body.code && { code: body.code.toUpperCase() }),
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    })
    if (body.department_ids !== undefined) {
      await DepartmentRoleMapping.destroy({ where: { roleId: role.id } })
      await DepartmentRoleMapping.bulkCreate(
        body.department_ids.map((departmentId) => ({ departmentId, roleId: role.id })),
      )
    }
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'ROLE', entityId: role.id, entityRef: role.name,
      oldValue: before, newValue: { code: role.code, name: role.name, description: role.description },
    })
    res.json(successResponse('Role updated successfully.', role))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/roles/:role_id
router.delete('/:roleId', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findByPk(req.params.roleId as string)
    if (!role) throw new NotFoundError('Role')

    const activeUsers = await User.count({ where: { roleId: role.id, isActive: true } })
    if (activeUsers > 0) {
      throw new BadRequestError(
        `Cannot deactivate this role because it has ${activeUsers} active user(s) assigned.`,
        'ROLE_HAS_ACTIVE_USERS',
      )
    }

    await role.update({ isActive: false })
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'ROLE', entityId: role.id, entityRef: role.name,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Role Privileges ─────────────────────────────────────────────────────────
const rolePrivRouter = Router()

// GET /api/role-privileges
rolePrivRouter.get('/', authenticate, requirePrivilege('admin.role_privileges'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await Role.findAll({ where: { isActive: true }, order: [['name', 'ASC']] })
    const grants = await RolePrivilege.findAll()
    const privileges = Object.keys(PRIVILEGE_CATALOG)

    res.json(successResponse('Role privileges retrieved successfully.', {
      roles: roles.map(r => ({ id: r.id, code: r.code, name: r.name })),
      privileges,
      grants: grants.map(g => ({
        role_id: g.roleId,
        privilege_key: g.privilegeKey,
        is_granted: g.isGranted,
      })),
    }))
  } catch (err) {
    next(err)
  }
})

// PUT /api/role-privileges — bulk save matrix
rolePrivRouter.put('/', authenticate, requirePrivilege('admin.role_privileges'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { grants } = z.object({
      grants: z.array(z.object({
        role_id: z.string().uuid(),
        privilege_key: z.string(),
        is_granted: z.boolean(),
      })),
    }).parse(req.body)

    const roleIds = [...new Set(grants.map((g) => g.role_id))]
    const before = await RolePrivilege.findAll({ where: { roleId: roleIds } })
    const beforeGranted = new Set(before.filter((r) => r.isGranted).map((r) => `${r.roleId}:${r.privilegeKey}`))

    // Upsert each grant
    for (const g of grants) {
      await RolePrivilege.upsert({
        roleId: g.role_id,
        privilegeKey: g.privilege_key,
        isGranted: g.is_granted,
        updatedBy: req.user!.id,
        updatedAt: new Date(),
      })
    }

    const roles = await Role.findAll({ where: { id: roleIds }, attributes: ['id', 'name'] })
    const roleName = new Map(roles.map((r) => [r.id, r.name]))

    const perRoleChanges = new Map<string, { granted: string[]; revoked: string[] }>()
    for (const g of grants) {
      const key = `${g.role_id}:${g.privilege_key}`
      const wasGranted = beforeGranted.has(key)
      if (wasGranted === g.is_granted) continue
      if (!perRoleChanges.has(g.role_id)) perRoleChanges.set(g.role_id, { granted: [], revoked: [] })
      const bucket = perRoleChanges.get(g.role_id)!
      ;(g.is_granted ? bucket.granted : bucket.revoked).push(g.privilege_key)
    }
    const details = [...perRoleChanges.entries()].map(([roleId, c]) => {
      const parts: string[] = []
      if (c.granted.length) parts.push(`granted: ${c.granted.join(', ')}`)
      if (c.revoked.length) parts.push(`revoked: ${c.revoked.join(', ')}`)
      return `${roleName.get(roleId) ?? roleId} — ${parts.join('; ')}`
    })

    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'ROLE_PRIVILEGE', entityId: null,
      entityRef: roleIds.map((id) => roleName.get(id) ?? id).join(', '),
      newValue: { granted: grants.filter((g) => g.is_granted).map((g) => g.privilege_key) },
      details: details.length ? details.join(' | ') : 'No privilege changes',
    })

    res.json(successResponse('Role privileges updated successfully.', null))
  } catch (err) {
    next(err)
  }
})

export { rolePrivRouter }
export default router
