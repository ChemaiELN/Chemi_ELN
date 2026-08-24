import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { NotFoundError } from '../../utils/errors'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../../utils/response'
import {
  InvEquipmentType,
  InvInstrumentType,
  InvColumnType,
  InvConsumableType,
  InvStorageCondition,
  InvMeasurementMaster,
  InvSparePart,
} from '../../models/index'

/**
 * Every master-data list on this router shares one shape: optional active_only,
 * an ILIKE search across a few text columns, and optional pagination.
 *
 * Page params are opt-in — dozens of dropdown call sites still expect the bare
 * array this used to return, so the `{ items, total }` envelope only appears
 * when the caller actually asks for a page.
 */
async function listMasterData(
  model: any,
  label: string,
  req: Request,
  res: Response,
  opts: { searchFields: string[]; orderBy: string },
) {
  const { search, active_only: activeOnly } = req.query as Record<string, string>
  const where: Record<string, unknown> = {}
  if (activeOnly === 'true') where.isActive = true
  if (search) {
    where[Op.or as unknown as string] = opts.searchFields.map((f) => ({
      [f]: { [Op.iLike]: `%${search}%` },
    }))
  }
  const order: any = parseSort(req.query as Record<string, unknown>, model, [['createdAt', 'DESC']])

  if (!wantsPagination(req.query)) {
    res.json(successResponse(label, await model.findAll({ where, order })))
    return
  }
  const { page, limit, offset } = parsePagination(req.query, 10)
  const { rows, count } = await model.findAndCountAll({ where, order, limit, offset })
  res.json(listResponse(label, rows, buildPagination(page, limit, count)))
}

const TYPE_SEARCH = { searchFields: ['name', 'description'], orderBy: 'name' }

const router = Router()

// ── Equipment Types ───────────────────────────────────────────────────────────

router.get('/equipment-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvEquipmentType, 'Equipment types retrieved successfully.', req, res, TYPE_SEARCH)
  } catch (err) {
    next(err)
  }
})

router.post('/equipment-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, isActive } = req.body
    const row = await InvEquipmentType.create({
      code,
      name,
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
    })
    res.status(201).json(successResponse('Equipment type created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.get('/equipment-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvEquipmentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Equipment type')
    res.json(successResponse('Equipment type retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/equipment-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvEquipmentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Equipment type')
    const { code, name, description, isActive } = req.body
    await row.update({
      ...(code !== undefined && { code }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Equipment type updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/equipment-types/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvEquipmentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Equipment type')
    await row.update({ isActive: false })
    res.json(successResponse('Equipment type deactivated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/equipment-types/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvEquipmentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Equipment type')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Equipment type toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── Instrument Types ──────────────────────────────────────────────────────────

router.get('/instrument-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvInstrumentType, 'Instrument types retrieved successfully.', req, res, TYPE_SEARCH)
  } catch (err) {
    next(err)
  }
})

router.post('/instrument-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, isActive } = req.body
    const row = await InvInstrumentType.create({
      code,
      name,
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
    })
    res.status(201).json(successResponse('Instrument type created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.get('/instrument-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvInstrumentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Instrument type')
    res.json(successResponse('Instrument type retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/instrument-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvInstrumentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Instrument type')
    const { code, name, description, isActive } = req.body
    await row.update({
      ...(code !== undefined && { code }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Instrument type updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/instrument-types/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvInstrumentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Instrument type')
    await row.update({ isActive: false })
    res.json(successResponse('Instrument type deactivated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/instrument-types/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvInstrumentType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Instrument type')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Instrument type toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── Column Types ──────────────────────────────────────────────────────────────

router.get('/column-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvColumnType, 'Column types retrieved successfully.', req, res, TYPE_SEARCH)
  } catch (err) {
    next(err)
  }
})

router.post('/column-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, lengthMm, particleSizeUm, poreSizeAngstrom, isActive } = req.body
    const row = await InvColumnType.create({
      code,
      name,
      description: description ?? null,
      lengthMm: lengthMm ?? null,
      particleSizeUm: particleSizeUm ?? null,
      poreSizeAngstrom: poreSizeAngstrom ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
    })
    res.status(201).json(successResponse('Column type created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.get('/column-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvColumnType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Column type')
    res.json(successResponse('Column type retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/column-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvColumnType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Column type')
    const { code, name, description, lengthMm, particleSizeUm, poreSizeAngstrom, isActive } = req.body
    await row.update({
      ...(code !== undefined && { code }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(lengthMm !== undefined && { lengthMm }),
      ...(particleSizeUm !== undefined && { particleSizeUm }),
      ...(poreSizeAngstrom !== undefined && { poreSizeAngstrom }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Column type updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/column-types/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvColumnType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Column type')
    await row.update({ isActive: false })
    res.json(successResponse('Column type deactivated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/column-types/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvColumnType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Column type')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Column type toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── Consumable Types ──────────────────────────────────────────────────────────

router.get('/consumable-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvConsumableType, 'Consumable types retrieved successfully.', req, res, { searchFields: ['name', 'description'], orderBy: 'name' })
  } catch (err) {
    next(err)
  }
})

router.post('/consumable-types', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, isActive } = req.body
    const row = await InvConsumableType.create({
      name,
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Consumable type created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.get('/consumable-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    res.json(successResponse('Consumable type retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/consumable-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    const { name, description, isActive } = req.body
    await row.update({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Consumable type updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/consumable-types/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Consumable type toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/consumable-types/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvConsumableType.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Consumable type')
    await row.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Storage Conditions ────────────────────────────────────────────────────────

router.get('/storage-conditions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvStorageCondition, 'Storage conditions retrieved successfully.', req, res, { searchFields: ['label', 'description'], orderBy: 'label' })
  } catch (err) {
    next(err)
  }
})

router.post('/storage-conditions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, temperatureMin, temperatureMax, temperatureUnit, description, isActive } = req.body
    const row = await InvStorageCondition.create({
      label,
      temperatureMin: temperatureMin ?? null,
      temperatureMax: temperatureMax ?? null,
      temperatureUnit: temperatureUnit ?? '°C',
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Storage condition created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/storage-conditions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    const { label, temperatureMin, temperatureMax, temperatureUnit, description, isActive } = req.body
    await row.update({
      ...(label !== undefined && { label }),
      ...(temperatureMin !== undefined && { temperatureMin }),
      ...(temperatureMax !== undefined && { temperatureMax }),
      ...(temperatureUnit !== undefined && { temperatureUnit }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Storage condition updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/storage-conditions/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Storage condition toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/storage-conditions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvStorageCondition.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Storage condition')
    await row.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Measurement Master ────────────────────────────────────────────────────────

router.get('/measurement-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvMeasurementMaster, 'Measurement master retrieved successfully.', req, res, { searchFields: ['name'], orderBy: 'name' })
  } catch (err) {
    next(err)
  }
})

router.post('/measurement-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, dataType, uom, isActive } = req.body
    const row = await InvMeasurementMaster.create({
      name,
      dataType: dataType ?? 'DECIMAL',
      uom: uom ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
    })
    res.status(201).json(successResponse('Measurement master entry created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/measurement-master/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvMeasurementMaster.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Measurement master entry')
    const { name, dataType, uom, isActive } = req.body
    await row.update({
      ...(name !== undefined && { name }),
      ...(dataType !== undefined && { dataType }),
      ...(uom !== undefined && { uom }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Measurement master entry updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/measurement-master/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvMeasurementMaster.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Measurement master entry')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Measurement master entry toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── Spare Parts ───────────────────────────────────────────────────────────────

router.get('/spare-parts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listMasterData(InvSparePart, 'Spare parts retrieved successfully.', req, res, { searchFields: ['partCode', 'name', 'description'], orderBy: 'partCode' })
  } catch (err) {
    next(err)
  }
})

router.post('/spare-parts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { partCode, name, description, isActive } = req.body
    const row = await InvSparePart.create({
      partCode,
      name,
      description: description ?? null,
      isActive: isActive ?? true,
      createdAt: new Date(),
    })
    res.status(201).json(successResponse('Spare part created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/spare-parts/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvSparePart.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Spare part')
    const { partCode, name, description, isActive } = req.body
    await row.update({
      ...(partCode !== undefined && { partCode }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Spare part updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/spare-parts/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvSparePart.findByPk(req.params.id as string)
    if (!row) throw new NotFoundError('Spare part')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Spare part toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

export default router
