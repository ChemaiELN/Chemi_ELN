import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../../middleware/auth.middleware';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, ConflictError, AppError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
import { createUploader } from '../../middleware/upload.middleware';
import {
  ArdTechnique,
  ArdTestConfiguration,
  ArdTestGroup,
  ArdTestGroupMember,
  ArdFormType,
  ArdSetting,
  ArdAnalystQualification,
  ArdTeam,
  ArdNotificationRead,
  ArdAuditLog,
  ArdContentBlock,
  ArdQualificationAlert,
  ArdAttribute,
  ArdDataItem,
  MasterDataItem,
  Department,
  User,
} from '../../models/index';

// ─────────────────────────────────────────────────────────────────────────────
// Shared output mappers
// ─────────────────────────────────────────────────────────────────────────────
// The wire shape for every master-data entity, ported from the _*_out() helpers in
// backend/app/modules/ard/master_data.py. Used by both the root bundle and the
// individual sub-routers so a record looks identical wherever it is served.
// Note `active` (not isActive) and audit users resolved to usernames.

const iso = (d: unknown): string | null => (d ? new Date(d as Date).toISOString() : null);

// ARD lookups live in the shared master_data_items table, namespaced by prefix so they
// never collide with Inventory/Admin categories (ard_lookup_categories.py:41).
const LOOKUP_STORAGE_PREFIX = 'ARD:';
const stripLookupPrefix = (stored: string) =>
  stored.startsWith(LOOKUP_STORAGE_PREFIX) ? stored.slice(LOOKUP_STORAGE_PREFIX.length) : stored;

const LOOKUP_LEGACY_ALIASES: Record<string, string> = {
  StorageCondition: 'Storage Condition',
  SampleType: 'Sample Type',
  TemplateType: 'Template Type',
  ChromatographyTechnique: 'Chromatography Technique',
  SampleIntegrity: 'Sample Integrity',
  AttachmentType: 'Attachment Type',
  SpecificationType: 'Specification Type',
  SpecType: 'Specification Type',
  ChemicalGrade: 'Chemical Grade',
  WeighingUnit: 'Weighing Unit',
  ResultDataType: 'Result Data Type',
  ReportType: 'Report Type',
  FormCategory: 'Form Category',
  SchemeMode: 'Scheme Mode',
  PackType: 'Pack Type',
  DosageForm: 'Dosage Form',
  SamplingStage: 'Sampling Stage',
};

function normalizeLookupCategory(category: string): string {
  return LOOKUP_LEGACY_ALIASES[category] || category;
}

function toStorageCategory(category: string): string {
  return LOOKUP_STORAGE_PREFIX + normalizeLookupCategory(category);
}

/** Resolve created_by/updated_by uuids to usernames in one query (master_data.py:66-72). */
async function buildUserNameMap(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (unique.length === 0) return new Map();
  const users = await (User as any).findAll({ where: { id: { [Op.in]: unique } }, attributes: ['id', 'username'] });
  return new Map(users.map((u: any) => [String(u.id), u.username as string]));
}

/** Convenience for the sub-routers: build the name map for exactly these rows. */
async function auditNamesFor(rows: any[]): Promise<Map<string, string>> {
  return buildUserNameMap(rows.flatMap((r: any) => [r?.createdBy, r?.updatedBy]));
}

function auditOf(row: any, names: Map<string, string>) {
  const createdBy = row.createdBy ? (names.get(String(row.createdBy)) ?? String(row.createdBy)) : null;
  const updatedBy = row.updatedBy ? (names.get(String(row.updatedBy)) ?? String(row.updatedBy)) : null;
  return {
    createdBy,
    createdAt: iso(row.createdAt),
    updatedBy: updatedBy ?? createdBy,
    updatedAt: iso(row.updatedAt) ?? iso(row.createdAt),
  };
}

// Settings store every value as text plus a value_type discriminator
// (master_data.py:520-529).
function coerceSettingValue(row: any): unknown {
  const raw = String(row.value ?? '');
  if (row.valueType === 'boolean') return ['true', '1', 'yes'].includes(raw.trim().toLowerCase());
  if (row.valueType === 'number') {
    const n = raw.includes('.') ? parseFloat(raw) : parseInt(raw, 10);
    return Number.isNaN(n) ? raw : n;
  }
  return raw;
}

const techniqueOut = (t: any, names: Map<string, string>) => ({
  id: t.id, code: t.code, name: t.name, active: t.isActive, ...auditOf(t, names),
});

const testConfigOut = (c: any, names: Map<string, string>) => ({
  id: c.id, code: c.configCode, analysisCode: c.analysisTechnicalCode,
  techniqueCode: c.techniqueCode, techniqueName: c.techniqueName,
  testType: c.testType, testSubtype: c.testSubtype,
  methodReference: c.methodReference,
  active: c.isActive, resultParams: c.resultParams || [], ...auditOf(c, names),
});

const testGroupOut = (g: any, names: Map<string, string>) => ({
  id: g.id, name: g.name, description: g.description, active: g.isActive,
  testConfigIds: ((g.members as any[]) || []).map((m: any) => m.testConfigId),
  // Membership rows, so the frontend can resolve/edit per-group Specification
  // overrides keyed by resultParam id without touching shared Test Config data.
  members: ((g.members as any[]) || []).map((m: any) => ({
    id: m.id, testConfigId: m.testConfigId, specOverrides: m.specOverrides || {},
  })),
  ...auditOf(g, names),
});

const attributeOut = (a: any, names: Map<string, string>) => ({
  id: a.id, name: a.name, label: a.label, type: a.fieldType,
  required: a.required, maxLength: a.maxLength, options: a.options,
  active: a.isActive, ...auditOf(a, names),
});

const formTypeOut = (f: any, names: Map<string, string>) => ({
  id: f.id, code: f.code, name: f.name, description: f.description,
  category: f.category,
  attributeLinks: f.attributeLinks || [], testGroupIds: f.testGroupIds || [],
  mandateCertification: f.mandateCertification, mandateBatchNo: f.mandateBatchNo,
  mandateSampleQty: f.mandateSampleQty, mandateQaSubmission: f.mandateQaSubmission,
  allowPostApprovalChanges: Boolean(f.allowPostApprovalChanges),
  active: f.isActive, ...auditOf(f, names),
});

const settingOut = (s2: any) => ({
  id: s2.id, key: s2.key, label: s2.label, category: s2.category,
  value: coerceSettingValue(s2), valueType: s2.valueType, description: s2.description,
});

const qualificationOut = (q: any, names: Map<string, string>, analystNames: Map<string, string>) => ({
  id: q.id, userId: q.userId,
  analystName: analystNames.get(String(q.userId)) ?? String(q.userId),
  techniqueEntries: q.techniqueEntries || [],
  validTill: q.validTill, remarks: q.remarks,
  approvalStatus: q.approvalStatus, approvedBy: q.approvedBy,
  approvedAt: iso(q.approvedAt),
  ...auditOf(q, names),
});

const alertOut = (a: any) => ({
  id: a.id, name: a.name, daysBeforeExpiry: a.daysBeforeExpiry, active: a.isActive,
});

const dataItemOut = (d: any, names: Map<string, string>) => ({
  id: d.id, name: d.name, dataType: d.dataType, lengthCategory: d.lengthCategory,
  lovLookupType: d.lovLookupType,
  description: d.description, active: d.isActive, ...auditOf(d, names),
});

const contentBlockOut = (b: any, names: Map<string, string>) => ({
  id: b.id, name: b.name, contentType: b.contentType,
  body: b.body, displayHeight: b.displayHeight || 250,
  active: b.isActive, ...auditOf(b, names),
});

const lookupOut = (m: any, names: Map<string, string> = new Map()) => ({
  id: m.id, category: stripLookupPrefix(m.category ?? ''), code: m.code,
  label: m.name, description: m.description ?? null,
  active: m.isActive ?? true, ...auditOf(m, names),
});

// ─────────────────────────────────────────────────────────────────────────────
// techniqueRouter
// ─────────────────────────────────────────────────────────────────────────────

export const techniqueRouter = Router();

const saveTechniqueSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().optional().default(''),
  code: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

techniqueRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    const rows = await (ArdTechnique as any).findAll({ where, order: [['name', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Techniques', { items: rows.map((t: any) => techniqueOut(t, names)), total: rows.length }));
  } catch (err) { next(err); }
});

techniqueRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTechnique as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Technique not found');
    res.json(successResponse('Technique', techniqueOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

// POST upsert — Python save_technique (master_data.py:91-120)
techniqueRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveTechniqueSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    const code = body.code.trim();
    if (!code) throw new BadRequestError('Technique code is required.');

    // Technique name (code) must be unique. A duplicate name must be
    // rejected, never silently merged into the existing record.
    const duplicate = await (ArdTechnique as any).findOne({ where: { code } });

    if (body.id) {
      const row = await (ArdTechnique as any).findByPk(body.id);
      if (!row) throw new NotFoundError('Technique not found');
      if (duplicate && duplicate.id !== row.id) {
        throw new ConflictError(`A technique named "${code}" already exists.`);
      }
      if (row.code !== code) {
        await (ArdTestConfiguration as any).update(
          { techniqueCode: code, techniqueName: body.name },
          { where: { techniqueCode: row.code } },
        );
      }
      await row.update({
        code,
        name: body.name,
        isActive: body.active ?? row.isActive,
        updatedBy: userId,
        updatedAt: new Date(),
        createdBy: row.createdBy || userId,
      });
      await row.reload();
      return res.json(successResponse('Technique updated', techniqueOut(row, await auditNamesFor([row]))));
    }

    if (duplicate) {
      throw new ConflictError(`A technique named "${code}" already exists.`);
    }
    const row = await (ArdTechnique as any).create({
      code, name: body.name, isActive: body.active ?? true, createdBy: userId,
    });
    await row.reload();
    res.status(201).json(successResponse('Technique created', techniqueOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

techniqueRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTechnique as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Technique not found');
    const body = saveTechniqueSchema.partial().parse(req.body);
    if (body.code) {
      const duplicate = await (ArdTechnique as any).findOne({ where: { code: body.code.trim() } });
      if (duplicate && duplicate.id !== row.id) {
        throw new ConflictError(`A technique named "${body.code.trim()}" already exists.`);
      }
    }
    const userId = (req as any).user?.id ?? null;
    await (row as any).update({
      ...body,
      updatedBy: userId,
      updatedAt: new Date(),
      createdBy: row.createdBy || userId,
    });
    await row.reload();
    res.json(successResponse('Technique updated', techniqueOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

techniqueRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTechnique as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Technique not found');
    await (row as any).update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// testConfigRouter
// ─────────────────────────────────────────────────────────────────────────────

export const testConfigRouter = Router();
const memUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Wire contract matches Python TestConfigIn (master_data.py). The old Angular
// aliases (name / technique_key / parameters) stay accepted so leftover clients
// do not break, but they are not required.
const saveTestConfigSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().optional().nullable(),
  analysisCode: z.string().optional().nullable(),
  techniqueId: z.string().uuid().optional(),
  techniqueCode: z.string().optional(),
  techniqueName: z.string().optional(),
  testType: z.string().min(1).optional(),
  testSubtype: z.string().optional().nullable(),
  methodReference: z.string().optional().nullable(),
  active: z.boolean().optional(),
  resultParams: z.any().optional(),
  // legacy Angular aliases
  name: z.string().optional(),
  technique_id: z.string().optional(),
  technique_key: z.string().optional(),
  technique_name: z.string().optional(),
  description: z.string().optional(),
  parameters: z.any().optional(),
}).refine((d) => !!(d.testType || d.name), {
  message: 'testType is required',
  path: ['testType'],
});

async function resolveTechnique(body: z.infer<typeof saveTestConfigSchema>) {
  let techniqueCode = body.techniqueCode || body.technique_key || '';
  let techniqueName = body.techniqueName || body.technique_name || '';
  const techniqueId = body.techniqueId || body.technique_id;
  if (techniqueId) {
    const technique = await (ArdTechnique as any).findByPk(techniqueId);
    if (!technique) throw new BadRequestError('Unknown technique.');
    techniqueCode = technique.code;
    techniqueName = techniqueName || technique.name;
  }
  if (!techniqueCode) throw new BadRequestError('A technique is required.');
  return { techniqueCode, techniqueName: techniqueName || techniqueCode };
}

async function upsertTestConfig(body: z.infer<typeof saveTestConfigSchema>, userId?: string) {
  const { techniqueCode, techniqueName } = await resolveTechnique(body);
  const testType = (body.testType || body.name || '').trim();
  const testSubtype = (body.testSubtype ?? '').trim() || null;
  const resultParams = body.resultParams ?? body.parameters ?? [];

  let row = body.id ? await (ArdTestConfiguration as any).findByPk(body.id) : null;
  const isNew = !row;

  // Test Type + Test Subtype must be unique — never silently merge into an
  // existing config with the same combination.
  const dupWhere: any = { testType };
  dupWhere[Op.and] = [
    testSubtype
      ? { testSubtype }
      : { [Op.or]: [{ testSubtype: null }, { testSubtype: '' }] },
  ];
  const duplicate = await (ArdTestConfiguration as any).findOne({ where: dupWhere });
  if (duplicate && (!row || duplicate.id !== row.id)) {
    throw new ConflictError(
      `A test configuration for "${testType}${testSubtype ? ` / ${testSubtype}` : ''}" already exists.`
    );
  }
  if (!row) {
    row = await (ArdTestConfiguration as any).create({
      testType,
      testSubtype: body.testSubtype ?? null,
      techniqueCode,
      techniqueName,
      analysisTechnicalCode: body.analysisCode ?? null,
      methodReference: body.methodReference ?? body.description ?? null,
      resultParams,
      isActive: body.active ?? true,
      configCode: body.code ?? null,
      createdBy: userId ?? null,
    });
  } else {
    await row.update({
      testType,
      testSubtype: body.testSubtype ?? row.testSubtype,
      techniqueCode,
      techniqueName,
      analysisTechnicalCode: body.analysisCode ?? row.analysisTechnicalCode,
      methodReference: body.methodReference ?? body.description ?? row.methodReference,
      resultParams,
      isActive: body.active ?? row.isActive,
      updatedBy: userId ?? null,
      updatedAt: new Date(),
    });
  }
  await row.reload();
  if (!row.configCode) {
    const suffix = String(row.id).replace(/-/g, '').slice(-4);
    await row.update({ configCode: body.code || `TC-${suffix}` });
    await row.reload();
  }
  return { row, isNew };
}

testConfigRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, technique_key } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    if (technique_key) where.techniqueCode = technique_key;
    // ard_test_configurations has no `name`/`technique_id`/`description` columns — the
    // test identity is test_type (+ test_subtype) and the technique is linked by code.
    const rows = await (ArdTestConfiguration as any).findAll({ where, order: [['testType', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Test configurations', { items: rows.map((c: any) => testConfigOut(c, names)), total: rows.length }));
  } catch (err) { next(err); }
});

testConfigRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestConfiguration as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test configuration not found');
    res.json(successResponse('Test configuration', testConfigOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

testConfigRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveTestConfigSchema.parse(req.body);
    const { row, isNew } = await upsertTestConfig(body, (req as any).user?.id);
    const payload = testConfigOut(row, await auditNamesFor([row]));
    res.status(isNew ? 201 : 200).json(successResponse(isNew ? 'Test configuration created' : 'Test configuration updated', payload));
  } catch (err) { next(err); }
});

testConfigRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await (ArdTestConfiguration as any).findByPk(req.params.id);
    if (!existing) throw new NotFoundError('Test configuration not found');
    const body = saveTestConfigSchema.parse({
      testType: existing.testType,
      techniqueCode: existing.techniqueCode,
      techniqueName: existing.techniqueName,
      ...req.body,
      id: req.params.id,
    });
    const { row } = await upsertTestConfig(body, (req as any).user?.id);
    res.json(successResponse('Test configuration updated', testConfigOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

testConfigRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestConfiguration as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test configuration not found');
    await (row as any).update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// Minimal quoted-field-aware CSV line splitter — the expected file is simple
// (no embedded newlines inside fields), so a full CSV library is unnecessary.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

// POST /master-data/test-configs/import-csv — ported from Python's
// import_test_configs_csv (master_data.py:208-256). Expected columns:
// techniqueCode, techniqueName, testType, testSubtype (optional).
testConfigRouter.post('/import-csv', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new BadRequestError('No file uploaded.');
    const userId = (req as any).user?.id ?? null;
    const text = req.file.buffer.toString('utf-8').replace(/^﻿/, ''); // strip BOM
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      res.json(successResponse('Import complete', { created: 0, skipped: 0, errors: ['File has no data rows.'] }));
      return;
    }
    const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (...names: string[]) => names.map((n) => header.indexOf(n.toLowerCase())).find((i) => i >= 0) ?? -1;
    const colTechniqueCode = idx('techniqueCode', 'technique_code');
    const colTechniqueName = idx('techniqueName', 'technique_name');
    const colTestType = idx('testType', 'test_type');
    const colTestSubtype = idx('testSubtype', 'test_subtype');

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const cells = splitCsvLine(lines[i]);
      const techniqueCode = (colTechniqueCode >= 0 ? cells[colTechniqueCode] : '') || '';
      const techniqueName = (colTechniqueName >= 0 ? cells[colTechniqueName] : '') || '';
      const testType = (colTestType >= 0 ? cells[colTestType] : '') || '';
      const testSubtype = (colTestSubtype >= 0 ? cells[colTestSubtype] : '') || null;
      if (!techniqueCode || !testType) {
        errors.push(`Row ${rowNum}: techniqueCode and testType are required.`);
        continue;
      }
      const existing = await (ArdTestConfiguration as any).findOne({ where: { techniqueCode, testType } });
      if (existing) { skipped++; continue; }
      await upsertTestConfig({ techniqueCode, techniqueName: techniqueName || techniqueCode, testType, testSubtype } as any, userId);
      created++;
    }
    res.json(successResponse('Import complete', { created, skipped, errors }));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// testGroupRouter
// ─────────────────────────────────────────────────────────────────────────────

export const testGroupRouter = Router();

const saveTestGroupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
  testConfigIds: z.array(z.string().uuid()).optional(),
  test_config_ids: z.array(z.string().uuid()).optional(),
});

async function reloadTestGroup(id: string) {
  return (ArdTestGroup as any).findByPk(id, {
    include: [{ model: ArdTestGroupMember, as: 'members' }],
  });
}

// Diffs against the existing membership rather than destroy+recreate, so a
// member's specOverrides (a per-group Specification override, scoped to that
// membership row) survives edits that don't touch that particular test.
async function replaceGroupMembers(groupId: string, configIds: string[], transaction: any) {
  const existing = await (ArdTestGroupMember as any).findAll({ where: { testGroupId: groupId }, transaction });
  const existingIds = new Set(existing.map((m: any) => m.testConfigId));
  const nextIds = new Set(configIds);

  const toRemove = existing.filter((m: any) => !nextIds.has(m.testConfigId));
  if (toRemove.length) {
    await (ArdTestGroupMember as any).destroy({
      where: { id: { [Op.in]: toRemove.map((m: any) => m.id) } }, transaction,
    });
  }

  const toAdd = configIds.filter((id) => !existingIds.has(id));
  if (toAdd.length) {
    await (ArdTestGroupMember as any).bulkCreate(
      toAdd.map((id) => ({ testGroupId: groupId, testConfigId: id })),
      { transaction },
    );
  }
}

testGroupRouter.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdTestGroup as any).findAll({
      include: [{ model: ArdTestGroupMember, as: 'members' }],
      order: [['name', 'ASC']],
    });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Test groups', { items: rows.map((g: any) => testGroupOut(g, names)), total: rows.length }));
  } catch (err) { next(err); }
});

testGroupRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await reloadTestGroup(req.params.id as string);
    if (!row) throw new NotFoundError('Test group not found');
    res.json(successResponse('Test group', testGroupOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

// POST upsert — Python TestGroupIn (master_data.py:277-297)
testGroupRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveTestGroupSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    const configIds = body.testConfigIds ?? body.test_config_ids;

    const name = body.name.trim();
    const duplicate = await (ArdTestGroup as any).findOne({ where: { name } });
    if (duplicate && duplicate.id !== body.id) {
      throw new ConflictError(`A test group named "${name}" already exists.`);
    }

    const saved = await sequelize.transaction(async (t) => {
      let row = body.id ? await (ArdTestGroup as any).findByPk(body.id, { transaction: t }) : null;
      const isNew = !row;
      if (!row) {
        row = await (ArdTestGroup as any).create({
          name: body.name,
          description: body.description ?? null,
          isActive: body.active ?? true,
          createdBy: userId,
        }, { transaction: t });
      } else {
        await row.update({
          name: body.name,
          description: body.description ?? row.description,
          isActive: body.active ?? row.isActive,
          updatedBy: userId,
          updatedAt: new Date(),
          createdBy: row.createdBy || userId,
        }, { transaction: t });
      }
      if (configIds !== undefined) {
        await replaceGroupMembers(row.id, configIds, t);
      }
      return { id: row.id as string, isNew };
    });
    const row = await reloadTestGroup(saved.id);
    res.status(saved.isNew ? 201 : 200).json(successResponse(
      saved.isNew ? 'Test group created' : 'Test group updated',
      testGroupOut(row, await auditNamesFor([row])),
    ));
  } catch (err) { next(err); }
});

testGroupRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await (ArdTestGroup as any).findByPk(req.params.id);
    if (!existing) throw new NotFoundError('Test group not found');
    const body = saveTestGroupSchema.parse({
      name: existing.name,
      ...req.body,
      id: req.params.id,
    });
    const name = body.name.trim();
    const duplicate = await (ArdTestGroup as any).findOne({ where: { name } });
    if (duplicate && duplicate.id !== existing.id) {
      throw new ConflictError(`A test group named "${name}" already exists.`);
    }
    const userId = (req as any).user?.id ?? null;
    const configIds = body.testConfigIds ?? body.test_config_ids;
    await sequelize.transaction(async (t) => {
      await existing.update({
        name: body.name,
        description: body.description ?? existing.description,
        isActive: body.active ?? existing.isActive,
        updatedBy: userId,
        updatedAt: new Date(),
        createdBy: existing.createdBy || userId,
      }, { transaction: t });
      if (configIds !== undefined) {
        await replaceGroupMembers(existing.id, configIds, t);
      }
    });
    const row = await reloadTestGroup(req.params.id as string);
    res.json(successResponse('Test group updated', testGroupOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

testGroupRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestGroup as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test group not found');
    const t = await (ArdTestGroup as any).sequelize.transaction();
    try {
      await (ArdTestGroupMember as any).destroy({ where: { testGroupId: row.id }, transaction: t });
      await row.destroy({ transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
    res.status(204).send();
  } catch (err) { next(err); }
});

const saveSpecOverrideSchema = z.object({
  paramId: z.string().min(1),
  specification: z.string().optional().nullable(),
});

// PATCH /:groupId/members/:memberId/spec-override — sets a per-group
// override for one result parameter's Specification on a linked test. Scoped
// to this membership row only; the shared Test Configuration is untouched.
testGroupRouter.patch('/:groupId/members/:memberId/spec-override', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await (ArdTestGroupMember as any).findOne({
      where: { id: req.params.memberId, testGroupId: req.params.groupId },
    });
    if (!member) throw new NotFoundError('Test group member not found');
    const { paramId, specification } = saveSpecOverrideSchema.parse(req.body);

    const overrides = { ...(member.specOverrides || {}) };
    if (specification === undefined || specification === null || specification === '') {
      delete overrides[paramId];
    } else {
      overrides[paramId] = specification;
    }
    await member.update({ specOverrides: overrides });

    const group = await reloadTestGroup(req.params.groupId as string);
    res.json(successResponse('Specification override saved', testGroupOut(group, await auditNamesFor([group]))));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// attributeRouter — ported from Python's save_attribute (master_data.py:332-350).
// This router did not exist at all before; POST /attributes 404'd unconditionally.
// ─────────────────────────────────────────────────────────────────────────────

export const attributeRouter = Router();

const saveAttributeSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().optional(),
  maxLength: z.number().int().positive().optional().nullable(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional().nullable(),
  active: z.boolean().optional(),
});

// Mirrors Python's _camel_key(label) so a generated `name` stays consistent
// across both backends sharing the same DB.
function camelKey(label: string): string {
  const words = label.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'field';
  return words[0].toLowerCase() + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
}

attributeRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    const rows = await (ArdAttribute as any).findAll({ where, order: [['label', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Attributes', { items: rows.map((a: any) => attributeOut(a, names)), total: rows.length }));
  } catch (err) { next(err); }
});

attributeRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAttribute as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Attribute not found');
    res.json(successResponse('Attribute', attributeOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

attributeRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveAttributeSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;

    const dupe = await (ArdAttribute as any).findOne({
      where: {
        label: { [Op.iLike]: body.label },
        ...(body.id ? { id: { [Op.ne]: body.id } } : {}),
      },
    });
    if (dupe) throw new BadRequestError(`An attribute named "${body.label}" already exists.`);

    let row = body.id ? await (ArdAttribute as any).findByPk(body.id) : null;
    if (!row) {
      row = await (ArdAttribute as any).create({
        name: camelKey(body.label),
        label: body.label,
        fieldType: body.type,
        required: body.required ?? false,
        maxLength: body.maxLength ?? null,
        options: body.options ?? null,
        isActive: body.active ?? true,
        createdBy: userId,
      });
    } else {
      await row.update({
        label: body.label,
        fieldType: body.type,
        required: body.required ?? false,
        maxLength: body.maxLength ?? null,
        options: body.options ?? null,
        isActive: body.active ?? row.isActive,
        updatedBy: userId,
        updatedAt: new Date(),
      });
    }
    await row.reload();
    res.json(successResponse('Attribute saved', attributeOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

attributeRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAttribute as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Attribute not found');
    await row.update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// dataItemRouter — ported from Python's save_data_item (master_data.py:451-469).
// Did not exist at all before; POST /data-items 404'd unconditionally.
// ─────────────────────────────────────────────────────────────────────────────

export const dataItemRouter = Router();

// NOTE: superseded by ardDataItems.routes.ts (Extra/analysis/ard-templates-
// rearchitecture-prompt.md §3.2) — the frontend Data Items tab now calls that
// router exclusively (step 6). Kept compiling against the current schema only
// so this mounted-but-dead route doesn't 500 if anything still hits it directly.
// dataType is INTEGER|TEXT|DATE|LOV; lengthCategory is derived, never accepted
// from the client; LOV values come from Inventory's inv_general_lookup via
// lovLookupType (product owner review 2026-08-20).
function deriveLengthCategory(dataType: string): string {
  return dataType === 'TEXT' ? 'LONG' : 'SHORT';
}
const saveDataItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  dataType: z.enum(['INTEGER', 'TEXT', 'DATE', 'LOV']),
  lovLookupType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

dataItemRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    const rows = await (ArdDataItem as any).findAll({ where, order: [['name', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Data items', { items: rows.map((d: any) => dataItemOut(d, names)), total: rows.length }));
  } catch (err) { next(err); }
});

dataItemRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdDataItem as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Data item not found');
    res.json(successResponse('Data item', dataItemOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

dataItemRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveDataItemSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    let row = body.id ? await (ArdDataItem as any).findByPk(body.id) : null;
    const fields = {
      name: body.name,
      dataType: body.dataType,
      lengthCategory: deriveLengthCategory(body.dataType),
      lovLookupType: body.dataType === 'LOV' ? (body.lovLookupType ?? null) : null,
      description: body.description ?? null,
      isActive: body.active ?? (row ? row.isActive : true),
    };
    if (!row) {
      row = await (ArdDataItem as any).create({ ...fields, createdBy: userId });
    } else {
      await row.update({ ...fields, updatedBy: userId, updatedAt: new Date() });
    }
    await row.reload();
    res.json(successResponse('Data item saved', dataItemOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

dataItemRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdDataItem as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Data item not found');
    await row.update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// formTypeRouter
// ─────────────────────────────────────────────────────────────────────────────

export const formTypeRouter = Router();

// Wire contract matches Python's FormTypeIn (master_data.py:362-379). The
// previous version of this schema (requires_batch_no/requires_sample_qty,
// no category/attributeLinks/testGroupIds) never matched what the frontend
// actually sends, and left `code` unset against a NOT-NULL column — every
// create failed with a DB error.
const attributeLinkSchema = z.object({
  attributeId: z.string(),
  sequence: z.number().int().optional().default(0),
  requiredOverride: z.boolean().optional().nullable(),
  displayInReport: z.boolean().optional().default(true),
});

const saveFormTypeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  attributeLinks: z.array(attributeLinkSchema).optional().default([]),
  testGroupIds: z.array(z.string()).optional().default([]),
  mandateCertification: z.boolean().optional().default(false),
  mandateBatchNo: z.boolean().optional().default(false),
  mandateSampleQty: z.boolean().optional().default(false),
  mandateQaSubmission: z.boolean().optional().default(false),
  allowPostApprovalChanges: z.boolean().optional().default(false),
  active: z.boolean().optional(),
});

function formTypeCode(name: string): string {
  const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return code || 'FORM';
}

formTypeRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    const rows = await (ArdFormType as any).findAll({ where, order: [['name', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Form types', { items: rows.map((f: any) => formTypeOut(f, names)), total: rows.length }));
  } catch (err) { next(err); }
});

formTypeRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdFormType as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Form type not found');
    res.json(successResponse('Form type', formTypeOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

// POST upsert — mirrors Python's save_form_type (master_data.py:400-429).
// Handles both create and update: the frontend always POSTs here, passing
// `id` when editing (there is no separate PATCH call from the UI, though the
// PATCH route below is kept for direct API consumers).
formTypeRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveFormTypeSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;

    let row = body.id ? await (ArdFormType as any).findByPk(body.id) : null;
    const fields = {
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      attributeLinks: body.attributeLinks,
      testGroupIds: body.testGroupIds,
      mandateCertification: body.mandateCertification,
      mandateBatchNo: body.mandateBatchNo,
      mandateSampleQty: body.mandateSampleQty,
      mandateQaSubmission: body.mandateQaSubmission,
      allowPostApprovalChanges: body.allowPostApprovalChanges,
      isActive: body.active ?? (row ? row.isActive : true),
    };
    if (!row) {
      row = await (ArdFormType as any).create({
        ...fields,
        code: body.code || formTypeCode(body.name),
        createdBy: userId,
      });
    } else {
      await row.update({
        ...fields,
        ...(body.code ? { code: body.code } : {}),
        updatedBy: userId,
        updatedAt: new Date(),
      });
    }
    await row.reload();
    res.json(successResponse('Form type saved', formTypeOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

formTypeRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdFormType as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Form type not found');
    const body = saveFormTypeSchema.partial().parse(req.body);
    await (row as any).update({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.attributeLinks !== undefined ? { attributeLinks: body.attributeLinks } : {}),
      ...(body.testGroupIds !== undefined ? { testGroupIds: body.testGroupIds } : {}),
      ...(body.mandateCertification !== undefined ? { mandateCertification: body.mandateCertification } : {}),
      ...(body.mandateBatchNo !== undefined ? { mandateBatchNo: body.mandateBatchNo } : {}),
      ...(body.mandateSampleQty !== undefined ? { mandateSampleQty: body.mandateSampleQty } : {}),
      ...(body.mandateQaSubmission !== undefined ? { mandateQaSubmission: body.mandateQaSubmission } : {}),
      ...(body.allowPostApprovalChanges !== undefined ? { allowPostApprovalChanges: body.allowPostApprovalChanges } : {}),
      ...(body.active !== undefined ? { isActive: body.active } : {}),
      ...(body.code ? { code: body.code } : {}),
      updatedBy: (req as any).user?.id ?? null,
      updatedAt: new Date(),
    });
    res.json(successResponse('Form type updated', formTypeOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

formTypeRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdFormType as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Form type not found');
    await (row as any).update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ardSettingsRouter
// ─────────────────────────────────────────────────────────────────────────────

export const ardSettingsRouter = Router();

const updateSettingSchema = z.object({
  value: z.any(),
  label: z.string().optional(),
});

ardSettingsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdSetting as any).findAll({ order: [['key', 'ASC']] });
    res.json(successResponse('Settings', { items: rows.map(settingOut), total: rows.length }));
  } catch (err) { next(err); }
});

ardSettingsRouter.patch('/:key', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdSetting as any).findOne({ where: { key: req.params.key } });
    if (!row) throw new NotFoundError('Setting not found');
    const body = updateSettingSchema.parse(req.body);
    await (row as any).update({ value: body.value, label: body.label });
    res.json(successResponse('Setting updated', row));
  } catch (err) { next(err); }
});

// PUT /settings/:id — mirrors Python's update_setting (master_data.py:552-561).
// This is what the frontend actually calls (apiPut by id); the PATCH-by-key
// route above never matched, so every settings toggle 404'd.
ardSettingsRouter.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdSetting as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Setting not found');
    const body = updateSettingSchema.parse(req.body);
    await row.update({ value: String(body.value) });
    res.json(successResponse('Setting updated', settingOut(row)));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// qualificationRouter
// ─────────────────────────────────────────────────────────────────────────────

export const qualificationRouter = Router();

// Wire contract matches Python's QualificationIn (master_data.py:566-578).
// The previous schema here (analyst_id/technique_key) never matched what the
// frontend actually sends (userId/techniqueEntries) — every save 400'd.
const techniqueEntrySchema = z.object({
  techniqueId: z.string(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  certificationPath: z.string().optional().nullable(),
  techniqueName: z.string().optional().nullable(),
  analystName: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

const saveQualificationSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  techniqueEntries: z.array(techniqueEntrySchema).optional().default([]),
  validTill: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

const certUploader = createUploader('ard-qualifications');

// ard_analyst_qualifications stores a technique_entries JSON list per analyst; entries
// have been written with either a techniqueCode or technique key over time.
function entriesOf(row: any): any[] {
  return ((row?.techniqueEntries as any[]) || []).map((e: any) => ({ ...e }));
}
function techniqueOf(entry: any): string {
  return entry?.techniqueCode ?? entry?.technique ?? '';
}

qualificationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analyst_id, technique_key } = req.query as Record<string, string>;
    // ard_analyst_qualifications is one row per user holding a technique_entries JSON
    // list — there are no analyst_id/technique_key/is_active columns to filter on, so
    // the technique filter is applied in memory.
    const where: any = {};
    if (analyst_id) where.userId = analyst_id;
    let rows = await (ArdAnalystQualification as any).findAll({ where, order: [['createdAt', 'DESC']] });
    if (technique_key) {
      rows = rows.filter((r: any) => entriesOf(r).some((e: any) => techniqueOf(e) === technique_key));
    }
    const names = await auditNamesFor(rows);
    const analystNames = await buildUserNameMap(rows.map((q: any) => q.userId));
    res.json(successResponse('Analyst qualifications', {
      items: rows.map((q: any) => qualificationOut(q, names, analystNames)),
      total: rows.length,
    }));
  } catch (err) { next(err); }
});

// GET /certificate — download by qualification_id + technique_id, mirrors
// Python's download_certificate (master_data.py:660-671). MUST be registered
// before GET '/:id' below, or Express matches "certificate" as the :id param.
qualificationRouter.get('/certificate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qualification_id, technique_id } = req.query as Record<string, string>;
    if (!qualification_id || !technique_id) throw new BadRequestError('qualification_id and technique_id are required.');
    const row = await (ArdAnalystQualification as any).findByPk(qualification_id);
    if (!row) throw new NotFoundError('Qualification not found.');
    const entry = entriesOf(row).find((e: any) => String(e.techniqueId) === String(technique_id));
    if (!entry?.certificationPath || !fs.existsSync(entry.certificationPath)) {
      throw new NotFoundError('No certificate on file for this technique.');
    }
    res.sendFile(path.resolve(entry.certificationPath));
  } catch (err) { next(err); }
});

qualificationRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    res.json(successResponse('Analyst qualification', qualificationOut(
      row, await auditNamesFor([row]), await buildUserNameMap([(row as any).userId]),
    )));
  } catch (err) { next(err); }
});

// POST upsert — mirrors Python's save_qualification (master_data.py:595-614).
// One row per analyst; techniqueEntries is a full wholesale replace each save
// (the frontend always submits its complete current selection), not a merge.
qualificationRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveQualificationSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;

    let row = body.id
      ? await (ArdAnalystQualification as any).findByPk(body.id)
      : await (ArdAnalystQualification as any).findOne({ where: { userId: body.userId } });
    const isNew = !row;
    if (!row) {
      row = await (ArdAnalystQualification as any).create({
        userId: body.userId,
        techniqueEntries: body.techniqueEntries,
        validTill: body.validTill ?? null,
        remarks: body.remarks ?? null,
        createdBy: userId,
      });
    } else {
      await row.update({
        techniqueEntries: body.techniqueEntries,
        ...(body.validTill !== undefined ? { validTill: body.validTill } : {}),
        ...(body.remarks !== undefined ? { remarks: body.remarks } : {}),
        updatedBy: userId,
        updatedAt: new Date(),
      });
    }
    await row.reload();
    res.status(isNew ? 201 : 200).json(successResponse(
      'Qualification saved',
      qualificationOut(row, await auditNamesFor([row]), await buildUserNameMap([row.userId])),
    ));
  } catch (err) { next(err); }
});

qualificationRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    const body = saveQualificationSchema.partial().parse(req.body);
    await row.update({
      ...(body.techniqueEntries !== undefined ? { techniqueEntries: body.techniqueEntries } : {}),
      ...(body.validTill !== undefined ? { validTill: body.validTill } : {}),
      ...(body.remarks !== undefined ? { remarks: body.remarks } : {}),
      updatedBy: (req as any).user?.id ?? null,
      updatedAt: new Date(),
    });
    res.json(successResponse(
      'Qualification updated',
      qualificationOut(row, await auditNamesFor([row]), await buildUserNameMap([row.userId])),
    ));
  } catch (err) { next(err); }
});

// POST /:id/approve — mirrors Python's approve_qualification (master_data.py:617-630).
qualificationRouter.post('/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    const user = (req as any).user;
    await row.update({
      approvalStatus: req.body?.approvalStatus || 'APPROVED',
      approvedBy: user?.username ?? null,
      approvedAt: new Date(),
      ...(req.body?.remarks ? { remarks: req.body.remarks } : {}),
    });
    res.json(successResponse(
      'Qualification approved',
      qualificationOut(row, await auditNamesFor([row]), await buildUserNameMap([row.userId])),
    ));
  } catch (err) { next(err); }
});

// POST /:id/certificate — mirrors Python's upload_certificate (master_data.py:633-657).
qualificationRouter.post('/:id/certificate', authenticate, certUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    if (!req.file) throw new BadRequestError('No file uploaded.');
    if (path.extname(req.file.originalname).toLowerCase() !== '.pdf') {
      throw new BadRequestError('Only PDF files are allowed for certificates.');
    }
    const techniqueId = req.body?.technique_id;
    if (!techniqueId) throw new BadRequestError('technique_id is required.');
    const entries = entriesOf(row).map((e: any) => {
      if (String(e.techniqueId) !== String(techniqueId)) return e;
      if (e.certificationPath && fs.existsSync(e.certificationPath)) {
        try { fs.unlinkSync(e.certificationPath); } catch { /* best-effort cleanup */ }
      }
      return { ...e, certificationPath: req.file!.path };
    });
    await row.update({ techniqueEntries: entries, updatedBy: (req as any).user?.id ?? null, updatedAt: new Date() });
    res.json(successResponse(
      'Certificate uploaded',
      qualificationOut(row, await auditNamesFor([row]), await buildUserNameMap([row.userId])),
    ));
  } catch (err) { next(err); }
});

qualificationRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    // No is_active column — deactivate each technique entry, preserving the record.
    await (row as any).update({
      techniqueEntries: entriesOf(row).map((e: any) => ({ ...e, active: false })),
    });
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /qualifications/import-csv — bulk-add technique qualifications.
// Expected columns: username (or empNo), techniqueCode, startDate, endDate
// (optional), validTill (optional). Resolves the user by username/emp_no and
// the technique by code; upserts that one technique entry into the analyst's
// row without disturbing their other qualified techniques.
qualificationRouter.post('/import-csv', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new BadRequestError('No file uploaded.');
    const userId = (req as any).user?.id ?? null;
    const text = req.file.buffer.toString('utf-8').replace(/^﻿/, '');
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      res.json(successResponse('Import complete', { created: 0, skipped: 0, errors: ['File has no data rows.'] }));
      return;
    }
    const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idx = (...names: string[]) => names.map((n) => header.indexOf(n.toLowerCase())).find((i) => i >= 0) ?? -1;
    const colUsername = idx('username');
    const colEmpNo = idx('empno', 'emp_no');
    const colTechnique = idx('techniquecode', 'technique_code');
    const colStart = idx('startdate', 'start_date');
    const colEnd = idx('enddate', 'end_date');
    const colValidTill = idx('validtill', 'valid_till');

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const cells = splitCsvLine(lines[i]);
      const username = colUsername >= 0 ? cells[colUsername] : '';
      const empNo = colEmpNo >= 0 ? cells[colEmpNo] : '';
      const techniqueCode = colTechnique >= 0 ? cells[colTechnique] : '';
      if ((!username && !empNo) || !techniqueCode) {
        errors.push(`Row ${rowNum}: username/empNo and techniqueCode are required.`);
        skipped++;
        continue;
      }
      const analyst = await (User as any).findOne({
        where: username ? { username } : { empNo },
      });
      if (!analyst) { errors.push(`Row ${rowNum}: user "${username || empNo}" not found.`); skipped++; continue; }
      const technique = await (ArdTechnique as any).findOne({ where: { code: techniqueCode } });
      if (!technique) { errors.push(`Row ${rowNum}: technique "${techniqueCode}" not found.`); skipped++; continue; }

      const entry = {
        techniqueId: technique.id,
        techniqueName: technique.code,
        startDate: colStart >= 0 ? (cells[colStart] || null) : null,
        endDate: colEnd >= 0 ? (cells[colEnd] || null) : null,
      };
      let row = await (ArdAnalystQualification as any).findOne({ where: { userId: analyst.id } });
      const kept = row ? entriesOf(row).filter((e: any) => String(e.techniqueId) !== String(technique.id)) : [];
      const validTill = colValidTill >= 0 ? (cells[colValidTill] || null) : null;
      if (!row) {
        await (ArdAnalystQualification as any).create({
          userId: analyst.id, techniqueEntries: [entry], validTill, createdBy: userId,
        });
      } else {
        await row.update({
          techniqueEntries: [...kept, entry],
          ...(validTill ? { validTill } : {}),
          updatedBy: userId, updatedAt: new Date(),
        });
      }
      created++;
    }
    res.json(successResponse('Import complete', { created, skipped, errors }));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// teamRouter
// ─────────────────────────────────────────────────────────────────────────────

export const teamRouter = Router();

const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tl_analyst_map: z.any().optional(),
});

teamRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    const rows = await (ArdTeam as any).findAll({ where, order: [['name', 'ASC']] });
    res.json(successResponse('Teams', rows));
  } catch (err) { next(err); }
});

teamRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTeam as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Team not found');
    res.json(successResponse('Team', row));
  } catch (err) { next(err); }
});

teamRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTeamSchema.parse(req.body);
    const row = await (ArdTeam as any).create({
      name: body.name,
      description: body.description,
      tlAnalystMap: body.tl_analyst_map,
      isActive: true,
    });
    res.status(201).json(successResponse('Team created', row));
  } catch (err) { next(err); }
});

teamRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTeam as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Team not found');
    const body = createTeamSchema.partial().parse(req.body);
    await (row as any).update({
      name: body.name,
      description: body.description,
      tlAnalystMap: body.tl_analyst_map,
    });
    res.json(successResponse('Team updated', row));
  } catch (err) { next(err); }
});

teamRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTeam as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Team not found');
    await (row as any).update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ardNotificationRouter
// ─────────────────────────────────────────────────────────────────────────────

export const ardNotificationRouter = Router();

const markReadSchema = z.object({
  notification_id: z.string(),
});

ardNotificationRouter.get('/unread-count', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Placeholder: no separate notifications table; ArdNotificationRead only records what was read
    res.json(successResponse('Unread notification count', { count: 0 }));
  } catch (err) { next(err); }
});

ardNotificationRouter.post('/mark-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notification_id } = markReadSchema.parse(req.body);
    const user = (req as any).user;
    const [record, created] = await (ArdNotificationRead as any).findOrCreate({
      where: { userId: user.id, notificationId: notification_id },
      defaults: { userId: user.id, notificationId: notification_id },
    });
    res.json(successResponse(created ? 'Notification marked as read' : 'Already marked as read', record));
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ardAuditRouter
// ─────────────────────────────────────────────────────────────────────────────

export const ardAuditRouter = Router();


// ─────────────────────────────────────────────────────────────────────────────
// Lookup categories, content blocks, qualification alerts
// ─────────────────────────────────────────────────────────────────────────────

export const lookupCategoryRouter = Router();
export const lookupRouter = Router();
export const contentBlockRouter = Router();
export const qualificationAlertRouter = Router();

// Canonical ARD lookup categories — ported verbatim from
// backend/app/shared/ard_lookup_categories.py:6.
const VALID_LOOKUP_CATEGORIES = [
  'Sample Type', 'Pack Type', 'Storage Condition', 'Field Type', 'Template Type',
  'Priority', 'UOM', 'Chromatography Technique', 'Sample Integrity',
  'Attachment Type', 'Specification Type', 'Chemical Grade', 'Weighing Unit',
  'Result Data Type', 'Report Type', 'Form Category', 'Scheme Mode',
  'Dosage Form', 'Sampling Stage',
];

// GET /master-data/lookup-categories
lookupCategoryRouter.get('/', authenticate, (_req: Request, res: Response) => {
  res.json([...VALID_LOOKUP_CATEGORIES].sort());
});

const saveLookupSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1),
  code: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

// POST /master-data/lookups — Python LookupIn upsert (master_data.py:496-515)
lookupRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveLookupSchema.parse(req.body);
    const category = normalizeLookupCategory(body.category);
    if (!VALID_LOOKUP_CATEGORIES.includes(category)) {
      throw new BadRequestError(`Invalid lookup category '${body.category}'.`);
    }
    const storageCategory = toStorageCategory(category);
    const userId = (req as any).user?.id ?? null;
    let row = body.id ? await (MasterDataItem as any).findByPk(body.id) : null;
    const isNew = !row;
    if (!row) {
      row = await (MasterDataItem as any).create({
        category: storageCategory,
        code: body.code,
        name: body.label,
        description: body.description ?? null,
        sortOrder: 0,
        isActive: body.active ?? true,
        createdBy: userId,
      });
    } else {
      await row.update({
        category: storageCategory,
        code: body.code,
        name: body.label,
        description: body.description ?? null,
        isActive: body.active ?? row.isActive,
        updatedBy: userId,
        updatedAt: new Date(),
        // Seeded / pre-audit rows had no created_by — stamp on first edit.
        createdBy: row.createdBy || userId,
      });
    }
    await row.reload();
    res.status(isNew ? 201 : 200).json(successResponse(
      isNew ? 'Lookup created' : 'Lookup updated',
      lookupOut(row, await auditNamesFor([row])),
    ));
  } catch (err) { next(err); }
});

// GET /master-data/content-blocks
contentBlockRouter.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdContentBlock as any).findAll({ order: [['name', 'ASC']] });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Content blocks', { items: rows.map((b: any) => contentBlockOut(b, names)), total: rows.length }));
  } catch (err) { next(err); }
});

contentBlockRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdContentBlock as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Content block not found');
    res.json(successResponse('Content block', contentBlockOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

// POST upsert — ported from Python's save_content_block (master_data.py:771-786).
// Did not exist at all before; POST /content-blocks 404'd unconditionally.
const saveContentBlockSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  contentType: z.string().optional().default('richtext'),
  body: z.string().optional().nullable(),
  displayHeight: z.number().int().positive().optional().default(250),
  active: z.boolean().optional(),
});

contentBlockRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveContentBlockSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;
    let row = body.id ? await (ArdContentBlock as any).findByPk(body.id) : null;
    const fields = {
      name: body.name,
      contentType: body.contentType,
      body: body.body ?? null,
      displayHeight: body.displayHeight,
      isActive: body.active ?? (row ? row.isActive : true),
    };
    if (!row) {
      row = await (ArdContentBlock as any).create({ ...fields, createdBy: userId });
    } else {
      await row.update({ ...fields, updatedBy: userId, updatedAt: new Date() });
    }
    await row.reload();
    res.json(successResponse('Content block saved', contentBlockOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

contentBlockRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdContentBlock as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Content block not found');
    await row.update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

const ALERT_VIEW_ROLES = ['SUPER_ADMIN', 'HOD', 'TL'];

// GET /master-data/qualification-alerts/evaluate
// Mirrors backend/app/modules/ard/master_data.py:698-738.
qualificationAlertRouter.get('/evaluate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleCode = ((req.user as any)?.role as any)?.code ?? '';
    if (!ALERT_VIEW_ROLES.includes(roleCode)) {
      throw new ForbiddenError('Not permitted to view qualification alerts.');
    }

    const alerts = await (ArdQualificationAlert as any).findAll({ where: { isActive: true } });
    const window = alerts.reduce((max: number, a: any) => Math.max(max, Number(a.daysBeforeExpiry ?? 0)), 0);

    // Entries have been written with either the technique's id or its code, so index
    // both — otherwise the UI shows a raw UUID where a technique name belongs.
    const techniques = await (ArdTechnique as any).findAll({ attributes: ['id', 'code', 'name'] });
    const techniqueNames = new Map<string, string>();
    for (const t of techniques) {
      if ((t as any).id) techniqueNames.set(String((t as any).id), (t as any).name);
      if ((t as any).code) techniqueNames.set(String((t as any).code), (t as any).name);
    }

    const MS_PER_DAY = 86_400_000;
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();

    const quals = await (ArdAnalystQualification as any).findAll();
    const warnings: any[] = [];

    for (const qual of quals) {
      const analyst = (qual as any).userId
        ? await (User as any).findByPk((qual as any).userId, { attributes: ['id', 'username'] })
        : null;

      for (const entry of (((qual as any).techniqueEntries as any[]) || [])) {
        const endRaw: string | undefined = entry?.endDate ?? entry?.expiresOn;
        if (!endRaw) continue;
        const endMs = new Date(`${String(endRaw).slice(0, 10)}T00:00:00Z`).getTime();
        if (Number.isNaN(endMs)) continue;

        const daysRemaining = Math.round((endMs - todayMs) / MS_PER_DAY);
        let status: string;
        if (daysRemaining < 0) status = 'EXPIRED';
        else if (alerts.length > 0 && daysRemaining <= window) status = 'EXPIRING';
        else continue;

        const code = entry?.techniqueId ?? entry?.techniqueCode ?? entry?.technique ?? null;
        warnings.push({
          analystId: (qual as any).userId,
          analystName: (analyst as any)?.username ?? String((qual as any).userId),
          techniqueCode: code,
          techniqueName: (code && techniqueNames.get(code)) || code,
          endDate: endRaw,
          daysRemaining,
          status,
        });
      }
    }

    warnings.sort((a, b) => a.daysRemaining - b.daysRemaining);
    res.json(successResponse('Qualification alerts', {
      window,
      alertsActive: alerts.length,
      expired: warnings.filter((w) => w.status === 'EXPIRED').length,
      expiring: warnings.filter((w) => w.status === 'EXPIRING').length,
      warnings,
    }));
  } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────────────────────────
// Master-data bundle
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ard/master-data — the Configuration screen loads everything in one call.
// Ported from backend/app/modules/ard/master_data.py:788-817.

async function masterDataBundle() {
  const newestFirst: any = [['createdAt', 'DESC']];

  const [
    techniques, testConfigs, testGroups, attributes, formTypes,
    settings, qualifications, alerts, dataItems, contentBlocks,
    lookupRows, departments,
  ] = await Promise.all([
    (ArdTechnique as any).findAll({ order: newestFirst }),
    (ArdTestConfiguration as any).findAll({ order: newestFirst }),
    (ArdTestGroup as any).findAll({ include: [{ model: ArdTestGroupMember, as: 'members' }], order: newestFirst }),
    (ArdAttribute as any).findAll({ order: newestFirst }),
    (ArdFormType as any).findAll({ order: newestFirst }),
    (ArdSetting as any).findAll({ order: [['category', 'ASC']] }),
    (ArdAnalystQualification as any).findAll({ order: newestFirst }),
    (ArdQualificationAlert as any).findAll(),
    (ArdDataItem as any).findAll({ order: newestFirst }),
    (ArdContentBlock as any).findAll({ order: [['name', 'ASC']] }),
    (MasterDataItem as any).findAll({
      where: { category: { [Op.like]: `${LOOKUP_STORAGE_PREFIX}%` } },
      order: newestFirst,
    }),
    (Department as any).findAll({ order: [['name', 'ASC']] }),
  ]);

  const names = await auditNamesFor([
    ...techniques, ...testConfigs, ...testGroups, ...attributes,
    ...formTypes, ...qualifications, ...dataItems, ...contentBlocks,
    ...lookupRows,
  ]);
  const analystNames = await buildUserNameMap(qualifications.map((q: any) => q.userId));
  const lookups = lookupRows.map((m: any) => lookupOut(m, names));

  return {
    techniques: techniques.map((t: any) => techniqueOut(t, names)),
    chromatographyTechniqueCodes: lookups
      .filter((l: any) => l.category === 'Chromatography Technique' && l.active)
      .map((l: any) => l.code),
    departments: departments.map((d: any) => ({
      id: d.id, code: d.code, name: d.name, active: d.isActive ?? true,
    })),
    testConfigs: testConfigs.map((c: any) => testConfigOut(c, names)),
    testGroups: testGroups.map((g: any) => testGroupOut(g, names)),
    attributes: attributes.map((a: any) => attributeOut(a, names)),
    formTypes: formTypes.map((f: any) => formTypeOut(f, names)),
    lookups,
    settings: settings.map(settingOut),
    qualifications: qualifications.map((q: any) => qualificationOut(q, names, analystNames)),
    alerts: alerts.map(alertOut),
    dataItems: dataItems.map((d: any) => dataItemOut(d, names)),
    contentBlocks: contentBlocks.map((b: any) => contentBlockOut(b, names)),
  };
}


// Barrel default export — mounts all sub-routers under /api/ard/master-data
import { Router as _Router } from 'express'
const _masterDataRouter = _Router()
_masterDataRouter.use('/techniques', techniqueRouter)
_masterDataRouter.use('/test-configs', testConfigRouter)
_masterDataRouter.use('/test-groups', testGroupRouter)
_masterDataRouter.use('/attributes', attributeRouter)
_masterDataRouter.use('/data-items', dataItemRouter)
_masterDataRouter.use('/form-types', formTypeRouter)
// GET /settings-map — a flat { [key]: { value, valueType } } lookup used by
// every e-signature/authentication gate across the ARD frontend (ardApi.settingsMap,
// e.g. ATR submit/withdraw/certify, experiment verification flow). This route
// never existed, so that fetch always 404'd, settingsMap was always empty, and
// every `requiresEsign` check silently evaluated false — password re-authentication
// never triggered anywhere that reads it, regardless of the setting's actual value.
_masterDataRouter.get('/settings-map', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdSetting as any).findAll();
    const map: Record<string, { value: unknown; valueType: string }> = {};
    for (const row of rows) {
      const out = settingOut(row);
      map[out.key] = { value: out.value, valueType: out.valueType };
    }
    res.json(successResponse('Settings map', map));
  } catch (err) { next(err); }
});
_masterDataRouter.use('/settings', ardSettingsRouter)
_masterDataRouter.use('/qualifications', qualificationRouter)
_masterDataRouter.use('/team', teamRouter)
_masterDataRouter.use('/notifications-legacy', ardNotificationRouter)
_masterDataRouter.use('/audit', ardAuditRouter)
_masterDataRouter.use('/lookup-categories', lookupCategoryRouter)
_masterDataRouter.use('/lookups', lookupRouter)
_masterDataRouter.use('/content-blocks', contentBlockRouter)
_masterDataRouter.use('/qualification-alerts', qualificationAlertRouter)
// Root bundle — registered last so the sub-router mounts above take precedence.
_masterDataRouter.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse('ARD master data', await masterDataBundle()))
  } catch (err) { next(err) }
})

export default _masterDataRouter

ardAuditRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id } = req.query as Record<string, string>;
    const { page, limit, offset } = parsePagination(req.query);
    const where: any = {};
    if (entity_type) where.entityType = entity_type;
    if (entity_id) where.entityId = entity_id;

    const { count, rows } = await (ArdAuditLog as any).findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    const pagination = buildPagination(page, limit, count);
    res.json(listResponse('Audit logs', rows, pagination));
  } catch (err) { next(err); }
});
