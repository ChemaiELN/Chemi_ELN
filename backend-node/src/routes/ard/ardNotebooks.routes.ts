import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { ArdNotebook, ArdExperiment, ArdAuditLog, ArdProject } from '../../models/index'

const router = Router()

function isAdmin(rc: string) { return ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(rc) }
function isLabRole(rc: string) { return !['EXTERNAL', 'ADC_PD', 'CGT'].includes(rc) }
function canEdit(nb: ArdNotebook, user: any, rc: string) {
  const assigned = (nb.assignedUsers as any[]) || []
  return nb.createdById === user.id || isAdmin(rc) || assigned.some((u: any) => u.userId === user.id)
}

function nbOut(nb: ArdNotebook) {
  return {
    id: nb.id, code: nb.code, name: nb.name, description: nb.description,
    projectId: nb.projectId, notebookType: nb.notebookType, status: nb.status,
    assignedUsers: nb.assignedUsers, resultParameters: nb.resultParameters,
    auditTrail: nb.auditTrail, equipmentIds: nb.equipmentIds,
    maxExperiments: nb.maxExperiments,
    includeVerificationFlow: nb.includeVerificationFlow,
    createdBy: nb.createdBy, createdById: nb.createdById,
    createdAt: nb.createdAt, updatedAt: nb.updatedAt,
  }
}

async function auditLog(entityId: string, action: string, userId: string | null) {
  await ArdAuditLog.create({ entityType: 'NOTEBOOK', entityId, action, userId } as any)
}

// The "Notebook Events" tab reads nb.auditTrail (a JSONB column on the
// notebook itself), NOT the ArdAuditLog table auditLog() above writes to —
// those are two entirely separate logs. Previously only Close/Deactivate
// pushed an entry here (via a frontend-supplied `auditEntry`), so every
// other change — name/description/type edits, members added/removed,
// result parameters, max experiments, verification flow, create, reopen —
// never showed up in Notebook Events at all. This computes what actually
// changed server-side so nothing depends on a call site remembering to
// pass auditEntry, and so DETAIL (not just a bare "Updated") is recorded.
function pushTrail(nb: ArdNotebook, action: string, actorName: string, detail?: string) {
  const existing = (nb.auditTrail as any[]) || [];
  return [...existing, { action, actorName, detail: detail || '', createdAt: new Date().toISOString() }];
}

function diffNotebookUpdate(nb: ArdNotebook, updates: any): { action: string; detail: string } | null {
  const parts: string[] = [];

  if (updates.name !== undefined && updates.name !== nb.name) {
    parts.push(`Name: "${nb.name}" → "${updates.name}"`);
  }
  if (updates.description !== undefined && (updates.description || null) !== (nb.description || null)) {
    parts.push('Description updated');
  }
  if (updates.notebookType !== undefined && updates.notebookType !== nb.notebookType) {
    parts.push(`Type: "${nb.notebookType || '—'}" → "${updates.notebookType || '—'}"`);
  }
  if (updates.includeVerificationFlow !== undefined && updates.includeVerificationFlow !== (nb as any).includeVerificationFlow) {
    parts.push(`Verification flow ${updates.includeVerificationFlow ? 'enabled' : 'disabled'}`);
  }
  if (updates.maxExperiments !== undefined && updates.maxExperiments !== (nb as any).maxExperiments) {
    parts.push(`Max experiments: ${(nb as any).maxExperiments ?? '—'} → ${updates.maxExperiments ?? '—'}`);
  }

  let membershipChanged = false;
  if (updates.assignedUsers !== undefined) {
    const before = (nb.assignedUsers as any[]) || [];
    const after = (updates.assignedUsers as any[]) || [];
    const beforeIds = new Set(before.map((u: any) => u.userId));
    const afterIds = new Set(after.map((u: any) => u.userId));
    const added = after.filter((u: any) => !beforeIds.has(u.userId)).map((u: any) => u.userName);
    const removed = before.filter((u: any) => !afterIds.has(u.userId)).map((u: any) => u.userName);
    if (added.length) { parts.push(`Members added: ${added.join(', ')}`); membershipChanged = true; }
    if (removed.length) { parts.push(`Members removed: ${removed.join(', ')}`); membershipChanged = true; }
  }

  if (updates.resultParameters !== undefined) {
    const before = (nb.resultParameters as any[]) || [];
    const after = (updates.resultParameters as any[]) || [];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      parts.push(`Result parameters updated (${after.length})`);
    }
  }

  if (parts.length === 0) return null;
  return { action: membershipChanged ? 'Members changed' : 'Updated', detail: parts.join('; ') };
}

async function nextCode(): Promise<string> {
  const year = new Date().getFullYear()
  const [{ count }] = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM ard_notebooks WHERE code LIKE 'NB-${year}-%'`,
    { type: QueryTypes.SELECT }
  )
  const seq = String(Number(count) + 1).padStart(5, '0')
  return `NB-${year}-${seq}`
}

// GET /api/ard/notebooks
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    const { projectId, status } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    if (!isAdmin(rc)) {
      // Correlated subquery: the unqualified `project_id` resolves to the outer
      // notebook row regardless of the alias Sequelize gives the outer table
      // (it uses "ArdNotebook" in COUNT queries but "ard_notebooks" in SELECTs —
      // qualifying with the literal table name broke the COUNT variant with
      // "invalid reference to FROM-clause entry for table ard_notebooks").
      where[Op.or] = [
        { createdById: user.id },
        sequelize.literal(`assigned_users::text LIKE '%${user.id}%'`),
        sequelize.literal(`EXISTS (SELECT 1 FROM ard_projects WHERE ard_projects.id = project_id AND ard_projects.team::text LIKE '%${user.id}%')`),
      ]
    }

    const { count, rows } = await ArdNotebook.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] })
    res.json(listResponse('Notebooks', rows.map(nbOut), buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

async function canView(nb: ArdNotebook, user: any, rc: string): Promise<boolean> {
  if (canEdit(nb, user, rc)) return true
  if (!nb.projectId) return false
  const project = await ArdProject.findByPk(nb.projectId)
  const team = (project?.team as any[]) || []
  return team.some((m: any) => m.userId === user.id)
}

// GET /api/ard/notebooks/:notebookId
router.get('/:notebookId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')
    if (!(await canView(nb, user, rc))) throw new ForbiddenError('You are not a member of this notebook')
    res.json(successResponse('Notebook', nbOut(nb)))
  } catch (err) { next(err) }
})

// POST /api/ard/notebooks
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isLabRole(rc)) throw new ForbiddenError('Insufficient permissions')

    const { name, description, projectId, notebookType, assignedUsers, resultParameters } = z.object({
      name: z.string().min(1),
      description: z.string().nullable().optional(),
      projectId: z.string().uuid().nullable().optional(),
      notebookType: z.string().nullable().optional(),
      assignedUsers: z.array(z.any()).optional(),
      resultParameters: z.array(z.any()).optional(),
    }).parse(req.body)

    if (projectId) {
      const project = await ArdProject.findByPk(projectId)
      if (project && project.status !== 'OPEN') {
        throw new BadRequestError('Cannot create a notebook in a closed project', 'INVALID_STATE')
      }
    }

    // Notebook names are unique, case-insensitively — "Trail-3" and
    // "trail-3" count as the same name, matching how a user would actually
    // read a duplicate.
    const trimmedName = name.trim();
    const dupe = await ArdNotebook.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('name')), trimmedName.toLowerCase()),
    });
    if (dupe) throw new BadRequestError(`A notebook named "${trimmedName}" already exists.`, 'VALIDATION_ERROR');

    const code = await nextCode()
    const nb = await ArdNotebook.create({
      code, name,
      description: description || null,
      projectId: projectId || null,
      notebookType: notebookType || null,
      // Creator is automatically an assigned user when no explicit list is given.
      assignedUsers: (assignedUsers && assignedUsers.length > 0) ? assignedUsers : [{ userId: user.id, userName: user.username, role: rc }],
      resultParameters: resultParameters || [],
      auditTrail: [{ action: 'Created', actorName: user.username, detail: '', createdAt: new Date().toISOString() }],
      equipmentIds: [],
      status: 'ACTIVE',
      createdBy: user.username,
      createdById: user.id,
    } as any)

    await auditLog(nb.id, 'Created', user.id)
    res.status(201).json(successResponse('Notebook created', nbOut(nb)))
  } catch (err) { next(err) }
})

// PATCH /api/ard/notebooks/:notebookId
router.patch('/:notebookId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')

    const body = req.body
    const updates: any = { updatedAt: new Date() }

    if (body.status !== undefined) {
      if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can change notebook status')
      const newStatus = body.status
      if (!['CLOSED', 'DEACTIVE'].includes(newStatus)) {
        throw new BadRequestError('Invalid status transition', 'VALIDATION_ERROR')
      }
      if (newStatus === 'CLOSED') {
        if (!body.remarks && !body.reason) throw new BadRequestError('Remarks required to close notebook', 'VALIDATION_ERROR')
        const inProgress = await ArdExperiment.count({
          where: { notebookId: nb.id, status: { [Op.in]: ['IN_PROGRESS', 'SUBMITTED', 'REWORK'] } } as any,
        })
        if (inProgress > 0) throw new BadRequestError('Cannot close notebook with experiments still in progress', 'VALIDATION_ERROR')
      }
      updates.status = newStatus
    }

    // Status transitions (Close / Deactivate) have their own validation above;
    // this ACTIVE-gate only applies to editing other fields on a non-active notebook.
    if (body.status === undefined && nb.status !== 'ACTIVE') {
      throw new BadRequestError('Notebook must be Active to edit', 'INVALID_STATE')
    }

    if (!canEdit(nb, user, rc)) throw new ForbiddenError('Access denied')

    // canEdit above lets ANY assigned member patch the notebook (name,
    // description, etc.) — membership changes need their own, narrower
    // check: only HOD/TL manage who's on a notebook (matches the project
    // team's own rule), and nobody — HOD/TL included — can remove
    // themself. The notebook creator/owner is deliberately NOT exempt from
    // removal here; only the acting user's own row is protected.
    if (body.assignedUsers !== undefined) {
      if (!['HOD', 'TL', 'TEAM_LEAD', 'SUPER_ADMIN'].includes(rc)) {
        throw new ForbiddenError('Only HOD or TL can add or remove notebook members');
      }
      const before = (nb.assignedUsers as any[]) || [];
      const wasAssigned = before.some((u: any) => u.userId === user.id);
      const stillAssigned = (body.assignedUsers as any[]).some((u: any) => u.userId === user.id);
      if (wasAssigned && !stillAssigned) {
        throw new BadRequestError('You cannot remove yourself from the notebook', 'VALIDATION_ERROR');
      }
    }

    if (body.name !== undefined && body.name.trim().toLowerCase() !== (nb.name || '').trim().toLowerCase()) {
      const trimmedName = body.name.trim();
      const dupe = await ArdNotebook.findOne({
        where: {
          [Op.and]: [
            { id: { [Op.ne]: nb.id } },
            sequelize.where(sequelize.fn('lower', sequelize.col('name')), trimmedName.toLowerCase()),
          ],
        } as any,
      });
      if (dupe) throw new BadRequestError(`A notebook named "${trimmedName}" already exists.`, 'VALIDATION_ERROR');
    }

    const editableFields = ['name', 'description', 'notebookType', 'includeVerificationFlow', 'assignedUsers', 'resultParameters', 'maxExperiments']
    editableFields.forEach(k => { if (body[k] !== undefined) updates[k] = body[k] })

    if (updates.status !== undefined) {
      // Status transitions are always logged, taking priority over any
      // other field changed in the same request (Close/Deactivate calls
      // don't also change other fields in practice, but this keeps the
      // status transition itself as the headline event if they ever do).
      const action = updates.status === 'CLOSED' ? 'Closed' : 'Deactivated';
      const reason = body.remarks || body.reason || '';
      updates.auditTrail = pushTrail(nb, action, user.username, reason);
    } else {
      const change = diffNotebookUpdate(nb, updates);
      if (change) updates.auditTrail = pushTrail(nb, change.action, user.username, change.detail);
    }

    await nb.update(updates)
    await auditLog(nb.id, 'Updated', user.id)
    res.json(successResponse('Notebook updated', nbOut(nb)))
  } catch (err) { next(err) }
})

// DELETE /api/ard/notebooks/:notebookId
router.delete('/:notebookId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can delete notebooks')

    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')

    await auditLog(nb.id, 'Deleted', user.id)
    await ArdExperiment.update({ notebookId: null } as any, { where: { notebookId: nb.id } as any })
    await nb.destroy()
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/ard/notebooks/:notebookId/reopen
router.post('/:notebookId/reopen', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can reopen notebooks')

    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')
    if (nb.status !== 'CLOSED') throw new BadRequestError('Only CLOSED notebooks can be reopened', 'INVALID_STATE')

    const remarks = req.body.remarks || req.body.reason
    if (!remarks) throw new BadRequestError('Remarks required', 'VALIDATION_ERROR')

    await nb.update({ status: 'ACTIVE', updatedAt: new Date(), auditTrail: pushTrail(nb, 'Reopened', user.username, remarks) })
    await auditLog(nb.id, 'Reopened', user.id)
    res.json(successResponse('Notebook reopened', nbOut(nb)))
  } catch (err) { next(err) }
})

// GET /api/ard/notebooks/:notebookId/experiments
router.get('/:notebookId/experiments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nb = await ArdNotebook.findByPk(req.params.notebookId as string, { attributes: ['id'] })
    if (!nb) throw new NotFoundError('Notebook')

    const rows = await ArdExperiment.findAll({
      where: { notebookId: nb.id } as any,
      attributes: ['id', 'code', 'templateName', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
    })
    res.json(successResponse('Notebook experiments', {
      items: rows.map((e: any) => ({ id: e.id, code: e.code, templateName: e.templateName, status: e.status, createdAt: e.createdAt })),
      total: rows.length,
    }))
  } catch (err) { next(err) }
})

// GET /api/ard/notebooks/:notebookId/equipment
router.get('/:notebookId/equipment', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const nb = await ArdNotebook.findByPk(req.params.notebookId as string, { attributes: ['id', 'equipmentIds'] })
    if (!nb) throw new NotFoundError('Notebook')
    res.json(successResponse('Notebook equipment', { items: (nb.equipmentIds as any[]) || [] }))
  } catch (err) { next(err) }
})

// POST /api/ard/notebooks/:notebookId/equipment
router.post('/:notebookId/equipment', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isLabRole(rc)) throw new ForbiddenError('Insufficient permissions')

    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')

    const { equipmentId, equipmentCode, equipmentName } = z.object({
      equipmentId: z.string().min(1),
      equipmentCode: z.string().optional(),
      equipmentName: z.string().optional(),
    }).parse(req.body)

    const existing = (nb.equipmentIds as any[]) || []
    if (existing.some((e: any) => e.equipmentId === equipmentId)) {
      throw new BadRequestError('Equipment already linked to this notebook', 'CONFLICT')
    }

    const link = { id: uuidv4(), equipmentId, equipmentCode: equipmentCode || null, equipmentName: equipmentName || null, addedBy: user.username, addedAt: new Date().toISOString() }
    await nb.update({ equipmentIds: [...existing, link], updatedAt: new Date() })
    res.json(successResponse('Equipment linked', { items: (nb.equipmentIds as any[]) }))
  } catch (err) { next(err) }
})

// DELETE /api/ard/notebooks/:notebookId/equipment/:linkId
router.delete('/:notebookId/equipment/:linkId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isLabRole(rc) && !isAdmin(rc)) throw new ForbiddenError('Insufficient permissions')

    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) throw new NotFoundError('Notebook')

    const existing = (nb.equipmentIds as any[]) || []
    const updated = existing.filter((e: any) => e.id !== req.params.linkId)
    await nb.update({ equipmentIds: updated, updatedAt: new Date() })
    res.json(successResponse('Equipment unlinked', { items: updated }))
  } catch (err) { next(err) }
})

// GET /api/ard/notebooks/:notebookId/documents/report.pdf
router.get('/:notebookId/documents/report.pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ardNotebookReportHtml } = await import('../../utils/ardDocuments')
    const { htmlToPdf } = await import('../../utils/pdfRenderer')
    const nb = await ArdNotebook.findByPk(req.params.notebookId as string)
    if (!nb) { res.status(404).json({ success: false, message: 'Notebook not found' }); return }
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!(await canView(nb, user, rc))) throw new ForbiddenError('You are not a member of this notebook')
    const experiments = await ArdExperiment.findAll({ where: { notebookId: nb.id } })
    const html = ardNotebookReportHtml(nb.toJSON(), experiments.map(e => e.toJSON()))
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="notebook-${nb.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

export default router
