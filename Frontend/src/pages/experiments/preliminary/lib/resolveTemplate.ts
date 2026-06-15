import {
  getNotebook,
  getWorkflowTemplate,
  type NotebookResponse,
  type WorkflowTemplateResponse,
} from '@/utilities/chemiaApi'
import { parseWorkflowDefinition, type WorkflowDefinition } from './templateTypes'

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
  if (nb.template_snapshot) {
    return {
      templateId: nb.template_id ?? null,
      templateName: nb.template_name,
      templateSlug: nb.template_slug,
      definition: parseWorkflowDefinition(nb.template_snapshot),
    }
  }

  if (!nb.template_id) return null

  const tmpl: WorkflowTemplateResponse = await getWorkflowTemplate(nb.template_id)
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

export function notebookUsesWorkflowTemplate(nb: Pick<NotebookResponse, 'template_id' | 'template_snapshot'>): boolean {
  return notebookHasWorkflowTemplate(nb)
}

export function workflowNotebookIds(notebooks: NotebookResponse[]): Set<string> {
  return new Set(notebooks.filter(notebookUsesWorkflowTemplate).map(nb => nb.id))
}
