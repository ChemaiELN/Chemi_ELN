import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { InvSparePart } from '../../models/index'

const router = Router()

// GET /api/inventory/spare-parts
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active_only } = req.query as Record<string, string>
    const where: any = {}
    if (active_only === 'true') where.isActive = true
    if (search) where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { partCode: { [Op.iLike]: `%${search}%` } },
    ]
    const order: any = [['createdAt', 'DESC']]

    if (!wantsPagination(req.query)) {
      const rows = await InvSparePart.findAll({ where, order })
      res.json(successResponse('Spare parts', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvSparePart.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Spare parts', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// POST /api/inventory/spare-parts
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      partCode: z.string().min(1),
      name: z.string().min(1),
    }).passthrough().parse(req.body)

    const existing = await InvSparePart.findOne({ where: { partCode: body.partCode } })
    if (existing) throw new BadRequestError(`Part code "${body.partCode}" already exists`, 'CONFLICT')

    const row = await InvSparePart.create({ ...body, isActive: true, createdAt: new Date() } as any)
    res.status(201).json(successResponse('Spare part created', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/spare-parts/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvSparePart.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Spare part')
    const updates = z.object({
      name: z.string().min(1).optional(),
      partCode: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
    }).passthrough().parse(req.body)
    await row.update(updates)
    res.json(successResponse('Spare part updated', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/spare-parts/:id/toggle
router.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvSparePart.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Spare part')
    await row.update({ isActive: !row.isActive })
    const state = row.isActive ? 'activated' : 'deactivated'
    res.json(successResponse(`${row.name} ${state}`, { ...row.toJSON(), message: `${row.name} ${state}.` }))
  } catch (err) { next(err) }
})

export default router
