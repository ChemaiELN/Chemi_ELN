import { useState, useCallback, type CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Tag, Button,  Form, Input, Select, Switch, Popconfirm, Tooltip, message,
} from 'antd'
import { AdminModal } from '../../components/ui/AdminModal'
import {
  ChevronRight, ChevronLeft, Settings2, Layers, Hash, FileText,
  FlaskConical, Beaker, TestTube2, Microscope, Package, Waves,
  Plus, Trash2, Edit2, Save, CheckCircle2, Circle, GripVertical,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { workflowTemplateApi } from '../../api/adc'
import type { WorkflowTemplate } from '../../api/adc'

function moveItem<T>(arr: T[], idx: number, dir: -1 | 1): T[] {
  const next = [...arr]
  const target = idx + dir
  if (target < 0 || target >= next.length) return next
  ;[next[idx], next[target]] = [next[target], next[idx]]
  return next
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TemplateTableColumn {
  key: string
  label: string
  type: string
  required?: boolean
  unit?: string
  options?: string[]
}
interface TemplateField {
  key: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  unit?: string
  placeholder?: string
  columns?: TemplateTableColumn[]
}
interface TemplateScreen {
  key: string
  title: string
  fields: TemplateField[]
  has_signature?: boolean
  has_files?: boolean
  screen_type?: string
}
interface TemplateSection {
  key: string
  title: string
  screens: TemplateScreen[]
}
interface TemplateDef {
  sections: TemplateSection[]
}

type View = 'processes' | 'sections' | 'section-detail'

// ── Constants ─────────────────────────────────────────────────────────────────
const FIELD_TYPES = [
  'text', 'number', 'date', 'datetime', 'select', 'radio', 'checkbox',
  'textarea', 'boolean', 'file', 'section_header', 'calculation', 'table',
]
const SCREEN_TYPES = ['form', 'table', 'signature', 'review', 'summary']

const SECTION_ICONS: Record<string, React.ReactNode> = {
  materials_consumables:       <Package    size={22} className="text-white" />,
  buffer_preparation:          <Waves      size={22} className="text-white" />,
  manufacturing_steps:         <FlaskConical size={22} className="text-white" />,
  purification_analysis:       <Beaker     size={22} className="text-white" />,
  analytical_char_ds:          <Microscope size={22} className="text-white" />,
  formulation_lyo:             <TestTube2  size={22} className="text-white" />,
  analytical_characterization: <Layers     size={22} className="text-white" />,
}
const SECTION_COLORS: Record<string, string> = {
  materials_consumables:       'from-amber-400 to-orange-500',
  buffer_preparation:          'from-cyan-400 to-blue-500',
  manufacturing_steps:         'from-blue-500 to-indigo-600',
  purification_analysis:       'from-violet-500 to-purple-600',
  analytical_char_ds:          'from-rose-400 to-pink-600',
  formulation_lyo:             'from-emerald-400 to-teal-600',
  analytical_characterization: 'from-slate-400 to-slate-600',
}
const SECTION_SHADOW: Record<string, string> = {
  materials_consumables:       'shadow-orange-500/30',
  buffer_preparation:          'shadow-blue-500/30',
  manufacturing_steps:         'shadow-indigo-500/30',
  purification_analysis:       'shadow-purple-500/30',
  analytical_char_ds:          'shadow-pink-500/30',
  formulation_lyo:             'shadow-teal-500/30',
  analytical_characterization: 'shadow-slate-500/30',
}
const FIELD_TYPE_COLOR: Record<string, string> = {
  text: 'blue', number: 'green', date: 'orange', select: 'purple',
  textarea: 'cyan', boolean: 'magenta', file: 'gold', datetime: 'volcano',
  radio: 'geekblue', checkbox: 'lime', calculation: 'gold', section_header: 'default',
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const COLUMN_TYPES = ['text', 'number', 'date', 'select', 'boolean', 'textarea']

// ── Field edit modal ──────────────────────────────────────────────────────────
function FieldModal({
  open, initial, onOk, onCancel,
}: {
  open: boolean
  initial?: TemplateField
  onOk: (f: TemplateField) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  const watchType = Form.useWatch('type', form)
  const needsOptions = ['select', 'radio', 'checkbox'].includes(watchType)
  const isTable = watchType === 'table'

  const handleOk = () => {
    form.validateFields().then(vals => {
      const rawOpts: string = vals.options_raw ?? ''
      const options = needsOptions
        ? rawOpts.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined

      const columns: TemplateTableColumn[] | undefined = isTable
        ? (vals.columns ?? []).map((c: { label: string; key?: string; type: string; required?: boolean; unit?: string; options_raw?: string }) => ({
            key: c.key || slugify(c.label),
            label: c.label,
            type: c.type,
            required: c.required ?? false,
            unit: c.unit || undefined,
            options: ['select'].includes(c.type)
              ? (c.options_raw ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
              : undefined,
          }))
        : undefined

      onOk({
        key: vals.key,
        label: vals.label,
        type: vals.type,
        required: vals.required ?? false,
        unit: vals.unit || undefined,
        placeholder: vals.placeholder || undefined,
        options: options?.length ? options : undefined,
        columns: columns?.length ? columns : undefined,
      })
      form.resetFields()
    })
  }

  // Convert existing columns back to form shape on edit
  const initialValues = initial
    ? {
        ...initial,
        options_raw: initial.options?.join(', ') ?? '',
        columns: initial.columns?.map(c => ({ ...c, options_raw: c.options?.join(', ') ?? '' })) ?? [],
      }
    : { type: 'text', required: false, columns: [] }

  return (
    <AdminModal
      title={initial ? 'Edit Field' : 'Add Field'}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel() }}
      okText={initial ? 'Update' : 'Add'}
      width={isTable ? 700 : 560}
      centered
      destroyOnHidden
      >
      <Form
        form={form}
        layout="vertical"
        className="mt-3"
        initialValues={initialValues}
        onValuesChange={(changed) => {
          if (changed.label && !initial) {
            form.setFieldValue('key', slugify(changed.label))
          }
        }}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="label" label="Field Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Batch Number" />
          </Form.Item>
          <Form.Item name="key" label="Field Key" rules={[{ required: true }]} extra="Unique snake_case ID">
            <Input placeholder="batch_number" className="  text-xs" />
          </Form.Item>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={FIELD_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          {!isTable && (
            <Form.Item name="unit" label="Unit">
              <Input placeholder="e.g. mg/mL, °C" />
            </Form.Item>
          )}
        </div>
        {!isTable && (
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="placeholder" label="Placeholder">
              <Input placeholder="Helper text shown in the input" />
            </Form.Item>
            <Form.Item name="required" label="Required" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        )}
        {needsOptions && (
          <Form.Item name="options_raw" label="Options (comma-separated)" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Option A, Option B, Option C" />
          </Form.Item>
        )}

        {/* ── Table columns editor ─────────────────────────────────────── */}
        {isTable && (
          <div className="mt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-slate-700">Table Columns</span>
              <span className="text-[11px] text-slate-400">Define each column that will appear in this table</span>
            </div>
            <Form.List name="columns">
              {(fields, { add, remove }) => (
                <div className="space-y-2">
                  {fields.length === 0 && (
                    <p className="text-slate-400 text-xs text-center py-3 border border-dashed border-slate-200 rounded-lg">
                      No columns yet — click Add Column below
                    </p>
                  )}
                  {fields.map((field, idx) => (
                    <ColumnRow key={field.key} field={field} idx={idx} remove={remove} form={form} />
                  ))}
                  <Button
                    type="dashed"
                    size="small"
                    icon={<Plus size={12} />}
                    className="w-full text-[12px]"
                    onClick={() => add({ type: 'text', required: false })}
                  >
                    Add Column
                  </Button>
                </div>
              )}
            </Form.List>
          </div>
        )}
      </Form>
    </AdminModal>
  )
}

// ── Column row inside table field editor ──────────────────────────────────────
function ColumnRow({
  field, idx, remove, form,
}: {
  field: { key: number; name: number }
  idx: number
  remove: (idx: number) => void
  form: ReturnType<typeof Form.useForm>[0]
}) {
  const colType = Form.useWatch(['columns', field.name, 'type'], form)
  const colNeedsOptions = colType === 'select'

  return (
    <div className="border border-slate-200 rounded-lg px-3 pt-3 pb-2 bg-slate-50/60 relative">
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span className="text-[10px] text-slate-400  ">col {idx + 1}</span>
        <Popconfirm title="Remove this column?" okButtonProps={{ danger: true }} okText="Remove"
          onConfirm={() => remove(field.name)}>
          <Button type="text" size="small" danger icon={<Trash2 size={12} />} />
        </Popconfirm>
      </div>
      <div className="grid grid-cols-3 gap-x-3">
        <Form.Item
          name={[field.name, 'label']}
          label="Column Label"
          rules={[{ required: true, message: 'Required' }]}
          className="mb-2"
        >
          <Input
            placeholder="e.g. Volume"
            size="small"
            onChange={e => {
              const auto = slugify(e.target.value)
              form.setFieldValue(['columns', field.name, 'key'], auto)
            }}
          />
        </Form.Item>
        <Form.Item
          name={[field.name, 'key']}
          label="Key"
          rules={[{ required: true, message: 'Required' }]}
          className="mb-2"
        >
          <Input placeholder="volume" size="small" className="  text-[11px]" />
        </Form.Item>
        <Form.Item name={[field.name, 'type']} label="Type" rules={[{ required: true }]} className="mb-2">
          <Select size="small" options={COLUMN_TYPES.map(t => ({ value: t, label: t }))} />
        </Form.Item>
      </div>
      <div className="grid grid-cols-3 gap-x-3">
        <Form.Item name={[field.name, 'unit']} label="Unit" className="mb-1">
          <Input placeholder="mg/mL" size="small" />
        </Form.Item>
        <Form.Item name={[field.name, 'required']} label="Required" valuePropName="checked" className="mb-1">
          <Switch size="small" />
        </Form.Item>
        {colNeedsOptions && (
          <Form.Item name={[field.name, 'options_raw']} label="Options" className="mb-1" rules={[{ required: true }]}>
            <Input placeholder="A, B, C" size="small" />
          </Form.Item>
        )}
      </div>
    </div>
  )
}

// ── Screen modal ──────────────────────────────────────────────────────────────
function ScreenModal({
  open, initial, onOk, onCancel,
}: {
  open: boolean
  initial?: Partial<TemplateScreen>
  onOk: (s: Partial<TemplateScreen>) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  const handleOk = () => {
    form.validateFields().then(vals => {
      onOk(vals)
      form.resetFields()
    })
  }
  return (
    <AdminModal
      title={initial?.key ? 'Edit Screen' : 'Add Screen'}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel() }}
      okText={initial?.key ? 'Update' : 'Add'}
      width={480}
      centered
      destroyOnHidden
      >
      <Form
        form={form}
        layout="vertical"
        className="mt-3"
        initialValues={initial ?? { has_signature: false, has_files: false }}
        onValuesChange={(changed) => {
          if (changed.title && !initial?.key) {
            form.setFieldValue('key', slugify(changed.title))
          }
        }}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="title" label="Screen Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Antibody Info" />
          </Form.Item>
          <Form.Item name="key" label="Screen Key" rules={[{ required: true }]}>
            <Input placeholder="antibody_info" className="  text-xs" />
          </Form.Item>
        </div>
        <Form.Item name="screen_type" label="Screen Type">
          <Select allowClear placeholder="form" options={SCREEN_TYPES.map(t => ({ value: t, label: t }))} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="has_signature" label="Has Signature" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="has_files" label="Has Files" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </AdminModal>
  )
}

// ── Section modal ─────────────────────────────────────────────────────────────
function SectionModal({
  open, initial, onOk, onCancel,
}: {
  open: boolean
  initial?: Partial<TemplateSection>
  onOk: (s: Partial<TemplateSection>) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  return (
    <AdminModal
      title={initial?.key ? 'Edit Section' : 'Add Section'}
      open={open}
      onOk={() => form.validateFields().then(v => { onOk(v); form.resetFields() })}
      onCancel={() => { form.resetFields(); onCancel() }}
      okText={initial?.key ? 'Update' : 'Add'}
      width={440}
      centered
      destroyOnHidden
      >
      <Form
        form={form}
        layout="vertical"
        className="mt-3"
        initialValues={initial ?? {}}
        onValuesChange={(changed) => {
          if (changed.title && !initial?.key)
            form.setFieldValue('key', slugify(changed.title))
        }}
      >
        <Form.Item name="title" label="Section Title" rules={[{ required: true }]}>
          <Input placeholder="e.g. Buffer Preparation" />
        </Form.Item>
        <Form.Item name="key" label="Section Key" rules={[{ required: true }]}>
          <Input placeholder="buffer_preparation" className="  text-xs" />
        </Form.Item>
      </Form>
    </AdminModal>
  )
}

// ── Sortable field row ────────────────────────────────────────────────────────
function SortableFieldRow({
  id, fi, f,
  onEdit, onDelete,
}: {
  id: string
  fi: number
  f: TemplateField
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  }
  return (
    <div ref={setNodeRef} style={style}
      className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors bg-white">
      <span
        {...attributes} {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <GripVertical size={14} />
      </span>
      <span className="text-[11px] text-slate-400 w-5 text-right shrink-0 select-none">{fi + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-800 truncate">{f.label}</p>
        <p className="text-[11px] text-slate-400   truncate">{f.key}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <Tag color={FIELD_TYPE_COLOR[f.type] ?? 'default'} bordered className="text-[11px]">{f.type}</Tag>
        {f.required ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Circle size={13} className="text-slate-300" />}
        {f.unit && <Tag bordered className="text-[11px]">{f.unit}</Tag>}
        {f.type === 'table' && (
          <span className="text-[11px] text-slate-400">
            {f.columns?.length ? `${f.columns.length} cols` : <span className="text-orange-400">no columns</span>}
          </span>
        )}
        {f.options?.length ? <span className="text-[11px] text-slate-400">{f.options.length} opts</span> : null}
      </div>
      <div className="flex items-center gap-0.5 ml-auto shrink-0">
        <Tooltip title="Edit field">
          <Button type="text" size="small" icon={<Edit2 size={13} />} className="text-blue-500" onClick={onEdit} />
        </Tooltip>
        <Popconfirm title="Delete this field?" okButtonProps={{ danger: true }} okText="Delete" onConfirm={onDelete}>
          <Tooltip title="Delete field">
            <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
          </Tooltip>
        </Popconfirm>
      </div>
    </div>
  )
}

// ── Sortable screen block ─────────────────────────────────────────────────────
function SortableScreenBlock({
  id, screen, si,
  onEditScreen, onDeleteScreen,
  onAddField, onEditField, onDeleteField,
  onFieldDragEnd,
}: {
  id: string
  screen: TemplateScreen
  si: number
  onEditScreen: () => void
  onDeleteScreen: () => void
  onAddField: () => void
  onEditField: (fi: number) => void
  onDeleteField: (fi: number) => void
  onFieldDragEnd: (oldIdx: number, newIdx: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
  }

  const fieldSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const fieldIds = screen.fields.map((f, i) => f.key ? `${si}_${f.key}` : `${si}_field_${i}`)

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = fieldIds.indexOf(active.id as string)
    const newIdx = fieldIds.indexOf(over.id as string)
    if (oldIdx !== -1 && newIdx !== -1) onFieldDragEnd(oldIdx, newIdx)
  }

  return (
    <div ref={setNodeRef} style={style} className="glass-card rounded-xl overflow-hidden">
      {/* Screen header */}
      <div className="bg-slate-50/80 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <span
          {...attributes} {...listeners}
          className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        >
          <GripVertical size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[13px] font-semibold text-slate-800">{screen.title}</span>
          <span className="text-[11px] text-slate-400   ml-2">{screen.key}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {screen.has_signature && <Tag color="purple" bordered className="text-[11px]">Signature</Tag>}
          {screen.has_files     && <Tag color="blue"   bordered className="text-[11px]">Files</Tag>}
          {screen.screen_type   && <Tag bordered className="text-[11px]">{screen.screen_type}</Tag>}
          <Tag bordered className="text-[11px]  ">{screen.fields.length} fields</Tag>
        </div>
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          <Tooltip title="Edit screen">
            <Button type="text" size="small" icon={<Edit2 size={14} />} className="text-blue-500" onClick={onEditScreen} />
          </Tooltip>
          <Popconfirm title="Delete this screen and all its fields?" okButtonProps={{ danger: true }} okText="Delete"
            onConfirm={onDeleteScreen}>
            <Tooltip title="Delete screen">
              <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      {/* Fields — nested DnD context */}
      <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-slate-100">
            {screen.fields.length === 0 && (
              <p className="text-slate-400 text-sm px-5 py-4 text-center">No fields yet.</p>
            )}
            {screen.fields.map((f, fi) => (
              <SortableFieldRow
                key={fieldIds[fi]}
                id={fieldIds[fi]}
                fi={fi}
                f={f}
                onEdit={() => onEditField(fi)}
                onDelete={() => onDeleteField(fi)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add field */}
      <div className="px-4 py-2 border-t border-dashed border-slate-200">
        <Button type="primary" size="small" icon={<Plus size={12} />} className="text-[12px]" onClick={onAddField}>
          Add Field
        </Button>
      </div>
    </div>
  )
}

// ── Level 2: Section detail editor ───────────────────────────────────────────
function SectionDetailPage({
  sectionIdx,
  def,
  onDefChange,
  onBack,
  onSave,
  saving,
  dirty,
}: {
  sectionIdx: number
  def: TemplateDef
  onDefChange: (d: TemplateDef) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  dirty: boolean
}) {
  const section = def.sections[sectionIdx]
  const [fieldModal, setFieldModal] = useState<{ screenIdx: number; fieldIdx?: number } | null>(null)
  const [screenModal, setScreenModal] = useState<{ screenIdx?: number } | null>(null)

  const screenSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const updateSection = useCallback((updatedSec: TemplateSection) => {
    const sections = [...def.sections]
    sections[sectionIdx] = updatedSec
    onDefChange({ ...def, sections })
  }, [def, sectionIdx, onDefChange])

  // ── Screen ops ──────────────────────────────────────────────────────────────
  const addScreen = (vals: Partial<TemplateScreen>) => {
    updateSection({ ...section, screens: [...section.screens, { key: vals.key!, title: vals.title!, fields: [], has_signature: vals.has_signature, has_files: vals.has_files, screen_type: vals.screen_type }] })
    setScreenModal(null)
  }
  const editScreen = (si: number, vals: Partial<TemplateScreen>) => {
    const screens = [...section.screens]
    screens[si] = { ...screens[si], ...vals }
    updateSection({ ...section, screens })
    setScreenModal(null)
  }
  const deleteScreen = (si: number) => {
    updateSection({ ...section, screens: section.screens.filter((_, i) => i !== si) })
  }

  // ── Field ops ───────────────────────────────────────────────────────────────
  const addField = (si: number, f: TemplateField) => {
    const screens = [...section.screens]
    screens[si] = { ...screens[si], fields: [...screens[si].fields, f] }
    updateSection({ ...section, screens })
    setFieldModal(null)
  }
  const editField = (si: number, fi: number, f: TemplateField) => {
    const screens = [...section.screens]
    const fields = [...screens[si].fields]
    fields[fi] = f
    screens[si] = { ...screens[si], fields }
    updateSection({ ...section, screens })
    setFieldModal(null)
  }
  const deleteField = (si: number, fi: number) => {
    const screens = [...section.screens]
    screens[si] = { ...screens[si], fields: screens[si].fields.filter((_, i) => i !== fi) }
    updateSection({ ...section, screens })
  }

  // ── Drag-end handlers ────────────────────────────────────────────────────────
  const handleScreenDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = section.screens.findIndex(s => s.key === active.id)
    const newIdx = section.screens.findIndex(s => s.key === over.id)
    if (oldIdx !== -1 && newIdx !== -1)
      updateSection({ ...section, screens: arrayMove(section.screens, oldIdx, newIdx) })
  }

  const handleFieldDragEnd = (si: number, oldIdx: number, newIdx: number) => {
    const screens = [...section.screens]
    screens[si] = { ...screens[si], fields: arrayMove(screens[si].fields, oldIdx, newIdx) }
    updateSection({ ...section, screens })
  }

  const totalFields = section.screens.reduce((a, s) => a + s.fields.length, 0)
  const color  = SECTION_COLORS[section.key]  ?? 'from-slate-400 to-slate-600'
  const shadow = SECTION_SHADOW[section.key]  ?? 'shadow-slate-500/30'
  const icon   = SECTION_ICONS[section.key]   ?? <Layers size={22} className="text-white" />

  return (
    <div className="p-4 md:p-2 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 cursor-pointer hover:text-slate-700" onClick={onBack}>ADC Process</span>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-700">{section.title}</span>
        </div>
        <Button type="primary" icon={<Save size={13} />} onClick={onSave} loading={saving} disabled={!dirty}>
          {dirty ? 'Save Changes' : 'Saved'}
        </Button>
      </div>

      {/* Section summary */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg ${shadow} shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-800">{section.title}</h1>
          <div className="flex items-center gap-4 mt-0.5 text-sm text-slate-500">
            <span className="flex items-center gap-1"><FileText size={12} />{section.screens.length} screens</span>
            <span className="flex items-center gap-1"><Hash size={12} />{totalFields} fields</span>
            {dirty && <Tag color="orange" bordered className="text-[11px]">Unsaved changes</Tag>}
          </div>
        </div>
        <Button type="primary" icon={<Plus size={13} />} onClick={() => setScreenModal({})}>Add Screen</Button>
      </div>

      {/* Screens — draggable */}
      <DndContext sensors={screenSensors} collisionDetection={closestCenter} onDragEnd={handleScreenDragEnd}>
        <SortableContext items={section.screens.map(s => s.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {section.screens.map((screen, si) => (
              <SortableScreenBlock
                key={screen.key}
                id={screen.key}
                screen={screen}
                si={si}
                onEditScreen={() => setScreenModal({ screenIdx: si })}
                onDeleteScreen={() => deleteScreen(si)}
                onAddField={() => setFieldModal({ screenIdx: si })}
                onEditField={fi => setFieldModal({ screenIdx: si, fieldIdx: fi })}
                onDeleteField={fi => deleteField(si, fi)}
                onFieldDragEnd={(old, nw) => handleFieldDragEnd(si, old, nw)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {section.screens.length === 0 && (
        <div className="glass-card rounded-xl p-10 text-center text-slate-400">
          No screens yet. Click <strong>Add Screen</strong> to get started.
        </div>
      )}

      {/* Modals — key forces full remount so Form.useForm() gets fresh initialValues each open */}
      <FieldModal
        key={fieldModal ? `field-${fieldModal.screenIdx}-${fieldModal.fieldIdx ?? 'new'}` : 'field-closed'}
        open={!!fieldModal}
        initial={fieldModal?.fieldIdx !== undefined
          ? section.screens[fieldModal.screenIdx]?.fields[fieldModal.fieldIdx]
          : undefined}
        onOk={f => {
          if (fieldModal!.fieldIdx !== undefined)
            editField(fieldModal!.screenIdx, fieldModal!.fieldIdx, f)
          else
            addField(fieldModal!.screenIdx, f)
        }}
        onCancel={() => setFieldModal(null)}
      />

      <ScreenModal
        key={screenModal ? `screen-${screenModal.screenIdx ?? 'new'}` : 'screen-closed'}
        open={!!screenModal}
        initial={screenModal?.screenIdx !== undefined
          ? section.screens[screenModal.screenIdx]
          : undefined}
        onOk={vals => {
          if (screenModal?.screenIdx !== undefined)
            editScreen(screenModal.screenIdx, vals)
          else
            addScreen(vals as TemplateScreen)
        }}
        onCancel={() => setScreenModal(null)}
      />
    </div>
  )
}

// ── Level 1: Section cards (editable) ────────────────────────────────────────
function SectionCardsView({
  def,
  onDefChange,
  onBack,
  onSave,
  saving,
  dirty,
  onSelectSection,
}: {
  def: TemplateDef
  onDefChange: (d: TemplateDef) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
  dirty: boolean
  onSelectSection: (idx: number) => void
}) {
  const [secModal, setSecModal] = useState<{ idx?: number } | null>(null)

  const sections = def.sections

  const addSection = (vals: Partial<TemplateSection>) => {
    onDefChange({ ...def, sections: [...sections, { key: vals.key!, title: vals.title!, screens: [] }] })
    setSecModal(null)
  }
  const editSection = (idx: number, vals: Partial<TemplateSection>) => {
    const next = [...sections]
    next[idx] = { ...next[idx], title: vals.title!, key: vals.key! }
    onDefChange({ ...def, sections: next })
    setSecModal(null)
  }
  const deleteSection = (idx: number) => {
    onDefChange({ ...def, sections: sections.filter((_, i) => i !== idx) })
  }
  const moveSection = (idx: number, dir: -1 | 1) => {
    onDefChange({ ...def, sections: moveItem(sections, idx, dir) })
  }

  return (
    <div className="p-4 md:p-2 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm font-semibold text-slate-700">ADC Process</span>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<Plus size={13} />} onClick={() => setSecModal({})}>Add Section</Button>
          <Button
            type="primary" icon={<Save size={13} />}
            onClick={onSave} loading={saving} disabled={!dirty}
          >
            {dirty ? 'Save Template' : 'Saved'}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-800">ADC Synthesis — Sections</h1>
        <p className="text-slate-400 text-sm">
          {sections.length} sections · {sections.reduce((a, s) => a + s.screens.length, 0)} screens total
          {dirty && <Tag color="orange" bordered className="ml-2 text-[11px]">Unsaved changes</Tag>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sections.map((sec, idx) => {
          const color  = SECTION_COLORS[sec.key]  ?? 'from-slate-400 to-slate-600'
          const shadow = SECTION_SHADOW[sec.key]  ?? 'shadow-slate-500/30'
          const icon   = SECTION_ICONS[sec.key]   ?? <Layers size={22} className="text-white" />
          const totalFields = sec.screens.reduce((a, s) => a + s.fields.length, 0)

          return (
            <div key={sec.key} className="glass-card rounded-2xl p-5 flex flex-col">
              {/* Order controls */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-0.5">
                  <Tooltip title="Move up">
                    <Button type="text" size="small" icon={<ArrowUp size={14} />} disabled={idx === 0}
                      onClick={() => moveSection(idx, -1)} />
                  </Tooltip>
                  <Tooltip title="Move down">
                    <Button type="text" size="small" icon={<ArrowDown size={14} />} disabled={idx === sections.length - 1}
                      onClick={() => moveSection(idx, 1)} />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip title="Edit section">
                    <Button type="text" size="small" icon={<Edit2 size={14} />} className="text-blue-500"
                      onClick={() => setSecModal({ idx })} />
                  </Tooltip>
                  <Popconfirm title="Delete this section and all its screens?" okButtonProps={{ danger: true }} okText="Delete"
                    onConfirm={() => deleteSection(idx)}>
                    <Tooltip title="Delete section">
                      <Button type="text" size="small" danger icon={<Trash2 size={14} />} />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </div>

              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg ${shadow} mb-3`}>
                {icon}
              </div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-0.5">Section {idx + 1}</p>
              <h3 className="text-[14px] font-bold text-slate-800 leading-snug mb-2 flex-1">{sec.title}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1"><FileText size={11} />{sec.screens.length} screens</span>
                <span className="flex items-center gap-1"><Hash size={11} />{totalFields} fields</span>
              </div>
              <Button
                type="primary" ghost size="small"
                icon={<ChevronRight size={12} />}
                className="text-[12px]"
                onClick={() => onSelectSection(idx)}
              >
                Open &amp; Edit Fields
              </Button>
            </div>
          )
        })}
      </div>

      <SectionModal
        key={secModal ? `sec-${secModal.idx ?? 'new'}` : 'sec-closed'}
        open={!!secModal}
        initial={secModal?.idx !== undefined ? sections[secModal.idx] : undefined}
        onOk={vals => secModal?.idx !== undefined ? editSection(secModal.idx, vals) : addSection(vals)}
        onCancel={() => setSecModal(null)}
      />
    </div>
  )
}

// ── Level 0: Process cards ────────────────────────────────────────────────────

// Accent classes per card variant, kept as literal strings (not interpolated)
// so Tailwind's static analysis can find and generate them.
const CARD_ACCENTS = {
  blue: {
    hoverShadow: 'hover:shadow-blue-300/40',
    iconBg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    iconShadow: 'shadow-blue-500/30',
    chevron: 'text-blue-300 group-hover:text-blue-500',
    bullet: 'bg-blue-400',
    footer: 'text-blue-600',
  },
  teal: {
    hoverShadow: 'hover:shadow-teal-300/40',
    iconBg: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    iconShadow: 'shadow-teal-500/30',
    chevron: 'text-teal-300 group-hover:text-teal-500',
    bullet: 'bg-teal-400',
    footer: 'text-teal-600',
  },
} as const

interface WorkflowProcessCardProps {
  icon: React.ElementType
  title: string
  description: string
  items: string[]
  accent: keyof typeof CARD_ACCENTS
  onClick: () => void
  disabled?: boolean
}

function WorkflowProcessCard({ icon: Icon, title, description, items, accent, onClick, disabled }: WorkflowProcessCardProps) {
  const c = CARD_ACCENTS[accent]
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-card rounded-3xl p-7 text-left hover:shadow-2xl ${c.hoverShadow} hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
    >
      <div className="flex items-start justify-between mb-5">
        <div className={`w-14 h-14 rounded-2xl ${c.iconBg} flex items-center justify-center shadow-lg ${c.iconShadow}`}>
          <Icon size={26} className="text-white" />
        </div>
        <ChevronRight size={18} className={`${c.chevron} mt-1 transition-colors`} />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-1">{title}</h2>
      <p className="text-slate-500 text-sm mb-5">{description}</p>
      <div className="space-y-1.5 mb-5">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2 text-slate-500 text-xs">
            <div className={`w-1 h-1 rounded-full ${c.bullet} shrink-0`} />
            {item}
          </div>
        ))}
      </div>
      <div className="mt-2 pt-4 border-t border-white/50">
        <span className={`text-xs font-semibold ${c.footer} flex items-center gap-1 group-hover:gap-2 transition-all`}>
          Open Process <ChevronRight size={12} />
        </span>
      </div>
    </button>
  )
}

export default function WorkflowTemplatesPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<View>('processes')
  const [activeTemplate, setActiveTemplate] = useState<WorkflowTemplate | null>(null)
  const [activeSectionIdx, setActiveSectionIdx] = useState<number>(0)
  const [def, setDef] = useState<TemplateDef | null>(null)
  const [dirty, setDirty] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: () => workflowTemplateApi.list(),
  })

  const saveMutation = useMutation({
    mutationFn: () => workflowTemplateApi.update(activeTemplate!.id, { definition: def }),
    onSuccess: () => {
      setDirty(false)
      message.success('Template saved — new version snapshot created.')
      qc.invalidateQueries({ queryKey: ['workflow-templates'] })
    },
    onError: () => message.error('Failed to save template.'),
  })

  const adcTemplate = data.find(t => t.slug === 'adc-synthesis-v2') ?? null

  const openProcess = async () => {
    if (!adcTemplate) return
    const full = await workflowTemplateApi.get(adcTemplate.id)
    setActiveTemplate(full)
    setDef((full.definition as TemplateDef) ?? { sections: [] })
    setDirty(false)
    setView('sections')
  }

  const handleDefChange = (d: TemplateDef) => {
    setDef(d)
    setDirty(true)
  }

  if (view === 'section-detail' && def && activeTemplate) {
    return (
      <SectionDetailPage
        sectionIdx={activeSectionIdx}
        def={def}
        onDefChange={handleDefChange}
        onBack={() => setView('sections')}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
      />
    )
  }

  if (view === 'sections' && def && activeTemplate) {
    return (
      <SectionCardsView
        def={def}
        onDefChange={handleDefChange}
        onBack={() => { setActiveTemplate(null); setDef(null); setDirty(false); setView('processes') }}
        onSave={() => saveMutation.mutate()}
        saving={saveMutation.isPending}
        dirty={dirty}
        onSelectSection={idx => { setActiveSectionIdx(idx); setView('section-detail') }}
      />
    )
  }

  return (
    <div className="p-4 md:p-2 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Workflow Templates</h1>
        <p className="text-slate-400 text-sm">Select a process to view and manage its section templates.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl">
        <WorkflowProcessCard
          icon={FlaskConical}
          title="ADC Process"
          description="Antibody-drug conjugation workflow — synthesis sections & templates"
          items={['Materials & Consumables', 'Buffer Preparation', 'Bioconjugation', 'Purification & Analysis', 'Analytical Characterization DS', 'Formulation & Lyo Studies', 'Analytical Characterization DP']}
          accent="blue"
          onClick={openProcess}
          disabled={!adcTemplate || isLoading}
        />

        <div className="glass-card rounded-3xl p-7 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center opacity-40 min-h-[280px]">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
            <Settings2 size={20} className="text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">More processes</p>
          <p className="text-slate-300 text-xs mt-1">coming soon</p>
        </div>
      </div>
    </div>
  )
}
