import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { NotFoundError } from '../../utils/errors'
import { Op } from 'sequelize'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../../utils/response'
import { InvUomDimension, InvUomUnit } from '../../models/index'

const uomRouter = Router()

// ── UOM Dimensions ────────────────────────────────────────────────────────────

// GET /uom-master — list all dimensions with nested units
uomRouter.get('/uom-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query as Record<string, string>
    const where: any = {}
    if (search) where[Op.or] = [
      { dimensionKey: { [Op.iLike]: `%${search}%` } },
      { displayName: { [Op.iLike]: `%${search}%` } },
      { baseUnit: { [Op.iLike]: `%${search}%` } },
    ]
    const include = [{ model: InvUomUnit, as: 'units' }]
    const order: any = parseSort(req.query as Record<string, unknown>, InvUomDimension, [['sortOrder', 'ASC'], ['displayName', 'ASC']])

    if (!wantsPagination(req.query)) {
      const rows = await InvUomDimension.findAll({ where, include, order })
      res.json(successResponse('UOM dimensions retrieved successfully.', rows))
      return
    }
    // `distinct` so the hasMany units join does not inflate the count.
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvUomDimension.findAndCountAll({
      where, include, order, limit, offset, distinct: true,
    })
    res.json(listResponse('UOM dimensions retrieved successfully.', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /uom-master — create dimension
uomRouter.post('/uom-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dimensionKey, displayName, baseUnit, sortOrder, isActive } = req.body
    const row = await InvUomDimension.create({
      dimensionKey,
      displayName,
      baseUnit,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })
    res.status(201).json(successResponse('UOM dimension created successfully.', row))
  } catch (err) {
    next(err)
  }
})

// GET /uom-master/:dimensionKey — get by dimensionKey field
uomRouter.get('/uom-master/:dimensionKey', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvUomDimension.findOne({
      where: { dimensionKey: req.params.dimensionKey as string },
      include: [{ model: InvUomUnit, as: 'units' }],
    })
    if (!row) throw new NotFoundError('UOM dimension')
    res.json(successResponse('UOM dimension retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /uom-master/:dimensionId — update dimension
uomRouter.patch('/uom-master/:dimensionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvUomDimension.findByPk(req.params.dimensionId as string)
    if (!row) throw new NotFoundError('UOM dimension')
    const { dimensionKey, displayName, baseUnit, sortOrder, isActive } = req.body
    await row.update({
      ...(dimensionKey !== undefined && { dimensionKey }),
      ...(displayName !== undefined && { displayName }),
      ...(baseUnit !== undefined && { baseUnit }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('UOM dimension updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /uom-master/:dimensionId/toggle — toggle dimension isActive
uomRouter.patch('/uom-master/:dimensionId/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvUomDimension.findByPk(req.params.dimensionId as string)
    if (!row) throw new NotFoundError('UOM dimension')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('UOM dimension toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── UOM Units ─────────────────────────────────────────────────────────────────

// POST /uom-master/:dimensionId/units — create unit under dimension
uomRouter.post('/uom-master/:dimensionId/units', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dimensionId = parseInt(req.params.dimensionId as string, 10)
    const dimension = await InvUomDimension.findByPk(dimensionId)
    if (!dimension) throw new NotFoundError('UOM dimension')
    const { symbol, name, factorToBase, sortOrder, isActive } = req.body
    const unit = await InvUomUnit.create({
      dimensionId,
      symbol,
      name: name ?? null,
      factorToBase: factorToBase ?? 1,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    })
    res.status(201).json(successResponse('UOM unit created successfully.', unit))
  } catch (err) {
    next(err)
  }
})

// PATCH /uom-master/units/:unitId — update unit
uomRouter.patch('/uom-master/units/:unitId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await InvUomUnit.findByPk(req.params.unitId as string)
    if (!unit) throw new NotFoundError('UOM unit')
    const { symbol, name, factorToBase, sortOrder, isActive } = req.body
    await unit.update({
      ...(symbol !== undefined && { symbol }),
      ...(name !== undefined && { name }),
      ...(factorToBase !== undefined && { factorToBase }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('UOM unit updated successfully.', unit))
  } catch (err) {
    next(err)
  }
})

// PATCH /uom-master/units/:unitId/toggle — toggle unit isActive
uomRouter.patch('/uom-master/units/:unitId/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unit = await InvUomUnit.findByPk(req.params.unitId as string)
    if (!unit) throw new NotFoundError('UOM unit')
    await unit.update({ isActive: !unit.isActive })
    res.json(successResponse('UOM unit toggled successfully.', unit))
  } catch (err) {
    next(err)
  }
})

export default uomRouter
