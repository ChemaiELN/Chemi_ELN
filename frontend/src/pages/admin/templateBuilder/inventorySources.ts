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
import { materialApi, manufacturerApi, uomApi, lookupApi } from '../../../api/inventory'

export type InventorySourceKey = 'materials' | 'manufacturers' | 'uom' | 'lookup'

export interface SourceColumn {
  key: string
  label: string
}

export interface FetchOpts {
  lookupType?: string
  search?: string            // honored only when serverSearch is true
}
export interface FetchOneOpts {
  value: unknown
  valueField: string
  lookupType?: string
}

export interface InventorySourceDef {
  key: InventorySourceKey
  label: string
  needsLookupType?: boolean          // 'lookup' only — requires a lookup_type to be chosen
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
    ],
    serverSearch: true,
    fetch: (opts) => materialApi.list({
      active_only: true,
      limit: opts?.search ? SEARCH_PAGE : BROWSE_PAGE,
      ...(opts?.search ? { search: opts.search } : {}),
    }) as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField }) =>
      materialApi.list({ active_only: true, limit: 20, search: String(value) })
        .then(rows => findByValue(rows as Record<string, unknown>[], valueField, value)),
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
    }) as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField }) =>
      manufacturerApi.list({ active_only: true, limit: 20, search: String(value) })
        .then(rows => findByValue(rows as Record<string, unknown>[], valueField, value)),
  },
  uom: {
    key: 'uom',
    label: 'Units (UOM)',
    defaultValueField: 'symbol',
    defaultLabelField: 'name',
    columns: [
      { key: 'symbol', label: 'Symbol' },
      { key: 'name', label: 'Name' },
    ],
    // UOM is nested dimension→units; flatten to a single list of units. Small,
    // bounded set — loaded once and filtered client-side.
    fetch: async () => {
      const dims = await uomApi.list({ active_only: true, limit: CLIENT_LIMIT })
      return dims.flatMap(d => d.units ?? []) as unknown as Record<string, unknown>[]
    },
    fetchOne: async ({ value, valueField }) => {
      const dims = await uomApi.list({ active_only: true, limit: CLIENT_LIMIT })
      const units = dims.flatMap(d => d.units ?? []) as unknown as Record<string, unknown>[]
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
      lookupApi.list({ lookup_type: opts?.lookupType, active_only: true, limit: CLIENT_LIMIT }) as Promise<Record<string, unknown>[]>,
    fetchOne: ({ value, valueField, lookupType }) =>
      lookupApi.list({ lookup_type: lookupType, active_only: true, limit: CLIENT_LIMIT })
        .then(rows => findByValue(rows as Record<string, unknown>[], valueField, value)),
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
]
