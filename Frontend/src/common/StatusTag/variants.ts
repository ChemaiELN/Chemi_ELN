import styles from './styles.module.less'

export type StatusVariant =
  | 'success'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'approved'
  | 'submitted'
  | 'verified'
  | 'draft'
  | 'rejected'
  | 'processing'
  | 'pending'
  | 'critical'

/** Text colors aligned with StatusTag variant styles (projects table palette). */
export const VARIANT_COLORS: Record<StatusVariant, string> = {
  success:    '#15803d',
  warning:    '#b45309',
  info:       '#1d4ed8',
  neutral:    '#475569',
  approved:   '#047857',
  submitted:  '#0369a1',
  verified:   '#5aa3a1',
  draft:      '#57534e',
  rejected:   '#be123c',
  processing: '#0369a1',
  pending:    '#b45309',
  critical:   '#be123c',
}

/** Normalize API / UI status strings for lookup. */
export function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ')
}

const STATUS_VARIANT: Record<string, StatusVariant> = {
  // Projects
  ACTIVE: 'success',
  'ON HOLD': 'warning',
  COMPLETED: 'info',
  CANCELLED: 'neutral',

  // Milestones
  'NOT STARTED': 'neutral',
  'ON TRACK': 'success',
  'AT RISK': 'warning',
  DELAYED: 'rejected',

  // Experiments
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  UNLOCKED: 'warning',
  VOID: 'neutral',

  // Notebooks
  ARCHIVED: 'neutral',
  LOCKED: 'warning',
  CLOSED: 'neutral',

  ASSIGNED: 'processing',
  'VERIFICATION REQUESTED': 'submitted',
  REWORK: 'warning',
  INPROGRESS: 'processing',
  OPEN: 'info',

  // ATR
  NEW: 'neutral',

  // Unlock / activity
  PENDING: 'pending',
  REVISED: 'warning',
  SAVED: 'neutral',
  DENIED: 'rejected',
  REVOKED: 'neutral',

  // Inventory — batches
  AVAILABLE: 'success',
  'PARTIALLY CONSUMED': 'info',
  CONSUMED: 'neutral',
  EXPIRED: 'rejected',
  QUARANTINE: 'warning',

  // Inventory — stock requests
  FULFILLED: 'success',

  // Inventory — schedules / assets
  DUE: 'warning',
  'IN PROGRESS': 'processing',
  'PENDING CLARIFICATION': 'warning',
  INACTIVE: 'neutral',
  'UNDER MAINTENANCE': 'warning',
  'UNDER CALIBRATION': 'warning',
  DECOMMISSIONED: 'rejected',
  EXHAUSTED: 'rejected',
  OK: 'success',
  OVERDUE: 'critical',

  // Priority
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'warning',
  CRITICAL: 'critical',
}

const STATUS_LABEL: Record<string, string> = {
  'ON HOLD': 'On Hold',
  'NOT STARTED': 'Not Started',
  'ON TRACK': 'On Track',
  'AT RISK': 'At Risk',
  'IN PROGRESS': 'In Progress',
  'PENDING CLARIFICATION': 'Pending Clarification',
  'PARTIALLY CONSUMED': 'Part. Consumed',
  'UNDER MAINTENANCE': 'Under Maint.',
  'UNDER CALIBRATION': 'Under Calib.',
  DECOMMISSIONED: 'Decomm.',
}

export function resolveStatusVariant(status: string): StatusVariant {
  const key = normalizeStatus(status)
  return STATUS_VARIANT[key] ?? 'neutral'
}

export function statusVariantClass(variant: StatusVariant): string {
  return styles[variant]
}

export function formatStatusLabel(status: string, label?: string): string {
  if (label) return label
  const key = normalizeStatus(status)
  if (STATUS_LABEL[key]) return STATUS_LABEL[key]
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, ch => ch.toUpperCase())
}
