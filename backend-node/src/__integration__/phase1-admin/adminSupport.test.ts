/**
 * Phase 1E–1K — privileges, settings, audit, dashboard, login-issues, master-data, templates
 */
import request from 'supertest'
import app from '../../app'
import { getAdminToken, getUserToken } from '../helpers/auth.helper'
import {
  cleanupPhase1Fixtures,
  seedMinimalAdmin,
} from '../helpers/seed.helper'

const SUFFIX = Date.now().toString(36).slice(-6)

describe('Phase 1 — Admin supporting routes', () => {
  let adminToken: string
  let noprivToken: string
  let deptId: string
  let roleId: string
  let chemId: string
  let instrId: string
  let seqId: string
  let issueId: string

  beforeAll(async () => {
    await seedMinimalAdmin()
    adminToken = await getAdminToken()
    noprivToken = await getUserToken('NOPRIV')

    const dept = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `P1D${SUFFIX}`, name: `P1 Supp Dept ${SUFFIX}` })
    expect(dept.status).toBe(201)
    deptId = dept.body.id

    const role = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `P1R${SUFFIX}`,
        name: `P1 Supp Role ${SUFFIX}`,
        department_ids: [deptId],
      })
    expect(role.status).toBe(201)
    roleId = role.body.id
  })

  afterAll(async () => {
    await cleanupPhase1Fixtures()
  })

  describe('Department role privileges', () => {
    it('GET catalog → 200', async () => {
      const res = await request(app)
        .get('/api/department-role-privileges/catalog')
        .query({ module: 'ADC' })
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.module).toBe('ADC')
      expect(Array.isArray(res.body.groups)).toBe(true)
    })

    it('GET privileges for dept/role → 200', async () => {
      const res = await request(app)
        .get('/api/department-role-privileges')
        .query({ department_id: deptId, role_id: roleId })
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.granted)).toBe(true)
    })

    it('PUT privileges → 200', async () => {
      const res = await request(app)
        .put('/api/department-role-privileges')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          department_id: deptId,
          role_id: roleId,
          grants: [{ privilege_key: 'adc.project.view', is_granted: true }],
        })
      expect(res.status).toBe(200)
      expect(res.body.granted).toContain('adc.project.view')
    })

    it('PUT privileges no privilege → 403', async () => {
      const res = await request(app)
        .put('/api/department-role-privileges')
        .set('Authorization', `Bearer ${noprivToken}`)
        .send({
          department_id: deptId,
          role_id: roleId,
          grants: [{ privilege_key: 'adc.project.view', is_granted: false }],
        })
      expect(res.status).toBe(403)
    })
  })

  describe('Admin settings + id sequences', () => {
    let originalLockAttempts: number

    beforeAll(async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      originalLockAttempts = res.body.lock_user_after_x_attempts
    })

    afterAll(async () => {
      // Restore singleton GlobalSettings so later phases keep a stable lockout threshold
      if (typeof originalLockAttempts === 'number') {
        await request(app)
          .patch('/api/admin/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ lock_user_after_x_attempts: originalLockAttempts })
      }
    })

    it('GET /api/admin/settings → 200', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/settings no privilege → 403', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${noprivToken}`)
      expect(res.status).toBe(403)
    })

    it('PATCH /api/admin/settings → 200', async () => {
      const nextValue = originalLockAttempts === 7 ? 8 : 7
      const res = await request(app)
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lock_user_after_x_attempts: nextValue })
      expect(res.status).toBe(200)
      expect(res.body.lock_user_after_x_attempts).toBe(nextValue)
    })

    it('GET /api/admin/id-sequences → 200', async () => {
      const res = await request(app)
        .get('/api/admin/id-sequences')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST /api/admin/id-sequences → 201', async () => {
      const res = await request(app)
        .post('/api/admin/id-sequences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `P1SEQ${SUFFIX}`, label: `P1 Sequence ${SUFFIX}`, prefix: 'P1' })
      expect(res.status).toBe(201)
      seqId = res.body.id
    })

    it('PATCH /api/admin/id-sequences/:id → 200', async () => {
      const res = await request(app)
        .patch(`/api/admin/id-sequences/${seqId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: `P1 Sequence Updated ${SUFFIX}` })
      expect(res.status).toBe(200)
    })

    it('POST /api/admin/id-sequences-next/:code → 200', async () => {
      const res = await request(app)
        .post(`/api/admin/id-sequences-next/P1SEQ${SUFFIX}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('DELETE /api/admin/id-sequences/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/admin/id-sequences/${seqId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })
  })

  describe('Admin audit trail + dashboard', () => {
    it('GET /api/admin/audit-trail → 200', async () => {
      const res = await request(app)
        .get('/api/admin/audit-trail')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/audit-trail/event-types → 200', async () => {
      const res = await request(app)
        .get('/api/admin/audit-trail/event-types')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/audit-trail/entity-types → 200', async () => {
      const res = await request(app)
        .get('/api/admin/audit-trail/entity-types')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/dashboard/department-user-counts → 200', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/department-user-counts')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/admin/dashboard/locked-accounts → 200', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard/locked-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })

  describe('Login issues', () => {
    let issueUsername: string

    beforeAll(async () => {
      // Dedicated user so resolve does not invalidate the shared admin session
      const created = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `test_p1_issue_${SUFFIX}`,
          title: 'Mr',
          first_name: 'Issue',
          last_name: 'User',
          display_name: `P1 Issue ${SUFFIX}`,
          designation: 'Analyst',
        })
      expect(created.status).toBe(201)
      issueUsername = created.body.username
    })

    it('POST /api/login-issues (no auth) → 201', async () => {
      const res = await request(app)
        .post('/api/login-issues')
        .send({
          username: issueUsername,
          issue_type: 'PASSWORD_RESET',
          description: 'Phase1 test issue',
        })
      expect(res.status).toBe(201)
      issueId = res.body.id
    })

    it('GET /api/login-issues admin → 200', async () => {
      const res = await request(app)
        .get('/api/login-issues')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/login-issues no privilege → 403', async () => {
      const res = await request(app)
        .get('/api/login-issues')
        .set('Authorization', `Bearer ${noprivToken}`)
      expect(res.status).toBe(403)
    })

    it('POST /api/login-issues/:id/resolve → 200', async () => {
      const res = await request(app)
        .post(`/api/login-issues/${issueId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })

  describe('Master data', () => {
    it('GET /api/master-data/items → 200', async () => {
      const res = await request(app)
        .get('/api/master-data/items')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/master-data/chemicals → 200', async () => {
      const res = await request(app)
        .get('/api/master-data/chemicals')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST /api/master-data/chemicals → 201', async () => {
      const res = await request(app)
        .post('/api/master-data/chemicals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ chemical_name: `P1 Chem ${SUFFIX}`, formula: 'H2O' })
      expect(res.status).toBe(201)
      chemId = res.body.id
    })

    it('POST /api/master-data/chemicals no privilege → 403', async () => {
      const res = await request(app)
        .post('/api/master-data/chemicals')
        .set('Authorization', `Bearer ${noprivToken}`)
        .send({ chemical_name: `P1 Chem Forbidden ${SUFFIX}` })
      expect(res.status).toBe(403)
    })

    it('PATCH /api/master-data/chemicals/:id → 200', async () => {
      const res = await request(app)
        .patch(`/api/master-data/chemicals/${chemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ formula: 'D2O' })
      expect(res.status).toBe(200)
    })

    it('DELETE /api/master-data/chemicals/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/master-data/chemicals/${chemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })

    it('GET /api/master-data/instruments → 200', async () => {
      const res = await request(app)
        .get('/api/master-data/instruments')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('POST /api/master-data/instruments → 201', async () => {
      const res = await request(app)
        .post('/api/master-data/instruments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          instrument_code: `P1I${SUFFIX}`,
          instrument_name: `P1 Instrument ${SUFFIX}`,
        })
      expect(res.status).toBe(201)
      instrId = res.body.id
    })

    it('PATCH /api/master-data/instruments/:id → 200', async () => {
      const res = await request(app)
        .patch(`/api/master-data/instruments/${instrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ instrument_name: `P1 Instrument Updated ${SUFFIX}` })
      expect(res.status).toBe(200)
    })

    it('DELETE /api/master-data/instruments/:id → 204', async () => {
      const res = await request(app)
        .delete(`/api/master-data/instruments/${instrId}`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(204)
    })
  })

  describe('Master templates (inventory)', () => {
    it('GET /api/inventory/master-templates → 200', async () => {
      const res = await request(app)
        .get('/api/inventory/master-templates')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })

    it('GET /api/inventory/master-templates/:key/download → 200', async () => {
      const res = await request(app)
        .get('/api/inventory/master-templates/maintenance-planner/download')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
    })
  })
})
