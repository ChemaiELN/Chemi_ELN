/**
 * Reusable file attachments panel for any ARD entity.
 * Usage: <ArdAttachmentsPanel entityType="atr_form" entityId={atrId} readOnly={false} />
 */
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Table, Spin, Alert, Tooltip, message, Popconfirm, Input, Modal, Image, Select, Form } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Upload, Download, Trash2, Paperclip, FileText, FileImage, Eye, FolderOpen, Copy, Plus, Pencil } from 'lucide-react'
import { ardUploadsApi, ATTACHMENT_TYPE_OPTIONS, type ArdAttachment, type ArdAttachmentType } from '../../api/ard-uploads'
import { glassModalProps } from '../../utils/modalStyles'
import dayjs from 'dayjs'

interface Props {
  entityType: string
  entityId: string
  readOnly?: boolean
  /** Optional label shown at the top of the panel */
  label?: string
  /** When true, shows a Folder Links section for UNC path attachments */
  folderLinkEnabled?: boolean
}

function fileIcon(fileType?: string) {
  if (!fileType) return <Paperclip size={14} className="text-slate-400" />
  if (fileType === 'folder_link') return <FolderOpen size={14} className="text-amber-500" />
  if (fileType.includes('image')) return <FileImage size={14} className="text-blue-400" />
  return <FileText size={14} className="text-red-400" />
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ArdAttachmentsPanel({ entityType, entityId, readOnly = false, label, folderLinkEnabled = false }: Props) {
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editField, setEditField] = useState<'name' | 'description'>('name')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | null>(null)
  const [folderPath, setFolderPath] = useState('')
  const [folderName, setFolderName] = useState('')
  const [pendingType, setPendingType] = useState<ArdAttachmentType | undefined>(undefined)
  const [pendingCustomType, setPendingCustomType] = useState('')
  const [editModalRow, setEditModalRow] = useState<ArdAttachment | null>(null)
  const [editForm] = Form.useForm()

  const queryKey = ['ard-attachments', entityType, entityId]

  const { data = [], isLoading, error } = useQuery<ArdAttachment[]>({
    queryKey,
    queryFn: () => ardUploadsApi.list(entityType, entityId),
    enabled: !!entityId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['ard-project-audit', entityId] })
    qc.invalidateQueries({ queryKey: ['ard-project', entityId] })
  }

  const removeMut = useMutation({
    mutationFn: (id: string) => ardUploadsApi.remove(id),
    onSuccess: () => { msgApi.success('Attachment removed.'); invalidate() },
    onError: () => msgApi.error('Failed to remove attachment.'),
  })

  const addFolderMut = useMutation({
    mutationFn: () => ardUploadsApi.addFolderLink(entityType, entityId, folderPath, folderName || undefined),
    onSuccess: () => { msgApi.success('Folder link added.'); setFolderPath(''); setFolderName(''); invalidate() },
    onError: () => msgApi.error('Failed to add folder link.'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name?: string; description?: string }) =>
      ardUploadsApi.updateMeta(id, { name, description }),
    onSuccess: () => { setEditingId(null); invalidate() },
    onError: () => msgApi.error('Failed to update.'),
  })

  const editModalMut = useMutation({
    mutationFn: (v: { name: string; description?: string; attachmentType?: ArdAttachmentType; customTypeName?: string; attachmentLink?: string }) =>
      ardUploadsApi.updateMeta(editModalRow!.id, v),
    onSuccess: () => { msgApi.success('Attachment updated.'); setEditModalRow(null); invalidate() },
    onError: () => msgApi.error('Failed to update attachment.'),
  })

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    let successCount = 0
    for (const file of files) {
      try {
        await ardUploadsApi.upload(entityType, entityId, file, '', '', pendingType, pendingCustomType)
        successCount++
      } catch (err: unknown) {
        msgApi.error(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`)
      }
    }
    if (successCount > 0) {
      msgApi.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded.`)
      invalidate()
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handlePreview(att: ArdAttachment) {
    try {
      const { blob } = await ardUploadsApi.downloadBlob(att.id)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewType(att.fileType?.includes('image') ? 'image' : 'pdf')
    } catch {
      msgApi.error('Preview failed.')
    }
  }

  async function handleDownload(att: ArdAttachment) {
    try {
      const { blob, filename } = await ardUploadsApi.downloadBlob(att.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename || att.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      msgApi.error('Download failed.')
    }
  }

  const columns: ColumnsType<ArdAttachment> = [
    {
      title: 'File',
      dataIndex: 'name',
      render: (_, row) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {fileIcon(row.fileType)}
            {editingId === row.id && editField === 'name' ? (
              <Input
                size="small"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => updateMut.mutate({ id: row.id, name: editName })}
                onPressEnter={() => updateMut.mutate({ id: row.id, name: editName })}
                autoFocus
                style={{ width: 200 }}
              />
            ) : (
              <span
                className={!readOnly ? 'cursor-pointer hover:text-violet-600 transition-colors font-medium text-slate-700' : 'font-medium text-slate-700'}
                onClick={() => { if (!readOnly) { setEditingId(row.id); setEditField('name'); setEditName(row.name) } }}
              >
                {row.name}
              </span>
            )}
          </div>
          {editingId === row.id && editField === 'description' ? (
            <Input
              size="small"
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              onBlur={() => updateMut.mutate({ id: row.id, description: editDesc })}
              onPressEnter={() => updateMut.mutate({ id: row.id, description: editDesc })}
              placeholder="Add description..."
              autoFocus
              className="ml-5 mt-0.5"
              style={{ width: 200 }}
            />
          ) : (
            <span
              className={`ml-5 text-xs ${row.description ? 'text-slate-400' : 'text-slate-300 italic'} ${!readOnly ? 'cursor-pointer hover:text-violet-500 transition-colors' : ''}`}
              onClick={() => { if (!readOnly) { setEditingId(row.id); setEditField('description'); setEditDesc(row.description ?? '') } }}
            >
              {row.description || (!readOnly ? 'Add description…' : '')}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'attachmentType',
      width: 100,
      render: (v: ArdAttachmentType | null, row) => {
        const opt = ATTACHMENT_TYPE_OPTIONS.find((o) => o.value === v)
        const label = v === 'others' ? (row.customTypeName || 'Others') : opt?.label
        return label ? <span className="text-slate-500 text-xs">{label}</span> : <span className="text-slate-300 text-xs">—</span>
      },
    },
    {
      title: 'Size',
      dataIndex: 'sizeBytes',
      width: 90,
      render: (v) => <span className="text-slate-500 text-xs font-mono">{formatBytes(v)}</span>,
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      width: 130,
      render: (v) => <span className="text-slate-600 text-xs">{v}</span>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      width: 110,
      render: (v) => <span className="text-slate-500 text-xs">{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: '',
      width: 90,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {(row.fileType?.includes('image') || row.fileType?.includes('pdf')) && (
            <Tooltip title="Preview">
              <button onClick={() => handlePreview(row)}
                className="p-1 rounded text-slate-400 hover:text-violet-500 transition-colors">
                <Eye size={14} />
              </button>
            </Tooltip>
          )}
          <Tooltip title="Download">
            <button onClick={() => handleDownload(row)}
              className="p-1 rounded text-slate-400 hover:text-violet-600 transition-colors">
              <Download size={14} />
            </button>
          </Tooltip>
          {!readOnly && (
            <>
              <Tooltip title="Edit">
                <button
                  onClick={() => {
                    setEditModalRow(row)
                    editForm.setFieldsValue({
                      name: row.name, description: row.description ?? '',
                      attachmentType: row.attachmentType ?? undefined, customTypeName: row.customTypeName ?? '',
                    })
                  }}
                  className="p-1 rounded text-slate-400 hover:text-violet-600 transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </Tooltip>
              <Popconfirm title="Remove this attachment?" onConfirm={() => removeMut.mutate(row.id)} okText="Remove" okButtonProps={{ danger: true }}>
                <button className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ]

  const fileAttachments = data.filter(a => a.fileType !== 'folder_link')
  const folderLinks = data.filter(a => a.fileType === 'folder_link')

  return (
    <div className="space-y-3">
      {ctx}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
          {label ?? 'Attachments'} {fileAttachments.length > 0 && `(${fileAttachments.length})`}
        </p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Select
              size="small"
              placeholder="Type"
              allowClear
              style={{ width: 110 }}
              value={pendingType}
              onChange={setPendingType}
              options={ATTACHMENT_TYPE_OPTIONS}
            />
            {pendingType === 'others' && (
              <Input size="small" placeholder="Custom type" style={{ width: 120 }} value={pendingCustomType}
                onChange={(e) => setPendingCustomType(e.target.value)} />
            )}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg" />
            <Button
              size="small"
              icon={uploading ? <Spin size="small" /> : <Upload size={13} />}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Attach files'}
            </Button>
          </div>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-4"><Spin /></div>}

      {error && (
        <Alert type="warning" message="Could not load attachments" showIcon className="text-xs" />
      )}

      {!isLoading && fileAttachments.length === 0 && (
        <p className="text-sm text-slate-400 italic py-2">No attachments yet.</p>
      )}

      {fileAttachments.length > 0 && (
        <Table
          dataSource={fileAttachments}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          className="rounded-lg overflow-hidden"
        />
      )}

      {/* Links section — external URL or UNC folder path */}
      {folderLinkEnabled && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide flex items-center gap-1">
            <FolderOpen size={12} className="text-amber-500" />
            Links {folderLinks.length > 0 && `(${folderLinks.length})`}
          </p>

          {folderLinks.map(fl => (
            <div key={fl.id} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <FolderOpen size={14} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{fl.name}</p>
                <p className="text-[11px] text-amber-700 font-mono truncate">{fl.attachmentLink}</p>
              </div>
              <Tooltip title="Copy link">
                <button
                  className="p-1 rounded text-slate-400 hover:text-amber-600 transition-colors"
                  onClick={() => { navigator.clipboard.writeText(fl.attachmentLink || fl.name); msgApi.success('Link copied.') }}
                >
                  <Copy size={13} />
                </button>
              </Tooltip>
              {!readOnly && (
                <Popconfirm title="Remove this folder link?" onConfirm={() => removeMut.mutate(fl.id)} okText="Remove" okButtonProps={{ danger: true }}>
                  <button className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </Popconfirm>
              )}
            </div>
          ))}

          {!readOnly && (
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">URL or UNC Path</span>
                <Input
                  size="small"
                  placeholder="https://... or \\server\share\folder"
                  value={folderPath}
                  onChange={e => setFolderPath(e.target.value)}
                  style={{ width: 260, fontFamily: 'monospace' }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400">Label (optional)</span>
                <Input
                  size="small"
                  placeholder="e.g. Raw Data"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  style={{ width: 140 }}
                />
              </div>
              <Button
                size="small"
                icon={<Plus size={12} />}
                disabled={!folderPath.trim() || addFolderMut.isPending}
                loading={addFolderMut.isPending}
                onClick={() => addFolderMut.mutate()}
              >
                Add Link
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Preview modal */}
      <Modal
        {...glassModalProps}
        open={!!previewUrl}
        onCancel={() => { setPreviewUrl(null); setPreviewType(null) }}
        footer={null}
        width={previewType === 'pdf' ? 800 : 600}
        centered
        title="Preview"
      >
        {previewType === 'image' && previewUrl && (
          <Image src={previewUrl} alt="Preview" style={{ maxWidth: '100%' }} />
        )}
        {previewType === 'pdf' && previewUrl && (
          <iframe src={previewUrl} title="PDF Preview" style={{ width: '100%', height: 560, border: 'none' }} />
        )}
      </Modal>

      {/* Edit attachment modal */}
      <Modal
        {...glassModalProps}
        title="Edit Attachment"
        open={!!editModalRow}
        onCancel={() => setEditModalRow(null)}
        onOk={() => editForm.validateFields().then((v) => editModalMut.mutate(v))}
        confirmLoading={editModalMut.isPending}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input /></Form.Item>
          <Form.Item name="attachmentType" label="Type">
            <Select allowClear options={ATTACHMENT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => editForm.getFieldValue('attachmentType') === 'others' && (
              <Form.Item name="customTypeName" label="Custom Type"><Input /></Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
