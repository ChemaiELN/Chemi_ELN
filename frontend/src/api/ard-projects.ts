import { apiGet, apiPost, apiPut, apiDelete } from './client'
import type { TemplateField } from '../pages/admin/templateBuilder/types'

export type ProjectStatus = 'OPEN' | 'CLOSED'
export type StpStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED'

export interface ProjectStp {
  id: string
  documentNo: string
  title: string
  version: string
  status: StpStatus
  stpType?: string
  stpGrade?: string
  specificationNo?: string
  weighingDetails?: boolean
  phDetails?: boolean
  columnDetails?: boolean
  chromatogramReport?: boolean
  // All three uploads are embedded, fillable spreadsheets (same Univer-backed
  // field used by the admin Template Builder / CGT), not plain file
  // attachments — each is what the STP Worksheet preview (and, for
  // Procedure, an experiment created from this STP) actually renders and
  // persists into. Same import pipeline (calcTemplateApi.importXlsx) for
  // all three — see handleSpreadsheetFilePicked.
  procedureSpreadsheet?: TemplateField['spreadsheet']
  sampleMappingSpreadsheet?: TemplateField['spreadsheet']
  stpCalculationSpreadsheet?: TemplateField['spreadsheet']
  // Legacy filename-only fields — a prior version of this form stored just
  // the picked file's name with no real upload behind it. Kept optional so
  // any already-saved STP still displays what it has; no longer written to.
  sampleMappingFile?: string
  stpProcedureFile?: string
  stpCalculationFile?: string
  description?: string
  testType?: string
  testSubtype?: string
  scope?: string
  effectiveDate?: string
  submittedBy?: string
  submittedAt?: string
  submitDescription?: string
  submitRemarks?: string | null
  approverUsername?: string
  approverName?: string
  approvedBy?: string
  approvedAt?: string
  returnedBy?: string
  returnReason?: string
  remarks?: string
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

export interface ProjectTeamMember {
  userId?: string
  userName: string
  role: string
  // Which notebooks this member has been explicitly granted access to.
  // Undefined/empty means NO notebook access (the default) — access must be
  // granted via the project's "Notebook Access" screen. HOD members always
  // get every notebook regardless of this field.
  notebookIds?: string[]
}

export interface ProjectAttribute {
  id: string
  key: string
  type?: string
  value: string
  createdBy?: string
  createdAt?: string
  updatedBy?: string
  updatedAt?: string
}

export interface ProjectAuditEntry {
  id: string
  action: string
  actorName: string
  detail?: string
  createdAt: string
}

export interface Project {
  id: string
  code: string
  name?: string
  productName: string
  productCode?: string
  description?: string
  customer?: string
  projectType?: string
  analysisType?: string
  priority?: string
  targetDate?: string
  status: ProjectStatus
  ownerName?: string
  ownerId?: string
  stpDocuments: ProjectStp[]
  team: ProjectTeamMember[]
  teamMembers?: any[]
  assignedTl?: string
  attributes: ProjectAttribute[]
  auditTrail: ProjectAuditEntry[]
  createdBy: string
  createdById?: string
  updatedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface ProjectListResult {
  items: Project[]
  total: number
  page: number
  pageSize: number
}

const BASE = '/api/ard/projects'

export const ardProjectsApi = {
  list(params?: { status?: string; q?: string; page?: number; pageSize?: number }) {
    return apiGet<ProjectListResult>(BASE, params as Record<string, unknown>)
  },

  get(id: string) {
    return apiGet<Project>(`${BASE}/${id}`)
  },

  create(body: Partial<Project> & { code: string; productName: string }) {
    return apiPost<Project>(BASE, body)
  },

  update(id: string, body: Partial<Project>) {
    return apiPut<Project>(`${BASE}/${id}`, body)
  },

  close(id: string, body?: Record<string, unknown>) {
    return apiPost<Project>(`${BASE}/${id}/close`, body || {})
  },

  deactivate(id: string, body?: Record<string, unknown>) {
    return apiPost<Project>(`${BASE}/${id}/deactivate`, body || {})
  },

  reopen(id: string, body?: Record<string, unknown>) {
    return apiPost<Project>(`${BASE}/${id}/reopen`, body || {})
  },

  remove(id: string) {
    return apiDelete(`${BASE}/${id}`)
  },

  submitStp(projectId: string, stpId: string, body: { remarks?: string; password: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/submit`, body)
  },
  approveStp(projectId: string, stpId: string, body: { remarks?: string; password: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/approve`, body)
  },
  returnStp(projectId: string, stpId: string, body?: { reason?: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/return`, body || {})
  },
}
