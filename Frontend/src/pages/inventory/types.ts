/**
 * Inventory Master — TypeScript interfaces
 * Mirrors the FastAPI Pydantic schemas exactly.
 */

// ─── Common ───────────────────────────────────────────────────────────────────

export type InvStatus = 'AVAILABLE' | 'PARTIALLY_CONSUMED' | 'CONSUMED' | 'EXPIRED' | 'QUARANTINE'
export type BatchCategory = 'available' | 'non_available' | 'historic'
export type StockRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'CANCELLED'
export type Criticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type ScheduleStatus = 'DUE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type AssetStatus = 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE' | 'UNDER_CALIBRATION' | 'DECOMMISSIONED'
export type ServiceStatus = 'OK' | 'DUE' | 'OVERDUE' | 'EXPIRED' | 'EXHAUSTED'

// ─── Materials ────────────────────────────────────────────────────────────────

export interface ChemicalProps {
  purity_pct?:       number | null
  grade?:            string | null
  appearance?:       string | null
  solubility?:       string | null
  boiling_pt?:       number | null
  melting_pt?:       number | null
  flash_pt?:         number | null
  density?:          number | null
  ph_range?:         string | null
}

export interface FormulationProps {
  role?:                string | null
  concentration?:       number | null
  units?:               string | null
  function?:            string | null
  compatibility_notes?: string | null
}

export interface Material {
  id:                     number
  code:                   string
  name:                   string
  material_type:          string
  cas_no?:                string | null
  molecular_formula?:     string | null
  mol_weight?:            number | null
  storage_condition?:     string | null
  hazard_class?:          string | null
  description?:           string | null
  is_active:              boolean
  chemical_props?:        ChemicalProps | null
  formulation_props?:     FormulationProps | null
}

// ─── Manufacturers ────────────────────────────────────────────────────────────

export interface Manufacturer {
  id:             number
  code:           string
  name:           string
  country?:       string | null
  contact_person?: string | null
  email?:         string | null
  phone?:         string | null
  website?:       string | null
  address?:       string | null
  is_active:      boolean
}

export interface ManufacturerMapping {
  id:                number
  material_id:       number
  manufacturer_id:   number
  catalogue_no?:     string | null
  technical_grade?:  string | null
  lead_time_days?:   number | null
  min_order_qty?:    number | null
  material_name?:    string | null
  material_code?:    string | null
  manufacturer_name?: string | null
  manufacturer_code?: string | null
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export interface BatchEvent {
  id:           number
  batch_id:     number
  event_type:   string
  qty?:         number | null
  ref_no?:      string | null
  module?:      string | null
  issued_to?:   string | null
  purpose?:     string | null
  project_code?: string | null
  performed_by?: string | null
  performed_at?: string | null
  remarks?:     string | null
}

export interface Batch {
  id:               number
  batch_no:         string
  material_id:      number
  manufacturer_id?: number | null
  qty_received:     number
  qty_available:    number
  unit:             string
  location?:        string | null
  mfg_date?:        string | null
  expiry_date?:     string | null
  retest_date?:     string | null
  invoice_no?:      string | null
  po_no?:           string | null
  remarks?:         string | null
  status:           InvStatus
  category:         BatchCategory
  received_by?:     string | null
  received_at?:     string | null
  is_active:        boolean
  material_name?:   string | null
  material_code?:   string | null
  manufacturer_name?: string | null
  events?:          BatchEvent[] | null
}

// ─── Batch Verification ───────────────────────────────────────────────────────

export interface BatchVerification {
  id:            number
  request_no:    string
  batch_id:      number
  requested_by?: string | null
  requested_at?: string | null
  verified_by?:  string | null
  verified_at?:  string | null
  status:        VerificationStatus
  remarks?:      string | null
  batch_no?:     string | null
  material_name?: string | null
}

// ─── Stock Requests ───────────────────────────────────────────────────────────

export interface StockRequestEvent {
  id:           number
  request_id:   number
  event_type:   string
  performed_by?: string | null
  performed_at?: string | null
  remarks?:     string | null
}

export interface StockRequest {
  id:               number
  request_no:       string
  material_id:      number
  qty_required:     number
  unit:             string
  required_by_date?: string | null
  criticality:      Criticality
  purpose?:         string | null
  requested_by?:    string | null
  requested_at?:    string | null
  approved_by?:     string | null
  approved_at?:     string | null
  status:           StockRequestStatus
  remarks?:         string | null
  material_name?:   string | null
  material_code?:   string | null
  events?:          StockRequestEvent[] | null
}

// ─── Equipment Types ──────────────────────────────────────────────────────────

export interface EquipmentType {
  id:          number
  code:        string
  name:        string
  description?: string | null
  is_active:   boolean
}

export interface InstrumentType {
  id:          number
  code:        string
  name:        string
  description?: string | null
  is_active:   boolean
}

export interface ColumnType {
  id:                  number
  code:                string
  name:                string
  description?:        string | null
  length_mm?:          number | null
  particle_size_um?:   number | null
  pore_size_angstrom?: number | null
  is_active:           boolean
}

// ─── Equipment Catalogues ─────────────────────────────────────────────────────

export interface EquipmentCatalogue {
  id:                    number
  asset_id:              string
  name:                  string
  equipment_type_id?:    number | null
  serial_no?:            string | null
  manufacturer?:         string | null
  model?:                string | null
  location?:             string | null
  purchase_date?:        string | null
  last_maintenance_date?: string | null
  maintenance_due_date?: string | null
  maintenance_status:    ServiceStatus
  status:                AssetStatus
  is_active:             boolean
  equipment_type_name?:  string | null
  equipment_type_code?:  string | null
}

export interface InstrumentCatalogue {
  id:                     number
  asset_id:               string
  name:                   string
  instrument_type_id?:    number | null
  serial_no?:             string | null
  manufacturer?:          string | null
  model?:                 string | null
  location?:              string | null
  purchase_date?:         string | null
  last_calibration_date?: string | null
  calibration_due_date?:  string | null
  calibration_status:     ServiceStatus
  status:                 AssetStatus
  is_active:              boolean
  instrument_type_name?:  string | null
  instrument_type_code?:  string | null
}

export interface ColumnCatalogue {
  id:                     number
  column_id:              string
  name:                   string
  column_type_id?:        number | null
  serial_no?:             string | null
  manufacturer?:          string | null
  part_no?:               string | null
  purchased_date?:        string | null
  max_injections?:        number | null
  cumulative_injections:  number
  status:                 string
  is_active:              boolean
  column_type_name?:      string | null
  column_type_code?:      string | null
  injections_remaining?:  number | null
}

// ─── Schedules ────────────────────────────────────────────────────────────────

export interface MaintenanceSchedule {
  id:               number
  equipment_id:     number
  maintenance_type?: string | null
  scheduled_date:   string
  completed_date?:  string | null
  technician?:      string | null
  status:           ScheduleStatus
  notes?:           string | null
  equipment_asset_id?: string | null
  equipment_name?:  string | null
}

export interface CalibrationSchedule {
  id:               number
  instrument_id:    number
  calibration_type?: string | null
  scheduled_date:   string
  completed_date?:  string | null
  technician?:      string | null
  certificate_no?:  string | null
  status:           ScheduleStatus
  notes?:           string | null
  instrument_asset_id?: string | null
  instrument_name?: string | null
}

export interface EquipmentVerification {
  id:                  number
  request_no:          string
  equipment_id:        number
  requested_by?:       string | null
  requested_at?:       string | null
  verified_by?:        string | null
  verified_at?:        string | null
  status:              VerificationStatus
  remarks?:            string | null
  equipment_asset_id?: string | null
  equipment_name?:     string | null
}

export interface InstrumentVerification {
  id:                   number
  request_no:           string
  instrument_id:        number
  requested_by?:        string | null
  requested_at?:        string | null
  verified_by?:         string | null
  verified_at?:         string | null
  status:               VerificationStatus
  remarks?:             string | null
  instrument_asset_id?: string | null
  instrument_name?:     string | null
}

// ─── Audit Trail ──────────────────────────────────────────────────────────────

export interface AuditTrailEntry {
  id:           number
  event_type:   string
  entity_type:  string
  entity_id?:   number | null
  entity_ref?:  string | null
  performed_by?: string | null
  performed_at?: string | null
  old_value?:   string | null
  new_value?:   string | null
  details?:     string | null
}

export interface AuditTrailPage {
  total: number
  page:  number
  pages: number
  items: AuditTrailEntry[]
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface KpiCard {
  label:   string
  value:   number
  detail?: string | null
}

export interface DashboardKpis {
  materials:               KpiCard
  batches_available:       KpiCard
  batches_low_stock:       KpiCard
  batches_expiring_30d:    KpiCard
  batches_expired:         KpiCard
  stock_requests_pending:  KpiCard
  stock_requests_critical: KpiCard
  maintenance_due:         KpiCard
  calibration_due:         KpiCard
  verifications_pending:   KpiCard
}

export interface AvailableStockRow {
  material_id:      number
  material_code:    string
  material_name:    string
  material_type:    string
  total_available:  number
  unit:             string
  batch_count:      number
  has_expiring:     boolean
}

export interface ExpiringBatch {
  batch_id:       number
  batch_no:       string
  material_name:  string
  material_code:  string
  qty_available:  number
  unit:           string
  expiry_date:    string
  days_to_expiry: number
  location?:      string | null
}

export interface PendingAction {
  category:    string
  ref_no:      string
  description: string
  priority:    'HIGH' | 'MEDIUM' | 'LOW'
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface BatchInventoryRow {
  batch_id:       number
  batch_no:       string
  material_code:  string
  material_name:  string
  material_type:  string
  manufacturer?:  string | null
  qty_received:   number
  qty_available:  number
  unit:           string
  location?:      string | null
  mfg_date?:      string | null
  expiry_date?:   string | null
  retest_date?:   string | null
  status:         string
  category:       string
  received_by?:   string | null
  received_at?:   string | null
}

export interface ExpiryReportRow {
  batch_id:       number
  batch_no:       string
  material_code:  string
  material_name:  string
  manufacturer?:  string | null
  qty_available:  number
  unit:           string
  location?:      string | null
  mfg_date?:      string | null
  expiry_date:    string
  retest_date?:   string | null
  status:         string
  days_to_expiry: number
}

export interface StockRequestReportRow {
  request_id:        number
  request_no:        string
  material_code:     string
  material_name:     string
  qty_required:      number
  unit:              string
  criticality:       string
  status:            string
  requested_by?:     string | null
  requested_at?:     string | null
  approved_by?:      string | null
  approved_at?:      string | null
  required_by_date?: string | null
  purpose?:          string | null
  remarks?:          string | null
}

export interface EquipmentStatusRow {
  asset_type:        string
  asset_id:          string
  name:              string
  type_name?:        string | null
  manufacturer?:     string | null
  model?:            string | null
  location?:         string | null
  status:            string
  service_status:    string
  last_service_date?: string | null
  next_service_due?: string | null
  is_active:         boolean
}

// ─── Navigation view keys ─────────────────────────────────────────────────────

export type InvView =
  // Dashboard
  | 'dashboard'
  // Master data
  | 'materials' | 'manufacturers' | 'mappings' | 'audit-trail'
  // Batches
  | 'batches-available' | 'batches-non-available' | 'batches-historic'
  // Verifications & Stock
  | 'batch-verifications' | 'stock-requests'
  // Equipment types
  | 'equipment-types' | 'instrument-types' | 'column-types'
  // Catalogues
  | 'equipment-catalogue' | 'instrument-catalogue' | 'column-catalogue'
  // Schedules & verifications
  | 'maintenance-schedules' | 'calibration-schedules'
  | 'equipment-verifications' | 'instrument-verifications'
  // Reports
  | 'report-batch-inventory' | 'report-expiry'
  | 'report-stock-requests' | 'report-equipment-status'
