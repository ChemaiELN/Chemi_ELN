import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { NotFoundError } from '../../utils/errors'
import { InvLogMapping, InvChecklist } from '../../models/InventoryModels.model'

// ─────────────────────────────────────────────────────────────────────────────
// Log Mapping Router
// ─────────────────────────────────────────────────────────────────────────────

const logMappingRouter = Router()

// ── List ──────────────────────────────────────────────────────────────────────

logMappingRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { equipmentId, instrumentId, logType } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (equipmentId) where.equipmentId = Number(equipmentId)
    if (instrumentId) where.instrumentId = Number(instrumentId)
    if (logType) where.logType = logType

    const rows = await InvLogMapping.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: InvChecklist, as: 'checklist', attributes: ['id', 'name', 'version'], required: false }],
    })

    // The frontend's logMappingApi.list() expects a bare array (LogMappingTab.tsx),
    // not the {items,total,...} pagination envelope — same bug class as the
    // analogous stock-request/batch events endpoints. It also expects flat
    // checklist_name/checklist_version fields rather than a nested object.
    const data = rows.map((r) => {
      const json = r.toJSON() as any
      return {
        ...json,
        checklistName: json.checklist?.name ?? null,
        checklistVersion: json.checklist?.version ?? null,
      }
    })
    res.json(successResponse('Log mappings', data))
  } catch (err) { next(err) }
})

// ── Create ────────────────────────────────────────────────────────────────────

logMappingRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    const record = await InvLogMapping.create({
      ...req.body,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Log mapping created', record))
  } catch (err) { next(err) }
})

// ── Update ────────────────────────────────────────────────────────────────────

logMappingRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvLogMapping.findByPk(id)
    if (!record) throw new NotFoundError('Log mapping not found')
    await record.update({ ...req.body, updatedAt: new Date() })
    res.json(successResponse('Log mapping updated', record))
  } catch (err) { next(err) }
})

// ── Delete ────────────────────────────────────────────────────────────────────

logMappingRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvLogMapping.findByPk(id)
    if (!record) throw new NotFoundError('Log mapping not found')
    await record.destroy()
    res.json(successResponse('Log mapping deleted', null))
  } catch (err) { next(err) }
})

export default logMappingRouter
