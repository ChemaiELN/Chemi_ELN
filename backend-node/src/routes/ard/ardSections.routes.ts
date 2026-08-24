import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { Op } from 'sequelize';
import { authenticate } from '../../middleware/auth.middleware';
import { requireArdDeptMember, assertSameDept } from '../../shared/ardDepartmentAccess';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
import {
  ArdSection, ArdSectionRichtext, ArdSectionDatatable, ArdSectionEmbeddedFile,
  ArdSectionDataItem, ArdDatatableColumn, ArdDataItem, ArdTemplateSection, ArdAuditLog,
} from '../../models/index';
import {
  SECTION_TYPES, normalizeSectionType, RICHTEXT_TYPES, DATATABLE_TYPES, EMBEDDED_FILE_TYPES,
  SINGLE_DATA_ITEM_TYPES, MULTI_DATA_ITEM_TYPES,
} from '../../constants/ardSectionTypes';

// New master Sections router (rearchitecture prompt §3.1). Sections are reusable
// master data — a section created here is selectable/attachable from more than one
// template via ard_template_sections (§1.6), never owned 1:1 by a template.
const ardSectionRouter = Router();
ardSectionRouter.use(authenticate, requireArdDeptMember);

async function auditLog(entityId: string, action: string, userId: string | null, detail?: string | null) {
  await (ArdAuditLog as any).create({ entityType: 'SECTION', entityId, action, userId, detail: detail ?? null });
}

const MAX_DATATABLE_COLUMNS = 10;
const MAX_COLUMN_WIDTH_SUM = 100;

const columnSchema = z.object({
  dataItemId: z.string().uuid(),
  sequenceNumber: z.number().int().min(0).optional(),
  relativeWidth: z.number().positive(),
  isMandatory: z.boolean().optional(),
});

const dataItemLinkSchema = z.object({
  dataItemId: z.string().uuid(),
  sequenceNumber: z.number().int().min(0).optional(),
  isMandatory: z.boolean().optional(),
});

const saveSectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  uniqueIdentifier: z.string().optional().nullable(),
  sectionType: z.string().min(1),
  deptId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
  richtext: z.object({
    editorHeight: z.number().int().optional().nullable(),
    editorWidth: z.number().int().optional().nullable(),
    defaultContent: z.string().optional().nullable(),
  }).optional(),
  datatable: z.object({
    name: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    typicalRowCount: z.number().int().positive().optional(),
    columns: z.array(columnSchema).optional(),
  }).optional(),
  dataItemLink: dataItemLinkSchema.optional(),
  dataItemLinks: z.array(dataItemLinkSchema).optional(),
});

function validateDatatableColumns(columns: { relativeWidth: number }[] | undefined) {
  if (!columns || !columns.length) return;
  if (columns.length > MAX_DATATABLE_COLUMNS) {
    throw new BadRequestError(`A data table can have at most ${MAX_DATATABLE_COLUMNS} active columns.`);
  }
  const sum = columns.reduce((acc, c) => acc + Number(c.relativeWidth || 0), 0);
  if (sum > MAX_COLUMN_WIDTH_SUM) {
    throw new BadRequestError(`Column widths must sum to at most ${MAX_COLUMN_WIDTH_SUM} (currently ${sum}).`);
  }
}

async function assertNoDuplicate(name: string, uniqueIdentifier: string | null, excludeId?: string) {
  const where: any = { name, isActive: true };
  where[Op.and] = [
    uniqueIdentifier ? { uniqueIdentifier } : { [Op.or]: [{ uniqueIdentifier: null }, { uniqueIdentifier: '' }] },
  ];
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const duplicate = await (ArdSection as any).findOne({ where });
  if (duplicate) {
    throw new ConflictError(`A section named "${name}"${uniqueIdentifier ? ` (${uniqueIdentifier})` : ''} already exists.`);
  }
}

function sectionSummaryOut(s: any) {
  return {
    id: s.id, name: s.name, description: s.description, uniqueIdentifier: s.uniqueIdentifier,
    sectionType: s.sectionType, deptId: s.deptId, active: s.isActive,
    createdById: s.createdById, createdAt: s.createdAt,
    lastUpdatedById: s.lastUpdatedById, updatedAt: s.updatedAt,
  };
}

async function loadDetail(section: any) {
  const stype = normalizeSectionType(section.sectionType);
  const out: any = sectionSummaryOut(section);

  if (RICHTEXT_TYPES.has(stype)) {
    const rt = await (ArdSectionRichtext as any).findByPk(section.id);
    out.richtext = rt ? { editorHeight: rt.editorHeight, editorWidth: rt.editorWidth, defaultContent: rt.defaultContent } : null;
  }
  if (DATATABLE_TYPES.has(stype)) {
    const dt = await (ArdSectionDatatable as any).findOne({ where: { sectionId: section.id } });
    if (dt) {
      const columns = await (ArdDatatableColumn as any).findAll({
        where: { datatableId: dt.id, isActive: true },
        include: [{ model: ArdDataItem, as: 'dataItem' }],
        order: [['sequenceNumber', 'ASC']],
      });
      out.datatable = {
        id: dt.id, name: dt.name, description: dt.description, typicalRowCount: dt.typicalRowCount,
        columns: columns.map((c: any) => ({
          id: c.id, dataItemId: c.dataItemId, dataItemName: c.dataItem?.name,
          sequenceNumber: c.sequenceNumber, relativeWidth: Number(c.relativeWidth), isMandatory: c.isMandatory,
        })),
      };
    } else {
      out.datatable = null;
    }
  }
  if (EMBEDDED_FILE_TYPES.has(stype)) {
    const ef = await (ArdSectionEmbeddedFile as any).findByPk(section.id);
    out.embeddedFile = ef ? {
      fileName: ef.fileName, mappingFileName: ef.mappingFileName, hasFile: !!ef.fileData, hasMappingFile: !!ef.mappingFileData,
    } : null;
  }
  if (SINGLE_DATA_ITEM_TYPES.has(stype) || MULTI_DATA_ITEM_TYPES.has(stype)) {
    const links = await (ArdSectionDataItem as any).findAll({
      where: { sectionId: section.id, isActive: true },
      include: [{ model: ArdDataItem, as: 'dataItem' }],
      order: [['sequenceNumber', 'ASC']],
    });
    out.dataItemLinks = links.map((l: any) => ({
      id: l.id, dataItemId: l.dataItemId, dataItemName: l.dataItem?.name, dataItemType: l.dataItem?.dataType,
      sequenceNumber: l.sequenceNumber, isMandatory: l.isMandatory,
    }));
  }
  return out;
}

// GET / — list master sections; filter deptId, sectionType, q
ardSectionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deptId, sectionType, is_active, q } = req.query as Record<string, string>;
    const where: any = {};
    if (deptId) where.deptId = deptId;
    if (sectionType) where.sectionType = normalizeSectionType(sectionType);
    if (is_active !== undefined) where.isActive = is_active === 'true';
    if (q) where.name = { [Op.iLike]: `%${q}%` };

    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 200);
    const { count, rows } = await (ArdSection as any).findAndCountAll({
      where, order: [['name', 'ASC']], offset, limit,
    });
    res.json(listResponse('Sections', rows.map(sectionSummaryOut), buildPagination(page, limit, count)));
  } catch (err) { next(err); }
});

// GET /section-types — same catalog templates use, so the builder can pick from it.
ardSectionRouter.get('/section-types', (_req: Request, res: Response) => {
  res.json(SECTION_TYPES);
});

// GET /:id — full section incl. type-specific detail
ardSectionRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await (ArdSection as any).findByPk(req.params.id);
    if (!section) throw new NotFoundError('Section not found');
    assertSameDept(section.deptId, (req as any).user);
    res.json(successResponse('Section', await loadDetail(section)));
  } catch (err) { next(err); }
});

// GET /:id/events — audit trail for this section
ardSectionRouter.get('/:id/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdAuditLog as any).findAll({
      where: { entityType: 'SECTION', entityId: req.params.id },
      order: [['createdAt', 'DESC']],
    });
    res.json(successResponse('Section audit trail', { items: rows }));
  } catch (err) { next(err); }
});

async function upsertDetail(section: any, body: z.infer<typeof saveSectionSchema>, userId: string | null, t: any) {
  const stype = normalizeSectionType(body.sectionType);

  if (RICHTEXT_TYPES.has(stype) && body.richtext) {
    const [rt] = await (ArdSectionRichtext as any).findOrCreate({
      where: { sectionId: section.id }, defaults: { sectionId: section.id }, transaction: t,
    });
    await rt.update({
      editorHeight: body.richtext.editorHeight ?? null,
      editorWidth: body.richtext.editorWidth ?? null,
      defaultContent: body.richtext.defaultContent ?? null,
    }, { transaction: t });
  }

  if (DATATABLE_TYPES.has(stype) && body.datatable) {
    validateDatatableColumns(body.datatable.columns);
    let dt = await (ArdSectionDatatable as any).findOne({ where: { sectionId: section.id }, transaction: t });
    if (!dt) {
      dt = await (ArdSectionDatatable as any).create({ sectionId: section.id, name: body.datatable.name ?? null, description: body.datatable.description ?? null, typicalRowCount: body.datatable.typicalRowCount ?? 3 }, { transaction: t });
    } else {
      await dt.update({ name: body.datatable.name ?? null, description: body.datatable.description ?? null, typicalRowCount: body.datatable.typicalRowCount ?? dt.typicalRowCount }, { transaction: t });
    }

    const incomingColumns = body.datatable.columns ?? [];
    const existing = await (ArdDatatableColumn as any).findAll({ where: { datatableId: dt.id }, transaction: t });
    const keepIds = new Set<string>();
    for (let i = 0; i < incomingColumns.length; i++) {
      const c = incomingColumns[i];
      const match = existing.find((e: any) => e.dataItemId === c.dataItemId);
      if (match) {
        await match.update({ sequenceNumber: i, relativeWidth: c.relativeWidth, isMandatory: c.isMandatory ?? false, isActive: true }, { transaction: t });
        keepIds.add(match.id);
      } else {
        const created = await (ArdDatatableColumn as any).create({
          datatableId: dt.id, dataItemId: c.dataItemId, sequenceNumber: i,
          relativeWidth: c.relativeWidth, isMandatory: c.isMandatory ?? false, isActive: true,
        }, { transaction: t });
        keepIds.add(created.id);
      }
    }
    // Soft-remove anything dropped rather than deleting (§3.1).
    for (const e of existing) {
      if (!keepIds.has(e.id) && e.isActive) await e.update({ isActive: false }, { transaction: t });
    }
  }

  if (SINGLE_DATA_ITEM_TYPES.has(stype)) {
    if (!body.dataItemLink?.dataItemId) {
      throw new BadRequestError(`Section type "${stype}" requires a linked data item.`);
    }
    const existing = await (ArdSectionDataItem as any).findAll({ where: { sectionId: section.id }, transaction: t });
    const match = existing.find((e: any) => e.dataItemId === body.dataItemLink!.dataItemId);
    if (match) {
      await match.update({ sequenceNumber: 0, isMandatory: body.dataItemLink.isMandatory ?? false, isActive: true }, { transaction: t });
    } else {
      await (ArdSectionDataItem as any).create({
        sectionId: section.id, dataItemId: body.dataItemLink.dataItemId,
        sequenceNumber: 0, isMandatory: body.dataItemLink.isMandatory ?? false, isActive: true,
      }, { transaction: t });
    }
    for (const e of existing) {
      if (e.dataItemId !== body.dataItemLink.dataItemId && e.isActive) await e.update({ isActive: false }, { transaction: t });
    }
  }

  if (MULTI_DATA_ITEM_TYPES.has(stype) && body.dataItemLinks) {
    const existing = await (ArdSectionDataItem as any).findAll({ where: { sectionId: section.id }, transaction: t });
    const keepIds = new Set<string>();
    for (let i = 0; i < body.dataItemLinks.length; i++) {
      const l = body.dataItemLinks[i];
      const match = existing.find((e: any) => e.dataItemId === l.dataItemId);
      if (match) {
        await match.update({ sequenceNumber: i, isMandatory: l.isMandatory ?? false, isActive: true }, { transaction: t });
        keepIds.add(match.id);
      } else {
        const created = await (ArdSectionDataItem as any).create({
          sectionId: section.id, dataItemId: l.dataItemId, sequenceNumber: i, isMandatory: l.isMandatory ?? false, isActive: true,
        }, { transaction: t });
        keepIds.add(created.id);
      }
    }
    for (const e of existing) {
      if (!keepIds.has(e.id) && e.isActive) await e.update({ isActive: false }, { transaction: t });
    }
  }
}

// POST / — create
ardSectionRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    const body = saveSectionSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    const stype = normalizeSectionType(body.sectionType);
    if (!SECTION_TYPES.some((s) => s.type === stype)) {
      throw new BadRequestError(`Unknown section type "${body.sectionType}".`);
    }

    await assertNoDuplicate(body.name, body.uniqueIdentifier ?? null);

    const section = await (ArdSection as any).create({
      name: body.name,
      description: body.description ?? null,
      uniqueIdentifier: body.uniqueIdentifier ?? null,
      sectionType: stype,
      deptId: body.deptId ?? null,
      isActive: body.active ?? true,
      createdById: userId,
    }, { transaction: t });

    await upsertDetail(section, body, userId, t);
    await auditLog(section.id, 'Created', userId, section.name);
    await t.commit();

    const fresh = await (ArdSection as any).findByPk(section.id);
    res.status(201).json(successResponse('Section created', await loadDetail(fresh)));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// PUT /:id — update
ardSectionRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const t = await sequelize.transaction();
  try {
    const section = await (ArdSection as any).findByPk(req.params.id, { transaction: t });
    if (!section) throw new NotFoundError('Section not found');
    assertSameDept(section.deptId, (req as any).user);
    const body = saveSectionSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    const stype = normalizeSectionType(body.sectionType);
    if (!SECTION_TYPES.some((s) => s.type === stype)) {
      throw new BadRequestError(`Unknown section type "${body.sectionType}".`);
    }

    await assertNoDuplicate(body.name, body.uniqueIdentifier ?? null, section.id);

    await section.update({
      name: body.name,
      description: body.description ?? null,
      uniqueIdentifier: body.uniqueIdentifier ?? null,
      sectionType: stype,
      deptId: body.deptId ?? null,
      isActive: body.active ?? section.isActive,
      lastUpdatedById: userId,
      updatedAt: new Date(),
    }, { transaction: t });

    await upsertDetail(section, body, userId, t);
    await auditLog(section.id, 'Updated', userId, section.name);
    await t.commit();

    const fresh = await (ArdSection as any).findByPk(section.id);
    res.json(successResponse('Section updated', await loadDetail(fresh)));
  } catch (err) {
    await t.rollback();
    next(err);
  }
});

// DELETE /:id — soft delete of the master section only. Does NOT cascade to
// ard_template_sections — a section removed this way stays silently attached to
// templates that already reference it; it just stops being offered for new
// attachments (matches the legacy system's actual behavior — §3.1).
ardSectionRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = await (ArdSection as any).findByPk(req.params.id);
    if (!section) throw new NotFoundError('Section not found');
    assertSameDept(section.deptId, (req as any).user);
    const userId = (req as any).user?.id ?? null;
    const activeAttachments = await (ArdTemplateSection as any).count({ where: { sectionId: section.id, isActive: true } });

    await section.update({ isActive: false, lastUpdatedById: userId, updatedAt: new Date() });
    await auditLog(
      section.id, 'Deactivated', userId,
      activeAttachments ? `${section.name} (still attached to ${activeAttachments} template version(s))` : section.name,
    );
    res.status(204).send();
  } catch (err) { next(err); }
});

// ── Embedded file upload (preconfigured_excel sections) ─────────────────────────
// §1.4: real server-side upload validation — actual extension AND magic-byte content
// sniffing, not the client-reported MIME string alone (spoofable), plus a concrete
// max size enforced here rather than relying on generic body-size-limit middleware.
const MAX_EMBEDDED_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls']);

// .xlsx is a ZIP archive (PK.. local-file-header or empty-archive signature).
// .xls (legacy binary) is an OLE2 compound file.
function sniffSpreadsheetSignature(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
  const isOle2 = buf.length >= 8
    && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0
    && buf[4] === 0xa1 && buf[5] === 0xb1 && buf[6] === 0x1a && buf[7] === 0xe1;
  return isZip || isOle2;
}

function validateSpreadsheetUpload(file: Express.Multer.File | undefined, label: string) {
  if (!file) return;
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_SPREADSHEET_EXTENSIONS.has(ext)) {
    throw new BadRequestError(`${label}: only .xlsx or .xls files are allowed.`, 'INVALID_FILE_TYPE');
  }
  if (file.size > MAX_EMBEDDED_FILE_BYTES) {
    throw new BadRequestError(`${label}: file exceeds the 10 MB limit.`, 'FILE_TOO_LARGE');
  }
  if (!sniffSpreadsheetSignature(file.buffer)) {
    throw new BadRequestError(`${label}: file content does not match a valid spreadsheet (extension/content mismatch).`, 'INVALID_FILE_CONTENT');
  }
}

const embeddedFileUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EMBEDDED_FILE_BYTES },
});

// POST /:id/embedded-file — upload the preconfigured spreadsheet (and optional CDS
// mapping file) for a `preconfigured_excel` section. Bytes are stored in the DB
// (ard_section_embedded_file), matching §1.4 — not on disk like ArdAttachment.
ardSectionRouter.post(
  '/:id/embedded-file',
  authenticate,
  embeddedFileUploader.fields([{ name: 'file', maxCount: 1 }, { name: 'mappingFile', maxCount: 1 }]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const section = await (ArdSection as any).findByPk(req.params.id);
      if (!section) throw new NotFoundError('Section not found');
      assertSameDept(section.deptId, (req as any).user);
      const stype = normalizeSectionType(section.sectionType);
      if (!EMBEDDED_FILE_TYPES.has(stype)) {
        throw new BadRequestError(`Section type "${stype}" does not accept an embedded file.`);
      }

      const files = req.files as { file?: Express.Multer.File[]; mappingFile?: Express.Multer.File[] } | undefined;
      const file = files?.file?.[0];
      const mappingFile = files?.mappingFile?.[0];
      if (!file) throw new BadRequestError('No file uploaded.');
      validateSpreadsheetUpload(file, 'Spreadsheet');
      validateSpreadsheetUpload(mappingFile, 'Mapping file');

      const userId = (req as any).user?.id ?? null;
      const [ef] = await (ArdSectionEmbeddedFile as any).findOrCreate({
        where: { sectionId: section.id }, defaults: { sectionId: section.id },
      });
      await ef.update({
        fileName: file.originalname,
        fileData: file.buffer,
        ...(mappingFile ? { mappingFileName: mappingFile.originalname, mappingFileData: mappingFile.buffer } : {}),
      });
      await auditLog(section.id, 'Embedded file uploaded', userId, `${file.originalname}${mappingFile ? ` + ${mappingFile.originalname}` : ''}`);

      res.json(successResponse('Embedded file uploaded', {
        fileName: ef.fileName, mappingFileName: ef.mappingFileName, hasFile: true, hasMappingFile: !!ef.mappingFileData,
      }));
    } catch (err) { next(err); }
  },
);

export default ardSectionRouter;
