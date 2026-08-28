import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { authenticate } from '../../middleware/auth.middleware';
import { verifyPassword } from '../../utils/auth.utils';
import { requirePrivilege, userHasPrivilege, CREATOR_ROLES } from '../../shared/privileges';
import { settingEnabled, enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError, AppError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
import {
  ArdExperiment,
  ArdTemplate,
  ArdNotebook,
  ArdTestRequest,
  ArdAtrForm,
  ArdProject,
  ArdSetting,
  User,
  Role,
} from '../../models/index';
import { generateArdExperimentCode } from '../../utils/idSequence';
import { buildExperimentSectionDefs } from './ardTemplates.routes';

const ardExperimentRouter = Router();

// Mirrors Python's is_lab_role (atr_rbac.py:151-152) — analyst/TL/HOD/QA/admin.
function isLabRole(rc: string): boolean {
  return ['ANALYST', 'CHEM', 'CHEMIST', 'TL', 'HOD', 'QA', 'ADMIN', 'SUPER_ADMIN'].includes(rc);
}

// B-80: mirrors ArdExperimentWorkspacePage.tsx's `verificationEnabled` — both
// the app-level setting and the notebook flag default to true when unset
// (verification required unless explicitly turned off at either level).
async function isVerificationRequired(notebookId: string | null): Promise<boolean> {
  const setting = await (ArdSetting as any).findOne({ where: { key: 'IncludeADVerificationFlow' } });
  const appOk = setting ? String(setting.value).toLowerCase() !== 'false' : true;
  if (!appOk) return false;
  if (!notebookId) return true;
  const nb = await (ArdNotebook as any).findByPk(notebookId, { attributes: ['includeVerificationFlow'] });
  return nb?.includeVerificationFlow ?? true;
}

// Status machine
const EXPERIMENT_TRANSITIONS: Record<string, string[]> = {
  IN_PROGRESS: ['VERIFICATION_REQUESTED', 'SUBMITTED', 'DEACTIVATED'],
  VERIFICATION_REQUESTED: ['VERIFIED', 'VERIFICATION_REWORK', 'DEACTIVATED'],
  VERIFIED: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REWORK', 'DEACTIVATED'],
  APPROVED: ['UNLOCK_REQUESTED'],
  REWORK: ['IN_PROGRESS'],
  UNLOCK_REQUESTED: ['UNLOCKED'],
  UNLOCKED: ['IN_PROGRESS'],
};

const ESIGN_TRANSITIONS: Record<string, string> = {
  SUBMITTED: ESIGN_FLAGS.EXPERIMENT_SUBMIT_AUTH,
  APPROVED: ESIGN_FLAGS.EXPERIMENT_APPROVE_AUTH,
};

const HOD_TL_ROLES = ['HOD', 'TL', 'SUPER_ADMIN'];
const MAX_SNAPSHOTS = 50;

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

// Wire contract matches what ArdExperimentsPage.tsx actually sends
// (camelCase, straight from the Form's field names) — the old snake_case
// schema here never matched, so every experiment create 400'd.
const createExperimentSchema = z.object({
  templateId: z.string().optional(),
  notebookId: z.string().optional(),
  projectId: z.string().optional(),
  name: z.string().optional(),
  testType: z.string().optional(),
  testSubType: z.string().optional(),
  aimObjective: z.string().optional(),
  projectStpId: z.string().optional(),
  // legacy snake_case aliases, kept for any other caller
  template_id: z.string().optional(),
  notebook_id: z.string().optional(),
  project_id: z.string().optional(),
});

const updateExperimentSchema = z.object({
  sections: z.record(z.any()).optional(),
  test_type: z.string().optional(),
  test_subtype: z.string().optional(),
  highlighted: z.boolean().optional(),
  aim_achieved: z.boolean().optional(),
  aim_remarks: z.string().optional(),
  // Rich-text Aim/Objective and Conclusion — fixed blocks every experiment
  // has regardless of its template's attached sections (mirrors the
  // Attachments panel, which is likewise not a template-authored section).
  aim: z.string().nullable().optional(),
  conclusion: z.string().nullable().optional(),
  linked_samples: z.any().optional(),
  reference_experiments: z.any().optional(),
  linked_atr_ids: z.any().optional(),
  contributors: z.any().optional(),
});

const transitionSchema = z.object({
  // Every frontend call site sends the target status as `to` (see
  // ArdExperimentWorkspacePage.tsx's `transition.mutate`/`mutateAsync`
  // calls) — `action` was never actually sent, so this schema's required
  // `action` field failed validation on every single transition (422).
  // `action` is kept as a fallback alias, matching atrs.routes.ts's schema.
  to: z.string().optional(),
  action: z.string().optional(),
  password: z.string().optional(),
  remarks: z.string().optional(),
  reason: z.string().optional(),
  aimAchieved: z.boolean().optional(),
  aimRemarks: z.string().optional(),
  reviewerId: z.string().optional(),
  reviewerName: z.string().optional(),
  linkedAtrIds: z.any().optional(),
});

const cloneSchema = z.object({});

const sectionCommentSchema = z.object({
  section_key: z.string(),
  comment: z.string().min(1),
});

const clarificationSchema = z.object({
  message: z.string().min(1),
});

const postAnalyticalSchema = z.object({
  key: z.string().optional(),
  value: z.any().optional(),
}).passthrough();

const takeoverSchema = z.object({
  analyst_id: z.string(),
  analyst_name: z.string().optional(),
});

const reassignReviewerSchema = z.object({
  reviewer_id: z.string(),
  reviewer_name: z.string().optional(),
});

const sampleWeightsSchema = z.object({
  sample_weights: z.record(z.any()),
});

const importEmpowerSchema = z.object({
  csv_data: z.string(),
});

const pushResultsSchema = z.object({
  test_request_id: z.string(),
  results: z.any(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findExperiment(experimentId: string): Promise<InstanceType<typeof ArdExperiment>> {
  const exp = await (ArdExperiment as any).findByPk(experimentId);
  if (!exp) throw new NotFoundError('Experiment not found');
  return exp;
}

function makeSectionSnapshot(sections: any) {
  const hash = createHash('sha256').update(JSON.stringify(sections)).digest('hex');
  return { hash, sections, at: new Date() };
}

function mergeSnapshots(existing: any[], newSnap: any): any[] {
  const arr = [...(existing || []), newSnap];
  return arr.slice(-MAX_SNAPSHOTS);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /
ardExperimentRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notebookId, view } = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(req.query);
    const where: any = {};
    if (status) where.status = status;
    if (notebookId) where.notebookId = notebookId;

    const { count, rows } = await (ArdExperiment as any).findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    const pagination = buildPagination(page, limit, count);
    res.json(listResponse('Experiments', rows, pagination));
  } catch (err) {
    next(err);
  }
});

// POST /
ardExperimentRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createExperimentSchema.parse(req.body);
    const user = (req as any).user;
    const templateId = body.templateId || body.template_id;
    const notebookId = body.notebookId || body.notebook_id;
    const projectId = body.projectId || body.project_id;
    const projectStpId = body.projectStpId;
    if (!templateId && !projectStpId) throw new BadRequestError('templateId or projectStpId is required');

    if (notebookId) {
      const notebook = await (ArdNotebook as any).findByPk(notebookId);
      if (!notebook) throw new NotFoundError('Notebook not found');
      if (notebook.status !== 'ACTIVE') {
        throw new BadRequestError('Cannot add an experiment to a notebook that is not Active', 'INVALID_STATE');
      }
      if ((notebook as any).maxExperiments) {
        const existingCount = await (ArdExperiment as any).count({ where: { notebookId } });
        if (existingCount >= (notebook as any).maxExperiments) {
          throw new BadRequestError('Notebook has reached maximum experiment capacity');
        }
      }
    }

    const code = await generateArdExperimentCode();

    let templateName: string | null = null;
    let sectionDefs: any[];
    let stp: any = null;
    if (projectStpId) {
      // STP-sourced experiment: NOT a snapshot-of-attached-Sections like a
      // template — the STP itself carries a fixed, ordered set of section
      // types the renderer already knows (sample_details/equipment/material/
      // weighing/ph/column/spreadsheet/further_actions — the same block
      // types Template Builder already defines, matching the legacy STP
      // Worksheet's experiment screen: Sample Details, Equipment Details,
      // Material Details always present; Weighing/pH/Column only when the
      // STP checked them; one spreadsheet block per uploaded Excel; Further
      // Actions at the end), so sectionDefs are built directly here rather
      // than via buildExperimentSectionDefs (which reads the ArdTemplate
      // snapshot tables STPs have no relationship to).
      if (!projectId) throw new BadRequestError('projectId is required when creating from an STP');
      const project = await (ArdProject as any).findByPk(projectId);
      if (!project) throw new NotFoundError('Project not found');
      stp = ((project.stpDocuments as any[]) || []).find((s: any) => s.id === projectStpId);
      if (!stp) throw new NotFoundError('STP document on this project');
      if (stp.status !== 'APPROVED') throw new BadRequestError('Only an APPROVED STP can be used to create an experiment', 'INVALID_STATE');

      templateName = stp.title;
      sectionDefs = [
        { id: uuidv4(), type: 'sample_details', title: 'Sample Details', required: true },
        { id: uuidv4(), type: 'equipment', title: 'Equipment Details', required: true },
        { id: uuidv4(), type: 'material', title: 'Material Details', required: true },
      ];
      if (stp.weighingDetails) sectionDefs.push({ id: uuidv4(), type: 'weighing', title: 'Weighing Details', required: true });
      if (stp.phDetails) sectionDefs.push({ id: uuidv4(), type: 'ph', title: 'pH Details', required: true });
      if (stp.columnDetails) sectionDefs.push({ id: uuidv4(), type: 'column', title: 'Column Details', required: true });
      if (stp.sampleMappingSpreadsheet) {
        sectionDefs.push({ id: uuidv4(), type: 'spreadsheet', title: 'Sample Mapping Details', required: true, spreadsheet: stp.sampleMappingSpreadsheet });
      }
      if (stp.procedureSpreadsheet) {
        sectionDefs.push({ id: uuidv4(), type: 'spreadsheet', title: 'Procedure', required: true, spreadsheet: stp.procedureSpreadsheet });
      }
      if (stp.stpCalculationSpreadsheet) {
        sectionDefs.push({ id: uuidv4(), type: 'spreadsheet', title: 'STP Calculation', required: true, spreadsheet: stp.stpCalculationSpreadsheet });
      }
      sectionDefs.push({ id: uuidv4(), type: 'further_actions', title: 'Further Actions', required: false });
    } else {
      const template = await (ArdTemplate as any).findByPk(templateId);
      if (!template) throw new NotFoundError('Template not found');
      templateName = template.name;
      sectionDefs = await buildExperimentSectionDefs(templateId as string);
    }

    // Test Type/Sub-Type mirror the selected STP when created via Project
    // STP (matching the legacy Angular "Add Experiment" form, where these
    // were read-only, derived from the chosen STP, not independently
    // picked) — body.testType/testSubType stay as an explicit override for
    // the Via-Template flow, which has no STP to derive them from.
    const testType = body.testType || stp?.testType || null;
    const testSubtype = body.testSubType || stp?.testSubtype || null;

    const exp = await (ArdExperiment as any).create({
      code,
      name: body.name || null,
      templateId: projectStpId ? null : templateId,
      templateName,
      projectStpId: projectStpId || null,
      testType,
      testSubtype,
      aim: body.aimObjective || null,
      sectionDefs,
      sections: {},
      notebookId,
      projectId,
      createdById: user.id,
      status: 'IN_PROGRESS',
      history: [],
      linkedSamples: [],
      referenceExperiments: [],
      clarifications: [],
      sectionComments: [],
      postAnalytical: [],
      versionSnapshots: [],
    });

    res.status(201).json(successResponse('Experiment created', exp));
  } catch (err) {
    next(err);
  }
});

// GET /ongoing — the AD Experiments "Ongoing" tab: experiments still being
// worked on (IN_PROGRESS), not yet sent anywhere for review. Flat list, no
// mine/others split — that only makes sense once something's been submitted.
ardExperimentRouter.get('/ongoing', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdExperiment as any).findAll({ where: { status: 'IN_PROGRESS' }, order: [['updatedAt', 'DESC']] });

    const projectIds = Array.from(new Set(rows.map((e: any) => e.projectId).filter(Boolean)));
    const projects = projectIds.length
      ? await (ArdProject as any).findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id', 'code', 'productName'] })
      : [];
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));

    const MS_PER_DAY = 86_400_000;
    const now = Date.now();
    const items = rows.map((e: any) => {
      const project: any = e.projectId ? projectMap.get(e.projectId) : null;
      return {
        id: String(e.id),
        code: e.code,
        templateName: e.templateName ?? null,
        status: e.status,
        aim: e.aim ?? null,
        projectCode: project?.code ?? null,
        productName: project?.productName ?? null,
        ageDays: e.createdAt ? Math.floor((now - new Date(e.createdAt).getTime()) / MS_PER_DAY) : null,
        notebookId: e.notebookId ? String(e.notebookId) : null,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
      };
    });

    res.json(successResponse('Ongoing experiments', { items, total: items.length }));
  } catch (err) {
    next(err);
  }
});

// GET /review-comments — the AD Experiments "Review Comments" tab: every
// experiment carrying at least one reviewer comment (the same clarifications
// thread the experiment workspace's "QA Comments" panel posts to via
// POST /:experimentId/clarifications). perspective=all widens beyond just
// the caller's own experiments — same idea as the Tests screen's "Include
// All Users" checkbox on In Progress.
ardExperimentRouter.get('/review-comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const { perspective } = req.query as Record<string, string>;

    const rows = await (ArdExperiment as any).findAll({ order: [['updatedAt', 'DESC']] });
    const withComments = rows.filter((e: any) => Array.isArray(e.clarifications) && e.clarifications.length > 0);
    const scoped = perspective === 'all'
      ? withComments
      : withComments.filter((e: any) => e.createdById === user.id);

    const projectIds = Array.from(new Set(scoped.map((e: any) => e.projectId).filter(Boolean)));
    const projects = projectIds.length
      ? await (ArdProject as any).findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id', 'code', 'productName'] })
      : [];
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));

    const notebookIds = Array.from(new Set(scoped.map((e: any) => e.notebookId).filter(Boolean)));
    const notebooks = notebookIds.length
      ? await (ArdNotebook as any).findAll({ where: { id: { [Op.in]: notebookIds } }, attributes: ['id', 'notebookType'] })
      : [];
    const notebookMap = new Map(notebooks.map((n: any) => [n.id, n]));

    const creatorIds = Array.from(new Set(scoped.map((e: any) => e.createdById).filter(Boolean)));
    const creators = creatorIds.length
      ? await (User as any).findAll({ where: { id: { [Op.in]: creatorIds } }, attributes: ['id', 'username'] })
      : [];
    const creatorMap = new Map(creators.map((u: any) => [u.id, u.username]));

    const MS_PER_DAY = 86_400_000;
    const now = Date.now();
    const items = scoped.map((e: any) => {
      const project: any = e.projectId ? projectMap.get(e.projectId) : null;
      const notebook: any = e.notebookId ? notebookMap.get(e.notebookId) : null;
      return {
        id: String(e.id),
        code: e.code,
        templateName: e.templateName ?? null,
        aim: e.aim ?? null,
        projectCode: project?.code ?? null,
        productName: project?.productName ?? null,
        notebookType: notebook?.notebookType ?? null,
        linkedAtrIds: e.linkedAtrIds ?? [],
        clarifications: e.clarifications ?? [],
        createdByName: e.createdById ? (creatorMap.get(e.createdById) ?? null) : null,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
        ageDays: e.createdAt ? Math.floor((now - new Date(e.createdAt).getTime()) / MS_PER_DAY) : null,
      };
    });

    res.json(successResponse('Review comments', { items, total: items.length }));
  } catch (err) {
    next(err);
  }
});

// GET /pending-review
ardExperimentRouter.get('/pending-review', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Mirrors backend/app/modules/ard/experiments.py:1046-1089.
    //   others → experiments *I* submitted that are still awaiting action
    //   mine   → experiments awaiting *my* action: QA/HOD/admin see every review-state
    //            experiment; a TL sees SUBMITTED ones raised by someone else; anyone
    //            else has nothing to review.
    const REVIEW_STATUSES = ['SUBMITTED', 'VERIFICATION_REQUESTED'];
    const { perspective = 'mine', status } = req.query as Record<string, string>;
    // AD Experiments has two distinct tabs sharing this same endpoint —
    // Approval (SUBMITTED) and Verification (VERIFICATION_REQUESTED) — so a
    // caller narrows to exactly one status; omitting it keeps the original
    // combined behavior for any other consumer.
    const statuses = status ? [status] : REVIEW_STATUSES;
    const user = (req as any).user;
    const roleCode: string = (user?.role as any)?.code ?? '';

    let where: any;
    if (perspective === 'others') {
      where = { createdById: user.id, status: { [Op.in]: statuses } };
    } else if (['QA', 'HOD', 'SUPER_ADMIN', 'ADMIN'].includes(roleCode)) {
      where = { status: { [Op.in]: statuses } };
    } else if (['TL', 'TEAM_LEAD'].includes(roleCode)) {
      where = { status: { [Op.in]: statuses }, createdById: { [Op.ne]: user.id } };
    } else {
      where = null;
    }

    const rows = where === null
      ? []
      : await (ArdExperiment as any).findAll({ where, order: [['updatedAt', 'DESC']] });

    // Product/Project Code live on the parent project, not the experiment —
    // one lookup for every distinct projectId instead of N+1 per row.
    const projectIds = Array.from(new Set(rows.map((e: any) => e.projectId).filter(Boolean)));
    const projects = projectIds.length
      ? await (ArdProject as any).findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id', 'code', 'productName'] })
      : [];
    const projectMap = new Map(projects.map((p: any) => [p.id, p]));

    // Who submitted and when is derived from the most recent SUBMITTED /
    // VERIFICATION_REQUESTED history entry (experiments.py:1091-1116).
    // requestCount tallies every such entry — how many times this experiment
    // has been sent out for review (resubmissions after rework count too).
    const MS_PER_DAY = 86_400_000;
    const now = Date.now();
    const items = rows.map((e: any) => {
      const history: any[] = (e.history as any[]) || [];
      let submittedBy: string | null = null;
      let submittedAt: string | null = null;
      let requestCount = 0;
      for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        // History entries record the transition as {from, to}, not an
        // {action} field — this previously always missed (both here and in
        // the original single-entry version this replaced), leaving
        // Submitted By/On blank for every row.
        if (entry?.to === 'SUBMITTED' || entry?.to === 'VERIFICATION_REQUESTED') {
          requestCount += 1;
          if (submittedAt === null) {
            // byName is the resolved username recorded alongside every
            // history entry — `by` itself is only the raw user id.
            submittedBy = entry?.byName ?? entry?.by ?? null;
            submittedAt = entry?.at ?? null;
          }
        }
      }
      const project: any = e.projectId ? projectMap.get(e.projectId) : null;
      return {
        id: String(e.id),
        code: e.code,
        templateName: e.templateName ?? null,
        status: e.status,
        submittedBy,
        submittedAt,
        submittedTo: e.reviewerName ?? null,
        aim: e.aim ?? null,
        requestCount,
        projectCode: project?.code ?? null,
        productName: project?.productName ?? null,
        ageDays: e.createdAt ? Math.floor((now - new Date(e.createdAt).getTime()) / MS_PER_DAY) : null,
        notebookId: e.notebookId ? String(e.notebookId) : null,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
        history,
      };
    });

    res.json(successResponse('Pending review experiments', { items, total: items.length }));
  } catch (err) {
    next(err);
  }
});

// GET /lookup/by-code/:code
ardExperimentRouter.get('/lookup/by-code/:code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await (ArdExperiment as any).findOne({ where: { code: req.params.code } });
    if (!exp) throw new NotFoundError('Experiment not found');
    res.json(successResponse('Experiment', exp));
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId
ardExperimentRouter.get('/:experimentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await (ArdExperiment as any).findByPk(req.params.experimentId, {
      include: [{ model: ArdNotebook, as: 'notebook' }],
    });
    if (!exp) throw new NotFoundError('Experiment not found');
    res.json(successResponse('Experiment', exp));
  } catch (err) {
    next(err);
  }
});

// PATCH /:experimentId
ardExperimentRouter.patch('/:experimentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const currentStatus = (exp as any).status;
    if (!['IN_PROGRESS', 'REWORK'].includes(currentStatus)) {
      throw new BadRequestError(`Experiment cannot be edited in status: ${currentStatus}`);
    }

    const body = updateExperimentSchema.parse(req.body);
    const updates: any = {};

    if (body.sections) {
      const existing = (exp as any).sections || {};
      const merged = {
        ...existing,
        ...Object.fromEntries(
          Object.entries(body.sections).map(([k, v]) => [
            k,
            { ...(existing[k] || {}), ...(v as object) },
          ])
        ),
      };
      updates.sections = merged;
      const snap = makeSectionSnapshot(merged);
      updates.versionSnapshots = mergeSnapshots((exp as any).versionSnapshots, snap);
    }

    if (body.test_type !== undefined) updates.testType = body.test_type;
    if (body.test_subtype !== undefined) updates.testSubtype = body.test_subtype;
    if (body.highlighted !== undefined) updates.highlighted = body.highlighted;
    if (body.aim_achieved !== undefined) updates.aimAchieved = body.aim_achieved;
    if (body.aim_remarks !== undefined) updates.aimRemarks = body.aim_remarks;
    if (body.aim !== undefined) updates.aim = body.aim;
    if (body.conclusion !== undefined) updates.conclusion = body.conclusion;
    if (body.linked_samples !== undefined) updates.linkedSamples = body.linked_samples;
    if (body.reference_experiments !== undefined) updates.referenceExperiments = body.reference_experiments;
    if (body.linked_atr_ids !== undefined) updates.linkedAtrIds = body.linked_atr_ids;
    if (body.contributors !== undefined) updates.contributors = body.contributors;

    await (exp as any).update(updates);
    res.json(successResponse('Experiment updated', exp));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/transition
ardExperimentRouter.post('/:experimentId/transition', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = transitionSchema.parse(req.body);
    const action = parsed.to || parsed.action;
    if (!action) throw new BadRequestError('Target status is required');
    const { password, remarks, reason, aimAchieved, aimRemarks, reviewerId, reviewerName, linkedAtrIds } = parsed;
    const exp = await findExperiment(req.params.experimentId as string);
    const user = (req as any).user;
    const currentStatus = (exp as any).status;
    const allowed = EXPERIMENT_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(action)) {
      throw new BadRequestError(`Transition '${action}' not allowed from status '${currentStatus}'`);
    }

    // B-80: IN_PROGRESS -> SUBMITTED is the direct 1-step shortcut that skips
    // peer verification entirely — only valid when verification isn't
    // required for this experiment (app setting AND notebook flag). This
    // must be enforced here, not just hidden in the UI, since the frontend
    // button being hidden doesn't stop a direct API call.
    if (currentStatus === 'IN_PROGRESS' && action === 'SUBMITTED') {
      const required = await isVerificationRequired((exp as any).notebookId ?? null);
      if (required) {
        throw new BadRequestError('This notebook requires peer verification before approval — submit for verification instead.', 'VERIFICATION_REQUIRED');
      }
    }

    const esignFlag = ESIGN_TRANSITIONS[action];
    if (esignFlag) {
      await enforceEsignature(user, esignFlag, password);
    }

    const historyEntry = {
      from: currentStatus,
      to: action,
      by: user.id,
      byName: user.username,
      at: new Date(),
      ...(remarks ? { remarks } : {}),
      ...(reason ? { reason } : {}),
    };

    const updates: any = {
      status: action,
      history: [...((exp as any).history || []), historyEntry],
    };

    if (action === 'SUBMITTED') {
      updates.submittedById = user.id;
      updates.submittedAt = new Date();
      if (reviewerId) {
        updates.reviewerId = reviewerId;
        updates.reviewerName = reviewerName ?? null;
      }
    }
    if (action === 'APPROVED') {
      updates.approvedById = user.id;
      updates.approvedAt = new Date();
    }
    if (aimAchieved != null) updates.aimAchieved = aimAchieved;
    if (aimRemarks) updates.aimRemarks = aimRemarks;
    if (linkedAtrIds) updates.linkedAtrIds = linkedAtrIds;

    await (exp as any).update(updates);
    res.json(successResponse('Experiment status updated', exp));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/clone
ardExperimentRouter.post('/:experimentId/clone', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const rc: string = (user?.role as any)?.code || '';
    if (!isLabRole(rc)) throw new ForbiddenError('Not permitted to clone experiments.');
    const exp = await findExperiment(req.params.experimentId as string);
    const code = await generateArdExperimentCode();
    const clone = await (ArdExperiment as any).create({
      code,
      templateId: (exp as any).templateId,
      templateName: (exp as any).templateName,
      sectionDefs: (exp as any).sectionDefs,
      sections: (exp as any).sections,
      notebookId: (exp as any).notebookId,
      projectId: (exp as any).projectId,
      testType: (exp as any).testType,
      testSubtype: (exp as any).testSubtype,
      status: 'IN_PROGRESS',
      createdById: user.id,
      history: [],
      linkedSamples: [],
      referenceExperiments: [],
      clarifications: [],
      sectionComments: [],
      postAnalytical: [],
      versionSnapshots: [],
    });
    res.status(201).json(successResponse('Experiment cloned', clone));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/clone-blank
ardExperimentRouter.post('/:experimentId/clone-blank', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const rc: string = (user?.role as any)?.code || '';
    if (!isLabRole(rc)) throw new ForbiddenError('Not permitted to clone experiments.');
    const exp = await findExperiment(req.params.experimentId as string);
    const code = await generateArdExperimentCode();
    const clone = await (ArdExperiment as any).create({
      code,
      templateId: (exp as any).templateId,
      templateName: (exp as any).templateName,
      sectionDefs: (exp as any).sectionDefs,
      sections: null,
      notebookId: (exp as any).notebookId,
      projectId: (exp as any).projectId,
      testType: (exp as any).testType,
      testSubtype: (exp as any).testSubtype,
      status: 'IN_PROGRESS',
      createdById: user.id,
      history: [],
      linkedSamples: [],
      referenceExperiments: [],
      clarifications: [],
      sectionComments: [],
      postAnalytical: [],
      versionSnapshots: [],
    });
    res.status(201).json(successResponse('Blank experiment cloned', clone));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/restore
ardExperimentRouter.post('/:experimentId/restore', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!HOD_TL_ROLES.includes(user.role?.code)) {
      throw new ForbiddenError('Only HOD, TL, or SUPER_ADMIN can restore experiments');
    }
    const exp = await findExperiment(req.params.experimentId as string);
    if ((exp as any).status !== 'DEACTIVATED') {
      throw new BadRequestError('Only DEACTIVATED experiments can be restored');
    }
    await (exp as any).update({ status: 'IN_PROGRESS' });
    res.json(successResponse('Experiment restored', exp));
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId/check-lock
ardExperimentRouter.get('/:experimentId/check-lock', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const locked =
      !!(exp as any).editorLockUserId &&
      new Date((exp as any).editorLockExpiresAt) > new Date();
    res.json(
      successResponse('Lock status', {
        locked,
        lockedBy: locked ? (exp as any).editorLockUsername : null,
        expiresAt: locked ? (exp as any).editorLockExpiresAt : null,
      })
    );
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/acquire-lock
ardExperimentRouter.post('/:experimentId/acquire-lock', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const user = (req as any).user;
    const now = new Date();
    if (
      (exp as any).editorLockUserId &&
      new Date((exp as any).editorLockExpiresAt) > now &&
      (exp as any).editorLockUserId !== user.id
    ) {
      throw new ConflictError('Experiment is currently locked by another user.');
    }
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await (exp as any).update({
      editorLockUserId: user.id,
      editorLockUsername: user.username,
      editorLockExpiresAt: expiresAt,
    });
    res.json(successResponse('Lock acquired', { expiresAt }));
  } catch (err) {
    next(err);
  }
});

// DELETE /:experimentId/lock
ardExperimentRouter.delete('/:experimentId/lock', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const user = (req as any).user;
    const isOwner = (exp as any).editorLockUserId === user.id;
    const isPrivileged = HOD_TL_ROLES.includes(user.role?.code);
    if (!isOwner && !isPrivileged) {
      throw new ForbiddenError('You do not have permission to release this lock');
    }
    await (exp as any).update({
      editorLockUserId: null,
      editorLockUsername: null,
      editorLockExpiresAt: null,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId/versions
ardExperimentRouter.get('/:experimentId/versions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    res.json(
      successResponse('Experiment versions', {
        snapshots: (exp as any).versionSnapshots || [],
        history: (exp as any).history || [],
      })
    );
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId/versions/compare
ardExperimentRouter.get('/:experimentId/versions/compare', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { v1, v2 } = req.query as Record<string, string>;
    const exp = await findExperiment(req.params.experimentId as string);
    const snapshots: any[] = (exp as any).versionSnapshots || [];
    const snap1 = snapshots.find((s) => s.hash === v1) || null;
    const snap2 = snapshots.find((s) => s.hash === v2) || null;
    res.json(successResponse('Version comparison', { v1: snap1, v2: snap2 }));
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId/report.pdf
ardExperimentRouter.get('/:experimentId/report.pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ardExperimentReportHtml } = await import('../../utils/ardDocuments');
    const { htmlToPdf } = await import('../../utils/pdfRenderer');
    const exp = await findExperiment(req.params.experimentId as string);
    const notebook = exp.notebookId ? await ArdNotebook.findByPk(exp.notebookId as any) : null;
    const creatorName = (exp as any).createdByName ?? (exp as any).createdBy ?? 'Unknown';
    const html = ardExperimentReportHtml(exp.toJSON(), notebook?.toJSON() ?? {}, {}, creatorName);
    const pdf = await htmlToPdf(html);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ard-experiment-${exp.id}.pdf"` });
    res.send(pdf);
  } catch (err) { next(err); }
});

// POST /:experimentId/section-comments
ardExperimentRouter.post('/:experimentId/section-comments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { section_key, comment } = sectionCommentSchema.parse(req.body);
    const user = (req as any).user;
    const exp = await findExperiment(req.params.experimentId as string);
    const entry = {
      id: uuidv4(),
      sectionKey: section_key,
      // sectionId/authorRole are what the ModifyAfterRework "unlock sections
      // with reviewer comments" check on the frontend actually reads — this
      // entry previously only carried sectionKey/by, so that check silently
      // never matched anything and no section ever unlocked during rework.
      sectionId: section_key,
      comment,
      by: user.id,
      byName: user.username,
      authorRole: (user.role as any)?.code ?? null,
      at: new Date(),
    };
    await (exp as any).update({
      sectionComments: [...((exp as any).sectionComments || []), entry],
    });
    res.status(201).json(successResponse('Section comment added', entry));
  } catch (err) {
    next(err);
  }
});

// DELETE /:experimentId/section-comments/:commentId
ardExperimentRouter.delete('/:experimentId/section-comments/:commentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const filtered = ((exp as any).sectionComments || []).filter(
      (c: any) => c.id !== req.params.commentId
    );
    await (exp as any).update({ sectionComments: filtered });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/clarifications
ardExperimentRouter.post('/:experimentId/clarifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = clarificationSchema.parse(req.body);
    const user = (req as any).user;
    const exp = await findExperiment(req.params.experimentId as string);
    const entry = {
      id: uuidv4(),
      message,
      by: user.id,
      byName: user.username,
      at: new Date(),
    };
    await (exp as any).update({
      clarifications: [...((exp as any).clarifications || []), entry],
    });
    res.status(201).json(successResponse('Clarification added', entry));
  } catch (err) {
    next(err);
  }
});

// DELETE /:experimentId/clarifications/:clarificationId
ardExperimentRouter.delete('/:experimentId/clarifications/:clarificationId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const filtered = ((exp as any).clarifications || []).filter(
      (c: any) => c.id !== req.params.clarificationId
    );
    await (exp as any).update({ clarifications: filtered });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /:experimentId/post-analytical
ardExperimentRouter.get('/:experimentId/post-analytical', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    res.json(successResponse('Post-analytical data', (exp as any).postAnalytical || []));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/post-analytical
ardExperimentRouter.post('/:experimentId/post-analytical', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = postAnalyticalSchema.parse(req.body);
    const user = (req as any).user;
    const exp = await findExperiment(req.params.experimentId as string);
    const entry = {
      id: uuidv4(),
      ...body,
      by: user.id,
      byName: user.username,
      at: new Date(),
    };
    await (exp as any).update({
      postAnalytical: [...((exp as any).postAnalytical || []), entry],
    });
    res.status(201).json(successResponse('Post-analytical entry added', entry));
  } catch (err) {
    next(err);
  }
});

// DELETE /:experimentId/post-analytical/:itemId
ardExperimentRouter.delete('/:experimentId/post-analytical/:itemId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    const filtered = ((exp as any).postAnalytical || []).filter(
      (item: any) => item.id !== req.params.itemId
    );
    await (exp as any).update({ postAnalytical: filtered });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/takeover
ardExperimentRouter.post('/:experimentId/takeover', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!HOD_TL_ROLES.includes(user.role?.code)) {
      throw new ForbiddenError('Only HOD, TL, or SUPER_ADMIN can perform takeover');
    }
    const { analyst_id, analyst_name } = takeoverSchema.parse(req.body);
    const exp = await findExperiment(req.params.experimentId as string);
    let resolvedName = analyst_name;
    if (!resolvedName) {
      const analyst = await (User as any).findByPk(analyst_id);
      resolvedName = analyst?.username;
    }
    await (exp as any).update({ createdById: analyst_id });
    res.json(successResponse('Experiment taken over', exp));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/reassign-reviewer
ardExperimentRouter.post('/:experimentId/reassign-reviewer', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewer_id, reviewer_name } = reassignReviewerSchema.parse(req.body);
    const exp = await findExperiment(req.params.experimentId as string);
    let resolvedName = reviewer_name;
    if (!resolvedName) {
      const reviewer = await (User as any).findByPk(reviewer_id);
      resolvedName = reviewer?.username;
    }
    await (exp as any).update({ reviewerId: reviewer_id, reviewerName: resolvedName });
    res.json(successResponse('Reviewer reassigned', exp));
  } catch (err) {
    next(err);
  }
});

// POST /bulk-take-over-review — the "Take Over" action on the AD Experiments
// Approval > Submitted to Others tab. Claims the review for the current user.
// Always requires e-signature (unconditional, like ardTests.routes.ts's
// bulk-reassign-team) since this changes who owns a GxP review decision.
ardExperimentRouter.post('/bulk-take-over-review', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const body = z.object({
      experimentIds: z.array(z.string()).min(1),
      remarks: z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body);

    const passwordValid = await verifyPassword(body.password, user.passwordHash);
    if (!passwordValid) {
      throw new BadRequestError('Electronic signature failed. Incorrect password.', 'ESIGNATURE_FAILED');
    }

    const experiments = await (ArdExperiment as any).findAll({ where: { id: { [Op.in]: body.experimentIds } } });
    let updatedCount = 0;
    for (const exp of experiments) {
      const fromReviewer = (exp as any).reviewerName ?? null;
      const historyEntry = {
        action: 'REVIEWER_TAKEOVER',
        by: user.id,
        byName: user.username,
        at: new Date(),
        remarks: body.remarks,
        ...(fromReviewer ? { from: fromReviewer } : {}),
        to: user.username,
      };
      await exp.update({
        reviewerId: user.id,
        reviewerName: user.username,
        history: [...((exp as any).history || []), historyEntry],
      });
      updatedCount++;
    }

    res.json(successResponse('Review taken over', { updatedCount }));
  } catch (err) {
    next(err);
  }
});

// PATCH /:experimentId/highlight
ardExperimentRouter.patch('/:experimentId/highlight', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp = await findExperiment(req.params.experimentId as string);
    await (exp as any).update({ highlighted: !(exp as any).highlighted });
    res.json(successResponse('Highlight toggled', { highlighted: (exp as any).highlighted }));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/stp/update-sample-weights
ardExperimentRouter.post('/:experimentId/stp/update-sample-weights', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sample_weights } = sampleWeightsSchema.parse(req.body);
    const exp = await findExperiment(req.params.experimentId as string);
    const sections = { ...((exp as any).sections || {}), sampleWeights: sample_weights };
    const snap = makeSectionSnapshot(sections);
    await (exp as any).update({
      sections,
      versionSnapshots: mergeSnapshots((exp as any).versionSnapshots, snap),
    });
    res.json(successResponse('Sample weights updated', { sections }));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/stp/import-empower
ardExperimentRouter.post('/:experimentId/stp/import-empower', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { csv_data } = importEmpowerSchema.parse(req.body);
    const exp = await findExperiment(req.params.experimentId as string);
    const lines = csv_data.trim().split('\n');
    const headers = lines[0]?.split(',').map((h: string) => h.trim()) || [];
    const rows = lines.slice(1).map((line: string) => {
      const values = line.split(',').map((v: string) => v.trim());
      return Object.fromEntries(headers.map((h: string, i: number) => [h, values[i] ?? '']));
    });
    const sections = { ...((exp as any).sections || {}), empowerData: rows };
    const snap = makeSectionSnapshot(sections);
    await (exp as any).update({
      sections,
      versionSnapshots: mergeSnapshots((exp as any).versionSnapshots, snap),
    });
    res.json(successResponse('Empower data imported', { rowCount: rows.length }));
  } catch (err) {
    next(err);
  }
});

// POST /:experimentId/stp/push-results
ardExperimentRouter.post('/:experimentId/stp/push-results', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { test_request_id, results } = pushResultsSchema.parse(req.body);
    const testReq = await (ArdTestRequest as any).findByPk(test_request_id);
    if (!testReq) throw new NotFoundError('Test request not found');
    await (testReq as any).update({ results });
    res.json(successResponse('Results pushed to test request', testReq));
  } catch (err) {
    next(err);
  }
});

export default ardExperimentRouter;
