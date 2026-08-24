import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { config } from '../config'
import { BadRequestError } from './errors'

export const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xlsx', '.xls',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
])

export function validateUploadExtension(filename: string): void {
  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestError(
      `File type not allowed. Allowed types: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      'INVALID_FILE_TYPE',
    )
  }
}

export function saveUpload(
  sourcePath: string,
  originalName: string,
  subdir: string,
): { storedPath: string; storedFilename: string } {
  const ext = path.extname(originalName).toLowerCase()
  validateUploadExtension(originalName)

  const uploadDir = path.join(config.uploadDir, subdir)
  fs.mkdirSync(uploadDir, { recursive: true })

  const storedFilename = `${uuidv4().replace(/-/g, '')}${ext}`
  const storedPath = path.join(uploadDir, storedFilename)

  fs.renameSync(sourcePath, storedPath)
  return { storedPath, storedFilename }
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch {
    // Silent — same behaviour as Python implementation
  }
}

export function getAbsoluteUploadPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath
  return path.join(process.cwd(), relativePath)
}
