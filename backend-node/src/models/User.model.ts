import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare username: string
  declare empNo: string | null
  declare email: string | null
  declare passwordHash: string
  declare roleId: string | null
  declare departmentId: string | null
  declare labId: string | null
  declare failedLoginCount: CreationOptional<number>
  declare lockedUntil: Date | null
  declare tokenVersion: CreationOptional<number>
  declare mustResetPassword: CreationOptional<boolean>
  declare passwordChangedAt: Date | null
  declare allowSettingsUpdate: CreationOptional<boolean>
  declare dashboardReference: string | null
  declare isActive: CreationOptional<boolean>
  declare title: string | null
  declare firstName: string | null
  declare middleInitials: string | null
  declare lastName: string | null
  declare displayName: string | null
  declare designation: string | null
  declare contactNo: string | null
  declare jobDescriptionFile: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare role?: NonAttribute<unknown>
  declare department?: NonAttribute<unknown>
  declare lab?: NonAttribute<unknown>
}

User.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  empNo: { type: DataTypes.STRING(50), allowNull: true, unique: true, field: 'emp_no' },
  email: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
  roleId: { type: DataTypes.UUID, allowNull: true, field: 'role_id' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  labId: { type: DataTypes.UUID, allowNull: true, field: 'lab_id' },
  failedLoginCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'failed_login_count' },
  lockedUntil: { type: DataTypes.DATE, allowNull: true, field: 'locked_until' },
  tokenVersion: { type: DataTypes.INTEGER, defaultValue: 1, field: 'token_version' },
  mustResetPassword: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'must_reset_password' },
  passwordChangedAt: { type: DataTypes.DATE, allowNull: true, field: 'password_changed_at' },
  allowSettingsUpdate: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'allow_settings_update' },
  dashboardReference: { type: DataTypes.STRING(255), allowNull: true, field: 'dashboard_reference' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  title: { type: DataTypes.STRING(20), allowNull: true },
  firstName: { type: DataTypes.STRING(100), allowNull: true, field: 'first_name' },
  middleInitials: { type: DataTypes.STRING(20), allowNull: true, field: 'middle_initials' },
  lastName: { type: DataTypes.STRING(100), allowNull: true, field: 'last_name' },
  displayName: { type: DataTypes.STRING(150), allowNull: true, unique: true, field: 'display_name' },
  designation: { type: DataTypes.STRING(150), allowNull: true },
  contactNo: { type: DataTypes.STRING(30), allowNull: true, field: 'contact_no' },
  jobDescriptionFile: { type: DataTypes.STRING(255), allowNull: true, field: 'job_description_file' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'users',
  timestamps: false,
})
