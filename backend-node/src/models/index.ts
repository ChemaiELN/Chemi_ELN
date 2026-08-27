// Re-export all models for convenient import
export { Role } from './Role.model'
export { Department } from './Department.model'
export { Lab, UserLab } from './Lab.model'
export { User } from './User.model'
export { GlobalSettings } from './GlobalSettings.model'
export { AdminAuditTrail } from './AdminAuditTrail.model'
export { LoginIssueRequest } from './LoginIssueRequest.model'
export { DepartmentRoleMapping, RolePrivilege, UserSecurityQuestion } from './RolePrivilege.model'
export { DepartmentRolePrivilege } from './DepartmentRolePrivilege.model'
export { MasterDataItem, LookupChemical, LookupInstrument } from './MasterData.model'
export { IdSequenceConfig, IdSequenceCounter } from './IdSequence.model'
export {
  Project, ProjectCodeCounter, ProjectUser, Route,
  ProjectAttachment, ProjectRiskAssessment, ProjectRiskRow,
} from './Project.model'
export { Notebook, NotebookPermission } from './Notebook.model'
export {
  Experiment, ExperimentAssignment, ExperimentFile,
  ExperimentAtrRequest, ExperimentReview, ExperimentHistory,
} from './Experiment.model'
export {
  CgtProject, CgtProjectCodeCounter, CgtNotebook, CgtNotebookPermission,
  CgtExperiment, CgtExperimentAssignment,
} from './CgtProject.model'
export {
  ArdSetting, ArdTechnique, ArdTestConfiguration, ArdTestGroup, ArdTestGroupMember,
  ArdFormType, ArdAnalystQualification, ArdTeam,
  ArdAtrForm, ArdAtrSample, ArdTestRequest,
  ArdTemplate, ArdExperiment, ArdNotebook, ArdProject,
  ArdQcTrfForm, ArdProjectSpecification,
  ArdAttachment, ArdAuditLog, ArdNotificationRead,
  ArdContentBlock, ArdQualificationAlert, ArdAttribute, ArdDataItem,
} from './ArdModels.model'
export {
  ArdSection, ArdSectionRichtext, ArdSectionDatatable, ArdSectionEmbeddedFile,
  ArdTemplateSection, ArdSectionDataItem, ArdDatatableColumn,
  ArdTemplateSectionRichtextSnapshot, ArdTemplateSectionDataItemSnapshot,
  ArdTemplateSectionDatatableSnapshot, ArdTemplateDatatableColumnSnapshot,
  ArdTemplateSectionEmbeddedFileSnapshot,
} from './ArdSections.model'
export { AdcObjective, AdcRegulatoryClassification, AdcRiskAssessment, AdcRiskItem } from './AdcModels.model'
export {
  WorkflowTemplate, WorkflowTemplateVersion,
  CalcSheetTemplate, CalcSheetTemplateVersion,
} from './WorkflowTemplate.model'
export {
  InvMaterial, InvMaterialChemicalProp, InvMaterialFormulationProp, InvMaterialCodeCounter,
  InvManufacturer, InvManufacturerMapping,
  InvBatch, InvBatchEvent, InvBatchPack, InvBatchNoCounter, InvBatchNumberCounter,
  InvStockRequest, InvStockRequestEvent,
  InvEquipmentType, InvInstrumentType, InvColumnType,
  InvEquipmentCatalogue, InvInstrumentCatalogue, InvColumnCatalogue,
  InvChecklist, InvChecklistItem, InvChecklistApproval,
  InvSchedule,
  InvWorkOrder, InvWorkOrderResult, InvWorkOrderSignature, InvWorkOrderSpare, InvCalibrationReference,
  InvGatePass, InvGatePassItem, InvGatePassReturn, InvGatePassSignature,
  InvUsageLog,
  InvInstrumentParameter, InvInstrumentSpecDetail,
  InvLogMapping, InvMeasurementMaster, InvSparePart,
  InvConsumableType, InvStorageCondition, InvStorageLocation, InvStorageLocationLab,
  InvUomDimension, InvUomUnit,
  InvTestType, InvTestName, InvTestMethod,
  InvGeneralLookup, InvAuditTrail,
} from './InventoryModels.model'

import { sequelize } from '../database/connection'

// Set up all associations
import { Role } from './Role.model'
import { Department } from './Department.model'
import { Lab, UserLab } from './Lab.model'
import { User } from './User.model'
import { LoginIssueRequest } from './LoginIssueRequest.model'
import { DepartmentRoleMapping, RolePrivilege } from './RolePrivilege.model'
import { DepartmentRolePrivilege } from './DepartmentRolePrivilege.model'
import { Project, ProjectUser, ProjectRiskAssessment, ProjectRiskRow } from './Project.model'
import { Notebook, NotebookPermission } from './Notebook.model'
import { Experiment, ExperimentAssignment } from './Experiment.model'
import { CgtProject, CgtNotebook, CgtNotebookPermission, CgtExperiment, CgtExperimentAssignment } from './CgtProject.model'
import {
  ArdAtrForm, ArdAtrSample, ArdTestRequest, ArdExperiment, ArdNotebook,
  ArdTestGroup, ArdTestGroupMember, ArdTestConfiguration,
} from './ArdModels.model'
import { AdcRiskAssessment, AdcRiskItem } from './AdcModels.model'
import { ArdTemplate, ArdDataItem } from './ArdModels.model'
import {
  ArdSection, ArdSectionRichtext, ArdSectionDatatable, ArdSectionEmbeddedFile,
  ArdTemplateSection, ArdSectionDataItem, ArdDatatableColumn,
  ArdTemplateSectionDatatableSnapshot, ArdTemplateDatatableColumnSnapshot,
} from './ArdSections.model'
import {
  InvUomDimension, InvUomUnit, InvTestType, InvTestName, InvTestMethod,
  InvMaterial, InvManufacturer,
  InvBatch, InvBatchEvent, InvBatchPack,
  InvStockRequest, InvStockRequestEvent,
  InvGatePass, InvGatePassItem, InvGatePassReturn, InvGatePassSignature,
  InvWorkOrder, InvWorkOrderResult, InvWorkOrderSignature, InvWorkOrderSpare,
  InvCalibrationReference,
  InvEquipmentCatalogue, InvInstrumentCatalogue, InvStorageLocation,
  InvLogMapping, InvChecklist,
} from './InventoryModels.model'

// User associations
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' })
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' })
User.belongsTo(Lab, { foreignKey: 'labId', as: 'lab' })
Role.hasMany(User, { foreignKey: 'roleId', as: 'users' })
Department.hasMany(User, { foreignKey: 'departmentId', as: 'users' })
Lab.hasMany(User, { foreignKey: 'labId', as: 'users' })

// User <-> Lab many-to-many (a user can be assigned to multiple labs, on top of
// the legacy single `lab` above which stays for backwards compatibility).
User.belongsToMany(Lab, { through: UserLab, foreignKey: 'userId', otherKey: 'labId', as: 'labs' })
Lab.belongsToMany(User, { through: UserLab, foreignKey: 'labId', otherKey: 'userId', as: 'assignedUsers' })
UserLab.belongsTo(Lab, { foreignKey: 'labId', as: 'lab' })
UserLab.belongsTo(User, { foreignKey: 'userId', as: 'user' })

// Login issue request associations
LoginIssueRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' })
LoginIssueRequest.belongsTo(User, { foreignKey: 'resolvedBy', as: 'resolver' })

// Department <-> Role mapping
Department.belongsToMany(Role, { through: DepartmentRoleMapping, foreignKey: 'departmentId', otherKey: 'roleId', as: 'roles' })
Role.belongsToMany(Department, { through: DepartmentRoleMapping, foreignKey: 'roleId', otherKey: 'departmentId', as: 'departments' })

// Role privileges
Role.hasMany(RolePrivilege, { foreignKey: 'roleId', as: 'privileges' })
RolePrivilege.belongsTo(Role, { foreignKey: 'roleId', as: 'role' })

// Department+Role operation privileges (module-level, e.g. ADC)
Role.hasMany(DepartmentRolePrivilege, { foreignKey: 'roleId', as: 'deptPrivileges' })
DepartmentRolePrivilege.belongsTo(Role, { foreignKey: 'roleId', as: 'role' })
Department.hasMany(DepartmentRolePrivilege, { foreignKey: 'departmentId', as: 'deptPrivileges' })
DepartmentRolePrivilege.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' })

// Project associations.
// 'members' is the hasMany onto the ProjectUser join rows, because the routes include
// ProjectUser directly to read its `role` column (projects.routes.ts:100,240) — a
// belongsToMany would resolve 'members' to User and drop that column. The
// through-association is kept under a distinct alias for convenience queries.
Project.hasMany(ProjectUser, { foreignKey: 'projectId', as: 'members' })
ProjectUser.belongsTo(Project, { foreignKey: 'projectId', as: 'project' })
Project.belongsToMany(User, { through: ProjectUser, foreignKey: 'projectId', otherKey: 'userId', as: 'memberUsers' })
User.belongsToMany(Project, { through: ProjectUser, foreignKey: 'userId', otherKey: 'projectId', as: 'projects' })

// Notebook associations
Notebook.belongsTo(Project, { foreignKey: 'projectId', as: 'project' })
Notebook.hasMany(NotebookPermission, { foreignKey: 'notebookId', as: 'permissions' })
NotebookPermission.belongsTo(Notebook, { foreignKey: 'notebookId', as: 'notebook' })
NotebookPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' })

// Experiment associations
Experiment.belongsTo(Notebook, { foreignKey: 'notebookId', as: 'notebook' })
Experiment.hasMany(ExperimentAssignment, { foreignKey: 'experimentId', as: 'assignments' })
ExperimentAssignment.belongsTo(Experiment, { foreignKey: 'experimentId' })
ExperimentAssignment.belongsTo(User, { foreignKey: 'userId', as: 'user' })

// CGT associations
CgtNotebook.belongsTo(CgtProject, { foreignKey: 'cgtProjectId', as: 'project' })
CgtProject.hasMany(CgtNotebook, { foreignKey: 'cgtProjectId', as: 'notebooks' })
CgtExperiment.belongsTo(CgtNotebook, { foreignKey: 'cgtNotebookId', as: 'notebook' })
CgtNotebook.hasMany(CgtExperiment, { foreignKey: 'cgtNotebookId', as: 'experiments' })
CgtNotebookPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' })
CgtNotebook.hasMany(CgtNotebookPermission, { foreignKey: 'cgtNotebookId', as: 'permissions' })
CgtExperimentAssignment.belongsTo(User, { foreignKey: 'userId', as: 'user' })
CgtExperiment.hasMany(CgtExperimentAssignment, { foreignKey: 'cgtExperimentId', as: 'assignments' })
CgtExperimentAssignment.belongsTo(CgtExperiment, { foreignKey: 'cgtExperimentId', as: 'experiment' })

// ARD ATR associations
ArdAtrForm.hasMany(ArdAtrSample, { foreignKey: 'atrFormId', as: 'samples' })
ArdAtrSample.belongsTo(ArdAtrForm, { foreignKey: 'atrFormId', as: 'atrForm' })

// A test request has NO atr_form_id column — it hangs off a sample, and the sample
// carries atr_form_id (backend/app/models/ard_atr.py:191,133). Reaching an ATR from a
// test is therefore a two-hop join through ArdAtrSample, exactly as FastAPI does it
// (backend/app/modules/ard/tests.py:222-223). Declaring a direct
// ArdAtrForm.hasMany(ArdTestRequest, { foreignKey: 'atrFormId' }) injected a phantom
// atrFormId attribute onto the model and broke every test query.
ArdTestRequest.belongsTo(ArdAtrSample, { foreignKey: 'sampleId', as: 'sample' })
ArdAtrSample.hasMany(ArdTestRequest, { foreignKey: 'sampleId', as: 'tests' })

// Test groups → their member configurations (ard_test_group_members).
ArdTestGroup.hasMany(ArdTestGroupMember, { foreignKey: 'testGroupId', as: 'members' })
ArdTestGroupMember.belongsTo(ArdTestGroup, { foreignKey: 'testGroupId', as: 'group' })
ArdTestGroupMember.belongsTo(ArdTestConfiguration, { foreignKey: 'testConfigId', as: 'testConfig' })

// ADC associations
AdcRiskAssessment.hasMany(AdcRiskItem, { foreignKey: 'riskAssessmentId', as: 'items' })
AdcRiskItem.belongsTo(AdcRiskAssessment, { foreignKey: 'riskAssessmentId', as: 'riskAssessment' })

// ARD Experiment associations
ArdExperiment.belongsTo(ArdNotebook, { foreignKey: 'notebookId', as: 'notebook' })
ArdNotebook.hasMany(ArdExperiment, { foreignKey: 'notebookId', as: 'experiments' })

// ARD Templates rearchitecture — Sections/Data Items as reusable master data,
// attached to a template version via join tables (Extra/analysis/ard-templates-
// rearchitecture-prompt.md §1.6/§1.7/§1.8).
ArdTemplate.hasMany(ArdTemplateSection, { foreignKey: 'templateId', as: 'templateSections' })
ArdTemplateSection.belongsTo(ArdTemplate, { foreignKey: 'templateId', as: 'template' })
ArdTemplateSection.belongsTo(ArdSection, { foreignKey: 'sectionId', as: 'section' })
ArdSection.hasMany(ArdTemplateSection, { foreignKey: 'sectionId', as: 'templateAttachments' })

ArdSection.belongsTo(User, { foreignKey: 'createdById', as: 'creator' })
ArdSection.belongsTo(User, { foreignKey: 'lastUpdatedById', as: 'updater' })

ArdSection.hasOne(ArdSectionRichtext, { foreignKey: 'sectionId', as: 'richtext' })
ArdSectionRichtext.belongsTo(ArdSection, { foreignKey: 'sectionId', as: 'section' })
ArdSection.hasMany(ArdSectionDatatable, { foreignKey: 'sectionId', as: 'datatables' })
ArdSectionDatatable.belongsTo(ArdSection, { foreignKey: 'sectionId', as: 'section' })
ArdSection.hasOne(ArdSectionEmbeddedFile, { foreignKey: 'sectionId', as: 'embeddedFile' })
ArdSectionEmbeddedFile.belongsTo(ArdSection, { foreignKey: 'sectionId', as: 'section' })

ArdSection.hasMany(ArdSectionDataItem, { foreignKey: 'sectionId', as: 'dataItemLinks' })
ArdSectionDataItem.belongsTo(ArdSection, { foreignKey: 'sectionId', as: 'section' })
ArdSectionDataItem.belongsTo(ArdDataItem, { foreignKey: 'dataItemId', as: 'dataItem' })
ArdDataItem.hasMany(ArdSectionDataItem, { foreignKey: 'dataItemId', as: 'sectionLinks' })

ArdSectionDatatable.hasMany(ArdDatatableColumn, { foreignKey: 'datatableId', as: 'columns' })
ArdDatatableColumn.belongsTo(ArdSectionDatatable, { foreignKey: 'datatableId', as: 'datatable' })
ArdDatatableColumn.belongsTo(ArdDataItem, { foreignKey: 'dataItemId', as: 'dataItem' })
ArdDataItem.hasMany(ArdDatatableColumn, { foreignKey: 'dataItemId', as: 'columnLinks' })

ArdTemplateSectionDatatableSnapshot.hasMany(ArdTemplateDatatableColumnSnapshot, { foreignKey: 'datatableSnapshotId', as: 'columns' })
ArdTemplateDatatableColumnSnapshot.belongsTo(ArdTemplateSectionDatatableSnapshot, { foreignKey: 'datatableSnapshotId', as: 'datatableSnapshot' })

// Lab → Department. Missing here made GET /api/labs fail with
// "Department is not associated to Lab!" (labs.routes.ts:37).
Lab.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' })

// Project associations used by projects.routes.ts (lines 82-83, 146-147, 223-227, 403).
Project.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' })
// Aliased 'creator', not 'createdBy': Project already has a `createdBy` UUID attribute
// and Sequelize rejects an association that collides with an attribute name. The
// frontend expects `created_by` to stay a UUID string alongside a separate
// `created_by_name` (frontend/src/api/adc.ts Project interface), so routes flatten
// this association into that field rather than nesting an object under created_by.
Project.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
ProjectUser.belongsTo(User, { foreignKey: 'userId', as: 'user' })
ProjectRiskAssessment.hasMany(ProjectRiskRow, { foreignKey: 'assessmentId', as: 'rows' })
ProjectRiskRow.belongsTo(ProjectRiskAssessment, { foreignKey: 'assessmentId', as: 'assessment' })

// Inventory — UOM associations
InvUomDimension.hasMany(InvUomUnit, { foreignKey: 'dimensionId', as: 'units' })
InvUomUnit.belongsTo(InvUomDimension, { foreignKey: 'dimensionId', as: 'dimension' })

// Inventory — Test master associations
InvTestType.hasMany(InvTestName, { foreignKey: 'testTypeId', as: 'names' })
InvTestName.belongsTo(InvTestType, { foreignKey: 'testTypeId', as: 'type' })
InvTestName.hasMany(InvTestMethod, { foreignKey: 'testNameId', as: 'methods' })
InvTestMethod.belongsTo(InvTestName, { foreignKey: 'testNameId', as: 'testName' })

// Inventory — Batch associations.
// These were missing, so every endpoint eager-loading a batch's material, events or
// packs failed with SequelizeEagerLoadingError ("InvMaterial is not associated to
// InvBatch") and surfaced as a 500 — e.g. GET /inventory/dashboard/expiring-soon.
InvBatch.belongsTo(InvMaterial, { foreignKey: 'materialId', as: 'material' })
InvMaterial.hasMany(InvBatch, { foreignKey: 'materialId', as: 'batches' })
InvBatch.belongsTo(InvManufacturer, { foreignKey: 'manufacturerId', as: 'manufacturer' })
InvBatch.hasMany(InvBatchEvent, { foreignKey: 'batchId', as: 'events' })
InvBatchEvent.belongsTo(InvBatch, { foreignKey: 'batchId', as: 'batch' })
InvBatch.hasMany(InvBatchPack, { foreignKey: 'batchId', as: 'packs' })
InvBatchPack.belongsTo(InvBatch, { foreignKey: 'batchId', as: 'batch' })

// Inventory — Equipment/Instrument storage location associations
InvEquipmentCatalogue.belongsTo(InvStorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' })
InvInstrumentCatalogue.belongsTo(InvStorageLocation, { foreignKey: 'storageLocationId', as: 'storageLocation' })

// Inventory — Log Mapping -> Checklist association
InvLogMapping.belongsTo(InvChecklist, { foreignKey: 'checklistId', as: 'checklist' })

// Inventory — Stock request associations
InvStockRequest.belongsTo(InvMaterial, { foreignKey: 'materialId', as: 'material' })
InvStockRequest.hasMany(InvStockRequestEvent, { foreignKey: 'requestId', as: 'events' })
InvStockRequestEvent.belongsTo(InvStockRequest, { foreignKey: 'requestId', as: 'request' })

// Inventory — Gate pass associations
InvGatePass.hasMany(InvGatePassItem, { foreignKey: 'gatePassId', as: 'items' })
InvGatePassItem.belongsTo(InvGatePass, { foreignKey: 'gatePassId', as: 'gatePass' })
InvGatePassItem.belongsTo(InvMaterial, { foreignKey: 'materialId', as: 'material' })
InvGatePass.hasMany(InvGatePassReturn, { foreignKey: 'gatePassId', as: 'returns' })
InvGatePassReturn.belongsTo(InvGatePass, { foreignKey: 'gatePassId', as: 'gatePass' })
InvGatePass.hasMany(InvGatePassSignature, { foreignKey: 'gatePassId', as: 'signatures' })
InvGatePassSignature.belongsTo(InvGatePass, { foreignKey: 'gatePassId', as: 'gatePass' })

// Inventory — Work order associations
InvWorkOrder.hasMany(InvWorkOrderResult, { foreignKey: 'workOrderId', as: 'results' })
InvWorkOrderResult.belongsTo(InvWorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' })
InvWorkOrder.hasMany(InvWorkOrderSignature, { foreignKey: 'workOrderId', as: 'signatures' })
InvWorkOrderSignature.belongsTo(InvWorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' })
// Aliased sparesUsed/calibReferences (not spares/calibrationReferences) so the
// snake_case response middleware produces spares_used/calib_references,
// matching the frontend's WorkOrderDetail contract (WorkOrderExecutionPage.tsx).
InvWorkOrder.hasMany(InvWorkOrderSpare, { foreignKey: 'workOrderId', as: 'sparesUsed' })
InvWorkOrderSpare.belongsTo(InvWorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' })
InvWorkOrder.hasMany(InvCalibrationReference, { foreignKey: 'workOrderId', as: 'calibReferences' })
InvCalibrationReference.belongsTo(InvWorkOrder, { foreignKey: 'workOrderId', as: 'workOrder' })

// ── Timestamp hooks ───────────────────────────────────────────────────────────
// Most tables in this schema declare created_at / updated_at as NOT NULL with no
// database default, while the models are defined with `timestamps: false` (they were
// written to mirror the FastAPI models, which set the values in application code).
// That left every INSERT depending on the route remembering to pass createdAt —
// e.g. POST /api/projects failed with
//   null value in column "created_at" of relation "projects" violates not-null
// These hooks populate the values for any model that declares the attributes, so the
// guarantee lives in one place instead of ~100 call sites. Models without the
// attributes (ard_settings, ard_test_group_members, …) are untouched.
function stampTimestamps(instance: any, { isUpdate = false } = {}): void {
  const attributes = (instance?.constructor as any)?.getAttributes?.() ?? {}
  const now = new Date()
  if (!isUpdate && attributes.createdAt && instance.getDataValue('createdAt') == null) {
    instance.setDataValue('createdAt', now)
  }
  if (attributes.updatedAt && (isUpdate || instance.getDataValue('updatedAt') == null)) {
    instance.setDataValue('updatedAt', now)
  }
}

sequelize.addHook('beforeCreate', (instance: any) => stampTimestamps(instance))
sequelize.addHook('beforeUpdate', (instance: any) => stampTimestamps(instance, { isUpdate: true }))
sequelize.addHook('beforeBulkCreate', (instances: any[]) => {
  for (const instance of instances) stampTimestamps(instance)
})
