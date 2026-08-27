/**
 * Phase 4A — CGT Notebooks + Experiments
 * Paths: /api/cgt-notebooks, /api/cgt-experiments
 * Skip: PDF/DOCX, ATR, deactivate (irreversible freeze)
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

describe('Phase 4A — CGT Notebooks + Experiments', () => {
  let adminToken: string
  let noprivToken: string
  let adminUserId: string
  let projectId: string
  let notebookId: string
  let experimentId: string
  let rejectExperimentId: string

  beforeAll(async () => {
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')

    const project = await request(app)
      .post('/api/cgt-projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P4 NB Parent ${SUFFIX}`, manager_id: adminUserId })
    expect(project.status).toBe(201)
    projectId = project.body.id
  })

  afterAll(async () => {
    await cleanupPhase4Fixtures()
  })

  it('GET /api/cgt-notebooks → 200 + items', async () => {
    const res = await request(app)
      .get('/api/cgt-notebooks')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/cgt-notebooks no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/cgt-notebooks')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('POST /api/cgt-projects/:id/notebooks → 201', async () => {
    const res = await request(app)
      .post(`/api/cgt-projects/${projectId}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Notebook ${SUFFIX}` })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe(`P4 Notebook ${SUFFIX}`)
    notebookId = res.body.id
  })

  it('GET /api/cgt-notebooks/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/cgt-notebooks/${notebookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(notebookId)
  })

  it('PATCH /api/cgt-notebooks/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/cgt-notebooks/${notebookId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: `P4 nb updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('POST notebook close → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-notebooks/${notebookId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('CLOSED')
  })

  it('POST notebook reopen → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-notebooks/${notebookId}/reopen`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACTIVE')
  })

  it('POST assign-user → 201 or 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-notebooks/${notebookId}/assign-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: adminUserId })
    expect([200, 201]).toContain(res.status)
  })

  it('DELETE unassign → 200', async () => {
    const res = await request(app)
      .delete(`/api/cgt-notebooks/${notebookId}/unassign/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET template-snapshot → 200', async () => {
    const res = await request(app)
      .get(`/api/cgt-notebooks/${notebookId}/template-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/cgt-experiments → 200 + items', async () => {
    const res = await request(app)
      .get('/api/cgt-experiments')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
  })

  it('GET /api/cgt-experiments no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/cgt-experiments')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('POST /api/cgt-notebooks/:id/experiments → 201', async () => {
    const res = await request(app)
      .post(`/api/cgt-notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Experiment ${SUFFIX}` })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('DRAFT')
    experimentId = res.body.id
  })

  it('GET /api/cgt-experiments/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/cgt-experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(experimentId)
  })

  it('PATCH /api/cgt-experiments/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/cgt-experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Experiment Updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('POST assign experiment user → 201 or 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${experimentId}/assign-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: adminUserId })
    expect([200, 201]).toContain(res.status)
  })

  it('POST submit → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${experimentId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('SUBMITTED')
  })

  it('POST submit again → 400', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${experimentId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('POST approve → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${experimentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('APPROVED')
  })

  it('POST unlock → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${experimentId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('DRAFT')
  })

  it('POST reject missing reason → 400', async () => {
    const draft = await request(app)
      .post(`/api/cgt-notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Reject Exp ${SUFFIX}` })
    expect(draft.status).toBe(201)

    await request(app)
      .post(`/api/cgt-experiments/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    rejectExperimentId = draft.body.id

    const res = await request(app)
      .post(`/api/cgt-experiments/${rejectExperimentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST reject with reason → 200', async () => {
    const res = await request(app)
      .post(`/api/cgt-experiments/${rejectExperimentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'incomplete' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REJECTED')
  })

  it('GET my-dashboard → 200', async () => {
    const res = await request(app)
      .get('/api/cgt-experiments/my-dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
