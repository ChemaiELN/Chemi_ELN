import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize'
import { sequelize } from '../database/connection'

// ── ARD Settings ─────────────────────────────────────────────────────────────
// The friendly key/value/label attribute names are kept (routes and
// shared/ardSettings.ts depend on them) and mapped to the real setting_* columns.
// ard_settings has NO updated_at column, and setting_category is NOT NULL.
export class ArdSetting extends Model<InferAttributes<ArdSetting>, InferCreationAttributes<ArdSetting>> {
  declare id: CreationOptional<string>
  declare key: string
  declare value: string
  declare label: string
  declare category: CreationOptional<string>
  declare description: CreationOptional<string | null>
  declare valueType: CreationOptional<string>
}
ArdSetting.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  key: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'setting_key' },
  value: { type: DataTypes.TEXT, allowNull: false, defaultValue: '', field: 'setting_value' },
  label: { type: DataTypes.STRING, allowNull: false, defaultValue: '', field: 'setting_label' },
  category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'GENERAL', field: 'setting_category' },
  description: { type: DataTypes.TEXT, allowNull: true },
  valueType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'string', field: 'value_type' },
}, { sequelize, tableName: 'ard_settings', timestamps: false })

// ── ARD Techniques ────────────────────────────────────────────────────────────
// ard_techniques has no `description` column; `code` is NOT NULL and unique.
export class ArdTechnique extends Model<InferAttributes<ArdTechnique>, InferCreationAttributes<ArdTechnique>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
}
ArdTechnique.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  name: { type: DataTypes.STRING, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_techniques', timestamps: false })

// ── ARD Test Configurations ───────────────────────────────────────────────────
export class ArdTestConfiguration extends Model<InferAttributes<ArdTestConfiguration>, InferCreationAttributes<ArdTestConfiguration>> {
  declare id: CreationOptional<string>
  declare configCode: CreationOptional<string | null>
  declare techniqueCode: string
  declare techniqueName: string
  declare testType: string
  declare testSubtype: CreationOptional<string | null>
  declare resultParams: CreationOptional<any>
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare analysisTechnicalCode: CreationOptional<string | null>
  declare methodReference: CreationOptional<string | null>
}
ArdTestConfiguration.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  configCode: { type: DataTypes.STRING, allowNull: true, field: 'config_code' },
  techniqueCode: { type: DataTypes.STRING, allowNull: false, field: 'technique_code' },
  techniqueName: { type: DataTypes.STRING, allowNull: false, field: 'technique_name' },
  testType: { type: DataTypes.STRING, allowNull: false, field: 'test_type' },
  testSubtype: { type: DataTypes.STRING, allowNull: true, field: 'test_subtype' },
  resultParams: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'result_params' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  analysisTechnicalCode: { type: DataTypes.STRING, allowNull: true, field: 'analysis_technical_code' },
  methodReference: { type: DataTypes.STRING, allowNull: true, field: 'method_reference' },
}, { sequelize, tableName: 'ard_test_configurations', timestamps: false })

// ── ARD Test Groups ───────────────────────────────────────────────────────────
export class ArdTestGroup extends Model<InferAttributes<ArdTestGroup>, InferCreationAttributes<ArdTestGroup>> {
  declare id: CreationOptional<string>
  declare name: string
  declare description: string | null
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTestGroup.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_test_groups', timestamps: false })

// ── ARD Test Group Members ────────────────────────────────────────────────────
// Real columns are test_group_id / test_configuration_id. `testGroupId` matches what the
// routes already query; `testConfigId` keeps its shorter name and just maps correctly.
export class ArdTestGroupMember extends Model<InferAttributes<ArdTestGroupMember>, InferCreationAttributes<ArdTestGroupMember>> {
  declare id: CreationOptional<string>
  declare testGroupId: string
  declare testConfigId: string
  declare specOverrides: CreationOptional<any>
}
ArdTestGroupMember.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  testGroupId: { type: DataTypes.UUID, allowNull: false, field: 'test_group_id' },
  testConfigId: { type: DataTypes.UUID, allowNull: false, field: 'test_configuration_id' },
  specOverrides: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'spec_overrides' },
}, { sequelize, tableName: 'ard_test_group_members', timestamps: false })

// ── ARD Form Types ────────────────────────────────────────────────────────────
export class ArdFormType extends Model<InferAttributes<ArdFormType>, InferCreationAttributes<ArdFormType>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare description: CreationOptional<string | null>
  declare attributeLinks: CreationOptional<any>
  declare testGroupIds: CreationOptional<any>
  declare mandateCertification: CreationOptional<boolean>
  declare mandateBatchNo: CreationOptional<boolean>
  declare mandateSampleQty: CreationOptional<boolean>
  declare mandateQaSubmission: CreationOptional<boolean>
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare category: CreationOptional<string | null>
  declare allowPostApprovalChanges: CreationOptional<boolean>
}
ArdFormType.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  attributeLinks: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'attribute_links' },
  testGroupIds: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'test_group_ids' },
  mandateCertification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'mandate_certification' },
  mandateBatchNo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'mandate_batch_no' },
  mandateSampleQty: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'mandate_sample_qty' },
  mandateQaSubmission: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'mandate_qa_submission' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  category: { type: DataTypes.STRING, allowNull: true },
  allowPostApprovalChanges: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'allow_post_approval_changes' },
}, { sequelize, tableName: 'ard_form_types', timestamps: false })

// ── ARD Analyst Qualifications ────────────────────────────────────────────────
export class ArdAnalystQualification extends Model<InferAttributes<ArdAnalystQualification>, InferCreationAttributes<ArdAnalystQualification>> {
  declare id: CreationOptional<string>
  declare userId: string
  declare techniqueEntries: CreationOptional<any>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare validTill: CreationOptional<string | null>
  declare remarks: CreationOptional<string | null>
  declare approvalStatus: CreationOptional<string | null>
  declare approvedBy: CreationOptional<string | null>
  declare approvedAt: CreationOptional<Date | null>
}
ArdAnalystQualification.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  techniqueEntries: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'technique_entries' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  validTill: { type: DataTypes.STRING, allowNull: true, field: 'valid_till' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  approvalStatus: { type: DataTypes.STRING, allowNull: true, field: 'approval_status' },
  approvedBy: { type: DataTypes.STRING, allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
}, { sequelize, tableName: 'ard_analyst_qualifications', timestamps: false })

// ── ARD Teams ─────────────────────────────────────────────────────────────────
export class ArdTeam extends Model<InferAttributes<ArdTeam>, InferCreationAttributes<ArdTeam>> {
  declare id: CreationOptional<string>
  declare name: string
  declare description: string | null
  declare hodId: CreationOptional<string | null>
  declare tlId: CreationOptional<string | null>
  declare tlIds: CreationOptional<string[]>
  declare memberIds: CreationOptional<string[]>
  declare tlAnalystMap: object | null
  declare tlAnalystCanReview: CreationOptional<object>
  declare createdBy: CreationOptional<string | null>
  declare isActive: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTeam.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  hodId: { type: DataTypes.UUID, allowNull: true, field: 'hod_id' },
  tlId: { type: DataTypes.UUID, allowNull: true, field: 'tl_id' },
  tlIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'tl_ids' },
  memberIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'member_ids' },
  tlAnalystMap: { type: DataTypes.JSONB, allowNull: true, field: 'tl_analyst_map' },
  tlAnalystCanReview: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'tl_analyst_can_review' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_teams', timestamps: false })

// ── ARD ATR Forms ─────────────────────────────────────────────────────────────
export class ArdAtrForm extends Model<InferAttributes<ArdAtrForm>, InferCreationAttributes<ArdAtrForm>> {
  declare id: CreationOptional<string>
  declare formNo: string
  declare formTypeId: CreationOptional<string | null>
  declare formTypeName: string
  declare status: CreationOptional<string>
  declare projectCode: string
  declare productName: string
  declare qcRef: CreationOptional<string | null>
  declare assignedTl: string
  declare assignedTlId: CreationOptional<string | null>
  declare preapprovalNote: CreationOptional<string | null>
  declare mandateCertification: CreationOptional<boolean>
  declare schemePresent: CreationOptional<boolean>
  declare schemeMode: CreationOptional<string | null>
  declare formCategory: CreationOptional<string | null>
  declare associatedExpCodes: CreationOptional<string | null>
  declare referenceAtrFormId: CreationOptional<string | null>
  declare formOpen: CreationOptional<boolean>
  declare reassignRemarks: CreationOptional<string | null>
  declare withdrawRemarks: CreationOptional<string | null>
  declare certificationRemarks: CreationOptional<string | null>
  declare requestRemarks: CreationOptional<string | null>
  declare analysisRemarks: CreationOptional<string | null>
  declare clarifiedAt: CreationOptional<Date | null>
  declare createdBy: string
  declare createdById: CreationOptional<string | null>
  declare attributeValues: CreationOptional<any>
  declare clarifications: CreationOptional<any>
  declare certificationAttachment: CreationOptional<any | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare objectives: CreationOptional<string | null>
  declare qaReviewerId: CreationOptional<string | null>
  declare reportType: CreationOptional<string | null>
  declare originModule: CreationOptional<string>
  declare originProjectId: CreationOptional<string | null>
  declare originProjectCode: CreationOptional<string | null>
  declare originProjectName: CreationOptional<string | null>
  declare originNotebookId: CreationOptional<string | null>
  declare originNotebookCode: CreationOptional<string | null>
  declare originExperimentId: CreationOptional<string | null>
  declare originExperimentCode: CreationOptional<string | null>
  declare originSectionId: CreationOptional<string | null>
  declare originSectionTitle: CreationOptional<string | null>
  declare originSnapshot: CreationOptional<any | null>
  declare receivedById: CreationOptional<string | null>
  declare receivedAt: CreationOptional<Date | null>
  declare referenceExperimentId: CreationOptional<string | null>
  declare referenceExperimentCode: CreationOptional<string | null>
  declare certifiedBy: CreationOptional<string | null>
  declare certifiedAt: CreationOptional<Date | null>
  declare assignedTeamId: CreationOptional<string | null>
  declare raisedAt: CreationOptional<Date | null>
  declare qaApproveRemarks: CreationOptional<string | null>
  declare qaReworkHistory: CreationOptional<any | null>
  declare raisedStandalone: CreationOptional<boolean>
  declare currentOwner: CreationOptional<string | null>
  declare currentOwnerId: CreationOptional<string | null>
  declare approvedBy: CreationOptional<string | null>
  declare approvedById: CreationOptional<string | null>
  declare approvedAt: CreationOptional<Date | null>
  declare submittedAt: CreationOptional<Date | null>
  declare coaGeneratedBy: CreationOptional<string | null>
  declare coaGeneratedAt: CreationOptional<Date | null>
  declare lastUpdatedBy: CreationOptional<string | null>
  declare lastUpdatedById: CreationOptional<string | null>
  declare supportingDocs: CreationOptional<any | null>
  declare workflowHistory: CreationOptional<any | null>
}
ArdAtrForm.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  formNo: { type: DataTypes.STRING, allowNull: false, field: 'form_no' },
  formTypeId: { type: DataTypes.UUID, allowNull: true, field: 'form_type_id' },
  formTypeName: { type: DataTypes.STRING, allowNull: false, field: 'form_type_name' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'DRAFT' },
  projectCode: { type: DataTypes.STRING, allowNull: false, field: 'project_code' },
  productName: { type: DataTypes.STRING, allowNull: false, field: 'product_name' },
  qcRef: { type: DataTypes.STRING, allowNull: true, field: 'qc_ref' },
  assignedTl: { type: DataTypes.STRING, allowNull: false, field: 'assigned_tl' },
  assignedTlId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_tl_id' },
  preapprovalNote: { type: DataTypes.TEXT, allowNull: true, field: 'preapproval_note' },
  mandateCertification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'mandate_certification' },
  schemePresent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'scheme_present' },
  schemeMode: { type: DataTypes.STRING, allowNull: true, field: 'scheme_mode' },
  formCategory: { type: DataTypes.STRING, allowNull: true, field: 'form_category' },
  associatedExpCodes: { type: DataTypes.TEXT, allowNull: true, field: 'associated_exp_codes' },
  referenceAtrFormId: { type: DataTypes.UUID, allowNull: true, field: 'reference_atr_form_id' },
  formOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'form_open' },
  reassignRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'reassign_remarks' },
  withdrawRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'withdraw_remarks' },
  certificationRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'certification_remarks' },
  requestRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'request_remarks' },
  analysisRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'analysis_remarks' },
  clarifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'clarified_at' },
  createdBy: { type: DataTypes.STRING, allowNull: false, field: 'created_by' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  attributeValues: { type: DataTypes.JSON, allowNull: false, defaultValue: {}, field: 'attribute_values' },
  clarifications: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  certificationAttachment: { type: DataTypes.JSON, allowNull: true, defaultValue: [], field: 'certification_attachment' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  objectives: { type: DataTypes.TEXT, allowNull: true },
  qaReviewerId: { type: DataTypes.UUID, allowNull: true, field: 'qa_reviewer_id' },
  reportType: { type: DataTypes.STRING, allowNull: true, field: 'report_type' },
  originModule: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ARD', field: 'origin_module' },
  originProjectId: { type: DataTypes.STRING, allowNull: true, field: 'origin_project_id' },
  originProjectCode: { type: DataTypes.STRING, allowNull: true, field: 'origin_project_code' },
  originProjectName: { type: DataTypes.STRING, allowNull: true, field: 'origin_project_name' },
  originNotebookId: { type: DataTypes.STRING, allowNull: true, field: 'origin_notebook_id' },
  originNotebookCode: { type: DataTypes.STRING, allowNull: true, field: 'origin_notebook_code' },
  originExperimentId: { type: DataTypes.STRING, allowNull: true, field: 'origin_experiment_id' },
  originExperimentCode: { type: DataTypes.STRING, allowNull: true, field: 'origin_experiment_code' },
  originSectionId: { type: DataTypes.STRING, allowNull: true, field: 'origin_section_id' },
  originSectionTitle: { type: DataTypes.STRING, allowNull: true, field: 'origin_section_title' },
  originSnapshot: { type: DataTypes.JSON, allowNull: true, defaultValue: [], field: 'origin_snapshot' },
  receivedById: { type: DataTypes.UUID, allowNull: true, field: 'received_by_id' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
  referenceExperimentId: { type: DataTypes.UUID, allowNull: true, field: 'reference_experiment_id' },
  referenceExperimentCode: { type: DataTypes.STRING, allowNull: true, field: 'reference_experiment_code' },
  certifiedBy: { type: DataTypes.STRING, allowNull: true, field: 'certified_by' },
  certifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'certified_at' },
  assignedTeamId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_team_id' },
  raisedAt: { type: DataTypes.DATE, allowNull: true, field: 'raised_at' },
  qaApproveRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'qa_approve_remarks' },
  qaReworkHistory: { type: DataTypes.JSON, allowNull: true, defaultValue: [], field: 'qa_rework_history' },
  raisedStandalone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'raised_standalone' },
  currentOwner: { type: DataTypes.STRING, allowNull: true, field: 'current_owner' },
  currentOwnerId: { type: DataTypes.UUID, allowNull: true, field: 'current_owner_id' },
  approvedBy: { type: DataTypes.STRING, allowNull: true, field: 'approved_by' },
  approvedById: { type: DataTypes.UUID, allowNull: true, field: 'approved_by_id' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  coaGeneratedBy: { type: DataTypes.STRING, allowNull: true, field: 'coa_generated_by' },
  coaGeneratedAt: { type: DataTypes.DATE, allowNull: true, field: 'coa_generated_at' },
  lastUpdatedBy: { type: DataTypes.STRING, allowNull: true, field: 'last_updated_by' },
  lastUpdatedById: { type: DataTypes.UUID, allowNull: true, field: 'last_updated_by_id' },
  supportingDocs: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'supporting_docs' },
  workflowHistory: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'workflow_history' },
}, { sequelize, tableName: 'ard_atr_forms', timestamps: false })

// ── ARD ATR Samples ───────────────────────────────────────────────────────────
export class ArdAtrSample extends Model<InferAttributes<ArdAtrSample>, InferCreationAttributes<ArdAtrSample>> {
  declare id: CreationOptional<string>
  declare atrFormId: string
  declare sampleCode: string
  declare sampleType: CreationOptional<string | null>
  declare quantity: CreationOptional<string | null>
  declare uom: CreationOptional<string | null>
  declare packType: CreationOptional<string | null>
  declare storageCondition: CreationOptional<string | null>
  declare batchNo: CreationOptional<string | null>
  declare mfgDate: CreationOptional<string | null>
  declare expDate: CreationOptional<string | null>
  declare sampleDescription: CreationOptional<string | null>
  declare status: CreationOptional<string>
  declare chemicals: CreationOptional<any>
  declare manufacturedBy: CreationOptional<string | null>
  declare receivedBy: CreationOptional<string | null>
  declare preparedBy: CreationOptional<string | null>
  declare sampledBy: CreationOptional<string | null>
  declare receivedOn: CreationOptional<string | null>
  declare preparedOn: CreationOptional<string | null>
  declare sampledOn: CreationOptional<string | null>
  declare totalContainers: CreationOptional<number | null>
  declare sampledContainers: CreationOptional<number | null>
  declare sampleContent: CreationOptional<string | null>
  declare sampleIntegrity: CreationOptional<string | null>
  declare additionalRemarks: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare internalSampleNo: CreationOptional<string | null>
  declare productName: CreationOptional<string | null>
  declare sourceBatchId: CreationOptional<number | null>
  declare hazardWarningFlag: CreationOptional<boolean>
  declare controlQty: CreationOptional<string | null>
  declare controlQtyUom: CreationOptional<string | null>
  declare sampleIteration: CreationOptional<number | null>
  declare arNo: CreationOptional<string | null>
}
ArdAtrSample.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  atrFormId: { type: DataTypes.UUID, allowNull: false, field: 'atr_form_id' },
  sampleCode: { type: DataTypes.STRING, allowNull: false, field: 'sample_code' },
  sampleType: { type: DataTypes.STRING, allowNull: true, field: 'sample_type' },
  quantity: { type: DataTypes.STRING, allowNull: true },
  uom: { type: DataTypes.STRING, allowNull: true },
  packType: { type: DataTypes.STRING, allowNull: true, field: 'pack_type' },
  storageCondition: { type: DataTypes.STRING, allowNull: true, field: 'storage_condition' },
  batchNo: { type: DataTypes.STRING, allowNull: true, field: 'batch_no' },
  mfgDate: { type: DataTypes.STRING, allowNull: true, field: 'mfg_date' },
  expDate: { type: DataTypes.STRING, allowNull: true, field: 'exp_date' },
  sampleDescription: { type: DataTypes.TEXT, allowNull: true, field: 'sample_description' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' },
  chemicals: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  manufacturedBy: { type: DataTypes.STRING, allowNull: true, field: 'manufactured_by' },
  receivedBy: { type: DataTypes.STRING, allowNull: true, field: 'received_by' },
  preparedBy: { type: DataTypes.STRING, allowNull: true, field: 'prepared_by' },
  sampledBy: { type: DataTypes.STRING, allowNull: true, field: 'sampled_by' },
  receivedOn: { type: DataTypes.STRING, allowNull: true, field: 'received_on' },
  preparedOn: { type: DataTypes.STRING, allowNull: true, field: 'prepared_on' },
  sampledOn: { type: DataTypes.STRING, allowNull: true, field: 'sampled_on' },
  totalContainers: { type: DataTypes.INTEGER, allowNull: true, field: 'total_containers' },
  sampledContainers: { type: DataTypes.INTEGER, allowNull: true, field: 'sampled_containers' },
  sampleContent: { type: DataTypes.TEXT, allowNull: true, field: 'sample_content' },
  sampleIntegrity: { type: DataTypes.STRING, allowNull: true, field: 'sample_integrity' },
  additionalRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'additional_remarks' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  internalSampleNo: { type: DataTypes.STRING, allowNull: true, field: 'internal_sample_no' },
  productName: { type: DataTypes.STRING, allowNull: true, field: 'product_name' },
  sourceBatchId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_batch_id' },
  hazardWarningFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'hazard_warning_flag' },
  controlQty: { type: DataTypes.STRING, allowNull: true, field: 'control_qty' },
  controlQtyUom: { type: DataTypes.STRING, allowNull: true, field: 'control_qty_uom' },
  sampleIteration: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 1, field: 'sample_iteration' },
  arNo: { type: DataTypes.STRING, allowNull: true, field: 'ar_no' },
}, { sequelize, tableName: 'ard_atr_samples', timestamps: false })

// ── ARD Test Requests ─────────────────────────────────────────────────────────
export class ArdTestRequest extends Model<InferAttributes<ArdTestRequest>, InferCreationAttributes<ArdTestRequest>> {
  declare id: CreationOptional<string>
  declare sampleId: string
  declare testConfigId: CreationOptional<string | null>
  declare testType: string
  declare testSubtype: CreationOptional<string | null>
  declare techniqueCode: CreationOptional<string | null>
  declare techniqueName: CreationOptional<string | null>
  declare status: CreationOptional<string>
  declare priority: CreationOptional<string | null>
  declare arNumber: CreationOptional<string | null>
  declare assignedToId: CreationOptional<string | null>
  declare assignedToName: CreationOptional<string | null>
  declare assignedAt: CreationOptional<Date | null>
  declare assignRemarks: CreationOptional<string | null>
  declare delegatedToId: CreationOptional<string | null>
  declare delegatedToName: CreationOptional<string | null>
  declare delegatedAt: CreationOptional<Date | null>
  declare delegateRemarks: CreationOptional<string | null>
  declare startedAt: CreationOptional<Date | null>
  declare submittedAt: CreationOptional<Date | null>
  declare verifiedAt: CreationOptional<Date | null>
  declare verifiedBy: CreationOptional<string | null>
  declare verifyRemarks: CreationOptional<string | null>
  declare unlockRemarks: CreationOptional<string | null>
  declare unlockedAt: CreationOptional<Date | null>
  declare unlockedBy: CreationOptional<string | null>
  declare withdrawRemarks: CreationOptional<string | null>
  declare withdrawnAt: CreationOptional<Date | null>
  declare withdrawnBy: CreationOptional<string | null>
  declare resultRemarks: CreationOptional<string | null>
  declare adRemarks: CreationOptional<string | null>
  declare submitRemarks: CreationOptional<string | null>
  declare remarks: CreationOptional<string | null>
  declare lowerLimit: CreationOptional<string | null>
  declare upperLimit: CreationOptional<string | null>
  declare limitsUom: CreationOptional<string | null>
  declare certifiedBy: CreationOptional<string | null>
  declare analyzedBy: CreationOptional<string | null>
  declare chromatogramFile: CreationOptional<any | null>
  declare results: CreationOptional<any>
  declare referenceStandards: CreationOptional<any>
  declare versions: CreationOptional<any>
  declare ownershipHistory: CreationOptional<any>
  declare enhancementRequests: CreationOptional<any>
  declare chromatographyColumns: CreationOptional<any>
  declare rawDataAttachments: CreationOptional<any>
  declare finalReportAttachments: CreationOptional<any>
  declare experimentId: CreationOptional<string | null>
  declare version: CreationOptional<number>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
  declare instrumentCode: CreationOptional<string | null>
  declare acceptedAt: CreationOptional<Date | null>
  declare acceptedBy: CreationOptional<string | null>
  declare acceptRemarks: CreationOptional<string | null>
  declare testReassignRemarks: CreationOptional<string | null>
  declare unsatisfactoryRemarks: CreationOptional<string | null>
  declare reassignedTlId: CreationOptional<string | null>
  declare reassignedTlName: CreationOptional<string | null>
  declare arGeneratedAt: CreationOptional<Date | null>
  declare sourceDept: CreationOptional<string | null>
  declare trfFormId: CreationOptional<string | null>
  declare cancelRemarks: CreationOptional<string | null>
  declare removalRemarks: CreationOptional<string | null>
  declare notebookReference: CreationOptional<string | null>
  declare notebookRefLink: CreationOptional<boolean>
  declare isAdditionalTest: CreationOptional<boolean>
  declare testQty: CreationOptional<string | null>
  declare testQtyUom: CreationOptional<string | null>
  declare testQuantity: CreationOptional<string | null>
  declare testUnitOfMeasurement: CreationOptional<string | null>
  declare lastStatusChangedAt: CreationOptional<Date | null>
}
ArdTestRequest.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
  sampleId: { type: DataTypes.UUID, allowNull: false, field: 'sample_id' },
  testConfigId: { type: DataTypes.UUID, allowNull: true, field: 'test_config_id' },
  testType: { type: DataTypes.STRING, allowNull: false, field: 'test_type' },
  testSubtype: { type: DataTypes.STRING, allowNull: true, field: 'test_subtype' },
  techniqueCode: { type: DataTypes.STRING, allowNull: true, field: 'technique_code' },
  techniqueName: { type: DataTypes.STRING, allowNull: true, field: 'technique_name' },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'UNASSIGNED' },
  priority: { type: DataTypes.STRING, allowNull: true },
  arNumber: { type: DataTypes.STRING, allowNull: true, field: 'ar_number' },
  assignedToId: { type: DataTypes.UUID, allowNull: true, field: 'assigned_to_id' },
  assignedToName: { type: DataTypes.STRING, allowNull: true, field: 'assigned_to_name' },
  assignedAt: { type: DataTypes.DATE, allowNull: true, field: 'assigned_at' },
  assignRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'assign_remarks' },
  delegatedToId: { type: DataTypes.UUID, allowNull: true, field: 'delegated_to_id' },
  delegatedToName: { type: DataTypes.STRING, allowNull: true, field: 'delegated_to_name' },
  delegatedAt: { type: DataTypes.DATE, allowNull: true, field: 'delegated_at' },
  delegateRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'delegate_remarks' },
  startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  verifiedBy: { type: DataTypes.STRING, allowNull: true, field: 'verified_by' },
  verifyRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'verify_remarks' },
  unlockRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'unlock_remarks' },
  unlockedAt: { type: DataTypes.DATE, allowNull: true, field: 'unlocked_at' },
  unlockedBy: { type: DataTypes.STRING, allowNull: true, field: 'unlocked_by' },
  withdrawRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'withdraw_remarks' },
  withdrawnAt: { type: DataTypes.DATE, allowNull: true, field: 'withdrawn_at' },
  withdrawnBy: { type: DataTypes.STRING, allowNull: true, field: 'withdrawn_by' },
  resultRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'result_remarks' },
  adRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'ad_remarks' },
  submitRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'submit_remarks' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  lowerLimit: { type: DataTypes.STRING, allowNull: true, field: 'lower_limit' },
  upperLimit: { type: DataTypes.STRING, allowNull: true, field: 'upper_limit' },
  limitsUom: { type: DataTypes.STRING, allowNull: true, field: 'limits_uom' },
  certifiedBy: { type: DataTypes.STRING, allowNull: true, field: 'certified_by' },
  analyzedBy: { type: DataTypes.STRING, allowNull: true, field: 'analyzed_by' },
  chromatogramFile: { type: DataTypes.JSON, allowNull: true, defaultValue: [], field: 'chromatogram_file' },
  results: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  referenceStandards: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'reference_standards' },
  versions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  ownershipHistory: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'ownership_history' },
  enhancementRequests: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'enhancement_requests' },
  chromatographyColumns: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'chromatography_columns' },
  rawDataAttachments: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'raw_data_attachments' },
  finalReportAttachments: { type: DataTypes.JSON, allowNull: false, defaultValue: [], field: 'final_report_attachments' },
  experimentId: { type: DataTypes.UUID, allowNull: true, field: 'experiment_id' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  instrumentCode: { type: DataTypes.STRING, allowNull: true, field: 'instrument_code' },
  acceptedAt: { type: DataTypes.DATE, allowNull: true, field: 'accepted_at' },
  acceptedBy: { type: DataTypes.STRING, allowNull: true, field: 'accepted_by' },
  acceptRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'accept_remarks' },
  testReassignRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'test_reassign_remarks' },
  unsatisfactoryRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'unsatisfactory_remarks' },
  reassignedTlId: { type: DataTypes.UUID, allowNull: true, field: 'reassigned_tl_id' },
  reassignedTlName: { type: DataTypes.STRING, allowNull: true, field: 'reassigned_tl_name' },
  arGeneratedAt: { type: DataTypes.DATE, allowNull: true, field: 'ar_generated_at' },
  sourceDept: { type: DataTypes.STRING, allowNull: true, field: 'source_dept' },
  trfFormId: { type: DataTypes.UUID, allowNull: true, field: 'trf_form_id' },
  cancelRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'cancel_remarks' },
  removalRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'removal_remarks' },
  notebookReference: { type: DataTypes.STRING, allowNull: true, field: 'notebook_reference' },
  notebookRefLink: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'notebook_ref_link' },
  isAdditionalTest: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_additional_test' },
  testQty: { type: DataTypes.STRING, allowNull: true, field: 'test_qty' },
  testQtyUom: { type: DataTypes.STRING, allowNull: true, field: 'test_qty_uom' },
  testQuantity: { type: DataTypes.STRING, allowNull: true, field: 'test_quantity' },
  testUnitOfMeasurement: { type: DataTypes.STRING, allowNull: true, field: 'test_unit_of_measurement' },
  lastStatusChangedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_status_changed_at' },
}, { sequelize, tableName: 'ard_test_requests', timestamps: false })

// ── ARD Templates ─────────────────────────────────────────────────────────────
export class ArdTemplate extends Model<InferAttributes<ArdTemplate>, InferCreationAttributes<ArdTemplate>> {
  declare id: CreationOptional<string>
  declare familyId: string | null
  declare name: string
  declare code: CreationOptional<string | null>
  declare templateType: string | null
  declare version: CreationOptional<number>
  declare status: CreationOptional<string>
  declare description: string | null
  declare reviewRemarks: string | null
  declare remarks: string | null
  declare approvedBy: string | null
  declare approvedOn: string | null
  declare createdById: string | null
  declare sections: object | null
  declare deptId: string | null
  declare activationDate: string | null
  declare lastUpdatedBy: string | null
  declare lastUpdatedById: string | null
  declare includeWeighing: CreationOptional<boolean>
  declare includePh: CreationOptional<boolean>
  declare includeChemicals: CreationOptional<boolean>
  declare includeSampleDetails: CreationOptional<boolean>
  declare includeEquipment: CreationOptional<boolean>
  declare includeColumn: CreationOptional<boolean>
  declare includeAttachments: CreationOptional<boolean>
  declare includeResults: CreationOptional<boolean>
  declare includeConclusion: CreationOptional<boolean>
  declare includeCdsReport: CreationOptional<boolean>
  declare includeExperimentParameters: CreationOptional<boolean>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdTemplate.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  familyId: { type: DataTypes.UUID, allowNull: true, field: 'family_id' },
  name: { type: DataTypes.STRING(200), allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: true },
  templateType: { type: DataTypes.STRING(50), allowNull: true, field: 'template_type' },
  version: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.STRING(30), defaultValue: 'DRAFT' },
  description: { type: DataTypes.TEXT, allowNull: true },
  reviewRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'review_remarks' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedOn: { type: DataTypes.STRING(30), allowNull: true, field: 'approved_on' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  sections: { type: DataTypes.JSONB, allowNull: true },
  deptId: { type: DataTypes.UUID, allowNull: true, field: 'dept_id' },
  activationDate: { type: DataTypes.STRING(20), allowNull: true, field: 'activation_date' },
  lastUpdatedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'last_updated_by' },
  lastUpdatedById: { type: DataTypes.UUID, allowNull: true, field: 'last_updated_by_id' },
  includeWeighing: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_weighing' },
  includePh: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_ph' },
  includeChemicals: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_chemicals' },
  includeSampleDetails: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_sample_details' },
  includeEquipment: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_equipment' },
  includeColumn: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_column' },
  includeAttachments: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_attachments' },
  includeResults: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_results' },
  includeConclusion: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_conclusion' },
  includeCdsReport: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_cds_report' },
  includeExperimentParameters: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'include_experiment_parameters' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_templates', timestamps: false })

// ── ARD Experiments ───────────────────────────────────────────────────────────
export class ArdExperiment extends Model<InferAttributes<ArdExperiment>, InferCreationAttributes<ArdExperiment>> {
  declare id: CreationOptional<string>
  declare code: string
  declare templateId: string | null
  declare templateName: string | null
  declare status: CreationOptional<string>
  declare version: CreationOptional<number>
  declare sectionDefs: object | null
  declare sections: object | null
  declare history: object | null
  declare linkedSamples: object | null
  declare referenceExperiments: object | null
  declare clarifications: object | null
  declare sectionComments: object | null
  declare postAnalytical: object | null
  declare notebookId: string | null
  declare projectId: string | null
  declare projectStpId: string | null
  declare testType: string | null
  declare testSubtype: string | null
  declare atrResultId: string | null
  declare versionSnapshots: object | null
  declare highlighted: CreationOptional<boolean>
  declare highlightComment: string | null
  declare reviewerId: string | null
  declare reviewerName: string | null
  declare aimAchieved: boolean | null
  declare aimRemarks: string | null
  declare aim: string | null
  declare conclusion: string | null
  declare contributors: object | null
  declare linkedAtrIds: object | null
  declare editorLockUserId: string | null
  declare editorLockUsername: string | null
  declare editorLockExpiresAt: Date | null
  declare createdById: string | null
  declare submittedById: string | null
  declare approvedById: string | null
  declare submittedAt: Date | null
  declare approvedAt: Date | null
  declare printedAt: Date | null
  declare printedBy: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdExperiment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  templateId: { type: DataTypes.UUID, allowNull: true, field: 'template_id' },
  templateName: { type: DataTypes.STRING(200), allowNull: true, field: 'template_name' },
  status: { type: DataTypes.STRING(30), defaultValue: 'IN_PROGRESS' },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  sectionDefs: { type: DataTypes.JSONB, allowNull: true, field: 'section_defs' },
  sections: { type: DataTypes.JSONB, allowNull: true },
  history: { type: DataTypes.JSONB, allowNull: true },
  linkedSamples: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'linked_samples' },
  referenceExperiments: { type: DataTypes.JSONB, allowNull: true, defaultValue: [], field: 'reference_experiments' },
  clarifications: { type: DataTypes.JSONB, allowNull: true },
  sectionComments: { type: DataTypes.JSONB, allowNull: true, field: 'section_comments' },
  postAnalytical: { type: DataTypes.JSONB, allowNull: true, field: 'post_analytical' },
  notebookId: { type: DataTypes.UUID, allowNull: true, field: 'notebook_id' },
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  projectStpId: { type: DataTypes.STRING(100), allowNull: true, field: 'project_stp_id' },
  testType: { type: DataTypes.STRING(100), allowNull: true, field: 'test_type' },
  testSubtype: { type: DataTypes.STRING(100), allowNull: true, field: 'test_subtype' },
  atrResultId: { type: DataTypes.UUID, allowNull: true, field: 'atr_result_id' },
  versionSnapshots: { type: DataTypes.JSONB, allowNull: true, field: 'version_snapshots' },
  highlighted: { type: DataTypes.BOOLEAN, defaultValue: false },
  highlightComment: { type: DataTypes.TEXT, allowNull: true, field: 'highlight_comment' },
  reviewerId: { type: DataTypes.UUID, allowNull: true, field: 'reviewer_id' },
  reviewerName: { type: DataTypes.STRING(200), allowNull: true, field: 'reviewer_name' },
  aimAchieved: { type: DataTypes.BOOLEAN, allowNull: true, field: 'aim_achieved' },
  aimRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'aim_remarks' },
  aim: { type: DataTypes.TEXT, allowNull: true, field: 'aim' },
  conclusion: { type: DataTypes.TEXT, allowNull: true, field: 'conclusion' },
  contributors: { type: DataTypes.JSONB, allowNull: true },
  linkedAtrIds: { type: DataTypes.JSONB, allowNull: true, field: 'linked_atr_ids' },
  editorLockUserId: { type: DataTypes.UUID, allowNull: true, field: 'editor_lock_user_id' },
  editorLockUsername: { type: DataTypes.STRING(200), allowNull: true, field: 'editor_lock_username' },
  editorLockExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'editor_lock_expires_at' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  submittedById: { type: DataTypes.UUID, allowNull: true, field: 'submitted_by_id' },
  approvedById: { type: DataTypes.UUID, allowNull: true, field: 'approved_by_id' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  printedAt: { type: DataTypes.DATE, allowNull: true, field: 'printed_at' },
  printedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'printed_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_experiments', timestamps: false })

// ── ARD Notebooks ─────────────────────────────────────────────────────────────
export class ArdNotebook extends Model<InferAttributes<ArdNotebook>, InferCreationAttributes<ArdNotebook>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare description: string | null
  declare projectId: string | null
  declare notebookType: string | null
  declare status: CreationOptional<string>
  declare assignedUsers: object | null
  declare resultParameters: object | null
  declare auditTrail: object | null
  declare equipmentIds: object | null
  declare maxExperiments: number | null
  declare includeVerificationFlow: CreationOptional<boolean>
  declare createdBy: string | null
  declare createdById: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdNotebook.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  projectId: { type: DataTypes.UUID, allowNull: true, field: 'project_id' },
  notebookType: { type: DataTypes.STRING(50), allowNull: true, field: 'notebook_type' },
  status: { type: DataTypes.STRING(20), defaultValue: 'ACTIVE' },
  assignedUsers: { type: DataTypes.JSONB, allowNull: true, field: 'assigned_users' },
  resultParameters: { type: DataTypes.JSONB, allowNull: true, field: 'result_parameters' },
  auditTrail: { type: DataTypes.JSONB, allowNull: true, field: 'audit_trail' },
  equipmentIds: { type: DataTypes.JSONB, allowNull: true, field: 'equipment_ids' },
  maxExperiments: { type: DataTypes.INTEGER, allowNull: true, field: 'max_experiments' },
  includeVerificationFlow: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'include_verification_flow' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_notebooks', timestamps: false })

// ── ARD Projects ──────────────────────────────────────────────────────────────
export class ArdProject extends Model<InferAttributes<ArdProject>, InferCreationAttributes<ArdProject>> {
  declare id: CreationOptional<string>
  declare code: string
  declare name: string
  declare productName: string | null
  declare productCode: string | null
  declare description: string | null
  declare customer: string | null
  declare projectType: string | null
  declare analysisType: string | null
  declare priority: string | null
  declare targetDate: string | null
  declare status: CreationOptional<string>
  declare ownerName: string | null
  declare ownerId: string | null
  declare stpDocuments: object | null
  declare team: object | null
  declare attributes: object | null
  declare auditTrail: object | null
  declare createdBy: string | null
  declare createdById: string | null
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}
ArdProject.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  productName: { type: DataTypes.STRING(200), allowNull: true, field: 'product_name' },
  productCode: { type: DataTypes.STRING(50), allowNull: true, field: 'product_code' },
  description: { type: DataTypes.TEXT, allowNull: true },
  customer: { type: DataTypes.STRING(200), allowNull: true },
  projectType: { type: DataTypes.STRING(50), allowNull: true, field: 'project_type' },
  analysisType: { type: DataTypes.STRING(30), allowNull: true, field: 'analysis_type' },
  priority: { type: DataTypes.STRING(20), allowNull: true },
  targetDate: { type: DataTypes.STRING(20), allowNull: true, field: 'target_date' },
  status: { type: DataTypes.STRING(20), defaultValue: 'OPEN' },
  ownerName: { type: DataTypes.STRING(200), allowNull: true, field: 'owner_name' },
  ownerId: { type: DataTypes.UUID, allowNull: true, field: 'owner_id' },
  stpDocuments: { type: DataTypes.JSONB, allowNull: true, field: 'stp_documents' },
  team: { type: DataTypes.JSONB, allowNull: true },
  attributes: { type: DataTypes.JSONB, allowNull: true },
  auditTrail: { type: DataTypes.JSONB, allowNull: true, field: 'audit_trail' },
  createdBy: { type: DataTypes.STRING(200), allowNull: true, field: 'created_by' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  updatedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
}, { sequelize, tableName: 'ard_projects', timestamps: false })

// ── ARD Attachments ───────────────────────────────────────────────────────────
export class ArdAttachment extends Model<InferAttributes<ArdAttachment>, InferCreationAttributes<ArdAttachment>> {
  declare id: CreationOptional<string>
  declare entityType: string
  declare entityId: string
  declare name: string
  declare description: string | null
  declare filename: string | null
  declare fileType: string | null
  declare sizeBytes: number | null
  declare attachmentLink: string | null
  declare attachmentType: CreationOptional<string | null>
  declare customTypeName: CreationOptional<string | null>
  declare uploadedBy: string | null
  declare uploadedById: string | null
  declare createdAt: CreationOptional<Date>
}
ArdAttachment.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
  name: { type: DataTypes.STRING(300), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  filename: { type: DataTypes.STRING(300), allowNull: true },
  fileType: { type: DataTypes.STRING(100), allowNull: true, field: 'file_type' },
  sizeBytes: { type: DataTypes.INTEGER, allowNull: true, field: 'size_bytes' },
  attachmentLink: { type: DataTypes.TEXT, allowNull: true, field: 'attachment_link' },
  attachmentType: { type: DataTypes.STRING(50), allowNull: true, field: 'attachment_type' },
  customTypeName: { type: DataTypes.STRING(100), allowNull: true, field: 'custom_type_name' },
  uploadedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'uploaded_by' },
  uploadedById: { type: DataTypes.UUID, allowNull: true, field: 'uploaded_by_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, { sequelize, tableName: 'ard_attachments', timestamps: false })

// ── ARD Audit Log ─────────────────────────────────────────────────────────────
export class ArdAuditLog extends Model<InferAttributes<ArdAuditLog>, InferCreationAttributes<ArdAuditLog>> {
  declare id: CreationOptional<string>
  declare entityType: string
  declare entityId: string | null
  declare action: string
  declare detail: string | null
  declare userId: string | null
  declare createdAt: CreationOptional<Date>
}
ArdAuditLog.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  entityType: { type: DataTypes.STRING(50), allowNull: false, field: 'entity_type' },
  entityId: { type: DataTypes.UUID, allowNull: true, field: 'entity_id' },
  action: { type: DataTypes.STRING(100), allowNull: false },
  detail: { type: DataTypes.TEXT, allowNull: true },
  userId: { type: DataTypes.UUID, allowNull: true, field: 'user_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, { sequelize, tableName: 'ard_audit_log', timestamps: false })

// ── ARD QC-TRF Form ───────────────────────────────────────────────────────────
export class ArdQcTrfForm extends Model<InferAttributes<ArdQcTrfForm>, InferCreationAttributes<ArdQcTrfForm>> {
  declare id: CreationOptional<string>
  declare formNo: string
  declare status: CreationOptional<string>
  declare projectCode: string
  declare projectName: string
  declare sampleCode: string
  declare sampleType: string | null
  declare batchNo: string
  declare sampleQty: string | null
  declare sampleQtyUom: string | null
  declare mfgDate: string | null
  declare expDate: string | null
  declare storageCondition: string | null
  declare sampleDescription: string | null
  declare totalContainers: number | null
  declare sampledContainers: number | null
  declare sampleContent: string | null
  declare preparedBy: string | null
  declare preparedOn: string | null
  declare sampledBy: string | null
  declare sampledOn: string | null
  declare specificationName: string | null
  declare specificationId: string | null
  declare specificationVersion: string | null
  declare submittedBy: string | null
  declare submittedOn: Date | null
  declare registeredBy: string | null
  declare registeredOn: Date | null
  declare rejectedBy: string | null
  declare rejectedOn: Date | null
  declare rejectRemarks: string | null
  declare receivedBy: string | null
  declare receivedAt: Date | null
  declare sampleIntegrity: string | null
  declare receivingRemarks: string | null
  declare assignedTl: string | null
  declare qcRefNum: string | null
  declare remarks: string | null
  declare approvedBy: string | null
  declare approvedAt: Date | null
  declare testRequests: object
  declare sampleLines: object
  declare sampleAttributes: object
  declare createdBy: string
  declare createdById: string | null
  declare createdAt: CreationOptional<Date>
  declare updatedAt: Date | null
}
ArdQcTrfForm.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  formNo: { type: DataTypes.STRING(40), allowNull: false, unique: true, field: 'form_no' },
  status: { type: DataTypes.STRING(30), defaultValue: 'DRAFT' },
  projectCode: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '', field: 'project_code' },
  projectName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '', field: 'project_name' },
  sampleCode: { type: DataTypes.STRING(50), allowNull: false, defaultValue: '', field: 'sample_code' },
  sampleType: { type: DataTypes.STRING(100), allowNull: true, field: 'sample_type' },
  batchNo: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '', field: 'batch_no' },
  sampleQty: { type: DataTypes.STRING(50), allowNull: true, field: 'sample_qty' },
  sampleQtyUom: { type: DataTypes.STRING(30), allowNull: true, field: 'sample_qty_uom' },
  mfgDate: { type: DataTypes.STRING(20), allowNull: true, field: 'mfg_date' },
  expDate: { type: DataTypes.STRING(20), allowNull: true, field: 'exp_date' },
  storageCondition: { type: DataTypes.STRING(200), allowNull: true, field: 'storage_condition' },
  sampleDescription: { type: DataTypes.TEXT, allowNull: true, field: 'sample_description' },
  totalContainers: { type: DataTypes.INTEGER, allowNull: true, field: 'total_containers' },
  sampledContainers: { type: DataTypes.INTEGER, allowNull: true, field: 'sampled_containers' },
  sampleContent: { type: DataTypes.TEXT, allowNull: true, field: 'sample_content' },
  preparedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'prepared_by' },
  preparedOn: { type: DataTypes.STRING(20), allowNull: true, field: 'prepared_on' },
  sampledBy: { type: DataTypes.STRING(200), allowNull: true, field: 'sampled_by' },
  sampledOn: { type: DataTypes.STRING(20), allowNull: true, field: 'sampled_on' },
  specificationName: { type: DataTypes.STRING(200), allowNull: true, field: 'specification_name' },
  specificationId: { type: DataTypes.STRING(100), allowNull: true, field: 'specification_id' },
  specificationVersion: { type: DataTypes.STRING(50), allowNull: true, field: 'specification_version' },
  submittedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'submitted_by' },
  submittedOn: { type: DataTypes.DATE, allowNull: true, field: 'submitted_on' },
  registeredBy: { type: DataTypes.STRING(200), allowNull: true, field: 'registered_by' },
  registeredOn: { type: DataTypes.DATE, allowNull: true, field: 'registered_on' },
  rejectedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'rejected_by' },
  rejectedOn: { type: DataTypes.DATE, allowNull: true, field: 'rejected_on' },
  rejectRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'reject_remarks' },
  receivedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'received_by' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
  sampleIntegrity: { type: DataTypes.STRING(100), allowNull: true, field: 'sample_integrity' },
  receivingRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'receiving_remarks' },
  assignedTl: { type: DataTypes.STRING(200), allowNull: true, field: 'assigned_tl' },
  qcRefNum: { type: DataTypes.STRING(100), allowNull: true, field: 'qc_ref_num' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  testRequests: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'test_requests' },
  sampleLines: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'sample_lines' },
  sampleAttributes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'sample_attributes' },
  createdBy: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '', field: 'created_by' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_qc_trf_forms', timestamps: false })

// ── ARD Project Specification ─────────────────────────────────────────────────
export class ArdProjectSpecification extends Model<InferAttributes<ArdProjectSpecification>, InferCreationAttributes<ArdProjectSpecification>> {
  declare id: CreationOptional<string>
  declare projectId: string
  declare specCode: string | null
  declare version: CreationOptional<string>
  declare title: string
  declare shortName: CreationOptional<string | null>
  declare specType: CreationOptional<string | null>
  declare description: CreationOptional<string | null>
  declare status: CreationOptional<string>
  declare testParameters: object
  declare submitRemarks: string | null
  declare approveRemarks: string | null
  declare createdBy: string
  declare createdById: string | null
  declare approvedBy: string | null
  declare approvedAt: Date | null
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: Date | null
}
ArdProjectSpecification.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
  specCode: { type: DataTypes.STRING(50), allowNull: true, field: 'spec_code' },
  version: { type: DataTypes.STRING(20), defaultValue: '1.0' },
  title: { type: DataTypes.STRING(200), allowNull: false },
  shortName: { type: DataTypes.STRING(60), allowNull: true, field: 'short_name' },
  specType: { type: DataTypes.STRING(60), allowNull: true, field: 'spec_type' },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(30), defaultValue: 'DRAFT' },
  testParameters: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'test_parameters' },
  submitRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'submit_remarks' },
  approveRemarks: { type: DataTypes.TEXT, allowNull: true, field: 'approve_remarks' },
  createdBy: { type: DataTypes.STRING(200), allowNull: false, field: 'created_by' },
  createdById: { type: DataTypes.UUID, allowNull: true, field: 'created_by_id' },
  approvedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'approved_by' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  updatedBy: { type: DataTypes.STRING(200), allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_project_specifications', timestamps: false })

// ── ARD Notification Read ─────────────────────────────────────────────────────
export class ArdNotificationRead extends Model<InferAttributes<ArdNotificationRead>, InferCreationAttributes<ArdNotificationRead>> {
  declare id: CreationOptional<string>
  declare userId: string
  declare notificationId: string
  declare createdAt: CreationOptional<Date>
}
ArdNotificationRead.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  notificationId: { type: DataTypes.STRING(100), allowNull: false, field: 'notification_id' },
  createdAt: { type: DataTypes.DATE, field: 'created_at' },
}, { sequelize, tableName: 'ard_notification_read', timestamps: false })

// ── ARD Content Blocks (Content Library) ──────────────────────────────────────
export class ArdContentBlock extends Model<InferAttributes<ArdContentBlock>, InferCreationAttributes<ArdContentBlock>> {
  declare id: CreationOptional<string>
  declare name: string
  declare contentType: CreationOptional<string | null>
  declare body: CreationOptional<string | null>
  declare isActive: CreationOptional<boolean>
  declare displayHeight: CreationOptional<number | null>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
}
ArdContentBlock.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  contentType: { type: DataTypes.STRING, allowNull: true, field: 'content_type' },
  body: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  displayHeight: { type: DataTypes.INTEGER, allowNull: true, field: 'display_height' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_content_blocks', timestamps: false })

// ── ARD Qualification Alerts ───────────────────────────────────────────────────
export class ArdQualificationAlert extends Model<InferAttributes<ArdQualificationAlert>, InferCreationAttributes<ArdQualificationAlert>> {
  declare id: CreationOptional<string>
  declare name: string
  declare daysBeforeExpiry: number
  declare isActive: CreationOptional<boolean>
}
ArdQualificationAlert.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  daysBeforeExpiry: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30, field: 'days_before_expiry' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
}, { sequelize, tableName: 'ard_qualification_alerts', timestamps: false })

// ── ARD Attributes (form attribute definitions) ────────────────────────────────
export class ArdAttribute extends Model<InferAttributes<ArdAttribute>, InferCreationAttributes<ArdAttribute>> {
  declare id: CreationOptional<string>
  declare name: string
  declare label: CreationOptional<string | null>
  declare fieldType: CreationOptional<string | null>
  declare required: CreationOptional<boolean>
  declare maxLength: CreationOptional<number | null>
  declare options: CreationOptional<any>
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
}
ArdAttribute.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  label: { type: DataTypes.STRING, allowNull: true },
  fieldType: { type: DataTypes.STRING, allowNull: true, field: 'field_type' },
  required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  maxLength: { type: DataTypes.INTEGER, allowNull: true, field: 'max_length' },
  options: { type: DataTypes.JSON, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_attributes', timestamps: false })

// ── ARD Data Items (reusable data-item catalogue) ──────────────────────────────
// dataType is a fixed enum in code — INTEGER | TEXT | DATE | LOV, matching the
// legacy "Template DataItems" screen exactly (product owner review 2026-08-20).
// lengthCategory (SHORT|LONG) is never user-entered — it's derived server-side
// from dataType (INTEGER/DATE/LOV -> SHORT, TEXT -> LONG). LOV selectable values
// come from the Inventory module's shared inv_general_lookup table, keyed by
// lovLookupType (= inv_general_lookup.lookup_type) — not an ARD-local lookup.
export class ArdDataItem extends Model<InferAttributes<ArdDataItem>, InferCreationAttributes<ArdDataItem>> {
  declare id: CreationOptional<string>
  declare name: string
  declare dataType: CreationOptional<string | null>
  declare lengthCategory: CreationOptional<string | null>
  declare lovLookupType: CreationOptional<string | null>
  declare uom: CreationOptional<string | null>
  declare description: CreationOptional<string | null>
  declare isActive: CreationOptional<boolean>
  declare createdBy: CreationOptional<string | null>
  declare updatedBy: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date | null>
  declare updatedAt: CreationOptional<Date | null>
}
ArdDataItem.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  dataType: { type: DataTypes.STRING, allowNull: true, field: 'data_type' },
  lengthCategory: { type: DataTypes.STRING(10), allowNull: true, field: 'length_category' },
  lovLookupType: { type: DataTypes.STRING(100), allowNull: true, field: 'lov_lookup_type' },
  uom: { type: DataTypes.STRING, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.UUID, allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.UUID, allowNull: true, field: 'updated_by' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
}, { sequelize, tableName: 'ard_data_items', timestamps: false })
