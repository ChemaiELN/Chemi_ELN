import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requireDeptPrivilege, requireAnyDeptPrivilege, userHasDeptPrivilege } from '../shared/deptPrivileges'
import { verifyPassword } from '../utils/auth.utils'
import { successResponse, listResponse, parsePagination, parseSort, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { sequelize } from '../database/connection'
import { createRequestedAtrFromExperiment } from '../shared/ardExternalRequests'
import {
  CgtProject,
  CgtProjectCodeCounter,
  CgtNotebook,
  CgtNotebookPermission,
  CgtExperiment,
  CgtExperimentAssignment,
  WorkflowTemplate,
  User,
  Role,
} from '../models/index'

const cgtRouter = Router()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYear() {
  return new Date().getFullYear()
}

function twoDigitYear(year: number) {
  return String(year).slice(-2)
}

function padSeq(seq: number, len = 5) {
  return String(seq).padStart(len, '0')
}

function buildProjectCode(year: number, seq: number) {
  return `CGT/${twoDigitYear(year)}/${padSeq(seq)}`
}

// ---------------------------------------------------------------------------
// PROJECT ROUTES
// ---------------------------------------------------------------------------

// GET /cgt-projects/hod-dashboard-stats — cheap aggregate counts for the HOD
// KPI cards, independent of the paginated/filtered project list below.
cgtRouter.get('/cgt-projects/hod-dashboard-stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const total = await CgtProject.count()
    const withNotebooks = await CgtProject.count({
      include: [{ model: CgtNotebook, as: 'notebooks', attributes: [], required: true }],
      distinct: true,
      col: 'id',
    })
    const completed = await CgtProject.count({ where: { status: { [Op.in]: ['COMPLETED', 'CLOSED'] } } })
    return res.json(successResponse('HOD dashboard stats', {
      total, with_notebooks: withNotebooks, without_notebooks: total - withNotebooks, completed,
    }))
  } catch (err) { next(err) }
})

// GET /cgt-projects/hod-dashboard — MUST be before /cgt-projects/:id
// Retained for back-compat; superseded by hod-dashboard-stats + the paginated
// /cgt-projects list (with has_notebook) for the actual table.
cgtRouter.get('/cgt-projects/hod-dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allProjects = await CgtProject.findAll({
      include: [{ model: CgtNotebook, as: 'notebooks', attributes: ['id', 'code', 'title'], required: false }],
      order: [['updatedAt', 'DESC']],
    })
    const total = allProjects.length
    const withNotebooks = allProjects.filter((p: any) => p.notebooks?.length > 0)
    const withoutNotebooks = allProjects.filter((p: any) => !p.notebooks?.length)
    const completed = allProjects.filter((p: any) => p.status === 'COMPLETED' || p.status === 'CLOSED').length
    return res.json(successResponse('HOD dashboard', {
      stats: { total, with_notebooks: withNotebooks.length, without_notebooks: withoutNotebooks.length, completed },
      recent_projects: allProjects.slice(0, 5),
      with_notebooks: withNotebooks,
      without_notebooks: withoutNotebooks,
    }))
  } catch (err) { next(err) }
})

// GET /cgt-projects
cgtRouter.get('/cgt-projects', authenticate, requireAnyDeptPrivilege(['cgt.project.view', 'cgt.project.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status: qStatus, search: qSearch, hasNotebook, has_notebook } = req.query as Record<string, string>
    const where: Record<string, any> = {}

    if (qStatus) where.status = qStatus
    if (qSearch) {
      const s = `%${qSearch}%`
      ;(where as any)[Op.or as any] = [
        { name: { [Op.iLike]: s } },
        { code: { [Op.iLike]: s } },
        { projectType: { [Op.iLike]: s } },
        { process: { [Op.iLike]: s } },
        { market: { [Op.iLike]: s } },
        { status: { [Op.iLike]: s } },
      ]
    }

    // Filters the HOD dashboard's "Notebook Created" toggle down to projects
    // that do/don't have at least one notebook — 'true'/'false' from the query string.
    const notebookFilter = hasNotebook ?? has_notebook
    if (notebookFilter === 'true') {
      where.id = { [Op.in]: sequelize.literal('(SELECT DISTINCT cgt_project_id FROM cgt_notebooks)') as any }
    } else if (notebookFilter === 'false') {
      where.id = { [Op.notIn]: sequelize.literal('(SELECT DISTINCT cgt_project_id FROM cgt_notebooks)') as any }
    }

    const order = parseSort(req.query as Record<string, unknown>, CgtProject, [['createdAt', 'DESC']])
    const { rows, count } = await CgtProject.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [{ model: CgtNotebook, as: 'notebooks', attributes: ['id', 'code', 'title'], required: false }],
      distinct: true,
    })

    return res.json(listResponse('Projects retrieved', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /cgt-projects/next-code — MUST be before /cgt-projects/:id
cgtRouter.get('/cgt-projects/next-code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = currentYear()
    const rows = await sequelize.query<{ last_seq: number }>(
      'SELECT last_seq FROM cgt_project_code_counter WHERE year = :year',
      { replacements: { year: twoDigitYear(year) }, type: QueryTypes.SELECT },
    )
    const lastSeq = rows.length > 0 ? Number(rows[0].last_seq) : 0
    const code = buildProjectCode(year, lastSeq + 1)
    return res.json(successResponse('Next code previewed', { code }))
  } catch (err) {
    next(err)
  }
})

// POST /cgt-projects
cgtRouter.post('/cgt-projects', authenticate, requireDeptPrivilege('cgt.project.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({
      name: z.string().min(1),
      product_name: z.string().optional(),
      in_house_project_id: z.string().optional(),
      project_type: z.string().optional(),
      market: z.string().optional(),
      process: z.string().optional(),
      manager_id: z.string().uuid(),
      start_date: z.string().optional(),
      target_date: z.string().optional(),
      description: z.string().optional(),
      objective: z.string().optional(),
    })
    const body = bodySchema.parse(req.body)
    const user = req.user as any
    const year = currentYear()

    const project = await sequelize.transaction(async (t) => {
      // SELECT FOR UPDATE on counter row
      // cgt_project_code_counter is keyed by `year` and has no id column.
      const counterRows = await sequelize.query<{ last_seq: number }>(
        'SELECT last_seq FROM cgt_project_code_counter WHERE year = :year FOR UPDATE',
        { replacements: { year: twoDigitYear(year) }, type: QueryTypes.SELECT, transaction: t },
      )

      let counter: any
      let newSeq: number

      if (counterRows.length === 0) {
        newSeq = 1
        counter = await CgtProjectCodeCounter.create(
          { year: twoDigitYear(year), lastSeq: newSeq },
          { transaction: t },
        )
      } else {
        const row = counterRows[0]
        newSeq = Number(row.last_seq) + 1
        await CgtProjectCodeCounter.update(
          { lastSeq: newSeq },
          { where: { year: twoDigitYear(year) }, transaction: t },
        )
      }

      const code = buildProjectCode(year, newSeq)

      return CgtProject.create(
        {
          code,
          name: body.name,
          productName: body.product_name ?? null,
          inHouseProjectId: body.in_house_project_id ?? null,
          projectType: body.project_type ?? null,
          market: body.market ?? null,
          process: body.process ?? null,
          managerId: body.manager_id,
          startDate: (body.start_date as unknown as Date) ?? null,
          targetDate: (body.target_date as unknown as Date) ?? null,
          description: body.description ?? null,
          objective: body.objective ?? null,
          status: 'ACTIVE',
          createdBy: user.id,
        },
        { transaction: t },
      )
    })

    return res.status(201).json(successResponse('Project created', project))
  } catch (err) {
    next(err)
  }
})

// GET /cgt-projects/:id
cgtRouter.get('/cgt-projects/:id', authenticate, requireAnyDeptPrivilege(['cgt.project.view', 'cgt.project.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await CgtProject.findByPk(req.params.id as string)
    if (!project) throw new NotFoundError('Project not found')
    return res.json(successResponse('Project retrieved', project))
  } catch (err) {
    next(err)
  }
})

// PATCH /cgt-projects/:id
cgtRouter.patch('/cgt-projects/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await CgtProject.findByPk(req.params.id as string)
    if (!project) throw new NotFoundError('Project not found')

    // `status` intentionally not accepted here — see the Close/Reopen/
    // Deactivate endpoints below, which own every transition.
    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
    })
    const body = bodySchema.parse(req.body)
    await project.update({
      ...(body.title !== undefined ? { name: body.title } : {}),
      description: body.description,
    })

    return res.json(successResponse('Project updated', project))
  } catch (err) {
    next(err)
  }
})

// ── Lifecycle: Close / Reopen / Deactivate ──────────────────────────────────
// Mirrors the ADC Project lifecycle in projects.routes.ts. See that file's
// comment for the full rationale.

async function verifySignaturePassword(userId: string, password: unknown) {
  if (!password || typeof password !== 'string') {
    throw new BadRequestError('password is required to sign')
  }
  const user = await User.findByPk(userId)
  if (!user || !(await verifyPassword(password, (user as any).passwordHash))) {
    throw new BadRequestError('Incorrect password')
  }
}

// Set on every CgtExperiment under a Notebook that gets closed (if not yet
// APPROVED) or deactivated (unconditionally). Blocks every mutation until
// the Notebook is reopened (Close only — Deactivate never unfreezes).
function assertNotFrozen(experiment: { frozenAt?: Date | string | null }) {
  if (experiment.frozenAt) {
    throw new BadRequestError('This experiment is frozen because its Notebook is closed or deactivated.')
  }
}

cgtRouter.post('/cgt-projects/:id/close', authenticate, requireDeptPrivilege('cgt.project.close'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await CgtProject.findByPk(req.params.id as string)
    if (!project) throw new NotFoundError('Project not found')
    if ((project as any).status !== 'ACTIVE') {
      throw new BadRequestError(`Project must be Active to close (current status: ${(project as any).status}).`)
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await project.update({ status: 'CLOSED' })
    return res.json(successResponse('Project closed.', project))
  } catch (err) {
    next(err)
  }
})

cgtRouter.post('/cgt-projects/:id/reopen', authenticate, requireDeptPrivilege('cgt.project.reopen'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await CgtProject.findByPk(req.params.id as string)
    if (!project) throw new NotFoundError('Project not found')
    if ((project as any).status !== 'CLOSED') {
      throw new BadRequestError(`Project must be Closed to reopen (current status: ${(project as any).status}).`)
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await project.update({ status: 'ACTIVE' })
    return res.json(successResponse('Project reopened.', project))
  } catch (err) {
    next(err)
  }
})

cgtRouter.post('/cgt-projects/:id/deactivate', authenticate, requireDeptPrivilege('cgt.project.deactivate'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await CgtProject.findByPk(req.params.id as string)
    if (!project) throw new NotFoundError('Project not found')
    if ((project as any).status === 'DEACTIVATED') {
      throw new BadRequestError('Project is already deactivated.')
    }

    const notebooks = await CgtNotebook.findAll({ where: { cgtProjectId: project.id }, attributes: ['id', 'status'] })
    const notDeactivated = notebooks.filter((n) => (n as any).status !== 'DEACTIVATED')
    if (notDeactivated.length > 0) {
      throw new BadRequestError(
        `Every Notebook under this Project must be deactivated first (${notDeactivated.length} not yet deactivated).`,
      )
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await project.update({ status: 'DEACTIVATED' })
    return res.json(successResponse('Project deactivated.', project))
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// NOTEBOOK ROUTES (nested under project)
// ---------------------------------------------------------------------------

// GET /cgt-projects/:id/notebooks
cgtRouter.get(
  '/cgt-projects/:id/notebooks',
  authenticate,
  requireAnyDeptPrivilege(['cgt.notebook.view', 'cgt.notebook.view_all']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type: qType, status: qStatus2 } = req.query as Record<string, string>
      const where: Record<string, any> = { cgtProjectId: req.params.id as string }
      if (qType) where.type = qType
      if (qStatus2) where.status = qStatus2

      const notebooks = await CgtNotebook.findAll({ where, order: [['createdAt', 'DESC']] })
      return res.json(successResponse('Notebooks retrieved', notebooks))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-projects/:id/notebooks
cgtRouter.post(
  '/cgt-projects/:id/notebooks',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await CgtProject.findByPk(req.params.id as string)
      if (!project) throw new NotFoundError('Project not found')
      if ((project as any).status === 'CLOSED' || (project as any).status === 'DEACTIVATED') {
        throw new BadRequestError(`Cannot create a Notebook in a ${(project as any).status.toLowerCase()} Project.`)
      }

      const bodySchema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.string().optional(),
        template_id: z.string().optional(),
        status: z.string().optional(),
      })
      const body = bodySchema.parse(req.body)
      const user = req.user as any
      const year = new Date().getFullYear()

      // Notebook code is {project_code}-NB{seq:03d}, scoped to the project — see
      // _next_nb_code() in backend/app/modules/cgt/notebooks.py:89. Numbering by a
      // project-local count under a globally-unique `code` column (the previous
      // CGT-NB-{year}-{seq} scheme) collided on the first notebook of every project.
      const parentProject = await CgtProject.findByPk(req.params.id as string)
      if (!parentProject) throw new NotFoundError('Project not found')
      const countResult = await CgtNotebook.count({ where: { cgtProjectId: req.params.id as string } })
      const code = `${(parentProject as any).code}-NB${String(countResult + 1).padStart(3, '0')}`

      let templateSnapshot: any = null
      if (body.template_id) {
        const template = await WorkflowTemplate.findByPk(body.template_id)
        if (!template) throw new NotFoundError('Workflow template not found')
        templateSnapshot = (template as any).definition
      }

      const notebook = await CgtNotebook.create({
        cgtProjectId: req.params.id as string,
        code,
        title: body.title,
        description: body.description ?? null,
        status: body.status ?? 'ACTIVE',
        templateId: body.template_id ?? null,
        templateSnapshot,
        createdBy: user.id,
      })

      return res.status(201).json(successResponse('Notebook created', notebook))
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// GLOBAL NOTEBOOK LIST
// ---------------------------------------------------------------------------

cgtRouter.get('/cgt-notebooks', authenticate, requireAnyDeptPrivilege(['cgt.notebook.view', 'cgt.notebook.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, projectId, search, hasExperiment, has_experiment } = req.query as Record<string, string>
    const where: Record<string, any> = {}
    if (status) where.status = status
    if (projectId) where.cgtProjectId = projectId
    if (search) {
      ;(where as any)[Op.or as any] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { '$project.code$': { [Op.iLike]: `%${search}%` } },
        { '$project.name$': { [Op.iLike]: `%${search}%` } },
      ]
    }

    // Filters the TL dashboard's "Experiment Created" toggle down to notebooks
    // that do/don't have at least one experiment — 'true'/'false' from the query string.
    const experimentFilter = hasExperiment ?? has_experiment
    if (experimentFilter === 'true') {
      where.id = { [Op.in]: sequelize.literal('(SELECT DISTINCT cgt_notebook_id FROM cgt_experiments)') as any }
    } else if (experimentFilter === 'false') {
      where.id = { [Op.notIn]: sequelize.literal('(SELECT DISTINCT cgt_notebook_id FROM cgt_experiments)') as any }
    }

    const order = parseSort(req.query as Record<string, unknown>, CgtNotebook, [['createdAt', 'DESC']])
    const { rows, count } = await CgtNotebook.findAndCountAll({
      where, limit, offset,
      include: [
        { model: CgtProject, as: 'project', attributes: ['id', 'code', 'name'] },
        { model: CgtExperiment, as: 'experiments', attributes: ['id', 'fullCode', 'title', 'status', 'createdAt'], required: false },
      ],
      order,
      distinct: true,
    })
    return res.json(listResponse('Notebooks retrieved', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// GET /cgt-notebooks/tl-dashboard-stats — cheap aggregate counts for the TL
// KPI cards, independent of the paginated/filtered notebook list above.
cgtRouter.get('/cgt-notebooks/tl-dashboard-stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const total = await CgtNotebook.count()
    const withExperiments = await CgtNotebook.count({
      include: [{ model: CgtExperiment, as: 'experiments', attributes: [], required: true }],
      distinct: true,
      col: 'id',
    })
    const totalExperiments = await CgtExperiment.count()
    return res.json(successResponse('TL dashboard stats', {
      total, with_experiments: withExperiments, without_experiments: total - withExperiments, total_experiments: totalExperiments,
    }))
  } catch (err) { next(err) }
})

// ---------------------------------------------------------------------------
// INDIVIDUAL NOTEBOOK ROUTES — static paths BEFORE /:id
// ---------------------------------------------------------------------------

// GET /cgt-notebooks/tl-dashboard — MUST be before /cgt-notebooks/:id
cgtRouter.get('/cgt-notebooks/tl-dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allNotebooks = await CgtNotebook.findAll({
      include: [{ model: CgtExperiment, as: 'experiments', attributes: ['id', 'fullCode', 'title', 'status', 'createdAt'], required: false }],
      order: [['updatedAt', 'DESC']],
    })
    const withExp = allNotebooks.filter((n: any) => n.experiments?.length > 0)
    const withoutExp = allNotebooks.filter((n: any) => !(n.experiments?.length > 0))
    const totalExp = allNotebooks.reduce((sum: number, n: any) => sum + ((n.CgtExperiments ?? n.experiments ?? []).length), 0)
    return res.json(successResponse('TL dashboard', {
      stats: { total: allNotebooks.length, with_experiments: withExp.length, without_experiments: withoutExp.length, total_experiments: totalExp },
      with_experiments: withExp,
      without_experiments: withoutExp,
    }))
  } catch (err) { next(err) }
})

// GET /cgt-notebooks/:id
// Not gated by requireAnyDeptPrivilege alone: a chemist has no notebook-level
// browsing privilege, only a per-experiment CgtExperimentAssignment — but the
// experiment workspace (CgtSectionPage) needs this notebook's template_snapshot
// to render at all, so an assigned chemist must still be able to fetch it.
cgtRouter.get('/cgt-notebooks/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any
    const notebookId = req.params.id as string

    const hasPrivilege = await userHasDeptPrivilege(user, 'cgt.notebook.view')
      || await userHasDeptPrivilege(user, 'cgt.notebook.view_all')
    if (!hasPrivilege) {
      const assigned = await CgtExperimentAssignment.findOne({
        where: { userId: user.id },
        include: [{ model: CgtExperiment, as: 'experiment', attributes: [], where: { cgtNotebookId: notebookId }, required: true }],
      })
      if (!assigned) throw new ForbiddenError('Insufficient privileges to view this notebook.')
    }

    const notebook = await CgtNotebook.findByPk(notebookId)
    if (!notebook) throw new NotFoundError('Notebook not found')
    return res.json(successResponse('Notebook retrieved', notebook))
  } catch (err) {
    next(err)
  }
})

// PATCH /cgt-notebooks/:id
cgtRouter.patch('/cgt-notebooks/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await CgtNotebook.findByPk(req.params.id as string)
    if (!notebook) throw new NotFoundError('Notebook not found')

    // `status` intentionally not accepted here — see Close/Reopen/Deactivate.
    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional(),
    })
    const body = bodySchema.parse(req.body)
    await notebook.update(body)

    return res.json(successResponse('Notebook updated', notebook))
  } catch (err) {
    next(err)
  }
})

// ── Lifecycle: Close / Reopen / Deactivate ──────────────────────────────────
// Mirrors ADC's notebooks.routes.ts — see that file's comment for rationale.

cgtRouter.post('/cgt-notebooks/:id/close', authenticate, requireDeptPrivilege('cgt.notebook.close'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await CgtNotebook.findByPk(req.params.id as string)
    if (!notebook) throw new NotFoundError('Notebook not found')
    if ((notebook as any).status !== 'ACTIVE') {
      throw new BadRequestError(`Notebook must be Active to close (current status: ${(notebook as any).status}).`)
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await CgtExperiment.update(
        { frozenAt: new Date() },
        { where: { cgtNotebookId: notebook.id, status: { [Op.ne]: 'APPROVED' } }, transaction: t },
      )
      await notebook.update({ status: 'CLOSED' }, { transaction: t })
    })
    return res.json(successResponse('Notebook closed.', notebook))
  } catch (err) {
    next(err)
  }
})

cgtRouter.post('/cgt-notebooks/:id/reopen', authenticate, requireDeptPrivilege('cgt.notebook.reopen'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await CgtNotebook.findByPk(req.params.id as string)
    if (!notebook) throw new NotFoundError('Notebook not found')
    if ((notebook as any).status !== 'CLOSED') {
      throw new BadRequestError(`Notebook must be Closed to reopen (current status: ${(notebook as any).status}).`)
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await CgtExperiment.update(
        { frozenAt: null },
        { where: { cgtNotebookId: notebook.id }, transaction: t },
      )
      await notebook.update({ status: 'ACTIVE' }, { transaction: t })
    })
    return res.json(successResponse('Notebook reopened.', notebook))
  } catch (err) {
    next(err)
  }
})

cgtRouter.post('/cgt-notebooks/:id/deactivate', authenticate, requireDeptPrivilege('cgt.notebook.deactivate'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await CgtNotebook.findByPk(req.params.id as string)
    if (!notebook) throw new NotFoundError('Notebook not found')
    if ((notebook as any).status === 'DEACTIVATED') {
      throw new BadRequestError('Notebook is already deactivated.')
    }

    const experimentCount = await CgtExperiment.count({ where: { cgtNotebookId: notebook.id } })
    if (experimentCount === 0) {
      throw new BadRequestError('Cannot deactivate a Notebook with no Experiments.')
    }
    await verifySignaturePassword((req.user as any).id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await CgtExperiment.update(
        { frozenAt: new Date() },
        { where: { cgtNotebookId: notebook.id }, transaction: t },
      )
      await notebook.update({ status: 'DEACTIVATED' }, { transaction: t })
    })
    return res.json(successResponse('Notebook deactivated.', notebook))
  } catch (err) {
    next(err)
  }
})

// GET /cgt-notebooks/:id/assigned-users
// Flattened to {user_id, username, emp_no, granted_at}, scoped to editors — mirrors
// backend/app/modules/cgt/notebooks.py:321-341 (no TL-role filter here, unlike the
// ADC notebook version). The raw permission rows nested the user under `.user`, so
// the assigned-TL avatar's `u.username` was always undefined.
cgtRouter.get('/cgt-notebooks/:id/assigned-users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perms = await CgtNotebookPermission.findAll({
      where: { cgtNotebookId: req.params.id as string, canEdit: true },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo'] }],
    })
    return res.json(successResponse('Assigned users', perms.map((p: any) => ({
      user_id: String(p.userId),
      username: p.user?.username ?? null,
      emp_no: p.user?.empNo ?? null,
      granted_at: p.grantedAt ? new Date(p.grantedAt).toISOString() : null,
    }))))
  } catch (err) { next(err) }
})

// POST /cgt-notebooks/:id/assign-user
cgtRouter.post(
  '/cgt-notebooks/:id/assign-user',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notebook = await CgtNotebook.findByPk(req.params.id as string)
      if (!notebook) throw new NotFoundError('Notebook not found')

      // "Assign TL" is a fixed grant, not a configurable permission set — FastAPI
      // always sets can_view/can_edit/can_submit = true regardless of the body
      // (backend/app/modules/cgt/notebooks.py:344-369). The frontend's assignUser()
      // never sends can_edit, so defaulting it to false here meant the assigned-users
      // query's `canEdit: true` filter never matched — the TL column stayed blank
      // even after a successful assignment.
      const bodySchema = z.object({ user_id: z.string() })
      const body = bodySchema.parse(req.body)
      const grantedBy = (req.user as any).id

      const [permission, created] = await CgtNotebookPermission.findOrCreate({
        where: { cgtNotebookId: req.params.id as string, userId: body.user_id },
        defaults: {
          cgtNotebookId: req.params.id as string,
          userId: body.user_id,
          canView: true,
          canEdit: true,
          canSubmit: true,
          grantedBy,
        },
      })

      if (!created) {
        await permission.update({ canView: true, canEdit: true, canSubmit: true })
      }

      return res.status(created ? 201 : 200).json(successResponse('User assigned to notebook', { ok: true }))
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /cgt-notebooks/:id/unassign/:userId
cgtRouter.delete('/cgt-notebooks/:id/unassign/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destroyed = await CgtNotebookPermission.destroy({
      where: { cgtNotebookId: req.params.id as string, userId: req.params.userId as string },
    })
    if (!destroyed) throw new NotFoundError('Permission not found')
    return res.json(successResponse('User unassigned', null))
  } catch (err) { next(err) }
})

// GET /cgt-notebooks/:id/template-snapshot
cgtRouter.get('/cgt-notebooks/:id/template-snapshot', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await CgtNotebook.findByPk(req.params.id as string)
    if (!notebook) throw new NotFoundError('Notebook not found')
    return res.json(successResponse('Template snapshot', {
      template_snapshot: (notebook as any).templateSnapshot ?? null,
      template_id: (notebook as any).templateId ?? null,
    }))
  } catch (err) { next(err) }
})

// ---------------------------------------------------------------------------
// EXPERIMENT ROUTES (nested under notebook)
// ---------------------------------------------------------------------------

// GET /cgt-notebooks/:id/experiments
cgtRouter.get(
  '/cgt-notebooks/:id/experiments',
  authenticate,
  requireAnyDeptPrivilege(['cgt.experiment.view', 'cgt.experiment.view_all']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiments = await CgtExperiment.findAll({
        where: { cgtNotebookId: req.params.id as string },
        order: [['createdAt', 'DESC']],
      })
      return res.json(successResponse('Experiments retrieved', experiments))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-notebooks/:id/experiments
cgtRouter.post(
  '/cgt-notebooks/:id/experiments',
  authenticate,
  requireDeptPrivilege('cgt.experiment.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notebook = await CgtNotebook.findByPk(req.params.id as string)
      if (!notebook) throw new NotFoundError('Notebook not found')
      if ((notebook as any).status === 'DEACTIVATED') {
        throw new BadRequestError('Cannot create an Experiment in a deactivated Notebook.')
      }

      const bodySchema = z.object({
        title: z.string().min(1),
        data: z.any().optional(),
        status: z.string().optional(),
      })
      const body = bodySchema.parse(req.body)
      const user = req.user as any

      // Find max version for this notebook
      const maxResult = await CgtExperiment.findOne({
        where: { cgtNotebookId: req.params.id as string },
        order: [['version', 'DESC']],
        attributes: ['version'],
      })
      const version = maxResult ? Number((maxResult as any).version) + 1 : 1
      const fullCode = `${(notebook as any).code}-EXP-${String(version).padStart(3, '0')}`

      const experiment = await CgtExperiment.create({
        cgtNotebookId: req.params.id as string,
        // cgt_experiments.cgt_project_id is NOT NULL — carried down from the notebook.
        cgtProjectId: (notebook as any).cgtProjectId,
        baseCode: fullCode,
        fullCode,
        title: body.title,
        status: body.status ?? 'DRAFT',
        version,
        isLatestVersion: true,
        data: body.data ?? null,
        createdBy: user.id,
      } as any)

      return res.status(201).json(successResponse('Experiment created', experiment))
    } catch (err) {
      next(err)
    }
  },
)

// ---------------------------------------------------------------------------
// GLOBAL EXPERIMENT LIST
// ---------------------------------------------------------------------------

cgtRouter.get('/cgt-experiments', authenticate, requireAnyDeptPrivilege(['cgt.experiment.view', 'cgt.experiment.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query)
    const { status, notebookId, projectId, search } = req.query as Record<string, string>
    const where: Record<string, any> = {}
    if (status) where.status = status
    if (notebookId) where.cgtNotebookId = notebookId
    if (search) {
      ;(where as any)[Op.or as any] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { fullCode: { [Op.iLike]: `%${search}%` } },
        { status: { [Op.iLike]: `%${search}%` } },
        { '$notebook.code$': { [Op.iLike]: `%${search}%` } },
        { '$notebook.title$': { [Op.iLike]: `%${search}%` } },
      ]
    }
    const notebookWhere: Record<string, any> = {}
    if (projectId) notebookWhere.cgtProjectId = projectId
    const order = parseSort(req.query as Record<string, unknown>, CgtExperiment, [['createdAt', 'DESC']])
    const { rows, count } = await CgtExperiment.findAndCountAll({
      where, limit, offset,
      include: [{
        model: CgtNotebook,
        as: 'notebook',
        attributes: ['id', 'title', 'code', 'cgtProjectId'],
        where: Object.keys(notebookWhere).length ? notebookWhere : undefined,
        required: Object.keys(notebookWhere).length > 0,
      }],
      order,
    })
    return res.json(listResponse('Experiments retrieved', rows, buildPagination(page, limit, count)))
  } catch (err) { next(err) }
})

// ---------------------------------------------------------------------------
// INDIVIDUAL EXPERIMENT ROUTES — static paths BEFORE /:id
// ---------------------------------------------------------------------------

// GET /cgt-experiments/my-dashboard — MUST be before /cgt-experiments/:id
cgtRouter.get('/cgt-experiments/my-dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user as any).id as string
    // Chemists don't create experiments — a TL/HOD assigns them via
    // CgtExperimentAssignment, so "my dashboard" must filter by assignment,
    // not by createdBy (which would always be empty for a chemist).
    const mine = await CgtExperiment.findAll({
      include: [
        { model: CgtNotebook, as: 'notebook', attributes: ['id', 'code', 'title', 'cgtProjectId'], required: false },
        { model: CgtExperimentAssignment, as: 'assignments', attributes: [], where: { userId }, required: true },
      ],
      order: [['updatedAt', 'DESC']],
    })
    const completed = mine.filter((e: any) => e.status === 'APPROVED').length
    const pending = mine.filter((e: any) => ['DRAFT', 'IN_PROGRESS', 'SUBMITTED'].includes(e.status)).length
    return res.json(successResponse('My dashboard', {
      stats: { total: mine.length, completed, pending },
      items: mine,
    }))
  } catch (err) { next(err) }
})

// GET /cgt-experiments/:id
cgtRouter.get('/cgt-experiments/:id', authenticate, requireAnyDeptPrivilege(['cgt.experiment.view', 'cgt.experiment.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await CgtExperiment.findByPk(req.params.id as string)
    if (!experiment) throw new NotFoundError('Experiment not found')
    return res.json(successResponse('Experiment retrieved', experiment))
  } catch (err) {
    next(err)
  }
})

// PATCH /cgt-experiments/:id
cgtRouter.patch('/cgt-experiments/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await CgtExperiment.findByPk(req.params.id as string)
    if (!experiment) throw new NotFoundError('Experiment not found')
    assertNotFrozen(experiment as any)

    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      data: z.record(z.any()).optional(),
    })
    const body = bodySchema.parse(req.body)

    const updates: Record<string, any> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.data !== undefined) {
      // Deep-merge into existing data
      const existing = (experiment as any).data ?? {}
      updates.data = { ...existing, ...body.data }
    }

    await experiment.update(updates)
    return res.json(successResponse('Experiment updated', experiment))
  } catch (err) {
    next(err)
  }
})

// POST /cgt-experiments/:id/submit
cgtRouter.post(
  '/cgt-experiments/:id/submit',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await CgtExperiment.findByPk(req.params.id as string)
      if (!experiment) throw new NotFoundError('Experiment not found')
      assertNotFrozen(experiment as any)
      if ((experiment as any).status !== 'DRAFT') {
        throw new BadRequestError(`Cannot submit: current status is ${(experiment as any).status}. Expected DRAFT`)
      }

      const user = req.user as any
      await experiment.update({ status: 'SUBMITTED', submittedBy: user.id, submittedAt: new Date() })
      return res.json(successResponse('Experiment submitted', experiment))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-experiments/:id/approve
cgtRouter.post(
  '/cgt-experiments/:id/approve',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await CgtExperiment.findByPk(req.params.id as string)
      if (!experiment) throw new NotFoundError('Experiment not found')
      assertNotFrozen(experiment as any)
      if ((experiment as any).status !== 'SUBMITTED') {
        throw new BadRequestError(`Cannot approve: current status is ${(experiment as any).status}. Expected SUBMITTED`)
      }

      const user = req.user as any
      const userRole = (user.role?.code ?? user.roleCode ?? '').toUpperCase()
      const APPROVER_ROLES = ['HOD', 'SUPER_ADMIN']
      if (!APPROVER_ROLES.includes(userRole)) {
        throw new ForbiddenError('Only HOD or SUPER_ADMIN can approve CGT experiments.')
      }

      await experiment.update({ status: 'APPROVED', approvedBy: user.id, approvedAt: new Date() })
      return res.json(successResponse('Experiment approved', experiment))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-experiments/:id/reject
cgtRouter.post(
  '/cgt-experiments/:id/reject',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await CgtExperiment.findByPk(req.params.id as string)
      if (!experiment) throw new NotFoundError('Experiment not found')
      assertNotFrozen(experiment as any)
      if ((experiment as any).status !== 'SUBMITTED') {
        throw new BadRequestError(`Cannot reject: current status is ${(experiment as any).status}. Expected SUBMITTED`)
      }
      const { reason } = req.body
      if (!reason) throw new BadRequestError('A rejection reason is required.')
      const user = req.user as any
      await experiment.update({ status: 'REJECTED', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: reason })
      return res.json(successResponse('Experiment rejected', experiment))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-experiments/:id/unlock
cgtRouter.post(
  '/cgt-experiments/:id/unlock',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await CgtExperiment.findByPk(req.params.id as string)
      if (!experiment) throw new NotFoundError('Experiment not found')
      assertNotFrozen(experiment as any)
      const status = (experiment as any).status
      if (status !== 'APPROVED' && status !== 'REJECTED') {
        throw new BadRequestError(`Cannot unlock: current status is ${status}. Expected APPROVED or REJECTED`)
      }
      await experiment.update({ status: 'DRAFT' })
      return res.json(successResponse('Experiment unlocked', experiment))
    } catch (err) {
      next(err)
    }
  },
)

// GET /cgt-experiments/:id/report.pdf
cgtRouter.get(
  '/cgt-experiments/:id/report.pdf',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { adcExperimentReportHtml } = await import('../utils/ardDocuments')
      const { htmlToPdf } = await import('../utils/pdfRenderer')
      const exp = await CgtExperiment.findByPk(req.params.id as string)
      if (!exp) { res.status(404).json({ success: false, message: 'Experiment not found' }); return }
      const notebook = (exp as any).cgtNotebookId ? await CgtNotebook.findByPk((exp as any).cgtNotebookId) : null
      const project = notebook && (notebook as any).cgtProjectId ? await CgtProject.findByPk((notebook as any).cgtProjectId) : null
      const html = adcExperimentReportHtml(exp.toJSON(), notebook?.toJSON() ?? {}, project?.toJSON() ?? {}, '—', '—', 'Laurus Labs')
      const pdf = await htmlToPdf(html)
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cgt-experiment-${exp.id}.pdf"` })
      res.send(pdf)
    } catch (err) { next(err) }
  },
)

// GET /cgt-experiments/:id/report/docx
cgtRouter.get('/cgt-experiments/:id/report/docx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adcExperimentReportHtml } = await import('../utils/ardDocuments')
    const { htmlToPdf } = await import('../utils/pdfRenderer')
    const exp = await CgtExperiment.findByPk(req.params.id as string)
    if (!exp) { res.status(404).json({ success: false, message: 'Experiment not found' }); return }
    const notebook = (exp as any).cgtNotebookId ? await CgtNotebook.findByPk((exp as any).cgtNotebookId) : null
    const project = notebook && (notebook as any).cgtProjectId ? await CgtProject.findByPk((notebook as any).cgtProjectId) : null
    const html = adcExperimentReportHtml(exp.toJSON(), notebook?.toJSON() ?? {}, project?.toJSON() ?? {}, '—', '—', 'Laurus Labs')
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cgt-experiment-${exp.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// GET /cgt-experiments/:id/assigned-users
cgtRouter.get(
  '/cgt-experiments/:id/assigned-users',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assignments = await CgtExperimentAssignment.findAll({
        where: { cgtExperimentId: req.params.id as string },
        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo'] }],
        order: [['grantedAt', 'DESC']],
      })
      // Flattened to {user_id, username, emp_no, granted_at} — mirrors
      // backend/app/modules/cgt/experiments.py:550-568.
      return res.json(successResponse('Assigned users', assignments.map((a: any) => ({
        user_id: String(a.userId),
        username: a.user?.username ?? null,
        emp_no: a.user?.empNo ?? null,
        granted_at: a.grantedAt ? new Date(a.grantedAt).toISOString() : null,
      }))))
    } catch (err) {
      next(err)
    }
  },
)

// POST /cgt-experiments/:id/assign-user
cgtRouter.post(
  '/cgt-experiments/:id/assign-user',
  authenticate,
  requireDeptPrivilege('cgt.experiment.assign_user'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await CgtExperiment.findByPk(req.params.id as string)
      if (!experiment) throw new NotFoundError('Experiment not found')

      const bodySchema = z.object({ user_id: z.string() })
      const body = bodySchema.parse(req.body)

      const [assignment, created] = await CgtExperimentAssignment.findOrCreate({
        where: { cgtExperimentId: req.params.id as string, userId: body.user_id },
        defaults: {
          cgtExperimentId: req.params.id as string,
          userId: body.user_id,
          grantedAt: new Date(),
        },
      })

      return res.status(created ? 201 : 200).json(
        successResponse(created ? 'User assigned to experiment' : 'User already assigned', assignment),
      )
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /cgt-experiments/:id/unassign/:userId
cgtRouter.delete('/cgt-experiments/:id/unassign/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destroyed = await CgtExperimentAssignment.destroy({
      where: { cgtExperimentId: req.params.id as string, userId: req.params.userId as string },
    })
    if (!destroyed) throw new NotFoundError('Assignment not found')
    return res.json(successResponse('User unassigned', null))
  } catch (err) { next(err) }
})

// POST /cgt-experiments/:id/atr
cgtRouter.post('/cgt-experiments/:id/atr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const exp: any = await CgtExperiment.findByPk(req.params.id as string, {
      include: [{ model: CgtNotebook, as: 'notebook', required: false }],
    })
    if (!exp) throw new NotFoundError('Experiment not found')

    const project: any = exp.cgtProjectId
      ? await CgtProject.findByPk(exp.cgtProjectId)
      : (exp.notebook?.cgtProjectId ? await CgtProject.findByPk(exp.notebook.cgtProjectId) : null)

    const { section_id: sectionId, section_title: sectionTitle, data_snapshot: snapshot } = (req.body ?? {}) as any

    const atr = await createRequestedAtrFromExperiment(req.user as any, {
      originModule: 'CGT',
      projectId: project?.id ?? null,
      projectCode: project?.code ?? null,
      projectName: project?.name ?? exp.title ?? null,
      notebookId: exp.notebook?.id ?? exp.cgtNotebookId ?? null,
      notebookCode: exp.notebook?.code ?? null,
      experimentId: exp.id,
      experimentCode: exp.fullCode ?? exp.baseCode ?? null,
      sectionId: sectionId ?? exp.sectionKey ?? null,
      sectionTitle: sectionTitle ?? null,
      snapshot: snapshot ?? null,
    })

    return res.status(201).json(successResponse('ATR form created', {
      id: (atr as any).id,
      formNo: (atr as any).formNo,
      status: (atr as any).status,
      originModule: 'CGT',
    }))
  } catch (err) { next(err) }
})

export default cgtRouter
