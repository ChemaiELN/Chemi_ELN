import fs from 'fs'
import path from 'path'
import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege, userHasPrivilege, CREATOR_ROLES } from '../shared/privileges'
import { requireDeptPrivilege, requireAnyDeptPrivilege, userHasDeptPrivilege } from '../shared/deptPrivileges'
import { verifyPassword } from '../utils/auth.utils'
import { successResponse, listResponse, parsePagination, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { sequelize } from '../database/connection'
import { createUploader } from '../middleware/upload.middleware'
import {
  Project,
  ProjectCodeCounter,
  ProjectUser,
  Route,
  ProjectAttachment,
  ProjectRiskAssessment,
  ProjectRiskRow,
  User,
  Role,
  Department,
  Notebook,
} from '../models/index'

const router = Router()

/**
 * Flatten the eager-loaded `creator` / `department` associations into the scalar fields
 * the frontend declares (created_by_name, department_name — see the Project interface in
 * frontend/src/api/adc.ts). `created_by` stays the raw UUID.
 */
function flattenProject(project: any): Record<string, unknown> {
  const plain = typeof project?.toJSON === 'function' ? project.toJSON() : { ...project }
  const creator = plain.creator
  const department = plain.department
  delete plain.creator
  const out: Record<string, unknown> = {
    ...plain,
    created_by_name: creator?.username ?? null,
    department_name: department?.name ?? plain.department_name ?? null,
  }
  // notebookCount only present when the list endpoint requested it (raw SQL
  // literal attribute) — replaces the old hod-dashboard's full nested
  // `notebooks[]` array so a row-count badge doesn't require loading every
  // child notebook into memory just to display "3 Notebooks".
  if (plain.notebookCount !== undefined) {
    out.notebook_count = Number(plain.notebookCount ?? 0)
    delete out.notebookCount
  }
  return out
}

// ── Schemas ───────────────────────────────────────────────────────────────────

// The ADC project form posts `name` plus the wider ADC field set (see the Form.Item
// names in frontend/src/pages/adc/AdcProjectsPage.tsx and FastAPI's create_project at
// backend/app/modules/projects/router.py:274-304). `title` is accepted as an alias so
// older callers keep working.
const ProjectFieldsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  product_name: z.string().optional().nullable(),
  in_house_project_id: z.string().optional().nullable(),
  project_type: z.string().optional().nullable(),
  market: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
  start_date: z.string().optional().nullable(),
  target_date: z.string().optional().nullable(),
  status: z.string().optional(),
  description: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  customer: z.string().optional().nullable(),
  adc_code: z.string().optional().nullable(),
  target_antigen: z.string().optional().nullable(),
  antibody_clone: z.string().optional().nullable(),
  payload: z.string().optional().nullable(),
  linker: z.string().optional().nullable(),
  target_dar: z.string().optional().nullable(),
  project_stage: z.string().optional().nullable(),
  qa_review_required: z.boolean().optional().nullable(),
  oel_band: z.string().optional().nullable(),
  containment_category: z.string().optional().nullable(),
  gmp_non_gmp: z.string().optional().nullable(),
}).passthrough()

const ProjectCreateSchema = ProjectFieldsSchema
const ProjectUpdateSchema = ProjectFieldsSchema

/** Map the snake_case request body onto model attributes, skipping absent keys. */
const PROJECT_FIELD_MAP: Record<string, string> = {
  product_name: 'productName',
  in_house_project_id: 'inHouseProjectId',
  project_type: 'projectType',
  market: 'market',
  manager_id: 'managerId',
  start_date: 'startDate',
  target_date: 'targetDate',
  description: 'description',
  objective: 'objective',
  remarks: 'remarks',
  customer: 'customer',
  adc_code: 'adcCode',
  target_antigen: 'targetAntigen',
  antibody_clone: 'antibodyClone',
  payload: 'payload',
  linker: 'linker',
  target_dar: 'targetDar',
  project_stage: 'projectStage',
  qa_review_required: 'qaReviewRequired',
  oel_band: 'oelBand',
  containment_category: 'containmentCategory',
  gmp_non_gmp: 'gmpNonGmp',
}

// `status` deliberately never passes through here — see the Close/Reopen/
// Deactivate endpoints below, which own every status transition (precondition
// checks + password signature) instead of a free-form field on this generic
// create/update path.
function projectFieldsFromBody(body: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, attr] of Object.entries(PROJECT_FIELD_MAP)) {
    if (body[key] !== undefined) out[attr] = body[key]
  }
  const projectName = body.name ?? body.title
  if (projectName !== undefined) out.name = projectName
  return out
}

const MemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.string().min(1),
})

const RiskAssessmentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
})

const RiskRowSchema = z.object({
  hazard: z.string().min(1),
  likelihood: z.string().min(1),
  severity: z.number(),
  riskLevel: z.string().min(1),
  mitigation: z.string().optional().nullable(),
})

// ── HOD Dashboard ─────────────────────────────────────────────────────────────
// The combined {stats, with_notebooks, without_notebooks} endpoint that used
// to live here has been split into GET /hod-stats (below) for the KPI cards
// and GET / with department_code=ADC_PD&has_notebooks=... for the paginated
// project list — see AdcPdHodDashboard.tsx / AdcPdHodProjectsPage.tsx.

// GET /projects/hod-stats — lightweight KPI counts for the HOD dashboard,
// same ADC_PD department scope as hod-dashboard used to compute inline. Kept
// as its own endpoint so the dashboard's KPI cards don't require pulling
// every project into memory just to count them.
router.get('/hod-stats', authenticate, requireDeptPrivilege('adc.dashboard.hod'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adcPd = await Department.findOne({ where: { code: 'ADC_PD' } })
    const departmentId = adcPd ? (adcPd as any).id : '00000000-0000-0000-0000-000000000000'

    const [total, withNotebooks, completed] = await Promise.all([
      Project.count({ where: { departmentId } }),
      Project.count({
        where: {
          departmentId,
          id: { [Op.in]: sequelize.literal('(SELECT DISTINCT project_id FROM notebooks)') as any },
        },
      }),
      Project.count({ where: { departmentId, status: { [Op.in]: ['COMPLETED', 'Completed', 'ARCHIVED', 'Archived'] } } }),
    ])

    res.json(successResponse('HOD dashboard stats retrieved successfully.', {
      total, with_notebooks: withNotebooks, without_notebooks: total - withNotebooks, completed,
    }))
  } catch (err) {
    next(err)
  }
})

// ── Next Code Preview ─────────────────────────────────────────────────────────

router.get('/next-code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = new Date().getFullYear()
    const shortYear = String(year).slice(-2)

    const rows = await sequelize.query(
      'SELECT last_seq FROM project_code_counter WHERE year = :year',
      { replacements: { year: shortYear }, type: 'SELECT' as any },
    ) as any[]

    const lastSeq: number = rows.length > 0 ? (rows[0].last_seq ?? 0) : 0
    const nextSeq = String(lastSeq + 1).padStart(5, '0')
    const code = `ADC/${shortYear}/${nextSeq}`

    res.json(successResponse('Next project code retrieved successfully.', { code }))
  } catch (err) {
    next(err)
  }
})

// ── List Projects ─────────────────────────────────────────────────────────────

// Frontend dataIndex -> Sequelize order clause. created_by sorts through the
// `creator` association (username), everything else is a plain column.
const PROJECT_SORT_COLUMNS: Record<string, any> = {
  code: 'code',
  name: 'name',
  project_type: 'projectType',
  market: 'market',
  created_at: 'createdAt',
  status: 'status',
  created_by_name: [{ model: User, as: 'creator' }, 'username'],
}

router.get('/', authenticate, requireAnyDeptPrivilege(['adc.project.view', 'adc.project.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, search, assigned_only, sortBy, sortDir, departmentCode, hasNotebooks } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where[Op.or as unknown as string] = ['name', 'code', 'projectType', 'market', '$creator.username$'].map((f) => ({
        [f]: { [Op.iLike]: `%${search}%` },
      }))
    }
    const andConditions: unknown[] = []
    if (hasNotebooks === 'true') {
      andConditions.push({ id: { [Op.in]: sequelize.literal('(SELECT DISTINCT project_id FROM notebooks)') as any } })
    } else if (hasNotebooks === 'false') {
      andConditions.push({ id: { [Op.notIn]: sequelize.literal('(SELECT DISTINCT project_id FROM notebooks)') as any } })
    }

    // departmentCode is the HOD-dashboard scope — "every project in my
    // department", not "projects I'm personally assigned to". Gated behind
    // the same privilege the old combined hod-dashboard endpoint required,
    // so a caller can't use it to bypass the normal assigned-only visibility
    // rule below.
    let usedDepartmentScope = false
    if (departmentCode) {
      const canUseDeptScope = await userHasDeptPrivilege(req.user!, 'adc.dashboard.hod')
      if (canUseDeptScope) {
        const dept = await Department.findOne({ where: { code: departmentCode } })
        where.departmentId = dept ? (dept as any).id : '00000000-0000-0000-0000-000000000000'
        usedDepartmentScope = true
      }
    }

    // Users without adc.project.view_all only ever see projects they're assigned
    // to, regardless of what the client asks for. The explicit assigned_only flag
    // still lets a privileged user narrow the list voluntarily. Department-scoped
    // requests (HOD dashboard) intentionally skip this — that scope IS the access rule.
    if (!usedDepartmentScope) {
      const canViewAll = await userHasDeptPrivilege(req.user!, 'adc.project.view_all')
      if (!canViewAll || assigned_only === 'true') {
        const assignments = await ProjectUser.findAll({ where: { userId: req.user!.id }, attributes: ['projectId'] })
        const ids = assignments.map((a: any) => a.projectId)
        andConditions.push({ id: { [Op.in]: ids } })
      }
    }
    if (andConditions.length) where[Op.and as any] = andConditions

    const sortColumn = PROJECT_SORT_COLUMNS[sortBy] ?? 'createdAt'
    const direction = sortDir === 'asc' ? 'ASC' : 'DESC'
    const order: any[] = Array.isArray(sortColumn) ? [[...sortColumn, direction]] : [[sortColumn, direction]]

    const { count, rows } = await Project.findAndCountAll({
      where,
      attributes: {
        include: [
          [sequelize.literal('(SELECT COUNT(*) FROM notebooks WHERE notebooks.project_id = "Project".id)'), 'notebookCount'],
        ],
      },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'empNo', 'email'] },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
      ],
      order,
      offset,
      limit,
      subQuery: false,
    })

    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('Projects retrieved successfully.', rows.map(flattenProject), pagination))
  } catch (err) {
    next(err)
  }
})

// ── Create Project ────────────────────────────────────────────────────────────

router.post('/', authenticate, requireDeptPrivilege('adc.project.create'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!
    const body = ProjectCreateSchema.parse(req.body)

    const year = new Date().getFullYear()
    const shortYear = String(year).slice(-2)

    const project = await sequelize.transaction(async (t) => {
      // SELECT FOR UPDATE
      const [counter, created] = await ProjectCodeCounter.findOrCreate({
        where: { year: shortYear },
        defaults: { year: shortYear, lastSeq: 0 },
        lock: true,
        transaction: t,
      })

      const newSeq = (counter as any).lastSeq + 1
      await counter.update({ lastSeq: newSeq }, { transaction: t })

      const code = `ADC/${shortYear}/${String(newSeq).padStart(5, '0')}`

      // ADC projects are owned by the ADC PD department regardless of who creates
      // them (QA does the creating) — router.py:266-269.
      const adcPdDept = await Department.findOne({ where: { code: 'ADC_PD' } })

      const p = await Project.create(
        {
          code,
          ...projectFieldsFromBody(body as any),
          status: 'ACTIVE',
          departmentId: (adcPdDept as any)?.id ?? user.departmentId,
          createdBy: user.id,
        } as any,
        { transaction: t },
      )

      return p
    })

    res.status(201).json(successResponse('Project created successfully.', project))
  } catch (err) {
    next(err)
  }
})

// ── Get Single Project ────────────────────────────────────────────────────────

router.get('/:projectId', authenticate, requireAnyDeptPrivilege(['adc.project.view', 'adc.project.view_all']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string, {
      include: [
        {
          model: ProjectUser,
          as: 'members',
          include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo', 'email'] }],
        },
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'username', 'empNo', 'email'] },
      ],
    })
    if (!project) throw new NotFoundError('Project')
    res.json(successResponse('Project retrieved successfully.', flattenProject(project)))
  } catch (err) {
    next(err)
  }
})

// ── Update Project ────────────────────────────────────────────────────────────

router.patch('/:projectId', authenticate, requireDeptPrivilege('adc.project.edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')

    const body = ProjectUpdateSchema.parse(req.body)
    // Project has no `title` attribute — the display name is `name`. Writing to
    // `title` here meant edits were silently dropped.
    await project.update(projectFieldsFromBody(body as any))
    res.json(successResponse('Project updated successfully.', project))
  } catch (err) {
    next(err)
  }
})

// ── Lifecycle: Close / Reopen / Deactivate ──────────────────────────────────
// Replaces the old free-form status dropdown (ACTIVE/ON_HOLD/COMPLETED/
// CANCELLED/ARCHIVED — never enforced, only ACTIVE was ever actually set)
// with a real three-state model: ACTIVE -> CLOSED (reversible, blocks new
// Notebooks under it) -> DEACTIVATED (permanent, requires every Notebook
// under it to already be deactivated). Every transition requires the
// caller's own password as an e-signature, same pattern as the experiment
// submit/approve/reject signatures.

async function verifySignaturePassword(userId: string, password: unknown) {
  if (!password || typeof password !== 'string') {
    throw new BadRequestError('password is required to sign')
  }
  const user = await User.findByPk(userId)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new BadRequestError('Incorrect password')
  }
}

router.post('/:projectId/close', authenticate, requireDeptPrivilege('adc.project.close'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')
    if (project.status !== 'ACTIVE') {
      throw new BadRequestError(`Project must be Active to close (current status: ${project.status}).`)
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await project.update({ status: 'CLOSED' })
    res.json(successResponse('Project closed.', project))
  } catch (err) {
    next(err)
  }
})

router.post('/:projectId/reopen', authenticate, requireDeptPrivilege('adc.project.reopen'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')
    if (project.status !== 'CLOSED') {
      throw new BadRequestError(`Project must be Closed to reopen (current status: ${project.status}).`)
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await project.update({ status: 'ACTIVE' })
    res.json(successResponse('Project reopened.', project))
  } catch (err) {
    next(err)
  }
})

router.post('/:projectId/deactivate', authenticate, requireDeptPrivilege('adc.project.deactivate'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')
    if (project.status === 'DEACTIVATED') {
      throw new BadRequestError('Project is already deactivated.')
    }

    const notebooks = await Notebook.findAll({ where: { projectId: project.id }, attributes: ['id', 'status'] })
    const notDeactivated = notebooks.filter((n) => n.status !== 'DEACTIVATED')
    if (notDeactivated.length > 0) {
      throw new BadRequestError(
        `Every Notebook under this Project must be deactivated first (${notDeactivated.length} not yet deactivated).`,
      )
    }
    await verifySignaturePassword(req.user!.id, (req.body ?? {}).password)

    await project.update({ status: 'DEACTIVATED' })
    res.json(successResponse('Project deactivated.', project))
  } catch (err) {
    next(err)
  }
})

// ── Members ───────────────────────────────────────────────────────────────────

router.get('/:projectId/members', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await ProjectUser.findAll({
      where: { projectId: req.params.projectId as string },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'empNo', 'email'] }],
    })
    res.json(successResponse('Project members retrieved successfully.', members))
  } catch (err) {
    next(err)
  }
})

router.post('/:projectId/members', authenticate, requireDeptPrivilege('adc.project.manage_members'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')

    const body = MemberSchema.parse(req.body)

    const [member, created] = await ProjectUser.findOrCreate({
      where: { projectId: req.params.projectId as string, userId: body.user_id },
      defaults: { projectId: req.params.projectId as string, userId: body.user_id, role: body.role },
    })

    if (!created) {
      await member.update({ role: body.role })
    }

    res.status(created ? 201 : 200).json(successResponse('Project member upserted successfully.', member))
  } catch (err) {
    next(err)
  }
})

router.delete('/:projectId/members/:userId', authenticate, requireDeptPrivilege('adc.project.manage_members'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await ProjectUser.destroy({
      where: { projectId: req.params.projectId as string, userId: req.params.userId as string },
    })
    if (!deleted) throw new NotFoundError('Project member')
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Routes (Synthesis) ────────────────────────────────────────────────────────

router.get('/:projectId/routes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')
    const routes = await Route.findAll({
      where: { projectId: req.params.projectId as string },
      order: [['createdAt', 'ASC']],
    })
    res.json(successResponse('Project routes retrieved successfully.', routes))
  } catch (err) {
    next(err)
  }
})

// ── Attachments ───────────────────────────────────────────────────────────────

const attachmentUpload = createUploader('project-attachments')

router.get('/:projectId/attachments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachments = await ProjectAttachment.findAll({
      where: { projectId: req.params.projectId as string },
      order: [['uploadedAt', 'DESC']],
    })
    res.json(successResponse('Project attachments retrieved successfully.', attachments))
  } catch (err) {
    next(err)
  }
})

router.post(
  '/:projectId/attachments',
  authenticate,
  requireDeptPrivilege('adc.project.manage_attachments'),
  attachmentUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await Project.findByPk(req.params.projectId as string)
      if (!project) throw new NotFoundError('Project')
      if (!req.file) throw new BadRequestError('No file uploaded.')

      const attachment = await ProjectAttachment.create({
        projectId: req.params.projectId as string,
        filename: req.file.filename,
        filePath: req.file.filename,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedBy: req.user!.id,
      } as any)

      res.status(201).json(successResponse('Attachment uploaded successfully.', attachment))
    } catch (err) {
      next(err)
    }
  },
)

router.delete('/:projectId/attachments/:attachId', authenticate, requireDeptPrivilege('adc.project.manage_attachments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await ProjectAttachment.findOne({
      where: { id: req.params.attachId as string, projectId: req.params.projectId as string },
    })
    if (!attachment) throw new NotFoundError('Attachment')

    const filePath = path.join(process.cwd(), 'uploads', 'project-attachments', (attachment as any).filename)
    try {
      fs.unlinkSync(filePath)
    } catch {
      // file may already be deleted; continue
    }

    await attachment.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Risk Assessment ───────────────────────────────────────────────────────────

router.get('/:projectId/risk-assessment', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ra = await ProjectRiskAssessment.findOne({
      where: { projectId: req.params.projectId as string },
      include: [{ model: ProjectRiskRow, as: 'rows', order: [['createdAt', 'ASC']] }],
    })
    res.json(successResponse('Risk assessment retrieved successfully.', ra ?? null))
  } catch (err) {
    next(err)
  }
})

router.put('/:projectId/risk-assessment', authenticate, requireDeptPrivilege('adc.project.risk_assessment_edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findByPk(req.params.projectId as string)
    if (!project) throw new NotFoundError('Project')

    const body = RiskAssessmentSchema.parse(req.body)

    const [ra, created] = await ProjectRiskAssessment.findOrCreate({
      where: { projectId: req.params.projectId as string },
      defaults: { projectId: req.params.projectId as string, ...(body as Record<string, unknown>) } as any,
    })

    if (!created) {
      await ra.update(body as any)
    }

    res.status(created ? 201 : 200).json(successResponse('Risk assessment saved successfully.', ra))
  } catch (err) {
    next(err)
  }
})

router.post('/:projectId/risk-assessment/rows', authenticate, requireDeptPrivilege('adc.project.risk_assessment_edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ra = await ProjectRiskAssessment.findOne({ where: { projectId: req.params.projectId as string } })
    if (!ra) throw new NotFoundError('Risk assessment')

    const body = RiskRowSchema.parse(req.body)
    const row = await ProjectRiskRow.create({
      assessmentId: (ra as any).id,
      severity: body.severity,
      mitigation: body.mitigation ?? null,
    } as any)

    res.status(201).json(successResponse('Risk row created successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.patch('/:projectId/risk-assessment/rows/:rowId', authenticate, requireDeptPrivilege('adc.project.risk_assessment_edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await ProjectRiskRow.findByPk(req.params.rowId as string)
    if (!row) throw new NotFoundError('Risk row')

    const body = RiskRowSchema.partial().parse(req.body)
    await row.update(body as any)

    res.json(successResponse('Risk row updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

router.delete('/:projectId/risk-assessment/rows/:rowId', authenticate, requireDeptPrivilege('adc.project.risk_assessment_edit'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await ProjectRiskRow.findByPk(req.params.rowId as string)
    if (!row) throw new NotFoundError('Risk row')
    await row.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
