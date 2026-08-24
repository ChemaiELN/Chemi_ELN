import fs from 'fs'
import path from 'path'
import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import ExcelJS from 'exceljs'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination, parseSort } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { createUploader } from '../../middleware/upload.middleware'
import { deleteFile, getAbsoluteUploadPath } from '../../utils/files'
import {
  InvBatch,
  InvBatchEvent,
  InvBatchPack,
  InvBatchNoCounter,
  InvMaterial,
  InvManufacturer,
} from '../../models/InventoryModels.model'
import { IdSequenceConfig, IdSequenceCounter } from '../../models/IdSequence.model'
import { generateNextSequenceValue } from '../../utils/idSequence'
import { Department } from '../../models/Department.model'
import { claimNextCode } from './materials.routes'

// Inhouse Batch No = <first 5 letters of material type>/<shared sequence>.
// The numeric sequence itself is a single counter shared across every
// material type (not one counter per type) — this matches the pre-existing
// historical data (ANTIB/26/10009, RAWMA/26/10014, CONSU/26/10011, ... all
// draw from the same running number) — and is delegated to the generic
// Admin > ID Numbering engine (id_sequence_configs/id_sequence_counters,
// config code INV_INHOUSE_BATCH_NO) instead of a bespoke counter table, so
// its digit count / year format can be managed from that same admin screen.
const INHOUSE_SEQUENCE_CODE = 'INV_INHOUSE_BATCH_NO'

// "RAW MATERIAL" -> "RAWMA", "Chemical & Solvents" -> "CHEMI" — strip spaces/
// punctuation first so short first words (e.g. "RAW") don't get padded out
// with a literal space before reaching 5 characters.
function inhouseTypePrefix(materialType: string): string {
  return materialType.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
}

// RETEST is a computed, display-only status — never persisted. A batch shows
// RETEST once its retest_date has passed, but only while it's otherwise
// AVAILABLE/PARTIALLY_CONSUMED; a CONSUMED or QUARANTINE batch keeps its own
// status regardless of retest date.
const RETESTABLE_STATUSES = new Set(['AVAILABLE', 'PARTIALLY_CONSUMED'])

function computeEffectiveStatus(status: string | null | undefined, retestDate: string | null | undefined): string | null | undefined {
  if (!retestDate || !status || !RETESTABLE_STATUSES.has(status)) return status
  const today = new Date().toISOString().split('T')[0]
  return retestDate < today ? 'RETEST' : status
}

const batchesRouter = Router()

const coaUploader = createUploader('inventory/coa')
const docsUploader = createUploader('inventory/docs')

// ── Counter helpers ───────────────────────────────────────────────────────────

async function previewMceBatchNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const row = await InvBatchNoCounter.findOne({ where: { year: yy } })
  const nextSeq = (row?.lastSeq ?? 0) + 1
  return `MCE/${yy}/${String(nextSeq).padStart(5, '0')}`
}

async function getNextPackSeq(batchId: number): Promise<number> {
  const [result] = await sequelize.query(
    `SELECT COALESCE(MAX(seq_no), 0) AS max_seq FROM inv_batch_packs WHERE batch_id = :batchId`,
    { replacements: { batchId }, type: QueryTypes.SELECT },
  ) as [{ max_seq: number }]
  return (result?.max_seq ?? 0) + 1
}

async function generateInhouseNo(materialType: string): Promise<string> {
  const prefix = inhouseTypePrefix(materialType)
  const { value } = await generateNextSequenceValue(INHOUSE_SEQUENCE_CODE)
  return `${prefix}/${value}`
}

// Read-only peek at what generateInhouseNo would produce next, without
// consuming a sequence value (used by the New Batch modal to display the
// number before the batch is actually saved).
async function previewInhouseNo(materialType: string): Promise<string> {
  const prefix = inhouseTypePrefix(materialType)
  const config = await IdSequenceConfig.findOne({ where: { code: INHOUSE_SEQUENCE_CODE, isActive: true } })
  if (!config) throw new BadRequestError(`ID sequence configuration '${INHOUSE_SEQUENCE_CODE}' not found.`, 'SEQUENCE_NOT_FOUND')

  const fullYear = new Date().getFullYear()
  const year = config.yearDigits === 4 ? fullYear : fullYear % 100
  const counter = await IdSequenceCounter.findOne({
    where: { configId: config.id, year: config.includeYear ? year : null },
  })
  const nextSeq = (counter?.lastValue ?? 0) + 1
  const seqStr = String(nextSeq).padStart(config.sequenceDigits, '0')

  const parts: string[] = []
  if (config.prefix) parts.push(config.prefix)
  if (config.includeYear) parts.push(String(year))
  parts.push(seqStr)

  return `${prefix}/${parts.join(config.separator || '/')}`
}

// ── Number previews ───────────────────────────────────────────────────────────

batchesRouter.get('/next-batch-no', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const batchNo = await previewMceBatchNo()
    res.json(successResponse('Next MCE batch number', { batchNo }))
  } catch (err) {
    next(err)
  }
})

batchesRouter.get('/next-pack-seq', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.query as Record<string, string>
    if (!batchId) throw new BadRequestError('batchId is required', 'MISSING_PARAM')
    const nextSeq = await getNextPackSeq(Number(batchId))
    res.json(successResponse('Next pack sequence', { nextSeq }))
  } catch (err) {
    next(err)
  }
})

batchesRouter.get('/next-inhouse-no', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { material_type } = req.query as Record<string, string>
    if (!material_type) throw new BadRequestError('material_type is required', 'MISSING_PARAM')
    const inhouseBatchNo = await previewInhouseNo(material_type)
    res.json(successResponse('Next in-house batch number', { inhouseBatchNo }))
  } catch (err) {
    next(err)
  }
})

// ── List & Export ─────────────────────────────────────────────────────────────

batchesRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { materialId, materialCode, departmentId, status, category, search, statusGroup } = req.query as Record<string, string>
    // Frontend sends `expand_packs=1` (BatchesPage.tsx) — accept both the raw
    // query key and a couple of truthy encodings.
    const expandPacksRaw = (req.query.expand_packs ?? req.query.expandPacks) as string | undefined
    const expandPacks = expandPacksRaw === '1' || expandPacksRaw === 'true'
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = {}
    if (materialId) where.materialId = Number(materialId)
    if (category) where.category = category

    // Both the statusGroup filter and the search filter below need their own
    // OR clause — combine them with Op.and instead of both writing to the
    // same where[Op.or] key, which would let one silently clobber the other.
    const andConditions: unknown[] = []

    // "Non Available Batches" page: RETEST is computed (never stored), so it
    // can't be matched with a plain status equality — match its underlying
    // condition (AVAILABLE/PARTIALLY_CONSUMED past retest_date) directly,
    // OR'd with the (rare, manually-set) EXPIRED status.
    if (statusGroup === 'non_available') {
      const todayStr = new Date().toISOString().split('T')[0]
      andConditions.push({
        [Op.or]: [
          { status: 'EXPIRED' },
          {
            status: { [Op.in]: [...RETESTABLE_STATUSES] },
            retestDate: { [Op.ne]: null, [Op.lt]: todayStr },
          },
        ],
      })
    } else if (status) {
      where.status = status
    }

    const materialWhere: Record<string, unknown> = {}
    if (materialCode) materialWhere.code = materialCode
    if (departmentId) materialWhere.departmentId = departmentId
    if (search) {
      andConditions.push({
        [Op.or]: [
          { batchNo: { [Op.iLike]: `%${search}%` } },
          { inhouseBatchNo: { [Op.iLike]: `%${search}%` } },
          { invoiceNo: { [Op.iLike]: `%${search}%` } },
          { bin: { [Op.iLike]: `%${search}%` } },
          { status: { [Op.iLike]: `%${search}%` } },
          { '$material.name$': { [Op.iLike]: `%${search}%` } },
          { '$manufacturer.name$': { [Op.iLike]: `%${search}%` } },
        ],
      })
    }
    if (andConditions.length) where[Op.and as any] = andConditions

    const include: any[] = [
      { model: InvMaterial, as: 'material', attributes: ['id', 'code', 'name', 'materialType', 'departmentId'], where: Object.keys(materialWhere).length ? materialWhere : undefined, required: Object.keys(materialWhere).length > 0 },
      { model: InvManufacturer, as: 'manufacturer', attributes: ['id', 'name'], required: false },
    ]
    if (expandPacks) {
      // `separate: true` runs packs as its own follow-up query instead of a SQL
      // JOIN. Without it, the hasMany join fans each batch out into one row per
      // pack *before* LIMIT/OFFSET is applied, so pagination slices mid-batch
      // (a multi-pack batch can span two pages, or crowd out other batches on
      // one page) and the plain count comes back inflated by the join fanout.
      include.push({ model: InvBatchPack, as: 'packs', required: false, separate: true })
    }

    // sort_by/sort_dir were being dropped here, so none of the table's column
    // sorters actually changed the order the server returned.
    //
    // material_name / manufacturer_name live on joined tables rather than on
    // inv_batches, so they sort through the association. (pack_sku cannot: packs
    // are fetched as a separate one-to-many query, so there is no single pack
    // row to order a batch by — that column has no sorter.)
    const rawSort = String(req.query.sortBy ?? req.query.sort_by ?? '')
    const sortDesc = String(req.query.sortDir ?? req.query.sort_dir ?? 'asc').toLowerCase() === 'desc'
    const assocSort: Record<string, [any, string]> = {
      material_name: [{ model: InvMaterial, as: 'material' }, 'name'],
      manufacturer_name: [{ model: InvManufacturer, as: 'manufacturer' }, 'name'],
    }
    const order: any = assocSort[rawSort]
      ? [[...assocSort[rawSort]!, sortDesc ? 'DESC' : 'ASC']]
      : parseSort(req.query as Record<string, unknown>, InvBatch, [['createdAt', 'DESC']])

    const { count, rows } = await InvBatch.findAndCountAll({
      where,
      include,
      limit,
      offset,
      distinct: true,
      order,
    })

    // Flatten each batch to the shape the frontend's Batch type expects:
    // material_name / manufacturer_name pulled out of the nested associations,
    // and — when expand_packs is set — one row per pack with its own
    // qty_available / qty_received / pack_sku / row_key (batches without
    // packs still get a single row so every batch is represented).
    // inhouse_batch_no stays the BATCH's real value on every row — it's
    // NOT the same thing as the per-pack SKU (pack_sku already covers
    // that), so it must not be overwritten per pack.
    const flattened = rows.flatMap((batch) => {
      const b = batch.get({ plain: true }) as any
      const base: Record<string, unknown> = {
        ...b,
        status: computeEffectiveStatus(b.status, b.retestDate),
        materialName: b.material?.name ?? null,
        manufacturerName: b.manufacturer?.name ?? null,
      }
      delete base.material
      delete base.manufacturer

      if (expandPacks && b.includePack && Array.isArray(b.packs) && b.packs.length > 0) {
        return b.packs.map((pack: any) => ({
          ...base,
          qtyReceived: pack.qtyPerPack,
          qtyAvailable: pack.qtyAvailable,
          packSku: pack.packNo,
          packId: pack.id,
          rowKey: `${b.id}-${pack.id}`,
        }))
      }

      return [{ ...base, packSku: null, packId: null, rowKey: String(b.id) }]
    })

    res.json(listResponse('Batches', flattened, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

batchesRouter.get('/export.xlsx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { materialId, materialCode, departmentId, status, category, search, statusGroup } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (materialId) where.materialId = Number(materialId)
    if (category) where.category = category

    const andConditions: unknown[] = []
    if (statusGroup === 'non_available') {
      const todayStr = new Date().toISOString().split('T')[0]
      andConditions.push({
        [Op.or]: [
          { status: 'EXPIRED' },
          {
            status: { [Op.in]: [...RETESTABLE_STATUSES] },
            retestDate: { [Op.ne]: null, [Op.lt]: todayStr },
          },
        ],
      })
    } else if (status) {
      where.status = status
    }

    const materialWhere: Record<string, unknown> = {}
    if (materialCode) materialWhere.code = materialCode
    if (departmentId) materialWhere.departmentId = departmentId
    if (search) {
      andConditions.push({
        [Op.or]: [
          { batchNo: { [Op.iLike]: `%${search}%` } },
          { inhouseBatchNo: { [Op.iLike]: `%${search}%` } },
          { invoiceNo: { [Op.iLike]: `%${search}%` } },
          { bin: { [Op.iLike]: `%${search}%` } },
          { status: { [Op.iLike]: `%${search}%` } },
          { '$material.name$': { [Op.iLike]: `%${search}%` } },
        ],
      })
    }
    if (andConditions.length) where[Op.and as any] = andConditions

    const rows = await InvBatch.findAll({
      where,
      include: [
        { model: InvMaterial, as: 'material', attributes: ['id', 'code', 'name', 'materialType'], where: Object.keys(materialWhere).length ? materialWhere : undefined, required: Object.keys(materialWhere).length > 0 },
      ],
      // Same sort as the on-screen table, which passes sort_by/sort_dir through.
      order: parseSort(req.query as Record<string, unknown>, InvBatch, [['createdAt', 'DESC']]) as any,
    })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Batches')
    sheet.columns = [
      { header: 'Batch No', key: 'batchNo', width: 20 },
      { header: 'Material Code', key: 'materialCode', width: 15 },
      { header: 'Material Name', key: 'materialName', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Qty Received', key: 'qtyReceived', width: 15 },
      { header: 'Qty Available', key: 'qtyAvailable', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Inhouse Batch No', key: 'inhouseBatchNo', width: 20 },
      { header: 'Mfg Date', key: 'mfgDate', width: 15 },
      { header: 'Expiry Date', key: 'expiryDate', width: 15 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Invoice No', key: 'invoiceNo', width: 20 },
      { header: 'PO No', key: 'poNo', width: 20 },
    ]

    for (const b of rows) {
      const mat = (b as any).material
      sheet.addRow({
        batchNo: b.batchNo,
        materialCode: mat?.code ?? '',
        materialName: mat?.name ?? '',
        status: computeEffectiveStatus(b.status, b.retestDate),
        category: b.category,
        qtyReceived: b.qtyReceived,
        qtyAvailable: b.qtyAvailable,
        unit: b.unit,
        inhouseBatchNo: b.inhouseBatchNo ?? '',
        mfgDate: b.mfgDate ?? '',
        expiryDate: b.expiryDate ?? '',
        location: b.location ?? '',
        invoiceNo: b.invoiceNo ?? '',
        poNo: b.poNo ?? '',
      })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="batches.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    next(err)
  }
})

// ── Create ────────────────────────────────────────────────────────────────────

batchesRouter.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!
    const performedBy = (user as any).username ?? (user as any).email ?? String((user as any).id)
    const body = req.body

    // The Inhouse Batch No shown in the New Batch form comes from the
    // read-only /next-inhouse-no preview, which does NOT consume a sequence
    // value — trusting body.inhouseBatchNo here would let two concurrent
    // submissions for the same material type walk away with the same
    // number. Generate the real, sequence-consuming value server-side at
    // creation time instead, and ignore whatever the client sent.
    const material = await InvMaterial.findByPk(body.materialId)
    if (!material) throw new BadRequestError('Material not found', 'MATERIAL_NOT_FOUND')
    const inhouseBatchNo = await generateInhouseNo(material.materialType ?? 'GEN')

    // MFG Batch No is a mandatory, user-entered field on the New Batch form
    // — it must NOT be auto-generated or silently overwritten.
    const batchNo = typeof body.batchNo === 'string' ? body.batchNo.trim() : ''
    if (!batchNo) throw new BadRequestError('MFG Batch No is required', 'MISSING_BATCH_NO')

    // A Pack Type on its own always produces at least one SKU/Pack ID row.
    // Single vs Multi isn't a separate mode — it's derived purely from
    // Number of Packs (defaults to 1; >1 means Multi): either all packs
    // share "Qty Received per Pack" uniformly, or each is individually
    // entered when "Same Qty Received per Pack" is unchecked. The batch's
    // own qty_received/qty_available is the sum across packs.
    let packQuantities: number[] = []
    if (body.includePack && body.packType) {
      const packCount = Number(body.packNumber) || 1
      if (!Number.isInteger(packCount) || packCount < 1) {
        throw new BadRequestError('Number of Packs must be a positive integer', 'INVALID_PACK_NUMBER')
      }
      if (packCount > 1 && body.sameQtyPerPack === false) {
        const provided = Array.isArray(body.packQuantities) ? body.packQuantities : []
        if (provided.length !== packCount) {
          throw new BadRequestError('Provide a quantity for every pack', 'INVALID_PACK_QUANTITIES')
        }
        packQuantities = provided.map((q: unknown) => Number(q))
      } else {
        packQuantities = Array(packCount).fill(Number(body.qtyReceived))
      }
      if (packQuantities.some((q) => !Number.isFinite(q) || q < 0)) {
        throw new BadRequestError('Pack quantities must be non-negative numbers', 'INVALID_PACK_QUANTITIES')
      }
    }
    const totalQty = packQuantities.length > 0
      ? packQuantities.reduce((sum, q) => sum + q, 0)
      : Number(body.qtyReceived)

    const t = await sequelize.transaction()
    try {
      const batch = await InvBatch.create({
        batchNo,
        materialId: body.materialId,
        manufacturerId: body.manufacturerId ?? null,
        stockRequestId: body.stockRequestId ?? null,
        qtyReceived: totalQty,
        qtyAvailable: totalQty,
        unit: body.unit ?? 'g',
        status: body.status ?? 'AVAILABLE',
        category: body.category ?? 'available',
        measuringUnit: body.measuringUnit ?? null,
        measuringUnitValue: body.measuringUnitValue ?? null,
        includePack: body.includePack ?? false,
        packNumber: body.packNumber ?? null,
        packType: body.packType ?? null,
        packMode: body.packMode ?? null,
        inhouseBatchNo,
        mfgDate: body.mfgDate ?? null,
        expiryDate: body.expiryDate ?? null,
        retestDate: body.retestDate ?? null,
        grDate: body.grDate ?? null,
        location: body.location ?? null,
        bin: body.bin ?? null,
        invoiceNo: body.invoiceNo ?? null,
        poNo: body.poNo ?? null,
        clone: body.clone ?? null,
        price: body.price ?? null,
        receivedBy: body.receivedBy ?? performedBy,
        receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(),
        remarks: body.remarks ?? null,
        coaFilePath: null,
        coaFilename: null,
        otherDocsFilePath: null,
        otherDocsFilename: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { transaction: t })

      await InvBatchEvent.create({
        batchId: batch.id,
        eventType: 'RECEIVED',
        qty: totalQty,
        refNo: batchNo,
        module: 'INVENTORY',
        issuedTo: null,
        purpose: body.remarks ?? null,
        projectCode: null,
        performedBy,
        performedAt: new Date(),
        remarks: body.remarks ?? null,
      }, { transaction: t })

      if (packQuantities.length > 0) {
        const letter = (String(body.packType).trim().charAt(0) || 'P').toUpperCase()
        for (let i = 0; i < packQuantities.length; i++) {
          const packNo = `${inhouseBatchNo}/${letter}${i + 1}`
          await InvBatchPack.create({
            batchId: batch.id,
            seqNo: i + 1,
            packNo,
            qtyPerPack: packQuantities[i],
            qtyAvailable: packQuantities[i],
            inhouseBatchNo: packNo,
          }, { transaction: t })
        }
      }

      await t.commit()
      res.status(201).json(successResponse('Batch created', batch))
    } catch (err) {
      await t.rollback()
      throw err
    }
  } catch (err) {
    next(err)
  }
})

// ── Single batch ──────────────────────────────────────────────────────────────

batchesRouter.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id), {
      include: [
        { model: InvBatchEvent, as: 'events', required: false, order: [['performedAt', 'DESC']] as any },
        { model: InvBatchPack, as: 'packs', required: false },
        { model: InvMaterial, as: 'material', required: false },
      ],
    })
    if (!batch) throw new NotFoundError('Batch not found')
    const plain = batch.get({ plain: true }) as any
    plain.status = computeEffectiveStatus(plain.status, plain.retestDate)
    res.json(successResponse('Batch', plain))
  } catch (err) {
    next(err)
  }
})

// ── Update ────────────────────────────────────────────────────────────────────

batchesRouter.patch('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')

    const allowed = [
      'manufacturerId', 'stockRequestId', 'unit', 'status', 'category',
      'measuringUnit', 'measuringUnitValue', 'includePack', 'packNumber',
      'packType', 'packMode', 'inhouseBatchNo', 'mfgDate', 'expiryDate',
      'retestDate', 'grDate', 'location', 'bin', 'invoiceNo', 'poNo',
      'clone', 'price', 'receivedBy', 'receivedAt', 'remarks',
    ]
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    updates.updatedAt = new Date()
    await batch.update(updates)
    res.json(successResponse('Batch updated', batch))
  } catch (err) {
    next(err)
  }
})

// ── Toggle active ─────────────────────────────────────────────────────────────

batchesRouter.patch('/:id/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')
    const newStatus = batch.status === 'QUARANTINE' ? 'AVAILABLE' : 'QUARANTINE'
    await batch.update({ status: newStatus, updatedAt: new Date() })
    res.json(successResponse('Batch status toggled', { id: batch.id, status: newStatus }))
  } catch (err) {
    next(err)
  }
})

// ── Reconcile ─────────────────────────────────────────────────────────────────

batchesRouter.post('/:id/reconcile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    // `qty` is additive (positive = add stock, negative = remove). Matches FastAPI deduct_qty semantics.
    const { qty, reason } = req.body
    if (qty === undefined) throw new BadRequestError('qty is required', 'MISSING_PARAM')

    const user = req.user!
    const performedBy = (user as any).username ?? (user as any).email ?? String((user as any).id)

    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')

    const prevQty = Number(batch.qtyAvailable)
    const newQty = prevQty + Number(qty)
    await batch.update({ qtyAvailable: newQty, updatedAt: new Date() })

    await InvBatchEvent.create({
      batchId: batch.id,
      eventType: 'RECONCILE',
      qty: Number(qty),
      refNo: batch.batchNo,
      module: 'INVENTORY',
      issuedTo: null,
      purpose: reason ?? null,
      projectCode: null,
      performedBy,
      performedAt: new Date(),
      remarks: reason ?? null,
    })

    res.json(successResponse('Batch reconciled', { id: batch.id, qtyAvailable: newQty }))
  } catch (err) {
    next(err)
  }
})

// ── Issuance (two identical endpoints as per spec) ────────────────────────────

const BLOCKED_STATUSES = ['CONSUMED', 'EXPIRED', 'QUARANTINE', 'RETEST']

async function handleIssuance(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string
    const { issuedQty, issuedTo, purpose, projectCode, refNo, packId, remarks } = req.body
    if (issuedQty === undefined) throw new BadRequestError('issuedQty is required', 'MISSING_PARAM')

    const user = req.user!
    const performedBy = (user as any).username ?? (user as any).email ?? String((user as any).id)

    const t = await sequelize.transaction()
    try {
      const batch = await InvBatch.findByPk(Number(id), { transaction: t, lock: true })
      if (!batch) throw new NotFoundError('Batch not found')

      const effectiveStatus = computeEffectiveStatus(batch.status, batch.retestDate)
      if (BLOCKED_STATUSES.includes(effectiveStatus ?? '')) {
        throw new BadRequestError(`Cannot issue from a batch with status ${effectiveStatus}`, 'BATCH_STATUS_BLOCKED')
      }

      const currentQty = Number(batch.qtyAvailable)
      if (Number(issuedQty) > currentQty) throw new BadRequestError(`Insufficient quantity available (${currentQty})`, 'INSUFFICIENT_QTY')

      const newQty = currentQty - Number(issuedQty)

      // Deduct from the exact SKU/Pack ID the user picked in the table row —
      // not FIFO across every pack. Batches with no packs at all (packId
      // null) just deduct from the batch's own qty_available directly.
      if (packId != null) {
        const pack = await InvBatchPack.findOne({
          where: { id: Number(packId), batchId: batch.id },
          transaction: t,
          lock: true,
        })
        if (!pack) throw new NotFoundError('Pack not found on this batch')
        const packQty = Number(pack.qtyAvailable)
        if (Number(issuedQty) > packQty) throw new BadRequestError(`Insufficient quantity available on this pack (${packQty})`, 'INSUFFICIENT_QTY')
        await pack.update({ qtyAvailable: packQty - Number(issuedQty) }, { transaction: t })
      }

      // Auto-transition: fully depleted -> CONSUMED, stock remaining after
      // an issuance -> PARTIALLY_CONSUMED. Issuance is only reachable from
      // AVAILABLE/PARTIALLY_CONSUMED (BLOCKED_STATUSES above rules out
      // CONSUMED/EXPIRED/QUARANTINE), so this can't clobber those.
      const newStatus = newQty <= 0 ? 'CONSUMED' : 'PARTIALLY_CONSUMED'
      await batch.update({ qtyAvailable: newQty, status: newStatus, updatedAt: new Date() }, { transaction: t })

      const event = await InvBatchEvent.create({
        batchId: batch.id,
        eventType: 'ISSUED',
        qty: issuedQty,
        refNo: refNo ?? batch.batchNo,
        module: 'INVENTORY',
        issuedTo: issuedTo ?? null,
        purpose: purpose ?? null,
        projectCode: projectCode ?? null,
        performedBy,
        performedAt: new Date(),
        remarks: remarks ?? purpose ?? null,
      }, { transaction: t })

      await t.commit()
      res.json(successResponse('Batch issuance recorded', { event, qtyAvailable: newQty, status: newStatus }))
    } catch (err) {
      await t.rollback()
      throw err
    }
  } catch (err) {
    next(err)
  }
}

batchesRouter.post('/:id/issuance', authenticate, handleIssuance)
batchesRouter.post('/:id/issue', authenticate, handleIssuance)

// ── Allocate ──────────────────────────────────────────────────────────────────

// Allocate moves stock from a specific SKU/Pack ID (or the whole batch, when
// it has no packs) to a different department: deduct from the source, then
// clone the material into the target department if it isn't already there,
// and create a brand-new batch under that cloned material for the
// transferred quantity — mirroring a normal goods-received entry on the
// receiving side. Every step runs in one transaction so a failure partway
// through (e.g. bad target department) never leaves stock deducted with
// nothing created on the other end.
batchesRouter.post('/:id/allocate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { qty, packId, targetDepartmentId, remarks } = req.body
    if (qty === undefined) throw new BadRequestError('qty is required', 'MISSING_PARAM')
    if (!targetDepartmentId) throw new BadRequestError('targetDepartmentId is required', 'MISSING_PARAM')

    // MFG Batch No must be unique across all batches, so the destination
    // can't just reuse the source's — it's a mandatory, user-entered field
    // on the Allocate modal, same as on New Batch. No auto-generation/suffix.
    const destBatchNo = typeof req.body.batchNo === 'string' ? req.body.batchNo.trim() : ''
    if (!destBatchNo) throw new BadRequestError('MFG Batch No is required', 'MISSING_BATCH_NO')

    const user = req.user!
    const performedBy = (user as any).username ?? (user as any).email ?? String((user as any).id)

    const t = await sequelize.transaction()
    try {
      const batch = await InvBatch.findByPk(Number(id), { transaction: t, lock: true })
      if (!batch) throw new NotFoundError('Batch not found')

      const effectiveStatus = computeEffectiveStatus(batch.status, batch.retestDate)
      if (BLOCKED_STATUSES.includes(effectiveStatus ?? '')) {
        throw new BadRequestError(`Cannot allocate from a batch with status ${effectiveStatus}`, 'BATCH_STATUS_BLOCKED')
      }

      const targetDept = await Department.findByPk(targetDepartmentId, { transaction: t })
      if (!targetDept) throw new BadRequestError('Target department not found', 'DEPARTMENT_NOT_FOUND')

      const sourceMaterial = await InvMaterial.findByPk(batch.materialId, { transaction: t })
      if (!sourceMaterial) throw new BadRequestError('Material not found', 'MATERIAL_NOT_FOUND')

      if (sourceMaterial.departmentId === targetDepartmentId) {
        throw new BadRequestError('Target department is the same as the source', 'SAME_DEPARTMENT')
      }

      const currentQty = Number(batch.qtyAvailable)
      if (Number(qty) > currentQty) throw new BadRequestError(`Insufficient quantity available (${currentQty})`, 'INSUFFICIENT_QTY')

      let sourcePack: InvBatchPack | null = null
      if (packId != null) {
        sourcePack = await InvBatchPack.findOne({
          where: { id: Number(packId), batchId: batch.id },
          transaction: t,
          lock: true,
        })
        if (!sourcePack) throw new NotFoundError('Pack not found on this batch')
        const packQty = Number(sourcePack.qtyAvailable)
        if (Number(qty) > packQty) throw new BadRequestError(`Insufficient quantity available on this pack (${packQty})`, 'INSUFFICIENT_QTY')
      }

      // Find-or-clone the material under the target department. Matched by
      // name + CAS No (both must agree, including "neither has one") so we
      // don't create a duplicate every time the same material is allocated
      // to a department it's already been allocated to before.
      let targetMaterial = await InvMaterial.findOne({
        where: { name: sourceMaterial.name, casNo: sourceMaterial.casNo, departmentId: targetDepartmentId },
        transaction: t,
      })
      if (!targetMaterial) {
        const code = await claimNextCode(t)
        targetMaterial = await InvMaterial.create({
          code,
          name: sourceMaterial.name,
          materialType: sourceMaterial.materialType,
          casNo: sourceMaterial.casNo,
          molecularFormula: sourceMaterial.molecularFormula,
          molWeight: sourceMaterial.molWeight,
          storageCondition: sourceMaterial.storageCondition,
          hazardClass: sourceMaterial.hazardClass,
          isoType: sourceMaterial.isoType,
          description: sourceMaterial.description,
          isActive: true,
          departmentId: targetDepartmentId,
          consumableTypeId: sourceMaterial.consumableTypeId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { transaction: t })
      }

      // Deduct from the source (specific pack if one was targeted, always
      // from the batch total) — same shape as issuance's transition rule.
      if (sourcePack) {
        await sourcePack.update({ qtyAvailable: Number(sourcePack.qtyAvailable) - Number(qty) }, { transaction: t })
      }
      const newSourceQty = currentQty - Number(qty)
      const newSourceStatus = newSourceQty <= 0 ? 'CONSUMED' : 'PARTIALLY_CONSUMED'
      await batch.update({ qtyAvailable: newSourceQty, status: newSourceStatus, updatedAt: new Date() }, { transaction: t })

      await InvBatchEvent.create({
        batchId: batch.id,
        eventType: 'STOCK_ALLOCATION',
        qty,
        refNo: batch.batchNo,
        module: 'INVENTORY',
        issuedTo: null,
        purpose: `Allocated to ${targetDept.name}`,
        projectCode: null,
        performedBy,
        performedAt: new Date(),
        remarks: remarks ?? null,
      }, { transaction: t })

      // Create the receiving batch under the cloned material. It's still
      // physically the same lot split across departments, so the Inhouse
      // Batch No and SKU/Pack ID carry over unchanged from the source —
      // only the MFG Batch No has to be a new, user-entered value (unique
      // constraint on that column).
      const destBatch = await InvBatch.create({
        batchNo: destBatchNo,
        materialId: targetMaterial.id,
        manufacturerId: batch.manufacturerId,
        stockRequestId: null,
        qtyReceived: qty,
        qtyAvailable: qty,
        unit: batch.unit,
        status: 'AVAILABLE',
        category: 'available',
        measuringUnit: null,
        measuringUnitValue: null,
        includePack: !!sourcePack,
        packNumber: sourcePack ? 1 : null,
        packType: sourcePack ? batch.packType : null,
        packMode: null,
        inhouseBatchNo: batch.inhouseBatchNo,
        mfgDate: batch.mfgDate,
        expiryDate: batch.expiryDate,
        retestDate: batch.retestDate,
        grDate: null,
        location: null,
        bin: null,
        invoiceNo: null,
        poNo: null,
        clone: null,
        price: null,
        receivedBy: performedBy,
        receivedAt: new Date(),
        remarks: `Allocated from batch ${batch.batchNo}${sourcePack ? ` (${sourcePack.packNo})` : ''}`,
        coaFilePath: null,
        coaFilename: null,
        otherDocsFilePath: null,
        otherDocsFilename: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }, { transaction: t })

      // Same SKU/Pack ID as the source pack — it's the same physical pack,
      // just now counted under the destination department's batch.
      if (sourcePack) {
        await InvBatchPack.create({
          batchId: destBatch.id,
          seqNo: 1,
          packNo: sourcePack.packNo,
          qtyPerPack: qty,
          qtyAvailable: qty,
          inhouseBatchNo: sourcePack.packNo,
        }, { transaction: t })
      }

      const destEvent = await InvBatchEvent.create({
        batchId: destBatch.id,
        eventType: 'BATCH_ALLOCATED',
        qty,
        refNo: destBatch.batchNo,
        module: 'INVENTORY',
        issuedTo: null,
        purpose: `Allocated from ${batch.batchNo}`,
        projectCode: null,
        performedBy,
        performedAt: new Date(),
        remarks: remarks ?? null,
      }, { transaction: t })

      await t.commit()
      res.status(201).json(successResponse('Batch allocated', {
        sourceBatchId: batch.id,
        sourceQtyAvailable: newSourceQty,
        sourceStatus: newSourceStatus,
        destinationBatch: destBatch,
        destinationEvent: destEvent,
      }))
    } catch (err) {
      await t.rollback()
      throw err
    }
  } catch (err) {
    next(err)
  }
})

// ── Events ────────────────────────────────────────────────────────────────────

batchesRouter.get('/:id/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string

    // The frontend's batchApi.events() (BatchesPage.tsx) is typed
    // apiGet<BatchEvent[]> — it expects a bare array, not the
    // {items,total,...} pagination envelope. Sending the envelope made
    // `historyEvents.slice(...)` throw on an object with no .slice, which
    // crashed the whole page (no error boundary) — the "blank page" the
    // Event History button produced.
    const rows = await InvBatchEvent.findAll({
      where: { batchId: Number(id) },
      order: [['performedAt', 'DESC']],
    })

    res.json(successResponse('Batch events', rows))
  } catch (err) {
    next(err)
  }
})

// ── COA document ──────────────────────────────────────────────────────────────

batchesRouter.post('/:id/coa', authenticate, coaUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    if (!req.file) throw new BadRequestError('No file uploaded', 'NO_FILE')

    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')

    // Delete old COA if exists
    if (batch.coaFilePath) {
      deleteFile(getAbsoluteUploadPath(batch.coaFilePath))
    }

    await batch.update({
      coaFilePath: req.file.path,
      coaFilename: req.file.originalname,
      updatedAt: new Date(),
    })

    res.json(successResponse('COA uploaded', { coaFilename: req.file.originalname }))
  } catch (err) {
    next(err)
  }
})

batchesRouter.get('/:id/coa', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')
    if (!batch.coaFilePath) throw new NotFoundError('No COA file on record')

    const absPath = getAbsoluteUploadPath(batch.coaFilePath)
    if (!fs.existsSync(absPath)) throw new NotFoundError('COA file not found on disk')

    res.download(absPath, batch.coaFilename ?? path.basename(absPath))
  } catch (err) {
    next(err)
  }
})

batchesRouter.delete('/:id/coa', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')
    if (!batch.coaFilePath) throw new NotFoundError('No COA file on record')

    deleteFile(getAbsoluteUploadPath(batch.coaFilePath))
    await batch.update({ coaFilePath: null, coaFilename: null, updatedAt: new Date() })

    res.json(successResponse('COA deleted', null))
  } catch (err) {
    next(err)
  }
})

// ── Other docs ────────────────────────────────────────────────────────────────

batchesRouter.post('/:id/other-docs', authenticate, docsUploader.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    if (!req.file) throw new BadRequestError('No file uploaded', 'NO_FILE')

    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')

    if (batch.otherDocsFilePath) {
      deleteFile(getAbsoluteUploadPath(batch.otherDocsFilePath))
    }

    await batch.update({
      otherDocsFilePath: req.file.path,
      otherDocsFilename: req.file.originalname,
      updatedAt: new Date(),
    })

    res.json(successResponse('Other doc uploaded', { otherDocsFilename: req.file.originalname }))
  } catch (err) {
    next(err)
  }
})

batchesRouter.get('/:id/other-docs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')
    if (!batch.otherDocsFilePath) throw new NotFoundError('No other-docs file on record')

    const absPath = getAbsoluteUploadPath(batch.otherDocsFilePath)
    if (!fs.existsSync(absPath)) throw new NotFoundError('Other-docs file not found on disk')

    res.download(absPath, batch.otherDocsFilename ?? path.basename(absPath))
  } catch (err) {
    next(err)
  }
})

batchesRouter.delete('/:id/other-docs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const batch = await InvBatch.findByPk(Number(id))
    if (!batch) throw new NotFoundError('Batch not found')
    if (!batch.otherDocsFilePath) throw new NotFoundError('No other-docs file on record')

    deleteFile(getAbsoluteUploadPath(batch.otherDocsFilePath))
    await batch.update({ otherDocsFilePath: null, otherDocsFilename: null, updatedAt: new Date() })

    res.json(successResponse('Other doc deleted', null))
  } catch (err) {
    next(err)
  }
})

export default batchesRouter
