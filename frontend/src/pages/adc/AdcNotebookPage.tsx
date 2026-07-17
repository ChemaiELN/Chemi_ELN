import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tag, Spin, Table, Tooltip } from 'antd'
import { ArrowLeft, BookOpen, ChevronRight, Printer, Search } from 'lucide-react'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { BTN_32 } from '../../utils/buttonSize'

interface TemplateField   { key: string; label: string; type: string; required?: boolean }
interface TemplateScreen  { key: string; title: string; fields: TemplateField[] }
interface TemplateSection { key: string; title: string; screens: TemplateScreen[] }
interface TemplateSnapshot { sections: TemplateSection[] }

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'gold', APPROVED: 'green', REJECTED: 'red',
}

export default function AdcNotebookPage() {
  const { projectId, notebookId } = useParams<{ projectId: string; notebookId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: nb, isLoading: loadingNb } = useQuery({
    queryKey: ['adc-notebook', notebookId],
    queryFn:  () => notebookApi.get(notebookId!),
    enabled:  !!notebookId,
  })

  useBreadcrumbLabel(notebookId ?? '', nb?.title ?? nb?.code ?? null)

  const snapshot = nb?.template_snapshot as TemplateSnapshot | null | undefined

  const { data: experiments = [], isLoading: loadingExp } = useQuery({
    queryKey: ['adc-experiments', notebookId],
    queryFn:  () => experimentApi.listForNotebook(notebookId!),
    enabled:  !!notebookId,
  })

  if (loadingNb || loadingExp) {
    return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  }
  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const sections: TemplateSection[] = snapshot?.sections ?? []
  const expBySection = new Map<string, Experiment>(
    experiments.map((e: Experiment) => [e.section_key, e])
  )

  const q = search.trim().toLowerCase()
  const filtered = q
    ? sections.filter(s => s.title.toLowerCase().includes(q))
    : sections

  const columns = [
    {
      title: '#', key: 'idx', width: 52,
      render: (_: unknown, __: TemplateSection, i: number) => (
        <span className="text-[13px] text-slate-400 ">{i + 1}</span>
      ),
    },
    {
      title: 'Section', dataIndex: 'title', key: 'title',
      render: (v: string, row: TemplateSection) => (
        <button
          onClick={() => navigate(`/adc/projects/${projectId}/notebooks/${notebookId}/sections/${row.key}`)}
          className="text-[13px] font-medium text-slate-700 hover:text-slate-900 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Screens', key: 'screens', width: 90,
      render: (_: unknown, row: TemplateSection) => (
        <span className="text-[13px] text-slate-500">{row.screens.length}</span>
      ),
    },
    {
      title: 'Fields', key: 'fields', width: 80,
      render: (_: unknown, row: TemplateSection) => (
        <span className="text-[13px] text-slate-500">
          {row.screens.reduce((a, s) => a + s.fields.length, 0)}
        </span>
      ),
    },
    {
      title: 'Exp Code', key: 'exp_code', width: 130,
      render: (_: unknown, row: TemplateSection) => {
        const exp = expBySection.get(row.key)
        return exp
          ? <span className=" text-[12px] text-slate-600">{exp.full_code}</span>
          : <span className="text-slate-300 text-[13px]">—</span>
      },
    },
    {
      title: 'Status', key: 'status', width: 110,
      render: (_: unknown, row: TemplateSection) => {
        const exp = expBySection.get(row.key)
        return exp
          ? <Tag color={STATUS_COLOR[exp.status] ?? 'default'}>{exp.status}</Tag>
          : <span className="text-slate-300 text-[13px]">—</span>
      },
    },
    {
      title: '', key: 'action', width: 44,
      render: (_: unknown, row: TemplateSection) => (
        <Tooltip title="Open section">
          <button
            onClick={() => navigate(`/adc/projects/${projectId}/notebooks/${notebookId}/sections/${row.key}`)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/adc/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-indigo-600 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Project
      </button>

      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">{nb.title}</h1>
              <span className=" text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{nb.code}</span>
              <Tag color={STATUS_COLOR[nb.status] ?? 'default'} className="text-xs">{nb.status}</Tag>
            </div>
            <p className="text-xs text-slate-400">{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Tooltip title="Print notebook">
          <button
            onClick={() => window.open(`/adc/print/notebooks/${notebookId}`, '_blank')}
            style={BTN_32}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600 transition-colors px-3 rounded-lg hover:bg-violet-50 border border-slate-200 hover:border-violet-300"
          >
            <Printer size={14} /> Print
          </button>
        </Tooltip>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sections..."
            className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="key"
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 20,
            hideOnSinglePage: true,
            showTotal: t => `${t} section${t !== 1 ? 's' : ''}`,
            size: 'small',
          }}
          locale={{ emptyText: sections.length === 0 ? 'No template sections found.' : 'No sections match your search.' }}
        />
      </div>
    </div>
  )
}
