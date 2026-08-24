import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Input, Select, Tag, message, Card, Popconfirm, Space, Checkbox, Form, Tooltip, Empty, Segmented,
} from 'antd'
import {
  Plus, Trash2, ArrowUp, ArrowDown, Eye, Edit2, Save, ArrowLeft, CheckCircle, Send, AlertCircle, FileText, LayoutGrid, GripVertical, Settings2,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import {
  ardTemplateApi, ardSectionApi, type ArdTemplateSectionAttachment, type ArdMasterSection,
  type TemplateStatus, type ArdTemplateDoc,
} from '../../api/ard'
import { ApiError } from '../../api/client'
import { ESignatureModal } from '../../components/common/ESignatureModal'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

function statusTag(status: TemplateStatus) {
  const color =
    status === 'PUBLISHED'
      ? 'green'
      : status === 'PENDING_APPROVAL'
        ? 'gold'
        : status === 'REWORK'
          ? 'red'
          : status === 'SUPERSEDED'
            ? 'default'
            : 'default'
  return <Tag color={color}>{status ? status.replace(/_/g, ' ') : status}</Tag>
}

// A section attached to this template version, joined with its master
// ArdSection for display — local editable state until Save is clicked
// (rearchitecture prompt §1.6: attachment flags belong to the join row, not
// the section's own content).
interface Attachment extends ArdTemplateSectionAttachment {
  section: ArdMasterSection
}

const ATTACH_FLAGS: { key: keyof ArdTemplateSectionAttachment; label: string; hint: string }[] = [
  { key: 'includeInCloning', label: 'Include when cloning', hint: 'Carried over when this template is cloned' },
  { key: 'includeInEmpower', label: 'Include in Empower export', hint: 'Sent to Empower/CDS integration' },
  { key: 'updateSampleWeights', label: 'Updates sample weights', hint: 'Writes back to sample weight tracking' },
  { key: 'updateResultSample', label: 'Updates result sample', hint: 'Writes back to the result sample record' },
  { key: 'includeReadWeighingExcel', label: 'Read from weighing spreadsheet', hint: 'Pulls values from an embedded weighing sheet' },
]

function SortableAttachmentItem({
  att, idx, isSelected, editable, isFirst, isLast, onSelect, onMoveUp, onMoveDown, onRemove,
}: {
  att: Attachment
  idx: number
  isSelected: boolean
  editable: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: att.sectionId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 rounded-lg border transition-all cursor-pointer space-y-2 ${
        isSelected ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {editable && (
            <span
              {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-indigo-600 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-100 shrink-0"
              title="Drag to reorder section"
            >
              <GripVertical size={16} />
            </span>
          )}
          <span className="w-6 h-6 rounded-full font-mono text-xs font-bold flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 truncate">{att.section.name}</span>
              {!att.section.active && <Tag color="red" className="text-[9px] px-1 py-0">Master section inactive</Tag>}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">Type: {att.section.sectionType}</div>
          </div>
        </div>

        {editable && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button type="text" size="small" disabled={isFirst} icon={<ArrowUp size={13} />} onClick={onMoveUp} />
            <Button type="text" size="small" disabled={isLast} icon={<ArrowDown size={13} />} onClick={onMoveDown} />
            <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={onRemove} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArdTemplateBuilderPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()

  const [draft, setDraft] = useState<ArdTemplateDoc | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [attachSel, setAttachSel] = useState<string | undefined>()
  const [previewMode, setPreviewMode] = useState(false)
  const [activeMobileTab, setActiveMobileTab] = useState<'palette' | 'canvas' | 'properties'>('canvas')
  const [esignPending, setEsignPending] = useState<'PUBLISHED' | 'REWORK' | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const { data: template, isLoading } = useQuery({
    queryKey: ['ard-template', templateId],
    queryFn: () => ardTemplateApi.get(templateId!),
    enabled: !!templateId,
  })

  const { data: templateSections } = useQuery({
    queryKey: ['ard-template-sections', templateId],
    queryFn: () => ardTemplateApi.sections(templateId!),
    enabled: !!templateId,
  })

  const { data: sectionsList } = useQuery({
    queryKey: ['ard-sections', 'all-active'],
    queryFn: () => ardSectionApi.list({ is_active: 'true', pageSize: 500 }),
  })

  const { data: preview } = useQuery({
    queryKey: ['ard-template-preview', templateId],
    queryFn: () => ardTemplateApi.preview(templateId!),
    enabled: !!templateId && previewMode,
  })

  useEffect(() => {
    if (template) setDraft(template)
  }, [template?.id])

  useEffect(() => {
    if (templateSections) {
      const rows: Attachment[] = templateSections.items
        .filter((r) => r.section)
        .map((r) => ({
          sectionId: r.sectionId,
          includeInCloning: r.includeInCloning,
          includeInEmpower: r.includeInEmpower,
          updateSampleWeights: r.updateSampleWeights,
          updateResultSample: r.updateResultSample,
          includeReadWeighingExcel: r.includeReadWeighingExcel,
          section: r.section as unknown as ArdMasterSection,
        }))
      setAttachments(rows)
      if (rows.length) setSelectedSectionId(rows[0].sectionId)
    }
  }, [templateSections])

  const editable = draft ? ['DRAFT', 'REWORK'].includes(draft.status) : false

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft to save')
      const sections: ArdTemplateSectionAttachment[] = attachments.map((a) => ({
        sectionId: a.sectionId,
        includeInCloning: a.includeInCloning,
        includeInEmpower: a.includeInEmpower,
        updateSampleWeights: a.updateSampleWeights,
        updateResultSample: a.updateResultSample,
        includeReadWeighingExcel: a.includeReadWeighingExcel,
      }))
      return ardTemplateApi.save(draft.id, {
        sections,
        description: draft.description,
        remarks: (draft as any).remarks,
        activationDate: (draft as any).activationDate,
        includeWeighing: !!(draft as any).includeWeighing,
        includePh: !!(draft as any).includePh,
        includeChemicals: !!(draft as any).includeChemicals,
        includeSampleDetails: !!(draft as any).includeSampleDetails,
        includeEquipment: !!(draft as any).includeEquipment,
        includeColumn: !!(draft as any).includeColumn,
        includeAttachments: !!(draft as any).includeAttachments,
        includeResults: !!(draft as any).includeResults,
        includeConclusion: !!(draft as any).includeConclusion,
        includeCdsReport: !!(draft as any).includeCdsReport,
      })
    },
    onSuccess: (updated) => {
      setDraft(updated)
      qc.invalidateQueries({ queryKey: ['ard-template', templateId] })
      qc.invalidateQueries({ queryKey: ['ard-template-sections', templateId] })
      msg.success('Template draft saved successfully.')
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to save template.'),
  })

  const transition = useMutation({
    mutationFn: ({ to, password, remarks }: { to: string; password?: string; remarks?: string }) =>
      ardTemplateApi.transition(templateId!, { to, ...(password ? { password } : {}), ...(remarks ? { remarks } : {}) }),
    onSuccess: (updated, { to }) => {
      setDraft(updated)
      setEsignPending(null)
      qc.invalidateQueries({ queryKey: ['ard-template', templateId] })
      msg.success(`Template status updated to ${to.replace(/_/g, ' ')}.`)
    },
    onError: (e) => msg.error(e instanceof ApiError ? (typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)) : 'Status update failed.'),
  })

  if (isLoading || !draft) {
    return <div className="p-8 text-center text-slate-500">Loading template builder...</div>
  }

  const selectedAttachment = attachments.find((a) => a.sectionId === selectedSectionId)
  const availableSections = (sectionsList?.items ?? []).filter((s) => !attachments.some((a) => a.sectionId === s.id))

  const attachSection = () => {
    if (!attachSel || !editable) return
    const section = (sectionsList?.items ?? []).find((s) => s.id === attachSel)
    if (!section) return
    setAttachments([...attachments, {
      sectionId: section.id, section,
      includeInCloning: true, includeInEmpower: false, updateSampleWeights: false, updateResultSample: false, includeReadWeighingExcel: false,
    }])
    setSelectedSectionId(section.id)
    setAttachSel(undefined)
    setActiveMobileTab('canvas')
  }

  const removeAttachment = (sectionId: string) => {
    if (!editable) return
    const next = attachments.filter((a) => a.sectionId !== sectionId)
    setAttachments(next)
    if (selectedSectionId === sectionId) setSelectedSectionId(next[0]?.sectionId ?? null)
  }

  const moveAttachment = (sectionId: string, dir: -1 | 1) => {
    if (!editable) return
    const idx = attachments.findIndex((a) => a.sectionId === sectionId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= attachments.length) return
    const reordered = [...attachments]
    const [item] = reordered.splice(idx, 1)
    reordered.splice(target, 0, item)
    setAttachments(reordered)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id && editable) {
      const oldIndex = attachments.findIndex((a) => a.sectionId === active.id)
      const newIndex = attachments.findIndex((a) => a.sectionId === over.id)
      if (oldIndex >= 0 && newIndex >= 0) setAttachments(arrayMove(attachments, oldIndex, newIndex))
    }
  }

  const updateSelectedFlag = (key: keyof ArdTemplateSectionAttachment, value: boolean) => {
    if (!selectedSectionId || !editable) return
    setAttachments(attachments.map((a) => (a.sectionId === selectedSectionId ? { ...a, [key]: value } : a)))
  }

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      {ctx}

      {/* Top Header Bar */}
      <div className="glass-card rounded-lg p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/ard/templates')}>
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight truncate">{draft.name}</h1>
              {statusTag(draft.status)}
              <span className="font-mono text-xs font-semibold text-slate-500">v{draft.version}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
              Type: <span className="font-semibold text-slate-700">{draft.templateType || 'General'}</span>
              {' · Code: '}
              {draft.code
                ? <span className="font-mono text-indigo-600">{draft.code}</span>
                : <span className="italic text-slate-400">not set</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <Button icon={previewMode ? <Edit2 size={14} /> : <Eye size={14} />} onClick={() => setPreviewMode(!previewMode)}>
            {previewMode ? 'Edit Mode' : 'Preview Mode'}
          </Button>

          {editable && (
            <Button type="primary" icon={<Save size={14} />} loading={save.isPending} onClick={() => save.mutate()}>
              Save Template
            </Button>
          )}

          {draft.status === 'DRAFT' && (
            <Popconfirm title="Submit template for approval?" onConfirm={() => transition.mutate({ to: 'PENDING_APPROVAL' })}>
              <Button type="primary" className="bg-amber-600 hover:bg-amber-700" icon={<Send size={14} />} loading={transition.isPending}>
                Submit
              </Button>
            </Popconfirm>
          )}

          {draft.status === 'PENDING_APPROVAL' && (() => {
            const isSelfCreated = draft.createdById && user?.id && draft.createdById === user.id
            return (
              <>
                <Tooltip title={isSelfCreated ? 'You cannot approve a template you created' : undefined}>
                  <Button type="primary" icon={<CheckCircle size={14} />} loading={transition.isPending}
                    disabled={!!isSelfCreated}
                    onClick={() => setEsignPending('PUBLISHED')}>
                    Publish
                  </Button>
                </Tooltip>
                <Tooltip title={isSelfCreated ? 'You cannot rework a template you submitted yourself' : undefined}>
                  <Button danger icon={<AlertCircle size={14} />} loading={transition.isPending}
                    disabled={!!isSelfCreated}
                    onClick={() => setEsignPending('REWORK')}>
                    Rework
                  </Button>
                </Tooltip>
              </>
            )
          })()}
        </div>
      </div>

      {!editable && !previewMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span>This template is currently <strong>{draft.status}</strong> and is read-only. Create a new version from the templates page to make edits.</span>
        </div>
      )}

      {/* Mobile Segmented Tab Selector */}
      {!previewMode && (
        <div className="block lg:hidden">
          <Segmented
            block
            value={activeMobileTab}
            onChange={(v: any) => setActiveMobileTab(v)}
            options={[
              { label: 'Add Section', value: 'palette' },
              { label: `Canvas (${attachments.length})`, value: 'canvas' },
              { label: 'Properties', value: 'properties' },
            ]}
          />
        </div>
      )}

      {previewMode ? (
        /* Preview Mode — rendered from the SNAPSHOT tables (§3.4), same
           read-path an experiment created from this template will use. */
        <Card title="Live Template Preview (from saved snapshot)" className="glass-card rounded-lg overflow-hidden">
          {!preview || preview.sections.length === 0 ? (
            <Empty description="No sections attached to this template, or nothing saved yet." />
          ) : (
            <div className="space-y-6">
              {preview.sections.map((sec, idx) => (
                <div key={sec.sectionId} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold text-slate-800 text-sm">{idx + 1}. {sec.name}</span>
                    <Tag color="geekblue">{sec.sectionType}</Tag>
                  </div>
                  {sec.richtext && (
                    <div className="p-3 bg-white rounded border border-slate-200 text-xs text-slate-600 min-h-[60px] whitespace-pre-wrap">
                      {sec.richtext.defaultContent || <span className="italic text-slate-400">(no default content set)</span>}
                    </div>
                  )}
                  {sec.datatable && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr>
                            {sec.datatable.columns.map((c) => (
                              <th key={c.dataItemId} className="border border-slate-200 bg-slate-100 px-2 py-1 text-left" style={{ width: `${c.relativeWidth}%` }}>
                                Col {c.sequenceNumber + 1}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>{sec.datatable.columns.map((c) => <td key={c.dataItemId} className="border border-slate-200 px-2 py-1 text-slate-400 italic">—</td>)}</tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {sec.embeddedFile && (
                    <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200">
                      Spreadsheet: <span className="font-mono">{sec.embeddedFile.fileName ?? 'none uploaded'}</span>
                    </div>
                  )}
                  {sec.dataItemLinks && sec.dataItemLinks.length > 0 && (
                    <div className="space-y-1">
                      {sec.dataItemLinks.map((l) => (
                        <div key={l.dataItemId} className="text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                          <span>{l.name} <span className="text-slate-400">({l.dataType})</span></span>
                          {l.isMandatory && <Tag color="red" className="text-[9px] px-1 py-0">Mandatory</Tag>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        /* Edit Mode: Add-Section palette | Canvas | Attachment properties */
        <div className="grid grid-cols-12 gap-4 items-start">
          {/* Column 1: Add existing master section */}
          <div className={`col-span-12 lg:col-span-3 glass-card rounded-lg p-4 space-y-4 ${activeMobileTab === 'palette' ? 'block' : 'hidden lg:block'}`}>
            <div className="border-b border-slate-100 pb-2">
              <h2 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <LayoutGrid size={16} className="text-indigo-600" /> Add Section
              </h2>
              <p className="text-[11px] text-slate-400">Pick from reusable master Sections and attach to this template.</p>
            </div>
            <Select
              className="w-full"
              showSearch
              optionFilterProp="label"
              placeholder="Select a section to add..."
              disabled={!editable}
              value={attachSel}
              onChange={setAttachSel}
              options={availableSections.map((s) => ({ value: s.id, label: `${s.name} (${s.sectionType})` }))}
            />
            <Button block type="primary" icon={<Plus size={14} />} disabled={!editable || !attachSel} onClick={attachSection}>
              Attach to Template
            </Button>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              Need a new section? Author its content in Configuration → Sections, then come back and attach it here.
            </p>
          </div>

          {/* Column 2: Center Canvas */}
          <div className={`col-span-12 lg:col-span-5 glass-card rounded-lg p-4 space-y-3 min-h-[650px] ${activeMobileTab === 'canvas' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Template Canvas</h2>
                <p className="text-[11px] text-slate-400">{attachments.length} section(s) attached (drag handle to reorder)</p>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <FileText size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-medium text-slate-500">No sections attached</p>
                <p className="text-[11px] text-slate-400 mt-1">Pick a section on the left and attach it to this template.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={attachments.map((a) => a.sectionId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                    {attachments.map((att, idx) => (
                      <SortableAttachmentItem
                        key={att.sectionId}
                        att={att}
                        idx={idx}
                        isSelected={att.sectionId === selectedSectionId}
                        editable={editable}
                        isFirst={idx === 0}
                        isLast={idx === attachments.length - 1}
                        onSelect={() => {
                          setSelectedSectionId(att.sectionId)
                          if (window.innerWidth < 1024) setActiveMobileTab('properties')
                        }}
                        onMoveUp={() => moveAttachment(att.sectionId, -1)}
                        onMoveDown={() => moveAttachment(att.sectionId, 1)}
                        onRemove={() => removeAttachment(att.sectionId)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Column 3: Template Settings / Attachment Properties */}
          <div className={`col-span-12 lg:col-span-4 glass-card rounded-lg p-4 space-y-4 min-h-[650px] ${activeMobileTab === 'properties' ? 'block' : 'hidden lg:block'}`}>
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">
                  {selectedAttachment ? 'Attachment Properties' : 'Template Settings'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {selectedAttachment ? 'How this section behaves within this template' : 'Template metadata & fixed section flags'}
                </p>
              </div>
              {selectedAttachment && (
                <Button size="small" type="text" onClick={() => setSelectedSectionId(null)} className="text-xs text-slate-500">
                  ← Template Settings
                </Button>
              )}
            </div>

            {!selectedAttachment ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">Template Details</h3>
                  <Form layout="vertical" size="small">
                    <Form.Item label="Description" className="mb-3">
                      <Input.TextArea disabled={!editable} rows={2} value={draft.description ?? ''}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="Template purpose description..." />
                    </Form.Item>
                    <Form.Item label="Remarks" className="mb-3">
                      <Input.TextArea disabled={!editable} rows={2} value={(draft as any).remarks ?? ''}
                        onChange={(e) => setDraft({ ...draft, remarks: e.target.value } as any)}
                        placeholder="Internal remarks..." />
                    </Form.Item>
                    <Form.Item label="Activation Date" className="mb-3">
                      <Input disabled={!editable} placeholder="YYYY-MM-DD" value={(draft as any).activationDate ?? ''}
                        onChange={(e) => setDraft({ ...draft, activationDate: e.target.value } as any)} />
                    </Form.Item>
                  </Form>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-1">Fixed Section Inclusions</h3>
                  <p className="text-[11px] text-slate-400 mb-2">Control which fixed sections this template includes in experiments.</p>
                  <div className="space-y-1.5">
                    {([
                      ['includeWeighing', 'Weighing'],
                      ['includePh', 'pH Measurement'],
                      ['includeChemicals', 'Chemicals / Reagents'],
                      ['includeSampleDetails', 'Sample Details'],
                      ['includeEquipment', 'Equipment / Instruments'],
                      ['includeColumn', 'Chromatography Column'],
                      ['includeAttachments', 'Attachments / Spectra'],
                      ['includeResults', 'Results Summary'],
                      ['includeConclusion', 'Conclusion'],
                      ['includeCdsReport', 'CDS Report'],
                    ] as [string, string][]).map(([key, label]) => (
                      <Checkbox key={key} disabled={!editable} checked={!!((draft as any)[key])}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked } as any)}>
                        <span className="text-xs text-slate-700">{label}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
                <div className="pt-2 text-center text-slate-400 text-[11px]">
                  Select an attached section in the canvas to configure its per-template flags.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-800">{selectedAttachment.section.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Type: {selectedAttachment.section.sectionType}</div>
                  {selectedAttachment.section.description && (
                    <p className="text-[11px] text-slate-500 mt-1">{selectedAttachment.section.description}</p>
                  )}
                </div>

                <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5">
                  <Settings2 size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                  <span>Section content (title, columns, linked data items) is authored on the master Section — edit it under Configuration → Sections. These flags only control how it behaves inside <em>this</em> template.</span>
                </div>

                <div className="space-y-2">
                  {ATTACH_FLAGS.map((f) => (
                    <div key={f.key} className="flex items-start gap-2">
                      <Checkbox
                        disabled={!editable}
                        checked={!!selectedAttachment[f.key]}
                        onChange={(e) => updateSelectedFlag(f.key, e.target.checked)}
                      />
                      <div>
                        <div className="text-xs font-medium text-slate-700">{f.label}</div>
                        <div className="text-[10px] text-slate-400">{f.hint}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ESignatureModal
        open={esignPending !== null}
        userName={user?.username ?? ''}
        title={esignPending === 'PUBLISHED' ? 'Electronic Signature — Publish Template' : 'Electronic Signature — Return for Rework'}
        description={esignPending === 'PUBLISHED'
          ? 'Publishing makes this template available for new ATRs. Re-enter your password to confirm.'
          : 'Returning for rework reverts the template to draft state. Re-enter your password to confirm.'}
        requireReason={esignPending === 'PUBLISHED'}
        loading={transition.isPending}
        onCancel={() => setEsignPending(null)}
        onConfirm={async ({ password, reason }) => {
          if (esignPending) await transition.mutateAsync({ to: esignPending, password, ...(reason ? { remarks: reason } : {}) })
        }}
      />
    </div>
  )
}
