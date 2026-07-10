import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Select, Popconfirm } from 'antd'
import { GripVertical, Pencil, Copy, Trash2, Columns2, Rows as RowsIcon } from 'lucide-react'
import FieldPreview from './FieldPreview'
import type { TemplateField, TemplateSection } from './types'

function FieldRow({ field, onEdit, onDuplicate, onDelete }: {
  field: TemplateField
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field:${field.id}`,
    data: { source: 'field', fieldId: field.id },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, gridColumn: field.colSpan === 2 ? 'span 2' : undefined }}
      className={`group relative border border-transparent hover:border-violet-200 rounded-lg p-2.5 bg-white/60 hover:bg-white transition-colors ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0" title="Drag to reorder">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <FieldPreview field={field} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Edit"><Pencil size={13} /></button>
          <button onClick={onDuplicate} className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Duplicate"><Copy size={13} /></button>
          <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  )
}

interface SectionCardProps {
  section: TemplateSection
  index: number
  onRename: (title: string) => void
  onColumnsChange: (columns: 1 | 2) => void
  onDuplicateSection: () => void
  onDeleteSection: () => void
  onEditField: (field: TemplateField) => void
  onDuplicateField: (fieldId: string) => void
  onDeleteField: (fieldId: string) => void
}

export default function SectionCard({
  section, index, onRename, onColumnsChange, onDuplicateSection, onDeleteSection,
  onEditField, onDuplicateField, onDeleteField,
}: SectionCardProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `section:${section.id}`,
    data: { source: 'section', sectionId: section.id },
  })
  const { attributes, listeners, setNodeRef: setDragRef, transform, transition, isDragging } = useSortable({
    id: `sectionHandle:${section.id}`,
    data: { source: 'sectionHandle', sectionId: section.id },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const fieldIds = section.fields.map(f => `field:${f.id}`)

  return (
    <div ref={setDragRef} style={style} className={`glass-card rounded-xl overflow-hidden ${isDragging ? 'opacity-50' : ''}`}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/50 bg-white/40">
        <button {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" title="Drag to reorder section">
          <GripVertical size={15} />
        </button>
        <span className="text-[10px] font-bold text-slate-400">SECTION {index + 1}</span>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => { onRename(titleDraft.trim() || section.title); setEditingTitle(false) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="flex-1 text-sm font-semibold text-slate-700 bg-white border border-violet-300 rounded px-2 py-0.5 outline-none"
          />
        ) : (
          <button onClick={() => { setTitleDraft(section.title); setEditingTitle(true) }} className="flex-1 text-left text-sm font-semibold text-slate-700 hover:text-violet-700 flex items-center gap-1.5">
            {section.title} <Pencil size={11} className="text-slate-300" />
          </button>
        )}

        <Select
          size="small"
          value={section.columns}
          onChange={onColumnsChange}
          style={{ width: 108 }}
          options={[
            { value: 1, label: <span className="flex items-center gap-1 text-xs"><RowsIcon size={12} /> 1 column</span> },
            { value: 2, label: <span className="flex items-center gap-1 text-xs"><Columns2 size={12} /> 2 columns</span> },
          ]}
        />
        <button onClick={onDuplicateSection} className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Duplicate section"><Copy size={14} /></button>
        <Popconfirm title="Delete this section and all its fields?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={onDeleteSection}>
          <button className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete section"><Trash2 size={14} /></button>
        </Popconfirm>
      </div>

      {/* Section body — droppable for new fields from the palette */}
      <div
        ref={setDropRef}
        className={`p-4 min-h-[100px] transition-colors ${isOver ? 'bg-violet-50/70' : ''}`}
        style={{ display: 'grid', gridTemplateColumns: section.columns === 2 ? '1fr 1fr' : '1fr', gap: '10px' }}
      >
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {section.fields.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              onEdit={() => onEditField(field)}
              onDuplicate={() => onDuplicateField(field.id)}
              onDelete={() => onDeleteField(field.id)}
            />
          ))}
        </SortableContext>
        {section.fields.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-slate-200 rounded-lg py-8 flex items-center justify-center text-xs text-slate-400">
            Drag fields here
          </div>
        )}
      </div>
    </div>
  )
}
