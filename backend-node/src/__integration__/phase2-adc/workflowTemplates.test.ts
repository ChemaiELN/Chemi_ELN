/**
 * Phase 2E — Workflow templates
 * Note: plan lists publish/clone — those routes do not exist; cover real CRUD only.
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase2Fixtures,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)
const SLUG = `test_p2_wf_${SUFFIX}`

describe('Phase 2E — Workflow templates', () => {
  let adminToken: string
  let noprivToken: string
  let templateId: string

  beforeAll(async () => {
    await seedMinimalAdmin()
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('GET /api/workflow-templates → 200', async () => {
    const res = await request(app)
      .get('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/workflow-templates → 201', async () => {
    const res = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `P2 WF ${SUFFIX}`,
        slug: SLUG,
        description: 'phase2',
        category: 'ADC_GENERAL',
      })
    expect(res.status).toBe(201)
    expect(res.body.slug).toBe(SLUG)
    templateId = res.body.id
  })

  it('POST duplicate slug → 409', async () => {
    const res = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 WF Dup ${SUFFIX}`, slug: SLUG })
    expect(res.status).toBe(409)
    expect(res.body.error?.code).toBe('CONFLICT')
  })

  it('POST missing name → 422', async () => {
    const res = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: `test_p2_wf_bad_${SUFFIX}` })
    expect(res.status).toBe(422)
  })

  it('POST no privilege → 403', async () => {
    const res = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${noprivToken}`)
      .send({ name: 'Nope', slug: `test_p2_wf_nopriv_${SUFFIX}` })
    expect(res.status).toBe(403)
  })

  it('GET /api/workflow-templates/:id → 200', async () => {
    const res = await request(app)
      .get(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(templateId)
  })

  it('PATCH /api/workflow-templates/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: `updated ${SUFFIX}` })
    expect(res.status).toBe(200)
  })

  it('DELETE /api/workflow-templates/:id → 204', async () => {
    const res = await request(app)
      .delete(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  it('GET deleted template → is_active false', async () => {
    const res = await request(app)
      .get(`/api/workflow-templates/${templateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.is_active).toBe(false)
  })
})
