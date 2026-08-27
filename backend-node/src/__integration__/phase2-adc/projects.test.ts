/**
 * Phase 2A — ADC Projects
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase2Fixtures,
  ensureAdcPdDepartment,
  seedMinimalAdmin,
  TEST_ADMIN_PASSWORD,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 2A — Projects', () => {
  let adminToken: string
  let noprivToken: string
  let projectId: string
  let memberUserId: string
  let riskRowId: string

  beforeAll(async () => {
    await ensureAdcPdDepartment()
    const admin = await seedMinimalAdmin()
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')
    memberUserId = admin.userId
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('GET /api/projects → 200 + items', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/projects no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/projects/next-code → 200', async () => {
    const res = await request(app)
      .get('/api/projects/next-code')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/projects/hod-stats → 200', async () => {
    const res = await request(app)
      .get('/api/projects/hod-stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/projects → 201', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 Project ${SUFFIX}` })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe(`P2 Project ${SUFFIX}`)
    expect(res.body.status).toBe('ACTIVE')
    projectId = res.body.id
  })

  it('POST /api/projects missing name → 422', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'no name' })
    // Zod allows omit; Sequelize NOT NULL → ValidationError → 422 via error middleware
    expect(res.status).toBe(422)
  })

  it('GET /api/projects/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(projectId)
  })

  it('GET /api/projects/:id missing → 404', async () => {
    const res = await request(app)
      .get('/api/projects/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /api/projects/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: `P2 updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('POST close → 200', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CLOSED')
  })

  it('POST reopen → 200', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
  })

  it('GET members → 200', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST members → 201', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: memberUserId, role: 'SCIENTIST' })
    expect([200, 201]).toContain(res.status)
  })

  it('DELETE members → 204', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/members/${memberUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('GET attachments → 200', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('PUT risk-assessment → 201 or 200', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/risk-assessment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Risk ${SUFFIX}`, description: 'phase2' })
    expect([200, 201]).toContain(res.status)
  })

  it('GET risk-assessment → 200', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/risk-assessment`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST risk-assessment/rows → 201', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/risk-assessment/rows`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        hazard: 'solvent',
        likelihood: 'medium',
        severity: 3,
        risk_level: 'medium',
        mitigation: 'PPE',
      })
    expect(res.status).toBe(201)
    expect(res.body.process_step).toBe('solvent')
    expect(res.body.failure_mode).toBe('medium')
    expect(res.body.severity).toBe(3)
    expect(res.body.detection).toBe(2)
    riskRowId = res.body.id
  })

  it('PATCH risk-assessment/rows/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/projects/${projectId}/risk-assessment/rows/${riskRowId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ severity: 4 })
    expect(res.status).toBe(200)
  })

  it('DELETE risk-assessment/rows/:id → 204', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/risk-assessment/rows/${riskRowId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('POST deactivate with active notebook → 400', async () => {
    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 Deact Block ${SUFFIX}` })
    expect(proj.status).toBe(201)

    const nb = await request(app)
      .post(`/api/projects/${proj.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Deact Block NB ${SUFFIX}` })
    expect(nb.status).toBe(201)

    const res = await request(app)
      .post(`/api/projects/${proj.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(400)
  })

  it('POST deactivate after notebooks deactivated → 200', async () => {
    const proj = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 Deact OK ${SUFFIX}` })
    expect(proj.status).toBe(201)

    const nb = await request(app)
      .post(`/api/projects/${proj.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Deact OK NB ${SUFFIX}` })
    expect(nb.status).toBe(201)

    await request(app)
      .post(`/api/notebooks/${nb.body.id}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Deact OK Exp ${SUFFIX}` })
      .expect(201)

    await request(app)
      .post(`/api/notebooks/${nb.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
      .expect(200)

    const res = await request(app)
      .post(`/api/projects/${proj.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('DEACTIVATED')
  })
})
