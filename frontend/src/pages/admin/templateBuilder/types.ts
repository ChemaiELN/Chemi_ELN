// ── Template Builder data model ────────────────────────────────────────────
// Stored as-is in WorkflowTemplate.definition (JSON column) via the existing
// /api/workflow-templates endpoints — no new backend needed. Kept flat and
// serializable so it round-trips cleanly through JSON.

export type FieldType =
  | 'SECTION_HEADING'
  | 'SPACER'
  | 'SINGLE_LINE_TEXT'
  | 'MULTI_LINE_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'DATE_TIME'
  | 'YES_NO'
  | 'DROPDOWN'
  | 'CHECKBOX'
  | 'CHECKLIST'
  | 'RADIO'
  | 'ATTACHMENT'
  | 'IMAGE'

export interface TemplateField {
  id: string
  type: FieldType
  label: string
  name: string               // internal field name (snake_case), unique within template
  placeholder?: string
  helpText?: string
  required?: boolean
  readOnly?: boolean
  hidden?: boolean
  defaultValue?: string
  minLength?: number
  maxLength?: number
  minValue?: number
  maxValue?: number
  regex?: string
  options?: string[]         // DROPDOWN / CHECKLIST / RADIO
  colSpan?: 1 | 2             // within a 2-column section; SECTION_HEADING/SPACER always span 2
}

export interface TemplateSection {
  id: string
  title: string
  columns: 1 | 2
  fields: TemplateField[]
}

export interface TemplateDefinition {
  sections: TemplateSection[]
}

// Field-type registry — the single source of truth for the toolbox palette,
// default field creation, and the preview renderer's dispatch. Add a new
// entry here (+ a case in FieldPreview.tsx) to introduce a new field type.
export interface FieldTypeDescriptor {
  type: FieldType
  label: string
  category: 'Layout Elements' | 'Text Elements' | 'Date Elements' | 'Selection Elements' | 'Media Elements'
  hasOptions?: boolean
  isLayoutOnly?: boolean      // SECTION_HEADING / SPACER — no validation config
}

export const FIELD_TYPE_REGISTRY: FieldTypeDescriptor[] = [
  { type: 'SECTION_HEADING', label: 'Sub-heading',      category: 'Layout Elements', isLayoutOnly: true },
  { type: 'SPACER',          label: 'Spacer / Blank',   category: 'Layout Elements', isLayoutOnly: true },
  { type: 'SINGLE_LINE_TEXT', label: 'Single Line Text', category: 'Text Elements' },
  { type: 'MULTI_LINE_TEXT',  label: 'Multi-Line Text',  category: 'Text Elements' },
  { type: 'NUMBER',           label: 'Number',           category: 'Text Elements' },
  { type: 'DATE',             label: 'Date',              category: 'Date Elements' },
  { type: 'DATE_TIME',        label: 'Date & Time',       category: 'Date Elements' },
  { type: 'YES_NO',           label: 'Yes / No',          category: 'Selection Elements' },
  { type: 'DROPDOWN',         label: 'Dropdown',          category: 'Selection Elements', hasOptions: true },
  { type: 'CHECKBOX',         label: 'Checkbox',          category: 'Selection Elements' },
  { type: 'CHECKLIST',        label: 'Checklist',         category: 'Selection Elements', hasOptions: true },
  { type: 'RADIO',            label: 'Radio Buttons',     category: 'Selection Elements', hasOptions: true },
  { type: 'ATTACHMENT',       label: 'Attachment',        category: 'Media Elements' },
  { type: 'IMAGE',            label: 'Image',             category: 'Media Elements' },
]

export const FIELD_CATEGORIES: FieldTypeDescriptor['category'][] = [
  'Layout Elements', 'Text Elements', 'Date Elements', 'Selection Elements', 'Media Elements',
]

export function descriptorFor(type: FieldType): FieldTypeDescriptor {
  return FIELD_TYPE_REGISTRY.find(d => d.type === type)!
}

let _idSeq = 0
export function newId(prefix: string): string {
  _idSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${_idSeq}`
}

export function makeField(type: FieldType): TemplateField {
  const d = descriptorFor(type)
  return {
    id: newId('field'),
    type,
    label: d.label,
    name: `${type.toLowerCase()}_${_idSeq}`,
    colSpan: d.isLayoutOnly ? 2 : 1,
    ...(d.hasOptions ? { options: ['Option 1', 'Option 2'] } : {}),
  }
}

export function makeSection(title = 'New Section'): TemplateSection {
  return { id: newId('section'), title, columns: 1, fields: [] }
}
