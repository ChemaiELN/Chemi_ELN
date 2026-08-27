/**
 * Phase 2F — ADC lifecycle smoke
 * Create Project → Notebook → Experiment → Assign → Submit → Approve → Clone
 */
import request from 'supertest'
import { randomUUID } from 'crypto'
import app from '../../app'
import { getAdminToken } from '../helpers/auth.helper'
import {
  cleanupPhase2Fixtures,
  ensureAdcPdDepartment,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = randomUUID().slice(0, 8)

describe('Phase 2F — ADC lifecycle', () => {
  let adminToken: string
  let adminUserId: string

  beforeAll(async () => {
    await ensureAdcPdDepartment()
    const admin = await seedMinimalAdmin()
    adminUserId = admin.userId
    adminToken = await getAdminToken()
  })

  afterAll(async () => {
    await cleanupPhase2Fixtures()
  })

  it('project → notebook → experiment → assign → submit → approve → clone', async () => {
    const project = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `P2 Lifecycle Project ${SUFFIX}` })
    expect(project.status).toBe(201)
    expect(project.body.status).toBe('ACTIVE')

    const notebook = await request(app)
      .post(`/api/projects/${project.body.id}/notebooks`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Lifecycle Notebook ${SUFFIX}` })
    expect(notebook.status).toBe(201)

    const experiment = await request(app)
      .post(`/api/notebooks/${notebook.body.id}/experiments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `P2 Lifecycle Experiment ${SUFFIX}` })
    expect(experiment.status).toBe(201)
    expect(experiment.body.status).toBe('DRAFT')

    const assign = await request(app)
      .post(`/api/experiments/${experiment.body.id}/assign-user`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: adminUserId })
    expect([200, 201]).toContain(assign.status)

    const submit = await request(app)
      .post(`/api/experiments/${experiment.body.id}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(submit.status).toBe(200)
    expect(submit.body.status).toBe('SUBMITTED')

    const approve = await request(app)
      .post(`/api/experiments/${experiment.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approve.status).toBe(200)
    expect(approve.body.status).toBe('APPROVED')

    const clone = await request(app)
      .post(`/api/experiments/${experiment.body.id}/clone`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(clone.status).toBe(201)
    expect(clone.body.id).toBeTruthy()
    expect(clone.body.id).not.toBe(experiment.body.id)
  })
})
