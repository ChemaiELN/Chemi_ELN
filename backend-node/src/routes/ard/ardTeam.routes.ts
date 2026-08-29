import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors'
import { qualificationActive } from '../../shared/ardQualifications'
import {
  ArdTeam, ArdAnalystQualification, ArdTestRequest, ArdExperiment,
  ArdAuditLog, User, Role, Department,
} from '../../models/index'

const router = Router()

const ARD_DEPT_CODES = ['AD', 'ARD']
// QA is included here (in addition to the ARD depts) so QA people are selectable
// as Team Members — a QA person can stand in when the HOD/Main TL is unavailable.
const TEAM_USER_DEPT_CODES = ['AD', 'ARD', 'QA']
const TEAM_USER_ROLES = ['HOD', 'HEAD_OF_DEPT', 'MANAGER', 'TL', 'TEAM_LEAD', 'CHEM', 'CHEMIST', 'ANALYST', 'SUPER_ADMIN']
const LEAD_ROLES = new Set(['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN', 'QA'])

// A person can be TL — primary (tlIds[0]) or secondary (tlIds[1+]) — of only
// ONE active team at a time. They can still be added as a plain member
// (memberIds) of any number of other teams; only holding a TL slot on more
// than one team is blocked.
async function assertTlIdsAvailable(tlIds: string[] | undefined, excludeTeamId?: string) {
  if (!tlIds || !tlIds.length) return
  const teams = await ArdTeam.findAll({ where: { isActive: true } as any })
  for (const tlId of tlIds) {
    const clash = teams.find((t: any) => {
      if (excludeTeamId && t.id === excludeTeamId) return false
      const ids: string[] = (t.tlIds as string[]) || []
      return ids.includes(tlId)
    })
    if (clash) {
      const user = await User.findByPk(tlId, { attributes: ['username'] })
      throw new ConflictError(
        `${user?.username || 'This user'} is already a Team Lead on "${(clash as any).name}". A Team Lead can lead only one team, but can still be added as a member of other teams.`
      )
    }
  }
}

async function assertTeamNameAvailable(name: string, excludeTeamId?: string) {
  const where: any = { name: { [Op.iLike]: name }, isActive: true }
  if (excludeTeamId) where.id = { [Op.ne]: excludeTeamId }
  const clash = await ArdTeam.findOne({ where })
  if (clash) {
    throw new ConflictError(`A team named "${name}" already exists.`)
  }
}

// GET /api/ard/team/users — Python list_team_users (team.py:23-50)
router.get('/users', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.findAll({
      where: { isActive: true },
      include: [
        { model: Role, as: 'role', attributes: ['code'], where: { code: { [Op.in]: TEAM_USER_ROLES } }, required: true },
        { model: Department, as: 'department', attributes: ['code'], where: { code: { [Op.in]: TEAM_USER_DEPT_CODES } }, required: true },
      ],
      attributes: ['id', 'username', 'empNo', 'email'],
      order: [['username', 'ASC']],
    })
    const items = users.map((u: any) => {
      const role_code = (u.role as any)?.code ?? null
      const department_code = (u.department as any)?.code ?? null
      return {
        id: u.id,
        username: u.username,
        full_name: u.username,
        role_code,
        department_code,
      }
    })
    res.json(successResponse('ARD users', { items }))
  } catch (err) { next(err) }
})

// GET /api/ard/team/directory
// Returns both active and inactive teams — the frontend has an active/inactive
// Switch per row (deactivate is a toggle, not a delete). Filtering this to
// isActive-only made a deactivated team disappear from the list entirely with
// no way left in the UI to find and reactivate it, which looked exactly like
// a delete even though the DELETE route only ever soft-deletes.
router.get('/directory', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await ArdTeam.findAll({ order: [['name', 'ASC']] })

    // Build user id→username map from all referenced user IDs. Must include
    // tlAnalystMap's values too, not just memberIds — an analyst can be
    // assigned under a TL there without also being duplicated into
    // memberIds, and missing them here silently rendered their raw UUID
    // instead of a username in the directory's per-TL analyst lists.
    const allUserIds = new Set<string>()
    teams.forEach((t: any) => {
      if (t.hodId) allUserIds.add(t.hodId)
      ;((t.tlIds as string[]) || []).forEach((id: string) => allUserIds.add(id))
      ;((t.memberIds as string[]) || []).forEach((id: string) => allUserIds.add(id))
      Object.values((t.tlAnalystMap as Record<string, string[]>) || {}).forEach((ids) => ids.forEach((id) => allUserIds.add(id)))
    })
    const users = allUserIds.size > 0
      ? await User.findAll({ where: { id: { [Op.in]: [...allUserIds] } }, attributes: ['id', 'username'] })
      : []
    const uMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    const items = teams.map((t: any) => {
      const tlIds: string[] = (t.tlIds as string[]) || []
      const memberIds: string[] = (t.memberIds as string[]) || []
      const tlAnalystMap: Record<string, string[]> = (t.tlAnalystMap as any) || {}
      const tlAnalystCanReview: Record<string, Record<string, boolean>> = (t.tlAnalystCanReview as any) || {}

      const tls = tlIds.map((tlId: string) => ({
        id: tlId,
        name: uMap[tlId] || tlId,
        analysts: (tlAnalystMap[tlId] || []).map((aId: string) => ({
          id: aId,
          name: uMap[aId] || aId,
          role: memberIds.includes(aId) ? 'ANALYST' : 'MEMBER',
          // Was never attached here — the frontend's "Can Review" toggle read
          // this field expecting it per-analyst, always got undefined, and
          // rendered OFF even right after a successful save (the save itself
          // worked; only the directory's re-hydration of the switch state
          // was missing it).
          canReview: !!tlAnalystCanReview[tlId]?.[aId],
        })),
      }))

      return {
        id: t.id,
        teamName: t.name,
        hodId: t.hodId || null,
        hodName: t.hodId ? (uMap[t.hodId] || '—') : '—',
        tlIds,
        tlNames: tlIds.map((id: string) => uMap[id] || id),
        tls,
        description: t.description || null,
        active: t.isActive,
        tlAnalystMap,
        tlAnalystCanReview: (t.tlAnalystCanReview as any) || {},
        memberIds,
      }
    })

    res.json(successResponse('Team directory', { items }))
  } catch (err) { next(err) }
})

// POST /api/ard/team/teams
router.post('/teams', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!LEAD_ROLES.has(rc)) throw new ForbiddenError('Insufficient permissions')

    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      hodId: z.string().uuid().optional(),
      tlIds: z.array(z.string().uuid()).optional(),
      memberIds: z.array(z.string().uuid()).optional(),
      tlAnalystMap: z.record(z.array(z.string().uuid())).optional(),
    }).parse(req.body)

    const tlIds = body.tlIds || []
    const memberIds = body.memberIds || []
    const tlAnalystMap = body.tlAnalystMap || (
      tlIds[0] && memberIds.length ? { [tlIds[0]]: memberIds } : {}
    )

    await assertTeamNameAvailable(body.name)
    await assertTlIdsAvailable(tlIds)

    const team = await ArdTeam.create({
      name: body.name,
      description: body.description || null,
      hodId: body.hodId || null,
      tlIds,
      memberIds,
      tlAnalystMap,
      tlAnalystCanReview: {},
      isActive: true,
      createdBy: user.id,
    } as any)

    res.status(201).json(successResponse('Team created', { id: team.id, name: team.name }))
  } catch (err) { next(err) }
})

// PUT /api/ard/team/teams/:teamId
router.put('/teams/:teamId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!LEAD_ROLES.has(rc)) throw new ForbiddenError('Insufficient permissions')

    const team = await ArdTeam.findByPk(req.params.teamId as string)
    if (!team) throw new NotFoundError('Team')

    const updates: any = { updatedAt: new Date() }
    const fields = ['name', 'description', 'hodId', 'tlIds', 'tlAnalystMap', 'isActive', 'tlAnalystCanReview', 'memberIds']
    fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

    if (updates.name !== undefined) {
      await assertTeamNameAvailable(updates.name, team.id)
    }
    if (updates.tlIds !== undefined) {
      await assertTlIdsAvailable(updates.tlIds, team.id)
    }

    await team.update(updates)
    res.json(successResponse('Team updated', { ok: true }))
  } catch (err) { next(err) }
})

// DELETE /api/ard/team/teams/:teamId (soft-delete)
router.delete('/teams/:teamId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!LEAD_ROLES.has(rc)) throw new ForbiddenError('Insufficient permissions')

    const team = await ArdTeam.findByPk(req.params.teamId as string)
    if (!team) throw new NotFoundError('Team')

    await team.update({ isActive: false })
    res.json(successResponse('Team deactivated', { ok: true }))
  } catch (err) { next(err) }
})

// GET /api/ard/team/workload
router.get('/workload', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analysts = await User.findAll({
      where: { isActive: true },
      include: [
        { model: Role, as: 'role', attributes: ['code'], where: { code: { [Op.in]: ['CHEM', 'ANALYST'] } } },
      ],
      attributes: ['id', 'username'],
    })

    const qualMap: Record<string, string[]> = {}
    const quals = await ArdAnalystQualification.findAll({ attributes: ['userId', 'techniqueEntries'] as any })
    quals.forEach((q: any) => {
      const entries: any[] = (q.techniqueEntries as any[]) || []
      qualMap[q.userId] = entries
        .filter((e: any) => qualificationActive(e))
        .map((e: any) => e.techniqueCode || e.technique || e.techniqueId || '')
        .filter(Boolean)
    })

    const tests = await ArdTestRequest.findAll({
      where: { assignedToId: { [Op.ne]: null } } as any,
      attributes: ['assignedToId', 'status'] as any,
    })
    const experiments = await ArdExperiment.findAll({
      where: { status: { [Op.notIn]: ['APPROVED', 'VERIFIED', 'DEACTIVATED'] } } as any,
      attributes: ['createdById', 'status'] as any,
    })

    const rows = analysts.map((u: any) => {
      const uid = u.id
      const myTests = tests.filter((t: any) => t.assignedToId === uid)
      const assigned = myTests.filter((t: any) => t.status === 'ASSIGNED').length
      const inProgress = myTests.filter((t: any) => t.status === 'IN_PROGRESS').length
      const pendingVerify = myTests.filter((t: any) => t.status === 'VERIFICATION_REQUESTED').length
      const rework = myTests.filter((t: any) => ['REWORK', 'VERIFICATION_REWORK'].includes(t.status)).length
      const exps = experiments.filter((e: any) => e.createdById === uid).length
      const total = assigned + inProgress + pendingVerify + rework + exps
      return { userId: uid, userName: u.username, techniques: qualMap[uid] || [], assigned, inProgress, pendingVerify, rework, experiments: exps, total }
    })

    rows.sort((a, b) => b.total - a.total)
    res.json(successResponse('Workload', { items: rows }))
  } catch (err) { next(err) }
})

// GET /api/ard/team/events
router.get('/events', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(100, parseInt((req.query as any).limit || '50', 10))
    const logs = await ArdAuditLog.findAll({
      where: { entityType: 'TEAM' },
      order: [['createdAt', 'DESC']],
      limit,
    })
    const userIds = [...new Set(logs.map((l: any) => l.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const uMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))
    const items = logs.map((l: any) => ({
      id: l.id,
      eventType: l.action,
      eventTime: l.createdAt,
      user: uMap[l.userId] || 'System',
      eventDetails: l.detail,
    }))
    res.json(successResponse('Team events', { items }))
  } catch (err) { next(err) }
})

export default router
