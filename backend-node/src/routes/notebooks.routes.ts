import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requireDeptPrivilege, requireAnyDeptPrivilege, userHasDeptPrivilege } from '../shared/deptPrivileges'
import { verifyPassword } from '../utils/auth.utils'
import { successResponse, listResponse, parsePagination, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { sequelize } from '../database/connection'
import {
  Notebook,
  NotebookPermission,
  Experiment,
  ExperimentAssignment,
  Project,
  WorkflowTemplate,
  User,
  Role,
} from '../models/index'

const router = Router()

/**
 * Flatten the eager-loaded `project` association into the scalar project_code /
 * project_name fields the frontend declares (see the Notebook interface in
 * frontend/src/api/adc.ts:150-151). The nested object is kept off the payload.
 */
function flattenNotebook(notebook: any): Record<string, unknown> {
  const plain = typeof notebook?.toJSON === 'function' ? notebook.toJSON() : { ...notebook }
  const project = plain.project
  delete plain.project
  const out: Record<string, unknown> = {
    ...plain,
    project_code: project?.code ?? null,
    project_name: project?.name ?? null,
  }
  // experimentCount only present when the list query requested it (raw SQL
  // literal attribute) — replaces the old tl-dashboard's full nested
  // `experiments[]` array with a plain count badge.
  if (plain.experimentCount !== undefined) {
    out.experiment_count = Number(plain.experimentCount ?? 0)
    delete out.experimentCount
  }
  return out
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const NotebookCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  type: z.string().optional(),
  template_id: z.string().uuid().optional().nullable(),
  status: z.string().optional(),
})

const NotebookUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
})

const AssignUserSchema = z.object({
  user_id: z.string().uuid(),
  permissions: z.object({
    can_view: z.boolean().optional(),
    can_edit: z.boolean().optional(),
    can_submit: z.boolean().optional(),
    can_approve: z.boolean().optional(),
  }).optional(),
})

// ── Project-scoped notebook list ──────────────────────────────────────────────

const NOTEBOOK_SORT_COLUMNS: Record<string, string> = {
  code: 'code',
  title: 'title',
  status: 'status',
  created_at: 'createdAt',
}

router.get('/projects/:projectId/notebooks', authenticate, requireAnyDeptPrivilege(['adc.notebook.view', 'adc.notebook.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, sortBy, sortDir } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = { projectId: req.params.projectId as string }
    if (req.query.type) where.type = req.query.type as string
    if (req.query.status) where.status = req.query.status as string
    if (search) {
      where[Op.or as unknown as string] = ['code', 'title'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }

    const sortColumn = NOTEBOOK_SORT_COLUMNS[sortBy] ?? 'createdAt'
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC'

    const { count, rows } = await Notebook.findAndCountAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'code', 'name'] },
      ],
      order: [[sortColumn, direction]],
      offset,
      limit,
    })
    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('Notebooks retrieved successfully.', rows.map(flattenNotebook), pagination))
  } catch (err) {
    next(err)
  }
})

// ── Create Notebook ───────────────────────────────────────────────────────────

router.post('/projects/:projectId/notebooks', authenticate, requireDeptPrivilege('adc.notebook.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!

    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')
    if (project.status === 'CLOSED' || project.status === 'DEACTIVATED') {
      throw new BadRequestError(`Cannot create a Notebook in a ${project.status.toLowerCase()} Project.`)
    }

    const body = NotebookCreateSchema.parse(req.body)

    // Auto-generate notebook code: NB-{YY}-{5-digit-seq}
    const year = new Date().getFullYear()
    const shortYear = String(year).slice(-2)

    const maxResult = await Notebook.findOne({
      where: sequelize.literal(`code LIKE 'NB-${shortYear}-%'`) as any,
      order: [['createdAt', 'DESC']],
      attributes: ['code'],
    })

    let nextSeq = 1
    if (maxResult) {
      const parts = ((maxResult as any).code as string).split('-')
      const lastNum = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(lastNum)) nextSeq = lastNum + 1
    }

    const code = `NB-${shortYear}-${String(nextSeq).padStart(5, '0')}`

    // Fetch template snapshot if template_id provided
    let templateSnapshot: Record<string, unknown> | null = null
    if (body.template_id) {
      const template = await WorkflowTemplate.findByPk(body.template_id)
      if (!template) throw new NotFoundError('Workflow template')
      templateSnapshot = (template as any).definition ?? null
    }

    const notebook = await Notebook.create({
      projectId: req.params.projectId as string,
      code,
      title: body.title,
      description: body.description ?? null,
      type: body.type ?? 'GENERAL',
      status: body.status ?? 'ACTIVE',
      templateId: body.template_id ?? null,
      templateSnapshot,
      createdBy: user.id,
    })

    res.status(201).json(successResponse('Notebook created successfully.', notebook))
  } catch (err) {
    next(err)
  }
})

// ── Global Notebook List ──────────────────────────────────────────────────────

const GLOBAL_NOTEBOOK_SORT_COLUMNS: Record<string, string> = {
  code: 'code',
  title: 'title',
  status: 'status',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
}

router.get('/notebooks', authenticate, requireAnyDeptPrivilege(['adc.notebook.view', 'adc.notebook.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, status, project_id, assigned_to_me, hasExperiments, sortBy, sortDir } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const user = req.user!
    // Without adc.notebook.view_all the caller only ever sees notebooks they have
    // been granted view permission on.
    const isRestricted = !(await userHasDeptPrivilege(user, 'adc.notebook.view_all'))

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (project_id) where.projectId = project_id
    if (search) {
      where[Op.or as unknown as string] = ['title', 'code'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }

    const andConditions: unknown[] = []
    if (hasExperiments === 'true') {
      andConditions.push({ id: { [Op.in]: sequelize.literal('(SELECT DISTINCT notebook_id FROM experiments)') as any } })
    } else if (hasExperiments === 'false') {
      andConditions.push({ id: { [Op.notIn]: sequelize.literal('(SELECT DISTINCT notebook_id FROM experiments)') as any } })
    }

    // A notebook is in scope if the caller has an explicit view permission on
    // it, OR they created it themselves — a TL who creates a notebook (rare,
    // but happens) shouldn't lose sight of it just because nobody granted
    // them a permission row on their own notebook. Mirrors what tl-dashboard
    // used to do via a required-join-plus-fallback-query pattern.
    if (isRestricted || assigned_to_me === 'true') {
      const [permitted, created] = await Promise.all([
        NotebookPermission.findAll({ where: { userId: user.id, canView: true }, attributes: ['notebookId'] }),
        Notebook.findAll({ where: { createdBy: user.id }, attributes: ['id'] }),
      ])
      const ids = new Set<string>([
        ...(permitted as any[]).map((p) => String(p.notebookId)),
        ...(created as any[]).map((n) => String(n.id)),
      ])
      andConditions.push({ id: { [Op.in]: [...ids] } })
    }
    if (andConditions.length) where[Op.and as any] = andConditions

    const sortColumn = GLOBAL_NOTEBOOK_SORT_COLUMNS[sortBy] ?? 'createdAt'
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC'

    const { count, rows } = await Notebook.findAndCountAll({
      where,
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM experiments WHERE experiments.notebook_id = "Notebook".id)'), 'experimentCount'],
        ],
      },
      include: [
        { model: Project, as: 'project', attributes: ['id', 'code', 'name'] },
      ],
      distinct: true,
      order: [[sortColumn, direction]],
      offset,
      limit,
    })

    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('Notebooks retrieved successfully.', rows.map(flattenNotebook), pagination))
  } catch (err) {
    next(err)
  }
})

// ── TL Dashboard ──────────────────────────────────────────────────────────────

/**
 * Resolves which notebook ids a TL is scoped to: every notebook if they hold
 * adc.notebook.view_all, otherwise notebooks they have an explicit view
 * permission on OR created themselves. Shared by tl-stats and
 * tl-experiment-summary so the two endpoints can't drift out of sync with
 * each other (or with the identical scoping in GET /notebooks above).
 */
async function resolveTlNotebookIds(user: { id: string }): Promise<string[] | null> {
  const canViewAll = await userHasDeptPrivilege(user as any, 'adc.notebook.view_all')
  if (canViewAll) return null
  const [permitted, created] = await Promise.all([
    NotebookPermission.findAll({ where: { userId: user.id, canView: true }, attributes: ['notebookId'] }),
    Notebook.findAll({ where: { createdBy: user.id }, attributes: ['id'] }),
  ])
  const ids = new Set<string>([
    ...(permitted as any[]).map((p) => String(p.notebookId)),
    ...(created as any[]).map((n) => String(n.id)),
  ])
  return [...ids]
}

// GET /notebooks/tl-stats — lightweight KPI counts for the TL dashboard.
router.get('/notebooks/tl-stats', authenticate, requireDeptPrivilege('adc.dashboard.tl'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebookIds = await resolveTlNotebookIds(req.user!)
    // An empty (but non-null) scope means "restricted TL with zero notebooks" —
    // use an impossible id so `Op.in: []` doesn't get interpreted as "no filter".
    const scopeIds = notebookIds && !notebookIds.length ? ['00000000-0000-0000-0000-000000000000'] : notebookIds

    const [total, withExperiments, totalExperiments] = await Promise.all([
      Notebook.count({ where: scopeIds ? { id: { [Op.in]: scopeIds } } : {} }),
      Notebook.count({
        where: {
          ...(scopeIds ? { id: { [Op.in]: scopeIds } } : {}),
          [Op.and]: [{ id: { [Op.in]: sequelize.literal('(SELECT DISTINCT notebook_id FROM experiments)') as any } }],
        },
      }),
      Experiment.count({ where: scopeIds ? { notebookId: { [Op.in]: scopeIds } } : {} }),
    ])

    res.json(successResponse('TL dashboard stats retrieved successfully.', {
      total, with_experiments: withExperiments, without_experiments: total - withExperiments, total_experiments: totalExperiments,
    }))
  } catch (err) {
    next(err)
  }
})

// GET /notebooks/tl-experiment-summary — per-chemist experiment counts across
// the TL's notebook scope, for the "with experiments" view's analytics panel.
// This has to stay a dedicated aggregate query rather than something the
// frontend derives from a page of results: the panel needs counts over the
// TL's ENTIRE scope, not just whatever page the notebooks table currently
// shows, and it existed before pagination purely as a client-side reduction
// over the (previously unbounded) full experiment list.
router.get('/notebooks/tl-experiment-summary', authenticate, requireDeptPrivilege('adc.dashboard.tl'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromDate, toDate } = req.query as Record<string, string>
    const notebookIds = await resolveTlNotebookIds(req.user!)

    const where: Record<string, unknown> = notebookIds ? { notebookId: { [Op.in]: notebookIds } } : {}
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) (where.createdAt as any)[Op.gte] = new Date(fromDate)
      if (toDate) (where.createdAt as any)[Op.lte] = new Date(toDate)
    }

    const experiments = notebookIds && !notebookIds.length ? [] : await Experiment.findAll({
      where,
      attributes: ['id', 'fullCode', 'title', 'status', 'createdAt', 'notebookId'],
      include: [{ model: ExperimentAssignment, as: 'assignments', attributes: ['userId'] }],
    })

    const userIds = new Set<string>()
    for (const e of experiments as any[]) {
      for (const a of e.assignments ?? []) userIds.add(String(a.userId))
    }
    const users = userIds.size
      ? await User.findAll({ where: { id: { [Op.in]: [...userIds] } }, attributes: ['id', 'username'] })
      : []
    const usernameById = new Map((users as any[]).map((u) => [String(u.id), u.username]))

    const byUser = new Map<string, { user_id: string; username: string | null; experiments: any[] }>()
    for (const e of experiments as any[]) {
      const row = { id: e.id, code: e.fullCode, title: e.title, status: e.status, created_at: e.createdAt }
      for (const a of e.assignments ?? []) {
        const uid = String(a.userId)
        const entry = byUser.get(uid) ?? { user_id: uid, username: usernameById.get(uid) ?? null, experiments: [] as any[] }
        entry.experiments.push(row)
        byUser.set(uid, entry)
      }
    }

    const summary = [...byUser.values()]
      .map((u) => ({ ...u, count: u.experiments.length }))
      .sort((a, b) => b.count - a.count)

    res.json(successResponse('TL experiment summary retrieved successfully.', summary))
  } catch (err) {
    next(err)
  }
})

// ── Single Notebook ───────────────────────────────────────────────────────────

router.get('/notebooks/:notebookId', authenticate, requireAnyDeptPrivilege(['adc.notebook.view', 'adc.notebook.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string, {
      include: [
        { model: Project, as: 'project', attributes: ['id', 'code', 'name', 'status'] },
        { model: NotebookPermission, as: 'permissions' },
      ],
    })
    if (!notebook) throw new NotFoundError('Notebook')
    // Keep `permissions` (the detail view needs it) but flatten the project into the
    // scalar project_code / project_name the frontend declares.
    const plain: any = flattenNotebook(notebook)
    plain.permissions = (notebook as any).permissions ?? []
    res.json(successResponse('Notebook retrieved successfully.', plain))
  } catch (err) {
    next(err)
  }
})

// ── Update Notebook ───────────────────────────────────────────────────────────

router.patch('/notebooks/:notebookId', authenticate, requireDeptPrivilege('adc.notebook.edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')

    // `status` is intentionally NOT accepted here — it now moves only through
    // the dedicated close/reopen/deactivate endpoints below, which carry the
    // precondition checks and password signature the lifecycle requires.
    const body = NotebookUpdateSchema.parse(req.body)
    const updates: Record<string, unknown> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description

    await notebook.update(updates)
    res.json(successResponse('Notebook updated successfully.', notebook))
  } catch (err) {
    next(err)
  }
})

// ── Lifecycle: Close / Reopen / Deactivate ──────────────────────────────────
// Mirrors the Project lifecycle in projects.routes.ts. Closing a Notebook
// still allows new Experiments to be created in it, but freezes every
// Experiment not yet APPROVED (the caller is expected to have already warned
// the user this will happen). Reopening unfreezes them again. Deactivating
// requires at least one Experiment to exist, freezes ALL of them regardless
// of status, and — unlike Close — has no way back.

async function verifySignaturePassword(userId: string, password: unknown) {
  if (!password || typeof password !== 'string') {
    throw new BadRequestError('password is required to sign')
  }
  const user = await User.findByPk(userId)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new BadRequestError('Incorrect password')
  }
}

router.post('/notebooks/:notebookId/close', authenticate, requireDeptPrivilege('adc.notebook.close'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')
    if (notebook.status !== 'ACTIVE') {
      throw new BadRequestError(`Notebook must be Active to close (current status: ${notebook.status}).`)
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await Experiment.update(
        { frozenAt: new Date() },
        { where: { notebookId: notebook.id, status: { [Op.ne]: 'APPROVED' } }, transaction: t },
      )
      await notebook.update({ status: 'CLOSED' }, { transaction: t })
    })
    res.json(successResponse('Notebook closed.', notebook))
  } catch (err) {
    next(err)
  }
})

router.post('/notebooks/:notebookId/reopen', authenticate, requireDeptPrivilege('adc.notebook.reopen'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')
    if (notebook.status !== 'CLOSED') {
      throw new BadRequestError(`Notebook must be Closed to reopen (current status: ${notebook.status}).`)
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await Experiment.update(
        { frozenAt: null },
        { where: { notebookId: notebook.id }, transaction: t },
      )
      await notebook.update({ status: 'ACTIVE' }, { transaction: t })
    })
    res.json(successResponse('Notebook reopened.', notebook))
  } catch (err) {
    next(err)
  }
})

router.post('/notebooks/:notebookId/deactivate', authenticate, requireDeptPrivilege('adc.notebook.deactivate'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')
    if (notebook.status === 'DEACTIVATED') {
      throw new BadRequestError('Notebook is already deactivated.')
    }

    const experimentCount = await Experiment.count({ where: { notebookId: notebook.id } })
    if (experimentCount === 0) {
      throw new BadRequestError('Cannot deactivate a Notebook with no Experiments.')
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await sequelize.transaction(async (t) => {
      await Experiment.update(
        { frozenAt: new Date() },
        { where: { notebookId: notebook.id }, transaction: t },
      )
      await notebook.update({ status: 'DEACTIVATED' }, { transaction: t })
    })
    res.json(successResponse('Notebook deactivated.', notebook))
  } catch (err) {
    next(err)
  }
})

// ── Template Snapshot ─────────────────────────────────────────────────────────

router.get('/notebooks/:notebookId/template-snapshot', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string, {
      attributes: ['id', 'code', 'templateSnapshot'],
    })
    if (!notebook) throw new NotFoundError('Notebook')
    res.json(successResponse('Template snapshot retrieved successfully.', (notebook as any).templateSnapshot ?? null))
  } catch (err) {
    next(err)
  }
})

// ── Assigned Users ────────────────────────────────────────────────────────────

// This column is specifically "Assigned TL" (see AdcProjectDetailPage.tsx:203) — a
// NotebookPermission row can (today) hold non-TL editors too, so FastAPI also joins
// Role and requires code == 'TL' (backend/app/modules/notebooks/router.py:337-361).
// The response is flattened to {user_id, username, emp_no, granted_at}; returning the
// raw permission rows left `username` nested under `.user`, so the cell's
// `u.username` was always undefined and rendered the "?" fallback avatar.
router.get('/notebooks/:notebookId/assigned-users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')

    const permissions = await NotebookPermission.findAll({
      where: { notebookId: req.params.notebookId as string, canEdit: true },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'empNo'],
        required: true,
        include: [{ model: Role, as: 'role', attributes: ['code'], where: { code: 'TL' }, required: true }],
      }],
    })

    res.json(successResponse('Assigned users retrieved successfully.', permissions.map((p: any) => ({
      user_id: String(p.userId),
      username: p.user?.username ?? null,
      emp_no: p.user?.empNo ?? null,
      granted_at: p.grantedAt ? new Date(p.grantedAt).toISOString() : null,
    }))))
  } catch (err) {
    next(err)
  }
})

// "Assign TL" is a fixed grant, not a configurable permission set: FastAPI always
// sets can_view/can_edit/can_submit = true regardless of any `permissions` in the
// body (backend/app/modules/notebooks/router.py:371-398). The previous Node version
// read `body.permissions` and defaulted can_edit to FALSE when absent — since the
// frontend's assignUser() never sends a permissions object, every TL assignment was
// created with can_edit: false and so never matched the assigned-users query's
// `canEdit: true` filter, leaving the "Assigned TL" column blank even after a
// successful assignment.
router.post('/notebooks/:notebookId/assign-user', authenticate, requireDeptPrivilege('adc.notebook.assign_user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')

    const body = AssignUserSchema.parse(req.body)
    const grantedBy = (req.user as any).id

    const [perm, created] = await NotebookPermission.findOrCreate({
      where: { notebookId: req.params.notebookId as string, userId: body.user_id },
      defaults: {
        notebookId: req.params.notebookId as string,
        userId: body.user_id,
        canView: true,
        canEdit: true,
        canSubmit: true,
        grantedBy,
      },
    })

    if (!created) {
      await perm.update({ canView: true, canEdit: true, canSubmit: true })
    }

    res.status(created ? 201 : 200).json(successResponse('User permission upserted successfully.', { ok: true }))
  } catch (err) {
    next(err)
  }
})

router.delete('/notebooks/:notebookId/unassign/:userId', authenticate, requireDeptPrivilege('adc.notebook.assign_user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await NotebookPermission.destroy({
      where: { notebookId: req.params.notebookId as string, userId: req.params.userId as string },
    })
    if (!deleted) throw new NotFoundError('Notebook permission')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
