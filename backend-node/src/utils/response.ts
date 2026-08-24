export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

// The frontend API client (frontend/src/api/client.ts) returns res.json() directly
// with NO envelope unwrapping, matching the original FastAPI backend which returned
// bare payloads. These helpers therefore return the payload itself — `message` is
// kept in the signature so the ~55 existing call sites don't need to change, but it
// is intentionally not serialised.
export function successResponse<T>(_message: string, data: T, extra?: Record<string, unknown>) {
  if (extra && data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return { ...(data as Record<string, unknown>), ...extra }
  }
  return data
}

// FastAPI list endpoints returned {"items": [...], "total": N} — see
// backend/app/modules/inventory/materials.py:133. The frontend relies on this
// exact shape, e.g. apiGet<{items: Batch[]; total: number}>(...).then(r => r.items).
export function listResponse<T>(
  _message: string,
  items: T[],
  pagination: PaginationMeta,
) {
  // `pageSize` and `page_size` are both emitted because the frontend is inconsistent:
  // ARD types use pageSize (api/ard-projects.ts:98) while types.ts uses page_size.
  return {
    items,
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    pageSize: pagination.limit,
    page_size: pagination.limit,
  }
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) }
}

/**
 * True when the caller explicitly asked for a page.
 *
 * The master-data list routes historically returned a bare array and dozens of
 * dropdown call sites still rely on that shape, so they only switch to the
 * `{ items, total }` envelope when the caller opts in.
 *
 * A bare `limit` deliberately does NOT count: option pickers pass `limit` on
 * its own to cap how many rows they pull (see frontend
 * pages/admin/templateBuilder/inventorySources.ts and AtrRequestField.tsx),
 * and switching those to the envelope would break them. Paged callers always
 * send an offset (`skip`) or a page number alongside it.
 */
export function wantsPagination(query: Record<string, unknown>): boolean {
  return ['skip', 'page', 'pageSize', 'page_size'].some(
    (k) => query[k] !== undefined && query[k] !== null && String(query[k]) !== '',
  )
}

/**
 * `maxLimit` defaults to 500 rather than the original 200: option pickers ask for
 * `limit: 500` (PlannerPage/UsageLogsPage) and were being silently truncated to 200
 * with no signal to the caller. Routes that must stay tighter can pass their own.
 */
export function parsePagination(query: Record<string, unknown>, defaultLimit = 20, maxLimit = 500) {
  const requested = parseInt(String(query.limit ?? query.pageSize ?? query.page_size ?? defaultLimit), 10)
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(requested) ? requested : defaultLimit))

  // The frontend sends FastAPI-style `skip` (an absolute row offset). Prefer it when
  // present and derive `page` from it; fall back to `page` for any caller using that.
  if (query.skip !== undefined && query.skip !== null && String(query.skip) !== '') {
    const offset = Math.max(0, parseInt(String(query.skip), 10) || 0)
    return { page: Math.floor(offset / limit) + 1, limit, offset }
  }

  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1)
  return { page, limit, offset: (page - 1) * limit }
}

/**
 * Resolve a table's `sort_by`/`sort_dir` query params into a Sequelize `order`.
 *
 * The frontend sends the column's snake_case dataIndex (e.g. `part_code`), so
 * the value is camelised and checked against the model's real attributes —
 * an unknown column falls back to the list's default order rather than
 * throwing. Sorting has to be resolved server-side: a client comparator only
 * reorders the page it was given.
 */
export function parseSort(
  query: Record<string, unknown>,
  model: { getAttributes: () => Record<string, unknown> },
  fallback: [string, string][],
): [string, string][] {
  const raw = query.sortBy ?? query.sort_by
  if (!raw) return fallback
  const camel = String(raw).replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
  if (!(camel in model.getAttributes())) return fallback
  const dir = String(query.sortDir ?? query.sort_dir ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
  return [[camel, dir]]
}
