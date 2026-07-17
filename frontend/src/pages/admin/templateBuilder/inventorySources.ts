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

export interface InventorySourceDef {
  key: InventorySourceKey
  label: string
  needsLookupType?: boolean          // 'lookup' only — requires a lookup_type to be chosen
  defaultValueField: string
  defaultLabelField: string
  columns: SourceColumn[]            // selectable as value/label; also the future autofill attribute list
  fetch: (opts?: { lookupType?: string }) => Promise<Record<string, unknown>[]>
}

const LIST_PARAMS = { active_only: true, limit: 200 }

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
    ],
    fetch: () => materialApi.list(LIST_PARAMS) as Promise<Record<string, unknown>[]>,
  },
  manufacturers: {
    key: 'manufacturers',
    label: 'Manufacturers',
    defaultValueField: 'code',
    defaultLabelField: 'name',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'country', label: 'Country' },
    ],
    fetch: () => manufacturerApi.list(LIST_PARAMS) as Promise<Record<string, unknown>[]>,
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
    // UOM is nested dimension→units; flatten to a single list of units.
    fetch: async () => {
      const dims = await uomApi.list({ active_only: true })
      return dims.flatMap(d => d.units ?? []) as unknown as Record<string, unknown>[]
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
      lookupApi.list({ lookup_type: opts?.lookupType, active_only: true }) as Promise<Record<string, unknown>[]>,
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
