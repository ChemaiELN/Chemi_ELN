/**
 * Phase 1B/1C/1D — Roles, Departments, Labs
 */
import request from 'supertest'
import app from '../../app'
import { getAdminToken } from '../helpers/auth.helper'
import { cleanupPhase1Fixtures, seedMinimalAdmin } from '../helpers/seed.helper'

const SUFFIX = Date.now().toString(36).slice(-6)

describe('Phase 1 — Roles / Departments / Labs', () => {
  let adminToken: string
  let deptId: string
  let roleId: string
  let labId: string

  beforeAll(async () => {
    await seedMinimalAdmin()
    adminToken = await getAdminToken()
  })

  afterAll(async () => {
    await cleanupPhase1Fixtures()
  })

  describe('Departments', () => {
    it('GET /api/departments → 200', async () => {
      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/departments/lookup → 200 array', async () => {
      const res = await request(app)
        .get('/api/departments/lookup')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('GET /api/departments/role-mapping → 200', async () => {
      const res = await request(app)
        .get('/api/departments/role-mapping')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST /api/departments → 201', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `P1D${SUFFIX}`, name: `P1 Dept ${SUFFIX}`, description: 'phase1' })
      expect(res.status).toBe(201)
      expect(res.body.code).toBe(`P1D${SUFFIX}`)
      deptId = res.body.id
    })

    it('POST /api/departments duplicate → 409', async () => {
      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `P1D${SUFFIX}`, name: `P1 Dept Dup ${SUFFIX}` })
      expect(res.status).toBe(409)
      expect(res.body.error?.code).toBe('CONFLICT')
    })

    it('GET /api/departments/:id → 200', async () => {
      const res = await request(app)
        .get(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(deptId)
    })

    it('PATCH /api/departments/:id → 200', async () => {
      const res = await request(app)
        .patch(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `P1 Dept Updated ${SUFFIX}` })
      expect(res.status).toBe(200)
      expect(res.body.name).toContain('Updated')
    })
  })

  describe('Roles', () => {
    it('GET /api/roles → 200', async () => {
      const res = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST /api/roles → 201', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `P1R${SUFFIX}`,
          name: `P1 Role ${SUFFIX}`,
          description: 'phase1',
          department_ids: [deptId],
        })
      expect(res.status).toBe(201)
      expect(res.body.code).toBe(`P1R${SUFFIX}`.toUpperCase())
      roleId = res.body.id
    })

    it('POST /api/roles missing name → 422', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `P1RX${SUFFIX}`, department_ids: [deptId] })
      expect(res.status).toBe(422)
    })

    it('POST /api/roles duplicate code → 409', async () => {
      const res = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `P1R${SUFFIX}`,
          name: `P1 Role Dup ${SUFFIX}`,
          department_ids: [deptId],
        })
      expect(res.status).toBe(409)
      expect(res.body.error?.code).toBe('CONFLICT')
    })

    it('PATCH /api/roles/:id rename → 200', async () => {
      const res = await request(app)
        .patch(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `P1 Role Renamed ${SUFFIX}` })
      expect(res.status).toBe(200)
      expect(res.body.name).toContain('Renamed')
    })

    it('PATCH /api/roles/:id missing → 404', async () => {
      const res = await request(app)
        .patch('/api/roles/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Nope' })
      expect(res.status).toBe(404)
    })
  })

  describe('Labs', () => {
    it('GET /api/labs → 200', async () => {
      const res = await request(app)
        .get('/api/labs')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/labs/lookup → 200', async () => {
      const res = await request(app)
        .get('/api/labs/lookup')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it('POST /api/labs → 201', async () => {
      const res = await request(app)
        .post('/api/labs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `P1L${SUFFIX}`,
          name: `P1 Lab ${SUFFIX}`,
          department_id: deptId,
        })
      expect(res.status).toBe(201)
      labId = res.body.id
    })

    it('POST /api/labs duplicate code → 409', async () => {
      const res = await request(app)
        .post('/api/labs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `P1L${SUFFIX}`,
          name: `P1 Lab Dup ${SUFFIX}`,
          department_id: deptId,
        })
      expect(res.status).toBe(409)
      expect(res.body.error?.code).toBe('CONFLICT')
    })

    it('GET /api/labs/:id → 200', async () => {
      const res = await request(app)
        .get(`/api/labs/${labId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.id).toBe(labId)
    })

    it('PATCH /api/labs/:id → 200', async () => {
      const res = await request(app)
        .patch(`/api/labs/${labId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `P1 Lab Updated ${SUFFIX}` })
      expect(res.status).toBe(200)
    })

    it('DELETE /api/labs/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/labs/${labId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })

    it('DELETE /api/roles/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })

    it('DELETE /api/departments/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/departments/${deptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })
  })
})
