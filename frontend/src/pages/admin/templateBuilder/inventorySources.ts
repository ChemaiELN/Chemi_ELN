// ── Inventory-backed dropdown sources ───────────────────────────────────────
// Single source of truth for the "options from inventory" feature. Each entry
// maps a source key (stored in a field's `inventorySource.source`) to:
//   • the API call that fetches the rows,
//   • the columns a builder-admin may pick as the stored value / shown label.
//
// Consumed by the builder (FieldPropertiesDrawer — to list columns) and the
// runtime (useInventoryOptions — to fetch + map rows to Select options). Add a
// source here and both sides pick it up; no renderer changes needed.
//
// Server list endpoints cap at limit≤200 (see backend/app/modules/inventory/*),
// so we request the max and active rows only. A source with >200 active rows
// will truncate — revisit with server-side search if that becomes real.
import {
  materialApi, manufacturerApi, uomApi, lookupApi, batchApi, testMasterApi,
  consumableTypeApi, equipmentTypeApi, instrumentTypeApi, equipmentCatalogueApi, instrumentCatalogueApi,
  storageConditionApi, storageLocationApi,
} from '../../../api/inventory'

export type InventorySourceKey =
  | 'materials' | 'manufacturers' | 'uom' | 'lookup' | 'batches' | 'test_names' | 'test_methods'
  | 'consumable_types' | 'consumables' | 'equipment_types' | 'instrument_types' | 'equipment' | 'instrument'
  | 'storage_conditions' | 'storage_locations'

export interface SourceColumn {
  key: string
  label: string
}

export interface FetchOpts {
  lookupType?: string
  dimensionKey?: string      // honored only when source === 'uom' — restricts to one UOM dimension
  search?: string            // honored only when serverSearch is true
  materialCode?: string      // honored only when filterByMaterial is true (batches)
  parentValue?: string       // honored only when filterByParent is true (e.g. test_methods filtered by test_names)
  departmentId?: string      // honored only for materials/equipment/instrument — template-authored fixed department scope
}
export interface FetchOneOpts {
  value: unknown
  valueField: string
  lookupType?: string
  dimensionKey?: string
}

export interface InventorySourceDef {
  key: InventorySourceKey
  label: string
  needsLookupType?: boolean          // 'lookup' only — requires a lookup_type to be chosen
  // 'uom' only — lets the builder optionally restrict the option list to one
  // UOM dimension (e.g. only "Volume" units). Not required — omitting it
  // keeps today's behavior of showing every unit across every dimension.
  supportsDimensionFilter?: boolean
  // 'batches' only — the list is filtered by a sibling materials dropdown's
  // selected code; the dropdown is disabled until a material is chosen.
  filterByMaterial?: boolean
  // Generic cascading filter (e.g. 'test_methods' filtered by a 'test_names'
  // dropdown's selected value) — the dropdown is disabled until the parent
  // field has a value. `parentSource` names which source the driver field
  // must use; `parentPrompt` is the disabled-state placeholder.
  filterByParent?: { parentSource: InventorySourceKey; parentPrompt: string }
  // true → the backend supports a `search` param, so we query per keystroke
  // (debounced). false → load once (server caps well above realistic size) and
  // filter in the browser.
  serverSearch?: boolean
  defaultValueField: string
  defaultLabelField: string
  columns: SourceColumn[]            // selectable as value/label; also the autofill attribute list
  fetch: (opts?: FetchOpts) => Promise<Record<string, unknown>[]>
  // Resolve a single row by its stored value — used to show a label on reload
  // and to feed autofill for server-search sources.
  fetchOne: (opts: FetchOneOpts) => Promise<Record<string, unknown> | null>
}

// Client-side sources load a full page; their endpoints cap at 500.
const CLIENT_LIMIT = 500
// Server-search sources: a small page for browsing, a slightly larger page when
// a search term narrows results.
const SEARCH_PAGE = 50
const BROWSE_PAGE = 50

function findByValue(rows: Record<string, unknown>[], valueField: string, value: unknown) {
  return rows.find(r => String(r[valueField]) === String(value)) ?? null
}

// Materials come back with `grade` nested under `chemical_props` (the API's
// serialized ChemicalProps association), not as a flat column — flatten it so
// attribute-mode autoFill (which reads `row[attribute]` as a top-level key)
// can resolve it the same way it resolves `cas_no`, `mol_weight`, etc.
function withFlatGrade(row: Record<string, unknown>): Record<string, unknown> {
  const props = row.chemical_props as { grade?: string | null } | null | undefined
  return { ...row, grade: props?.grade ?? null }
}

export const INVENTORY_SOURCES: Record<InventorySourceKey, InventorySourceDef> = {
  materials: {
    key: 'materials',
    label: 'Materials',
    defaultValueField: 'code',
    defaultLabelField: 'name',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'cas_no', label: 'CAS No' },
      { key: 'molecular_formula', label: 'Molecular Formula' },
      { key: 'mol_weight', label: 'Molecular Weight' },
      { key: 'storage_condition', label: 'Storage Condition' },
      { key: 'hazard_class', label: 'Hazard Class' },
      { key: 'iso_type', label: 'ISO Type' },
      { key: 'grade', label: 'Technical Grade' },
    ],
    serverSearch: true,
    // `grade` is flattened onto the row from the nested `chemical_props` the
    // API returns, so autoFill's attribute-mode (which reads `row[attribute]`
    // — a flat key, see useInventoryOptions.ts) can resolve it. Grade used to
    // be sourced from the material↔manufacturer mapping's own technical_grade
    // column via mapping-mode autoFill, but that field was dropped from the
    // Mappings screen — Technical Grade is now a material-level attribute
    // (Materials edit modal's "Chemical Properties" section) shared by every
    // manufacturer, so every ADC template's Grade column was switched to
    // attribute-mode against this field.
    fetch: (opts) => materialApi.list({
      active_only: true,
      limit: opts?.search ? SEARCH_PAGE : BROWSE_PAGE,
      ...(opts?.search ? { search: opts.search } : {}),
      ...(opts?.departmentId ? { department_id: opts.departmentId } : {}),
    }).then(rows => (rows as unknown as Record<string, unknown>[]).map(withFlatGrade)) as unknown as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField }) =>
      materialApi.list({ active_only: true, limit: 20, search: String(value) })
        .then(rows => findByValue((rows as unknown as Record<string, unknown>[]).map(withFlatGrade), valueField, value)),
  },
  manufacturers: {
    key: 'manufacturers',
    label: 'Manufacturers',
    serverSearch: true,
    defaultValueField: 'code',
    defaultLabelField: 'name',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'country', label: 'Country' },
    ],
    fetch: (opts) => manufacturerApi.list({
      active_only: true,
      limit: opts?.search ? SEARCH_PAGE : BROWSE_PAGE,
      ...(opts?.search ? { search: opts.search } : {}),
    }) as unknown as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField }) =>
      manufacturerApi.list({ active_only: true, limit: 20, search: String(value) })
        .then(rows => findByValue(rows as unknown as Record<string, unknown>[], valueField, value)),
  },
  uom: {
    key: 'uom',
    label: 'Units (UOM)',
    supportsDimensionFilter: true,
    defaultValueField: 'symbol',
    defaultLabelField: 'name',
    columns: [
      { key: 'symbol', label: 'Symbol' },
      { key: 'name', label: 'Name' },
    ],
    // UOM is nested dimension→units; flatten to a single list of units. Small,
    // bounded set — loaded once and filtered client-side. When a dimensionKey
    // is configured, restrict to that one dimension (e.g. only "Volume")
    // instead of flattening every dimension together.
    fetch: async (opts) => {
      const dims = await uomApi.list({ active_only: true, limit: CLIENT_LIMIT })
      const scoped = opts?.dimensionKey ? dims.filter(d => d.dimension_key === opts.dimensionKey) : dims
      return scoped.flatMap(d => d.units ?? []) as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField, dimensionKey }) => {
      const dims = await uomApi.list({ active_only: true, limit: CLIENT_LIMIT })
      const scoped = dimensionKey ? dims.filter(d => d.dimension_key === dimensionKey) : dims
      const units = scoped.flatMap(d => d.units ?? []) as unknown as Record<string, unknown>[]
      return findByValue(units, valueField, value)
    },
  },
  lookup: {
    key: 'lookup',
    label: 'General Lookup',
    needsLookupType: true,
    defaultValueField: 'lookup_code',
    defaultLabelField: 'lookup_value',
    columns: [
      { key: 'lookup_code', label: 'Code' },
      { key: 'lookup_value', label: 'Value' },
    ],
    fetch: (opts) =>
      lookupApi.list({ lookup_type: opts?.lookupType, active_only: true, limit: CLIENT_LIMIT }) as unknown as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField, lookupType }) =>
      lookupApi.list({ lookup_type: lookupType, active_only: true, limit: CLIENT_LIMIT })
        .then(rows => findByValue(rows as unknown as Record<string, unknown>[], valueField, value)),
  },
  batches: {
    key: 'batches',
    label: 'Batches (of a material)',
    filterByMaterial: true,
    // One row per PACK, not per batch — a batch with 3 packs (each with its
    // own SKU/Pack ID and, when include_pack was used, its own sub-lot) lists
    // as 3 selectable rows, mirroring the admin Batches table's expand_packs
    // view. `row_key` is the only value guaranteed unique across those rows
    // (batch_no repeats per pack); `batch_label` is a synthetic display label
    // (batch_no, plus the pack SKU when this batch has packs) so rows for the
    // same batch remain distinguishable in the dropdown.
    defaultValueField: 'row_key',
    defaultLabelField: 'batch_label',
    columns: [
      { key: 'batch_label', label: 'Batch + Pack (display)' },
      { key: 'batch_no', label: 'Batch No' },
      { key: 'inhouse_batch_no', label: 'In-house Batch No' },
      { key: 'pack_sku', label: 'SKU / Pack ID' },
      { key: 'mfg_date', label: 'Mfg Date' },
      { key: 'expiry_date', label: 'Expiry Date' },
      { key: 'retest_date', label: 'Retest Date' },
      { key: 'qty_available', label: 'Qty Available' },
      { key: 'unit', label: 'Unit' },
      { key: 'manufacturer_name', label: 'Manufacturer' },
      { key: 'pack_type', label: 'Pack Type' },
      { key: 'location', label: 'Location' },
      { key: 'invoice_no', label: 'Invoice No' },
      { key: 'po_no', label: 'PO No' },
      { key: 'price', label: 'Price' },
      { key: 'status', label: 'Status' },
    ],
    // The list only makes sense once a material is chosen — return nothing until
    // then. Batches per material are few, so no server-search needed.
    fetch: (opts) =>
      opts?.materialCode
        ? (batchApi.list({ material_code: opts.materialCode, limit: 200, expand_packs: 1 }) as unknown as Promise<Record<string, unknown>[]>)
            .then(rows => rows.map(r => ({
              ...r,
              batch_label: r.pack_sku ? `${r.batch_no} — ${r.pack_sku}` : String(r.batch_no ?? ''),
            })))
        : Promise.resolve([]),
    // Label == value (batch_label/row_key), and auto-filled values are already
    // persisted, so no single-row resolve is needed on reload.
    fetchOne: async () => null,
  },
  test_names: {
    key: 'test_names',
    label: 'Test / Analysis Names',
    defaultValueField: 'name',
    defaultLabelField: 'name',
    columns: [
      { key: 'name', label: 'Test Name' },
      { key: 'type_name', label: 'Test Type' },
    ],
    // Small master list (Test Types → Names → Methods) — one call loads the
    // whole tree; flatten active names across active types.
    fetch: async () => {
      const types = await testMasterApi.list()
      return types
        .filter(t => t.is_active)
        .flatMap(t => t.names.filter(n => n.is_active).map(n => ({ id: n.id, name: n.name, type_name: t.name, type_key: t.type_key })))
    },
    fetchOne: async ({ value, valueField }) => {
      const types = await testMasterApi.list()
      const rows = types
        .filter(t => t.is_active)
        .flatMap(t => t.names.filter(n => n.is_active).map(n => ({ id: n.id, name: n.name, type_name: t.name, type_key: t.type_key })))
      return findByValue(rows, valueField, value)
    },
  },
  test_methods: {
    key: 'test_methods',
    label: 'Test Methods (of a test)',
    filterByParent: { parentSource: 'test_names', parentPrompt: 'Select the test first' },
    defaultValueField: 'method_name',
    defaultLabelField: 'method_name',
    columns: [
      { key: 'method_name', label: 'Method Name' },
    ],
    // The list only makes sense once a test name is chosen — `parentValue` is
    // that test name's stored value (name text, per test_names' valueField).
    fetch: async (opts) => {
      if (!opts?.parentValue) return []
      const types = await testMasterApi.list()
      const testName = types.flatMap(t => t.names).find(n => n.name === opts.parentValue)
      if (!testName) return []
      return testName.methods.filter(m => m.is_active).map(m => ({ id: m.id, method_name: m.method_name }))
    },
    // Label == value (method_name), and the parent filter already scopes the
    // list correctly on reload — no single-row resolve needed.
    fetchOne: async () => null,
  },
  consumable_types: {
    key: 'consumable_types',
    label: 'Consumable Types',
    defaultValueField: 'id',
    defaultLabelField: 'name',
    columns: [
      { key: 'id', label: 'Id' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ],
    // Small, unpaged master lookup — load once.
    fetch: async () => {
      const rows = await consumableTypeApi.list()
      return rows.filter(r => r.is_active) as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await consumableTypeApi.list()
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  consumables: {
    key: 'consumables',
    label: 'Consumables (materials of a consumable type)',
    // Consumable items are Materials linked to a Consumable Type
    // (InvMaterial.consumable_type_id) — cascade off a 'consumable_types' dropdown.
    filterByParent: { parentSource: 'consumable_types', parentPrompt: 'Select the consumable type first' },
    defaultValueField: 'code',
    defaultLabelField: 'name',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'cas_no', label: 'CAS No' },
      { key: 'storage_condition', label: 'Storage Condition' },
      { key: 'hazard_class', label: 'Hazard Class' },
    ],
    fetch: (opts) =>
      opts?.parentValue
        // /api/inventory/materials caps `limit` at 200 (unlike the 500-cap
        // client sources elsewhere in this file) — CLIENT_LIMIT would 422.
        ? materialApi.list({ consumable_type_id: opts.parentValue, active_only: true, limit: 200 }) as unknown as Promise<Record<string, unknown>[]>
        : Promise.resolve([]),
    fetchOne: async ({ value, valueField }) =>
      materialApi.list({ active_only: true, limit: 20, search: String(value) })
        .then(rows => findByValue(rows as unknown as Record<string, unknown>[], valueField, value)),
  },
  equipment_types: {
    key: 'equipment_types',
    label: 'Equipment Types',
    defaultValueField: 'id',
    defaultLabelField: 'name',
    columns: [
      { key: 'id', label: 'Id' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
    ],
    fetch: async () => {
      const rows = await equipmentTypeApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return rows as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await equipmentTypeApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  instrument_types: {
    key: 'instrument_types',
    label: 'Instrument Types',
    defaultValueField: 'id',
    defaultLabelField: 'name',
    columns: [
      { key: 'id', label: 'Id' },
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
    ],
    fetch: async () => {
      const rows = await instrumentTypeApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return rows as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await instrumentTypeApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  equipment: {
    key: 'equipment',
    label: 'Equipment (catalogue)',
    defaultValueField: 'asset_id',
    defaultLabelField: 'name',
    columns: [
      // Numeric catalogue PK — needed by the USAGE_LOG_START_STOP element
      // (a read-only autofilled column mirroring this attribute holds the
      // id the runtime resolves via a sibling column; see
      // pages/cgt/components/UsageLogStartStopField.tsx). Distinct from
      // `asset_id` below, the human-readable code shown/stored everywhere else.
      { key: 'id', label: 'Catalogue Id (numeric)' },
      { key: 'asset_id', label: 'Equipment ID (Asset ID)' },
      { key: 'name', label: 'Name' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'serial_no', label: 'Serial No' },
      { key: 'location', label: 'Location' },
      { key: 'maintenance_status', label: 'Maintenance Status' },
      { key: 'status', label: 'Status' },
      { key: 'last_maintenance_date', label: 'Last Maintenance Date' },
      { key: 'next_maintenance_date', label: 'Next Maintenance Date' },
    ],
    fetch: async (opts) => {
      const rows = await equipmentCatalogueApi.list({
        active_only: true, limit: CLIENT_LIMIT,
        ...(opts?.departmentId ? { department_id: opts.departmentId } : {}),
      })
      // Equipment with an open maintenance/calibration work order isn't a
      // valid pick for a new experiment — excluded here, not at the API
      // layer, so an already-selected row (fetchOne, below) still
      // resolves/displays fine if it goes into maintenance after being picked.
      return (rows as unknown as Record<string, unknown>[]).filter(
        r => r.effective_status === 'AVAILABLE' || r.effective_status === 'IN_USE',
      )
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await equipmentCatalogueApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  instrument: {
    key: 'instrument',
    label: 'Instruments (catalogue)',
    defaultValueField: 'asset_id',
    defaultLabelField: 'name',
    columns: [
      // See the matching comment on 'equipment' above.
      { key: 'id', label: 'Catalogue Id (numeric)' },
      { key: 'asset_id', label: 'Instrument ID (Asset ID)' },
      { key: 'name', label: 'Name' },
      { key: 'make', label: 'Make' },
      { key: 'model', label: 'Model' },
      { key: 'serial_no', label: 'Serial No' },
      { key: 'location', label: 'Location' },
      { key: 'calibration_status', label: 'Calibration Status' },
      { key: 'status', label: 'Status' },
      { key: 'last_calibration_date', label: 'Last Calibration Date' },
      { key: 'next_calibration_date', label: 'Next Calibration Date' },
    ],
    fetch: async (opts) => {
      const rows = await instrumentCatalogueApi.list({
        active_only: true, limit: CLIENT_LIMIT,
        ...(opts?.departmentId ? { department_id: opts.departmentId } : {}),
      })
      // Same reasoning as 'equipment' above: exclude only from the pickable
      // list, not from fetchOne, so an already-selected instrument still
      // resolves/displays if it goes into maintenance after being picked.
      return (rows as unknown as Record<string, unknown>[]).filter(
        r => r.effective_status === 'AVAILABLE' || r.effective_status === 'IN_USE',
      )
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await instrumentCatalogueApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  storage_conditions: {
    key: 'storage_conditions',
    label: 'Storage Conditions',
    defaultValueField: 'id',
    defaultLabelField: 'label',
    columns: [
      { key: 'id', label: 'Id' },
      { key: 'label', label: 'Label' },
      { key: 'temperature_min', label: 'Temperature Min' },
      { key: 'temperature_max', label: 'Temperature Max' },
      { key: 'temperature_unit', label: 'Temperature Unit' },
      { key: 'description', label: 'Description' },
    ],
    // Small, unpaged master lookup — load once.
    fetch: async () => {
      const rows = await storageConditionApi.list()
      return rows.filter(r => r.is_active) as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await storageConditionApi.list()
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
  storage_locations: {
    key: 'storage_locations',
    label: 'Storage Locations',
    defaultValueField: 'id',
    defaultLabelField: 'name',
    columns: [
      { key: 'id', label: 'Id' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
    ],
    // Small, unpaged master lookup — load once.
    fetch: async () => {
      const rows = await storageLocationApi.list()
      return rows.filter(r => r.is_active) as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const rows = await storageLocationApi.list()
      return findByValue(rows as unknown as Record<string, unknown>[], valueField, value)
    },
  },
}

export const INVENTORY_SOURCE_LIST: InventorySourceDef[] = Object.values(INVENTORY_SOURCES)

// Columns on a material↔manufacturer mapping that a 'mapping'-mode autofill can
// copy (see backend InvManufacturerMapping / MappingOut).
export const MAPPING_ATTRIBUTES: SourceColumn[] = [
  { key: 'catalogue_no', label: 'Catalogue No' },
  { key: 'technical_grade', label: 'Technical Grade' },
  { key: 'lead_time_days', label: 'Lead Time (days)' },
  { key: 'min_order_qty', label: 'Min Order Qty' },
  { key: 'dsd_file_path', label: 'SDS File Path' },
]
