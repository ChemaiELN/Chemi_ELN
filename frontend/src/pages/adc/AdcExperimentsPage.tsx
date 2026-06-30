import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input, Table, Tag, Select, Grid } from 'antd'

const { useBreakpoint } = Grid
import { Search, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import { experimentApi, type ExperimentListItem } from '../../api/adc'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green',
  REJECTED: 'red', LOCKED: 'purple', VOID: 'orange',
}

export default function AdcExperimentsPage() {
  const navigate = useNavigate()

  const screens = useBreakpoint()

  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState<string | undefined>(undefined)
  const [page, setPage]           = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['experiments-all', search, statusFilter, page],
    queryFn:  () => experimentApi.listAll({
      search: search || undefined,
      status: statusFilter || undefined,
      page,
      limit: 10,
    }),
  })

  const experiments = data?.items ?? []
  const total       = data?.total ?? 0

  const columns = [
    {
      title: 'Code',
      dataIndex: 'full_code',
      key: 'full_code',
      width: 160,
      render: (v: string) => (
        <span className="font-mono text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Experiment Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/experiments/${row.id}`)}
          className="text-[13px] font-medium text-indigo-600 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook',
      dataIndex: 'notebook_code',
      key: 'notebook_code',
      width: 160,
      render: (v: string, row: ExperimentListItem) => (
        <button
          onClick={() => navigate(`/notebooks/${row.notebook_id}/overview`)}
          className="text-[13px] font-mono text-teal-600 hover:underline"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project_code',
      width: 120,
      render: (v: string) => (
        <span className="text-[13px] font-mono text-slate-600">{v}</span>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 130,
      render: (v: string) => (
        <span className="text-[13px] text-slate-600">{v ?? '—'}</span>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => (
        <span className="text-[13px] text-slate-500">{dayjs(v).format('DD MMM YYYY')}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? 'default'} className="text-[13px]">
          {v}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 44,
      render: (_: unknown, row: ExperimentListItem) => (
        <button
          title="View experiment"
          onClick={() => navigate(`/notebooks/${row.notebook_id}/experiments/${row.id}`)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Experiments</h1>
            <p className="text-xs text-slate-400">{total} experiment{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <Select
          placeholder="All statuses"
          allowClear
          style={{ width: 150 }}
          value={statusFilter}
          onChange={v => { setStatus(v); setPage(1) }}
          options={[
            { value: 'DRAFT',     label: 'Draft' },
            { value: 'SUBMITTED', label: 'Submitted' },
            { value: 'APPROVED',  label: 'Approved' },
            { value: 'REJECTED',  label: 'Rejected' },
            { value: 'LOCKED',    label: 'Locked' },
          ]}
        />
        <Input
          prefix={<Search size={14} className="text-slate-400" />}
          placeholder="Search experiment code, title, notebook…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ width: 320 }}
          allowClear
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={experiments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: 10,
            total,
            onChange: p => setPage(p),
            showTotal: (t) => `${t} experiments`,
            showSizeChanger: false,
            size: 'small',
          }}
          locale={{ emptyText: 'No experiments found.' }}
        />
      </div>
    </div>
  )
}
