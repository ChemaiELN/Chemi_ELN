import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { Op } from 'sequelize'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { InvStorageCondition } from '../../models/index'

const router = Router()

// GET /api/inventory/storage-conditions
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active_only: activeOnly } = req.query as Record<string, string>
    const where: any = {}
    if (activeOnly === 'true') where.isActive = true
    if (search) where.label = { [Op.iLike]: `%${search}%` }
    const order: any = [['createdAt', 'DESC']]

    if (!wantsPagination(req.query)) {
      const rows = await InvStorageCondition.findAll({ where, order })
      res.json(successResponse('Storage conditions', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvStorageCondition.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Storage conditions', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// POST /api/inventory/storage-conditions
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label } = z.object({ label: z.string().min(1) }).parse(req.body)
    const existing = await InvStorageCondition.findOne({ where: { label } })
    if (existing) throw new BadRequestError(`Storage condition "${label}" already exists`, 'CONFLICT')
    const row = await InvStorageCondition.create({ label, createdAt: new Date(), updatedAt: new Date() } as any)
    res.status(201).json(successResponse('Storage condition created', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/storage-conditions/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    const updates = z.object({ label: z.string().min(1).optional(), isActive: z.boolean().optional() }).parse(req.body)
    await row.update(updates)
    res.json(successResponse('Storage condition updated', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/storage-conditions/:id/toggle
router.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    await row.update({ isActive: !row.isActive })
    const state = row.isActive ? 'activated' : 'deactivated'
    res.json(successResponse(`${row.label} ${state}`, { ...row.toJSON(), message: `${row.label} ${state}.` }))
  } catch (err) { next(err) }
})

// DELETE /api/inventory/storage-conditions/:id
router.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    await row.destroy()
    res.status(204).send()
  } catch (err) { next(err) }
})

export default router
