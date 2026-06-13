export const ADC_TEMPLATE_SLUG = 'adc-preliminary'

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
