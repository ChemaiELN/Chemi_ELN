import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { authenticate } from '../../middleware/auth.middleware';
import { requireArdDeptMember, assertSameDept } from '../../shared/ardDepartmentAccess';
import { enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError, AppError } from '../../utils/errors';
import { SECTION_TYPES, normalizeSectionType, DATATABLE_TYPES, SINGLE_DATA_ITEM_TYPES, MULTI_DATA_ITEM_TYPES, RICHTEXT_TYPES, EMBEDDED_FILE_TYPES } from '../../constants/ardSectionTypes';
import { sequelize } from '../../database/connection';
import {
  ArdTemplate, ArdExperiment, ArdAuditLog,
  ArdSection, ArdSectionDatatable, ArdDatatableColumn, ArdSectionDataItem, ArdDataItem,
  ArdSectionRichtext, ArdSectionEmbeddedFile,
  ArdTemplateSection,
  ArdTemplateSectionRichtextSnapshot, ArdTemplateSectionDataItemSnapshot,
  ArdTemplateSectionDatatableSnapshot, ArdTemplateDatatableColumnSnapshot,
  ArdTemplateSectionEmbeddedFileSnapshot,
} from '../../models/index';

const ardTemplateRouter = Router();
ardTemplateRouter.use(authenticate, requireArdDeptMember);

// Ported verbatim from Python's TEMPLATE_TRANSITIONS / TEMPLATE_TRANSITION_ROLES
// (backend/app/modules/ard/templates.py:19-34). TL is included on every
// transition — this is what "Team lead needs to publish" was missing.
const TEMPLATE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['PUBLISHED', 'REWORK'],
  REWORK: ['DRAFT', 'PENDING_APPROVAL'],
  PUBLISHED: [],
  SUPERSEDED: [],
};
const TEMPLATE_TRANSITION_ROLES: Record<string, string[]> = {
  PENDING_APPROVAL: ['TL', 'HOD', 'SUPER_ADMIN'],
  PUBLISHED: ['TL', 'HOD', 'SUPER_ADMIN'],
  REWORK: ['TL', 'HOD', 'SUPER_ADMIN'],
  DRAFT: ['TL', 'HOD', 'SUPER_ADMIN'],
};
const CREATE_ROLES = ['TL', 'HOD', 'SUPER_ADMIN'];

function requireCreateRole(user: any) {
  const rc = (user?.role as any)?.code || '';
  if (!CREATE_ROLES.includes(rc)) throw new ForbiddenError('Only TL/HOD can manage templates.');
}

async function auditLog(entityId: string, action: string, userId: string | null, detail?: string | null) {
  await (ArdAuditLog as any).create({ entityType: 'TEMPLATE', entityId, action, userId, detail: detail ?? null });
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────
// §3.3: `sections` moves from "full section content inline" to an ordered list of
// attachment records referencing master ard_sections rows by id.
const templateSectionAttachmentSchema = z.object({
  sectionId: z.string().uuid(),
  includeInCloning: z.boolean().optional(),
  includeInEmpower: z.boolean().optional(),
  updateSampleWeights: z.boolean().optional(),
  updateResultSample: z.boolean().optional(),
  includeReadWeighingExcel: z.boolean().optional(),
});

const saveTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional().nullable(),
  templateType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sections: z.array(templateSectionAttachmentSchema).optional(),
  deptId: z.string().optional().nullable(),
  activationDate: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  includeWeighing: z.boolean().optional(),
  includePh: z.boolean().optional(),
  includeChemicals: z.boolean().optional(),
  includeSampleDetails: z.boolean().optional(),
  includeEquipment: z.boolean().optional(),
  includeColumn: z.boolean().optional(),
  includeAttachments: z.boolean().optional(),
  includeResults: z.boolean().optional(),
  includeConclusion: z.boolean().optional(),
  includeCdsReport: z.boolean().optional(),
});

const transitionSchema = z.object({
  to: z.string(),
  remarks: z.string().optional(),
  password: z.string().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function findTemplate(templateId: string): Promise<InstanceType<typeof ArdTemplate>> {
  const tpl = await (ArdTemplate as any).findByPk(templateId);
  if (!tpl) throw new NotFoundError('Template not found');
  return tpl;
}

async function assertNoDuplicateCode(code: string | null | undefined, excludeId?: string) {
  if (!code) return;
  const where: any = { code };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const duplicate = await (ArdTemplate as any).findOne({ where });
  if (duplicate) {
    throw new ConflictError(`A template with code "${code}" already exists.`);
  }
}

// §3.3: persist the ordered attachment list as ard_template_sections rows.
// sequenceNumber is always derived from array order — never trusted from the
// client — and existing rows not present in the new list are soft-removed
// rather than deleted, matching the soft-removal convention used everywhere
// else in this rearchitecture.
async function replaceTemplateSections(
  templateId: string,
  attachments: z.infer<typeof templateSectionAttachmentSchema>[],
  t: any,
) {
  const existing = await (ArdTemplateSection as any).findAll({ where: { templateId }, transaction: t });
  const keepIds = new Set<string>();
  for (let i = 0; i < attachments.length; i++) {
    const a = attachments[i];
    const match = existing.find((e: any) => e.sectionId === a.sectionId);
    const fields = {
      sequenceNumber: i,
      includeInCloning: a.includeInCloning ?? true,
      includeInEmpower: a.includeInEmpower ?? false,
      updateSampleWeights: a.updateSampleWeights ?? false,
      updateResultSample: a.updateResultSample ?? false,
      includeReadWeighingExcel: a.includeReadWeighingExcel ?? false,
      isActive: true,
    };
    if (match) {
      await match.update(fields, { transaction: t });
      keepIds.add(match.id);
    } else {
      const created = await (ArdTemplateSection as any).create({ templateId, sectionId: a.sectionId, ...fields }, { transaction: t });
      keepIds.add(created.id);
    }
  }
  for (const e of existing) {
    if (!keepIds.has(e.id) && e.isActive) await e.update({ isActive: false }, { transaction: t });
  }
}

// Structural completeness check, adapted from the legacy JSON-blob validator to the
// new join-table model. A template needs at least one attached section; table/
// combined sections need at least one active column; data_item/autocomplete_data_item
// sections need at least one active linked data item (defensive — ardSections.routes.ts
// already enforces this at section-save time, but a master section's only link could
// have been removed since this template attached it).
async function assertTemplateSectionsValid(templateId: string) {
  const errors: string[] = [];
  const attachments = await (ArdTemplateSection as any).findAll({
    where: { templateId, isActive: true },
    include: [{ model: ArdSection, as: 'section' }],
    order: [['sequenceNumber', 'ASC']],
  });

  if (!attachments.length) {
    errors.push('Add at least one section before submitting.');
  }

  for (const a of attachments) {
    const section = a.section;
    if (!section) continue;
    const stype = normalizeSectionType(section.sectionType);
    if (DATATABLE_TYPES.has(stype)) {
      const dt = await (ArdSectionDatatable as any).findOne({ where: { sectionId: section.id } });
      const colCount = dt ? await (ArdDatatableColumn as any).count({ where: { datatableId: dt.id, isActive: true } }) : 0;
      if (!colCount) errors.push(`Section '${section.name}' needs at least one column.`);
    }
    if (SINGLE_DATA_ITEM_TYPES.has(stype)) {
      const linkCount = await (ArdSectionDataItem as any).count({ where: { sectionId: section.id, isActive: true } });
      if (!linkCount) errors.push(`Section '${section.name}' needs a linked data item.`);
    }
  }

  if (errors.length) {
    throw new AppError('Template failed validation', 400, 'TEMPLATE_VALIDATION', { message: 'Template failed validation', errors });
  }
}

// §1.10/§4: copy-on-save snapshot — pins this template version's rendered content
// independently of later edits to the shared master section/data-item definitions.
// Reads from the LIVE master tables (ard_sections / ard_data_items / ...), so this
// is the "derive fresh from current master data" path — used on create, plain
// save, and new-version. Cloning uses copySnapshotFromSource() instead, which
// copies from the source template's own already-snapshotted rows (see below).
export async function snapshotTemplateSections(templateId: string, t: any) {
  const attachments = await (ArdTemplateSection as any).findAll({
    where: { templateId, isActive: true },
    include: [{ model: ArdSection, as: 'section' }],
    transaction: t,
  });

  for (const a of attachments) {
    const section = a.section;
    if (!section) continue;
    const stype = normalizeSectionType(section.sectionType);

    if (RICHTEXT_TYPES.has(stype)) {
      const rt = await (ArdSectionRichtext as any).findByPk(section.id, { transaction: t });
      const [snap] = await (ArdTemplateSectionRichtextSnapshot as any).findOrCreate({
        where: { templateId, sectionId: section.id },
        defaults: { templateId, sectionId: section.id },
        transaction: t,
      });
      await snap.update({
        editorHeight: rt?.editorHeight ?? null,
        editorWidth: rt?.editorWidth ?? null,
        defaultContent: rt?.defaultContent ?? null,
      }, { transaction: t });
    }

    if (DATATABLE_TYPES.has(stype)) {
      const dt = await (ArdSectionDatatable as any).findOne({ where: { sectionId: section.id }, transaction: t });
      if (dt) {
        const [dtSnap] = await (ArdTemplateSectionDatatableSnapshot as any).findOrCreate({
          where: { templateId, sectionId: section.id, datatableId: dt.id },
          defaults: { templateId, sectionId: section.id, datatableId: dt.id },
          transaction: t,
        });
        await dtSnap.update({ name: dt.name, description: dt.description, typicalRowCount: dt.typicalRowCount }, { transaction: t });

        const columns = await (ArdDatatableColumn as any).findAll({ where: { datatableId: dt.id, isActive: true }, transaction: t });
        for (const col of columns) {
          const [colSnap] = await (ArdTemplateDatatableColumnSnapshot as any).findOrCreate({
            where: { datatableSnapshotId: dtSnap.id, dataItemId: col.dataItemId },
            defaults: {
              templateId, datatableSnapshotId: dtSnap.id, dataItemId: col.dataItemId,
              sequenceNumber: col.sequenceNumber, relativeWidth: col.relativeWidth, isMandatory: col.isMandatory,
            },
            transaction: t,
          });
          await colSnap.update({
            sequenceNumber: col.sequenceNumber, relativeWidth: col.relativeWidth, isMandatory: col.isMandatory,
          }, { transaction: t });
        }
      }
    }

    if (EMBEDDED_FILE_TYPES.has(stype)) {
      const ef = await (ArdSectionEmbeddedFile as any).findByPk(section.id, { transaction: t });
      const [efSnap] = await (ArdTemplateSectionEmbeddedFileSnapshot as any).findOrCreate({
        where: { templateId, sectionId: section.id },
        defaults: { templateId, sectionId: section.id },
        transaction: t,
      });
      await efSnap.update({
        fileName: ef?.fileName ?? null, fileData: ef?.fileData ?? null,
        mappingFileName: ef?.mappingFileName ?? null, mappingFileData: ef?.mappingFileData ?? null,
      }, { transaction: t });
    }

    if (SINGLE_DATA_ITEM_TYPES.has(stype) || MULTI_DATA_ITEM_TYPES.has(stype)) {
      const links = await (ArdSectionDataItem as any).findAll({
        where: { sectionId: section.id, isActive: true },
        include: [{ model: ArdDataItem, as: 'dataItem' }],
        transaction: t,
      });
      for (const link of links) {
        if (!link.dataItem) continue;
        const [diSnap] = await (ArdTemplateSectionDataItemSnapshot as any).findOrCreate({
          where: { templateId, sectionId: section.id, dataItemId: link.dataItemId },
          defaults: { templateId, sectionId: section.id, dataItemId: link.dataItemId, name: link.dataItem.name, dataType: link.dataItem.dataType },
          transaction: t,
        });
        await diSnap.update({
          name: link.dataItem.name, dataType: link.dataItem.dataType, lengthCategory: link.dataItem.lengthCategory,
          sequenceNumber: link.sequenceNumber, isMandatory: link.isMandatory,
        }, { transaction: t });
      }
    }
  }
}

// §4 (clone row): "copy from the source template's own already-snapshotted rows,
// not the live master sections, so a clone of an old version reproduces exactly
// what that version looked like, unaffected by later master-section edits."
async function copySnapshotFromSource(sourceTemplateId: string, newTemplateId: string, t: any) {
  const richtextRows = await (ArdTemplateSectionRichtextSnapshot as any).findAll({ where: { templateId: sourceTemplateId }, transaction: t });
  for (const r of richtextRows) {
    await (ArdTemplateSectionRichtextSnapshot as any).create({
      templateId: newTemplateId, sectionId: r.sectionId, editorHeight: r.editorHeight, editorWidth: r.editorWidth, defaultContent: r.defaultContent,
    }, { transaction: t });
  }

  const dataItemRows = await (ArdTemplateSectionDataItemSnapshot as any).findAll({ where: { templateId: sourceTemplateId }, transaction: t });
  for (const r of dataItemRows) {
    await (ArdTemplateSectionDataItemSnapshot as any).create({
      templateId: newTemplateId, sectionId: r.sectionId, dataItemId: r.dataItemId, name: r.name, dataType: r.dataType,
      lengthCategory: r.lengthCategory, sequenceNumber: r.sequenceNumber, isMandatory: r.isMandatory,
    }, { transaction: t });
  }

  const embeddedFileRows = await (ArdTemplateSectionEmbeddedFileSnapshot as any).findAll({ where: { templateId: sourceTemplateId }, transaction: t });
  for (const r of embeddedFileRows) {
    await (ArdTemplateSectionEmbeddedFileSnapshot as any).create({
      templateId: newTemplateId, sectionId: r.sectionId, fileName: r.fileName, fileData: r.fileData,
      mappingFileName: r.mappingFileName, mappingFileData: r.mappingFileData,
    }, { transaction: t });
  }

  const datatableRows = await (ArdTemplateSectionDatatableSnapshot as any).findAll({ where: { templateId: sourceTemplateId }, transaction: t });
  for (const dtRow of datatableRows) {
    const newDt = await (ArdTemplateSectionDatatableSnapshot as any).create({
      templateId: newTemplateId, sectionId: dtRow.sectionId, datatableId: dtRow.datatableId,
      name: dtRow.name, description: dtRow.description, typicalRowCount: dtRow.typicalRowCount,
    }, { transaction: t });
    const colRows = await (ArdTemplateDatatableColumnSnapshot as any).findAll({ where: { datatableSnapshotId: dtRow.id }, transaction: t });
    for (const col of colRows) {
      await (ArdTemplateDatatableColumnSnapshot as any).create({
        templateId: newTemplateId, datatableSnapshotId: newDt.id, dataItemId: col.dataItemId,
        sequenceNumber: col.sequenceNumber, relativeWidth: col.relativeWidth, isMandatory: col.isMandatory,
      }, { transaction: t });
    }
  }
}

// Copies the attachment list (ard_template_sections) itself from source → target,
// preserving per-attachment flags and order. Used by both clone and new-version.
async function copyTemplateSectionAttachments(sourceTemplateId: string, newTemplateId: string, t: any) {
  const rows = await (ArdTemplateSection as any).findAll({ where: { templateId: sourceTemplateId, isActive: true }, order: [['sequenceNumber', 'ASC']], transaction: t });
  for (const r of rows) {
    await (ArdTemplateSection as any).create({
      templateId: newTemplateId, sectionId: r.sectionId, sequenceNumber: r.sequenceNumber,
      includeInCloning: r.includeInCloning, includeInEmpower: r.includeInEmpower,
      updateSampleWeights: r.updateSampleWeights, updateResultSample: r.updateResultSample,
      includeReadWeighingExcel: r.includeReadWeighingExcel, isActive: true,
    }, { transaction: t });
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /
ardTemplateRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
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

// GET /section-types — must precede '/:templateId' or it is captured as an id.
ardTemplateRouter.get('/section-types', (_req: Request, res: Response) => {
  res.json(SECTION_TYPES);
});

// GET /published — latest PUBLISHED version per template family.
ardTemplateRouter.get('/published', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdTemplate as any).findAll({
      where: { status: 'PUBLISHED' },
      order: [['createdAt', 'DESC']],
    });

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

// GET /:templateId/experiment-count
ardTemplateRouter.get('/:templateId/experiment-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await (ArdExperiment as any).count({ where: { templateId: req.params.templateId } });
    res.json(successResponse('Experiment count', { count }));
  } catch (err) { next(err); }
});

// GET /:templateId/sections — the attachment list with per-attachment flags,
// resolved against the live master sections (for authoring in the builder).
ardTemplateRouter.get('/:templateId/sections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);
    const rows = await (ArdTemplateSection as any).findAll({
      where: { templateId: tpl.id, isActive: true },
      include: [{ model: ArdSection, as: 'section' }],
      order: [['sequenceNumber', 'ASC']],
    });
    res.json(successResponse('Template sections', {
      items: rows.map((r: any) => ({
        id: r.id, sectionId: r.sectionId, sequenceNumber: r.sequenceNumber,
        includeInCloning: r.includeInCloning, includeInEmpower: r.includeInEmpower,
        updateSampleWeights: r.updateSampleWeights, updateResultSample: r.updateResultSample,
        includeReadWeighingExcel: r.includeReadWeighingExcel,
        section: r.section ? {
          id: r.section.id, name: r.section.name, sectionType: r.section.sectionType,
          description: r.section.description, active: r.section.isActive,
        } : null,
      })),
    }));
  } catch (err) { next(err); }
});

// GET /:templateId/preview — render from the SNAPSHOT tables, never the live
// ard_sections/ard_data_items tables (§3.4). Any future "generate an experiment
// from an active template" endpoint should follow the same read-path convention.
ardTemplateRouter.get('/:templateId/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);

    const [richtext, dataItems, datatables, embeddedFiles, columns] = await Promise.all([
      (ArdTemplateSectionRichtextSnapshot as any).findAll({ where: { templateId: tpl.id } }),
      (ArdTemplateSectionDataItemSnapshot as any).findAll({ where: { templateId: tpl.id }, order: [['sequenceNumber', 'ASC']] }),
      (ArdTemplateSectionDatatableSnapshot as any).findAll({ where: { templateId: tpl.id } }),
      (ArdTemplateSectionEmbeddedFileSnapshot as any).findAll({ where: { templateId: tpl.id } }),
      (ArdTemplateDatatableColumnSnapshot as any).findAll({ where: { templateId: tpl.id }, order: [['sequenceNumber', 'ASC']] }),
    ]);

    const attachments = await (ArdTemplateSection as any).findAll({
      where: { templateId: tpl.id, isActive: true },
      include: [{ model: ArdSection, as: 'section' }],
      order: [['sequenceNumber', 'ASC']],
    });

    const columnsByDatatableSnap = new Map<string, any[]>();
    for (const c of columns) {
      const list = columnsByDatatableSnap.get(c.datatableSnapshotId) ?? [];
      list.push({ dataItemId: c.dataItemId, sequenceNumber: c.sequenceNumber, relativeWidth: Number(c.relativeWidth), isMandatory: c.isMandatory });
      columnsByDatatableSnap.set(c.datatableSnapshotId, list);
    }

    const sections = attachments.map((a: any) => {
      const section = a.section;
      const base = { sectionId: a.sectionId, name: section?.name ?? null, sectionType: section?.sectionType ?? null, sequenceNumber: a.sequenceNumber };
      const rt = richtext.find((r: any) => r.sectionId === a.sectionId);
      const dt = datatables.find((r: any) => r.sectionId === a.sectionId);
      const ef = embeddedFiles.find((r: any) => r.sectionId === a.sectionId);
      const dataItemLinks = dataItems.filter((r: any) => r.sectionId === a.sectionId);
      return {
        ...base,
        richtext: rt ? { editorHeight: rt.editorHeight, editorWidth: rt.editorWidth, defaultContent: rt.defaultContent } : undefined,
        datatable: dt ? { name: dt.name, description: dt.description, typicalRowCount: dt.typicalRowCount, columns: columnsByDatatableSnap.get(dt.id) ?? [] } : undefined,
        embeddedFile: ef ? { fileName: ef.fileName, mappingFileName: ef.mappingFileName, hasFile: !!ef.fileData } : undefined,
        dataItemLinks: dataItemLinks.length ? dataItemLinks.map((l: any) => ({ dataItemId: l.dataItemId, name: l.name, dataType: l.dataType, lengthCategory: l.lengthCategory, isMandatory: l.isMandatory })) : undefined,
      };
    });

    res.json(successResponse('Template preview', { templateId: tpl.id, name: (tpl as any).name, status: (tpl as any).status, sections }));
  } catch (err) { next(err); }
});

// GET /:templateId
ardTemplateRouter.get('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);
    res.json(successResponse('Template', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /
ardTemplateRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    requireCreateRole((req as any).user);
    const body = saveTemplateSchema.parse(req.body);
    const user = (req as any).user;

    await assertNoDuplicateCode(body.code);

    const tpl = await (ArdTemplate as any).create({
      name: body.name || 'Untitled Template',
      code: body.code ?? null,
      templateType: body.templateType,
      description: body.description,
      sections: [], // legacy JSONB column — retained until the §6 backfill/cleanup migration; no longer authoritative
      deptId: body.deptId,
      activationDate: body.activationDate,
      includeWeighing: body.includeWeighing,
      includePh: body.includePh,
      includeChemicals: body.includeChemicals,
      includeSampleDetails: body.includeSampleDetails,
      includeEquipment: body.includeEquipment,
      includeColumn: body.includeColumn,
      includeAttachments: body.includeAttachments,
      includeResults: body.includeResults,
      includeConclusion: body.includeConclusion,
      includeCdsReport: body.includeCdsReport,
      status: 'DRAFT',
      // §5.4: no explicit version here — the model default (0) applies. A DRAFT
      // that's never been published shouldn't claim to be "version 1"; the
      // PUBLISHED transition below is the only place version gets bumped to 1.
      createdById: user.id,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    }, { transaction: t });

    await (tpl as any).update({ familyId: (tpl as any).id }, { transaction: t });

    if (body.sections?.length) {
      await replaceTemplateSections(tpl.id, body.sections, t);
      await snapshotTemplateSections(tpl.id, t);
    }

    await auditLog(tpl.id, 'Created', user.id, tpl.name);
    await t.commit();

    res.status(201).json(successResponse('Template created', tpl));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// PUT /:templateId — mirrors Python's save_template (templates.py:160-187).
ardTemplateRouter.put('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    requireCreateRole((req as any).user);
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);
    const user = (req as any).user;

    if (['PUBLISHED', 'SUPERSEDED'].includes((tpl as any).status)) {
      throw new BadRequestError('Published/superseded templates are read-only.');
    }

    const body = saveTemplateSchema.parse(req.body);
    if (body.code !== undefined) await assertNoDuplicateCode(body.code, tpl.id);

    const updates: any = { lastUpdatedBy: user.username, lastUpdatedById: user.id };
    (Object.keys(body) as (keyof typeof body)[]).forEach((k) => {
      if (k === 'sections') return; // handled separately below via the join tables
      if (body[k] !== undefined) updates[k] = body[k];
    });

    await (tpl as any).update(updates, { transaction: t });

    // §4: re-snapshot on every save including plain edits — legacy skipped this on
    // plain edits and that was a confirmed defect, not an intentional design choice.
    if (body.sections !== undefined) {
      await replaceTemplateSections(tpl.id, body.sections, t);
    }
    await snapshotTemplateSections(tpl.id, t);

    await auditLog(tpl.id, 'Updated', user.id, tpl.name);
    await t.commit();

    const fresh = await findTemplate(tpl.id);
    res.json(successResponse('Template updated', fresh));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// DELETE /:templateId
ardTemplateRouter.delete('/:templateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCreateRole((req as any).user);
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);
    if ((tpl as any).status === 'PUBLISHED') throw new BadRequestError('Published templates cannot be deleted.');
    const linked = await (ArdExperiment as any).count({ where: { templateId: tpl.id } });
    if (linked > 0) throw new BadRequestError('Template has associated experiments and cannot be deleted.');
    await tpl.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/transition — mirrors Python's transition_template
// (templates.py:190-237). Replaces the old /submit, /approve, /reject routes,
// none of which the frontend ever called (it calls /transition).
ardTemplateRouter.post('/:templateId/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tpl = await findTemplate(req.params.templateId as string);
    assertSameDept((tpl as any).deptId, (req as any).user);
    const user = (req as any).user;
    const rc: string = (user?.role as any)?.code || '';
    const { to, remarks, password } = transitionSchema.parse(req.body);

    const allowedFrom = TEMPLATE_TRANSITIONS[(tpl as any).status] || [];
    if (!allowedFrom.includes(to)) {
      throw new BadRequestError(`Cannot transition from ${(tpl as any).status} to ${to}.`);
    }
    if (!(TEMPLATE_TRANSITION_ROLES[to] || []).includes(rc)) {
      throw new ForbiddenError(`Not permitted to move this template to ${to}.`);
    }

    if (to === 'PUBLISHED') {
      await enforceEsignature(user, ESIGN_FLAGS.QA_CERTIFY_AUTH, password);
    } else if (to === 'REWORK') {
      await enforceEsignature(user, ESIGN_FLAGS.QA_REJECT_AUTH, password);
    }

    // §5.5: self-approval is blocked on BOTH PUBLISHED and REWORK — a creator
    // sending their own submission into rework defeats the two-person approval
    // gate just as much as self-publishing would. Legacy Node only checked this
    // for PUBLISHED.
    if ((to === 'PUBLISHED' || to === 'REWORK') && (tpl as any).createdById && String((tpl as any).createdById) === String(user.id)) {
      throw new BadRequestError(`You cannot move a template you created to ${to}.`);
    }

    if (['PENDING_APPROVAL', 'PUBLISHED'].includes(to)) {
      await assertTemplateSectionsValid(tpl.id);
    }

    const updates: any = { status: to };
    if (remarks) updates.reviewRemarks = remarks;

    if (to === 'PUBLISHED') {
      updates.approvedBy = user.username;
      updates.approvedOn = new Date().toISOString().split('T')[0];
      if (!(tpl as any).version) updates.version = 1;
      const fam = (tpl as any).familyId || tpl.id;
      await (ArdTemplate as any).update(
        { status: 'SUPERSEDED' },
        { where: { familyId: fam, status: 'PUBLISHED', id: { [Op.ne]: tpl.id } } },
      );
    }

    // Pure status changes — §4 explicitly excludes every transition from
    // re-triggering the snapshot; content persistence stays decoupled from approval.
    await (tpl as any).update(updates);
    await auditLog(tpl.id, `Status → ${to}`, user.id, `v${(tpl as any).version} - ${(tpl as any).name}`);

    // §3.3: notification on submit-for-approval. This codebase's ARD notification
    // feed (ardNotifications.routes.ts buildItems()) is pull-based — it already
    // queries `ArdTemplate.findAll({ where: { status: 'PENDING_APPROVAL' } })` on
    // every GET /api/ard/notifications call for HOD/Admin users, so a template
    // reaching PENDING_APPROVAL is automatically surfaced with no extra push call
    // needed here. No other transition notifies, matching legacy's own asymmetry.

    res.json(successResponse('Template updated', tpl));
  } catch (err) {
    next(err);
  }
});

// POST /:templateId/clone — mirrors Python's clone_template (templates.py:240-257).
ardTemplateRouter.post('/:templateId/clone', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    requireCreateRole((req as any).user);
    const source = await findTemplate(req.params.templateId as string);
    assertSameDept((source as any).deptId, (req as any).user);
    const user = (req as any).user;

    const clone = await (ArdTemplate as any).create({
      name: `${(source as any).name} (Copy)`,
      code: null, // §5.3: code is not propagated automatically — cloning is a distinct record and must get its own code
      templateType: (source as any).templateType,
      description: (source as any).description,
      deptId: (source as any).deptId,
      sections: [],
      createdById: user.id,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    }, { transaction: t });
    await (clone as any).update({ familyId: clone.id }, { transaction: t });

    // §4: clone copies from the SOURCE's own already-snapshotted rows, not the
    // live master sections — a clone of an old version reproduces exactly what
    // that version looked like, unaffected by later master-section edits.
    await copyTemplateSectionAttachments(source.id, clone.id, t);
    await copySnapshotFromSource(source.id, clone.id, t);

    await auditLog(clone.id, 'Cloned', user.id, clone.name);
    await t.commit();

    res.status(201).json(successResponse('Template cloned', clone));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// POST /:templateId/new-version — mirrors Python's new_version (templates.py:274-292).
ardTemplateRouter.post('/:templateId/new-version', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    requireCreateRole((req as any).user);
    const source = await findTemplate(req.params.templateId as string);
    assertSameDept((source as any).deptId, (req as any).user);
    const user = (req as any).user;
    if ((source as any).status !== 'PUBLISHED') {
      throw new BadRequestError('Only a published template can start a new version.');
    }

    const nv = await (ArdTemplate as any).create({
      name: (source as any).name,
      code: (source as any).code, // §5.3: code DOES propagate here — it's the same logical template, next version
      templateType: (source as any).templateType,
      description: (source as any).description,
      deptId: (source as any).deptId,
      sections: [],
      familyId: (source as any).familyId || source.id,
      version: ((source as any).version || 1) + 1,
      status: 'DRAFT',
      createdById: user.id,
      lastUpdatedBy: user.username,
      lastUpdatedById: user.id,
    }, { transaction: t });

    // §4: new-version starts from a fresh copy of the source's attachment list,
    // then RE-snapshots from the live master sections (unlike clone, which freezes
    // an exact historical replica) — a new DRAFT version is meant to pick up
    // current master-data content as its starting point.
    await copyTemplateSectionAttachments(source.id, nv.id, t);
    await snapshotTemplateSections(nv.id, t);

    await auditLog(nv.id, `New Version Created (v${(nv as any).version})`, user.id, nv.name);
    await t.commit();

    res.status(201).json(successResponse('New version created', nv));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

export default ardTemplateRouter;
