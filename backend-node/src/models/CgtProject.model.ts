import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

export class CgtProject extends Model<InferAttributes<CgtProject>, InferCreationAttributes<CgtProject>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare productName: string | null
  declare inHouseProjectId: string | null
  declare projectType: string | null
  declare market: string | null
  declare process: string | null
  declare createdBy: string | null
  declare managerId: string | null
  declare startDate: Date | null
  declare targetDate: Date | null
  declare status: string
  declare description: string | null
  declare objective: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CgtProject.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  productName: { type: DataTypes.STRING(255), allowNull: true, field: 'product_name' },
  inHouseProjectId: { type: DataTypes.STRING(100), allowNull: true, field: 'in_house_project_id' },
  projectType: { type: DataTypes.STRING(50), allowNull: true, field: 'project_type' },
  market: { type: DataTypes.STRING(50), allowNull: true },
  process: { type: DataTypes.STRING(50), allowNull: true },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  managerId: { type: DataTypes.UUID, allowNull: true, field: 'manager_id' },
  startDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'start_date' },
  targetDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'target_date' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
  description: { type: DataTypes.TEXT, allowNull: true },
  objective: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'cgt_projects',
  timestamps: false,
})

export class CgtProjectCodeCounter extends Model<InferAttributes<CgtProjectCodeCounter>, InferCreationAttributes<CgtProjectCodeCounter>> {
  declare year: string
  declare lastSeq: number
}

CgtProjectCodeCounter.init({
  year: { type: DataTypes.STRING(2), primaryKey: true },
  lastSeq: { type: DataTypes.INTEGER, defaultValue: 30000, field: 'last_seq' },
}, {
  sequelize,
  tableName: 'cgt_project_code_counter',
  timestamps: false,
})

export class CgtNotebook extends Model<InferAttributes<CgtNotebook>, InferCreationAttributes<CgtNotebook>> {
  declare id: CreationOptional<string>
  declare code: string
  declare title: string
  declare description: string | null
  declare cgtProjectId: string
  declare templateId: string | null
  declare templateSnapshot: object | null
  declare createdBy: string | null
  declare status: CreationOptional<string>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CgtNotebook.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: true },
  cgtProjectId: { type: DataTypes.UUID, allowNull: false, field: 'cgt_project_id' },
  templateId: { type: DataTypes.UUID, allowNull: true, field: 'template_id' },
  templateSnapshot: { type: DataTypes.JSONB, allowNull: true, field: 'template_snapshot' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  status: { type: DataTypes.STRING(20), defaultValue: 'ACTIVE' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'cgt_notebooks',
  timestamps: false,
})

export class CgtNotebookPermission extends Model<InferAttributes<CgtNotebookPermission>, InferCreationAttributes<CgtNotebookPermission>> {
  declare id: CreationOptional<string>
  declare cgtNotebookId: string
  declare userId: string
  declare canView: CreationOptional<boolean>
  declare canEdit: CreationOptional<boolean>
  declare canSubmit: CreationOptional<boolean>
  declare grantedBy: string | null
  declare grantedAt: CreationOptional<Date>
}

CgtNotebookPermission.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cgtNotebookId: { type: DataTypes.UUID, allowNull: false, field: 'cgt_notebook_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  canView: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'can_view' },
  canEdit: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_edit' },
  canSubmit: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'can_submit' },
  grantedBy: { type: DataTypes.UUID, allowNull: true, field: 'granted_by' },
  // NOT NULL in the DB with no server-side default — see Notebook.model.ts.
  grantedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'granted_at' },
}, {
  sequelize,
  tableName: 'cgt_notebook_permissions',
  timestamps: false,
})

export class CgtExperiment extends Model<InferAttributes<CgtExperiment>, InferCreationAttributes<CgtExperiment>> {
  declare id: CreationOptional<string>
  declare cgtNotebookId: string
  declare cgtProjectId: string | null
  declare baseCode: string
  declare version: CreationOptional<number>
  declare fullCode: string
  declare title: string
  declare screenKey: string | null
  declare sectionKey: string | null
  declare data: object | null
  declare observations: string | null
  declare conclusion: string | null
  declare status: CreationOptional<string>
  declare isLatestVersion: CreationOptional<boolean>
  declare createdBy: string | null
  declare submittedBy: string | null
  declare approvedBy: string | null
  declare rejectedBy: string | null
  declare scientistSignedBy: string | null
  declare submittedAt: Date | null
  declare approvedAt: Date | null
  declare rejectedAt: Date | null
  declare rejectionReason: string | null
  declare scientistSignedAt: Date | null
  declare scientistSignReason: string | null
  declare frozenAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

CgtExperiment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cgtNotebookId: { type: DataTypes.UUID, allowNull: false, field: 'cgt_notebook_id' },
  cgtProjectId: { type: DataTypes.UUID, allowNull: true, field: 'cgt_project_id' },
  baseCode: { type: DataTypes.STRING(50), allowNull: false, field: 'base_code' },
  version: { type: DataTypes.SMALLINT, defaultValue: 1 },
  fullCode: { type: DataTypes.STRING(60), allowNull: false, unique: true, field: 'full_code' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  screenKey: { type: DataTypes.STRING(100), allowNull: true, field: 'screen_key' },
  sectionKey: { type: DataTypes.STRING(100), allowNull: true, field: 'section_key' },
  data: { type: DataTypes.JSONB, allowNull: true },
  observations: { type: DataTypes.TEXT, allowNull: true },
  conclusion: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(20), defaultValue: 'DRAFT' },
  isLatestVersion: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_latest_version' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  submittedBy: { type: DataTypes.UUID, allowNull: true, field: 'submitted_by' },
  approvedBy: { type: DataTypes.UUID, allowNull: true, field: 'approved_by' },
  rejectedBy: { type: DataTypes.UUID, allowNull: true, field: 'rejected_by' },
  scientistSignedBy: { type: DataTypes.UUID, allowNull: true, field: 'scientist_signed_by' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  rejectedAt: { type: DataTypes.DATE, allowNull: true, field: 'rejected_at' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  scientistSignedAt: { type: DataTypes.DATE, allowNull: true, field: 'scientist_signed_at' },
  scientistSignReason: { type: DataTypes.STRING(500), allowNull: true, field: 'scientist_sign_reason' },
  frozenAt: { type: DataTypes.DATE, allowNull: true, field: 'frozen_at' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'cgt_experiments',
  timestamps: false,
})

export class CgtExperimentAssignment extends Model<InferAttributes<CgtExperimentAssignment>, InferCreationAttributes<CgtExperimentAssignment>> {
  declare id: CreationOptional<string>
  declare cgtExperimentId: string
  declare userId: string
  declare grantedBy: string | null
  declare grantedAt: CreationOptional<Date>
}

CgtExperimentAssignment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cgtExperimentId: { type: DataTypes.UUID, allowNull: false, field: 'cgt_experiment_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  grantedBy: { type: DataTypes.UUID, allowNull: true, field: 'granted_by' },
  grantedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'granted_at' },
}, {
  sequelize,
  tableName: 'cgt_experiment_assignments',
  timestamps: false,
})

