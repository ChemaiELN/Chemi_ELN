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
import { NotFoundError } from '../../utils/errors'
import { createUploader } from '../../middleware/upload.middleware'
import {
  InvSchedule,
  InvEquipmentCatalogue,
  InvInstrumentCatalogue,
  InvLogMapping,
} from '../../models/InventoryModels.model'

const memUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// InvSchedule has no equipment_code/current_status/days_label columns of its
// own — the frontend (PlannerPage.tsx) expects them joined/computed here.
async function withAssetInfo(rows: any[]) {
  const equipmentIds = [...new Set(rows.filter((r) => r.targetKind === 'EQUIPMENT' && r.equipmentId).map((r) => r.equipmentId))]
  const instrumentIds = [...new Set(rows.filter((r) => r.targetKind === 'INSTRUMENT' && r.instrumentId).map((r) => r.instrumentId))]

  const [equipmentRows, instrumentRows] = await Promise.all([
    equipmentIds.length ? InvEquipmentCatalogue.findAll({ where: { id: equipmentIds }, attributes: ['id', 'assetId', 'status'] }) : [],
    instrumentIds.length ? InvInstrumentCatalogue.findAll({ where: { id: instrumentIds }, attributes: ['id', 'assetId', 'status'] }) : [],
  ])
  const equipmentById = new Map(equipmentRows.map((e) => [e.id, e]))
  const instrumentById = new Map(instrumentRows.map((i) => [i.id, i]))

  const today = new Date().toISOString().slice(0, 10)
  return rows.map((r) => {
    const asset = r.targetKind === 'EQUIPMENT' ? equipmentById.get(r.equipmentId) : instrumentById.get(r.instrumentId)

    let daysLabel: string | null = null
    if (r.status === 'DONE') {
      daysLabel = r.doneOn ? `Completed on ${r.doneOn}` : 'Completed'
    } else if (r.dueDate) {
      const diffDays = Math.round((new Date(r.dueDate).getTime() - new Date(today).getTime()) / 86400000)
      daysLabel = diffDays > 0 ? `${diffDays} day${diffDays === 1 ? '' : 's'} left`
        : diffDays < 0 ? `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} passed`
        : 'Due today'
    }

    // Mirrors withDueMaintenance in catalogue.routes.ts: an AVAILABLE asset
    // whose own schedule row is still DUE/PLANNED and past due shows as
    // DUE_MAINTENANCE/DUE_CALIBRATION instead of AVAILABLE — using this
    // row's own status/dueDate directly, no extra query needed since each
    // schedule row already represents the asset's own due/overdue state.
    const isOverdue = ['DUE', 'PLANNED'].includes(r.status) && r.dueDate && r.dueDate <= today
    const currentStatus = asset?.status === 'AVAILABLE' && isOverdue
      ? (r.logType === 'CALIBRATION' ? 'DUE_CALIBRATION' : 'DUE_MAINTENANCE')
      : (asset?.status ?? null)

    return {
      ...r,
      equipmentCode: asset?.assetId ?? null,
      currentStatus,
      daysLabel,
    }
  })
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Schedule Router
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const scheduleRouter = Router()

const excelUploader = createUploader('inventory/uploads')

// â”€â”€ List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

scheduleRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      targetKind, logType, scheduleType, equipmentId, instrumentId,
      status, calibrationSource, fromDate, toDate,
    } = req.query as Record<string, string>

    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (targetKind) where.targetKind = targetKind
    if (logType) where.logType = logType
    if (scheduleType) where.scheduleType = scheduleType
    if (equipmentId) where.equipmentId = parseInt(equipmentId, 10)
    if (instrumentId) where.instrumentId = parseInt(instrumentId, 10)
    if (status) where.status = status
    if (calibrationSource) where.calibrationSource = calibrationSource
    if (fromDate || toDate) {
      where.dueDate = {}
      if (fromDate) where.dueDate[Op.gte] = fromDate
      if (toDate) where.dueDate[Op.lte] = toDate
    }

    const { count, rows } = await InvSchedule.findAndCountAll({
      where,
      limit,
      offset,
      order: [['dueDate', 'ASC']],
    })

    const withAsset = await withAssetInfo(rows.map((r) => r.toJSON()))
    res.json(listResponse('Schedules', withAsset, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// â”€â”€ Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

scheduleRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    const { equipmentId, instrumentId, logType } = req.body as Record<string, unknown>

    // Resolve the checklist from the asset's official Log Mapping server-side —
    // never trust the client's (optional) checklist_id field for this. Without
    // this, a schedule created with no checklist attached slips past the "must
    // go through a work order" gate even when the asset has a mapped checklist,
    // letting Mark Complete close it out with no execution/verify/approve at all.
    let checklistId: number | null = null
    if (logType && (equipmentId || instrumentId)) {
      const mapping = await InvLogMapping.findOne({
        where: {
          logType: logType as string,
          ...(equipmentId ? { equipmentId: Number(equipmentId) } : { instrumentId: Number(instrumentId) }),
        },
      })
      checklistId = mapping?.checklistId ?? null
    }

    const record = await InvSchedule.create({
      ...req.body,
      checklistId,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Schedule created', record))
  } catch (err) { next(err) }
})

// â”€â”€ Upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCHEDULE_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 }
const VALID_TARGET_KINDS = new Set(['EQUIPMENT', 'INSTRUMENT'])
const VALID_LOG_TYPES = new Set(['MAINTENANCE', 'CLEANING', 'CALIBRATION'])
const VALID_CALIB_SOURCES = new Set(['INTERNAL', 'EXTERNAL'])

scheduleRouter.post('/upload', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetKind, logType, calibrationSource } = req.query as Record<string, string>
    if (!VALID_TARGET_KINDS.has(targetKind)) {
      res.status(400).json({ success: false, message: `target_kind must be EQUIPMENT or INSTRUMENT` }); return
    }
    if (!VALID_LOG_TYPES.has(logType)) {
      res.status(400).json({ success: false, message: `log_type must be MAINTENANCE, CLEANING, or CALIBRATION` }); return
    }
    if (targetKind === 'INSTRUMENT' && logType === 'CALIBRATION') {
      if (!calibrationSource || !VALID_CALIB_SOURCES.has(calibrationSource)) {
        res.status(400).json({ success: false, message: 'calibration_source (INTERNAL|EXTERNAL) required for instrument calibration' }); return
      }
    }

    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const userId = (req as any).user?.id as string | undefined
    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const assetIdRaw = String(v[1] ?? '').trim()
      const scheduleTypeRaw = String(v[2] ?? '').trim().replace(/\s+/g, '_').toUpperCase()
      const dueDateRaw = v[3]

      if (!assetIdRaw || !scheduleTypeRaw || !dueDateRaw) {
        errors.push({ row: rowNum, message: 'asset_id, schedule_type, and due_date are all required' }); continue
      }
      if (!SCHEDULE_MONTHS[scheduleTypeRaw]) {
        errors.push({ row: rowNum, message: `Invalid schedule_type: ${scheduleTypeRaw}` }); continue
      }

      let equipmentId: number | null = null
      let instrumentId: number | null = null
      if (targetKind === 'EQUIPMENT') {
        const eq = await InvEquipmentCatalogue.findOne({ where: { assetId: assetIdRaw } as any })
        if (!eq) { errors.push({ row: rowNum, message: `Equipment not found: ${assetIdRaw}` }); continue }
        equipmentId = eq.id
      } else {
        const ins = await InvInstrumentCatalogue.findOne({ where: { assetId: assetIdRaw } as any })
        if (!ins) { errors.push({ row: rowNum, message: `Instrument not found: ${assetIdRaw}` }); continue }
        instrumentId = ins.id
      }

      let dueDate: string
      if (dueDateRaw instanceof Date) {
        dueDate = dueDateRaw.toISOString().slice(0, 10)
      } else {
        dueDate = String(dueDateRaw).trim().slice(0, 10)
      }

      // Same server-side resolution as POST / — an uploaded schedule for an
      // asset with a mapped checklist must still go through the work order
      // gate, not just a direct Mark Complete.
      const mapping = await InvLogMapping.findOne({
        where: { logType, ...(equipmentId ? { equipmentId } : { instrumentId }) },
      })

      const rec = await InvSchedule.create({
        targetKind,
        equipmentId,
        instrumentId,
        logType,
        checklistId: mapping?.checklistId ?? null,
        scheduleType: scheduleTypeRaw,
        dueDate,
        calibrationSource: calibrationSource ?? null,
        status: 'DUE',
        source: 'EXCEL_UPLOAD',
        createdBy: userId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

// â”€â”€ Update â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

scheduleRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvSchedule.findByPk(id)
    if (!record) throw new NotFoundError('Schedule not found')
    await record.update(req.body)
    res.json(successResponse('Schedule updated', record))
  } catch (err) { next(err) }
})

// â”€â”€ Delete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

scheduleRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvSchedule.findByPk(id)
    if (!record) throw new NotFoundError('Schedule not found')
    await record.destroy()
    res.json(successResponse('Schedule deleted', null))
  } catch (err) { next(err) }
})

// â”€â”€ Complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

scheduleRouter.post('/:id/complete', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvSchedule.findByPk(id)
    if (!record) throw new NotFoundError('Schedule not found')

    const userId = (req as any).user?.id as string | undefined
    const now = new Date()

    await record.update({
      status: 'COMPLETED',
      doneOn: now.toISOString().slice(0, 10),
    })

    res.json(successResponse('Schedule marked as completed', {
      ...record.toJSON(),
      completedAt: now,
      completedBy: userId,
    }))
  } catch (err) { next(err) }
})

export default scheduleRouter

