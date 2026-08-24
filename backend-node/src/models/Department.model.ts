import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Department extends Model<InferAttributes<Department>, InferCreationAttributes<Department>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare roles?: NonAttribute<unknown[]>
}

Department.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'departments',
  timestamps: false,
})
