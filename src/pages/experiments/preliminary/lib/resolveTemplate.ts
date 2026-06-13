import {
  getNotebook,
  getWorkflowTemplate,
  type NotebookResponse,
  type WorkflowTemplateResponse,
} from '@/utilities/chemiaApi'
import { parseWorkflowDefinition, type WorkflowDefinition } from './templateTypes'

const NB_TMPL_KEY = (nbId: string) => `chemia_nb_tmpl_${nbId}`

export interface ResolvedNotebookTemplate {
  templateId: string | null
  templateName: string | null
  templateSlug: string | null
  definition: WorkflowDefinition
}

export async function resolveNotebookTemplate(
  notebookId: string,
): Promise<ResolvedNotebookTemplate | null> {
  const nb = await getNotebook(notebookId)
  return resolveTemplateFromNotebook(nb)
}

export async function resolveTemplateFromNotebook(
  nb: NotebookResponse,
): Promise<ResolvedNotebookTemplate | null> {
  const templateId = nb.template_id ?? localStorage.getItem(NB_TMPL_KEY(nb.id))
  if (!templateId && !nb.template_snapshot) return null

  if (nb.template_snapshot) {
    return {
      templateId: nb.template_id ?? templateId,
      templateName: nb.template_name,
      templateSlug: nb.template_slug,
      definition: parseWorkflowDefinition(nb.template_snapshot),
    }
  }

  if (!templateId) return null

  const tmpl: WorkflowTemplateResponse = await getWorkflowTemplate(templateId)
  return {
    templateId: tmpl.id,
    templateName: tmpl.name,
    templateSlug: tmpl.slug,
    definition: parseWorkflowDefinition(tmpl.definition as Record<string, unknown> | undefined),
  }
}

export function notebookHasWorkflowTemplate(nb: Pick<NotebookResponse, 'template_id' | 'template_snapshot'>): boolean {
  return !!(nb.template_id || nb.template_snapshot)
}

/** UI routing check — includes localStorage fallback from notebook creation. */
export function notebookUsesWorkflowTemplate(nb: Pick<NotebookResponse, 'id' | 'template_id' | 'template_snapshot'>): boolean {
  if (notebookHasWorkflowTemplate(nb)) return true
  try {
    return !!localStorage.getItem(NB_TMPL_KEY(nb.id))
  } catch {
    return false
  }
}

export function workflowNotebookIds(notebooks: NotebookResponse[]): Set<string> {
  return new Set(notebooks.filter(notebookUsesWorkflowTemplate).map(nb => nb.id))
}
