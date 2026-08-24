import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import {
  successResponse,
  listResponse,
  parsePagination,
  buildPagination,
} from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { createUploader } from '../../middleware/upload.middleware'
import {
  InvEquipmentCatalogue,
  InvEquipmentType,
  InvInstrumentCatalogue,
  InvInstrumentType,
  InvColumnCatalogue,
  InvStorageLocation,
  InvUsageLog,
  InvSchedule,
} from '../../models/InventoryModels.model'

const storageLocationInclude = { model: InvStorageLocation, as: 'storageLocation' as const, attributes: ['id', 'name'], required: false }

// DUE_MAINTENANCE is computed at read time, never persisted — same pattern as
// the batch RETEST/EXPIRED status — so it can't go stale and doesn't need a
// scheduled job. An asset shows DUE_MAINTENANCE only while its stored status
// is still AVAILABLE (any work-order-driven status like UNDER_MAINTENANCE
// takes precedence) and it has a schedule past due with no work order raised.
async function withDueMaintenance<T extends { id: number; status: string }>(
  rows: T[],
  targetKind: 'EQUIPMENT' | 'INSTRUMENT',
): Promise<(T & { effective_status: string })[]> {
  const availableIds = rows.filter((r) => r.status === 'AVAILABLE').map((r) => r.id)
  if (!availableIds.length) {
    return rows.map((r) => ({ ...r, effective_status: r.status }))
  }
  const idField = targetKind === 'EQUIPMENT' ? 'equipmentId' : 'instrumentId'
  const overdue = await InvSchedule.findAll({
    where: {
      targetKind,
      [idField]: { [Op.in]: availableIds },
      status: { [Op.in]: ['DUE', 'PLANNED'] },
      dueDate: { [Op.lte]: new Date().toISOString().slice(0, 10) },
    },
    attributes: [idField],
  })
  const dueIds = new Set(overdue.map((s: any) => s[idField]))
  return rows.map((r) => ({
    ...r,
    effective_status: r.status === 'AVAILABLE' && dueIds.has(r.id) ? 'DUE_MAINTENANCE' : r.status,
  }))
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Equipment Router
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const equipmentRouter = Router()

const excelUploader = createUploader('inventory/uploads')
const memUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

equipmentRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, equipmentTypeId, departmentId, status, activeOnly } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { assetId: { [Op.iLike]: `%${search}%` } },
        { make: { [Op.iLike]: `%${search}%` } },
        { model: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
        { usageType: { [Op.iLike]: `%${search}%` } },
        { '$storageLocation.name$': { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (equipmentTypeId) where.equipmentTypeId = parseInt(equipmentTypeId, 10)
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    if (activeOnly === 'true' || activeOnly === '1') where.isActive = true

    const { count, rows } = await InvEquipmentCatalogue.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [storageLocationInclude],
    })

    const withStatus = await withDueMaintenance(rows.map((r) => r.toJSON() as any), 'EQUIPMENT')
    res.json(listResponse('Equipment catalogue', withStatus, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

equipmentRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await InvEquipmentCatalogue.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() })
    res.status(201).json(successResponse('Equipment created', record))
  } catch (err) { next(err) }
})

equipmentRouter.post('/upload', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const assetId = String(v[1] ?? '').trim()
      const name = String(v[2] ?? '').trim()
      if (!assetId) { errors.push({ row: rowNum, message: 'asset_id is required' }); continue }
      if (!name) { errors.push({ row: rowNum, message: 'name is required' }); continue }

      const exists = await InvEquipmentCatalogue.findOne({ where: { assetId } as any })
      if (exists) { errors.push({ row: rowNum, message: `Asset ID already exists: ${assetId}` }); continue }

      const typeName = String(v[3] ?? '').trim()
      let equipmentTypeId: number | null = null
      if (typeName) {
        const et = await InvEquipmentType.findOne({ where: { name: { [Op.iLike]: typeName } } as any })
        if (!et) { errors.push({ row: rowNum, message: `Equipment type not found: ${typeName}` }); continue }
        equipmentTypeId = et.id
      }

      const rec = await InvEquipmentCatalogue.create({
        assetId, name, equipmentTypeId,
        make: String(v[4] ?? '').trim() || null,
        model: String(v[5] ?? '').trim() || null,
        serialNo: String(v[6] ?? '').trim() || null,
        location: String(v[7] ?? '').trim() || null,
        usageType: String(v[8] ?? '').trim() || null,
        description: String(v[9] ?? '').trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

equipmentRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvEquipmentCatalogue.findByPk(id, { include: [storageLocationInclude] })
    if (!record) throw new NotFoundError('Equipment not found')
    const [withStatus] = await withDueMaintenance([record.toJSON() as any], 'EQUIPMENT')
    res.json(successResponse('Equipment', withStatus))
  } catch (err) { next(err) }
})

equipmentRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvEquipmentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Equipment not found')
    await record.update({ ...req.body, updatedAt: new Date() })
    res.json(successResponse('Equipment updated', record))
  } catch (err) { next(err) }
})

equipmentRouter.patch('/:id/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { status } = req.body as { status: string }
    const record = await InvEquipmentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Equipment not found')

    // An active usage session is the only thing that's allowed to put this
    // equipment IN_USE / take it back to AVAILABLE — manually overriding the
    // status here would desync it from the open InvUsageLog row (which would
    // stay ACTIVE/unclosed forever). Require ending the session first.
    const activeLog = await InvUsageLog.findOne({
      where: { targetKind: 'EQUIPMENT', equipmentId: record.id, status: 'ACTIVE' },
    })
    if (activeLog) {
      throw new BadRequestError(
        'This equipment has an active usage session — end it from Equipment Usage Logs before changing status.',
        'ACTIVE_USAGE_SESSION',
      )
    }

    await record.update({ status })
    res.json(successResponse('Equipment status updated', record))
  } catch (err) { next(err) }
})

equipmentRouter.delete('/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvEquipmentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Equipment not found')
    await record.update({ isActive: false })
    res.json(successResponse('Equipment deactivated', record))
  } catch (err) { next(err) }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Instrument Router
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const instrumentRouter = Router()

instrumentRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, instrumentTypeId, departmentId, status, activeOnly } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { assetId: { [Op.iLike]: `%${search}%` } },
        { make: { [Op.iLike]: `%${search}%` } },
        { model: { [Op.iLike]: `%${search}%` } },
        { '$storageLocation.name$': { [Op.iLike]: `%${search}%` } },
        { usageType: { [Op.iLike]: `%${search}%` } },
        { calibrationStatus: { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (instrumentTypeId) where.instrumentTypeId = parseInt(instrumentTypeId, 10)
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    if (activeOnly === 'true' || activeOnly === '1') where.isActive = true

    const { count, rows } = await InvInstrumentCatalogue.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [storageLocationInclude],
    })

    const withStatus = await withDueMaintenance(rows.map((r) => r.toJSON() as any), 'INSTRUMENT')
    res.json(listResponse('Instrument catalogue', withStatus, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

instrumentRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await InvInstrumentCatalogue.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() })
    res.status(201).json(successResponse('Instrument created', record))
  } catch (err) { next(err) }
})

instrumentRouter.post('/upload', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const assetId = String(v[1] ?? '').trim()
      const name = String(v[2] ?? '').trim()
      if (!assetId) { errors.push({ row: rowNum, message: 'asset_id is required' }); continue }
      if (!name) { errors.push({ row: rowNum, message: 'name is required' }); continue }

      const exists = await InvInstrumentCatalogue.findOne({ where: { assetId } as any })
      if (exists) { errors.push({ row: rowNum, message: `Asset ID already exists: ${assetId}` }); continue }

      const typeName = String(v[3] ?? '').trim()
      let instrumentTypeId: number | null = null
      if (typeName) {
        const it = await InvInstrumentType.findOne({ where: { name: { [Op.iLike]: typeName } } as any })
        if (!it) { errors.push({ row: rowNum, message: `Instrument type not found: ${typeName}` }); continue }
        instrumentTypeId = it.id
      }

      const loRange = v[9] ? parseFloat(String(v[9])) : null
      const upRange = v[11] ? parseFloat(String(v[11])) : null
      const reqCalib = String(v[13] ?? '').trim().toUpperCase() === 'YES'

      const rec = await InvInstrumentCatalogue.create({
        assetId, name, instrumentTypeId,
        make: String(v[4] ?? '').trim() || null,
        model: String(v[5] ?? '').trim() || null,
        serialNo: String(v[6] ?? '').trim() || null,
        location: String(v[7] ?? '').trim() || null,
        usageType: String(v[8] ?? '').trim() || null,
        lowerOperatingRange: isNaN(loRange as number) ? null : loRange,
        lowerUom: String(v[10] ?? '').trim() || null,
        upperOperatingRange: isNaN(upRange as number) ? null : upRange,
        upperUom: String(v[12] ?? '').trim() || null,
        requiredCalibration: reqCalib,
        description: String(v[14] ?? '').trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

instrumentRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvInstrumentCatalogue.findByPk(id, { include: [storageLocationInclude] })
    if (!record) throw new NotFoundError('Instrument not found')
    const [withStatus] = await withDueMaintenance([record.toJSON() as any], 'INSTRUMENT')
    res.json(successResponse('Instrument', withStatus))
  } catch (err) { next(err) }
})

instrumentRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvInstrumentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Instrument not found')
    await record.update({ ...req.body, updatedAt: new Date() })
    res.json(successResponse('Instrument updated', record))
  } catch (err) { next(err) }
})

instrumentRouter.patch('/:id/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { status } = req.body as { status: string }
    const record = await InvInstrumentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Instrument not found')

    // Same rule as equipment — an open usage session must be ended (via
    // Instrument Usage Logs) before the status can be changed manually.
    const activeLog = await InvUsageLog.findOne({
      where: { targetKind: 'INSTRUMENT', instrumentId: record.id, status: 'ACTIVE' },
    })
    if (activeLog) {
      throw new BadRequestError(
        'This instrument has an active usage session — end it from Instrument Usage Logs before changing status.',
        'ACTIVE_USAGE_SESSION',
      )
    }

    await record.update({ status })
    res.json(successResponse('Instrument status updated', record))
  } catch (err) { next(err) }
})

instrumentRouter.delete('/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvInstrumentCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Instrument not found')
    await record.update({ isActive: false })
    res.json(successResponse('Instrument deactivated', record))
  } catch (err) { next(err) }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Column Router
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const columnRouter = Router()

columnRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, columnTypeId, departmentId, status, activeOnly } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { columnId: { [Op.iLike]: `%${search}%` } },
        { manufacturer: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (columnTypeId) where.columnTypeId = parseInt(columnTypeId, 10)
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    if (activeOnly === 'true' || activeOnly === '1') where.isActive = true

    const { count, rows } = await InvColumnCatalogue.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    })

    res.json(listResponse('Column catalogue', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

columnRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await InvColumnCatalogue.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() })
    res.status(201).json(successResponse('Column created', record))
  } catch (err) { next(err) }
})

columnRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvColumnCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Column not found')
    res.json(successResponse('Column', record))
  } catch (err) { next(err) }
})

columnRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvColumnCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Column not found')
    await record.update({ ...req.body, updatedAt: new Date() })
    res.json(successResponse('Column updated', record))
  } catch (err) { next(err) }
})

columnRouter.delete('/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvColumnCatalogue.findByPk(id)
    if (!record) throw new NotFoundError('Column not found')
    await record.update({ isActive: false })
    res.json(successResponse('Column deactivated', record))
  } catch (err) { next(err) }
})


