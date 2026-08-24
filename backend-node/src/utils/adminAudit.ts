import { Request } from 'express'
import { AdminAuditTrail } from '../models/AdminAuditTrail.model'

// Field names whose values must never be written to the audit trail, in
// either old_value or new_value — only the fact that they changed is logged.
const SENSITIVE_FIELDS = new Set([
  'password', 'passwordHash', 'newPassword', 'new_password',
  'token', 'tokenVersion', 'accessToken', 'refreshToken',
  'smtpPassword', 'smtp_password',
])

const REDACTED = '[REDACTED]'

function redact(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_FIELDS.has(k) ? REDACTED : v
  }
  return out
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'none'
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'none'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/**
 * Field-level diff summary, e.g. "role changed from Chemist to HOD;
 * is_active changed from true to false" — built from whichever keys are
 * present in either snapshot. Sensitive fields are redacted before
 * comparison so their old/new values never leak into the summary either.
 */
export function summarizeDiff(oldValue?: Record<string, unknown> | null, newValue?: Record<string, unknown> | null): string | null {
  const oldR = redact(oldValue)
  const newR = redact(newValue)
  if (!oldR && !newR) return null

  const keys = new Set([...Object.keys(oldR ?? {}), ...Object.keys(newR ?? {})])
  const changes: string[] = []
  for (const key of keys) {
    const before = oldR?.[key]
    const after = newR?.[key]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    changes.push(`${key} changed from ${formatValue(before)} to ${formatValue(after)}`)
  }
  return changes.length ? changes.join('; ') : null
}

interface LogAdminAuditOptions {
  req: Request
  eventType: 'CREATE' | 'UPDATE' | 'DELETE' | 'GRANT' | 'REVOKE' | 'RESET'
  entityType: string
  entityId?: string | number | null
  entityRef?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  details?: string | null
}

/**
 * Writes one Administration audit row. Never throws — a logging failure
 * must not fail the underlying admin action, so errors are swallowed after
 * being surfaced to the console.
 */
const EVENT_VERB: Record<LogAdminAuditOptions['eventType'], string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  GRANT: 'Granted',
  REVOKE: 'Revoked',
  RESET: 'Reset',
}

export async function logAdminAudit(opts: LogAdminAuditOptions): Promise<void> {
  try {
    const performedBy = opts.req.user?.displayName || opts.req.user?.username || 'unknown'
    const oldR = redact(opts.oldValue)
    const newR = redact(opts.newValue)
    const label = opts.entityRef ? `${opts.entityType} "${opts.entityRef}"` : opts.entityType
    const details = opts.details
      ?? summarizeDiff(opts.oldValue, opts.newValue)
      ?? `${EVENT_VERB[opts.eventType]} ${label}`
    await AdminAuditTrail.create({
      eventType: opts.eventType,
      entityType: opts.entityType,
      entityId: opts.entityId != null ? String(opts.entityId) : null,
      entityRef: opts.entityRef ?? null,
      performedBy,
      oldValue: oldR ? JSON.stringify(oldR) : null,
      newValue: newR ? JSON.stringify(newR) : null,
      details,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write admin audit trail entry', err)
  }
}
