import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import {
  ArdAtrForm, ArdTestRequest, ArdExperiment, ArdTemplate,
  ArdQcTrfForm, ArdAuditLog, ArdNotificationRead,
} from '../../models/index'

const router = Router()

function roleCode(user: any): string { return (user?.role as any)?.code || '' }
function isAdmin(rc: string) { return ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(rc) }
function isQA(rc: string) { return rc === 'QA' }
function isTL(rc: string) { return ['TL', 'TEAM_LEAD'].includes(rc) }

async function buildItems(user: any): Promise<any[]> {
  const uid = user.id
  const rc = roleCode(user)
  const items: any[] = []
  const now = Date.now()

  // Tests assigned to me
  const myTests = await ArdTestRequest.findAll({
    where: { assignedToId: uid, status: { [Op.in]: ['ASSIGNED', 'REWORK', 'VERIFICATION_REWORK', 'ACCEPTED'] } } as any,
  })
  myTests.forEach((t: any) => items.push({
    id: `test-assigned-${t.id}`,
    title: `Test assigned: ${t.testType}`,
    body: `AR: ${t.arNumber || '—'}`,
    href: `/ard/tests/${t.id}`,
    at: t.updatedAt || t.createdAt,
    tone: 'info',
    category: 'workflow',
  }))

  // Tests delegated to me
  const delegated = await ArdTestRequest.findAll({
    where: { delegatedToId: uid, status: 'DELEGATED' } as any,
  })
  delegated.forEach((t: any) => items.push({
    id: `test-delegated-${t.id}`,
    title: `Delegated test: ${t.testType}`,
    body: `AR: ${t.arNumber || '—'}`,
    href: `/ard/tests/${t.id}`,
    at: t.updatedAt || t.createdAt,
    tone: 'warning',
    category: 'workflow',
  }))

  // QA sees submitted TRFs
  if (isQA(rc) || isAdmin(rc)) {
    const trfs = await ArdQcTrfForm.findAll({ where: { status: 'SUBMITTED' } })
    trfs.forEach((f: any) => items.push({
      id: `trf-submitted-${f.id}`,
      title: `TRF awaiting registration: ${f.formNo}`,
      body: f.projectName,
      href: `/ard/qc-trf/${f.id}`,
      at: f.updatedAt || f.createdAt,
      tone: 'warning',
      category: 'workflow',
    }))

    const qaAtrs = await ArdAtrForm.findAll({ where: { status: 'QA_PRE_APPROVAL' } })
    qaAtrs.forEach((f: any) => items.push({
      id: `atr-qa-${f.id}`,
      title: `ATR awaiting QA approval: ${f.formNo}`,
      body: f.productName,
      href: `/ard/atrs/${f.id}`,
      at: f.updatedAt || f.createdAt,
      tone: 'warning',
      category: 'workflow',
    }))
  }

  // ATRs pending clarification visible to everyone (scoped)
  const clarWhere: any = { status: 'PENDING_CLARIFICATION' }
  if (!isAdmin(rc) && !isQA(rc)) clarWhere.createdById = uid
  const clarAtrs = await ArdAtrForm.findAll({ where: clarWhere })
  clarAtrs.forEach((f: any) => items.push({
    id: `atr-clarification-${f.id}`,
    title: `ATR needs clarification: ${f.formNo}`,
    body: f.productName,
    href: `/ard/atrs/${f.id}`,
    at: f.updatedAt || f.createdAt,
    tone: 'error',
    category: 'workflow',
  }))

  // HOD/Admin sees submitted experiments and pending template approvals
  if (isAdmin(rc)) {
    const submittedExps = await ArdExperiment.findAll({ where: { status: 'SUBMITTED' } })
    submittedExps.forEach((e: any) => items.push({
      id: `exp-submitted-${e.id}`,
      title: `Experiment awaiting approval: ${e.code}`,
      body: e.templateName,
      href: `/ard/experiments/${e.id}`,
      at: e.updatedAt || e.createdAt,
      tone: 'info',
      category: 'workflow',
    }))

    // Scenario 20b (requestForUnlock) — legacy mailed every notebook user
    // when an unlock request was raised; this app has no email
    // infrastructure at all, so the closest functional equivalent is
    // surfacing it here, same as the SUBMITTED item above already does for
    // approval requests.
    const unlockRequests = await ArdExperiment.findAll({ where: { status: 'UNLOCK_REQUESTED' } })
    unlockRequests.forEach((e: any) => items.push({
      id: `exp-unlock-requested-${e.id}`,
      title: `Unlock requested: ${e.code}`,
      body: e.templateName,
      href: `/ard/experiments/${e.id}`,
      at: e.updatedAt || e.createdAt,
      tone: 'warning',
      category: 'workflow',
    }))

    const pendingTemplates = await ArdTemplate.findAll({ where: { status: 'PENDING_APPROVAL' } })
    pendingTemplates.forEach((t: any) => items.push({
      id: `tmpl-pending-${t.id}`,
      title: `Template awaiting approval: ${t.name}`,
      body: t.techniqueCode,
      href: `/ard/templates/${t.id}`,
      at: t.updatedAt || t.createdAt,
      tone: 'info',
      category: 'workflow',
    }))
  }

  // Experiments where I am creator — status changes
  const myExps = await ArdExperiment.findAll({
    where: { createdById: uid, status: { [Op.in]: ['APPROVED', 'REWORK', 'VERIFIED'] } } as any,
  })
  myExps.forEach((e: any) => items.push({
    id: `exp-status-${e.id}`,
    title: `Experiment ${e.status.toLowerCase()}: ${e.code}`,
    body: e.templateName,
    href: `/ard/experiments/${e.id}`,
    at: e.updatedAt || e.createdAt,
    tone: e.status === 'REWORK' ? 'error' : 'success',
    category: 'workflow',
  }))

  // Recent ATR status changes (audit trail)
  const auditLogs = await ArdAuditLog.findAll({
    where: { entityType: 'ATR', action: { [Op.iLike]: 'Status → %' } },
    order: [['createdAt', 'DESC']],
    limit: 50,
  })
  auditLogs.forEach((l: any) => items.push({
    id: `audit-atr-${l.id}`,
    title: `ATR ${l.action}`,
    body: l.detail || '',
    href: `/ard/atrs/${l.entityId}`,
    at: l.createdAt,
    tone: 'info',
    category: 'atr',
  }))

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items
}

// GET /api/ard/notifications
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const allItems = await buildItems(user)

    const readRecords = await ArdNotificationRead.findAll({ where: { userId: user.id } })
    const readSet = new Set(readRecords.map((r: any) => r.notificationId))

    const items = allItems.map(item => ({ ...item, read: readSet.has(item.id) }))
    const unread = items.filter(i => !i.read).length

    res.json(successResponse('Notifications', { items, unread }))
  } catch (err) { next(err) }
})

// POST /api/ard/notifications/mark-read
router.post('/mark-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body)
    for (const id of ids) {
      await (ArdNotificationRead as any).findOrCreate({
        where: { userId: user.id, notificationId: id },
        defaults: { userId: user.id, notificationId: id },
      })
    }
    res.json(successResponse('Marked as read', { ok: true }))
  } catch (err) { next(err) }
})

// POST /api/ard/notifications/mark-all-read
router.post('/mark-all-read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const allItems = await buildItems(user)
    const readRecords = await ArdNotificationRead.findAll({ where: { userId: user.id } })
    const readSet = new Set(readRecords.map((r: any) => r.notificationId))

    for (const item of allItems) {
      if (!readSet.has(item.id)) {
        await (ArdNotificationRead as any).findOrCreate({
          where: { userId: user.id, notificationId: item.id },
          defaults: { userId: user.id, notificationId: item.id },
        })
      }
    }
    res.json(successResponse('All notifications marked as read', { ok: true }))
  } catch (err) { next(err) }
})

export default router
