import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { ForbiddenError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { ArdAuditLog, User } from '../../models/index'
import ExcelJS from 'exceljs'

const router = Router()

const AUDIT_ROLES = new Set(['SUPER_ADMIN', 'HOD', 'QA', 'ADMIN'])

function fmtTime(d: Date | null): string {
  if (!d) return ''
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${pad(dt.getDate())} ${months[dt.getMonth()]} ${dt.getFullYear()} (${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())})`
}

function buildWhere(q: Record<string, string>) {
  const where: any = {}
  if (q.kind && q.kind !== 'ALL') where.entityType = { [Op.iLike]: `%${q.kind}%` }
  if (q.q) where[Op.or] = [
    { entityType: { [Op.iLike]: `%${q.q}%` } },
    { action: { [Op.iLike]: `%${q.q}%` } },
    { detail: { [Op.iLike]: `%${q.q}%` } },
  ]
  if (q.date_from) where.createdAt = { ...where.createdAt, [Op.gte]: new Date(q.date_from) }
  if (q.date_to) {
    const to = new Date(q.date_to)
    to.setDate(to.getDate() + 1)
    where.createdAt = { ...where.createdAt, [Op.lt]: to }
  }
  return where
}

async function resolveActorIds(actor: string): Promise<string[] | null> {
  if (!actor) return null
  const users = await User.findAll({ where: { username: { [Op.iLike]: `%${actor}%` } }, attributes: ['id'] })
  return users.map((u: any) => u.id)
}

function fmtRow(l: any, userMap: Record<string, string>) {
  const username = l.userId ? (userMap[l.userId] || 'System') : 'System'
  return {
    id: l.id,
    eventType: l.action,
    eventTime: l.createdAt,
    eventTimeFormatted: fmtTime(l.createdAt),
    user: username,
    entityType: (l.entityType || '').toUpperCase(),
    entityId: l.entityId,
    eventDetails: l.detail || l.action,
    at: l.createdAt,
    kind: (l.entityType || '').toUpperCase(),
    entity: l.detail || l.action,
    action: l.action,
    actor: username,
  }
}

// GET /api/ard/audit
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!AUDIT_ROLES.has(rc)) throw new ForbiddenError('Insufficient permissions')

    const q = req.query as Record<string, string>
    const page = Math.max(1, parseInt(q.page || '1', 10))
    const pageSize = Math.max(1, parseInt(q.pageSize || '50', 10))
    const offset = (page - 1) * pageSize

    const where = buildWhere(q)
    if (q.actor) {
      const actorIds = await resolveActorIds(q.actor)
      if (actorIds && actorIds.length > 0) where.userId = { [Op.in]: actorIds }
      else where.userId = null
    }

    const { count, rows } = await ArdAuditLog.findAndCountAll({ where, limit: pageSize, offset, order: [['createdAt', 'DESC']] })
    const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    res.json(successResponse('Audit logs', { items: rows.map(r => fmtRow(r, userMap)), total: count, page, pageSize }))
  } catch (err) { next(err) }
})

// GET /api/ard/audit/entity/:entityType/:entityId
router.get('/entity/:entityType/:entityId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string>
    const page = Math.max(1, parseInt(q.page || '1', 10))
    const pageSize = Math.max(1, parseInt(q.pageSize || '50', 10))
    const offset = (page - 1) * pageSize

    const where: any = {
      entityType: (req.params.entityType as string).toUpperCase(),
      entityId: req.params.entityId as string,
    }

    const { count, rows } = await ArdAuditLog.findAndCountAll({ where, limit: pageSize, offset, order: [['createdAt', 'DESC']] })
    const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    res.json(successResponse('Audit logs', { items: rows.map(r => fmtRow(r, userMap)), total: count, page, pageSize }))
  } catch (err) { next(err) }
})

// GET /api/ard/audit/export/xlsx
router.get('/export/xlsx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!AUDIT_ROLES.has(rc)) throw new ForbiddenError('Insufficient permissions')

    const q = req.query as Record<string, string>
    const where = buildWhere(q)
    if (q.actor) {
      const actorIds = await resolveActorIds(q.actor)
      if (actorIds && actorIds.length > 0) where.userId = { [Op.in]: actorIds }
      else where.userId = null
    }

    const rows = await ArdAuditLog.findAll({ where, limit: 5000, order: [['createdAt', 'DESC']] })
    const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Audit Trail')
    const headers = ['Event Type', 'Event Time', 'User', 'Entity Type', 'Event Details']
    const hRow = ws.addRow(headers)
    hRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A7A4A' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    })
    rows.forEach((r: any) => {
      const fmt = fmtRow(r, userMap)
      ws.addRow([fmt.eventType, fmt.eventTimeFormatted, fmt.user, fmt.entityType, fmt.eventDetails])
    })

    const buf = await wb.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=AuditTrail.xlsx')
    res.send(Buffer.from(buf))
  } catch (err) { next(err) }
})

export default router
