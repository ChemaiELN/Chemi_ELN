import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { Lab, UserLab } from '../models/Lab.model'
import { Department } from '../models/Department.model'
import { sequelize } from '../database/connection'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

// GET /api/labs/lookup
router.get('/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { isActive: true }
    if (req.query.department_id) where.departmentId = req.query.department_id as string

    const labs = await Lab.findAll({
      where,
      attributes: ['id', 'code', 'name', 'departmentId'],
      order: [['name', 'ASC']],
    })
    res.json(successResponse('Labs retrieved successfully.', labs))
  } catch (err) {
    next(err)
  }
})

// GET /api/labs
router.get('/', authenticate, requirePrivilege('labs.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, is_active } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (req.query.department_id) where.departmentId = req.query.department_id as string
    if (is_active !== undefined) where.isActive = is_active === 'true'
    if (search) {
      where[Op.or as unknown as string] = ['name', 'code', '$department.name$'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }
    const order = parseSort(req.query as Record<string, unknown>, Lab, [['createdAt', 'DESC']])

    // The admin Labs table renders department_name and user_count as flat columns
    // (frontend/src/pages/admin/LabsPage.tsx:108,115) — a nested department object
    // left both blank. user_count counts distinct users via the many-to-many
    // user_labs join table, which is now the source of truth for lab assignment
    // (a user can belong to more than one lab).
    const withCounts = async (labs: Lab[]) => {
      const counts = await UserLab.findAll({
        attributes: ['labId', [sequelize.fn('COUNT', sequelize.col('user_id')), 'count']],
        group: ['labId'],
        raw: true,
      }) as unknown as Array<{ labId: string | null; count: string }>
      const countByLab = new Map(counts.map((c) => [String(c.labId), Number(c.count)]))
      return labs.map((l: any) => {
        const plain = l.toJSON()
        const dept = plain.department
        return {
          ...plain,
          department_code: dept?.code ?? null,
          department_name: dept?.name ?? null,
          user_count: countByLab.get(String(l.id)) ?? 0,
        }
      })
    }

    const include = [{ model: Department, as: 'department', attributes: ['id', 'code', 'name'] }]

    if (!wantsPagination(req.query)) {
      const labs = await Lab.findAll({ where, include, order })
      res.json(successResponse('Labs retrieved successfully.', await withCounts(labs)))
      return
    }

    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 10)
    const { rows, count } = await Lab.findAndCountAll({ where, include, order, limit, offset, distinct: true })
    res.json(listResponse('Labs retrieved successfully.', await withCounts(rows), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

const LabSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  department_id: z.string().uuid(),
})

// POST /api/labs
router.post('/', authenticate, requirePrivilege('labs.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LabSchema.parse(req.body)
    const lab = await Lab.create({
      code: body.code,
      name: body.name,
      description: body.description || null,
      departmentId: body.department_id,
      createdBy: req.user!.id,
    })
    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'LAB', entityId: lab.id, entityRef: lab.name,
      newValue: { code: lab.code, name: lab.name, description: lab.description, department_id: lab.departmentId },
    })
    res.status(201).json(successResponse('Lab created successfully.', lab))
  } catch (err) {
    next(err)
  }
})

// GET /api/labs/:lab_id
router.get('/:labId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lab = await Lab.findByPk(req.params.labId as string, {
      include: [{ model: Department, as: 'department', attributes: ['id', 'code', 'name'] }],
    })
    if (!lab) throw new NotFoundError('Lab')
    res.json(successResponse('Lab details retrieved successfully.', lab))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/labs/:lab_id
router.patch('/:labId', authenticate, requirePrivilege('labs.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lab = await Lab.findByPk(req.params.labId as string)
    if (!lab) throw new NotFoundError('Lab')
    const before = { code: lab.code, name: lab.name, description: lab.description, department_id: lab.departmentId }
    const body = LabSchema.partial().parse(req.body)
    await lab.update({
      ...(body.code && { code: body.code }),
      ...(body.name && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.department_id && { departmentId: body.department_id }),
    })
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'LAB', entityId: lab.id, entityRef: lab.name,
      oldValue: before, newValue: { code: lab.code, name: lab.name, description: lab.description, department_id: lab.departmentId },
    })
    res.json(successResponse('Lab updated successfully.', lab))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/labs/:lab_id
router.delete('/:labId', authenticate, requirePrivilege('labs.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lab = await Lab.findByPk(req.params.labId as string)
    if (!lab) throw new NotFoundError('Lab')
    await lab.update({ isActive: false })
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'LAB', entityId: lab.id, entityRef: lab.name,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
