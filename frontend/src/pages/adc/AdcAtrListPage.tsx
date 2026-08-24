import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Table, Input } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { FlaskConical, Search } from 'lucide-react'
import { atrApi, type ExperimentAtr } from '../../api/adc'
import { StatusTag } from '../../components/ui/StatusTag'
import { EmptyValue } from '../../components/ui/EmptyValue'
import dayjs from 'dayjs'

// ATRs (Analytical Test Requests) this chemist has raised against their own
// experiments (e.g. clicking "Lock Fields Above" in 1.1 Antibody Info). Pure
// "raise" tracking for now — nothing here yet reflects ARD picking these up
// or returning results (that module doesn't exist yet); every row shows
// PENDING until that's wired up.
const STATUS_COLOR: Record<string, string> = {
  PENDING: 'gold', IN_PROGRESS: 'blue', COMPLETED: 'green',
}

export default function AdcAtrListPage() {
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])
  useEffect(() => { setPage(1) }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['my-atr', page, pageSize, search, sortBy, sortDir],
    queryFn: () => atrApi.listMine({
      page, limit: pageSize, search: search || undefined,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const atrs = data?.items ?? []
  const total = data?.total ?? 0

  const columns: ColumnsType<ExperimentAtr> = [
    {
      title: 'ATR No', dataIndex: 'atr_no', key: 'atr_no', width: 140,
      sorter: true,
      render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Section', dataIndex: 'section_title', key: 'section_title',
      sorter: true,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Experiment', key: 'experiment',
      render: (_, r) => r.experiment_code
        ? <span className="text-[13px] text-slate-800">{`${r.experiment_code} — ${r.experiment_title ?? ''}`}</span>
        : <EmptyValue />,
    },
    {
      title: 'Project', dataIndex: 'project_code', key: 'project_code', width: 140,
      render: (v: string) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120, align: 'center' as const,
      sorter: true,
      render: (v: ExperimentAtr['status']) => (
        <StatusTag color={STATUS_COLOR[v]} className="text-[13px]">{v}</StatusTag>
      ),
    },
    {
      title: 'Raised At', dataIndex: 'raised_at', key: 'raised_at', width: 160,
      sorter: true,
      render: (v: string) => (
        <span className="text-[13px] text-slate-800">{dayjs(v).format('DD MMM YYYY HH:mm')}</span>
      ),
    },
  ]

  return (
    <div className="p-1 sm:p-2 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical size={18} className="text-violet-500" />
        <h1 className="text-lg font-semibold text-slate-800">ATR — Analytical Test Requests</h1>
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        Requests you've raised for ARD analysis. Results and hand-back will appear here once ARD is wired up.
      </p>
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search ATR no. or section…"
          style={{ width: 260 }}
          allowClear
        />
      </div>
      <div className="glass-card rounded-xl overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={atrs}
          loading={isLoading}
          onRow={r => ({
            onClick: () => r.notebook_id && navigate(`/notebooks/${r.notebook_id}/experiments/${r.experiment_id}`),
            className: r.notebook_id ? 'cursor-pointer' : undefined,
          })}
          pagination={{ current: page, pageSize, total, showTotal: (t) => `${t} ATRs` }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<ExperimentAtr>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No ATRs raised yet.' }}
        />
      </div>
    </div>
  )
}
