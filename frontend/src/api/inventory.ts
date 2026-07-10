import { apiDelete, apiDownloadBlob, apiGet, apiPatch, apiPost, apiPut, apiUpload } from './client'

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
  material_name: string | null; manufacturer_name: string | null
}
export interface BatchEvent { id: number; batch_id: number; event_type: string; qty: number | null; ref_no: string | null; module: string | null; issued_to: string | null; purpose: string | null; project_code: string | null; performed_by: string; performed_at: string; remarks: string | null }
export interface StockRequestEvent { id: number; request_id: number; event_type: string; performed_by: string; performed_at: string; remarks: string | null }
export interface StockRequest { id: number; request_no: string; material_id: number; qty_required: number; unit: string; criticality: string; status: string; created_at: string; updated_at: string; events: StockRequestEvent[]; required_by_date: string | null; purpose: string | null; requested_by: string | null; requested_at: string | null; approved_by: string | null; approved_at: string | null; remarks: string | null }
export interface Lookup { id: number; lookup_type: string; lookup_value: string; lookup_code: string; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
export interface UomUnit { id: number; dimension_id: number; symbol: string; name: string; sort_order: number; is_active: boolean }
export interface UomDimension { id: number; dimension_key: string; display_name: string; base_unit: string; sort_order: number; is_active: boolean; units: UomUnit[] }
export interface TestMethod { id: number; test_name_id: number; method_name: string }
export interface TestName { id: number; test_type_id: number; name: string; methods: TestMethod[] }
export interface TestType { id: number; type_key: string; name: string; names: TestName[] }
export interface DashboardKPIs {
  active_materials: number; available_batches: number; low_stock: number; expiring_soon: number; expired: number
  pending_stock_requests: number; critical_stock_requests: number
  out_of_stock: number; pending_approvals_total: number; maintenance_due: number; calibration_due: number
}
export interface PendingApproval { type: string; reference_no: string; status: string; raised_by: string | null; raised_at: string | null; age_days: number | null }
export interface MaintenanceCalibrationDue { type: 'Maintenance' | 'Calibration'; asset_code: string; asset_name: string; due_date: string; days_until_due: number }
export interface EquipmentStatusBreakdown { equipment: { status: string; count: number }[]; instruments: { status: string; count: number }[] }
export interface ExpiryTimelinePoint { month: string; count: number; qty: number }
export interface ExpiringBatch { id: number; batch_no: string; inhouse_batch_no: string | null; material_id: number; qty_available: number; unit: string; expiry_date: string }
export interface EquipmentCatalogue { id: number; asset_id: string; equipment_type_id: number | null; name: string; make: string | null; model: string | null; serial_no: string | null; location: string | null; usage_type: string | null; movable: boolean; gross_capacity: number | null; capacity_unit: string | null; description: string | null; maintenance_status: string; status: string; last_maintenance_date: string | null; next_maintenance_date: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface InstrumentCatalogue { id: number; asset_id: string; instrument_type_id: number | null; name: string; make: string | null; model: string | null; serial_no: string | null; location: string | null; usage_type: string | null; movable: boolean; gross_capacity: number | null; capacity_unit: string | null; lower_operating_range: number | null; lower_uom: string | null; upper_operating_range: number | null; upper_uom: string | null; required_calibration: boolean; description: string | null; calibration_status: string; status: string; last_calibration_date: string | null; next_calibration_date: string | null; is_active: boolean; created_at: string; updated_at: string }
export interface ColumnCatalogue { id: number; column_id: string; column_type_id: number | null; name: string; serial_no: string | null; lot_no: string | null; max_injections: number; cumulative_injections: number; injections_remaining: number; status: string; is_active: boolean; created_at: string; updated_at: string }
export interface EquipType { id: number; code: string; name: string; description: string | null; is_active: boolean; created_at: string }
export interface ColumnType { id: number; code: string; name: string; description: string | null; length_mm: number | null; particle_size_um: number | null; pore_size_angstrom: number | null; is_active: boolean; created_at: string }
export interface StorageCondition { id: number; label: string; temperature_min: number | null; temperature_max: number | null; temperature_unit: string; description: string | null; sort_order: number; is_active: boolean }
export interface ChecklistItem { id: number; checklist_id: number; seq_no: number; instruction_type: string; data_type: string | null; frequencies: string[] | null; precision: number | null; lower_limit: number | null; upper_limit: number | null; options: string[] | null; details: string | null; created_at: string }
export interface ChecklistApproval { id: number; checklist_id: number; action: string; from_state: string | null; to_state: string | null; performed_by: string; comment: string | null; performed_at: string }
export interface Checklist { id: number; name: string; checklist_type: string; log_type: string; usage_type: string | null; target_kind: string; equipment_code: string | null; version: string; status: string; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
export interface ChecklistDetail extends Checklist { items: ChecklistItem[]; approvals: ChecklistApproval[] }
export interface MeasurementMaster { id: number; name: string; data_type: string; uom: string | null; is_active: boolean; created_at: string }
export interface LogMapping { id: number; equipment_id: number | null; instrument_id: number | null; log_type: string; checklist_id: number | null; checklist_name: string | null; checklist_version: string | null; tolerance_days: number | null; alert_limit: number | null; deviation_limit: number | null; created_at: string; updated_at: string }
export interface InstrumentParameter { id: number; instrument_id: number; measurement_id: number | null; measurement_name: string | null; precision: number | null; lower_unit: number | null; lower_uom: string | null; upper_unit: number | null; upper_uom: string | null; calibration_tolerance_pct: number | null; seq_no: number; created_at: string }
export interface InstrumentSpecDetail { id: number; instrument_id: number; specification: string; value: string | null; uom: string | null; seq_no: number; created_at: string }
export interface Schedule { id: number; target_kind: string; equipment_id: number | null; instrument_id: number | null; equipment_code: string | null; equipment_type: string | null; log_type: string; checklist_id: number | null; schedule_type: string; due_date: string; planned_date: string | null; tolerance_days: number | null; alert_limit: number | null; deviation_limit: number | null; done_on: string | null; status: string; source: string; current_status: string | null; days_label: string | null; created_at: string; updated_at: string }
export interface MasterTemplate { key: string; name: string; filename: string }
export interface ScheduleUploadResult { created: number; skipped: number; errors: string[] }
export interface SparePart { id: number; part_code: string; name: string; description: string | null; is_active: boolean; created_at: string }
export interface RequestItem {
  // PLANNED: a Schedule; UNPLANNED/BREAKDOWN: a catalogue item
  id: number; equipment_code?: string | null; asset_id?: string; name?: string
  due_date?: string; schedule_type?: string; days_label?: string | null; current_status?: string | null
  status?: string; has_open_request?: boolean; tolerance_days?: number | null; planned_date?: string | null
  checklist_id?: number | null; alert_limit?: number | null; deviation_limit?: number | null
}
export interface WorkOrderResult { id: number; work_order_id: number; checklist_item_id: number | null; observation: string | null; comment: string | null; done_by: string | null; done_at: string | null }
export interface WorkOrderSignature { id: number; work_order_id: number; signing_for: string; name: string; comments: string | null; completed_on: string }
export interface WorkOrderSpare { id: number; work_order_id: number; spare_part_id: number | null; part_code: string }
export interface WorkOrder {
  id: number; workorder_no: string; target_kind: string
  equipment_id: number | null; instrument_id: number | null; equipment_code: string | null
  schedule_id: number | null; checklist_id: number | null; checklist_name: string | null
  kind: string; log_type: string; status: string; deviation: boolean; remarks: string | null
  maintenance_type: string | null; breakdown_description: string | null; spare_parts_used: boolean | null
  calibration_source: string | null; certificate_no: string | null
  raised_by: string | null; raised_at: string | null
  started_by: string | null; started_at: string | null
  ended_by: string | null; ended_at: string | null
  verified_by: string | null; verified_at: string | null
  approved_by: string | null; approved_at: string | null
  created_at: string; updated_at: string
}
export interface CalibrationReference { id: number; work_order_id: number; measurement_id: number | null; measurement_name: string | null; reference_inst_id: string | null; reference_reading: number | null; instrument_reading: number | null; variance_pct: number | null; tolerance_pct: number | null; status: string | null; done_by: string | null; done_at: string | null }
export interface UsageLog { id: number; target_kind: string; equipment_id: number | null; instrument_id: number | null; previous_product_code: string | null; previous_batch_no: string | null; reference_no: string | null; document_name: string | null; usage_remarks: string | null; status: string; started_by: string | null; started_at: string | null; ended_by: string | null; ended_at: string | null; source: string; created_at: string; updated_at: string }
export interface StatusHistoryRow { status: string; previous_product_code: string | null; previous_batch_no: string | null; started_by: string | null; started_at: string; ended_by: string | null; ended_at: string | null; duration: string; remarks: string | null }
export interface CalendarSegment { status: string; duration: string; seconds: number }
export interface WorkOrderDetail extends WorkOrder {
  results: WorkOrderResult[]; signatures: WorkOrderSignature[]; spares_used: WorkOrderSpare[]
  checklist_items: ChecklistItem[]; calib_references: CalibrationReference[]
}

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
  expiringSoon: (days?: number) => apiGet<ExpiringBatch[]>('/api/inventory/dashboard/expiring-soon', days ? { days } : undefined),
  pendingActions: () => apiGet<Record<string, number>>('/api/inventory/dashboard/pending-actions'),
  pendingApprovals: () => apiGet<PendingApproval[]>('/api/inventory/dashboard/pending-approvals'),
  maintenanceCalibrationDue: (days?: number) => apiGet<MaintenanceCalibrationDue[]>('/api/inventory/dashboard/maintenance-calibration-due', days ? { days } : undefined),
  equipmentStatus: () => apiGet<EquipmentStatusBreakdown>('/api/inventory/dashboard/equipment-status'),
  expiryTimeline: (months?: number) => apiGet<ExpiryTimelinePoint[]>('/api/inventory/dashboard/expiry-timeline', months ? { months } : undefined),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  batchInventory: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/batch-inventory', params),
  expiry: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/expiry', params),
  stockRequests: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/stock-requests', params),
  equipmentStatus: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/equipment-status', params),
  instrumentStatus: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/instrument-status', params),
  workOrders: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/work-orders', params),
  usageSummary: (params?: Record<string, unknown>) => apiGet<unknown[]>('/api/inventory/reports/usage-summary', params),
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
  changeStatus: (id: number, body: { status: string; remarks?: string }) => apiPatch<EquipmentCatalogue>(`/api/inventory/equipment/${id}/status`, body),
  deactivate: (id: number) => apiDelete<EquipmentCatalogue>(`/api/inventory/equipment/${id}/deactivate`),
}

export const instrumentCatalogueApi = {
  list: (params?: Record<string, unknown>) => apiGet<InstrumentCatalogue[]>('/api/inventory/instruments', params),
  get: (id: number) => apiGet<InstrumentCatalogue>(`/api/inventory/instruments/${id}`),
  create: (body: unknown) => apiPost<InstrumentCatalogue>('/api/inventory/instruments', body),
  update: (id: number, body: unknown) => apiPatch<InstrumentCatalogue>(`/api/inventory/instruments/${id}`, body),
  changeStatus: (id: number, body: { status: string; remarks?: string }) => apiPatch<InstrumentCatalogue>(`/api/inventory/instruments/${id}/status`, body),
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

export const checklistApi = {
  list: (params?: Record<string, unknown>) => apiGet<Checklist[]>('/api/inventory/checklists', params),
  get: (id: number) => apiGet<ChecklistDetail>(`/api/inventory/checklists/${id}`),
  create: (body: unknown) => apiPost<ChecklistDetail>('/api/inventory/checklists', body),
  update: (id: number, body: unknown) => apiPatch<ChecklistDetail>(`/api/inventory/checklists/${id}`, body),
  toggle: (id: number) => apiPatch<Checklist>(`/api/inventory/checklists/${id}/toggle`, {}),
  addItem: (id: number, body: unknown) => apiPost<ChecklistItem>(`/api/inventory/checklists/${id}/items`, body),
  updateItem: (itemId: number, body: unknown) => apiPatch<ChecklistItem>(`/api/inventory/checklists/items/${itemId}`, body),
  deleteItem: (itemId: number) => apiDelete<void>(`/api/inventory/checklists/items/${itemId}`),
  submit: (id: number, body: { comment?: string }) => apiPost<ChecklistDetail>(`/api/inventory/checklists/${id}/submit`, body),
  verify: (id: number, body: { comment?: string }) => apiPost<ChecklistDetail>(`/api/inventory/checklists/${id}/verify`, body),
  approve: (id: number, body: { comment?: string }) => apiPost<ChecklistDetail>(`/api/inventory/checklists/${id}/approve`, body),
  reinitiate: (id: number, body: { comment?: string }) => apiPost<ChecklistDetail>(`/api/inventory/checklists/${id}/reinitiate`, body),
  newVersion: (id: number) => apiPost<ChecklistDetail>(`/api/inventory/checklists/${id}/new-version`, {}),
}

export const measurementMasterApi = {
  list: (params?: Record<string, unknown>) => apiGet<MeasurementMaster[]>('/api/inventory/measurement-master', params),
  create: (body: unknown) => apiPost<MeasurementMaster>('/api/inventory/measurement-master', body),
  update: (id: number, body: unknown) => apiPatch<MeasurementMaster>(`/api/inventory/measurement-master/${id}`, body),
  toggle: (id: number) => apiPatch<MeasurementMaster>(`/api/inventory/measurement-master/${id}/toggle`, {}),
}

export const logMappingApi = {
  list: (params?: Record<string, unknown>) => apiGet<LogMapping[]>('/api/inventory/log-mappings', params),
  create: (body: unknown) => apiPost<LogMapping>('/api/inventory/log-mappings', body),
  update: (id: number, body: unknown) => apiPatch<LogMapping>(`/api/inventory/log-mappings/${id}`, body),
  delete: (id: number) => apiDelete<void>(`/api/inventory/log-mappings/${id}`),
}

export const instrumentParameterApi = {
  list: (instrumentId: number) => apiGet<InstrumentParameter[]>(`/api/inventory/instruments/${instrumentId}/parameters`),
  create: (instrumentId: number, body: unknown) => apiPost<InstrumentParameter>(`/api/inventory/instruments/${instrumentId}/parameters`, body),
  update: (paramId: number, body: unknown) => apiPatch<InstrumentParameter>(`/api/inventory/instrument-parameters/${paramId}`, body),
  delete: (paramId: number) => apiDelete<void>(`/api/inventory/instrument-parameters/${paramId}`),
}

export const instrumentSpecDetailApi = {
  list: (instrumentId: number) => apiGet<InstrumentSpecDetail[]>(`/api/inventory/instruments/${instrumentId}/spec-details`),
  create: (instrumentId: number, body: unknown) => apiPost<InstrumentSpecDetail>(`/api/inventory/instruments/${instrumentId}/spec-details`, body),
  update: (detailId: number, body: unknown) => apiPatch<InstrumentSpecDetail>(`/api/inventory/instrument-spec-details/${detailId}`, body),
  delete: (detailId: number) => apiDelete<void>(`/api/inventory/instrument-spec-details/${detailId}`),
}

export const scheduleApi = {
  list: (params?: Record<string, unknown>) => apiGet<Schedule[]>('/api/inventory/schedules', params),
  create: (body: unknown) => apiPost<Schedule>('/api/inventory/schedules', body),
  update: (id: number, body: unknown) => apiPatch<Schedule>(`/api/inventory/schedules/${id}`, body),
  delete: (id: number) => apiDelete<void>(`/api/inventory/schedules/${id}`),
  complete: (id: number, body: { done_on: string; generate_next?: boolean }) => apiPost<Schedule>(`/api/inventory/schedules/${id}/complete`, body),
  upload: (targetKind: string, logType: string, file: File) => {
    const fd = new FormData(); fd.append('file', file)
    const qs = new URLSearchParams({ target_kind: targetKind, log_type: logType }).toString()
    return apiUpload<ScheduleUploadResult>(`/api/inventory/schedules/upload?${qs}`, fd)
  },
}

export const sparePartApi = {
  list: (params?: Record<string, unknown>) => apiGet<SparePart[]>('/api/inventory/spare-parts', params),
  create: (body: unknown) => apiPost<SparePart>('/api/inventory/spare-parts', body),
  update: (id: number, body: unknown) => apiPatch<SparePart>(`/api/inventory/spare-parts/${id}`, body),
  toggle: (id: number) => apiPatch<SparePart>(`/api/inventory/spare-parts/${id}/toggle`, {}),
}

export const workOrderApi = {
  requests: (params: Record<string, unknown>) => apiGet<RequestItem[]>('/api/inventory/work-orders/requests', params),
  list: (params?: Record<string, unknown>) => apiGet<WorkOrder[]>('/api/inventory/work-orders', params),
  get: (id: number) => apiGet<WorkOrderDetail>(`/api/inventory/work-orders/${id}`),
  raise: (body: unknown) => apiPost<WorkOrderDetail>('/api/inventory/work-orders', body),
  start: (id: number) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/start`, {}),
  saveResults: (id: number, body: unknown) => apiPut<WorkOrderDetail>(`/api/inventory/work-orders/${id}/results`, body),
  end: (id: number, body: { comment?: string; certificate_no?: string }) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/end`, body),
  verify: (id: number, body: { password: string; comment: string; maintenance_type?: string }) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/verify`, body),
  approve: (id: number, body: { password: string; comment: string }) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/approve`, body),
  reinitiate: (id: number, body: { comment?: string }) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/reinitiate`, body),
  breakdownDetails: (id: number, body: { spare_parts_used: boolean; description: string; part_codes: string[] }) => apiPost<WorkOrderDetail>(`/api/inventory/work-orders/${id}/breakdown-details`, body),
  addCalibrationReference: (id: number, body: { measurement_id?: number; reference_inst_id?: string; reference_reading: number; instrument_reading: number }) => apiPost<CalibrationReference>(`/api/inventory/work-orders/${id}/calibration-references`, body),
  deleteCalibrationReference: (refId: number) => apiDelete<void>(`/api/inventory/work-orders/calibration-references/${refId}`),
}

export const usageLogApi = {
  list: (params: Record<string, unknown>) => apiGet<UsageLog[]>('/api/inventory/usage-logs', params),
  create: (body: unknown) => apiPost<UsageLog>('/api/inventory/usage-logs', body),
  end: (id: number, body: { ended_at: string; usage_remarks: string }) => apiPatch<UsageLog>(`/api/inventory/usage-logs/${id}/end`, body),
  statusHistory: (params: Record<string, unknown>) => apiGet<StatusHistoryRow[]>('/api/inventory/usage-logs/status-history', params),
  calendar: (params: Record<string, unknown>) => apiGet<Record<string, CalendarSegment[]>>('/api/inventory/usage-logs/calendar', params),
}

export const masterTemplateApi = {
  list: () => apiGet<MasterTemplate[]>('/api/inventory/master-templates'),
  download: async (key: string) => {
    const { blob, filename } = await apiDownloadBlob(`/api/inventory/master-templates/${key}/download`)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  },
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
