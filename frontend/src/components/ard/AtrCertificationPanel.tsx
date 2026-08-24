import React from 'react'
import { App, Button, Input, Space, Table, Tag, Typography, Upload } from 'antd'
import { Paperclip, Upload as UploadIcon, Download, Trash2 } from 'lucide-react'
import { ardUploadsApi } from '../../api/ard-uploads'

const { Text } = Typography

export interface CertificationAttachmentMeta {
  id?: string
  name?: string
  documentName?: string
  sizeLabel?: string
  uploadedAt?: string
  attachmentType?: string
  sizeBytes?: number
  downloadUrl?: string
  fileName?: string
  certifiedBy?: string
  certifiedAt?: string
  remarks?: string
}

interface AtrCertificationPanelProps {
  atrId: string
  attachment?: CertificationAttachmentMeta | null
  readOnly?: boolean
  onChange: (attachment: CertificationAttachmentMeta | null) => void
}

function toCertAttachment(uploaded: {
  id: string
  name: string
  sizeBytes?: number
  createdAt?: string
  downloadUrl?: string
}): CertificationAttachmentMeta {
  const bytes = uploaded.sizeBytes || 0
  return {
    id: uploaded.id,
    name: uploaded.name,
    documentName: uploaded.name,
    sizeLabel: bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '—',
    uploadedAt: uploaded.createdAt || new Date().toISOString(),
    attachmentType: 'Certification',
    sizeBytes: bytes,
    downloadUrl: uploaded.downloadUrl,
  }
}

export const AtrCertificationPanel: React.FC<AtrCertificationPanelProps> = ({
  atrId,
  attachment,
  readOnly = false,
  onChange,
}) => {
  const { message } = App.useApp()

  async function uploadCert(file: File) {
    if (!atrId || atrId.startsWith('new-')) {
      message.warning('Save the ATR before uploading the certification report')
      return
    }
    try {
      const uploaded = await ardUploadsApi.upload('atr_form', atrId, file, file.name, 'Certification Report')
      const certObj = toCertAttachment(uploaded)
      onChange(certObj)
      message.success('Certification report uploaded')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  async function removeCert() {
    if (!attachment) return
    try {
      if (attachment.id) {
        await ardUploadsApi.remove(attachment.id)
      }
      onChange(null)
      message.success('Certification report removed')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to remove file')
    }
  }

  async function downloadCert() {
    if (!attachment) return
    try {
      if (attachment.id) {
        const { blob, filename } = await ardUploadsApi.downloadBlob(attachment.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = attachment.documentName || attachment.name || filename || 'certification-report'
        a.click()
        URL.revokeObjectURL(url)
      } else if (attachment.downloadUrl) {
        window.open(attachment.downloadUrl, '_blank')
      } else {
        message.info('Certification metadata recorded')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Download failed')
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <div className="mb-3">
        <h5 className="font-semibold text-slate-800 text-sm">Certification Report</h5>
        <Text type="secondary" className="text-xs">
          Required before closure when the form type mandates certification. Stored separately from supporting attachments.
        </Text>
      </div>

      {attachment ? (
        <Table
          size="small"
          pagination={false}
          rowKey={(r) => r.id || r.fileName || 'cert-row'}
          dataSource={[attachment]}
          columns={[
            {
              title: 'Uploaded File',
              dataIndex: 'name',
              width: 220,
              render: (name: string, row) => (
                <Space size={6}>
                  <Paperclip size={15} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-slate-800">
                    {name || row.documentName || row.fileName || 'Certification Report'}
                  </span>
                </Space>
              ),
            },
            {
              title: 'Document Name',
              dataIndex: 'documentName',
              width: 240,
              render: (v: string | undefined, row) =>
                readOnly ? (
                  <span className="text-xs text-slate-700">
                    {v || row.name || row.fileName || '—'}
                  </span>
                ) : (
                  <Input
                    variant="borderless"
                    size="small"
                    value={v || row.name || ''}
                    placeholder="Enter document title…"
                    onChange={(e) => onChange({ ...row, documentName: e.target.value })}
                    onBlur={async (e) => {
                      if (row.id) {
                        try {
                          await ardUploadsApi.updateMeta(row.id, { name: e.target.value })
                        } catch {
                          /* best effort */
                        }
                      }
                    }}
                  />
                ),
            },
            {
              title: 'Size',
              dataIndex: 'sizeLabel',
              width: 90,
              render: (s: string) => <span className="text-xs text-slate-500">{s || '—'}</span>,
            },
            {
              title: 'Type',
              width: 150,
              render: () => <Tag color="green">Certification Report</Tag>,
            },
            {
              title: 'Action',
              width: 90,
              render: () => (
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    icon={<Download size={14} />}
                    onClick={() => void downloadCert()}
                  />
                  {!readOnly ? (
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => void removeCert()}
                    />
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      ) : readOnly ? (
        <Text type="secondary" className="text-xs italic">No certification report attached.</Text>
      ) : (
        <Upload
          beforeUpload={(file) => {
            void uploadCert(file)
            return false
          }}
          showUploadList={false}
          maxCount={1}
        >
          <Button icon={<UploadIcon size={14} />} size="small">
            Upload certification report
          </Button>
        </Upload>
      )}
    </div>
  )
}
