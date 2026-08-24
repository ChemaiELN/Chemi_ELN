import { Router } from 'express'

import materialsRouter from './materials.routes'
import manufacturersRouter from './manufacturers.routes'
import mappingsRouter from './mappings.routes'
import batchesRouter from './batches.routes'
import stockRequestsRouter from './stockRequests.routes'
import masterDataLookupRouter from './masterDataLookup.routes'
import lookupRouter from './lookup.routes'
import uomRouter from './uom.routes'
import testMasterRouter from './testMaster.routes'
import storageLocationsRouter from './storageLocations.routes'
import { equipmentRouter, instrumentRouter, columnRouter } from './catalogue.routes'
import instrumentSpecRouter, { instrumentParamDetailRouter } from './instrumentSpec.routes'
import checklistRouter from './checklists.routes'
import scheduleRouter from './schedules.routes'
import logMappingRouter from './logMappings.routes'
import workOrderRouter from './workOrders.routes'
import gatePassRouter from './gatePasses.routes'
import usageLogRouter from './usageLogs.routes'
import dashboardRouter from './dashboard.routes'
import reportsRouter from './reports.routes'
import auditTrailRouter from './auditTrail.routes'
import consumableTypesRouter from './consumableTypes.routes'
import sparePartsRouter from './spareParts.routes'
import storageConditionsRouter from './storageConditions.routes'
import measurementMasterRouter from './measurementMaster.routes'
import masterTemplatesRouter from './masterTemplates.routes'

const router = Router()

// Materials, manufacturers, mappings
router.use('/materials', materialsRouter)
router.use('/manufacturers', manufacturersRouter)
router.use('/mappings', mappingsRouter)

// Batches and stock
router.use('/batches', batchesRouter)
router.use('/stock-requests', stockRequestsRouter)

// Equipment / instrument / column catalogues.
// These MUST be mounted on their own prefixes, matching FastAPI
// (app/modules/inventory/catalogue.py:68,306,553). Mounting them at '/' made their
// '/:id' routes swallow every single-segment inventory path registered afterwards —
// e.g. GET /inventory/checklists became findByPk('checklists') and returned a 500.
router.use('/equipment', equipmentRouter)
router.use('/instruments', instrumentRouter)
router.use('/columns', columnRouter)

// Instrument spec: /:instrumentId/parameters and /:instrumentId/spec-details need the
// /instruments prefix to match the frontend's /api/inventory/instruments/:id/... calls;
// the flat /instrument-parameters/:id and /instrument-spec-details/:id edit/delete
// routes are a separate router mounted at root instead.
router.use('/instruments', instrumentSpecRouter)
router.use('/', instrumentParamDetailRouter)

// Master data lookups (equipment-types, instrument-types, column-types, consumable-types, etc.)
router.use('/', masterDataLookupRouter)

// UOM, test master, storage, lookup.
// uom / test-master / storage-locations declare their own '/uom-master', '/test-master'
// and '/storage-locations' prefixes on each handler, so they mount at the root — giving
// them a prefix here would produce '/inventory/uom-master/uom-master'.
router.use('/', uomRouter)
router.use('/', testMasterRouter)
router.use('/', storageLocationsRouter)
// lookupRouter declares its own '/lookup' and '/lookup/types' prefixes on each
// handler (see lookup.routes.ts), so it mounts at root like uom/test-master/
// storage-locations above — mounting it at '/lookup' here doubled the path.
router.use('/', lookupRouter)

// Checklists, schedules, log-mappings
router.use('/checklists', checklistRouter)
router.use('/schedules', scheduleRouter)
router.use('/log-mappings', logMappingRouter)

// Work orders, gate passes, usage logs — these also carry their own prefixes.
router.use('/', workOrderRouter)
router.use('/', gatePassRouter)
router.use('/', usageLogRouter)

// Dashboard, reports, audit trail.
// dashboardRouter's handlers are bare ('/kpis'), so it keeps a prefix here; reports and
// audit-trail declare theirs inline and mount at the root.
router.use('/dashboard', dashboardRouter)
router.use('/', reportsRouter)
router.use('/', auditTrailRouter)

// Additional master data
router.use('/consumable-types', consumableTypesRouter)
router.use('/spare-parts', sparePartsRouter)
router.use('/storage-conditions', storageConditionsRouter)
router.use('/measurement-master', measurementMasterRouter)
router.use('/master-templates', masterTemplatesRouter)

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Inventory module ready.' })
})

export default router
