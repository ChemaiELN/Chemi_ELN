import { ArdAtrForm, ArdAuditLog } from '../models/index'
import { generateAtrNumber } from '../utils/idSequence'
import { ForbiddenError } from '../utils/errors'

/**
 * Creating an ARD work item from an external module's experiment.
 *
 * Ported from backend/app/shared/ard_external_requests.py. REQUESTED is the handoff
 * state: immutable to the requester, and ARD then receives it into its normal
 * NEW/processing workflow.
 */

// Only a user from the module's own department may raise its requests.
const EXTERNAL_MODULE_DEPARTMENTS: Record<string, string> = { ADC: 'ADC_PD', CGT: 'CGT' }

export interface ExternalAtrOrigin {
  originModule: 'ADC' | 'CGT'
  projectId?: string | null
  projectCode?: string | null
  projectName?: string | null
  notebookId?: string | null
  notebookCode?: string | null
  experimentId: string
  experimentCode?: string | null
  sectionId?: string | null
  sectionTitle?: string | null
  snapshot?: unknown
}

export async function createRequestedAtrFromExperiment(
  user: any,
  origin: ExternalAtrOrigin,
): Promise<any> {
  const expectedDepartment = EXTERNAL_MODULE_DEPARTMENTS[origin.originModule]
  const actualDepartment = (user?.department as any)?.code ?? null
  const roleCode = (user?.role as any)?.code ?? ''
  // SUPER_ADMIN is allowed through so the flow stays testable by an admin account.
  if (!expectedDepartment || (actualDepartment !== expectedDepartment && roleCode !== 'SUPER_ADMIN')) {
    throw new ForbiddenError("The requester's department does not match the source module.")
  }

  const formNo = await generateAtrNumber()
  const form = await ArdAtrForm.create({
    formNo,
    formTypeName: 'Experiment ATR',
    status: 'REQUESTED',
    projectCode: origin.projectCode ?? '',
    productName: origin.projectName ?? '',
    assignedTl: '',
    createdBy: user?.username ?? 'system',
    createdById: user?.id ?? null,
    attributeValues: {},
    originModule: origin.originModule,
    originProjectId: origin.projectId ? String(origin.projectId) : null,
    originProjectCode: origin.projectCode ?? null,
    originProjectName: origin.projectName ?? null,
    originNotebookId: origin.notebookId ? String(origin.notebookId) : null,
    originNotebookCode: origin.notebookCode ?? null,
    originExperimentId: String(origin.experimentId),
    originExperimentCode: origin.experimentCode ?? null,
    originSectionId: origin.sectionId ?? null,
    originSectionTitle: origin.sectionTitle ?? null,
    originSnapshot: origin.snapshot ?? null,
  } as any)

  try {
    await ArdAuditLog.create({
      entityType: 'ATR',
      entityId: (form as any).id,
      action: `Requested from ${origin.originModule}`,
      detail: `${formNo} - ${origin.experimentCode ?? origin.experimentId}`,
      userId: user?.id ?? null,
    } as any)
  } catch {
    // audit failures must never block the handoff
  }

  return form
}
