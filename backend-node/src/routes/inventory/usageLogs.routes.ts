import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { InvUsageLog, InvEquipmentCatalogue, InvInstrumentCatalogue, InvColumnCatalogue } from '../../models/InventoryModels.model'
import { Experiment } from '../../models/Experiment.model'
import { Project } from '../../models/Project.model'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const usageLogRouter = Router()

// equipmentId/instrumentId/columnId and experimentId are plain FK columns with
// no Sequelize association, so the asset code / experiment code / project code
// shown in the usage-log tables have to be resolved with separate batch
// lookups — without this every one of those columns fell back to "NA".
async function attachUsageLogCodes(rows: InstanceType<typeof InvUsageLog>[]) {
  const equipmentIds = [...new Set(rows.filter((r) => r.targetKind === 'EQUIPMENT' && r.equipmentId).map((r) => r.equipmentId as number))]
  const instrumentIds = [...new Set(rows.filter((r) => r.targetKind === 'INSTRUMENT' && r.instrumentId).map((r) => r.instrumentId as number))]
  const columnIds = [...new Set(rows.filter((r) => r.targetKind === 'COLUMN' && r.columnId).map((r) => r.columnId as number))]
  const experimentIds = [...new Set(rows.filter((r) => r.experimentId).map((r) => r.experimentId as string))]

  const [equipmentRows, instrumentRows, columnRows, experimentRows] = await Promise.all([
    equipmentIds.length ? InvEquipmentCatalogue.findAll({ where: { id: equipmentIds }, attributes: ['id', 'assetId'] }) : [],
    instrumentIds.length ? InvInstrumentCatalogue.findAll({ where: { id: instrumentIds }, attributes: ['id', 'assetId'] }) : [],
    columnIds.length ? InvColumnCatalogue.findAll({ where: { id: columnIds }, attributes: ['id', 'columnId'] }) : [],
    experimentIds.length ? Experiment.findAll({ where: { id: experimentIds }, attributes: ['id', 'fullCode', 'projectId'] }) : [],
  ])
  const equipmentCodeById = new Map(equipmentRows.map((e: any) => [e.id, e.assetId]))
  const instrumentCodeById = new Map(instrumentRows.map((i: any) => [i.id, i.assetId]))
  const columnCodeById = new Map(columnRows.map((c: any) => [c.id, c.columnId]))
  const experimentById = new Map(experimentRows.map((e: any) => [e.id, e]))

  const projectIds = [...new Set(experimentRows.map((e: any) => e.projectId).filter(Boolean))]
  const projects = projectIds.length ? await Project.findAll({ where: { id: projectIds }, attributes: ['id', 'code'] }) : []
  const projectCodeById = new Map(projects.map((p: any) => [p.id, p.code]))

  return rows.map((log) => {
    const assetCode =
      log.targetKind === 'INSTRUMENT'
        ? instrumentCodeById.get(log.instrumentId) ?? null
        : log.targetKind === 'COLUMN'
          ? columnCodeById.get(log.columnId) ?? null
          : equipmentCodeById.get(log.equipmentId) ?? null
    const experiment = log.experimentId ? experimentById.get(log.experimentId) : null
    return {
      ...log.toJSON(),
      asset_code: assetCode,
      experiment_code: experiment?.fullCode ?? null,
      project_code: experiment?.projectId ? projectCodeById.get(experiment.projectId) ?? null : null,
    }
  })
}

// GET /usage-logs — paginated list
usageLogRouter.get('/usage-logs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { targetKind, equipmentId, instrumentId, columnId, fromDate, toDate, status } = req.query as Record<string, string>

    if (!targetKind) {
      return res.status(400).json({ success: false, message: 'targetKind is required' })
    }

    const where: Record<string, unknown> = { targetKind }
    if (equipmentId) where.equipmentId = parseInt(equipmentId, 10)
    if (instrumentId) where.instrumentId = parseInt(instrumentId, 10)
    if (columnId) where.columnId = parseInt(columnId, 10)
    // Lets a Usage Log control ask "is there already a running session for
    // this catalogue item?" — needed so the same equipment/instrument can be
    // referenced by a Usage Log field placed in more than one section and
    // still show one consistent Running/Ended state (see
    // UsageLogStartStopField.tsx).
    if (status) where.status = status
    if (fromDate || toDate) {
      where.startedAt = {}
      if (fromDate) (where.startedAt as any)[Op.gte] = new Date(fromDate)
      if (toDate) (where.startedAt as any)[Op.lte] = new Date(toDate)
    }

    const { count, rows } = await InvUsageLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['startedAt', 'DESC']],
    })
    const rowsWithCodes = await attachUsageLogCodes(rows)
    res.json(listResponse('Usage logs fetched', rowsWithCodes, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /usage-logs — start a usage session
usageLogRouter.post('/usage-logs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body
    const log = await InvUsageLog.create({
      targetKind: body.targetKind,
      equipmentId: body.equipmentId ?? null,
      instrumentId: body.instrumentId ?? null,
      columnId: body.columnId ?? null,
      previousProductCode: body.previousProductCode ?? null,
      previousBatchNo: body.previousBatchNo ?? null,
      referenceNo: body.referenceNo ?? null,
      documentName: body.documentName ?? null,
      usageRemarks: body.usageRemarks ?? null,
      status: 'ACTIVE',
      startedBy: (req as any).user?.id ?? body.startedBy ?? null,
      startedAt: new Date(),
      endedBy: null,
      endedAt: null,
      source: body.source ?? 'MANUAL',
      experimentId: body.experimentId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    // Set asset to IN_USE
    if (body.targetKind === 'EQUIPMENT' && body.equipmentId) {
      await InvEquipmentCatalogue.update({ status: 'IN_USE' }, { where: { id: body.equipmentId } })
    } else if (body.targetKind === 'INSTRUMENT' && body.instrumentId) {
      await InvInstrumentCatalogue.update({ status: 'IN_USE' }, { where: { id: body.instrumentId } })
    } else if (body.targetKind === 'COLUMN' && body.columnId) {
      await InvColumnCatalogue.update({ status: 'IN_USE' }, { where: { id: body.columnId } })
    }
    res.status(201).json(successResponse('Usage log started', log))
  } catch (err) {
    next(err)
  }
})

// PATCH /usage-logs/:id/end — end a usage session
usageLogRouter.patch('/usage-logs/:id/end', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { remarks } = req.body
    const log = await InvUsageLog.findByPk(id)
    if (!log) return res.status(404).json({ success: false, message: 'Usage log not found' })
    await log.update({
      endedAt: new Date(),
      endedBy: (req as any).user?.id ?? req.body.endedBy ?? null,
      status: 'COMPLETED',
      usageRemarks: remarks ?? log.usageRemarks,
    })
    // Reset asset to AVAILABLE and track column injections
    if (log.targetKind === 'EQUIPMENT' && log.equipmentId) {
      await InvEquipmentCatalogue.update({ status: 'AVAILABLE' }, { where: { id: log.equipmentId } })
    } else if (log.targetKind === 'INSTRUMENT' && log.instrumentId) {
      await InvInstrumentCatalogue.update({ status: 'AVAILABLE' }, { where: { id: log.instrumentId } })
    } else if (log.targetKind === 'COLUMN' && log.columnId) {
      await InvColumnCatalogue.update({ status: 'AVAILABLE' }, { where: { id: log.columnId } })
      const injectionCount = Number(req.body.injectionCount ?? 0)
      if (injectionCount > 0) {
        await InvColumnCatalogue.increment('cumulativeInjections', { by: injectionCount, where: { id: log.columnId } })
      }
    }
    res.json(successResponse('Usage log ended', log))
  } catch (err) {
    next(err)
  }
})

// GET /usage-logs/status-history — grouped status history for a target
usageLogRouter.get('/usage-logs/status-history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      targetKind, targetId, equipmentId, instrumentId, columnId, fromDate, toDate,
    } = req.query as Record<string, string>
    if (!targetKind) {
      return res.status(400).json({ success: false, message: 'targetKind is required' })
    }

    const where: Record<string, unknown> = { targetKind }

    // The History tab sends equipment_id/instrument_id/column_id (matching the
    // rest of the usage-log endpoints) and never sends target_id, so accept
    // both spellings. The asset filter is optional — with none set the tab
    // shows every asset of that kind, which is what its UI implies.
    const perKind: Record<string, string | undefined> = {
      EQUIPMENT: equipmentId, INSTRUMENT: instrumentId, COLUMN: columnId,
    }
    const rawId = perKind[targetKind] ?? targetId
    if (rawId !== undefined && rawId !== null && String(rawId) !== '') {
      const idInt = parseInt(String(rawId), 10)
      if (targetKind === 'EQUIPMENT') where.equipmentId = idInt
      else if (targetKind === 'INSTRUMENT') where.instrumentId = idInt
      else if (targetKind === 'COLUMN') where.columnId = idInt
    }

    // from_date/to_date were accepted by the caller but never applied here, so
    // the range picker on the History tab did nothing.
    if (fromDate || toDate) {
      const range: Record<symbol, Date> = {}
      if (fromDate) range[Op.gte] = new Date(`${fromDate}T00:00:00`)
      if (toDate) range[Op.lte] = new Date(`${toDate}T23:59:59.999`)
      where.startedAt = range
    }

    const query = {
      where,
      order: [['startedAt', 'DESC']] as any,
      attributes: ['id', 'targetKind', 'equipmentId', 'instrumentId', 'columnId', 'experimentId', 'status', 'startedAt', 'endedAt', 'startedBy', 'endedBy', 'usageRemarks'],
    }

    if (!wantsPagination(req.query)) {
      const logs = await InvUsageLog.findAll(query)
      res.json(successResponse('Status history', await attachUsageLogCodes(logs)))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvUsageLog.findAndCountAll({ ...query, limit, offset })
    res.json(listResponse('Status history', await attachUsageLogCodes(rows), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /usage-logs/calendar — current month usage logs for calendar display
usageLogRouter.get('/usage-logs/calendar', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetKind } = req.query as Record<string, string>
    if (!targetKind) {
      return res.status(400).json({ success: false, message: 'targetKind is required' })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const logs = await InvUsageLog.findAll({
      where: {
        targetKind,
        startedAt: { [Op.between]: [startOfMonth, endOfMonth] },
      },
      order: [['startedAt', 'ASC']],
    })
    const logsWithCodes = await attachUsageLogCodes(logs)

    // Format for calendar: group by date
    const calendarMap: Record<string, typeof logsWithCodes> = {}
    logsWithCodes.forEach((log) => {
      const dateKey = log.startedAt ? new Date(log.startedAt).toISOString().split('T')[0] : 'unknown'
      if (!calendarMap[dateKey]) calendarMap[dateKey] = []
      calendarMap[dateKey].push(log)
    })

    const calendarData = Object.entries(calendarMap).map(([date, entries]) => ({ date, entries }))
    res.json(successResponse('Calendar usage logs', calendarData))
  } catch (err) {
    next(err)
  }
})

export default usageLogRouter
