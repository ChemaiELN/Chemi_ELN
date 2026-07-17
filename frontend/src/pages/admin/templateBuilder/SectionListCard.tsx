import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Popconfirm } from 'antd'
import { GripVertical, Copy, Trash2, ChevronRight, Layers, Hash } from 'lucide-react'
import type { TemplateSection } from './types'

// One card in the section-overview list. Clicking it opens the section editor.
// Sortable (drag handle) so sections can be reordered without expanding them.
export default function SectionListCard({ section, onOpen, onDuplicate, onDelete }: {
  section: TemplateSection
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `sectionHandle:${section.id}`,
    data: { source: 'sectionHandle', sectionId: section.id },
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const screenCount = section.screens.length
  const fieldCount = section.screens.reduce((n, s) => n + s.fields.length, 0)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl border border-slate-200/70 bg-[#FEFEFA] shadow-sm hover:shadow-lg hover:border-violet-200 hover:-translate-y-0.5 transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Action icons — bottom-right corner (top-right is used by the open arrow) */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button onClick={e => { e.stopPropagation(); onDuplicate() }} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Duplicate section"><Copy size={14} /></button>
        <Popconfirm title="Delete this section and all its screens?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={onDelete}>
          <button onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete section"><Trash2 size={14} /></button>
        </Popconfirm>
      </div>

      <button onClick={onOpen} className="w-full text-left px-4 py-4 flex flex-col gap-2">
        {/* Drag handle + title — same row */}
        <div className="flex items-center gap-2">
          <span
            {...attributes} {...listeners}
            onClick={e => e.stopPropagation()}
            className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to reorder section"
          >
            <GripVertical size={16} />
          </span>
          <p className="flex-1 min-w-0 text-base font-normal text-slate-800 truncate group-hover:text-violet-700 transition-colors">
            {section.title}
          </p>
          <ChevronRight size={18} className="text-slate-300 group-hover:text-violet-500 transition-colors shrink-0" />
        </div>

        <div className="flex items-center gap-2 pl-6">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
            <Layers size={11} />{screenCount} screen{screenCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
            <Hash size={11} />{fieldCount} field{fieldCount !== 1 ? 's' : ''}
          </span>
        </div>
      </button>
    </div>
  )
}
