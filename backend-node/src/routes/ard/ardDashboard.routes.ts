import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { sequelize } from '../../database/connection'
import {
  ArdAtrForm, ArdTestRequest, ArdExperiment, ArdTemplate,
  ArdAnalystQualification, ArdAuditLog, ArdQcTrfForm,
  User, Role,
} from '../../models/index'

const router = Router()

// Sidebar items. The `group` values are significant: ArdSidebar.tsx only renders the
// groups in its GROUP_ORDER — 'work', 'notebook', 'insights', 'admin' — plus items with
// a null group (rendered top-level). Anything in an unknown group (this list previously
// used 'main') is silently dropped, which left only the Admin section visible.
// Keys, labels, hrefs, groups and icons mirror the FastAPI source of truth in
// backend/app/modules/ard/dashboard.py:41-59.
const ARD_MENU_ITEMS: Array<{
  key: string
  label: string
  href: string
  group: string | null
  icon: string
}> = [
  { key: 'dashboard', label: 'Dashboard', href: '/ard', group: null, icon: 'LayoutDashboard' },
  { key: 'my-queue', label: 'My Queue', href: '/ard/my-queue', group: null, icon: 'Inbox' },
  { key: 'atrs', label: 'ATRs', href: '/ard/atrs', group: 'work', icon: 'FileSpreadsheet' },
  { key: 'tests', label: 'Tests', href: '/ard/tests', group: 'work', icon: 'CheckSquare' },
  { key: 'qc-trf', label: 'TRF Forms', href: '/ard/qc-trf', group: 'work', icon: 'FileCheck' },
  { key: 'projects', label: 'Projects', href: '/ard/projects', group: 'notebook', icon: 'FolderKanban' },
  { key: 'notebooks', label: 'Notebooks', href: '/ard/notebooks', group: 'notebook', icon: 'BookOpen' },
  { key: 'experiments', label: 'Experiments', href: '/ard/experiments', group: 'notebook', icon: 'FlaskConical' },
  { key: 'pending-review', label: 'Pending Review', href: '/ard/experiments/pending-review', group: 'notebook', icon: 'FlaskConical' },
  { key: 'templates', label: 'Templates', href: '/ard/templates', group: 'notebook', icon: 'FileText' },
  { key: 'compare', label: 'Compare Exps', href: '/ard/experiments/compare', group: 'insights', icon: 'GitCompareArrows' },
  { key: 'reports', label: 'Reports', href: '/ard/reports', group: 'insights', icon: 'BarChart3' },
  { key: 'notifications', label: 'Notifications', href: '/ard/notifications', group: 'insights', icon: 'Bell' },
  { key: 'search', label: 'Search', href: '/ard/search', group: 'insights', icon: 'Search' },
  { key: 'team', label: 'Team Directory', href: '/ard/team', group: 'insights', icon: 'Users' },
  { key: 'audit', label: 'Audit Trail', href: '/ard/audit', group: 'admin', icon: 'History' },
  { key: 'configuration', label: 'Master Data', href: '/ard/configuration', group: 'admin', icon: 'Settings2' },
]
const ADMIN_ONLY_GROUPS = new Set(['admin'])
const ADMIN_ROLE_CODES = new Set(['HOD', 'SUPER_ADMIN', 'ADMIN', 'TL', 'TEAM_LEAD'])

// GET /api/ard/ping
router.get('/ping', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user
  res.json({ module: 'ard', status: 'ok', user: user?.username })
})

// ── User lists for the TL / QA assignment dropdowns ──────────────────────────
// Ported from backend/app/modules/ard/atr.py:1664-1676.

async function activeUsersByRole(roleCodes: string[]) {
  const users = await User.findAll({
    where: { isActive: true },
    include: [{ model: Role, as: 'role', attributes: ['code'], where: { code: { [Op.in]: roleCodes } }, required: true }],
    attributes: ['id', 'username', 'email'],
    order: [['username', 'ASC']],
  })
  return users.map((u) => ({
    id: (u as any).id,
    username: (u as any).username,
    email: (u as any).email ?? null,
    roleCode: ((u as any).role as any)?.code ?? null,
  }))
}

// GET /api/ard/users/tl-list
router.get('/users/tl-list', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse('TL users', { items: await activeUsersByRole(['TL', 'HOD']) }))
  } catch (err) {
    next(err)
  }
})

// GET /api/ard/users/qa-list
router.get('/users/qa-list', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse('QA users', { items: await activeUsersByRole(['QA']) }))
  } catch (err) {
    next(err)
  }
})

// GET /api/ard/menu
router.get('/menu', authenticate, (req: Request, res: Response) => {
  const user = (req as any).user
  const roleCode: string = (user?.role as any)?.code || ''
  const isAdminRole = ADMIN_ROLE_CODES.has(roleCode)

  const items = ARD_MENU_ITEMS.filter(item => {
    if (item.key === 'my-queue' && (roleCode === 'ADMIN' || roleCode === 'SUPER_ADMIN')) return false
    if (item.group !== null && ADMIN_ONLY_GROUPS.has(item.group) && !isAdminRole) return false
    return true
  })

  res.json(successResponse('ARD menu', { items }))
})

async function getDashboardMetrics() {
  const [
    totalAtrs,
    pendingAtrs,
    approvedAtrs,
    totalExperiments,
    inProgressExperiments,
    submittedExperiments,
    totalTests,
    pendingVerificationTests,
    verifiedTests,
    reworkTests,
    totalTrfs,
    atrStatusRows,
    testTechniqueRows,
  ] = await Promise.all([
    ArdAtrForm.count(),
    ArdAtrForm.count({ where: { status: { [Op.in]: ['REQUESTED', 'NEW', 'QA_PRE_APPROVAL', 'PENDING_CLARIFICATION', 'PENDING_APPROVAL', 'CERTIFICATION_REQUESTED'] } } }),
    ArdAtrForm.count({ where: { status: { [Op.in]: ['APPROVED', 'CERTIFIED'] } } }),
    ArdExperiment.count(),
    ArdExperiment.count({ where: { status: 'IN_PROGRESS' } }),
    ArdExperiment.count({ where: { status: 'SUBMITTED' } }),
    ArdTestRequest.count(),
    ArdTestRequest.count({ where: { status: 'VERIFICATION_REQUESTED' } }),
    ArdTestRequest.count({ where: { status: 'VERIFIED' } }),
    ArdTestRequest.count({ where: { status: { [Op.in]: ['REWORK', 'VERIFICATION_REWORK'] } } }),
    ArdQcTrfForm.count(),
    sequelize.query<{ status: string; count: string }>(
      'SELECT status, COUNT(id) AS count FROM ard_atr_forms GROUP BY status',
      { type: QueryTypes.SELECT }
    ),
    sequelize.query<{ technique: string; count: string }>(
      "SELECT COALESCE(technique_code, test_type) AS technique, COUNT(id) AS count FROM ard_test_requests GROUP BY technique",
      { type: QueryTypes.SELECT }
    ),
  ])

  return {
    kpis: {
      totalAtrs, pendingAtrs, approvedAtrs,
      totalExperiments, inProgressExperiments, submittedExperiments,
      totalTests, pendingVerificationTests, verifiedTests, reworkTests,
      totalTrfs, expiringQuals: 0,
    },
    atrStatusBreakdown: atrStatusRows.map(r => ({ status: r.status, count: Number(r.count) })),
    testTechniqueBreakdown: testTechniqueRows.map(r => ({ technique: r.technique, count: Number(r.count) })),
  }
}

// GET /api/ard/dashboard/metrics
router.get('/dashboard/metrics', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const base = await getDashboardMetrics()

    const [pendingTests, pendingAtrs, submittedExps, recentLogs] = await Promise.all([
      ArdTestRequest.findAll({ where: { status: 'VERIFICATION_REQUESTED' }, limit: 10, order: [['createdAt', 'DESC']] }),
      ArdAtrForm.findAll({ where: { status: { [Op.in]: ['REQUESTED', 'QA_PRE_APPROVAL', 'PENDING_CLARIFICATION', 'PENDING_APPROVAL'] } }, limit: 10, order: [['createdAt', 'DESC']] }),
      ArdExperiment.findAll({ where: { status: 'SUBMITTED' }, limit: 10, order: [['createdAt', 'DESC']] }),
      ArdAuditLog.findAll({ limit: 15, order: [['createdAt', 'DESC']] }),
    ])

    const pendingQueue = [
      ...pendingTests.map((t: any) => ({ id: t.id, title: t.testType || t.testSubtype, subtitle: t.arNumber, href: `/ard/tests/${t.id}`, type: 'Test', at: t.createdAt, tone: 'warning' })),
      ...pendingAtrs.map((f: any) => ({ id: f.id, title: f.formNo, subtitle: f.productName, href: `/ard/atrs/${f.id}`, type: 'ATR', at: f.createdAt, tone: 'info' })),
      ...submittedExps.map((e: any) => ({ id: e.id, title: e.code, subtitle: e.templateName, href: `/ard/experiments/${e.id}`, type: 'Experiment', at: e.createdAt, tone: 'info' })),
    ]

    const userIds = [...new Set(recentLogs.map((l: any) => l.userId).filter(Boolean))]
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] }) : []
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))

    const recentEvents = recentLogs.map((l: any) => ({
      id: l.id,
      entityType: l.entityType,
      entityId: l.entityId,
      action: l.action,
      detail: l.detail,
      by: userMap[l.userId] || null,
      at: l.createdAt,
    }))

    res.json(successResponse('Dashboard metrics', { ...base, pendingQueue, recentEvents }))
  } catch (err) { next(err) }
})

// GET /api/ard/dashboard/my-metrics
router.get('/dashboard/my-metrics', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const deptCode: string = (user?.department as any)?.code || ''
    const uid = user?.id

    if (['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      const base = await getDashboardMetrics()
      return res.json(successResponse('My metrics', { roleCode, deptCode, ...base }))
    }

    if (roleCode === 'TL' || roleCode === 'TEAM_LEAD') {
      const [myAtrs, teamTests] = await Promise.all([
        ArdAtrForm.findAll({ where: { assignedTlId: uid } as any }),
        ArdTestRequest.findAll({
          where: { assignedToId: uid } as any,
        }),
      ])
      const atrStatusBreakdown = myAtrs.reduce((acc: any, f: any) => {
        acc[f.status] = (acc[f.status] || 0) + 1
        return acc
      }, {})
      return res.json(successResponse('My metrics', {
        roleCode, deptCode,
        myAtrs: myAtrs.map((f: any) => ({ id: f.id, formNo: f.formNo, productName: f.productName, status: f.status })),
        teamTests: teamTests.map((t: any) => ({ id: t.id, testType: t.testType, arNumber: t.arNumber, status: t.status })),
        kpis: {
          myAtrs: myAtrs.length,
          pendingAtrs: myAtrs.filter((f: any) => ['REQUESTED', 'PENDING_CLARIFICATION', 'PENDING_APPROVAL'].includes(f.status)).length,
          teamTests: teamTests.length,
          pendingVerification: teamTests.filter((t: any) => t.status === 'VERIFICATION_REQUESTED').length,
          reworkTests: teamTests.filter((t: any) => ['REWORK', 'VERIFICATION_REWORK'].includes(t.status)).length,
        },
        atrStatusBreakdown: Object.entries(atrStatusBreakdown).map(([status, count]) => ({ status, count })),
      }))
    }

    if (roleCode === 'QA') {
      const [qaQueue, trfs] = await Promise.all([
        ArdAtrForm.findAll({ where: { status: { [Op.in]: ['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK', 'CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK'] } }, order: [['updatedAt', 'DESC']], limit: 30 }),
        ArdQcTrfForm.findAll({ order: [['updatedAt', 'DESC']], limit: 20 }),
      ])
      return res.json(successResponse('My metrics', {
        roleCode, deptCode,
        qaQueue: qaQueue.map((f: any) => ({ id: f.id, formNo: f.formNo, productName: f.productName, status: f.status })),
        kpis: {
          qaQueueCount: qaQueue.length,
          preApproval: qaQueue.filter((f: any) => f.status === 'QA_PRE_APPROVAL').length,
          certRequested: qaQueue.filter((f: any) => f.status === 'CERTIFICATION_REQUESTED').length,
          totalTrfs: trfs.length,
        },
      }))
    }

    // Default — analyst / external requester
    const [myTests, myExperiments] = await Promise.all([
      ArdTestRequest.findAll({ where: { assignedToId: uid } as any }),
      ArdExperiment.findAll({ where: { createdById: uid } as any }),
    ])
    res.json(successResponse('My metrics', {
      roleCode, deptCode,
      myTests: myTests.map((t: any) => ({ id: t.id, testType: t.testType, arNumber: t.arNumber, status: t.status })),
      myExperiments: myExperiments.map((e: any) => ({ id: e.id, code: e.code, templateName: e.templateName, status: e.status })),
      kpis: {
        totalMyTests: myTests.length,
        inProgressTests: myTests.filter((t: any) => t.status === 'IN_PROGRESS').length,
        pendingVerification: myTests.filter((t: any) => t.status === 'VERIFICATION_REQUESTED').length,
        reworkTests: myTests.filter((t: any) => ['REWORK', 'VERIFICATION_REWORK'].includes(t.status)).length,
        myExperiments: myExperiments.length,
      },
    }))
  } catch (err) { next(err) }
})

export default router
