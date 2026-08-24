import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class DepartmentRoleMapping extends Model<InferAttributes<DepartmentRoleMapping>, InferCreationAttributes<DepartmentRoleMapping>> {
  declare id: CreationOptional<string>
  declare departmentId: string
  declare roleId: string
  declare createdAt: CreationOptional<Date>
}

DepartmentRoleMapping.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  departmentId: { type: DataTypes.UUID, allowNull: false, field: 'department_id' },
  roleId: { type: DataTypes.UUID, allowNull: false, field: 'role_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'department_role_mapping',
  timestamps: false,
})

export class RolePrivilege extends Model<InferAttributes<RolePrivilege>, InferCreationAttributes<RolePrivilege>> {
  declare id: CreationOptional<string>
  declare roleId: string
  declare departmentId: string | null
  declare privilegeKey: string
  declare isGranted: boolean
  declare updatedBy: string | null
  declare updatedAt: Date | null
}

RolePrivilege.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  roleId: { type: DataTypes.UUID, allowNull: false, field: 'role_id' },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  privilegeKey: { type: DataTypes.STRING(50), allowNull: false, field: 'privilege_key' },
  isGranted: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_granted' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'role_privileges',
  timestamps: false,
})

export class UserSecurityQuestion extends Model<InferAttributes<UserSecurityQuestion>, InferCreationAttributes<UserSecurityQuestion>> {
  declare id: CreationOptional<string>
  declare userId: string
  declare questionIndex: number
  declare answerHash: string
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

UserSecurityQuestion.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  questionIndex: { type: DataTypes.INTEGER, allowNull: false, field: 'question_index' },
  answerHash: { type: DataTypes.STRING(255), allowNull: false, field: 'answer_hash' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'user_security_questions',
  timestamps: false,
})
