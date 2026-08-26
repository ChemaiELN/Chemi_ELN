import { useDraggable } from '@dnd-kit/core'
import { Popover } from 'antd'
import {
  Rows, Minus, TextCursorInput, AlignLeft, Hash, Calendar, CalendarClock,
  ToggleLeft, ChevronDownSquare, CheckSquare, ListChecks, CircleDotDashed,
  Paperclip, Image as ImageIcon, Lock, PenLine, Sheet, Layers, FlaskConical, Signature, FileSearch, Clock3, Timer,
} from 'lucide-react'
import { FIELD_CATEGORIES, FIELD_TYPE_REGISTRY, type FieldType } from './types'

// Static, non-interactive mockup of the raised ATR Form panel — shown on
// hover over the ATR Request palette tile so authors can see roughly what
// they're dropping in, without any live data or API calls.
function AtrRequestPreviewMockup() {
  const sections = ['Summary', 'Form Attributes', 'Sample Details', 'Test Details', 'Supporting Docs']
  return (
    <div className="w-56 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <FileSearch size={13} className="text-violet-500" />
        ATR Form
      </div>
      <div className="space-y-1.5">
        {sections.map(s => (
          <div key={s} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s}</p>
            <div className="mt-1 h-1.5 w-3/4 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 italic">Opens a Form Type picker, then expands into this form.</p>
    </div>
  )
}

const ICONS: Record<FieldType, React.ElementType> = {
  SECTION_HEADING: Rows,
  SPACER: Minus,
  LOCK_TOGGLE: Lock,
  SINGLE_LINE_TEXT: TextCursorInput,
  MULTI_LINE_TEXT: AlignLeft,
  RICH_TEXT: PenLine,
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
  SPREADSHEET: Sheet,
  REPEATING_GROUP: Layers,
  KETCHER: FlaskConical,
  SIGNATURE: Signature,
  ATR_REQUEST: FileSearch,
  USAGE_LOG_START_STOP: Clock3,
  TIMER: Timer,
}

function PaletteItem({ type, label }: { type: FieldType; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: 'palette', fieldType: type },
  })
  const Icon = ICONS[type]

  const button = (
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

  if (type === 'ATR_REQUEST') {
    return (
      <Popover content={<AtrRequestPreviewMockup />} placement="right" mouseEnterDelay={0.3}>
        {button}
      </Popover>
    )
  }

  return button
}

export default function FieldToolbox() {
  return (
    <div className="w-64 shrink-0 glass-card rounded-lg p-4 space-y-5 overflow-y-auto no-scrollbar">
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
