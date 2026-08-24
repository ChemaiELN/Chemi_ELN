import { Router, Request, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireDeptPrivilege } from '../shared/deptPrivileges'
import { successResponse } from '../utils/response'
import { NotFoundError, BadRequestError } from '../utils/errors'
import { AdcObjective, AdcRegulatoryClassification, AdcRiskAssessment, AdcRiskItem } from '../models/index'
import { enforceEsignature, ESIGN_FLAGS } from '../shared/ardSettings'

const adcRouter = Router()

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getRiskAssessmentByExperiment(experimentId: string): Promise<AdcRiskAssessment> {
  const record = await AdcRiskAssessment.findOne({ where: { experimentId } })
  if (!record) throw new NotFoundError('Risk assessment not found for this experiment')
  return record
}

// ── Objective ─────────────────────────────────────────────────────────────────

adcRouter.get('/objective/:experimentId', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const record = await AdcObjective.findOne({ where: { experimentId } })
  res.json(successResponse('ADC objective', record))
})

adcRouter.put('/objective/:experimentId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const body = req.body
  const [record, created] = await AdcObjective.findOrCreate({
    where: { experimentId },
    defaults: { experimentId, ...body },
  })
  if (!created) await record.update(body)
  res.json(successResponse('ADC objective saved', record))
})

// ── Regulatory Classification ─────────────────────────────────────────────────

adcRouter.get('/regulatory/:experimentId', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const record = await AdcRegulatoryClassification.findOne({ where: { experimentId } })
  res.json(successResponse('ADC regulatory classification', record))
})

adcRouter.put('/regulatory/:experimentId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const body = req.body
  const [record, created] = await AdcRegulatoryClassification.findOrCreate({
    where: { experimentId },
    defaults: { experimentId, ...body },
  })
  if (!created) await record.update(body)
  res.json(successResponse('ADC regulatory classification saved', record))
})

// ── Risk Assessment ───────────────────────────────────────────────────────────

adcRouter.get('/risk-assessment/:experimentId', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const record = await AdcRiskAssessment.findOne({
    where: { experimentId },
    include: [{ model: AdcRiskItem, as: 'items' }],
  })
  res.json(successResponse('ADC risk assessment', record))
})

adcRouter.put('/risk-assessment/:experimentId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const body = req.body
  const [record, created] = await AdcRiskAssessment.findOrCreate({
    where: { experimentId },
    defaults: { experimentId, ...body },
  })
  if (!created) await record.update(body)
  res.json(successResponse('ADC risk assessment saved', record))
})

adcRouter.post('/risk-assessment/:experimentId/approve', authenticate, requireDeptPrivilege('adc.experiment.risk_assessment_approve'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const { password } = req.body
  const user = (req as any).user
  await enforceEsignature(user, ESIGN_FLAGS.EXPERIMENT_APPROVE_AUTH, password)
  const record = await getRiskAssessmentByExperiment(experimentId)
  await record.update({ status: 'Approved' })
  res.json(successResponse('ADC risk assessment approved', record))
})

// ── Risk Items ────────────────────────────────────────────────────────────────

adcRouter.get('/risk-assessment/:experimentId/items', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const assessment = await getRiskAssessmentByExperiment(experimentId)
  const items = await AdcRiskItem.findAll({ where: { riskAssessmentId: assessment.id }, order: [['seqNo', 'ASC']] })
  res.json(successResponse('ADC risk items', items))
})

adcRouter.post('/risk-assessment/:experimentId/items', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const assessment = await getRiskAssessmentByExperiment(experimentId)
  const item = await AdcRiskItem.create({ riskAssessmentId: assessment.id as string, ...req.body })
  res.status(201).json(successResponse('ADC risk item created', item))
})

adcRouter.put('/risk-assessment/:experimentId/items/:itemId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const itemId = req.params.itemId as string
  const assessment = await getRiskAssessmentByExperiment(experimentId)
  const item = await AdcRiskItem.findOne({ where: { id: Number(itemId), riskAssessmentId: assessment.id } })
  if (!item) throw new NotFoundError('Risk item not found')
  await item.update(req.body)
  res.json(successResponse('ADC risk item updated', item))
})

adcRouter.delete('/risk-assessment/:experimentId/items/:itemId', authenticate, requireDeptPrivilege('adc.experiment.edit'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const itemId = req.params.itemId as string
  const assessment = await getRiskAssessmentByExperiment(experimentId)
  const item = await AdcRiskItem.findOne({ where: { id: Number(itemId), riskAssessmentId: assessment.id } })
  if (!item) throw new NotFoundError('Risk item not found')
  await item.destroy()
  res.json(successResponse('ADC risk item deleted', { deleted: true }))
})

// ── AD Submission Workflow ────────────────────────────────────────────────────

adcRouter.post('/experiments/:experimentId/submit-to-ad', authenticate, requireDeptPrivilege('adc.experiment.submit_to_ad'), async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const record = await getRiskAssessmentByExperiment(experimentId)
  await record.update({ status: 'Submitted' })
  res.json(successResponse('Submitted to AD', record))
})

adcRouter.post('/experiments/:experimentId/ad-results', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const { result, notes } = req.body
  if (!result) throw new BadRequestError('result is required')
  const record = await getRiskAssessmentByExperiment(experimentId)
  const combined = [result, notes].filter(Boolean).join('\n')
  await record.update({ status: 'AD_Reviewed', additionalNotes: combined })
  res.json(successResponse('AD results recorded', record))
})

// ── Experiment History (combined read) ────────────────────────────────────────

adcRouter.get('/experiments/:experimentId/adc-snapshot', authenticate, async (req: Request, res: Response) => {
  const experimentId = req.params.experimentId as string
  const [objective, regulatory, riskAssessment] = await Promise.all([
    AdcObjective.findOne({ where: { experimentId } }),
    AdcRegulatoryClassification.findOne({ where: { experimentId } }),
    AdcRiskAssessment.findOne({
      where: { experimentId },
      include: [{ model: AdcRiskItem, as: 'items' }],
    }),
  ])
  res.json(successResponse('ADC experiment history', { objective, regulatory, riskAssessment }))
})

export default adcRouter
