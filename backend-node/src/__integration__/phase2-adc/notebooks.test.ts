/**
 * Phase 2B — ADC Notebooks
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

describe('Phase 2B — Notebooks', () => {
  let adminToken: string
  let noprivToken: string
  let adminUserId: string
  let projectId: string
  let notebookId: string

  beforeAll(async () => {
    await ensureAdcPdDepartment()
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')

    const project = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 NB Parent ${SUFFIX}` })
    expect(project.status).toBe(201)
    projectId = project.body.id
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('GET /api/notebooks → 200 + items', async () => {
    const res = await request(app)
      .get('/api/notebooks')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/notebooks no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/notebooks')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/notebooks/tl-stats → 200', async () => {
    const res = await request(app)
      .get('/api/notebooks/tl-stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/notebooks/tl-experiment-summary → 200', async () => {
    const res = await request(app)
      .get('/api/notebooks/tl-experiment-summary')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/projects/:id/notebooks → 200', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/projects/:id/notebooks → 201', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Notebook ${SUFFIX}` })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe(`P2 Notebook ${SUFFIX}`)
    notebookId = res.body.id
  })

  it('GET /api/notebooks/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/notebooks/${notebookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(notebookId)
  })

  it('PATCH /api/notebooks/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/notebooks/${notebookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: `P2 nb updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('POST close → 200', async () => {
    const res = await request(app)
      .post(`/api/notebooks/${notebookId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CLOSED')
  })

  it('POST reopen → 200', async () => {
    const res = await request(app)
      .post(`/api/notebooks/${notebookId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
  })

  it('GET template-snapshot → 200', async () => {
    const res = await request(app)
      .get(`/api/notebooks/${notebookId}/template-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET assigned-users → 200', async () => {
    const res = await request(app)
      .get(`/api/notebooks/${notebookId}/assigned-users`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST assign-user → 201 or 200', async () => {
    const res = await request(app)
      .post(`/api/notebooks/${notebookId}/assign-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: adminUserId })
    expect([200, 201]).toContain(res.status)
  })

  it('DELETE unassign → 204', async () => {
    const res = await request(app)
      .delete(`/api/notebooks/${notebookId}/unassign/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  // Product rule (notebooks.routes.ts:472-474): deactivate freezes all experiments —
  // an empty notebook has nothing to archive, so the route returns 400 by design.
  it('POST deactivate without experiments → 400', async () => {
    const emptyNb = await request(app)
      .post(`/api/projects/${projectId}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Empty NB ${SUFFIX}` })
    expect(emptyNb.status).toBe(201)

    const res = await request(app)
      .post(`/api/notebooks/${emptyNb.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(400)
  })

  it('POST deactivate with experiment → 200', async () => {
    await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Deact Exp ${SUFFIX}` })
      .expect(201)

    const res = await request(app)
      .post(`/api/notebooks/${notebookId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('DEACTIVATED')
  })
})
