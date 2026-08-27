import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { v4 as uuidv4 } from 'uuid'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import { verifyPassword } from '../../utils/auth.utils'
import {
  ArdTestRequest,
  ArdAtrForm,
  ArdAtrSample,
  ArdTeam,
  ArdAuditLog,
  ArdExperiment,
  User,
  Role,
  Department,
} from '../../models/index'
import { generateArTestNumber } from '../../utils/idSequence'
import { enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings'
import { canReadAllTests, teammateTlIds, ledTeamMemberIds } from '../../shared/ardRbac'
import {
  ATR_PENDING_APPROVAL_DONE_TEST_STATUSES,
  shouldMoveAtrToPartialOnTestStart,
} from '../../shared/ardWorkflowGuards'
import {
  assertAnalystQualifiedForTest,
  listQualifiedAnalystIds,
  resolveTestTechniqueKey,
  techniqueHasQualificationRecords,
} from '../../shared/ardQualifications'

const ardTestRouter = Router()

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
  const allDone = allTests.every((t) =>
    ATR_PENDING_APPROVAL_DONE_TEST_STATUSES.includes(((t as any).status ?? '') as any),
  )
  if (!allDone) return
  const atr = await ArdAtrForm.findByPk(atrFormId)
  if (!atr || (atr as any).status !== 'PARTIAL') return
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
    // A test moved by the HOD's "Re-assign Test" tool carries its own team
    // override (reassignedTlId/Name) that supersedes the parent ATR's team —
    // every consumer of assignedTl/assignedTlId (queues, visibility checks)
    // should see the test's CURRENT team, not the ATR's original one.
    assignedTl: plain.reassignedTlName ?? form?.assignedTl ?? null,
    assignedTlId: plain.reassignedTlId ?? form?.assignedTlId ?? null,
    originalAssignedTlId: form?.assignedTlId ?? null,
    qcRef: form?.qcRef ?? null,
    atrStatus: form?.status ?? null,
    sampleCode: sample?.sampleCode ?? null,
    sampleType: sample?.sampleType ?? null,
    batchNo: sample?.batchNo ?? null,
    storageCondition: sample?.storageCondition ?? null,
    packType: sample?.packType ?? null,
    sourceDept: form?.originModule && form.originModule !== 'ARD' ? form.originModule : 'ARD',
    requestedBy: form?.createdBy ?? null,
    requestedOn: form?.createdAt ?? null,
    formCreatedById: form?.createdById ?? null,
    priority: form?.priority ?? null,
  }
}

// Eager-load chain used wherever a test is returned to the client.
const TEST_CONTEXT_INCLUDE = [{
  model: ArdAtrSample,
  as: 'sample',
  attributes: ['id', 'sampleCode', 'sampleType', 'batchNo', 'atrFormId', 'storageCondition', 'packType'],
  required: false,
  include: [{
    model: ArdAtrForm,
    as: 'atrForm',
    attributes: ['id', 'formNo', 'projectCode', 'productName', 'assignedTl', 'assignedTlId', 'qcRef', 'status', 'createdById', 'createdBy', 'createdAt', 'originModule', 'priority'],
    required: false,
  }],
}]

/**
 * Same team-boundary rule as the ATR endpoints: visible if the caller can
 * read all tests (HOD/Admin/QA), is personally assigned/delegated the test,
 * raised the parent ATR themselves, or is on the team the ATR's TL belongs
 * to. `findTest`/the detail route previously had no check at all here —
 * anyone with a valid atrId+testId could read full test detail regardless
 * of team.
 */
// While the parent ATR is mid QA-pre-approval cycle it isn't cleared for the
// team yet — see the matching note on teamScopedAtrWhere in atrs.routes.ts.
const QA_CYCLE_STATUSES = ['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK']

async function canViewTest(user: any, test: any): Promise<boolean> {
  if (canReadAllTests(user)) return true
  const uid = user.id
  if (test.assignedToId === uid || test.delegatedToId === uid) return true
  const atrForm = test.sample?.atrForm
  if (!atrForm) return false
  if (atrForm.createdById === uid) return true
  // A reassigned test's team is whatever it was moved TO, full stop — the
  // old team (via the ATR's own assignedTlId) no longer applies once this is
  // set, matching the "completely goes from his to the selected team" rule.
  const effectiveTlId = test.reassignedTlId ?? atrForm.assignedTlId
  if (effectiveTlId && !QA_CYCLE_STATUSES.includes(atrForm.status)) {
    const tlIds = await teammateTlIds(user)
    if (tlIds.includes(effectiveTlId)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET / â€” paginated list
ardTestRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const { page, limit, offset } = parsePagination(req.query)
    const and: any[] = []
    if (req.query.status) and.push({ status: req.query.status })
    if (req.query.view === 'unlocked') and.push({ status: 'UNLOCKED' })
    if (req.query.experimentId) and.push({ experimentId: req.query.experimentId })

    if (req.query.q) {
      const q = `%${req.query.q}%`
      and.push({
        [Op.or]: [
          { testType: { [Op.iLike]: q } },
          { arNumber: { [Op.iLike]: q } },
          { techniqueCode: { [Op.iLike]: q } },
        ],
      })
    }

    // Explicit team filter for the HOD's "Re-assign Test" tool — applies
    // regardless of role, since canReadAllTests users (HOD) otherwise get no
    // team scoping at all below. A test with a reassignedTlId override uses
    // that as its current team; everything else falls back to its parent
    // ATR's assignedTlId, same rule as canViewTest/the visibility clause below.
    if (req.query.tlId) {
      and.push({
        [Op.or]: [
          { reassignedTlId: req.query.tlId },
          { reassignedTlId: { [Op.is]: null }, '$sample.atrForm.assigned_tl_id$': req.query.tlId },
        ],
      })
    }

    if (!canReadAllTests(user)) {
      // A test belongs to whichever team its ATR is assigned to — visible to
      // that team's HOD/TLs/analysts, plus whoever it's personally
      // assigned/delegated to or whoever raised the parent ATR. Previously
      // ANY unassigned test (assignedToId null / status UNASSIGNED) was
      // visible to every authenticated user with no team boundary at all;
      // that's now scoped the same way.
      const uid = user.id
      const tlIds = await teammateTlIds(user)
      const orClause: any[] = [
        { assignedToId: uid },
        { delegatedToId: uid },
        { '$sample.atrForm.created_by_id$': uid },
      ]
      if (tlIds.length > 0) {
        // Not visible to the team while the parent ATR is still mid QA-pre-
        // approval cycle — see canViewTest's note above. A test carrying its
        // own reassignedTlId has moved teams — only that new team (not the
        // ATR's original one) should see it.
        orClause.push({
          [Op.or]: [
            { reassignedTlId: { [Op.in]: tlIds } },
            {
              reassignedTlId: { [Op.is]: null },
              '$sample.atrForm.assigned_tl_id$': { [Op.in]: tlIds },
              '$sample.atrForm.status$': { [Op.notIn]: QA_CYCLE_STATUSES },
            },
          ],
        })
      }
      and.push({ [Op.or]: orClause })
    }

    const where = and.length ? { [Op.and]: and } : {}

    const listInclude = [{
      ...TEST_CONTEXT_INCLUDE[0],
      required: !canReadAllTests(user),
      include: [{
        ...(TEST_CONTEXT_INCLUDE[0] as any).include[0],
        required: !canReadAllTests(user),
      }],
    }]

    const { rows, count } = await ArdTestRequest.findAndCountAll({
      where,
      include: listInclude as any,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true,
      subQuery: false,
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

      // AR number is generated only when the analyst actually starts the
      // test (see POST /:atrId/:testId/start) — not at assignment, so an
      // assigned-but-not-yet-started test has no AR# yet.
      await test.update({
        assignedToId: body.analystId,
        assignedToName: body.analystName,
        assignedAt: new Date(),
        status: 'ASSIGNED',
      })
      updatedCount++
    }

    return res.json(successResponse('Tests assigned', { updatedCount }))
  } catch (err) {
    next(err)
  }
})

// POST /bulk-reassign-team — the HOD's "Re-assign Test" tool. Moves selected
// tests to a different team wholesale: sets a per-test team override
// (reassignedTlId/Name) that supersedes the parent ATR's own assignedTlId
// everywhere a test's team is checked (testOut, canViewTest, the list route's
// visibility clause above) — the old team stops seeing these tests, the new
// team starts, and sibling tests left on the same ATR are untouched.
const HOD_REASSIGN_ROLES = ['HOD', 'SUPER_ADMIN', 'ADMIN']
ardTestRouter.post('/bulk-reassign-team', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    assertRole(req, HOD_REASSIGN_ROLES)

    const body = z.object({
      testIds: z.array(z.string()).min(1),
      tlId: z.string(),
      remarks: z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body)

    // This bulk, cross-team ownership change always requires e-signature —
    // unlike this file's other ESIGN_FLAGS-gated actions (which are
    // admin-toggle, off by default), this one is unconditional, matching
    // ardProjects.routes.ts's spec submit/approve routes.
    const passwordValid = await verifyPassword(body.password, user.passwordHash)
    if (!passwordValid) {
      throw new BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED')
    }

    const targetTl = await User.findByPk(body.tlId)
    if (!targetTl) throw new NotFoundError('Target Team Lead not found')

    const tests = await ArdTestRequest.findAll({ where: { id: { [Op.in]: body.testIds } } })
    let updatedCount = 0
    for (const test of tests) {
      const fromTl = (test as any).reassignedTlName ?? null
      await test.update({
        reassignedTlId: body.tlId,
        reassignedTlName: (targetTl as any).username,
        testReassignRemarks: body.remarks,
      })
      await writeAuditLog(
        (test as any).id,
        'TEAM_REASSIGNED',
        user.id,
        `${user.username}: reassigned${fromTl ? ` from ${fromTl}` : ''} to ${(targetTl as any).username} — ${body.remarks}`,
      )
      updatedCount++
    }

    return res.json(successResponse('Tests reassigned', { updatedCount }))
  } catch (err) {
    next(err)
  }
})

// GET /unsatisfactory-report — HOD's cross-team view of every test currently
// UNSATISFACTORY across every team they lead (not just one team at a time,
// unlike the tlId filter above — this pools all of them). Optionally bounded
// by a date range on updatedAt: UNSATISFACTORY is a terminal status (see the
// `terminal` list further down in this file), so nothing updates a test's
// row after it lands in this status — updatedAt reliably means "when it was
// marked unsatisfactory."
ardTestRouter.get('/unsatisfactory-report', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertRole(req, ['HOD', 'SUPER_ADMIN'])
    const user = (req as any).user

    const myTeams = await ArdTeam.findAll({ where: { hodId: user.id }, attributes: ['tlIds'] })
    const tlIds = Array.from(new Set(myTeams.flatMap((t: any) => (t.tlIds ?? []) as string[])))

    const and: any[] = [{ status: 'UNSATISFACTORY' }]
    if (tlIds.length > 0) {
      and.push({
        [Op.or]: [
          { reassignedTlId: { [Op.in]: tlIds } },
          { reassignedTlId: { [Op.is]: null }, '$sample.atrForm.assigned_tl_id$': { [Op.in]: tlIds } },
        ],
      })
    } else {
      // This HOD leads no teams — never fall through to "no team filter at
      // all" (which would leak every other HOD's tests); force zero rows.
      and.push({ id: null })
    }

    if (req.query.applyDate === 'true') {
      const from = req.query.from ? new Date(req.query.from as string) : null
      const to = req.query.to ? new Date(req.query.to as string) : null
      if (from && to && from.getTime() > to.getTime()) {
        throw new BadRequestError('"From" date must be before "To" date')
      }
      const dateWhere: any = {}
      if (from) dateWhere[Op.gte] = from
      if (to) dateWhere[Op.lte] = to
      if (from || to) and.push({ updatedAt: dateWhere })
    }

    const tests = await ArdTestRequest.findAll({
      where: { [Op.and]: and },
      include: TEST_CONTEXT_INCLUDE as any,
      order: [['updatedAt', 'DESC']],
      subQuery: false,
    })

    return res.json(successResponse('Unsatisfactory tests', tests.map(testOut)))
  } catch (err) {
    next(err)
  }
})

// GET /:atrId/:testId
ardTestRouter.get('/:atrId/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    await findTest(req.params.atrId as string, req.params.testId as string)
    const test = await ArdTestRequest.findByPk(req.params.testId as string, {
      include: TEST_CONTEXT_INCLUDE as any,
    })
    if (!test) throw new NotFoundError('Test request not found')
    if (!(await canViewTest(user, test))) throw new ForbiddenError('Not permitted to view this test.')
    return res.json(successResponse('Test request retrieved', testOut(test)))
  } catch (err) {
    next(err)
  }
})

// GET /:atrId/:testId/events — audit trail for a single test (ownership/status
// transitions written by recordTestHistory as ArdAuditLog rows).
ardTestRouter.get('/:atrId/:testId/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    await findTest(req.params.atrId as string, req.params.testId as string)
    const test = await ArdTestRequest.findByPk(req.params.testId as string, {
      include: TEST_CONTEXT_INCLUDE as any,
    })
    if (!test) throw new NotFoundError('Test request not found')
    if (!(await canViewTest(user, test))) throw new ForbiddenError('Not permitted to view this test.')

    const logs = await ArdAuditLog.findAll({
      where: { entityType: 'ATR_TEST', entityId: req.params.testId as string },
      order: [['createdAt', 'DESC']],
    })
    const userIds = Array.from(new Set(logs.map((l: any) => l.userId).filter(Boolean)))
    const users = userIds.length ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = new Map(users.map((u: any) => [u.id, u.username]))

    const items = logs.map((l: any) => ({
      id: l.id,
      action: l.action,
      detail: l.detail,
      by: userMap.get(l.userId) || null,
      at: l.createdAt,
    }))
    return res.json(successResponse('Test events retrieved', items))
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
      const user = (req as any).user
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const techniqueKey = await resolveTestTechniqueKey(test as any)
      const hasRecords = techniqueKey ? await techniqueHasQualificationRecords(techniqueKey) : false

      // A TL only assigns within their own team(s) — HOD/QA/Admin (who already
      // read everything, canReadAllTests) keep the full pool for cross-team
      // reassignment. Without this, a TL saw every ANALYST/CHEM in the system,
      // including other departments' (ADC, CGT, QC) staff who aren't on their team.
      const teamMemberIds = canReadAllTests(user) ? null : await ledTeamMemberIds(user)
      if (teamMemberIds !== null && teamMemberIds.length === 0) {
        return res.json(successResponse('Qualified analysts retrieved', { techniqueKey, items: [], isRestricted: !!hasRecords }))
      }

      if (!hasRecords) {
        const users = await User.findAll({
          where: teamMemberIds ? { id: { [Op.in]: teamMemberIds } } : undefined,
          include: [{ model: Role, as: 'role', attributes: ['code'], where: { code: { [Op.in]: ['ANALYST', 'CHEM', 'CHEMIST'] } }, required: true }],
          attributes: ['id', 'username'],
        })
        const items = users.map((u: any) => ({
          userId: u.id, userName: u.username, roleCode: (u.role as any)?.code ?? null,
        }))
        return res.json(successResponse('Qualified analysts retrieved', { techniqueKey, items, isRestricted: false }))
      }

      let ids = [...await listQualifiedAnalystIds(techniqueKey!)]
      if (teamMemberIds) ids = ids.filter((id) => teamMemberIds.includes(id))
      const users = ids.length
        ? await User.findAll({ where: { id: { [Op.in]: ids } }, include: [{ model: Role, as: 'role', attributes: ['code'] }], attributes: ['id', 'username'] })
        : []
      const items = users.map((u: any) => ({
        userId: u.id, userName: u.username, roleCode: (u.role as any)?.code ?? null,
      }))
      return res.json(successResponse('Qualified analysts retrieved', { techniqueKey, items, isRestricted: true }))
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

      // Accept every alias the frontend actually sends — ArdTestExecutePage
      // posts analystId/analystName (the ARD module's camelCase contract);
      // this schema previously only accepted the legacy analyst_id/analyst_name
      // snake_case names, so every assignment from the UI 400'd.
      const bodySchema = z.object({
        analyst_id: z.string().optional(),
        analystId: z.string().optional(),
        analyst_name: z.string().optional(),
        analystName: z.string().optional(),
      }).transform((v) => ({
        analystId: v.analystId ?? v.analyst_id,
        analystName: v.analystName ?? v.analyst_name,
      })).refine((v) => !!v.analystId, { message: 'analystId is required' })
      const body = bodySchema.parse(req.body)

      await assertAnalystQualifiedForTest(body.analystId as string, test as any)

      const user = req.user as any
      await recordTestHistory((test as any).id, 'ASSIGNED', user.id, user.username)

      // AR number is generated only when the analyst actually starts the
      // test (see POST /:atrId/:testId/start) — not at assignment.
      await test.update({
        assignedToId: body.analystId,
        assignedToName: body.analystName ?? null,
        assignedAt: new Date(),
        status: 'ASSIGNED',
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
      // A newly-created test starts UNASSIGNED, but once its ATR is
      // submitted, the ATR /transition handler moves any still-UNASSIGNED
      // test to PENDING (Extra/atrs.routes.ts's "open UNASSIGNED tests" step)
      // — this only ever accepted the pre-submission status, so claiming any
      // test that had actually gone through a real ATR submission 400'd.
      assertStatus(test, ['UNASSIGNED', 'PENDING'], 'claim')

      const user = req.user as any

      await recordTestHistory((test as any).id, 'CLAIMED', user.id, user.username, req.body?.remarks as string | undefined)

      // AR number is generated only when the analyst actually starts the
      // test (see POST /:atrId/:testId/start) — not at claim time.
      await test.update({
        assignedToId: user.id,
        assignedToName: user.username,
        assignedAt: new Date(),
        status: 'ASSIGNED',
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

      // Accept every alias the frontend actually sends — different ARD test
      // pages independently grew their own name for "who this is delegated
      // to" (tlId/tlName, targetUserId/targetUserName) and "remarks"
      // (actionRemarks/remarks), and none of them matched this schema's
      // original analyst_id/analyst_name, so every delegate action 400'd.
      const bodySchema = z.object({
        analyst_id: z.string().optional(),
        analystId: z.string().optional(),
        tlId: z.string().optional(),
        targetUserId: z.string().optional(),
        analyst_name: z.string().optional(),
        analystName: z.string().optional(),
        tlName: z.string().optional(),
        targetUserName: z.string().optional(),
        remarks: z.string().optional(),
        actionRemarks: z.string().optional(),
      }).transform((v) => ({
        analystId: v.analystId ?? v.analyst_id ?? v.tlId ?? v.targetUserId,
        analystName: v.analystName ?? v.analyst_name ?? v.tlName ?? v.targetUserName,
        remarks: v.remarks ?? v.actionRemarks,
      })).refine((v) => !!v.analystId, { message: 'A target user id is required' })
      const body = bodySchema.parse(req.body)

      await assertAnalystQualifiedForTest(body.analystId as string, test as any)

      const user = req.user as any
      await recordTestHistory(
        (test as any).id,
        'DELEGATED',
        user.id,
        user.username,
        `To: ${body.analystName ?? body.analystId}${body.remarks ? ` — ${body.remarks}` : ''}`,
      )

      await test.update({
        assignedToId: body.analystId,
        assignedToName: body.analystName ?? null,
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

      // AR number is deliberately generated here, not at assign/claim time —
      // it should only exist once the analyst actually starts the test.
      let arNumber = (test as any).arNumber
      if (!arNumber) {
        arNumber = await generateArTestNumber((test as any).techniqueCode || 'GEN')
      }

      await test.update({ status: 'IN_PROGRESS', startedAt: new Date(), arNumber })
      const atr = await ArdAtrForm.findByPk(req.params.atrId as string)
      if (atr && shouldMoveAtrToPartialOnTestStart((atr as any).status)) {
        await (atr as any).update({ status: 'PARTIAL', updatedAt: new Date() })
      }
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

      // The frontend already sends the current results/remarks alongside the
      // submit action (so the analyst doesn't have to click "Save Results"
      // separately first) — this previously ignored all of it and only
      // flipped status/submittedAt, silently dropping whatever the analyst
      // had just entered.
      const body = req.body as Record<string, unknown>
      const resultFields: Record<string, unknown> = {}
      if (body.results !== undefined) resultFields.results = body.results
      if (body.resultRemarks !== undefined) resultFields.resultRemarks = body.resultRemarks
      if (body.adRemarks !== undefined) resultFields.adRemarks = body.adRemarks
      if (body.submitRemarks !== undefined) resultFields.submitRemarks = body.submitRemarks
      if (body.referenceStandards !== undefined) resultFields.referenceStandards = body.referenceStandards
      if (body.analyzedBy !== undefined) resultFields.analyzedBy = body.analyzedBy
      if (body.certifiedBy !== undefined) resultFields.certifiedBy = body.certifiedBy

      await test.update({ ...resultFields, status: 'VERIFICATION_REQUESTED', submittedAt: new Date() })
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
      // Withdrawing a test is the requester's call, not the analyst executing
      // it — an analyst pulling their own assignment mid-test would silently
      // drop work with no oversight. Only whoever raised the parent ATR (or a
      // supervisory role) may withdraw it.
      const atr = await ArdAtrForm.findByPk(req.params.atrId as string)
      const isCreator = atr && (atr as any).createdById === user.id
      const allowed = isCreator || TL_ROLES.includes(roleCode(req)) || (user.department as any)?.code === 'QA'
      if (!allowed) throw new ForbiddenError('Insufficient privileges for this action')

      await recordTestHistory((test as any).id, 'WITHDRAWN', user.id, user.username)

      await test.update({ status: 'WITHDRAWN' })
      return res.json(successResponse('Test withdrawn', test))
    } catch (err) {
      next(err)
    }
  },
)

// Mirrors ExperimentSectionRenderer.tsx's handleAddAtr() row-building — the
// manual "Add ATR Test" flow already turns an ATR's samples/tests into
// Sample Details rows; this ports the same shape so a test that links itself
// to an experiment (rather than being added there by hand) still shows up.
async function buildSampleRowsFromAtr(atrId: string): Promise<any[]> {
  const atr = await ArdAtrForm.findByPk(atrId, {
    include: [{ model: ArdAtrSample, as: 'samples', include: [{ model: ArdTestRequest, as: 'tests' }] }],
  })
  if (!atr) return []
  const atrPlain = atr.toJSON() as any
  return (atrPlain.samples ?? []).map((s: any) => {
    const tests = (s.tests ?? []).map((t: any) => {
      const firstResult = (t.results ?? [])[0] ?? {}
      return {
        id: String(t.id ?? uuidv4()),
        atrId: String(atrPlain.id ?? ''),
        testType: t.testType || '',
        testSubtype: t.testSubtype || '',
        arNumber: t.arNumber || '',
        status: t.status || 'UNASSIGNED',
        techniqueName: t.techniqueName || '',
        techniqueCode: t.techniqueCode || '',
        instrumentCode: t.instrumentCode || '',
        assignedToName: t.assignedToName || '',
        lowerLimit: t.lowerLimit || firstResult.lower_limit || '',
        upperLimit: t.upperLimit || firstResult.upper_limit || '',
        limitsUom: t.limitsUom || firstResult.uom || '',
        resultValue: t.resultValue || '',
        resultUom: t.resultUom || '',
        resultStatus: t.resultStatus || '',
      }
    })
    const qty = [s.quantity, s.uom].filter(Boolean).join(' ')
    return {
      id: uuidv4(),
      atrId: String(atrPlain.id ?? ''),
      atrFormNo: atrPlain.formNo || '',
      projectCode: atrPlain.projectCode || '',
      sampleCode: s.sampleCode || s.internalSampleNo || '',
      sampleType: s.sampleType || '',
      testSubtype: atrPlain.formTypeName || '',
      batchNo: s.batchNo || '',
      sampleCondition: s.storageCondition || s.sampleIntegrity || '',
      qty,
      status: s.status || 'UNASSIGNED',
      remarks: s.additionalRemarks || '',
      tests,
    }
  })
}

// Appends this ATR's Sample Details row(s) into the experiment's first
// sample_details-type section, unless that ATR is already represented there
// (re-linking/re-saving shouldn't duplicate rows). Best-effort: an
// experiment with no sample_details section, or any failure building the
// rows, must never block the link itself — this is a convenience side
// effect, not the source of truth (the test's own experimentId is).
async function attachAtrToExperimentSampleDetails(experiment: InstanceType<typeof ArdExperiment>, atrId: string): Promise<void> {
  try {
    const sectionDefs = Array.isArray((experiment as any).sectionDefs) ? (experiment as any).sectionDefs as any[] : []
    const sampleSection = sectionDefs.find((s) => (s?.type || '').toLowerCase().replace(/-/g, '_') === 'sample_details')
    if (!sampleSection?.id) return

    const sections = { ...((experiment as any).sections as Record<string, any> ?? {}) }
    const existingRows: any[] = Array.isArray(sections[sampleSection.id]) ? sections[sampleSection.id] : []
    if (existingRows.some((r) => r?.atrId === atrId)) return

    const newRows = await buildSampleRowsFromAtr(atrId)
    if (newRows.length === 0) return

    sections[sampleSection.id] = [...existingRows, ...newRows]
    await experiment.update({ sections })
  } catch {
    // best-effort — the notebook link itself already succeeded
  }
}

// POST /:atrId/:testId/link-notebook
// Sets how this test's "Notebook Reference" is recorded — either a free-text
// manual note, or a structured link to a real ArdExperiment (existing or
// freshly created by the caller via POST /api/ard/experiments, whose id is
// passed in here as experimentId). Structured links denormalize the
// experiment's code into notebookReference so list/detail views don't need
// an extra join just to show it.
const linkNotebookSchema = z.object({
  experimentId: z.string().uuid().nullable().optional(),
  notebookReference: z.string().nullable().optional(),
})
ardTestRouter.post(
  '/:atrId/:testId/link-notebook',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      const body = linkNotebookSchema.parse(req.body)
      const user = req.user as any

      if (body.experimentId) {
        const experiment = await ArdExperiment.findByPk(body.experimentId)
        if (!experiment) throw new NotFoundError('Experiment not found')
        await test.update({
          experimentId: experiment.id,
          notebookRefLink: true,
          notebookReference: (experiment as any).code,
        })
        await attachAtrToExperimentSampleDetails(experiment, req.params.atrId as string)
      } else {
        await test.update({
          experimentId: null,
          notebookRefLink: false,
          notebookReference: body.notebookReference ?? null,
        })
      }

      await recordTestHistory((test as any).id, 'NOTEBOOK_LINKED', user.id, user.username, (test as any).notebookReference ?? undefined)
      return res.json(successResponse('Notebook reference updated', test))
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

      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : null
      await recordTestHistory((test as any).id, 'UNSATISFACTORY', user.id, user.username, remarks ?? undefined)
      await test.update({ status: 'UNSATISFACTORY', unsatisfactoryRemarks: remarks })
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
  '/:atrId/:testId/enhancement-requests',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any
      // Two different pages independently grew their own field names for
      // this same action — ArdTestExecutePage sends reason/additionalTestType,
      // ArdTestsPage sends description/remarks — and neither matched this
      // handler's original message/enhancementType, so every enhancement
      // request 400'd (once the route path itself was fixed to match what
      // both pages actually call: enhancement-requests, not enhancement).
      const body = req.body as Record<string, unknown>
      const reason = (body.message ?? body.reason ?? body.description) as string | undefined
      const additionalTestType = (body.enhancementType ?? body.additionalTestType ?? body.remarks) as string | undefined
      if (!reason) throw new BadRequestError('reason is required', 'MISSING_PARAM')
      const test = await findTest(req.params.atrId as string, req.params.testId as string)
      if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes((test as any).status)) {
        throw new BadRequestError(`Cannot add enhancement to a test with status ${(test as any).status}`, 'INVALID_STATUS')
      }
      // Store into the dedicated enhancementRequests column the frontend
      // actually reads (EnhancementRequest[]) — the previous version wrote an
      // unrelated shape into `clarifications`, so raised requests never
      // showed up in the Enhancements tab at all.
      const existing: any[] = (test as any).enhancementRequests ?? []
      const entry = {
        id: uuidv4(),
        requestedBy: user.username ?? user.email ?? user.id,
        reason,
        additionalTestType: additionalTestType || undefined,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      }
      // Not transitioning test.status to ENHANCEMENT_REQUESTED here — nothing
      // in the codebase (frontend or backend) ever moves a test back out of
      // that status, so doing so would strand it. The Enhancements tab
      // already becomes visible once enhancementRequests is non-empty.
      await (test as any).update({
        enhancementRequests: [...existing, entry],
      })
      await writeAuditLog(req.params.testId as string, 'ENHANCEMENT_REQUESTED', user.id, reason)
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

export default ardTestRouter

