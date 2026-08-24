import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { authenticate } from '../../middleware/auth.middleware';
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
  User,
  Role,
} from '../../models/index';
import { generateArdExperimentCode } from '../../utils/idSequence';

const ardExperimentRouter = Router();

// Mirrors Python's is_lab_role (atr_rbac.py:151-152) — analyst/TL/HOD/QA/admin.
function isLabRole(rc: string): boolean {
  return ['ANALYST', 'CHEM', 'CHEMIST', 'TL', 'HOD', 'QA', 'ADMIN', 'SUPER_ADMIN'].includes(rc);
}

// Status machine
const EXPERIMENT_TRANSITIONS: Record<string, string[]> = {
  IN_PROGRESS: ['VERIFICATION_REQUESTED', 'SUBMITTED', 'DEACTIVATED'],
  VERIFICATION_REQUESTED: ['VERIFIED', 'VERIFICATION_REWORK'],
  VERIFIED: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REWORK'],
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
  templateId: z.string(),
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
    if (!templateId) throw new BadRequestError('templateId is required');

    const template = await (ArdTemplate as any).findByPk(templateId);
    if (!template) throw new NotFoundError('Template not found');

    if (notebookId) {
      const notebook = await (ArdNotebook as any).findByPk(notebookId);
      if (!notebook) throw new NotFoundError('Notebook not found');
      if (notebook.status !== 'OPEN') {
        throw new BadRequestError('Cannot add an experiment to a notebook that is not OPEN', 'INVALID_STATE');
      }
      if ((notebook as any).maxExperiments) {
        const existingCount = await (ArdExperiment as any).count({ where: { notebookId } });
        if (existingCount >= (notebook as any).maxExperiments) {
          throw new BadRequestError('Notebook has reached maximum experiment capacity');
        }
      }
    }

    const code = await generateArdExperimentCode();
    const exp = await (ArdExperiment as any).create({
      code,
      name: body.name || null,
      templateId,
      templateName: template.name,
      sectionDefs: template.sections,
      sections: {},
      notebookId,
      projectId,
      createdById: user.id,
      status: 'IN_PROGRESS',
      history: [],
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

// GET /pending-review
ardExperimentRouter.get('/pending-review', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Mirrors backend/app/modules/ard/experiments.py:1046-1089.
    //   others → experiments *I* submitted that are still awaiting action
    //   mine   → experiments awaiting *my* action: QA/HOD/admin see every review-state
    //            experiment; a TL sees SUBMITTED ones raised by someone else; anyone
    //            else has nothing to review.
    const REVIEW_STATUSES = ['SUBMITTED', 'VERIFICATION_REQUESTED'];
    const { perspective = 'mine' } = req.query as Record<string, string>;
    const user = (req as any).user;
    const roleCode: string = (user?.role as any)?.code ?? '';

    let where: any;
    if (perspective === 'others') {
      where = { createdById: user.id, status: { [Op.in]: REVIEW_STATUSES } };
    } else if (['QA', 'HOD', 'SUPER_ADMIN', 'ADMIN'].includes(roleCode)) {
      where = { status: { [Op.in]: REVIEW_STATUSES } };
    } else if (['TL', 'TEAM_LEAD'].includes(roleCode)) {
      where = { status: 'SUBMITTED', createdById: { [Op.ne]: user.id } };
    } else {
      where = null;
    }

    const rows = where === null
      ? []
      : await (ArdExperiment as any).findAll({ where, order: [['updatedAt', 'DESC']] });

    // Who submitted and when is derived from the most recent SUBMITTED /
    // VERIFICATION_REQUESTED history entry (experiments.py:1091-1116).
    const MS_PER_DAY = 86_400_000;
    const now = Date.now();
    const items = rows.map((e: any) => {
      const history: any[] = (e.history as any[]) || [];
      let submittedBy: string | null = null;
      let submittedAt: string | null = null;
      for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (entry?.action === 'SUBMITTED' || entry?.action === 'VERIFICATION_REQUESTED') {
          submittedBy = entry?.by ?? null;
          submittedAt = entry?.at ?? null;
          break;
        }
      }
      return {
        id: String(e.id),
        code: e.code,
        templateName: e.templateName ?? null,
        status: e.status,
        submittedBy,
        submittedAt,
        ageDays: e.createdAt ? Math.floor((now - new Date(e.createdAt).getTime()) / MS_PER_DAY) : null,
        notebookId: e.notebookId ? String(e.notebookId) : null,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
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
      comment,
      by: user.id,
      byName: user.username,
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
