import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tag, Spin, Tooltip } from 'antd'
import { ArrowLeft, BookOpen, ChevronRight, CheckCircle, Clock, AlertCircle, Printer } from 'lucide-react'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'

interface TemplateField { key: string; label: string; type: string; required?: boolean }
interface TemplateScreen { key: string; title: string; fields: TemplateField[] }
interface TemplateSection { key: string; title: string; screens: TemplateScreen[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT:     <Clock size={14} className="text-slate-400" />,
  SUBMITTED: <Clock size={14} className="text-amber-500" />,
  APPROVED:  <CheckCircle size={14} className="text-emerald-500" />,
  REJECTED:  <AlertCircle size={14} className="text-red-500" />,
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

function sectionProgress(sec: TemplateSection) {
  const total = sec.screens.reduce((a, s) => a + s.fields.filter(f => f.required).length, 0)
  return total
}

export default function AdcNotebookPage() {
  const { projectId, notebookId } = useParams<{ projectId: string; notebookId: string }>()
  const navigate = useNavigate()

  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['adc-notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })

  const snapshot = nb?.template_snapshot as TemplateSnapshot | null | undefined

  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['adc-experiments', notebookId],
    queryFn:  () => experimentApi.listForNotebook(notebookId!),
    enabled:  !!notebookId,
  })

  const expBySection = new Map<string, Experiment>(
    experiments.map((e: Experiment) => [e.section_key, e])
  )

  const isLoading = loadingNb || loadingExp

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }

  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const sections: TemplateSection[] = snapshot?.sections ?? []

  return (
    <div className="p-6 lg:p-8">
      {/* Back */}
      <button
        onClick={() => navigate(`/adc/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Project
      </button>

      {/* Notebook header */}
      <div className="glass-card rounded-2xl p-5 lg:p-7 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <BookOpen size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">{nb.code}</span>
                <Tag color="default">{nb.status}</Tag>
              </div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{nb.title}</h1>
              {nb.description && <p className="text-sm lg:text-base text-slate-500 mt-0.5">{nb.description}</p>}
            </div>
          </div>
          <Tooltip title="Print notebook">
            <button
              onClick={() => window.open(`/adc/print/notebooks/${notebookId}`, '_blank')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300"
            >
              <Printer size={14} /> Print
            </button>
          </Tooltip>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 lg:gap-8 mt-5 pt-4 border-t border-slate-100">
          <div>
            <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest">Sections</p>
            <p className="text-2xl lg:text-3xl font-bold text-slate-800">{sections.length}</p>
          </div>
          <div>
            <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest">Completed</p>
            <p className="text-2xl lg:text-3xl font-bold text-emerald-600">
              {experiments.filter((e: Experiment) => e.status === 'APPROVED').length}
            </p>
          </div>
          <div>
            <p className="text-[10px] lg:text-xs text-slate-400 uppercase tracking-widest">In Progress</p>
            <p className="text-2xl lg:text-3xl font-bold text-indigo-600">
              {experiments.filter((e: Experiment) => e.status === 'DRAFT').length}
            </p>
          </div>
        </div>
      </div>

      {/* Section cards */}
      {sections.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm">No template sections found.</p>
          <p className="text-slate-300 text-xs mt-1">Ensure the notebook was created with a valid workflow template.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((sec, idx) => {
            const exp = expBySection.get(sec.key)
            const status = exp?.status ?? null
            const screenCount = sec.screens.length
            const fieldCount = sec.screens.reduce((a, s) => a + s.fields.length, 0)

            return (
              <button
                key={sec.key}
                onClick={() => navigate(`/adc/projects/${projectId}/notebooks/${notebookId}/sections/${sec.key}`)}
                className="w-full glass-card rounded-xl px-4 lg:px-6 py-3.5 lg:py-4 flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
              >
                {/* Index */}
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 text-slate-500 font-bold text-sm lg:text-base">
                  {idx + 1}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm lg:text-base font-semibold text-slate-800 truncate">{sec.title}</span>
                    {status && (
                      <Tag color={STATUS_COLOR[status]} className="text-[11px] shrink-0">{status}</Tag>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs lg:text-sm text-slate-400">
                    <span>{screenCount} screen{screenCount !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
                    {exp && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-[11px]">{exp.full_code}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status icon */}
                <div className="shrink-0 flex items-center gap-2">
                  {status ? STATUS_ICON[status] : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
