import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, Popconfirm, message } from 'antd'
import { Upload, Trash2, FileText, Save, Pencil } from 'lucide-react'
import { attachmentApi, projectApi, type Project } from '../../../api/adc'
import RichEditor, { RichDisplay } from '../../../components/RichEditor'
import { BTN_32 } from '../../../utils/buttonSize'
import BrandSpinner from '../../../components/ui/BrandSpinner'
import { EmptyValue } from '../../../components/ui/EmptyValue'
import dayjs from 'dayjs'

interface Props { project: Project; projectId: string }

function fileSize(bytes: number | null) {
  if (!bytes) return <EmptyValue />
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const hasData = (p: Project) =>
  !!(p.related_docs_comments || p.related_docs_observations)

export default function RelatedDocumentsTab({ project, projectId }: Props) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pendingComments, setPendingComments] = useState('')
  const [uploading, setUploading] = useState(false)

  const [editing, setEditing] = useState(!hasData(project))
  const [comments, setComments] = useState(project.related_docs_comments ?? '')
  const [observations, setObservations] = useState(project.related_docs_observations ?? '')

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['project-attachments', projectId],
    queryFn:  () => attachmentApi.list(projectId),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => attachmentApi.delete(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-attachments', projectId] }),
  })

  const saveMut = useMutation({
    mutationFn: () => projectApi.update(projectId, {
      related_docs_comments:     comments,
      related_docs_observations: observations,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adc-project', projectId] })
      message.success('Saved')
      setEditing(false)
    },
  })

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await attachmentApi.upload(projectId, file, pendingComments || undefined)
      qc.invalidateQueries({ queryKey: ['project-attachments', projectId] })
      setPendingComments('')
      if (fileRef.current) fileRef.current.value = ''
      message.success('File uploaded')
    } catch {
      message.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Upload section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Attach Documents</h2>
        <div className="flex gap-3 items-start">
          <Input
            value={pendingComments}
            onChange={e => setPendingComments(e.target.value)}
            placeholder="File comments (optional)"
            className="flex-1"
          />
          <Button
            icon={<Upload size={14} />}
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            Upload File
          </Button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* File list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-700">Documents ({attachments.length})</h2>
        </div>
        {isLoading ? (
          <div className="py-6"><BrandSpinner fullScreen={false} size={64} label="Loading documents…" /></div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-10">
            <FileText size={32} className="mx-auto mb-2 text-slate-200" />
            <p className="text-sm text-slate-400">No documents attached yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attachments.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <FileText size={18} className="text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{a.filename}</p>
                  <p className="text-xs text-slate-400">
                    {fileSize(a.file_size)} · {dayjs(a.uploaded_at).format('DD MMM YYYY HH:mm')}
                    {a.comments && <> · <span className="italic">{a.comments}</span></>}
                  </p>
                </div>
                <Popconfirm
                  title="Delete this file?"
                  onConfirm={() => deleteMut.mutate(a.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <button className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </Popconfirm>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments + observations — view/edit toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-700">Comments & Observations</h2>
          {!editing && (
            <Button size="small" style={BTN_32} icon={<Pencil size={13} />} onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Comments</p>
              <RichEditor value={comments} onChange={setComments} placeholder="General comments about related documents…" minHeight={100} />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Observations</p>
              <RichEditor value={observations} onChange={setObservations} placeholder="Observations…" minHeight={100} />
            </div>
            <div className="flex gap-2 mt-2">
              <Button size="small" style={BTN_32} onClick={() => { setComments(''); setObservations('') }}>Clear</Button>
              <Button size="small" style={BTN_32} type="primary" icon={<Save size={12} />} loading={saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {comments || observations ? (
              <>
                {comments && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">COMMENTS</p>
                    <RichDisplay html={comments} />
                  </div>
                )}
                {observations && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">OBSERVATIONS</p>
                    <RichDisplay html={observations} />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 italic text-center py-4">No comments or observations yet. Click Edit to add.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
