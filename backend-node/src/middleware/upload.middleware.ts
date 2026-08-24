import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config'
import { ALLOWED_EXTENSIONS } from '../utils/files'
import { BadRequestError } from '../utils/errors'
import { Request } from 'express'

function diskStorage(subdir: string) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(config.uploadDir, subdir)
      // multer does NOT create the destination directory itself — without this,
      // the very first upload into a not-yet-created subdir fails with ENOENT.
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${uuidv4().replace(/-/g, '')}${ext}`)
    },
  })
}

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    cb(new BadRequestError(
      `File type not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      'INVALID_FILE_TYPE',
    ))
    return
  }
  cb(null, true)
}

export function createUploader(subdir: string) {
  return multer({
    storage: diskStorage(subdir),
    fileFilter,
    limits: { fileSize: config.maxUploadBytes },
  })
}

// Default uploader for general attachments
export const defaultUploader = createUploader('attachments')
