import { apiGet, apiUpload, apiPatch, apiDelete, apiDownloadBlob, apiPost } from './client'

const BASE = '/api/ard/uploads'

export type ArdAttachmentType = 'certificate' | 'report' | 'data' | 'sop' | 'others'

export interface ArdAttachment {
  id: string
  entityType: string
  entityId: string
  name: string
  description?: string
  filename: string
  fileType?: string
  sizeBytes?: number
  attachmentLink?: string | null
  attachmentType?: ArdAttachmentType | null
  customTypeName?: string | null
  uploadedBy: string
  createdAt: string
  downloadUrl: string
  folderPath?: string | null
}

export const ATTACHMENT_TYPE_OPTIONS: { value: ArdAttachmentType; label: string }[] = [
  { value: 'certificate', label: 'Certificate' },
  { value: 'report', label: 'Report' },
  { value: 'data', label: 'Data' },
  { value: 'sop', label: 'SOP' },
  { value: 'others', label: 'Others' },
]

export const ardUploadsApi = {
  list(entityType: string, entityId: string): Promise<ArdAttachment[]> {
    return apiGet<ArdAttachment[]>(BASE, { entity_type: entityType, entity_id: entityId })
  },

  upload(
    entityType: string, entityId: string, file: File, name = '', description = '',
    attachmentType?: ArdAttachmentType, customTypeName?: string,
  ): Promise<ArdAttachment> {
    const fd = new FormData()
    fd.append('entity_type', entityType)
    fd.append('entity_id', entityId)
    fd.append('name', name || file.name)
    fd.append('description', description)
    if (attachmentType) fd.append('attachment_type', attachmentType)
    if (attachmentType === 'others' && customTypeName) fd.append('custom_type_name', customTypeName)
    fd.append('file', file)
    return apiUpload<ArdAttachment>(BASE, fd)
  },

  updateMeta(id: string, patch: {
    name?: string; description?: string; attachmentType?: ArdAttachmentType; customTypeName?: string; attachmentLink?: string
  }): Promise<ArdAttachment> {
    return apiPatch<ArdAttachment>(`${BASE}/${id}`, {
      name: patch.name,
      description: patch.description,
      attachment_type: patch.attachmentType,
      custom_type_name: patch.customTypeName,
      attachment_link: patch.attachmentLink,
    })
  },

  remove(id: string): Promise<void> {
    return apiDelete<void>(`${BASE}/${id}`)
  },

  async downloadBlob(id: string): Promise<{ blob: Blob; filename: string }> {
    return apiDownloadBlob(`${BASE}/${id}/download`)
  },

  addFolderLink(entityType: string, entityId: string, link: string, name?: string): Promise<ArdAttachment> {
    return apiPost<ArdAttachment>(`${BASE}/folder-link`, {
      entity_type: entityType, entity_id: entityId, attachment_link: link, name: name || link,
    })
  },
}
