import { type QueryClient } from '@tanstack/react-query'
import { mappingApi, type Mapping } from '../../../api/inventory'
import type { TemplateField } from './types'
import type { InventorySourceKey } from './inventorySources'

// ── React Query cache keys ──────────────────────────────────────────────────
// Option list for a source; `term` distinguishes debounced server searches.
export function optionsQueryKey(source?: string, lookupType?: string, term = '') {
  return ['inv-options', source ?? null, lookupType ?? null, term] as const
}
// One resolved row, keyed by the value stored in the form. Primed by
// InventorySelect on selection (and on reload via fetchOne) so autofill and
// label display never depend on the current, possibly-filtered, option list.
export function rowQueryKey(source: string, lookupType: string | undefined, valueField: string, value: unknown) {
  return ['inv-row', source, lookupType ?? null, valueField, value] as const
}

function getRow(qc: QueryClient, src: NonNullable<TemplateField['inventorySource']>, value: unknown) {
  if (value == null || value === '') return undefined
  return qc.getQueryData<Record<string, unknown>>(rowQueryKey(src.source, src.lookupType, src.valueField, value))
}

// When `changed` (an inventory-backed driver dropdown) gets a new value, copy
// the selected row's attributes into every sibling bound to it via
// `autoFill.sourceFieldName`. Returns the next value map (merged onto `values`).
// The driver's row is read from the per-value cache primed on selection.
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

  const row = getRow(qc, changed.inventorySource, newValue)

  const next = { ...values }
  for (const dep of dependents) {
    const attr = dep.autoFill!.attribute
    const raw = row && attr ? row[attr] : undefined
    next[dep.name] = raw == null ? '' : raw
  }
  return next
}

// Resolve the id of the row a driver dropdown currently points at (the driver
// stores a code/symbol, not the row id).
function driverRowId(qc: QueryClient, driver: TemplateField | undefined, value: unknown): number | null {
  const src = driver?.inventorySource
  if (!src) return null
  const row = getRow(qc, src, value)
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

// Re-export so callers that only need the source key type don't import twice.
export type { InventorySourceKey }
