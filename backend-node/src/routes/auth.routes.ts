import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import {
  createAccessToken, createRefreshToken, decodeToken, isRefreshToken,
  hashPassword, verifyPassword, createPasswordResetToken, verifyPasswordResetToken, PasswordSchema,
} from '../utils/auth.utils'
import { successResponse } from '../utils/response'
import {
  UnauthorizedError, BadRequestError, NotFoundError,
} from '../utils/errors'
import { User } from '../models/User.model'
import { GlobalSettings } from '../models/GlobalSettings.model'
import { UserSecurityQuestion } from '../models/RolePrivilege.model'
import { Role } from '../models/Role.model'
import { Department } from '../models/Department.model'
import { Lab } from '../models/Lab.model'
import { sequelize } from '../database/connection'
import { resolveUserPrivileges } from '../shared/deptPrivileges'
import { resolveAdminPrivileges } from '../shared/privileges'

const router = Router()

const SECURITY_QUESTIONS = [
  { index: 0, text: "What was the name of your first pet?" },
  { index: 1, text: "What city were you born in?" },
  { index: 2, text: "What is your mother's maiden name?" },
  { index: 3, text: "What was the name of your elementary school?" },
  { index: 4, text: "What was the make of your first car?" },
  { index: 5, text: "What is the name of the street you grew up on?" },
  { index: 6, text: "What was your childhood nickname?" },
  { index: 7, text: "What is the middle name of your oldest sibling?" },
]

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = z.object({
      username: z.string().min(1, 'Username is required.'),
      password: z.string().min(1, 'Password is required.'),
    }).parse(req.body)

    // Accept either username or email in the username field (matches FastAPI behaviour)
    const user = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] },
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' },
        { model: Lab, as: 'lab' },
      ],
    })

    const settings = await GlobalSettings.findOne() || { lockUserAfterXAttempts: 5, passwordExpiryDays: null }
    const maxAttempts = settings.lockUserAfterXAttempts ?? 5

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid username or password.')
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedError('Account is temporarily locked due to too many failed login attempts. Please try again later.')
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      const newCount = (user.failedLoginCount ?? 0) + 1
      const updates: Partial<User> = { failedLoginCount: newCount } as Partial<User>
      const justLocked = newCount >= maxAttempts
      if (justLocked) {
        updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000)
      }
      await user.update(updates)
      // The attempt that actually crosses the threshold must say so immediately —
      // otherwise the account silently locks (and keeps re-locking on every
      // failed attempt after) while the user only ever sees the same generic
      // "wrong password" message.
      if (justLocked) {
        throw new UnauthorizedError('Too many failed login attempts. Your account is now temporarily locked. Please try again later or contact your administrator.')
      }
      throw new UnauthorizedError('Invalid username or password.')
    }

    const role = user.role as Role | undefined
    if (!user.departmentId && role?.code !== 'SUPER_ADMIN' && role?.code !== 'DQA') {
      throw new UnauthorizedError('Your account has not been assigned to a department. Contact your administrator.')
    }

    // Reset failed count on success; bump tokenVersion to invalidate other sessions (BUG-2)
    const newTokenVersion = user.tokenVersion + 1
    const loginUpdates: Partial<User> = {
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: newTokenVersion,
    } as Partial<User>

    // Password expiry: force a reset once the current password is older than
    // the configured limit. Accounts created before password_changed_at
    // existed are backfilled to their created_at (see migration
    // 20260820000000-add-user-password-changed-at), so this never divides by
    // a null date.
    const expiryDays = settings.passwordExpiryDays
    if (expiryDays && user.passwordChangedAt) {
      const ageMs = Date.now() - user.passwordChangedAt.getTime()
      if (ageMs > expiryDays * 24 * 60 * 60 * 1000) {
        loginUpdates.mustResetPassword = true
      }
    }

    await user.update(loginUpdates)
    await user.reload()

    const accessToken = createAccessToken(user.id, user.tokenVersion)
    const refreshToken = createRefreshToken(user.id, user.tokenVersion)

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/refresh
// TODO: for full session security, persist refresh token hash per user in DB
// and invalidate explicitly on login. tokenVersion covers the common case for now.
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = z.object({
      refresh_token: z.string().min(1),
    }).parse(req.body)

    const payload = decodeToken(refresh_token)
    if (!payload || !isRefreshToken(payload)) {
      throw new UnauthorizedError('Invalid or expired refresh token.')
    }

    const user = await User.findByPk(payload.sub)
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive.')
    }

    // A password reset, unlock, or logout bumps tokenVersion — reject any
    // refresh token issued before that so it can't keep minting new access
    // tokens (see createRefreshToken).
    if (user.tokenVersion !== payload.ver) {
      throw new UnauthorizedError('Session has been invalidated. Please log in again.')
    }

    const role = await Role.findByPk(user.roleId || '')
    if (!user.departmentId && role?.code !== 'SUPER_ADMIN' && role?.code !== 'DQA') {
      throw new UnauthorizedError('Your account has not been assigned to a department. Contact your administrator.')
    }

    const accessToken = createAccessToken(user.id, user.tokenVersion)
    const newRefreshToken = createRefreshToken(user.id, user.tokenVersion)

    res.json({
      access_token: accessToken,
      refresh_token: newRefreshToken,
      token_type: 'bearer',
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.user!.update({ tokenVersion: req.user!.tokenVersion + 1 } as Partial<User>)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/verify-password
router.post('/verify-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body)
    const valid = await verifyPassword(password, req.user!.passwordHash)
    const role = req.user!.role as Role | undefined
    res.json(successResponse('Password verified.', {
      verified: valid,
      user_id: req.user!.id,
      username: req.user!.username,
      role_code: role?.code || null,
    }))
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!
    const role = user.role as Role | undefined
    const dept = user.department as Department | undefined
    const lab = user.lab as Lab | undefined

    // Fine-grained (department, role) operation grants — drives module UI gating.
    const privileges = await resolveUserPrivileges(user)
    const adminPrivileges = await resolveAdminPrivileges(user)
    const securityQuestionCount = await UserSecurityQuestion.count({ where: { userId: user.id } })
    const settings = await GlobalSettings.findOne()

    res.json(successResponse('User profile retrieved successfully.', {
      id: user.id,
      username: user.username,
      emp_no: user.empNo,
      email: user.email,
      is_active: user.isActive ?? true,
      privileges,
      admin_privileges: adminPrivileges,
      dashboard_reference: user.dashboardReference,
      must_reset_password: user.mustResetPassword,
      terms_accepted: !!user.termsAcceptedAt,
      has_security_questions: securityQuestionCount > 0,
      enable_security_questions: settings?.enableSecurityQuestions ?? true,
      allow_settings_update: user.allowSettingsUpdate,
      // Flat role fields (frontend expects role_code, role_name, role_id)
      role_id: role?.id ?? null,
      role_code: role?.code ?? null,
      role_name: role?.name ?? null,
      // Flat department fields
      department_id: dept?.id ?? null,
      department_code: dept?.code ?? null,
      department_name: dept?.name ?? null,
      // Nested objects kept for backwards-compat with other consumers
      role: role ? { id: role.id, code: role.code, name: role.name } : null,
      department: dept ? { id: dept.id, code: dept.code, name: dept.name } : null,
      lab: lab ? { id: lab.id, code: lab.code, name: lab.name } : null,
    }))
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/change-password — in-app password change (first-login or voluntary)
router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      old_password: z.string().optional(),
      new_password: PasswordSchema,
      security_answers: z.array(z.object({
        index: z.number().int(),
        answer: z.string().min(1),
      })).optional(),
    }).parse(req.body)

    const user = req.user!
    let verified = false

    if (body.old_password) {
      verified = await verifyPassword(body.old_password, user.passwordHash)
      if (!verified) throw new BadRequestError('Current password is incorrect.', 'WRONG_PASSWORD')
    } else if (body.security_answers?.length) {
      const savedQuestions = await UserSecurityQuestion.findAll({ where: { userId: user.id } })
      if (savedQuestions.length === 0) {
        throw new BadRequestError('No security questions configured for this account.', 'NO_SECURITY_QUESTIONS')
      }
      for (const ans of body.security_answers) {
        const saved = savedQuestions.find(q => q.questionIndex === ans.index)
        if (!saved) throw new BadRequestError('Invalid security question.', 'INVALID_QUESTION')
        const match = await verifyPassword(ans.answer.toLowerCase().trim(), saved.answerHash)
        if (!match) throw new BadRequestError('Security answer is incorrect.', 'WRONG_ANSWER')
      }
      verified = true
    } else {
      throw new BadRequestError('Provide current password or security question answers.', 'VERIFICATION_REQUIRED')
    }

    const hashed = await hashPassword(body.new_password)
    await user.update({
      passwordHash: hashed,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
      tokenVersion: user.tokenVersion + 1,
    } as Partial<User>)
    await user.reload()

    const accessToken = createAccessToken(user.id, user.tokenVersion)
    const refreshToken = createRefreshToken(user.id, user.tokenVersion)

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/accept-terms — record T&C acceptance during first-login flow
router.post('/accept-terms', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    z.object({ accepted: z.literal(true) }).parse(req.body)
    await req.user!.update({ termsAcceptedAt: new Date() } as Partial<User>)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/security-questions
router.get('/security-questions', (_req: Request, res: Response) => {
  res.json(successResponse('Security questions retrieved successfully.', {
    questions: SECURITY_QUESTIONS,
  }))
})

// POST /api/auth/me/security-questions
router.post('/me/security-questions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { questions } = z.object({
      questions: z.array(z.object({
        index: z.number().int().min(0).max(7),
        answer: z.string().min(1),
      })).min(1),
    }).parse(req.body)

    const t = await sequelize.transaction()
    try {
      // Delete existing and re-insert
      await UserSecurityQuestion.destroy({ where: { userId: req.user!.id }, transaction: t })
      for (const q of questions) {
        await UserSecurityQuestion.create({
          userId: req.user!.id,
          questionIndex: q.index,
          answerHash: await hashPassword(q.answer.toLowerCase().trim()),
        }, { transaction: t })
      }
      await t.commit()
    } catch (err) {
      await t.rollback()
      throw err
    }

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/forgot-password/verify
router.post('/forgot-password/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, answers } = z.object({
      username: z.string().min(1),
      answers: z.array(z.object({
        index: z.number().int(),
        answer: z.string().min(1),
      })).min(1),
    }).parse(req.body)

    const user = await User.findOne({ where: { [Op.or]: [{ username }, { email: username }], isActive: true } })
    if (!user) throw new BadRequestError('Could not verify identity with the provided information.', 'VERIFICATION_FAILED')

    const savedQuestions = await UserSecurityQuestion.findAll({ where: { userId: user.id } })
    if (savedQuestions.length === 0) {
      throw new BadRequestError('No security questions configured for this account.', 'NO_SECURITY_QUESTIONS')
    }

    for (const ans of answers) {
      const saved = savedQuestions.find(q => q.questionIndex === ans.index)
      if (!saved) throw new BadRequestError('Invalid security question.', 'INVALID_QUESTION')
      const match = await verifyPassword(ans.answer.toLowerCase().trim(), saved.answerHash)
      if (!match) throw new BadRequestError('Security answer is incorrect.', 'WRONG_ANSWER')
    }

    const resetToken = createPasswordResetToken(user.id)
    res.json(successResponse('Identity verified successfully.', { resetToken }))
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/forgot-password/reset
router.post('/forgot-password/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resetToken, newPassword } = z.object({
      resetToken: z.string().min(1),
      newPassword: PasswordSchema,
    }).parse(req.body)

    const userId = verifyPasswordResetToken(resetToken)
    if (!userId) throw new BadRequestError('Invalid or expired reset token.', 'INVALID_RESET_TOKEN')

    const user = await User.findByPk(userId)
    if (!user) throw new NotFoundError('User')

    const hashed = await hashPassword(newPassword)
    await user.update({
      passwordHash: hashed,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
      tokenVersion: user.tokenVersion + 1,
    } as Partial<User>)

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
