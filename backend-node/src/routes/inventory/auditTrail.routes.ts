import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { InvAuditTrail } from '../../models/InventoryModels.model'
import { sequelize } from '../../database/connection'
import { parsePagination, successResponse, listResponse, buildPagination, wantsPagination } from '../../utils/response'

const auditTrailRouter = Router()

// Whitelist of columns the Audit Trail table UI is allowed to sort by.
const SORTABLE_COLUMNS: Record<string, string> = {
  event_type: 'eventType',
  entity_type: 'entityType',
  entity_ref: 'entityRef',
  performed_by: 'performedBy',
  performed_at: 'performedAt',
  old_value: 'oldValue',
  new_value: 'newValue',
}

// GET /audit-trail — filtered list
// Returns a bare array by default: the per-asset AuditTab in
// EquipmentDetailPage.tsx/InstrumentDetailPage.tsx types this as an array and
// breaks on the {items,total,...} envelope. Callers that send page params
// (AuditTrailPage.tsx) get the envelope instead.
auditTrailRouter.get('/audit-trail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paged = wantsPagination(req.query)
    const { page, limit, offset } = parsePagination(req.query, 200)
    const { eventType, entityType, entityId, performedBy, dateFrom, dateTo, search, sort_by, sort_dir } =
      req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (eventType) where.eventType = eventType
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (performedBy) where.performedBy = { [Op.iLike]: `%${performedBy}%` }
    if (dateFrom || dateTo) {
      where.performedAt = {}
      if (dateFrom) (where.performedAt as any)[Op.gte] = new Date(dateFrom)
      if (dateTo) (where.performedAt as any)[Op.lte] = new Date(dateTo)
    }

    // Free-text search used to run in the browser over the fetched page, which
    // silently searched only the newest 200 entries.
    if (search) {
      where[Op.or as unknown as string] = [
        { entityRef: { [Op.iLike]: `%${search}%` } },
        { performedBy: { [Op.iLike]: `%${search}%` } },
        { entityType: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const sortColumn = SORTABLE_COLUMNS[sort_by] ?? 'performedAt'
    const order: any = [[sortColumn, sort_dir === 'asc' ? 'ASC' : 'DESC']]
    if (!paged) {
      const rows = await InvAuditTrail.findAll({ where, order, limit })
      res.json(successResponse('Audit trail fetched', rows))
      return
    }
    const { rows, count } = await InvAuditTrail.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Audit trail fetched', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /audit-trail/event-types — distinct event types
auditTrailRouter.get('/audit-trail/event-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await sequelize.query<{ event_type: string }>(
      'SELECT DISTINCT event_type FROM inv_audit_trail ORDER BY event_type ASC',
      { type: QueryTypes.SELECT },
    )
    const eventTypes = rows.map((r) => r.event_type)
    res.json(successResponse('Event types fetched', eventTypes))
  } catch (err) {
    next(err)
  }
})

// GET /audit-trail/entity-types — distinct entity types
auditTrailRouter.get('/audit-trail/entity-types', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await sequelize.query<{ entity_type: string }>(
      'SELECT DISTINCT entity_type FROM inv_audit_trail ORDER BY entity_type ASC',
      { type: QueryTypes.SELECT },
    )
    const entityTypes = rows.map((r) => r.entity_type)
    res.json(successResponse('Entity types fetched', entityTypes))
  } catch (err) {
    next(err)
  }
})

export default auditTrailRouter
