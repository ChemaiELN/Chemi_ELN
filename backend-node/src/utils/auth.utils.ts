import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config'

const SALT_ROUNDS = 12

// Server-side password strength rule — mirrors the client-side hint shown in
// UsersPage.tsx's reset-password form, but must be enforced here since the
// UI's own regex is trivially bypassed by calling the API directly.
export const PasswordSchema = z.string()
  .min(8, 'Password must be at least 8 characters.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/\d/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.')

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

interface AccessTokenPayload {
  sub: string
  type: 'access'
  ver: number
  exp?: number
}

interface RefreshTokenPayload {
  sub: string
  type: 'refresh'
  ver: number
  exp?: number
}

export function createAccessToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, type: 'access', ver: tokenVersion },
    config.jwt.secret,
    { expiresIn: `${config.jwt.accessExpireMinutes}m` },
  )
}

// Stamped with the same tokenVersion as the access token, so bumping
// tokenVersion (password reset, unlock, logout) invalidates outstanding
// refresh tokens too — otherwise a stolen refresh token could keep minting
// fresh access tokens after a reset.
export function createRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    { sub: userId, type: 'refresh', ver: tokenVersion },
    config.jwt.secret,
    { expiresIn: `${config.jwt.refreshExpireDays}d` },
  )
}

export function decodeToken(token: string): AccessTokenPayload | RefreshTokenPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as AccessTokenPayload | RefreshTokenPayload
  } catch {
    return null
  }
}

export function isAccessToken(payload: AccessTokenPayload | RefreshTokenPayload): payload is AccessTokenPayload {
  return payload.type === 'access'
}

export function isRefreshToken(payload: AccessTokenPayload | RefreshTokenPayload): payload is RefreshTokenPayload {
  return payload.type === 'refresh'
}

// 15-minute one-time reset token (signed JWT, not stored in DB)
export function createPasswordResetToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'password_reset' }, config.jwt.secret, { expiresIn: '15m' })
}

export function verifyPasswordResetToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret) as { sub: string; type: string }
    if (payload.type !== 'password_reset') return null
    return payload.sub
  } catch {
    return null
  }
}
