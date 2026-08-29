import { Request, Response, NextFunction } from 'express'
import { decodeToken, isAccessToken } from '../utils/auth.utils'
import { UnauthorizedError } from '../utils/errors'
import { User } from '../models/User.model'
import { Role } from '../models/Role.model'
import { Department } from '../models/Department.model'
import { Lab } from '../models/Lab.model'

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No authentication token provided.')
    }

    const token = authHeader.slice(7)
    const payload = decodeToken(token)

    if (!payload || !isAccessToken(payload)) {
      throw new UnauthorizedError('Invalid or expired access token.')
    }

    const user = await User.findByPk(payload.sub, {
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' },
        { model: Lab, as: 'lab' },
      ],
    })

    if (!user) {
      throw new UnauthorizedError('User account not found.')
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated.')
    }

    if (user.tokenVersion !== payload.ver) {
      throw new UnauthorizedError('Session has been invalidated. Please log in again.')
    }

    // Department assignment is enforced at login/refresh — not here — so existing
    // in-flight sessions for edge-case accounts are not cut off mid-request.

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

// Optional auth — attaches user if token present, but does not fail if absent
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return next()

  try {
    const token = authHeader.slice(7)
    const payload = decodeToken(token)
    if (!payload || !isAccessToken(payload)) return next()

    const user = await User.findByPk(payload.sub, {
      include: [
        { model: Role, as: 'role' },
        { model: Department, as: 'department' },
      ],
    })
    if (user && user.isActive && user.tokenVersion === payload.ver) {
      req.user = user
    }
  } catch {
    // Swallow — optional
  }
  next()
}
