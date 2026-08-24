import {
  ATR_CERT_COMPLETED_TEST_STATUSES,
  ATR_PENDING_APPROVAL_DONE_TEST_STATUSES,
  CERTIFICATION_INCOMPLETE_TEST_STATUSES,
  normalizeAtrTransitionAction,
  shouldMoveAtrToPartialOnTestStart,
} from '../shared/ardWorkflowGuards'

describe('normalizeAtrTransitionAction', () => {
  it('prefers action when both action and to are present', () => {
    expect(normalizeAtrTransitionAction({ action: 'NEW', to: 'QA_PRE_APPROVAL' })).toBe('NEW')
  })

  it('falls back to to for frontend payload compatibility', () => {
    expect(normalizeAtrTransitionAction({ to: 'NEW' })).toBe('NEW')
  })

  it('returns undefined when neither key exists', () => {
    expect(normalizeAtrTransitionAction({})).toBeUndefined()
  })
})

describe('ATR test-status guards', () => {
  it('moves ATR to PARTIAL only from pre-lab statuses', () => {
    expect(shouldMoveAtrToPartialOnTestStart('NEW')).toBe(true)
    expect(shouldMoveAtrToPartialOnTestStart('CLARIFIED')).toBe(true)
    expect(shouldMoveAtrToPartialOnTestStart('PARTIAL')).toBe(false)
    expect(shouldMoveAtrToPartialOnTestStart('CERTIFIED')).toBe(false)
  })

  it('keeps certification-incomplete list aligned with active test statuses', () => {
    expect(CERTIFICATION_INCOMPLETE_TEST_STATUSES).toContain('IN_PROGRESS')
    expect(CERTIFICATION_INCOMPLETE_TEST_STATUSES).toContain('ASSIGNED')
    expect(CERTIFICATION_INCOMPLETE_TEST_STATUSES).toContain('PENDING')
    expect(CERTIFICATION_INCOMPLETE_TEST_STATUSES).not.toContain('STARTED')
  })

  it('uses PARTIAL->PENDING_APPROVAL done states that include VERIFIED', () => {
    expect(ATR_PENDING_APPROVAL_DONE_TEST_STATUSES).toContain('VERIFIED')
    expect(ATR_PENDING_APPROVAL_DONE_TEST_STATUSES).toContain('ACCEPTED')
    expect(ATR_PENDING_APPROVAL_DONE_TEST_STATUSES).toContain('REJECTED')
  })

  it('uses strict completion states for certification request gate', () => {
    expect(ATR_CERT_COMPLETED_TEST_STATUSES).toContain('ACCEPTED')
    expect(ATR_CERT_COMPLETED_TEST_STATUSES).toContain('UNSATISFACTORY')
    expect(ATR_CERT_COMPLETED_TEST_STATUSES).toContain('WITHDRAWN')
    expect(ATR_CERT_COMPLETED_TEST_STATUSES).toContain('CANCELLED')
    expect(ATR_CERT_COMPLETED_TEST_STATUSES).not.toContain('VERIFIED')
  })
})
