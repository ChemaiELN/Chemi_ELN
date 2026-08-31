import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import {
  InvWorkOrder,
  InvWorkOrderResult,
  InvWorkOrderSignature,
  InvWorkOrderSpare,
  InvSparePart,
  InvCalibrationReference,
  InvSchedule,
  InvEquipmentCatalogue,
  InvInstrumentCatalogue,
  InvChecklistItem,
} from '../../models/InventoryModels.model'
import { successResponse, listResponse, buildPagination, parsePagination } from '../../utils/response'
import { enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings'
import { sequelize } from '../../database/connection'

// Same pattern as stockRequests.routes.ts's getPerformedBy() — store a
// human-readable identifier on raised_by/started_by/etc., not the raw user
// UUID, so the execution page can display it directly without a join.
function getPerformedBy(req: Request): string {
  const user = req.user!
  return (user as any).username ?? (user as any).email ?? String((user as any).id)
}

const workOrderRouter = Router()

// Same lightweight per-year counter pattern as stockRequests.routes.ts's
// generateRequestNo() — reuses the shared inv_batch_number_counter table with
// its own "WO_" prefixed key so its sequence stays independent.
async function generateWorkOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const key = `WO_${yy}`

  const t = await sequelize.transaction()
  try {
    const [rows] = await sequelize.query(
      `SELECT last_seq FROM inv_batch_number_counter WHERE year = :key FOR UPDATE`,
      { replacements: { key }, type: QueryTypes.SELECT, transaction: t },
    ) as [{ last_seq: number } | undefined]

    let seq: number
    if (!rows) {
      await sequelize.query(
        `INSERT INTO inv_batch_number_counter (year, last_seq) VALUES (:key, 1)`,
        { replacements: { key }, type: QueryTypes.INSERT, transaction: t },
      )
      seq = 1
    } else {
      seq = rows.last_seq + 1
      await sequelize.query(
        `UPDATE inv_batch_number_counter SET last_seq = :seq WHERE year = :key`,
        { replacements: { seq, key }, type: QueryTypes.UPDATE, transaction: t },
      )
    }

    await t.commit()
    return `WO/${yy}/${String(seq).padStart(5, '0')}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}

// Drives the equipment/instrument catalogue `status` field off the work
// order's own lifecycle, per the canonical status vocabulary:
//   raised (OPEN/RAISED)                       -> UNDER_MAINTENANCE / UNDER_CLEANING / UNDER_CALIBRATION
//   in progress / awaiting verify or approval   -> REVIEW_MAINTENANCE / CLEANING_PENDING / REVIEW_CALIBRATION
//   approved                                    -> AVAILABLE (+ last_*_date bumped, linked schedule closed)
//   any stage of a BREAKDOWN work order         -> BREAKDOWN throughout, until approved
async function applyWorkOrderCatalogueStatus(wo: InvWorkOrder, newWoStatus: string) {
  const isRaised = newWoStatus === 'OPEN' || newWoStatus === 'RAISED'
  const isReviewing = ['IN_PROGRESS', 'PENDING_VERIFICATION', 'PENDING_APPROVAL'].includes(newWoStatus)
  const isApproved = newWoStatus === 'APPROVED'

  let status: string | null = null
  if (wo.kind === 'BREAKDOWN') {
    status = isApproved ? 'AVAILABLE' : 'BREAKDOWN'
  } else if (isRaised) {
    status = wo.logType === 'CLEANING' ? 'UNDER_CLEANING' : wo.logType === 'CALIBRATION' ? 'UNDER_CALIBRATION' : 'UNDER_MAINTENANCE'
  } else if (isReviewing) {
    status = wo.logType === 'CLEANING' ? 'CLEANING_PENDING' : wo.logType === 'CALIBRATION' ? 'REVIEW_CALIBRATION' : 'REVIEW_MAINTENANCE'
  } else if (isApproved) {
    status = 'AVAILABLE'
  }
  if (!status) return

  const today = new Date().toISOString().slice(0, 10)
  if (wo.targetKind === 'EQUIPMENT' && wo.equipmentId) {
    await InvEquipmentCatalogue.update(
      { status, ...(isApproved ? { lastMaintenanceDate: today } : {}) },
      { where: { id: wo.equipmentId } },
    )
  } else if (wo.targetKind === 'INSTRUMENT' && wo.instrumentId) {
    // Instruments track both dates independently — bump whichever the
    // approved work order actually was (calibration vs. general maintenance).
    await InvInstrumentCatalogue.update(
      {
        status,
        ...(isApproved && wo.logType === 'CALIBRATION' ? { lastCalibrationDate: today } : {}),
        ...(isApproved && wo.logType !== 'CALIBRATION' ? { lastMaintenanceDate: today } : {}),
      },
      { where: { id: wo.instrumentId } },
    )
  }

  // Closing the loop: an approved work order completes its linked schedule,
  // so the same schedule doesn't sit DUE forever and immediately re-flip the
  // asset back to DUE_MAINTENANCE.
  if (isApproved && wo.scheduleId) {
    await InvSchedule.update(
      { status: 'DONE', doneOn: today },
      { where: { id: wo.scheduleId } },
    )
  }
}

// GET /work-orders/requests
// kind=UNPLANNED/BREAKDOWN (the only caller today — RequestsPage.tsx's
// DirectPickTab) lists equipment/instrument catalogue items directly, each
// flagged with whether it already has an open (non-approved) work order of
// that same kind so the "Raise" button can disable itself.
workOrderRouter.get('/work-orders/requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kind, targetKind, logType, calibrationSource, sortBy, sortDir, search, assetId, name, status } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    if (kind === 'UNPLANNED' || kind === 'BREAKDOWN') {
      const isInstrument = targetKind === 'INSTRUMENT'
      const Model: any = isInstrument ? InvInstrumentCatalogue : InvEquipmentCatalogue
      const idField = isInstrument ? 'instrumentId' : 'equipmentId'
      // sortBy arrives as the frontend's snake_case dataIndex (e.g. "asset_id") —
      // caseNormalize only aliases query *keys*, not string values.
      const sortColumnMap: Record<string, string> = { name: 'name', asset_id: 'assetId', status: 'status' }
      const order: [string, string][] = [[sortColumnMap[sortBy] ?? 'name', sortDir === 'desc' ? 'DESC' : 'ASC']]

      const where: any = { isActive: true }
      if (search) {
        (where as any)[Op.or as any] = [
          { assetId: { [Op.iLike]: `%${search}%` } },
          { name: { [Op.iLike]: `%${search}%` } },
        ]
      }
      // Per-column search filters (Unplanned/Breakdown request pickers)
      if (assetId) where.assetId = { [Op.iLike]: `%${assetId}%` }
      if (name) where.name = { [Op.iLike]: `%${name}%` }
      if (status) where.status = { [Op.iLike]: `%${status}%` }

      const { count, rows } = await Model.findAndCountAll({
        where,
        limit,
        offset,
        order,
      })

      const ids = rows.map((r: any) => r.id)
      const openWorkOrders = ids.length
        ? await InvWorkOrder.findAll({
          where: {
            kind,
            targetKind: isInstrument ? 'INSTRUMENT' : 'EQUIPMENT',
            [idField]: { [Op.in]: ids },
            status: { [Op.ne]: 'APPROVED' },
          },
          attributes: [idField],
        })
        : []
      const openIds = new Set(openWorkOrders.map((w: any) => w[idField]))

      const items = rows.map((r: any) => ({
        id: r.id,
        asset_id: r.assetId,
        name: r.name,
        status: r.status,
        has_open_request: openIds.has(r.id),
      }))

      res.json(listResponse('Catalogue items for direct pick', items, buildPagination(page, limit, count)))
      return
    }

    // Legacy schedule-based PLANNED path — the Planner page now owns Plan/Raise
    // directly on schedule rows, so nothing currently calls this branch, but
    // it's kept working (using the schedule's real DUE/PLANNED status values,
    // not the nonexistent PENDING/OVERDUE this used to check) in case a caller
    // needs it again.
    const where: Record<string, unknown> = {
      status: { [Op.in]: ['DUE', 'PLANNED'] },
    }
    if (targetKind) where.targetKind = targetKind
    if (logType) where.logType = logType
    if (calibrationSource) where.calibrationSource = calibrationSource

    const { count: scheduleCount, rows: schedules } = await InvSchedule.findAndCountAll({ where, limit, offset, order: [['dueDate', 'ASC']] })
    res.json(listResponse('Schedule requests fetched', schedules, buildPagination(page, limit, scheduleCount)))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders â€” raise a work order
workOrderRouter.post('/work-orders', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body

    // Raising against a schedule (the Planner's "Raise" action only sends
    // schedule_id, kind, log_type, etc.) — the work order needs its own
    // equipment_id/instrument_id/checklist_id copied over, otherwise it's
    // left completely disconnected from the asset and checklist it's
    // actually executing (execution page then shows "No checklist mapped").
    let scheduleFields: Record<string, unknown> = {}
    if (body.scheduleId) {
      const schedule = await InvSchedule.findByPk(body.scheduleId)
      if (schedule) {
        scheduleFields = {
          targetKind: body.targetKind ?? schedule.targetKind,
          equipmentId: body.equipmentId ?? schedule.equipmentId,
          instrumentId: body.instrumentId ?? schedule.instrumentId,
          checklistId: body.checklistId ?? schedule.checklistId,
        }
      }
    }

    const workorderNo = await generateWorkOrderNo()
    const wo = await InvWorkOrder.create({
      ...body,
      ...scheduleFields,
      workorderNo,
      // Every consumer (WorkOrderExecutionPage's action-button gating,
      // WorkOrdersQueuePage's STATUS_COLOR, reinitiate) expects 'RAISED' —
      // 'OPEN' isn't a status any frontend code recognizes, so a freshly
      // raised work order had no visible actions at all (e.g. no Start button).
      status: 'RAISED',
      raisedBy: getPerformedBy(req),
      raisedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await applyWorkOrderCatalogueStatus(wo, 'RAISED')
    res.status(201).json(successResponse('Work order created', wo))
  } catch (err) {
    next(err)
  }
})

// GET /work-orders â€” paginated list
workOrderRouter.get('/work-orders', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { kind, targetKind, status, search, workorderNo, raisedBy } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (kind) where.kind = kind
    if (targetKind) where.targetKind = targetKind
    if (status) where.status = status
    if (search) {
      (where as any)[Op.or as any] = [
        { workorderNo: { [Op.iLike]: `%${search}%` } },
        { kind: { [Op.iLike]: `%${search}%` } },
        { logType: { [Op.iLike]: `%${search}%` } },
        { raisedBy: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
      ]
    }
    // Per-column search filters (Work Orders queue table)
    if (workorderNo) where.workorderNo = { [Op.iLike]: `%${workorderNo}%` }
    if (raisedBy) where.raisedBy = { [Op.iLike]: `%${raisedBy}%` }

    const { count, rows } = await InvWorkOrder.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    })

    // equipmentId/instrumentId are plain FK columns (no Sequelize association),
    // so the asset code has to be resolved with a separate batch lookup —
    // without this the list's "Code" column always fell back to "NA".
    const equipmentIds = [
      ...new Set(rows.filter((r) => r.targetKind === 'EQUIPMENT' && r.equipmentId).map((r) => r.equipmentId as number)),
    ]
    const instrumentIds = [
      ...new Set(rows.filter((r) => r.targetKind === 'INSTRUMENT' && r.instrumentId).map((r) => r.instrumentId as number)),
    ]

    const [equipmentRows, instrumentRows] = await Promise.all([
      equipmentIds.length
        ? InvEquipmentCatalogue.findAll({ where: { id: equipmentIds }, attributes: ['id', 'assetId'] })
        : [],
      instrumentIds.length
        ? InvInstrumentCatalogue.findAll({ where: { id: instrumentIds }, attributes: ['id', 'assetId'] })
        : [],
    ])
    const equipmentCodeById = new Map(equipmentRows.map((e: any) => [e.id, e.assetId]))
    const instrumentCodeById = new Map(instrumentRows.map((i: any) => [i.id, i.assetId]))

    const rowsWithCode = rows.map((wo) => {
      const equipmentCode =
        wo.targetKind === 'INSTRUMENT'
          ? instrumentCodeById.get(wo.instrumentId) ?? null
          : equipmentCodeById.get(wo.equipmentId) ?? null
      return { ...wo.toJSON(), equipment_code: equipmentCode }
    })

    res.json(listResponse('Work orders fetched', rowsWithCode, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /work-orders/:id â€” get one with associations
workOrderRouter.get('/work-orders/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const wo = await InvWorkOrder.findByPk(id, {
      include: [
        { model: InvWorkOrderResult, as: 'results' },
        { model: InvWorkOrderSignature, as: 'signatures' },
        { model: InvWorkOrderSpare, as: 'sparesUsed' },
        { model: InvCalibrationReference, as: 'calibReferences' },
      ],
    })
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })

    // The checklist itself isn't a direct association on InvWorkOrder — its
    // items are fetched by the checklistId it was raised against. Without
    // this, wo.checklist_items was always undefined and crashed the
    // execution page (it renders wo.checklist_items.length unconditionally).
    const checklistItems = wo.checklistId
      ? await InvChecklistItem.findAll({ where: { checklistId: wo.checklistId }, order: [['seqNo', 'ASC']] })
      : []

    res.json(successResponse('Work order fetched', { ...wo.toJSON(), checklistItems }))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/start
workOrderRouter.post('/work-orders/:id/start', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const wo = await InvWorkOrder.findByPk(id)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    await wo.update({
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      startedBy: getPerformedBy(req),
    })
    await applyWorkOrderCatalogueStatus(wo, 'IN_PROGRESS')
    res.json(successResponse('Work order started', wo))
  } catch (err) {
    next(err)
  }
})

// PUT /work-orders/:id/results â€” upsert results
workOrderRouter.put('/work-orders/:id/results', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = parseInt(req.params.id as string, 10)
    // ChecklistTable.tsx's autosave (WorkOrderExecutionPage.tsx) PUTs a bare
    // array as the body, not { results: [...] } — accept both shapes.
    const results = Array.isArray(req.body) ? req.body : req.body?.results

    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, message: 'results must be an array' })
    }

    const upserted = await Promise.all(
      results.map(async (r: any) => {
        // The case-normalize middleware only aliases plain-object request
        // bodies, not a top-level array's elements — read the frontend's
        // actual snake_case keys directly rather than relying on it.
        const checklistItemId = r.checklist_item_id ?? r.checklistItemId ?? null
        const doneBy = getPerformedBy(req)
        const [record] = await InvWorkOrderResult.findOrCreate({
          where: { workOrderId, checklistItemId },
          defaults: { workOrderId, checklistItemId },
        })
        await record.update({
          observation: r.observation,
          comment: r.comment,
          doneBy,
          doneAt: new Date(),
        })
        return record
      }),
    )

    res.json(successResponse('Results saved', upserted))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/end
workOrderRouter.post('/work-orders/:id/end', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { remarks } = req.body
    const wo = await InvWorkOrder.findByPk(id)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    await wo.update({
      status: 'PENDING_VERIFICATION',
      endedAt: new Date(),
      endedBy: getPerformedBy(req),
      remarks: remarks ?? wo.remarks,
    })
    await applyWorkOrderCatalogueStatus(wo, 'PENDING_VERIFICATION')
    res.json(successResponse('Work order ended', wo))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/verify
workOrderRouter.post('/work-orders/:id/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = parseInt(req.params.id as string, 10)
    const { name, comments } = req.body
    const wo = await InvWorkOrder.findByPk(workOrderId)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    await enforceEsignature((req as any).user, ESIGN_FLAGS.WORK_ORDER_VERIFY_AUTH, req.body.password)
    await wo.update({
      status: 'PENDING_APPROVAL',
      verifiedBy: getPerformedBy(req),
      verifiedAt: new Date(),
    })
    await applyWorkOrderCatalogueStatus(wo, 'PENDING_APPROVAL')
    const sig = await InvWorkOrderSignature.create({
      workOrderId,
      signingFor: 'VERIFIED',
      name: name ?? (req as any).user?.name ?? '',
      comments: comments ?? null,
      completedOn: new Date(),
    })
    res.json(successResponse('Work order verified', { wo, sig }))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/approve
workOrderRouter.post('/work-orders/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = parseInt(req.params.id as string, 10)
    const { name, comments } = req.body
    const wo = await InvWorkOrder.findByPk(workOrderId)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    await enforceEsignature((req as any).user, ESIGN_FLAGS.WORK_ORDER_APPROVE_AUTH, req.body.password)
    await wo.update({
      status: 'APPROVED',
      approvedBy: getPerformedBy(req),
      approvedAt: new Date(),
    })
    await applyWorkOrderCatalogueStatus(wo, 'APPROVED')
    const sig = await InvWorkOrderSignature.create({
      workOrderId,
      signingFor: 'APPROVED',
      name: name ?? (req as any).user?.name ?? '',
      comments: comments ?? null,
      completedOn: new Date(),
    })
    res.json(successResponse('Work order approved', { wo, sig }))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/reinitiate
workOrderRouter.post('/work-orders/:id/reinitiate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { remarks } = req.body
    const wo = await InvWorkOrder.findByPk(id)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    await wo.update({ status: 'RAISED', remarks: remarks ?? wo.remarks })
    await applyWorkOrderCatalogueStatus(wo, 'RAISED')
    res.json(successResponse('Work order reinitiated', wo))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/breakdown-details
workOrderRouter.post('/work-orders/:id/breakdown-details', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const wo = await InvWorkOrder.findByPk(id)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })
    const sparePartsUsed = req.body.sparePartsUsed ?? wo.sparePartsUsed
    await wo.update({
      breakdownDescription: req.body.breakdownDescription ?? req.body.description ?? null,
      maintenanceType: req.body.maintenanceType ?? wo.maintenanceType,
      sparePartsUsed,
    })

    // The form (WorkOrderExecutionPage's breakdown modal) sends the selected
    // parts as `part_codes`, but only the boolean flag was ever persisted —
    // inv_work_order_spares stayed empty, so the detail view's "Replaced Spare
    // Parts" field was always blank and Spare Parts master data went nowhere.
    // Replace the set on each save so editing the modal is idempotent.
    const rawCodes = req.body.partCodes ?? req.body.part_codes
    if (Array.isArray(rawCodes)) {
      const partCodes = rawCodes.map((c: unknown) => String(c ?? '').trim()).filter(Boolean)
      await InvWorkOrderSpare.destroy({ where: { workOrderId: wo.id } })
      if (sparePartsUsed && partCodes.length) {
        const parts = await InvSparePart.findAll({ where: { partCode: partCodes } })
        const idByCode = new Map(parts.map((p) => [p.partCode, p.id]))
        await InvWorkOrderSpare.bulkCreate(
          partCodes.map((partCode) => ({
            workOrderId: wo.id,
            sparePartId: idByCode.get(partCode) ?? null,
            partCode,
          })),
        )
      }
    }

    const updated = await InvWorkOrder.findByPk(id, {
      include: [{ model: InvWorkOrderSpare, as: 'sparesUsed' }],
    })
    res.json(successResponse('Breakdown details updated', updated))
  } catch (err) {
    next(err)
  }
})

// POST /work-orders/:id/calibration-references
workOrderRouter.post('/work-orders/:id/calibration-references', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = parseInt(req.params.id as string, 10)
    const refs: any[] = req.body.references ?? req.body
    if (!Array.isArray(refs)) {
      return res.status(400).json({ success: false, message: 'Body must be an array of reference readings' })
    }
    const created = await InvCalibrationReference.bulkCreate(
      refs.map((r) => ({
        workOrderId,
        measurementId: r.measurementId ?? null,
        measurementName: r.measurementName ?? null,
        referenceInstId: r.referenceInstId ?? null,
        referenceReading: r.referenceReading ?? null,
        instrumentReading: r.instrumentReading ?? null,
        variancePct: r.variancePct ?? null,
        tolerancePct: r.tolerancePct ?? null,
        status: r.status ?? null,
        doneBy: getPerformedBy(req),
        doneAt: new Date(),
      })),
    )
    res.status(201).json(successResponse('Calibration references created', created))
  } catch (err) {
    next(err)
  }
})

// DELETE /work-orders/calibration-references/:refId
workOrderRouter.delete('/work-orders/calibration-references/:refId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refId = req.params.refId as string
    const ref = await InvCalibrationReference.findByPk(refId)
    if (!ref) return res.status(404).json({ success: false, message: 'Reference not found' })
    await ref.destroy()
    res.json(successResponse('Calibration reference deleted', null))
  } catch (err) {
    next(err)
  }
})

export default workOrderRouter

