/**
 * Phase 1A — Users admin API
 */
import request from 'supertest'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import { cleanupPhase1Fixtures, seedMinimalAdmin } from '../helpers/seed.helper'

const SUFFIX = Date.now().toString(36).slice(-6)

describe('Phase 1A — Users', () => {
  let adminToken: string
  let noprivToken: string
  let createdUserId: string

  beforeAll(async () => {
    await seedMinimalAdmin()
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')
  })

  afterAll(async () => {
    await cleanupPhase1Fixtures()
  })

  it('GET /api/users admin → 200 + items', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/users no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/users no token → 401', async () => {
    const res = await request(app).get('/api/users')
    expect(res.status).toBe(401)
  })

  it('GET /api/users/lookup → 200 array', async () => {
    const res = await request(app)
      .get('/api/users/lookup')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('POST /api/users valid → 201', async () => {
    const username = `test_p1_u_${SUFFIX}`
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        email: `${username}@test.local`,
        title: 'Mr',
        first_name: 'Phase',
        last_name: 'One',
        display_name: `P1 User ${SUFFIX}`,
        designation: 'Analyst',
      })
    expect(res.status).toBe(201)
    expect(res.body.username).toBe(username)
    createdUserId = res.body.id
  })

  it('POST /api/users duplicate username → 409', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: `test_p1_u_${SUFFIX}`,
        title: 'Mr',
        first_name: 'Dup',
        last_name: 'User',
        display_name: `P1 Dup ${SUFFIX}`,
        designation: 'Analyst',
      })
    expect(res.status).toBe(409)
  })

  it('POST /api/users missing fields → 422', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: `test_p1_bad_${SUFFIX}` })
    expect(res.status).toBe(422)
  })

  it('GET /api/users/:id existing → 200', async () => {
    const res = await request(app)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(createdUserId)
  })

  it('GET /api/users/:id missing → 404', async () => {
    const res = await request(app)
      .get('/api/users/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /api/users/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `updated_${SUFFIX}@test.local`, first_name: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.first_name).toBe('Updated')
  })

  it('GET job-description without file → 404', async () => {
    const res = await request(app)
      .get(`/api/users/${createdUserId}/job-description`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('POST reset-password → 204', async () => {
    const res = await request(app)
      .post(`/api/users/${createdUserId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'ResetPass@1' })
    expect(res.status).toBe(204)
  })

  it('POST reset-to-default → 204', async () => {
    const res = await request(app)
      .post(`/api/users/${createdUserId}/reset-to-default`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('POST unlock → 204', async () => {
    const res = await request(app)
      .post(`/api/users/${createdUserId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('DELETE /api/users/:id → 204', async () => {
    const res = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('DELETE /api/users/:id missing → 404', async () => {
    const res = await request(app)
      .delete('/api/users/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })
})
