import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { NotFoundError } from '../../utils/errors'
import {
  InvInstrumentParameter,
  InvInstrumentSpecDetail,
} from '../../models/InventoryModels.model'

// ─────────────────────────────────────────────────────────────────────────────
// Instrument Spec Router
// Mounted under the /instruments prefix (alongside instrumentRouter)
// ─────────────────────────────────────────────────────────────────────────────

const instrumentSpecRouter = Router()

// ── Parameters ────────────────────────────────────────────────────────────────

instrumentSpecRouter.get(
  '/:instrumentId/parameters',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instrumentId = parseInt(req.params.instrumentId as string, 10)
      const rows = await InvInstrumentParameter.findAll({
        where: { instrumentId },
        order: [['seqNo', 'ASC']],
      })
      res.json(successResponse('Instrument parameters', rows))
    } catch (err) { next(err) }
  },
)

instrumentSpecRouter.post(
  '/:instrumentId/parameters',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instrumentId = parseInt(req.params.instrumentId as string, 10)
      const record = await InvInstrumentParameter.create({ ...req.body, instrumentId, createdAt: new Date() })
      res.status(201).json(successResponse('Parameter created', record))
    } catch (err) { next(err) }
  },
)

// ── Spec Details ──────────────────────────────────────────────────────────────

instrumentSpecRouter.get(
  '/:instrumentId/spec-details',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instrumentId = parseInt(req.params.instrumentId as string, 10)
      const rows = await InvInstrumentSpecDetail.findAll({
        where: { instrumentId },
        order: [['seqNo', 'ASC']],
      })
      res.json(successResponse('Instrument spec details', rows))
    } catch (err) { next(err) }
  },
)

instrumentSpecRouter.post(
  '/:instrumentId/spec-details',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const instrumentId = parseInt(req.params.instrumentId as string, 10)
      const record = await InvInstrumentSpecDetail.create({ ...req.body, instrumentId, createdAt: new Date() })
      res.status(201).json(successResponse('Spec detail created', record))
    } catch (err) { next(err) }
  },
)

// ── Parameter sub-resource (flat path — mounted at router level) ──────────────
// PATCH /instrument-parameters/:paramId
// DELETE /instrument-parameters/:paramId
// These are registered on a separate path; caller mounts this router at /instruments
// and also mounts it at / so the flat paths resolve correctly.
// We export a second small router for flat parameter/spec-detail routes.

export const instrumentParamDetailRouter = Router()

instrumentParamDetailRouter.patch(
  '/instrument-parameters/:paramId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramId = req.params.paramId as string
      const record = await InvInstrumentParameter.findByPk(paramId)
      if (!record) throw new NotFoundError('Parameter not found')
      await record.update(req.body)
      res.json(successResponse('Parameter updated', record))
    } catch (err) { next(err) }
  },
)

instrumentParamDetailRouter.delete(
  '/instrument-parameters/:paramId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramId = req.params.paramId as string
      const record = await InvInstrumentParameter.findByPk(paramId)
      if (!record) throw new NotFoundError('Parameter not found')
      await record.destroy()
      res.json(successResponse('Parameter deleted', null))
    } catch (err) { next(err) }
  },
)

instrumentParamDetailRouter.patch(
  '/instrument-spec-details/:detailId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detailId = req.params.detailId as string
      const record = await InvInstrumentSpecDetail.findByPk(detailId)
      if (!record) throw new NotFoundError('Spec detail not found')
      await record.update(req.body)
      res.json(successResponse('Spec detail updated', record))
    } catch (err) { next(err) }
  },
)

instrumentParamDetailRouter.delete(
  '/instrument-spec-details/:detailId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detailId = req.params.detailId as string
      const record = await InvInstrumentSpecDetail.findByPk(detailId)
      if (!record) throw new NotFoundError('Spec detail not found')
      await record.destroy()
      res.json(successResponse('Spec detail deleted', null))
    } catch (err) { next(err) }
  },
)

export default instrumentSpecRouter
