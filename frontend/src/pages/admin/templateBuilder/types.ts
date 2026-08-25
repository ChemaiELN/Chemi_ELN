// ── Template Builder data model ────────────────────────────────────────────
// Stored as-is in WorkflowTemplate.definition (JSON column) via the existing
// /api/workflow-templates endpoints — no new backend needed. Kept flat and
// serializable so it round-trips cleanly through JSON.
//
// Hierarchy mirrors the ADC workflow templates: section → screen → field.
// A section groups related screens (sub-forms); a screen holds fields laid
// out in a 1- or 2-column grid.
import type { CalcField, ProtectedRangeMeta } from '../calcTemplates/types'

export type FieldType =
  | 'SECTION_HEADING'
  | 'SPACER'
  | 'LOCK_TOGGLE'
  | 'SINGLE_LINE_TEXT'
  | 'MULTI_LINE_TEXT'
  | 'RICH_TEXT'
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
  | 'SPREADSHEET'
  | 'REPEATING_GROUP'
  | 'KETCHER'
  | 'SIGNATURE'
  | 'ATR_REQUEST'
  | 'USAGE_LOG_START_STOP'

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
  unit?: string              // NUMBER — fixed unit suffix shown next to the input (e.g. "°C")
  regex?: string
  options?: string[]         // DROPDOWN / CHECKLIST / RADIO — static option list
  // Inventory-backed options (DROPDOWN). Undefined/'static' → use `options`
  // above (back-compat with all existing templates). 'screenRows' → options
  // are rows the user has already entered into ANOTHER table screen
  // (`rowSource`, below) — for picking from data logged elsewhere in the
  // experiment rather than from inventory master data.
  optionsMode?: 'static' | 'inventory' | 'screenRows'
  inventorySource?: {
    source: string           // InventorySourceKey (see inventorySources.ts)
    lookupType?: string      // required only when source === 'lookup'
    dimensionKey?: string    // required only when source === 'uom' — restricts the option list to one UOM dimension (e.g. 'volume', 'mass')
    valueField: string       // row column stored as the answer (e.g. 'code')
    labelField: string       // row column shown to the user (e.g. 'name')
    // Cascading dropdown: for a material-filtered source (e.g. 'batches'), the
    // `name` of a sibling materials dropdown whose selected code filters this
    // list — so a Batch dropdown only shows batches of the chosen material.
    filterByField?: string
    // Template-authored department scope (Materials/Equipment/Instrument/
    // Column sources only — the other inventory sources have no department
    // concept). Fixed at template-design time, same for every chemist who
    // runs this template — NOT the logged-in user's own department. Unset
    // means no filtering (every department's records show up).
    departmentId?: string
  }
  // DROPDOWN with optionsMode 'screenRows': options come from the rows a user
  // has already entered into a table screen elsewhere in the experiment (any
  // section) — e.g. picking a Filter Lot from what was logged in a
  // Consumables table, rather than from inventory master data. Read-only at
  // runtime (CgtSectionPage/CgtTableField resolve it from the whole run's
  // data); the builder Preview can't simulate it (each section previews in
  // isolation) and shows a disabled placeholder instead.
  rowSource?: {
    sectionId: string        // section id owning the source table screen
    screenId: string         // the source table screen's id
    valueField: string       // source screen's field `name` stored as the answer
    labelField: string       // source screen's field `name` shown to the user
    filterField?: string     // optional: source screen's field `name` to filter rows by
    filterValue?: string      // optional: only rows where filterField === filterValue
    // Set BOTH when the source screen isn't a plain table but a single
    // REPEATING_GROUP field (e.g. "2. Buffer Preparation") — its stored value
    // is an array of items, each `{[subScreenId]: {fieldName: value, ...}}`,
    // not a flat row array, so valueField/labelField must be read from
    // item[subScreenId] rather than the item itself.
    repeatingGroupFieldName?: string   // the REPEATING_GROUP field's own `name` on the source screen
    subScreenId?: string               // which sub-screen within each item holds valueField/labelField
  }
  // Auto-fill: derive this field's value from other fields on the same screen.
  // Locked (read-only) unless `editable`. Runtime wiring lives in the CGT form.
  //   • 'attribute' — copy one column from the row picked in a single driver
  //     dropdown (e.g. Material → CAS No).
  //   • 'mapping'   — resolve the material↔manufacturer mapping from TWO driver
  //     dropdowns and copy a mapping column (e.g. → Catalogue No).
  //   • 'row'       — copy one column from the row picked in a single driver
  //     dropdown whose optionsMode is 'screenRows' (e.g. a mirrored Lot No →
  //     Vial ID), analogous to 'attribute' but sourced from another screen's
  //     entered rows instead of inventory.
  //   • 'spreadsheet' — a live, read-only computed value pulled from a
  //     SPREADSHEET field's marked output cell — possibly on a screen in a
  //     DIFFERENT section (e.g. 3.3/3.4's "carried from 3.2" figures reading
  //     3.2's calc template output). Not a one-time copy: re-evaluated from
  //     the source spreadsheet's current values every render, same as the
  //     source field's own live Univer recalculation.
  autoFill?: {
    mode?: 'attribute' | 'mapping' | 'row' | 'spreadsheet' | 'field'   // default/undefined → 'attribute'
    editable?: boolean               // default false → value is locked
    // attribute / row mode:
    sourceFieldName?: string         // `name` of the driver dropdown
    attribute?: string               // column copied from the selected row
    // mapping mode:
    materialFieldName?: string       // `name` of a materials dropdown
    manufacturerFieldName?: string   // `name` of a manufacturers dropdown
    mappingAttribute?: string        // mapping column (e.g. 'catalogue_no')
    // spreadsheet mode: `sourceFieldName` (above) is the SPREADSHEET field's
    // own `name`; `attribute` (above) is the calc template's output field key
    // (e.g. 'making_adcs_2_step_c10'). sectionId/screenId locate which screen
    // holds that spreadsheet field, since it usually lives in another section.
    sectionId?: string
    screenId?: string
  }
  // DATE_TIME only: show a "stamp now" button next to the picker that sets
  // the value to the current timestamp in one click.
  quickStamp?: boolean
  // SINGLE_LINE_TEXT only: show a "Generate" button next to the input that
  // calls the admin-configured ID Numbering sequence (see
  // backend/app/models/id_sequence.py + Admin > ID Numbering) and fills in
  // the result, e.g. 'SAMPLE_ID' -> "SAMPLE/26/00001". Once generated the
  // field locks — same one-time-assignment behavior as the other auto-id
  // fields in this template (Batch Record ID, Intermediate Output ID, etc.)
  // that predate this capability and are still plain manual text fields.
  idSequence?: string   // the IdSequenceConfig.code to call, e.g. 'SAMPLE_ID'
  colSpan?: 1 | 2            // within a 2-column screen; SECTION_HEADING/SPACER always span 2
  // LOCK_TOGGLE: no extra config — placing this field renders a Lock/Unlock
  // button in the CGT runtime (label is the button's un-toggled text). On
  // click it locks (read-only) every screen in the same SECTION that comes
  // before this field's screen, plus any fields before it on its own screen.
  // Toggles back to editable on a second click. Purely a runtime UI action;
  // nothing here is persisted on the field itself — the lock state lives in
  // the experiment data, keyed by this field's id.
  // Computation (NUMBER fields only): when this field's value is committed
  // (on blur), add or subtract it from another NUMBER field anywhere in the
  // same section — e.g. deduct a "Sample Qty" from a batch table's "Qty".
  // One-shot: applied once per commit, not continuously recomputed, so
  // re-editing this field applies the operation again on top of the target's
  // current value. If the target lives on a table screen, row 0 is used.
  computation?: {
    operation: 'add' | 'subtract'
    targetFieldName: string
  }
  // LOCK_TOGGLE only: the moment this button transitions unlocked -> locked
  // (not on unlock), copy rows row-for-row from a source table screen into a
  // target table screen, both in the same section — e.g. "Test Required" ->
  // "Sample Analysis Results", handing off Test/Method/Acceptance Criteria to
  // the next department while their own columns (Sample ID, Results, Status)
  // stay blank and editable. Mirrored target columns become read-only for as
  // long as this button stays locked (re-editable if unlocked, re-copied on
  // the next lock click). One-way per source row: extra rows already present
  // in the target beyond the source's row count are left alone.
  mirrorOnLock?: {
    sourceScreenId: string
    targetScreenId: string
    columns: { sourceFieldName: string; targetFieldName: string }[]
  }[]
  // LOCK_TOGGLE only: the moment this button transitions unlocked -> locked,
  // also raise an ATR (Analytical Test Request) against the OWNING SECTION —
  // e.g. 1.1 Antibody Info's "Lock Fields Above" hands the whole section off
  // to ARD for testing. Snapshots the section's current data into a new
  // ExperimentAtrRequest row (see backend/app/models/experiment.py) — a
  // one-time copy, not a live link; nothing consumes it yet (ARD-side wiring
  // comes once that module exists). No-op on unlock.
  raisesAtr?: boolean
  // DROPDOWN field living inside a REPEATING_GROUP's sub-screen only: lets a
  // second "Add X" button (rendered next to the table's normal Add row, by
  // CgtTableField) create a row whose value for THIS field is picked from a
  // sibling field of EARLIER items in the SAME repeating group instance,
  // instead of from its normal optionsMode/rowSource. E.g. Buffer
  // Preparation's Chemical/Reagent: "Add row" -> chemicals from 1.3 Reagents
  // & Salts (its normal screenRows source); "Add Buffer" -> the Buffer name
  // of any earlier buffer item already added in this same experiment, so a
  // later buffer can be composed using an earlier prepared one as an
  // ingredient. No auto-fill of other columns when picked this way.
  altGroupSource?: {
    addButtonLabel: string   // e.g. "Add Buffer"
    subScreenId: string       // sibling sub-screen holding the source field (e.g. Buffer Details)
    valueField: string        // that sub-screen's field `name` stored as the answer
    labelField: string        // that sub-screen's field `name` shown to the user
  }
  // REPEATING_GROUP only: sub-screens that repeat per item (e.g. one buffer).
  // Each item's data is keyed { [subScreenId]: values | rows[] } — same shape
  // as a section's top-level screen data, scoped to the item. The screens
  // array is the static template (authored in the seed); at runtime the user
  // adds/removes items via Add/Remove buttons rendered by CgtSectionPage.
  repeatConfig?: {
    addButtonLabel?: string    // button text, default "Add item"
    itemLabel?: string         // e.g. "Buffer" → "Buffer 1", "Remove Buffer"
    screens: TemplateScreen[]  // sub-screens forming one repeating item
  }
  // SPREADSHEET only. Two ways to source the sheet:
  //   • 'inline'   — authored per-field, right here in this builder. Own copy
  //     of everything (`workbookData`/`fields`/`protectedRanges`), same shape
  //     as the standalone Calc Templates feature's metadata (see
  //     pages/admin/calcTemplates/types.ts) so the runtime control can share
  //     its fill logic (read-only sheet, form-panel inputs, live client-side
  //     recalculation).
  //   • 'template' — references a template published in Admin > Calc
  //     Templates by id, PINNED to the version chosen at reference time
  //     (`calcTemplateVersion`) — publishing a newer version there does NOT
  //     change already-configured fields; re-pick to upgrade. Lets one
  //     authored sheet get reused across many screens/templates instead of
  //     re-authoring it inline each time. `calcTemplateName` is a display-only
  //     cache so the builder doesn't need an extra fetch just to show which
  //     template is referenced.
  // Undefined `mode` on an existing field means 'inline' (back-compat).
  // No backend re-validation in either mode — this field's computed value is
  // trusted client-side like every other form field in this builder; the
  // experiment's own chemist/HOD e-signature sign-off is the audit control,
  // matching the rest of the CGT runtime.
  spreadsheet?: {
    mode?: 'inline' | 'template'
    // inline mode:
    workbookData: Record<string, unknown> | null
    fields: CalcField[]
    protectedRanges: ProtectedRangeMeta[]
    // template mode:
    calcTemplateId?: string
    calcTemplateVersion?: number
    calcTemplateName?: string
  }
  // ATR_REQUEST only: per-instance configuration of which sections of the
  // ATR Form appear at runtime (both real CGT/ADC experiments and Builder
  // Preview mode) and whether the "Form Type" picker modal is skipped in
  // favor of a fixed, template-author-chosen Form Type. Every key is
  // undefined-safe — an existing ATR_REQUEST field with no config at all
  // behaves exactly as before (every section shown, Form Type modal shown).
  atrRequestConfig?: {
    showFormAttributes?: boolean   // default true if undefined
    showSampleDetails?: boolean    // default true if undefined
    showTestDetails?: boolean      // default true if undefined
    showSupportingDocs?: boolean   // default true if undefined
    showQaCertification?: boolean  // default true if undefined
    lockedFormTypeId?: string | null  // if set, skip the "Form Type" modal entirely and auto-create using this form type
  }
  // USAGE_LOG_START_STOP only: renders "Start"/"End" buttons that call the
  // real inventory usage-log endpoints (POST /api/inventory/usage-logs,
  // PATCH .../{id}/end — see api/inventory.ts's usageLogApi), auto-flipping
  // the target catalogue item's status AVAILABLE<->IN_USE. `idFieldName`
  // names ANOTHER field on the SAME table screen (a sibling column) that
  // holds the numeric catalogue id (Equipment/InstrumentCatalogue.id, not
  // the `asset_id` string) for this row — typically a read-only autoFill
  // column mirroring the row's driver dropdown. Optional so a freshly
  // dropped, not-yet-configured instance renders a disabled "Not
  // configured" state instead of crashing.
  usageLogConfig?: {
    targetKind: 'EQUIPMENT' | 'INSTRUMENT'
    idFieldName?: string
  }
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
  category: 'Layout Elements' | 'Text Elements' | 'Date Elements' | 'Selection Elements' | 'Media Elements' | 'Advanced Elements'
  hasOptions?: boolean
  isLayoutOnly?: boolean      // SECTION_HEADING / SPACER — no validation config
}

export const FIELD_TYPE_REGISTRY: FieldTypeDescriptor[] = [
  { type: 'SECTION_HEADING', label: 'Sub-heading',      category: 'Layout Elements', isLayoutOnly: true },
  { type: 'SPACER',          label: 'Spacer / Blank',   category: 'Layout Elements', isLayoutOnly: true },
  { type: 'LOCK_TOGGLE',     label: 'Lock Fields Button', category: 'Layout Elements', isLayoutOnly: true },
  { type: 'SINGLE_LINE_TEXT', label: 'Single Line Text', category: 'Text Elements' },
  { type: 'MULTI_LINE_TEXT',  label: 'Multi-Line Text',  category: 'Text Elements' },
  { type: 'RICH_TEXT',        label: 'Rich Text',        category: 'Text Elements' },
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
  { type: 'SPREADSHEET',      label: 'Spreadsheet',       category: 'Advanced Elements' },
  { type: 'REPEATING_GROUP',  label: 'Repeating Group',   category: 'Advanced Elements', isLayoutOnly: true },
  // Not used by any published template yet — added to the palette ahead of
  // need so a future template can drag it in directly, same chemical
  // structure editor already used in the standalone ADC project's Scheme tab
  // (pages/adc/tabs/SchemeTab.tsx), wrapped as a plain value/onChange control.
  { type: 'KETCHER',         label: 'Chemical Structure (Ketcher)', category: 'Advanced Elements' },
  // Self-contained: no per-field config needed. Renders "Done By" (chemist)
  // and "Checked By" (TL) buttons, each requiring a password re-entry
  // (backend POST /api/experiments/{id}/sections/{sectionId}/signature).
  // Signature state is stored at the SECTION level (a reserved
  // '__section_signature__' key sitting alongside the section's screen data,
  // not tied to any one screen) so it's readable regardless of which screen
  // the field itself was dropped on. The runtime also uses its mere presence
  // in a section to gate that section's "Next" button until both are signed
  // — see AdcBuilderExperimentPage.tsx's `sectionHasSignature`.
  { type: 'SIGNATURE',       label: 'Signature (Done / Checked By)', category: 'Advanced Elements', isLayoutOnly: true },
  // Self-contained: no per-field config needed — everything (Form Types,
  // Attributes, Test Configurations) is fetched live from ARD master data at
  // runtime. Renders as a "Raise ATR Request" button that opens a Form Type
  // picker, then expands inline into a full ATR Form (see AtrRequestField.tsx),
  // creating a real app.models.ard_atr.ArdAtrForm via the existing
  // /api/ard/atrs endpoints (linked back via its origin_* columns) — distinct
  // from the lightweight LOCK_TOGGLE "raisesAtr" experiment_atr_requests snapshot.
  { type: 'ATR_REQUEST',     label: 'ATR Request',      category: 'Advanced Elements', isLayoutOnly: true },
  // Self-contained aside from `usageLogConfig` (target kind + which sibling
  // column on the same table screen holds the numeric catalogue id). Renders
  // "Start"/"End" buttons calling the real inventory usage-log endpoints
  // (see api/inventory.ts's usageLogApi) — see CgtFieldControl.tsx's
  // USAGE_LOG_START_STOP case / UsageLogStartStopField.tsx for the runtime.
  { type: 'USAGE_LOG_START_STOP', label: 'Equipment Start/Stop', category: 'Advanced Elements', isLayoutOnly: true },
]

export const FIELD_CATEGORIES: FieldTypeDescriptor['category'][] = [
  'Layout Elements', 'Text Elements', 'Date Elements', 'Selection Elements', 'Media Elements', 'Advanced Elements',
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
    colSpan: d.isLayoutOnly || type === 'SPREADSHEET' || type === 'KETCHER' ? 2 : 1,
    ...(d.hasOptions ? { options: ['Option 1', 'Option 2'] } : {}),
    ...(type === 'SPREADSHEET' ? { spreadsheet: { workbookData: null, fields: [], protectedRanges: [] } } : {}),
    // Without a starter sub-screen, a freshly-dropped Repeating Group has
    // nowhere for "+ Add field" (the builder canvas's sub-field editor) to
    // add into — it renders with no body at all, looking broken.
    ...(type === 'REPEATING_GROUP' ? { repeatConfig: { addButtonLabel: 'Add Item', itemLabel: 'Item', screens: [makeScreen('Details')] } } : {}),
    // No idFieldName yet — author must pick a sibling id column in the
    // drawer; until then the runtime shows a disabled "Not configured" state.
    ...(type === 'USAGE_LOG_START_STOP' ? { usageLogConfig: { targetKind: 'EQUIPMENT' } } : {}),
  }
}

export function makeScreen(title = 'New Screen'): TemplateScreen {
  return { id: newId('screen'), title, columns: 2, fields: [] }
}

export function makeSection(title = 'New Section'): TemplateSection {
  return { id: newId('section'), title, screens: [makeScreen('Details')] }
}
