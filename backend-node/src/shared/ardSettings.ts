import { ArdSetting } from '../models/ArdModels.model'
import { User } from '../models/User.model'
import { verifyPassword } from '../utils/auth.utils'
import { BadRequestError } from '../utils/errors'

export async function settingEnabled(key: string): Promise<boolean> {
  const setting = await ArdSetting.findOne({ where: { key } })
  if (!setting) return false
  const val = (setting.value || '').toLowerCase()
  return val === 'true' || val === '1' || val === 'yes'
}

export async function enforceEsignature(
  user: User,
  flagKey: string,
  password?: string,
): Promise<void> {
  const flagOn = await settingEnabled(flagKey)
  if (!flagOn) return
  if (!password) {
    throw new BadRequestError(
      'Electronic signature required. Please provide your password.',
      'ESIGNATURE_REQUIRED',
    )
  }
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    throw new BadRequestError(
      'Electronic signature failed. Incorrect password.',
      'ESIGNATURE_FAILED',
    )
  }
}

// All e-signature flag keys used in the ARD module
export const ESIGN_FLAGS = {
  ATR_QA_PRE_APPROVAL: 'ATRQAPreApproval',
  ASSIGN_TEST: 'AssignTest',
  INDIVIDUAL_TEST_ASSIGNMENT: 'IndividualTestAssignment',
  ASSIGN_TEST_AUTH: 'AssignTestAuthentication',
  EXPERIMENT_SUBMIT_AUTH: 'ExperimentSubmitAuthentication',
  EXPERIMENT_APPROVE_AUTH: 'ExperimentApproveAuthentication',
  EXPERIMENT_VERIFY_SUBMIT_AUTH: 'ExperimentVerifySubmitAuthentication',
  EXPERIMENT_REJECT_AUTH: 'ExperimentRejectAuthentication',
  EXPERIMENT_DEACTIVATE_AUTH: 'ExperimentDeactivateAuthentication',
  QA_CERTIFY_AUTH: 'QACertifyAuthentication',
  QA_REJECT_AUTH: 'QARejectAuthentication',
  INCLUDE_AD_VERIFICATION: 'IncludeADVerificationFlow',
  VERIFICATION_REQUEST_FLOW: 'VerificationRequestFlow',
  DELAYED_SUBMISSION_EXP_AD: 'DelayedSubmissionExpAD',
  WORK_ORDER_VERIFY_AUTH: 'WorkOrderVerifyAuthentication',
  WORK_ORDER_APPROVE_AUTH: 'WorkOrderApproveAuthentication',
  GATE_PASS_APPROVE_AUTH: 'GatePassApproveAuthentication',
  GATE_PASS_DISPATCH_AUTH: 'GatePassDispatchAuthentication',
} as const
