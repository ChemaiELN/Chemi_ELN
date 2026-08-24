import { Router, Request, Response, NextFunction } from 'express'
import { Op, where, col, literal } from 'sequelize'
import {
  InvMaterial,
  InvBatch,
  InvWorkOrder,
  InvStockRequest,
  InvGatePass,
  InvSchedule,
  InvEquipmentCatalogue,
  InvInstrumentCatalogue,
  InvChecklist,
} from '../../models/InventoryModels.model'
import { successResponse, listResponse, buildPagination, parsePagination } from '../../utils/response'
import { authenticate } from '../../middleware/auth.middleware'

const dashboardRouter = Router()

// GET /dashboard/kpis
dashboardRouter.get('/kpis', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const in30Days = new Date()
    in30Days.setDate(today.getDate() + 30)
    const in30DaysStr = in30Days.toISOString().split('T')[0]
    const in7Days = new Date()
    in7Days.setDate(today.getDate() + 7)
    const in7DaysStr = in7Days.toISOString().split('T')[0]
    const PENDING_STATES = ['PENDING_VERIFICATION', 'PENDING_APPROVAL']

    const [
      activeMaterials,
      materialsWithStock,
      availableBatches,
      lowStockBatches,
      expiringSoon,
      pendingStockRequests,
      criticalStockRequests,
      pendingWorkOrders,
      pendingChecklists,
      maintenanceDue,
      calibrationDue,
    ] = await Promise.all([
      InvMaterial.count({ where: { isActive: true } }),
      InvBatch.count({ where: { status: 'AVAILABLE', qtyAvailable: { [Op.gt]: 0 } }, distinct: true, col: 'material_id' }),
      InvBatch.count({ where: { status: 'AVAILABLE' } }),
      InvBatch.count({
        where: {
          [Op.and]: [
            { status: 'AVAILABLE', qtyReceived: { [Op.gt]: 0 } },
            where(col('qty_available'), Op.lte, literal('qty_received * 0.1')),
          ],
        },
      }),
      InvBatch.count({
        where: {
          expiryDate: { [Op.ne]: null, [Op.gte]: todayStr, [Op.lte]: in30DaysStr },
          qtyAvailable: { [Op.gt]: 0 },
        },
      }),
      InvStockRequest.count({ where: { status: 'PENDING' } }),
      InvStockRequest.count({ where: { status: 'PENDING', criticality: 'CRITICAL' } }),
      InvWorkOrder.count({ where: { status: { [Op.in]: PENDING_STATES } } }),
      InvChecklist.count({ where: { status: { [Op.in]: PENDING_STATES } } }),
      InvEquipmentCatalogue.count({
        where: { isActive: true, nextMaintenanceDate: { [Op.ne]: null, [Op.lte]: in7DaysStr } },
      }),
      InvInstrumentCatalogue.count({
        where: { isActive: true, requiredCalibration: true, nextCalibrationDate: { [Op.ne]: null, [Op.lte]: in7DaysStr } },
      }),
    ])

    res.json(
      successResponse('KPIs fetched', {
        active_materials: activeMaterials,
        available_batches: availableBatches,
        out_of_stock: Math.max(activeMaterials - materialsWithStock, 0),
        low_stock: lowStockBatches,
        expiring_soon: expiringSoon,
        pending_stock_requests: pendingStockRequests,
        critical_stock_requests: criticalStockRequests,
        pending_approvals_total: pendingStockRequests + pendingWorkOrders + pendingChecklists,
        maintenance_due: maintenanceDue,
        calibration_due: calibrationDue,
      }),
    )
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/available-stock
dashboardRouter.get('/available-stock', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)

    const { count, rows } = await InvBatch.findAndCountAll({
      where: { status: 'AVAILABLE' },
      include: [{ model: InvMaterial, as: 'material' }],
      order: [['expiryDate', 'ASC']],
      limit,
      offset,
    })
    res.json(listResponse('Available stock fetched', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/expiring-soon
dashboardRouter.get('/expiring-soon', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date()
    const in30Days = new Date()
    in30Days.setDate(today.getDate() + 30)

    const rows = await InvBatch.findAll({
      where: {
        expiryDate: {
          [Op.gte]: today.toISOString().split('T')[0],
          [Op.lte]: in30Days.toISOString().split('T')[0],
        },
      },
      include: [{ model: InvMaterial, as: 'material' }],
      order: [['expiryDate', 'ASC']],
    })
    res.json(successResponse('Expiring soon', rows))
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/pending-actions
dashboardRouter.get('/pending-actions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [pendingStockRequests, openWorkOrders, pendingChecklists] = await Promise.all([
      InvStockRequest.count({ where: { status: 'PENDING' } }),
      InvWorkOrder.count({ where: { status: { [Op.in]: ['OPEN', 'IN_PROGRESS', 'RAISED'] } } }),
      InvChecklist.count({ where: { status: 'PENDING_APPROVAL' } }),
    ])
    res.json(
      successResponse('Pending actions', {
        pendingStockRequests,
        openWorkOrders,
        pendingChecklists,
      }),
    )
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/pending-approvals
// Frontend shape: PendingApproval[] — { type, reference_no, status, raised_by, raised_at, age_days }
// Mirrors backend/app/modules/inventory/dashboard.py:188 — stock requests in PENDING,
// plus work orders and checklists awaiting verification or approval, newest-aged first.
dashboardRouter.get('/pending-approvals', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = Date.now()
    const MS_PER_DAY = 86_400_000
    const PENDING_STATES = ['PENDING_VERIFICATION', 'PENDING_APPROVAL']

    const ageDays = (d: unknown): number | null =>
      d ? Math.floor((now - new Date(d as Date).getTime()) / MS_PER_DAY) : null
    const iso = (d: unknown): string | null => (d ? new Date(d as Date).toISOString() : null)

    const [stockRequests, workOrders, checklists] = await Promise.all([
      InvStockRequest.findAll({ where: { status: 'PENDING' } }),
      InvWorkOrder.findAll({ where: { status: { [Op.in]: PENDING_STATES } } }),
      InvChecklist.findAll({ where: { status: { [Op.in]: PENDING_STATES } } }),
    ])

    const items = [
      ...stockRequests.map((sr) => {
        const r = sr as any
        return {
          type: 'Stock Request',
          reference_no: r.requestNo,
          status: r.status,
          raised_by: r.requestedBy ?? null,
          raised_at: iso(r.createdAt),
          age_days: ageDays(r.createdAt),
        }
      }),
      ...workOrders.map((wo) => {
        const r = wo as any
        return {
          type: 'Work Order',
          reference_no: r.workorderNo,
          status: r.status,
          raised_by: r.raisedBy ?? null,
          raised_at: iso(r.raisedAt),
          age_days: ageDays(r.raisedAt),
        }
      }),
      ...checklists.map((cl) => {
        const r = cl as any
        return {
          type: 'Checklist',
          reference_no: r.name,
          status: r.status,
          raised_by: r.createdBy ?? null,
          raised_at: iso(r.createdAt),
          age_days: ageDays(r.createdAt),
        }
      }),
    ]

    items.sort((a, b) => (b.age_days ?? -1) - (a.age_days ?? -1))

    res.json(successResponse('Pending approvals', items))
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/maintenance-calibration-due
// Frontend shape: MaintenanceCalibrationDue[] — { type, asset_code, asset_name, due_date, days_until_due }
dashboardRouter.get('/maintenance-calibration-due', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Due dates live on the catalogues themselves (nextMaintenanceDate /
    // nextCalibrationDate), not on InvSchedule — see dashboard.py:234.
    const days = parseInt((req.query.days as string) ?? '7', 10)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const cutoff = new Date()
    cutoff.setDate(today.getDate() + days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const MS_PER_DAY = 86_400_000

    const daysUntil = (due: string): number =>
      Math.round((new Date(`${due}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) / MS_PER_DAY)

    const [equipment, instruments] = await Promise.all([
      InvEquipmentCatalogue.findAll({
        where: {
          isActive: true,
          nextMaintenanceDate: { [Op.ne]: null, [Op.lte]: cutoffStr },
        },
        order: [['nextMaintenanceDate', 'ASC']],
      }),
      InvInstrumentCatalogue.findAll({
        where: {
          isActive: true,
          requiredCalibration: true,
          nextCalibrationDate: { [Op.ne]: null, [Op.lte]: cutoffStr },
        },
        order: [['nextCalibrationDate', 'ASC']],
      }),
    ])

    const items = [
      ...equipment.map((eq) => {
        const r = eq as any
        const due = String(r.nextMaintenanceDate).split('T')[0]
        return {
          type: 'Maintenance' as const,
          asset_code: r.assetId,
          asset_name: r.name,
          due_date: due,
          days_until_due: daysUntil(due),
        }
      }),
      ...instruments.map((inst) => {
        const r = inst as any
        const due = String(r.nextCalibrationDate).split('T')[0]
        return {
          type: 'Calibration' as const,
          asset_code: r.assetId,
          asset_name: r.name,
          due_date: due,
          days_until_due: daysUntil(due),
        }
      }),
    ]

    items.sort((a, b) => a.due_date.localeCompare(b.due_date))

    res.json(successResponse('Maintenance/calibration due', items))
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/equipment-status
// Frontend shape: { equipment: [{status, count}], instruments: [{status, count}] }
dashboardRouter.get('/equipment-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [equipmentByStatus, instrumentByStatus] = await Promise.all([
      InvEquipmentCatalogue.findAll({
        attributes: [
          'status',
          [InvEquipmentCatalogue.sequelize!.fn('COUNT', InvEquipmentCatalogue.sequelize!.col('id')), 'count'],
        ],
        where: { isActive: true },
        group: ['status'],
      }),
      InvInstrumentCatalogue.findAll({
        attributes: [
          'status',
          [InvInstrumentCatalogue.sequelize!.fn('COUNT', InvInstrumentCatalogue.sequelize!.col('id')), 'count'],
        ],
        where: { isActive: true },
        group: ['status'],
      }),
    ])

    const toStatusCount = (rows: any[]) =>
      rows.map((r) => ({ status: r.status ?? r.get('status'), count: Number(r.get('count') ?? 0) }))

    res.json(successResponse('Equipment status', {
      equipment: toStatusCount(equipmentByStatus),
      instruments: toStatusCount(instrumentByStatus),
    }))
  } catch (err) {
    next(err)
  }
})

// GET /dashboard/expiry-timeline
// Frontend shape: ExpiryTimelinePoint[] — { month, count, qty }
dashboardRouter.get('/expiry-timeline', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = parseInt((req.query.months as string) ?? '6', 10)
    const { materialId } = req.query as Record<string, string>

    const today = new Date()
    const cutoff = new Date()
    cutoff.setMonth(today.getMonth() + months)

    // Only batches that still hold stock count toward the timeline — dashboard.py:305.
    const where: Record<string, unknown> = {
      expiryDate: {
        [Op.ne]: null,
        [Op.gte]: today.toISOString().split('T')[0],
        [Op.lt]: cutoff.toISOString().split('T')[0],
      },
      qtyAvailable: { [Op.gt]: 0 },
    }
    if (materialId) where.materialId = parseInt(materialId, 10)

    const rows = await InvBatch.findAll({
      where,
      attributes: ['expiryDate', 'qtyAvailable'],
      order: [['expiryDate', 'ASC']],
    })

    // Aggregate by YYYY-MM month bucket
    const buckets = new Map<string, { count: number; qty: number }>()
    for (const row of rows) {
      const r = row as any
      const d = r.expiryDate ? String(r.expiryDate).substring(0, 7) : 'unknown'
      const existing = buckets.get(d) ?? { count: 0, qty: 0 }
      existing.count += 1
      existing.qty += Number(r.qtyAvailable ?? 0)
      buckets.set(d, existing)
    }

    const timeline = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { count, qty }]) => ({ month, count, qty }))

    res.json(successResponse('Expiry timeline', timeline))
  } catch (err) {
    next(err)
  }
})

export default dashboardRouter
