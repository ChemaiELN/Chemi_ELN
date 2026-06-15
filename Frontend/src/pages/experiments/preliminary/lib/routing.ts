export const ADC_TEMPLATE_SLUG           = 'adc-preliminary'
export const ADC_SYNTHESIS_TEMPLATE_SLUG = 'adc-synthesis'

/** All template slugs that use the workflow experiment viewer */
export const WORKFLOW_TEMPLATE_SLUGS = new Set([
  ADC_TEMPLATE_SLUG,
  ADC_SYNTHESIS_TEMPLATE_SLUG,
])

export function workflowExperimentPath(experimentId: string): string {
  return `/experiments/${experimentId}/preliminary`
}

/** @deprecated use workflowExperimentPath */
export const adcWorkflowPath = workflowExperimentPath

export function experimentDetailPath(
  experimentId: string,
  hasWorkflowTemplate?: boolean,
): string {
  if (hasWorkflowTemplate) return workflowExperimentPath(experimentId)
  return `/experiments/${experimentId}`
}
