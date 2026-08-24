import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePrivilege, userHasPrivilege, CREATOR_ROLES } from '../../shared/privileges';
import { settingEnabled, enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError, AppError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
import {
  ArdAtrForm,
  ArdAtrSample,
  ArdTestRequest,
  ArdFormType,
  ArdTestConfiguration,
  ArdTestGroup,
  ArdTestGroupMember,
  ArdAnalystQualification,
  User,
  Role,
  Department,
} from '../../models/index';
import { generateAtrNumber } from '../../utils/idSequence';

const atrRouter = Router();

const ATR_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SAVED'],
  SAVED: ['NEW', 'DRAFT'],
  REQUESTED: ['DEPT_TL_APPROVED', 'REJECTED'],
  DEPT_TL_APPROVED: ['NEW'],
  NEW: ['IN_PROGRESS', 'WITHDRAWN', 'PARTIAL'],
  QA_PRE_APPROVAL: ['NEW', 'REJECTED'],
  PARTIAL: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'WITHDRAWN'],
  PENDING_APPROVAL: ['CERTIFIED', 'REJECTED', 'CERTIFICATION_REQUESTED', 'CLARIFIED', 'PENDING_CLARIFICATION'],
  CERTIFICATION_REQUESTED: ['CERTIFIED', 'CERT_REWORK'],
};

const EDITABLE_STATUSES = ['DRAFT', 'SAVED'];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createAtrSchema = z.object({
  form_type_id: z.string().optional(),
  form_type_name: z.string().optional(),
  product_name: z.string().optional(),
  project_code: z.string().optional(),
  project_id: z.string().optional(),
  batch_no: z.string().optional(),
  priority: z.string().optional(),
  remarks: z.string().optional(),
  chemicals: z.any().optional(),
  target_completion_date: z.string().optional(),
});

const updateAtrSchema = createAtrSchema.partial();

const transitionSchema = z.object({
  action: z.string(),
  password: z.string().optional(),
});

const clarificationSchema = z.object({
  message: z.string().min(1),
});

const changeOwnerSchema = z.object({
  user_id: z.string(),
});

const assignTlSchema = z.object({
  tl_id: z.string(),
  tl_name: z.string().optional(),
});

const reassignQaSchema = z.object({
  qa_id: z.string(),
  qa_name: z.string().optional(),
});

const linkExperimentSchema = z.object({
  experiment_id: z.string(),
});

const addTestsSchema = z.object({
  test_config_ids: z.array(z.string()).optional(),
  test_group_id: z.string().optional(),
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

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /counts
atrRouter.get('/counts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdAtrForm as any).findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    });
    const counts: Record<string, number> = {};
    for (const row of rows as any[]) {
      counts[row.status] = parseInt(row.count, 10);
    }
    res.json(successResponse('ATR counts', counts));
  } catch (err) {
    next(err);
  }
});

// GET /
atrRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, statuses, tab, q, scope } = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(req.query);
    const where: any = {};

    if (statuses) {
      where.status = { [Op.in]: statuses.split(',').map((s) => s.trim()) };
    } else if (status) {
      where.status = status;
    } else if (tab) {
      where.status = tab;
    }

    if (q) {
      // batch_no is a sample column, so it is not searchable on the form row.
      where[Op.or as any] = [
        { formNo: { [Op.iLike]: `%${q}%` } },
        { productName: { [Op.iLike]: `%${q}%` } },
        { projectCode: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (scope === 'mine') {
      where.createdById = (req as any).user.id;
    }

    const { count, rows } = await (ArdAtrForm as any).findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        // Tests hang off samples (ard_test_requests.sample_id), matching the frontend's
        // AtrSample shape — there is no direct form→test association.
        { model: ArdAtrSample, as: 'samples', attributes: ['id'], include: [{ model: ArdTestRequest, as: 'tests', attributes: ['id'] }] },
      ],
    });

    const pagination = buildPagination(page, limit, count);
    res.json(listResponse('ATR forms', rows, pagination));
  } catch (err) {
    next(err);
  }
});

// GET /:atrId
atrRouter.get('/:atrId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const atr = await (ArdAtrForm as any).findByPk((req.params.atrId as string), {
      include: [
        { model: ArdAtrSample, as: 'samples', include: [{ model: ArdTestRequest, as: 'tests' }] },
      ],
    });
    if (!atr) throw new NotFoundError('ATR form not found');
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
      body.target_completion_date ? `Target completion: ${body.target_completion_date}` : null,
      body.batch_no ? `Batch no: ${body.batch_no}` : null,
    ].filter(Boolean).join(' | ');

    const atr = await (ArdAtrForm as any).create({
      formNo: atrNo,
      status: 'DRAFT',
      formTypeId: body.form_type_id ?? null,
      formTypeName: body.form_type_name ?? '',
      productName: body.product_name ?? '',
      projectCode: body.project_code ?? '',
      originProjectId: body.project_id ?? null,
      requestRemarks: extraNotes || null,
      analysisRemarks: body.remarks ?? null,
      createdBy: user.username,
      createdById: user.id,
      assignedTl: '',
      workflowHistory: [],
      clarifications: [],
      attributeValues: {},
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
    if (body.form_type_id !== undefined) updates.formTypeId = body.form_type_id;
    if (body.form_type_name !== undefined) updates.formTypeName = body.form_type_name;
    if (body.product_name !== undefined) updates.productName = body.product_name;
    if (body.project_code !== undefined) updates.projectCode = body.project_code;
    if (body.project_id !== undefined) updates.originProjectId = body.project_id;
    if (body.remarks !== undefined) updates.analysisRemarks = body.remarks;
    const notes = [
      body.priority ? `Priority: ${body.priority}` : null,
      body.target_completion_date ? `Target completion: ${body.target_completion_date}` : null,
      body.batch_no ? `Batch no: ${body.batch_no}` : null,
    ].filter(Boolean).join(' | ');
    if (notes) updates.requestRemarks = notes;
    await (atr as any).update(updates);
    res.json(successResponse('ATR form updated', atr));
  } catch (err) {
    next(err);
  }
});

// POST /:atrId/transition
atrRouter.post('/:atrId/transition', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, password } = transitionSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    const user = (req as any).user;
    const currentStatus = (atr as any).status;
    const allowed = ATR_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(action)) {
      throw new BadRequestError(`Transition '${action}' is not allowed from status '${currentStatus}'`);
    }

    if (action === 'QA_PRE_APPROVAL') {
      await enforceEsignature(user, ESIGN_FLAGS.ATR_QA_PRE_APPROVAL, password);
    }

    const historyEntry = {
      from: currentStatus,
      to: action,
      by: user.id,
      byName: user.username,
      at: new Date(),
    };

    await (atr as any).update({
      status: action,
      workflowHistory: [...((atr as any).workflowHistory || []), historyEntry],
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
    const { user_id } = changeOwnerSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    const newOwner = await (User as any).findByPk(user_id);
    if (!newOwner) throw new NotFoundError('User not found');

    await (atr as any).update({
      currentOwnerId: user_id,
      currentOwner: newOwner.username,
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
    if (user.role?.code !== 'HOD') {
      throw new ForbiddenError('Only HOD can assign TL');
    }
    const { tl_id, tl_name } = assignTlSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    let resolvedTlName = tl_name;
    if (!resolvedTlName) {
      const tl = await (User as any).findByPk(tl_id);
      resolvedTlName = tl?.username;
    }
    await (atr as any).update({ assignedTlId: tl_id, assignedTl: resolvedTlName ?? '' });
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
    const { qa_id, qa_name } = reassignQaSchema.parse(req.body);
    const atr = await findAtr((req.params.atrId as string));
    let resolvedQaName = qa_name;
    if (!resolvedQaName) {
      const qa = await (User as any).findByPk(qa_id);
      resolvedQaName = qa?.username;
    }
    await (atr as any).update({ qaReviewerId: qa_id });
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
    const entry = {
      id: uuidv4(),
      message,
      by: user.id,
      byName: user.username,
      at: new Date(),
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
    const incompleteStatuses = ['UNASSIGNED', 'ASSIGNED', 'STARTED'];
    // Tests are reachable only via their sample (no atr_form_id on ard_test_requests).
    const atrSampleRows = await (ArdAtrSample as any).findAll({
      where: { atrFormId: (req.params.atrId as string) },
      attributes: ['id'],
    });
    const atrSampleIds = atrSampleRows.map((r: any) => r.id);
    const incomplete = atrSampleIds.length === 0 ? 0 : await (ArdTestRequest as any).count({
      where: {
        sampleId: { [Op.in]: atrSampleIds },
        status: { [Op.in]: incompleteStatuses },
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
atrRouter.post('/:atrId/certify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await enforceEsignature(user, ESIGN_FLAGS.QA_CERTIFY_AUTH, req.body.password);
    const atr = await findAtr((req.params.atrId as string));
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
    await (atr as any).update({ status: 'CERT_REWORK' });
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
    const { test_config_ids = [], test_group_id } = addTestsSchema.parse(req.body);
    const atrId = req.params.atrId as string;
    const sampleId = (req.params.sampleId as string) as string;

    const atr = await findAtr(atrId);
    const sample = await (ArdAtrSample as any).findByPk(sampleId);
    if (!sample) throw new NotFoundError('Sample not found');

    let configIds: string[] = [...test_config_ids];

    if (test_group_id) {
      const members = await (ArdTestGroupMember as any).findAll({
        where: { testGroupId: test_group_id },
      });
      const groupConfigIds = members.map((m: any) => m.testConfigId);
      configIds = [...new Set([...configIds, ...groupConfigIds])];
    }

    const created: any[] = [];
    await sequelize.transaction(async (t) => {
      for (const configId of configIds) {
        const config = await (ArdTestConfiguration as any).findByPk(configId, { transaction: t });
        if (!config) continue;
        const testReq = await (ArdTestRequest as any).create(
          {
            sampleId,
            testConfigId: configId,
            testType: config.testType,
            testSubtype: config.testSubtype ?? null,
            techniqueCode: config.techniqueCode,
            techniqueName: config.techniqueName,
            status: 'UNASSIGNED',
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
