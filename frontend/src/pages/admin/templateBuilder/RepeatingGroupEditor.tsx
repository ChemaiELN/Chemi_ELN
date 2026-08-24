import { Select } from 'antd'
import { Pencil, Copy, Trash2 } from 'lucide-react'
import FieldPreview from './FieldPreview'
import { FIELD_TYPE_REGISTRY, type TemplateField, type TemplateScreen, type FieldType } from './types'

// Nesting a repeating group inside a repeating group isn't supported by the
// runtime — excluded from what can be added into a sub-screen.
const ADDABLE_TYPES = FIELD_TYPE_REGISTRY.filter(d => d.type !== 'REPEATING_GROUP')

function SubFieldRow({ field, onEdit, onDuplicate, onDelete }: {
  field: TemplateField
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div
      style={{ gridColumn: field.colSpan === 2 ? 'span 2' : undefined }}
      className="group relative border border-transparent hover:border-violet-200 rounded-lg p-2 bg-white/60 hover:bg-white transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <FieldPreview field={field} />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Edit"><Pencil size={12} /></button>
          <button onClick={onDuplicate} className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Duplicate"><Copy size={12} /></button>
          <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  )
}

// Editable version of a REPEATING_GROUP's sub-screens, used only on the design
// canvas (ScreenCard) — the PreviewModal keeps rendering these read-only via
// FieldPreview's own REPEATING_GROUP case, since that's a fill-in simulation,
// not the builder. Scoped deliberately: lets fields already on a sub-screen be
// edited/duplicated/deleted, and new fields added to an existing sub-screen —
// but not reordering or adding/removing whole sub-screens (those still require
// editing the seed Python directly).
export default function RepeatingGroupEditor({
  screens, itemLabel, onEditField, onDuplicateField, onDeleteField, onAddField,
}: {
  screens: TemplateScreen[]
  itemLabel: string
  onEditField: (subScreenId: string, field: TemplateField) => void
  onDuplicateField: (subScreenId: string, fieldId: string) => void
  onDeleteField: (subScreenId: string, fieldId: string) => void
  onAddField: (subScreenId: string, type: FieldType) => void
}) {
  return (
    <div className="border border-violet-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-200">
        <span className="text-xs font-semibold text-violet-700">{itemLabel} 1</span>
        <span className="text-[11px] text-slate-400 italic">repeating — edits apply to every item</span>
      </div>
      <div className="p-3 space-y-4">
        {screens.map(subScreen => (
          <div key={subScreen.id}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{subScreen.title}</p>
              <Select
                size="small"
                placeholder="+ Add field"
                value={undefined}
                style={{ width: 140 }}
                options={ADDABLE_TYPES.map(d => ({ value: d.type, label: d.label }))}
                onChange={(v: FieldType) => onAddField(subScreen.id, v)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: subScreen.columns === 2 ? '1fr 1fr' : '1fr', gap: '8px' }}>
              {subScreen.fields.map(f => (
                <SubFieldRow
                  key={f.id}
                  field={f}
                  onEdit={() => onEditField(subScreen.id, f)}
                  onDuplicate={() => onDuplicateField(subScreen.id, f.id)}
                  onDelete={() => onDeleteField(subScreen.id, f.id)}
                />
              ))}
              {subScreen.fields.length === 0 && (
                <div className="col-span-full border border-dashed border-slate-200 rounded py-3 text-center text-[11px] text-slate-400">
                  No fields
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
