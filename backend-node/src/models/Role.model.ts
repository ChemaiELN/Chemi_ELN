import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>

  // associations
  declare users?: NonAttribute<unknown[]>
}

Role.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'roles',
  timestamps: false,
  underscored: false,
})
