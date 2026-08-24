import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { successResponse, listResponse, parsePagination, buildPagination, parseSort } from '../utils/response'
import { NotFoundError, ConflictError } from '../utils/errors'
import { hashPassword, PasswordSchema } from '../utils/auth.utils'
import { User } from '../models/User.model'
import { Role } from '../models/Role.model'
import { Department } from '../models/Department.model'
import { Lab, UserLab } from '../models/Lab.model'
import { createUploader } from '../middleware/upload.middleware'
import { config } from '../config'
import path from 'path'
import { logAdminAudit } from '../utils/adminAudit'

const router = Router()
const jobDescUploader = createUploader('user-job-descriptions')

// Username doubles as the employee identifier now, so it's restricted to a
// predictable, URL/login-safe charset: letters, digits, dot, underscore, hyphen.
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/

const userIncludes = [
  { model: Role, as: 'role', attributes: ['id', 'code', 'name'] },
  { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
  { model: Lab, as: 'lab', attributes: ['id', 'code', 'name'] },
  { model: Lab, as: 'labs', attributes: ['id', 'code', 'name'], through: { attributes: [] } },
]

/**
 * The admin Users table renders role_name / role_code / department_name / lab_name as
 * flat scalars (see UserOut in frontend/src/api/admin.ts and the column definitions in
 * pages/admin/UsersPage.tsx). Returning only nested role/department/lab objects left
 * those columns blank. Flat fields are emitted alongside the nested ones so any other
 * consumer keeps working.
 */
function userOut(u: User, labsOverride?: Lab[]) {
  const role = u.role as Role | undefined
  const dept = u.department as Department | undefined
  const lab = u.lab as Lab | undefined
  const labs = labsOverride ?? ((u as any).labs as Lab[] | undefined)
  return {
    id: u.id,
    username: u.username,
    emp_no: u.empNo,
    email: u.email,
    dashboard_reference: u.dashboardReference,
    must_reset_password: u.mustResetPassword,
    allow_settings_update: u.allowSettingsUpdate,
    is_active: u.isActive,
    is_locked: !!u.lockedUntil && u.lockedUntil > new Date(),
    locked_until: u.lockedUntil,
    failed_login_count: u.failedLoginCount,
    title: u.title,
    first_name: u.firstName,
    middle_initials: u.middleInitials,
    last_name: u.lastName,
    display_name: u.displayName,
    designation: u.designation,
    contact_no: u.contactNo,
    has_job_description: !!u.jobDescriptionFile,
    created_at: u.createdAt ?? null,
    // Flat role / department / lab fields
    role_id: role?.id ?? u.roleId ?? null,
    role_code: role?.code ?? null,
    role_name: role?.name ?? null,
    department_id: dept?.id ?? u.departmentId ?? null,
    department_code: dept?.code ?? null,
    department_name: dept?.name ?? null,
    lab_id: lab?.id ?? u.labId ?? null,
    lab_code: lab?.code ?? null,
    lab_name: lab?.name ?? null,
    // Full set of labs this user is assigned to (many-to-many via user_labs).
    lab_ids: (labs ?? []).map((l) => l.id),
    labs: (labs ?? []).map((l) => ({ id: l.id, code: l.code, name: l.name })),
    // Nested objects retained for backwards compatibility
    role: role ? { id: role.id, code: role.code, name: role.name } : null,
    department: dept ? { id: dept.id, code: dept.code, name: dept.name } : null,
    lab: lab ? { id: lab.id, code: lab.code, name: lab.name } : null,
  }
}

// Loads each user's assigned labs via the join table, keyed by user id — used
// where an `include` on the many-to-many would duplicate/mis-paginate rows.
async function attachLabs(userIds: string[]): Promise<Map<string, Lab[]>> {
  const map = new Map<string, Lab[]>()
  if (userIds.length === 0) return map
  const rows = await UserLab.findAll({
    where: { userId: userIds },
    include: [{ model: Lab, as: 'lab', attributes: ['id', 'code', 'name'] }],
  })
  for (const row of rows as any[]) {
    const lab = row.lab as Lab
    if (!lab) continue
    if (!map.has(row.userId)) map.set(row.userId, [])
    map.get(row.userId)!.push(lab)
  }
  return map
}

// GET /api/users
router.get('/', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>, 10)
    const order = parseSort(req.query as Record<string, unknown>, User, [['createdAt', 'DESC']])
    const { search, role_id, role_code, dept_id, is_active } = req.query as Record<string, string>

    const where: Record<string, unknown> = {}
    if (search) {
      (where as any)[Op.or as any] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { empNo: { [Op.iLike]: `%${search}%` } },
        { displayName: { [Op.iLike]: `%${search}%` } },
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { designation: { [Op.iLike]: `%${search}%` } },
      ]
    }
    if (dept_id) where.departmentId = dept_id
    if (is_active !== undefined) where.isActive = is_active === 'true'

    const roleWhere: Record<string, unknown> = {}
    if (role_id) where.roleId = role_id
    if (role_code) roleWhere.code = role_code

    const { count, rows } = await User.findAndCountAll({
      where,
      include: [
        { model: Role, as: 'role', where: Object.keys(roleWhere).length ? roleWhere : undefined, attributes: ['id', 'code', 'name'] },
        { model: Department, as: 'department', attributes: ['id', 'code', 'name'] },
        { model: Lab, as: 'lab', attributes: ['id', 'code', 'name'] },
      ],
      limit,
      offset,
      order,
    })

    // Fetched separately (not via `include`) so the many-to-many join doesn't
    // duplicate/mis-paginate the findAndCountAll above.
    const labsByUser = await attachLabs(rows.map((r) => r.id))

    res.json(listResponse('Users retrieved successfully.', rows.map((r) => userOut(r, labsByUser.get(r.id))), buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// GET /api/users/lookup
router.get('/lookup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, role_code, dept_code, limit: lim } = req.query as Record<string, string>
    const limit = Math.min(200, parseInt(lim || '50', 10))

    const where: Record<string, unknown> = { isActive: true }
    if (search) {
      (where as any)[Op.or as any] = [
        { username: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const roleWhere: Record<string, unknown> = {}
    if (role_code) roleWhere.code = role_code

    const deptWhere: Record<string, unknown> = {}
    if (dept_code) deptWhere.code = dept_code

    const rows = await User.findAll({
      where,
      include: [
        { model: Role, as: 'role', where: Object.keys(roleWhere).length ? roleWhere : undefined, attributes: ['id', 'code', 'name'] },
        { model: Department, as: 'department', where: Object.keys(deptWhere).length ? deptWhere : undefined, attributes: ['id', 'code', 'name'] },
      ],
      limit,
      order: [['username', 'ASC']],
    })

    res.json(successResponse('Users retrieved successfully.', { total: rows.length, items: rows.map((r) => userOut(r)) }))
  } catch (err) {
    next(err)
  }
})

// GET /api/users/:user_id
router.get('/:userId', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string, { include: userIncludes })
    if (!user) throw new NotFoundError('User')
    res.json(successResponse('User details retrieved successfully.', userOut(user)))
  } catch (err) {
    next(err)
  }
})

const DEFAULT_PASSWORD = 'Password@123'

const UserCreateSchema = z.object({
  username: z.string().min(1).regex(USERNAME_PATTERN, 'Username may only contain letters, numbers, dots, hyphens and underscores — no spaces.'),
  email: z.string().email().optional().or(z.literal('')),
  title: z.string().min(1),
  first_name: z.string().min(1),
  middle_initials: z.string().optional(),
  last_name: z.string().min(1),
  display_name: z.string().min(1),
  designation: z.string().min(1),
  contact_no: z.string().optional(),
})

// POST /api/users
router.post('/', authenticate, requirePrivilege('users.manage'), jobDescUploader.single('job_description'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = UserCreateSchema.parse(req.body)

    const existingUsername = await User.findOne({ where: { username: body.username } })
    if (existingUsername) throw new ConflictError('A user with this username already exists.')

    const existingDisplayName = await User.findOne({ where: { displayName: body.display_name } })
    if (existingDisplayName) throw new ConflictError('A user with this display name already exists. Display names must be unique.')

    const hashed = await hashPassword(DEFAULT_PASSWORD)
    const user = await User.create({
      username: body.username,
      email: body.email || null,
      passwordHash: hashed,
      passwordChangedAt: new Date(),
      title: body.title,
      firstName: body.first_name,
      middleInitials: body.middle_initials || null,
      lastName: body.last_name,
      displayName: body.display_name,
      designation: body.designation,
      contactNo: body.contact_no || null,
      jobDescriptionFile: req.file?.filename || null,
      mustResetPassword: true,
      allowSettingsUpdate: false,
      isActive: true,
    })

    await logAdminAudit({
      req, eventType: 'CREATE', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      newValue: { username: user.username, email: user.email, display_name: user.displayName, designation: user.designation },
    })

    const full = await User.findByPk(user.id, { include: userIncludes })
    res.status(201).json(successResponse('User created successfully.', userOut(full!)))
  } catch (err) {
    next(err)
  }
})

const UserUpdateSchema = z.object({
  username: z.string().min(1).regex(USERNAME_PATTERN, 'Username may only contain letters, numbers, dots, hyphens and underscores — no spaces.').optional(),
  display_name: z.string().min(1).optional(),
  emp_no: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  title: z.string().optional(),
  first_name: z.string().optional(),
  middle_initials: z.string().optional().nullable(),
  last_name: z.string().optional(),
  designation: z.string().optional(),
  contact_no: z.string().optional().nullable(),
  role_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional().nullable(),
  lab_id: z.string().uuid().optional().nullable(),
  lab_ids: z.array(z.string().uuid()).optional(),
  dashboard_reference: z.string().optional().nullable(),
  must_reset_password: z.boolean().optional(),
  allow_settings_update: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

// PATCH /api/users/:user_id
router.patch('/:userId', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string)
    if (!user) throw new NotFoundError('User')

    const beforeLabRows = await UserLab.findAll({ where: { userId: user.id } })
    const beforeLabIds = beforeLabRows.map((r) => r.labId).sort()
    const beforeRoleId = user.roleId
    const beforeDeptId = user.departmentId

    const before = {
      username: user.username, display_name: user.displayName, emp_no: user.empNo, email: user.email,
      title: user.title, first_name: user.firstName, middle_initials: user.middleInitials, last_name: user.lastName,
      designation: user.designation, contact_no: user.contactNo, dashboard_reference: user.dashboardReference,
      must_reset_password: user.mustResetPassword, allow_settings_update: user.allowSettingsUpdate, is_active: user.isActive,
    }

    const body = UserUpdateSchema.parse(req.body)

    if (body.username !== undefined && body.username !== user.username) {
      const dupUsername = await User.findOne({ where: { username: body.username } })
      if (dupUsername) throw new ConflictError('A user with this username already exists.')
    }
    if (body.display_name !== undefined && body.display_name !== user.displayName) {
      const dupDisplayName = await User.findOne({ where: { displayName: body.display_name } })
      if (dupDisplayName) throw new ConflictError('A user with this display name already exists. Display names must be unique.')
    }

    const updates: Record<string, unknown> = {}
    if (body.username !== undefined) updates.username = body.username
    if (body.display_name !== undefined) updates.displayName = body.display_name
    if (body.emp_no !== undefined) updates.empNo = body.emp_no
    if (body.email !== undefined) updates.email = body.email
    if (body.title !== undefined) updates.title = body.title
    if (body.first_name !== undefined) updates.firstName = body.first_name
    if (body.middle_initials !== undefined) updates.middleInitials = body.middle_initials
    if (body.last_name !== undefined) updates.lastName = body.last_name
    if (body.designation !== undefined) updates.designation = body.designation
    if (body.contact_no !== undefined) updates.contactNo = body.contact_no
    if (body.role_id !== undefined) updates.roleId = body.role_id
    if (body.department_id !== undefined) updates.departmentId = body.department_id
    if (body.lab_id !== undefined) updates.labId = body.lab_id
    if (body.dashboard_reference !== undefined) updates.dashboardReference = body.dashboard_reference
    if (body.must_reset_password !== undefined) updates.mustResetPassword = body.must_reset_password
    if (body.allow_settings_update !== undefined) updates.allowSettingsUpdate = body.allow_settings_update
    if (body.is_active !== undefined) updates.isActive = body.is_active

    await user.update(updates)
    if (body.lab_ids !== undefined) {
      await (user as any).setLabs(body.lab_ids)
    }

    const afterLabIds = body.lab_ids !== undefined ? [...body.lab_ids].sort() : beforeLabIds

    // Resolve every role/department/lab id involved (before AND after) to a
    // human-readable name in one batch, so the audit trail's diff reads e.g.
    // "role changed from Chemist to HOD" instead of raw UUIDs.
    const roleIds = [...new Set([beforeRoleId, user.roleId].filter((v): v is string => !!v))]
    const deptIds = [...new Set([beforeDeptId, user.departmentId].filter((v): v is string => !!v))]
    const labIds = [...new Set([...beforeLabIds, ...afterLabIds].filter(Boolean))]
    const [roleRows, deptRows, labRows] = await Promise.all([
      roleIds.length ? Role.findAll({ where: { id: roleIds }, attributes: ['id', 'name'] }) : [],
      deptIds.length ? Department.findAll({ where: { id: deptIds }, attributes: ['id', 'name'] }) : [],
      labIds.length ? Lab.findAll({ where: { id: labIds }, attributes: ['id', 'name'] }) : [],
    ])
    const roleName = new Map(roleRows.map((r) => [r.id, r.name]))
    const deptName = new Map(deptRows.map((d) => [d.id, d.name]))
    const labName = new Map(labRows.map((l) => [l.id, l.name]))

    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      oldValue: {
        ...before,
        role: beforeRoleId ? roleName.get(beforeRoleId) ?? beforeRoleId : null,
        department: beforeDeptId ? deptName.get(beforeDeptId) ?? beforeDeptId : null,
        labs: beforeLabIds.map((id) => labName.get(id) ?? id),
      },
      newValue: {
        username: user.username, display_name: user.displayName, emp_no: user.empNo, email: user.email,
        title: user.title, first_name: user.firstName, middle_initials: user.middleInitials, last_name: user.lastName,
        designation: user.designation, contact_no: user.contactNo, dashboard_reference: user.dashboardReference,
        must_reset_password: user.mustResetPassword, allow_settings_update: user.allowSettingsUpdate, is_active: user.isActive,
        role: user.roleId ? roleName.get(user.roleId) ?? user.roleId : null,
        department: user.departmentId ? deptName.get(user.departmentId) ?? user.departmentId : null,
        labs: afterLabIds.map((id) => labName.get(id) ?? id),
      },
    })

    const full = await User.findByPk(user.id, { include: userIncludes })
    res.json(successResponse('User updated successfully.', userOut(full!)))
  } catch (err) {
    next(err)
  }
})

// GET /api/users/:userId/job-description
router.get('/:userId/job-description', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string)
    if (!user || !user.jobDescriptionFile) throw new NotFoundError('Job description')
    const filePath = path.join((config as any).uploadDir, 'user-job-descriptions', user.jobDescriptionFile)
    res.download(filePath)
  } catch (err) {
    next(err)
  }
})

// POST /api/users/:user_id/reset-password
router.post('/:userId/reset-password', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = z.object({ newPassword: PasswordSchema }).parse(req.body)
    const user = await User.findByPk(req.params.userId as string)
    if (!user) throw new NotFoundError('User')

    const hashed = await hashPassword(newPassword)
    await user.update({
      passwordHash: hashed,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
      tokenVersion: user.tokenVersion + 1,
    } as Partial<User>)

    // Never logs the actual password — just that a reset happened.
    await logAdminAudit({
      req, eventType: 'RESET', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      details: 'Password was reset by an administrator.',
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/users/:user_id/reset-to-default — one-click reset to the standard
// default password (as opposed to /reset-password, which takes an
// admin-chosen one). Used by the Admin Dashboard's User Maintenance panel.
router.post('/:userId/reset-to-default', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string)
    if (!user) throw new NotFoundError('User')

    const hashed = await hashPassword(DEFAULT_PASSWORD)
    await user.update({
      passwordHash: hashed,
      mustResetPassword: true,
      passwordChangedAt: new Date(),
      tokenVersion: user.tokenVersion + 1,
    } as Partial<User>)

    await logAdminAudit({
      req, eventType: 'RESET', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      details: 'Password was reset to the default password by an administrator.',
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// POST /api/users/:user_id/unlock — clears a lockout from too many failed
// login attempts. Does NOT touch the password (kept as a separate step —
// see /reset-to-default) so the two actions stay independently auditable.
router.post('/:userId/unlock', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string)
    if (!user) throw new NotFoundError('User')

    const wasLocked = !!user.lockedUntil
    await user.update({ failedLoginCount: 0, lockedUntil: null } as Partial<User>)

    await logAdminAudit({
      req, eventType: 'UPDATE', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      details: wasLocked ? 'Account unlocked by an administrator.' : 'Failed login count reset by an administrator (account was not locked).',
    })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// DELETE /api/users/:user_id — soft delete
router.delete('/:userId', authenticate, requirePrivilege('users.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByPk(req.params.userId as string)
    if (!user) throw new NotFoundError('User')
    await user.update({ isActive: false } as Partial<User>)
    await logAdminAudit({
      req, eventType: 'DELETE', entityType: 'USER', entityId: user.id, entityRef: user.displayName ?? user.username,
      oldValue: { is_active: true }, newValue: { is_active: false },
    })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
