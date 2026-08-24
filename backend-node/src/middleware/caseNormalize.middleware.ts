import { Request, Response, NextFunction } from 'express'
import { Model } from 'sequelize'

/**
 * Casing bridge between the frontend and this backend.
 *
 * The frontend was written against the original FastAPI backend, so it speaks
 * snake_case on the wire: query params (`target_kind`, `sort_by`), request bodies
 * (`started_at`, `usage_remarks`) and response fields (`material_type`, `created_at`).
 * Sequelize models, by contrast, use camelCase attributes.
 *
 * Rather than rewrite every route, these two helpers translate at the edge:
 *  - `normalizeRequestCase` adds camelCase aliases for snake_case input keys, so
 *    handlers reading `req.body.targetKind` see a value sent as `target_kind`.
 *  - `snakeCaseResponse` converts outgoing JSON keys to snake_case.
 *
 * Both are additive/non-destructive: original keys are preserved, so a handler or
 * client using either style keeps working.
 */

export function snakeCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

export function camelCase(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
}

/**
 * Route prefixes whose responses must stay camelCase.
 *
 * The frontend is split by module: everything under src/api/ speaks snake_case EXCEPT
 * the ARD client (ard.ts, ard-projects.ts, ard-notebooks.ts, ard-uploads.ts), which
 * declares camelCase contracts throughout — e.g. ArdAtrForm's `formNo`, `assignedTl`,
 * `mandateCertification`. Converting those would break the whole ARD module.
 */
const CAMEL_CASE_PATH_PREFIXES = ['/api/ard']

export function keepsCamelCase(path: string): boolean {
  return CAMEL_CASE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/**
 * Keys the frontend declares in camelCase even on otherwise snake_case routes, so they
 * must survive conversion:
 *  - pageSize — ARD-style pagination wrappers (frontend/src/api/ard-projects.ts:98)
 *  - formNo/originModule — the ARD-shaped object returned by
 *    POST /api/cgt-experiments/:id/atr (cgt.ts:196)
 */
const PRESERVE_KEYS = new Set<string>([
  'pageSize',
  'formNo',
  'originModule',
])

// doneBy/checkedBy are ALSO used as plain Sequelize column names elsewhere
// (e.g. InvWorkOrderResult.doneBy on /api/inventory/work-orders), where they
// must convert to done_by/checked_by like every other field. Globally
// preserving them broke that. Scope the exception to just the ADC
// SectionSignature payload (experiments/notebooks routes, adc.ts:230-231)
// where the frontend genuinely expects camelCase doneBy/checkedBy.
const PATH_SCOPED_PRESERVE_KEYS = new Set<string>(['doneBy', 'checkedBy'])
const PATH_SCOPED_PRESERVE_PREFIXES = ['/api/experiments', '/api/notebooks']

function pathUsesScopedPreserve(path: string): boolean {
  return PATH_SCOPED_PRESERVE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

/**
 * Some fields hold an opaque JSON blob authored by a third-party library
 * (Univer's IWorkbookData) or by our own non-REST internal shape — their
 * inner keys are NOT a wire contract we control and must survive verbatim.
 * Deep-converting `workbook_data.sheets['sheet-01'].cellData` etc. to
 * `cell_data`/`row_count`/`sheet_order` silently produced a shape Univer's
 * `createWorkbook()` doesn't recognize: no error, just an empty grid,
 * because a spreadsheet worth of cell data was still "there" — just under
 * renamed keys nothing downstream was reading. Calc templates' `metadata`
 * (field/protected-range definitions, itself full of camelCase like
 * `sheetId`/`startRow`) has the same problem. Once matched, the key's VALUE
 * is passed through completely untouched — only the key name itself still
 * gets normalized.
 */
// Both casings are listed because the key arrives pre-cased differently
// depending on the source: convertXlsx's plain return object already uses
// `workbook_data` (snake_case at the source), while Sequelize model
// instances expose the same data as the camelCase `workbookData` attribute.
const OPAQUE_VALUE_KEYS = new Set<string>([
  'workbookData', 'workbook_data',
  'metadata',
  'fieldMetadata', 'field_metadata',
  'definition',
  // A builder-authored template definition, frozen onto the notebook/experiment
  // when it was created. Its inner keys are the template DSL the builder and the
  // runtime field controls share (`optionsMode`, `inventorySource`, `labelField`,
  // `autoFill`, `filterByField`, …) and the frontend reads them in camelCase
  // throughout (see admin/templateBuilder/types.ts). Converting them produced a
  // definition the runtime silently failed to understand: an inventory-backed
  // DROPDOWN arrived as `options_mode`/`inventory_source`, so CgtFieldControl
  // fell through to the plain-options branch, issued no query at all and
  // rendered an empty "No data" dropdown. The template builder's own preview
  // looked correct because it reads the live template over
  // /api/workflow-templates, which is already exempt here.
  'templateSnapshot', 'template_snapshot',
])
const PATH_SCOPED_OPAQUE_PREFIXES = [
  '/api/calc-templates',
  '/api/workflow-templates',
  // Serve the frozen template_snapshot: ADC notebooks/experiments (mounted at
  // /api by notebooks.routes + experiments.routes) and the CGT equivalents.
  '/api/notebooks',
  '/api/experiments',
  '/api/cgt-notebooks',
  '/api/cgt-experiments',
  '/api/cgt-projects',
]

function pathUsesOpaqueValues(path: string): boolean {
  return PATH_SCOPED_OPAQUE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)
}

/**
 * Deep-convert object keys to snake_case. Arrays are mapped element-wise. Dates,
 * Buffers and other class instances are returned untouched so they still serialise
 * the way `JSON.stringify` would.
 */
export function toSnakeCaseDeep(
  input: unknown,
  depth = 0,
  preserveKeys: Set<string> = PRESERVE_KEYS,
  opaqueValueKeys: Set<string> | null = null,
): unknown {
  if (depth > 12) return input
  if (Array.isArray(input)) return input.map((v) => toSnakeCaseDeep(v, depth + 1, preserveKeys, opaqueValueKeys))

  // Sequelize rows are class instances, not plain objects — flatten them (including
  // eager-loaded associations) before converting, or they would pass through untouched.
  if (input instanceof Model) {
    return toSnakeCaseDeep((input as Model).get({ plain: true }), depth + 1, preserveKeys, opaqueValueKeys)
  }
  if (!isPlainObject(input)) return input

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    // The key name itself is still normalized — only its VALUE's inner keys
    // are left alone (e.g. workbookData -> workbook_data, but the Univer
    // snapshot inside it keeps cellData/rowCount/sheetOrder verbatim).
    const isOpaque = opaqueValueKeys?.has(key)
    const converted = isOpaque ? value : toSnakeCaseDeep(value, depth + 1, preserveKeys, opaqueValueKeys)
    out[preserveKeys.has(key) ? key : snakeCase(key)] = converted
  }
  return out
}

/** Add camelCase aliases for snake_case keys, in place, without dropping originals. */
function addCamelAliases(target: Record<string, unknown>, depth = 0): void {
  if (depth > 12) return
  for (const key of Object.keys(target)) {
    const value = target[key]
    if (isPlainObject(value)) addCamelAliases(value, depth + 1)
    else if (Array.isArray(value)) {
      for (const el of value) if (isPlainObject(el)) addCamelAliases(el, depth + 1)
    }
    if (key.includes('_')) {
      const camel = camelCase(key)
      if (camel !== key && !(camel in target)) target[camel] = value
    }
  }
}

export function normalizeRequestCase(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.query && typeof req.query === 'object') {
      addCamelAliases(req.query as Record<string, unknown>)
    }
    if (req.body && isPlainObject(req.body)) {
      addCamelAliases(req.body as Record<string, unknown>)
    }
  } catch {
    // Never block a request over casing normalisation.
  }
  next()
}

export function snakeCaseResponse(req: Request, res: Response, next: NextFunction): void {
  // ARD routes serve a camelCase contract — leave their payloads untouched.
  if (keepsCamelCase(req.path)) { next(); return }

  const preserveKeys = pathUsesScopedPreserve(req.path)
    ? new Set([...PRESERVE_KEYS, ...PATH_SCOPED_PRESERVE_KEYS])
    : PRESERVE_KEYS
  const opaqueValueKeys = pathUsesOpaqueValues(req.path) ? OPAQUE_VALUE_KEYS : null

  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    try {
      return originalJson(toSnakeCaseDeep(body, 0, preserveKeys, opaqueValueKeys))
    } catch {
      return originalJson(body)
    }
  }) as Response['json']
  next()
}
