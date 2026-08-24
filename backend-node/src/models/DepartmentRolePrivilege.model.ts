import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

/**
 * Per-(department, role) operation grants for module privileges — see
 * shared/privilegeCatalog.ts for the keys and shared/deptPrivileges.ts for
 * resolution.
 *
 * Deliberately separate from `role_privileges` (RolePrivilege), which holds the
 * coarse role-only admin grants. That table's `department_id` is nullable, and a
 * unique constraint spanning a nullable column is unreliable in Postgres
 * (NULL != NULL, so duplicates slip through). Keeping departmental grants here
 * lets the uniqueness be a real NOT NULL composite constraint.
 */
export class DepartmentRolePrivilege extends Model<
  InferAttributes<DepartmentRolePrivilege>,
  InferCreationAttributes<DepartmentRolePrivilege>
> {
  declare id: CreationOptional<string>
  declare departmentId: string
  declare roleId: string
  declare privilegeKey: string
  declare isGranted: boolean
  declare updatedBy: string | null
  declare updatedAt: CreationOptional<Date>
}

DepartmentRolePrivilege.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  departmentId: { type: DataTypes.UUID, allowNull: false, field: 'department_id' },
  roleId: { type: DataTypes.UUID, allowNull: false, field: 'role_id' },
  privilegeKey: { type: DataTypes.STRING(100), allowNull: false, field: 'privilege_key' },
  isGranted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_granted' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'department_role_privileges',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['department_id', 'role_id', 'privilege_key'] },
    { fields: ['department_id', 'role_id'] },
  ],
})
