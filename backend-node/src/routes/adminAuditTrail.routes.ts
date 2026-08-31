import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { AdminAuditTrail } from '../models/AdminAuditTrail.model'
import { sequelize } from '../database/connection'
import { listResponse, buildPagination, parsePagination, parseSort, successResponse } from '../utils/response'

const router = Router()

// GET /api/admin/audit-trail — paginated with filters. Readable by anyone
// with Admin access (no dedicated privilege), same as the rest of the
// Admin area's read-only screens.
router.get('/', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, 10)
    const order = parseSort(req.query as Record<string, unknown>, AdminAuditTrail, [['performedAt', 'DESC']])
    const { search, eventType, entityType, entityId, performedBy, dateFrom, dateTo } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (eventType) where.eventType = eventType
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (performedBy) where.performedBy = { [Op.iLike]: `%${performedBy}%` }
    if (search) {
      (where as any)[Op.or as any] = [
        { entityRef: { [Op.iLike]: `%${search}%` } },
        { performedBy: { [Op.iLike]: `%${search}%` } },
        { entityType: { [Op.iLike]: `%${search}%` } },
        { eventType: { [Op.iLike]: `%${search}%` } },
        { details: { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (dateFrom || dateTo) {
      where.performedAt = {}
      if (dateFrom) (where.performedAt as any)[Op.gte] = new Date(dateFrom)
      if (dateTo) (where.performedAt as any)[Op.lte] = new Date(dateTo)
    }

    const { count, rows } = await AdminAuditTrail.findAndCountAll({
      where,
      order,
      limit,
      offset,
    })
    res.json(listResponse('Audit trail fetched', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/audit-trail/event-types — distinct event types
router.get('/event-types', authenticate, requirePrivilege('users.manage'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await sequelize.query<{ event_type: string }>(
      'SELECT DISTINCT event_type FROM admin_audit_trail ORDER BY event_type ASC',
      { type: QueryTypes.SELECT },
    )
    res.json(successResponse('Event types fetched', rows.map((r) => r.event_type)))
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/audit-trail/entity-types — distinct entity types
router.get('/entity-types', authenticate, requirePrivilege('users.manage'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await sequelize.query<{ entity_type: string }>(
      'SELECT DISTINCT entity_type FROM admin_audit_trail ORDER BY entity_type ASC',
      { type: QueryTypes.SELECT },
    )
    res.json(successResponse('Entity types fetched', rows.map((r) => r.entity_type)))
  } catch (err) {
    next(err)
  }
})

export default router
