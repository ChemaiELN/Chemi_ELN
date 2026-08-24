import { apiGet, apiUpload, apiPatch, apiDelete, apiDownloadBlob, apiPost } from './client'

const BASE = '/api/ard/uploads'

export interface ArdAttachment {
  id: string
  entityType: string
  entityId: string
  name: string
  description?: string
  filename: string
  fileType?: string
  sizeBytes?: number
  uploadedBy: string
  createdAt: string
  downloadUrl: string
  folderPath?: string | null
}

export const ardUploadsApi = {
  list(entityType: string, entityId: string): Promise<ArdAttachment[]> {
    return apiGet<ArdAttachment[]>(BASE, { entity_type: entityType, entity_id: entityId })
  },

  upload(entityType: string, entityId: string, file: File, name = '', description = ''): Promise<ArdAttachment> {
    const fd = new FormData()
    fd.append('entity_type', entityType)
    fd.append('entity_id', entityId)
    fd.append('name', name || file.name)
    fd.append('description', description)
    fd.append('file', file)
    return apiUpload<ArdAttachment>(BASE, fd)
  },

  updateMeta(id: string, patch: { name?: string; description?: string }): Promise<ArdAttachment> {
    return apiPatch<ArdAttachment>(`${BASE}/${id}`, patch)
  },

  remove(id: string): Promise<void> {
    return apiDelete<void>(`${BASE}/${id}`)
  },

  async downloadBlob(id: string): Promise<{ blob: Blob; filename: string }> {
    return apiDownloadBlob(`${BASE}/${id}/download`)
  },

  addFolderLink(entityType: string, entityId: string, folderPath: string, name?: string): Promise<ArdAttachment> {
    return apiPost<ArdAttachment>(`${BASE}/folder-link`, { entityType, entityId, folderPath, name: name || folderPath })
  },
}
