import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from './client'
import type { WorkflowTemplate } from './adc'

export interface TemplateWithEnabled extends WorkflowTemplate {
  enabled: boolean
}

export interface CgtProcess {
  id: string
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export const templateSettingsApi = {
  // ADC
  listAdcTemplates: () => apiGet<TemplateWithEnabled[]>('/api/template-settings/adc/templates'),
  saveAdcTemplates:  (templateIds: string[]) => apiPut<{ template_ids: string[] }>('/api/template-settings/adc/templates', { template_ids: templateIds }),
  listAdcEnabled:    () => apiGet<WorkflowTemplate[]>('/api/template-settings/adc/enabled'),

  // CGT processes
  listCgtProcesses:  (params?: { is_active?: boolean }) => apiGet<CgtProcess[]>('/api/template-settings/cgt/processes', params as Record<string, unknown>),
  createCgtProcess:  (name: string) => apiPost<CgtProcess>('/api/template-settings/cgt/processes', { name }),
  updateCgtProcess:  (id: string, body: { name?: string; sort_order?: number; is_active?: boolean }) => apiPatch<CgtProcess>(`/api/template-settings/cgt/processes/${id}`, body),
  deleteCgtProcess:  (id: string) => apiDelete<void>(`/api/template-settings/cgt/processes/${id}`),

  // CGT per-process template selection
  listCgtProcessTemplates: (processId: string) => apiGet<TemplateWithEnabled[]>(`/api/template-settings/cgt/processes/${processId}/templates`),
  saveCgtProcessTemplates: (processId: string, templateIds: string[]) => apiPut<{ template_ids: string[] }>(`/api/template-settings/cgt/processes/${processId}/templates`, { template_ids: templateIds }),

  // Consumer lookup by process name
  templatesForProcess: (processName: string) => apiGet<WorkflowTemplate[]>('/api/template-settings/cgt/process-templates', { process: processName }),
}
