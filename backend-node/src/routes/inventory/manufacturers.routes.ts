import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import path from 'path'
import multer from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { createUploader, } from '../../middleware/upload.middleware'
import { saveUpload, deleteFile } from '../../utils/files'
import { config } from '../../config'
import { InvManufacturer } from '../../models/InventoryModels.model'

const multerMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const manufacturersRouter = Router()

// â”€â”€ Zod schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const createManufacturerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  country: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  isQualified: z.boolean().optional(),
})

const updateManufacturerSchema = createManufacturerSchema.partial()

// â”€â”€ Multer uploader for qualification docs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const qualificationUploader = createUploader('inv-manufacturer-docs')

// â”€â”€ GET /manufacturers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, activeOnly, code, name, country, contactPerson, email, phone } = req.query as Record<string, string>
    const { page: pg, limit: lim, offset } = parsePagination(req.query)

    const where: any = {}
    if (activeOnly === 'true') where.isActive = true
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { country: { [Op.iLike]: `%${search}%` } },
        { contactPerson: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ]
    }
    // Per-column search filters (Manufacturers table)
    if (code) where.code = { [Op.iLike]: `%${code}%` }
    if (name) where.name = { [Op.iLike]: `%${name}%` }
    if (country) where.country = { [Op.iLike]: `%${country}%` }
    if (contactPerson) where.contactPerson = { [Op.iLike]: `%${contactPerson}%` }
    if (email) where.email = { [Op.iLike]: `%${email}%` }
    if (phone) where.phone = { [Op.iLike]: `%${phone}%` }

    const { count, rows } = await InvManufacturer.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: lim,
      offset,
    })

    res.json(listResponse('Manufacturers', rows, buildPagination(pg, lim, count)))
  } catch (err) { next(err) }
})

// â”€â”€ POST /manufacturers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createManufacturerSchema.parse(req.body)
    const manufacturer = await InvManufacturer.create({ ...body, createdAt: new Date(), updatedAt: new Date() })
    res.status(201).json(successResponse('Manufacturer created', manufacturer))
  } catch (err) { next(err) }
})

// â”€â”€ POST /manufacturers/upload â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.post('/upload', authenticate, multerMemory.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: 'No file uploaded' }); return }
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(req.file.buffer as any)
    const ws = wb.worksheets[0]
    if (!ws) { res.status(400).json({ success: false, message: 'Empty workbook' }); return }

    const created: number[] = []
    const errors: { row: number; message: string }[] = []
    const seenCodes = new Set<string>()
    const seenNames = new Set<string>()

    ws.eachRow({ includeEmpty: false }, async () => {}) // force parse
    const allRows: any[][] = []
    ws.eachRow({ includeEmpty: false }, (row, idx) => { if (idx > 1) allRows.push(row.values as any[]) })

    for (let i = 0; i < allRows.length; i++) {
      const rowNum = i + 2
      const v = allRows[i]
      const code = String(v[1] ?? '').trim()
      const name = String(v[2] ?? '').trim()
      if (!code || !name) { errors.push({ row: rowNum, message: 'code and name are required' }); continue }
      if (seenCodes.has(code.toLowerCase())) { errors.push({ row: rowNum, message: `Duplicate code in file: ${code}` }); continue }
      if (seenNames.has(name.toLowerCase())) { errors.push({ row: rowNum, message: `Duplicate name in file: ${name}` }); continue }
      seenCodes.add(code.toLowerCase()); seenNames.add(name.toLowerCase())

      const existing = await InvManufacturer.findOne({ where: { code: { [Op.iLike]: code } } as any })
      if (existing) { errors.push({ row: rowNum, message: `Code already exists: ${code}` }); continue }

      const rec = await InvManufacturer.create({
        code,
        name,
        country: String(v[3] ?? '').trim() || null,
        contactPerson: String(v[4] ?? '').trim() || null,
        email: String(v[5] ?? '').trim() || null,
        phone: String(v[6] ?? '').trim() || null,
        website: String(v[7] ?? '').trim() || null,
        address: String(v[8] ?? '').trim() || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      created.push(rec.id)
    }

    res.json({ created: created.length, skipped: errors.length, errors: errors.map((e) => `Row ${e.row}: ${e.message}`) })
  } catch (err) { next(err) }
})

// â”€â”€ GET /manufacturers/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    res.json(successResponse('Manufacturer', mfr))
  } catch (err) { next(err) }
})

// â”€â”€ PATCH /manufacturers/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    const body = updateManufacturerSchema.parse(req.body)
    await mfr.update(body)
    res.json(successResponse('Manufacturer updated', mfr))
  } catch (err) { next(err) }
})

// â”€â”€ DELETE /manufacturers/:id/deactivate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.delete('/:id/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    await mfr.update({ isActive: false })
    res.json(successResponse('Manufacturer deactivated', mfr))
  } catch (err) { next(err) }
})

// â”€â”€ PATCH /manufacturers/:id/toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    await mfr.update({ isActive: !mfr.isActive })
    res.json(successResponse('Manufacturer toggled', mfr))
  } catch (err) { next(err) }
})

// â”€â”€ POST /manufacturers/:id/qualification-file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.post(
  '/:id/qualification-file',
  authenticate,
  qualificationUploader.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string
      const mfr = await InvManufacturer.findByPk(id)
      if (!mfr) throw new NotFoundError('Manufacturer not found')

      if (!req.file) throw new BadRequestError('No file uploaded', 'NO_FILE')

      // Delete old file if present
      if (mfr.qualificationFilePath) {
        deleteFile(path.resolve(config.uploadDir, mfr.qualificationFilePath))
      }

      const { storedPath, storedFilename } = saveUpload(
        req.file.path,
        req.file.originalname,
        'inv-manufacturer-docs',
      )

      const relativePath = path.relative(config.uploadDir, storedPath)
      await mfr.update({
        qualificationFilePath: relativePath,
      })

      res.json(successResponse('Qualification file uploaded', mfr))
    } catch (err) { next(err) }
  },
)

// â”€â”€ GET /manufacturers/:id/qualification-file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.get('/:id/qualification-file', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    if (!mfr.qualificationFilePath) throw new NotFoundError('No qualification file on record')

    const absPath = path.resolve(config.uploadDir, mfr.qualificationFilePath)
    const downloadName = path.basename(mfr.qualificationFilePath)
    res.download(absPath, downloadName)
  } catch (err) { next(err) }
})

// â”€â”€ DELETE /manufacturers/:id/qualification-file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

manufacturersRouter.delete('/:id/qualification-file', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const mfr = await InvManufacturer.findByPk(id)
    if (!mfr) throw new NotFoundError('Manufacturer not found')
    if (!mfr.qualificationFilePath) throw new NotFoundError('No qualification file on record')

    deleteFile(path.resolve(config.uploadDir, mfr.qualificationFilePath))
    await mfr.update({ qualificationFilePath: null })
    res.json(successResponse('Qualification file deleted', mfr))
  } catch (err) { next(err) }
})

export default manufacturersRouter

