import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { ArdQcTrfForm, ArdAuditLog, ArdAtrForm, ArdAtrSample, ArdTestRequest, User } from '../../models/index'

const router = Router()

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SAVED', 'SUBMITTED', 'WITHDRAWN'],
  SAVED: ['SUBMITTED', 'DRAFT', 'WITHDRAWN'],
  SUBMITTED: ['REGISTERED', 'REJECTED', 'WITHDRAWN'],
  REGISTERED: ['RECEIVED', 'REJECTED'],
  RECEIVED: ['REJECTED'],
  REJECTED: ['SAVED', 'SUBMITTED'],
}

function canReadAll(roleCode: string) {
  return ['QA', 'HOD', 'ADMIN', 'SUPER_ADMIN', 'TL', 'TEAM_LEAD'].includes(roleCode)
}
function isLabRole(roleCode: string) {
  return !['EXTERNAL', 'ADC_PD', 'CGT'].includes(roleCode)
}
function isAnalystTeam(roleCode: string) {
  return ['ANALYST', 'CHEMIST', 'CHEM', 'TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)
}

function trfOut(f: ArdQcTrfForm) {
  return {
    id: f.id,
    formNo: f.formNo,
    status: f.status,
    projectCode: f.projectCode,
    projectName: f.projectName,
    sampleCode: f.sampleCode,
    sampleType: f.sampleType,
    batchNo: f.batchNo,
    sampleQty: f.sampleQty,
    sampleQtyUom: f.sampleQtyUom,
    mfgDate: f.mfgDate,
    expDate: f.expDate,
    storageCondition: f.storageCondition,
    sampleDescription: f.sampleDescription,
    totalContainers: f.totalContainers,
    sampledContainers: f.sampledContainers,
    sampleContent: f.sampleContent,
    preparedBy: f.preparedBy,
    preparedOn: f.preparedOn,
    sampledBy: f.sampledBy,
    sampledOn: f.sampledOn,
    specificationName: f.specificationName,
    specificationId: f.specificationId,
    specificationVersion: f.specificationVersion,
    submittedBy: f.submittedBy,
    submittedOn: f.submittedOn,
    registeredBy: f.registeredBy,
    registeredOn: f.registeredOn,
    approvedBy: f.approvedBy,
    approvedAt: f.approvedAt,
    rejectedBy: f.rejectedBy,
    rejectedOn: f.rejectedOn,
    rejectRemarks: f.rejectRemarks,
    receivedBy: f.receivedBy,
    receivedAt: f.receivedAt,
    sampleIntegrity: f.sampleIntegrity,
    receivingRemarks: f.receivingRemarks,
    assignedTl: f.assignedTl,
    qcRefNum: f.qcRefNum,
    remarks: f.remarks,
    testRequests: f.testRequests,
    sampleLines: f.sampleLines,
    sampleAttributes: f.sampleAttributes,
    createdBy: f.createdBy,
    createdById: f.createdById,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }
}

async function auditLog(entityId: string, action: string, userId: string | null) {
  await ArdAuditLog.create({ entityType: 'QC_TRF', entityId, action, userId } as any)
}

// GET /api/ard/qc-trf
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const { status, q, view } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}

    if (view === 'received' || view === 'all') {
      if (!canReadAll(roleCode)) throw new ForbiddenError('Insufficient permissions')
      if (view === 'received') where.status = 'SUBMITTED'
    } else {
      where.createdById = user.id
    }

    if (status) where.status = status
    if (q) where[Op.or] = [{ formNo: { [Op.iLike]: `%${q}%` } }, { projectName: { [Op.iLike]: `%${q}%` } }]

    const { count, rows } = await ArdQcTrfForm.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] })
    res.json(listResponse('QC-TRF forms', rows.map(trfOut), buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// GET /api/ard/qc-trf/:formId
router.get('/:formId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const f = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!f) throw new NotFoundError('QC-TRF form')
    if (f.createdById !== user.id && !canReadAll(roleCode)) throw new ForbiddenError('Access denied')
    res.json(successResponse('QC-TRF form', trfOut(f)))
  } catch (err) { next(err) }
})

// POST /api/ard/qc-trf
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    if (!isAnalystTeam(roleCode)) throw new ForbiddenError('Insufficient permissions')

    const { projectCode, projectName } = z.object({
      projectCode: z.string().min(1),
      projectName: z.string().min(1),
    }).parse(req.body)

    const formNo = `TRF-DRAFT-${uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()}`

    const f = await ArdQcTrfForm.create({
      formNo, projectCode, projectName,
      sampleCode: '', batchNo: '',
      testRequests: [], sampleLines: [], sampleAttributes: [],
      createdBy: user.username, createdById: user.id,
    } as any)

    await auditLog(f.id, 'Created', user.id)
    res.status(201).json(successResponse('QC-TRF form created', trfOut(f)))
  } catch (err) { next(err) }
})

// PUT /api/ard/qc-trf/:formId
router.put('/:formId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const f = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!f) throw new NotFoundError('QC-TRF form')
    if (f.createdById !== user.id && !canReadAll(roleCode)) throw new ForbiddenError('Access denied')
    if (!isLabRole(roleCode)) throw new ForbiddenError('Insufficient permissions')

    const scalars = ['projectCode', 'projectName', 'sampleCode', 'sampleType', 'batchNo',
      'sampleQty', 'sampleQtyUom', 'mfgDate', 'expDate', 'storageCondition', 'sampleDescription',
      'totalContainers', 'sampledContainers', 'sampleContent', 'preparedBy', 'preparedOn',
      'sampledBy', 'sampledOn', 'specificationName', 'specificationId', 'specificationVersion',
      'qcRefNum', 'remarks', 'assignedTl']
    const updates: any = {}
    scalars.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    if (req.body.testRequests !== undefined) updates.testRequests = req.body.testRequests
    if (req.body.sampleLines !== undefined) updates.sampleLines = req.body.sampleLines
    if (req.body.sampleAttributes !== undefined) updates.sampleAttributes = req.body.sampleAttributes
    if (req.body.status === 'DRAFT' || req.body.status === 'SAVED') updates.status = req.body.status
    updates.updatedAt = new Date()

    await f.update(updates)
    await auditLog(f.id, 'Updated', user.id)
    res.json(successResponse('QC-TRF form updated', trfOut(f)))
  } catch (err) { next(err) }
})

// POST /api/ard/qc-trf/:formId/transition
router.post('/:formId/transition', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const f = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!f) throw new NotFoundError('QC-TRF form')

    const { to, rejectRemarks, receivedBy, sampleIntegrity, receivingRemarks } = z.object({
      to: z.string().min(1),
      rejectRemarks: z.string().optional(),
      receivedBy: z.string().optional(),
      sampleIntegrity: z.string().optional(),
      receivingRemarks: z.string().optional(),
    }).parse(req.body)

    const allowed = VALID_TRANSITIONS[f.status as string] || []
    if (!allowed.includes(to)) {
      throw new BadRequestError(`Cannot transition from ${f.status} to ${to}`, 'INVALID_TRANSITION')
    }

    const updates: any = { status: to, updatedAt: new Date() }

    if (to === 'SUBMITTED') {
      const tests = (f.testRequests as any[]) || []
      if (tests.length === 0) throw new BadRequestError('At least one test request is required before submitting', 'VALIDATION_ERROR')
      if (!f.sampleCode) throw new BadRequestError('Sample code is required before submitting', 'VALIDATION_ERROR')
      if (!f.projectCode) throw new BadRequestError('Project code is required before submitting', 'VALIDATION_ERROR')

      // Assign proper TRF number
      const year = new Date().getFullYear()
      const [{ count }] = await sequelize.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ard_qc_trf_forms WHERE form_no LIKE 'TRF-${year}-%'`,
        { type: QueryTypes.SELECT }
      )
      const seq = String(Number(count) + 1).padStart(5, '0')
      updates.formNo = `TRF-${year}-${seq}`
      updates.submittedBy = user.username
      updates.submittedOn = new Date()
    }

    if (to === 'REGISTERED') {
      updates.registeredBy = user.username
      updates.registeredOn = new Date()
      updates.approvedBy = user.username
      updates.approvedAt = new Date()
    }

    if (to === 'RECEIVED') {
      if (!receivedBy) throw new BadRequestError('receivedBy is required', 'VALIDATION_ERROR')
      updates.receivedBy = receivedBy
      updates.receivedAt = new Date()
      updates.sampleIntegrity = sampleIntegrity || null
      updates.receivingRemarks = receivingRemarks || null

      // Auto-create ATR form, sample and test requests
      const t = await sequelize.transaction()
      try {
        await f.update(updates, { transaction: t })
        await auditLog(f.id, `Status → ${to}`, user.id)

        const atrForm = await ArdAtrForm.create({
          formNo: `ATR-TRF-${f.formNo}`,
          productName: f.projectName,
          projectCode: f.projectCode,
          status: 'APPROVED',
          originModule: 'QC_TRF',
          createdBy: user.username,
          createdById: user.id,
        } as any, { transaction: t })

        const sample = await ArdAtrSample.create({
          atrFormId: atrForm.id,
          sampleCode: f.sampleCode,
          batchNo: f.batchNo,
          tests: [],
        } as any, { transaction: t })

        const tests = (f.testRequests as any[]) || []
        for (const tr of tests) {
          await ArdTestRequest.create({
            sampleId: sample.id,
            testType: tr.testType || tr.test_type || 'General',
            status: 'UNASSIGNED',
            arNumber: f.formNo,
          } as any, { transaction: t })
        }

        await t.commit()
        return res.json(successResponse(`Status updated to ${to}`, trfOut(f)))
      } catch (err) {
        await t.rollback()
        throw err
      }
    }

    if (to === 'REJECTED') {
      if (!rejectRemarks?.trim()) throw new BadRequestError('Reject remarks are required', 'VALIDATION_ERROR')
      updates.rejectedBy = user.username
      updates.rejectedOn = new Date()
      updates.rejectRemarks = rejectRemarks
    }

    if (to === 'WITHDRAWN') {
      const remarks = req.body.remarks || req.body.withdrawRemarks
      updates.rejectRemarks = remarks || null
    }

    await f.update(updates)
    await auditLog(f.id, `Status → ${to}`, user.id)
    res.json(successResponse(`Status updated to ${to}`, trfOut(f)))
  } catch (err) { next(err) }
})

// POST /api/ard/qc-trf/:formId/add-tests
router.post('/:formId/add-tests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    if (!isAnalystTeam(roleCode)) throw new ForbiddenError('Insufficient permissions')

    const f = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!f) throw new NotFoundError('QC-TRF form')

    const allowedStatuses = ['DRAFT', 'SAVED', 'SUBMITTED', 'REGISTERED']
    if (!allowedStatuses.includes(f.status as string)) {
      throw new BadRequestError(`Cannot add tests in status ${f.status}`, 'INVALID_STATE')
    }

    const newTests: any[] = req.body.testRequests || req.body.tests || []
    if (!Array.isArray(newTests) || newTests.length === 0) {
      throw new BadRequestError('testRequests array is required', 'VALIDATION_ERROR')
    }

    const existing = (f.testRequests as any[]) || []
    await f.update({ testRequests: [...existing, ...newTests], updatedAt: new Date() })
    await auditLog(f.id, `Additional tests added (${newTests.length})`, user.id)
    res.json(successResponse('Tests added', trfOut(f)))
  } catch (err) { next(err) }
})

// DELETE /api/ard/qc-trf/:formId
router.delete('/:formId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    if (!isAnalystTeam(roleCode)) throw new ForbiddenError('Insufficient permissions')

    const f = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!f) throw new NotFoundError('QC-TRF form')
    if (!['DRAFT', 'SAVED'].includes(f.status as string)) {
      throw new BadRequestError('Only DRAFT or SAVED forms can be deleted', 'INVALID_STATE')
    }

    await auditLog(f.id, 'Deleted', user.id)
    await f.destroy()
    res.json(successResponse('QC-TRF form deleted', { ok: true }))
  } catch (err) { next(err) }
})

// GET /api/ard/qc-trf/:formId/events
router.get('/:formId/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const f = await ArdQcTrfForm.findByPk(req.params.formId as string, { attributes: ['id', 'createdById'] })
    if (!f) throw new NotFoundError('QC-TRF form')
    if (f.createdById !== user.id && !canReadAll(roleCode)) throw new ForbiddenError('Access denied')

    const logs = await ArdAuditLog.findAll({
      where: { entityType: 'QC_TRF', entityId: req.params.formId as string },
      order: [['createdAt', 'DESC']],
      limit: 200,
    })

    const userIds = [...new Set(logs.map((l: any) => l.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    const items = logs.map((l: any) => ({
      id: l.id,
      eventType: l.action,
      eventTime: l.createdAt,
      user: userMap[l.userId] || null,
      eventDetails: l.detail,
    }))
    res.json(successResponse('Events', { items }))
  } catch (err) { next(err) }
})

// GET /api/ard/qc-trf/:formId/documents/summary.pdf
router.get('/:formId/documents/summary.pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qcTrfSummaryHtml } = await import('../../utils/ardDocuments')
    const { htmlToPdf } = await import('../../utils/pdfRenderer')
    const form = await ArdQcTrfForm.findByPk(req.params.formId as string)
    if (!form) { res.status(404).json({ success: false, message: 'QC-TRF form not found' }); return }
    const html = await qcTrfSummaryHtml(form.toJSON())
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="qc-trf-${form.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

export default router
