// ── Template Builder data model ────────────────────────────────────────────
// Stored as-is in WorkflowTemplate.definition (JSON column) via the existing
// /api/workflow-templates endpoints — no new backend needed. Kept flat and
// serializable so it round-trips cleanly through JSON.
//
// Hierarchy mirrors the ADC workflow templates: section → screen → field.
// A section groups related screens (sub-forms); a screen holds fields laid
// out in a 1- or 2-column grid.

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
  options?: string[]         // DROPDOWN / CHECKLIST / RADIO — static option list
  // Inventory-backed options (DROPDOWN). Undefined/'static' → use `options`
  // above (back-compat with all existing templates).
  optionsMode?: 'static' | 'inventory'
  inventorySource?: {
    source: string           // InventorySourceKey (see inventorySources.ts)
    lookupType?: string      // required only when source === 'lookup'
    valueField: string       // row column stored as the answer (e.g. 'code')
    labelField: string       // row column shown to the user (e.g. 'name')
  }
  // Auto-fill: derive this field's value from other fields on the same screen.
  // Locked (read-only) unless `editable`. Runtime wiring lives in the CGT form.
  //   • 'attribute' — copy one column from the row picked in a single driver
  //     dropdown (e.g. Material → CAS No).
  //   • 'mapping'   — resolve the material↔manufacturer mapping from TWO driver
  //     dropdowns and copy a mapping column (e.g. → Catalogue No).
  autoFill?: {
    mode?: 'attribute' | 'mapping'   // default/undefined → 'attribute'
    editable?: boolean               // default false → value is locked
    // attribute mode:
    sourceFieldName?: string         // `name` of the driver dropdown (inventory-backed)
    attribute?: string               // column copied from the selected row
    // mapping mode:
    materialFieldName?: string       // `name` of a materials dropdown
    manufacturerFieldName?: string   // `name` of a manufacturers dropdown
    mappingAttribute?: string        // mapping column (e.g. 'catalogue_no')
  }
  colSpan?: 1 | 2            // within a 2-column screen; SECTION_HEADING/SPACER always span 2
}

export interface TemplateScreen {
  id: string
  title: string
  columns: 1 | 2
  fields: TemplateField[]
}

export interface TemplateSection {
  id: string
  title: string
  phase?: string             // optional grouping label (e.g. 'RUN SETUP'); consecutive
                             // sections sharing a phase render under one collapsible group
  screens: TemplateScreen[]
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

export function makeScreen(title = 'New Screen'): TemplateScreen {
  return { id: newId('screen'), title, columns: 2, fields: [] }
}

export function makeSection(title = 'New Section'): TemplateSection {
  return { id: newId('section'), title, screens: [makeScreen('Details')] }
}
