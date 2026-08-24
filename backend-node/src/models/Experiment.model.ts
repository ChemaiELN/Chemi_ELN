import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Experiment extends Model<InferAttributes<Experiment>, InferCreationAttributes<Experiment>> {
  declare id: CreationOptional<string>
  declare notebookId: string
  declare projectId: string | null
  declare baseCode: string
  declare version: CreationOptional<number>
  declare fullCode: string
  declare title: string
  declare screenKey: string | null
  declare sectionKey: string | null
  declare data: object | null
  declare observations: string | null
  declare conclusion: string | null
  declare disposition: string | null
  declare lpDisposition: string | null
  declare schemeMol: string | null
  declare status: CreationOptional<string>
  declare isLatestVersion: CreationOptional<boolean>
  declare parentId: string | null
  declare linkedPreliminaryId: string | null
  declare revisionNote: string | null
  declare createdBy: string | null
  declare submittedBy: string | null
  declare approvedBy: string | null
  declare rejectedBy: string | null
  declare voidedBy: string | null
  declare scientistSignedBy: string | null
  declare submittedAt: Date | null
  declare approvedAt: Date | null
  declare rejectedAt: Date | null
  declare voidedAt: Date | null
  declare scientistSignedAt: Date | null
  declare rejectionReason: string | null
  declare voidReason: string | null
  declare scientistSignReason: string | null
  // Set when the owning notebook is closed (while this experiment isn't
  // yet APPROVED) or deactivated. Blocks every mutation — submit, approve,
  // reject, unlock, void, section saves/signatures — while set. Cleared on
  // notebook reopen; never cleared once the notebook is deactivated.
  declare frozenAt: Date | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare assignments?: NonAttribute<unknown[]>
  declare files?: NonAttribute<unknown[]>
}

Experiment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  notebookId: { type: DataTypes.UUID, allowNull: false, field: 'notebook_id' },
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  baseCode: { type: DataTypes.STRING(50), allowNull: false, field: 'base_code' },
  version: { type: DataTypes.SMALLINT, defaultValue: 1 },
  fullCode: { type: DataTypes.STRING(60), allowNull: false, unique: true, field: 'full_code' },
  title: { type: DataTypes.STRING(255), allowNull: false },
  screenKey: { type: DataTypes.STRING(100), allowNull: true, field: 'screen_key' },
  sectionKey: { type: DataTypes.STRING(100), allowNull: true, field: 'section_key' },
  data: { type: DataTypes.JSONB, allowNull: true },
  observations: { type: DataTypes.TEXT, allowNull: true },
  conclusion: { type: DataTypes.TEXT, allowNull: true },
  disposition: { type: DataTypes.STRING(100), allowNull: true },
  lpDisposition: { type: DataTypes.STRING(100), allowNull: true, field: 'lp_disposition' },
  schemeMol: { type: DataTypes.TEXT, allowNull: true, field: 'scheme_mol' },
  status: { type: DataTypes.STRING(20), defaultValue: 'DRAFT' },
  isLatestVersion: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_latest_version' },
  parentId: { type: DataTypes.UUID, allowNull: true, field: 'parent_id' },
  linkedPreliminaryId: { type: DataTypes.UUID, allowNull: true, field: 'linked_preliminary_id' },
  revisionNote: { type: DataTypes.TEXT, allowNull: true, field: 'revision_note' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  submittedBy: { type: DataTypes.UUID, allowNull: true, field: 'submitted_by' },
  approvedBy: { type: DataTypes.UUID, allowNull: true, field: 'approved_by' },
  rejectedBy: { type: DataTypes.UUID, allowNull: true, field: 'rejected_by' },
  voidedBy: { type: DataTypes.UUID, allowNull: true, field: 'voided_by' },
  scientistSignedBy: { type: DataTypes.UUID, allowNull: true, field: 'scientist_signed_by' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  rejectedAt: { type: DataTypes.DATE, allowNull: true, field: 'rejected_at' },
  voidedAt: { type: DataTypes.DATE, allowNull: true, field: 'voided_at' },
  scientistSignedAt: { type: DataTypes.DATE, allowNull: true, field: 'scientist_signed_at' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  voidReason: { type: DataTypes.TEXT, allowNull: true, field: 'void_reason' },
  scientistSignReason: { type: DataTypes.STRING(200), allowNull: true, field: 'scientist_sign_reason' },
  frozenAt: { type: DataTypes.DATE, allowNull: true, field: 'frozen_at' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'experiments',
  timestamps: false,
})

export class ExperimentAssignment extends Model<InferAttributes<ExperimentAssignment>, InferCreationAttributes<ExperimentAssignment>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare userId: string
  declare grantedBy: string | null
  declare grantedAt: CreationOptional<Date>
}

ExperimentAssignment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, field: 'experiment_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  grantedBy: { type: DataTypes.UUID, allowNull: true, field: 'granted_by' },
  // NOT NULL in the DB with no server-side default — see Notebook.model.ts.
  grantedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: 'granted_at' },
}, {
  sequelize,
  tableName: 'experiment_assignments',
  timestamps: false,
})

export class ExperimentFile extends Model<InferAttributes<ExperimentFile>, InferCreationAttributes<ExperimentFile>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare sectionKey: string | null
  declare filename: string
  declare filePath: string
  declare fileSize: number | null
  declare fileType: string | null
  declare uploadedBy: string | null
  declare uploadedAt: CreationOptional<Date>
}

ExperimentFile.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, field: 'experiment_id' },
  sectionKey: { type: DataTypes.STRING(100), allowNull: true, field: 'section_key' },
  filename: { type: DataTypes.STRING(255), allowNull: false },
  filePath: { type: DataTypes.STRING(500), allowNull: false, field: 'file_path' },
  fileSize: { type: DataTypes.BIGINT, allowNull: true, field: 'file_size' },
  fileType: { type: DataTypes.STRING(50), allowNull: true, field: 'file_type' },
  uploadedBy: { type: DataTypes.UUID, allowNull: true, field: 'uploaded_by' },
  uploadedAt: { type: DataTypes.DATE, field: 'uploaded_at' },
}, {
  sequelize,
  tableName: 'experiment_files',
  timestamps: false,
})

export class ExperimentAtrRequest extends Model<InferAttributes<ExperimentAtrRequest>, InferCreationAttributes<ExperimentAtrRequest>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare atrNo: string
  declare sectionId: string | null
  declare sectionTitle: string | null
  declare dataSnapshot: object | null
  declare ardAtrFormId: string | null
  declare status: CreationOptional<string>
  declare raisedBy: string | null
  declare raisedAt: CreationOptional<Date>
  declare completedBy: string | null
  declare completedAt: Date | null
  declare resultNotes: string | null
}

ExperimentAtrRequest.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, field: 'experiment_id' },
  atrNo: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'atr_no' },
  sectionId: { type: DataTypes.STRING(100), allowNull: true, field: 'section_id' },
  sectionTitle: { type: DataTypes.STRING(255), allowNull: true, field: 'section_title' },
  dataSnapshot: { type: DataTypes.JSONB, allowNull: true, field: 'data_snapshot' },
  ardAtrFormId: { type: DataTypes.UUID, allowNull: true, field: 'ard_atr_form_id' },
  status: { type: DataTypes.STRING(20), defaultValue: 'PENDING' },
  raisedBy: { type: DataTypes.UUID, allowNull: true, field: 'raised_by' },
  raisedAt: { type: DataTypes.DATE, field: 'raised_at' },
  completedBy: { type: DataTypes.UUID, allowNull: true, field: 'completed_by' },
  completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  resultNotes: { type: DataTypes.TEXT, allowNull: true, field: 'result_notes' },
}, {
  sequelize,
  tableName: 'experiment_atr_requests',
  timestamps: false,
})

export class ExperimentReview extends Model<InferAttributes<ExperimentReview>, InferCreationAttributes<ExperimentReview>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare reviewerId: string
  declare assignedBy: string | null
  declare assignedAt: CreationOptional<Date>
  declare signedAt: Date | null
  declare signReason: string | null
  declare decision: string | null
}

ExperimentReview.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, field: 'experiment_id' },
  reviewerId: { type: DataTypes.UUID, allowNull: false, field: 'reviewer_id' },
  assignedBy: { type: DataTypes.UUID, allowNull: true, field: 'assigned_by' },
  assignedAt: { type: DataTypes.DATE, field: 'assigned_at' },
  signedAt: { type: DataTypes.DATE, allowNull: true, field: 'signed_at' },
  signReason: { type: DataTypes.STRING(200), allowNull: true, field: 'sign_reason' },
  decision: { type: DataTypes.STRING(20), allowNull: true },
}, {
  sequelize,
  tableName: 'experiment_reviews',
  timestamps: false,
})

export class ExperimentHistory extends Model<InferAttributes<ExperimentHistory>, InferCreationAttributes<ExperimentHistory>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare actorId: string | null
  declare action: string
  declare details: object | null
  declare createdAt: CreationOptional<Date>
}

ExperimentHistory.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, field: 'experiment_id' },
  actorId: { type: DataTypes.UUID, allowNull: true, field: 'actor_id' },
  action: { type: DataTypes.STRING(50), allowNull: false },
  details: { type: DataTypes.JSONB, allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'experiment_history',
  timestamps: false,
})
