import { apiGet, apiPost, apiPut, apiDelete } from './client'

export type ProjectStatus = 'OPEN' | 'CLOSED'
export type StpStatus = 'DRAFT' | 'APPROVAL_REQUIRED' | 'REWORK' | 'ACTIVE' | 'SUPERSEDED'

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

  submitStp(projectId: string, stpId: string, body?: { approverUsername?: string; description?: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/submit`, body || {})
  },
  approveStp(projectId: string, stpId: string, body?: { remarks?: string; password?: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/approve`, body || {})
  },
  returnStp(projectId: string, stpId: string, body?: { reason?: string }) {
    return apiPost<Project>(`${BASE}/${projectId}/stps/${stpId}/return`, body || {})
  },
}
