import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../utils/response'
import { NotFoundError, BadRequestError } from '../utils/errors'
import { Department } from '../models/Department.model'
import { Role } from '../models/Role.model'
import { User } from '../models/User.model'
import { DepartmentRoleMapping } from '../models/RolePrivilege.model'
import { sequelize } from '../database/connection'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

// GET /api/departments/lookup
router.get('/lookup', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const depts = await Department.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
    })
    res.json(successResponse('Departments retrieved successfully.', depts))
  } catch (err) {
    next(err)
  }
})

// GET /api/departments/role-mapping
router.get('/role-mapping', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await DepartmentRoleMapping.findAll()
    // Group by department_id
    const grouped: Record<string, string[]> = {}
    for (const m of mappings) {
      if (!grouped[m.departmentId]) grouped[m.departmentId] = []
      grouped[m.departmentId].push(m.roleId)
    }
    const result = Object.entries(grouped).map(([department_id, role_ids]) => ({
      department_id,
      role_ids,
    }))
    res.json(successResponse('Department role mapping retrieved successfully.', result))
  } catch (err) {
    next(err)
  }
})

// GET /api/departments
router.get('/', authenticate, requirePrivilege('departments.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, is_active } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (is_active !== undefined) where.isActive = is_active === 'true'
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
      ]
    }
    const order = parseSort(req.query as Record<string, unknown>, Department, [['createdAt', 'DESC']])

    const withUserCounts = async (depts: Department[]) => {
      // The admin Departments table has a user_count column
      // (frontend/src/pages/admin/DepartmentsPage.tsx:78), so count members per
      // department in one grouped query rather than N+1.
      const counts = await User.findAll({
        attributes: ['departmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['departmentId'],
        raw: true,
      }) as unknown as Array<{ departmentId: string | null; count: string }>
      const countByDept = new Map(counts.map((c) => [String(c.departmentId), Number(c.count)]))
      return depts.map((d: any) => ({
        ...d.toJSON(),
        user_count: countByDept.get(String(d.id)) ?? 0,
      }))
    }

    if (!wantsPagination(req.query)) {
      const depts = await Department.findAll({
        where,
        include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
        order,
      })
      res.json(successResponse('Departments retrieved successfully.', await withUserCounts(depts)))
      return
    }

    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 10)
    const { rows, count } = await Department.findAndCountAll({
      where,
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
      order,
      limit,
      offset,
      distinct: true,
    })
    res.json(listResponse('Departments retrieved successfully.', await withUserCounts(rows), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

const DeptSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
  role_ids: z.array(z.string().uuid()).optional(),
  // Only meaningful on PATCH (the table's Active switch sends this) — POST
  // always creates a department active.
  is_active: z.boolean().optional(),
})

// POST /api/departments
router.post('/', authenticate, requirePrivilege('departments.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = DeptSchema.parse(req.body)
    const dept = await Department.create({
      code: body.code,
      name: body.name,
      description: body.description || null,
      createdBy: req.user!.id,
    })

    if (body.role_ids?.length) {
      await DepartmentRoleMapping.bulkCreate(
        body.role_ids.map(rid => ({ departmentId: dept.id, roleId: rid })),
      )
    }

    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'DEPARTMENT', entityId: dept.id, entityRef: dept.name,
      newValue: { code: dept.code, name: dept.name, description: dept.description },
    })

    res.status(201).json(successResponse('Department created successfully.', dept))
  } catch (err) {
    next(err)
  }
})

// GET /api/departments/:dept_id
router.get('/:deptId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await Department.findByPk(req.params.deptId as string, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }],
    })
    if (!dept) throw new NotFoundError('Department')
    res.json(successResponse('Department details retrieved successfully.', dept))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/departments/:dept_id
router.patch('/:deptId', authenticate, requirePrivilege('departments.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await Department.findByPk(req.params.deptId as string)
    if (!dept) throw new NotFoundError('Department')

    const before = { code: dept.code, name: dept.name, description: dept.description }

    // Code is permanently immutable after creation (it's referenced across
    // access/workflow rules — see the frontend's edit-form hint), independent
    // of whether the department currently has users. Deactivation is
    // additionally blocked while active users remain (cosmetic name/description
    // edits stay allowed either way — nothing else depends on their value).
    if (req.body.code !== undefined && String(req.body.code) !== dept.code) {
      throw new BadRequestError("A department's code cannot be changed after creation.", 'DEPARTMENT_CODE_IMMUTABLE')
    }
    if (req.body.is_active === false || req.body.role_ids !== undefined) {
      const activeUsers = await User.count({ where: { departmentId: dept.id, isActive: true } })
      if (activeUsers > 0) {
        if (req.body.is_active === false) {
          throw new BadRequestError(
            `Cannot deactivate department because it has ${activeUsers} active user(s) assigned.`,
            'DEPARTMENT_HAS_ACTIVE_USERS',
          )
        }
        throw new BadRequestError(
          `Cannot change which roles this department offers because it has ${activeUsers} active user(s) assigned. Reassign them first.`,
          'DEPARTMENT_HAS_ACTIVE_USERS',
        )
      }
    }

    const body = DeptSchema.partial().parse(req.body)
    if (body.name !== undefined) dept.name = body.name
    if (body.description !== undefined) dept.description = body.description || null
    if (body.is_active !== undefined) dept.isActive = body.is_active
    await dept.save()

    if (body.role_ids !== undefined) {
      await DepartmentRoleMapping.destroy({ where: { departmentId: dept.id } })
      if (body.role_ids.length) {
        await DepartmentRoleMapping.bulkCreate(
          body.role_ids.map(rid => ({ departmentId: dept.id, roleId: rid })),
        )
      }
    }

    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'DEPARTMENT', entityId: dept.id, entityRef: dept.name,
      oldValue: before, newValue: { code: dept.code, name: dept.name, description: dept.description },
    })

    res.json(successResponse('Department updated successfully.', dept))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/departments/:dept_id — soft deactivate; block if active users
router.delete('/:deptId', authenticate, requirePrivilege('departments.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dept = await Department.findByPk(req.params.deptId as string)
    if (!dept) throw new NotFoundError('Department')

    const activeUsers = await User.count({ where: { departmentId: dept.id, isActive: true } })
    if (activeUsers > 0) {
      throw new BadRequestError(
        `Cannot deactivate department because it has ${activeUsers} active user(s) assigned.`,
        'DEPARTMENT_HAS_ACTIVE_USERS',
      )
    }

    await dept.update({ isActive: false })
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'DEPARTMENT', entityId: dept.id, entityRef: dept.name,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
