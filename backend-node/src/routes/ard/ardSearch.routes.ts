import { Router, Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import {
  ArdAtrForm, ArdTestRequest, ArdExperiment, ArdQcTrfForm,
} from '../../models/index'

const router = Router()

function canSeeAll(roleCode: string): boolean {
  return ['QA', 'HOD', 'ADMIN', 'SUPER_ADMIN'].includes(roleCode)
}

// GET /api/ard/search
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, ar_no, batch, technique } = req.query as Record<string, string>
    const user = (req as any).user
    const roleCode: string = (user?.role as any)?.code || ''
    const uid = user?.id

    if (!q && !ar_no && !batch && !technique) {
      return res.json(successResponse('Search results', { items: [] }))
    }

    const seeAll = canSeeAll(roleCode)
    const items: any[] = []

    // ATR search
    if (q) {
      const where: any = {
        [Op.or]: [
          { formNo: { [Op.iLike]: `%${q}%` } },
          { productName: { [Op.iLike]: `%${q}%` } },
          { projectCode: { [Op.iLike]: `%${q}%` } },
        ],
      }
      if (!seeAll) {
        where.createdById = uid
      }
      const atrs = await ArdAtrForm.findAll({ where, limit: 50, attributes: ['id', 'formNo', 'productName', 'status'] })
      atrs.forEach((f: any) => items.push({ id: f.id, kind: 'ATR', title: f.formNo, subtitle: f.productName, status: f.status }))
    }

    // Test search
    if (q || ar_no || batch || technique) {
      const orConditions: any[] = []
      if (q) {
        orConditions.push({ arNumber: { [Op.iLike]: `%${q}%` } })
        orConditions.push({ testType: { [Op.iLike]: `%${q}%` } })
      }
      if (ar_no) orConditions.push({ arNumber: { [Op.iLike]: `%${ar_no}%` } })
      if (technique) orConditions.push({ techniqueCode: { [Op.iLike]: `%${technique}%` } })
      if (batch) orConditions.push({ batchNo: { [Op.iLike]: `%${batch}%` } } as any)

      const testWhere: any = orConditions.length > 0 ? { [Op.or]: orConditions } : {}
      if (!seeAll) {
        testWhere.assignedToId = uid
      }
      const tests = await ArdTestRequest.findAll({ where: testWhere, limit: 50, attributes: ['id', 'testType', 'testSubtype', 'arNumber', 'status'] })
      tests.forEach((t: any) => items.push({ id: t.id, kind: 'Test', title: `${t.testType}${t.testSubtype ? ' / ' + t.testSubtype : ''}`, subtitle: t.arNumber, status: t.status }))
    }

    // Experiment search
    if (q) {
      const where: any = { code: { [Op.iLike]: `%${q}%` } }
      if (!seeAll) where.createdById = uid
      const exps = await ArdExperiment.findAll({ where, limit: 50, attributes: ['id', 'code', 'templateName', 'status'] })
      exps.forEach((e: any) => items.push({ id: e.id, kind: 'Experiment', title: e.code, subtitle: e.templateName, status: e.status }))
    }

    // QC-TRF search
    if (q || batch) {
      const orConditions: any[] = []
      if (q) {
        orConditions.push({ formNo: { [Op.iLike]: `%${q}%` } })
        orConditions.push({ projectName: { [Op.iLike]: `%${q}%` } })
        orConditions.push({ projectCode: { [Op.iLike]: `%${q}%` } })
      }
      if (batch) orConditions.push({ batchNo: { [Op.iLike]: `%${batch}%` } })

      const trfWhere: any = { [Op.or]: orConditions }
      if (!seeAll) trfWhere.createdById = uid

      const trfs = await ArdQcTrfForm.findAll({ where: trfWhere, limit: 50, attributes: ['id', 'formNo', 'projectName', 'status'] })
      trfs.forEach((f: any) => items.push({ id: f.id, kind: 'QC-TRF', title: f.formNo, subtitle: f.projectName, status: f.status }))
    }

    res.json(successResponse('Search results', { items: items.slice(0, 100) }))
  } catch (err) { next(err) }
})

export default router
