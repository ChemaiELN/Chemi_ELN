import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { authenticate } from '../../middleware/auth.middleware';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ForbiddenError, AppError } from '../../utils/errors';
import { sequelize } from '../../database/connection';
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
  id: d.id, name: d.name, dataType: d.dataType, uom: d.uom,
  options: d.options, description: d.description, active: d.isActive, ...auditOf(d, names),
});

const contentBlockOut = (b: any, names: Map<string, string>) => ({
  id: b.id, name: b.name, contentType: b.contentType,
  body: b.body, displayHeight: b.displayHeight || 250,
  active: b.isActive, ...auditOf(b, names),
});

const lookupOut = (m: any) => ({
  id: m.id, category: stripLookupPrefix(m.category ?? ''), code: m.code,
  label: m.name, description: m.description ?? null,
  active: m.isActive ?? true, createdAt: iso(m.createdAt),
});

// ─────────────────────────────────────────────────────────────────────────────
// techniqueRouter
// ─────────────────────────────────────────────────────────────────────────────

export const techniqueRouter = Router();

const createTechniqueSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
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

techniqueRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTechniqueSchema.parse(req.body);
    const row = await (ArdTechnique as any).create({ name: body.name, code: body.code, description: body.description, isActive: true });
    res.status(201).json(successResponse('Technique created', row));
  } catch (err) { next(err); }
});

techniqueRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTechnique as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Technique not found');
    const body = createTechniqueSchema.partial().parse(req.body);
    await (row as any).update(body);
    res.json(successResponse('Technique updated', row));
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

const createTestConfigSchema = z.object({
  name: z.string().min(1),
  technique_id: z.string().optional(),
  technique_key: z.string().optional(),
  technique_name: z.string().optional(),
  description: z.string().optional(),
  parameters: z.any().optional(),
});

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
    const body = createTestConfigSchema.parse(req.body);
    const row = await (ArdTestConfiguration as any).create({
      testType: body.name,
      techniqueCode: body.technique_key ?? '',
      techniqueName: body.technique_name ?? '',
      methodReference: body.description ?? null,
      resultParams: body.parameters ?? [],
      isActive: true,
    });
    res.status(201).json(successResponse('Test configuration created', row));
  } catch (err) { next(err); }
});

testConfigRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestConfiguration as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test configuration not found');
    const body = createTestConfigSchema.partial().parse(req.body);
    const configUpdates: Record<string, unknown> = {};
    if (body.name !== undefined) configUpdates.testType = body.name;
    if (body.technique_key !== undefined) configUpdates.techniqueCode = body.technique_key;
    if (body.technique_name !== undefined) configUpdates.techniqueName = body.technique_name;
    if (body.description !== undefined) configUpdates.methodReference = body.description;
    if (body.parameters !== undefined) configUpdates.resultParams = body.parameters;
    await (row as any).update(configUpdates);
    res.json(successResponse('Test configuration updated', row));
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

// ─────────────────────────────────────────────────────────────────────────────
// testGroupRouter
// ─────────────────────────────────────────────────────────────────────────────

export const testGroupRouter = Router();

const createTestGroupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  test_config_ids: z.array(z.string()).optional(),
});

testGroupRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdTestGroup as any).findAll({
      include: [{ model: ArdTestGroupMember, as: 'members', attributes: ['id'] }],
      order: [['name', 'ASC']],
    });
    const names = await auditNamesFor(rows);
    res.json(successResponse('Test groups', { items: rows.map((g: any) => testGroupOut(g, names)), total: rows.length }));
  } catch (err) { next(err); }
});

testGroupRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestGroup as any).findByPk(req.params.id, {
      include: [{ model: ArdTestGroupMember, as: 'members' }],
    });
    if (!row) throw new NotFoundError('Test group not found');
    res.json(successResponse('Test group', testGroupOut(row, await auditNamesFor([row]))));
  } catch (err) { next(err); }
});

testGroupRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createTestGroupSchema.parse(req.body);
    const group = await sequelize.transaction(async (t) => {
      const g = await (ArdTestGroup as any).create(
        { name: body.name, description: body.description, isActive: true },
        { transaction: t }
      );
      if (body.test_config_ids?.length) {
        const members = body.test_config_ids.map((id: string) => ({ testGroupId: (g as any).id, testConfigId: id }));
        await (ArdTestGroupMember as any).bulkCreate(members, { transaction: t });
      }
      return g;
    });
    res.status(201).json(successResponse('Test group created', group));
  } catch (err) { next(err); }
});

testGroupRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestGroup as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test group not found');
    const body = createTestGroupSchema.partial().parse(req.body);
    await sequelize.transaction(async (t) => {
      if (body.name !== undefined || body.description !== undefined) {
        await (row as any).update({ name: body.name, description: body.description }, { transaction: t });
      }
      if (body.test_config_ids !== undefined) {
        await (ArdTestGroupMember as any).destroy({ where: { testGroupId: (row as any).id }, transaction: t });
        if (body.test_config_ids.length) {
          const members = body.test_config_ids.map((id: string) => ({ testGroupId: (row as any).id, testConfigId: id }));
          await (ArdTestGroupMember as any).bulkCreate(members, { transaction: t });
        }
      }
    });
    res.json(successResponse('Test group updated', row));
  } catch (err) { next(err); }
});

testGroupRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdTestGroup as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Test group not found');
    await (row as any).update({ isActive: false });
    res.status(204).send();
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// formTypeRouter
// ─────────────────────────────────────────────────────────────────────────────

export const formTypeRouter = Router();

const createFormTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  requires_batch_no: z.boolean().optional(),
  requires_sample_qty: z.boolean().optional(),
});

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

formTypeRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createFormTypeSchema.parse(req.body);
    const row = await (ArdFormType as any).create({
      name: body.name,
      code: body.code,
      mandateBatchNo: body.requires_batch_no,
      mandateSampleQty: body.requires_sample_qty,
      isActive: true,
    });
    res.status(201).json(successResponse('Form type created', row));
  } catch (err) { next(err); }
});

formTypeRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdFormType as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Form type not found');
    const body = createFormTypeSchema.partial().parse(req.body);
    await (row as any).update({
      name: body.name,
      code: body.code,
      mandateBatchNo: body.requires_batch_no,
      mandateSampleQty: body.requires_sample_qty,
    });
    res.json(successResponse('Form type updated', row));
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

// ─────────────────────────────────────────────────────────────────────────────
// qualificationRouter
// ─────────────────────────────────────────────────────────────────────────────

export const qualificationRouter = Router();

const createQualificationSchema = z.object({
  analyst_id: z.string(),
  analyst_name: z.string().optional(),
  technique_key: z.string(),
  technique_name: z.string().optional(),
  qualified_on: z.string().optional(),
  expires_on: z.string().optional(),
});

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

qualificationRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    res.json(successResponse('Analyst qualification', qualificationOut(
      row, await auditNamesFor([row]), await buildUserNameMap([(row as any).userId]),
    )));
  } catch (err) { next(err); }
});

qualificationRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createQualificationSchema.parse(req.body);
    let analystName = body.analyst_name;
    if (!analystName) {
      const analyst = await (User as any).findByPk(body.analyst_id);
      analystName = analyst?.username;
    }
    const entry = {
      techniqueCode: body.technique_key,
      techniqueName: body.technique_name ?? null,
      qualifiedOn: body.qualified_on ?? null,
      expiresOn: body.expires_on ?? null,
      analystName: analystName ?? null,
      active: true,
    };
    // One row per analyst: append to their technique_entries rather than inserting a
    // second row for the same user.
    const existingRow = await (ArdAnalystQualification as any).findOne({ where: { userId: body.analyst_id } });
    let row;
    if (existingRow) {
      const kept = entriesOf(existingRow).filter((e: any) => techniqueOf(e) !== body.technique_key);
      await existingRow.update({ techniqueEntries: [...kept, entry] });
      row = existingRow;
    } else {
      row = await (ArdAnalystQualification as any).create({
        userId: body.analyst_id,
        techniqueEntries: [entry],
      });
    }
    res.status(201).json(successResponse('Qualification created', row));
  } catch (err) { next(err); }
});

qualificationRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdAnalystQualification as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Qualification not found');
    const body = createQualificationSchema.partial().parse(req.body);
    const entries = entriesOf(row);
    const target = body.technique_key
      ? entries.find((e: any) => techniqueOf(e) === body.technique_key)
      : entries[0];
    if (target) {
      if (body.technique_name !== undefined) target.techniqueName = body.technique_name;
      if (body.qualified_on !== undefined) target.qualifiedOn = body.qualified_on;
      if (body.expires_on !== undefined) target.expiresOn = body.expires_on;
      if (body.analyst_name !== undefined) target.analystName = body.analyst_name;
    }
    const qualUpdates: Record<string, unknown> = { techniqueEntries: entries };
    if (body.analyst_id !== undefined) qualUpdates.userId = body.analyst_id;
    await (row as any).update(qualUpdates);
    res.json(successResponse('Qualification updated', row));
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

// GET /master-data/content-blocks
contentBlockRouter.get('/', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (ArdContentBlock as any).findAll({ order: [['name', 'ASC']] });
    res.json(successResponse('Content blocks', { items: rows, total: rows.length }));
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
  ]);
  const analystNames = await buildUserNameMap(qualifications.map((q: any) => q.userId));
  const lookups = lookupRows.map(lookupOut);

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
_masterDataRouter.use('/form-types', formTypeRouter)
_masterDataRouter.use('/settings', ardSettingsRouter)
_masterDataRouter.use('/qualifications', qualificationRouter)
_masterDataRouter.use('/team', teamRouter)
_masterDataRouter.use('/notifications-legacy', ardNotificationRouter)
_masterDataRouter.use('/audit', ardAuditRouter)
_masterDataRouter.use('/lookup-categories', lookupCategoryRouter)
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
