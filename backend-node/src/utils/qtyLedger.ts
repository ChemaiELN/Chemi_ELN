/**
 * Batch quantity ledger — port of backend/app/modules/inventory/_qty_ledger.py.
 * FIFO deduct by pack seq_no; restore fills least-full packs first.
 */
import { Transaction } from 'sequelize'
import { Op } from 'sequelize'
import { InvBatch, InvBatchEvent, InvBatchPack } from '../models/InventoryModels.model'
import { BadRequestError, NotFoundError } from './errors'

export const BLOCKED_STATUSES = new Set(['CONSUMED', 'EXPIRED', 'QUARANTINE'])

export async function deductFromPacks(batchId: number, qty: number, transaction?: Transaction): Promise<void> {
  let remaining = qty
  const packs = await InvBatchPack.findAll({
    where: { batchId, qtyAvailable: { [Op.gt]: 0 } },
    order: [['seqNo', 'ASC']],
    transaction,
    lock: transaction ? true : undefined,
  })
  for (const pack of packs) {
    if (remaining <= 0) break
    const take = Math.min(Number(pack.qtyAvailable), remaining)
    await pack.update({ qtyAvailable: Number(pack.qtyAvailable) - take }, { transaction })
    remaining -= take
  }
}

export async function restoreToPacks(batchId: number, qty: number, transaction?: Transaction): Promise<void> {
  let remaining = qty
  const packs = await InvBatchPack.findAll({
    where: { batchId },
    order: [['seqNo', 'ASC']],
    transaction,
    lock: transaction ? true : undefined,
  })
  for (const pack of packs) {
    if (remaining <= 0) break
    const room = Number(pack.qtyPerPack || 0) - Number(pack.qtyAvailable || 0)
    if (room <= 0) continue
    const give = Math.min(room, remaining)
    await pack.update({ qtyAvailable: Number(pack.qtyAvailable || 0) + give }, { transaction })
    remaining -= give
  }
}

function applyConsumedStatus(available: number): { qtyAvailable: number; status: string; category?: string } {
  // Matches Python deduct_qty: remaining 0 → CONSUMED/historic, else PARTIALLY_CONSUMED.
  if (available <= 0) {
    return { qtyAvailable: 0, status: 'CONSUMED', category: 'historic' }
  }
  return { qtyAvailable: available, status: 'PARTIALLY_CONSUMED' }
}

export async function deductQty(opts: {
  batchId: number
  qty: number
  eventType: string
  performedBy: string
  refNo?: string | null
  module?: string | null
  issuedTo?: string | null
  purpose?: string | null
  projectCode?: string | null
  remarks?: string | null
  transaction?: Transaction
}): Promise<{ qtyAvailable: number; status: string }> {
  const { batchId, qty, transaction } = opts
  const batch = await InvBatch.findByPk(batchId, { transaction, lock: transaction ? true : undefined })
  if (!batch) throw new NotFoundError('Batch not found')
  if (BLOCKED_STATUSES.has(batch.status ?? '')) {
    throw new BadRequestError(`Batch ${batchId} has status '${batch.status}' and cannot be issued.`)
  }
  if (qty <= 0) throw new BadRequestError('Quantity must be greater than zero.')
  const available = Number(batch.qtyAvailable || 0)
  if (qty > available) {
    throw new BadRequestError(`Insufficient stock. Available: ${available}, requested: ${qty}.`)
  }

  const next = applyConsumedStatus(available - qty)
  await batch.update({ qtyAvailable: next.qtyAvailable, status: next.status, ...(next.category ? { category: next.category } : {}), updatedAt: new Date() }, { transaction })
  if (batch.includePack) await deductFromPacks(batchId, qty, transaction)

  await InvBatchEvent.create({
    batchId,
    eventType: opts.eventType,
    qty,
    refNo: opts.refNo ?? null,
    module: opts.module ?? null,
    issuedTo: opts.issuedTo ?? null,
    purpose: opts.purpose ?? null,
    projectCode: opts.projectCode ?? null,
    performedBy: opts.performedBy,
    performedAt: new Date(),
    remarks: opts.remarks ?? null,
  }, { transaction })

  return { qtyAvailable: next.qtyAvailable, status: next.status }
}

/** Deduct from one pack and keep the parent batch aggregate in sync (Python deduct_pack_qty). */
export async function deductPackQty(opts: {
  packId: number
  qty: number
  eventType: string
  performedBy: string
  refNo?: string | null
  module?: string | null
  issuedTo?: string | null
  purpose?: string | null
  projectCode?: string | null
  remarks?: string | null
  transaction?: Transaction
}): Promise<{ qtyAvailable: number; status: string }> {
  const { packId, qty, transaction } = opts
  const pack = await InvBatchPack.findByPk(packId, { transaction, lock: transaction ? true : undefined })
  if (!pack) throw new NotFoundError('Pack not found')
  const batch = await InvBatch.findByPk(pack.batchId, { transaction, lock: transaction ? true : undefined })
  if (!batch) throw new NotFoundError('Parent batch for pack not found')
  if (BLOCKED_STATUSES.has(batch.status ?? '')) {
    throw new BadRequestError(`Batch ${batch.id} has status '${batch.status}' and cannot be issued.`)
  }
  if (qty <= 0) throw new BadRequestError('Quantity must be greater than zero.')
  const packAvailable = Number(pack.qtyAvailable ?? 0)
  if (qty > packAvailable) {
    throw new BadRequestError(
      `Insufficient stock in pack '${pack.inhouseBatchNo}'. Available: ${packAvailable}, requested: ${qty}.`,
    )
  }

  await pack.update({ qtyAvailable: packAvailable - qty }, { transaction })
  const next = applyConsumedStatus(Math.max(Number(batch.qtyAvailable || 0) - qty, 0))
  await batch.update({
    qtyAvailable: next.qtyAvailable,
    status: next.status,
    ...(next.category ? { category: next.category } : {}),
    updatedAt: new Date(),
  }, { transaction })

  await InvBatchEvent.create({
    batchId: batch.id,
    eventType: opts.eventType,
    qty,
    refNo: opts.refNo ?? null,
    module: opts.module ?? null,
    issuedTo: opts.issuedTo ?? null,
    purpose: opts.purpose ?? null,
    projectCode: opts.projectCode ?? null,
    performedBy: opts.performedBy,
    performedAt: new Date(),
    remarks: opts.remarks ?? null,
  }, { transaction })

  return { qtyAvailable: next.qtyAvailable, status: next.status }
}

export async function restoreQty(opts: {
  batchId: number
  qty: number
  performedBy: string
  remarks?: string | null
  transaction?: Transaction
}): Promise<{ qtyAvailable: number; status: string }> {
  const { batchId, qty, transaction } = opts
  const batch = await InvBatch.findByPk(batchId, { transaction, lock: transaction ? true : undefined })
  if (!batch) throw new NotFoundError('Batch not found')

  const available = Number(batch.qtyAvailable || 0) + qty
  const received = Number(batch.qtyReceived || 0)
  let status = batch.status ?? 'AVAILABLE'
  let category = batch.category
  if (['CONSUMED', 'PARTIALLY_CONSUMED'].includes(status)) {
    status = available < received ? 'PARTIALLY_CONSUMED' : 'AVAILABLE'
    category = 'available'
  }
  await batch.update({ qtyAvailable: available, status, category, updatedAt: new Date() }, { transaction })
  if (batch.includePack) await restoreToPacks(batchId, qty, transaction)

  await InvBatchEvent.create({
    batchId,
    eventType: 'ADJUSTMENT',
    qty,
    performedBy: opts.performedBy,
    performedAt: new Date(),
    remarks: opts.remarks ?? null,
  }, { transaction })

  return { qtyAvailable: available, status }
}
