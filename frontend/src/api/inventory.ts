import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './client'

// ── Shared types ──────────────────────────────────────────────────────────────
export interface ConsumableType { id: number; name: string; description: string | null; sort_order: number; is_active: boolean }
export interface ChemicalProps { purity_pct: number | null; grade: string | null; appearance: string | null; solubility: string | null; boiling_pt: number | null; melting_pt: number | null; flash_pt: number | null; density: number | null; ph_range: string | null }
export interface FormulationProps { role: string | null; concentration: number | null; units: string | null; function: string | null; compatibility_notes: string | null }
export interface Material { id: number; code: string; name: string; material_type: string | null; cas_no: string | null; molecular_formula: string | null; mol_weight: number | null; storage_condition: string | null; hazard_class: string | null; description: string | null; is_active: boolean; department_id: string | null; consumable_type_id: number | null; created_at: string; updated_at: string; chemical_props: ChemicalProps | null; formulation_props: FormulationProps | null }
export interface Manufacturer { id: number; code: string; name: string; country: string | null; contact_person: string | null; email: string | null; phone: string | null; website: string | null; address: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface Mapping { id: number; material_id: number; manufacturer_id: number; catalogue_no: string | null; technical_grade: string | null; lead_time_days: number | null; min_order_qty: number | null; dsd_file_path: string | null; created_at: string; updated_at: string }

// B3 types
export interface BatchPack { id: number; batch_id: number; seq_no: number; pack_no: string; qty_per_pack: number; qty_available: number; inhouse_batch_no: string }
export interface Batch {
  id: number; batch_no: string; material_id: number; manufacturer_id: number | null
  qty_received: number; qty_available: number; unit: string; status: string; category: string
  measuring_unit: string | null; include_pack: boolean; pack_number: number | null
  inhouse_batch_no: string | null; mfg_date: string | null; expiry_date: string | null
  retest_date: string | null; gr_date: string | null; coa_file_path: string | null
  other_docs_file_path: string | null; created_at: string; updated_at: string; packs: BatchPack[]
  // extended fields
  measuring_unit_value: number | null; pack_type: string | null; pack_mode: string | null
  location: string | null; invoice_no: string | null; po_no: string | null
  clone: string | null; iso_type: string | null; price: number | null
  received_by: string | null; received_at: string | null; remarks: string | null
  coa_filename: string | null; other_docs_filename: string | null
}
export interface BatchEvent { id: number; batch_id: number; event_type: string; qty: number | null; ref_no: string | null; module: string | null; issued_to: string | null; purpose: string | null; project_code: string | null; performed_by: string; performed_at: string; remarks: string | null }
export interface BatchVerification { id: number; request_no: string; batch_id: number; requested_by: string; requested_at: string; verified_by: string | null; verified_at: string | null; status: string; remarks: string | null }
export interface StockRequestEvent { id: number; request_id: number; event_type: string; performed_by: string; performed_at: string; remarks: string | null }
export interface StockRequest { id: number; request_no: string; material_id: number; qty_required: number; unit: string; criticality: string; status: string; created_at: string; updated_at: string; events: StockRequestEvent[]; required_by_date: string | null; purpose: string | null; requested_by: string | null; requested_at: string | null; approved_by: string | null; approved_at: string | null; remarks: string | null }
export interface MaintenanceSchedule { id: number; equipment_id: number; scheduled_date: string; completed_date: string | null; notes: string | null; status: string; created_at: string; updated_at: string }
export interface CalibrationSchedule { id: number; instrument_id: number; scheduled_date: string; completed_date: string | null; certificate_no: string | null; status: string; created_at: string; updated_at: string }
export interface EquipVerification { id: number; request_no: string; equipment_id: number; requested_by: string; requested_at: string; verified_by: string | null; verified_at: string | null; status: string; remarks: string | null }
export interface InstrVerification { id: number; request_no: string; instrument_id: number; requested_by: string; requested_at: string; verified_by: string | null; verified_at: string | null; status: string; remarks: string | null }
export interface Lookup { id: number; lookup_type: string; lookup_value: string; lookup_code: string; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
export interface UomUnit { id: number; dimension_id: number; symbol: string; name: string; sort_order: number; is_active: boolean }
export interface UomDimension { id: number; dimension_key: string; display_name: string; base_unit: string; sort_order: number; is_active: boolean; units: UomUnit[] }
export interface TestMethod { id: number; test_name_id: number; method_name: string }
export interface TestName { id: number; test_type_id: number; name: string; methods: TestMethod[] }
export interface TestType { id: number; type_key: string; name: string; names: TestName[] }
export interface DashboardKPIs { active_materials: number; available_batches: number; low_stock: number; expiring_soon: number; expired: number; pending_stock_requests: number; critical_stock_requests: number; maintenance_due: number; calibration_due: number; pending_verifications: number }
export interface EquipmentCatalogue { id: number; asset_id: string; equipment_type_id: number | null; name: string; make: string | null; model: string | null; serial_no: string | null; location: string | null; maintenance_status: string; status: string; last_maintenance_date: string | null; next_maintenance_date: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface InstrumentCatalogue { id: number; asset_id: string; instrument_type_id: number | null; name: string; make: string | null; model: string | null; serial_no: string | null; location: string | null; calibration_status: string; status: string; last_calibration_date: string | null; next_calibration_date: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface ColumnCatalogue { id: number; column_id: string; column_type_id: number | null; name: string; serial_no: string | null; lot_no: string | null; max_injections: number; cumulative_injections: number; injections_remaining: number; status: string; is_active: boolean; created_at: string; updated_at: string }
export interface EquipType { id: number; code: string; name: string; description: string | null; is_active: boolean; created_at: string }
export interface ColumnType { id: number; code: string; name: string; description: string | null; length_mm: number | null; particle_size_um: number | null; pore_size_angstrom: number | null; is_active: boolean; created_at: string }
export interface StorageCondition { id: number; label: string; temperature_min: number | null; temperature_max: number | null; temperature_unit: string; description: string | null; sort_order: number; is_active: boolean }

// ── Storage Conditions ────────────────────────────────────────────────────────
export const storageConditionApi = {
  list: () => apiGet<StorageCondition[]>('/api/inventory/storage-conditions'),
  create: (body: unknown) => apiPost<StorageCondition>('/api/inventory/storage-conditions', body),
  update: (id: number, body: unknown) => apiPatch<StorageCondition>(`/api/inventory/storage-conditions/${id}`, body),
  toggle: (id: number) => apiPatch<StorageCondition>(`/api/inventory/storage-conditions/${id}/toggle`, {}),
  delete: (id: number) => apiDelete<void>(`/api/inventory/storage-conditions/${id}`),
}

// ── Batches ───────────────────────────────────────────────────────────────────
export const batchApi = {
  nextBatchNo: () => apiGet<{ batch_no: string }>('/api/inventory/batches/next-batch-no'),
  nextInhouseNo: (materialType: string) => apiGet<{ inhouse_batch_no: string }>('/api/inventory/batches/next-inhouse-no', { material_type: materialType }),
  list: (params?: Record<string, unknown>) => apiGet<Batch[]>('/api/inventory/batches', params),
  get: (id: number) => apiGet<Batch>(`/api/inventory/batches/${id}`),
  create: (body: unknown) => apiPost<Batch>('/api/inventory/batches', body),
  update: (id: number, body: unknown) => apiPatch<Batch>(`/api/inventory/batches/${id}`, body),
  toggle: (id: number) => apiPatch<Batch>(`/api/inventory/batches/${id}/toggle`, {}),
  issue: (id: number, body: unknown) => apiPost<Batch>(`/api/inventory/batches/${id}/issue`, body),
  allocate: (id: number, body: unknown) => apiPost<Batch>(`/api/inventory/batches/${id}/allocate`, body),
  events: (id: number) => apiGet<BatchEvent[]>(`/api/inventory/batches/${id}/events`),
  uploadCoa: (id: number, file: File) => { const fd = new FormData(); fd.append('file', file); return apiUpload<Batch>(`/api/inventory/batches/${id}/coa`, fd) },
  deleteCoa: (id: number) => apiDelete<Batch>(`/api/inventory/batches/${id}/coa`),
  uploadOtherDocs: (id: number, file: File) => { const fd = new FormData(); fd.append('file', file); return apiUpload<Batch>(`/api/inventory/batches/${id}/other-docs`, fd) },
  deleteOtherDocs: (id: number) => apiDelete<Batch>(`/api/inventory/batches/${id}/other-docs`),
}

// ── Batch Verifications ───────────────────────────────────────────────────────
export const batchVerifApi = {
  list: (params?: Record<string, unknown>) => apiGet<BatchVerification[]>('/api/inventory/batch-verifications', params),
  get: (id: number) => apiGet<BatchVerification>(`/api/inventory/batch-verifications/${id}`),
  create: (body: unknown) => apiPost<BatchVerification>('/api/inventory/batch-verifications', body),
  verify: (id: number, body?: unknown) => apiPatch<BatchVerification>(`/api/inventory/batch-verifications/${id}/verify`, body ?? {}),
  reject: (id: number, body?: unknown) => apiPatch<BatchVerification>(`/api/inventory/batch-verifications/${id}/reject`, body ?? {}),
}

// ── Stock Requests ────────────────────────────────────────────────────────────
export const stockRequestApi = {
  list: (params?: Record<string, unknown>) => apiGet<StockRequest[]>('/api/inventory/stock-requests', params),
  get: (id: number) => apiGet<StockRequest>(`/api/inventory/stock-requests/${id}`),
  create: (body: unknown) => apiPost<StockRequest>('/api/inventory/stock-requests', body),
  update: (id: number, body: unknown) => apiPatch<StockRequest>(`/api/inventory/stock-requests/${id}`, body),
  approve: (id: number, body?: unknown) => apiPatch<StockRequest>(`/api/inventory/stock-requests/${id}/approve`, body ?? {}),
  reject: (id: number, body?: unknown) => apiPatch<StockRequest>(`/api/inventory/stock-requests/${id}/reject`, body ?? {}),
  fulfill: (id: number, body?: unknown) => apiPatch<StockRequest>(`/api/inventory/stock-requests/${id}/fulfill`, body ?? {}),
  cancel: (id: number, body?: unknown) => apiPatch<StockRequest>(`/api/inventory/stock-requests/${id}/cancel`, body ?? {}),
  events: (id: number) => apiGet<StockRequestEvent[]>(`/api/inventory/stock-requests/${id}/events`),
}

// ── Schedules ─────────────────────────────────────────────────────────────────
export const maintenanceApi = {
  list: (params?: Record<string, unknown>) => apiGet<MaintenanceSchedule[]>('/api/inventory/maintenance-schedules', params),
  get: (id: number) => apiGet<MaintenanceSchedule>(`/api/inventory/maintenance-schedules/${id}`),
  create: (body: unknown) => apiPost<MaintenanceSchedule>('/api/inventory/maintenance-schedules', body),
  update: (id: number, body: unknown) => apiPatch<MaintenanceSchedule>(`/api/inventory/maintenance-schedules/${id}`, body),
  complete: (id: number, body: unknown) => apiPatch<MaintenanceSchedule>(`/api/inventory/maintenance-schedules/${id}/complete`, body),
  cancel: (id: number) => apiPatch<MaintenanceSchedule>(`/api/inventory/maintenance-schedules/${id}/cancel`, {}),
}

export const calibrationApi = {
  list: (params?: Record<string, unknown>) => apiGet<CalibrationSchedule[]>('/api/inventory/calibration-schedules', params),
  get: (id: number) => apiGet<CalibrationSchedule>(`/api/inventory/calibration-schedules/${id}`),
  create: (body: unknown) => apiPost<CalibrationSchedule>('/api/inventory/calibration-schedules', body),
  update: (id: number, body: unknown) => apiPatch<CalibrationSchedule>(`/api/inventory/calibration-schedules/${id}`, body),
  complete: (id: number, body: unknown) => apiPatch<CalibrationSchedule>(`/api/inventory/calibration-schedules/${id}/complete`, body),
  cancel: (id: number) => apiPatch<CalibrationSchedule>(`/api/inventory/calibration-schedules/${id}/cancel`, {}),
}

// ── Equipment / Instrument Verifications ──────────────────────────────────────
export const equipVerifApi = {
  list: (params?: Record<string, unknown>) => apiGet<EquipVerification[]>('/api/inventory/equipment-verifications', params),
  get: (id: number) => apiGet<EquipVerification>(`/api/inventory/equipment-verifications/${id}`),
  create: (body: unknown) => apiPost<EquipVerification>('/api/inventory/equipment-verifications', body),
  verify: (id: number, body?: unknown) => apiPatch<EquipVerification>(`/api/inventory/equipment-verifications/${id}/verify`, body ?? {}),
  reject: (id: number, body?: unknown) => apiPatch<EquipVerification>(`/api/inventory/equipment-verifications/${id}/reject`, body ?? {}),
}

export const instrVerifApi = {
  list: (params?: Record<string, unknown>) => apiGet<InstrVerification[]>('/api/inventory/instrument-verifications', params),
  get: (id: number) => apiGet<InstrVerification>(`/api/inventory/instrument-verifications/${id}`),
  create: (body: unknown) => apiPost<InstrVerification>('/api/inventory/instrument-verifications', body),
  verify: (id: number, body?: unknown) => apiPatch<InstrVerification>(`/api/inventory/instrument-verifications/${id}/verify`, body ?? {}),
  reject: (id: number, body?: unknown) => apiPatch<InstrVerification>(`/api/inventory/instrument-verifications/${id}/reject`, body ?? {}),
}

// ── Lookup ────────────────────────────────────────────────────────────────────
export const lookupApi = {
  types: () => apiGet<string[]>('/api/inventory/lookup/types'),
  list: (params?: Record<string, unknown>) => apiGet<Lookup[]>('/api/inventory/lookup', params),
  get: (id: number) => apiGet<Lookup>(`/api/inventory/lookup/${id}`),
  create: (body: unknown) => apiPost<Lookup>('/api/inventory/lookup', body),
  update: (id: number, body: unknown) => apiPatch<Lookup>(`/api/inventory/lookup/${id}`, body),
  toggle: (id: number) => apiPatch<Lookup>(`/api/inventory/lookup/${id}/toggle`, {}),
}

// ── UOM ───────────────────────────────────────────────────────────────────────
export const uomApi = {
  list: (params?: Record<string, unknown>) => apiGet<UomDimension[]>('/api/inventory/uom-master', params),
  get: (key: string) => apiGet<UomDimension>(`/api/inventory/uom-master/${key}`),
  create: (body: unknown) => apiPost<UomDimension>('/api/inventory/uom-master', body),
  update: (id: number, body: unknown) => apiPatch<UomDimension>(`/api/inventory/uom-master/${id}`, body),
  toggle: (id: number) => apiPatch<UomDimension>(`/api/inventory/uom-master/${id}/toggle`, {}),
  createUnit: (dimId: number, body: unknown) => apiPost<UomUnit>(`/api/inventory/uom-master/${dimId}/units`, body),
  updateUnit: (unitId: number, body: unknown) => apiPatch<UomUnit>(`/api/inventory/uom-master/units/${unitId}`, body),
  toggleUnit: (unitId: number) => apiPatch<UomUnit>(`/api/inventory/uom-master/units/${unitId}/toggle`, {}),
}

// ── Test Master ───────────────────────────────────────────────────────────────
export const testMasterApi = {
  list: () => apiGet<TestType[]>('/api/inventory/test-master'),
  get: (key: string) => apiGet<TestType>(`/api/inventory/test-master/${key}`),
  create: (body: unknown) => apiPost<TestType>('/api/inventory/test-master', body),
  update: (key: string, body: unknown) => apiPatch<TestType>(`/api/inventory/test-master/${key}`, body),
  createName: (key: string, body: unknown) => apiPost<TestName>(`/api/inventory/test-master/${key}/names`, body),
  updateName: (id: number, body: unknown) => apiPatch<TestName>(`/api/inventory/test-master/names/${id}`, body),
  deleteName: (id: number) => apiDelete(`/api/inventory/test-master/names/${id}`),
  createMethod: (nameId: number, body: unknown) => apiPost<TestMethod>(`/api/inventory/test-master/names/${nameId}/methods`, body),
  updateMethod: (id: number, body: unknown) => apiPatch<TestMethod>(`/api/inventory/test-master/methods/${id}`, body),
  deleteMethod: (id: number) => apiDelete(`/api/inventory/test-master/methods/${id}`),
}

// ── Consumable Types ──────────────────────────────────────────────────────────
export const consumableTypeApi = {
  list: () => apiGet<ConsumableType[]>('/api/inventory/consumable-types'),
  create: (body: unknown) => apiPost<ConsumableType>('/api/inventory/consumable-types', body),
  update: (id: number, body: unknown) => apiPatch<ConsumableType>(`/api/inventory/consumable-types/${id}`, body),
  toggle: (id: number) => apiPatch<ConsumableType>(`/api/inventory/consumable-types/${id}/toggle`, {}),
  delete: (id: number) => apiDelete(`/api/inventory/consumable-types/${id}`),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: () => apiGet<DashboardKPIs>('/api/inventory/dashboard/kpis'),
  availableStock: () => apiGet<unknown[]>('/api/inventory/dashboard/available-stock'),
  expiringSoon: (days?: number) => apiGet<unknown[]>('/api/inventory/dashboard/expiring-soon', days ? { days } : undefined),
  pendingActions: () => apiGet<Record<string, number>>('/api/inventory/dashboard/pending-actions'),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  batchInventory: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/batch-inventory', params),
  expiry: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/expiry', params),
  stockRequests: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/stock-requests', params),
  equipmentStatus: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/equipment-status', params),
}

// ── Materials (re-exported for convenience) ───────────────────────────────────
export const materialApi = {
  nextCode: () => apiGet<{ code: string }>('/api/inventory/materials/next-code'),
  // Back-compat: unwraps the paginated response and returns just the page of items
  // (used by pickers/dropdowns elsewhere that don't need a total count).
  list: (params?: Record<string, unknown>) =>
    apiGet<{ items: Material[]; total: number }>('/api/inventory/materials', params).then(r => r.items),
  // Server-side pagination: returns { items, total } so the caller can size a Table's pagination.
  listPaged: (params?: Record<string, unknown>) =>
    apiGet<{ items: Material[]; total: number }>('/api/inventory/materials', params),
  get: (id: number) => apiGet<Material>(`/api/inventory/materials/${id}`),
  create: (body: unknown) => apiPost<Material>('/api/inventory/materials', body),
  update: (id: number, body: unknown) => apiPatch<Material>(`/api/inventory/materials/${id}`, body),
  deactivate: (id: number) => apiDelete<Material>(`/api/inventory/materials/${id}/deactivate`),
  upsertChemicalProps: (id: number, body: unknown) => apiPut<ChemicalProps>(`/api/inventory/materials/${id}/chemical-props`, body),
  upsertFormulationProps: (id: number, body: unknown) => apiPut<FormulationProps>(`/api/inventory/materials/${id}/formulation-props`, body),
}

export const mappingApi = {
  list: (params?: Record<string, unknown>) => apiGet<Mapping[]>('/api/inventory/mappings', params),
  create: (body: unknown) => apiPost<Mapping>('/api/inventory/mappings', body),
  update: (id: number, body: unknown) => apiPatch<Mapping>(`/api/inventory/mappings/${id}`, body),
  delete: (id: number) => apiDelete<void>(`/api/inventory/mappings/${id}`),
  uploadDsd: (id: number, file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return apiUpload<Mapping>(`/api/inventory/mappings/${id}/dsd`, fd)
  },
  downloadDsd: (id: number) => `/api/inventory/mappings/${id}/dsd/download`,
  deleteDsd: (id: number) => apiDelete<Mapping>(`/api/inventory/mappings/${id}/dsd`),
}

export const manufacturerApi = {
  list: (params?: Record<string, unknown>) => apiGet<Manufacturer[]>('/api/inventory/manufacturers', params),
  get: (id: number) => apiGet<Manufacturer>(`/api/inventory/manufacturers/${id}`),
  create: (body: unknown) => apiPost<Manufacturer>('/api/inventory/manufacturers', body),
  update: (id: number, body: unknown) => apiPatch<Manufacturer>(`/api/inventory/manufacturers/${id}`, body),
  deactivate: (id: number) => apiDelete<Manufacturer>(`/api/inventory/manufacturers/${id}/deactivate`),
}

export const equipmentCatalogueApi = {
  list: (params?: Record<string, unknown>) => apiGet<EquipmentCatalogue[]>('/api/inventory/equipment', params),
  get: (id: number) => apiGet<EquipmentCatalogue>(`/api/inventory/equipment/${id}`),
  create: (body: unknown) => apiPost<EquipmentCatalogue>('/api/inventory/equipment', body),
  update: (id: number, body: unknown) => apiPatch<EquipmentCatalogue>(`/api/inventory/equipment/${id}`, body),
  deactivate: (id: number) => apiDelete<EquipmentCatalogue>(`/api/inventory/equipment/${id}/deactivate`),
}

export const instrumentCatalogueApi = {
  list: (params?: Record<string, unknown>) => apiGet<InstrumentCatalogue[]>('/api/inventory/instruments', params),
  get: (id: number) => apiGet<InstrumentCatalogue>(`/api/inventory/instruments/${id}`),
  create: (body: unknown) => apiPost<InstrumentCatalogue>('/api/inventory/instruments', body),
  update: (id: number, body: unknown) => apiPatch<InstrumentCatalogue>(`/api/inventory/instruments/${id}`, body),
  deactivate: (id: number) => apiDelete<InstrumentCatalogue>(`/api/inventory/instruments/${id}/deactivate`),
}

export const columnCatalogueApi = {
  list: (params?: Record<string, unknown>) => apiGet<ColumnCatalogue[]>('/api/inventory/columns', params),
  get: (id: number) => apiGet<ColumnCatalogue>(`/api/inventory/columns/${id}`),
  create: (body: unknown) => apiPost<ColumnCatalogue>('/api/inventory/columns', body),
  update: (id: number, body: unknown) => apiPatch<ColumnCatalogue>(`/api/inventory/columns/${id}`, body),
  deactivate: (id: number) => apiDelete<ColumnCatalogue>(`/api/inventory/columns/${id}/deactivate`),
}

export const equipmentTypeApi = {
  list: (params?: Record<string, unknown>) => apiGet<EquipType[]>('/api/inventory/equipment-types', params),
  create: (body: unknown) => apiPost<EquipType>('/api/inventory/equipment-types', body),
  update: (id: number, body: unknown) => apiPatch<EquipType>(`/api/inventory/equipment-types/${id}`, body),
  toggle: (id: number) => apiPatch<EquipType>(`/api/inventory/equipment-types/${id}/toggle`, {}),
}

export const instrumentTypeApi = {
  list: (params?: Record<string, unknown>) => apiGet<EquipType[]>('/api/inventory/instrument-types', params),
  create: (body: unknown) => apiPost<EquipType>('/api/inventory/instrument-types', body),
  update: (id: number, body: unknown) => apiPatch<EquipType>(`/api/inventory/instrument-types/${id}`, body),
  toggle: (id: number) => apiPatch<EquipType>(`/api/inventory/instrument-types/${id}/toggle`, {}),
}

export const columnTypeApi = {
  list: (params?: Record<string, unknown>) => apiGet<ColumnType[]>('/api/inventory/column-types', params),
  create: (body: unknown) => apiPost<ColumnType>('/api/inventory/column-types', body),
  update: (id: number, body: unknown) => apiPatch<ColumnType>(`/api/inventory/column-types/${id}`, body),
  toggle: (id: number) => apiPatch<ColumnType>(`/api/inventory/column-types/${id}/toggle`, {}),
}

// ── Audit Trail ───────────────────────────────────────────────────────────────
export interface AuditTrailEntry {
  id: number
  event_type: string
  entity_type: string
  entity_id: number | null
  entity_ref: string | null
  performed_by: string
  performed_at: string
  old_value: string | null
  new_value: string | null
  details: string | null
}

export const auditTrailApi = {
  list: (params?: Record<string, unknown>) => apiGet<AuditTrailEntry[]>('/api/inventory/audit-trail', params),
  eventTypes: () => apiGet<string[]>('/api/inventory/audit-trail/event-types'),
  entityTypes: () => apiGet<string[]>('/api/inventory/audit-trail/entity-types'),
}
