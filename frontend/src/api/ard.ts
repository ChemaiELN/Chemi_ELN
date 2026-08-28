import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiUpload, apiDownloadBlob } from './client'

// ── ARD (Analytical R&D) ────────────────────────────────────────────────────

export interface ArdPingResponse {
  module: string
  status: string
  user: string
}

// ── Master Data ──────────────────────────────────────────────────────────

export interface AuditFields {
  createdBy: string | null
  createdAt: string | null
  updatedBy: string | null
  updatedAt: string | null
}

export interface ArdTechnique extends AuditFields {
  id: string
  code: string
  name: string
  active: boolean
}

export type ValidationType = 'NONE' | 'NMT' | 'NLT' | 'RANGE'
export type ParamType = 'INPUT' | 'OUTPUT'

export interface ResultParam {
  id: string
  name: string
  dataType: 'text' | 'number' | 'date'
  uom?: string | null
  lowerLimit?: number | null
  upperLimit?: number | null
  placeholder?: string | null
  specification?: string | null
  validationType?: ValidationType
  paramType?: ParamType
  formula?: string | null
}

export interface ArdTestConfiguration extends AuditFields {
  id: string
  code: string | null
  techniqueCode: string
  techniqueName: string
  testType: string
  testSubtype: string | null
  active: boolean
  resultParams: ResultParam[]
}

export interface ArdTestGroupMemberRef {
  id: string
  testConfigId: string
  specOverrides: Record<string, string>
}

export interface ArdTestGroup extends AuditFields {
  id: string
  name: string
  description: string | null
  active: boolean
  testConfigIds: string[]
  members?: ArdTestGroupMemberRef[]
}

export type FieldTypeCode =
  | 'text' | 'textarea' | 'number' | 'date' | 'select' | 'radio' | 'checkbox' | 'switch' | 'section'

export interface ArdAttribute extends AuditFields {
  id: string
  name: string
  label: string
  type: FieldTypeCode
  required: boolean
  maxLength: number | null
  options: { label: string; value: string }[] | null
  active: boolean
}

export interface FormTypeAttrLink {
  attributeId: string
  sequence: number
  requiredOverride?: boolean | null
  displayInReport?: boolean | null
}

export interface ArdFormType extends AuditFields {
  id: string
  code: string
  name: string
  description: string | null
  attributeLinks: FormTypeAttrLink[]
  testGroupIds: string[]
  mandateCertification: boolean
  mandateBatchNo: boolean
  mandateSampleQty: boolean
  mandateQaSubmission: boolean
  allowPostApprovalChanges: boolean
  active: boolean
}

// Matches the legacy "Template DataItems" screen exactly (product owner review
// 2026-08-20): dataType is INTEGER | TEXT | DATE | LOV. lengthCategory is never
// user-entered — the server derives it from dataType (TEXT -> LONG, else SHORT).
// LOV selectable values come from the Inventory module's shared general-lookup
// table (lovLookupType), not an ARD-local lookup.
export type ArdDataItemType = 'INTEGER' | 'TEXT' | 'DATE' | 'LOV'
export type ArdDataItemLengthCategory = 'SHORT' | 'LONG'

export interface ArdDataItem extends AuditFields {
  id: string
  name: string
  description: string | null
  dataType: ArdDataItemType
  lengthCategory: ArdDataItemLengthCategory | null
  lovLookupType: string | null
  active: boolean
}

export interface ArdContentBlock extends AuditFields {
  id: string
  name: string
  contentType: 'richtext' | 'doc' | 'excel'
  body: string | null
  displayHeight: number
  active: boolean
}

export interface ArdLookup extends AuditFields {
  id: string
  category: string
  code: string
  label: string
  description: string | null
  active: boolean
}

export interface ArdSetting {
  id: string
  key: string
  label: string
  category: string
  value: string | number | boolean
  valueType: 'boolean' | 'number' | 'text'
  description: string | null
}

export interface TechniqueEntry {
  techniqueId: string
  startDate?: string | null
  endDate?: string | null
  certificationPath?: string | null
}

export interface ArdAnalystQualification extends AuditFields {
  id: string
  userId: string
  analystName: string
  techniqueEntries: TechniqueEntry[]
  validTill?: string | null
  remarks?: string | null
  approvalStatus?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
}

export interface ArdQualificationAlert {
  id: string
  name: string
  daysBeforeExpiry: number
  active: boolean
}

export interface ArdQualificationWarning {
  analystId: string
  analystName: string
  techniqueCode: string
  techniqueName: string
  endDate: string
  daysRemaining: number
  status: 'EXPIRED' | 'EXPIRING'
}

export interface ArdMasterDataState {
  techniques: ArdTechnique[]
  chromatographyTechniqueCodes: string[]
  departments: { id: string; code: string; name: string; active: boolean }[]
  testConfigs: ArdTestConfiguration[]
  testGroups: ArdTestGroup[]
  attributes: ArdAttribute[]
  formTypes: ArdFormType[]
  lookups: ArdLookup[]
  settings: ArdSetting[]
  qualifications: ArdAnalystQualification[]
  alerts: ArdQualificationAlert[]
  dataItems: ArdDataItem[]
  contentBlocks: ArdContentBlock[]
}

// ── ATR (Analytical Test Request) ───────────────────────────────────────

export type AtrStatus =
  | 'DRAFT' | 'SAVED' | 'NEW' | 'REQUESTED' | 'DEPT_TL_APPROVED' | 'QA_PRE_APPROVAL' | 'PRE_APPROVAL_REWORK'
  | 'PENDING_CLARIFICATION' | 'CLARIFIED' | 'PARTIAL' | 'PENDING_APPROVAL'
  | 'APPROVED' | 'VERIFIED' | 'CERTIFICATION_REQUESTED' | 'CERTIFICATION_REWORK'
  | 'CERTIFIED' | 'REJECTED' | 'WITHDRAWN' | 'ENHANCEMENT_REQUESTED' | 'ACCEPTED'

export interface AtrSampleChemical {
  id: string
  name: string
  lotNo?: string
  quantity?: string
  expiryDate?: string | null
  consumedAt?: string | null
}

export interface AtrSampleTestSummary {
  id: string
  testType: string
  testSubtype: string | null
  status: string
  techniqueCode: string | null
  arNumber?: string | null
  techniqueName?: string | null
  instrumentCode?: string | null
  assignedToName?: string | null
  testConfigId?: string | null
  results?: Record<string, unknown>[]
  lowerLimit?: string | null
  upperLimit?: string | null
  limitsUom?: string | null
  resultValue?: string | null
  resultUom?: string | null
  resultStatus?: string | null
  priority?: string | null
  remarks?: string | null
  testQuantity?: string | null
}

export interface AtrSample {
  id: string
  sampleCode: string
  tests: AtrSampleTestSummary[]
  sampleType: string | null
  quantity: string | null
  uom: string | null
  packType: string | null
  storageCondition: string | null
  batchNo: string | null
  mfgDate: string | null
  expDate: string | null
  sampleDescription: string | null
  status: string
  chemicals: AtrSampleChemical[]
  manufacturedBy: string | null
  receivedBy: string | null
  preparedBy: string | null
  sampledBy: string | null
  receivedOn: string | null
  preparedOn: string | null
  sampledOn: string | null
  totalContainers: number | null
  sampledContainers: number | null
  sampleContent: string | null
  sampleIntegrity: string | null
  additionalRemarks: string | null
  internalSampleNo: string | null
  productName: string | null
  // Real integer inventory batch id (see batchApi in api/inventory.ts) — set
  // when the Batch No. column's "select from stock" picker is used, so the
  // sample links back to a real ArdAtrForm-adjacent inventory batch/pack.
  sourceBatchId?: number | null
}

export interface AtrSupportingDoc {
  id: string
  name: string
  type?: string | null
  description?: string | null
  uploadedBy: string
  uploadedAt: string
  fileSize?: number | null
  checksum?: string | null
  url?: string | null
}

export interface ClarificationMessage {
  id: string
  authorRole: string
  authorName: string
  message: string
  createdAt: string
  round?: number
}

export interface AtrForm {
  id: string
  formNo: string
  formTypeId: string | null
  formTypeName: string
  status: AtrStatus
  projectCode: string
  productName: string
  qcRef: string | null
  assignedTl: string
  assignedTlId: string | null
  qaReviewerId?: string | null
  qaReviewerName?: string | null
  mandateCertification: boolean
  schemePresent: boolean
  schemeMode: string | null
  formCategory: string | null
  reportType: string | null
  associatedExpCodes: string | null
  referenceAtrFormId: string | null
  referenceExperimentId?: string | null
  referenceExperimentCode?: string | null
  originModule?: 'ARD' | 'ADC' | 'CGT'
  originProjectId?: string | null
  originProjectCode?: string | null
  originProjectName?: string | null
  originNotebookId?: string | null
  originNotebookCode?: string | null
  originExperimentId?: string | null
  originExperimentCode?: string | null
  originSectionId?: string | null
  originSectionTitle?: string | null
  originSnapshot?: unknown
  receivedById?: string | null
  receivedAt?: string | null
  formOpen: boolean
  reassignRemarks: string | null
  withdrawRemarks: string | null
  certificationRemarks: string | null
  requestRemarks: string | null
  analysisRemarks: string | null
  objectives?: string | null
  clarifiedAt: string | null
  certifiedBy?: string | null
  certifiedAt?: string | null
  createdBy: string
  createdById: string | null
  attributeValues: Record<string, unknown>
  clarifications: ClarificationMessage[]
  certificationAttachment: Record<string, unknown> | null
  raisedBy?: string | null
  raisedOn?: string | null
  raisedAt?: string | null
  assignedTeamId?: string | null
  assignedTeamName?: string | null
  sourceDept?: string | null
  currentOwnerName?: string | null
  dateDiffForAge?: number | null
  createdAt: string | null
  updatedAt: string | null
  samples: AtrSample[]
  testCount: number
  // Legacy parity fields
  currentOwner?: string | null
  currentOwnerId?: string | null
  approvedBy?: string | null
  approvedById?: string | null
  approvedAt?: string | null
  submittedAt?: string | null
  coaGeneratedBy?: string | null
  coaGeneratedAt?: string | null
  lastUpdatedBy?: string | null
  supportingDocs?: AtrSupportingDoc[]
  workflowHistory?: unknown[]
  // G-1: QA approval remarks
  qaApproveRemarks?: string | null
  // G-2: QA rework history [{remarks, date, by}]
  qaReworkHistory?: Array<{ remarks: string; date: string; by: string }>
  // G-3: Standalone vs cross-module origin
  raisedStandalone?: boolean
  // Backend toast message
  message?: string
}

export interface AtrListResponse {
  items: AtrForm[]
  total: number
  page: number
  pageSize: number
}

// Flattened test row from GET /api/ard/tests (testOut() in ardTests.routes.ts)
// — used by the HOD's "Re-assign Test" tool. assignedTlId/assignedTl already
// reflect a test's CURRENT team (its own reassignedTlId override if it has
// one, else its parent ATR's assignedTlId).
export interface ArdTestRow {
  id: string
  atrId: string
  formNo: string
  projectCode: string | null
  productName: string | null
  sampleCode: string | null
  batchNo: string | null
  testType: string
  testSubtype: string | null
  status: string
  assignedTlId: string | null
  assignedTl: string | null
  requestedBy: string | null
  requestedOn: string | null
  remarks: string | null
  arNumber: string | null
  sourceDept: string | null
  unsatisfactoryRemarks: string | null
}

const ATR_BASE = '/api/ard/atrs'

export const ardAtrApi = {
  list: (params?: { status?: string; statuses?: string; tab?: string; q?: string; scope?: string; teamId?: string; page?: number; pageSize?: number }) =>
    apiGet<AtrListResponse>(ATR_BASE, params),
  bulkReassignForms: (body: { atrIds: string[]; tlId: string; remarks: string; password: string }) =>
    apiPost<{ updatedCount: number }>(`${ATR_BASE}/bulk-reassign`, body),
  getCounts: () => apiGet<{ counts: Record<string, number>; unassigned: number; methodDev: number }>(`${ATR_BASE}/counts`),
  get: (id: string) => apiGet<AtrForm>(`${ATR_BASE}/${id}`),
  create: (body: Record<string, unknown>) => apiPost<AtrForm>(ATR_BASE, body),
  save: (id: string, body: Record<string, unknown>) => apiPut<AtrForm>(`${ATR_BASE}/${id}`, body),
  transition: (id: string, body: Record<string, unknown>) => apiPost<AtrForm>(`${ATR_BASE}/${id}/transition`, body),
  remove: (id: string) => apiDelete<{ ok: boolean }>(`${ATR_BASE}/${id}`),
  assignTl: (id: string, body: Record<string, unknown>) => apiPost<AtrForm>(`${ATR_BASE}/${id}/assign-tl`, body),
  reassignQa: (id: string, body: { qaUserId?: string | null }) => apiPost<AtrForm>(`${ATR_BASE}/${id}/reassign-qa`, body),
  addClarification: (id: string, body: Record<string, unknown>) => apiPost<AtrForm>(`${ATR_BASE}/${id}/clarifications`, body),
  clone: (id: string, body?: Record<string, unknown>) => apiPost<AtrForm>(`${ATR_BASE}/${id}/clone`, body),
  requestCertification: (id: string, body?: { remarks?: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/request-certification`, body || {}),
  certify: (id: string, body?: { certificationRemarks?: string; password?: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/certify`, body || {}),
  certificationRework: (id: string, body?: { remarks?: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/certification-rework`, body || {}),
  linkExperiment: (id: string, body: { experimentId?: string | null; experimentCode?: string | null }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/link-experiment`, body),
  raiseEnhancement: (id: string, body: { remarks: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/raise-enhancement`, body),
  addTests: (atrId: string, sampleId: string, body: { testConfigIds?: string[]; testGroupIds?: string[]; testGroupId?: string; priority?: string; remarks?: string; quantity?: string }) =>
    apiPost<{ created: AtrSampleTestSummary[] }>(`${ATR_BASE}/${atrId}/samples/${sampleId}/tests`, body),
  removeTest: (atrId: string, sampleId: string, testId: string) =>
    apiDelete<{ ok: boolean }>(`${ATR_BASE}/${atrId}/samples/${sampleId}/tests/${testId}`),
  changeOwner: (id: string, body: { newOwnerId: string; remarks: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${id}/change-owner`, body),
  patchSample: (atrId: string, sampleId: string, body: { internalSampleNo?: string | null; productName?: string | null }) =>
    apiPatch<AtrSample>(`${ATR_BASE}/${atrId}/samples/${sampleId}`, body),
  takeoverTest: (atrId: string, testId: string, body: { targetUserId?: string; remarks?: string }) =>
    apiPost<AtrSampleTestSummary>(`/api/ard/tests/${atrId}/${testId}/takeover`, body),
  unlockTest: (atrId: string, testId: string, body: { actionRemarks?: string; actorUserName?: string }) =>
    apiPost<AtrSampleTestSummary>(`/api/ard/tests/${atrId}/${testId}/unlock`, body),
  bulkAssign: (body: { testIds: { atrId: string; testId: string }[]; analystId: string; analystName: string; actionRemarks?: string }) =>
    apiPost<{ assigned: number; skipped: number }>('/api/ard/tests/bulk-assign', body),
  listTests: (params?: { tlId?: string; q?: string; pageSize?: number }) =>
    apiGet<{ items: ArdTestRow[]; total: number }>('/api/ard/tests', params),
  bulkReassignTeam: (body: { testIds: string[]; tlId: string; remarks: string; password: string }) =>
    apiPost<{ updatedCount: number }>('/api/ard/tests/bulk-reassign-team', body),
  unsatisfactoryReport: (params?: { applyDate?: boolean; from?: string; to?: string }) =>
    apiGet<ArdTestRow[]>('/api/ard/tests/unsatisfactory-report', params),
  getSupportingDocs: (atrId: string) =>
    apiGet<{ items: AtrSupportingDoc[] }>(`${ATR_BASE}/${atrId}/supporting-docs`),
  addSupportingDoc: (atrId: string, body: { name: string; type?: string; description?: string; url?: string; fileSize?: number; checksum?: string }) =>
    apiPost<AtrForm>(`${ATR_BASE}/${atrId}/supporting-docs`, body),
  removeSupportingDoc: (atrId: string, docId: string) =>
    apiDelete<AtrForm>(`${ATR_BASE}/${atrId}/supporting-docs/${docId}`),
}

// ── Templates ────────────────────────────────────────────────────────────

export type TemplateStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'REWORK' | 'PUBLISHED' | 'SUPERSEDED'
export type SectionType =
  | 'richtext' | 'params' | 'table' | 'combined' | 'preconfigured_excel'
  | 'standard_preparation' | 'data_item' | 'autocomplete_data_item'
  | 'weighing' | 'ph' | 'equipment' | 'column' | 'chemical'
  | 'quantitative_result' | 'further_actions' | 'sample' | 'sample_details'
  | 'content_block'

export interface TemplateSection {
  id: string
  title: string
  type: SectionType
  columns?: { key: string; label: string; title?: string }[]
  children?: TemplateSection[]
  dataItemId?: string
  required?: boolean
  sequence?: number
  [key: string]: unknown
}

export interface ArdTemplateDoc {
  id: string
  familyId: string
  name: string
  code?: string | null
  templateType: string | null
  description: string | null
  version: number
  status: TemplateStatus
  reviewRemarks: string | null
  remarks: string | null
  approvedBy: string | null
  approvedOn: string | null
  createdBy: string | null
  createdById: string | null
  createdAt: string | null
  updatedAt: string | null
  sections: TemplateSection[]
  deptId?: string | null
  activationDate?: string | null
  lastUpdatedBy?: string | null
  lastUpdatedById?: string | null
  includeWeighing?: boolean
  includePh?: boolean
  includeChemicals?: boolean
  includeSampleDetails?: boolean
  includeEquipment?: boolean
  includeColumn?: boolean
  includeAttachments?: boolean
  includeResults?: boolean
  includeConclusion?: boolean
  includeCdsReport?: boolean
  includeExperimentParameters?: boolean
}

const TEMPLATE_BASE = '/api/ard/templates'

// §1.6: per-attachment flags for a section attached to one template version —
// the wire shape ardTemplateApi.save() now sends for `sections`, replacing the
// old inline-content array.
export interface ArdTemplateSectionAttachment {
  sectionId: string
  includeInCloning?: boolean
  includeInEmpower?: boolean
  updateSampleWeights?: boolean
  updateResultSample?: boolean
  includeReadWeighingExcel?: boolean
  isMandatory?: boolean
}

export interface ArdTemplateSectionAttachmentRow extends ArdTemplateSectionAttachment {
  id: string
  sequenceNumber: number
  section: { id: string; name: string; sectionType: SectionType; description: string | null; active: boolean } | null
}

export interface ArdTemplatePreviewSection {
  sectionId: string
  name: string | null
  sectionType: SectionType | null
  sequenceNumber: number
  isMandatory?: boolean
  richtext?: { editorHeight: number | null; editorWidth: number | null; defaultContent: string | null }
  datatable?: { name: string | null; description: string | null; typicalRowCount: number; columns: { dataItemId: string | null; columnKey?: string | null; columnLabel?: string | null; sequenceNumber: number; relativeWidth: number; isMandatory: boolean }[] }
  embeddedFile?: { fileName: string | null; mappingFileName: string | null; hasFile: boolean; workbookData?: Record<string, unknown> | null; metadata?: Record<string, unknown> | null }
  dataItemLinks?: { dataItemId: string; name: string; dataType: string; lengthCategory: string | null; isMandatory: boolean }[]
  contentBlock?: { id: string; name: string; contentType: string; body: string | null; active: boolean } | null
}

export const ardTemplateApi = {
  sectionTypes: () => apiGet<{ type: SectionType; label: string; configurable: string; fixed: boolean }[]>(`${TEMPLATE_BASE}/section-types`),
  list: (params?: { status?: string; q?: string; page?: number; pageSize?: number }) =>
    apiGet<{ items: ArdTemplateDoc[]; total: number; page: number; pageSize: number }>(TEMPLATE_BASE, params),
  published: () => apiGet<{ items: ArdTemplateDoc[] }>(`${TEMPLATE_BASE}/published`),
  get: (id: string) => apiGet<ArdTemplateDoc>(`${TEMPLATE_BASE}/${id}`),
  experimentCount: (id: string) => apiGet<{ count: number }>(`${TEMPLATE_BASE}/${id}/experiment-count`),
  sections: (id: string) => apiGet<{ items: ArdTemplateSectionAttachmentRow[] }>(`${TEMPLATE_BASE}/${id}/sections`),
  preview: (id: string) => apiGet<{ templateId: string; name: string; status: TemplateStatus; sections: ArdTemplatePreviewSection[] }>(`${TEMPLATE_BASE}/${id}/preview`),
  create: (body: Record<string, unknown>) => apiPost<ArdTemplateDoc>(TEMPLATE_BASE, body),
  save: (id: string, body: Record<string, unknown>) => apiPut<ArdTemplateDoc>(`${TEMPLATE_BASE}/${id}`, body),
  transition: (id: string, body: Record<string, unknown>) => apiPost<ArdTemplateDoc>(`${TEMPLATE_BASE}/${id}/transition`, body),
  clone: (id: string) => apiPost<ArdTemplateDoc>(`${TEMPLATE_BASE}/${id}/clone`),
  newVersion: (id: string) => apiPost<ArdTemplateDoc>(`${TEMPLATE_BASE}/${id}/new-version`),
  delete: (id: string) => apiDelete<void>(`${TEMPLATE_BASE}/${id}`),
}

// ── ARD Sections (reusable master data — rearchitecture prompt §1.1-§1.9) ───

export interface ArdSectionColumn {
  id?: string
  dataItemId?: string | null
  dataItemName?: string
  // Old's fixed free-text GxP preset (Lab Component sections use this instead
  // of a Master Data link) — see migration 20260825000003.
  columnKey?: string | null
  columnLabel?: string | null
  sequenceNumber: number
  relativeWidth: number
  isMandatory: boolean
}

export interface ArdSectionDataItemLink {
  id?: string
  dataItemId: string
  dataItemName?: string
  dataItemType?: string
  sequenceNumber: number
  isMandatory: boolean
}

export interface ArdMasterSection {
  id: string
  name: string
  description: string | null
  uniqueIdentifier: string | null
  sectionType: SectionType
  deptId: string | null
  active: boolean
  createdById: string | null
  createdBy?: string | null
  createdAt: string | null
  lastUpdatedById: string | null
  updatedBy?: string | null
  updatedAt: string | null
  richtext?: { editorHeight: number | null; editorWidth: number | null; defaultContent: string | null } | null
  datatable?: { id: string; name: string | null; description: string | null; typicalRowCount: number; columns: ArdSectionColumn[] } | null
  embeddedFile?: { fileName: string | null; mappingFileName: string | null; hasFile: boolean; hasMappingFile: boolean; workbookData?: Record<string, unknown> | null; metadata?: Record<string, unknown> | null } | null
  dataItemLinks?: ArdSectionDataItemLink[]
  contentBlockId?: string | null
  contentBlock?: { id: string; name: string; contentType: string; body: string | null; active: boolean } | null
}

const SECTION_BASE = '/api/ard/sections'

export const ardSectionApi = {
  list: (params?: { sectionType?: string; is_active?: string; q?: string; page?: number; pageSize?: number }) =>
    apiGet<{ items: ArdMasterSection[]; total: number; page: number; pageSize: number }>(SECTION_BASE, params),
  get: (id: string) => apiGet<ArdMasterSection>(`${SECTION_BASE}/${id}`),
  create: (body: Record<string, unknown>) => apiPost<ArdMasterSection>(SECTION_BASE, body),
  save: (id: string, body: Record<string, unknown>) => apiPut<ArdMasterSection>(`${SECTION_BASE}/${id}`, body),
  delete: (id: string) => apiDelete<void>(`${SECTION_BASE}/${id}`),
  events: (id: string) => apiGet<{ items: unknown[] }>(`${SECTION_BASE}/${id}/events`),
  uploadEmbeddedFile: (id: string, file: File, mappingFile?: File) => {
    const form = new FormData()
    form.append('file', file)
    if (mappingFile) form.append('mappingFile', mappingFile)
    return apiUpload<{ fileName: string; mappingFileName: string | null; hasFile: boolean; hasMappingFile: boolean }>(`${SECTION_BASE}/${id}/embedded-file`, form)
  },
  // Preview-only conversion — no section id, nothing persisted. Lets the Add
  // Section form render the live spreadsheet the moment a file is picked,
  // before the section itself has been saved.
  parseEmbeddedFile: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiUpload<{ fileName: string; workbookData: Record<string, unknown>; metadata: Record<string, unknown> }>(`${SECTION_BASE}/parse-embedded-file`, form)
  },
}

// ── ARD Data Items — new canonical router (rearchitecture prompt §3.2) ──────
// Supersedes ardApi.saveDataItem (still used by the legacy master-data bundle
// tab) — this is the dedicated router the Sections builder and a future
// standalone Data Items admin page should use.

const DATA_ITEM_BASE = '/api/ard/data-items'

export const ardDataItemApi = {
  list: (params?: { is_active?: string; data_type?: string; q?: string; page?: number; pageSize?: number }) =>
    apiGet<{ items: ArdDataItem[]; total: number; page: number; pageSize: number }>(DATA_ITEM_BASE, params),
  lovLookupTypes: () => apiGet<{ items: string[] }>(`${DATA_ITEM_BASE}/lov-lookup-types`),
  get: (id: string) => apiGet<ArdDataItem>(`${DATA_ITEM_BASE}/${id}`),
  create: (body: Record<string, unknown>) => apiPost<ArdDataItem>(DATA_ITEM_BASE, body),
  save: (id: string, body: Record<string, unknown>) => apiPut<ArdDataItem>(`${DATA_ITEM_BASE}/${id}`, body),
  delete: (id: string) => apiDelete<void>(`${DATA_ITEM_BASE}/${id}`),
}

// ── Experiments ──────────────────────────────────────────────────────────

export type ExperimentStatus =
  | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REWORK' | 'VERIFICATION_REQUESTED' | 'VERIFICATION_REWORK' | 'VERIFIED' | 'UNLOCK_REQUESTED' | 'UNLOCKED' | 'DEACTIVATED'

export interface RefExperiment {
  code: string
  remarks?: string
  addedBy?: string
  addedAt?: string
}

export interface VersionSnapshot {
  version: number
  savedAt: string
  savedBy: string
  status: string
  sectionSummary: Record<string, { hasData: boolean; count: number; hash: string }>
}

export interface VersionsResponse {
  currentVersion: number
  snapshots: VersionSnapshot[]
  statusHistory: { from: string; to: string; by: string; at: string; remarks?: string }[]
}

export interface VersionCompareResponse {
  v1: VersionSnapshot
  v2: VersionSnapshot
  changes: Record<string, boolean>
}

export interface ExperimentLockInfo {
  locked: boolean
  lockedBy: string | null
  lockedByUserId: string | null
  expiresAt: string | null
}

export interface SectionCommentEntry {
  id: string
  sectionKey: string
  sectionId?: string
  comment: string
  by: string
  byName: string
  authorRole?: string | null
  at: string
}

export interface ArdExperimentDoc {
  id: string
  code: string
  templateId: string | null
  templateName: string | null
  status: ExperimentStatus
  version: number
  sectionDefs: TemplateSection[]
  sections: Record<string, unknown>
  history: { from: string; to: string; by: string; at: string; remarks?: string }[]
  linkedSamples: unknown[]
  referenceExperiments: RefExperiment[]
  clarifications: unknown[]
  sectionComments: SectionCommentEntry[]
  notebookId: string | null
  projectId: string | null
  projectStpId: string | null
  testType: string | null
  testSubtype: string | null
  highlighted: boolean
  reviewerId: string | null
  reviewerName: string | null
  aimAchieved: boolean | null
  aimRemarks: string | null
  aim: string | null
  conclusion: string | null
  contributors: { userId: string; userName: string; at: string }[]
  resultParameters?: Record<string, unknown>[] | null
  createdById: string | null
  createdAt: string | null
  updatedAt: string | null
  submittedById?: string | null
  submittedAt?: string | null
  approvedById?: string | null
  approvedAt?: string | null
  printedBy?: string | null
  printedAt?: string | null
}

export interface OngoingExperimentItem {
  id: string
  code: string
  templateName: string | null
  status: string
  aim: string | null
  projectCode: string | null
  productName: string | null
  ageDays: number | null
  notebookId: string | null
  createdAt: string | null
}

export interface ReviewCommentItem {
  id: string
  code: string
  templateName: string | null
  aim: string | null
  projectCode: string | null
  productName: string | null
  notebookType: string | null
  linkedAtrIds: string[]
  clarifications: { id?: string; message?: string; by?: string; byName?: string; at?: string }[]
  createdByName: string | null
  createdAt: string | null
  ageDays: number | null
}

export interface PendingReviewItem {
  id: string
  code: string
  templateName: string | null
  status: string
  submittedBy: string | null
  submittedAt: string | null
  submittedTo: string | null
  aim: string | null
  requestCount: number
  projectCode: string | null
  productName: string | null
  ageDays: number | null
  notebookId: string | null
  createdAt: string | null
  history: { action?: string; from?: string; to?: string; by?: string; byName?: string; at?: string; remarks?: string }[]
}

const EXPERIMENT_BASE = '/api/ard/experiments'

export const ardExperimentApi = {
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    apiGet<{ items: ArdExperimentDoc[]; total: number; page: number; pageSize: number }>(EXPERIMENT_BASE, params),
  get: (id: string) => apiGet<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}`),
  create: (body: Record<string, unknown>) => apiPost<ArdExperimentDoc>(EXPERIMENT_BASE, body),
  patch: (id: string, body: Record<string, unknown>) => apiPatch<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}`, body),
  transition: (id: string, body: Record<string, unknown>) => apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/transition`, body),
  clone: (id: string) => apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/clone`),
  cloneBlank: (id: string) => apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/clone-blank`),
  downloadReport: (id: string) => apiDownloadBlob(`${EXPERIMENT_BASE}/${id}/report.pdf`),
  versions: (id: string) => apiGet<VersionsResponse>(`${EXPERIMENT_BASE}/${id}/versions`),
  compareVersions: (id: string, v1: number, v2: number) =>
    apiGet<VersionCompareResponse>(`${EXPERIMENT_BASE}/${id}/versions/compare`, { v1, v2 }),
  getByCode: (code: string) => apiGet<ArdExperimentDoc>(`${EXPERIMENT_BASE}/lookup/by-code/${encodeURIComponent(code)}`),
  // Backend schema is section_key/comment (snake_case, required) — this
  // previously sent sectionId/message, which don't exist on the schema at
  // all, so every call 422'd with "section_key: Required". Never had a
  // caller to surface the bug until now.
  addComment: (id: string, body: { sectionKey: string; comment: string }) =>
    apiPost<SectionCommentEntry>(`${EXPERIMENT_BASE}/${id}/section-comments`, { section_key: body.sectionKey, comment: body.comment }),
  deleteComment: (id: string, commentId: string) =>
    apiDelete<void>(`${EXPERIMENT_BASE}/${id}/section-comments/${commentId}`),
  addClarification: (id: string, body: { message: string }) =>
    apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/clarifications`, body),
  deleteClarification: (id: string, clarId: string) =>
    apiDelete<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/clarifications/${clarId}`),
  getPostAnalytical: (id: string) =>
    apiGet<{ items: Record<string, unknown>[] }>(`${EXPERIMENT_BASE}/${id}/post-analytical`),
  addPostAnalytical: (id: string, body: { parameter: string; observation: string; unit?: string }) =>
    apiPost<{ items: Record<string, unknown>[] }>(`${EXPERIMENT_BASE}/${id}/post-analytical`, body),
  deletePostAnalytical: (id: string, itemId: string) =>
    apiDelete<{ items: Record<string, unknown>[] }>(`${EXPERIMENT_BASE}/${id}/post-analytical/${itemId}`),
  takeover: (id: string, body: { newAnalystId: string; remarks: string }) =>
    apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/takeover`, body),
  // The backend schema requires reviewer_id/reviewer_name specifically (snake_case,
  // not aliased from camelCase — normalizeRequestCase only adds camelCase aliases
  // for snake_case input, never the reverse) — sending reviewerId/remarks here
  // always 422'd with "reviewer_id: Required", silently breaking every caller.
  reassignReviewer: (id: string, body: { reviewerId: string; reviewerName?: string }) =>
    apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/reassign-reviewer`, { reviewer_id: body.reviewerId, reviewer_name: body.reviewerName }),
  bulkTakeOverReview: (body: { experimentIds: string[]; remarks: string; password: string }) =>
    apiPost<{ updatedCount: number }>(`${EXPERIMENT_BASE}/bulk-take-over-review`, body),
  restore: (id: string, remarks?: string) =>
    apiPost<ArdExperimentDoc>(`${EXPERIMENT_BASE}/${id}/restore`, { remarks }),
  toggleHighlight: (id: string) =>
    apiPatch<{ highlighted: boolean }>(`${EXPERIMENT_BASE}/${id}/highlight`, {}),
  ongoing: () => apiGet<{ items: OngoingExperimentItem[]; total: number }>(`${EXPERIMENT_BASE}/ongoing`),
  pendingReview: (perspective: 'mine' | 'others', status?: 'SUBMITTED' | 'VERIFICATION_REQUESTED') =>
    apiGet<{ items: PendingReviewItem[]; total: number }>(`${EXPERIMENT_BASE}/pending-review`, { perspective, status }),
  reviewComments: (perspective: 'mine' | 'all') =>
    apiGet<{ items: ReviewCommentItem[]; total: number }>(`${EXPERIMENT_BASE}/review-comments`, { perspective }),
  acquireLock: (id: string) => apiPost<ExperimentLockInfo>(`${EXPERIMENT_BASE}/${id}/acquire-lock`),
  releaseLock: (id: string) => apiDelete<{ released: boolean }>(`${EXPERIMENT_BASE}/${id}/lock`),
  checkLock: (id: string) => apiGet<ExperimentLockInfo>(`${EXPERIMENT_BASE}/${id}/check-lock`),
  stpUpdateSampleWeights: (id: string, weights?: Record<string, string>) =>
    apiPost<{ ok: boolean; updatedFields: number }>(`${EXPERIMENT_BASE}/${id}/stp/update-sample-weights`, { weights }),
  stpImportEmpower: (id: string, csvData: string, sectionId?: string) =>
    apiPost<{ ok: boolean; rowsImported: number; sectionId: string }>(`${EXPERIMENT_BASE}/${id}/stp/import-empower`, { csvData, sectionId }),
  stpPushResults: (id: string, results: Record<string, unknown>[], testId?: string) =>
    apiPost<{ ok: boolean; testId: string; resultsCount: number }>(`${EXPERIMENT_BASE}/${id}/stp/push-results`, { results, testId }),
}

// ── QC-TRF ───────────────────────────────────────────────────────────────

export type QcTrfStatus = 'DRAFT' | 'SAVED' | 'SUBMITTED' | 'REGISTERED' | 'REJECTED'

export interface QcTrfForm {
  id: string
  formNo: string
  status: QcTrfStatus
  projectCode: string
  projectName: string
  sampleCode: string
  sampleType: string | null
  batchNo: string
  sampleQty: string | null
  sampleQtyUom: string | null
  specificationName: string | null
  specificationId: string | null
  specificationVersion: string | null
  remarks: string | null
  createdBy: string
  createdAt: string | null
}

const QC_TRF_BASE = '/api/ard/qc-trf'

export const ardQcTrfApi = {
  list: (params?: { status?: string; q?: string; view?: string; page?: number; pageSize?: number }) =>
    apiGet<{ items: QcTrfForm[]; total: number }>(QC_TRF_BASE, params),
  get: (id: string) => apiGet<QcTrfForm>(`${QC_TRF_BASE}/${id}`),
  create: (body: Record<string, unknown>) => apiPost<QcTrfForm>(QC_TRF_BASE, body),
  save: (id: string, body: Record<string, unknown>) => apiPut<QcTrfForm>(`${QC_TRF_BASE}/${id}`, body),
  transition: (id: string, body: Record<string, unknown>) => apiPost<QcTrfForm>(`${QC_TRF_BASE}/${id}/transition`, body),
  addTests: (id: string, body: { testRequests: unknown[] }) => apiPost<QcTrfForm>(`${QC_TRF_BASE}/${id}/add-tests`, body),
  remove: (id: string) => apiDelete<{ ok: boolean }>(`${QC_TRF_BASE}/${id}`),
}

// ── Search / Team / Audit / Notifications ───────────────────────────────

export interface SearchResult { id: string; kind: string; title: string; subtitle: string | null; status: string; atrId?: string }
export interface TeamMember { name: string; role: string }
export interface TeamGroup { id: string; teamName: string; hodId?: string | null; tlId?: string | null; tlIds?: string[]; hodName: string | null; tlName: string | null; tlNames?: string[]; description: string | null; active: boolean; memberIds?: string[]; members: TeamMember[]; tls?: any[]; tlAnalystMap?: Record<string, string[]>; tlAnalystCanReview?: Record<string, boolean> }
export interface WorkloadRow { userId: string; userName: string; techniques: number; assigned: number; inProgress: number; pendingVerify: number; rework: number; experiments: number; total: number }
export interface TeamEvent { id: string; experimentCode: string | null; experimentId: string; status: string; updatedBy: string; updatedAt: string | null }
export interface AuditRow { id: string; at: string | null; kind: string; entity: string; action: string; actor: string; entityId: string; entityType: string }
export interface ArdNotification { id: string; title: string; body: string; href: string; at: string | null; tone: string; read: boolean; category?: string }

export type TeamUserDto = { id: string; username: string; full_name: string; role_code: string; department_code: string | null }

export interface ArdTeamDirectoryItem {
  id: string
  teamName: string
  hodId?: string | null
  hodName?: string | null
  tlIds?: string[]
  tlNames?: string[]
  active?: boolean
}

export const ardOpsApi = {
  search: (q: string) => apiGet<{ items: SearchResult[] }>('/api/ard/search', { q }),
  teamDirectory: () => apiGet<{ items: TeamGroup[] }>('/api/ard/team/directory'),
  listDirectory: () => apiGet<{ items: ArdTeamDirectoryItem[] }>('/api/ard/team/directory'),
  teamUsers: () => apiGet<{ items: TeamUserDto[] }>('/api/ard/team/users'),
  teamWorkload: () => apiGet<{ items: WorkloadRow[] }>('/api/ard/team/workload'),
  teamEvents: () => apiGet<{ items: TeamEvent[] }>('/api/ard/team/events'),
  createTeam: (body: { name: string; description?: string; hodId?: string; tlIds?: string[]; memberIds?: string[]; tlAnalystMap?: Record<string, string[]> }) =>
    apiPost<{ id: string; name: string }>('/api/ard/team/teams', body),
  updateTeam: (id: string, body: { name?: string; description?: string; hodId?: string; tlIds?: string[]; tlAnalystMap?: Record<string, string[]>; tlAnalystCanReview?: Record<string, boolean>; isActive?: boolean }) =>
    apiPut<{ ok: boolean }>(`/api/ard/team/teams/${id}`, body),
  deleteTeam: (id: string) =>
    apiDelete<{ ok: boolean }>(`/api/ard/team/teams/${id}`),
  audit: (params?: { kind?: string; actor?: string; q?: string; date_from?: string; date_to?: string; page?: number }) =>
    apiGet<{ items: AuditRow[]; total: number }>('/api/ard/audit', params),
  notifications: () => apiGet<{ items: ArdNotification[]; unread: number }>('/api/ard/notifications'),
  markRead: (ids: string[]) => apiPost('/api/ard/notifications/mark-read', { ids }),
  markAllRead: () => apiPost('/api/ard/notifications/mark-all-read'),
}

export const ardTeamApi = ardOpsApi

// ── Reports ──────────────────────────────────────────────────────────────

export interface ReportTable { headers: string[]; rows: (string | number)[][] }

export interface ArdDashboardMetrics {
  kpis: {
    totalAtrs: number
    pendingAtrs: number
    approvedAtrs: number
    totalExperiments: number
    inProgressExperiments: number
    submittedExperiments: number
    totalTests: number
    pendingVerificationTests: number
    verifiedTests: number
    reworkTests: number
    expiringQuals: number
    totalTrfs: number
  }
  atrStatusBreakdown: { status: string; count: number }[]
  testTechniqueBreakdown: { technique: string; count: number }[]
  pendingQueue: {
    id: string
    title: string
    subtitle: string
    href: string
    type: string
    at: string | null
    tone: string
  }[]
  recentEvents: {
    id: string
    entityType: string
    entityId: string | null
    action: string
    detail: string | null
    by: string
    at: string | null
  }[]
}

export interface ArdMyDashboardMetrics {
  roleCode: string
  deptCode: string
  kpis: Record<string, number>
  myTests?: { id: string; testType: string; subtype: string | null; status: string; atrFormNo: string | null; atrId: string | null; productName: string | null; arNumber: string | null; at: string | null }[]
  myExperiments?: { id: string; code: string; status: string; templateName: string | null }[]
  myAtrs?: { id: string; formNo: string; productName: string; status: string; at?: string | null }[]
  teamTests?: { id: string; testType: string; status: string; assignedTo: string | null; arNumber: string | null }[]
  atrStatusBreakdown?: { status: string; count: number }[]
  qaQueue?: { id: string; formNo: string; productName: string; status: string; at: string | null }[]
  // Also includes full ArdDashboardMetrics fields when role is HOD/admin
  pendingQueue?: ArdDashboardMetrics['pendingQueue']
  recentEvents?: ArdDashboardMetrics['recentEvents']
  testTechniqueBreakdown?: { technique: string; count: number }[]
}

const REPORTS_BASE = '/api/ard/reports'

export type ReportKey =
  | 'batch-summary'
  | 'unsatisfactory-tests'
  | 'experiment-events'
  | 'delayed-atrs'
  | 'inactive-experiments'
  | 'delayed-approvals'
  | 'project-report'

export const ardReportsApi = {
  batchSummary: () => apiGet<ReportTable>(`${REPORTS_BASE}/batch-summary`),
  unsatisfactoryTests: () => apiGet<ReportTable>(`${REPORTS_BASE}/unsatisfactory-tests`),
  experimentEvents: () => apiGet<ReportTable>(`${REPORTS_BASE}/experiment-events`),
  delayedAtrs: (days = 7) => apiGet<ReportTable>(`${REPORTS_BASE}/delayed-atrs?days=${days}`),
  inactiveExperiments: (days = 14) => apiGet<ReportTable>(`${REPORTS_BASE}/inactive-experiments?days=${days}`),
  delayedApprovals: (days = 3) => apiGet<ReportTable>(`${REPORTS_BASE}/delayed-approvals?days=${days}`),
  projectReport: () => apiGet<ReportTable>(`${REPORTS_BASE}/project-report`),
  downloadXlsx: (report: ReportKey, days?: number) => {
    const qs = days !== undefined ? `?days=${days}` : ''
    return apiDownloadBlob(`${REPORTS_BASE}/${report}.xlsx${qs}`)
  },
  downloadPdf: (report: ReportKey, days?: number) => {
    const qs = days !== undefined ? `?days=${days}` : ''
    return apiDownloadBlob(`${REPORTS_BASE}/${report}.pdf${qs}`)
  },
}

const BASE = '/api/ard/master-data'

export const ardApi = {
  ping: () => apiGet<ArdPingResponse>('/api/ard/ping'),
  dashboardMetrics: () => apiGet<ArdDashboardMetrics>('/api/ard/dashboard/metrics'),
  myDashboardMetrics: () => apiGet<ArdMyDashboardMetrics>('/api/ard/dashboard/my-metrics'),

  getMasterData: () => apiGet<ArdMasterDataState>(BASE),
  lookupCategories: () => apiGet<string[]>(`${BASE}/lookup-categories`),
  settingsMap: () => apiGet<Record<string, { value: string | number | boolean; valueType: string }>>(`${BASE}/settings-map`),

  saveTechnique: (body: Partial<ArdTechnique> & { code: string; name: string }) =>
    apiPost<ArdTechnique>(`${BASE}/techniques`, body),

  saveTestConfig: (body: Record<string, unknown>) =>
    apiPost<ArdTestConfiguration>(`${BASE}/test-configs`, body),

  saveTestGroup: (body: Record<string, unknown>) =>
    apiPost<ArdTestGroup>(`${BASE}/test-groups`, body),

  saveTestGroupSpecOverride: (groupId: string, memberId: string, paramId: string, specification: string | null) =>
    apiPatch<ArdTestGroup>(`${BASE}/test-groups/${groupId}/members/${memberId}/spec-override`, { paramId, specification }),

  deleteTestGroup: (id: string) => apiDelete<void>(`${BASE}/test-groups/${id}`),

  saveAttribute: (body: Record<string, unknown>) =>
    apiPost<ArdAttribute>(`${BASE}/attributes`, body),

  saveFormType: (body: Record<string, unknown>) =>
    apiPost<ArdFormType>(`${BASE}/form-types`, body),

  saveDataItem: (body: Record<string, unknown>) =>
    apiPost<ArdDataItem>(`${BASE}/data-items`, body),

  listContentBlocks: () =>
    apiGet<{ items: ArdContentBlock[]; total: number }>(`${BASE}/content-blocks`),

  saveContentBlock: (body: Record<string, unknown>) =>
    apiPost<ArdContentBlock>(`${BASE}/content-blocks`, body),

  saveLookup: (body: Record<string, unknown>) =>
    apiPost<ArdLookup>(`${BASE}/lookups`, body),

  updateSetting: (id: string, value: unknown) =>
    apiPut<ArdSetting>(`${BASE}/settings/${id}`, { value }),

  saveQualification: (body: Record<string, unknown>) =>
    apiPost<ArdAnalystQualification>(`${BASE}/qualifications`, body),

  approveQualification: (id: string, body: { approvalStatus?: string; remarks?: string }) =>
    apiPost<ArdAnalystQualification>(`${BASE}/qualifications/${id}/approve`, body),

  uploadCertificate: (qualificationId: string, techniqueId: string, file: File) => {
    const form = new FormData()
    form.append('technique_id', techniqueId)
    form.append('file', file)
    return apiUpload<ArdAnalystQualification>(`${BASE}/qualifications/${qualificationId}/certificate`, form)
  },

  saveQualificationAlert: (body: Record<string, unknown>) =>
    apiPost<ArdQualificationAlert>(`${BASE}/qualification-alerts`, body),

  evaluateAlerts: () =>
    apiGet<{ window: number; alertsActive: number; expired: number; expiring: number; warnings: ArdQualificationWarning[] }>(
      `${BASE}/qualification-alerts/evaluate`
    ),
}

// ── Project Specifications ───────────────────────────────────────────────────

export interface ArdSpecTestParam {
  id?: string
  // Links this parameter back to the Test Configuration it was pulled from, so
  // the spec editor can group parameters by test and let the user re-sync or
  // remove a whole test at once. Absent for manually-added ad-hoc parameters.
  testConfigId?: string | null
  testType?: string | null
  testSubtype?: string | null
  techniqueName?: string | null
  // True when this row was typed in by hand (name is editable) rather than
  // pulled from the Test Configuration's own result parameters (name is
  // fixed, matching what's defined in master data).
  manualEntry?: boolean
  parameter: string
  dataType?: 'text' | 'number' | 'range' | string | null
  // NONE | NMT | NLT | RANGE — same validation scheme as Test Configuration's
  // ResultParam.validationType (numeric limit type, not a replication scheme).
  validationType?: string | null
  specLimit: string
  unit?: string | null
  testMethod?: string | null
  precision?: number | null
  lowerLimit?: number | null
  upperLimit?: number | null
  remarks?: string | null
}

export interface ArdProjectSpecification {
  id: string
  projectId: string
  specCode: string
  version: string
  title: string
  shortName?: string | null
  specType?: string | null
  description?: string | null
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  testParameters: ArdSpecTestParam[]
  submitRemarks?: string | null
  approveRemarks?: string | null
  createdBy: string
  createdById?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  updatedBy?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export const ardUserApi = {
  tlList: () => apiGet<{ id: string; username: string; full_name?: string }[]>('/api/ard/users/tl-list'),
  qaList: () => apiGet<{ id: string; username: string; full_name?: string }[]>('/api/ard/users/qa-list'),
}

export const ardProjectSpecsApi = {
  list: (projectId: string) =>
    apiGet<ArdProjectSpecification[]>(`/api/ard/projects/${projectId}/specifications`),
  create: (projectId: string, body: { specCode?: string; version?: string; title?: string; testParameters?: ArdSpecTestParam[] }) =>
    apiPost<ArdProjectSpecification>(`/api/ard/projects/${projectId}/specifications`, body),
  update: (projectId: string, specId: string, body: Partial<ArdProjectSpecification>) =>
    apiPut<ArdProjectSpecification>(`/api/ard/projects/${projectId}/specifications/${specId}`, body),
  submit: (projectId: string, specId: string, body: { remarks?: string; password: string }) =>
    apiPost<ArdProjectSpecification>(`/api/ard/projects/${projectId}/specifications/${specId}/submit`, body),
  approve: (projectId: string, specId: string, body: { remarks?: string; password: string }) =>
    apiPost<ArdProjectSpecification>(`/api/ard/projects/${projectId}/specifications/${specId}/approve`, body),
  remove: (projectId: string, specId: string) =>
    apiDelete<void>(`/api/ard/projects/${projectId}/specifications/${specId}`),
}
