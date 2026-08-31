import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import path from 'path'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { createUploader } from '../../middleware/upload.middleware'
import { saveUpload, deleteFile } from '../../utils/files'
import { config } from '../../config'
import {
  InvManufacturerMapping,
  InvMaterial,
  InvManufacturer,
} from '../../models/InventoryModels.model'

const mappingsRouter = Router()
const multerMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// â”€â”€ Zod schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const createMappingSchema = z.object({
  materialId: z.number().int().positive(),
  manufacturerId: z.number().int().positive(),
  catalogueNo: z.string().optional().nullable(),
  technicalGrade: z.string().optional().nullable(),
  leadTimeDays: z.number().int().optional().nullable(),
  minOrderQty: z.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
})

const updateMappingSchema = createMappingSchema.partial()

// â”€â”€ Multer uploader for DSD docs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const dsdUploader = createUploader('inv-mapping-dsd')

// â”€â”€ Sequelize include options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const defaultIncludes = [
  { model: InvMaterial, as: 'material' },
  { model: InvManufacturer, as: 'manufacturer' },
]

/**
 * Flatten the joined manufacturer (and material) onto the mapping row.
 *
 * FastAPI's MappingOut schema did this via a model_validator
 * (backend/app/schemas/inventory.py) and the frontend contract still expects
 * it: `Mapping` in frontend/src/api/inventory.ts declares flat
 * `manufacturer_code` / `manufacturer_name`, and the template autofill engine
 * (templateBuilder/useInventoryOptions.ts) reads `m.manufacturer_code` to
 * auto-select the Make dropdown. Returning only the nested `manufacturer`
 * object left those undefined, so Make never auto-filled and every
 * mapping-mode column that depends on it (Cat. No., Grade, SDS) resolved to
 * an empty string.
 */
function serializeMapping(row: InstanceType<typeof InvManufacturerMapping>) {
  const json = row.toJSON() as Record<string, unknown>
  const manufacturer = json.manufacturer as { code?: string; name?: string } | null | undefined
  const material = json.material as { code?: string; name?: string } | null | undefined
  return {
    ...json,
    manufacturer_code: manufacturer?.code ?? null,
    manufacturer_name: manufacturer?.name ?? null,
    material_code: material?.code ?? null,
    material_name: material?.name ?? null,
  }
}

// Associations (define once, idempotent if called multiple times)
;(function setupAssociations() {
  if (!(InvManufacturerMapping as any).associations?.material) {
    InvManufacturerMapping.belongsTo(InvMaterial, { foreignKey: 'material_id', as: 'material' })
  }
  if (!(InvManufacturerMapping as any).associations?.manufacturer) {
    InvManufacturerMapping.belongsTo(InvManufacturer, { foreignKey: 'manufacturer_id', as: 'manufacturer' })
  }
})()

// â”€â”€ GET /mappings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, materialId, manufacturerId, catalogueNo, materialName, manufacturerName } = req.query as Record<string, string>
    const { page: pg, limit: lim, offset } = parsePagination(req.query)

    const where: any = {}
    if (materialId) where.materialId = Number(materialId)
    if (manufacturerId) where.manufacturerId = Number(manufacturerId)
    if (search) {
      where[Op.or] = [
        { catalogueNo: { [Op.iLike]: `%${search}%` } },
        { technicalGrade: { [Op.iLike]: `%${search}%` } },
        { '$material.name$': { [Op.iLike]: `%${search}%` } },
        { '$manufacturer.name$': { [Op.iLike]: `%${search}%` } },
      ]
    }
    // Per-column search filters (Mappings table)
    const andConditions: unknown[] = []
    if (catalogueNo) andConditions.push({ catalogueNo: { [Op.iLike]: `%${catalogueNo}%` } })
    if (materialName) andConditions.push({ '$material.name$': { [Op.iLike]: `%${materialName}%` } })
    if (manufacturerName) andConditions.push({ '$manufacturer.name$': { [Op.iLike]: `%${manufacturerName}%` } })
    if (andConditions.length) where[Op.and as any] = andConditions

    const { count, rows } = await InvManufacturerMapping.findAndCountAll({
      where,
      include: defaultIncludes,
      order: [['id', 'DESC']],
      limit: lim,
      offset,
    })

    res.json(listResponse('Manufacturer-material mappings', rows.map(serializeMapping), buildPagination(pg, lim, count)))
  } catch (err) { next(err) }
})

// â”€â”€ POST /mappings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createMappingSchema.parse(req.body)
    const now = new Date()
    const mapping = await InvManufacturerMapping.create({
      materialId: body.materialId,
      manufacturerId: body.manufacturerId,
      catalogueNo: body.catalogueNo ?? null,
      technicalGrade: body.technicalGrade ?? null,
      leadTimeDays: body.leadTimeDays ?? null,
      minOrderQty: body.minOrderQty ?? null,
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json(successResponse('Mapping created', mapping))
  } catch (err) { next(err) }
})

// â”€â”€ POST /mappings/upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.post('/upload', authenticate, multerMemory.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const seenPairs = new Set<string>()

    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const materialCode = String(v[1] ?? '').trim()
      const manufacturerCode = String(v[2] ?? '').trim()
      if (!materialCode || !manufacturerCode) { errors.push({ row: rowNum, message: 'material_code and manufacturer_code are required' }); continue }

      const material = await InvMaterial.findOne({ where: { code: materialCode } as any })
      if (!material) { errors.push({ row: rowNum, message: `Material not found: ${materialCode}` }); continue }
      const manufacturer = await InvManufacturer.findOne({ where: { code: manufacturerCode } as any })
      if (!manufacturer) { errors.push({ row: rowNum, message: `Manufacturer not found: ${manufacturerCode}` }); continue }

      const pairKey = `${material.id}:${manufacturer.id}`
      if (seenPairs.has(pairKey)) { errors.push({ row: rowNum, message: `Duplicate pair in file: ${materialCode}/${manufacturerCode}` }); continue }
      seenPairs.add(pairKey)

      const exists = await InvManufacturerMapping.findOne({ where: { materialId: material.id, manufacturerId: manufacturer.id } as any })
      if (exists) { errors.push({ row: rowNum, message: `Mapping already exists: ${materialCode}/${manufacturerCode}` }); continue }

      const leadTime = v[5] ? parseInt(String(v[5]), 10) : null
      const minQty = v[6] ? parseFloat(String(v[6])) : null
      const rec = await InvManufacturerMapping.create({
        materialId: material.id,
        manufacturerId: manufacturer.id,
        catalogueNo: String(v[3] ?? '').trim() || null,
        technicalGrade: String(v[4] ?? '').trim() || null,
        leadTimeDays: isNaN(leadTime as number) ? null : leadTime,
        minOrderQty: isNaN(minQty as number) ? null : minQty,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

// â”€â”€ GET /mappings/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mapping = await InvManufacturerMapping.findByPk(id, { include: defaultIncludes })
    if (!mapping) throw new NotFoundError('Mapping not found')
    res.json(successResponse('Mapping', serializeMapping(mapping)))
  } catch (err) { next(err) }
})

// â”€â”€ PATCH /mappings/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mapping = await InvManufacturerMapping.findByPk(id)
    if (!mapping) throw new NotFoundError('Mapping not found')
    const body = updateMappingSchema.parse(req.body)
    await mapping.update({ ...body, updatedAt: new Date() })
    await mapping.reload({ include: defaultIncludes })
    res.json(successResponse('Mapping updated', serializeMapping(mapping)))
  } catch (err) { next(err) }
})

// â”€â”€ DELETE /mappings/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.delete('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mapping = await InvManufacturerMapping.findByPk(id)
    if (!mapping) throw new NotFoundError('Mapping not found')
    // Clean up DSD file if present
    if (mapping.dsdFilePath) {
      deleteFile(path.resolve(config.uploadDir, mapping.dsdFilePath))
    }
    await mapping.destroy()
    res.json(successResponse('Mapping deleted', null))
  } catch (err) { next(err) }
})

// â”€â”€ POST /mappings/:id/dsd â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.post(
  '/:id/dsd',
  authenticate,
  dsdUploader.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const mapping = await InvManufacturerMapping.findByPk(id)
      if (!mapping) throw new NotFoundError('Mapping not found')

      if (!req.file) throw new BadRequestError('No file uploaded', 'NO_FILE')

      // Delete old DSD file if present
      if (mapping.dsdFilePath) {
        deleteFile(path.resolve(config.uploadDir, mapping.dsdFilePath))
      }

      const { storedPath } = saveUpload(
        req.file.path,
        req.file.originalname,
        'inv-mapping-dsd',
      )

      const relativePath = path.relative(config.uploadDir, storedPath)
      await mapping.update({ dsdFilePath: relativePath, updatedAt: new Date() })
      await mapping.reload({ include: defaultIncludes })

      res.json(successResponse('DSD file uploaded', serializeMapping(mapping)))
    } catch (err) { next(err) }
  },
)

// â”€â”€ GET /mappings/:id/dsd/download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.get('/:id/dsd/download', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mapping = await InvManufacturerMapping.findByPk(id)
    if (!mapping) throw new NotFoundError('Mapping not found')
    if (!mapping.dsdFilePath) throw new NotFoundError('No DSD file on record')

    const absPath = path.resolve(config.uploadDir, mapping.dsdFilePath)
    const downloadName = path.basename(mapping.dsdFilePath)
    res.download(absPath, downloadName)
  } catch (err) { next(err) }
})

// â”€â”€ DELETE /mappings/:id/dsd â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

mappingsRouter.delete('/:id/dsd', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mapping = await InvManufacturerMapping.findByPk(id)
    if (!mapping) throw new NotFoundError('Mapping not found')
    if (!mapping.dsdFilePath) throw new NotFoundError('No DSD file on record')

    deleteFile(path.resolve(config.uploadDir, mapping.dsdFilePath))
    await mapping.update({ dsdFilePath: null, updatedAt: new Date() })
    await mapping.reload({ include: defaultIncludes })
    res.json(successResponse('DSD file deleted', serializeMapping(mapping)))
  } catch (err) { next(err) }
})

export default mappingsRouter

