import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse } from '../utils/response'
import { NotFoundError } from '../utils/errors'
import { GlobalSettings } from '../models/GlobalSettings.model'
import { IdSequenceConfig, IdSequenceCounter } from '../models/IdSequence.model'
import { generateNextSequenceValue } from '../utils/idSequence'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()

// The SMTP password is write-only: it's never sent back to the client, whether
// in the settings response or the audit trail's before/after diff. The
// Settings form already treats a blank field as "keep current" (see
// frontend/src/pages/admin/SettingsPage.tsx), so nothing depends on it echoing back.
function settingsOut(settings: GlobalSettings) {
  const { smtpPassword: _smtpPassword, ...rest } = settings.toJSON() as Record<string, unknown>
  return rest
}

// GET /api/admin/settings
router.get('/settings', authenticate, requirePrivilege('admin.settings'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await GlobalSettings.findOne()
    if (!settings) {
      // Create defaults
      const s = await GlobalSettings.create({ id: 1 })
      return res.json(successResponse('Settings retrieved successfully.', settingsOut(s)))
    }
    res.json(successResponse('Settings retrieved successfully.', settingsOut(settings)))
  } catch (err) {
    next(err)
  }
})

const SettingsSchema = z.object({
  auth_type: z.string().optional().nullable(),
  lock_user_after_x_attempts: z.number().int().min(1).optional(),
  password_expiry_days: z.number().int().min(1).optional(),
  max_image_kb: z.number().int().optional(),
  max_attachment_kb: z.number().int().optional(),
  experiments_per_notebook: z.number().int().optional(),
  notebooks_per_project: z.number().int().optional(),
  search_limit: z.number().int().optional(),
  qa_role: z.string().optional().nullable(),
  smtp_host: z.string().optional().nullable(),
  smtp_port: z.number().int().optional().nullable(),
  smtp_from_address: z.string().optional().nullable(),
  smtp_username: z.string().optional().nullable(),
  smtp_password: z.string().optional().nullable(),
  enable_email_notifications: z.boolean().optional(),
})

// PATCH /api/admin/settings
router.patch('/settings', authenticate, requirePrivilege('admin.settings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SettingsSchema.parse(req.body)
    let settings = await GlobalSettings.findOne()
    if (!settings) settings = await GlobalSettings.create({ id: 1 })
    const before = settingsOut(settings)

    await settings.update({
      ...(body.auth_type !== undefined && { authType: body.auth_type }),
      ...(body.lock_user_after_x_attempts !== undefined && { lockUserAfterXAttempts: body.lock_user_after_x_attempts }),
      ...(body.password_expiry_days !== undefined && { passwordExpiryDays: body.password_expiry_days }),
      ...(body.max_image_kb !== undefined && { maxImageKb: body.max_image_kb }),
      ...(body.max_attachment_kb !== undefined && { maxAttachmentKb: body.max_attachment_kb }),
      ...(body.experiments_per_notebook !== undefined && { experimentsPerNotebook: body.experiments_per_notebook }),
      ...(body.notebooks_per_project !== undefined && { notebooksPerProject: body.notebooks_per_project }),
      ...(body.search_limit !== undefined && { searchLimit: body.search_limit }),
      ...(body.qa_role !== undefined && { qaRole: body.qa_role }),
      ...(body.smtp_host !== undefined && { smtpHost: body.smtp_host }),
      ...(body.smtp_port !== undefined && { smtpPort: body.smtp_port }),
      ...(body.smtp_from_address !== undefined && { smtpFromAddress: body.smtp_from_address }),
      ...(body.smtp_username !== undefined && { smtpUsername: body.smtp_username }),
      ...(body.smtp_password !== undefined && { smtpPassword: body.smtp_password }),
      ...(body.enable_email_notifications !== undefined && { enableEmailNotifications: body.enable_email_notifications }),
    })
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'SETTINGS', entityId: settings.id, entityRef: 'Global Settings',
      oldValue: before, newValue: settingsOut(settings),
    })
    res.json(successResponse('Settings updated successfully.', settingsOut(settings)))
  } catch (err) {
    next(err)
  }
})

// ── ID Sequences ─────────────────────────────────────────────────────────────

// GET /api/admin/id-sequences
router.get('/id-sequences', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await IdSequenceConfig.findAll({ order: [['createdAt', 'DESC']] })
    res.json(successResponse('ID sequence configurations retrieved successfully.', configs))
  } catch (err) {
    next(err)
  }
})

const IdSeqSchema = z.object({
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(150),
  prefix: z.string().optional().nullable(),
  separator: z.string().optional(),
  include_year: z.boolean().optional(),
  year_digits: z.number().int().optional(),
  sequence_digits: z.number().int().optional(),
  reset_yearly: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

// POST /api/admin/id-sequences
router.post('/id-sequences', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = IdSeqSchema.parse(req.body)
    const config = await IdSequenceConfig.create({
      code: body.code,
      label: body.label,
      prefix: body.prefix || null,
      separator: body.separator || '/',
      includeYear: body.include_year ?? true,
      yearDigits: body.year_digits ?? 2,
      sequenceDigits: body.sequence_digits ?? 5,
      resetYearly: body.reset_yearly ?? true,
      isActive: body.is_active ?? true,
      createdBy: req.user!.id,
    })
    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'ID_SEQUENCE', entityId: config.id, entityRef: config.label,
      newValue: config.toJSON() as Record<string, unknown>,
    })
    res.status(201).json(successResponse('ID sequence configuration created successfully.', config))
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/id-sequences/:config_id
router.patch('/id-sequences/:configId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await IdSequenceConfig.findByPk(req.params.configId as string)
    if (!config) throw new NotFoundError('ID sequence configuration')
    const before = config.toJSON() as Record<string, unknown>
    const body = IdSeqSchema.partial().parse(req.body)
    await config.update({
      ...(body.label !== undefined && { label: body.label }),
      ...(body.prefix !== undefined && { prefix: body.prefix }),
      ...(body.separator !== undefined && { separator: body.separator }),
      ...(body.include_year !== undefined && { includeYear: body.include_year }),
      ...(body.year_digits !== undefined && { yearDigits: body.year_digits }),
      ...(body.sequence_digits !== undefined && { sequenceDigits: body.sequence_digits }),
      ...(body.reset_yearly !== undefined && { resetYearly: body.reset_yearly }),
      ...(body.is_active !== undefined && { isActive: body.is_active }),
    })
    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'ID_SEQUENCE', entityId: config.id, entityRef: config.label,
      oldValue: before, newValue: config.toJSON() as Record<string, unknown>,
    })
    res.json(successResponse('ID sequence configuration updated successfully.', config))
  } catch (err) {
    next(err)
  }
})

// DELETE /api/admin/id-sequences/:config_id
router.delete('/id-sequences/:configId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await IdSequenceConfig.findByPk(req.params.configId as string)
    if (!config) throw new NotFoundError('ID sequence configuration')
    const before = config.toJSON() as Record<string, unknown>
    await IdSequenceCounter.destroy({ where: { configId: config.id } })
    await config.destroy()
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'ID_SEQUENCE', entityId: before.id as string, entityRef: before.label as string,
      oldValue: before,
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/id-sequences/:code/next — get next value
router.post('/id-sequences-next/:code', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await generateNextSequenceValue(req.params.code as string)
    res.json(successResponse('Next sequence value generated successfully.', result))
  } catch (err) {
    next(err)
  }
})

export default router
