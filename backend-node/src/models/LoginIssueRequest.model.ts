import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class LoginIssueRequest extends Model<InferAttributes<LoginIssueRequest>, InferCreationAttributes<LoginIssueRequest>> {
  declare id: CreationOptional<string>
  declare username: string
  declare userId: string | null
  declare issueType: string
  declare description: string | null
  declare status: CreationOptional<string>
  declare resolvedBy: string | null
  declare resolvedAt: Date | null
  declare createdAt: CreationOptional<Date>

  declare user?: NonAttribute<unknown>
  declare resolver?: NonAttribute<unknown>
}

LoginIssueRequest.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  username: { type: DataTypes.STRING(100), allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
  issueType: { type: DataTypes.STRING(20), allowNull: false, field: 'issue_type' },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
  resolvedBy: { type: DataTypes.UUID, allowNull: true, field: 'resolved_by' },
  resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, { sequelize, tableName: 'login_issue_requests', timestamps: false })
