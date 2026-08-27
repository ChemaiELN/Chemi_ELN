/**
 * Phase 2C — ADC Experiments (core CRUD + workflow; skip PDF/ATR/upload happy paths)
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase2Fixtures,
  ensureAdcPdDepartment,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 2C — Experiments', () => {
  let adminToken: string
  let noprivToken: string
  let adminUserId: string
  let notebookId: string
  let experimentId: string
  let rejectExperimentId: string

  beforeAll(async () => {
    await ensureAdcPdDepartment()
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')

    const project = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 Exp Parent ${SUFFIX}` })
    expect(project.status).toBe(201)

    const notebook = await request(app)
      .post(`/api/projects/${project.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Exp Notebook ${SUFFIX}` })
    expect(notebook.status).toBe(201)
    notebookId = notebook.body.id
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('GET /api/experiments → 200', async () => {
    const res = await request(app)
      .get('/api/experiments')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/experiments no privilege → 403', async () => {
    const res = await request(app)
      .get('/api/experiments')
      .set('Authorization', `Bearer ${noprivToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /api/experiments/my-stats → 200', async () => {
    const res = await request(app)
      .get('/api/experiments/my-stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/notebooks/:id/experiments → 200', async () => {
    const res = await request(app)
      .get(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/notebooks/:id/experiments → 201', async () => {
    const res = await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Experiment ${SUFFIX}` })
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('DRAFT')
    experimentId = res.body.id
  })

  it('GET /api/experiments/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(experimentId)
  })

  it('PATCH /api/experiments/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/experiments/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Experiment Updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('GET assigned-users → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/assigned-users`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST assign-user → 201 or 200', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/assign-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: adminUserId })
    expect([200, 201]).toContain(res.status)
  })

  it('DELETE unassign → 204', async () => {
    const res = await request(app)
      .delete(`/api/experiments/${experimentId}/unassign/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('POST submit → 200', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('SUBMITTED')
  })

  it('POST submit again → 400', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })

  it('POST approve → 200', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('APPROVED')
  })

  it('POST reviews → 201', async () => {
    // Route has no status guard — works on APPROVED (before unlock below)
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewer_id: adminUserId })
    expect(res.status).toBe(201)
    expect(res.body.reviewer_id ?? res.body.reviewerId).toBe(adminUserId)
  })

  it('POST reviews/:reviewerId/sign → 200', async () => {
    // :reviewerId is the reviewer's user UUID, not ExperimentReview.id (experiments.routes.ts:778-779)
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/reviews/${adminUserId}/sign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'APPROVE', reason: 'phase2 review' })
    expect(res.status).toBe(200)
  })

  it('POST unlock → 200', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('UNLOCKED')
  })

  it('POST clone → 201', async () => {
    const res = await request(app)
      .post(`/api/experiments/${experimentId}/clone`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.id).not.toBe(experimentId)
  })

  it('POST scientist-sign → 200', async () => {
    const draft = await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Sign Exp ${SUFFIX}` })
    expect(draft.status).toBe(201)

    const res = await request(app)
      .post(`/api/experiments/${draft.body.id}/scientist-sign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'signed in phase2' })
    expect(res.status).toBe(200)
  })

  it('POST reject missing reason → 422', async () => {
    const draft = await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Reject Exp ${SUFFIX}` })
    expect(draft.status).toBe(201)

    await request(app)
      .post(`/api/experiments/${draft.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    rejectExperimentId = draft.body.id

    const res = await request(app)
      .post(`/api/experiments/${rejectExperimentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(422)
  })

  it('POST reject with reason → 200', async () => {
    const res = await request(app)
      .post(`/api/experiments/${rejectExperimentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'incomplete data' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('REJECTED')
  })

  it('POST void → 200', async () => {
    const draft = await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Void Exp ${SUFFIX}` })
    expect(draft.status).toBe(201)

    const res = await request(app)
      .post(`/api/experiments/${draft.body.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'obsolete' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('VOID')
  })

  it('GET files → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/files`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET reviews → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/reviews`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET history → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/history`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET atr-requests → 200', async () => {
    const res = await request(app)
      .get(`/api/experiments/${experimentId}/atr-requests`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
