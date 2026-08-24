import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class IdSequenceConfig extends Model<InferAttributes<IdSequenceConfig>, InferCreationAttributes<IdSequenceConfig>> {
  declare id: CreationOptional<string>
  declare code: string
  declare label: string
  declare prefix: string | null
  declare separator: CreationOptional<string>
  declare includeYear: CreationOptional<boolean>
  declare yearDigits: CreationOptional<number>
  declare sequenceDigits: CreationOptional<number>
  declare resetYearly: CreationOptional<boolean>
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

IdSequenceConfig.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  label: { type: DataTypes.STRING(150), allowNull: false },
  prefix: { type: DataTypes.STRING(20), allowNull: true },
  separator: { type: DataTypes.STRING(5), defaultValue: '/', field: 'separator' },
  includeYear: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'include_year' },
  yearDigits: { type: DataTypes.SMALLINT, defaultValue: 2, field: 'year_digits' },
  sequenceDigits: { type: DataTypes.SMALLINT, defaultValue: 5, field: 'sequence_digits' },
  resetYearly: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'reset_yearly' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'id_sequence_configs',
  timestamps: false,
})

export class IdSequenceCounter extends Model<InferAttributes<IdSequenceCounter>, InferCreationAttributes<IdSequenceCounter>> {
  declare id: CreationOptional<string>
  declare configId: string
  declare year: number | null
  declare period: string | null
  declare lastValue: CreationOptional<number>
}

IdSequenceCounter.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  configId: { type: DataTypes.UUID, allowNull: false, field: 'config_id' },
  year: { type: DataTypes.SMALLINT, allowNull: true },
  period: { type: DataTypes.STRING(10), allowNull: true },
  lastValue: { type: DataTypes.INTEGER, defaultValue: 0, field: 'last_value' },
}, {
  sequelize,
  tableName: 'id_sequence_counters',
  timestamps: false,
})
