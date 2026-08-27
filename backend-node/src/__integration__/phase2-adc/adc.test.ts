/**
 * Phase 2D — ADC-specific routes (/api/adc/*)
 * Soft-tests side-effect AD submit/results; skips password-gated approve when esign may block.
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken } from '../helpers/auth.helper'
import {
  cleanupPhase2Fixtures,
  ensureAdcPdDepartment,
  seedMinimalAdmin,
  TEST_ADMIN_PASSWORD,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 2D — ADC routes', () => {
  let adminToken: string
  let notebookId: string
  let experimentId: string
  let riskItemId: number

  beforeAll(async () => {
    await ensureAdcPdDepartment()
    await seedMinimalAdmin()
    adminToken = await getAdminToken()

    const project = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 ADC Parent ${SUFFIX}` })
    expect(project.status).toBe(201)

    const notebook = await request(app)
      .post(`/api/projects/${project.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 ADC Notebook ${SUFFIX}` })
    expect(notebook.status).toBe(201)
    notebookId = notebook.body.id

    const experiment = await request(app)
      .post(`/api/notebooks/${notebook.body.id}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 ADC Experiment ${SUFFIX}` })
    expect(experiment.status).toBe(201)
    experimentId = experiment.body.id
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('PUT /api/adc/objective/:expId → 200', async () => {
    const res = await request(app)
      .put(`/api/adc/objective/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        study_purpose: 'phase2 purpose',
        hypothesis: 'phase2 hyp',
        success_criteria: 'pass',
      })
    expect(res.status).toBe(200)
  })

  it('GET /api/adc/objective/:expId → 200', async () => {
    const res = await request(app)
      .get(`/api/adc/objective/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.study_purpose).toBe('phase2 purpose')
  })

  it('PUT /api/adc/regulatory/:expId → 200', async () => {
    const res = await request(app)
      .put(`/api/adc/regulatory/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ oel_band: '1', containment_category: 'A', gmp_classification: 'GMP' })
    expect(res.status).toBe(200)
  })

  it('GET /api/adc/regulatory/:expId → 200', async () => {
    const res = await request(app)
      .get(`/api/adc/regulatory/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('PUT /api/adc/risk-assessment/:expId → 200', async () => {
    const res = await request(app)
      .put(`/api/adc/risk-assessment/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assessment_type: 'FMEA', overall_risk_level: 'medium', status: 'Draft' })
    expect(res.status).toBe(200)
  })

  it('GET /api/adc/risk-assessment/:expId → 200', async () => {
    const res = await request(app)
      .get(`/api/adc/risk-assessment/${experimentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('POST risk items → 201', async () => {
    const res = await request(app)
      .post(`/api/adc/risk-assessment/${experimentId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        process_step: 'mixing',
        failure_mode: 'spill',
        severity: 3,
        occurrence: 2,
        detection: 2,
        mitigation: 'containment',
      })
    expect(res.status).toBe(201)
    expect(res.body.process_step).toBe('mixing')
    expect(res.body.failure_mode).toBe('spill')
    riskItemId = res.body.id
  })

  it('GET risk items → 200', async () => {
    const res = await request(app)
      .get(`/api/adc/risk-assessment/${experimentId}/items`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('PUT risk item → 200', async () => {
    const res = await request(app)
      .put(`/api/adc/risk-assessment/${experimentId}/items/${riskItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ severity: 4 })
    expect(res.status).toBe(200)
  })

  it('DELETE risk item → 200 + deleted', async () => {
    const res = await request(app)
      .delete(`/api/adc/risk-assessment/${experimentId}/items/${riskItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.deleted).toBe(true)
  })

  it('POST submit-to-ad → 200', async () => {
    const res = await request(app)
      .post(`/api/adc/experiments/${experimentId}/submit-to-ad`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Submitted')
  })

  it('POST ad-results → 200', async () => {
    const res = await request(app)
      .post(`/api/adc/experiments/${experimentId}/ad-results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ result: 'pass', notes: 'phase2' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('AD_Reviewed')
  })

  it('POST ad-results missing result → 400', async () => {
    const fresh = await request(app)
      .post(`/api/notebooks/${notebookId}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 ADC Fresh ${SUFFIX}` })
    expect(fresh.status).toBe(201)

    await request(app)
      .put(`/api/adc/risk-assessment/${fresh.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assessment_type: 'FMEA', status: 'Draft' })
      .expect(200)

    await request(app)
      .post(`/api/adc/experiments/${fresh.body.id}/submit-to-ad`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)

    const res = await request(app)
      .post(`/api/adc/experiments/${fresh.body.id}/ad-results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'only notes' })
    expect(res.status).toBe(400)
  })

  it('POST risk-assessment approve → 200', async () => {
    const res = await request(app)
      .post(`/api/adc/risk-assessment/${experimentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: TEST_ADMIN_PASSWORD })
    // ExperimentApproveAuthentication esign flag defaults off in test DB (ardSettings.ts)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Approved')
  })

  it('GET adc-snapshot → 200', async () => {
    const res = await request(app)
      .get(`/api/adc/experiments/${experimentId}/adc-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    // snakeCaseResponse converts route keys: riskAssessment → risk_assessment
    expect(res.body).toHaveProperty('objective')
    expect(res.body).toHaveProperty('regulatory')
    expect(res.body).toHaveProperty('risk_assessment')
  })
})
