import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse } from '../utils/response'
import { NotFoundError, BadRequestError } from '../utils/errors'
import { WorkflowTemplate, CgtProcess, TemplateDropdownSelection } from '../models/index'

// The list of workflow_template categories that belong to CGT — mirrors the
// CGT_CATEGORIES set in workflowTemplates.routes.ts. Kept in sync manually;
// see the comment there for why the 'CGT_' prefix isn't a real department marker.
const CGT_CATEGORIES = new Set(['CGT_PLASMID', 'CGT_AAV', 'CGT_MOLBIO', 'CALC_CGT'])
function isAdcTemplate(category?: string | null): boolean {
  return !category || !CGT_CATEGORIES.has(category.toUpperCase())
}

const router = Router()
const manage = requirePrivilege('admin.settings')

// ── ADC template settings ─────────────────────────────────────────────────────

// GET /api/template-settings/adc/templates
router.get('/adc/templates', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await WorkflowTemplate.findAll({ where: { isActive: true }, order: [['name', 'ASC']] })
    const adcTemplates = templates.filter(t => isAdcTemplate(t.category))
    const selections = await TemplateDropdownSelection.findAll({ where: { scope: 'ADC' } })
    const enabledIds = new Set(selections.map(s => s.templateId))
    res.json(successResponse('ADC template settings retrieved successfully.', adcTemplates.map(t => ({
      ...t.toJSON(),
      enabled: enabledIds.has(t.id),
    }))))
  } catch (err) {
    next(err)
  }
})

// PUT /api/template-settings/adc/templates  { template_ids: string[] }
router.put('/adc/templates', authenticate, manage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { template_ids } = z.object({ template_ids: z.array(z.string().uuid()) }).parse(req.body)
    await TemplateDropdownSelection.destroy({ where: { scope: 'ADC' } })
    await TemplateDropdownSelection.bulkCreate(template_ids.map(templateId => ({ scope: 'ADC' as const, processId: null, templateId })))
    res.json(successResponse('ADC template settings updated successfully.', { template_ids }))
  } catch (err) {
    next(err)
  }
})

// GET /api/template-settings/adc/enabled — templates offered in the ADC
// "Create Notebook" dropdown (consumed by NotebooksPage.tsx).
router.get('/adc/enabled', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const selections = await TemplateDropdownSelection.findAll({ where: { scope: 'ADC' } })
    const ids = selections.map(s => s.templateId)
    const templates = ids.length
      ? await WorkflowTemplate.findAll({ where: { id: { [Op.in]: ids }, isActive: true }, order: [['name', 'ASC']] })
      : []
    res.json(successResponse('Enabled ADC templates retrieved successfully.', templates))
  } catch (err) {
    next(err)
  }
})

// ── CGT process settings ──────────────────────────────────────────────────────

// GET /api/template-settings/cgt/processes
router.get('/cgt/processes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: Record<string, unknown> = {}
    if (req.query.is_active !== undefined) where.isActive = req.query.is_active === 'true'
    const processes = await CgtProcess.findAll({ where, order: [['sortOrder', 'ASC'], ['name', 'ASC']] })
    res.json(successResponse('CGT processes retrieved successfully.', processes))
  } catch (err) {
    next(err)
  }
})

const ProcessSchema = z.object({
  name: z.string().min(1).max(100),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

// POST /api/template-settings/cgt/processes
router.post('/cgt/processes', authenticate, manage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ProcessSchema.parse(req.body)
    const process = await CgtProcess.create({
      name: body.name,
      sortOrder: body.sort_order ?? 0,
      isActive: body.is_active ?? true,
    })
    res.status(201).json(successResponse('CGT process created successfully.', process))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/template-settings/cgt/processes/:id
router.patch('/cgt/processes/:id', authenticate, manage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const process = await CgtProcess.findByPk(req.params.id as string)
    if (!process) throw new NotFoundError('CGT process')
    const body = ProcessSchema.partial().parse(req.body)
    await process.update({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.sort_order !== undefined && { sortOrder: body.sort_order }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    })
    res.json(successResponse('CGT process updated successfully.', process))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/template-settings/cgt/processes/:id  (soft delete — a project
// created under this process still needs the name to remain meaningful)
router.delete('/cgt/processes/:id', authenticate, manage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const process = await CgtProcess.findByPk(req.params.id as string)
    if (!process) throw new NotFoundError('CGT process')
    await process.update({ isActive: false })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// GET /api/template-settings/cgt/processes/:id/templates
router.get('/cgt/processes/:id/templates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const process = await CgtProcess.findByPk(req.params.id as string)
    if (!process) throw new NotFoundError('CGT process')
    const templates = await WorkflowTemplate.findAll({
      where: { isActive: true, category: { [Op.in]: [...CGT_CATEGORIES] } },
      order: [['name', 'ASC']],
    })
    const selections = await TemplateDropdownSelection.findAll({ where: { scope: 'CGT', processId: process.id } })
    const enabledIds = new Set(selections.map(s => s.templateId))
    res.json(successResponse('CGT process template settings retrieved successfully.', templates.map(t => ({
      ...t.toJSON(),
      enabled: enabledIds.has(t.id),
    }))))
  } catch (err) {
    next(err)
  }
})

// PUT /api/template-settings/cgt/processes/:id/templates  { template_ids: string[] }
router.put('/cgt/processes/:id/templates', authenticate, manage, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const process = await CgtProcess.findByPk(req.params.id as string)
    if (!process) throw new NotFoundError('CGT process')
    const { template_ids } = z.object({ template_ids: z.array(z.string().uuid()) }).parse(req.body)
    await TemplateDropdownSelection.destroy({ where: { scope: 'CGT', processId: process.id } })
    await TemplateDropdownSelection.bulkCreate(
      template_ids.map(templateId => ({ scope: 'CGT' as const, processId: process.id, templateId })),
    )
    res.json(successResponse('CGT process template settings updated successfully.', { template_ids }))
  } catch (err) {
    next(err)
  }
})

// GET /api/template-settings/cgt/process-templates?process=NAME — templates
// offered in the CGT "Create Notebook" dropdown for a given project's process
// (consumed by CgtNotebooksPage.tsx, replacing PROCESS_TO_TEMPLATE_CATEGORY).
router.get('/cgt/process-templates', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.query.process as string | undefined
    if (!name) throw new BadRequestError('process query param is required', 'MISSING_PROCESS')
    const process = await CgtProcess.findOne({ where: { name } })
    if (!process) {
      res.json(successResponse('No templates configured for this process.', []))
      return
    }
    const selections = await TemplateDropdownSelection.findAll({ where: { scope: 'CGT', processId: process.id } })
    const ids = selections.map(s => s.templateId)
    const templates = ids.length
      ? await WorkflowTemplate.findAll({ where: { id: { [Op.in]: ids }, isActive: true }, order: [['name', 'ASC']] })
      : []
    res.json(successResponse('CGT process templates retrieved successfully.', templates))
  } catch (err) {
    next(err)
  }
})

export default router
