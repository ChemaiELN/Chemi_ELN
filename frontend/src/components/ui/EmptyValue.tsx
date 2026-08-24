import type { ReactNode } from 'react'

/**
 * The project-wide "empty cell" placeholder. Was previously a hyphen/em-dash
 * ('—'), styled inconsistently across pages (slate-300/400/500/600, 12px/13px,
 * some unwrapped) — this is the single source of truth for both the text
 * ("NA") and its styling, for table cells and read-only detail fields alike.
 */
export const EMPTY_VALUE_TEXT = 'NA'

export function EmptyValue({ className }: { className?: string }) {
  return <span className={`text-[13px] text-slate-300 ${className ?? ''}`}>{EMPTY_VALUE_TEXT}</span>
}

/**
 * Renders `value` if present, otherwise the standard empty-cell placeholder.
 * Drop-in replacement for the old `value || <span ...>—</span>` / `value ?? '—'`
 * ternaries scattered across table column `render` functions.
 */
export function withEmptyValue(value: ReactNode, className?: string): ReactNode {
  if (value === null || value === undefined || value === '') return <EmptyValue className={className} />
  return value
}
