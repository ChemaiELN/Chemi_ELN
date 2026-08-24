import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { NotFoundError } from '../../utils/errors'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../../utils/response'
import { InvGeneralLookup } from '../../models/index'
import { sequelize } from '../../database/connection'

const lookupRouter = Router()

// GET /lookup/types — distinct lookup_type values
lookupRouter.get('/lookup/types', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await sequelize.query<{ lookup_type: string }>(
      'SELECT DISTINCT lookup_type FROM inv_general_lookup ORDER BY lookup_type',
      { type: QueryTypes.SELECT },
    )
    const types = rows.map((r) => r.lookup_type)
    res.json(successResponse('Lookup types retrieved successfully.', types))
  } catch (err) {
    next(err)
  }
})

// GET /lookup — bare array, optional filter by lookup_type / active_only
// The frontend's lookupApi.list() (frontend/src/api/inventory.ts) types this as
// apiGet<Lookup[]>, i.e. a bare array like consumableTypeApi/equipmentTypeApi —
// not the {items,total,...} pagination envelope.
lookupRouter.get('/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lookup_type: lookupType, search, active_only: activeOnly } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (lookupType) where.lookupType = lookupType
    if (activeOnly === 'true') where.isActive = true
    if (search) {
      (where as any)[Op.or as any] = [
        { lookupValue: { [Op.iLike]: `%${search}%` } },
        { lookupCode: { [Op.iLike]: `%${search}%` } },
        { lookupType: { [Op.iLike]: `%${search}%` } },
      ]
    }
    const order: any = parseSort(req.query as Record<string, unknown>, InvGeneralLookup, [['createdAt', 'DESC']])

    if (!wantsPagination(req.query)) {
      const rows = await InvGeneralLookup.findAll({ where, order })
      res.json(successResponse('General lookups retrieved successfully.', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvGeneralLookup.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('General lookups retrieved successfully.', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /lookup — create
lookupRouter.post('/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lookupType, lookupValue, lookupCode, isActive } = req.body
    const now = new Date()
    const row = await InvGeneralLookup.create({
      lookupType,
      lookupValue,
      lookupCode,
      isActive: isActive ?? true,
      createdBy: req.user?.id ?? null,
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json(successResponse('General lookup created successfully.', row))
  } catch (err) {
    next(err)
  }
})

// GET /lookup/:id — get one
lookupRouter.get('/lookup/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvGeneralLookup.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('General lookup')
    res.json(successResponse('General lookup retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /lookup/:id — update
lookupRouter.patch('/lookup/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvGeneralLookup.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('General lookup')
    const { lookupType, lookupValue, lookupCode, isActive } = req.body
    await row.update({
      ...(lookupType !== undefined && { lookupType }),
      ...(lookupValue !== undefined && { lookupValue }),
      ...(lookupCode !== undefined && { lookupCode }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    res.json(successResponse('General lookup updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /lookup/:id/toggle — toggle isActive
lookupRouter.patch('/lookup/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvGeneralLookup.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('General lookup')
    await row.update({ isActive: !row.isActive, updatedAt: new Date() })
    res.json(successResponse('General lookup toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

export default lookupRouter
