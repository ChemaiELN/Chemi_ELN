import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Grid, Input } from 'antd'

const { useBreakpoint } = Grid
import { Search } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtNotebookApi, type CgtNotebook } from '../../api/cgt'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'blue', ARCHIVED: 'default', COMPLETED: 'green',
}

export default function CgtNotebooksPage() {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-notebooks-all', search],
    queryFn:  () => cgtNotebookApi.listAll({ search: search || undefined, limit: 200 }),
  })

  const notebooks = data?.items ?? []
  const total = data?.total ?? 0

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      render: (v: string) => (
        <span className="  text-[13px] font-semibold text-slate-700">{v}</span>
      ),
    },
    {
      title: 'Notebook Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}/notebooks/${row.id}`)}
          className="text-[13px] font-medium text-indigo-600 hover:underline text-left"
        >
          {v}
        </button>
      ),
    },
    {
      title: 'Project',
      dataIndex: 'project_code',
      key: 'project_code',
      width: 140,
      render: (v: string, row: CgtNotebook) => (
        <button
          onClick={() => navigate(`/cgt/projects/${row.cgt_project_id}`)}
          className="text-[13px]   text-teal-600 hover:underline"
        >
          {v ?? '—'}
        </button>
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
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        {/* <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Notebooks</h1>
          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2.5 py-0.5 rounded-full">
            {total}
          </span>
        </div> */}
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search notebooks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={notebooks}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size={screens.md ? 'middle' : 'small'}
          scroll={{ x: 'max-content' }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (t) => `${t} notebooks`,
            size: 'small',
          }}
          locale={{ emptyText: 'No notebooks found.' }}
        />
      </div>
    </div>
  )
}
