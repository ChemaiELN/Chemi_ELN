import { Request, Response, NextFunction } from 'express'
import { ForbiddenError } from '../utils/errors'

// Rearchitecture prompt §5.2: "No department gate on any template route ...
// any authenticated user, regardless of department, can hit every template
// endpoint." No requireArdDepartment-style middleware existed anywhere in this
// codebase (confirmed by search) — this is a new, minimal gate built to close
// that gap for ardTemplates.routes.ts, ardSections.routes.ts, ardDataItems.routes.ts.
//
// SUPER_ADMIN always bypasses (matches the convention in shared/privileges.ts).
// Everyone else must belong to a department to use these routes at all — plain
// `authenticate` let a user with no department assignment through previously.
export function requireArdDeptMember(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = (req as any).user
    const rc = (user?.role as any)?.code || ''
    if (rc === 'SUPER_ADMIN') return next()
    if (!user?.departmentId) {
      throw new ForbiddenError('You must belong to a department to access this resource.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// Resource-level check for routes scoped to a single template/section that carries
// its own deptId. A resource with no deptId set is treated as shared/global and
// stays visible to everyone (matches how deptId is optional in §1.1/ArdTemplate).
export function assertSameDept(resourceDeptId: string | null | undefined, user: any) {
  const rc = (user?.role as any)?.code || ''
  if (rc === 'SUPER_ADMIN') return
  if (!resourceDeptId) return
  if (String(resourceDeptId) !== String(user?.departmentId || '')) {
    throw new ForbiddenError('This record belongs to a different department.')
  }
}
