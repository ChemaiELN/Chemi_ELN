import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// ── Storage Conditions ────────────────────────────────────────────────────────
export class InvStorageCondition extends Model<InferAttributes<InvStorageCondition>, InferCreationAttributes<InvStorageCondition>> {
  declare id: CreationOptional<number>
  declare label: string
  declare temperatureMin: number | null
  declare temperatureMax: number | null
  declare temperatureUnit: CreationOptional<string>
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvStorageCondition.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  label: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  temperatureMin: { type: DataTypes.DECIMAL(6, 1), allowNull: true, field: 'temperature_min' },
  temperatureMax: { type: DataTypes.DECIMAL(6, 1), allowNull: true, field: 'temperature_max' },
  temperatureUnit: { type: DataTypes.STRING(10), allowNull: false, defaultValue: '°C', field: 'temperature_unit' },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_storage_conditions', timestamps: false })

// ── Consumable Types ──────────────────────────────────────────────────────────
export class InvConsumableType extends Model<InferAttributes<InvConsumableType>, InferCreationAttributes<InvConsumableType>> {
  declare id: CreationOptional<number>
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvConsumableType.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_consumable_types', timestamps: false })

// ── Storage Locations ─────────────────────────────────────────────────────────
export class InvStorageLocation extends Model<InferAttributes<InvStorageLocation>, InferCreationAttributes<InvStorageLocation>> {
  declare id: CreationOptional<number>
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvStorageLocation.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_storage_locations', timestamps: false })

// ── Storage Location Labs (join table) ────────────────────────────────────────
export class InvStorageLocationLab extends Model<InferAttributes<InvStorageLocationLab>, InferCreationAttributes<InvStorageLocationLab>> {
  declare storageLocationId: number
  declare labId: string
}
InvStorageLocationLab.init({
  storageLocationId: { type: DataTypes.INTEGER, primaryKey: true, field: 'storage_location_id' },
  labId: { type: DataTypes.UUID, primaryKey: true, field: 'lab_id' },
}, { sequelize, tableName: 'inv_storage_location_labs', timestamps: false })

// ── Materials ─────────────────────────────────────────────────────────────────
export class InvMaterial extends Model<InferAttributes<InvMaterial>, InferCreationAttributes<InvMaterial>> {
  declare id: CreationOptional<number>
  declare code: string
  declare name: string
  declare materialType: string | null
  declare casNo: string | null
  declare molecularFormula: string | null
  declare molWeight: number | null
  declare storageCondition: string | null
  declare hazardClass: string | null
  declare isoType: string | null
  declare antibioticResistanceMarker: string | null
  declare stockConcentration: string | null
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare departmentId: string | null
  declare consumableTypeId: number | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvMaterial.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  materialType: { type: DataTypes.STRING(100), allowNull: true, field: 'material_type' },
  casNo: { type: DataTypes.STRING(100), allowNull: true, field: 'cas_no' },
  molecularFormula: { type: DataTypes.STRING(200), allowNull: true, field: 'molecular_formula' },
  molWeight: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'mol_weight' },
  storageCondition: { type: DataTypes.STRING(200), allowNull: true, field: 'storage_condition' },
  hazardClass: { type: DataTypes.STRING(100), allowNull: true, field: 'hazard_class' },
  isoType: { type: DataTypes.STRING(50), allowNull: true, field: 'iso_type' },
  antibioticResistanceMarker: { type: DataTypes.STRING(200), allowNull: true, field: 'antibiotic_resistance_marker' },
  stockConcentration: { type: DataTypes.STRING(100), allowNull: true, field: 'stock_concentration' },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  consumableTypeId: { type: DataTypes.INTEGER, allowNull: true, field: 'consumable_type_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_materials', timestamps: false })

// ── Material Chemical Props ───────────────────────────────────────────────────
export class InvMaterialChemicalProp extends Model<InferAttributes<InvMaterialChemicalProp>, InferCreationAttributes<InvMaterialChemicalProp>> {
  declare id: CreationOptional<number>
  declare materialId: number
  declare purityPct: number | null
  declare grade: string | null
  declare appearance: string | null
  declare solubility: string | null
  declare boilingPt: number | null
  declare meltingPt: number | null
  declare flashPt: number | null
  declare density: number | null
  declare phRange: string | null
}
InvMaterialChemicalProp.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'material_id' },
  purityPct: { type: DataTypes.DECIMAL(6, 2), allowNull: true, field: 'purity_pct' },
  grade: { type: DataTypes.STRING(100), allowNull: true },
  appearance: { type: DataTypes.STRING(200), allowNull: true },
  solubility: { type: DataTypes.STRING(200), allowNull: true },
  boilingPt: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'boiling_pt' },
  meltingPt: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'melting_pt' },
  flashPt: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'flash_pt' },
  density: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
  phRange: { type: DataTypes.STRING(50), allowNull: true, field: 'ph_range' },
}, { sequelize, tableName: 'inv_material_chemical_props', timestamps: false })

// ── Material Formulation Props ────────────────────────────────────────────────
export class InvMaterialFormulationProp extends Model<InferAttributes<InvMaterialFormulationProp>, InferCreationAttributes<InvMaterialFormulationProp>> {
  declare id: CreationOptional<number>
  declare materialId: number
  declare role: string | null
  declare concentration: number | null
  declare units: string | null
  declare function: string | null
  declare compatibilityNotes: string | null
}
InvMaterialFormulationProp.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'material_id' },
  role: { type: DataTypes.STRING(100), allowNull: true },
  concentration: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  units: { type: DataTypes.STRING(50), allowNull: true },
  function: { type: DataTypes.STRING(200), allowNull: true },
  compatibilityNotes: { type: DataTypes.TEXT, allowNull: true, field: 'compatibility_notes' },
}, { sequelize, tableName: 'inv_material_formulation_props', timestamps: false })

// ── Material Code Counter ─────────────────────────────────────────────────────
export class InvMaterialCodeCounter extends Model<InferAttributes<InvMaterialCodeCounter>, InferCreationAttributes<InvMaterialCodeCounter>> {
  declare year: string
  declare lastSeq: CreationOptional<number>
}
InvMaterialCodeCounter.init({
  year: { type: DataTypes.STRING(2), primaryKey: true },
  lastSeq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10000, field: 'last_seq' },
}, { sequelize, tableName: 'inv_material_code_counter', timestamps: false })

// ── Manufacturers ─────────────────────────────────────────────────────────────
export class InvManufacturer extends Model<InferAttributes<InvManufacturer>, InferCreationAttributes<InvManufacturer>> {
  declare id: CreationOptional<number>
  declare code: string
  declare name: string
  declare country: string | null
  declare contactPerson: string | null
  declare email: string | null
  declare phone: string | null
  declare website: string | null
  declare address: string | null
  declare isActive: CreationOptional<boolean>
  declare isQualified: CreationOptional<boolean>
  declare qualificationFilePath: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvManufacturer.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  country: { type: DataTypes.STRING(100), allowNull: true },
  contactPerson: { type: DataTypes.STRING(200), allowNull: true, field: 'contact_person' },
  email: { type: DataTypes.STRING(255), allowNull: true },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  website: { type: DataTypes.STRING(255), allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  isQualified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_qualified' },
  qualificationFilePath: { type: DataTypes.STRING(500), allowNull: true, field: 'qualification_file_path' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_manufacturers', timestamps: false })

// ── Manufacturer Mapping ──────────────────────────────────────────────────────
export class InvManufacturerMapping extends Model<InferAttributes<InvManufacturerMapping>, InferCreationAttributes<InvManufacturerMapping>> {
  declare id: CreationOptional<number>
  declare materialId: number
  declare manufacturerId: number
  declare catalogueNo: string | null
  declare technicalGrade: string | null
  declare leadTimeDays: number | null
  declare minOrderQty: number | null
  declare dsdFilePath: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvManufacturerMapping.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materialId: { type: DataTypes.INTEGER, allowNull: false, field: 'material_id' },
  manufacturerId: { type: DataTypes.INTEGER, allowNull: false, field: 'manufacturer_id' },
  catalogueNo: { type: DataTypes.STRING(100), allowNull: true, field: 'catalogue_no' },
  technicalGrade: { type: DataTypes.STRING(100), allowNull: true, field: 'technical_grade' },
  leadTimeDays: { type: DataTypes.INTEGER, allowNull: true, field: 'lead_time_days' },
  minOrderQty: { type: DataTypes.DECIMAL(10, 3), allowNull: true, field: 'min_order_qty' },
  dsdFilePath: { type: DataTypes.STRING(500), allowNull: true, field: 'dsd_file_path' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_manufacturer_mapping', timestamps: false })

// ── Batch No Counter ──────────────────────────────────────────────────────────
export class InvBatchNoCounter extends Model<InferAttributes<InvBatchNoCounter>, InferCreationAttributes<InvBatchNoCounter>> {
  declare year: string
  declare lastSeq: CreationOptional<number>
}
InvBatchNoCounter.init({
  year: { type: DataTypes.STRING(2), primaryKey: true },
  lastSeq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10000, field: 'last_seq' },
}, { sequelize, tableName: 'inv_batch_no_counter', timestamps: false })

// ── Batch Number Counter ──────────────────────────────────────────────────────
export class InvBatchNumberCounter extends Model<InferAttributes<InvBatchNumberCounter>, InferCreationAttributes<InvBatchNumberCounter>> {
  declare year: string
  declare lastSeq: CreationOptional<number>
}
InvBatchNumberCounter.init({
  year: { type: DataTypes.STRING(20), primaryKey: true },
  lastSeq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'last_seq' },
}, { sequelize, tableName: 'inv_batch_number_counter', timestamps: false })

// ── Batches ───────────────────────────────────────────────────────────────────
export class InvBatch extends Model<InferAttributes<InvBatch>, InferCreationAttributes<InvBatch>> {
  declare id: CreationOptional<number>
  declare batchNo: string
  declare materialId: number
  declare manufacturerId: number | null
  declare stockRequestId: number | null
  declare qtyReceived: number
  declare qtyAvailable: number
  declare unit: CreationOptional<string>
  declare status: CreationOptional<string>
  declare category: CreationOptional<string>
  declare measuringUnit: string | null
  declare measuringUnitValue: number | null
  declare includePack: CreationOptional<boolean>
  declare packNumber: number | null
  declare packType: string | null
  declare packMode: string | null
  declare inhouseBatchNo: string | null
  declare mfgDate: string | null
  declare expiryDate: string | null
  declare retestDate: string | null
  declare grDate: string | null
  declare location: string | null
  declare bin: string | null
  declare invoiceNo: string | null
  declare poNo: string | null
  declare clone: string | null
  declare price: number | null
  declare receivedBy: string | null
  declare receivedAt: Date | null
  declare remarks: string | null
  declare coaFilePath: string | null
  declare coaFilename: string | null
  declare otherDocsFilePath: string | null
  declare otherDocsFilename: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvBatch.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  batchNo: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'batch_no' },
  materialId: { type: DataTypes.INTEGER, allowNull: false, field: 'material_id' },
  manufacturerId: { type: DataTypes.INTEGER, allowNull: true, field: 'manufacturer_id' },
  stockRequestId: { type: DataTypes.INTEGER, allowNull: true, field: 'stock_request_id' },
  qtyReceived: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'qty_received' },
  qtyAvailable: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'qty_available' },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
  category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'available' },
  measuringUnit: { type: DataTypes.STRING(50), allowNull: true, field: 'measuring_unit' },
  measuringUnitValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'measuring_unit_value' },
  includePack: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'include_pack' },
  packNumber: { type: DataTypes.INTEGER, allowNull: true, field: 'pack_number' },
  packType: { type: DataTypes.STRING(100), allowNull: true, field: 'pack_type' },
  packMode: { type: DataTypes.STRING(20), allowNull: true, field: 'pack_mode' },
  inhouseBatchNo: { type: DataTypes.STRING(100), allowNull: true, field: 'inhouse_batch_no' },
  mfgDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'mfg_date' },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'expiry_date' },
  retestDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'retest_date' },
  grDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'gr_date' },
  location: { type: DataTypes.STRING(200), allowNull: true },
  bin: { type: DataTypes.STRING(200), allowNull: true },
  invoiceNo: { type: DataTypes.STRING(100), allowNull: true, field: 'invoice_no' },
  poNo: { type: DataTypes.STRING(100), allowNull: true, field: 'po_no' },
  clone: { type: DataTypes.STRING(200), allowNull: true },
  price: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
  receivedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'received_by' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  coaFilePath: { type: DataTypes.STRING(500), allowNull: true, field: 'coa_file_path' },
  coaFilename: { type: DataTypes.STRING(255), allowNull: true, field: 'coa_filename' },
  otherDocsFilePath: { type: DataTypes.STRING(500), allowNull: true, field: 'other_docs_file_path' },
  otherDocsFilename: { type: DataTypes.STRING(255), allowNull: true, field: 'other_docs_filename' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_batches', timestamps: false })

// ── Batch Events ──────────────────────────────────────────────────────────────
export class InvBatchEvent extends Model<InferAttributes<InvBatchEvent>, InferCreationAttributes<InvBatchEvent>> {
  declare id: CreationOptional<number>
  declare batchId: number
  declare eventType: string
  declare qty: number | null
  declare refNo: string | null
  declare module: string | null
  declare issuedTo: string | null
  declare purpose: string | null
  declare projectCode: string | null
  declare performedBy: string
  declare performedAt: CreationOptional<Date>
  declare remarks: string | null
}
InvBatchEvent.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  batchId: { type: DataTypes.INTEGER, allowNull: false, field: 'batch_id' },
  eventType: { type: DataTypes.STRING(30), allowNull: false, field: 'event_type' },
  qty: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
  refNo: { type: DataTypes.STRING(100), allowNull: true, field: 'ref_no' },
  module: { type: DataTypes.STRING(100), allowNull: true },
  issuedTo: { type: DataTypes.STRING(200), allowNull: true, field: 'issued_to' },
  purpose: { type: DataTypes.STRING(500), allowNull: true },
  projectCode: { type: DataTypes.STRING(100), allowNull: true, field: 'project_code' },
  performedBy: { type: DataTypes.STRING(200), allowNull: false, field: 'performed_by' },
  performedAt: { type: DataTypes.DATE, allowNull: false, field: 'performed_at' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'inv_batch_events', timestamps: false })

// ── Batch Packs ───────────────────────────────────────────────────────────────
export class InvBatchPack extends Model<InferAttributes<InvBatchPack>, InferCreationAttributes<InvBatchPack>> {
  declare id: CreationOptional<number>
  declare batchId: number
  declare seqNo: number
  declare packNo: string
  declare qtyPerPack: number
  declare qtyAvailable: number
  declare inhouseBatchNo: string
}
InvBatchPack.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  batchId: { type: DataTypes.INTEGER, allowNull: false, field: 'batch_id' },
  seqNo: { type: DataTypes.INTEGER, allowNull: false, field: 'seq_no' },
  packNo: { type: DataTypes.STRING(100), allowNull: false, field: 'pack_no' },
  qtyPerPack: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'qty_per_pack' },
  qtyAvailable: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'qty_available' },
  inhouseBatchNo: { type: DataTypes.STRING(100), allowNull: false, field: 'inhouse_batch_no' },
}, { sequelize, tableName: 'inv_batch_packs', timestamps: false })

// ── Stock Requests ────────────────────────────────────────────────────────────
export class InvStockRequest extends Model<InferAttributes<InvStockRequest>, InferCreationAttributes<InvStockRequest>> {
  declare id: CreationOptional<number>
  declare requestNo: string
  declare materialId: number
  declare qtyRequired: number
  declare unit: CreationOptional<string>
  declare requiredByDate: string | null
  declare criticality: CreationOptional<string>
  declare purpose: string | null
  declare requestedBy: string | null
  declare requestedAt: Date | null
  declare departmentCode: string | null
  declare approvalStage: string | null
  declare approvedBy: string | null
  declare approvedAt: Date | null
  declare status: CreationOptional<string>
  declare remarks: string | null
  declare sourceBatchId: number | null
  declare sourcePackId: number | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvStockRequest.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestNo: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'request_no' },
  materialId: { type: DataTypes.INTEGER, allowNull: false, field: 'material_id' },
  qtyRequired: { type: DataTypes.DECIMAL(12, 4), allowNull: false, field: 'qty_required' },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'g' },
  requiredByDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'required_by_date' },
  criticality: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'GENERAL' },
  purpose: { type: DataTypes.TEXT, allowNull: true },
  requestedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'requested_by' },
  requestedAt: { type: DataTypes.DATE, allowNull: true, field: 'requested_at' },
  departmentCode: { type: DataTypes.STRING(20), allowNull: true, field: 'department_code' },
  approvalStage: { type: DataTypes.STRING(10), allowNull: true, field: 'approval_stage' },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  sourceBatchId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_batch_id' },
  sourcePackId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_pack_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_stock_requests', timestamps: false })

// ── Stock Request Events ──────────────────────────────────────────────────────
export class InvStockRequestEvent extends Model<InferAttributes<InvStockRequestEvent>, InferCreationAttributes<InvStockRequestEvent>> {
  declare id: CreationOptional<number>
  declare requestId: number
  declare eventType: string
  declare performedBy: string
  declare performedAt: CreationOptional<Date>
  declare remarks: string | null
}
InvStockRequestEvent.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  eventType: { type: DataTypes.STRING(30), allowNull: false, field: 'event_type' },
  performedBy: { type: DataTypes.STRING(200), allowNull: false, field: 'performed_by' },
  performedAt: { type: DataTypes.DATE, allowNull: false, field: 'performed_at' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'inv_stock_request_events', timestamps: false })

// ── Equipment Types ───────────────────────────────────────────────────────────
export class InvEquipmentType extends Model<InferAttributes<InvEquipmentType>, InferCreationAttributes<InvEquipmentType>> {
  declare id: CreationOptional<number>
  declare code: string
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}
InvEquipmentType.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_equipment_types', timestamps: false })

// ── Instrument Types ──────────────────────────────────────────────────────────
export class InvInstrumentType extends Model<InferAttributes<InvInstrumentType>, InferCreationAttributes<InvInstrumentType>> {
  declare id: CreationOptional<number>
  declare code: string
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}
InvInstrumentType.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_instrument_types', timestamps: false })

// ── Column Types ──────────────────────────────────────────────────────────────
export class InvColumnType extends Model<InferAttributes<InvColumnType>, InferCreationAttributes<InvColumnType>> {
  declare id: CreationOptional<number>
  declare code: string
  declare name: string
  declare description: string | null
  declare lengthMm: number | null
  declare particleSizeUm: number | null
  declare poreSizeAngstrom: number | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}
InvColumnType.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  lengthMm: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'length_mm' },
  particleSizeUm: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'particle_size_um' },
  poreSizeAngstrom: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'pore_size_angstrom' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_column_types', timestamps: false })

// ── Equipment Catalogue ───────────────────────────────────────────────────────
export class InvEquipmentCatalogue extends Model<InferAttributes<InvEquipmentCatalogue>, InferCreationAttributes<InvEquipmentCatalogue>> {
  declare id: CreationOptional<number>
  declare assetId: string
  declare equipmentTypeId: number | null
  declare name: string
  declare make: string | null
  declare model: string | null
  declare serialNo: string | null
  declare location: string | null
  declare usageType: string | null
  declare movable: CreationOptional<boolean>
  declare grossCapacity: number | null
  declare capacityUnit: string | null
  declare description: string | null
  declare maintenanceStatus: CreationOptional<string>
  declare status: CreationOptional<string>
  declare lastMaintenanceDate: string | null
  declare nextMaintenanceDate: string | null
  declare maintenanceType: string | null
  declare maintenanceFrequencyValue: number | null
  declare maintenanceFrequencyUnit: string | null
  declare isActive: CreationOptional<boolean>
  declare departmentId: string | null
  declare storageLocationId: number | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvEquipmentCatalogue.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'asset_id' },
  equipmentTypeId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipment_type_id' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  make: { type: DataTypes.STRING(100), allowNull: true },
  model: { type: DataTypes.STRING(100), allowNull: true },
  serialNo: { type: DataTypes.STRING(100), allowNull: true, field: 'serial_no' },
  location: { type: DataTypes.STRING(200), allowNull: true },
  usageType: { type: DataTypes.STRING(50), allowNull: true, field: 'usage_type' },
  movable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  grossCapacity: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'gross_capacity' },
  capacityUnit: { type: DataTypes.STRING(50), allowNull: true, field: 'capacity_unit' },
  description: { type: DataTypes.TEXT, allowNull: true },
  maintenanceStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'OK', field: 'maintenance_status' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
  lastMaintenanceDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'last_maintenance_date' },
  nextMaintenanceDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'next_maintenance_date' },
  maintenanceType: { type: DataTypes.STRING(10), allowNull: true, field: 'maintenance_type' },
  maintenanceFrequencyValue: { type: DataTypes.INTEGER, allowNull: true, field: 'maintenance_frequency_value' },
  maintenanceFrequencyUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'maintenance_frequency_unit' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  storageLocationId: { type: DataTypes.INTEGER, allowNull: true, field: 'storage_location_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_equipment_catalogue', timestamps: false })

// ── Instrument Catalogue ──────────────────────────────────────────────────────
export class InvInstrumentCatalogue extends Model<InferAttributes<InvInstrumentCatalogue>, InferCreationAttributes<InvInstrumentCatalogue>> {
  declare id: CreationOptional<number>
  declare assetId: string
  declare instrumentTypeId: number | null
  declare name: string
  declare make: string | null
  declare model: string | null
  declare serialNo: string | null
  declare location: string | null
  declare usageType: string | null
  declare movable: CreationOptional<boolean>
  declare grossCapacity: number | null
  declare capacityUnit: string | null
  declare lowerOperatingRange: number | null
  declare lowerUom: string | null
  declare upperOperatingRange: number | null
  declare upperUom: string | null
  declare requiredCalibration: CreationOptional<boolean>
  declare description: string | null
  declare calibrationStatus: CreationOptional<string>
  declare status: CreationOptional<string>
  declare lastCalibrationDate: string | null
  declare nextCalibrationDate: string | null
  declare calibrationType: string | null
  declare calibrationFrequencyValue: number | null
  declare calibrationFrequencyUnit: string | null
  declare lastMaintenanceDate: string | null
  declare nextMaintenanceDate: string | null
  declare isActive: CreationOptional<boolean>
  declare departmentId: string | null
  declare storageLocationId: number | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvInstrumentCatalogue.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'asset_id' },
  instrumentTypeId: { type: DataTypes.INTEGER, allowNull: true, field: 'instrument_type_id' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  make: { type: DataTypes.STRING(100), allowNull: true },
  model: { type: DataTypes.STRING(100), allowNull: true },
  serialNo: { type: DataTypes.STRING(100), allowNull: true, field: 'serial_no' },
  location: { type: DataTypes.STRING(200), allowNull: true },
  usageType: { type: DataTypes.STRING(50), allowNull: true, field: 'usage_type' },
  movable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  grossCapacity: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'gross_capacity' },
  capacityUnit: { type: DataTypes.STRING(50), allowNull: true, field: 'capacity_unit' },
  lowerOperatingRange: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'lower_operating_range' },
  lowerUom: { type: DataTypes.STRING(50), allowNull: true, field: 'lower_uom' },
  upperOperatingRange: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'upper_operating_range' },
  upperUom: { type: DataTypes.STRING(50), allowNull: true, field: 'upper_uom' },
  requiredCalibration: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'required_calibration' },
  description: { type: DataTypes.TEXT, allowNull: true },
  calibrationStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'OK', field: 'calibration_status' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'AVAILABLE' },
  lastCalibrationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'last_calibration_date' },
  nextCalibrationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'next_calibration_date' },
  calibrationType: { type: DataTypes.STRING(10), allowNull: true, field: 'calibration_type' },
  calibrationFrequencyValue: { type: DataTypes.INTEGER, allowNull: true, field: 'calibration_frequency_value' },
  calibrationFrequencyUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'calibration_frequency_unit' },
  lastMaintenanceDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'last_maintenance_date' },
  nextMaintenanceDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'next_maintenance_date' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  storageLocationId: { type: DataTypes.INTEGER, allowNull: true, field: 'storage_location_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_instrument_catalogue', timestamps: false })

// ── Column Catalogue ──────────────────────────────────────────────────────────
export class InvColumnCatalogue extends Model<InferAttributes<InvColumnCatalogue>, InferCreationAttributes<InvColumnCatalogue>> {
  declare id: CreationOptional<number>
  declare columnId: string
  declare columnTypeId: number | null
  declare name: string
  declare manufacturer: string | null
  declare lengthValue: number | null
  declare lengthUnit: string | null
  declare poreSizeValue: number | null
  declare poreSizeUnit: string | null
  declare innerDiameterValue: number | null
  declare innerDiameterUnit: string | null
  declare particleSizeValue: number | null
  declare particleSizeUnit: string | null
  declare filmThicknessValue: number | null
  declare filmThicknessUnit: string | null
  declare outerDiameterValue: number | null
  declare outerDiameterUnit: string | null
  declare maxInjections: CreationOptional<number>
  declare cumulativeInjections: CreationOptional<number>
  declare status: CreationOptional<string>
  declare isActive: CreationOptional<boolean>
  declare departmentId: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvColumnCatalogue.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  columnId: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'column_id' },
  columnTypeId: { type: DataTypes.INTEGER, allowNull: true, field: 'column_type_id' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  manufacturer: { type: DataTypes.STRING(255), allowNull: true },
  lengthValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'length_value' },
  lengthUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'length_unit' },
  poreSizeValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'pore_size_value' },
  poreSizeUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'pore_size_unit' },
  innerDiameterValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'inner_diameter_value' },
  innerDiameterUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'inner_diameter_unit' },
  particleSizeValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'particle_size_value' },
  particleSizeUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'particle_size_unit' },
  filmThicknessValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'film_thickness_value' },
  filmThicknessUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'film_thickness_unit' },
  outerDiameterValue: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'outer_diameter_value' },
  outerDiameterUnit: { type: DataTypes.STRING(20), allowNull: true, field: 'outer_diameter_unit' },
  maxInjections: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 500, field: 'max_injections' },
  cumulativeInjections: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'cumulative_injections' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_column_catalogue', timestamps: false })

// ── Checklists ────────────────────────────────────────────────────────────────
export class InvChecklist extends Model<InferAttributes<InvChecklist>, InferCreationAttributes<InvChecklist>> {
  declare id: CreationOptional<number>
  declare name: string
  declare checklistType: CreationOptional<string>
  declare logType: CreationOptional<string>
  declare usageType: string | null
  declare targetKind: CreationOptional<string>
  declare equipmentCode: string | null
  declare version: CreationOptional<string>
  declare status: CreationOptional<string>
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvChecklist.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  checklistType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'GENERAL', field: 'checklist_type' },
  logType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'CHECKLIST', field: 'log_type' },
  usageType: { type: DataTypes.STRING(30), allowNull: true, field: 'usage_type' },
  targetKind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT', field: 'target_kind' },
  equipmentCode: { type: DataTypes.STRING(100), allowNull: true, field: 'equipment_code' },
  version: { type: DataTypes.STRING(10), allowNull: false, defaultValue: '0.1' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'DRAFT' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_checklists', timestamps: false })

// ── Checklist Items ───────────────────────────────────────────────────────────
export class InvChecklistItem extends Model<InferAttributes<InvChecklistItem>, InferCreationAttributes<InvChecklistItem>> {
  declare id: CreationOptional<number>
  declare checklistId: number
  declare seqNo: CreationOptional<number>
  declare instructionType: CreationOptional<string>
  declare dataType: string | null
  declare frequencies: object | null
  declare precision: number | null
  declare lowerLimit: number | null
  declare upperLimit: number | null
  declare options: object | null
  declare details: string | null
  declare createdAt: CreationOptional<Date>
}
InvChecklistItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  checklistId: { type: DataTypes.INTEGER, allowNull: false, field: 'checklist_id' },
  seqNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'seq_no' },
  instructionType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'INSTRUCTION', field: 'instruction_type' },
  dataType: { type: DataTypes.STRING(30), allowNull: true, field: 'data_type' },
  frequencies: { type: DataTypes.JSONB, allowNull: true },
  precision: { type: DataTypes.INTEGER, allowNull: true },
  lowerLimit: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'lower_limit' },
  upperLimit: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'upper_limit' },
  options: { type: DataTypes.JSONB, allowNull: true },
  details: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_checklist_items', timestamps: false })

// ── Checklist Approvals ───────────────────────────────────────────────────────
export class InvChecklistApproval extends Model<InferAttributes<InvChecklistApproval>, InferCreationAttributes<InvChecklistApproval>> {
  declare id: CreationOptional<number>
  declare checklistId: number
  declare action: string
  declare fromState: string | null
  declare toState: string | null
  declare performedBy: string
  declare comment: string | null
  declare performedAt: CreationOptional<Date>
}
InvChecklistApproval.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  checklistId: { type: DataTypes.INTEGER, allowNull: false, field: 'checklist_id' },
  action: { type: DataTypes.STRING(20), allowNull: false },
  fromState: { type: DataTypes.STRING(30), allowNull: true, field: 'from_state' },
  toState: { type: DataTypes.STRING(30), allowNull: true, field: 'to_state' },
  performedBy: { type: DataTypes.STRING(200), allowNull: false, field: 'performed_by' },
  comment: { type: DataTypes.TEXT, allowNull: true },
  performedAt: { type: DataTypes.DATE, allowNull: false, field: 'performed_at' },
}, { sequelize, tableName: 'inv_checklist_approvals', timestamps: false })

// ── Measurement Master ────────────────────────────────────────────────────────
export class InvMeasurementMaster extends Model<InferAttributes<InvMeasurementMaster>, InferCreationAttributes<InvMeasurementMaster>> {
  declare id: CreationOptional<number>
  declare name: string
  declare dataType: CreationOptional<string>
  declare uom: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}
InvMeasurementMaster.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  dataType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DECIMAL', field: 'data_type' },
  uom: { type: DataTypes.STRING(50), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_measurement_master', timestamps: false })

// ── Log Mappings ──────────────────────────────────────────────────────────────
export class InvLogMapping extends Model<InferAttributes<InvLogMapping>, InferCreationAttributes<InvLogMapping>> {
  declare id: CreationOptional<number>
  declare equipmentId: number | null
  declare instrumentId: number | null
  declare logType: string
  declare checklistId: number | null
  declare toleranceDays: number | null
  declare alertLimit: number | null
  declare deviationLimit: number | null
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvLogMapping.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  equipmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipment_id' },
  instrumentId: { type: DataTypes.INTEGER, allowNull: true, field: 'instrument_id' },
  logType: { type: DataTypes.STRING(30), allowNull: false, field: 'log_type' },
  checklistId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_id' },
  toleranceDays: { type: DataTypes.INTEGER, allowNull: true, field: 'tolerance_days' },
  alertLimit: { type: DataTypes.INTEGER, allowNull: true, field: 'alert_limit' },
  deviationLimit: { type: DataTypes.INTEGER, allowNull: true, field: 'deviation_limit' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_log_mappings', timestamps: false })

// ── Instrument Parameters ─────────────────────────────────────────────────────
export class InvInstrumentParameter extends Model<InferAttributes<InvInstrumentParameter>, InferCreationAttributes<InvInstrumentParameter>> {
  declare id: CreationOptional<number>
  declare instrumentId: number
  declare measurementId: number | null
  declare measurementName: string | null
  declare precision: number | null
  declare lowerUnit: number | null
  declare lowerUom: string | null
  declare upperUnit: number | null
  declare upperUom: string | null
  declare calibrationTolerancePct: number | null
  declare seqNo: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
}
InvInstrumentParameter.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  instrumentId: { type: DataTypes.INTEGER, allowNull: false, field: 'instrument_id' },
  measurementId: { type: DataTypes.INTEGER, allowNull: true, field: 'measurement_id' },
  measurementName: { type: DataTypes.STRING(255), allowNull: true, field: 'measurement_name' },
  precision: { type: DataTypes.INTEGER, allowNull: true },
  lowerUnit: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'lower_unit' },
  lowerUom: { type: DataTypes.STRING(50), allowNull: true, field: 'lower_uom' },
  upperUnit: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'upper_unit' },
  upperUom: { type: DataTypes.STRING(50), allowNull: true, field: 'upper_uom' },
  calibrationTolerancePct: { type: DataTypes.DECIMAL(8, 4), allowNull: true, field: 'calibration_tolerance_pct' },
  seqNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'seq_no' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_instrument_parameters', timestamps: false })

// ── Instrument Spec Details ───────────────────────────────────────────────────
export class InvInstrumentSpecDetail extends Model<InferAttributes<InvInstrumentSpecDetail>, InferCreationAttributes<InvInstrumentSpecDetail>> {
  declare id: CreationOptional<number>
  declare instrumentId: number
  declare specification: string
  declare value: string | null
  declare uom: string | null
  declare seqNo: CreationOptional<number>
  declare createdAt: CreationOptional<Date>
}
InvInstrumentSpecDetail.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  instrumentId: { type: DataTypes.INTEGER, allowNull: false, field: 'instrument_id' },
  specification: { type: DataTypes.STRING(255), allowNull: false },
  value: { type: DataTypes.STRING(255), allowNull: true },
  uom: { type: DataTypes.STRING(50), allowNull: true },
  seqNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'seq_no' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_instrument_spec_details', timestamps: false })

// ── Schedules ─────────────────────────────────────────────────────────────────
export class InvSchedule extends Model<InferAttributes<InvSchedule>, InferCreationAttributes<InvSchedule>> {
  declare id: CreationOptional<number>
  declare targetKind: CreationOptional<string>
  declare equipmentId: number | null
  declare instrumentId: number | null
  declare logType: string
  declare checklistId: number | null
  declare scheduleType: string
  declare dueDate: string
  declare plannedDate: string | null
  declare calibrationSource: string | null
  declare toleranceDays: number | null
  declare alertLimit: number | null
  declare deviationLimit: number | null
  declare doneOn: string | null
  declare status: CreationOptional<string>
  declare source: CreationOptional<string>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvSchedule.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  targetKind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT', field: 'target_kind' },
  equipmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipment_id' },
  instrumentId: { type: DataTypes.INTEGER, allowNull: true, field: 'instrument_id' },
  logType: { type: DataTypes.STRING(30), allowNull: false, field: 'log_type' },
  checklistId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_id' },
  scheduleType: { type: DataTypes.STRING(20), allowNull: false, field: 'schedule_type' },
  dueDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'due_date' },
  plannedDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'planned_date' },
  calibrationSource: { type: DataTypes.STRING(10), allowNull: true, field: 'calibration_source' },
  toleranceDays: { type: DataTypes.INTEGER, allowNull: true, field: 'tolerance_days' },
  alertLimit: { type: DataTypes.INTEGER, allowNull: true, field: 'alert_limit' },
  deviationLimit: { type: DataTypes.INTEGER, allowNull: true, field: 'deviation_limit' },
  doneOn: { type: DataTypes.DATEONLY, allowNull: true, field: 'done_on' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DUE' },
  source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_schedules', timestamps: false })

// ── Spare Parts ───────────────────────────────────────────────────────────────
export class InvSparePart extends Model<InferAttributes<InvSparePart>, InferCreationAttributes<InvSparePart>> {
  declare id: CreationOptional<number>
  declare partCode: string
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}
InvSparePart.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  partCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'part_code' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_spare_parts', timestamps: false })

// ── Work Orders ───────────────────────────────────────────────────────────────
export class InvWorkOrder extends Model<InferAttributes<InvWorkOrder>, InferCreationAttributes<InvWorkOrder>> {
  declare id: CreationOptional<number>
  declare workorderNo: string
  declare targetKind: CreationOptional<string>
  declare equipmentId: number | null
  declare instrumentId: number | null
  declare scheduleId: number | null
  declare checklistId: number | null
  declare kind: string
  declare logType: string
  declare status: CreationOptional<string>
  declare deviation: CreationOptional<boolean>
  declare remarks: string | null
  declare maintenanceType: string | null
  declare breakdownDescription: string | null
  declare sparePartsUsed: boolean | null
  declare calibrationSource: string | null
  declare certificateNo: string | null
  declare checklistSnapshot: object | null
  declare raisedBy: string | null
  declare raisedAt: Date | null
  declare startedBy: string | null
  declare startedAt: Date | null
  declare endedBy: string | null
  declare endedAt: Date | null
  declare verifiedBy: string | null
  declare verifiedAt: Date | null
  declare approvedBy: string | null
  declare approvedAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvWorkOrder.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workorderNo: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'workorder_no' },
  targetKind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT', field: 'target_kind' },
  equipmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipment_id' },
  instrumentId: { type: DataTypes.INTEGER, allowNull: true, field: 'instrument_id' },
  scheduleId: { type: DataTypes.INTEGER, allowNull: true, field: 'schedule_id' },
  checklistId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_id' },
  kind: { type: DataTypes.STRING(20), allowNull: false },
  logType: { type: DataTypes.STRING(30), allowNull: false, field: 'log_type' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'RAISED' },
  deviation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  maintenanceType: { type: DataTypes.STRING(10), allowNull: true, field: 'maintenance_type' },
  breakdownDescription: { type: DataTypes.TEXT, allowNull: true, field: 'breakdown_description' },
  sparePartsUsed: { type: DataTypes.BOOLEAN, allowNull: true, field: 'spare_parts_used' },
  calibrationSource: { type: DataTypes.STRING(10), allowNull: true, field: 'calibration_source' },
  certificateNo: { type: DataTypes.STRING(100), allowNull: true, field: 'certificate_no' },
  checklistSnapshot: { type: DataTypes.JSONB, allowNull: true, field: 'checklist_snapshot' },
  raisedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'raised_by' },
  raisedAt: { type: DataTypes.DATE, allowNull: true, field: 'raised_at' },
  startedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'started_by' },
  startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
  endedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'ended_by' },
  endedAt: { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
  verifiedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'verified_by' },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_work_orders', timestamps: false })

// ── Work Order Results ────────────────────────────────────────────────────────
export class InvWorkOrderResult extends Model<InferAttributes<InvWorkOrderResult>, InferCreationAttributes<InvWorkOrderResult>> {
  declare id: CreationOptional<number>
  declare workOrderId: number
  declare checklistItemId: number | null
  declare observation: string | null
  declare comment: string | null
  declare doneBy: string | null
  declare doneAt: Date | null
}
InvWorkOrderResult.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: false, field: 'work_order_id' },
  checklistItemId: { type: DataTypes.INTEGER, allowNull: true, field: 'checklist_item_id' },
  observation: { type: DataTypes.STRING(255), allowNull: true },
  comment: { type: DataTypes.TEXT, allowNull: true },
  doneBy: { type: DataTypes.STRING(200), allowNull: true, field: 'done_by' },
  doneAt: { type: DataTypes.DATE, allowNull: true, field: 'done_at' },
}, { sequelize, tableName: 'inv_work_order_results', timestamps: false })

// ── Work Order Signatures ─────────────────────────────────────────────────────
export class InvWorkOrderSignature extends Model<InferAttributes<InvWorkOrderSignature>, InferCreationAttributes<InvWorkOrderSignature>> {
  declare id: CreationOptional<number>
  declare workOrderId: number
  declare signingFor: string
  declare name: string
  declare comments: string | null
  declare completedOn: CreationOptional<Date>
}
InvWorkOrderSignature.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: false, field: 'work_order_id' },
  signingFor: { type: DataTypes.STRING(100), allowNull: false, field: 'signing_for' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  comments: { type: DataTypes.TEXT, allowNull: true },
  completedOn: { type: DataTypes.DATE, allowNull: false, field: 'completed_on' },
}, { sequelize, tableName: 'inv_work_order_signatures', timestamps: false })

// ── Work Order Spares ─────────────────────────────────────────────────────────
export class InvWorkOrderSpare extends Model<InferAttributes<InvWorkOrderSpare>, InferCreationAttributes<InvWorkOrderSpare>> {
  declare id: CreationOptional<number>
  declare workOrderId: number
  declare sparePartId: number | null
  declare partCode: string
}
InvWorkOrderSpare.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: false, field: 'work_order_id' },
  sparePartId: { type: DataTypes.INTEGER, allowNull: true, field: 'spare_part_id' },
  partCode: { type: DataTypes.STRING(100), allowNull: false, field: 'part_code' },
}, { sequelize, tableName: 'inv_work_order_spares', timestamps: false })

// ── Calibration References ────────────────────────────────────────────────────
export class InvCalibrationReference extends Model<InferAttributes<InvCalibrationReference>, InferCreationAttributes<InvCalibrationReference>> {
  declare id: CreationOptional<number>
  declare workOrderId: number
  declare measurementId: number | null
  declare measurementName: string | null
  declare referenceInstId: string | null
  declare referenceReading: number | null
  declare instrumentReading: number | null
  declare variancePct: number | null
  declare tolerancePct: number | null
  declare status: string | null
  declare doneBy: string | null
  declare doneAt: Date | null
}
InvCalibrationReference.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  workOrderId: { type: DataTypes.INTEGER, allowNull: false, field: 'work_order_id' },
  measurementId: { type: DataTypes.INTEGER, allowNull: true, field: 'measurement_id' },
  measurementName: { type: DataTypes.STRING(255), allowNull: true, field: 'measurement_name' },
  referenceInstId: { type: DataTypes.STRING(100), allowNull: true, field: 'reference_inst_id' },
  referenceReading: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'reference_reading' },
  instrumentReading: { type: DataTypes.DECIMAL(14, 4), allowNull: true, field: 'instrument_reading' },
  variancePct: { type: DataTypes.DECIMAL(8, 4), allowNull: true, field: 'variance_pct' },
  tolerancePct: { type: DataTypes.DECIMAL(8, 4), allowNull: true, field: 'tolerance_pct' },
  status: { type: DataTypes.STRING(10), allowNull: true },
  doneBy: { type: DataTypes.STRING(200), allowNull: true, field: 'done_by' },
  doneAt: { type: DataTypes.DATE, allowNull: true, field: 'done_at' },
}, { sequelize, tableName: 'inv_calibration_references', timestamps: false })

// ── Usage Logs ────────────────────────────────────────────────────────────────
export class InvUsageLog extends Model<InferAttributes<InvUsageLog>, InferCreationAttributes<InvUsageLog>> {
  declare id: CreationOptional<number>
  declare targetKind: CreationOptional<string>
  declare equipmentId: number | null
  declare instrumentId: number | null
  declare columnId: number | null
  declare previousProductCode: string | null
  declare previousBatchNo: string | null
  declare referenceNo: string | null
  declare documentName: string | null
  declare usageRemarks: string | null
  declare status: CreationOptional<string>
  declare startedBy: string | null
  declare startedAt: Date | null
  declare endedBy: string | null
  declare endedAt: Date | null
  declare source: CreationOptional<string>
  declare experimentId: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvUsageLog.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  targetKind: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'EQUIPMENT', field: 'target_kind' },
  equipmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'equipment_id' },
  instrumentId: { type: DataTypes.INTEGER, allowNull: true, field: 'instrument_id' },
  columnId: { type: DataTypes.INTEGER, allowNull: true, field: 'column_id' },
  previousProductCode: { type: DataTypes.STRING(100), allowNull: true, field: 'previous_product_code' },
  previousBatchNo: { type: DataTypes.STRING(100), allowNull: true, field: 'previous_batch_no' },
  referenceNo: { type: DataTypes.STRING(100), allowNull: true, field: 'reference_no' },
  documentName: { type: DataTypes.STRING(255), allowNull: true, field: 'document_name' },
  usageRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'usage_remarks' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'IN_USE' },
  startedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'started_by' },
  startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
  endedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'ended_by' },
  endedAt: { type: DataTypes.DATE, allowNull: true, field: 'ended_at' },
  source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MANUAL' },
  experimentId: { type: DataTypes.UUID, allowNull: true, field: 'experiment_id' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_usage_logs', timestamps: false })

// ── Gate Passes ───────────────────────────────────────────────────────────────
export class InvGatePass extends Model<InferAttributes<InvGatePass>, InferCreationAttributes<InvGatePass>> {
  declare id: CreationOptional<number>
  declare gpNumber: string
  declare docType: string
  declare manufacturerId: number | null
  declare vendorCode: string | null
  declare vendorName: string | null
  declare gpDate: string
  declare prNumber: string | null
  declare workOrderNo: string | null
  declare remarks: string | null
  declare status: CreationOptional<string>
  declare workOrderId: number | null
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare approvedBy: string | null
  declare approvedAt: Date | null
  declare dispatchedBy: string | null
  declare dispatchedAt: Date | null
  declare updatedAt: CreationOptional<Date>
}
InvGatePass.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gpNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'gp_number' },
  docType: { type: DataTypes.STRING(20), allowNull: false, field: 'doc_type' },
  manufacturerId: { type: DataTypes.INTEGER, allowNull: true, field: 'manufacturer_id' },
  vendorCode: { type: DataTypes.STRING(50), allowNull: true, field: 'vendor_code' },
  vendorName: { type: DataTypes.STRING(255), allowNull: true, field: 'vendor_name' },
  gpDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'gp_date' },
  prNumber: { type: DataTypes.STRING(100), allowNull: true, field: 'pr_number' },
  workOrderNo: { type: DataTypes.STRING(100), allowNull: true, field: 'work_order_no' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'DRAFT' },
  workOrderId: { type: DataTypes.INTEGER, allowNull: true, field: 'work_order_id' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  dispatchedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'dispatched_by' },
  dispatchedAt: { type: DataTypes.DATE, allowNull: true, field: 'dispatched_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_gate_passes', timestamps: false })

// ── Gate Pass Items ───────────────────────────────────────────────────────────
export class InvGatePassItem extends Model<InferAttributes<InvGatePassItem>, InferCreationAttributes<InvGatePassItem>> {
  declare id: CreationOptional<number>
  declare gatePassId: number
  declare srNo: number
  declare materialId: number | null
  declare materialCode: string | null
  declare materialName: string
  declare description: string | null
  declare quantity: CreationOptional<number>
  declare uom: string | null
  declare rate: number | null
  declare totalValue: CreationOptional<number>
  declare returnedQty: CreationOptional<number>
  declare sourceBatchId: number | null
  declare sourcePackId: number | null
}
InvGatePassItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gatePassId: { type: DataTypes.INTEGER, allowNull: false, field: 'gate_pass_id' },
  srNo: { type: DataTypes.INTEGER, allowNull: false, field: 'sr_no' },
  materialId: { type: DataTypes.INTEGER, allowNull: true, field: 'material_id' },
  materialCode: { type: DataTypes.STRING(50), allowNull: true, field: 'material_code' },
  materialName: { type: DataTypes.STRING(255), allowNull: false, field: 'material_name' },
  description: { type: DataTypes.TEXT, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
  uom: { type: DataTypes.STRING(20), allowNull: true },
  rate: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  totalValue: { type: DataTypes.DECIMAL(16, 2), allowNull: false, defaultValue: 0, field: 'total_value' },
  returnedQty: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0, field: 'returned_qty' },
  sourceBatchId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_batch_id' },
  sourcePackId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_pack_id' },
}, { sequelize, tableName: 'inv_gate_pass_items', timestamps: false })

// ── Gate Pass Returns ─────────────────────────────────────────────────────────
export class InvGatePassReturn extends Model<InferAttributes<InvGatePassReturn>, InferCreationAttributes<InvGatePassReturn>> {
  declare id: CreationOptional<number>
  declare gatePassId: number
  declare returnGpNumber: string
  declare returnDate: string
  declare itemSrNo: number
  declare receivedQty: CreationOptional<number>
  declare condition: string | null
  declare remarks: string | null
  declare receivedBy: string | null
  declare createdAt: CreationOptional<Date>
}
InvGatePassReturn.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gatePassId: { type: DataTypes.INTEGER, allowNull: false, field: 'gate_pass_id' },
  returnGpNumber: { type: DataTypes.STRING(50), allowNull: false, field: 'return_gp_number' },
  returnDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'return_date' },
  itemSrNo: { type: DataTypes.INTEGER, allowNull: false, field: 'item_sr_no' },
  receivedQty: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0, field: 'received_qty' },
  condition: { type: DataTypes.STRING(20), allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  receivedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'received_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, { sequelize, tableName: 'inv_gate_pass_returns', timestamps: false })

// ── Gate Pass Signatures ──────────────────────────────────────────────────────
export class InvGatePassSignature extends Model<InferAttributes<InvGatePassSignature>, InferCreationAttributes<InvGatePassSignature>> {
  declare id: CreationOptional<number>
  declare gatePassId: number
  declare signingFor: string
  declare name: string
  declare comments: string | null
  declare completedOn: CreationOptional<Date>
}
InvGatePassSignature.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gatePassId: { type: DataTypes.INTEGER, allowNull: false, field: 'gate_pass_id' },
  signingFor: { type: DataTypes.STRING(100), allowNull: false, field: 'signing_for' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  comments: { type: DataTypes.TEXT, allowNull: true },
  completedOn: { type: DataTypes.DATE, allowNull: false, field: 'completed_on' },
}, { sequelize, tableName: 'inv_gate_pass_signatures', timestamps: false })

// ── Audit Trail ───────────────────────────────────────────────────────────────
export class InvAuditTrail extends Model<InferAttributes<InvAuditTrail>, InferCreationAttributes<InvAuditTrail>> {
  declare id: CreationOptional<number>
  declare eventType: string
  declare entityType: string
  declare entityId: string | null
  declare entityRef: string | null
  declare performedBy: string
  declare performedAt: CreationOptional<Date>
  declare oldValue: string | null
  declare newValue: string | null
  declare details: string | null
}
InvAuditTrail.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  eventType: { type: DataTypes.STRING(50), allowNull: false, field: 'event_type' },
  entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.STRING(100), allowNull: true, field: 'entity_id' },
  entityRef: { type: DataTypes.STRING(200), allowNull: true, field: 'entity_ref' },
  performedBy: { type: DataTypes.STRING(200), allowNull: false, field: 'performed_by' },
  performedAt: { type: DataTypes.DATE, allowNull: false, field: 'performed_at' },
  oldValue: { type: DataTypes.TEXT, allowNull: true, field: 'old_value' },
  newValue: { type: DataTypes.TEXT, allowNull: true, field: 'new_value' },
  details: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'inv_audit_trail', timestamps: false })

// ── General Lookup ────────────────────────────────────────────────────────────
export class InvGeneralLookup extends Model<InferAttributes<InvGeneralLookup>, InferCreationAttributes<InvGeneralLookup>> {
  declare id: CreationOptional<number>
  declare lookupType: string
  declare lookupValue: string
  declare lookupCode: string
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
InvGeneralLookup.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lookupType: { type: DataTypes.STRING(100), allowNull: false, field: 'lookup_type' },
  lookupValue: { type: DataTypes.STRING(255), allowNull: false, field: 'lookup_value' },
  lookupCode: { type: DataTypes.STRING(100), allowNull: false, field: 'lookup_code' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
}, { sequelize, tableName: 'inv_general_lookup', timestamps: false })

// ── UOM Dimensions ────────────────────────────────────────────────────────────
export class InvUomDimension extends Model<InferAttributes<InvUomDimension>, InferCreationAttributes<InvUomDimension>> {
  declare id: CreationOptional<number>
  declare dimensionKey: string
  declare displayName: string
  declare baseUnit: string
  declare sortOrder: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
}
InvUomDimension.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dimensionKey: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'dimension_key' },
  displayName: { type: DataTypes.STRING(200), allowNull: false, field: 'display_name' },
  baseUnit: { type: DataTypes.STRING(50), allowNull: false, field: 'base_unit' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'inv_uom_dimensions', timestamps: false })

// ── UOM Units ─────────────────────────────────────────────────────────────────
export class InvUomUnit extends Model<InferAttributes<InvUomUnit>, InferCreationAttributes<InvUomUnit>> {
  declare id: CreationOptional<number>
  declare dimensionId: number
  declare symbol: string
  declare name: string | null
  declare factorToBase: CreationOptional<number>
  declare sortOrder: CreationOptional<number>
  declare isActive: CreationOptional<boolean>
}
InvUomUnit.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dimensionId: { type: DataTypes.INTEGER, allowNull: false, field: 'dimension_id' },
  symbol: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: true },
  factorToBase: { type: DataTypes.DECIMAL(24, 12), allowNull: false, defaultValue: 1, field: 'factor_to_base' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'inv_uom_units', timestamps: false })

// ── Test Types ────────────────────────────────────────────────────────────────
export class InvTestType extends Model<InferAttributes<InvTestType>, InferCreationAttributes<InvTestType>> {
  declare id: CreationOptional<number>
  declare typeKey: string
  declare name: string
  declare isActive: CreationOptional<boolean>
}
InvTestType.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  typeKey: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'type_key' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'inv_test_types', timestamps: false })

// ── Test Names ────────────────────────────────────────────────────────────────
export class InvTestName extends Model<InferAttributes<InvTestName>, InferCreationAttributes<InvTestName>> {
  declare id: CreationOptional<number>
  declare testTypeId: number
  declare name: string
  declare isActive: CreationOptional<boolean>
}
InvTestName.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  testTypeId: { type: DataTypes.INTEGER, allowNull: false, field: 'test_type_id' },
  name: { type: DataTypes.STRING(255), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'inv_test_names', timestamps: false })

// ── Test Methods ──────────────────────────────────────────────────────────────
export class InvTestMethod extends Model<InferAttributes<InvTestMethod>, InferCreationAttributes<InvTestMethod>> {
  declare id: CreationOptional<number>
  declare testNameId: number
  declare methodName: string
  declare isActive: CreationOptional<boolean>
}
InvTestMethod.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  testNameId: { type: DataTypes.INTEGER, allowNull: false, field: 'test_name_id' },
  methodName: { type: DataTypes.STRING(255), allowNull: false, field: 'method_name' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'inv_test_methods', timestamps: false })

