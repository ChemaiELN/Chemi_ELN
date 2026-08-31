import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import {
  InvMaterial,
  InvMaterialChemicalProp,
  InvMaterialFormulationProp,
  InvMaterialCodeCounter,
  InvConsumableType,
} from '../../models/InventoryModels.model'

/**
 * The Python backend's MaterialOut schema serialized the SQLAlchemy
 * `chemical_props`/`formulation_props` relationships on every response
 * (list, get, create, update) — see backend/app/schemas/inventory.py:185-186.
 * No Sequelize association was ever declared for the Node port, so every
 * materials response omitted both, and MaterialsPage's edit modal — which
 * reads `m.chemical_props?.grade` to populate the Technical Grade select —
 * always saw `undefined` and rendered the field blank, even though the value
 * was saved correctly via PUT /materials/:id/chemical-props.
 */
;(function setupMaterialAssociations() {
  if (!(InvMaterial as any).associations?.chemical_props) {
    InvMaterial.hasOne(InvMaterialChemicalProp, { foreignKey: 'materialId', as: 'chemical_props' })
  }
  if (!(InvMaterial as any).associations?.formulation_props) {
    InvMaterial.hasOne(InvMaterialFormulationProp, { foreignKey: 'materialId', as: 'formulation_props' })
  }
})()

const materialIncludes = [
  { model: InvMaterialChemicalProp, as: 'chemical_props' },
  { model: InvMaterialFormulationProp, as: 'formulation_props' },
]

const memUploader = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const materialsRouter = Router()

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatMaterialCode(year: string, seq: number): string {
  return `MAT/${year}/${String(seq).padStart(5, '0')}`
}

async function peekNextCode(): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2)
  const counter = await InvMaterialCodeCounter.findOne({ where: { year } })
  const next = counter ? counter.lastSeq + 1 : 10001
  return formatMaterialCode(year, next)
}

export async function claimNextCode(transaction: any): Promise<string> {
  const year = String(new Date().getFullYear()).slice(-2)
  const [counter] = await InvMaterialCodeCounter.findOrCreate({
    where: { year },
    defaults: { year, lastSeq: 10000 },
    transaction,
    lock: true,
  })
  await counter.reload({ transaction, lock: true })
  counter.lastSeq = (counter.lastSeq ?? 10000) + 1
  await counter.save({ transaction })
  return formatMaterialCode(year, counter.lastSeq)
}

// â”€â”€ Zod schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Numeric columns are DECIMAL in Postgres, so Sequelize serialises them as strings
// (e.g. "1032.0300"). The edit form echoes those values straight back, so accept
// numeric strings as well as numbers here.
const numericField = z.preprocess(
  (v) => (v === '' ? null : typeof v === 'string' ? Number(v) : v),
  z.number().refine((n) => Number.isFinite(n), 'Expected a number').optional().nullable(),
)

const createMaterialSchema = z.object({
  name: z.string().min(1),
  materialType: z.string().optional().nullable(),
  casNo: z.string().optional().nullable(),
  molecularFormula: z.string().optional().nullable(),
  molWeight: numericField,
  storageCondition: z.string().optional().nullable(),
  hazardClass: z.string().optional().nullable(),
  isoType: z.string().optional().nullable(),
  antibioticResistanceMarker: z.string().optional().nullable(),
  stockConcentration: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  consumableTypeId: z.preprocess(
    (v) => (v === '' ? null : typeof v === 'string' ? Number(v) : v),
    z.number().int().positive().optional().nullable(),
  ),
})

const updateMaterialSchema = createMaterialSchema.partial()

const chemicalPropSchema = z.object({
  purityPct: numericField,
  grade: z.string().optional().nullable(),
  appearance: z.string().optional().nullable(),
  solubility: z.string().optional().nullable(),
  boilingPt: numericField,
  meltingPt: numericField,
  flashPt: numericField,
  density: numericField,
  phRange: z.string().optional().nullable(),
})

const formulationPropSchema = z.object({
  role: z.string().optional().nullable(),
  concentration: numericField,
  units: z.string().optional().nullable(),
  function: z.string().optional().nullable(),
  compatibilityNotes: z.string().optional().nullable(),
})

// â”€â”€ GET /materials/next-code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/next-code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = await peekNextCode()
    res.json(successResponse('Next material code preview', { code }))
  } catch (err) { next(err) }
})

// â”€â”€ GET /materials/export.xlsx â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/export.xlsx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, materialType, consumableTypeId, departmentId, activeOnly } = req.query as Record<string, string>

    const where: any = {}
    if (activeOnly === 'true') where.isActive = true
    if (materialType) where.materialType = materialType
    if (consumableTypeId) where.consumableTypeId = Number(consumableTypeId)
    if (departmentId) where.departmentId = departmentId
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { casNo: { [Op.iLike]: `%${search}%` } },
        { materialType: { [Op.iLike]: `%${search}%` } },
        { molecularFormula: { [Op.iLike]: `%${search}%` } },
        { storageCondition: { [Op.iLike]: `%${search}%` } },
        { hazardClass: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const rows = await InvMaterial.findAll({ where, order: [['code', 'ASC']] })

    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Materials')

    sheet.columns = [
      { header: 'Code', key: 'code', width: 18 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Material Type', key: 'materialType', width: 20 },
      { header: 'CAS No', key: 'casNo', width: 15 },
      { header: 'Molecular Formula', key: 'molecularFormula', width: 20 },
      { header: 'Mol. Weight', key: 'molWeight', width: 14 },
      { header: 'Storage Condition', key: 'storageCondition', width: 22 },
      { header: 'Hazard Class', key: 'hazardClass', width: 16 },
      { header: 'ISO Type', key: 'isoType', width: 12 },
      { header: 'Active', key: 'isActive', width: 10 },
    ]

    for (const row of rows) {
      sheet.addRow({
        code: row.code,
        name: row.name,
        materialType: row.materialType ?? '',
        casNo: row.casNo ?? '',
        molecularFormula: row.molecularFormula ?? '',
        molWeight: row.molWeight ?? '',
        storageCondition: row.storageCondition ?? '',
        hazardClass: row.hazardClass ?? '',
        isoType: row.isoType ?? '',
        isActive: row.isActive ? 'Yes' : 'No',
      })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=materials.xlsx')
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
})

// â”€â”€ GET /materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      search, materialType, materialTypeSearch, consumableTypeId, departmentId, activeOnly,
      code, name, casNo, molecularFormula, storageCondition, hazardClass,
    } = req.query as Record<string, string>
    const { page: pg, limit: lim, offset } = parsePagination(req.query)

    const where: any = {}
    if (activeOnly === 'true') where.isActive = true
    // Column-header search box (Materials table) -- partial match, distinct from
    // the exact-match `materialType` param other pickers/dropdowns rely on.
    if (materialTypeSearch) where.materialType = { [Op.iLike]: `%${materialTypeSearch}%` }
    if (materialType) where.materialType = materialType
    if (consumableTypeId) where.consumableTypeId = Number(consumableTypeId)
    if (departmentId) where.departmentId = departmentId
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { casNo: { [Op.iLike]: `%${search}%` } },
        { materialType: { [Op.iLike]: `%${search}%` } },
        { molecularFormula: { [Op.iLike]: `%${search}%` } },
        { storageCondition: { [Op.iLike]: `%${search}%` } },
        { hazardClass: { [Op.iLike]: `%${search}%` } },
      ]
    }
    // Per-column search filters — each is independent so multiple columns
    // can be filtered at once, in addition to (or instead of) the single
    // combined `search` box above.
    if (code) where.code = { [Op.iLike]: `%${code}%` }
    if (name) where.name = { [Op.iLike]: `%${name}%` }
    if (casNo) where.casNo = { [Op.iLike]: `%${casNo}%` }
    if (molecularFormula) where.molecularFormula = { [Op.iLike]: `%${molecularFormula}%` }
    if (storageCondition) where.storageCondition = { [Op.iLike]: `%${storageCondition}%` }
    if (hazardClass) where.hazardClass = { [Op.iLike]: `%${hazardClass}%` }

    const { count, rows } = await InvMaterial.findAndCountAll({
      where,
      include: materialIncludes,
      order: [['createdAt', 'DESC']],
      limit: lim,
      offset,
    })

    res.json(listResponse('Materials', rows, buildPagination(pg, lim, count)))
  } catch (err) { next(err) }
})

// â”€â”€ POST /materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createMaterialSchema.parse(req.body)
    const t = await sequelize.transaction()
    try {
      const code = await claimNextCode(t)
      const material = await InvMaterial.create({ ...body, code, createdAt: new Date(), updatedAt: new Date() }, { transaction: t })
      await t.commit()
      // Reload with the (empty, at creation time) prop associations so the
      // response shape matches every other materials endpoint.
      await material.reload({ include: materialIncludes })
      res.status(201).json(successResponse('Material created', material))
    } catch (inner) {
      await t.rollback()
      throw inner
    }
  } catch (err) { next(err) }
})

// â”€â”€ GET /materials/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id, { include: materialIncludes })
    if (!material) throw new NotFoundError('Material not found')
    res.json(successResponse('Material', material))
  } catch (err) { next(err) }
})

// â”€â”€ PATCH /materials/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    const body = updateMaterialSchema.parse(req.body)
    await material.update(body)
    await material.reload({ include: materialIncludes })
    res.json(successResponse('Material updated', material))
  } catch (err) { next(err) }
})

// â”€â”€ DELETE /materials/:id/deactivate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.delete('/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    await material.update({ isActive: false })
    res.json(successResponse('Material deactivated', material))
  } catch (err) { next(err) }
})

// â”€â”€ PATCH /materials/:id/toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    await material.update({ isActive: !material.isActive })
    res.json(successResponse('Material toggled', material))
  } catch (err) { next(err) }
})

// â”€â”€ GET /materials/:id/chemical-props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/:id/chemical-props', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    const props = await InvMaterialChemicalProp.findOne({ where: { materialId: Number(id) } })
    res.json(successResponse('Chemical properties', props ?? null))
  } catch (err) { next(err) }
})

// â”€â”€ PUT /materials/:id/chemical-props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.put('/:id/chemical-props', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    const body = chemicalPropSchema.parse(req.body)
    const [props] = await InvMaterialChemicalProp.findOrCreate({
      where: { materialId: Number(id) },
      defaults: { materialId: Number(id), ...body },
    })
    await props.update(body)
    res.json(successResponse('Chemical properties saved', props))
  } catch (err) { next(err) }
})

// â”€â”€ GET /materials/:id/formulation-props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.get('/:id/formulation-props', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    const props = await InvMaterialFormulationProp.findOne({ where: { materialId: Number(id) } })
    res.json(successResponse('Formulation properties', props ?? null))
  } catch (err) { next(err) }
})

// â”€â”€ PUT /materials/:id/formulation-props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.put('/:id/formulation-props', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const material = await InvMaterial.findByPk(id)
    if (!material) throw new NotFoundError('Material not found')
    const body = formulationPropSchema.parse(req.body)
    const [props] = await InvMaterialFormulationProp.findOrCreate({
      where: { materialId: Number(id) },
      defaults: { materialId: Number(id), ...body },
    })
    await props.update(body)
    res.json(successResponse('Formulation properties saved', props))
  } catch (err) { next(err) }
})

// â”€â”€ POST /materials/upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

materialsRouter.post('/upload', authenticate, memUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const seenCas = new Set<string>()
    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const name = String(v[1] ?? '').trim()
      const casNo = String(v[3] ?? '').trim() || null
      if (!name) { errors.push({ row: rowNum, message: 'name is required' }); continue }

      if (casNo) {
        if (seenCas.has(casNo)) { errors.push({ row: rowNum, message: `Duplicate CAS No in file: ${casNo}` }); continue }
        seenCas.add(casNo)
        const existing = await InvMaterial.findOne({ where: { casNo } as any })
        if (existing) { errors.push({ row: rowNum, message: `CAS No already exists: ${casNo}` }); continue }
      }

      const ctName = String(v[8] ?? '').trim()
      let consumableTypeId: number | null = null
      if (ctName) {
        const ct = await InvConsumableType.findOne({ where: { name: { [Op.iLike]: ctName } } as any })
        if (!ct) { errors.push({ row: rowNum, message: `Consumable type not found: ${ctName}` }); continue }
        consumableTypeId = ct.id
      }

      const molW = v[5] ? parseFloat(String(v[5])) : null
      const code = await sequelize.transaction(async (t) => claimNextCode(t))

      const rec = await InvMaterial.create({
        code,
        name,
        materialType: String(v[2] ?? '').trim() || null,
        casNo,
        molecularFormula: String(v[4] ?? '').trim() || null,
        molWeight: isNaN(molW as number) ? null : molW,
        storageCondition: String(v[6] ?? '').trim() || null,
        hazardClass: String(v[7] ?? '').trim() || null,
        consumableTypeId,
        description: String(v[9] ?? '').trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

export default materialsRouter

