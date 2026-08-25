import fs from 'fs'
import path from 'path'
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { CREATOR_ROLES } from '../shared/privileges'
import { requireDeptPrivilege, requireAnyDeptPrivilege, userHasDeptPrivilege } from '../shared/deptPrivileges'
import { successResponse, listResponse, parsePagination, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { sequelize } from '../database/connection'
import { createUploader } from '../middleware/upload.middleware'
import { generateAtrNumber } from '../utils/idSequence'
import { createRequestedAtrFromExperiment } from '../shared/ardExternalRequests'
import { verifyPassword } from '../utils/auth.utils'
import { config } from '../config'
import {
  Experiment,
  ExperimentAssignment,
  ExperimentFile,
  ExperimentAtrRequest,
  ExperimentReview,
  ExperimentHistory,
  ArdAtrForm,
  Notebook,
  NotebookPermission,
  Project,
  User,
  Role,
} from '../models/index'

const router = Router()

// ── Schemas ───────────────────────────────────────────────────────────────────

const ExperimentCreateSchema = z.object({
  // The frontend posts { title, section_key? } (api/adc.ts createForNotebook).
  title: z.string().min(1).max(255),
  section_key: z.string().optional().nullable(),
  status: z.string().optional(),
  data: z.record(z.unknown()).optional().nullable(),
})

const ExperimentUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  observations: z.string().optional().nullable(),
  conclusion: z.string().optional().nullable(),
  disposition: z.string().optional().nullable(),
  schemeMol: z.string().optional().nullable(),
  data: z.record(z.unknown()).optional().nullable(),
})

const RejectSchema = z.object({ reason: z.string().min(1) })
const VoidSchema = z.object({ reason: z.string().min(1) })
const ScientistSignSchema = z.object({ reason: z.string().optional().nullable() })

const ReviewSignSchema = z.object({
  decision: z.string().min(1),
  reason: z.string().optional().nullable(),
})

// ── Global Experiment List ────────────────────────────────────────────────────

const EXPERIMENT_SORT_COLUMNS: Record<string, string> = {
  full_code: 'fullCode',
  title: 'title',
  status: 'status',
  created_at: 'createdAt',
  approved_at: 'approvedAt',
}

// Used both to filter GET /experiments by statusGroup and to compute the
// chemist dashboard's pending/completed KPI split.
const COMPLETED_EXPERIMENT_STATUSES = ['APPROVED', 'LOCKED']

// Set on every Experiment under a Notebook that gets closed (if not yet
// APPROVED) or deactivated (unconditionally) — see notebooks.routes.ts.
// Blocks every mutation until the Notebook is reopened (Close only; a
// Deactivated Notebook never unfreezes).
function assertNotFrozen(experiment: { frozenAt?: Date | string | null }) {
  if (experiment.frozenAt) {
    throw new BadRequestError('This experiment is frozen because its Notebook is closed or deactivated.')
  }
}

router.get('/experiments', authenticate, requireAnyDeptPrivilege(['adc.experiment.view', 'adc.experiment.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, sortBy, sortDir, statusGroup, assignedToTl } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const user = req.user!
    // Without adc.experiment.view_all the caller only ever sees experiments
    // assigned to them.
    const isRestricted = !(await userHasDeptPrivilege(user, 'adc.experiment.view_all'))

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    // The chemist dashboard's pending/completed toggle — "pending" isn't a
    // real status value, it's everything NOT in the completed set.
    if (statusGroup === 'completed') where.status = { [Op.in]: COMPLETED_EXPERIMENT_STATUSES }
    else if (statusGroup === 'pending') where.status = { [Op.notIn]: COMPLETED_EXPERIMENT_STATUSES }
    if (search) {
      where[Op.or as unknown as string] = ['title', 'fullCode', '$notebook.code$', '$notebook.title$', '$notebook.project.code$'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }

    // The TL dashboard's "Experiment Created" view lists experiments across
    // every notebook the TL can see — the same notebook scope as GET
    // /notebooks (permission-granted OR self-created OR full view_all), NOT
    // the assignment-based scoping below (a TL isn't necessarily assigned to
    // the experiment itself, just to its parent notebook).
    if (assignedToTl === 'true') {
      const canViewAllNotebooks = await userHasDeptPrivilege(user, 'adc.notebook.view_all')
      if (!canViewAllNotebooks) {
        const [permitted, created] = await Promise.all([
          NotebookPermission.findAll({ where: { userId: user.id, canView: true }, attributes: ['notebookId'] }),
          Notebook.findAll({ where: { createdBy: user.id }, attributes: ['id'] }),
        ])
        const notebookIds = new Set<string>([
          ...(permitted as any[]).map((p) => String(p.notebookId)),
          ...(created as any[]).map((n) => String(n.id)),
        ])
        where.notebookId = { [Op.in]: notebookIds.size ? [...notebookIds] : ['00000000-0000-0000-0000-000000000000'] }
      }
    } else if (isRestricted) {
      // Plain assignment-based scoping (chemist dashboard / general list).
      const assignments = await ExperimentAssignment.findAll({ where: { userId: user.id }, attributes: ['experimentId'] })
      where.id = { [Op.in]: assignments.map((a: any) => a.experimentId) }
    }

    const include: any[] = [
      {
        model: Notebook,
        as: 'notebook',
        attributes: ['id', 'code', 'title', 'projectId'],
        include: [{ model: Project, as: 'project', attributes: ['id', 'code', 'name'] }],
      },
    ]

    const sortColumn = EXPERIMENT_SORT_COLUMNS[sortBy] ?? 'createdAt'
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC'

    const { count, rows } = await Experiment.findAndCountAll({
      where,
      include,
      distinct: true,
      subQuery: false,
      order: [[sortColumn, direction]],
      offset,
      limit,
    })

    // Flatten the nested notebook/project associations into the flat
    // notebook_code/project_code fields ExperimentListItem declares — the
    // raw nested shape left those columns blank on every consumer (the
    // Experiments page, Reports page, and Chemist dashboard).
    const items = (rows as any[]).map((e) => {
      const plain = typeof e?.toJSON === 'function' ? e.toJSON() : { ...e }
      const notebook = plain.notebook
      const project = notebook?.project
      delete plain.notebook
      return {
        ...plain,
        notebook_code: notebook?.code ?? null,
        notebook_title: notebook?.title ?? null,
        project_code: project?.code ?? null,
        project_name: project?.name ?? null,
        created_by_name: null,
      }
    })

    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('Experiments retrieved successfully.', items, pagination))
  } catch (err) {
    next(err)
  }
})

// ── My Dashboard ──────────────────────────────────────────────────────────────

// GET /experiments already scopes itself to "my assigned experiments" for any
// caller without adc.experiment.view_all (see the isRestricted branch above),
// which is exactly what the chemist dashboard needs — so the dashboard's list
// is just that same paginated/searchable/sortable endpoint. This is only the
// lightweight KPI-card counts, computed over the caller's full assignment set
// rather than whatever page the list is currently showing.
router.get('/experiments/my-stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!
    const assignments = await ExperimentAssignment.findAll({ where: { userId: user.id }, attributes: ['experimentId'] })
    const ids = assignments.map((a: any) => a.experimentId)

    const [total, completed] = ids.length
      ? await Promise.all([
          Experiment.count({ where: { id: { [Op.in]: ids } } }),
          Experiment.count({ where: { id: { [Op.in]: ids }, status: { [Op.in]: COMPLETED_EXPERIMENT_STATUSES } } }),
        ])
      : [0, 0]

    res.json(successResponse('My dashboard stats retrieved successfully.', {
      total, completed, pending: total - completed,
    }))
  } catch (err) {
    next(err)
  }
})

// ── Notebook-scoped Experiment List ───────────────────────────────────────────

router.get('/notebooks/:notebookId/experiments', authenticate, requireAnyDeptPrivilege(['adc.experiment.view', 'adc.experiment.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = { notebookId: req.params.notebookId as string }
    if (req.query.section_key) {
      (where as any)[Op.and as any] = [
        sequelize.literal(`data->>'${req.query.section_key as string}' IS NOT NULL`),
      ]
    }

    const experiments = await Experiment.findAll({
      where,
      order: [['createdAt', 'ASC']],
    })
    res.json(successResponse('Experiments retrieved successfully.', experiments))
  } catch (err) {
    next(err)
  }
})

// ── Create Experiment ─────────────────────────────────────────────────────────

router.post('/notebooks/:notebookId/experiments', authenticate, requireDeptPrivilege('adc.experiment.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!

    const notebook = await Notebook.findByPk(req.params.notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')
    // Closed notebooks still accept new experiments — only a deactivated one
    // (or its project) blocks creation entirely.
    if ((notebook as any).status === 'DEACTIVATED') {
      throw new BadRequestError('Cannot create an Experiment in a deactivated Notebook.')
    }

    const body = ExperimentCreateSchema.parse(req.body)

    // Generate fullCode: {notebook.code}-EXP-{version padded 3 digits}
    const maxExp = await Experiment.findOne({
      where: { notebookId: req.params.notebookId as string },
      order: [['version', 'DESC']],
      attributes: ['version'],
    })
    const nextVersion = maxExp ? ((maxExp as any).version ?? 0) + 1 : 1
    const fullCode = `${(notebook as any).code}-EXP-${String(nextVersion).padStart(3, '0')}`

    const experiment = await Experiment.create({
      notebookId: req.params.notebookId as string,
      // experiments.project_id is NOT NULL — it is carried down from the notebook,
      // as FastAPI does (backend/app/modules/experiments/router.py:319).
      projectId: (notebook as any).projectId,
      baseCode: fullCode,
      fullCode,
      title: body.title,
      sectionKey: body.section_key ?? null,
      status: body.status ?? 'DRAFT',
      version: nextVersion,
      data: body.data ?? {},
      createdBy: user.id,
    } as any)

    res.status(201).json(successResponse('Experiment created successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

// ── Get Single Experiment ─────────────────────────────────────────────────────

router.get('/experiments/:expId', authenticate, requireAnyDeptPrivilege(['adc.experiment.view', 'adc.experiment.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expId = req.params.expId as string
    // Try UUID first, then fullCode
    let experiment = await Experiment.findOne({
      where: {
        [Op.or as any]: [
          { id: expId.match(/^[0-9a-f-]{36}$/i) ? expId : null },
          { fullCode: expId },
        ].filter((c: any) => Object.values(c)[0] !== null),
      },
      include: [
        {
          model: ExperimentAssignment,
          as: 'assignments',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo', 'email'] }],
        },
        { model: Notebook, as: 'notebook', attributes: ['id', 'code', 'title', 'projectId'] },
      ],
    })

    if (!experiment) throw new NotFoundError('Experiment')
    res.json(successResponse('Experiment retrieved successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

// ── Update Experiment ─────────────────────────────────────────────────────────

router.patch('/experiments/:expId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)

    const body = ExperimentUpdateSchema.parse(req.body)
    const updates: Record<string, unknown> = {}

    if (body.title !== undefined) updates.title = body.title
    if (body.observations !== undefined) updates.observations = body.observations
    if (body.conclusion !== undefined) updates.conclusion = body.conclusion
    if (body.disposition !== undefined) updates.disposition = body.disposition
    if (body.schemeMol !== undefined) updates.schemeMol = body.schemeMol

    if (body.data !== undefined && body.data !== null) {
      const existingData: Record<string, unknown> = ((experiment as any).data as Record<string, unknown>) ?? {}
      const merged: Record<string, unknown> = { ...existingData }
      for (const key of Object.keys(body.data)) {
        const existing = existingData[key]
        const incoming = (body.data as Record<string, unknown>)[key]
        if (
          existing !== null &&
          typeof existing === 'object' &&
          !Array.isArray(existing) &&
          incoming !== null &&
          typeof incoming === 'object' &&
          !Array.isArray(incoming)
        ) {
          merged[key] = { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) }
        } else {
          merged[key] = incoming
        }
      }
      updates.data = merged
    }

    await experiment.update(updates)
    res.json(successResponse('Experiment updated successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

// ── Assigned Users ────────────────────────────────────────────────────────────

router.get('/experiments/:expId/assigned-users', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const assignments = await ExperimentAssignment.findAll({
      where: { experimentId: req.params.expId as string },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo', 'email'] }],
    })
    // Flattened to {user_id, username, emp_no, granted_at} — mirrors
    // backend/app/modules/experiments/router.py:393-411. The raw assignment rows
    // nested the user under `.user`, so the UI's initials avatar always fell back to "?".
    res.json(successResponse('Assigned users retrieved successfully.', assignments.map((a: any) => ({
      user_id: String(a.userId),
      username: a.user?.username ?? null,
      emp_no: a.user?.empNo ?? null,
      granted_at: a.grantedAt ? new Date(a.grantedAt).toISOString() : null,
    }))))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/assign-user', authenticate, requireDeptPrivilege('adc.experiment.assign_user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const body = z.object({ user_id: z.string().uuid() }).parse(req.body)

    const [assignment, created] = await ExperimentAssignment.findOrCreate({
      where: { experimentId: req.params.expId as string, userId: body.user_id },
      defaults: { experimentId: req.params.expId as string, userId: body.user_id, grantedAt: new Date() },
    })

    res.status(created ? 201 : 200).json(successResponse('User assigned to experiment.', assignment))
  } catch (err) {
    next(err)
  }
})

router.delete('/experiments/:expId/unassign/:userId', authenticate, requireDeptPrivilege('adc.experiment.assign_user'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await ExperimentAssignment.destroy({
      where: { experimentId: req.params.expId as string, userId: req.params.userId as string },
    })
    if (!deleted) throw new NotFoundError('Assignment')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Workflow Transitions ──────────────────────────────────────────────────────

router.post('/experiments/:expId/submit', authenticate, requireDeptPrivilege('adc.experiment.submit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)
    if ((experiment as any).status !== 'DRAFT') {
      throw new BadRequestError('Experiment must be in DRAFT status to submit.')
    }

    await experiment.update({
      status: 'SUBMITTED',
      submittedBy: req.user!.id,
      submittedAt: new Date(),
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'SUBMITTED',
      actorId: req.user!.id,
      details: { message: 'Experiment submitted for review.' },
      createdAt: new Date(),
    })

    res.json(successResponse('Experiment submitted successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/approve', authenticate, requireDeptPrivilege('adc.experiment.approve'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)
    if ((experiment as any).status !== 'SUBMITTED') {
      throw new BadRequestError('Experiment must be in SUBMITTED status to approve.')
    }

    await experiment.update({
      status: 'APPROVED',
      approvedBy: req.user!.id,
      approvedAt: new Date(),
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'APPROVED',
      actorId: req.user!.id,
      details: { message: 'Experiment approved.' },
      createdAt: new Date(),
    })

    res.json(successResponse('Experiment approved successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/reject', authenticate, requireDeptPrivilege('adc.experiment.reject'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)
    if ((experiment as any).status !== 'SUBMITTED') {
      throw new BadRequestError('Experiment must be in SUBMITTED status to reject.')
    }

    const body = RejectSchema.parse(req.body)

    await experiment.update({
      status: 'REJECTED',
      rejectedBy: req.user!.id,
      rejectedAt: new Date(),
      rejectionReason: body.reason,
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'REJECTED',
      actorId: req.user!.id,
      details: { message: body.reason },
      createdAt: new Date(),
    })

    res.json(successResponse('Experiment rejected.', experiment))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/unlock', authenticate, requireDeptPrivilege('adc.experiment.unlock'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)
    if ((experiment as any).status !== 'APPROVED') {
      throw new BadRequestError('Experiment must be in APPROVED status to unlock.')
    }

    await experiment.update({
      status: 'UNLOCKED',
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'UNLOCKED',
      actorId: req.user!.id,
      details: { message: 'Experiment unlocked for editing.' },
      createdAt: new Date(),
    })

    res.json(successResponse('Experiment unlocked successfully.', experiment))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/void', authenticate, requireDeptPrivilege('adc.experiment.void'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)
    if ((experiment as any).status !== 'DRAFT') {
      throw new BadRequestError('Experiment must be in DRAFT status to void.')
    }

    const body = VoidSchema.parse(req.body)

    await experiment.update({
      status: 'VOID',
      voidedBy: req.user!.id,
      voidedAt: new Date(),
      voidReason: body.reason,
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'VOIDED',
      actorId: req.user!.id,
      details: { message: body.reason },
      createdAt: new Date(),
    })

    res.json(successResponse('Experiment voided.', experiment))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/scientist-sign', authenticate, requireDeptPrivilege('adc.experiment.submit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    assertNotFrozen(experiment as any)

    const body = ScientistSignSchema.parse(req.body)

    await experiment.update({
      scientistSignedAt: new Date(),
      scientistSignedBy: req.user!.id,
      scientistSignReason: body.reason ?? null,
    })

    await ExperimentHistory.create({
      experimentId: experiment.id,
      action: 'SCIENTIST_SIGNED',
      actorId: req.user!.id,
      details: { message: body.reason ?? 'Scientist signature applied.' },
      createdAt: new Date(),
    })

    res.json(successResponse('Scientist signature applied.', experiment))
  } catch (err) {
    next(err)
  }
})

// ── File Management ───────────────────────────────────────────────────────────

const fileUpload = createUploader('experiment-files')

router.get('/experiments/:expId/files', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const files = await ExperimentFile.findAll({
      where: { experimentId: req.params.expId as string },
      order: [['uploadedAt', 'DESC']],
    })
    res.json(successResponse('Experiment files retrieved successfully.', files))
  } catch (err) {
    next(err)
  }
})

router.post(
  '/experiments/:expId/files',
  authenticate,
  requireDeptPrivilege('adc.experiment.manage_files'),
  fileUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await Experiment.findByPk(req.params.expId as string)
      if (!experiment) throw new NotFoundError('Experiment')
      if (!req.file) throw new BadRequestError('No file uploaded.')

      const file = await ExperimentFile.create({
        experimentId: req.params.expId as string,
        filename: req.file.filename,
        filePath: req.file.filename,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user!.id,
      } as any)

      res.status(201).json(successResponse('File uploaded successfully.', file))
    } catch (err) {
      next(err)
    }
  },
)

router.delete('/experiments/:expId/files/:fileId', authenticate, requireDeptPrivilege('adc.experiment.manage_files'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await ExperimentFile.findOne({
      where: { id: req.params.fileId as string, experimentId: req.params.expId as string },
    })
    if (!file) throw new NotFoundError('File')

    const filePath = path.join(process.cwd(), 'uploads', 'experiment-files', (file as any).filename)
    try {
      fs.unlinkSync(filePath)
    } catch {
      // file may already be deleted; continue
    }

    await file.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Report PDF ────────────────────────────────────────────────────────────────

router.get('/experiments/:expId/report.pdf', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adcExperimentReportHtml } = await import('../utils/ardDocuments')
    const { htmlToPdf } = await import('../utils/pdfRenderer')

    const exp = await Experiment.findByPk(req.params.expId as string)
    if (!exp) { res.status(404).json({ success: false, message: 'Experiment not found' }); return }

    const notebook = exp.notebookId ? await Notebook.findByPk(exp.notebookId) : null
    const project = notebook && (notebook as any).projectId ? await Project.findByPk((notebook as any).projectId) : null

    const submitterName = exp.submittedBy ? String(exp.submittedBy) : 'Unknown'
    const approverName = (exp as any).approvedBy ? String((exp as any).approvedBy) : '—'

    const html = adcExperimentReportHtml(exp.toJSON(), notebook?.toJSON() ?? {}, project?.toJSON() ?? {}, approverName, submitterName)
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="experiment-${exp.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// GET /experiments/:expId/report/docx — same report as report.pdf above,
// under the path the frontend's AdcReportsPage actually calls
// (experimentApi.downloadReport in frontend/src/api/adc.ts). Mirrors CGT's
// identically-named /cgt-experiments/:id/report/docx (cgt.routes.ts), which
// likewise serves a PDF despite the "docx" path segment.
router.get('/experiments/:expId/report/docx', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { adcExperimentReportHtml } = await import('../utils/ardDocuments')
    const { htmlToPdf } = await import('../utils/pdfRenderer')

    const exp = await Experiment.findByPk(req.params.expId as string)
    if (!exp) { res.status(404).json({ success: false, message: 'Experiment not found' }); return }

    const notebook = exp.notebookId ? await Notebook.findByPk(exp.notebookId) : null
    const project = notebook && (notebook as any).projectId ? await Project.findByPk((notebook as any).projectId) : null

    const submitterName = exp.submittedBy ? String(exp.submittedBy) : 'Unknown'
    const approverName = (exp as any).approvedBy ? String((exp as any).approvedBy) : '—'

    const html = adcExperimentReportHtml(exp.toJSON(), notebook?.toJSON() ?? {}, project?.toJSON() ?? {}, approverName, submitterName)
    const pdf = await htmlToPdf(html)
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="experiment-${exp.id}.pdf"` })
    res.send(pdf)
  } catch (err) { next(err) }
})

// ── Clone Experiment ──────────────────────────────────────────────────────────

router.post('/experiments/:expId/clone', authenticate, requireDeptPrivilege('adc.experiment.clone'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await Experiment.findByPk(req.params.expId as string)
    if (!source) throw new NotFoundError('Experiment')

    const maxExp = await Experiment.findOne({
      where: { notebookId: (source as any).notebookId },
      order: [['version', 'DESC']],
      attributes: ['version'],
    })

    const notebook = await Notebook.findByPk((source as any).notebookId as string)
    if (!notebook) throw new NotFoundError('Notebook')

    const nextVersion = maxExp ? ((maxExp as any).version ?? 0) + 1 : 1
    const fullCode = `${(notebook as any).code}-EXP-${String(nextVersion).padStart(3, '0')}`

    const cloned = await Experiment.create({
      notebookId: (source as any).notebookId,
      baseCode: fullCode,
      fullCode,
      title: `${(source as any).title} (Clone)`,
      status: 'DRAFT',
      version: nextVersion,
      data: (source as any).data ?? {},
      createdBy: req.user!.id,
    })

    res.status(201).json(successResponse('Experiment cloned successfully.', cloned))
  } catch (err) {
    next(err)
  }
})

// ── Reviews ───────────────────────────────────────────────────────────────────

router.get('/experiments/:expId/reviews', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const reviews = await ExperimentReview.findAll({
      where: { experimentId: req.params.expId as string },
      order: [['assignedAt', 'ASC']],
    })
    res.json(successResponse('Reviews retrieved successfully.', reviews))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/reviews', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const body = z.object({ reviewer_id: z.string().uuid() }).parse(req.body)

    const reviewer = await User.findByPk(body.reviewer_id, { attributes: ['id', 'username'] })
    if (!reviewer) throw new NotFoundError('Reviewer user')

    const review = await ExperimentReview.create({
      experimentId: req.params.expId as string,
      reviewerId: body.reviewer_id,
    })

    res.status(201).json(successResponse('Review created successfully.', review))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/reviews/:reviewerId/sign', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await ExperimentReview.findOne({
      where: { experimentId: req.params.expId as string, reviewerId: req.params.reviewerId as string },
    })
    if (!review) throw new NotFoundError('Review')

    const body = ReviewSignSchema.parse(req.body)
    await review.update({
      decision: body.decision,
      signReason: body.reason ?? null,
      signedAt: new Date(),
    })

    res.json(successResponse('Review signed successfully.', review))
  } catch (err) {
    next(err)
  }
})

// ── ATR Requests ──────────────────────────────────────────────────────────────

router.get('/experiments/:expId/atr-requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const requests = await ExperimentAtrRequest.findAll({
      where: { experimentId: req.params.expId as string },
      order: [['raisedAt', 'DESC']],
    })
    res.json(successResponse('ATR requests retrieved successfully.', requests))
  } catch (err) {
    next(err)
  }
})

router.post('/experiments/:expId/atr-requests', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const atrNo = await generateAtrNumber()

    const atrRequest = await ExperimentAtrRequest.create({
      experimentId: req.params.expId as string,
      atrNo,
      status: 'PENDING',
      raisedAt: new Date(),
    })

    res.status(201).json(successResponse('ATR request created successfully.', atrRequest))
  } catch (err) {
    next(err)
  }
})

// ── ATR Complete (external AD integration — no authenticate middleware) ────────

router.post('/atr/:atrNo/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationKey = req.headers['x-adc-integration-key']
    if (integrationKey !== (config as any).ad?.integrationApiKey) {
      throw new ForbiddenError('Invalid integration key.')
    }

    const atrRequest = await ExperimentAtrRequest.findOne({
      where: { atrNo: req.params.atrNo as string },
    })
    if (!atrRequest) throw new NotFoundError('ATR request')

    await atrRequest.update({
      status: 'COMPLETED',
      completedAt: new Date(),
    })

    res.json(successResponse('ATR request marked as completed.', atrRequest))
  } catch (err) {
    next(err)
  }
})

// ---------------------------------------------------------------------------
// Endpoints the ADC frontend calls (frontend/src/api/adc.ts) that were missing.
// Paths mirror FastAPI's exp_router (backend/app/modules/experiments/router.py).
// ---------------------------------------------------------------------------

// GET /experiments/:expId/history - the experiment audit trail (router.py:1047).
router.get('/experiments/:expId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')

    const rows = await ExperimentHistory.findAll({
      where: { experimentId: req.params.expId as string },
      order: [['createdAt', 'ASC']],
    })

    // FastAPI returns a bare array of {action, actor_id, details, created_at}.
    res.json(successResponse('Experiment history retrieved successfully.', rows.map((h: any) => ({
      action: h.action,
      actor_id: h.actorId ? String(h.actorId) : null,
      details: h.details ?? null,
      created_at: h.createdAt ? new Date(h.createdAt).toISOString() : null,
    }))))
  } catch (err) {
    next(err)
  }
})

/** ATR request payload shape, mirroring _atr_dict() (router.py:783). */
function atrRequestOut(a: any, raiserName?: string | null, ardForm?: any) {
  return {
    id: String(a.id),
    experiment_id: String(a.experimentId),
    atr_no: a.atrNo,
    section_id: a.sectionId ?? null,
    section_title: a.sectionTitle ?? null,
    status: a.status,
    raised_by: a.raisedBy ? String(a.raisedBy) : null,
    raised_by_name: raiserName ?? null,
    raised_at: a.raisedAt ? new Date(a.raisedAt).toISOString() : null,
    completed_by: a.completedBy ? String(a.completedBy) : null,
    completed_at: a.completedAt ? new Date(a.completedAt).toISOString() : null,
    result_notes: a.resultNotes ?? null,
    ard_atr_id: a.ardAtrFormId ? String(a.ardAtrFormId) : null,
    ard_form_no: ardForm?.formNo ?? null,
    ard_status: ardForm?.status ?? null,
  }
}

async function decorateAtrRequests(rows: any[]) {
  const userIds = [...new Set(rows.map((r) => r.raisedBy).filter(Boolean))] as string[]
  const formIds = [...new Set(rows.map((r) => r.ardAtrFormId).filter(Boolean))] as string[]
  const users = userIds.length
    ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username'] })
    : []
  const forms = formIds.length
    ? await ArdAtrForm.findAll({ where: { id: { [Op.in]: formIds } }, attributes: ['id', 'formNo', 'status'] })
    : []
  const userMap = new Map(users.map((u: any) => [String(u.id), u.username]))
  const formMap = new Map(forms.map((f: any) => [String(f.id), f]))
  return rows.map((r) => atrRequestOut(r, userMap.get(String(r.raisedBy)), formMap.get(String(r.ardAtrFormId))))
}

// GET /experiments/:expId/atr - the frontend's path for this experiment's ATRs.
router.get('/experiments/:expId/atr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    const rows = await ExperimentAtrRequest.findAll({
      where: { experimentId: req.params.expId as string },
      order: [['raisedAt', 'DESC']],
    })
    res.json(successResponse('ATR requests retrieved successfully.', await decorateAtrRequests(rows)))
  } catch (err) {
    next(err)
  }
})

// POST /experiments/:expId/atr - raise an ATR. Creates the canonical ARD work item and
// keeps the historic experiment request row pointing at it (router.py:803-863).
router.post('/experiments/:expId/atr', authenticate, requireDeptPrivilege('adc.experiment.raise_atr'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const experiment: any = await Experiment.findByPk(req.params.expId as string)
    if (!experiment) throw new NotFoundError('Experiment')
    if (['APPROVED', 'LOCKED', 'VOID'].includes(experiment.status)) {
      throw new BadRequestError(`Cannot raise an ATR on an experiment in status '${experiment.status}'`)
    }
    assertNotFrozen(experiment as any)

    const { section_id: sectionId, section_title: sectionTitle } = (req.body ?? {}) as any
    if (!sectionId || !sectionTitle) {
      throw new BadRequestError('section_id and section_title are required.')
    }
    // Prefer the caller's in-memory snapshot: client saves are debounced, so the
    // persisted experiment data can lag what the chemist actually sees.
    const snapshot = 'data_snapshot' in (req.body ?? {})
      ? (req.body as any).data_snapshot
      : (experiment.data ?? {})[sectionId]

    const notebook: any = experiment.notebookId ? await Notebook.findByPk(experiment.notebookId) : null
    const project: any = notebook?.projectId ? await Project.findByPk(notebook.projectId) : null

    const ardForm: any = await createRequestedAtrFromExperiment(req.user as any, {
      originModule: 'ADC',
      projectId: project?.id ?? null,
      projectCode: project?.code ?? null,
      projectName: project?.productName ?? project?.name ?? experiment.title ?? null,
      notebookId: notebook?.id ?? null,
      notebookCode: notebook?.code ?? null,
      experimentId: experiment.id,
      experimentCode: experiment.fullCode ?? experiment.code ?? null,
      sectionId,
      sectionTitle,
      snapshot,
    })

    const atrRequest: any = await ExperimentAtrRequest.create({
      experimentId: experiment.id,
      atrNo: ardForm.formNo,
      sectionId,
      sectionTitle,
      dataSnapshot: snapshot ?? null,
      status: 'PENDING',
      raisedBy: (req.user as any).id,
      raisedAt: new Date(),
      ardAtrFormId: ardForm.id,
    } as any)

    try {
      await ExperimentHistory.create({
        experimentId: experiment.id,
        actorId: (req.user as any).id,
        action: 'ATR_RAISED',
        details: { section_id: sectionId, atr_no: ardForm.formNo },
      } as any)
    } catch {
      // history is best-effort
    }

    res.status(201).json(successResponse(
      'ATR raised successfully.',
      atrRequestOut(atrRequest, (req.user as any).username, ardForm),
    ))
  } catch (err) {
    next(err)
  }
})

const ATR_SORT_COLUMNS: Record<string, string> = {
  atr_no: 'atrNo',
  section_title: 'sectionTitle',
  status: 'status',
  raised_at: 'raisedAt',
}

// GET /atr - ATR requests raised by me (router.py:882). `mine` defaults to true.
router.get('/atr', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mine, status, search, sortBy, sortDir } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = {}
    if (mine !== 'false') where.raisedBy = (req.user as any).id
    if (status) where.status = status
    if (search) {
      where[Op.or as unknown as string] = ['atrNo', 'sectionTitle'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }

    const sortColumn = ATR_SORT_COLUMNS[sortBy] ?? 'raisedAt'
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC'

    const { count, rows } = await ExperimentAtrRequest.findAndCountAll({
      where,
      order: [[sortColumn, direction]],
      offset,
      limit,
    })
    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('ATR requests retrieved successfully.', await decorateAtrRequests(rows), pagination))
  } catch (err) {
    next(err)
  }
})

// GET /atr/:atrId (router.py:909)
router.get('/atr/:atrId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await ExperimentAtrRequest.findByPk(req.params.atrId as string)
    if (!row) throw new NotFoundError('ATR')
    const [decorated] = await decorateAtrRequests([row])
    res.json(successResponse('ATR retrieved successfully.', decorated))
  } catch (err) {
    next(err)
  }
})

// POST /experiments/:expId/files - upload an attachment (router.py:941).
router.post(
  '/experiments/:expId/files',
  authenticate,
  requireDeptPrivilege('adc.experiment.manage_files'),
  fileUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment = await Experiment.findByPk(req.params.expId as string)
      if (!experiment) throw new NotFoundError('Experiment')
      const file = (req as any).file
      if (!file) throw new BadRequestError('No file uploaded.')

      const record = await ExperimentFile.create({
        experimentId: req.params.expId as string,
        sectionKey: ((req.query.section_key ?? (req.body ?? {}).section_key) as string) ?? null,
        filename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        uploadedBy: (req.user as any).id,
        uploadedAt: new Date(),
      } as any)

      res.status(201).json(successResponse('File uploaded successfully.', record))
    } catch (err) {
      next(err)
    }
  },
)

// POST /experiments/:expId/sections/:sectionId/signature - sign off a section.
// Mirrors router.py:688-729: signatures are stored inside the section's own data under
// __section_signature__, the password is re-verified, and role/order rules are enforced.
const SIGNATURE_SECTION_KEY = '__section_signature__'

router.post(
  '/experiments/:expId/sections/:sectionId/signature',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const experiment: any = await Experiment.findByPk(req.params.expId as string)
      if (!experiment) throw new NotFoundError('Experiment')
      if (['APPROVED', 'LOCKED', 'VOID'].includes(experiment.status)) {
        throw new BadRequestError(`Cannot sign a section on an experiment in status '${experiment.status}'`)
      }
      assertNotFrozen(experiment as any)

      const sectionId = req.params.sectionId as string
      const { stage, password } = (req.body ?? {}) as any
      const user = req.user as any

      if (stage !== 'done' && stage !== 'checked') {
        throw new BadRequestError("stage must be 'done' or 'checked'")
      }
      if (!password) throw new BadRequestError('password is required to sign')
      if (!(await verifyPassword(password, user.passwordHash))) {
        throw new BadRequestError('Incorrect password')
      }

      // Who may perform vs review is configured per department+role rather than
      // hardcoded, so this now matches what the UI enables.
      const signPrivilege = stage === 'done'
        ? 'adc.experiment.sign_done'
        : 'adc.experiment.sign_checked'
      if (!(await userHasDeptPrivilege(user, signPrivilege))) {
        throw new ForbiddenError(
          stage === 'done'
            ? "You do not have permission to sign 'Done By'."
            : "You do not have permission to sign 'Checked By'.",
        )
      }

      const data = { ...((experiment.data as any) ?? {}) }
      const sectionData = { ...(data[sectionId] ?? {}) }
      const sig = { ...(sectionData[SIGNATURE_SECTION_KEY] ?? {}) }

      if (stage === 'checked' && !sig.doneBy) {
        throw new BadRequestError("This section must be signed 'Done By' before it can be checked.")
      }

      const key = stage === 'done' ? 'doneBy' : 'checkedBy'
      sig[key] = { user_id: String(user.id), name: user.username, at: new Date().toISOString() }
      sectionData[SIGNATURE_SECTION_KEY] = sig
      data[sectionId] = sectionData

      await experiment.update({ data, updatedAt: new Date() })

      try {
        await ExperimentHistory.create({
          experimentId: experiment.id,
          actorId: user.id,
          action: `SECTION_${String(stage).toUpperCase()}`,
          details: { section_id: sectionId },
        } as any)
      } catch {
        // history is best-effort
      }

      res.json(successResponse('Section signed successfully.', experiment))
    } catch (err) {
      next(err)
    }
  },
)

export default router
