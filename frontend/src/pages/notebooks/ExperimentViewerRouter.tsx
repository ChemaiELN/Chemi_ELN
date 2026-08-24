import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Spin } from 'antd'
import { notebookApi, workflowTemplateApi } from '../../api/adc'
import ExperimentDetailPage from './ExperimentDetailPage'
import AdcBuilderExperimentPage from './AdcBuilderExperimentPage'

// Gatekeeper for the global /notebooks/:notebookId/experiments/:experimentId
// route: picks which viewer renders this notebook's experiment, without
// touching either viewer's own code. Builder-authored templates (category
// starting with "CGT_", e.g. the CGT_ADC "ADC Synthesis" template usable from
// an ADC project) render with AdcBuilderExperimentPage; every other
// (legacy hardcoded-screen) template keeps using the existing
// ExperimentDetailPage unchanged.
export default function ExperimentViewerRouter() {
  const { notebookId } = useParams<{ notebookId: string }>()

  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['notebook', notebookId],
    queryFn: () => notebookApi.get(notebookId!),
    enabled: !!notebookId,
  })

  const { data: tmpl, isLoading: loadingTmpl } = useQuery({
    queryKey: ['workflow-template', nb?.template_id],
    queryFn: () => workflowTemplateApi.get(nb!.template_id!),
    enabled: !!nb?.template_id,
  })

  if (loadingNb || (nb?.template_id && loadingTmpl)) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }

  const isBuilderTemplate = tmpl?.category?.startsWith('CGT_') ?? false
  return isBuilderTemplate ? <AdcBuilderExperimentPage /> : <ExperimentDetailPage />
}
