import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Grid, Input } from 'antd'

const { useBreakpoint } = Grid
import { Search, Eye } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtExperimentApi, type CgtExperimentListItem } from '../../api/cgt'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green', REJECTED: 'red',
}

export default function CgtExperimentsPage() {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-experiments-all', search],
    queryFn:  () => cgtExperimentApi.listAll({ search: search || undefined, limit: 200 }),
  })

  const experiments = data?.items ?? []
  const total = data?.total ?? 0

  const goToExperiment = (row: CgtExperimentListItem) =>
    navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.cgt_notebook_id}/experiments/${row.id}`)

  const columns = [
    {
      title: 'Code',
      dataIndex: 'full_code',
      key: 'full_code',
      width: 160,
      render: (v: string) => (
        <span className=" text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Experiment Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, row: CgtExperimentListItem) => (
        <button onClick={() => goToExperiment(row)} className="text-[13px] font-medium text-indigo-600 hover:underline text-left">
          {v}
        </button>
      ),
    },
    {
      title: 'Notebook',
      dataIndex: 'notebook_code',
      key: 'notebook_code',
      width: 160,
      render: (v: string, row: CgtExperimentListItem) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.cgt_notebook_id}`)}
          className="text-[13px]  text-teal-600 hover:underline"
        >
          {v ?? '—'}
        </button>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project_code',
      width: 120,
      render: (v: string) => (
        <span className="text-[13px] text-slate-600">{v ?? '—'}</span>
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
        <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 44,
      render: (_: unknown, row: CgtExperimentListItem) => (
        <button
          title="View experiment"
          onClick={() => goToExperiment(row)}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <Eye size={14} />
        </button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Experiments</h1>
          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2.5 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search experiments…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={experiments}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (t) => `${t} experiments`,
            size: 'small',
          }}
          locale={{ emptyText: 'No experiments found.' }}
        />
      </div>
    </div>
  )
}
