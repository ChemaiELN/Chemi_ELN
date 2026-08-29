import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePrivilege, userHasPrivilege, CREATOR_ROLES } from '../../shared/privileges';
import { settingEnabled, enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError, AppError } from '../../utils/errors';
import { verifyPassword } from '../../utils/auth.utils';
import { sequelize } from '../../database/connection';
import {
  ArdAtrForm,
  ArdAtrSample,
  ArdTestRequest,
  ArdFormType,
  ArdTestConfiguration,
  ArdTestGroup,
  ArdTestGroupMember,
  User,
  Role,
  Department,
  ArdTeam,
  ArdExperiment,
} from '../../models/index';
import { generateAtrNumber, generateAtrSampleCode } from '../../utils/idSequence';
import { deductQty } from '../../utils/qtyLedger';
import {
  ATR_TAB_STATUSES,
  ATR_TRANSITIONS,
  canReadAllAtrs,
  defaultAtrScope,
  isAdmin,
  isExternalRequester,
  isHod,
  isQa,
  roleCode,
  teammateTlIds,
} from '../../shared/ardRbac';
import {
  CERTIFICATION_INCOMPLETE_TEST_STATUSES,
  ATR_CERT_COMPLETED_TEST_STATUSES,
  ATR_VERIFIED_COMPLETED_TEST_STATUSES,
  normalizeAtrTransitionAction,
} from '../../shared/ardWorkflowGuards';

const atrRouter = Router();

const EDITABLE_STATUSES = ['DRAFT', 'SAVED'];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

// ARD routes speak camelCase throughout (see caseNormalize.middleware.ts) — these
// keys must match the AtrForm contract the frontend actually sends
// (frontend/src/api/ard.ts), not the legacy snake_case FastAPI shape. Using
// snake_case keys here silently dropped every one of these fields on create/save,
// since normalizeRequestCase only adds camelCase aliases for snake_case input,
// never the reverse.
const createAtrSchema = z.object({
  formTypeId: z.string().optional(),
  formTypeName: z.string().optional(),
  productName: z.string().optional(),
  projectCode: z.string().optional(),
  projectId: z.string().optional(),
  qcRef: z.string().nullable().optional(),
  mandateCertification: z.boolean().optional(),
  formCategory: z.string().nullable().optional(),
  reportType: z.string().nullable().optional(),
  objectives: z.string().nullable().optional(),
  requestRemarks: z.string().nullable().optional(),
  associatedExpCodes: z.string().nullable().optional(),
  attributeValues: z.record(z.any()).optional(),
  assignedTl: z.string().optional(),
  assignedTlId: z.string().nullable().optional(),
  qaReviewerId: z.string().nullable().optional(),
  batchNo: z.string().optional(),
  priority: z.string().optional(),
  remarks: z.string().optional(),
  chemicals: z.any().optional(),
  targetCompletionDate: z.string().optional(),
  samples: z.array(z.record(z.any())).optional(),
});

const updateAtrSchema = createAtrSchema.partial();

const transitionSchema = z.object({
  action: z.string().optional(),
  to: z.string().optional(),
  password: z.string().optional(),
  teamId: z.string().uuid().optional(),
});

const clarificationSchema = z.object({
  message: z.string().min(1),
});

// camelCase to match the ARD frontend contract (see the note on createAtrSchema
// above) — these were all snake_case and silently rejected/ignored every
// field the frontend actually sends.
const changeOwnerSchema = z.object({
  newOwnerId: z.string(),
  remarks: z.string().optional(),
});

const assignTlSchema = z.object({
  tlId: z.string(),
  tlName: z.string().optional(),
  remarks: z.string().optional(),
});

const reassignQaSchema = z.object({
  qaUserId: z.string().nullable().optional(),
  qaName: z.string().optional(),
});

const linkExperimentSchema = z.object({
  experiment_id: z.string(),
});

// camelCase to match the ARD frontend contract (see the note on createAtrSchema
// above) — the frontend sends testConfigIds/testGroupIds/testGroupId, priority,
// remarks and quantity, none of which existed under the old snake_case names.
const addTestsSchema = z.object({
  testConfigIds: z.array(z.string()).optional(),
  testGroupId: z.string().optional(),
  testGroupIds: z.array(z.string()).optional(),
  priority: z.string().optional(),
  remarks: z.string().optional(),
  quantity: z.string().optional(),
});

const updateSampleSchema = z.object({
  sample_code: z.string().optional(),
  sample_name: z.string().optional(),
  batch_no: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  total_containers: z.number().optional(),
  sampled_containers: z.number().optional(),
  expiry_date: z.string().optional(),
  source_batch_id: z.string().optional(),
  additional_info: z.any().optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function findAtr(atrId: string): Promise<InstanceType<typeof ArdAtrForm>> {
  const atr = await (ArdAtrForm as any).findByPk(atrId);
  if (!atr) throw new NotFoundError('ATR form not found');
  return atr;
}

// A raised ATR belongs to the TL's whole team, not just that one TL — so
// anyone on that team (its HOD, any of its TLs, or its analysts) can see it
// once it's assigned, matching who can already act on it via team pages.
// Someone who isn't on the team gets nothing beyond what they personally
// raised.
//
// Exception: while the ATR is mid QA-pre-approval cycle (QA_PRE_APPROVAL, or
// sent back to the requester as PRE_APPROVAL_REWORK), it hasn't been cleared
// for the team yet — only QA (who already reads everything via
// canReadAllAtrs) and the requester who raised it should see it. It only
// becomes visible to the team once QA approves it through to NEW.
const QA_CYCLE_STATUSES = ['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK'];
async function teamScopedAtrWhere(user: any): Promise<Record<string, any>> {
  const tlIds = await teammateTlIds(user);
  if (tlIds.length === 0) {
    return { createdById: user.id };
  }
  return {
    [Op.or]: [
      { assignedTlId: { [Op.in]: tlIds }, status: { [Op.notIn]: QA_CYCLE_STATUSES } },
      { createdById: user.id },
    ],
  };
}

async function atrVisibilityWhere(user: any, scope?: string): Promise<Record<string, any> | null> {
  let canReadAll = canReadAllAtrs(user);
  let effective = scope || defaultAtrScope(user);
  const external = isExternalRequester(user);
  if (external) {
    canReadAll = false;
    // Every external (ADC/CGT) role gets department-wide visibility, not
    // just TLs — an ATR raised from a shared experiment is worked on by the
    // whole team (chem enters materials, TL reviews, HOD approves, all on
    // the same experiment), so scoping a non-TL role down to "only what I
    // personally created" locked colleagues out of their own experiment's
    // ATR panel — it showed an endless "Loading ATR form..." spinner instead
    // of the actual 403, since the frontend treats no data as loading.
    effective = 'dept';
  }
  // 'self' is a deliberate narrowing (the "My Raised ATRs" tab), so it's
  // honored even for roles that can otherwise read everything (HOD/QA/Admin)
  // — 'mine' doesn't work for this because it still folds in the rest of the
  // team for internal users (see teamScopedAtrWhere) below.
  if (effective === 'self') {
    return { createdById: user.id };
  }
  if (canReadAll) return null;
  if (effective === 'all') {
    throw new ForbiddenError('Not permitted to view all ATRs.');
  }
  if (effective === 'dept') {
    const peers = await User.findAll({
      where: { departmentId: user.departmentId },
      attributes: ['id'],
    });
    return { createdById: { [Op.in]: peers.map((u: any) => u.id) } };
  }
  if (!external && (effective === 'team' || effective === 'mine')) {
    return teamScopedAtrWhere(user);
  }
  return { createdById: user.id };
}

function atrTabWhere(tab?: string, status?: string, statuses?: string): Record<string, any> | null {
  if (status) return { status };
  if (tab && tab in ATR_TAB_STATUSES) {
    if (tab === 'method_dev') return { formCategory: 'METHOD_DEV' };
    if (tab === 'unassigned' || tab === 'queued') {
      return { status: 'NEW', assignedTlId: { [Op.is]: null } };
    }
    const mapped = ATR_TAB_STATUSES[tab];
    if (mapped.length) return { status: { [Op.in]: mapped } };
    return null;
  }
  if (statuses) {
    const list = statuses.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) return { status: { [Op.in]: list } };
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /counts
atrRouter.get('/counts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { scope, q } = req.query as Record<string, string>;
    const and: any[] = [];
    const vis = await atrVisibilityWhere(user, scope);
    if (vis) and.push(vis);
    if (q) {
      and.push({
        [Op.or]: [
          { formNo: { [Op.iLike]: `%${q}%` } },
          { productName: { [Op.iLike]: `%${q}%` } },
          { projectCode: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }
    const where = and.length ? { [Op.and]: and } : {};
    const rows = await (ArdAtrForm as any).findAll({
      where,
      attributes: ['status', 'assignedTlId', 'formCategory'],
      raw: true,
    });
    const counts: Record<string, number> = {};
    let unassigned = 0;
    let methodDev = 0;
    for (const row of rows as any[]) {
      counts[row.status] = (counts[row.status] || 0) + 1;
      if (row.status === 'NEW' && !row.assignedTlId) unassigned += 1;
      if (row.formCategory === 'METHOD_DEV') methodDev += 1;
    }
    res.json(successResponse('ATR counts', { counts, unassigned, methodDev }));
  } catch (err) {
    next(err);
  }
});

// GET /
atrRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { status, statuses, tab, q, scope } = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(req.query);
    const and: any[] = [];
    const vis = await atrVisibilityWhere(user, scope);
    if (vis) and.push(vis);
    const tabWhere = atrTabWhere(tab, status, statuses);
    if (tabWhere) and.push(tabWhere);
    if (q) {
      and.push({
        [Op.or]: [
          { formNo: { [Op.iLike]: `%${q}%` } },
          { productName: { [Op.iLike]: `%${q}%` } },
          { projectCode: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }
    // Team filter for the HOD's "Re-assign Forms" tool — an ATR's team is
    // whichever team's TL it's assigned to; assignedTeamId is also matched
    // since some forms get it set directly (the "Select ARD Team" workflow
    // step), but assignedTlId is the more reliably-populated field.
    if (req.query.teamId) {
      const team = await (ArdTeam as any).findByPk(req.query.teamId as string);
      const tlIds = team ? (team.tlIds || []) : [];
      and.push({
        [Op.or]: [
          { assignedTeamId: req.query.teamId },
          { assignedTlId: { [Op.in]: tlIds } },
        ],
      });
      // Reassigning a form that's already finished (or dead) doesn't make sense.
      and.push({ status: { [Op.notIn]: ['CERTIFIED', 'REJECTED', 'WITHDRAWN'] } });
    }
    const where = and.length ? { [Op.and]: and } : {};

    const { count, rows } = await (ArdAtrForm as any).findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      // distinct: true — without it, an ATR with multiple samples (each with
      // multiple tests) gets counted once per joined sample/test row, so the
      // reported total (and page count) balloons past the number of ATRs
      // findAndCountAll actually returns.
      distinct: true,
      include: [
        // batchNo/storageCondition added for the analyst "Clarification
        // Requests" tab's Batch Number / Storage Condition & Period columns
        // — everything else here already only ever used sampleCode/sampleType.
        { model: ArdAtrSample, as: 'samples', attributes: ['id', 'sampleCode', 'sampleType', 'batchNo', 'storageCondition'], include: [{ model: ArdTestRequest, as: 'tests', attributes: ['id'] }] },
      ],
    });

    const pagination = buildPagination(page, limit, count);
    res.json(listResponse('ATR forms', rows, pagination));
  } catch (err) {
    next(err);
  }
});

// POST /bulk-reassign — the HOD's "Re-assign Forms" tool. Moves whole ATR
// forms (not individual tests — see /api/ard/tests/bulk-reassign-team for
// that) from one team to another: the form's assignedTlId/assignedTl/
// assignedTeamId all flip to the destination team in one shot, so every
// sibling test on the form moves with it. Always requires e-signature —
// this is a bulk, cross-team ownership change.
const bulkReassignAtrsSchema = z.object({
  atrIds: z.array(z.string()).min(1),
  tlId: z.string(),
  remarks: z.string().min(1),
  password: z.string().min(1),
});
atrRouter.post('/bulk-reassign', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const code = roleCode(user);
    if (!['HOD', 'SUPER_ADMIN'].includes(code)) {
      throw new ForbiddenError('Only HOD or Super Admin can bulk re-assign ATR forms');
    }

    const body = bulkReassignAtrsSchema.parse(req.body);

    const passwordValid = await verifyPassword(body.password, user.passwordHash);
    if (!passwordValid) {
      throw new BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED');
    }

    const targetTl = await (User as any).findByPk(body.tlId);
    if (!targetTl) throw new NotFoundError('Target Team Lead not found');
    const destinationTeam = await (ArdTeam as any).findOne({ where: { tlIds: { [Op.contains]: [body.tlId] } } });

    let updatedCount = 0;
    await sequelize.transaction(async (t) => {
      const forms = await (ArdAtrForm as any).findAll({ where: { id: { [Op.in]: body.atrIds } }, transaction: t });
      for (const form of forms) {
        const historyEntry = {
          action: 'BULK_REASSIGN',
          by: user.id,
          byName: user.username,
          at: new Date(),
          remarks: body.remarks,
          fromTl: (form as any).assignedTl,
          toTl: (targetTl as any).username,
        };
        await form.update({
          assignedTlId: body.tlId,
          assignedTl: (targetTl as any).username,
          assignedTeamId: destinationTeam ? (destinationTeam as any).id : (form as any).assignedTeamId,
          reassignRemarks: body.remarks,
          workflowHistory: [...(((form as any).workflowHistory as any[]) || []), historyEntry],
        }, { transaction: t });
        updatedCount++;
      }
    });

    return res.json(successResponse('ATR forms reassigned', { updatedCount }));
  } catch (err) {
    next(err);
  }
});

// GET /:atrId
atrRouter.get('/:atrId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const atr = await (ArdAtrForm as any).findByPk((req.params.atrId as string), {
      include: [
        { model: ArdAtrSample, as: 'samples', include: [{ model: ArdTestRequest, as: 'tests' }] },
      ],
    });
    if (!atr) throw new NotFoundError('ATR form not found');

    // The list endpoint (GET /) scopes what a TL/analyst can see via
    // atrVisibilityWhere, but this detail endpoint previously had no check at
    // all — anyone with the id (a link, a guessed URL) could open any ATR's
    // full sample/test detail regardless of status or assignment. That let a
    // TL view a test still sitting in QA_PRE_APPROVAL before QA had approved
    // it. Apply the same visibility rule here: creator always sees their own
    // request (including if QA rejects it), an assigned TL sees theirs once
    // assigned, and HOD/Admin/QA see everything.
    const vis = await atrVisibilityWhere(user, undefined);
    if (vis) {
      const allowed = await (ArdAtrForm as any).count({ where: { [Op.and]: [vis, { id: atr.id }] } });
      if (!allowed) throw new ForbiddenError('Not permitted to view this ATR.');
    }

    res.json(successResponse('ATR form', atr));
  } catch (err) {
    next(err);
  }
});

// GET /:atrId/audit-log
atrRouter.get('/:atrId/audit-log', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const atr = await findAtr((req.params.atrId as string));
    res.json(successResponse('ATR audit trail', (atr as any).workflowHistory || []));
  } catch (err) {
    next(err);
  }
});

// POST /
atrRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createAtrSchema.parse(req.body);
    const user = (req as any).user;
    const atrNo = await generateAtrNumber();

    // ard_atr_forms has no project_id / batch_no / priority / chemicals /
    // target_completion_date / requested_by* columns. batch_no and chemicals live on the
    // sample; the requester is created_by(_id); the rest have no counterpart, so the
    // free-text ones are folded into request_remarks rather than silently dropped.
    const extraNotes = [
      body.priority ? `Priority: ${body.priority}` : null,
      body.targetCompletionDate ? `Target completion: ${body.targetCompletionDate}` : null,
      body.batchNo ? `Batch no: ${body.batchNo}` : null,
    ].filter(Boolean).join(' | ');
    const requestRemarks = [body.requestRemarks || null, extraNotes || null].filter(Boolean).join(' | ') || null;

    const atr = await (ArdAtrForm as any).create({
      formNo: atrNo,
      status: 'DRAFT',
      formTypeId: body.formTypeId ?? null,
      formTypeName: body.formTypeName ?? '',
      productName: body.productName ?? '',
      projectCode: body.projectCode ?? '',
      originProjectId: body.projectId ?? null,
      qcRef: body.qcRef ?? null,
      mandateCertification: body.mandateCertification ?? false,
      formCategory: body.formCategory ?? null,
      reportType: body.reportType ?? null,
      objectives: body.objectives ?? null,
      associatedExpCodes: body.associatedExpCodes ?? null,
      requestRemarks,
      analysisRemarks: body.remarks ?? null,
      createdBy: user.username,
      createdById: user.id,
      assignedTl: body.assignedTl ?? '',
      assignedTlId: body.assignedTlId ?? null,
      workflowHistory: [],
      clarifications: [],
      attributeValues: body.attributeValues ?? {},
    });

    res.status(201).json(successResponse('ATR form created', atr));
  } catch (err) {
    next(err);
  }
});

// PUT /:atrId
atrRouter.put('/:atrId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const atr = await findAtr((req.params.atrId as string));
    if (!EDITABLE_STATUSES.includes((atr as any).status)) {
      throw new BadRequestError(`ATR cannot be edited in status: ${(atr as any).status}`);
    }
    const body = updateAtrSchema.parse(req.body);
    // Only assign columns that exist; see the note on the create handler for why
    // priority / target date / batch no are folded into request_remarks.
    const updates: Record<string, unknown> = {};
    if (body.formTypeId !== undefined) updates.formTypeId = body.formTypeId;
    if (body.formTypeName !== undefined) updates.formTypeName = body.formTypeName;
    if (body.productName !== undefined) updates.productName = body.productName;
    if (body.projectCode !== undefined) updates.projectCode = body.projectCode;
    if (body.projectId !== undefined) updates.originProjectId = body.projectId;
    if (body.qcRef !== undefined) updates.qcRef = body.qcRef;
    if (body.mandateCertification !== undefined) updates.mandateCertification = body.mandateCertification;
    if (body.formCategory !== undefined) updates.formCategory = body.formCategory;
    if (body.reportType !== undefined) updates.reportType = body.reportType;
    if (body.objectives !== undefined) updates.objectives = body.objectives;
    if (body.associatedExpCodes !== undefined) updates.associatedExpCodes = body.associatedExpCodes;
    if (body.attributeValues !== undefined) updates.attributeValues = body.attributeValues;
    if (body.assignedTl !== undefined) updates.assignedTl = body.assignedTl;
    if (body.assignedTlId !== undefined) updates.assignedTlId = body.assignedTlId;
    if (body.qaReviewerId !== undefined) updates.qaReviewerId = body.qaReviewerId;
    if (body.remarks !== undefined) updates.analysisRemarks = body.remarks;
    if (body.requestRemarks !== undefined) updates.requestRemarks = body.requestRemarks;
    const notes = [
      body.priority ? `Priority: ${body.priority}` : null,
      body.targetCompletionDate ? `Target completion: ${body.targetCompletionDate}` : null,
      body.batchNo ? `Batch no: ${body.batchNo}` : null,
    ].filter(Boolean).join(' | ');
    if (notes) {
      updates.requestRemarks = [updates.requestRemarks ?? (atr as any).requestRemarks ?? null, notes].filter(Boolean).join(' | ');
    }

    // Full upsert/delete cascade for the Samples & Test Results tab — the
    // frontend's "Save Samples & Tests" button sends the whole edited array.
    // Without this the PUT handler silently dropped `samples` entirely (it
    // wasn't in the schema at all), so any sample-level edits the user made
    // (new samples, batch no./qty/dates, description, storage, packing...)
    // were lost the moment the query refetched — the "data disappearing" bug.
    if (body.samples !== undefined) {
      await sequelize.transaction(async (t) => {
        const existing = await (ArdAtrSample as any).findAll({ where: { atrFormId: atr.id }, transaction: t });
        const existingById = new Map(existing.map((s: any) => [String(s.id), s]));
        const keptIds = new Set<string>();

        for (const s of body.samples!) {
          const sId = s.id ? String(s.id) : '';
          const sampleData = {
            sampleCode: s.sampleCode ?? '',
            sampleType: s.sampleType ?? null,
            quantity: s.quantity ?? null,
            uom: s.uom ?? null,
            packType: s.packType ?? null,
            storageCondition: s.storageCondition ?? null,
            batchNo: s.batchNo ?? null,
            sourceBatchId: s.sourceBatchId ?? null,
            mfgDate: s.mfgDate ?? null,
            expDate: s.expDate ?? null,
            sampleDescription: s.sampleDescription ?? null,
            chemicals: s.chemicals ?? [],
            manufacturedBy: s.manufacturedBy ?? null,
            receivedBy: s.receivedBy ?? null,
            preparedBy: s.preparedBy ?? null,
            sampledBy: s.sampledBy ?? null,
            receivedOn: s.receivedOn ?? null,
            preparedOn: s.preparedOn ?? null,
            sampledOn: s.sampledOn ?? null,
            totalContainers: s.totalContainers ?? null,
            sampledContainers: s.sampledContainers ?? null,
            sampleContent: s.sampleContent ?? null,
            sampleIntegrity: s.sampleIntegrity ?? null,
            additionalRemarks: s.additionalRemarks ?? null,
            ...(s.internalSampleNo ? { internalSampleNo: s.internalSampleNo } : {}),
            ...(s.productName ? { productName: s.productName } : {}),
          };

          if (sId && existingById.has(sId)) {
            await (existingById.get(sId) as any).update(sampleData, { transaction: t });
            keptIds.add(sId);
          } else {
            // A genuinely new sample — the client only sends an optimistic
            // local placeholder id ("new-<timestamp>"). Sample Code is a
            // manual-entry field in the UI (required, user-typed), so use
            // what they entered; only fall back to the server sequence if
            // they left it blank.
            const sampleCode = s.sampleCode?.trim() || await generateAtrSampleCode();
            await (ArdAtrSample as any).create({ atrFormId: atr.id, ...sampleData, sampleCode }, { transaction: t });
          }
        }

        for (const [sId, sObj] of existingById) {
          if (!keptIds.has(sId as string)) {
            await (sObj as any).destroy({ transaction: t });
          }
        }

        if ((atr as any).status === 'DRAFT') {
          updates.status = 'SAVED';
        }
        await (atr as any).update(updates, { transaction: t });
      });
    } else {
      await (atr as any).update(updates);
    }

    const fresh = await (ArdAtrForm as any).findByPk(atr.id, {
      include: [{ model: ArdAtrSample, as: 'samples', include: [{ model: ArdTestRequest, as: 'tests' }] }],
    });
    res.json(successResponse('ATR form updated', fresh));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/transition
atrRouter.post('/:atrId/transition', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, to, password, teamId } = transitionSchema.parse(req.body);
    const targetStatus = normalizeAtrTransitionAction({ action, to });
    if (!targetStatus) {
      throw new BadRequestError("Transition target is required as 'action' or 'to'");
    }
    const atr = await findAtr((req.params.atrId as string));
    const user = (req as any).user;
    const currentStatus = (atr as any).status;
    const allowed = ATR_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      throw new BadRequestError(`Transition '${targetStatus}' is not allowed from status '${currentStatus}'`);
    }

    if (targetStatus === 'QA_PRE_APPROVAL') {
      await enforceEsignature(user, ESIGN_FLAGS.ATR_QA_PRE_APPROVAL, password);
    }

    // Segregation of duties: approving/returning an ATR out of QA Pre-Approval
    // is QA's call, not the requester's/HOD's — this had no check at all, so
    // whoever raised the ATR (and routed it to QA in the first place) could
    // call this same endpoint to approve their own submission.
    if (currentStatus === 'QA_PRE_APPROVAL' && ['NEW', 'PRE_APPROVAL_REWORK'].includes(targetStatus)) {
      if (!isQa(user) && roleCode(user) !== 'SUPER_ADMIN') {
        throw new ForbiddenError('Only QA can approve or return this ATR from QA Pre-Approval.');
      }
    }

    // The Form Pending Approval step (PENDING_APPROVAL -> APPROVED) is the
    // HOD/TL's call, not anyone who happens to know the ATR id — previously
    // unenforced server-side (the frontend just hid the button for everyone
    // else, which isn't real authorization).
    if (currentStatus === 'PENDING_APPROVAL' && targetStatus === 'APPROVED') {
      const isAssignedTl = (atr as any).assignedTlId === user.id;
      if (!isHod(user) && !isAdmin(user) && !isAssignedTl) {
        throw new ForbiddenError('Only the HOD or the assigned Team Lead can approve this ATR.');
      }
    }

    // Python atr.py: on first submit, deduct sample/chemical qty and open UNASSIGNED tests.
    if (
      ['NEW', 'REQUESTED', 'QA_PRE_APPROVAL'].includes(targetStatus) &&
      ['DRAFT', 'SAVED'].includes(currentStatus)
    ) {
      const samples = await (ArdAtrSample as any).findAll({
        where: { atrFormId: (atr as any).id },
        include: [{ model: ArdTestRequest, as: 'tests' }],
      })
      const performedBy = user.username ?? String(user.id)
      for (const sample of samples) {
        for (const test of (sample.tests || [])) {
          if (test.status === 'UNASSIGNED') {
            await test.update({ status: 'PENDING' })
          }
        }
        for (const chem of (sample.chemicals || [])) {
          const batchId = chem.batchId ?? chem.batch_id
          const qtyRaw = chem.quantity
          if (!batchId || qtyRaw == null || qtyRaw === '') continue
          try {
            const qty = Number(qtyRaw)
            if (!(qty > 0)) continue
            await deductQty({
              batchId: Number(batchId),
              qty,
              eventType: 'ATR_ISSUED',
              performedBy,
              refNo: (atr as any).formNo,
              module: 'ARD',
              purpose: `ATR ${(atr as any).formNo} — ${sample.sampleCode || ''}`,
              projectCode: (atr as any).projectCode,
            })
          } catch {
            // Python skips invalid chemical lots silently.
          }
        }
        if (sample.sourceBatchId && sample.quantity) {
          try {
            const qty = Number(sample.quantity)
            if (qty > 0) {
              await deductQty({
                batchId: Number(sample.sourceBatchId),
                qty,
                eventType: 'ATR_ISSUED',
                performedBy,
                refNo: (atr as any).formNo,
                module: 'ARD',
                purpose: `ATR ${(atr as any).formNo} — ${sample.sampleCode || ''} (sample qty)`,
                projectCode: (atr as any).projectCode,
              })
            }
          } catch {
            // Python skips invalid sample qty silently.
          }
        }
      }
    }

    const historyEntry = {
      from: currentStatus,
      to: targetStatus,
      by: user.id,
      byName: user.username,
      at: new Date(),
    };

    // Submitting to a team (the "Select ARD Team" step) must record who it
    // went to, or nothing in the team-scoped visibility checks below ever
    // matches — assignedTlId (not just assignedTeamId) is what every RBAC
    // clause (ATR list, test list) actually filters on, so both get set from
    // the team's first TL. A raised ATR belongs to the whole team, so any of
    // its TLs works here — teammateTlIds() resolves visibility per-team, not
    // per-TL, so every member of this team gains access regardless of which
    // TL id ends up stored.
    const teamUpdates: Record<string, unknown> = {};
    if (teamId) {
      const team = await (ArdTeam as any).findByPk(teamId);
      if (!team) throw new BadRequestError('Selected team not found.');
      const primaryTlId = (team.tlIds || [])[0] ?? null;
      let primaryTlName: string | null = null;
      if (primaryTlId) {
        const tl = await (User as any).findByPk(primaryTlId);
        primaryTlName = tl?.username ?? null;
      }
      teamUpdates.assignedTeamId = team.id;
      teamUpdates.assignedTlId = primaryTlId;
      teamUpdates.assignedTl = primaryTlName ?? '';
    }

    await (atr as any).update({
      status: targetStatus,
      workflowHistory: [...((atr as any).workflowHistory || []), historyEntry],
      ...teamUpdates,
    });

    res.json(successResponse('ATR status updated', atr));
  } catch (err) {
    next(err);
  }
});

// DELETE /:atrId
atrRouter.delete('/:atrId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const atr = await findAtr((req.params.atrId as string));
    if (!EDITABLE_STATUSES.includes((atr as any).status)) {
      throw new BadRequestError(`ATR cannot be deleted in status: ${(atr as any).status}`);
    }
    await (atr as any).destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/change-owner
atrRouter.post('/:atrId/change-owner', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const roleCode = user.role?.code;
    if (!['HOD', 'SUPER_ADMIN'].includes(roleCode)) {
      throw new ForbiddenError('Only HOD or SUPER_ADMIN can change ATR owner');
    }
    const { newOwnerId, remarks } = changeOwnerSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    const newOwner = await (User as any).findByPk(newOwnerId);
    if (!newOwner) throw new NotFoundError('User not found');

    await (atr as any).update({
      currentOwnerId: newOwnerId,
      currentOwner: newOwner.username,
      ...(remarks !== undefined ? { reassignRemarks: remarks } : {}),
    });
    res.json(successResponse('ATR owner changed', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/mandate-certification
atrRouter.post('/:atrId/mandate-certification', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const roleCode = user.role?.code;
    const deptCode = user.department?.code;
    if (!['HOD', 'SUPER_ADMIN'].includes(roleCode) && deptCode !== 'QA') {
      throw new ForbiddenError('Only HOD, SUPER_ADMIN, or QA department can mandate certification');
    }
    const atr = await findAtr((req.params.atrId as string));
    const mandated = !(atr as any).mandateCertification;
    const auditEntry = {
      id: uuidv4(),
      action: mandated ? 'MANDATE_CERTIFICATION' : 'UNMANDATE_CERTIFICATION',
      by: user.id,
      byName: user.username,
      at: new Date(),
    };
    await (atr as any).update({
      mandateCertification: mandated,
      workflowHistory: [...((atr as any).workflowHistory || []), auditEntry],
    });
    res.json(successResponse(`Certification mandate ${mandated ? 'set' : 'removed'}`, atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/assign-tl
atrRouter.post('/:atrId/assign-tl', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const atr = await findAtr((req.params.atrId as string));
    // HOD/Super Admin can reassign anything; otherwise only the TL currently
    // holding this ATR can hand it off to someone else (matches who the
    // frontend shows the "Reassign Team Lead" button to).
    const isPrivileged = ['HOD', 'SUPER_ADMIN'].includes(user.role?.code);
    const isCurrentTl = (atr as any).assignedTlId === user.id;
    if (!isPrivileged && !isCurrentTl) {
      throw new ForbiddenError('Only HOD, Super Admin, or the currently assigned Team Lead can reassign.');
    }
    const { tlId, tlName, remarks } = assignTlSchema.parse(req.body);
    let resolvedTlName = tlName;
    if (!resolvedTlName) {
      const tl = await (User as any).findByPk(tlId);
      resolvedTlName = tl?.username;
    }
    await (atr as any).update({
      assignedTlId: tlId,
      assignedTl: resolvedTlName ?? '',
      ...(remarks !== undefined ? { reassignRemarks: remarks } : {}),
    });
    res.json(successResponse('TL assigned', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/reassign-qa
atrRouter.post('/:atrId/reassign-qa', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const roleCode = user.role?.code;
    if (!['HOD', 'SUPER_ADMIN'].includes(roleCode)) {
      throw new ForbiddenError('Only HOD or SUPER_ADMIN can reassign QA');
    }
    const { qaUserId, qaName } = reassignQaSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    let resolvedQaName = qaName;
    if (!resolvedQaName && qaUserId) {
      const qa = await (User as any).findByPk(qaUserId);
      resolvedQaName = qa?.username;
    }
    await (atr as any).update({ qaReviewerId: qaUserId ?? null });
    res.json(successResponse('QA reassigned', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/clarifications
atrRouter.post('/:atrId/clarifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = clarificationSchema.parse(req.body);
    const user = (req as any).user;
    const atr = await findAtr((req.params.atrId as string));
    // Field names must match the ClarificationMessage contract the frontend
    // actually renders (ArdAtrWorkspacePage.tsx's Clarifications tab reads
    // .authorName/.authorRole/.createdAt) — this previously wrote
    // by/byName/at instead, so every clarification message ever posted here
    // rendered with a blank author name, role and date.
    const entry = {
      id: uuidv4(),
      message,
      authorName: user.username,
      authorRole: (user.role as any)?.code ?? null,
      createdAt: new Date(),
    };
    await (atr as any).update({
      clarifications: [...((atr as any).clarifications || []), entry],
    });
    res.status(201).json(successResponse('Clarification added', entry));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/request-certification
atrRouter.post('/:atrId/request-certification', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.department?.code !== 'QA') {
      throw new ForbiddenError('Only QA department can request certification');
    }
    const atr = await findAtr((req.params.atrId as string));
    // Tests are reachable only via their sample (no atr_form_id on ard_test_requests).
    const atrSampleRows = await (ArdAtrSample as any).findAll({
      where: { atrFormId: (req.params.atrId as string) },
      attributes: ['id'],
    });
    const atrSampleIds = atrSampleRows.map((r: any) => r.id);
    const incomplete = atrSampleIds.length === 0 ? 0 : await (ArdTestRequest as any).count({
      where: {
        sampleId: { [Op.in]: atrSampleIds },
        status: { [Op.in]: CERTIFICATION_INCOMPLETE_TEST_STATUSES },
      },
    });
    if (incomplete > 0) {
      throw new BadRequestError(`${incomplete} test request(s) are not yet complete`);
    }
    await (atr as any).update({ status: 'CERTIFICATION_REQUESTED' });
    res.json(successResponse('Certification requested', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/certify
// Mirrors legacy's approveCertificationAction / FETCHATRRESULTIDSFORCERTIFY
// (or …FORVERIFIED) guard: before letting QA certify, every active test
// under this ATR form must have reached a terminal status — which terminal
// set applies is picked by the CertificationAfterApproval setting. A linked
// AD Experiment currently reopened (UNLOCK_REQUESTED/UNLOCKED) is called out
// with its own message rather than the generic "not yet complete" one,
// since that's specifically recoverable by re-running the experiment's own
// approval cycle (S5->S14->S16) rather than by finishing lab work.
atrRouter.post('/:atrId/certify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const atr = await findAtr((req.params.atrId as string));

    const atrSampleRows = await (ArdAtrSample as any).findAll({
      where: { atrFormId: (req.params.atrId as string) },
      attributes: ['id'],
    });
    const atrSampleIds = atrSampleRows.map((r: any) => r.id);
    const activeTests = atrSampleIds.length === 0 ? [] : await (ArdTestRequest as any).findAll({
      where: { sampleId: { [Op.in]: atrSampleIds } },
      attributes: ['id', 'status', 'experimentId'],
    });

    const certificationAfterApproval = await settingEnabled('CertificationAfterApproval');
    const terminalStatuses: readonly string[] = certificationAfterApproval
      ? ATR_CERT_COMPLETED_TEST_STATUSES
      : ATR_VERIFIED_COMPLETED_TEST_STATUSES;
    const nonTerminal = activeTests.filter((t: any) => !terminalStatuses.includes(t.status));

    if (nonTerminal.length > 0) {
      const experimentIds = Array.from(new Set(nonTerminal.map((t: any) => t.experimentId).filter(Boolean)));
      const reopenedExperiments = experimentIds.length ? await (ArdExperiment as any).findAll({
        where: { id: { [Op.in]: experimentIds }, status: { [Op.in]: ['UNLOCK_REQUESTED', 'UNLOCKED'] } },
        attributes: ['id'],
      }) : [];

      if (reopenedExperiments.length > 0) {
        throw new BadRequestError(
          'Linked Experiment has been unlocked, Can not Certify the ATR Form!!.',
          'LINKED_EXPERIMENT_UNLOCKED',
        );
      }
      throw new BadRequestError(
        `${nonTerminal.length} linked test result(s) have not reached a terminal status yet`,
        'CERTIFICATION_NOT_TERMINAL',
      );
    }

    await enforceEsignature(user, ESIGN_FLAGS.QA_CERTIFY_AUTH, req.body.password);
    await (atr as any).update({
      certifiedAt: new Date(),
      certifiedBy: user.username,
      status: 'CERTIFIED',
    });
    res.json(successResponse('ATR certified', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/certification-rework
atrRouter.post('/:atrId/certification-rework', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.department?.code !== 'QA') {
      throw new ForbiddenError('Only QA department can request certification rework');
    }
    const atr = await findAtr((req.params.atrId as string));
    await (atr as any).update({ status: 'CERTIFICATION_REWORK' });
    res.json(successResponse('Certification rework requested', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/link-experiment
atrRouter.post('/:atrId/link-experiment', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { experiment_id } = linkExperimentSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    await (atr as any).update({
      originExperimentId: experiment_id,
      originModule: 'ADC',
    });
    res.json(successResponse('Experiment linked', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/samples/:sampleId/tests
atrRouter.post('/:atrId/samples/:sampleId/tests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = addTestsSchema.parse(req.body);
    const testConfigIds = body.testConfigIds ?? [];
    const testGroupIds = [...(body.testGroupIds ?? []), ...(body.testGroupId ? [body.testGroupId] : [])];
    const atrId = req.params.atrId as string;
    const sampleId = (req.params.sampleId as string) as string;

    const atr = await findAtr(atrId);
    const sample = await (ArdAtrSample as any).findByPk(sampleId);
    if (!sample) throw new NotFoundError('Sample not found');

    let configIds: string[] = [...testConfigIds];

    if (testGroupIds.length) {
      const members = await (ArdTestGroupMember as any).findAll({
        where: { testGroupId: { [Op.in]: testGroupIds } },
      });
      const groupConfigIds = members.map((m: any) => m.testConfigId);
      configIds = [...new Set([...configIds, ...groupConfigIds])];
    }

    const created: any[] = [];
    await sequelize.transaction(async (t) => {
      for (const configId of configIds) {
        const config = await (ArdTestConfiguration as any).findByPk(configId, { transaction: t });
        if (!config) continue;
        // Seed each result row from the matched Test Configuration's
        // resultParams — without this, ArdTestExecutePage's Results tab
        // always showed "No result parameters defined" regardless of what
        // was configured, since nothing ever copied the config's parameter
        // list onto the test itself.
        const resultRows = ((config.resultParams as any[]) ?? []).map((p: any) => ({
          parameterId: p.id,
          parameterName: p.name,
          param_name: p.name,
          param_type: p.paramType ?? 'INPUT',
          data_type: String(p.dataType ?? 'text').toUpperCase(),
          value: null,
          formula: p.formula ?? undefined,
          lower_limit: p.lowerLimit != null ? String(p.lowerLimit) : undefined,
          upper_limit: p.upperLimit != null ? String(p.upperLimit) : undefined,
          uom: p.uom ?? undefined,
          specification: p.specification ?? undefined,
        }))
        const testReq = await (ArdTestRequest as any).create(
          {
            sampleId,
            testConfigId: configId,
            testType: config.testType,
            testSubtype: config.testSubtype ?? null,
            techniqueCode: config.techniqueCode,
            techniqueName: config.techniqueName,
            status: 'UNASSIGNED',
            priority: body.priority ?? null,
            remarks: body.remarks ?? null,
            testQuantity: body.quantity ?? null,
            results: resultRows,
          },
          { transaction: t }
        );
        created.push(testReq);
      }
    });

    res.status(201).json(successResponse('Tests added to sample', created));
  } catch (err) {
    next(err);
  }
});

// PATCH /:atrId/samples/:sampleId
atrRouter.patch('/:atrId/samples/:sampleId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.department?.code !== 'QA') {
      throw new ForbiddenError('Only QA department can update samples');
    }
    const sample = await (ArdAtrSample as any).findByPk((req.params.sampleId as string));
    if (!sample || (sample as any).atrFormId !== (req.params.atrId as string)) {
      throw new NotFoundError('Sample not found');
    }
    const body = updateSampleSchema.parse(req.body);
    await (sample as any).update({
      sampleCode: body.sample_code,
      // sample_name/unit/expiry_date/additional_info have no columns — the real ones
      // are product_name / uom / exp_date / additional_remarks.
      productName: body.sample_name,
      batchNo: body.batch_no,
      quantity: body.quantity === undefined || body.quantity === null ? null : String(body.quantity),
      uom: body.unit,
      totalContainers: body.total_containers,
      sampledContainers: body.sampled_containers,
      expDate: body.expiry_date === undefined || body.expiry_date === null ? null : String(body.expiry_date),
      sourceBatchId: body.source_batch_id,
      additionalRemarks: body.additional_info,
    });
    res.json(successResponse('Sample updated', sample));
  } catch (err) {
    next(err);
  }
});

// DELETE /:atrId/samples/:sampleId/tests/:testId
atrRouter.delete('/:atrId/samples/:sampleId/tests/:testId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testReq = await (ArdTestRequest as any).findByPk((req.params.testId as string));
    const parentSample = testReq
      ? await (ArdAtrSample as any).findByPk((testReq as any).sampleId, { attributes: ['id', 'atrFormId'] })
      : null;
    if (!testReq || !parentSample || (parentSample as any).atrFormId !== (req.params.atrId as string)) {
      throw new NotFoundError('Test request not found');
    }
    if ((testReq as any).status !== 'UNASSIGNED') {
      throw new BadRequestError('Only UNASSIGNED test requests can be deleted');
    }
    await (testReq as any).destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /:id/summary.pdf
atrRouter.get('/:id/summary.pdf', authenticate, async (req, res, next) => {
  try {
    const { atrSummaryHtml } = await import('../../utils/ardDocuments')
    const { htmlToPdf } = await import('../../utils/pdfRenderer')
    const form = await ArdAtrForm.findByPk(req.params.id as string, {
      include: [
        { model: ArdAtrSample, as: 'samples', required: false, include: [{ model: ArdTestRequest, as: 'tests', required: false }] },
      ],
    })
    if (!form) { res.status(404).json({ success: false, message: 'ATR not found' }); return }
    const html = await atrSummaryHtml(form.toJSON())
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="atr-summary-${(form as any).formNo ?? form.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// GET /:id/coa.pdf
atrRouter.get('/:id/coa.pdf', authenticate, async (req, res, next) => {
  try {
    const { atrCoaHtml } = await import('../../utils/ardDocuments')
    const { htmlToPdf } = await import('../../utils/pdfRenderer')
    const form = await ArdAtrForm.findByPk(req.params.id as string, {
      include: [
        { model: ArdAtrSample, as: 'samples', required: false, include: [{ model: ArdTestRequest, as: 'tests', required: false }] },
      ],
    })
    if (!form) { res.status(404).json({ success: false, message: 'ATR not found' }); return }
    const html = await atrCoaHtml(form.toJSON())
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="atr-coa-${(form as any).formNo ?? form.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// GET /:id/detailed.pdf
atrRouter.get('/:id/detailed.pdf', authenticate, async (req, res, next) => {
  try {
    const { atrDetailedHtml } = await import('../../utils/ardDocuments')
    const { htmlToPdf } = await import('../../utils/pdfRenderer')
    const form = await ArdAtrForm.findByPk(req.params.id as string, {
      include: [
        { model: ArdAtrSample, as: 'samples', required: false, include: [{ model: ArdTestRequest, as: 'tests', required: false }] },
      ],
    })
    if (!form) { res.status(404).json({ success: false, message: 'ATR not found' }); return }
    const html = await atrDetailedHtml(form.toJSON())
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="atr-detailed-${(form as any).formNo ?? form.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// GET /:id/label.png  — barcode label PNG for the ATR form number
atrRouter.get('/:id/label.png', authenticate, async (req, res, next) => {
  try {
    const bwipjs = await import('bwip-js')
    const form = await ArdAtrForm.findByPk(req.params.id as string)
    if (!form) { res.status(404).json({ success: false, message: 'ATR not found' }); return }
    const text = (form as any).formNo ?? (form as any).formNo ?? form.id
    const png = await (bwipjs as any).toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: 'center',
    })
    res.set({ 'Content-Type': 'image/png', 'Content-Disposition': `inline; filename="label-${text}.png"` })
    res.send(png)
  } catch (err) { next(err) }
})

export default atrRouter;
