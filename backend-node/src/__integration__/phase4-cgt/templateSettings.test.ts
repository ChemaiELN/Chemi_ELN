/**
 * Phase 4B — CGT / ADC Template Settings
 * Mount: /api/template-settings
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase4Fixtures,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)
const PROCESS_NAME = `P4 Process ${SUFFIX}`
const WF_SLUG = `test_p4_wf_${SUFFIX}`

describe('Phase 4B — Template settings', () => {
  let adminToken: string
  let noprivToken: string
  let processId: string
  let templateId: string

  beforeAll(async () => {
    await seedMinimalAdmin()
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')

    // CGT-category workflow template for process template assignment
    const wf = await request(app)
      .post('/api/workflow-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `P4 WF ${SUFFIX}`,
        slug: WF_SLUG,
        category: 'CGT_PLASMID',
        description: 'phase4',
      })
    expect(wf.status).toBe(201)
    templateId = wf.body.id
  })

  afterAll(async () => {
    await cleanupPhase4Fixtures()
  })

  it('GET /api/template-settings/cgt/processes → 200', async () => {
    const res = await request(app)
      .get('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST /api/template-settings/cgt/processes → 201', async () => {
    const res = await request(app)
      .post('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: PROCESS_NAME, sort_order: 1 })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe(PROCESS_NAME)
    processId = res.body.id
  })

  it('POST duplicate process name → 409', async () => {
    const res = await request(app)
      .post('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: PROCESS_NAME })
    expect(res.status).toBe(409)
    expect(res.body.error?.code).toBe('CONFLICT')
  })

  it('POST process no privilege → 403', async () => {
    const res = await request(app)
      .post('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${noprivToken}`)
      .send({ name: `P4 Forbidden ${SUFFIX}` })
    expect(res.status).toBe(403)
  })

  it('PATCH /api/template-settings/cgt/processes/:id → 200', async () => {
    const res = await request(app)
      .patch(`/api/template-settings/cgt/processes/${processId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sort_order: 2 })
    expect(res.status).toBe(200)
  })

  it('GET process templates → 200', async () => {
    const res = await request(app)
      .get(`/api/template-settings/cgt/processes/${processId}/templates`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('PUT process templates → 200', async () => {
    const res = await request(app)
      .put(`/api/template-settings/cgt/processes/${processId}/templates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_ids: [templateId] })
    expect(res.status).toBe(200)
  })

  it('GET process-templates by name → 200', async () => {
    const res = await request(app)
      .get('/api/template-settings/cgt/process-templates')
      .query({ process: PROCESS_NAME })
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/template-settings/adc/templates → 200', async () => {
    const res = await request(app)
      .get('/api/template-settings/adc/templates')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('GET /api/template-settings/adc/enabled → 200', async () => {
    const res = await request(app)
      .get('/api/template-settings/adc/enabled')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('PUT /api/template-settings/adc/templates → 200', async () => {
    // Round-trip currently-enabled IDs — do not send [] (clears shared ADC selections)
    const getRes = await request(app)
      .get('/api/template-settings/adc/templates')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(getRes.status).toBe(200)
    const list = Array.isArray(getRes.body) ? getRes.body : (getRes.body.items ?? [])
    const existingIds = list.filter((t: { enabled?: boolean }) => t.enabled).map((t: { id: string }) => t.id)

    const res = await request(app)
      .put('/api/template-settings/adc/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_ids: existingIds })
    expect(res.status).toBe(200)
    expect(res.body.template_ids).toEqual(existingIds)
  })

  it('DELETE process → 204', async () => {
    const res = await request(app)
      .delete(`/api/template-settings/cgt/processes/${processId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(204)
  })

  // No GET-by-id for processes; soft-delete verified via list (is_active stays in list)
  it('GET deleted process → is_active false', async () => {
    const res = await request(app)
      .get('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    const items = Array.isArray(res.body) ? res.body : (res.body.items ?? [])
    const deleted = items.find((p: { id: string }) => p.id === processId)
    expect(deleted).toBeDefined()
    expect(deleted.is_active).toBe(false)
  })
})
