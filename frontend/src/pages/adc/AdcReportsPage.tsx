import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Table, Tag, Select, Tooltip, message } from 'antd'
import { Search, Download, FileText, CheckCircle2 } from 'lucide-react'
import dayjs from 'dayjs'
import { experimentApi, type ExperimentListItem } from '../../api/adc'
import { BTN_32 } from '../../utils/buttonSize'

export default function AdcReportsPage() {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [downloading, setDl]  = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reports-approved', search, page],
    queryFn: () => experimentApi.listAll({
      search: search || undefined,
      status: 'APPROVED',
      page,
      limit: 20,
    }),
  })

  const experiments = data?.items ?? []
  const total       = data?.total ?? 0

  const handleDownload = async (exp: ExperimentListItem) => {
    setDl(exp.id)
    try {
      const { blob, filename } = await experimentApi.downloadReport(exp.id)
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      message.success('Report downloaded')
    } catch {
      message.error('Failed to generate report')
    } finally {
      setDl(null)
    }
  }

  const columns = [
    {
      title: 'Code',
      dataIndex: 'full_code',
      key: 'full_code',
      width: 150,
      render: (v: string) => (
        <span className="font-mono text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Experiment',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => (
        <span className="text-[13px] font-medium text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Project',
      key: 'project',
      width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <div className="text-[12px]">
          <div className="font-medium text-slate-700">{row.project_code}</div>
          <div className="text-slate-400 truncate max-w-[140px]">{row.project_name}</div>
        </div>
      ),
    },
    {
      title: 'Notebook',
      key: 'notebook',
      width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <div className="text-[12px]">
          <div className="font-medium text-slate-700">{row.notebook_code}</div>
          <div className="text-slate-400 truncate max-w-[140px]">{row.notebook_title}</div>
        </div>
      ),
    },
    {
      title: 'Approved At',
      dataIndex: 'approved_at',
      key: 'approved_at',
      width: 160,
      render: (v: string) => v ? (
        <div className="text-[12px] text-slate-600">
          {dayjs(v).format('DD MMM YYYY')}
          <div className="text-slate-400">{dayjs(v).format('HH:mm')}</div>
        </div>
      ) : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: () => <Tag color="green" className="text-[11px]">APPROVED</Tag>,
    },
    {
      title: 'Report',
      key: 'report',
      width: 100,
      render: (_: unknown, row: ExperimentListItem) => (
        <Tooltip title="Download .docx report">
          <button
            onClick={() => handleDownload(row)}
            disabled={downloading === row.id}
            style={BTN_32}
            className={`flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all
              ${downloading === row.id
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'
              }`}
          >
            <Download size={12} className={downloading === row.id ? 'animate-bounce' : ''} />
            {downloading === row.id ? 'Generating…' : 'Download'}
          </button>
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0">
          <FileText size={17} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Experiment Reports</h1>
          <p className="text-xs text-slate-500">Download Word (.docx) reports for approved experiments</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
            <CheckCircle2 size={11} />
            {total} approved
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search by code, title, project…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          allowClear
          className="max-w-sm text-sm"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <Table
          dataSource={experiments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t} experiments`,
            size: 'small',
          }}
          size="small"
          scroll={{ x: 900 }}
          locale={{ emptyText: search ? 'No approved experiments match your search.' : 'No approved experiments yet. Approve an experiment to see it here.' }}
        />
      </div>
    </div>
  )
}
