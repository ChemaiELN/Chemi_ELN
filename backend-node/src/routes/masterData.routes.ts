import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { MasterDataItem, LookupChemical, LookupInstrument } from '../models/MasterData.model'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

// GET /api/master-data/items
router.get('/items', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search } = req.query as Record<string, string>
    const where: Record<string, unknown> = { isActive: true }
    if (category) where.category = category
    if (search) where.name = { [Op.iLike]: `%${search}%` }

    const items = await MasterDataItem.findAll({ where, order: [['category', 'ASC'], ['sortOrder', 'ASC'], ['name', 'ASC']] })
    res.json(successResponse('Master data items retrieved successfully.', items))
  } catch (err) {
    next(err)
  }
})

// ── Chemicals ────────────────────────────────────────────────────────────────

const ChemSchema = z.object({
  chemical_name: z.string().min(1).max(255),
  cas_no: z.string().optional().nullable(),
  formula: z.string().optional().nullable(),
  mol_wt: z.number().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  density: z.number().optional().nullable(),
  purity_pct: z.number().optional().nullable(),
  is_active: z.boolean().optional(),
})

// GET /api/master-data/chemicals
router.get('/chemicals', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    // Search spans every column the table shows — it used to match only the
    // name, and the page filtered the rest in the browser.
    if (req.query.search) {
      where[Op.or as unknown as string] = ['chemicalName', 'casNo', 'formula', 'vendorName'].map((f) => ({
        [f]: { [Op.iLike]: `%${req.query.search}%` },
      }))
    }
    if (req.query.is_active !== undefined) where.isActive = req.query.is_active === 'true'
    const order = parseSort(req.query as Record<string, unknown>, LookupChemical, [['chemicalName', 'ASC']]) as any

    if (!wantsPagination(req.query)) {
      const rows = await LookupChemical.findAll({ where, order })
      res.json(successResponse('Chemicals retrieved successfully.', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await LookupChemical.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Chemicals retrieved successfully.', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /api/master-data/chemicals
router.post('/chemicals', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ChemSchema.parse(req.body)
    const chem = await LookupChemical.create({
      chemicalName: body.chemical_name,
      casNo: body.cas_no || null,
      formula: body.formula || null,
      molWt: body.mol_wt ?? null,
      vendorName: body.vendor_name || null,
      density: body.density ?? null,
      purityPct: body.purity_pct ?? null,
      isActive: body.is_active ?? true,
      createdBy: req.user!.id,
    })
    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'MASTER_DATA_CHEMICAL', entityId: chem.id, entityRef: chem.chemicalName,
      newValue: chem.toJSON() as Record<string, unknown>,
    })
    res.status(201).json(successResponse('Chemical created successfully.', chem))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/master-data/chemicals/:id
router.patch('/chemicals/:id', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chem = await LookupChemical.findByPk(req.params.id as string)
    if (!chem) throw new NotFoundError('Chemical')
    const before = chem.toJSON() as Record<string, unknown>
    const body = ChemSchema.partial().parse(req.body)
    await chem.update({
      ...(body.chemical_name !== undefined && { chemicalName: body.chemical_name }),
      ...(body.cas_no !== undefined && { casNo: body.cas_no }),
      ...(body.formula !== undefined && { formula: body.formula }),
      ...(body.mol_wt !== undefined && { molWt: body.mol_wt }),
      ...(body.vendor_name !== undefined && { vendorName: body.vendor_name }),
      ...(body.density !== undefined && { density: body.density }),
      ...(body.purity_pct !== undefined && { purityPct: body.purity_pct }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    })
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'MASTER_DATA_CHEMICAL', entityId: chem.id, entityRef: chem.chemicalName,
      oldValue: before, newValue: chem.toJSON() as Record<string, unknown>,
    })
    res.json(successResponse('Chemical updated successfully.', chem))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/master-data/chemicals/:id
router.delete('/chemicals/:id', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chem = await LookupChemical.findByPk(req.params.id as string)
    if (!chem) throw new NotFoundError('Chemical')
    await chem.update({ isActive: false })
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'MASTER_DATA_CHEMICAL', entityId: chem.id, entityRef: chem.chemicalName,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Instruments ──────────────────────────────────────────────────────────────

const InstrSchema = z.object({
  instrument_code: z.string().min(1).max(50),
  instrument_type: z.string().optional().nullable(),
  instrument_name: z.string().min(1).max(200),
  maintenance_status: z.string().optional().nullable(),
  calibration_status: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
})

router.get('/instruments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    // Search spans every column the table shows — it used to match only the
    // name, and the page filtered the rest in the browser.
    if (req.query.search) {
      where[Op.or as unknown as string] = ['instrumentCode', 'instrumentName', 'instrumentType'].map((f) => ({
        [f]: { [Op.iLike]: `%${req.query.search}%` },
      }))
    }
    if (req.query.is_active !== undefined) where.isActive = req.query.is_active === 'true'
    const order = parseSort(req.query as Record<string, unknown>, LookupInstrument, [['instrumentName', 'ASC']]) as any

    if (!wantsPagination(req.query)) {
      const rows = await LookupInstrument.findAll({ where, order })
      res.json(successResponse('Instruments retrieved successfully.', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await LookupInstrument.findAndCountAll({ where, order, limit, offset })
    res.json(listResponse('Instruments retrieved successfully.', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

router.post('/instruments', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = InstrSchema.parse(req.body)
    const instr = await LookupInstrument.create({
      instrumentCode: body.instrument_code,
      instrumentType: body.instrument_type || null,
      instrumentName: body.instrument_name,
      maintenanceStatus: body.maintenance_status || null,
      calibrationStatus: body.calibration_status || null,
      isActive: body.is_active ?? true,
      createdBy: req.user!.id,
    })
    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'MASTER_DATA_INSTRUMENT', entityId: instr.id, entityRef: instr.instrumentName,
      newValue: instr.toJSON() as Record<string, unknown>,
    })
    res.status(201).json(successResponse('Instrument created successfully.', instr))
  } catch (err) {
    next(err)
  }
})

router.patch('/instruments/:id', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instr = await LookupInstrument.findByPk(req.params.id as string)
    if (!instr) throw new NotFoundError('Instrument')
    const before = instr.toJSON() as Record<string, unknown>
    const body = InstrSchema.partial().parse(req.body)
    await instr.update({
      ...(body.instrument_code !== undefined && { instrumentCode: body.instrument_code }),
      ...(body.instrument_type !== undefined && { instrumentType: body.instrument_type }),
      ...(body.instrument_name !== undefined && { instrumentName: body.instrument_name }),
      ...(body.maintenance_status !== undefined && { maintenanceStatus: body.maintenance_status }),
      ...(body.calibration_status !== undefined && { calibrationStatus: body.calibration_status }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    })
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'MASTER_DATA_INSTRUMENT', entityId: instr.id, entityRef: instr.instrumentName,
      oldValue: before, newValue: instr.toJSON() as Record<string, unknown>,
    })
    res.json(successResponse('Instrument updated successfully.', instr))
  } catch (err) {
    next(err)
  }
})

router.delete('/instruments/:id', authenticate, requirePrivilege('master_data.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instr = await LookupInstrument.findByPk(req.params.id as string)
    if (!instr) throw new NotFoundError('Instrument')
    await instr.update({ isActive: false })
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'MASTER_DATA_INSTRUMENT', entityId: instr.id, entityRef: instr.instrumentName,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
