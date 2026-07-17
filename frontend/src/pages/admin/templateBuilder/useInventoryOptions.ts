import { useQuery, type QueryClient } from '@tanstack/react-query'
import { INVENTORY_SOURCES, type InventorySourceDef, type InventorySourceKey } from './inventorySources'
import { mappingApi, type Mapping } from '../../../api/inventory'
import type { TemplateField } from './types'

// Cache key for a field's inventory rows — must match useInventoryOptions'
// queryKey exactly so applyAutoFill reads the same cached rows.
function invQueryKey(source?: string, lookupType?: string) {
  return ['inv-options', source ?? null, lookupType ?? null] as const
}

// When `changed` (an inventory-backed driver dropdown) gets a new value, copy
// the selected row's attributes into every sibling field bound to it via
// `autoFill.sourceFieldName`. Returns the next value map (merged onto `values`).
// Reads rows from the React Query cache — populated because the driver's
// options must have loaded for a value to be selectable.
export function applyAutoFill(
  qc: QueryClient,
  siblings: TemplateField[],
  changed: TemplateField,
  newValue: unknown,
  values: Record<string, unknown>,
): Record<string, unknown> {
  if (changed.optionsMode !== 'inventory' || !changed.inventorySource) return values
  const dependents = siblings.filter(
    f => (f.autoFill?.mode ?? 'attribute') === 'attribute' && f.autoFill?.sourceFieldName === changed.name,
  )
  if (dependents.length === 0) return values

  const src = changed.inventorySource
  const rows = qc.getQueryData<Record<string, unknown>[]>(invQueryKey(src.source, src.lookupType)) ?? []
  const cleared = newValue == null || newValue === ''
  const row = cleared ? undefined : rows.find(r => String(r[src.valueField]) === String(newValue))

  const next = { ...values }
  for (const dep of dependents) {
    const attr = dep.autoFill!.attribute
    const raw = row && attr ? row[attr] : undefined
    next[dep.name] = raw == null ? '' : raw
  }
  return next
}

// Resolve the id of the row a driver dropdown currently points at, from the
// cached inventory rows (the driver stores a code/symbol, not the row id).
function driverRowId(qc: QueryClient, driver: TemplateField | undefined, value: unknown): number | null {
  const src = driver?.inventorySource
  if (!src || value == null || value === '') return null
  const rows = qc.getQueryData<Record<string, unknown>[]>(invQueryKey(src.source, src.lookupType)) ?? []
  const row = rows.find(r => String(r[src.valueField]) === String(value))
  const id = row?.id
  return typeof id === 'number' ? id : id != null ? Number(id) : null
}

// Async counterpart of applyAutoFill for 'mapping'-mode dependents: when a
// material OR manufacturer driver changes, resolve the material↔manufacturer
// mapping and patch the dependent (e.g. Catalogue No). Applies each result via
// `commitPatch` (a functional partial merge) so late-arriving fetches never
// clobber concurrent edits. `merged` is the value map AFTER the sync change.
export async function resolveMappingAutoFills(
  qc: QueryClient,
  siblings: TemplateField[],
  changed: TemplateField,
  merged: Record<string, unknown>,
  commitPatch: (patch: Record<string, unknown>) => void,
): Promise<void> {
  const deps = siblings.filter(f => {
    const af = f.autoFill
    return af?.mode === 'mapping'
      && (af.materialFieldName === changed.name || af.manufacturerFieldName === changed.name)
  })

  for (const dep of deps) {
    const af = dep.autoFill!
    const matField = siblings.find(f => f.name === af.materialFieldName)
    const manuField = siblings.find(f => f.name === af.manufacturerFieldName)
    const materialId = driverRowId(qc, matField, merged[af.materialFieldName ?? ''])
    const manufacturerId = driverRowId(qc, manuField, merged[af.manufacturerFieldName ?? ''])
    const attr = af.mappingAttribute

    if (materialId == null || manufacturerId == null || !attr) {
      commitPatch({ [dep.name]: '' })
      continue
    }
    try {
      // material+manufacturer is unique (backend enforces), so [0] is the row.
      const maps = await qc.fetchQuery({
        queryKey: ['inv-mappings', materialId, manufacturerId],
        queryFn: () => mappingApi.list({ material_id: materialId, manufacturer_id: manufacturerId, limit: 200 }),
        staleTime: 5 * 60 * 1000,
      })
      const m = (maps as Mapping[])[0] as Record<string, unknown> | undefined
      const raw = m ? m[attr] : undefined
      commitPatch({ [dep.name]: raw == null ? '' : raw })
    } catch {
      commitPatch({ [dep.name]: '' })
    }
  }
}

export interface OptionItem {
  value: string
  label: string
}

export interface InventoryOptionsResult {
  options: OptionItem[]
  loading: boolean
  error: boolean
  inventory: boolean          // true when this field draws options from inventory
}

// Resolves a field's dropdown options — static (from `field.options`) or
// inventory-backed (fetched via the source registry). One React Query per
// (source, lookupType), so many fields sharing a source hit the network once.
// Static fields never trigger a fetch (query stays disabled).
export function useInventoryOptions(field: TemplateField): InventoryOptionsResult {
  const src = field.optionsMode === 'inventory' ? field.inventorySource : undefined
  const def: InventorySourceDef | undefined = src
    ? INVENTORY_SOURCES[src.source as InventorySourceKey]
    : undefined
  const ready = !!def && (!def.needsLookupType || !!src?.lookupType)

  const query = useQuery({
    queryKey: ['inv-options', src?.source ?? null, src?.lookupType ?? null],
    queryFn: () => def!.fetch({ lookupType: src?.lookupType }),
    enabled: !!src && ready,
    staleTime: 5 * 60 * 1000,
  })

  if (!src) {
    return {
      options: (field.options ?? []).map(o => ({ value: o, label: o })),
      loading: false,
      error: false,
      inventory: false,
    }
  }

  const options: OptionItem[] = (query.data ?? [])
    .map(row => {
      const value = row[src.valueField]
      const label = row[src.labelField]
      return {
        value: value == null ? '' : String(value),
        label: label == null || label === '' ? String(value ?? '') : String(label),
      }
    })
    .filter(o => o.value !== '')

  return { options, loading: query.isLoading && ready, error: query.isError, inventory: true }
}
