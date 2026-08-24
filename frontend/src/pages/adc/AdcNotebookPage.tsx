import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tooltip, Input, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeft, BookOpen, Printer, Search } from 'lucide-react'
import { notebookApi, experimentApi, type Experiment } from '../../api/adc'
import { NotebookLifecycleActions, LifecycleStatusTag } from '../../components/lifecycle/LifecycleActions'
import { useCan } from '../../hooks/usePrivilege'
import { StatusTag } from '../../components/ui/StatusTag'
import { useBreadcrumbLabel } from '../../components/layout/AdcShell'
import { BTN_32 } from '../../utils/buttonSize'
import BrandSpinner from '../../components/ui/BrandSpinner'
import { EmptyValue } from '../../components/ui/EmptyValue'

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
  const qc = useQueryClient()

  const canClose = useCan('adc.notebook.close')
  const canReopen = useCan('adc.notebook.reopen')
  const canDeactivate = useCan('adc.notebook.deactivate')

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm,  setSearchTerm]  = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

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

  const invalidateNotebook = () => qc.invalidateQueries({ queryKey: ['adc-notebook', notebookId] })
  const closeMut = useMutation({
    mutationFn: (password: string) => notebookApi.close(notebookId!, { password }),
    onSuccess: () => { invalidateNotebook(); message.success('Notebook closed.') },
  })
  const reopenMut = useMutation({
    mutationFn: (password: string) => notebookApi.reopen(notebookId!, { password }),
    onSuccess: () => { invalidateNotebook(); message.success('Notebook reopened.') },
  })
  const deactivateMut = useMutation({
    mutationFn: (password: string) => notebookApi.deactivate(notebookId!, { password }),
    onSuccess: () => { invalidateNotebook(); message.success('Notebook deactivated.') },
  })

  if (loadingNb || loadingExp) {
    return <div className="p-6 h-[60vh]"><BrandSpinner fullScreen={false} label="Loading notebook…" /></div>
  }
  if (!nb) return <div className="p-6 text-slate-500">Notebook not found.</div>

  const sections: TemplateSection[] = snapshot?.sections ?? []
  const expBySection = new Map<string, Experiment>(
    experiments.map((e: Experiment) => [e.section_key, e])
  )

  const filtered = searchTerm
    ? sections.filter(s => s.title.toLowerCase().includes(searchTerm))
    : sections

  const columns: ColumnsType<TemplateSection> = [
    {
      title: '#', key: 'idx', width: 52,
      render: (_: unknown, __: TemplateSection, i: number) => (
        <span className="text-[13px] text-slate-400">{i + 1}</span>
      ),
    },
    {
      title: 'Section', dataIndex: 'title', key: 'title', width: 200,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v: string, row: TemplateSection) => (
        <button
          onClick={() => navigate(`/adc/projects/${projectId}/notebooks/${notebookId}/sections/${row.key}`)}
          className="text-[13px] font-medium text-violet-600 hover:text-violet-800 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Screens', key: 'screens', width: 130,
      sorter: (a, b) => a.screens.length - b.screens.length,
      render: (_: unknown, row: TemplateSection) => (
        <span className="text-[13px] text-slate-800">{row.screens.length}</span>
      ),
    },
    {
      title: 'Fields', key: 'fields', width: 130,
      sorter: (a, b) =>
        a.screens.reduce((n, s) => n + s.fields.length, 0) - b.screens.reduce((n, s) => n + s.fields.length, 0),
      render: (_: unknown, row: TemplateSection) => (
        <span className="text-[13px] text-slate-800">
          {row.screens.reduce((a, s) => a + s.fields.length, 0)}
        </span>
      ),
    },
    {
      title: 'Exp Code', key: 'exp_code', width: 130,
      sorter: (a, b) => (expBySection.get(a.key)?.full_code ?? '').localeCompare(expBySection.get(b.key)?.full_code ?? ''),
      render: (_: unknown, row: TemplateSection) => {
        const exp = expBySection.get(row.key)
        return exp
          ? <span className="text-[13px] text-slate-800">{exp.full_code}</span>
          : <EmptyValue />
      },
    },
    {
      title: 'Status', key: 'status', width: 130, align: 'center' as const,
      sorter: (a, b) => (expBySection.get(a.key)?.status ?? '').localeCompare(expBySection.get(b.key)?.status ?? ''),
      render: (_: unknown, row: TemplateSection) => {
        const exp = expBySection.get(row.key)
        return exp
          ? <StatusTag color={STATUS_COLOR[exp.status] ?? 'default'} className="text-[13px]">{exp.status}</StatusTag>
          : <EmptyValue />
      },
    },
  ]

  return (
    <div className="p-6">
      {/* Back */}
      <button
        onClick={() => navigate(`/adc/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-violet-600 mb-5 transition-colors"
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
              <LifecycleStatusTag status={nb.status} />
            </div>
            <p className="text-xs text-slate-400">{sections.length} section{sections.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotebookLifecycleActions
            status={nb.status}
            canClose={canClose}
            canReopen={canReopen}
            canDeactivate={canDeactivate}
            nonApprovedExperimentCount={experiments.filter((e: Experiment) => e.status !== 'APPROVED').length}
            hasAnyExperiment={experiments.length > 0}
            onClose={p => closeMut.mutateAsync(p)}
            onReopen={p => reopenMut.mutateAsync(p)}
            onDeactivate={p => deactivateMut.mutateAsync(p)}
          />
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
      </div>

      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search sections…"
          style={{ width: 240 }}
          allowClear
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="key"
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 8,
            showSizeChanger: false,
            showTotal: t => `${t} section${t !== 1 ? 's' : ''}`,
            size: 'small',
          }}
          locale={{ emptyText: sections.length === 0 ? 'No template sections found.' : 'No sections match your search.' }}
        />
      </div>
    </div>
  )
}
