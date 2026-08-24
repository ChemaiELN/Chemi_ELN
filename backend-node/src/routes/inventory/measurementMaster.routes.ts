import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { NotFoundError } from '../../utils/errors'
import { InvMeasurementMaster } from '../../models/index'

const router = Router()

// GET /api/inventory/measurement-master
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, active_only } = req.query as Record<string, string>
    const where: any = {}
    if (active_only === 'true') where.isActive = true
    if (search) where.name = { [Op.iLike]: `%${search}%` }
    const order: any = [['createdAt', 'DESC']]

    if (!wantsPagination(req.query)) {
      const rows = await InvMeasurementMaster.findAll({ where, order })
      res.json(successResponse('Measurement masters', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvMeasurementMaster.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Measurement masters', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// POST /api/inventory/measurement-master
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({ name: z.string().min(1) }).passthrough().parse(req.body)
    const row = await InvMeasurementMaster.create({ ...body, isActive: true, createdAt: new Date() } as any)
    res.status(201).json(successResponse('Measurement master created', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/measurement-master/:id
router.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvMeasurementMaster.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Measurement master')
    const updates = z.object({ name: z.string().min(1).optional(), isActive: z.boolean().optional() }).passthrough().parse(req.body)
    await row.update(updates)
    res.json(successResponse('Measurement master updated', row))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/measurement-master/:id/toggle
router.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvMeasurementMaster.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Measurement master')
    await row.update({ isActive: !row.isActive })
    const state = row.isActive ? 'activated' : 'deactivated'
    res.json(successResponse(`${row.name} ${state}`, { ...row.toJSON(), message: `${row.name} ${state}.` }))
  } catch (err) { next(err) }
})

export default router
