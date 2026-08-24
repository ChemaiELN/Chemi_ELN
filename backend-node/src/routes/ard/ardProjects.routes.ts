import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse, parsePagination, buildPagination } from '../../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/errors'
import { sequelize } from '../../database/connection'
import { ArdProject, ArdProjectSpecification, ArdNotebook, ArdExperiment, ArdAuditLog } from '../../models/index'

const router = Router()

function isAdmin(rc: string) { return ['HOD', 'ADMIN', 'SUPER_ADMIN'].includes(rc) }
function isExternal(rc: string) { return ['ADC_PD', 'CGT', 'EXTERNAL'].includes(rc) }

function projectOut(p: ArdProject) {
  return {
    id: p.id, code: p.code, name: p.name, productName: p.productName,
    productCode: p.productCode, description: p.description, customer: p.customer,
    projectType: p.projectType, analysisType: p.analysisType, priority: p.priority,
    targetDate: p.targetDate, status: p.status, ownerName: p.ownerName, ownerId: p.ownerId,
    stpDocuments: p.stpDocuments, team: p.team, attributes: p.attributes, auditTrail: p.auditTrail,
    createdBy: p.createdBy, createdById: p.createdById, updatedBy: p.updatedBy,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }
}

function specOut(s: ArdProjectSpecification) {
  return {
    id: s.id, projectId: s.projectId, specCode: s.specCode, version: s.version,
    title: s.title, shortName: s.shortName, specType: s.specType, description: s.description,
    status: s.status, testParameters: s.testParameters,
    createdBy: s.createdBy, createdById: s.createdById,
    approvedBy: s.approvedBy, approvedAt: s.approvedAt,
    updatedBy: s.updatedBy,
    createdAt: s.createdAt, updatedAt: s.updatedAt,
  }
}

async function auditLog(entityId: string, action: string, userId: string | null) {
  await ArdAuditLog.create({ entityType: 'PROJECT', entityId, action, userId } as any)
}

function addAuditTrail(p: ArdProject, action: string, actorName: string, detail?: string) {
  const trail = (p.auditTrail as any[]) || []
  return [...trail, { id: uuidv4(), action, actorName, detail: detail || null, createdAt: new Date().toISOString() }]
}

// GET /api/ard/projects
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    const { status, q } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: any = {}
    if (status) where.status = status
    if (q) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${q}%` } },
        { productName: { [Op.iLike]: `%${q}%` } },
        { name: { [Op.iLike]: `%${q}%` } },
      ]
    }

    if (isExternal(rc)) {
      where[Op.or] = [
        ...(where[Op.or] || []),
        { createdById: user.id },
        sequelize.literal(`team::text LIKE '%${user.id}%'`),
      ]
    }

    const { count, rows } = await ArdProject.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] })
    res.json(listResponse('Projects', rows.map(projectOut), buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// GET /api/ard/projects/:projectId
router.get('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    const id = req.params.projectId as string

    let p = await ArdProject.findByPk(id)
    if (!p) {
      p = await ArdProject.findOne({ where: { [Op.or]: [{ code: id }, { name: id }] } })
    }
    if (!p) throw new NotFoundError('Project')

    if (isExternal(rc)) {
      const team = (p.team as any[]) || []
      const isMember = team.some((m: any) => m.userId === user.id)
      if (p.createdById !== user.id && p.ownerId !== user.id && !isMember) {
        throw new ForbiddenError('Access denied')
      }
    }

    res.json(successResponse('Project', projectOut(p)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const body = z.object({
      code: z.string().min(1),
      productName: z.string().min(1),
      name: z.string().optional(),
      productCode: z.string().optional(),
      description: z.string().optional(),
      customer: z.string().optional(),
      projectType: z.string().optional(),
      analysisType: z.string().optional(),
      priority: z.string().optional(),
      targetDate: z.string().optional(),
      ownerName: z.string().optional(),
    }).parse(req.body)

    const existing = await ArdProject.findOne({
      where: { [Op.or]: [{ code: body.code }, { productName: body.productName }] },
    })
    if (existing) throw new BadRequestError('A project with this code or product name already exists', 'CONFLICT')

    const auditTrail = [{ id: uuidv4(), action: 'CREATED', actorName: user.username, detail: null, createdAt: new Date().toISOString() }]
    const rc: string = (user?.role as any)?.code || ''
    const p = await ArdProject.create({
      ...body,
      name: body.name || body.code,
      status: 'OPEN',
      stpDocuments: [],
      // Creator is automatically a team member so they retain access/edit rights.
      team: [{ userId: user.id, userName: user.username, role: rc || 'HOD' }],
      attributes: [],
      auditTrail,
      createdBy: user.username,
      createdById: user.id,
    } as any)

    await auditLog(p.id, 'Created', user.id)
    res.status(201).json(successResponse('Project created', projectOut(p)))
  } catch (err) { next(err) }
})

// PUT /api/ard/projects/:projectId
router.put('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')

    if (req.body.code !== undefined && req.body.code !== p.code) {
      const dupe = await ArdProject.findOne({ where: { code: req.body.code, id: { [Op.ne]: p.id } } })
      if (dupe) throw new BadRequestError(`Project code "${req.body.code}" is already in use.`, 'VALIDATION_ERROR')
    }

    const updates: any = { updatedAt: new Date(), updatedBy: user.username }
    const scalars = ['code', 'name', 'productName', 'productCode', 'description', 'customer', 'projectType', 'analysisType', 'priority', 'targetDate', 'ownerName']
    scalars.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })
    const jsonFields = ['stpDocuments', 'team', 'attributes']
    jsonFields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k] })

    if (req.body.auditTrail !== undefined) {
      updates.auditTrail = req.body.auditTrail
    } else {
      updates.auditTrail = addAuditTrail(p, 'UPDATED', user.username)
    }

    await p.update(updates)
    await auditLog(p.id, 'Updated', user.id)
    res.json(successResponse('Project updated', projectOut(p)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/close
router.post('/:projectId/close', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can close projects')

    const reason = req.body.reason || req.body.remarks
    if (!reason) throw new BadRequestError('Reason is required', 'VALIDATION_ERROR')

    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')

    // Check for unapproved experiments
    const notebooks = await ArdNotebook.findAll({ where: { projectId: p.id }, attributes: ['id'] })
    const nbIds = notebooks.map((n: any) => n.id)
    const activeWhere: any = { status: { [Op.notIn]: ['APPROVED', 'VERIFIED', 'CLOSED', 'DEACTIVATED'] } }
    if (nbIds.length > 0) {
      activeWhere[Op.or] = [{ projectId: p.id }, { notebookId: { [Op.in]: nbIds } }]
    } else {
      activeWhere.projectId = p.id
    }
    const unapproved = await ArdExperiment.count({ where: activeWhere })
    if (unapproved > 0) throw new BadRequestError('Cannot close project with unapproved experiments', 'VALIDATION_ERROR')

    await p.update({ status: 'CLOSED', auditTrail: addAuditTrail(p, 'CLOSED', user.username, reason), updatedAt: new Date() })
    // Close linked notebooks
    await ArdNotebook.update({ status: 'CLOSED', updatedAt: new Date() } as any, { where: { projectId: p.id, status: 'OPEN' } as any })
    await auditLog(p.id, 'Closed', user.id)
    res.json(successResponse('Project closed', projectOut(p)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/deactivate
router.post('/:projectId/deactivate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can deactivate projects')

    const reason = req.body.reason
    if (!reason) throw new BadRequestError('Reason is required', 'VALIDATION_ERROR')

    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')

    const nbCount = await ArdNotebook.count({ where: { projectId: p.id } as any })
    if (nbCount > 0) throw new BadRequestError('Cannot deactivate project with linked notebooks', 'VALIDATION_ERROR')

    await p.update({ status: 'DEACTIVATED', auditTrail: addAuditTrail(p, 'DEACTIVATED', user.username, reason), updatedAt: new Date() })
    await auditLog(p.id, 'Deactivated', user.id)
    res.json(successResponse('Project deactivated', projectOut(p)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/reopen
router.post('/:projectId/reopen', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')

    const reason = req.body.reason || req.body.remarks
    await p.update({ status: 'OPEN', auditTrail: addAuditTrail(p, 'REOPENED', user.username, reason || null), updatedAt: new Date() })

    // Reopen linked notebooks and experiments
    await ArdNotebook.update({ status: 'OPEN', updatedAt: new Date() } as any, { where: { projectId: p.id, status: { [Op.in]: ['CLOSED', 'ARCHIVED'] } } as any })
    const notebooks = await ArdNotebook.findAll({ where: { projectId: p.id }, attributes: ['id'] })
    const nbIds = notebooks.map((n: any) => n.id)
    if (nbIds.length > 0) {
      await ArdExperiment.update({ status: 'IN_PROGRESS', updatedAt: new Date() } as any, {
        where: { notebookId: { [Op.in]: nbIds }, status: { [Op.in]: ['CLOSED', 'DEACTIVATED'] } } as any,
      })
    }
    await auditLog(p.id, 'Reopened', user.id)
    res.json(successResponse('Project reopened', projectOut(p)))
  } catch (err) { next(err) }
})

// DELETE /api/ard/projects/:projectId
router.delete('/:projectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can delete projects')

    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')

    await auditLog(p.id, 'Deleted', user.id)
    await p.destroy()
    res.status(204).send()
  } catch (err) { next(err) }
})

// ── Specifications ────────────────────────────────────────────────────────────

// GET /api/ard/projects/:projectId/specifications
router.get('/:projectId/specifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await ArdProjectSpecification.findAll({
      where: { projectId: req.params.projectId as string },
      order: [['createdAt', 'DESC']],
    })
    res.json(successResponse('Specifications', rows.map(specOut)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/specifications
router.post('/:projectId/specifications', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const projectId = req.params.projectId as string
    const p = await ArdProject.findByPk(projectId, { attributes: ['id', 'code'] })
    if (!p) throw new NotFoundError('Project')

    const { specCode, title, version, shortName, specType, description, testParameters } = z.object({
      specCode: z.string().optional(),
      title: z.string().min(1),
      version: z.string().optional(),
      shortName: z.string().optional(),
      specType: z.string().optional(),
      description: z.string().optional(),
      testParameters: z.array(z.any()).optional(),
    }).parse(req.body)

    const code = specCode || `SPEC-${p.code}-${uuidv4().replace(/-/g, '').slice(0, 4).toUpperCase()}`
    const s = await ArdProjectSpecification.create({
      projectId,
      specCode: code,
      title,
      version: version || '1.0',
      shortName: shortName || null,
      specType: specType || null,
      description: description || null,
      status: 'DRAFT',
      testParameters: testParameters || [],
      createdBy: user.username,
      createdById: user.id,
    } as any)
    res.status(201).json(successResponse('Specification created', specOut(s)))
  } catch (err) { next(err) }
})

// PUT /api/ard/projects/:projectId/specifications/:specId
router.put('/:projectId/specifications/:specId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const s = await ArdProjectSpecification.findOne({
      where: { id: req.params.specId as string, projectId: req.params.projectId as string },
    })
    if (!s) throw new NotFoundError('Specification')
    if (s.status === 'APPROVED') throw new BadRequestError('Cannot edit an approved specification', 'INVALID_STATE')

    const user = (req as any).user
    const updates: any = { updatedAt: new Date(), updatedBy: user.username }
    if (req.body.title !== undefined) updates.title = req.body.title
    if (req.body.version !== undefined) updates.version = req.body.version
    if (req.body.shortName !== undefined) updates.shortName = req.body.shortName || null
    if (req.body.specType !== undefined) updates.specType = req.body.specType || null
    if (req.body.description !== undefined) updates.description = req.body.description || null
    if (req.body.testParameters !== undefined) updates.testParameters = req.body.testParameters
    await s.update(updates)
    res.json(successResponse('Specification updated', specOut(s)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/specifications/:specId/submit
router.post('/:projectId/specifications/:specId/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const s = await ArdProjectSpecification.findOne({
      where: { id: req.params.specId as string, projectId: req.params.projectId as string },
    })
    if (!s) throw new NotFoundError('Specification')

    if (s.createdById !== user.id && !['HOD', 'ADMIN', 'SUPER_ADMIN'].includes((user?.role as any)?.code || '')) {
      throw new ForbiddenError('Access denied')
    }
    const params = (s.testParameters as any[]) || []
    if (params.length === 0) throw new BadRequestError('At least one test parameter is required', 'VALIDATION_ERROR')

    await s.update({ status: 'SUBMITTED', updatedAt: new Date() })
    res.json(successResponse('Specification submitted', specOut(s)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/specifications/:specId/approve
router.post('/:projectId/specifications/:specId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can approve specifications')

    const s = await ArdProjectSpecification.findOne({
      where: { id: req.params.specId as string, projectId: req.params.projectId as string },
    })
    if (!s) throw new NotFoundError('Specification')
    if (s.createdById === user.id) throw new ForbiddenError('Creator cannot approve their own specification')

    await s.update({ status: 'APPROVED', approvedBy: user.username, approvedAt: new Date(), updatedAt: new Date() })
    res.json(successResponse('Specification approved', specOut(s)))
  } catch (err) { next(err) }
})

// DELETE /api/ard/projects/:projectId/specifications/:specId
router.delete('/:projectId/specifications/:specId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can delete specifications')

    const s = await ArdProjectSpecification.findOne({
      where: { id: req.params.specId as string, projectId: req.params.projectId as string },
    })
    if (!s) throw new NotFoundError('Specification')
    await s.destroy()
    res.status(204).send()
  } catch (err) { next(err) }
})

// ── STP Workflow ──────────────────────────────────────────────────────────────

async function updateStp(projectId: string, stpId: string, patch: Partial<Record<string, any>>) {
  const p = await ArdProject.findByPk(projectId)
  if (!p) throw new NotFoundError('Project')
  const stps = (p.stpDocuments as any[]) || []
  const idx = stps.findIndex((s: any) => s.id === stpId)
  if (idx === -1) throw new NotFoundError('STP document')
  stps[idx] = { ...stps[idx], ...patch, updatedAt: new Date().toISOString() }
  await p.update({ stpDocuments: stps, updatedAt: new Date() })
  return p
}

// POST /api/ard/projects/:projectId/stps/:stpId/submit
router.post('/:projectId/stps/:stpId/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')
    const stps = (p.stpDocuments as any[]) || []
    const stp = stps.find((s: any) => s.id === req.params.stpId)
    if (!stp) throw new NotFoundError('STP document')
    if (!['DRAFT', 'RETURNED'].includes(stp.status)) throw new BadRequestError(`Cannot submit from ${stp.status}`, 'INVALID_STATE')

    const updated = await updateStp(p.id, req.params.stpId as string, {
      status: 'SUBMITTED',
      submittedBy: user.username,
      submittedAt: new Date().toISOString(),
    })
    res.json(successResponse('STP submitted', projectOut(updated)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/stps/:stpId/approve
router.post('/:projectId/stps/:stpId/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can approve STPs')

    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')
    const stps = (p.stpDocuments as any[]) || []
    const stp = stps.find((s: any) => s.id === req.params.stpId)
    if (!stp) throw new NotFoundError('STP document')
    if (stp.status !== 'SUBMITTED') throw new BadRequestError('STP must be SUBMITTED to approve', 'INVALID_STATE')
    if (stp.submittedBy === user.username) throw new ForbiddenError('Submitter cannot approve their own STP')

    // Supersede any other approved STP with same documentNo
    const updatedStps = stps.map((s: any) => {
      if (s.id !== stp.id && s.documentNo === stp.documentNo && s.status === 'APPROVED') {
        return { ...s, status: 'SUPERSEDED', updatedAt: new Date().toISOString() }
      }
      return s
    })
    const idx = updatedStps.findIndex((s: any) => s.id === req.params.stpId)
    updatedStps[idx] = {
      ...updatedStps[idx],
      status: 'APPROVED',
      approvedBy: user.username,
      approvedAt: new Date().toISOString(),
      effectiveDate: req.body.effectiveDate || new Date().toISOString().split('T')[0],
      remarks: req.body.remarks || null,
      updatedAt: new Date().toISOString(),
    }
    await p.update({ stpDocuments: updatedStps, updatedAt: new Date() })
    res.json(successResponse('STP approved', projectOut(p)))
  } catch (err) { next(err) }
})

// POST /api/ard/projects/:projectId/stps/:stpId/return
router.post('/:projectId/stps/:stpId/return', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    const rc: string = (user?.role as any)?.code || ''
    if (!isAdmin(rc)) throw new ForbiddenError('Only HOD/Admin can return STPs')

    const p = await ArdProject.findByPk(req.params.projectId as string)
    if (!p) throw new NotFoundError('Project')
    const stps = (p.stpDocuments as any[]) || []
    const stp = stps.find((s: any) => s.id === req.params.stpId)
    if (!stp) throw new NotFoundError('STP document')
    if (stp.status !== 'SUBMITTED') throw new BadRequestError('STP must be SUBMITTED to return', 'INVALID_STATE')

    const updated = await updateStp(p.id, req.params.stpId as string, {
      status: 'RETURNED',
      returnedBy: user.username,
      returnReason: req.body.reason || null,
    })
    res.json(successResponse('STP returned', projectOut(updated)))
  } catch (err) { next(err) }
})

export default router
