import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, message, Popconfirm, Select, Tag } from 'antd'
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronDown, Plus, Eye, Copy, Trash2, Pencil, Save, Send, FolderOpen } from 'lucide-react'
import { workflowTemplateApi } from '../../../api/adc'
import type { WorkflowTemplate } from '../../../api/adc'
import FieldToolbox from './FieldToolbox'
import SectionListCard from './SectionListCard'
import ScreenCard from './ScreenCard'
import FieldPropertiesDrawer from './FieldPropertiesDrawer'
import PreviewModal from './PreviewModal'
import {
  makeField, makeScreen, makeSection, descriptorFor, newId,
  type TemplateDefinition, type TemplateField, type TemplateScreen, type TemplateSection, type FieldType,
} from './types'

const EMPTY_DEF: TemplateDefinition = { sections: [] }

// Modalities this builder can manage — each is a distinct workflow_template
// category so Plasmid and AAV templates don't mix in the same list/picker.
const MODALITIES = [
  { value: 'CGT_PLASMID', label: 'Plasmid', slugPrefix: 'cgt-plasmid' },
  { value: 'CGT_AAV', label: 'AAV', slugPrefix: 'cgt-aav' },
  { value: 'CGT_MOLBIO', label: 'Mol-Bio', slugPrefix: 'cgt-molbio' },
  { value: 'CGT_ADC', label: 'ADC Synthesis', slugPrefix: 'cgt-adc' },
] as const
type Category = typeof MODALITIES[number]['value']

interface OverData {
  source?: string
  fieldType?: FieldType
  fieldId?: string
  screenId?: string
  sectionId?: string
}

// ── Pure definition transforms (no React) ────────────────────────────────────
function deepCopyScreen(s: TemplateScreen, titleSuffix = ''): TemplateScreen {
  return {
    id: newId('screen'),
    title: s.title + titleSuffix,
    columns: s.columns,
    fields: s.fields.map(f => ({ ...f, id: newId('field') })),
  }
}

function mapScreens(d: TemplateDefinition, screenId: string, fn: (s: TemplateScreen) => TemplateScreen): TemplateDefinition {
  return { sections: d.sections.map(sec => ({ ...sec, screens: sec.screens.map(s => s.id === screenId ? fn(s) : s) })) }
}

// Inventory-backed dropdowns on the same screen as `field` (excluding itself) —
// the candidates that can drive auto-fill for `field`.
function driverFieldsFor(d: TemplateDefinition, field: TemplateField | null): TemplateField[] {
  if (!field) return []
  const screen = d.sections
    .flatMap(s => s.screens)
    .find(sc => sc.fields.some(f => f.id === field.id))
  if (!screen) return []
  return screen.fields.filter(
    f => f.id !== field.id && f.type === 'DROPDOWN' && f.optionsMode === 'inventory',
  )
}

// Group consecutive sections that share a `phase` into one block, preserving
// order. Sections without a phase form their own single-section groups.
function groupByPhase(sections: TemplateSection[]): { phase?: string; sections: TemplateSection[] }[] {
  const groups: { phase?: string; sections: TemplateSection[] }[] = []
  for (const s of sections) {
    const last = groups[groups.length - 1]
    if (last && last.phase === s.phase && s.phase !== undefined) last.sections.push(s)
    else groups.push({ phase: s.phase, sections: [s] })
  }
  return groups
}

// ── Template list view ──────────────────────────────────────────────────────
function TemplateListView({ category, onCategoryChange, onEdit, onCreate }: {
  category: Category
  onCategoryChange: (c: Category) => void
  onEdit: (t: WorkflowTemplate) => void
  onCreate: () => void
}) {
  const qc = useQueryClient()
  const queryKey = ['cgt-templates', category]
  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => workflowTemplateApi.list({ category }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => workflowTemplateApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); message.success('Template deleted') },
    onError: () => message.error('Failed to delete template'),
  })

  const duplicateMut = useMutation({
    mutationFn: async (t: WorkflowTemplate) => {
      const full = await workflowTemplateApi.get(t.id)
      return workflowTemplateApi.create({
        name: `${t.name} (Copy)`,
        slug: `${t.slug}-copy-${Date.now().toString(36)}`,
        category,
        description: t.description,
        is_active: false,
        definition: full.definition,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); message.success('Template duplicated as a draft') },
    onError: () => message.error('Failed to duplicate template'),
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Template Builder</h1>
          <p className="text-slate-400 text-sm">CGT Process — form templates</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={category}
            onChange={v => onCategoryChange(v as Category)}
            options={MODALITIES.map(m => ({ label: m.label, value: m.value }))}
            style={{ width: 140 }}
            className="fefefa-select"
          />
          <Button type="primary" icon={<Plus size={14} />} onClick={onCreate}>New Template</Button>
        </div>
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
function BuilderView({ template, category, onBack }: { template: WorkflowTemplate | 'new'; category: Category; onBack: () => void }) {
  const qc = useQueryClient()
  const isNew = template === 'new'
  // Editing an existing template keeps its own category; only a brand-new
  // template picks up whatever modality was selected in the list view.
  const effectiveCategory = isNew ? category : (template.category as Category)
  const modality = MODALITIES.find(m => m.value === effectiveCategory) ?? MODALITIES[0]

  const { data: full, isLoading } = useQuery({
    queryKey: ['cgt-template', isNew ? 'new' : template.id],
    queryFn: () => isNew ? Promise.resolve(null) : workflowTemplateApi.get(template.id),
    enabled: !isNew,
  })

  const [name, setName] = useState(isNew ? `New ${modality.label} Template` : template.name)
  const [def, setDef] = useState<TemplateDefinition>(EMPTY_DEF)
  const [loadedDef, setLoadedDef] = useState(false)
  const [editingField, setEditingField] = useState<TemplateField | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeDragType, setActiveDragType] = useState<FieldType | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  // Accordion: only one phase group is open at a time. `null` means "use the
  // default" (first phase open); '' means the user has collapsed every group.
  const [openPhase, setOpenPhase] = useState<string | null>(null)
  const orderedPhases = groupByPhase(def.sections)
    .map(g => g.phase)
    .filter((p): p is string => !!p)
  const effectiveOpenPhase = openPhase === null ? (orderedPhases[0] ?? null) : (openPhase || null)
  const togglePhase = (phase: string) => setOpenPhase(effectiveOpenPhase === phase ? '' : phase)
  const [editingSecTitle, setEditingSecTitle] = useState(false)
  const [secTitleDraft, setSecTitleDraft] = useState('')

  if (full && !loadedDef) {
    setDef((full.definition as TemplateDefinition) ?? EMPTY_DEF)
    setLoadedDef(true)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const persist = useMutation({
    mutationFn: async (opts: { publish?: boolean }) => {
      const body = {
        name,
        category: effectiveCategory,
        definition: def,
        ...(opts.publish !== undefined ? { is_active: opts.publish } : {}),
      }
      if (isNew) {
        return workflowTemplateApi.create({ ...body, slug: newId(modality.slugPrefix), is_active: opts.publish ?? false })
      }
      return workflowTemplateApi.update(template.id, body)
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['cgt-templates', effectiveCategory] })
      // The individual-template query (read when a draft is reopened) was never
      // invalidated/updated after a save, so reopening served the stale
      // pre-save cache instead of what was just written. Seed it with the
      // response we already have so the next open is correct immediately.
      qc.setQueryData(['cgt-template', saved.id], saved)
      message.success('Template saved')
      onBack()
    },
    onError: () => message.error('Failed to save template'),
  })

  const sectionIds = useMemo(() => def.sections.map(s => `sectionHandle:${s.id}`), [def.sections])

  // ── Section CRUD ──
  const addSection = () => setDef(d => ({ sections: [...d.sections, makeSection(`Section ${d.sections.length + 1}`)] }))
  const renameSection = (id: string, title: string) => setDef(d => ({ sections: d.sections.map(s => s.id === id ? { ...s, title } : s) }))
  const setSectionPhase = (id: string, phase: string) => setDef(d => ({ sections: d.sections.map(s => s.id === id ? { ...s, phase: phase.trim() || undefined } : s) }))
  const deleteSection = (id: string) => setDef(d => ({ sections: d.sections.filter(s => s.id !== id) }))
  const duplicateSection = (id: string) => setDef(d => {
    const s = d.sections.find(x => x.id === id)
    if (!s) return d
    const copy: TemplateSection = { id: newId('section'), title: `${s.title} (Copy)`, phase: s.phase, screens: s.screens.map(sc => deepCopyScreen(sc)) }
    const idx = d.sections.findIndex(x => x.id === id)
    const next = [...d.sections]
    next.splice(idx + 1, 0, copy)
    return { sections: next }
  })

  // ── Screen CRUD ──
  const addScreen = (sectionId: string) => setDef(d => ({
    sections: d.sections.map(s => s.id === sectionId ? { ...s, screens: [...s.screens, makeScreen(`Screen ${s.screens.length + 1}`)] } : s),
  }))
  const renameScreen = (screenId: string, title: string) => setDef(d => mapScreens(d, screenId, s => ({ ...s, title })))
  const screenColumns = (screenId: string, columns: 1 | 2) => setDef(d => mapScreens(d, screenId, s => ({ ...s, columns })))
  const deleteScreen = (screenId: string) => setDef(d => ({ sections: d.sections.map(s => ({ ...s, screens: s.screens.filter(sc => sc.id !== screenId) })) }))
  const duplicateScreen = (sectionId: string, screenId: string) => setDef(d => ({
    sections: d.sections.map(s => {
      if (s.id !== sectionId) return s
      const idx = s.screens.findIndex(sc => sc.id === screenId)
      if (idx < 0) return s
      const copy = deepCopyScreen(s.screens[idx], ' (Copy)')
      const next = [...s.screens]
      next.splice(idx + 1, 0, copy)
      return { ...s, screens: next }
    }),
  }))

  // ── Field CRUD ──
  const deleteField = (screenId: string, fieldId: string) =>
    setDef(d => mapScreens(d, screenId, s => ({ ...s, fields: s.fields.filter(f => f.id !== fieldId) })))
  const duplicateField = (screenId: string, fieldId: string) =>
    setDef(d => mapScreens(d, screenId, s => {
      const idx = s.fields.findIndex(f => f.id === fieldId)
      if (idx < 0) return s
      const copy = { ...s.fields[idx], id: newId('field'), name: `${s.fields[idx].name}_copy` }
      const next = [...s.fields]
      next.splice(idx + 1, 0, copy)
      return { ...s, fields: next }
    }))
  const saveField = (updated: TemplateField) => {
    setDef(d => ({
      sections: d.sections.map(s => ({
        ...s,
        screens: s.screens.map(sc => ({ ...sc, fields: sc.fields.map(f => f.id === updated.id ? updated : f) })),
      })),
    }))
    setEditingField(null)
  }

  // ── DnD ──
  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as OverData | undefined
    if (data?.source === 'palette' && data.fieldType) setActiveDragType(data.fieldType)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragType(null)
    const { active, over } = e
    if (!over) return
    const a = active.data.current as OverData | undefined
    const o = over.data.current as OverData | undefined
    if (!a) return

    const targetScreenId = o?.screenId
    const targetSectionId = o?.sectionId
    const targetFieldId = o?.source === 'field' ? o.fieldId : undefined

    // 1) New field from palette → drop into a screen
    if (a.source === 'palette' && a.fieldType) {
      if (!targetScreenId) return
      const nf = makeField(a.fieldType)
      setDef(d => mapScreens(d, targetScreenId, s => {
        if (targetFieldId) {
          const idx = s.fields.findIndex(f => f.id === targetFieldId)
          const next = [...s.fields]
          next.splice(idx, 0, nf)
          return { ...s, fields: next }
        }
        return { ...s, fields: [...s.fields, nf] }
      }))
      return
    }

    // 2) Move / reorder an existing field
    if (a.source === 'field' && a.fieldId) {
      const fromScreenId = a.screenId!
      const toScreenId = targetScreenId ?? fromScreenId
      if (fromScreenId === toScreenId) {
        if (!targetFieldId || targetFieldId === a.fieldId) return
        setDef(d => mapScreens(d, toScreenId, s => {
          const oldIdx = s.fields.findIndex(f => f.id === a.fieldId)
          const newIdx = s.fields.findIndex(f => f.id === targetFieldId)
          return { ...s, fields: arrayMove(s.fields, oldIdx, newIdx) }
        }))
      } else {
        setDef(d => {
          let moved: TemplateField | undefined
          const stripped = d.sections.map(s => ({
            ...s,
            screens: s.screens.map(sc => {
              if (sc.id !== fromScreenId) return sc
              moved = sc.fields.find(f => f.id === a.fieldId)
              return { ...sc, fields: sc.fields.filter(f => f.id !== a.fieldId) }
            }),
          }))
          if (!moved) return d
          return {
            sections: stripped.map(s => ({
              ...s,
              screens: s.screens.map(sc => {
                if (sc.id !== toScreenId) return sc
                if (targetFieldId) {
                  const idx = sc.fields.findIndex(f => f.id === targetFieldId)
                  const next = [...sc.fields]
                  next.splice(idx, 0, moved!)
                  return { ...sc, fields: next }
                }
                return { ...sc, fields: [...sc.fields, moved!] }
              }),
            })),
          }
        })
      }
      return
    }

    // 3) Reorder / move a screen
    if (a.source === 'screenHandle' && a.screenId) {
      const fromSectionId = a.sectionId!
      const toSectionId = targetSectionId ?? fromSectionId
      const overScreenId = o?.screenId
      if (fromSectionId === toSectionId) {
        if (!overScreenId || overScreenId === a.screenId) return
        setDef(d => ({
          sections: d.sections.map(s => {
            if (s.id !== fromSectionId) return s
            const oldIdx = s.screens.findIndex(sc => sc.id === a.screenId)
            const newIdx = s.screens.findIndex(sc => sc.id === overScreenId)
            if (oldIdx < 0 || newIdx < 0) return s
            return { ...s, screens: arrayMove(s.screens, oldIdx, newIdx) }
          }),
        }))
      } else {
        setDef(d => {
          let moved: TemplateScreen | undefined
          const stripped = d.sections.map(s => {
            if (s.id !== fromSectionId) return s
            moved = s.screens.find(sc => sc.id === a.screenId)
            return { ...s, screens: s.screens.filter(sc => sc.id !== a.screenId) }
          })
          if (!moved) return d
          return {
            sections: stripped.map(s => {
              if (s.id !== toSectionId) return s
              if (overScreenId) {
                const idx = s.screens.findIndex(sc => sc.id === overScreenId)
                const next = [...s.screens]
                next.splice(idx, 0, moved!)
                return { ...s, screens: next }
              }
              return { ...s, screens: [...s.screens, moved!] }
            }),
          }
        })
      }
      return
    }

    // 4) Reorder a section
    if (a.source === 'sectionHandle' && a.sectionId) {
      if (!targetSectionId || targetSectionId === a.sectionId) return
      setDef(d => {
        const oldIdx = d.sections.findIndex(s => s.id === a.sectionId)
        const newIdx = d.sections.findIndex(s => s.id === targetSectionId)
        if (oldIdx < 0 || newIdx < 0) return d
        return { sections: arrayMove(d.sections, oldIdx, newIdx) }
      })
    }
  }

  if (!isNew && isLoading) return <div className="p-6 text-sm text-slate-400">Loading template…</div>

  const activeSection = def.sections.find(s => s.id === activeSectionId) ?? null

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {activeSection ? (
            /* Single breadcrumb trail: template → all sections → this section */
            <nav className="flex items-center gap-2 text-sm min-w-0">
              <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-violet-700 transition-colors shrink-0">
                <ChevronLeft size={15} /> {name}
              </button>
              <span className="text-slate-300">/</span>
              <button onClick={() => { setActiveSectionId(null); setEditingSecTitle(false) }} className="text-slate-500 hover:text-violet-700 transition-colors shrink-0">
                All sections
              </button>
              <span className="text-slate-300">/</span>
              {editingSecTitle ? (
                <input
                  autoFocus
                  value={secTitleDraft}
                  onChange={e => setSecTitleDraft(e.target.value)}
                  onBlur={() => { renameSection(activeSection.id, secTitleDraft.trim() || activeSection.title); setEditingSecTitle(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="text-sm font-semibold text-slate-700 bg-white border border-violet-300 rounded px-2 py-0.5 outline-none w-56"
                />
              ) : (
                <button onClick={() => { setSecTitleDraft(activeSection.title); setEditingSecTitle(true) }} className="text-sm font-semibold text-slate-700 hover:text-violet-700 flex items-center gap-1.5 min-w-0">
                  <span className="truncate">{activeSection.title}</span> <Pencil size={11} className="text-slate-300 shrink-0" />
                </button>
              )}
            </nav>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeSection && (
            <Input
              value={activeSection.phase ?? ''}
              onChange={e => setSectionPhase(activeSection.id, e.target.value)}
              placeholder="Phase / group (e.g. RUN SETUP)"
              style={{ width: 220, backgroundColor: '#FEFEFA' }}
              allowClear
            />
          )}
          <Button icon={<Eye size={13} />} style={{ backgroundColor: '#FEFEFA' }} onClick={() => setPreviewOpen(true)}>Preview</Button>
          <Button icon={<Save size={13} />} style={{ backgroundColor: '#FEFEFA' }} loading={persist.isPending} onClick={() => persist.mutate({ publish: isNew ? false : undefined })}>
            Save Draft
          </Button>
          <Button type="primary" icon={<Send size={13} />} loading={persist.isPending} onClick={() => persist.mutate({ publish: true })}>
            Publish
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {!activeSection ? (
          /* ── Section overview (cards) ── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600">Sections</p>
              <span className="text-xs text-slate-400">{def.sections.length} section{def.sections.length !== 1 ? 's' : ''}</span>
            </div>
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              {groupByPhase(def.sections).map((group, gi) => {
                const cards = group.sections.map(section => (
                  <SectionListCard
                    key={section.id}
                    section={section}
                    onOpen={() => setActiveSectionId(section.id)}
                    onDuplicate={() => duplicateSection(section.id)}
                    onDelete={() => deleteSection(section.id)}
                  />
                ))
                const grid = <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{cards}</div>
                if (!group.phase) return <div key={`grp-${gi}`}>{grid}</div>
                const isCollapsed = group.phase !== effectiveOpenPhase
                return (
                  <div key={`grp-${gi}`} className="space-y-2">
                    <button
                      onClick={() => togglePhase(group.phase!)}
                      className="flex items-center gap-2 px-1 pt-1 w-full text-left group/phase"
                    >
                      <ChevronDown
                        size={13}
                        className={`text-violet-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-violet-600 group-hover/phase:text-violet-800">{group.phase}</span>
                      <span className="text-[11px] text-slate-400">
                        {group.sections.length} screen{group.sections.length !== 1 ? 's' : ''}
                      </span>
                    </button>
                    {!isCollapsed && <div className="pl-3 border-l-2 border-violet-100">{grid}</div>}
                  </div>
                )
              })}
            </SortableContext>
            {def.sections.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No sections yet. Add one to start building.</p>
            )}
            <button
              onClick={addSection}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-5 flex items-center justify-center gap-2 text-sm text-slate-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/40 transition-colors"
            >
              <Plus size={15} /> Add Section
            </button>
          </div>
        ) : (
          /* ── Single-section editor ── */
          <div className="space-y-3">
            {/* Fixed-height row: the left palette stays put; only the right
                column (screens/fields) scrolls when there are many fields. */}
            <div className="flex gap-4 items-stretch h-[calc(100vh-150px)]">
              <FieldToolbox />
              <div className="flex-1 space-y-3 min-w-0 overflow-y-auto pr-1 no-scrollbar">
                <SortableContext items={activeSection.screens.map(s => `screenHandle:${s.id}`)} strategy={verticalListSortingStrategy}>
                  {activeSection.screens.map(screen => (
                    <ScreenCard
                      key={screen.id}
                      screen={screen}
                      sectionId={activeSection.id}
                      onRename={title => renameScreen(screen.id, title)}
                      onColumnsChange={cols => screenColumns(screen.id, cols)}
                      onDuplicate={() => duplicateScreen(activeSection.id, screen.id)}
                      onDelete={() => deleteScreen(screen.id)}
                      onEditField={field => setEditingField(field)}
                      onDuplicateField={fieldId => duplicateField(screen.id, fieldId)}
                      onDeleteField={fieldId => deleteField(screen.id, fieldId)}
                    />
                  ))}
                </SortableContext>
                <button
                  onClick={() => addScreen(activeSection.id)}
                  className="w-full border border-dashed border-slate-200 rounded-lg py-3 flex items-center justify-center gap-2 text-xs text-slate-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/40 transition-colors"
                >
                  <Plus size={13} /> Add Screen
                </button>
              </div>
            </div>
          </div>
        )}

        <DragOverlay>
          {activeDragType && (
            <div className="rounded-lg border border-violet-300 bg-white shadow-lg px-3 py-2 text-xs text-violet-700">
              {descriptorFor(activeDragType).label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <FieldPropertiesDrawer
        field={editingField}
        driverFields={driverFieldsFor(def, editingField)}
        onClose={() => setEditingField(null)}
        onSave={saveField}
      />
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} definition={def} title={name} />
    </div>
  )
}

export default function TemplateBuilderPage() {
  const [category, setCategory] = useState<Category>('CGT_PLASMID')
  const [active, setActive] = useState<WorkflowTemplate | 'new' | null>(null)

  if (active) {
    return <BuilderView template={active} category={category} onBack={() => setActive(null)} />
  }
  return (
    <TemplateListView
      category={category}
      onCategoryChange={setCategory}
      onEdit={setActive}
      onCreate={() => setActive('new')}
    />
  )
}
