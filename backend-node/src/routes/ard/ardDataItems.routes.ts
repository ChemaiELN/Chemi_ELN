import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Op } from 'sequelize';
import { authenticate } from '../../middleware/auth.middleware';
import { requireArdDeptMember } from '../../shared/ardDepartmentAccess';
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response';
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors';
import { ArdDataItem, ArdSectionDataItem, ArdDatatableColumn, InvGeneralLookup, ArdAuditLog } from '../../models/index';

// Canonical Data Items master-data router (rearchitecture prompt §3.2), aligned
// to the legacy "Template DataItems" screen per product owner review 2026-08-20:
// dataType is INTEGER | TEXT | DATE | LOV (legacy labels Integer/Text/Date/LOV);
// lengthCategory is never user-entered, only ever derived server-side from
// dataType; LOV selectable values come from the Inventory module's shared
// inv_general_lookup table (lookupType/lookupValue), not an ARD-local lookup.
const ardDataItemRouter = Router();
ardDataItemRouter.use(authenticate, requireArdDeptMember);

const DATA_TYPES = ['INTEGER', 'TEXT', 'DATE', 'LOV'] as const;

// Legacy convention: only TEXT gets the long/short distinction that actually
// matters for free-text field sizing; every other type is a short, fixed-width
// value. Never accepted from the client — always recomputed from dataType.
function deriveLengthCategory(dataType: string): string {
  return dataType === 'TEXT' ? 'LONG' : 'SHORT';
}

async function auditLog(entityId: string, action: string, userId: string | null, detail?: string | null) {
  await (ArdAuditLog as any).create({ entityType: 'DATA_ITEM', entityId, action, userId, detail: detail ?? null });
}

const saveDataItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  dataType: z.enum(DATA_TYPES),
  lovLookupType: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

function dataItemOut(d: any) {
  return {
    id: d.id, name: d.name, description: d.description, dataType: d.dataType,
    lengthCategory: d.lengthCategory, lovLookupType: d.lovLookupType,
    active: d.isActive,
    createdBy: d.createdBy, createdAt: d.createdAt, updatedBy: d.updatedBy, updatedAt: d.updatedAt,
  };
}

// GET / — list master data items
ardDataItemRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { is_active, data_type, q } = req.query as Record<string, string>;
    const where: any = {};
    if (is_active !== undefined) where.isActive = is_active === 'true';
    if (data_type) where.dataType = data_type;
    if (q) where.name = { [Op.iLike]: `%${q}%` };

    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 200);
    const { count, rows } = await (ArdDataItem as any).findAndCountAll({
      where, order: [['name', 'ASC']], offset, limit,
    });
    res.json(listResponse('Data items', rows.map(dataItemOut), buildPagination(page, limit, count)));
  } catch (err) { next(err); }
});

// GET /lov-lookup-types — distinct lookup types available from Inventory's
// shared general-lookup table, for the "Select LOV Lookup Type" picker.
ardDataItemRouter.get('/lov-lookup-types', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (InvGeneralLookup as any).findAll({
      attributes: [[InvGeneralLookup.sequelize!.fn('DISTINCT', InvGeneralLookup.sequelize!.col('lookup_type')), 'lookupType']],
      where: { isActive: true },
      order: [['lookup_type', 'ASC']],
      raw: true,
    });
    res.json(successResponse('LOV lookup types', { items: rows.map((r: any) => r.lookupType) }));
  } catch (err) { next(err); }
});

// GET /:id
ardDataItemRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdDataItem as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Data item not found');
    res.json(successResponse('Data item', dataItemOut(row)));
  } catch (err) { next(err); }
});

async function assertNoDuplicate(name: string, lengthCategory: string, excludeId?: string) {
  const where: any = { name, lengthCategory, isActive: true };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const duplicate = await (ArdDataItem as any).findOne({ where });
  if (duplicate) {
    throw new ConflictError(`A data item named "${name}" already exists.`);
  }
}

// POST / — create, with real server-side validation (rearchitecture prompt §1.5)
ardDataItemRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = saveDataItemSchema.parse(req.body);
    const userId = (req as any).user?.id ?? null;

    if (body.dataType === 'LOV' && !body.lovLookupType) {
      throw new BadRequestError('Select a LOV Lookup Type when Data Type is LOV.');
    }
    const lengthCategory = deriveLengthCategory(body.dataType);
    const lovLookupType = body.dataType === 'LOV' ? (body.lovLookupType as string) : null;

    await assertNoDuplicate(body.name, lengthCategory);

    const row = await (ArdDataItem as any).create({
      name: body.name,
      description: body.description ?? null,
      dataType: body.dataType,
      lengthCategory,
      lovLookupType,
      isActive: body.active ?? true,
      createdBy: userId,
    });
    await auditLog(row.id, 'Created', userId, row.name);
    res.status(201).json(successResponse('Data item created', dataItemOut(row)));
  } catch (err) { next(err); }
});

// PUT /:id — update, same validation, plus no-op-edit detection
ardDataItemRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdDataItem as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Data item not found');
    const body = saveDataItemSchema.parse({ ...req.body, id: req.params.id });
    const userId = (req as any).user?.id ?? null;

    if (body.dataType === 'LOV' && !body.lovLookupType) {
      throw new BadRequestError('Select a LOV Lookup Type when Data Type is LOV.');
    }
    const lengthCategory = deriveLengthCategory(body.dataType);
    const lovLookupType = body.dataType === 'LOV' ? (body.lovLookupType as string) : null;

    const noOp = row.name === body.name && row.description === (body.description ?? null)
      && row.dataType === body.dataType && row.lengthCategory === lengthCategory
      && row.lovLookupType === lovLookupType && row.isActive === (body.active ?? row.isActive);
    if (noOp) {
      res.json(successResponse('Data item unchanged', dataItemOut(row)));
      return;
    }

    await assertNoDuplicate(body.name, lengthCategory, row.id);

    await row.update({
      name: body.name,
      description: body.description ?? null,
      dataType: body.dataType,
      lengthCategory,
      lovLookupType,
      isActive: body.active ?? row.isActive,
      updatedBy: userId,
      updatedAt: new Date(),
    });
    await auditLog(row.id, 'Updated', userId, row.name);
    res.json(successResponse('Data item updated', dataItemOut(row)));
  } catch (err) { next(err); }
});

// DELETE /:id — soft delete, with a usage guard (deliberate improvement over legacy,
// which had none — see rearchitecture prompt §3.2).
ardDataItemRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await (ArdDataItem as any).findByPk(req.params.id);
    if (!row) throw new NotFoundError('Data item not found');
    const userId = (req as any).user?.id ?? null;

    const [sectionUses, columnUses] = await Promise.all([
      (ArdSectionDataItem as any).findAll({ where: { dataItemId: row.id, isActive: true }, include: [{ association: 'section', attributes: ['id', 'name'] }] }),
      (ArdDatatableColumn as any).findAll({
        where: { dataItemId: row.id, isActive: true },
        include: [{ association: 'datatable', include: [{ association: 'section', attributes: ['id', 'name'] }] }],
      }),
    ]);
    if (sectionUses.length || columnUses.length) {
      // Fall back to the owning section's name — a datatable itself is often unnamed
      // (its "name" is optional per §1.3), so the datatable-name-only label was blank
      // in that common case.
      const sectionNames = sectionUses.map((u: any) => u.section?.name).filter(Boolean);
      const tableSectionNames = columnUses.map((u: any) => u.datatable?.section?.name).filter(Boolean);
      const parts: string[] = [];
      if (sectionUses.length) parts.push(sectionNames.length ? `sections: ${sectionNames.join(', ')}` : `${sectionUses.length} section(s)`);
      if (columnUses.length) parts.push(tableSectionNames.length ? `data tables in: ${tableSectionNames.join(', ')}` : `${columnUses.length} data table column(s)`);
      throw new ConflictError(`Cannot deactivate "${row.name}" — still in use by ${parts.join('; ')}.`);
    }

    await row.update({ isActive: false, updatedBy: userId, updatedAt: new Date() });
    await auditLog(row.id, 'Deactivated', userId, row.name);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default ardDataItemRouter;
