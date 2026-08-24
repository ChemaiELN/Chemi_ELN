/**
 * ARD role / scope helpers — port of backend/app/modules/ard/atr_rbac.py
 * Keep in lockstep with Python. Do not invent Node-only role names.
 */
import { ArdTeam } from '../models/index'

export const ARD_NATIVE_DEPT_CODES = new Set(['AD', 'ARD', 'QA'])
export const EXTERNAL_REQUESTER_DEPT_CODES = new Set(['ADC_PD', 'CGT'])

export function roleCode(user: any): string {
  return String(user?.role?.code || user?.role_code || '').toUpperCase()
}

export function deptCode(user: any): string {
  return String(user?.department?.code || user?.department_code || '').toUpperCase()
}

export function isAnalyst(user: any): boolean {
  return ['ANALYST', 'CHEMIST', 'CHEM'].includes(roleCode(user))
}

export function isTl(user: any): boolean {
  return ['TL', 'TEAM_LEAD'].includes(roleCode(user))
}

export function isHod(user: any): boolean {
  return ['HOD', 'HEAD_OF_DEPT', 'MANAGER'].includes(roleCode(user))
}

export function isQa(user: any): boolean {
  return deptCode(user) === 'QA' || ['QA', 'QA_OFFICER'].includes(roleCode(user))
}

export function isAdmin(user: any): boolean {
  return ['SUPER_ADMIN', 'ADMIN'].includes(roleCode(user))
}

export function isExternalRequester(user: any): boolean {
  return EXTERNAL_REQUESTER_DEPT_CODES.has(deptCode(user))
}

export function isDeptTl(user: any): boolean {
  return isTl(user) && isExternalRequester(user)
}

export function canReadAllAtrs(user: any): boolean {
  return isHod(user) || isAdmin(user) || isQa(user)
}

export function canReadAllTests(user: any): boolean {
  return isHod(user) || isAdmin(user) || isQa(user)
}

export function defaultAtrScope(user: any): 'team' | 'mine' | 'all' {
  if (isTl(user)) return 'team'
  if (isAnalyst(user)) return 'mine'
  return 'all'
}

/**
 * An ATR raised for a team is visible to the WHOLE team (its HOD, every TL
 * on it, and every analyst member) — not only the one TL it happens to be
 * assigned to. Returns the set of TL user ids covering every team the given
 * user belongs to (as HOD, TL, or member), so callers can match
 * `assignedTlId IN (...)`. Empty if the user isn't on any team, in which
 * case a caller should fall back to "only what I personally raised".
 */
export async function teammateTlIds(user: any): Promise<string[]> {
  const teams = await (ArdTeam as any).findAll({ where: { isActive: true } })
  const myTeams = (teams as any[]).filter((t: any) =>
    t.hodId === user.id ||
    (t.tlIds || []).includes(user.id) ||
    (t.memberIds || []).includes(user.id)
  )
  const ids = new Set<string>()
  for (const t of myTeams) {
    for (const tlId of (t as any).tlIds || []) ids.add(tlId)
  }
  return Array.from(ids)
}

/**
 * Analyst member ids across every team the given user belongs to (as HOD,
 * TL, or member) — used for broad visibility checks (e.g. "can I see this
 * test") where any affiliation with the team should count.
 */
export async function teammateMemberIds(user: any): Promise<string[]> {
  const teams = await (ArdTeam as any).findAll({ where: { isActive: true } })
  const myTeams = (teams as any[]).filter((t: any) =>
    t.hodId === user.id ||
    (t.tlIds || []).includes(user.id) ||
    (t.memberIds || []).includes(user.id)
  )
  const ids = new Set<string>()
  for (const t of myTeams) {
    for (const memberId of (t as any).memberIds || []) ids.add(memberId)
  }
  return Array.from(ids)
}

/**
 * Analyst member ids across only the team(s) the given user actually LEADS
 * (as HOD or TL) — deliberately narrower than teammateMemberIds, which also
 * counts teams where the user is merely a plain member. A TL can be a plain
 * member of some other team they don't run (e.g. seconded onto it), and that
 * team's roster must not leak into "assign to an analyst" pickers scoped to
 * the team this person actually leads.
 */
export async function ledTeamMemberIds(user: any): Promise<string[]> {
  const teams = await (ArdTeam as any).findAll({ where: { isActive: true } })
  const ledTeams = (teams as any[]).filter((t: any) =>
    t.hodId === user.id || (t.tlIds || []).includes(user.id)
  )
  const ids = new Set<string>()
  for (const t of ledTeams) {
    for (const memberId of (t as any).memberIds || []) ids.add(memberId)
  }
  return Array.from(ids)
}

/** Tab query aliases used by ArdAtrsPage — must match Python _TAB_STATUSES. */
export const ATR_TAB_STATUSES: Record<string, string[]> = {
  qa_pre_approval: ['QA_PRE_APPROVAL'],
  in_lab: ['PARTIAL', 'IN_PROGRESS', 'PENDING_APPROVAL'],
  pending_certification: ['CERTIFICATION_REQUESTED'],
  certified: ['CERTIFIED'],
  queued: ['NEW'],
  unassigned: ['NEW'],
  verification_request: ['PENDING_APPROVAL'],
  enhancement: ['ENHANCEMENT_REQUESTED'],
  cert_rework: ['CERTIFICATION_REWORK'],
  pending_clarification: ['PENDING_CLARIFICATION'],
  method_dev: [],
}

/** ATR status machine — port of atr_rbac.ATR_TRANSITIONS. */
export const ATR_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SAVED', 'NEW', 'REQUESTED', 'QA_PRE_APPROVAL', 'WITHDRAWN'],
  SAVED: ['NEW', 'REQUESTED', 'QA_PRE_APPROVAL', 'WITHDRAWN'],
  REQUESTED: ['DEPT_TL_APPROVED', 'WITHDRAWN'],
  DEPT_TL_APPROVED: ['NEW', 'WITHDRAWN'],
  NEW: ['QA_PRE_APPROVAL', 'PENDING_CLARIFICATION', 'PARTIAL', 'REJECTED', 'WITHDRAWN'],
  QA_PRE_APPROVAL: ['NEW', 'PRE_APPROVAL_REWORK', 'WITHDRAWN'],
  PRE_APPROVAL_REWORK: ['QA_PRE_APPROVAL', 'SAVED'],
  PENDING_CLARIFICATION: ['CLARIFIED'],
  CLARIFIED: ['NEW', 'PARTIAL', 'PENDING_CLARIFICATION'],
  PARTIAL: ['PENDING_APPROVAL', 'APPROVED', 'PENDING_CLARIFICATION'],
  PENDING_APPROVAL: ['APPROVED'],
  APPROVED: ['VERIFIED', 'CERTIFICATION_REQUESTED'],
  VERIFIED: ['CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK', 'ACCEPTED', 'ENHANCEMENT_REQUESTED'],
  CERTIFICATION_REQUESTED: ['CERTIFIED', 'CERTIFICATION_REWORK'],
  CERTIFICATION_REWORK: ['CERTIFICATION_REQUESTED'],
  CERTIFIED: ['ENHANCEMENT_REQUESTED'],
  ACCEPTED: [],
  ENHANCEMENT_REQUESTED: ['PARTIAL', 'REJECTED'],
  REJECTED: ['SAVED', 'WITHDRAWN'],
  WITHDRAWN: [],
}
