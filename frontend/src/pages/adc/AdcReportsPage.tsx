import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Input, Table, Tooltip, message } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Search, Download, CheckCircle2 } from 'lucide-react'
import dayjs from 'dayjs'
import { experimentApi, type ExperimentListItem } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { BTN_32 } from '../../utils/buttonSize'
import { EmptyValue } from '../../components/ui/EmptyValue'

const STATUS_COLOR: Record<string, string> = {
  APPROVED: 'green',
}

export default function AdcReportsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [downloading, setDl]  = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])
  useEffect(() => { setPage(1) }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['reports-approved', search, page, pageSize, sortBy, sortDir],
    queryFn: () => experimentApi.listAll({
      search: search || undefined,
      status: 'APPROVED',
      page,
      limit: pageSize,
      sort_by: sortBy ?? undefined,
      sort_dir: sortDir,
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
      width: 130,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Experiment',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{v}</span>
      ),
    },
    {
      title: 'Project',
      key: 'project',
      width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <div className="text-[13px]">
          <div className="text-slate-800">{row.project_code}</div>
          <div className="text-slate-400 text-[12px] truncate max-w-[140px]">{row.project_name}</div>
        </div>
      ),
    },
    {
      title: 'Notebook',
      key: 'notebook',
      width: 160,
      render: (_: unknown, row: ExperimentListItem) => (
        <div className="text-[13px]">
          <div className="text-slate-800">{row.notebook_code}</div>
          <div className="text-slate-400 text-[12px] truncate max-w-[140px]">{row.notebook_title}</div>
        </div>
      ),
    },
    {
      title: 'Approved At',
      dataIndex: 'approved_at',
      key: 'approved_at',
      width: 130,
      sorter: true,
      render: (v: string) => v ? (
        <div className="text-[13px] text-slate-800">
          {dayjs(v).format('DD MMM YYYY')}
          <div className="text-slate-400 text-[12px]">{dayjs(v).format('HH:mm')}</div>
        </div>
      ) : <EmptyValue />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center' as const,
      render: () => <StatusTag color={STATUS_COLOR.APPROVED} className="text-[13px]">APPROVED</StatusTag>,
    },
    {
      title: 'Report',
      key: 'report',
      width: 130,
      render: (_: unknown, row: ExperimentListItem) => (
        <Tooltip title="Download .docx report">
          <button
            onClick={() => handleDownload(row)}
            disabled={downloading === row.id}
            style={BTN_32}
            className={`flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all
              ${downloading === row.id
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700'
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
    <div className="p-6">
      {/* Filter bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        {/* <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Experiment Reports</h1>
          <p className="text-xs text-slate-500">Download Word (.docx) reports for approved experiments</p>
        </div> */}
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search by code, title…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <span className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200/60 rounded-full px-2.5 py-1 ml-auto">
          <CheckCircle2 size={11} />
          {total} approved
        </span>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          dataSource={experiments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total,
            showTotal: (t) => `${t} experiments`,
            size: 'small',
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<ExperimentListItem>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: search ? 'No approved experiments match your search.' : 'No approved experiments yet. Approve an experiment to see it here.' }}
        />
      </div>
    </div>
  )
}
