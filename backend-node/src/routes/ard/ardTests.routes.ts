import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import {
  ArdTestRequest,
  ArdAtrForm,
  ArdAtrSample,
  ArdAnalystQualification,
  ArdTeam,
  ArdAuditLog,
  User,
  Role,
  Department,
} from '../../models/index'
import { generateArTestNumber } from '../../utils/idSequence'
import { enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings'

const ardTestRouter = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ard_test_requests has no workflow_history column (that column exists on
// ard_atr_forms only). Per-test workflow events are therefore recorded as
// ArdAuditLog rows, which is the purpose-built table and is what FastAPI relies on.
async function recordTestHistory(
  testId: string,
  action: string,
  userId: string,
  username: string,
  detail?: string,
) {
  const note = detail ? `${username}: ${detail}` : username
  await writeAuditLog(testId, action, userId, note)
}

/**
 * Is this analyst qualified for the technique?
 * ard_analyst_qualifications holds one row per user with a technique_entries JSON list;
 * there are no per-technique or is_active columns to filter on.
 */
async function isAnalystQualified(userId: string, techniqueCode: string): Promise<boolean> {
  const qualification = await ArdAnalystQualification.findOne({ where: { userId } })
  if (!qualification) return false
  const entries: any[] = ((qualification as any).techniqueEntries as any[]) || []
  return entries.some((e: any) => (e?.techniqueCode ?? e?.technique) === techniqueCode)
}

/** Sample ids belonging to an ATR — the only link between tests and a form. */
async function sampleIdsForAtr(atrFormId: string): Promise<string[]> {
  const samples = await ArdAtrSample.findAll({ where: { atrFormId }, attributes: ['id'] })
  return samples.map((s) => (s as any).id as string)
}

// A test is scoped to an ATR through its sample (ard_test_requests.sample_id →
// ard_atr_samples.atr_form_id); there is no atr_form_id on the test itself.
async function findTest(atrId: string, testId: string) {
  const test = await ArdTestRequest.findOne({
    where: { id: testId },
    include: [{
      model: ArdAtrSample,
      as: 'sample',
      attributes: ['id', 'atrFormId'],
      where: { atrFormId: atrId },
      required: true,
    }],
  })
  if (!test) throw new NotFoundError('Test request not found')
  return test
}

function roleCode(req: Request): string {
  return ((req.user as any)?.role as any)?.code ?? ''
}

const SUPER_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN']
const TL_ROLES = ['TL', 'HOD', 'SUPER_ADMIN', 'ADMIN']

function assertRole(req: Request, codes: string[]) {
  const code = roleCode(req)
  if (!codes.includes(code)) throw new ForbiddenError('Insufficient privileges for this action')
}

function assertStatus(test: any, allowed: string[], action: string) {
  if (!allowed.includes((test as any).status)) {
    throw new BadRequestError(
      `Cannot ${action}: current status is ${(test as any).status}. Expected one of: ${allowed.join(', ')}`,
    )
  }
}

async function tryAdvanceAtr(atrFormId: string): Promise<void> {
  const sampleIds = await sampleIdsForAtr(atrFormId)
  if (sampleIds.length === 0) return
  const allTests = await ArdTestRequest.findAll({ where: { sampleId: { [Op.in]: sampleIds } } })
  if (allTests.length === 0) return
  const DONE_STATUSES = ['VERIFIED', 'ACCEPTED', 'FAILED', 'UNSATISFACTORY', 'REJECTED']
  const allDone = allTests.every((t) => DONE_STATUSES.includes((t as any).status ?? ''))
  if (!allDone) return
  const atr = await ArdAtrForm.findByPk(atrFormId)
  if (!atr || (atr as any).status !== 'IN_PROGRESS') return
  await (atr as any).update({ status: 'PENDING_APPROVAL', updatedAt: new Date() })
}

async function writeAuditLog(entityId: string, action: string, userId: string, detail?: string): Promise<void> {
  try {
    await ArdAuditLog.create({ entityType: 'ATR_TEST', entityId, action, detail: detail ?? null, userId })
  } catch {
    // audit log failures must never break the main flow
  }
}


/**
 * Flatten the ATR/sample context onto a test payload. The frontend's test rows show
 * Form No / Product / Sample Code, which live on the parent sample and form — see
 * _test_out() in backend/app/modules/ard/tests.py:197-200.
 */
function testOut(test: any): Record<string, unknown> {
  const plain = typeof test?.toJSON === 'function' ? test.toJSON() : { ...test }
  const sample = plain.sample ?? null
  const form = sample?.atrForm ?? null
  delete plain.sample
  return {
    ...plain,
    atrId: form?.id ?? null,
    formNo: form?.formNo ?? null,
    projectCode: form?.projectCode ?? null,
    productName: form?.productName ?? null,
    assignedTl: form?.assignedTl ?? null,
    assignedTlId: form?.assignedTlId ?? null,
    qcRef: form?.qcRef ?? null,
    atrStatus: form?.status ?? null,
    sampleCode: sample?.sampleCode ?? null,
    sampleType: sample?.sampleType ?? null,
    batchNo: sample?.batchNo ?? null,
  }
}

// Eager-load chain used wherever a test is returned to the client.
const TEST_CONTEXT_INCLUDE = [{
  model: ArdAtrSample,
  as: 'sample',
  attributes: ['id', 'sampleCode', 'sampleType', 'batchNo', 'atrFormId'],
  required: false,
  include: [{
    model: ArdAtrForm,
    as: 'atrForm',
    attributes: ['id', 'formNo', 'projectCode', 'productName', 'assignedTl', 'assignedTlId', 'qcRef', 'status'],
    required: false,
  }],
}]

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET / â€” paginated list
ardTestRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const where: Record<string, any> = {}

    if (req.query.status) where.status = req.query.status
    if (req.query.view === 'mine') where.assignedToId = (req.user as any).id

    if (req.query.q) {
      const q = `%${req.query.q}%`
      where[Op.or as any] = [
        { testType: { [Op.iLike]: q } },
        { arNumber: { [Op.iLike]: q } },
        { techniqueCode: { [Op.iLike]: q } },
      ]
    }

    const { rows, count } = await ArdTestRequest.findAndCountAll({
      where,
      include: TEST_CONTEXT_INCLUDE as any,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
    })

    return res.json(listResponse('Test requests retrieved', rows.map(testOut), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /bulk-assign
ardTestRouter.post('/bulk-assign', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({
      testIds: z.array(z.object({ atrId: z.string(), testId: z.string() })),
      analystId: z.string(),
      analystName: z.string(),
    })

    const body = bodySchema.parse(req.body)
    let updatedCount = 0

    for (const { atrId, testId } of body.testIds) {
      const test = await ArdTestRequest.findOne({
        where: { id: testId },
        include: [{ model: ArdAtrSample, as: 'sample', attributes: ['id'], where: { atrFormId: atrId }, required: true }],
      })
      if (!test) continue

      let arNumber = (test as any).arNumber
      if (!arNumber) {
        arNumber = await generateArTestNumber((test as any).techniqueCode || 'GEN')
      }

      await test.update({
        assignedToId: body.analystId,
        assignedToName: body.analystName,
        assignedAt: new Date(),
        status: 'ASSIGNED',
        arNumber,
      })
      updatedCount++
    }

    return res.json(successResponse('Tests assigned', { updatedCount }))
  } catch (err) {
    next(err)
  }
})

// GET /:atrId/:testId
ardTestRouter.get('/:atrId/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await findTest(req.params.atrId as string, req.params.testId as string)
    const test = await ArdTestRequest.findByPk(req.params.testId as string, {
      include: TEST_CONTEXT_INCLUDE as any,
    })
    return res.json(successResponse('Test request retrieved', test ? testOut(test) : null))
  } catch (err) {
    next(err)
  }
})

// GET /:atrId/:testId/qualified-analysts
ardTestRouter.get(
  '/:atrId/:testId/qualified-analysts',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const techniqueCode = (test as any).techniqueCode

      // Qualifications are one row per analyst holding a technique_entries JSON list
      // (see ardTeam.routes.ts:168-171) — there is no per-technique column to filter on,
      // so filter in memory on the entry's techniqueCode.
      const allQualifications = await ArdAnalystQualification.findAll()
      const qualifications = allQualifications.filter((q: any) => {
        const entries: any[] = (q.techniqueEntries as any[]) || []
        return entries.some((e: any) => (e?.techniqueCode ?? e?.technique) === techniqueCode)
      })

      const result = await Promise.all(
        qualifications.map(async (q: any) => {
          const user = await User.findByPk(q.userId, {
            attributes: ['id', 'username', 'empNo', 'email'],
          })
          return { qualification: q, user }
        }),
      )

      return res.json(successResponse('Qualified analysts retrieved', result))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/assign
ardTestRouter.post(
  '/:atrId/:testId/assign',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)

      const bodySchema = z.object({
        analyst_id: z.string(),
        analyst_name: z.string().optional(),
      })
      const body = bodySchema.parse(req.body)

      const qualified = await isAnalystQualified(body.analyst_id, (test as any).techniqueCode)
      if (!qualified) throw new BadRequestError('Analyst is not qualified for this technique.')

      let arNumber = (test as any).arNumber
      if (!arNumber) {
        arNumber = await generateArTestNumber((test as any).techniqueCode || 'GEN')
      }

      const user = req.user as any
      await recordTestHistory((test as any).id, 'ASSIGNED', user.id, user.username)

      await test.update({
        assignedToId: body.analyst_id,
        assignedToName: body.analyst_name ?? null,
        assignedAt: new Date(),
        status: 'ASSIGNED',
        arNumber
      })

      return res.json(successResponse('Test assigned', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/claim
ardTestRouter.post(
  '/:atrId/:testId/claim',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['UNASSIGNED'], 'claim')

      const user = req.user as any
      let arNumber = (test as any).arNumber
      if (!arNumber) {
        arNumber = await generateArTestNumber((test as any).techniqueCode || 'GEN')
      }

      await recordTestHistory((test as any).id, 'CLAIMED', user.id, user.username)

      await test.update({
        assignedToId: user.id,
        assignedToName: user.username,
        assignedAt: new Date(),
        status: 'ASSIGNED',
        arNumber
      })

      return res.json(successResponse('Test claimed', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/delegate
ardTestRouter.post(
  '/:atrId/:testId/delegate',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['ASSIGNED'], 'delegate')

      const bodySchema = z.object({
        analyst_id: z.string(),
        analyst_name: z.string().optional(),
      })
      const body = bodySchema.parse(req.body)

      const qualified = await isAnalystQualified(body.analyst_id, (test as any).techniqueCode)
      if (!qualified) throw new BadRequestError('Analyst is not qualified for this technique.')

      const user = req.user as any
      await recordTestHistory(
        (test as any).id,
        'DELEGATED',
        user.id,
        user.username,
        `To: ${body.analyst_name ?? body.analyst_id}`,
      )

      await test.update({
        assignedToId: body.analyst_id,
        assignedToName: body.analyst_name ?? null,
        assignedAt: new Date()
      })

      return res.json(successResponse('Test delegated', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/start
ardTestRouter.post(
  '/:atrId/:testId/start',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['ASSIGNED'], 'start')

      const user = req.user as any
      await recordTestHistory((test as any).id, 'IN_PROGRESS', user.id, user.username)

      await test.update({ status: 'IN_PROGRESS', startedAt: new Date() })
      return res.json(successResponse('Test started', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/save-results
ardTestRouter.post(
  '/:atrId/:testId/save-results',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const bodySchema = z.object({ results: z.any() })
      const body = bodySchema.parse(req.body)

      await test.update({ results: body.results })
      return res.json(successResponse('Results saved', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/submit
ardTestRouter.post(
  '/:atrId/:testId/submit',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['IN_PROGRESS'], 'submit')
      await enforceEsignature(user, ESIGN_FLAGS.EXPERIMENT_SUBMIT_AUTH, req.body.password as string | undefined)
      await recordTestHistory((test as any).id, 'VERIFICATION_REQUESTED', user.id, user.username)

      await test.update({ status: 'VERIFICATION_REQUESTED', submittedAt: new Date() })
      await writeAuditLog(req.params.testId as string, 'TEST_SUBMITTED', user.id)
      return res.json(successResponse('Test submitted', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/verify
ardTestRouter.post(
  '/:atrId/:testId/verify',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const code = roleCode(req)
      const deptCode = (user.department as any)?.code
      const allowed =
        ['TL', 'HOD', 'SUPER_ADMIN', 'ADMIN'].includes(code) || deptCode === 'QA'
      if (!allowed) throw new ForbiddenError('Insufficient privileges for this action')

      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFICATION_REQUESTED'], 'verify')
      await enforceEsignature(user, ESIGN_FLAGS.ASSIGN_TEST_AUTH, req.body.password as string | undefined)

      await recordTestHistory((test as any).id, 'VERIFIED', user.id, user.username)

      await test.update({
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: user.id
      })
      await writeAuditLog(req.params.testId as string, 'TEST_VERIFIED', user.id)
      await tryAdvanceAtr(req.params.atrId as string)
      return res.json(successResponse('Test verified', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/rework
ardTestRouter.post(
  '/:atrId/:testId/rework',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFICATION_REQUESTED', 'VERIFIED'], 'rework')

      const bodySchema = z.object({ remarks: z.string().optional() })
      const body = bodySchema.parse(req.body)
      const user = req.user as any
      await recordTestHistory(
        (test as any).id,
        'REWORK',
        user.id,
        user.username,
        body.remarks,
      )

      await test.update({
        status: 'ASSIGNED',
        remarks: body.remarks ?? (test as any).remarks
      })
      return res.json(successResponse('Test sent for rework', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/unlock
ardTestRouter.post(
  '/:atrId/:testId/unlock',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFIED'], 'unlock')

      const user = req.user as any
      await recordTestHistory((test as any).id, 'UNLOCKED', user.id, user.username)

      await test.update({ status: 'IN_PROGRESS' })
      return res.json(successResponse('Test unlocked', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/withdraw
ardTestRouter.post(
  '/:atrId/:testId/withdraw',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['ASSIGNED', 'IN_PROGRESS'], 'withdraw')

      const user = req.user as any
      await recordTestHistory((test as any).id, 'WITHDRAWN', user.id, user.username)

      await test.update({ status: 'WITHDRAWN' })
      return res.json(successResponse('Test withdrawn', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/cancel
ardTestRouter.post(
  '/:atrId/:testId/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const terminal = ['WITHDRAWN', 'CANCELLED', 'PUBLISHED', 'ACCEPTED', 'UNSATISFACTORY']
      if (terminal.includes((test as any).status)) {
        throw new BadRequestError(`Cannot cancel a test in terminal status: ${(test as any).status}`)
      }

      const user = req.user as any
      await recordTestHistory((test as any).id, 'CANCELLED', user.id, user.username)

      await test.update({ status: 'CANCELLED' })
      return res.json(successResponse('Test cancelled', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/final-report
ardTestRouter.post(
  '/:atrId/:testId/final-report',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const bodySchema = z.object({ report_path: z.string().min(1) })
      const body = bodySchema.parse(req.body)

      // There is no scalar final_report column — the real schema keeps a
      // final_report_attachments JSON list, so append rather than overwrite.
      const existingReports: any[] = ((test as any).finalReportAttachments as any[]) || []
      await test.update({
        finalReportAttachments: [
          ...existingReports,
          { path: body.report_path, at: new Date(), by: (req.user as any)?.id ?? null },
        ],
      })
      return res.json(successResponse('Final report path saved', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/publish
ardTestRouter.post(
  '/:atrId/:testId/publish',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFIED'], 'publish')

      const user = req.user as any
      await recordTestHistory((test as any).id, 'PUBLISHED', user.id, user.username)

      await test.update({ status: 'PUBLISHED' })
      return res.json(successResponse('Test published', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/accept-test
ardTestRouter.post(
  '/:atrId/:testId/accept-test',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const code = roleCode(req)
      const deptCode = (user.department as any)?.code
      const allowed = ['HOD', 'SUPER_ADMIN', 'ADMIN'].includes(code) || deptCode === 'QA'
      if (!allowed) throw new ForbiddenError('Insufficient privileges for this action')

      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFIED', 'PUBLISHED'], 'accept-test')
      await enforceEsignature(user, ESIGN_FLAGS.QA_CERTIFY_AUTH, req.body.password as string | undefined)

      await recordTestHistory((test as any).id, 'ACCEPTED', user.id, user.username)
      await test.update({ status: 'ACCEPTED' })
      await writeAuditLog(req.params.testId as string, 'TEST_ACCEPTED', user.id)
      await tryAdvanceAtr(req.params.atrId as string)
      return res.json(successResponse('Test accepted', test))
    } catch (err) {
      next(err)
    }
  },
)

// POST /:atrId/:testId/unsatisfactory
ardTestRouter.post(
  '/:atrId/:testId/unsatisfactory',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const code = roleCode(req)
      const deptCode = (user.department as any)?.code
      const allowed = ['HOD', 'SUPER_ADMIN', 'ADMIN'].includes(code) || deptCode === 'QA'
      if (!allowed) throw new ForbiddenError('Insufficient privileges for this action')

      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['VERIFIED', 'PUBLISHED'], 'mark-unsatisfactory')

      await recordTestHistory((test as any).id, 'UNSATISFACTORY', user.id, user.username)
      await test.update({ status: 'UNSATISFACTORY' })
      return res.json(successResponse('Test marked unsatisfactory', test))
    } catch (err) {
      next(err)
    }
  },
)

ardTestRouter.post(
  '/:atrId/:testId/takeover',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['ASSIGNED', 'IN_PROGRESS'], 'takeover')
      await recordTestHistory((test as any).id, 'TAKEOVER', user.id, user.username ?? user.email)
      await test.update({
        assignedToId: user.id,
        assignedToName: user.username ?? user.email ?? user.id,
        assignedAt: new Date()
      })
      await writeAuditLog(req.params.testId as string, 'TEST_TAKEOVER', user.id)
      return res.json(successResponse('Test taken over', test))
    } catch (err) {
      next(err)
    }
  },
)

ardTestRouter.post(
  '/:atrId/:testId/enhancement',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      const { message, enhancementType } = req.body
      if (!message) throw new BadRequestError('message is required', 'MISSING_PARAM')
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes((test as any).status)) {
        throw new BadRequestError(`Cannot add enhancement to a test with status ${(test as any).status}`, 'INVALID_STATUS')
      }
      const existing: any[] = (test as any).clarifications ?? []
      const entry = {
        type: 'ENHANCEMENT',
        enhancementType: enhancementType ?? null,
        message,
        requestedBy: user.id,
        requestedByName: user.username ?? user.email,
        requestedAt: new Date(),
      }
      await (test as any).update({ clarifications: [...existing, entry] })
      await writeAuditLog(req.params.testId as string, 'ENHANCEMENT_REQUESTED', user.id, message)
      return res.json(successResponse('Enhancement request recorded', test))
    } catch (err) {
      next(err)
    }
  },
)

ardTestRouter.post(
  '/:atrId/:testId/publish-tentative',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      assertStatus(test, ['IN_PROGRESS', 'VERIFICATION_REQUESTED'], 'publish-tentative')
      await recordTestHistory((test as any).id, 'PUBLISHED_TENTATIVE', user.id, user.username ?? user.email)
      await test.update({ status: 'PUBLISHED' })
      await writeAuditLog(req.params.testId as string, 'TEST_PUBLISHED_TENTATIVE', user.id)
      return res.json(successResponse('Test result published as tentative', test))
    } catch (err) {
      next(err)
    }
  },
)

ardTestRouter.post(
  '/:atrId/:testId/generate-ar',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      assertRole(req, TL_ROLES)
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      if ((test as any).arNumber) {
        return res.json(successResponse('AR number already exists', { arNumber: (test as any).arNumber }))
      }
      const arNumber = await generateArTestNumber((test as any).techniqueCode || 'GEN')
      await test.update({ arNumber })
      return res.json(successResponse('AR number generated', { arNumber }))
    } catch (err) {
      next(err)
    }
  },
)

export default ardTestRouter

