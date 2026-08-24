import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'
import { ValidationError as SequelizeValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize'
import { ZodError } from 'zod'

// The frontend client (frontend/src/api/client.ts) reads `body.detail` to surface an
// error message — that is the FastAPI convention the original backend used. Without
// `detail` the client falls back to a bare "HTTP 404"/"HTTP 500" string. `success`,
// `message` and `error` are kept for any other consumer.

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Log the full error internally
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    userId: (req as any).user?.id,
  })

  // Zod validation errors — FastAPI/Pydantic returned detail as [{ loc, msg }],
  // which the client flattens via e.msg (client.ts:61-70).
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    res.status(422).json({
      success: false,
      message: 'Validation failed.',
      detail: err.errors.map(e => ({ loc: e.path, msg: e.message })),
      error: { code: 'VALIDATION_ERROR', details },
    })
    return
  }

  // Sequelize unique constraint
  if (err instanceof UniqueConstraintError) {
    const fields = Object.keys(err.fields || {})
    const msg = `A record with the same ${fields.join(', ')} already exists.`
    res.status(409).json({
      success: false,
      message: msg,
      detail: msg,
      error: { code: 'CONFLICT', details: null },
    })
    return
  }

  // Sequelize foreign key constraint
  if (err instanceof ForeignKeyConstraintError) {
    const msg = 'The referenced record does not exist or cannot be deleted because it is in use.'
    res.status(400).json({
      success: false,
      message: msg,
      detail: msg,
      error: { code: 'FOREIGN_KEY_ERROR', details: null },
    })
    return
  }

  // Sequelize validation error
  if (err instanceof SequelizeValidationError) {
    const details = err.errors.map(e => ({ field: e.path || '', message: e.message }))
    res.status(422).json({
      success: false,
      message: 'Validation failed.',
      detail: err.errors.map(e => ({ loc: [e.path || ''], msg: e.message })),
      error: { code: 'VALIDATION_ERROR', details },
    })
    return
  }

  // Our AppError hierarchy
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      detail: err.message,
      error: {
        code: err.code,
        details: err.details || null,
      },
    })
    return
  }

  // Unknown errors — do not leak internal details
  const genericMsg = 'An unexpected error occurred. Please try again later.'
  res.status(500).json({
    success: false,
    message: genericMsg,
    detail: genericMsg,
    error: { code: 'INTERNAL_ERROR', details: null },
  })
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const msg = `Route ${req.method} ${req.path} not found.`
  res.status(404).json({
    success: false,
    message: msg,
    detail: msg,
    error: { code: 'ROUTE_NOT_FOUND', details: null },
  })
}
