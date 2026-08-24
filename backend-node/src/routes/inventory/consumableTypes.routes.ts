import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { Op } from 'sequelize'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { InvConsumableType } from '../../models/index'

const router = Router()

// GET /api/inventory/consumable-types
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query as Record<string, string>
    const where: any = {}
    if (search) where.name = { [Op.iLike]: `%${search}%` }
    const order: any = [['createdAt', 'DESC']]

    // Dropdown callers send no page params and still get the bare array.
    if (!wantsPagination(req.query)) {
      const rows = await InvConsumableType.findAll({ where, order })
      res.json(successResponse('Consumable types', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvConsumableType.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Consumable types', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// POST /api/inventory/consumable-types
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body)
    const existing = await InvConsumableType.findOne({ where: { name } })
    if (existing) throw new BadRequestError(`Consumable type "${name}" already exists`, 'CONFLICT')
    const row = await InvConsumableType.create({ name, createdAt: new Date(), updatedAt: new Date() } as any)
    res.status(201).json(successResponse('Consumable type created', row))
  } catch (err) { next(err) }
})

// GET /api/inventory/consumable-types/:id
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    res.json(successResponse('Consumable type', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/consumable-types/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    const updates = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(req.body)
    await row.update(updates)
    res.json(successResponse('Consumable type updated', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/consumable-types/:id/toggle
router.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    await row.update({ isActive: !row.isActive })
    const state = row.isActive ? 'activated' : 'deactivated'
    res.json(successResponse(`${row.name} ${state}`, { ...row.toJSON(), message: `${row.name} ${state}.` }))
  } catch (err) { next(err) }
})

// DELETE /api/inventory/consumable-types/:id
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    await row.destroy()
    res.status(204).send()
  } catch (err) { next(err) }
})

export default router
