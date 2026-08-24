import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError } from '../utils/errors'
import { hashPassword } from '../utils/auth.utils'
import { LoginIssueRequest } from '../models/LoginIssueRequest.model'
import { User } from '../models/User.model'
import { Department } from '../models/Department.model'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

const DEFAULT_PASSWORD = 'Password@123'

const SubmitSchema = z.object({
  username: z.string().min(1),
  issue_type: z.enum(['UNLOCK', 'PASSWORD_RESET']),
  description: z.string().max(2000).optional().nullable(),
})

// POST /api/login-issues — PUBLIC, unauthenticated (a locked-out user can't
// log in to reach anything behind `authenticate`). Only accepted if the
// username matches a real, active account — avoids the queue filling with
// junk/spam while still not requiring the user to prove identity beyond that.
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SubmitSchema.parse(req.body)
    const user = await User.findOne({ where: { username: body.username } })
    if (!user || !user.isActive) {
      throw new BadRequestError('No active account matches that username.', 'UNKNOWN_USERNAME')
    }

    const request = await LoginIssueRequest.create({
      username: body.username,
      userId: user.id,
      issueType: body.issue_type,
      description: body.description || null,
      status: 'PENDING',
    })

    res.status(201).json(successResponse('Request submitted. An administrator will review it shortly.', {
      id: request.id,
    }))
  } catch (err) {
    next(err)
  }
})

// GET /api/login-issues?status=PENDING — admin queue, joined with the user's
// current display info and lock status so the dashboard can show both.
router.get('/', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const rows = await LoginIssueRequest.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'displayName', 'designation', 'isActive', 'lockedUntil'], include: [{ model: Department, as: 'department', attributes: ['name'] }] },
        { model: User, as: 'resolver', attributes: ['id', 'displayName', 'username'] },
      ],
      order: [['createdAt', 'DESC']],
    })

    res.json(listResponse('Login issue requests retrieved successfully.', rows.map((r: any) => {
      const u = r.user
      return {
        id: r.id,
        username: r.username,
        display_name: u?.displayName ?? null,
        designation: u?.designation ?? null,
        department_name: u?.department?.name ?? null,
        is_locked: !!u?.lockedUntil && new Date(u.lockedUntil) > new Date(),
        issue_type: r.issueType,
        description: r.description,
        status: r.status,
        resolved_by: r.resolver?.displayName ?? r.resolver?.username ?? null,
        resolved_at: r.resolvedAt,
        created_at: r.createdAt,
      }
    }), buildPagination(1, Math.max(rows.length, 1), rows.length)))
  } catch (err) {
    next(err)
  }
})

// POST /api/login-issues/:id/resolve — performs the action the request asked
// for (unlock OR reset-to-default, matching its issue_type) and marks it
// resolved. The two underlying actions stay separate: a PASSWORD_RESET
// request never also clears a lock — if the account is also locked, the
// admin still needs a separate Unlock action.
router.post('/:id/resolve', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await LoginIssueRequest.findByPk(req.params.id as string)
    if (!request) throw new NotFoundError('Login issue request')
    if (request.status === 'RESOLVED') throw new BadRequestError('This request has already been resolved.')

    const user = request.userId ? await User.findByPk(request.userId) : null
    if (!user) throw new NotFoundError('User')

    if (request.issueType === 'UNLOCK') {
      const wasLocked = !!user.lockedUntil
      await user.update({ failedLoginCount: 0, lockedUntil: null } as Partial<User>)
      await logAdminAudit({
        req, eventType: 'UPDATE', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
        details: wasLocked
          ? `Account unlocked by an administrator, resolving a user-submitted request.`
          : `Failed login count reset by an administrator (account was not locked), resolving a user-submitted request.`,
      })
    } else {
      const hashed = await hashPassword(DEFAULT_PASSWORD)
      await user.update({
        passwordHash: hashed,
        mustResetPassword: true,
        passwordChangedAt: new Date(),
        tokenVersion: user.tokenVersion + 1,
      } as Partial<User>)
      await logAdminAudit({
        req, eventType: 'RESET', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
        details: 'Password was reset to the default password by an administrator, resolving a user-submitted request.',
      })
    }

    await request.update({ status: 'RESOLVED', resolvedBy: req.user!.id, resolvedAt: new Date() })

    res.json(successResponse('Request resolved.', null))
  } catch (err) {
    next(err)
  }
})

export default router
