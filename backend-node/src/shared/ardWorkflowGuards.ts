export const ATR_TO_PARTIAL_ENTRY_STATUSES = ['NEW', 'SAVED', 'CLARIFIED', 'DRAFT'] as const

export const ATR_PENDING_APPROVAL_DONE_TEST_STATUSES = [
  'VERIFIED',
  'ACCEPTED',
  'FAILED',
  'UNSATISFACTORY',
  'REJECTED',
] as const

export const ATR_CERT_COMPLETED_TEST_STATUSES = [
  'ACCEPTED',
  'UNSATISFACTORY',
  'PUBLISHED',
  'WITHDRAWN',
  'CANCELLED',
] as const

export const CERTIFICATION_INCOMPLETE_TEST_STATUSES = [
  'UNASSIGNED',
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'VERIFICATION_REQUESTED',
  'VERIFICATION_REWORK',
  'UNLOCKED',
] as const

export function normalizeAtrTransitionAction(payload: {
  action?: string
  to?: string
}): string | undefined {
  if (payload.action && payload.action.trim()) return payload.action.trim()
  if (payload.to && payload.to.trim()) return payload.to.trim()
  return undefined
}

export function shouldMoveAtrToPartialOnTestStart(currentStatus: string | undefined): boolean {
  return ATR_TO_PARTIAL_ENTRY_STATUSES.includes((currentStatus ?? '') as any)
}
