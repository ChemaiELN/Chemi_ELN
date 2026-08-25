import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import {
  InvBatch,
  InvMaterial,
  InvStockRequest,
  InvEquipmentCatalogue,
  InvInstrumentCatalogue,
  InvWorkOrder,
  InvUsageLog,
} from '../../models/InventoryModels.model'
import { successResponse, listResponse, buildPagination, parsePagination } from '../../utils/response'

const reportsRouter = Router()

/**
 * ReportsPage.tsx used to filter each report's rows in the browser, which only
 * ever searched the page the server had already returned. Every report now
 * takes the same `search` param and matches it in SQL.
 */
function searchClause(search: string | undefined, fields: string[]): Record<string, unknown> {
  if (!search) return {}
  return { [Op.or as unknown as string]: fields.map((f) => ({ [f]: { [Op.iLike]: `%${search}%` } })) }
}

// Each report table sorts a different column by default (whichever the report
// is naturally ordered by), so `sortBy`/`sortDir` only override that when the
// requested column is in this report's own whitelist.
function resolveOrder(
  sortBy: string | undefined,
  sortDir: string | undefined,
  sortable: Record<string, string>,
  defaultColumn: string,
  defaultDir: 'ASC' | 'DESC' = 'DESC',
): [string, 'ASC' | 'DESC'] {
  const requested = sortBy ? sortable[sortBy] : undefined
  const column = requested || defaultColumn
  const dir = sortDir ? (sortDir === 'asc' ? 'ASC' : 'DESC') : (requested ? 'DESC' : defaultDir)
  return [column, dir]
}

// GET /reports/batch-inventory
reportsRouter.get('/reports/batch-inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { materialId, status, search, sortBy, sortDir } = req.query as Record<string, string>

    const where: Record<string, unknown> = { ...searchClause(search, ['batchNo', 'inhouseBatchNo']) }
    if (materialId) where.materialId = parseInt(materialId, 10)
    if (status) where.status = status

    const order = resolveOrder(sortBy, sortDir, {
      batch_no: 'batchNo', inhouse_batch_no: 'inhouseBatchNo', qty_received: 'qtyReceived', qty_available: 'qtyAvailable',
      status: 'status', mfg_date: 'mfgDate', expiry_date: 'expiryDate', gr_date: 'grDate',
    }, 'createdAt')

    const { count, rows } = await InvBatch.findAndCountAll({
      where,
      include: [{ model: InvMaterial, as: 'material' }],
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Batch inventory report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/expiry
reportsRouter.get('/reports/expiry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { expiredOnly, daysAhead, materialId, search, sortBy, sortDir } = req.query as Record<string, string>

    const today = new Date()
    const where: Record<string, unknown> = { ...searchClause(search, ['batchNo', 'inhouseBatchNo']) }

    if (materialId) where.materialId = parseInt(materialId, 10)

    if (expiredOnly === 'true') {
      where.expiryDate = { [Op.lt]: today.toISOString().split('T')[0] }
    } else if (daysAhead) {
      const ahead = new Date()
      ahead.setDate(today.getDate() + parseInt(daysAhead, 10))
      where.expiryDate = {
        [Op.lte]: ahead.toISOString().split('T')[0],
        [Op.ne]: null,
      }
    } else {
      where.expiryDate = { [Op.ne]: null }
    }

    const order = resolveOrder(sortBy, sortDir, {
      batch_no: 'batchNo', inhouse_batch_no: 'inhouseBatchNo', qty_available: 'qtyAvailable',
      status: 'status', expiry_date: 'expiryDate',
    }, 'expiryDate', 'ASC')

    const { count, rows } = await InvBatch.findAndCountAll({
      where,
      include: [{ model: InvMaterial, as: 'material' }],
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Expiry report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/stock-requests
reportsRouter.get('/reports/stock-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, criticality, search, sortBy, sortDir } = req.query as Record<string, string>

    const where: Record<string, unknown> = { ...searchClause(search, ['requestNo']) }
    if (status) where.status = status
    if (criticality) where.criticality = criticality

    const order = resolveOrder(sortBy, sortDir, {
      request_no: 'requestNo', qty_required: 'qtyRequired', criticality: 'criticality', status: 'status',
      created_at: 'createdAt', updated_at: 'updatedAt',
    }, 'createdAt')

    const { count, rows } = await InvStockRequest.findAndCountAll({
      where,
      include: [{ model: InvMaterial, as: 'material' }],
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Stock requests report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/equipment-status
reportsRouter.get('/reports/equipment-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, maintenanceStatus, search, sortBy, sortDir } = req.query as Record<string, string>

    const where: Record<string, unknown> = { ...searchClause(search, ['assetId', 'name']) }
    if (status) where.status = status
    if (maintenanceStatus) where.maintenanceStatus = maintenanceStatus

    const order = resolveOrder(sortBy, sortDir, {
      asset_id: 'assetId', name: 'name', make: 'make', model: 'model', location: 'location',
      status: 'status', maintenance_status: 'maintenanceStatus',
      last_maintenance_date: 'lastMaintenanceDate', next_maintenance_date: 'nextMaintenanceDate',
    }, 'name', 'ASC')

    const { count, rows } = await InvEquipmentCatalogue.findAndCountAll({
      where,
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Equipment status report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/instrument-status
reportsRouter.get('/reports/instrument-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, calibrationStatus, search, sortBy, sortDir } = req.query as Record<string, string>

    const where: Record<string, unknown> = { ...searchClause(search, ['assetId', 'name']) }
    if (status) where.status = status
    if (calibrationStatus) where.calibrationStatus = calibrationStatus

    const order = resolveOrder(sortBy, sortDir, {
      asset_id: 'assetId', name: 'name', make: 'make', model: 'model', location: 'location',
      status: 'status', calibration_status: 'calibrationStatus',
      last_calibration_date: 'lastCalibrationDate', next_calibration_date: 'nextCalibrationDate',
    }, 'name', 'ASC')

    const { count, rows } = await InvInstrumentCatalogue.findAndCountAll({
      where,
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Instrument status report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/work-orders
reportsRouter.get('/reports/work-orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { targetKind, kind, logType, status, fromDate, toDate, search, sortBy, sortDir } = req.query as Record<string, string>

    const where: Record<string, unknown> = { ...searchClause(search, ['workorderNo']) }
    if (targetKind) where.targetKind = targetKind
    if (kind) where.kind = kind
    if (logType) where.logType = logType
    if (status) where.status = status
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) (where.createdAt as any)[Op.gte] = new Date(fromDate)
      if (toDate) (where.createdAt as any)[Op.lte] = new Date(toDate)
    }

    const order = resolveOrder(sortBy, sortDir, {
      workorder_no: 'workorderNo', kind: 'kind', log_type: 'logType',
      calibration_source: 'calibrationSource', status: 'status', raised_by: 'raisedBy', raised_at: 'raisedAt',
      approved_by: 'approvedBy', approved_at: 'approvedAt',
    }, 'createdAt')

    const { count, rows } = await InvWorkOrder.findAndCountAll({
      where,
      order: [order],
      limit,
      offset,
    })
    res.json(listResponse('Work orders report', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /reports/usage-summary
// The frontend (ReportsPage.tsx's Usage Summary tab) expects one row per
// asset — asset_id, session_count, total_hours, last_used_at — not the raw
// per-session InvUsageLog rows this used to return verbatim (which has no
// such columns at all, so every one of those fields rendered blank/"—"/"NA").
// Aggregate the logs per equipment/instrument here instead.
reportsRouter.get('/reports/usage-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetKind, fromDate, toDate, search } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    if (!targetKind) {
      return res.status(400).json({ success: false, message: 'targetKind is required' })
    }

    const where: Record<string, unknown> = { targetKind }
    if (fromDate || toDate) {
      where.startedAt = {}
      if (fromDate) (where.startedAt as any)[Op.gte] = new Date(fromDate)
      if (toDate) (where.startedAt as any)[Op.lte] = new Date(toDate)
    }

    const logs = await InvUsageLog.findAll({ where, order: [['startedAt', 'DESC']] })

    const idField = targetKind === 'INSTRUMENT' ? 'instrumentId' : 'equipmentId'
    const byAsset = new Map<number, { sessionCount: number; totalHours: number; lastUsedAt: Date | null }>()
    const now = new Date()
    for (const log of logs) {
      const assetId = (log as any)[idField] as number | null
      if (!assetId) continue
      const started = log.startedAt ? new Date(log.startedAt) : null
      const ended = log.endedAt ? new Date(log.endedAt) : now
      const hours = started ? Math.max(0, (ended.getTime() - started.getTime()) / 3_600_000) : 0

      const entry = byAsset.get(assetId) ?? { sessionCount: 0, totalHours: 0, lastUsedAt: null }
      entry.sessionCount += 1
      entry.totalHours += hours
      if (started && (!entry.lastUsedAt || started > entry.lastUsedAt)) entry.lastUsedAt = started
      byAsset.set(assetId, entry)
    }

    const Model: any = targetKind === 'INSTRUMENT' ? InvInstrumentCatalogue : InvEquipmentCatalogue
    const ids = [...byAsset.keys()]
    const catalogueRows = ids.length ? await Model.findAll({ where: { id: ids }, attributes: ['id', 'assetId'] }) : []
    const codeById = new Map(catalogueRows.map((r: any) => [r.id, r.assetId]))

    const items = ids.map((id) => {
      const entry = byAsset.get(id)!
      return {
        id,
        asset_id: codeById.get(id) ?? null,
        session_count: entry.sessionCount,
        total_hours: Math.round(entry.totalHours * 100) / 100,
        last_used_at: entry.lastUsedAt,
      }
    }).sort((a, b) => b.session_count - a.session_count)

    // This report is aggregated in memory rather than in SQL, so search and
    // paging are applied to the finished rows instead of to the query.
    const matched = search
      ? items.filter((r) => String(r.asset_id ?? '').toLowerCase().includes(search.toLowerCase()))
      : items
    res.json(listResponse(
      'Usage summary report',
      matched.slice(offset, offset + limit),
      buildPagination(page, limit, matched.length),
    ))
  } catch (err) {
    next(err)
  }
})

export default reportsRouter
