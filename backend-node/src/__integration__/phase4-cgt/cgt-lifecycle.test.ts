/**
 * Phase 4C — CGT lifecycle smoke (corrected vs plan)
 * Create process → project → notebook → experiment → submit → approve
 * (Project-level submit/approve does NOT exist — experiment workflow only)
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken } from '../helpers/auth.helper'
import {
  cleanupPhase4Fixtures,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 4C — CGT lifecycle', () => {
  let adminToken: string
  let adminUserId: string

  beforeAll(async () => {
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
  })

  afterAll(async () => {
    await cleanupPhase4Fixtures()
  })

  it('process → project → notebook → experiment → submit → approve', async () => {
    const processName = `P4 Life Process ${SUFFIX}`
    const process = await request(app)
      .post('/api/template-settings/cgt/processes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: processName })
    expect(process.status).toBe(201)

    // `process` is an optional display string on the project (not a FK to CgtProcess)
    const project = await request(app)
      .post('/api/cgt-projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `P4 Life Project ${SUFFIX}`,
        manager_id: adminUserId,
        process: processName,
      })
    expect(project.status).toBe(201)
    expect(project.body.status).toBe('ACTIVE')
    expect(project.body.process).toBe(processName)

    const notebook = await request(app)
      .post(`/api/cgt-projects/${project.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Life Notebook ${SUFFIX}` })
    expect(notebook.status).toBe(201)

    const experiment = await request(app)
      .post(`/api/cgt-notebooks/${notebook.body.id}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P4 Life Experiment ${SUFFIX}` })
    expect(experiment.status).toBe(201)
    expect(experiment.body.status).toBe('DRAFT')

    const submit = await request(app)
      .post(`/api/cgt-experiments/${experiment.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(submit.status).toBe(200)
    expect(submit.body.status).toBe('SUBMITTED')

    const approve = await request(app)
      .post(`/api/cgt-experiments/${experiment.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approve.status).toBe(200)
    expect(approve.body.status).toBe('APPROVED')
  })
})
