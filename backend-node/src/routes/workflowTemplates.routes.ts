import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import multer from 'multer'
import { authenticate } from '../middleware/auth.middleware'
import { userHasPrivilege } from '../shared/privileges'
import { userHasDeptPrivilege } from '../shared/deptPrivileges'
import { successResponse, listResponse, parsePagination, buildPagination } from '../utils/response'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { convertXlsx } from '../utils/xlsxImport'
import { revalidateSubmission } from '../utils/calcRevalidate'
import {
  WorkflowTemplate,
  WorkflowTemplateVersion,
  CalcSheetTemplate,
  CalcSheetTemplateVersion,
} from '../models/index'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// Both Workflow Templates and Calc Templates are now scoped per module (ADC
// vs CGT) rather than living under a shared Admin page. The 'CGT_' prefix on
// workflow_template categories is a historical naming artifact of the shared
// Template Builder UI, NOT a department marker — 'CGT_ADC' is ADC's own "ADC
// Synthesis" modality, authored with that same builder. Mirrors
// frontend/src/pages/admin/templateBuilder/TemplateBuilderPage.tsx's
// MODALITIES list — keep the two in sync.
const CGT_CATEGORIES = new Set(['CGT_PLASMID', 'CGT_AAV', 'CGT_MOLBIO', 'CALC_CGT'])
function moduleFromCategory(category?: string | null): 'ADC' | 'CGT' {
  return category && CGT_CATEGORIES.has(category.toUpperCase()) ? 'CGT' : 'ADC'
}

// Manage access is granted either by the legacy global 'admin.settings' role
// privilege, or by the department-scoped, per-module, per-template-type
// privilege configured on the Department Role Privileges page
// (adc/cgt.workflow_templates.manage, adc/cgt.calc_templates.manage) — so a
// department can grant Workflow Templates without also granting Calc
// Templates (or vice versa), independent of the HOD dashboard privilege.
function requireTemplateManage<T extends { category: string | null }>(
  model: { findByPk: (id: string) => Promise<T | null> },
  source: 'body' | 'existing',
  kind: 'workflow_templates' | 'calc_templates',
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      if (await userHasPrivilege(user, 'admin.settings')) return next()

      let category: string | null | undefined
      if (source === 'body') {
        category = (req.body as { category?: string | null }).category
      } else {
        const row = await model.findByPk(req.params.templateId as string)
        category = row?.category
      }

      const key = `${moduleFromCategory(category).toLowerCase()}.${kind}.manage`
      if (await userHasDeptPrivilege(user, key)) return next()
      throw new ForbiddenError('You do not have permission to manage templates for this module.')
    } catch (err) {
      next(err)
    }
  }
}

// ── Workflow Templates ────────────────────────────────────────────────────────

const workflowTemplateRouter = Router()

const WfSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  // Independent of is_active/Publish: whether this template is offered as an
  // option in the "Create Notebook" modal's Workflow Template picker.
  show_in_notebook_dropdown: z.boolean().optional(),
  definition: z.record(z.unknown()).optional().nullable(),
})

// GET /api/workflow-templates
workflowTemplateRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    if (req.query.category) where.category = req.query.category as string
    if (req.query.scope === 'CGT') where.category = { [Op.in]: [...CGT_CATEGORIES] }
    else if (req.query.scope === 'ADC') where.category = { [Op.or]: [{ [Op.notIn]: [...CGT_CATEGORIES] }, { [Op.is]: null }] }
    if (req.query.is_active !== undefined) where.isActive = req.query.is_active === 'true'
    const rows = await WorkflowTemplate.findAll({ where, order: [['createdAt', 'DESC']] })
    res.json(successResponse('Workflow templates retrieved successfully.', rows))
  } catch (err) {
    next(err)
  }
})

// GET /api/workflow-templates/:templateId
workflowTemplateRouter.get('/:templateId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await WorkflowTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Workflow template')
    res.json(successResponse('Workflow template retrieved successfully.', tmpl))
  } catch (err) {
    next(err)
  }
})

// POST /api/workflow-templates
workflowTemplateRouter.post(
  '/',
  authenticate,
  requireTemplateManage(WorkflowTemplate, 'body', 'workflow_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = WfSchema.parse(req.body)
      const tmpl = await WorkflowTemplate.create({
        name: body.name,
        slug: body.slug,
        description: body.description ?? null,
        category: body.category ?? null,
        isActive: body.is_active ?? true,
        showInNotebookDropdown: body.show_in_notebook_dropdown ?? true,
        definition: body.definition ?? null,
        createdBy: req.user!.id,
      })
      await WorkflowTemplateVersion.create({
        templateId: tmpl.id,
        version: 1,
        definition: body.definition ?? null,
        savedBy: req.user!.id,
        savedAt: new Date(),
      })
      res.status(201).json(successResponse('Workflow template created successfully.', tmpl))
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /api/workflow-templates/:templateId
workflowTemplateRouter.patch(
  '/:templateId',
  authenticate,
  requireTemplateManage(WorkflowTemplate, 'existing', 'workflow_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tmpl = await WorkflowTemplate.findByPk(req.params.templateId as string)
      if (!tmpl) throw new NotFoundError('Workflow template')
      const body = WfSchema.partial().parse(req.body)

      const prevVersion: number = (tmpl as any).version ?? 1
      const updates: Record<string, unknown> = {}
      if (body.name !== undefined) updates.name = body.name
      if (body.description !== undefined) updates.description = body.description
      if (body.category !== undefined) updates.category = body.category
      if (body.is_active !== undefined) updates.isActive = body.is_active
      if (body.show_in_notebook_dropdown !== undefined) updates.showInNotebookDropdown = body.show_in_notebook_dropdown
      if (body.definition !== undefined) {
        updates.definition = body.definition
        updates.version = prevVersion + 1
      }

      await tmpl.update(updates)

      if (body.definition !== undefined) {
        await WorkflowTemplateVersion.create({
          templateId: tmpl.id,
          version: (tmpl as any).version,
          definition: body.definition ?? null,
          savedBy: req.user!.id,
          savedAt: new Date(),
        })
      }

      res.json(successResponse('Workflow template updated successfully.', tmpl))
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /api/workflow-templates/:templateId  (soft delete)
workflowTemplateRouter.delete(
  '/:templateId',
  authenticate,
  requireTemplateManage(WorkflowTemplate, 'existing', 'workflow_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tmpl = await WorkflowTemplate.findByPk(req.params.templateId as string)
      if (!tmpl) throw new NotFoundError('Workflow template')
      await tmpl.update({ isActive: false })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
)

// GET /api/workflow-templates/:templateId/versions
workflowTemplateRouter.get('/:templateId/versions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await WorkflowTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Workflow template')
    const versions = await WorkflowTemplateVersion.findAll({
      where: { templateId: tmpl.id },
      order: [['version', 'DESC']],
    })
    res.json(successResponse('Workflow template versions retrieved successfully.', versions))
  } catch (err) {
    next(err)
  }
})

// ── Calc Sheet Templates ──────────────────────────────────────────────────────

export const calcTemplateRouter = Router()

// The DB column/model attribute is `fieldMetadata` (field_metadata), but the
// frontend's CalcTemplateDetail/CalcTemplateVersionDetail types declare a
// plain `metadata` key (see frontend/src/api/calcTemplates.ts) — nothing
// renamed it, so every GET/PATCH response silently sent `field_metadata`
// instead. `existing.metadata` was always undefined on reopening a
// previously-saved template, which is why the named-fields panel showed 0
// even for a template that really did have fields marked and saved.
function flattenCalcTemplate(tmpl: { toJSON?: () => any } | any): Record<string, unknown> {
  const plain = typeof tmpl?.toJSON === 'function' ? tmpl.toJSON() : { ...tmpl }
  if ('fieldMetadata' in plain) {
    plain.metadata = plain.fieldMetadata
    delete plain.fieldMetadata
  }
  return plain
}

const CalcSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  definition: z.record(z.unknown()).optional().nullable(),
})

const CALC_TEMPLATE_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  slug: 'slug',
  version: 'version',
  is_active: 'isActive',
  updated_at: 'updatedAt',
  created_at: 'createdAt',
}

// GET /api/calc-templates
calcTemplateRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sortBy, sortDir, search } = req.query as Record<string, string>
    const { page, limit, offset } = parsePagination(req.query)

    const where: Record<string, unknown> = {}
    if (req.query.category) where.category = req.query.category as string
    // 'CALC_CGT' is the CGT bucket; everything else — including the legacy
    // plain 'CALC' rows created before templates were split per module — is
    // treated as ADC's.
    if (req.query.scope === 'CGT') where.category = 'CALC_CGT'
    else if (req.query.scope === 'ADC') where.category = { [Op.or]: [{ [Op.ne]: 'CALC_CGT' }, { [Op.is]: null }] }
    if (req.query.is_active !== undefined) where.isActive = req.query.is_active === 'true'
    if (search) {
      (where as any)[Op.or as any] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { slug: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const sortColumn = sortBy ? (CALC_TEMPLATE_SORT_COLUMNS[sortBy] ?? 'createdAt') : 'createdAt'
    const direction = sortDir ? (sortDir === 'desc' ? 'DESC' : 'ASC') : (sortBy ? 'ASC' : 'DESC')

    const { count, rows } = await CalcSheetTemplate.findAndCountAll({
      where,
      order: [[sortColumn, direction]],
      offset,
      limit,
    })

    const pagination = buildPagination(page, limit, count)
    res.json(listResponse('Calc sheet templates retrieved successfully.', rows, pagination))
  } catch (err) {
    next(err)
  }
})

// GET /api/calc-templates/:templateId
calcTemplateRouter.get('/:templateId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Calc sheet template')
    res.json(successResponse('Calc sheet template retrieved successfully.', flattenCalcTemplate(tmpl)))
  } catch (err) {
    next(err)
  }
})

// POST /api/calc-templates
calcTemplateRouter.post(
  '/',
  authenticate,
  requireTemplateManage(CalcSheetTemplate, 'body', 'calc_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = CalcSchema.parse(req.body)
      const tmpl = await CalcSheetTemplate.create({
        name: body.name,
        slug: body.slug,
        category: body.category ?? null,
        isActive: body.is_active ?? true,
        createdBy: req.user!.id,
      })
      await CalcSheetTemplateVersion.create({
        templateId: tmpl.id,
        version: 1,
        savedBy: req.user!.id,
        savedAt: new Date(),
      })
      res.status(201).json(successResponse('Calc sheet template created successfully.', flattenCalcTemplate(tmpl)))
    } catch (err) {
      next(err)
    }
  },
)

// PATCH /api/calc-templates/:templateId
calcTemplateRouter.patch(
  '/:templateId',
  authenticate,
  requireTemplateManage(CalcSheetTemplate, 'existing', 'calc_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
      if (!tmpl) throw new NotFoundError('Calc sheet template')
      const body = CalcSchema.partial().parse(req.body)

      const prevVersion: number = (tmpl as any).version ?? 1
      const updates: Record<string, unknown> = {}
      if (body.name !== undefined) updates.name = body.name
      if (body.category !== undefined) updates.category = body.category
      if (body.is_active !== undefined) updates.isActive = body.is_active

      let bumpVersion = false
      if (req.body.workbook_data !== undefined) { updates.workbookData = req.body.workbook_data; bumpVersion = true }
      if (req.body.metadata !== undefined) { updates.fieldMetadata = req.body.metadata; bumpVersion = true }
      if (bumpVersion) updates.version = prevVersion + 1

      await tmpl.update(updates)

      if (bumpVersion) {
        // The snapshot/metadata must be stored on the version row too, or the
        // version history is a list of empty rows — GET /versions/:version
        // declares workbook_data/metadata and was always returning null.
        await CalcSheetTemplateVersion.create({
          templateId: tmpl.id,
          version: (tmpl as any).version,
          workbookData: (tmpl as any).workbookData ?? null,
          fieldMetadata: (tmpl as any).fieldMetadata ?? null,
          savedBy: req.user!.id,
          savedAt: new Date(),
        })
      }

      res.json(successResponse('Calc sheet template updated successfully.', flattenCalcTemplate(tmpl)))
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /api/calc-templates/:templateId  (soft delete)
calcTemplateRouter.delete(
  '/:templateId',
  authenticate,
  requireTemplateManage(CalcSheetTemplate, 'existing', 'calc_templates'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
      if (!tmpl) throw new NotFoundError('Calc sheet template')
      await tmpl.update({ isActive: false })
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/calc-templates/import-xlsx  (MUST be before /:templateId)
calcTemplateRouter.post(
  '/import-xlsx',
  authenticate,
  // Stateless conversion utility (no template/category exists yet at this
  // point) — allow it to anyone who can manage calc templates in either module.
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user!
      if (await userHasPrivilege(user, 'admin.settings')) return next()
      if (await userHasDeptPrivilege(user, 'adc.calc_templates.manage')) return next()
      if (await userHasDeptPrivilege(user, 'cgt.calc_templates.manage')) return next()
      throw new ForbiddenError('You do not have permission to manage templates.')
    } catch (err) {
      next(err)
    }
  },
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded', 'MISSING_FILE')
      const ext = req.file.originalname.split('.').pop()?.toLowerCase()
      if (ext !== 'xlsx' && ext !== 'xlsm') {
        throw new BadRequestError('Only .xlsx and .xlsm files are supported', 'INVALID_FILE_TYPE')
      }
      if (req.file.size === 0) throw new BadRequestError('Uploaded file is empty', 'EMPTY_FILE')

      const stem = req.file.originalname.replace(/\.[^.]+$/, '')
      const result = await convertXlsx(req.file.buffer, stem)
      res.json(successResponse('XLSX imported successfully.', result))
    } catch (err) {
      next(err)
    }
  },
)

// GET /api/calc-templates/:templateId/versions
calcTemplateRouter.get('/:templateId/versions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Calc sheet template')
    const versions = await CalcSheetTemplateVersion.findAll({
      where: { templateId: tmpl.id },
      order: [['version', 'DESC']],
    })
    res.json(successResponse('Calc sheet template versions retrieved successfully.', versions))
  } catch (err) {
    next(err)
  }
})

// GET /api/calc-templates/:templateId/versions/:version
calcTemplateRouter.get('/:templateId/versions/:version', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Calc sheet template')
    const ver = parseInt(req.params.version as string, 10)
    const vrow = await CalcSheetTemplateVersion.findOne({ where: { templateId: tmpl.id, version: ver } })
    if (!vrow) throw new NotFoundError('Version')
    res.json(successResponse('Version retrieved.', flattenCalcTemplate(vrow)))
  } catch (err) {
    next(err)
  }
})

// POST /api/calc-templates/:templateId/submit  (revalidation)
calcTemplateRouter.post('/:templateId/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = await CalcSheetTemplate.findByPk(req.params.templateId as string)
    if (!tmpl) throw new NotFoundError('Calc sheet template')
    if (!(tmpl as any).isActive) throw new BadRequestError('Template is not active', 'TEMPLATE_INACTIVE')

    const { values } = z.object({ values: z.record(z.unknown()) }).parse(req.body)

    const workbookData = (tmpl as any).workbookData
    const fieldMetadata = (tmpl as any).fieldMetadata
    if (!workbookData || !fieldMetadata) {
      throw new BadRequestError('Template has no workbook data — import an XLSX first', 'NO_WORKBOOK_DATA')
    }

    const outputs = await revalidateSubmission(workbookData, fieldMetadata, values)
    res.json(successResponse('Revalidation complete.', { outputs }))
  } catch (err) {
    next(err)
  }
})

export default workflowTemplateRouter
