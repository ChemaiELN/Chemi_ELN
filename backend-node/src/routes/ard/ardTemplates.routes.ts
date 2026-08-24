import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePrivilege, userHasPrivilege, CREATOR_ROLES } from '../../shared/privileges';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, AppError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
import { ArdTemplate, User } from '../../models/index';

const ardTemplateRouter = Router();

const EDITABLE_STATUSES = ['DRAFT', 'REWORK'];

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  name: z.string().min(1),
  template_type: z.string().optional(),
  description: z.string().optional(),
  sections: z.any().optional(),
  dept_id: z.string().optional(),
  include_weighing: z.boolean().optional(),
  include_ph: z.boolean().optional(),
  include_chemicals: z.boolean().optional(),
  include_sample_details: z.boolean().optional(),
  include_equipment: z.boolean().optional(),
  include_column: z.boolean().optional(),
  include_attachments: z.boolean().optional(),
  include_results: z.boolean().optional(),
  include_conclusion: z.boolean().optional(),
  include_cds_report: z.boolean().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const rejectSchema = z.object({
  remarks: z.string().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findTemplate(templateId: string): Promise<InstanceType<typeof ArdTemplate>> {
  const tpl = await (ArdTemplate as any).findByPk(templateId);
  if (!tpl) throw new NotFoundError('Template not found');
  return tpl;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /
ardTemplateRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, template_type, is_active, q } = req.query as Record<string, string>;
    const where: any = {};

    if (is_active === 'true') {
      where.status = 'PUBLISHED';
    } else if (status) {
      where.status = status;
    }

    if (template_type) {
      where.templateType = template_type;
    }

    if (q) {
      where.name = { [Op.iLike]: `%${q}%` };
    }

    // The frontend expects the paginated wrapper {items, total, page, pageSize} that
    // FastAPI returned (backend/app/modules/ard/templates.py:88) — a bare array here
    // rendered the Templates screen as "No data".
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

    const { count, rows } = await (ArdTemplate as any).findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });

    res.json(successResponse('Templates', { items: rows, total: count, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

// The 8+ ARD template section types, ported from
// backend/app/modules/ard/section_types.py:7 (SECTION_TYPES).
const SECTION_TYPES = [
  { type: 'richtext', label: 'Rich Text', configurable: 'none' },
  { type: 'params', label: 'Parameters', configurable: 'none' },
  { type: 'table', label: 'Data Table', configurable: 'columns' },
  { type: 'combined', label: 'Combined', configurable: 'children' },
  { type: 'preconfigured_excel', label: 'Preconfigured Spreadsheet', configurable: 'sheetPreset' },
  { type: 'standard_preparation', label: 'Standard Preparation', configurable: 'none' },
  { type: 'data_item', label: 'Data Item', configurable: 'dataItemId' },
  { type: 'autocomplete_data_item', label: 'Autocomplete Data Item', configurable: 'dataItemId' },
  // Predefined GxP laboratory blocks implemented by the experiment renderer.
  { type: 'weighing', label: 'Weighing Details', configurable: 'none' },
  { type: 'ph', label: 'pH Details', configurable: 'none' },
  { type: 'equipment', label: 'Equipment Details', configurable: 'none' },
  { type: 'column', label: 'Column Details', configurable: 'none' },
  { type: 'chemical', label: 'Material / Chemical Details', configurable: 'none' },
  { type: 'quantitative_result', label: 'Quantitative Results', configurable: 'none' },
  { type: 'further_actions', label: 'Further Actions', configurable: 'none' },
];

// GET /section-types — must precede '/:templateId' or it is captured as an id.
ardTemplateRouter.get('/section-types', authenticate, (_req: Request, res: Response) => {
  res.json(SECTION_TYPES);
});

// GET /published — latest PUBLISHED version per template family.
ardTemplateRouter.get('/published', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdTemplate as any).findAll({
      where: { status: 'PUBLISHED' },
      order: [['createdAt', 'DESC']],
    });

    // Keep only the highest version within each family (family_id falls back to the id
    // for templates that have never been superseded) — mirrors templates.py:91-100.
    const latestByFamily = new Map<string, any>();
    for (const tpl of rows) {
      const family = (tpl as any).familyId ?? (tpl as any).id;
      const current = latestByFamily.get(family);
      if (!current || Number((tpl as any).version ?? 0) > Number(current.version ?? 0)) {
        latestByFamily.set(family, tpl);
      }
    }

    const items = Array.from(latestByFamily.values()).sort((a, b) => {
      const at = new Date((a.updatedAt ?? a.createdAt) as Date).getTime();
      const bt = new Date((b.updatedAt ?? b.createdAt) as Date).getTime();
      return bt - at;
    });

    res.json(successResponse('Published templates', { items }));
  } catch (err) {
    next(err);
  }
});

// GET /:templateId
ardTemplateRouter.get('/:templateId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    res.json(successResponse('Template', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /
ardTemplateRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTemplateSchema.parse(req.body);
    const user = (req as any).user;

    const tpl = await (ArdTemplate as any).create({
      name: body.name,
      templateType: body.template_type,
      description: body.description,
      sections: body.sections,
      deptId: body.dept_id,
      includeWeighing: body.include_weighing,
      includePh: body.include_ph,
      includeChemicals: body.include_chemicals,
      includeSampleDetails: body.include_sample_details,
      includeEquipment: body.include_equipment,
      includeColumn: body.include_column,
      includeAttachments: body.include_attachments,
      includeResults: body.include_results,
      includeConclusion: body.include_conclusion,
      includeCdsReport: body.include_cds_report,
      status: 'DRAFT',
      version: 1,
      createdById: user.id,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    });

    // Self-reference familyId
    await (tpl as any).update({ familyId: (tpl as any).id });

    res.status(201).json(successResponse('Template created', tpl));
  } catch (err) {
    next(err);
  }
});

// PATCH /:templateId
ardTemplateRouter.patch('/:templateId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    const user = (req as any).user;

    if (!EDITABLE_STATUSES.includes((tpl as any).status)) {
      throw new BadRequestError('Only DRAFT or REWORK templates can be edited.');
    }

    const body = updateTemplateSchema.parse(req.body);

    await (tpl as any).update({
      name: body.name,
      templateType: body.template_type,
      description: body.description,
      sections: body.sections,
      deptId: body.dept_id,
      includeWeighing: body.include_weighing,
      includePh: body.include_ph,
      includeChemicals: body.include_chemicals,
      includeSampleDetails: body.include_sample_details,
      includeEquipment: body.include_equipment,
      includeColumn: body.include_column,
      includeAttachments: body.include_attachments,
      includeResults: body.include_results,
      includeConclusion: body.include_conclusion,
      includeCdsReport: body.include_cds_report,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    });

    res.json(successResponse('Template updated', tpl));
  } catch (err) {
    next(err);
  }
});

// DELETE /:templateId
ardTemplateRouter.delete('/:templateId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    await (tpl as any).update({ status: 'DEACTIVATED' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/submit
ardTemplateRouter.post('/:templateId/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    if (!EDITABLE_STATUSES.includes((tpl as any).status)) {
      throw new BadRequestError(`Template cannot be submitted from status: ${(tpl as any).status}`);
    }
    await (tpl as any).update({ status: 'PENDING_APPROVAL' });
    res.json(successResponse('Template submitted for approval', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/approve
ardTemplateRouter.post('/:templateId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    if ((tpl as any).status !== 'PENDING_APPROVAL') {
      throw new BadRequestError('Only PENDING_APPROVAL templates can be approved');
    }
    const user = (req as any).user;
    await (tpl as any).update({
      status: 'PUBLISHED',
      approvedBy: user.username,
      approvedOn: new Date().toISOString().split('T')[0],
    });
    res.json(successResponse('Template approved', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/reject
ardTemplateRouter.post('/:templateId/reject', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    if ((tpl as any).status !== 'PENDING_APPROVAL') {
      throw new BadRequestError('Only PENDING_APPROVAL templates can be rejected');
    }
    const { remarks } = rejectSchema.parse(req.body);
    await (tpl as any).update({
      status: 'REWORK',
      reviewRemarks: remarks,
    });
    res.json(successResponse('Template rejected', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/supersede
ardTemplateRouter.post('/:templateId/supersede', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const original = await findTemplate(req.params.templateId as string);
    const user = (req as any).user;

    const newTpl = await (ArdTemplate as any).create({
      familyId: (original as any).familyId,
      name: (original as any).name,
      templateType: (original as any).templateType,
      description: (original as any).description,
      sections: (original as any).sections,
      deptId: (original as any).deptId,
      includeWeighing: (original as any).includeWeighing,
      includePh: (original as any).includePh,
      includeChemicals: (original as any).includeChemicals,
      includeSampleDetails: (original as any).includeSampleDetails,
      includeEquipment: (original as any).includeEquipment,
      includeColumn: (original as any).includeColumn,
      includeAttachments: (original as any).includeAttachments,
      includeResults: (original as any).includeResults,
      includeConclusion: (original as any).includeConclusion,
      includeCdsReport: (original as any).includeCdsReport,
      version: ((original as any).version || 1) + 1,
      status: 'DRAFT',
      createdById: user.id,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    });

    res.status(201).json(successResponse('Template superseded — new version created', newTpl));
  } catch (err) {
    next(err);
  }
});

export default ardTemplateRouter;
