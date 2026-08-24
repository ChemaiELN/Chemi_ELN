import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse, listResponse } from '../../utils/response'
import { NotFoundError, BadRequestError } from '../../utils/errors'
import { ArdAttachment } from '../../models/index'
import { createUploader } from '../../middleware/upload.middleware'
import { config } from '../../config'

const ardUploadRouter = Router()

const uploader = createUploader('ard-attachments')

// GET / — list attachments, filter by entity_type and/or entity_id
ardUploadRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id } = req.query as Record<string, string>
    const where: Record<string, any> = {}
    if (entity_type) where.entityType = entity_type
    if (entity_id) where.entityId = entity_id

    const attachments = await ArdAttachment.findAll({
      where,
      order: [['createdAt', 'DESC']],
    })

    return res.json(successResponse('Attachments retrieved', attachments))
  } catch (err) {
    next(err)
  }
})

// POST / — multipart file upload
ardUploadRouter.post(
  '/',
  authenticate,
  uploader.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new BadRequestError('No file uploaded')

      const bodySchema = z.object({
        entity_type: z.string().min(1),
        entity_id: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
      })

      const body = bodySchema.parse(req.body)
      const user = req.user as any

      const attachment = await ArdAttachment.create({
        entityType: body.entity_type,
        entityId: body.entity_id,
        name: body.name,
        description: body.description ?? null,
        filename: req.file.filename,
        fileType: req.file.mimetype,
        sizeBytes: req.file.size,
        attachmentLink: null,
        uploadedBy: user.username,
        uploadedById: user.id,
      })

      return res.status(201).json(successResponse('Attachment uploaded', attachment))
    } catch (err) {
      next(err)
    }
  },
)

// POST /folder-link — UNC/folder link (no file)
ardUploadRouter.post('/folder-link', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bodySchema = z.object({
      entity_type: z.string().min(1),
      entity_id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      attachment_link: z.string().min(1),
    })

    const body = bodySchema.parse(req.body)
    const user = req.user as any

    const attachment = await ArdAttachment.create({
      entityType: body.entity_type,
      entityId: body.entity_id,
      name: body.name,
      description: body.description ?? null,
      filename: null,
      fileType: null,
      sizeBytes: null,
      attachmentLink: body.attachment_link,
      uploadedBy: user.username,
      uploadedById: user.id,
    })

    return res.status(201).json(successResponse('Folder link saved', attachment))
  } catch (err) {
    next(err)
  }
})

// GET /:attachmentId/download
ardUploadRouter.get('/:attachmentId/download', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await ArdAttachment.findByPk(req.params.attachmentId as string)
    if (!attachment) throw new NotFoundError('Attachment not found')
    if (!(attachment as any).filename) throw new BadRequestError('This attachment is a folder link and cannot be downloaded')

    const filePath = path.join((config as any).uploadDir, 'ard-attachments', (attachment as any).filename)
    return res.download(filePath, (attachment as any).name)
  } catch (err) {
    next(err)
  }
})

// PATCH /:attachmentId — update name/description
ardUploadRouter.patch('/:attachmentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await ArdAttachment.findByPk(req.params.attachmentId as string)
    if (!attachment) throw new NotFoundError('Attachment not found')

    const bodySchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    })

    const body = bodySchema.parse(req.body)
    await attachment.update(body)

    return res.json(successResponse('Attachment updated', attachment))
  } catch (err) {
    next(err)
  }
})

// DELETE /:attachmentId
ardUploadRouter.delete('/:attachmentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const attachment = await ArdAttachment.findByPk(req.params.attachmentId as string)
    if (!attachment) throw new NotFoundError('Attachment not found')

    const filename = (attachment as any).filename
    if (filename) {
      const filePath = path.join((config as any).uploadDir, 'ard-attachments', filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await attachment.destroy()
    return res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default ardUploadRouter
