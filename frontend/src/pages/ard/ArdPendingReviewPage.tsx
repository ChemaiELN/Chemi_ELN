import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Table, Tag, Tabs } from 'antd'
import { ardExperimentApi, type PendingReviewItem } from '../../api/ard'
import dayjs from 'dayjs'

const EXP_STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: 'blue', SUBMITTED: 'purple', APPROVED: 'green', REWORK: 'red',
  VERIFICATION_REQUESTED: 'gold', VERIFIED: 'cyan', UNLOCKED: 'geekblue', DEACTIVATED: 'default',
}
const EXP_STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Ongoing', SUBMITTED: 'Submitted', APPROVED: 'Approved', REWORK: 'Rework',
  VERIFICATION_REQUESTED: 'Verification Requested', VERIFIED: 'Verified',
  UNLOCK_REQUESTED: 'Unlock Requested', UNLOCKED: 'Unlocked', DEACTIVATED: 'Deactivated',
}


function ReviewTable({ perspective }: { perspective: 'mine' | 'others' }) {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['ard-pending-review', perspective],
    queryFn: () => ardExperimentApi.pendingReview(perspective),
  })

  const columns = [
    {
      title: 'Experiment Code',
      dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-slate-700">{v}</span>,
    },
    {
      title: 'Template',
      dataIndex: 'templateName',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={EXP_STATUS_COLOR[v] ?? 'default'} className="text-xs">
          {EXP_STATUS_LABEL[v] ?? v}
        </Tag>
      ),
    },
    {
      title: perspective === 'mine' ? 'Submitted By' : 'Submitted By You',
      dataIndex: 'submittedBy',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Submitted On',
      dataIndex: 'submittedAt',
      render: (v: string | null) => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—',
    },
    {
      title: 'Age (days)',
      dataIndex: 'ageDays',
      render: (v: number | null) => (
        <span className="text-xs font-mono text-slate-600">{v !== null ? v : '—'}</span>
      ),
    },
  ]

  return (
    <div className="glass-card rounded-lg overflow-hidden">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items ?? []}
        columns={columns}
        size="small"
        onRow={(row: PendingReviewItem) => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
        rowClassName={() => 'cursor-pointer'}
        pagination={false}
        locale={{ emptyText: perspective === 'mine' ? 'No experiments awaiting your review.' : 'No experiments you submitted are pending review.' }}
      />
    </div>
  )
}

export default function ArdPendingReviewPage() {
  const [activeTab, setActiveTab] = useState<'mine' | 'others'>('mine')

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-4">Pending Review</h1>
      <Tabs
        activeKey={activeTab}
        onChange={k => setActiveTab(k as 'mine' | 'others')}
        items={[
          {
            key: 'mine',
            label: 'Submitted To Me',
            children: <ReviewTable perspective="mine" />,
          },
          {
            key: 'others',
            label: 'Submitted To Others',
            children: <ReviewTable perspective="others" />,
          },
        ]}
      />
    </div>
  )
}
