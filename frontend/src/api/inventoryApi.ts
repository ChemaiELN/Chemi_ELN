/**
 * Inventory Master — API service layer
 * All calls go through chemiaClient (Bearer token, 401 refresh, error extraction).
 */
import client from '@/utilities/chemiaClient'
import type {
  Material, Manufacturer, ManufacturerMapping,
  Batch, BatchEvent, BatchVerification,
  StockRequest, StockRequestEvent,
  EquipmentType, InstrumentType, ColumnType,
  EquipmentCatalogue, InstrumentCatalogue, ColumnCatalogue,
  MaintenanceSchedule, CalibrationSchedule,
  EquipmentVerification, InstrumentVerification,
  AuditTrailPage,
  DashboardKpis, AvailableStockRow, ExpiringBatch, PendingAction,
  BatchInventoryRow, ExpiryReportRow, StockRequestReportRow, EquipmentStatusRow,
} from '@/pages/inventory/types'

const B = '/api/inventory'

// ─── helpers ─────────────────────────────────────────────────────────────────

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ─── Materials ────────────────────────────────────────────────────────────────

export interface MaterialListParams {
  search?: string; type?: string; is_active?: boolean
}
export const getMaterials = async (p: MaterialListParams = {}): Promise<Material[]> => {
  const { data } = await client.get<Material[]>(`${B}/materials${qs(p)}`)
  return data
}
export const getMaterial = async (id: number): Promise<Material> => {
  const { data } = await client.get<Material>(`${B}/materials/${id}`)
  return data
}
export const createMaterial = async (body: Partial<Material>): Promise<Material> => {
  const { data } = await client.post<Material>(`${B}/materials`, body)
  return data
}
export const updateMaterial = async (id: number, body: Partial<Material>): Promise<Material> => {
  const { data } = await client.patch<Material>(`${B}/materials/${id}`, body)
  return data
}
export const toggleMaterial = async (id: number): Promise<Material> => {
  const { data } = await client.patch<Material>(`${B}/materials/${id}/toggle`)
  return data
}
export const upsertChemicalProps = async (id: number, body: object): Promise<Material> => {
  const { data } = await client.put<Material>(`${B}/materials/${id}/chemical-props`, body)
  return data
}
export const upsertFormulationProps = async (id: number, body: object): Promise<Material> => {
  const { data } = await client.put<Material>(`${B}/materials/${id}/formulation-props`, body)
  return data
}

// ─── Manufacturers ────────────────────────────────────────────────────────────

export const getManufacturers = async (p: { search?: string; is_active?: boolean } = {}): Promise<Manufacturer[]> => {
  const { data } = await client.get<Manufacturer[]>(`${B}/manufacturers${qs(p)}`)
  return data
}
export const getManufacturer = async (id: number): Promise<Manufacturer> => {
  const { data } = await client.get<Manufacturer>(`${B}/manufacturers/${id}`)
  return data
}
export const createManufacturer = async (body: Partial<Manufacturer>): Promise<Manufacturer> => {
  const { data } = await client.post<Manufacturer>(`${B}/manufacturers`, body)
  return data
}
export const updateManufacturer = async (id: number, body: Partial<Manufacturer>): Promise<Manufacturer> => {
  const { data } = await client.patch<Manufacturer>(`${B}/manufacturers/${id}`, body)
  return data
}
export const toggleManufacturer = async (id: number): Promise<Manufacturer> => {
  const { data } = await client.patch<Manufacturer>(`${B}/manufacturers/${id}/toggle`)
  return data
}

// ─── Mappings ─────────────────────────────────────────────────────────────────

export const getMappings = async (p: { material_id?: number; manufacturer_id?: number } = {}): Promise<ManufacturerMapping[]> => {
  const { data } = await client.get<ManufacturerMapping[]>(`${B}/mappings${qs(p)}`)
  return data
}
export const createMapping = async (body: Partial<ManufacturerMapping>): Promise<ManufacturerMapping> => {
  const { data } = await client.post<ManufacturerMapping>(`${B}/mappings`, body)
  return data
}
export const updateMapping = async (id: number, body: Partial<ManufacturerMapping>): Promise<ManufacturerMapping> => {
  const { data } = await client.patch<ManufacturerMapping>(`${B}/mappings/${id}`, body)
  return data
}
export const deleteMapping = async (id: number): Promise<void> => {
  await client.delete(`${B}/mappings/${id}`)
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

export interface AuditTrailParams {
  event_type?: string; entity_type?: string; performed_by?: string
  date_from?: string; date_to?: string; page?: number; page_size?: number
}
export const getAuditTrail = async (p: AuditTrailParams = {}): Promise<AuditTrailPage> => {
  const { data } = await client.get<AuditTrailPage>(`${B}/audit-trail${qs(p)}`)
  return data
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export interface BatchListParams {
  category?: string; material_id?: number; status?: string
  search?: string; is_active?: boolean
}
export const getBatches = async (p: BatchListParams = {}): Promise<Batch[]> => {
  const { data } = await client.get<Batch[]>(`${B}/batches${qs(p)}`)
  return data
}
export const getBatch = async (id: number): Promise<Batch> => {
  const { data } = await client.get<Batch>(`${B}/batches/${id}`)
  return data
}
export const createBatch = async (body: Partial<Batch>): Promise<Batch> => {
  const { data } = await client.post<Batch>(`${B}/batches`, body)
  return data
}
export const updateBatch = async (id: number, body: Partial<Batch>): Promise<Batch> => {
  const { data } = await client.patch<Batch>(`${B}/batches/${id}`, body)
  return data
}
export const toggleBatch = async (id: number): Promise<Batch> => {
  const { data } = await client.patch<Batch>(`${B}/batches/${id}/toggle`)
  return data
}
export const issueBatch = async (id: number, body: object): Promise<Batch> => {
  const { data } = await client.post<Batch>(`${B}/batches/${id}/issue`, body)
  return data
}
export const allocateBatch = async (id: number, body: object): Promise<Batch> => {
  const { data } = await client.post<Batch>(`${B}/batches/${id}/allocate`, body)
  return data
}
export const getBatchEvents = async (id: number, event_type?: string): Promise<BatchEvent[]> => {
  const { data } = await client.get<BatchEvent[]>(`${B}/batches/${id}/events${qs({ event_type })}`)
  return data
}

// ─── Batch Verifications ──────────────────────────────────────────────────────

export const getBatchVerifications = async (p: { batch_id?: number; status?: string } = {}): Promise<BatchVerification[]> => {
  const { data } = await client.get<BatchVerification[]>(`${B}/batch-verifications${qs(p)}`)
  return data
}
export const getBatchVerification = async (id: number): Promise<BatchVerification> => {
  const { data } = await client.get<BatchVerification>(`${B}/batch-verifications/${id}`)
  return data
}
export const createBatchVerification = async (body: object): Promise<BatchVerification> => {
  const { data } = await client.post<BatchVerification>(`${B}/batch-verifications`, body)
  return data
}
export const approveBatchVerification = async (id: number, remarks?: string): Promise<BatchVerification> => {
  const { data } = await client.patch<BatchVerification>(`${B}/batch-verifications/${id}/verify`, { remarks })
  return data
}
export const rejectBatchVerification = async (id: number, remarks?: string): Promise<BatchVerification> => {
  const { data } = await client.patch<BatchVerification>(`${B}/batch-verifications/${id}/reject`, { remarks })
  return data
}

// ─── Stock Requests ───────────────────────────────────────────────────────────

export interface StockRequestListParams {
  material_id?: number; status?: string; criticality?: string; search?: string
}
export const getStockRequests = async (p: StockRequestListParams = {}): Promise<StockRequest[]> => {
  const { data } = await client.get<StockRequest[]>(`${B}/stock-requests${qs(p)}`)
  return data
}
export const getStockRequest = async (id: number): Promise<StockRequest> => {
  const { data } = await client.get<StockRequest>(`${B}/stock-requests/${id}`)
  return data
}
export const createStockRequest = async (body: Partial<StockRequest>): Promise<StockRequest> => {
  const { data } = await client.post<StockRequest>(`${B}/stock-requests`, body)
  return data
}
export const updateStockRequest = async (id: number, body: Partial<StockRequest>): Promise<StockRequest> => {
  const { data } = await client.patch<StockRequest>(`${B}/stock-requests/${id}`, body)
  return data
}
export const approveStockRequest = async (id: number, remarks?: string): Promise<StockRequest> => {
  const { data } = await client.patch<StockRequest>(`${B}/stock-requests/${id}/approve`, { remarks })
  return data
}
export const rejectStockRequest = async (id: number, remarks?: string): Promise<StockRequest> => {
  const { data } = await client.patch<StockRequest>(`${B}/stock-requests/${id}/reject`, { remarks })
  return data
}
export const fulfillStockRequest = async (id: number, remarks?: string): Promise<StockRequest> => {
  const { data } = await client.patch<StockRequest>(`${B}/stock-requests/${id}/fulfill`, { remarks })
  return data
}
export const cancelStockRequest = async (id: number): Promise<StockRequest> => {
  const { data } = await client.patch<StockRequest>(`${B}/stock-requests/${id}/cancel`)
  return data
}
export const getStockRequestEvents = async (id: number): Promise<StockRequestEvent[]> => {
  const { data } = await client.get<StockRequestEvent[]>(`${B}/stock-requests/${id}/events`)
  return data
}

// ─── Equipment Types ──────────────────────────────────────────────────────────

export const getEquipmentTypes = async (p: { search?: string; is_active?: boolean } = {}): Promise<EquipmentType[]> => {
  const { data } = await client.get<EquipmentType[]>(`${B}/equipment-types${qs(p)}`)
  return data
}
export const createEquipmentType = async (body: Partial<EquipmentType>): Promise<EquipmentType> => {
  const { data } = await client.post<EquipmentType>(`${B}/equipment-types`, body)
  return data
}
export const updateEquipmentType = async (id: number, body: Partial<EquipmentType>): Promise<EquipmentType> => {
  const { data } = await client.patch<EquipmentType>(`${B}/equipment-types/${id}`, body)
  return data
}
export const toggleEquipmentType = async (id: number): Promise<EquipmentType> => {
  const { data } = await client.patch<EquipmentType>(`${B}/equipment-types/${id}/toggle`)
  return data
}

export const getInstrumentTypes = async (p: { search?: string; is_active?: boolean } = {}): Promise<InstrumentType[]> => {
  const { data } = await client.get<InstrumentType[]>(`${B}/instrument-types${qs(p)}`)
  return data
}
export const createInstrumentType = async (body: Partial<InstrumentType>): Promise<InstrumentType> => {
  const { data } = await client.post<InstrumentType>(`${B}/instrument-types`, body)
  return data
}
export const updateInstrumentType = async (id: number, body: Partial<InstrumentType>): Promise<InstrumentType> => {
  const { data } = await client.patch<InstrumentType>(`${B}/instrument-types/${id}`, body)
  return data
}
export const toggleInstrumentType = async (id: number): Promise<InstrumentType> => {
  const { data } = await client.patch<InstrumentType>(`${B}/instrument-types/${id}/toggle`)
  return data
}

export const getColumnTypes = async (p: { search?: string; is_active?: boolean } = {}): Promise<ColumnType[]> => {
  const { data } = await client.get<ColumnType[]>(`${B}/column-types${qs(p)}`)
  return data
}
export const createColumnType = async (body: Partial<ColumnType>): Promise<ColumnType> => {
  const { data } = await client.post<ColumnType>(`${B}/column-types`, body)
  return data
}
export const updateColumnType = async (id: number, body: Partial<ColumnType>): Promise<ColumnType> => {
  const { data } = await client.patch<ColumnType>(`${B}/column-types/${id}`, body)
  return data
}
export const toggleColumnType = async (id: number): Promise<ColumnType> => {
  const { data } = await client.patch<ColumnType>(`${B}/column-types/${id}/toggle`)
  return data
}

// ─── Equipment Catalogues ─────────────────────────────────────────────────────

export interface EquipCatalogueParams {
  search?: string; status?: string; equipment_type_id?: number
  maintenance_status?: string; is_active?: boolean
}
export const getEquipmentCatalogue = async (p: EquipCatalogueParams = {}): Promise<EquipmentCatalogue[]> => {
  const { data } = await client.get<EquipmentCatalogue[]>(`${B}/equipment-catalogue${qs(p)}`)
  return data
}
export const getEquipmentById = async (id: number): Promise<EquipmentCatalogue> => {
  const { data } = await client.get<EquipmentCatalogue>(`${B}/equipment-catalogue/${id}`)
  return data
}
export const createEquipment = async (body: Partial<EquipmentCatalogue>): Promise<EquipmentCatalogue> => {
  const { data } = await client.post<EquipmentCatalogue>(`${B}/equipment-catalogue`, body)
  return data
}
export const updateEquipment = async (id: number, body: Partial<EquipmentCatalogue>): Promise<EquipmentCatalogue> => {
  const { data } = await client.patch<EquipmentCatalogue>(`${B}/equipment-catalogue/${id}`, body)
  return data
}
export const toggleEquipment = async (id: number): Promise<EquipmentCatalogue> => {
  const { data } = await client.patch<EquipmentCatalogue>(`${B}/equipment-catalogue/${id}/toggle`)
  return data
}

export interface InstrCatalogueParams {
  search?: string; status?: string; instrument_type_id?: number
  calibration_status?: string; is_active?: boolean
}
export const getInstrumentCatalogue = async (p: InstrCatalogueParams = {}): Promise<InstrumentCatalogue[]> => {
  const { data } = await client.get<InstrumentCatalogue[]>(`${B}/instrument-catalogue${qs(p)}`)
  return data
}
export const getInstrumentById = async (id: number): Promise<InstrumentCatalogue> => {
  const { data } = await client.get<InstrumentCatalogue>(`${B}/instrument-catalogue/${id}`)
  return data
}
export const createInstrument = async (body: Partial<InstrumentCatalogue>): Promise<InstrumentCatalogue> => {
  const { data } = await client.post<InstrumentCatalogue>(`${B}/instrument-catalogue`, body)
  return data
}
export const updateInstrument = async (id: number, body: Partial<InstrumentCatalogue>): Promise<InstrumentCatalogue> => {
  const { data } = await client.patch<InstrumentCatalogue>(`${B}/instrument-catalogue/${id}`, body)
  return data
}
export const toggleInstrument = async (id: number): Promise<InstrumentCatalogue> => {
  const { data } = await client.patch<InstrumentCatalogue>(`${B}/instrument-catalogue/${id}/toggle`)
  return data
}

export interface ColCatalogueParams {
  search?: string; status?: string; column_type_id?: number; is_active?: boolean
}
export const getColumnCatalogue = async (p: ColCatalogueParams = {}): Promise<ColumnCatalogue[]> => {
  const { data } = await client.get<ColumnCatalogue[]>(`${B}/column-catalogue${qs(p)}`)
  return data
}
export const getColumnById = async (id: number): Promise<ColumnCatalogue> => {
  const { data } = await client.get<ColumnCatalogue>(`${B}/column-catalogue/${id}`)
  return data
}
export const createColumn = async (body: Partial<ColumnCatalogue>): Promise<ColumnCatalogue> => {
  const { data } = await client.post<ColumnCatalogue>(`${B}/column-catalogue`, body)
  return data
}
export const updateColumn = async (id: number, body: Partial<ColumnCatalogue>): Promise<ColumnCatalogue> => {
  const { data } = await client.patch<ColumnCatalogue>(`${B}/column-catalogue/${id}`, body)
  return data
}
export const toggleColumn = async (id: number): Promise<ColumnCatalogue> => {
  const { data } = await client.patch<ColumnCatalogue>(`${B}/column-catalogue/${id}/toggle`)
  return data
}

// ─── Maintenance Schedules ────────────────────────────────────────────────────

export const getMaintenanceSchedules = async (p: { equipment_id?: number; status?: string } = {}): Promise<MaintenanceSchedule[]> => {
  const { data } = await client.get<MaintenanceSchedule[]>(`${B}/maintenance-schedules${qs(p)}`)
  return data
}
export const createMaintenanceSchedule = async (body: object): Promise<MaintenanceSchedule> => {
  const { data } = await client.post<MaintenanceSchedule>(`${B}/maintenance-schedules`, body)
  return data
}
export const updateMaintenanceSchedule = async (id: number, body: object): Promise<MaintenanceSchedule> => {
  const { data } = await client.patch<MaintenanceSchedule>(`${B}/maintenance-schedules/${id}`, body)
  return data
}
export const completeMaintenanceSchedule = async (id: number, body: object): Promise<MaintenanceSchedule> => {
  const { data } = await client.patch<MaintenanceSchedule>(`${B}/maintenance-schedules/${id}/complete`, body)
  return data
}
export const cancelMaintenanceSchedule = async (id: number): Promise<MaintenanceSchedule> => {
  const { data } = await client.patch<MaintenanceSchedule>(`${B}/maintenance-schedules/${id}/cancel`)
  return data
}

// ─── Calibration Schedules ────────────────────────────────────────────────────

export const getCalibrationSchedules = async (p: { instrument_id?: number; status?: string } = {}): Promise<CalibrationSchedule[]> => {
  const { data } = await client.get<CalibrationSchedule[]>(`${B}/calibration-schedules${qs(p)}`)
  return data
}
export const createCalibrationSchedule = async (body: object): Promise<CalibrationSchedule> => {
  const { data } = await client.post<CalibrationSchedule>(`${B}/calibration-schedules`, body)
  return data
}
export const updateCalibrationSchedule = async (id: number, body: object): Promise<CalibrationSchedule> => {
  const { data } = await client.patch<CalibrationSchedule>(`${B}/calibration-schedules/${id}`, body)
  return data
}
export const completeCalibrationSchedule = async (id: number, body: object): Promise<CalibrationSchedule> => {
  const { data } = await client.patch<CalibrationSchedule>(`${B}/calibration-schedules/${id}/complete`, body)
  return data
}
export const cancelCalibrationSchedule = async (id: number): Promise<CalibrationSchedule> => {
  const { data } = await client.patch<CalibrationSchedule>(`${B}/calibration-schedules/${id}/cancel`)
  return data
}

// ─── Equipment Verifications ──────────────────────────────────────────────────

export const getEquipmentVerifications = async (p: { equipment_id?: number; status?: string } = {}): Promise<EquipmentVerification[]> => {
  const { data } = await client.get<EquipmentVerification[]>(`${B}/equipment-verifications${qs(p)}`)
  return data
}
export const createEquipmentVerification = async (body: object): Promise<EquipmentVerification> => {
  const { data } = await client.post<EquipmentVerification>(`${B}/equipment-verifications`, body)
  return data
}
export const approveEquipmentVerification = async (id: number, remarks?: string): Promise<EquipmentVerification> => {
  const { data } = await client.patch<EquipmentVerification>(`${B}/equipment-verifications/${id}/verify`, { remarks })
  return data
}
export const rejectEquipmentVerification = async (id: number, remarks?: string): Promise<EquipmentVerification> => {
  const { data } = await client.patch<EquipmentVerification>(`${B}/equipment-verifications/${id}/reject`, { remarks })
  return data
}

// ─── Instrument Verifications ─────────────────────────────────────────────────

export const getInstrumentVerifications = async (p: { instrument_id?: number; status?: string } = {}): Promise<InstrumentVerification[]> => {
  const { data } = await client.get<InstrumentVerification[]>(`${B}/instrument-verifications${qs(p)}`)
  return data
}
export const createInstrumentVerification = async (body: object): Promise<InstrumentVerification> => {
  const { data } = await client.post<InstrumentVerification>(`${B}/instrument-verifications`, body)
  return data
}
export const approveInstrumentVerification = async (id: number, remarks?: string): Promise<InstrumentVerification> => {
  const { data } = await client.patch<InstrumentVerification>(`${B}/instrument-verifications/${id}/verify`, { remarks })
  return data
}
export const rejectInstrumentVerification = async (id: number, remarks?: string): Promise<InstrumentVerification> => {
  const { data } = await client.patch<InstrumentVerification>(`${B}/instrument-verifications/${id}/reject`, { remarks })
  return data
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getInventoryKpis = async (): Promise<DashboardKpis> => {
  const { data } = await client.get<DashboardKpis>(`${B}/dashboard/kpis`)
  return data
}
export const getAvailableStock = async (material_type?: string): Promise<AvailableStockRow[]> => {
  const { data } = await client.get<AvailableStockRow[]>(`${B}/dashboard/available-stock${qs({ material_type })}`)
  return data
}
export const getExpiringSoon = async (days = 60): Promise<ExpiringBatch[]> => {
  const { data } = await client.get<ExpiringBatch[]>(`${B}/dashboard/expiring-soon${qs({ days })}`)
  return data
}
export const getPendingActions = async (): Promise<PendingAction[]> => {
  const { data } = await client.get<PendingAction[]>(`${B}/dashboard/pending-actions`)
  return data
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface BatchInventoryReportParams {
  category?: string; material_id?: number; material_type?: string
  status?: string; location?: string
}
export const reportBatchInventory = async (p: BatchInventoryReportParams = {}): Promise<BatchInventoryRow[]> => {
  const { data } = await client.get<BatchInventoryRow[]>(`${B}/reports/batch-inventory${qs(p)}`)
  return data
}

export interface ExpiryReportParams {
  date_from?: string; date_to?: string; include_expired?: boolean
}
export const reportExpiry = async (p: ExpiryReportParams = {}): Promise<ExpiryReportRow[]> => {
  const { data } = await client.get<ExpiryReportRow[]>(`${B}/reports/expiry${qs(p)}`)
  return data
}

export interface StockRequestReportParams {
  status?: string; criticality?: string; material_id?: number
  requested_by?: string; date_from?: string; date_to?: string
}
export const reportStockRequests = async (p: StockRequestReportParams = {}): Promise<StockRequestReportRow[]> => {
  const { data } = await client.get<StockRequestReportRow[]>(`${B}/reports/stock-requests${qs(p)}`)
  return data
}

export interface EquipmentStatusReportParams {
  asset_type?: string; status?: string; service_status?: string
}
export const reportEquipmentStatus = async (p: EquipmentStatusReportParams = {}): Promise<EquipmentStatusRow[]> => {
  const { data } = await client.get<EquipmentStatusRow[]>(`${B}/reports/equipment-status${qs(p)}`)
  return data
}
