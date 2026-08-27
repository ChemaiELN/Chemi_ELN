import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tabs, Table, Button, Input, Space, Modal, message } from 'antd'
import { FlaskConical, Search, ArrowRight, RotateCcw } from 'lucide-react'
import dayjs from 'dayjs'
import { ardExperimentApi, type PendingReviewItem, type OngoingExperimentItem } from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'
import { ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { ESignatureModal } from '../../components/common/ESignatureModal'

function AgeDot({ days, tagColor }: { days: number | null; tagColor: (d: number | null) => string }) {
  if (days === null) return <span className="text-slate-300 text-xs">—</span>
  return <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tagColor(days) }} title={`${days} day(s)`} />
}

// Aim is edited via RichEditor (Quill), so it's stored as HTML — a table
// cell needs the plain-text gist, not raw <p> tags.
function stripHtml(html: string | null): string {
  return (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Per-column text search — same pattern used on the ATR/Test list pages for consistency.
function getColumnSearchProps<T>(getValue: (row: T) => string | null | undefined, title: string) {
  return {
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div
        style={{ padding: 8, background: '#fafafa', borderRadius: 8, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0' }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Input
          placeholder={`Search ${title}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          autoComplete="off"
          style={{ width: 180, marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 88 }}>Search</Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm(); }} style={{ width: 88 }}>Reset</Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <Search size={12} color={filtered ? '#4f46e5' : '#94a3b8'} />,
    onFilter: (value: any, row: T) =>
      (getValue(row) ?? '').toString().toLowerCase().includes(String(value).toLowerCase()),
  }
}

// Select-style filter built from whatever distinct values are actually present.
function getColumnSelectFilterProps<T>(getValue: (row: T) => string | null | undefined, rows: T[]) {
  const values = Array.from(new Set(rows.map(getValue).filter((v): v is string => !!v))).sort()
  return {
    filters: values.map((v) => ({ text: v, value: v })),
    onFilter: (value: any, row: T) => getValue(row) === value,
  }
}

type ReviewSection = 'approval' | 'verification'
const SECTION_STATUS: Record<ReviewSection, 'SUBMITTED' | 'VERIFICATION_REQUESTED'> = {
  approval: 'SUBMITTED',
  verification: 'VERIFICATION_REQUESTED',
}

function ReviewTable({
  section, perspective, onEventsClick,
}: {
  section: ReviewSection
  perspective: 'mine' | 'others'
  onEventsClick: (rows: PendingReviewItem[]) => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()
  const { tagColor } = useHealthIndicator()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [takeOverEsignOpen, setTakeOverEsignOpen] = useState(false)
  const status = SECTION_STATUS[section]

  const { data, isLoading } = useQuery({
    queryKey: ['ard-pending-review', status, perspective],
    queryFn: () => ardExperimentApi.pendingReview(perspective, status),
  })
  const items = data?.items ?? []
  const selectedRows = items.filter((r) => selectedIds.includes(r.id))

  // Taking over a review moves ownership of a GxP decision to the current
  // user, so — like the HOD's Re-assign Test tool — it always requires
  // remarks and a re-authenticated e-signature, not just a click.
  const takeOverMut = useMutation({
    mutationFn: (payload: { remarks: string; password: string }) =>
      ardExperimentApi.bulkTakeOverReview({ experimentIds: selectedIds, remarks: payload.remarks, password: payload.password }),
    onSuccess: (res) => {
      msg.success(`Took over ${res.updatedCount} experiment${res.updatedCount !== 1 ? 's' : ''}.`)
      setSelectedIds([])
      setTakeOverEsignOpen(false)
      qc.invalidateQueries({ queryKey: ['ard-pending-review'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to take over.'),
  })

  const initiateApproval = () => {
    if (selectedIds.length === 0) return
    navigate(`/ard/experiments/${selectedIds[0]}`)
  }

  // Verification Requests → Approve is a direct status transition
  // (VERIFICATION_REQUESTED -> VERIFIED), unlike Approval's "Initiate
  // Approval" which just opens the experiment for a fuller review there.
  const approveMut = useMutation({
    mutationFn: async () => {
      let ok = 0
      let failed = 0
      for (const id of selectedIds) {
        try {
          await ardExperimentApi.transition(id, { to: 'VERIFIED' })
          ok++
        } catch {
          failed++
        }
      }
      return { ok, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) msg.success(`Approved ${ok} experiment${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.error(`${failed} experiment${failed !== 1 ? 's' : ''} could not be approved.`)
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-pending-review'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to approve.'),
  })

  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r) => r.productName, items) },
    { title: 'Project Code', dataIndex: 'projectCode', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r) => r.projectCode, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: PendingReviewItem) => r.code, 'Experiment Code'),
    },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: PendingReviewItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: PendingReviewItem) => stripHtml(r.aim), 'Experiment Aim') },
    { title: 'Request Count', dataIndex: 'requestCount', sorter: (a: PendingReviewItem, b: PendingReviewItem) => a.requestCount - b.requestCount },
    {
      title: 'Submitted By (On)',
      render: (_: unknown, r: PendingReviewItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.submittedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">{r.submittedAt ? dayjs(r.submittedAt).format('DD MMM YYYY (HH:mm)') : '—'}</p>
        </div>
      ),
      ...getColumnSelectFilterProps((r) => r.submittedBy, items),
    },
    // Only the "Submitted to me" view needs to say who it's currently routed to —
    // "Submitted to Others" is my own outgoing requests, where that's implicit.
    ...(perspective === 'mine' ? [{
      title: 'Submitted To', dataIndex: 'submittedTo', render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((r: PendingReviewItem) => r.submittedTo, items),
    }] : []),
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: PendingReviewItem, b: PendingReviewItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <div className="space-y-3">
      {ctx}
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{ emptyText: perspective === 'mine' ? 'No experiments awaiting your review.' : 'No experiments you submitted are pending review.' }}
      />
      <div className="flex gap-2">
        {perspective === 'mine' ? (
          section === 'approval' ? (
            <Button type="primary" disabled={selectedIds.length === 0} onClick={initiateApproval}
              icon={<ArrowRight size={14} />} className="bg-indigo-600 hover:bg-indigo-700 border-none">
              Initiate Approval
            </Button>
          ) : (
            <Button type="primary" disabled={selectedIds.length === 0} loading={approveMut.isPending} onClick={() => approveMut.mutate()}
              icon={<ArrowRight size={14} />} className="bg-emerald-600 hover:bg-emerald-700 border-none">
              Approve
            </Button>
          )
        ) : (
          <Button type="primary" disabled={selectedIds.length === 0} onClick={() => setTakeOverEsignOpen(true)}
            icon={<RotateCcw size={14} />} className="bg-amber-600 hover:bg-amber-700 border-none">
            Take Over
          </Button>
        )}
        <Button disabled={selectedIds.length === 0} onClick={() => onEventsClick(selectedRows)}>
          Events
        </Button>
      </div>

      <ESignatureModal
        open={takeOverEsignOpen}
        title="Take Over Review (E-Signature)"
        description="Provide remarks and re-authenticate with your password to take over this review."
        userName={user?.username || 'Current User'}
        requireReason
        reasonLabel="Remarks"
        loading={takeOverMut.isPending}
        onCancel={() => setTakeOverEsignOpen(false)}
        onConfirm={async (payload) => {
          await takeOverMut.mutateAsync({ remarks: payload.reason ?? '', password: payload.password })
        }}
      />
    </div>
  )
}

function OngoingTable() {
  const navigate = useNavigate()
  const { tagColor } = useHealthIndicator()

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-ongoing'],
    queryFn: () => ardExperimentApi.ongoing(),
  })
  const items = data?.items ?? []

  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.productName, items) },
    { title: 'Project Code', dataIndex: 'projectCode', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.projectCode, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: OngoingExperimentItem) => r.code, 'Experiment Code'),
    },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: OngoingExperimentItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: OngoingExperimentItem) => stripHtml(r.aim), 'Experiment Aim') },
    { title: 'Status', dataIndex: 'status', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.status, items) },
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: OngoingExperimentItem, b: OngoingExperimentItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <Table
      rowKey="id"
      loading={isLoading}
      dataSource={items}
      size="small"
      onRow={(row: OngoingExperimentItem) => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
      rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
      pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
      columns={columns as any}
      locale={{ emptyText: 'No ongoing experiments.' }}
    />
  )
}

export default function ArdAdExperimentsPage() {
  const [eventsRows, setEventsRows] = useState<PendingReviewItem[] | null>(null)

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      <div className="flex items-center gap-2">
        <FlaskConical size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">AD Experiments</h1>
      </div>

      <Card className="rounded-lg">
        <Tabs
          items={[
            {
              key: 'approval',
              label: 'Approval',
              children: (
                <Tabs
                  items={[
                    { key: 'mine', label: 'Submitted to me', children: <ReviewTable section="approval" perspective="mine" onEventsClick={setEventsRows} /> },
                    { key: 'others', label: 'Submitted to Others', children: <ReviewTable section="approval" perspective="others" onEventsClick={setEventsRows} /> },
                  ]}
                />
              ),
            },
            {
              key: 'verification',
              label: 'Verification',
              children: (
                <Tabs
                  items={[
                    { key: 'mine', label: 'Submitted to me', children: <ReviewTable section="verification" perspective="mine" onEventsClick={setEventsRows} /> },
                    { key: 'others', label: 'Submitted to Others', children: <ReviewTable section="verification" perspective="others" onEventsClick={setEventsRows} /> },
                  ]}
                />
              ),
            },
            {
              key: 'ongoing',
              label: 'Ongoing',
              children: <OngoingTable />,
            },
          ]}
        />
      </Card>

      <Modal {...glassModalProps} title="Events" open={!!eventsRows} onCancel={() => setEventsRows(null)} footer={null}>
        <div className="py-2 space-y-4 max-h-[60vh] overflow-y-auto">
          {(eventsRows ?? []).map((r) => (
            <div key={r.id}>
              <p className="text-sm font-semibold text-slate-800 mb-2">{r.code}</p>
              {r.history.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No events recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {r.history.map((ev, i) => (
                    <div key={i} className="text-xs border-l-2 border-indigo-200 pl-2">
                      <div>
                        <span className="font-medium text-slate-700">
                          {ev.action === 'REVIEWER_TAKEOVER'
                            ? `Review taken over${ev.from ? ` from ${ev.from}` : ''}`
                            : `${ev.from ?? '—'} → ${ev.to ?? ev.action ?? '—'}`}
                        </span>
                        <span className="text-slate-500"> by {ev.byName ?? ev.by ?? '—'}</span>
                        {ev.at && <span className="text-slate-400"> · {dayjs(ev.at).format('DD MMM YYYY (HH:mm)')}</span>}
                      </div>
                      {ev.remarks && <p className="text-[11px] text-slate-500 italic mt-0.5">"{ev.remarks}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
