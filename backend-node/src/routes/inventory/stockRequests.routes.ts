import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination, parseSort } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import {
  InvStockRequest,
  InvStockRequestEvent,
  InvMaterial,
  InvBatch,
  InvBatchPack,
  InvBatchEvent,
} from '../../models/InventoryModels.model'

const stockRequestsRouter = Router()

// Roles that go through the TL → HOD two-stage approval pipeline.
// Non-bench roles (TL, HOD, SUPER_ADMIN, ADMIN) get auto-approved on create.
const BENCH_ROLES = ['ANALYST', 'BENCH_SCIENTIST', 'SCIENTIST', 'TRAINEE', 'JRF', 'SRF', 'RA']

function isBenchRole(roleCode: string | undefined): boolean {
  return BENCH_ROLES.includes((roleCode ?? '').toUpperCase())
}

// Roles whose CRITICAL, batch-linked requests must go to their department TL
// before Store Incharge — everything else (any criticality from other roles,
// or non-CRITICAL from these roles) skips TL and goes straight to Store Incharge.
const TL_ROUTED_ROLES = ['CHEM', 'ANALYST']

// ── Request number generation ─────────────────────────────────────────────────

async function generateRequestNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const key = `SR_${yy}`

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
    return `SR/${yy}/${String(seq).padStart(5, '0')}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}

function getPerformedBy(req: Request): string {
  const user = req.user!
  return (user as any).username ?? (user as any).email ?? String((user as any).id)
}

// ── List ──────────────────────────────────────────────────────────────────────

stockRequestsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, status, criticality, materialId, actionableStatuses } =
      req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (criticality) where.criticality = criticality
    if (materialId) where.materialId = Number(materialId)
    if (search) {
      (where as any)[Op.or as any] = [
        { requestNo: { [Op.iLike]: `%${search}%` } },
        { criticality: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { '$material.name$': { [Op.iLike]: `%${search}%` } },
        { '$material.code$': { [Op.iLike]: `%${search}%` } },
      ]
    }

    // sort_by/sort_dir were being ignored here, so the table's column sorters
    // did nothing at all.
    const explicitSort = req.query.sortBy ?? req.query.sort_by
    const order: any[] = parseSort(req.query as Record<string, unknown>, InvStockRequest, [['createdAt', 'DESC']])

    // StockRequestsPage surfaces rows the current user can act on at the top.
    // The page only knows the user's privileges, so it sends the statuses that
    // count as actionable and the ordering is applied here — doing it in the
    // browser only reordered the page that had already been fetched, so an
    // actionable row on page 2 stayed on page 2.
    if (!explicitSort && actionableStatuses) {
      const statuses = actionableStatuses.split(',').map((v) => v.trim()).filter(Boolean)
      if (statuses.length) {
        const list = statuses.map((v) => sequelize.escape(v)).join(', ')
        order.unshift(sequelize.literal(`CASE WHEN "InvStockRequest"."status" IN (${list}) THEN 0 ELSE 1 END`))
      }
    }

    const { count, rows } = await InvStockRequest.findAndCountAll({
      where,
      include: [
        { model: InvMaterial, as: 'material', attributes: ['id', 'code', 'name', 'materialType'], required: false },
      ],
      limit,
      offset,
      order,
    })

    res.json(listResponse('Stock requests', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// ── Create ────────────────────────────────────────────────────────────────────

stockRequestsRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const performedBy = getPerformedBy(req)
    const user = req.user!
    const userId = (user as any).id

    const { materialId, qtyRequired, unit, requiredByDate, criticality, purpose, departmentCode, remarks, sourceBatchId, sourcePackId } = req.body
    if (!materialId) throw new BadRequestError('materialId is required', 'MISSING_PARAM')
    if (qtyRequired === undefined) throw new BadRequestError('qtyRequired is required', 'MISSING_PARAM')

    const requestNo = await generateRequestNo()

    const userRoleCode = (user as any).role?.code ?? (user as any).roleCode

    let initialStatus: string
    let approvalStage: string
    let autoApproved: boolean

    if (sourceBatchId) {
      // Batch/pack-linked request (raised from the Batches table "Request" action).
      // Routing is criticality-based, not role-based like the legacy flow below:
      //   CRITICAL + requester is CHEM/ANALYST -> TL approval first, then Store Incharge.
      //   everything else -> straight to Store Incharge (status APPROVED, ready for them).
      const needsTl = String(criticality ?? '').toUpperCase() === 'CRITICAL'
        && TL_ROUTED_ROLES.includes((userRoleCode ?? '').toUpperCase())
      initialStatus = needsTl ? 'PENDING' : 'APPROVED'
      approvalStage = needsTl ? 'TL' : 'COMPLETED'
      autoApproved = !needsTl
    } else {
      // Legacy plain-material request flow — unchanged.
      // Bench roles require TL then HOD approval; non-bench (TL/HOD/ADMIN) are auto-approved
      initialStatus = isBenchRole(userRoleCode) ? 'PENDING' : 'APPROVED'
      approvalStage = isBenchRole(userRoleCode) ? 'TL' : 'COMPLETED'
      autoApproved = !isBenchRole(userRoleCode)
    }

    const stockRequest = await InvStockRequest.create({
      requestNo,
      materialId: Number(materialId),
      qtyRequired: Number(qtyRequired),
      unit: unit ?? 'g',
      requiredByDate: requiredByDate ?? null,
      criticality: criticality ?? 'GENERAL',
      purpose: purpose ?? null,
      requestedBy: String(userId),
      requestedAt: new Date(),
      departmentCode: departmentCode ?? null,
      approvalStage,
      approvedBy: autoApproved ? performedBy : null,
      approvedAt: autoApproved ? new Date() : null,
      status: initialStatus,
      remarks: remarks ?? null,
      sourceBatchId: sourceBatchId ? Number(sourceBatchId) : null,
      sourcePackId: sourcePackId ? Number(sourcePackId) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType: 'CREATED',
      performedBy,
      performedAt: new Date(),
      remarks: null,
    })

    res.status(201).json(successResponse('Stock request created', stockRequest))
  } catch (err) {
    next(err)
  }
})

// ── Get one ───────────────────────────────────────────────────────────────────

stockRequestsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const stockRequest = await InvStockRequest.findByPk(Number(id), {
      include: [
        { model: InvStockRequestEvent, as: 'events', required: false, order: [['performedAt', 'DESC']] as any },
        { model: InvMaterial, as: 'material', required: false },
      ],
    })
    if (!stockRequest) throw new NotFoundError('Stock request not found')
    res.json(successResponse('Stock request', stockRequest))
  } catch (err) {
    next(err)
  }
})

// ── Update non-status fields ──────────────────────────────────────────────────

stockRequestsRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')

    const allowed = [
      'qtyRequired', 'unit', 'requiredByDate', 'criticality',
      'purpose', 'departmentCode', 'remarks',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    updates.updatedAt = new Date()
    await stockRequest.update(updates)
    res.json(successResponse('Stock request updated', stockRequest))
  } catch (err) {
    next(err)
  }
})

// ── Workflow transitions ───────────────────────────────────────────────────────

stockRequestsRouter.patch('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const performedBy = getPerformedBy(req)
    const { remarks } = req.body
    const user = req.user!
    const approverRoleCode = ((user as any).role?.code ?? (user as any).roleCode ?? '').toUpperCase()
    const isHodOrAdmin = ['HOD', 'SUPER_ADMIN', 'ADMIN'].includes(approverRoleCode)

    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')

    let nextStatus: string
    let nextStage: string
    let eventType: string

    if (stockRequest.status === 'PENDING' && stockRequest.approvalStage === 'TL' && stockRequest.sourceBatchId) {
      // Batch-linked CRITICAL request: TL is the only approval stage before
      // Store Incharge — there is no HOD stage in this flow.
      nextStatus = 'APPROVED'
      nextStage = 'COMPLETED'
      eventType = 'TL_APPROVED'
    } else if (stockRequest.status === 'PENDING' && stockRequest.approvalStage === 'TL') {
      // Stage 1: TL approves → moves to HOD stage
      nextStatus = 'PENDING_APPROVAL'
      nextStage = 'HOD'
      eventType = 'TL_APPROVED'
    } else if (stockRequest.status === 'PENDING_APPROVAL' && stockRequest.approvalStage === 'HOD' && isHodOrAdmin) {
      // Stage 2: HOD approves → fully approved
      nextStatus = 'APPROVED'
      nextStage = 'COMPLETED'
      eventType = 'APPROVED'
    } else if (stockRequest.status === 'PENDING' && isHodOrAdmin) {
      // HOD/Admin can fast-track a PENDING request directly to APPROVED
      nextStatus = 'APPROVED'
      nextStage = 'COMPLETED'
      eventType = 'APPROVED'
    } else {
      throw new BadRequestError(
        `Cannot approve a request with status '${stockRequest.status}' (stage: ${stockRequest.approvalStage ?? 'N/A'}) as role ${approverRoleCode}`,
        'INVALID_TRANSITION',
      )
    }

    await stockRequest.update({
      status: nextStatus,
      approvalStage: nextStage,
      approvedBy: performedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType,
      performedBy,
      performedAt: new Date(),
      remarks: remarks ?? null,
    })

    res.json(successResponse('Stock request approved', stockRequest))
  } catch (err) {
    next(err)
  }
})

stockRequestsRouter.patch('/:id/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const performedBy = getPerformedBy(req)
    const { remarks } = req.body

    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')
    if (!['PENDING', 'APPROVED', 'IN_PROGRESS'].includes(stockRequest.status ?? '')) {
      throw new BadRequestError(`Cannot reject a request with status '${stockRequest.status}'`, 'INVALID_TRANSITION')
    }

    await stockRequest.update({
      status: 'REJECTED',
      remarks: remarks ?? stockRequest.remarks,
      updatedAt: new Date(),
    })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType: 'REJECTED',
      performedBy,
      performedAt: new Date(),
      remarks: remarks ?? null,
    })

    res.json(successResponse('Stock request rejected', stockRequest))
  } catch (err) {
    next(err)
  }
})

stockRequestsRouter.patch('/:id/fulfill', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const performedBy = getPerformedBy(req)
    const { remarks } = req.body

    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')
    if (!['APPROVED', 'IN_PROGRESS'].includes(stockRequest.status ?? '')) {
      throw new BadRequestError(`Cannot fulfill a request with status '${stockRequest.status}'`, 'INVALID_TRANSITION')
    }

    if (stockRequest.sourceBatchId) {
      // Batch/pack-linked request: "fulfilling" here means restocking — Store
      // Incharge adds exactly the requested quantity to that pack (and the
      // parent batch total), rather than issuing/transferring stock out.
      const batch = await InvBatch.findByPk(stockRequest.sourceBatchId)
      if (!batch) throw new NotFoundError('Source batch not found')

      const qty = Number(stockRequest.qtyRequired)

      let pack: InvBatchPack | null = null
      if (stockRequest.sourcePackId) {
        pack = await InvBatchPack.findByPk(stockRequest.sourcePackId)
        if (!pack) throw new NotFoundError('Source pack not found')
        await pack.update({ qtyAvailable: Number(pack.qtyAvailable) + qty })
      }

      await batch.update({
        qtyReceived: Number(batch.qtyReceived) + qty,
        qtyAvailable: Number(batch.qtyAvailable) + qty,
        updatedAt: new Date(),
      })

      await InvBatchEvent.create({
        batchId: batch.id,
        eventType: 'RESTOCKED',
        qty,
        refNo: stockRequest.requestNo,
        module: 'STOCK_REQUEST',
        issuedTo: null,
        purpose: stockRequest.purpose,
        projectCode: null,
        performedBy,
        performedAt: new Date(),
        remarks: remarks ?? null,
      })
    }

    await stockRequest.update({ status: 'FULFILLED', updatedAt: new Date() })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType: 'FULFILLED',
      performedBy,
      performedAt: new Date(),
      remarks: remarks ?? null,
    })

    res.json(successResponse('Stock request fulfilled', stockRequest))
  } catch (err) {
    next(err)
  }
})

stockRequestsRouter.patch('/:id/in-progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const performedBy = getPerformedBy(req)
    const { remarks } = req.body

    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')
    if (stockRequest.status !== 'APPROVED') {
      throw new BadRequestError(`Cannot mark a request with status '${stockRequest.status}' as in progress`, 'INVALID_TRANSITION')
    }

    // Not a terminal state — Store Incharge can still Approve/Reject afterwards.
    await stockRequest.update({
      status: 'IN_PROGRESS',
      remarks: remarks ?? stockRequest.remarks,
      updatedAt: new Date(),
    })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType: 'IN_PROGRESS',
      performedBy,
      performedAt: new Date(),
      remarks: remarks ?? null,
    })

    res.json(successResponse('Stock request marked in progress', stockRequest))
  } catch (err) {
    next(err)
  }
})

stockRequestsRouter.patch('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const performedBy = getPerformedBy(req)
    const { remarks } = req.body

    const stockRequest = await InvStockRequest.findByPk(Number(id))
    if (!stockRequest) throw new NotFoundError('Stock request not found')
    if (['FULFILLED', 'CANCELLED'].includes(stockRequest.status ?? '')) {
      throw new BadRequestError(`Cannot cancel a request with status '${stockRequest.status}'`, 'INVALID_TRANSITION')
    }

    await stockRequest.update({ status: 'CANCELLED', updatedAt: new Date() })

    await InvStockRequestEvent.create({
      requestId: stockRequest.id,
      eventType: 'CANCELLED',
      performedBy,
      performedAt: new Date(),
      remarks: remarks ?? null,
    })

    res.json(successResponse('Stock request cancelled', stockRequest))
  } catch (err) {
    next(err)
  }
})

// ── Events ────────────────────────────────────────────────────────────────────

stockRequestsRouter.get('/:id/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string

    // The frontend's stockRequestApi.events() is typed apiGet<StockRequestEvent[]>
    // — it expects a bare array, not the {items,total,...} pagination
    // envelope (same bug class fixed on the analogous batch events endpoint).
    const rows = await InvStockRequestEvent.findAll({
      where: { requestId: Number(id) },
      order: [['performedAt', 'DESC']],
    })

    res.json(successResponse('Stock request events', rows))
  } catch (err) {
    next(err)
  }
})

export default stockRequestsRouter
