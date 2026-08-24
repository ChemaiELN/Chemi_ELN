import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { NotFoundError } from '../../utils/errors'
import { Op } from 'sequelize'
import { sequelize } from '../../database/connection'
import { successResponse, listResponse, buildPagination, parsePagination, wantsPagination, parseSort } from '../../utils/response'
import { InvTestType, InvTestName, InvTestMethod } from '../../models/index'

const testMasterRouter = Router()

// ── Test Types ────────────────────────────────────────────────────────────────

// GET /test-master — list all test types with nested names and methods
testMasterRouter.get('/test-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search } = req.query as Record<string, string>
    const where: any = {}
    if (search) {
      // A type matches on its own key/name OR on any of its nested test names.
      // Filtering via the `names` include instead would drop the non-matching
      // names from the returned rows, so match by subquery on the id.
      where[Op.or] = [
        { typeKey: { [Op.iLike]: `%${search}%` } },
        { name: { [Op.iLike]: `%${search}%` } },
        {
          id: {
            [Op.in]: sequelize.literal(
              `(SELECT test_type_id FROM inv_test_names WHERE name ILIKE ${sequelize.escape(`%${search}%`)})`,
            ),
          },
        },
      ]
    }
    const include = [
      {
        model: InvTestName,
        as: 'names',
        include: [{ model: InvTestMethod, as: 'methods' }],
      },
    ]
    const order: any = parseSort(req.query as Record<string, unknown>, InvTestType, [['name', 'ASC']])

    if (!wantsPagination(req.query)) {
      const rows = await InvTestType.findAll({ where, include, order })
      res.json(successResponse('Test types retrieved successfully.', rows))
      return
    }
    const { page, limit, offset } = parsePagination(req.query, 10)
    const { rows, count } = await InvTestType.findAndCountAll({
      where, include, order, limit, offset, distinct: true,
    })
    res.json(listResponse('Test types retrieved successfully.', rows, buildPagination(page, limit, count)))
  } catch (err) {
    next(err)
  }
})

// POST /test-master — create test type
testMasterRouter.post('/test-master', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { typeKey, name, isActive } = req.body
    const row = await InvTestType.create({
      typeKey,
      name,
      isActive: isActive ?? true,
    })
    res.status(201).json(successResponse('Test type created successfully.', row))
  } catch (err) {
    next(err)
  }
})

// GET /test-master/:typeKey — get by typeKey
testMasterRouter.get('/test-master/:typeKey', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvTestType.findOne({
      where: { typeKey: req.params.typeKey as string },
      include: [
        {
          model: InvTestName,
          as: 'names',
          include: [{ model: InvTestMethod, as: 'methods' }],
        },
      ],
    })
    if (!row) throw new NotFoundError('Test type')
    res.json(successResponse('Test type retrieved successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/:typeKey — update type
testMasterRouter.patch('/test-master/:typeKey', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvTestType.findOne({ where: { typeKey: req.params.typeKey as string } })
    if (!row) throw new NotFoundError('Test type')
    const { typeKey, name, isActive } = req.body
    await row.update({
      ...(typeKey !== undefined && { typeKey }),
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Test type updated successfully.', row))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/:typeKey/toggle — toggle type isActive
testMasterRouter.patch('/test-master/:typeKey/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await InvTestType.findOne({ where: { typeKey: req.params.typeKey as string } })
    if (!row) throw new NotFoundError('Test type')
    await row.update({ isActive: !row.isActive })
    res.json(successResponse('Test type toggled successfully.', row))
  } catch (err) {
    next(err)
  }
})

// ── Test Names ────────────────────────────────────────────────────────────────

// POST /test-master/:typeKey/names — add test name
testMasterRouter.post('/test-master/:typeKey/names', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = await InvTestType.findOne({ where: { typeKey: req.params.typeKey as string } })
    if (!type) throw new NotFoundError('Test type')
    const { name, isActive } = req.body
    const testName = await InvTestName.create({
      testTypeId: type.id,
      name,
      isActive: isActive ?? true,
    })
    res.status(201).json(successResponse('Test name created successfully.', testName))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/names/:nameId — update name
testMasterRouter.patch('/test-master/names/:nameId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testName = await InvTestName.findByPk(req.params.nameId as string)
    if (!testName) throw new NotFoundError('Test name')
    const { name, isActive } = req.body
    await testName.update({
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Test name updated successfully.', testName))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/names/:nameId/toggle — toggle name isActive
testMasterRouter.patch('/test-master/names/:nameId/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testName = await InvTestName.findByPk(req.params.nameId as string)
    if (!testName) throw new NotFoundError('Test name')
    await testName.update({ isActive: !testName.isActive })
    res.json(successResponse('Test name toggled successfully.', testName))
  } catch (err) {
    next(err)
  }
})

// DELETE /test-master/names/:nameId — delete name
testMasterRouter.delete('/test-master/names/:nameId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testName = await InvTestName.findByPk(req.params.nameId as string)
    if (!testName) throw new NotFoundError('Test name')
    await testName.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── Test Methods ──────────────────────────────────────────────────────────────

// POST /test-master/names/:nameId/methods — add test method
testMasterRouter.post('/test-master/names/:nameId/methods', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const testName = await InvTestName.findByPk(req.params.nameId as string)
    if (!testName) throw new NotFoundError('Test name')
    const { methodName, isActive } = req.body
    const method = await InvTestMethod.create({
      testNameId: testName.id,
      methodName,
      isActive: isActive ?? true,
    })
    res.status(201).json(successResponse('Test method created successfully.', method))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/methods/:methodId — update method
testMasterRouter.patch('/test-master/methods/:methodId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const method = await InvTestMethod.findByPk(req.params.methodId as string)
    if (!method) throw new NotFoundError('Test method')
    const { methodName, isActive } = req.body
    await method.update({
      ...(methodName !== undefined && { methodName }),
      ...(isActive !== undefined && { isActive }),
    })
    res.json(successResponse('Test method updated successfully.', method))
  } catch (err) {
    next(err)
  }
})

// PATCH /test-master/methods/:methodId/toggle — toggle method isActive
testMasterRouter.patch('/test-master/methods/:methodId/toggle', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const method = await InvTestMethod.findByPk(req.params.methodId as string)
    if (!method) throw new NotFoundError('Test method')
    await method.update({ isActive: !method.isActive })
    res.json(successResponse('Test method toggled successfully.', method))
  } catch (err) {
    next(err)
  }
})

// DELETE /test-master/methods/:methodId — delete method
testMasterRouter.delete('/test-master/methods/:methodId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const method = await InvTestMethod.findByPk(req.params.methodId as string)
    if (!method) throw new NotFoundError('Test method')
    await method.destroy()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default testMasterRouter
