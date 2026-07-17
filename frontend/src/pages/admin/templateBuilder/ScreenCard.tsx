import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Select, Popconfirm } from 'antd'
import { GripVertical, Pencil, Copy, Trash2, Columns2, Rows as RowsIcon } from 'lucide-react'
import FieldPreview from './FieldPreview'
import type { TemplateField, TemplateScreen } from './types'

function FieldRow({ field, sectionId, screenId, onEdit, onDuplicate, onDelete }: {
  field: TemplateField
  sectionId: string
  screenId: string
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `field:${field.id}`,
    data: { source: 'field', fieldId: field.id, screenId, sectionId },
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

interface ScreenCardProps {
  screen: TemplateScreen
  sectionId: string
  onRename: (title: string) => void
  onColumnsChange: (columns: 1 | 2) => void
  onDuplicate: () => void
  onDelete: () => void
  onEditField: (field: TemplateField) => void
  onDuplicateField: (fieldId: string) => void
  onDeleteField: (fieldId: string) => void
}

export default function ScreenCard({
  screen, sectionId, onRename, onColumnsChange, onDuplicate, onDelete,
  onEditField, onDuplicateField, onDeleteField,
}: ScreenCardProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(screen.title)

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `screen:${screen.id}`,
    data: { source: 'screen', screenId: screen.id, sectionId },
  })
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging } = useSortable({
    id: `screenHandle:${screen.id}`,
    data: { source: 'screenHandle', screenId: screen.id, sectionId },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const fieldIds = screen.fields.map(f => `field:${f.id}`)

  return (
    <div ref={setSortRef} style={style} className={`rounded-lg border border-slate-200 bg-[#FEFEFA] ${isDragging ? 'opacity-50' : ''}`}>
      {/* Screen header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <button {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" title="Drag to reorder screen">
          <GripVertical size={13} />
        </button>
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => { onRename(titleDraft.trim() || screen.title); setEditingTitle(false) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="flex-1 text-[13px] font-semibold text-slate-600 bg-white border border-violet-300 rounded px-2 py-0.5 outline-none"
          />
        ) : (
          <button onClick={() => { setTitleDraft(screen.title); setEditingTitle(true) }} className="flex-1 text-left text-[13px] font-semibold text-slate-600 hover:text-violet-700 flex items-center gap-1.5">
            {screen.title} <Pencil size={10} className="text-slate-300" />
          </button>
        )}
        <Select
          size="small"
          value={screen.columns}
          onChange={onColumnsChange}
          style={{ width: 104 }}
          options={[
            { value: 1, label: <span className="flex items-center gap-1 text-xs"><RowsIcon size={12} /> 1 column</span> },
            { value: 2, label: <span className="flex items-center gap-1 text-xs"><Columns2 size={12} /> 2 columns</span> },
          ]}
        />
        <button onClick={onDuplicate} className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Duplicate screen"><Copy size={13} /></button>
        <Popconfirm title="Delete this screen and its fields?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={onDelete}>
          <button className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete screen"><Trash2 size={13} /></button>
        </Popconfirm>
      </div>

      {/* Screen body — droppable for new fields */}
      <div
        ref={setDropRef}
        className={`p-3 min-h-[80px] transition-colors ${isOver ? 'bg-violet-50/70' : ''}`}
        style={{ display: 'grid', gridTemplateColumns: screen.columns === 2 ? '1fr 1fr' : '1fr', gap: '10px' }}
      >
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {screen.fields.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              sectionId={sectionId}
              screenId={screen.id}
              onEdit={() => onEditField(field)}
              onDuplicate={() => onDuplicateField(field.id)}
              onDelete={() => onDeleteField(field.id)}
            />
          ))}
        </SortableContext>
        {screen.fields.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-slate-200 rounded-lg py-6 flex items-center justify-center text-xs text-slate-400">
            Drag fields here
          </div>
        )}
      </div>
    </div>
  )
}
