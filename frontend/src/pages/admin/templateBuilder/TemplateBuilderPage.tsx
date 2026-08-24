import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, message, Popconfirm, Select, Switch, Tag, Tooltip } from 'antd'
import {
  DndContext, PointerSensor, useSensor, useSensors, DragOverlay,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { ChevronLeft, ChevronDown, Plus, Eye, Copy, Trash2, Pencil, Save, Send, FolderOpen, History } from 'lucide-react'
import { workflowTemplateApi } from '../../../api/adc'
import type { WorkflowTemplate } from '../../../api/adc'
import FieldToolbox from './FieldToolbox'
import SectionListCard from './SectionListCard'
import ScreenCard from './ScreenCard'
import FieldPropertiesDrawer, { type AutoPopulateApply } from './FieldPropertiesDrawer'
import PreviewModal from './PreviewModal'
import PreviousVersionsList from './PreviousVersionsList'
import BrandSpinner from '../../../components/ui/BrandSpinner'
import {
  makeField, makeScreen, makeSection, descriptorFor, newId,
  type TemplateDefinition, type TemplateField, type TemplateScreen, type TemplateSection, type FieldType,
} from './types'

const EMPTY_DEF: TemplateDefinition = { sections: [] }

// Modalities this builder can manage — each is a distinct workflow_template
// category so templates from different modalities don't mix in the same
// list/picker. The 'CGT_' prefix is a historical naming artifact of this
// builder, not a department marker — CGT_ADC is ADC's own "ADC Synthesis"
// modality, authored with this same builder rather than the module.
const MODALITIES = [
  { value: 'CGT_PLASMID', label: 'Plasmid', slugPrefix: 'cgt-plasmid', module: 'CGT' },
  { value: 'CGT_AAV', label: 'AAV', slugPrefix: 'cgt-aav', module: 'CGT' },
  { value: 'CGT_MOLBIO', label: 'Mol-Bio', slugPrefix: 'cgt-molbio', module: 'CGT' },
  { value: 'CGT_ADC', label: 'ADC Synthesis', slugPrefix: 'cgt-adc', module: 'ADC' },
] as const
type Category = typeof MODALITIES[number]['value']
type BuilderScope = 'ADC' | 'CGT'
const modalitiesForScope = (scope: BuilderScope) => MODALITIES.filter(m => m.module === scope)

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

// Applies `fn` to a REPEATING_GROUP field's nested sub-screens (repeatConfig.screens)
// — the same shape as a section's top-level screens, one level deeper. Used to let
// fields *inside* a repeating group (e.g. Buffer Preparation's Components table) be
// edited from the canvas, without exposing add/remove of the sub-screens themselves.
function mapGroupScreens(
  d: TemplateDefinition, screenId: string, groupFieldId: string,
  fn: (screens: TemplateScreen[]) => TemplateScreen[],
): TemplateDefinition {
  return mapScreens(d, screenId, s => ({
    ...s,
    fields: s.fields.map(f => (f.id === groupFieldId && f.type === 'REPEATING_GROUP' && f.repeatConfig)
      ? { ...f, repeatConfig: { ...f.repeatConfig, screens: fn(f.repeatConfig.screens) } }
      : f),
  }))
}

// Inventory- or screen-rows-backed dropdowns on the same screen as `field`
// (excluding itself) — the candidates that can drive auto-fill for `field`.
function driverFieldsFor(d: TemplateDefinition, field: TemplateField | null): TemplateField[] {
  if (!field) return []
  const screen = d.sections
    .flatMap(s => s.screens)
    .find(sc => sc.fields.some(f => f.id === field.id))
  if (!screen) return []
  return screen.fields.filter(
    f => f.id !== field.id && f.type === 'DROPDOWN' && (f.optionsMode === 'inventory' || f.optionsMode === 'screenRows'),
  )
}

// Every table/entry-table screen in the WHOLE template (all sections) — the
// candidates a DROPDOWN's optionsMode 'screenRows' can point at, since it may
// read rows entered into a screen in a DIFFERENT section (e.g. a Filters
// table pulling from 1.4 Consumables).
export interface CrossScreenRef { sectionId: string; sectionTitle: string; screenId: string; screenTitle: string; fields: TemplateField[] }
function allTableScreensFor(d: TemplateDefinition): CrossScreenRef[] {
  return d.sections.flatMap(s =>
    s.screens.filter(sc => isTableTitle(sc.title)).map(sc => ({
      sectionId: s.id, sectionTitle: s.title, screenId: sc.id, screenTitle: sc.title, fields: sc.fields,
    })),
  )
}

// Every SPREADSHEET field in the WHOLE template (all sections/screens) — the
// candidates a 'spreadsheet'-mode autoFill can pull a computed output value
// from, since the target field (e.g. 3.3's "carried from 3.2" figures) is
// usually on a different section than the spreadsheet itself.
export interface CrossScreenSpreadsheetRef { sectionId: string; sectionTitle: string; screenId: string; screenTitle: string; field: TemplateField }
function allSpreadsheetFieldsFor(d: TemplateDefinition): CrossScreenSpreadsheetRef[] {
  return d.sections.flatMap(s =>
    s.screens.flatMap(sc =>
      sc.fields.filter(f => f.type === 'SPREADSHEET').map(f => ({
        sectionId: s.id, sectionTitle: s.title, screenId: sc.id, screenTitle: sc.title, field: f,
      })),
    ),
  )
}

// Fields on the same screen that an inventory dropdown can auto-populate:
// non-layout, and not themselves inventory-backed dropdowns.
function siblingFieldsFor(d: TemplateDefinition, field: TemplateField | null): TemplateField[] {
  if (!field) return []
  const screen = d.sections
    .flatMap(s => s.screens)
    .find(sc => sc.fields.some(f => f.id === field.id))
  if (!screen) return []
  return screen.fields.filter(
    f => f.id !== field.id
      && f.type !== 'SECTION_HEADING' && f.type !== 'SPACER'
      && !(f.type === 'DROPDOWN' && f.optionsMode === 'inventory'),
  )
}

// Materials dropdowns anywhere in the same SECTION (across all its screens,
// not just the current one) — candidates for a Batches dropdown's "filter by
// material field", since the batch table is typically its own screen separate
// from the material-identity screen that drives it.
// Every inventory-backed dropdown anywhere in the same SECTION (excluding
// `field` itself) — the drawer filters this down by whichever `parentSource`
// the currently-selected source's `filterByParent` requires (e.g. batches
// need a 'materials' driver, test_methods need a 'test_names' driver).
function sectionInventoryDriversFor(d: TemplateDefinition, field: TemplateField | null): TemplateField[] {
  if (!field) return []
  const sec = d.sections.find(s => s.screens.some(sc => sc.fields.some(f => f.id === field.id)))
  if (!sec) return []
  return sec.screens
    .flatMap(sc => sc.fields)
    .filter(f => f.id !== field.id && f.type === 'DROPDOWN' && f.optionsMode === 'inventory' && !!f.inventorySource?.source)
}

// NUMBER fields anywhere in the same SECTION (across all its screens) other
// than `field` itself — candidates for its "add/subtract into" target.
function sectionNumberFieldsFor(d: TemplateDefinition, field: TemplateField | null): TemplateField[] {
  if (!field) return []
  const sec = d.sections.find(s => s.screens.some(sc => sc.fields.some(f => f.id === field.id)))
  if (!sec) return []
  return sec.screens
    .flatMap(sc => sc.fields)
    .filter(f => f.id !== field.id && f.type === 'NUMBER')
}

// Table / entry-table screens (repeatable rows) anywhere in the same SECTION
// as `field` — candidates for a LOCK_TOGGLE field's "mirror rows on lock"
// source/target pickers. Same title convention the runtime uses (CgtSectionPage).
const isTableTitle = (title: string) => /\((?:entry\s+)?table\)\s*$/i.test(title.trim())
function sectionTableScreensFor(d: TemplateDefinition, field: TemplateField | null): TemplateScreen[] {
  if (!field) return []
  const sec = d.sections.find(s => s.screens.some(sc => sc.fields.some(f => f.id === field.id)))
  if (!sec) return []
  return sec.screens.filter(sc => isTableTitle(sc.title))
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
function TemplateListView({ scope, category, onCategoryChange, onEdit, onCreate }: {
  scope: BuilderScope
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

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Template Builder</h1>
          <p className="text-slate-400 text-sm">{scope} Process — form templates</p>
        </div>
        <div className="flex items-center gap-3">
          {modalitiesForScope(scope).length > 1 && (
            <Select
              value={category}
              onChange={v => onCategoryChange(v as Category)}
              options={modalitiesForScope(scope).map(m => ({ label: m.label, value: m.value }))}
              style={{ width: 140 }}
              className="fefefa-select"
            />
          )}
          <Button type="primary" icon={<Plus size={14} />} onClick={onCreate}>New Template</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 h-[40vh]"><BrandSpinner fullScreen={false} label="Loading templates…" /></div>
      ) : data.length === 0 ? (
        <div className="rounded-lg p-16 flex flex-col items-center gap-2 text-center" style={{ backgroundColor: '#FEFEFA' }}>
          <FolderOpen size={28} className="text-slate-300" />
          <p className="text-sm text-slate-400">No templates yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => {
            const isExpanded = expandedHistoryId === t.id
            return (
              <Fragment key={t.id}>
                <div className="rounded-xl p-4 flex flex-col" style={{ backgroundColor: '#FEFEFA' }}>
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    <Tag color={t.is_active ? 'green' : 'default'}>{t.is_active ? 'Published' : 'Draft'}</Tag>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">v{t.version} · {t.slug}</p>
                  <p className="text-xs text-slate-500 flex-1 mb-3">{t.description || 'No description'}</p>
                  <div className="flex items-center gap-1.5 border-t border-white/50 pt-3">
                    <Button size="small" icon={<Pencil size={12} />} onClick={() => onEdit(t)}>Edit</Button>
                    <Button size="small" icon={<Copy size={12} />} loading={duplicateMut.isPending} onClick={() => duplicateMut.mutate(t)}>Duplicate</Button>
                    <Button
                      size="small"
                      icon={<History size={12} />}
                      onClick={() => setExpandedHistoryId(isExpanded ? null : t.id)}
                    >
                      {isExpanded ? 'Hide History' : 'History'}
                    </Button>
                    <Popconfirm title="Delete this template?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => deleteMut.mutate(t.id)}>
                      <Button size="small" danger icon={<Trash2 size={12} />} />
                    </Popconfirm>
                  </div>
                </div>

                {/* Previous versions — rendered as full-width cards directly
                    below this template, same card styling as above, no popup. */}
                {isExpanded && <PreviousVersionsList templateId={t.id} currentVersion={t.version} />}
              </Fragment>
            )
          })}
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
  // Independent of Draft/Publish: whether this template is offered in the
  // "Create Notebook" modal's Workflow Template picker (see AdcProjectDetailPage.tsx).
  const [showInDropdown, setShowInDropdown] = useState(isNew ? true : (template.show_in_notebook_dropdown ?? true))
  const [def, setDef] = useState<TemplateDefinition>(EMPTY_DEF)
  const [loadedDef, setLoadedDef] = useState(false)
  const [editingField, setEditingField] = useState<TemplateField | null>(null)
  // Set only when `editingField` is a field nested inside a REPEATING_GROUP's
  // sub-screen (rather than a top-level screen field) — saveField/closeField
  // branch on this to write back to the right place in the definition.
  const [editingSubLocation, setEditingSubLocation] = useState<{ screenId: string; groupFieldId: string; subScreenId: string } | null>(null)
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
        show_in_notebook_dropdown: showInDropdown,
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

  // ── Field CRUD — nested inside a REPEATING_GROUP's sub-screens ──
  const addSubField = (screenId: string, groupFieldId: string, subScreenId: string, type: FieldType) =>
    setDef(d => mapGroupScreens(d, screenId, groupFieldId, screens => screens.map(sc =>
      sc.id === subScreenId ? { ...sc, fields: [...sc.fields, makeField(type)] } : sc,
    )))
  const deleteSubField = (screenId: string, groupFieldId: string, subScreenId: string, fieldId: string) =>
    setDef(d => mapGroupScreens(d, screenId, groupFieldId, screens => screens.map(sc =>
      sc.id === subScreenId ? { ...sc, fields: sc.fields.filter(f => f.id !== fieldId) } : sc,
    )))
  const duplicateSubField = (screenId: string, groupFieldId: string, subScreenId: string, fieldId: string) =>
    setDef(d => mapGroupScreens(d, screenId, groupFieldId, screens => screens.map(sc => {
      if (sc.id !== subScreenId) return sc
      const idx = sc.fields.findIndex(f => f.id === fieldId)
      if (idx < 0) return sc
      const copy = { ...sc.fields[idx], id: newId('field'), name: `${sc.fields[idx].name}_copy` }
      const next = [...sc.fields]
      next.splice(idx + 1, 0, copy)
      return { ...sc, fields: next }
    })))

  const closeFieldEditor = () => { setEditingField(null); setEditingSubLocation(null) }

  const saveField = (updated: TemplateField, ap?: AutoPopulateApply) => {
    if (editingSubLocation) {
      const { screenId, groupFieldId, subScreenId } = editingSubLocation
      setDef(d => mapGroupScreens(d, screenId, groupFieldId, screens => screens.map(sc =>
        sc.id === subScreenId ? { ...sc, fields: sc.fields.map(f => f.id === updated.id ? updated : f) } : sc,
      )))
      closeFieldEditor()
      return
    }
    setDef(d => ({
      sections: d.sections.map(s => ({
        ...s,
        screens: s.screens.map(sc => {
          if (!sc.fields.some(f => f.id === updated.id)) return sc
          return {
            ...sc,
            fields: sc.fields.map(f => {
              if (f.id === updated.id) return updated
              if (!ap) return f
              // Reconcile sibling auto-fill driven by THIS dropdown (push model):
              // set the ones listed, clear the ones no longer listed.
              const target = ap.targets.find(t => t.fieldName === f.name)
              if (target) {
                return {
                  ...f,
                  autoFill: {
                    mode: ap.mode ?? 'attribute',
                    sourceFieldName: updated.name,
                    attribute: target.attribute,
                    editable: target.editable,
                  },
                }
              }
              const drivenByThis = ((f.autoFill?.mode ?? 'attribute') === 'attribute' || f.autoFill?.mode === 'row')
                && f.autoFill?.sourceFieldName === ap.driverOldName
              if (drivenByThis) {
                const { autoFill: _drop, ...rest } = f
                void _drop
                return rest
              }
              return f
            }),
          }
        }),
      })),
    }))
    closeFieldEditor()
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

  if (!isNew && isLoading) return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading template…" /></div>

  const activeSection = def.sections.find(s => s.id === activeSectionId) ?? null

  return (
    <div className="p-4 md:p-8 space-y-4">
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
          {!activeSection && (
            <Tooltip title="When on, this template is offered as an option in the Create Notebook modal's Workflow Template picker. Turn off to keep it usable/published without showing it there.">
              <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-md" style={{ backgroundColor: '#FEFEFA' }}>
                <Switch size="small" checked={showInDropdown} onChange={setShowInDropdown} />
                <span className="text-[12px] text-slate-600">Show in Create Notebook</span>
              </div>
            </Tooltip>
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
                      onEditSubField={(groupFieldId, subScreenId, field) => {
                        setEditingSubLocation({ screenId: screen.id, groupFieldId, subScreenId })
                        setEditingField(field)
                      }}
                      onDuplicateSubField={(groupFieldId, subScreenId, fieldId) => duplicateSubField(screen.id, groupFieldId, subScreenId, fieldId)}
                      onDeleteSubField={(groupFieldId, subScreenId, fieldId) => deleteSubField(screen.id, groupFieldId, subScreenId, fieldId)}
                      onAddSubField={(groupFieldId, subScreenId, type) => addSubField(screen.id, groupFieldId, subScreenId, type)}
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
        siblingFields={siblingFieldsFor(def, editingField)}
        sectionInventoryDrivers={sectionInventoryDriversFor(def, editingField)}
        sectionNumberFields={sectionNumberFieldsFor(def, editingField)}
        sectionTableScreens={sectionTableScreensFor(def, editingField)}
        crossTemplateTableScreens={allTableScreensFor(def)}
        crossTemplateSpreadsheetFields={allSpreadsheetFieldsFor(def)}
        onClose={closeFieldEditor}
        onSave={saveField}
      />
      <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} definition={def} title={name} />
    </div>
  )
}

interface TemplateBuilderPageProps {
  scope: BuilderScope
}

export default function TemplateBuilderPage({ scope }: TemplateBuilderPageProps) {
  const [category, setCategory] = useState<Category>(modalitiesForScope(scope)[0].value)
  const [active, setActive] = useState<WorkflowTemplate | 'new' | null>(null)

  if (active) {
    return <BuilderView template={active} category={category} onBack={() => setActive(null)} />
  }
  return (
    <TemplateListView
      scope={scope}
      category={category}
      onCategoryChange={setCategory}
      onEdit={setActive}
      onCreate={() => setActive('new')}
    />
  )
}
