import { useDraggable } from '@dnd-kit/core'
import {
  Rows, Minus, TextCursorInput, AlignLeft, Hash, Calendar, CalendarClock,
  ToggleLeft, ChevronDownSquare, CheckSquare, ListChecks, CircleDotDashed,
  Paperclip, Image as ImageIcon,
} from 'lucide-react'
import { FIELD_CATEGORIES, FIELD_TYPE_REGISTRY, type FieldType } from './types'

const ICONS: Record<FieldType, React.ElementType> = {
  SECTION_HEADING: Rows,
  SPACER: Minus,
  SINGLE_LINE_TEXT: TextCursorInput,
  MULTI_LINE_TEXT: AlignLeft,
  NUMBER: Hash,
  DATE: Calendar,
  DATE_TIME: CalendarClock,
  YES_NO: ToggleLeft,
  DROPDOWN: ChevronDownSquare,
  CHECKBOX: CheckSquare,
  CHECKLIST: ListChecks,
  RADIO: CircleDotDashed,
  ATTACHMENT: Paperclip,
  IMAGE: ImageIcon,
}

function PaletteItem({ type, label }: { type: FieldType; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: 'palette', fieldType: type },
  })
  const Icon = ICONS[type]

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      <Icon size={14} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

export default function FieldToolbox() {
  return (
    <div className="w-64 shrink-0 glass-card rounded-lg p-4 space-y-5 overflow-y-auto">
      <p className="font-semibold text-sm text-slate-700">Form Elements</p>
      {FIELD_CATEGORIES.map(cat => {
        const items = FIELD_TYPE_REGISTRY.filter(d => d.category === cat)
        return (
          <div key={cat}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">{cat}</p>
            <div className="grid grid-cols-2 gap-2">
              {items.map(d => <PaletteItem key={d.type} type={d.type} label={d.label} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
