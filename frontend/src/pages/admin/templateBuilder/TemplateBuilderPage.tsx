import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, message, Popconfirm, Tag } from 'antd'
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, Plus, Eye, Copy, Trash2, Pencil, Save, Send, FolderOpen } from 'lucide-react'
import { workflowTemplateApi } from '../../../api/adc'
import type { WorkflowTemplate } from '../../../api/adc'
import FieldToolbox from './FieldToolbox'
import SectionCard from './SectionCard'
import FieldPropertiesDrawer from './FieldPropertiesDrawer'
import PreviewModal from './PreviewModal'
import {
  makeField, makeSection, descriptorFor, newId,
  type TemplateDefinition, type TemplateField, type TemplateSection, type FieldType,
} from './types'

const CATEGORY = 'CGT_PLASMID'
const EMPTY_DEF: TemplateDefinition = { sections: [] }

// ── Template list view ──────────────────────────────────────────────────────
function TemplateListView({ onEdit, onCreate }: { onEdit: (t: WorkflowTemplate) => void; onCreate: () => void }) {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: ['cgt-plasmid-templates'],
    queryFn: () => workflowTemplateApi.list({ category: CATEGORY }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => workflowTemplateApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cgt-plasmid-templates'] }); message.success('Template deleted') },
    onError: () => message.error('Failed to delete template'),
  })

  const duplicateMut = useMutation({
    mutationFn: async (t: WorkflowTemplate) => {
      const full = await workflowTemplateApi.get(t.id)
      return workflowTemplateApi.create({
        name: `${t.name} (Copy)`,
        slug: `${t.slug}-copy-${Date.now().toString(36)}`,
        category: CATEGORY,
        description: t.description,
        is_active: false,
        definition: full.definition,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cgt-plasmid-templates'] }); message.success('Template duplicated as a draft') },
    onError: () => message.error('Failed to duplicate template'),
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Template Builder</h1>
          <p className="text-slate-400 text-sm">CGT Plasmid Process — form templates</p>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={onCreate}>New Template</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data.length === 0 ? (
        <div className="glass-card rounded-lg p-16 flex flex-col items-center gap-2 text-center">
          <FolderOpen size={28} className="text-slate-300" />
          <p className="text-sm text-slate-400">No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => (
            <div key={t.id} className="glass-card rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                <Tag color={t.is_active ? 'green' : 'default'}>{t.is_active ? 'Published' : 'Draft'}</Tag>
              </div>
              <p className="text-xs text-slate-400 mb-1">v{t.version} · {t.slug}</p>
              <p className="text-xs text-slate-500 flex-1 mb-3">{t.description || 'No description'}</p>
              <div className="flex items-center gap-1.5 border-t border-white/50 pt-3">
                <Button size="small" icon={<Pencil size={12} />} onClick={() => onEdit(t)}>Edit</Button>
                <Button size="small" icon={<Copy size={12} />} loading={duplicateMut.isPending} onClick={() => duplicateMut.mutate(t)}>Duplicate</Button>
                <Popconfirm title="Delete this template?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => deleteMut.mutate(t.id)}>
                  <Button size="small" danger icon={<Trash2 size={12} />} />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Builder view ─────────────────────────────────────────────────────────────
function BuilderView({ template, onBack }: { template: WorkflowTemplate | 'new'; onBack: () => void }) {
  const qc = useQueryClient()
  const isNew = template === 'new'

  const { data: full, isLoading } = useQuery({
    queryKey: ['cgt-plasmid-template', isNew ? 'new' : template.id],
    queryFn: () => isNew ? Promise.resolve(null) : workflowTemplateApi.get(template.id),
    enabled: !isNew,
  })

  const [name, setName] = useState(isNew ? 'New CGT Plasmid Template' : template.name)
  const [def, setDef] = useState<TemplateDefinition>(EMPTY_DEF)
  const [loadedDef, setLoadedDef] = useState(false)
  const [editingField, setEditingField] = useState<{ field: TemplateField; sectionId: string } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeDragType, setActiveDragType] = useState<FieldType | null>(null)

  if (full && !loadedDef) {
    setDef((full.definition as TemplateDefinition) ?? EMPTY_DEF)
    setLoadedDef(true)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const persist = useMutation({
    mutationFn: async (opts: { publish?: boolean }) => {
      const body = {
        name,
        category: CATEGORY,
        definition: def,
        ...(opts.publish !== undefined ? { is_active: opts.publish } : {}),
      }
      if (isNew) {
        return workflowTemplateApi.create({ ...body, slug: newId('cgt-plasmid'), is_active: opts.publish ?? false })
      }
      return workflowTemplateApi.update(template.id, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cgt-plasmid-templates'] })
      message.success('Template saved')
      onBack()
    },
    onError: () => message.error('Failed to save template'),
  })

  const sectionIds = useMemo(() => def.sections.map(s => `sectionHandle:${s.id}`), [def.sections])

  const addSection = () => setDef(d => ({ sections: [...d.sections, makeSection(`Section ${d.sections.length + 1}`)] }))

  const updateSection = (id: string, patch: Partial<TemplateSection>) =>
    setDef(d => ({ sections: d.sections.map(s => s.id === id ? { ...s, ...patch } : s) }))

  const deleteSection = (id: string) => setDef(d => ({ sections: d.sections.filter(s => s.id !== id) }))

  const duplicateSection = (id: string) => setDef(d => {
    const s = d.sections.find(x => x.id === id)
    if (!s) return d
    const copy: TemplateSection = { ...s, id: newId('section'), title: `${s.title} (Copy)`, fields: s.fields.map(f => ({ ...f, id: newId('field') })) }
    const idx = d.sections.findIndex(x => x.id === id)
    const next = [...d.sections]
    next.splice(idx + 1, 0, copy)
    return { sections: next }
  })

  const deleteField = (sectionId: string, fieldId: string) =>
    setDef(d => ({ sections: d.sections.map(s => s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fieldId) } : s) }))

  const duplicateField = (sectionId: string, fieldId: string) =>
    setDef(d => ({
      sections: d.sections.map(s => {
        if (s.id !== sectionId) return s
        const idx = s.fields.findIndex(f => f.id === fieldId)
        const copy = { ...s.fields[idx], id: newId('field'), name: `${s.fields[idx].name}_copy` }
        const next = [...s.fields]
        next.splice(idx + 1, 0, copy)
        return { ...s, fields: next }
      }),
    }))

  const saveField = (updated: TemplateField) => {
    setDef(d => ({
      sections: d.sections.map(s => ({
        ...s,
        fields: s.fields.map(f => f.id === updated.id ? updated : f),
      })),
    }))
    setEditingField(null)
  }

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { source?: string; fieldType?: FieldType } | undefined
    if (data?.source === 'palette' && data.fieldType) setActiveDragType(data.fieldType)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragType(null)
    const { active, over } = e
    if (!over) return
    const activeData = active.data.current as { source?: string; fieldType?: FieldType; fieldId?: string; sectionId?: string } | undefined
    const overData = over.data.current as { source?: string; sectionId?: string; fieldId?: string } | undefined
    if (!activeData) return

    // 1) Dragging a new field type from the palette onto a section (or its fields)
    if (activeData.source === 'palette' && activeData.fieldType) {
      const targetSectionId = overData?.sectionId
      if (!targetSectionId) return
      const newField = makeField(activeData.fieldType)
      setDef(d => ({
        sections: d.sections.map(s => {
          if (s.id !== targetSectionId) return s
          if (overData?.source === 'field' && overData.fieldId) {
            const idx = s.fields.findIndex(f => f.id === overData.fieldId)
            const next = [...s.fields]
            next.splice(idx, 0, newField)
            return { ...s, fields: next }
          }
          return { ...s, fields: [...s.fields, newField] }
        }),
      }))
      return
    }

    // 2) Reordering / moving an existing field
    if (activeData.source === 'field' && activeData.fieldId) {
      const fromSectionId = def.sections.find(s => s.fields.some(f => f.id === activeData.fieldId))?.id
      if (!fromSectionId) return
      const toSectionId = overData?.sectionId ?? fromSectionId
      if (fromSectionId === toSectionId) {
        if (overData?.source !== 'field' || !overData.fieldId || overData.fieldId === activeData.fieldId) return
        setDef(d => ({
          sections: d.sections.map(s => {
            if (s.id !== fromSectionId) return s
            const oldIdx = s.fields.findIndex(f => f.id === activeData.fieldId)
            const newIdx = s.fields.findIndex(f => f.id === overData.fieldId)
            return { ...s, fields: arrayMove(s.fields, oldIdx, newIdx) }
          }),
        }))
      } else {
        setDef(d => {
          const fromSection = d.sections.find(s => s.id === fromSectionId)!
          const movedField = fromSection.fields.find(f => f.id === activeData.fieldId)!
          const withoutField = d.sections.map(s => s.id === fromSectionId ? { ...s, fields: s.fields.filter(f => f.id !== activeData.fieldId) } : s)
          return {
            sections: withoutField.map(s => {
              if (s.id !== toSectionId) return s
              if (overData?.source === 'field' && overData.fieldId) {
                const idx = s.fields.findIndex(f => f.id === overData.fieldId)
                const next = [...s.fields]
                next.splice(idx, 0, movedField)
                return { ...s, fields: next }
              }
              return { ...s, fields: [...s.fields, movedField] }
            }),
          }
        })
      }
      return
    }

    // 3) Reordering sections
    if (activeData.source === 'sectionHandle' && activeData.sectionId) {
      const overSectionHandle = (over.data.current as { source?: string; sectionId?: string } | undefined)
      const overSectionId = overSectionHandle?.sectionId ?? overData?.sectionId
      if (!overSectionId || overSectionId === activeData.sectionId) return
      setDef(d => {
        const oldIdx = d.sections.findIndex(s => s.id === activeData.sectionId)
        const newIdx = d.sections.findIndex(s => s.id === overSectionId)
        if (oldIdx === -1 || newIdx === -1) return d
        return { sections: arrayMove(d.sections, oldIdx, newIdx) }
      })
    }
  }

  if (!isNew && isLoading) return <div className="p-6 text-sm text-slate-400">Loading template…</div>

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            variant="borderless"
            className="text-sm font-semibold text-slate-700 !p-0 !w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Eye size={13} />} onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button icon={<Save size={13} />} loading={persist.isPending} onClick={() => persist.mutate({ publish: isNew ? false : undefined })}>
            Save Draft
          </Button>
          <Button type="primary" icon={<Send size={13} />} loading={persist.isPending} onClick={() => persist.mutate({ publish: true })}>
            Publish
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 items-start">
          <FieldToolbox />

          <div className="flex-1 space-y-4 min-w-0">
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              {def.sections.map((section, idx) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={idx}
                  onRename={title => updateSection(section.id, { title })}
                  onColumnsChange={columns => updateSection(section.id, { columns })}
                  onDuplicateSection={() => duplicateSection(section.id)}
                  onDeleteSection={() => deleteSection(section.id)}
                  onEditField={field => setEditingField({ field, sectionId: section.id })}
                  onDuplicateField={fieldId => duplicateField(section.id, fieldId)}
                  onDeleteField={fieldId => deleteField(section.id, fieldId)}
                />
              ))}
            </SortableContext>

            <button
              onClick={addSection}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/40 transition-colors"
            >
              <Plus size={15} /> Add Section
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeDragType && (
            <div className="rounded-lg border border-violet-300 bg-white shadow-lg px-3 py-2 text-xs text-violet-700">
              {descriptorFor(activeDragType).label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <FieldPropertiesDrawer
        field={editingField?.field ?? null}
        onClose={() => setEditingField(null)}
        onSave={saveField}
      />
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} definition={def} title={name} />
    </div>
  )
}

export default function TemplateBuilderPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState<WorkflowTemplate | 'new' | null>(null)

  if (active) {
    return <BuilderView template={active} onBack={() => setActive(null)} />
  }
  return <TemplateListView onEdit={setActive} onCreate={() => setActive('new')} />
}
