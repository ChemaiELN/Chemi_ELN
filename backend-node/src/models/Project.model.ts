import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute } from 'sequelize'
import { sequelize } from '../database/connection'

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare productName: string | null
  declare inHouseProjectId: string | null
  declare projectType: string | null
  declare market: string | null
  declare departmentId: string | null
  declare managerId: string | null
  declare createdBy: string | null
  declare startDate: Date | null
  declare targetDate: Date | null
  declare status: string
  declare description: string | null
  declare objective: string | null
  declare observation: string | null
  declare remarks: string | null
  declare customer: string | null
  declare adcCode: string | null
  declare targetAntigen: string | null
  declare antibodyClone: string | null
  declare payload: string | null
  declare linker: string | null
  declare targetDar: string | null
  declare projectStage: string | null
  declare qaReviewRequired: CreationOptional<boolean>
  declare oelBand: string | null
  declare containmentCategory: string | null
  declare gmpNonGmp: string | null
  declare regulatoryObservations: string | null
  declare schemeData: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare members?: NonAttribute<unknown[]>
}

Project.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  productName: { type: DataTypes.STRING(255), allowNull: true, field: 'product_name' },
  inHouseProjectId: { type: DataTypes.STRING(100), allowNull: true, field: 'in_house_project_id' },
  projectType: { type: DataTypes.STRING(50), allowNull: true, field: 'project_type' },
  market: { type: DataTypes.STRING(50), allowNull: true },
  departmentId: { type: DataTypes.UUID, allowNull: true, field: 'department_id' },
  managerId: { type: DataTypes.UUID, allowNull: true, field: 'manager_id' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  startDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'start_date' },
  targetDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'target_date' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ACTIVE' },
  description: { type: DataTypes.TEXT, allowNull: true },
  objective: { type: DataTypes.TEXT, allowNull: true },
  observation: { type: DataTypes.TEXT, allowNull: true },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  customer: { type: DataTypes.STRING(255), allowNull: true },
  adcCode: { type: DataTypes.STRING(100), allowNull: true, field: 'adc_code' },
  targetAntigen: { type: DataTypes.STRING(255), allowNull: true, field: 'target_antigen' },
  antibodyClone: { type: DataTypes.STRING(255), allowNull: true, field: 'antibody_clone' },
  payload: { type: DataTypes.STRING(255), allowNull: true },
  linker: { type: DataTypes.STRING(255), allowNull: true },
  targetDar: { type: DataTypes.STRING(50), allowNull: true, field: 'target_dar' },
  projectStage: { type: DataTypes.STRING(50), allowNull: true, field: 'project_stage' },
  qaReviewRequired: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'qa_review_required' },
  oelBand: { type: DataTypes.STRING(100), allowNull: true, field: 'oel_band' },
  containmentCategory: { type: DataTypes.STRING(100), allowNull: true, field: 'containment_category' },
  gmpNonGmp: { type: DataTypes.STRING(20), allowNull: true, field: 'gmp_non_gmp' },
  regulatoryObservations: { type: DataTypes.TEXT, allowNull: true, field: 'regulatory_observations' },
  schemeData: { type: DataTypes.TEXT, allowNull: true, field: 'scheme_data' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'projects',
  timestamps: false,
})

export class ProjectCodeCounter extends Model<InferAttributes<ProjectCodeCounter>, InferCreationAttributes<ProjectCodeCounter>> {
  declare year: string
  declare lastSeq: number
}

ProjectCodeCounter.init({
  year: { type: DataTypes.STRING(2), primaryKey: true },
  lastSeq: { type: DataTypes.INTEGER, defaultValue: 30000, field: 'last_seq' },
}, {
  sequelize,
  tableName: 'project_code_counter',
  timestamps: false,
})

export class ProjectUser extends Model<InferAttributes<ProjectUser>, InferCreationAttributes<ProjectUser>> {
  declare projectId: string
  declare userId: string
  declare role: string | null
  declare addedAt: CreationOptional<Date>
  declare addedBy: string | null
}

ProjectUser.init({
  projectId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: 'project_id' },
  userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true, field: 'user_id' },
  role: { type: DataTypes.STRING(50), allowNull: true },
  addedAt: { type: DataTypes.DATE, field: 'added_at' },
  addedBy: { type: DataTypes.UUID, allowNull: true, field: 'added_by' },
}, {
  sequelize,
  tableName: 'project_users',
  timestamps: false,
})

export class Route extends Model<InferAttributes<Route>, InferCreationAttributes<Route>> {
  declare id: CreationOptional<string>
  declare projectId: string
  declare code: string | null
  declare name: string
  declare description: string | null
  declare sortOrder: number | null
  declare status: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

Route.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  code: { type: DataTypes.STRING(10), allowNull: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.STRING(500), allowNull: true },
  sortOrder: { type: DataTypes.SMALLINT, allowNull: true, field: 'sort_order' },
  status: { type: DataTypes.STRING(20), allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'routes',
  timestamps: false,
})

export class ProjectAttachment extends Model<InferAttributes<ProjectAttachment>, InferCreationAttributes<ProjectAttachment>> {
  declare id: CreationOptional<string>
  declare projectId: string
  declare filename: string
  declare filePath: string
  declare fileSize: number | null
  declare fileType: string | null
  declare comments: string | null
  declare uploadedBy: string | null
  declare uploadedAt: CreationOptional<Date>
}

ProjectAttachment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  filename: { type: DataTypes.STRING(255), allowNull: false },
  filePath: { type: DataTypes.STRING(500), allowNull: false, field: 'file_path' },
  fileSize: { type: DataTypes.BIGINT, allowNull: true, field: 'file_size' },
  fileType: { type: DataTypes.STRING(50), allowNull: true, field: 'file_type' },
  comments: { type: DataTypes.TEXT, allowNull: true },
  uploadedBy: { type: DataTypes.UUID, allowNull: true, field: 'uploaded_by' },
  uploadedAt: { type: DataTypes.DATE, field: 'uploaded_at' },
}, {
  sequelize,
  tableName: 'project_attachments',
  timestamps: false,
})

export class ProjectRiskAssessment extends Model<InferAttributes<ProjectRiskAssessment>, InferCreationAttributes<ProjectRiskAssessment>> {
  declare id: CreationOptional<string>
  declare projectId: string
  declare assessmentId: string | null
  declare assessmentType: string | null
  declare lastReviewed: Date | null
  declare reviewedBy: string | null
  declare overallRiskLevel: string | null
  declare status: string | null
  declare additionalNotes: string | null
  declare observations: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

ProjectRiskAssessment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  projectId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'project_id' },
  assessmentId: { type: DataTypes.STRING, allowNull: true, field: 'assessment_id' },
  assessmentType: { type: DataTypes.STRING, allowNull: true, field: 'assessment_type' },
  lastReviewed: { type: DataTypes.DATE, allowNull: true, field: 'last_reviewed' },
  reviewedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'reviewed_by' },
  overallRiskLevel: { type: DataTypes.STRING(20), allowNull: true, field: 'overall_risk_level' },
  status: { type: DataTypes.STRING(30), allowNull: true },
  additionalNotes: { type: DataTypes.TEXT, allowNull: true, field: 'additional_notes' },
  observations: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, {
  sequelize,
  tableName: 'project_risk_assessments',
  timestamps: false,
})

export class ProjectRiskRow extends Model<InferAttributes<ProjectRiskRow>, InferCreationAttributes<ProjectRiskRow>> {
  declare id: CreationOptional<string>
  declare assessmentId: string
  declare sortOrder: number | null
  declare processStep: string | null
  declare failureMode: string | null
  declare severity: number | null
  declare occurrence: number | null
  declare detection: number | null
  declare mitigation: string | null
  declare createdAt: CreationOptional<Date>
}

ProjectRiskRow.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  assessmentId: { type: DataTypes.UUID, allowNull: false, field: 'assessment_id' },
  sortOrder: { type: DataTypes.INTEGER, allowNull: true, field: 'sort_order' },
  processStep: { type: DataTypes.TEXT, allowNull: true, field: 'process_step' },
  failureMode: { type: DataTypes.TEXT, allowNull: true, field: 'failure_mode' },
  severity: { type: DataTypes.SMALLINT, allowNull: true },
  occurrence: { type: DataTypes.SMALLINT, allowNull: true },
  detection: { type: DataTypes.SMALLINT, allowNull: true },
  mitigation: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, {
  sequelize,
  tableName: 'project_risk_rows',
  timestamps: false,
})
