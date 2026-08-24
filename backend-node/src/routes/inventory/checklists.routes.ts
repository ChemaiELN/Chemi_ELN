import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import {
  successResponse,
  listResponse,
  parsePagination,
  buildPagination,
} from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import {
  InvChecklist,
  InvChecklistItem,
  InvChecklistApproval,
} from '../../models/InventoryModels.model'

// ─────────────────────────────────────────────────────────────────────────────
// Checklist Router
// ─────────────────────────────────────────────────────────────────────────────

const checklistRouter = Router()

// Verification and approval of a checklist may only be performed by QA — same
// department-code check used elsewhere in the app (e.g. BatchesPage/
// StockRequestsPage's UNRESTRICTED_DEPARTMENT_CODES).
function requireQaDepartment(req: Request) {
  const departmentCode = (req as any).user?.department?.code as string | undefined
  if (departmentCode !== 'QA') {
    throw new ForbiddenError('Only QA department users can verify or approve checklists.')
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

checklistRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, checklistType, targetKind, status, activeOnly } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { equipmentCode: { [Op.iLike]: `%${search}%` } },
        { checklistType: { [Op.iLike]: `%${search}%` } },
        { logType: { [Op.iLike]: `%${search}%` } },
        { targetKind: { [Op.iLike]: `%${search}%` } },
        { usageType: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { version: { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (checklistType) where.checklistType = checklistType
    if (targetKind) where.targetKind = targetKind
    if (status) where.status = status
    if (activeOnly === 'true' || activeOnly === '1') where.isActive = true

    const { count, rows } = await InvChecklist.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    })

    res.json(listResponse('Checklists', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// ── Create ────────────────────────────────────────────────────────────────────

checklistRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id as string | undefined
    const record = await InvChecklist.create({
      ...req.body,
      status: 'DRAFT',
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Checklist created', record))
  } catch (err) { next(err) }
})

// ── Item routes (must be above /:id to avoid param collision) ─────────────────

checklistRouter.patch('/items/:itemId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params.itemId as string
    const item = await InvChecklistItem.findByPk(itemId)
    if (!item) throw new NotFoundError('Checklist item not found')
    await item.update(req.body)
    res.json(successResponse('Item updated', item))
  } catch (err) { next(err) }
})

checklistRouter.delete('/items/:itemId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = req.params.itemId as string
    const item = await InvChecklistItem.findByPk(itemId)
    if (!item) throw new NotFoundError('Checklist item not found')
    await item.destroy()
    res.json(successResponse('Item deleted', null))
  } catch (err) { next(err) }
})

// ── Get one (with items + approvals) ─────────────────────────────────────────

checklistRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')

    const [items, approvals] = await Promise.all([
      InvChecklistItem.findAll({ where: { checklistId: record.id }, order: [['seqNo', 'ASC']] }),
      InvChecklistApproval.findAll({ where: { checklistId: record.id }, order: [['performedAt', 'ASC']] }),
    ])

    res.json(successResponse('Checklist', { ...record.toJSON(), items, approvals }))
  } catch (err) { next(err) }
})

// ── Update metadata ───────────────────────────────────────────────────────────

checklistRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')
    // Exclude items from the patch — items have their own routes
    const { items: _items, ...meta } = req.body
    await record.update({ ...meta, updatedAt: new Date() })
    res.json(successResponse('Checklist updated', record))
  } catch (err) { next(err) }
})

// ── Toggle isActive ───────────────────────────────────────────────────────────

checklistRouter.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')
    await record.update({ isActive: !record.isActive })
    res.json(successResponse('Checklist toggled', record))
  } catch (err) { next(err) }
})

// ── Add item ──────────────────────────────────────────────────────────────────

checklistRouter.post('/:id/items', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checklistId = parseInt(req.params.id as string, 10)
    const checklist = await InvChecklist.findByPk(checklistId)
    if (!checklist) throw new NotFoundError('Checklist not found')
    const item = await InvChecklistItem.create({ ...req.body, checklistId, createdAt: new Date() })
    res.status(201).json(successResponse('Item added', item))
  } catch (err) { next(err) }
})

// ── Submit ────────────────────────────────────────────────────────────────────

checklistRouter.post('/:id/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')
    if (record.status !== 'DRAFT') throw new BadRequestError('Only DRAFT checklists can be submitted')
    await record.update({ status: 'PENDING_VERIFICATION' })
    res.json(successResponse('Checklist submitted for verification', record))
  } catch (err) { next(err) }
})

// ── Verify ────────────────────────────────────────────────────────────────────

checklistRouter.post('/:id/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    requireQaDepartment(req)
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')
    if (record.status !== 'PENDING_VERIFICATION') throw new BadRequestError('Checklist is not pending verification')

    const userId = (req as any).user?.id as string
    const { comment } = req.body as { comment?: string }

    await record.update({ status: 'PENDING_APPROVAL' })
    await InvChecklistApproval.create({
      checklistId: record.id!,
      action: 'VERIFIED',
      fromState: 'PENDING_VERIFICATION',
      toState: 'PENDING_APPROVAL',
      performedBy: userId,
      comment: comment ?? null,
      performedAt: new Date(),
    })

    res.json(successResponse('Checklist verified', record))
  } catch (err) { next(err) }
})

// ── Approve ───────────────────────────────────────────────────────────────────

checklistRouter.post('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    requireQaDepartment(req)
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')
    if (record.status !== 'PENDING_APPROVAL') throw new BadRequestError('Checklist is not pending approval')

    const userId = (req as any).user?.id as string
    const { comment } = req.body as { comment?: string }

    // Bump minor version on approve: 1.0 → 1.1, 1.4 → 1.5, etc.
    const currentVer = record.version ?? '1.0'
    const [major, minor] = currentVer.split('.').map(Number)
    const bumpedVersion = `${major ?? 1}.${(minor ?? 0) + 1}`
    await record.update({ status: 'APPROVED', version: bumpedVersion })
    await InvChecklistApproval.create({
      checklistId: record.id!,
      action: 'APPROVED',
      fromState: 'PENDING_APPROVAL',
      toState: 'APPROVED',
      performedBy: userId,
      comment: comment ?? null,
      performedAt: new Date(),
    })

    res.json(successResponse('Checklist approved', record))
  } catch (err) { next(err) }
})

// ── Reinitiate ────────────────────────────────────────────────────────────────

checklistRouter.post('/:id/reinitiate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const record = await InvChecklist.findByPk(id)
    if (!record) throw new NotFoundError('Checklist not found')

    const userId = (req as any).user?.id as string
    const { remarks } = req.body as { remarks?: string }

    const fromState = record.status
    await record.update({ status: 'DRAFT' })
    await InvChecklistApproval.create({
      checklistId: record.id!,
      action: 'REINITIATED',
      fromState,
      toState: 'DRAFT',
      performedBy: userId,
      comment: remarks ?? null,
      performedAt: new Date(),
    })

    res.json(successResponse('Checklist reinitiated', record))
  } catch (err) { next(err) }
})

// ── New Version ───────────────────────────────────────────────────────────────

checklistRouter.post('/:id/new-version', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const original = await InvChecklist.findByPk(id)
    if (!original) throw new NotFoundError('Checklist not found')

    const existingItems = await InvChecklistItem.findAll({
      where: { checklistId: original.id },
    })

    // Bump version: treat version as a float string, increment the minor part
    const currentVersion = parseFloat(original.version ?? '0.1')
    const newVersion = (Math.round((currentVersion + 0.1) * 10) / 10).toFixed(1)

    const userId = (req as any).user?.id as string | undefined

    const cloned = await InvChecklist.create({
      name: original.name,
      checklistType: original.checklistType,
      logType: original.logType,
      usageType: original.usageType,
      targetKind: original.targetKind,
      equipmentCode: original.equipmentCode,
      version: newVersion,
      status: 'DRAFT',
      isActive: true,
      createdBy: userId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    if (existingItems.length > 0) {
      const itemData = existingItems.map((item) => ({
        checklistId: cloned.id!,
        seqNo: item.seqNo,
        instructionType: item.instructionType,
        dataType: item.dataType,
        frequencies: item.frequencies,
        precision: item.precision,
        lowerLimit: item.lowerLimit,
        upperLimit: item.upperLimit,
        options: item.options,
        details: item.details,
        createdAt: new Date(),
      }))
      await InvChecklistItem.bulkCreate(itemData as any)
    }

    res.status(201).json(successResponse('New checklist version created', cloned))
  } catch (err) { next(err) }
})

export default checklistRouter
