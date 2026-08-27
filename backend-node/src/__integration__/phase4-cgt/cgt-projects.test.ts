/**
 * Phase 4A — CGT Projects (real paths: /api/cgt-projects, not /api/cgt/projects)
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase4Fixtures,
  seedMinimalAdmin,
  TEST_ADMIN_PASSWORD,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 4A — CGT Projects', () => {
  let adminToken: string
  let noprivToken: string
  let adminUserId: string
  let projectId: string

  beforeAll(async () => {
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')
  })

  afterAll(async () => {
    await cleanupPhase4Fixtures()
  })

  it('GET /api/cgt-projects → 200 + items', async () => {
    const res = await request(app)
      .get('/api/cgt-projects')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/cgt-projects no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/cgt-projects')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/cgt-projects/next-code → 200', async () => {
    const res = await request(app)
      .get('/api/cgt-projects/next-code')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/cgt-projects/hod-dashboard-stats → 200', async () => {
    const res = await request(app)
      .get('/api/cgt-projects/hod-dashboard-stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/cgt-projects → 201', async () => {
    const res = await request(app)
      .post('/api/cgt-projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `P4 Project ${SUFFIX}`,
        manager_id: adminUserId,
        process: 'Molecular Biology',
      })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe(`P4 Project ${SUFFIX}`)
    expect(res.body.status).toBe('ACTIVE')
    projectId = res.body.id
  })

  it('POST /api/cgt-projects missing manager → 422', async () => {
    const res = await request(app)
      .post('/api/cgt-projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P4 Bad ${SUFFIX}` })
    expect(res.status).toBe(422)
  })

  it('GET /api/cgt-projects/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/cgt-projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(projectId)
  })

  it('GET /api/cgt-projects/:id missing → 404', async () => {
    const res = await request(app)
      .get('/api/cgt-projects/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /api/cgt-projects/:id → 200', async () => {
    // Route Zod field is 'title'; stored and returned as 'name' (cgt.routes.ts)
    const updatedName = `P4 Project Updated ${SUFFIX}`
    const res = await request(app)
      .patch(`/api/cgt-projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: updatedName, description: 'phase4' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe(updatedName)
  })

  it('POST close → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-projects/${projectId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CLOSED')
  })

  it('POST reopen → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-projects/${projectId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
  })

  it('GET /api/cgt-projects/:id/notebooks → 200', async () => {
    const res = await request(app)
      .get(`/api/cgt-projects/${projectId}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
