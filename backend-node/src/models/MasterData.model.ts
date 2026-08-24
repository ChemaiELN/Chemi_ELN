import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class MasterDataItem extends Model<InferAttributes<MasterDataItem>, InferCreationAttributes<MasterDataItem>> {
  declare id: CreationOptional<string>
  declare category: string
  declare code: string
  declare name: string
  declare description: string | null
  declare sortOrder: number | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
}

MasterDataItem.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  category: { type: DataTypes.STRING(50), allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: true, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'master_data_items',
  timestamps: false,
})

export class LookupChemical extends Model<InferAttributes<LookupChemical>, InferCreationAttributes<LookupChemical>> {
  declare id: CreationOptional<string>
  declare chemicalName: string
  declare casNo: string | null
  declare formula: string | null
  declare molWt: number | null
  declare vendorName: string | null
  declare density: number | null
  declare purityPct: number | null
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

LookupChemical.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  chemicalName: { type: DataTypes.STRING(255), allowNull: false, field: 'chemical_name' },
  casNo: { type: DataTypes.STRING(50), allowNull: true, field: 'cas_no' },
  formula: { type: DataTypes.STRING(100), allowNull: true },
  molWt: { type: DataTypes.DECIMAL(10, 4), allowNull: true, field: 'mol_wt' },
  vendorName: { type: DataTypes.STRING(200), allowNull: true, field: 'vendor_name' },
  density: { type: DataTypes.DECIMAL(10, 4), allowNull: true },
  purityPct: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'purity_pct' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'lookup_chemicals',
  timestamps: false,
})

export class LookupInstrument extends Model<InferAttributes<LookupInstrument>, InferCreationAttributes<LookupInstrument>> {
  declare id: CreationOptional<string>
  declare instrumentCode: string
  declare instrumentType: string | null
  declare instrumentName: string
  declare maintenanceStatus: string | null
  declare calibrationStatus: string | null
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

LookupInstrument.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  instrumentCode: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'instrument_code' },
  instrumentType: { type: DataTypes.STRING(100), allowNull: true, field: 'instrument_type' },
  instrumentName: { type: DataTypes.STRING(200), allowNull: false, field: 'instrument_name' },
  maintenanceStatus: { type: DataTypes.STRING(50), allowNull: true, field: 'maintenance_status' },
  calibrationStatus: { type: DataTypes.STRING(50), allowNull: true, field: 'calibration_status' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'lookup_instruments',
  timestamps: false,
})
