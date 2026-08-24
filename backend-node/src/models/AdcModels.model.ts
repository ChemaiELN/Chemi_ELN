import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// ── ADC Objective ─────────────────────────────────────────────────────────────
export class AdcObjective extends Model<InferAttributes<AdcObjective>, InferCreationAttributes<AdcObjective>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare studyPurpose: string | null
  declare hypothesis: string | null
  declare successCriteria: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
AdcObjective.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'experiment_id' },
  studyPurpose: { type: DataTypes.TEXT, allowNull: true, field: 'study_purpose' },
  hypothesis: { type: DataTypes.TEXT, allowNull: true },
  successCriteria: { type: DataTypes.TEXT, allowNull: true, field: 'success_criteria' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'adc_objective', timestamps: false })

// ── ADC Regulatory Classification ─────────────────────────────────────────────
export class AdcRegulatoryClassification extends Model<InferAttributes<AdcRegulatoryClassification>, InferCreationAttributes<AdcRegulatoryClassification>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare oelBand: string | null
  declare containmentCategory: string | null
  declare gmpClassification: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
AdcRegulatoryClassification.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'experiment_id' },
  oelBand: { type: DataTypes.STRING(50), allowNull: true, field: 'oel_band' },
  containmentCategory: { type: DataTypes.STRING(100), allowNull: true, field: 'containment_category' },
  gmpClassification: { type: DataTypes.STRING(50), allowNull: true, field: 'gmp_classification' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'adc_regulatory_classification', timestamps: false })

// ── ADC Risk Assessment ───────────────────────────────────────────────────────
export class AdcRiskAssessment extends Model<InferAttributes<AdcRiskAssessment>, InferCreationAttributes<AdcRiskAssessment>> {
  declare id: CreationOptional<string>
  declare experimentId: string
  declare assessmentId: string | null
  declare assessmentType: string | null
  declare lastReviewed: Date | null
  declare reviewedBy: string | null
  declare overallRiskLevel: string | null
  declare status: CreationOptional<string>
  declare additionalNotes: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
AdcRiskAssessment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  experimentId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'experiment_id' },
  assessmentId: { type: DataTypes.STRING(100), allowNull: true, field: 'assessment_id' },
  assessmentType: { type: DataTypes.STRING(50), allowNull: true, field: 'assessment_type' },
  lastReviewed: { type: DataTypes.DATEONLY, allowNull: true, field: 'last_reviewed' },
  reviewedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'reviewed_by' },
  overallRiskLevel: { type: DataTypes.STRING(20), allowNull: true, field: 'overall_risk_level' },
  status: { type: DataTypes.STRING(30), defaultValue: 'Draft' },
  additionalNotes: { type: DataTypes.TEXT, allowNull: true, field: 'additional_notes' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'adc_risk_assessment', timestamps: false })

// ── ADC Risk Item ─────────────────────────────────────────────────────────────
export class AdcRiskItem extends Model<InferAttributes<AdcRiskItem>, InferCreationAttributes<AdcRiskItem>> {
  declare id: CreationOptional<number>
  declare riskAssessmentId: string
  declare seqNo: CreationOptional<number>
  declare processStep: string | null
  declare failureMode: string | null
  declare severity: number | null
  declare occurrence: number | null
  declare detection: number | null
  declare rpn: number | null
  declare mitigation: string | null
}
AdcRiskItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  riskAssessmentId: { type: DataTypes.UUID, allowNull: false, field: 'risk_assessment_id' },
  seqNo: { type: DataTypes.SMALLINT, defaultValue: 0, field: 'seq_no' },
  processStep: { type: DataTypes.STRING(300), allowNull: true, field: 'process_step' },
  failureMode: { type: DataTypes.STRING(300), allowNull: true, field: 'failure_mode' },
  severity: { type: DataTypes.SMALLINT, allowNull: true },
  occurrence: { type: DataTypes.SMALLINT, allowNull: true },
  detection: { type: DataTypes.SMALLINT, allowNull: true },
  rpn: { type: DataTypes.INTEGER, allowNull: true },
  mitigation: { type: DataTypes.TEXT, allowNull: true },
}, { sequelize, tableName: 'adc_risk_item', timestamps: false })
