/**
 * Phase 0 — Auth foundation integration tests.
 * Matches actual API behaviour (Zod → 422, logout → 204, login → access_token).
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../../app'
import { config } from '../../config'
import { User } from '../../models/User.model'
import {
  TEST_ADMIN_PASSWORD,
  TEST_ADMIN_USERNAME,
  cleanupTestData,
  seedMinimalAdmin,
} from '../helpers/seed.helper'
import { getAdminToken, getTokenForUser } from '../helpers/auth.helper'

describe('Phase 0 — Auth', () => {
  let adminCreds: { username: string; password: string; userId: string }

  beforeAll(async () => {
    adminCreds = await seedMinimalAdmin()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe('POST /api/auth/login', () => {
    it('valid credentials → 200 + access_token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: adminCreds.username, password: adminCreds.password })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toEqual(expect.any(String))
      expect(res.body.refresh_token).toEqual(expect.any(String))
      expect(res.body.token_type).toBe('bearer')
    })

    it('wrong password → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: adminCreds.username, password: 'WrongPass@1' })

      expect(res.status).toBe(401)
      // Reset lock/fail counters so later tests are not affected
      await User.update(
        { failedLoginCount: 0, lockedUntil: null },
        { where: { id: adminCreds.userId } },
      )
    })

    it('missing username → 422', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: adminCreds.password })

      expect(res.status).toBe(422)
    })

    it('missing password → 422', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: adminCreds.username })

      expect(res.status).toBe(422)
    })

    it('non-existent user → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'no_such_user_phase0', password: 'Whatever@1' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    let token: string

    beforeAll(async () => {
      token = await getTokenForUser(adminCreds.username, adminCreds.password)
    })

    it('valid token → 200 + user object', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      // successResponse returns the payload flat (no { data: ... } envelope)
      expect(res.body).toMatchObject({
        id: adminCreds.userId,
        username: TEST_ADMIN_USERNAME,
        role_code: 'SUPER_ADMIN',
      })
      expect(res.body.data).toBeUndefined()
    })

    it('no token → 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('malformed token → 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-jwt')

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('valid token → 204 and invalidates session', async () => {
      const token = await getTokenForUser(adminCreds.username, adminCreds.password)
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(204)

      const me = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(me.status).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('valid refresh token → 200 + new tokens', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: adminCreds.username, password: adminCreds.password })
        .expect(200)

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: login.body.refresh_token })

      expect(res.status).toBe(200)
      expect(res.body.access_token).toEqual(expect.any(String))
      expect(res.body.refresh_token).toEqual(expect.any(String))
    })

    it('expired refresh token → 401', async () => {
      const expired = jwt.sign(
        { sub: adminCreds.userId, type: 'refresh', ver: 1 },
        config.jwt.secret,
        { expiresIn: '-1s' },
      )

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: expired })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/verify-password', () => {
    let token: string

    beforeAll(async () => {
      token = await getAdminToken()
    })

    it('correct password → 200 with verified true', async () => {
      const res = await request(app)
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: TEST_ADMIN_PASSWORD })

      expect(res.status).toBe(200)
      expect(res.body.verified).toBe(true)
    })

    it('wrong password → 200 with verified false', async () => {
      // API returns verified:false rather than 400 (see auth.routes.ts)
      const res = await request(app)
        .post('/api/auth/verify-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'WrongPass@1' })

      expect(res.status).toBe(200)
      expect(res.body.verified).toBe(false)
    })
  })

  describe('security questions + forgot-password', () => {
    let token: string

    beforeAll(async () => {
      token = await getAdminToken()
    })

    it('GET /api/auth/security-questions → 200 list', async () => {
      const res = await request(app).get('/api/auth/security-questions')
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.questions)).toBe(true)
      expect(res.body.questions.length).toBeGreaterThan(0)
    })

    it('POST /api/auth/me/security-questions → 204', async () => {
      const res = await request(app)
        .post('/api/auth/me/security-questions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questions: [
            { index: 0, answer: 'Fluffy' },
            { index: 1, answer: 'Hyderabad' },
          ],
        })

      expect(res.status).toBe(204)
    })

    it('POST /api/auth/forgot-password/verify wrong answer → 400', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/verify')
        .send({
          username: TEST_ADMIN_USERNAME,
          answers: [{ index: 0, answer: 'WrongAnswer' }],
        })

      expect(res.status).toBe(400)
    })

    it('POST /api/auth/forgot-password/verify valid answer → 200 + resetToken', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password/verify')
        .send({
          username: TEST_ADMIN_USERNAME,
          answers: [
            { index: 0, answer: 'Fluffy' },
            { index: 1, answer: 'Hyderabad' },
          ],
        })

      expect(res.status).toBe(200)
      expect(res.body.resetToken ?? res.body.reset_token).toEqual(expect.any(String))
    })

    it('POST /api/auth/forgot-password/reset → 204 and new password works', async () => {
      const verify = await request(app)
        .post('/api/auth/forgot-password/verify')
        .send({
          username: TEST_ADMIN_USERNAME,
          answers: [
            { index: 0, answer: 'Fluffy' },
            { index: 1, answer: 'Hyderabad' },
          ],
        })
        .expect(200)

      const resetToken = verify.body.resetToken ?? verify.body.reset_token
      const newPassword = 'NewAdmin@123'

      const reset = await request(app)
        .post('/api/auth/forgot-password/reset')
        .send({ resetToken, newPassword })

      expect(reset.status).toBe(204)

      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_ADMIN_USERNAME, password: newPassword })

      expect(login.status).toBe(200)
      expect(login.body.access_token).toEqual(expect.any(String))

      // Restore known password for any leftover assertions / cleanup clarity
      await seedMinimalAdmin({ password: TEST_ADMIN_PASSWORD, forcePassword: true })
    })
  })
})
