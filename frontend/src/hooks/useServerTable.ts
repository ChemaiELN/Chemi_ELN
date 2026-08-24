import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { useDebouncedValue } from './useDebouncedValue'

/**
 * Server-side search, filtering, sorting and pagination for an AntD table.
 *
 * The master-data tables used to load every row and then search, sort and
 * paginate them in the browser. That is only correct while the table is small,
 * and it fails silently once it is not: search misses rows the request never
 * returned, and a column sorter reorders the visible page instead of the set.
 *
 * Everything here goes to the server as skip/limit/search/sort_by/sort_dir.
 * Bind the search box to `searchInput`, spread `tableProps` onto the table, and
 * call `reload()` after a create/update/delete.
 */
export function useServerTable<T>(
  fetcher: (params: Record<string, unknown>) => Promise<{ items: T[]; total: number }>,
  options: {
    /** Extra request params (filters). Memoise or keep primitive-valued. */
    filters?: Record<string, unknown>
    defaultPageSize?: number
  } = {},
) {
  const { filters, defaultPageSize = 10 } = options

  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 300)

  // Filters are usually a fresh object each render, so key the effect off their
  // contents rather than their identity.
  const filterKey = useMemo(() => JSON.stringify(filters ?? {}), [filters])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {
        ...JSON.parse(filterKey),
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }
      if (search.trim()) params.search = search.trim()
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await fetcher(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [fetcher, filterKey, page, pageSize, search, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  // A narrower result set can have fewer pages than the one being viewed.
  useEffect(() => { setPage(1) }, [filterKey, search])

  const tableProps = {
    dataSource: rows,
    loading,
    pagination: {
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      showTotal: (t: number) => `${t} records`,
    },
    onChange: (
      pagination: TablePaginationConfig,
      _filters: unknown,
      sorter: SorterResult<T> | SorterResult<T>[],
    ) => {
      if (pagination.current) setPage(pagination.current)
      if (pagination.pageSize) setPageSize(pagination.pageSize)
      const s = Array.isArray(sorter) ? sorter[0] : sorter
      if (s?.order) {
        setSortBy(s.field as string)
        setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
      } else {
        setSortBy(null)
      }
    },
  }

  return { rows, total, loading, reload: load, searchInput, setSearchInput, setPage, tableProps }
}
