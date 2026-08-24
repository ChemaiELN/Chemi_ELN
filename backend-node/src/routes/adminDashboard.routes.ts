import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../middleware/auth.middleware'
import { requirePrivilege } from '../shared/privileges'
import { User } from '../models/User.model'
import { Department } from '../models/Department.model'
import { sequelize } from '../database/connection'
import { successResponse } from '../utils/response'

const router = Router()

// GET /api/admin/dashboard/department-user-counts — active user count per
// department, for the Admin Dashboard's Users pie chart.
router.get('/department-user-counts', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const counts = await User.findAll({
      where: { isActive: true },
      attributes: ['departmentId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['departmentId'],
      raw: true,
    }) as unknown as Array<{ departmentId: string | null; count: string }>

    const deptIds = counts.map((c) => c.departmentId).filter((id): id is string => !!id)
    const depts = deptIds.length
      ? await Department.findAll({ where: { id: deptIds }, attributes: ['id', 'code', 'name'] })
      : []
    const deptById = new Map(depts.map((d) => [d.id, d]))

    const result = counts.map((c) => ({
      department_id: c.departmentId,
      department_code: c.departmentId ? deptById.get(c.departmentId)?.code ?? 'Unassigned' : 'Unassigned',
      department_name: c.departmentId ? deptById.get(c.departmentId)?.name ?? 'Unassigned' : 'Unassigned',
      count: Number(c.count),
    }))

    res.json(successResponse('Department user counts retrieved successfully.', result))
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/dashboard/locked-accounts — every account currently locked
// out (locked_until in the future), independent of whether the user has
// submitted an unlock request — the automatic backend lockout never creates
// one on its own, so admins otherwise have no visibility into this.
router.get('/locked-accounts', authenticate, requirePrivilege('users.manage'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await User.findAll({
      where: { lockedUntil: { [Op.gt]: new Date() }, isActive: true },
      include: [{ model: Department, as: 'department', attributes: ['name'] }],
      order: [['lockedUntil', 'DESC']],
    })

    res.json(successResponse('Locked accounts retrieved successfully.', rows.map((u: any) => ({
      id: u.id,
      username: u.username,
      display_name: u.displayName,
      designation: u.designation,
      department_name: u.department?.name ?? null,
      failed_login_count: u.failedLoginCount,
      locked_until: u.lockedUntil,
    }))))
  } catch (err) {
    next(err)
  }
})

export default router
