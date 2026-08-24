import { apiGet, apiPost, apiPatch, apiDelete, apiDownloadBlob } from './client'

export interface NotebookEquipmentLink {
  id: string
  equipmentId: string
  equipmentCode: string | null
  equipmentName: string | null
  addedBy: string
  addedAt: string
}

export interface Notebook {
  id: string
  code: string
  name: string
  description: string | null
  projectId: string | null
  notebookType: string | null
  status: string
  verificationFlow?: boolean
  assignedUsers: AssignedUser[]
  resultParameters: ResultParameter[]
  auditTrail: AuditEntry[]
  equipmentIds: NotebookEquipmentLink[]
  createdBy: string
  createdById: string | null
  createdAt: string | null
  updatedAt: string | null
  experimentCount?: number
}

export interface AssignedUser {
  userId: string
  userName: string
  fullName?: string
  role: string
  canCreate?: boolean
  canEdit?: boolean
  canVerify?: boolean
  canApprove?: boolean
  canReqUnlock?: boolean
  canDeactivate?: boolean
}

export interface ResultParameter {
  id: string
  paramCode?: string
  paramName: string
  ioType?: string
  valueType?: string
  dataType?: string
  unit: string
  description?: string
  acceptanceCriteria?: string
  method?: string
}

export interface AuditEntry {
  id: string
  action: string
  actorName: string
  detail: string
  createdAt: string
}

export interface NotebookListResponse {
  items: Notebook[]
  total: number
  page: number
  pageSize: number
}

export interface ExperimentSummary {
  id: string
  code: string
  templateName: string | null
  status: string
  createdAt: string | null
  highlighted?: boolean
}

export const ardNotebooksApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiGet<NotebookListResponse>('/api/ard/notebooks', params),

  get: (id: string) => apiGet<Notebook>(`/api/ard/notebooks/${id}`),

  create: (body: Partial<Notebook> & { name: string }) =>
    apiPost<Notebook>('/api/ard/notebooks', body),

  patch: (id: string, body: Partial<Notebook> & { auditEntry?: Partial<AuditEntry> }) =>
    apiPatch<Notebook>(`/api/ard/notebooks/${id}`, body),

  delete: (id: string) => apiDelete(`/api/ard/notebooks/${id}`),

  experiments: (id: string) =>
    apiGet<{ items: ExperimentSummary[]; total: number }>(`/api/ard/notebooks/${id}/experiments`),

  listEquipment: (id: string) =>
    apiGet<{ items: NotebookEquipmentLink[] }>(`/api/ard/notebooks/${id}/equipment`),

  addEquipment: (id: string, body: { equipmentId: string; equipmentCode?: string; equipmentName?: string }) =>
    apiPost<{ items: NotebookEquipmentLink[] }>(`/api/ard/notebooks/${id}/equipment`, body),

  removeEquipment: (id: string, linkId: string) =>
    apiDelete<{ items: NotebookEquipmentLink[] }>(`/api/ard/notebooks/${id}/equipment/${linkId}`),

  reopen: (id: string, body: { remarks: string }) =>
    apiPost<Notebook>(`/api/ard/notebooks/${id}/reopen`, body),

  downloadReport: (id: string) => apiDownloadBlob(`/api/ard/notebooks/${id}/documents/report.pdf`),
}
