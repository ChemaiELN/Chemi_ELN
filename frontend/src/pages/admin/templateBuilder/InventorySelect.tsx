import { useEffect, useMemo, useState } from 'react'
import { Select } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { INVENTORY_SOURCES, type InventorySourceKey } from './inventorySources'
import { optionsQueryKey, rowQueryKey } from './useInventoryOptions'
import type { TemplateField } from './types'

// Small local debounce so per-keystroke search doesn't hammer the backend.
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

interface Opt { value: string; label: string; row: Record<string, unknown> }

// A dropdown backed by an inventory source. Server-search sources (materials,
// manufacturers) query per keystroke (debounced); client sources (uom, lookup)
// load once and filter in the browser. On selection it primes a per-value row
// cache so autofill and label-on-reload work regardless of the current search.
export default function InventorySelect({ field, value, onChange, disabled, allowClear, filterValue, excludeValues, onTotalCount }: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  allowClear?: boolean
  // For material-filtered sources (batches): the selected code of the sibling
  // material dropdown. The list is empty/disabled until it's set.
  filterValue?: unknown
  // Values already picked elsewhere (e.g. by other rows of the same table
  // column) — hidden from this instance's list so the same physical batch/pack
  // can't be selected twice. This instance's OWN current value is never hidden.
  excludeValues?: unknown[]
  // Reports the total (unfiltered) option count once loaded — lets a parent
  // table decide whether every option is already used across its rows (e.g.
  // to disable "Add row" once every pack of a batch has been picked).
  onTotalCount?: (n: number | undefined) => void
}) {
  const qc = useQueryClient()
  const src = field.inventorySource!
  const def = INVENTORY_SOURCES[src.source as InventorySourceKey]

  const [term, setTerm] = useState('')
  const debounced = useDebounced(term, 300)
  const searchTerm = def?.serverSearch ? debounced : ''

  const filtersByMaterial = !!def?.filterByMaterial
  const materialCode = filtersByMaterial && filterValue != null && filterValue !== '' ? String(filterValue) : undefined

  const filtersByParent = !!def?.filterByParent
  const parentValue = filtersByParent && filterValue != null && filterValue !== '' ? String(filterValue) : undefined

  const listReady = !!def
    && (!def.needsLookupType || !!src.lookupType)
    && (!filtersByMaterial || !!materialCode)
    && (!filtersByParent || !!parentValue)
  const list = useQuery({
    queryKey: optionsQueryKey(src.source, src.lookupType, searchTerm, materialCode ?? parentValue ?? '', src.dimensionKey ?? '', src.departmentId ?? ''),
    queryFn: () => def!.fetch({ lookupType: src.lookupType, dimensionKey: src.dimensionKey, search: searchTerm || undefined, materialCode, parentValue, departmentId: src.departmentId }),
    enabled: listReady,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    onTotalCount?.(listReady ? list.data?.length : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listReady, list.data])

  // Resolve the label for a stored value that isn't in the current list — only
  // needed for server-search sources (client sources load the full list).
  const selReady = !!def?.serverSearch && value != null && value !== ''
  const selected = useQuery({
    queryKey: rowQueryKey(src.source, src.lookupType, src.valueField, value, src.dimensionKey),
    queryFn: () => def!.fetchOne({ value, valueField: src.valueField, lookupType: src.lookupType, dimensionKey: src.dimensionKey }),
    enabled: selReady,
    staleTime: 5 * 60 * 1000,
  })

  const labelOf = (r: Record<string, unknown>) => {
    const l = r[src.labelField]
    return l == null || l === '' ? String(r[src.valueField] ?? '') : String(l)
  }

  const options = useMemo<Opt[]>(() => {
    const excluded = new Set((excludeValues ?? []).map(v => String(v)))
    const opts = (list.data ?? [])
      .map(r => ({ value: String(r[src.valueField] ?? ''), label: labelOf(r), row: r }))
      .filter(o => o.value !== '' && (o.value === String(value) || !excluded.has(o.value)))
    // Ensure the current value is present so its label shows even when it's not
    // in the fetched page.
    if (value != null && value !== '' && !opts.some(o => o.value === String(value))) {
      const r = selected.data
      opts.unshift({ value: String(value), label: r ? labelOf(r) : String(value), row: r ?? {} })
    }
    return opts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data, selected.data, value, src.valueField, src.labelField, excludeValues])

  const handleChange = (v: unknown, option: Opt | Opt[] | undefined) => {
    const opt = Array.isArray(option) ? option[0] : option
    if (v != null && v !== '' && opt?.row) {
      qc.setQueryData(rowQueryKey(src.source, src.lookupType, src.valueField, v, src.dimensionKey), opt.row)
    }
    onChange(v)
  }

  return (
    <Select
      className="w-full"
      placeholder={
        filtersByMaterial && !materialCode ? 'Select the material first'
          : filtersByParent && !parentValue ? (def!.filterByParent!.parentPrompt)
          : (field.placeholder ?? 'Select…')
      }
      disabled={disabled || (filtersByMaterial && !materialCode) || (filtersByParent && !parentValue)}
      value={value ? String(value) : undefined}
      onChange={handleChange}
      options={options}
      loading={list.isFetching || (selReady && selected.isLoading)}
      showSearch
      onSearch={def?.serverSearch ? setTerm : undefined}
      filterOption={def?.serverSearch ? false : (input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
      notFoundContent={list.isFetching ? 'Searching…' : undefined}
      allowClear={allowClear}
      optionFilterProp="label"
    />
  )
}
