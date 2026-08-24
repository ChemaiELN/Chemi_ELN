import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { NotFoundError, ForbiddenError } from '../../utils/errors'
import {
  ArdTeam, ArdAnalystQualification, ArdTestRequest, ArdExperiment,
  ArdAuditLog, User, Role, Department,
} from '../../models/index'

const router = Router()

const ARD_DEPT_CODE = 'AD'
const LEAD_ROLES = new Set(['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN', 'QA'])

// GET /api/ard/team/users
router.get('/users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await User.findAll({
      where: { isActive: true },
      include: [
        { model: Role, as: 'role', attributes: ['code'], where: { code: { [Op.in]: ['HOD', 'TL', 'TEAM_LEAD', 'CHEM', 'ANALYST', 'SUPER_ADMIN'] } } },
        { model: Department, as: 'department', attributes: ['code'], where: { code: ARD_DEPT_CODE } },
      ],
      attributes: ['id', 'username', 'empNo', 'email'],
      order: [['username', 'ASC']],
    })
    const items = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      fullName: u.empNo || u.username,
      roleCode: (u.role as any)?.code,
      departmentCode: (u.department as any)?.code,
    }))
    res.json(successResponse('ARD users', { items }))
  } catch (err) { next(err) }
})

// GET /api/ard/team/directory
router.get('/directory', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await ArdTeam.findAll({ where: { isActive: true } as any, order: [['name', 'ASC']] })

    // Build user id→username map from all referenced user IDs
    const allUserIds = new Set<string>()
    teams.forEach((t: any) => {
      if (t.hodId) allUserIds.add(t.hodId)
      ;((t.tlIds as string[]) || []).forEach((id: string) => allUserIds.add(id))
      ;((t.memberIds as string[]) || []).forEach((id: string) => allUserIds.add(id))
    })
    const users = allUserIds.size > 0
      ? await User.findAll({ where: { id: { [Op.in]: [...allUserIds] } }, attributes: ['id', 'username'] })
      : []
    const uMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    const items = teams.map((t: any) => {
      const tlIds: string[] = (t.tlIds as string[]) || []
      const memberIds: string[] = (t.memberIds as string[]) || []
      const tlAnalystMap: Record<string, string[]> = (t.tlAnalystMap as any) || {}

      const tls = tlIds.map((tlId: string) => ({
        id: tlId,
        name: uMap[tlId] || tlId,
        analysts: (tlAnalystMap[tlId] || []).map((aId: string) => ({
          id: aId,
          name: uMap[aId] || aId,
          role: memberIds.includes(aId) ? 'ANALYST' : 'MEMBER',
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
    }).parse(req.body)

    const team = await ArdTeam.create({
      name: body.name,
      description: body.description || null,
      hodId: body.hodId || null,
      tlIds: body.tlIds || [],
      memberIds: body.memberIds || [],
      tlAnalystMap: {},
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
      qualMap[q.userId] = entries.map((e: any) => e.techniqueCode || e.technique || '').filter(Boolean)
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
