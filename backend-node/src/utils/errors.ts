export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  // Most call sites pass a bare resource name ("Material") but many pass a complete
  // sentence ("Material not found"). Only append the suffix when it isn't already
  // there, so the message never reads "Material not found not found.".
  constructor(resource = 'Resource') {
    const trimmed = resource.trim()
    const alreadyComplete = /not found\.?$/i.test(trimmed)
    const message = alreadyComplete
      ? (trimmed.endsWith('.') ? trimmed : `${trimmed}.`)
      : `${trimmed} not found.`
    super(message, 404, 'NOT_FOUND')
  }
}

export class ValidationError extends AppError {
  constructor(details: Array<{ field: string; message: string }>) {
    super('Validation failed.', 422, 'VALIDATION_ERROR', details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST') {
    super(message, 400, code)
  }
}
