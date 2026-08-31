import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import ExcelJS from 'exceljs'
import { authenticate } from '../../middleware/auth.middleware'
import {
  InvGatePass,
  InvGatePassItem,
  InvGatePassReturn,
  InvGatePassSignature,
  InvWorkOrder,
  InvBatch,
  InvBatchPack,
  InvManufacturer,
  InvEquipmentCatalogue,
  InvInstrumentCatalogue,
} from '../../models/InventoryModels.model'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination } from '../../utils/response'
import { enforceEsignature, ESIGN_FLAGS } from '../../shared/ardSettings'
import { sequelize } from '../../database/connection'
import { BadRequestError, NotFoundError } from '../../utils/errors'

const gatePassRouter = Router()

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateGpNumber(): string {
  const now = new Date()
  return `GP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString().slice(-5)}`
}

// Same pattern as workOrders.routes.ts/stockRequests.routes.ts's
// getPerformedBy — without it, createdBy/approvedBy stored the raw user id
// (a UUID), and the detail page had nothing readable to show.
function getPerformedBy(req: Request): string {
  const user = (req as any).user
  return user?.username ?? user?.email ?? String(user?.id ?? '')
}

// gp.items is a separate table with no denormalized item_count/total_value/
// pending_items on InvGatePass itself, so every list view has to batch-sum
// them here — without this the Register table's Items/Value columns and the
// Returns page's Pending Items column were always blank/0.
async function attachGatePassAggregates(rows: InstanceType<typeof InvGatePass>[]) {
  const ids = rows.map((r) => r.id)
  const items = ids.length ? await InvGatePassItem.findAll({ where: { gatePassId: ids } }) : []
  const byGp = new Map<number, InstanceType<typeof InvGatePassItem>[]>()
  items.forEach((it) => {
    const list = byGp.get(it.gatePassId) ?? []
    list.push(it)
    byGp.set(it.gatePassId, list)
  })
  return rows.map((gp) => {
    const its = byGp.get(gp.id) ?? []
    const totalValue = its.reduce((sum, it) => sum + Number(it.totalValue ?? 0), 0)
    const pendingItems = its.filter((it) => Number(it.quantity) - Number(it.returnedQty ?? 0) > 0).length
    return { ...gp.toJSON(), item_count: its.length, total_value: totalValue, pending_items: pendingItems }
  })
}

// A line item picked against a specific batch/pack (SKU) — via sourcePackId,
// or the batch directly for un-packed batches (sourceBatchId, sourcePackId
// null) — deducts that quantity from live stock exactly like Batches'
// "Issue" action, so sending material out on a gate pass actually reduces
// what's shown as available elsewhere. Items raised without picking a
// source (sourceBatchId null) are plain free-text lines and are untouched.
async function deductGatePassItemStock(item: { quantity: number; sourceBatchId?: number | null; sourcePackId?: number | null }, transaction: any) {
  if (!item.sourceBatchId) return
  const batch = await InvBatch.findByPk(item.sourceBatchId, { transaction, lock: true })
  if (!batch) throw new NotFoundError('Source batch not found')

  if (item.sourcePackId != null) {
    const pack = await InvBatchPack.findOne({ where: { id: item.sourcePackId, batchId: batch.id }, transaction, lock: true })
    if (!pack) throw new NotFoundError('Source pack not found on this batch')
    const packQty = Number(pack.qtyAvailable)
    if (Number(item.quantity) > packQty) throw new BadRequestError(`Insufficient quantity available on pack ${pack.packNo} (${packQty})`, 'INSUFFICIENT_QTY')
    await pack.update({ qtyAvailable: packQty - Number(item.quantity) }, { transaction })
  }

  const batchQty = Number(batch.qtyAvailable)
  if (Number(item.quantity) > batchQty) throw new BadRequestError(`Insufficient quantity available on batch ${batch.batchNo} (${batchQty})`, 'INSUFFICIENT_QTY')
  const newQty = batchQty - Number(item.quantity)
  await batch.update({ qtyAvailable: newQty, status: newQty <= 0 ? 'CONSUMED' : 'PARTIALLY_CONSUMED', updatedAt: new Date() }, { transaction })
}

// Reverses deductGatePassItemStock — used when an item is removed/replaced
// on an edit (PUT), so re-saving a gate pass doesn't permanently lock away
// stock for a line item that no longer exists.
async function restoreGatePassItemStock(item: { quantity: number; sourceBatchId?: number | null; sourcePackId?: number | null }, transaction: any) {
  if (!item.sourceBatchId) return
  const batch = await InvBatch.findByPk(item.sourceBatchId, { transaction, lock: true })
  if (!batch) return

  if (item.sourcePackId != null) {
    const pack = await InvBatchPack.findOne({ where: { id: item.sourcePackId, batchId: batch.id }, transaction, lock: true })
    if (pack) await pack.update({ qtyAvailable: Number(pack.qtyAvailable) + Number(item.quantity) }, { transaction })
  }

  const newQty = Number(batch.qtyAvailable) + Number(item.quantity)
  await batch.update({ qtyAvailable: newQty, status: newQty > 0 ? 'PARTIALLY_CONSUMED' : batch.status, updatedAt: new Date() }, { transaction })
}

// Equipment/Instrument line items have no batch/stock quantity — instead,
// dispatching the gate pass marks the asset itself unavailable on-site
// (mirrors deductGatePassItemStock's role for materials). Only flips an
// AVAILABLE asset — one already UNDER_MAINTENANCE/IN_USE/etc. from some other
// flow is left alone rather than clobbered.
async function markGatePassItemAssetOut(item: { itemType?: string | null; equipmentId?: number | null; instrumentId?: number | null }, transaction: any) {
  if (item.itemType === 'EQUIPMENT' && item.equipmentId) {
    await InvEquipmentCatalogue.update(
      { status: 'OUT_FOR_SERVICE' },
      { where: { id: item.equipmentId, status: 'AVAILABLE' }, transaction },
    )
  } else if (item.itemType === 'INSTRUMENT' && item.instrumentId) {
    await InvInstrumentCatalogue.update(
      { status: 'OUT_FOR_SERVICE' },
      { where: { id: item.instrumentId, status: 'AVAILABLE' }, transaction },
    )
  }
}

// Reverses markGatePassItemAssetOut once the item is fully returned (or the
// whole gate pass is edited before ever being dispatched — see restoreGatePassItemStock's
// analogous role). Only reverts an asset this gate pass itself put OUT_FOR_SERVICE.
async function restoreGatePassItemAsset(item: { itemType?: string | null; equipmentId?: number | null; instrumentId?: number | null }, transaction: any) {
  if (item.itemType === 'EQUIPMENT' && item.equipmentId) {
    await InvEquipmentCatalogue.update(
      { status: 'AVAILABLE' },
      { where: { id: item.equipmentId, status: 'OUT_FOR_SERVICE' }, transaction },
    )
  } else if (item.itemType === 'INSTRUMENT' && item.instrumentId) {
    await InvInstrumentCatalogue.update(
      { status: 'AVAILABLE' },
      { where: { id: item.instrumentId, status: 'OUT_FOR_SERVICE' }, transaction },
    )
  }
}

// â”€â”€ Reports (must be defined before :id routes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET /gate-passes/reports/summary
gatePassRouter.get('/gate-passes/reports/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const OPEN_STATUSES = ['DISPATCHED', 'PARTIALLY_RETURNED']
    const [total, rgpCount, nrgpCount, pendingReturns, openPasses] = await Promise.all([
      InvGatePass.count(),
      InvGatePass.count({ where: { docType: 'RETURNABLE' } }),
      InvGatePass.count({ where: { docType: 'NON_RETURNABLE' } }),
      InvGatePass.count({ where: { docType: 'RETURNABLE', status: { [Op.in]: OPEN_STATUSES } } }),
      InvGatePass.findAll({ where: { docType: 'RETURNABLE', status: { [Op.in]: OPEN_STATUSES } }, attributes: ['id'] }),
    ])
    const openIds = openPasses.map((p) => p.id)
    const openItems = openIds.length ? await InvGatePassItem.findAll({ where: { gatePassId: openIds } }) : []
    const openValue = openItems.reduce((sum, it) => {
      const outstandingQty = Number(it.quantity) - Number(it.returnedQty ?? 0)
      if (outstandingQty <= 0) return sum
      const rate = Number(it.quantity) ? Number(it.totalValue ?? 0) / Number(it.quantity) : 0
      return sum + outstandingQty * rate
    }, 0)
    res.json(successResponse('Gate pass summary', {
      total, rgp_count: rgpCount, nrgp_count: nrgpCount, pending_returns: pendingReturns, open_value: openValue,
    }))
  } catch (err) {
    next(err)
  }
})

/**
 * Both gate-pass reports below are assembled in memory (pending value and the
 * per-vendor rollup have no single SQL row), so search and paging are applied
 * to the finished rows. Callers that send no page params still get the bare
 * array these have always returned.
 */
function pageRows<T extends Record<string, any>>(
  req: Request,
  all: T[],
  search: string | undefined,
  matches: (row: T, q: string) => boolean,
) {
  let matched = search ? all.filter((r) => matches(r, search.toLowerCase())) : all

  // Sorting has to happen here too: the caller only ever receives one page, so
  // a client-side comparator would just reorder that page.
  const { sortBy, sortDir } = req.query as Record<string, string>
  if (sortBy) {
    const dir = sortDir === 'desc' ? -1 : 1
    matched = [...matched].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av === bv) return 0
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }

  if (!wantsPagination(req.query)) return { paged: false as const, matched }
  const { page, limit, offset } = parsePagination(req.query)
  return { paged: true as const, matched, page, limit, rows: matched.slice(offset, offset + limit) }
}

// GET /gate-passes/reports/pending-returns
gatePassRouter.get('/gate-passes/reports/pending-returns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await InvGatePass.findAll({
      where: { docType: 'RETURNABLE', status: { [Op.in]: ['DISPATCHED', 'PARTIALLY_RETURNED'] } },
      include: [{ model: InvGatePassItem, as: 'items' }],
      order: [['dispatchedAt', 'ASC']],
    })
    const now = Date.now()
    const result = rows.map((gp: any) => {
      const items = gp.items ?? []
      const pendingItems = items.filter((it: any) => Number(it.quantity) - Number(it.returnedQty ?? 0) > 0)
      const pendingValue = pendingItems.reduce((sum: number, it: any) => {
        const outstandingQty = Number(it.quantity) - Number(it.returnedQty ?? 0)
        const rate = Number(it.quantity) ? Number(it.totalValue ?? 0) / Number(it.quantity) : 0
        return sum + outstandingQty * rate
      }, 0)
      const dispatchedAt = gp.dispatchedAt ? new Date(gp.dispatchedAt).getTime() : now
      const daysOpen = Math.max(0, Math.floor((now - dispatchedAt) / 86400000))
      return {
        id: gp.id, gp_number: gp.gpNumber, vendor_code: gp.vendorCode, vendor_name: gp.vendorName,
        gp_date: gp.gpDate, days_open: daysOpen, pending_items: pendingItems.length, pending_value: pendingValue,
      }
    })
    const { search } = req.query as Record<string, string>
    const out = pageRows(req, result, search, (r, q) =>
      String(r.gp_number ?? '').toLowerCase().includes(q) ||
      String(r.vendor_name ?? '').toLowerCase().includes(q) ||
      String(r.vendor_code ?? '').toLowerCase().includes(q))
    if (!out.paged) {
      res.json(successResponse('Pending return gate passes', out.matched))
      return
    }
    res.json(listResponse('Pending return gate passes', out.rows, buildPagination(out.page, out.limit, out.matched.length)))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/reports/vendor-summary
gatePassRouter.get('/gate-passes/reports/vendor-summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const passes = await InvGatePass.findAll({ attributes: ['id', 'vendorCode', 'vendorName'] })
    const ids = passes.map((p) => p.id)
    const items = ids.length ? await InvGatePassItem.findAll({ where: { gatePassId: ids }, attributes: ['gatePassId', 'totalValue'] }) : []
    const valueByGp = new Map<number, number>()
    items.forEach((it) => valueByGp.set(it.gatePassId, (valueByGp.get(it.gatePassId) ?? 0) + Number(it.totalValue ?? 0)))

    const byVendor = new Map<string, { vendor_code: string | null; vendor_name: string | null; gp_count: number; total_value: number }>()
    passes.forEach((p) => {
      const key = `${p.vendorCode ?? ''}|${p.vendorName ?? ''}`
      const entry = byVendor.get(key) ?? { vendor_code: p.vendorCode, vendor_name: p.vendorName, gp_count: 0, total_value: 0 }
      entry.gp_count += 1
      entry.total_value += valueByGp.get(p.id) ?? 0
      byVendor.set(key, entry)
    })
    const rows = [...byVendor.values()].sort((a, b) => b.gp_count - a.gp_count)
    const { search } = req.query as Record<string, string>
    const out = pageRows(req, rows, search, (r, q) =>
      String(r.vendor_name ?? '').toLowerCase().includes(q) ||
      String(r.vendor_code ?? '').toLowerCase().includes(q))
    if (!out.paged) {
      res.json(successResponse('Vendor summary', out.matched))
      return
    }
    res.json(listResponse('Vendor summary', out.rows, buildPagination(out.page, out.limit, out.matched.length)))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/reports/export.xlsx
gatePassRouter.get('/gate-passes/reports/export.xlsx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { docType, status, fromDate, toDate } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (docType) where.docType = docType
    if (status) where.status = status
    if (fromDate || toDate) {
      where.gpDate = {}
      if (fromDate) (where.gpDate as any)[Op.gte] = fromDate
      if (toDate) (where.gpDate as any)[Op.lte] = toDate
    }

    const passes = await InvGatePass.findAll({ where, order: [['gpDate', 'DESC']] })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Gate Passes')
    ws.columns = [
      { header: 'GP Number', key: 'gpNumber', width: 20 },
      { header: 'Doc Type', key: 'docType', width: 12 },
      { header: 'Vendor Name', key: 'vendorName', width: 25 },
      { header: 'GP Date', key: 'gpDate', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Work Order No', key: 'workOrderNo', width: 20 },
      { header: 'PR Number', key: 'prNumber', width: 20 },
      { header: 'Remarks', key: 'remarks', width: 30 },
    ]
    passes.forEach((p) => ws.addRow(p.toJSON()))

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=gate-passes-export.xlsx')
    await wb.xlsx.write(res)
    res.end()
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/returns/pending
gatePassRouter.get('/gate-passes/returns/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { sortBy, sortDir } = req.query as Record<string, string>
    const sortColumnMap: Record<string, string> = { gp_number: 'gpNumber', vendor_name: 'vendorName', gp_date: 'gpDate', status: 'status' }
    const order: [string, string][] = [[sortColumnMap[sortBy] ?? 'dispatchedAt', sortDir === 'desc' ? 'DESC' : 'ASC']]

    const { count, rows } = await InvGatePass.findAndCountAll({
      where: { docType: 'RETURNABLE', status: { [Op.in]: ['DISPATCHED', 'PARTIALLY_RETURNED'] } },
      limit,
      offset,
      order,
    })
    const rowsWithAgg = await attachGatePassAggregates(rows)
    res.json(listResponse('Pending returns', rowsWithAgg, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/by-work-order/:workOrderId
gatePassRouter.get('/gate-passes/by-work-order/:workOrderId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workOrderId = parseInt(req.params.workOrderId as string, 10)
    const gp = await InvGatePass.findOne({
      where: { workOrderId },
      include: [{ model: InvGatePassItem, as: 'items' }],
    })
    res.json(successResponse('Gate pass for work order', gp))
  } catch (err) {
    next(err)
  }
})

// POST /gate-passes/from-work-order
gatePassRouter.post('/gate-passes/from-work-order', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workOrderId } = req.body
    const wo = await InvWorkOrder.findByPk(workOrderId)
    if (!wo) return res.status(404).json({ success: false, message: 'Work order not found' })

    const today = new Date().toISOString().split('T')[0]
    // An asset sent out for external calibration/maintenance has to come back,
    // so these default to RETURNABLE (RGP) — hardcoding NON_RETURNABLE left
    // them ineligible for the returns flow (POST /returns rejects non-RGP) and
    // auto-CLOSED them on dispatch, so the instrument was never tracked as
    // outstanding. Caller can still override via the body for the rare
    // genuinely-permanent outward case (e.g. condemned/scrapped asset).
    const inferredDocType = ['CALIBRATION', 'MAINTENANCE', 'BREAKDOWN'].includes(String(wo.kind ?? '').toUpperCase())
      ? 'RETURNABLE'
      : 'NON_RETURNABLE'
    const gp = await InvGatePass.create({
      gpNumber: generateGpNumber(),
      docType: req.body.docType ?? inferredDocType,
      workOrderId,
      workOrderNo: wo.workorderNo,
      gpDate: today,
      status: 'DRAFT',
      createdBy: getPerformedBy(req),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    res.status(201).json(successResponse('Gate pass created from work order', gp))
  } catch (err) {
    next(err)
  }
})

// â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// POST /gate-passes
gatePassRouter.post('/gate-passes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // The form only ever sends manufacturerId (not vendorId/vendorName/
    // vendorCode — those were dead fields nothing populated), so vendor_name/
    // vendor_code have to be resolved server-side from the manufacturer
    // record, not trusted from the request body.
    const { docType, manufacturerId, items, isDraft, ...rest } = req.body
    const today = new Date().toISOString().split('T')[0]
    const manufacturer = manufacturerId ? await InvManufacturer.findByPk(manufacturerId) : null

    // The form's "Save as Draft" sends isDraft:true, "Submit" sends
    // isDraft:false — neither was ever read here, so every gate pass was
    // hard-coded to DRAFT forever and the Approve button (shown only once a
    // pass reaches CREATED) could never appear through the normal flow.
    const gp = await InvGatePass.create({
      gpNumber: generateGpNumber(),
      docType,
      manufacturerId: manufacturerId ?? null,
      vendorName: manufacturer?.name ?? null,
      vendorCode: manufacturer?.code ?? null,
      gpDate: rest.gpDate ?? today,
      status: isDraft === false ? 'CREATED' : 'DRAFT',
      createdBy: getPerformedBy(req),
      prNumber: rest.prNumber ?? null,
      workOrderNo: rest.workOrderNo ?? null,
      workOrderId: rest.workOrderId ?? null,
      remarks: rest.remarks ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    if (Array.isArray(items) && items.length > 0) {
      const t = await sequelize.transaction()
      try {
        for (const [idx, item] of items.entries()) {
          const quantity = Number(item.quantity ?? 0)
          const rate = item.rate != null ? Number(item.rate) : null
          const created = await InvGatePassItem.create({
            gatePassId: gp.id,
            srNo: item.srNo ?? idx + 1,
            materialId: item.materialId ?? null,
            materialCode: item.materialCode ?? null,
            materialName: item.materialName,
            description: item.description ?? null,
            quantity,
            uom: item.uom ?? null,
            rate,
            // The form never sends a totalValue — it's always derived from
            // quantity * rate, computed here rather than trusted from the client.
            totalValue: item.totalValue ?? (rate != null ? quantity * rate : 0),
            sourceBatchId: item.sourceBatchId ?? null,
            sourcePackId: item.sourcePackId ?? null,
            itemType: item.itemType ?? 'MATERIAL',
            equipmentId: item.equipmentId ?? null,
            instrumentId: item.instrumentId ?? null,
          }, { transaction: t })
          await deductGatePassItemStock(created, t)
        }
        await t.commit()
      } catch (err) {
        await t.rollback()
        throw err
      }
    }

    const result = await InvGatePass.findByPk(gp.id, {
      include: [{ model: InvGatePassItem, as: 'items' }],
    })
    res.status(201).json(successResponse('Gate pass created', result))
  } catch (err) {
    next(err)
  }
})

// PUT /gate-passes/:id
gatePassRouter.put('/gate-passes/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id as string, 10)
    const gp = await InvGatePass.findByPk(id)
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })

    // Once material has actually moved (dispatched) the pass is history, not
    // an editable draft — without this guard, editing it would restore
    // already-shipped stock and re-deduct it against possibly different
    // items, silently reconciling live inventory against a record that's
    // supposed to be immutable.
    if (['DISPATCHED', 'PARTIALLY_RETURNED', 'CLOSED'].includes(gp.status)) {
      return res.status(400).json({ success: false, message: `Cannot edit a gate pass that is already ${gp.status.replace(/_/g, ' ')}` })
    }

    // `status` must never be settable directly from the request body — that
    // would let a caller jump lifecycle stages (and skip the e-signature
    // enforced on approve/dispatch) via a plain PUT. The only status change
    // PUT is allowed to make is the form's own DRAFT -> CREATED submit.
    const { items, manufacturerId, submit, status: _ignoredStatus, ...gpData } = req.body
    if (manufacturerId !== undefined) {
      const manufacturer = manufacturerId ? await InvManufacturer.findByPk(manufacturerId) : null
      Object.assign(gpData, {
        manufacturerId: manufacturerId ?? null,
        vendorName: manufacturer?.name ?? null,
        vendorCode: manufacturer?.code ?? null,
      })
    }
    if (submit === true && gp.status === 'DRAFT') gpData.status = 'CREATED'
    await gp.update(gpData)

    if (Array.isArray(items)) {
      const t = await sequelize.transaction()
      try {
        const existing = await InvGatePassItem.findAll({ where: { gatePassId: id }, transaction: t })
        for (const old of existing) await restoreGatePassItemStock(old, t)
        await InvGatePassItem.destroy({ where: { gatePassId: id }, transaction: t })

        for (const [idx, item] of items.entries()) {
          const quantity = Number(item.quantity ?? 0)
          const rate = item.rate != null ? Number(item.rate) : null
          const created = await InvGatePassItem.create({
            gatePassId: id,
            srNo: item.srNo ?? idx + 1,
            materialId: item.materialId ?? null,
            materialCode: item.materialCode ?? null,
            materialName: item.materialName,
            description: item.description ?? null,
            quantity,
            uom: item.uom ?? null,
            rate,
            totalValue: item.totalValue ?? (rate != null ? quantity * rate : 0),
            sourceBatchId: item.sourceBatchId ?? null,
            sourcePackId: item.sourcePackId ?? null,
            itemType: item.itemType ?? 'MATERIAL',
            equipmentId: item.equipmentId ?? null,
            instrumentId: item.instrumentId ?? null,
          }, { transaction: t })
          await deductGatePassItemStock(created, t)
        }
        await t.commit()
      } catch (err) {
        await t.rollback()
        throw err
      }
    }

    const result = await InvGatePass.findByPk(id, {
      include: [{ model: InvGatePassItem, as: 'items' }],
    })
    res.json(successResponse('Gate pass updated', result))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes
gatePassRouter.get('/gate-passes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { docType, status, search, fromDate, toDate, gpNumber, vendorName } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (docType) where.docType = docType
    if (status) where.status = status
    if (search) {
      (where as any)[Op.or as any] = [
        { gpNumber: { [Op.iLike]: `%${search}%` } },
        { docType: { [Op.iLike]: `%${search}%` } },
        { vendorName: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
      ]
    }
    // Per-column search filters (Gate Pass tables)
    if (gpNumber) where.gpNumber = { [Op.iLike]: `%${gpNumber}%` }
    if (vendorName) where.vendorName = { [Op.iLike]: `%${vendorName}%` }
    if (fromDate || toDate) {
      where.gpDate = {}
      if (fromDate) (where.gpDate as any)[Op.gte] = fromDate
      if (toDate) (where.gpDate as any)[Op.lte] = toDate
    }

    const { count, rows } = await InvGatePass.findAndCountAll({
      where,
      limit,
      offset,
      order: [['gpDate', 'DESC']],
    })
    const rowsWithAgg = await attachGatePassAggregates(rows)
    res.json(listResponse('Gate passes fetched', rowsWithAgg, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/:id
gatePassRouter.get('/gate-passes/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const gp = await InvGatePass.findByPk(id, {
      include: [
        { model: InvGatePassItem, as: 'items' },
        { model: InvGatePassReturn, as: 'returns' },
        { model: InvGatePassSignature, as: 'signatures' },
      ],
    })
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })

    // Self-heal: a gate pass whose items are all fully returned but whose
    // status never got flipped to CLOSED (e.g. rows recorded before the
    // returns endpoint correctly processed the Return Entry page's
    // multi-item payload) would otherwise permanently show as an actionable
    // "Partially Returned" pending return with nothing left to return.
    // Only a pass that actually left the building can be "fully returned" —
    // gating on DISPATCHED/PARTIALLY_RETURNED stops a still-editable DRAFT
    // from self-closing. The positive-quantity guard matters too: a row with
    // quantity 0 trivially satisfies `returnedQty >= quantity` (0 >= 0), which
    // used to close a brand-new draft the moment it was read back.
    const items = (gp as any).items ?? []
    const dispatched = ['DISPATCHED', 'PARTIALLY_RETURNED'].includes(gp.status)
    const hasOutwardQty = items.some((i: any) => Number(i.quantity) > 0)
    if (
      dispatched && items.length && hasOutwardQty &&
      items.every((i: any) => Number(i.returnedQty ?? 0) >= Number(i.quantity))
    ) {
      await gp.update({ status: 'CLOSED' })
    }
    // Same self-heal for NON_RETURNABLE passes dispatched before dispatch
    // started auto-closing them — nothing to return, so DISPATCHED here just
    // means it's finished.
    if (gp.status === 'DISPATCHED' && gp.docType === 'NON_RETURNABLE') {
      await gp.update({ status: 'CLOSED' })
    }

    const [withAgg] = await attachGatePassAggregates([gp])
    res.json(successResponse('Gate pass fetched', withAgg))
  } catch (err) {
    next(err)
  }
})

// POST /gate-passes/:id/approve
gatePassRouter.post('/gate-passes/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gatePassId = parseInt(req.params.id as string, 10)
    const { name, comments } = req.body
    const gp = await InvGatePass.findByPk(gatePassId)
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })
    if (gp.status !== 'CREATED') {
      return res.status(400).json({ success: false, message: `Cannot approve a gate pass in ${gp.status} status — it must be CREATED first` })
    }
    await enforceEsignature((req as any).user, ESIGN_FLAGS.GATE_PASS_APPROVE_AUTH, req.body.password)
    await gp.update({
      status: 'APPROVED',
      approvedBy: name ?? getPerformedBy(req),
      approvedAt: new Date(),
    })
    await InvGatePassSignature.create({
      gatePassId,
      signingFor: 'APPROVED',
      name: name ?? getPerformedBy(req),
      comments: comments ?? null,
      completedOn: new Date(),
    })

    // The frontend replaces its whole `gp` state with this response and
    // reads gp_number/items/doc_type straight off it — returning { gp, sig }
    // (missing items/returns/signatures and every snake_case field) made the
    // page render against a shape it doesn't recognize and crash to a blank
    // screen. Return the same full detail shape as GET /gate-passes/:id.
    const result = await InvGatePass.findByPk(gatePassId, {
      include: [
        { model: InvGatePassItem, as: 'items' },
        { model: InvGatePassReturn, as: 'returns' },
        { model: InvGatePassSignature, as: 'signatures' },
      ],
    })
    const [withAgg] = await attachGatePassAggregates([result!])
    res.json(successResponse('Gate pass approved', withAgg))
  } catch (err) {
    next(err)
  }
})

// POST /gate-passes/:id/dispatch
gatePassRouter.post('/gate-passes/:id/dispatch', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const gp = await InvGatePass.findByPk(id)
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })
    if (gp.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: `Cannot dispatch a gate pass in ${gp.status} status — it must be APPROVED first` })
    }
    await enforceEsignature((req as any).user, ESIGN_FLAGS.GATE_PASS_DISPATCH_AUTH, req.body.password)
    await gp.update({
      // NON_RETURNABLE material never comes back, so dispatch is the last
      // lifecycle step for it — without this it sat at DISPATCHED forever
      // with no action anywhere to reach CLOSED. RETURNABLE passes still
      // need the Returns flow before they can close.
      status: gp.docType === 'NON_RETURNABLE' ? 'CLOSED' : 'DISPATCHED',
      dispatchedAt: new Date(),
      dispatchedBy: req.body.dispatchedBy ?? getPerformedBy(req),
    })

    // Equipment/Instrument line items have no stock to deduct (unlike
    // materials, handled at create/edit time) — instead the asset's own
    // status flips to OUT_FOR_SERVICE right here, at the point it actually
    // leaves the site, not while the pass was still a DRAFT/CREATED/APPROVED.
    const dispatchedItems = await InvGatePassItem.findAll({ where: { gatePassId: gp.id } })
    for (const item of dispatchedItems) await markGatePassItemAssetOut(item, undefined)

    // Same full-detail shape as GET /gate-passes/:id — a bare gp (no items
    // include, no aggregates) crashed the detail page the same way approve's
    // old { gp, sig } response did.
    const result = await InvGatePass.findByPk(id, {
      include: [
        { model: InvGatePassItem, as: 'items' },
        { model: InvGatePassReturn, as: 'returns' },
        { model: InvGatePassSignature, as: 'signatures' },
      ],
    })
    const [withAgg] = await attachGatePassAggregates([result!])
    res.json(successResponse('Gate pass dispatched', withAgg))
  } catch (err) {
    next(err)
  }
})

// POST /gate-passes/:id/returns
// The Return Entry page always posts { return_date, entries: [{ item_sr_no,
// received_qty, condition, remarks }, ...] } — one row per material — never
// a single flat { itemSrNo, receivedQty }. This handler used to only read
// the flat shape, so `receivedQty` was always undefined/NaN and every real
// return attempt failed with "receivedQty must be greater than 0" before it
// ever reached the DB.
gatePassRouter.post('/gate-passes/:id/returns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gatePassId = parseInt(req.params.id as string, 10)
    const body = req.body
    const entries: any[] = Array.isArray(body.entries) ? body.entries : [body]
    const returnDate = body.returnDate ?? new Date().toISOString().split('T')[0]
    const returnGpNumber = body.returnGpNumber ?? `RET-${Date.now()}`

    const validEntries = entries
      .map((e) => ({ ...e, receivedQty: Number(e.receivedQty ?? 0) }))
      .filter((e) => e.receivedQty > 0)
    if (!validEntries.length) {
      return res.status(400).json({ success: false, message: 'receivedQty must be greater than 0 for at least one item' })
    }

    const gp = await InvGatePass.findByPk(gatePassId, {
      include: [{ model: InvGatePassItem, as: 'items' }],
    })
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })
    // NON_RETURNABLE material never comes back — accepting a return against
    // one would fabricate stock that conceptually can't exist and put the
    // pass into a return-flow status (PARTIALLY_RETURNED) that means nothing
    // for permanent-outward material.
    if (gp.docType !== 'RETURNABLE') {
      return res.status(400).json({ success: false, message: 'Only returnable (RGP) gate passes can have returns recorded' })
    }
    if (!['DISPATCHED', 'PARTIALLY_RETURNED'].includes(gp.status)) {
      return res.status(400).json({ success: false, message: `Cannot record a return on a gate pass in ${gp.status} status — it must be dispatched first` })
    }

    const items = await InvGatePassItem.findAll({ where: { gatePassId } })
    const itemBySrNo = new Map(items.map((i) => [i.srNo, i]))

    // Validate every entry up front so a bad row doesn't leave earlier rows
    // in this same submission partially applied.
    for (const entry of validEntries) {
      const item = itemBySrNo.get(entry.itemSrNo)
      if (!item) {
        return res.status(404).json({ success: false, message: `Item sr_no ${entry.itemSrNo} not found on this gate pass` })
      }
      const outstanding = Number(item.quantity) - Number(item.returnedQty ?? 0)
      if (entry.receivedQty > outstanding) {
        return res.status(400).json({
          success: false,
          message: `Return qty ${entry.receivedQty} exceeds outstanding balance ${outstanding} for item ${entry.itemSrNo}`,
        })
      }
    }

    const returns = []
    for (const entry of validEntries) {
      returns.push(await InvGatePassReturn.create({
        gatePassId,
        returnGpNumber,
        returnDate,
        itemSrNo: entry.itemSrNo,
        receivedQty: entry.receivedQty,
        condition: entry.condition ?? null,
        remarks: entry.remarks ?? null,
        receivedBy: entry.receivedBy ?? getPerformedBy(req),
        createdAt: new Date(),
      }))
      await InvGatePassItem.increment('returnedQty', {
        by: entry.receivedQty,
        where: { gatePassId, srNo: entry.itemSrNo },
      })
    }

    // Determine gate pass status from fresh item totals (post-increment).
    const freshItems = await InvGatePassItem.findAll({ where: { gatePassId } })
    const allFullyReturned = freshItems.every((i) => Number(i.returnedQty ?? 0) >= Number(i.quantity))
    await gp.update({ status: allFullyReturned ? 'CLOSED' : 'PARTIALLY_RETURNED' })

    // An equipment/instrument item is back on-site the moment its own return
    // entry makes it fully returned — revert it to AVAILABLE right then, not
    // only once every other line item on the pass also closes out.
    const returnedSrNos = new Set(validEntries.map((e) => e.itemSrNo))
    for (const item of freshItems) {
      if (returnedSrNos.has(item.srNo) && Number(item.returnedQty ?? 0) >= Number(item.quantity)) {
        await restoreGatePassItemAsset(item, undefined)
      }
    }

    // The frontend reads `updated.status` off this response (to confirm the
    // gate pass closed) — a bare InvGatePassReturn row has no `status` field,
    // so that always rendered "undefined" before. Return the full gate pass
    // with its items instead, same shape as GET /gate-passes/:id.
    const result = await InvGatePass.findByPk(gatePassId, {
      include: [
        { model: InvGatePassItem, as: 'items' },
        { model: InvGatePassReturn, as: 'returns' },
        { model: InvGatePassSignature, as: 'signatures' },
      ],
    })
    res.status(201).json(successResponse('Return recorded', result))
  } catch (err) {
    next(err)
  }
})

// GET /gate-passes/:id/challan.xlsx
gatePassRouter.get('/gate-passes/:id/challan.xlsx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const gp = await InvGatePass.findByPk(id, {
      include: [{ model: InvGatePassItem, as: 'items' }],
    })
    if (!gp) return res.status(404).json({ success: false, message: 'Gate pass not found' })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Challan')

    // Header info
    ws.mergeCells('A1:F1')
    ws.getCell('A1').value = `Gate Pass Challan: ${gp.gpNumber}`
    ws.getCell('A1').font = { bold: true, size: 14 }

    ws.getCell('A2').value = 'Doc Type:'
    ws.getCell('B2').value = gp.docType
    ws.getCell('A3').value = 'Vendor:'
    ws.getCell('B3').value = gp.vendorName ?? ''
    ws.getCell('A4').value = 'Date:'
    ws.getCell('B4').value = gp.gpDate
    ws.getCell('A5').value = 'Status:'
    ws.getCell('B5').value = gp.status

    ws.addRow([])

    // Items table header
    const headerRow = ws.addRow(['Sr No', 'Material Code', 'Material Name', 'Description', 'Quantity', 'UOM'])
    headerRow.font = { bold: true }

    const items = (gp as any).items ?? []
    items.forEach((item: any) => {
      ws.addRow([item.srNo, item.materialCode, item.materialName, item.description, item.quantity, item.uom])
    })

    ws.columns.forEach((col) => { col.width = 20 })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=challan-${gp.gpNumber}.xlsx`)
    await wb.xlsx.write(res)
    res.end()
  } catch (err) {
    next(err)
  }
})

export default gatePassRouter

