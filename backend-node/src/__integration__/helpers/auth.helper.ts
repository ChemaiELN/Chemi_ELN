/**
 * Shared auth helpers for integration tests.
 * Always obtains a fresh token via POST /api/auth/login (no caching).
 */
import request from 'supertest'
import app from '../../app'
import {
  seedMinimalAdmin,
  seedNoprivUser,
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  TEST_NOPRIV_PASSWORD,
  TEST_NOPRIV_USERNAME,
} from './seed.helper'

export async function getTokenForUser(username: string, password: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password })

  if (res.status !== 200) {
    throw new Error(
      `Login failed for "${username}" (${res.status}): ${JSON.stringify(res.body)}`,
    )
  }

  const token: string | undefined = res.body.access_token ?? res.body.accessToken
  if (!token) {
    throw new Error(`Login succeeded but no access_token in response: ${JSON.stringify(res.body)}`)
  }
  return token
}

export async function getAdminToken(): Promise<string> {
  await seedMinimalAdmin()
  return getTokenForUser(TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD)
}

export async function getUserToken(role: string): Promise<string> {
  const normalized = role.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN', 'TEST_SUPER_ADMIN'].includes(normalized)) {
    return getAdminToken()
  }
  if (['NOPRIV', 'NO_PRIV', 'TEST_NOPRIV', 'NONE'].includes(normalized)) {
    await seedNoprivUser()
    return getTokenForUser(TEST_NOPRIV_USERNAME, TEST_NOPRIV_PASSWORD)
  }
  throw new Error(
    `getUserToken("${role}") not available yet — seed that role in a later phase`,
  )
}
