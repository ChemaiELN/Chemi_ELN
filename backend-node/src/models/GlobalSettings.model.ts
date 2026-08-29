import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class GlobalSettings extends Model<InferAttributes<GlobalSettings>, InferCreationAttributes<GlobalSettings>> {
  declare id: CreationOptional<number>
  declare authType: string | null
  declare lockUserAfterXAttempts: CreationOptional<number>
  declare passwordExpiryDays: CreationOptional<number>
  declare maxImageKb: CreationOptional<number>
  declare maxAttachmentKb: CreationOptional<number>
  declare experimentsPerNotebook: CreationOptional<number>
  declare notebooksPerProject: CreationOptional<number>
  declare searchLimit: CreationOptional<number>
  declare qaRole: string | null
  declare smtpHost: string | null
  declare smtpPort: number | null
  declare smtpFromAddress: string | null
  declare smtpUsername: string | null
  declare smtpPassword: string | null
  declare enableEmailNotifications: CreationOptional<boolean>
  declare enableSecurityQuestions: CreationOptional<boolean>
}

GlobalSettings.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 1 },
  authType: { type: DataTypes.STRING(50), allowNull: true, field: 'auth_type' },
  lockUserAfterXAttempts: { type: DataTypes.INTEGER, defaultValue: 5, field: 'lock_user_after_x_attempts' },
  passwordExpiryDays: { type: DataTypes.INTEGER, defaultValue: 90, field: 'password_expiry_days' },
  maxImageKb: { type: DataTypes.INTEGER, defaultValue: 2048, field: 'max_image_kb' },
  maxAttachmentKb: { type: DataTypes.INTEGER, defaultValue: 51200, field: 'max_attachment_kb' },
  experimentsPerNotebook: { type: DataTypes.INTEGER, defaultValue: 999, field: 'experiments_per_notebook' },
  notebooksPerProject: { type: DataTypes.INTEGER, defaultValue: 999, field: 'notebooks_per_project' },
  searchLimit: { type: DataTypes.INTEGER, defaultValue: 100, field: 'search_limit' },
  qaRole: { type: DataTypes.STRING(20), allowNull: true, field: 'qa_role' },
  smtpHost: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_host' },
  smtpPort: { type: DataTypes.INTEGER, allowNull: true, field: 'smtp_port' },
  smtpFromAddress: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_from_address' },
  smtpUsername: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_username' },
  smtpPassword: { type: DataTypes.STRING(255), allowNull: true, field: 'smtp_password' },
  enableEmailNotifications: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'enable_email_notifications' },
  enableSecurityQuestions: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'enable_security_questions' },
}, {
  sequelize,
  tableName: 'global_settings',
  timestamps: false,
})
