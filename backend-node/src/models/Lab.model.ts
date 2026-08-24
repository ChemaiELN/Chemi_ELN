import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Lab extends Model<InferAttributes<Lab>, InferCreationAttributes<Lab>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare description: string | null
  declare departmentId: string
  declare isActive: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare department?: NonAttribute<unknown>
}

Lab.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: true },
  departmentId: { type: DataTypes.UUID, allowNull: false, field: 'department_id' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'labs',
  timestamps: false,
})

// Join table for the many-to-many User <-> Lab assignment (users can now belong
// to more than one lab, e.g. assigned from the "Add User to Department" form).
export class UserLab extends Model<InferAttributes<UserLab>, InferCreationAttributes<UserLab>> {
  declare userId: string
  declare labId: string
}
UserLab.init({
  userId: { type: DataTypes.UUID, primaryKey: true, field: 'user_id' },
  labId: { type: DataTypes.UUID, primaryKey: true, field: 'lab_id' },
}, { sequelize, tableName: 'user_labs', timestamps: false })
