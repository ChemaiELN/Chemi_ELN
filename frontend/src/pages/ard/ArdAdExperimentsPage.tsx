import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tabs, Table, Button, Input, Space, Modal, message, Checkbox, Select } from 'antd'
import { FlaskConical, Search, ArrowRight, RotateCcw, ClipboardList, Lock, UserCog } from 'lucide-react'
import dayjs from 'dayjs'
import {
  ardExperimentApi,
  ardTemplateApi,
  type PendingReviewItem,
  type OngoingExperimentItem,
  type ReviewCommentItem,
  type UnlockedExperimentItem,
  type VersionsResponse,
  type ArdTemplateDoc,
  type ReviewRequestItem,
  type UnlockRequestItem,
  type ReassignReviewerItem,
} from '../../api/ard'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { useHealthIndicator } from '../../hooks/useHealthIndicator'
import { userApi } from '../../api/adc'
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
  section, perspective, onEventsClick, onHistoryClick,
}: {
  section: ReviewSection
  perspective: 'mine' | 'others'
  onEventsClick: (rows: PendingReviewItem[]) => void
  onHistoryClick: (id: string) => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const isTl = ['TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
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
    { title: 'Test Number(s)', dataIndex: 'testNumbers', render: (v: string | null) => v || '—' },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: PendingReviewItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: PendingReviewItem) => stripHtml(r.aim), 'Experiment Aim') },
    { title: 'Request Count', dataIndex: 'requestCount', sorter: (a: PendingReviewItem, b: PendingReviewItem) => a.requestCount - b.requestCount },
    {
      title: 'Submitted By / On',
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
          ) : isTl ? (
            // TL's own Verification tab just opens the experiment (the
            // verify decision is made in there) — HOD keeps the original
            // one-click Approve straight from this list.
            <Button type="primary" disabled={selectedIds.length === 0} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
              icon={<ArrowRight size={14} />} className="bg-emerald-600 hover:bg-emerald-700 border-none">
              Initiate Verification
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
        {isTl && perspective === 'mine' && (
          <Button disabled={selectedIds.length !== 1} onClick={() => onHistoryClick(selectedIds[0])}>
            History
          </Button>
        )}
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

// "Pending for Review/Verification" (TL screen only) — a single combined
// queue over both SUBMITTED and VERIFICATION_REQUESTED experiments (the
// pending-review endpoint's original, non-status-narrowed behavior), unlike
// the Approval/Verification tabs above which split them into two separate
// screens. "Submitted to me": Initiate Approval (enabled for SUBMITTED
// rows), Initiate Verification (enabled for VERIFICATION_REQUESTED rows),
// Events (workflow history) and History (version snapshots) — all
// single-row. "Submitted to Others": Take Over + Events, same as the
// Approval/Verification tabs' own "others" view.
function PendingReviewVerificationTable({
  perspective, onEventsClick, onHistoryClick,
}: {
  perspective: 'mine' | 'others'
  onEventsClick: (rows: PendingReviewItem[]) => void
  onHistoryClick: (id: string) => void
}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAppSelector(selectUser)
  const [msg, ctx] = message.useMessage()
  const { tagColor } = useHealthIndicator()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [takeOverEsignOpen, setTakeOverEsignOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['ard-pending-review-combined', perspective],
    queryFn: () => ardExperimentApi.pendingReview(perspective),
  })
  const items = data?.items ?? []
  const selectedRows = items.filter((r) => selectedIds.includes(r.id))
  const selectedRow = selectedIds.length === 1 ? items.find((r) => r.id === selectedIds[0]) : undefined

  const takeOverMut = useMutation({
    mutationFn: (payload: { remarks: string; password: string }) =>
      ardExperimentApi.bulkTakeOverReview({ experimentIds: selectedIds, remarks: payload.remarks, password: payload.password }),
    onSuccess: (res) => {
      msg.success(`Took over ${res.updatedCount} experiment${res.updatedCount !== 1 ? 's' : ''}.`)
      setSelectedIds([])
      setTakeOverEsignOpen(false)
      qc.invalidateQueries({ queryKey: ['ard-pending-review-combined'] })
    },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to take over.'),
  })

  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: PendingReviewItem) => r.productName, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: PendingReviewItem) => r.code, 'Experiment Code'),
    },
    { title: 'Test Number(s)', dataIndex: 'testNumbers', render: (v: string | null) => v || '—' },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: PendingReviewItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: PendingReviewItem) => stripHtml(r.aim), 'Experiment Aim') },
    { title: 'Req Count', dataIndex: 'requestCount', sorter: (a: PendingReviewItem, b: PendingReviewItem) => a.requestCount - b.requestCount },
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
    ...(perspective === 'others' ? [{
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
        pagination={{ pageSize: 15, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{ emptyText: perspective === 'mine' ? 'No experiments awaiting your review.' : 'No experiments you submitted are pending review.' }}
      />
      <div className="flex gap-2">
        {perspective === 'mine' ? (
          <>
            <Button type="primary" disabled={selectedRows.length === 0 || !selectedRows.every((r) => r.status === 'SUBMITTED')}
              onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
              icon={<ArrowRight size={14} />} className="bg-indigo-600 hover:bg-indigo-700 border-none">
              Initiate Approval
            </Button>
            <Button type="primary" disabled={selectedRows.length === 0 || !selectedRows.every((r) => r.status === 'VERIFICATION_REQUESTED')}
              onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
              icon={<ArrowRight size={14} />} className="bg-emerald-600 hover:bg-emerald-700 border-none">
              Initiate Verification
            </Button>
          </>
        ) : (
          <Button type="primary" disabled={selectedIds.length === 0} onClick={() => setTakeOverEsignOpen(true)}
            icon={<RotateCcw size={14} />} className="bg-amber-600 hover:bg-amber-700 border-none">
            Take Over
          </Button>
        )}
        <Button disabled={selectedIds.length === 0} onClick={() => onEventsClick(selectedRows)}>
          Events
        </Button>
        {perspective === 'mine' && (
          <Button disabled={!selectedRow} onClick={() => selectedRow && onHistoryClick(selectedRow.id)}>
            History
          </Button>
        )}
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
  const user = useAppSelector(selectUser)
  const isTl = ['TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-ongoing'],
    queryFn: () => ardExperimentApi.ongoing(),
  })
  const items = data?.items ?? []

  // TL's "On-Going Experiments" screen adds Notebook Type/ATR Form No.(s)/
  // Test Number(s)/Batch No/Started By(On), and swaps row-click navigation
  // for explicit View/Edit buttons (legacy screen); other roles keep the
  // plain row-click table.
  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.productName, items) },
    { title: 'Project Code', dataIndex: 'projectCode', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.projectCode, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: OngoingExperimentItem) => r.code, 'Experiment Code'),
    },
    ...(isTl ? [
      { title: 'Notebook Type', dataIndex: 'notebookType', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.notebookType, items) },
    ] : []),
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: OngoingExperimentItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: OngoingExperimentItem) => stripHtml(r.aim), 'Experiment Aim') },
    ...(isTl ? [
      { title: 'ATR Form No.(s)', dataIndex: 'atrFormNos', render: (v: string | null) => v || '—' },
      { title: 'Test Number(s)', dataIndex: 'testNumbers', render: (v: string | null) => v || '—' },
      { title: 'Batch No', dataIndex: 'batchNo', render: (v: string | null) => v || '—' },
      { title: 'Started By(On)', dataIndex: 'startedByName', render: (v: string | null, r: OngoingExperimentItem) => v ? (
        <div className="leading-tight">
          <div>{v}</div>
          <div className="text-[11px] text-slate-400">{r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY (HH:mm)') : ''}</div>
        </div>
      ) : '—' },
    ] : [
      { title: 'Status', dataIndex: 'status', ...getColumnSelectFilterProps((r: OngoingExperimentItem) => r.status, items) },
    ]),
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: OngoingExperimentItem, b: OngoingExperimentItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  if (!isTl) {
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

  return (
    <div className="space-y-3">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{ emptyText: 'No ongoing experiments.' }}
      />
      <div className="flex gap-2">
        <Button disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}?view=1`)}>
          View
        </Button>
        <Button type="primary" disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
          className="bg-indigo-600 hover:bg-indigo-700 border-none">
          Edit
        </Button>
      </div>
    </div>
  )
}

function ReviewCommentsTable({ onCommentsClick }: { onCommentsClick: (thread: ReviewCommentItem['clarifications']) => void }) {
  const navigate = useNavigate()
  const { tagColor } = useHealthIndicator()
  const user = useAppSelector(selectUser)
  const isTl = ['TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const [includeAllUsers, setIncludeAllUsers] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-review-comments', includeAllUsers],
    queryFn: () => ardExperimentApi.reviewComments(includeAllUsers ? 'all' : 'mine'),
  })
  const items = data?.items ?? []

  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: ReviewCommentItem) => r.productName, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: ReviewCommentItem) => r.code, 'Experiment Code'),
    },
    {
      title: 'Test Number(s)', dataIndex: 'testNumbers',
      render: (v: string | null) => v || '—',
    },
    { title: 'Notebook Type', dataIndex: 'notebookType', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: ReviewCommentItem) => r.notebookType, items) },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: ReviewCommentItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: ReviewCommentItem) => stripHtml(r.aim), 'Experiment Aim') },
    {
      title: 'Improvement Suggested', width: 90, align: 'center' as const,
      render: (_: unknown, r: ReviewCommentItem) => (
        <Button
          type="text" shape="circle" icon={<ClipboardList size={16} className="text-indigo-600" />}
          onClick={(e) => { e.stopPropagation(); onCommentsClick(r.clarifications) }}
        />
      ),
    },
    {
      title: 'Started By / On',
      render: (_: unknown, r: ReviewCommentItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.createdByName || '—'}</p>
          <p className="text-[11px] text-slate-400">{r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY (HH:mm)') : '—'}</p>
        </div>
      ),
      ...getColumnSelectFilterProps((r: ReviewCommentItem) => r.createdByName, items),
    },
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: ReviewCommentItem, b: ReviewCommentItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Checkbox checked={includeAllUsers} onChange={(e) => setIncludeAllUsers(e.target.checked)}>
          Include All Users
        </Checkbox>
      </div>
      {isTl ? (
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          size="small"
          rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
          columns={columns as any}
          locale={{ emptyText: 'No experiments with review comments.' }}
        />
      ) : (
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          size="small"
          onRow={(row: ReviewCommentItem) => ({ onClick: () => navigate(`/ard/experiments/${row.id}`) })}
          rowClassName={() => 'cursor-pointer hover:bg-indigo-50/40 transition-colors'}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
          columns={columns as any}
          locale={{ emptyText: 'No experiments with review comments.' }}
        />
      )}
      {isTl && (
        <div className="flex gap-2">
          <Button disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}?view=1`)}>
            View
          </Button>
          <Button type="primary" disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
            className="bg-indigo-600 hover:bg-indigo-700 border-none">
            Edit
          </Button>
        </div>
      )}
    </div>
  )
}

// "Unlocked Experiments" — TL-only tab: experiments an approver reopened
// for correction (status UNLOCKED). Checkbox row-selection + Edit/View,
// same pattern as the TL view of Ongoing.
function UnlockedTable() {
  const navigate = useNavigate()
  const { tagColor } = useHealthIndicator()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-unlocked'],
    queryFn: () => ardExperimentApi.unlocked(),
  })
  const items = data?.items ?? []

  const columns = [
    { title: 'Product', dataIndex: 'productName', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: UnlockedExperimentItem) => r.productName, items) },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: UnlockedExperimentItem) => r.code, 'Experiment Code'),
    },
    { title: 'Test Number(s)', dataIndex: 'testNumbers', render: (v: string | null) => v || '—' },
    { title: 'Notebook Type', dataIndex: 'notebookType', render: (v: string | null) => v || '—', ...getColumnSelectFilterProps((r: UnlockedExperimentItem) => r.notebookType, items) },
    { title: 'Template Name', dataIndex: 'templateName', render: (v: string | null) => v || '—', ...getColumnSearchProps((r: UnlockedExperimentItem) => r.templateName, 'Template Name') },
    { title: 'Experiment Aim', dataIndex: 'aim', render: (v: string | null) => stripHtml(v) || '—', ...getColumnSearchProps((r: UnlockedExperimentItem) => stripHtml(r.aim), 'Experiment Aim') },
    { title: 'Status', dataIndex: 'status', ...getColumnSelectFilterProps((r: UnlockedExperimentItem) => r.status, items) },
    {
      title: 'Started By (On)',
      render: (_: unknown, r: UnlockedExperimentItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.startedByName || '—'}</p>
          <p className="text-[11px] text-slate-400">{r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY (HH:mm)') : '—'}</p>
        </div>
      ),
      ...getColumnSelectFilterProps((r: UnlockedExperimentItem) => r.startedByName, items),
    },
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: UnlockedExperimentItem, b: UnlockedExperimentItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <div className="space-y-3">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{ emptyText: 'No unlocked experiments.' }}
      />
      <div className="flex gap-2">
        <Button type="primary" disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}`)}
          className="bg-indigo-600 hover:bg-indigo-700 border-none">
          Edit
        </Button>
        <Button disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/experiments/${selectedIds[0]}?view=1`)}>
          View
        </Button>
      </div>
    </div>
  )
}

// "Template Pending Approval" (TL screen only) — templates awaiting
// approval (status PENDING_APPROVAL), single action: Initiate Approval
// (opens the template builder, where the full approve/rework decision is
// made — same "open it, don't decide here" pattern as Initiate Approval on
// the experiments queue above).
function TemplatePendingApprovalTable() {
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['ard-templates-pending-approval'],
    queryFn: () => ardTemplateApi.list({ status: 'PENDING_APPROVAL', pageSize: 200 }),
  })
  const items = data?.items ?? []

  const columns = [
    {
      title: 'Template Name', dataIndex: 'name',
      render: (v: string) => <span className="font-medium text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: ArdTemplateDoc) => r.name, 'Template Name'),
    },
    { title: 'Template Description', dataIndex: 'description', render: (v: string | null) => v || '—' },
    { title: 'Status', dataIndex: 'status', render: (v: string) => v.replace(/_/g, ' ') },
    { title: 'Version', dataIndex: 'version' },
    {
      title: 'Created By(On)',
      render: (_: unknown, r: ArdTemplateDoc) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.createdBy || '—'}</p>
          <p className="text-[11px] text-slate-400">{r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY (HH:mm)') : '—'}</p>
        </div>
      ),
    },
    {
      title: 'Last Updated By (On)',
      render: (_: unknown, r: ArdTemplateDoc) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.lastUpdatedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">{r.updatedAt ? dayjs(r.updatedAt).format('DD MMM YYYY (HH:mm)') : '—'}</p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} templates` }}
        columns={columns as any}
        locale={{ emptyText: 'No templates pending approval.' }}
      />
      <div className="flex gap-2">
        <Button type="primary" disabled={selectedIds.length !== 1} onClick={() => navigate(`/ard/templates/${selectedIds[0]}`)}
          icon={<ArrowRight size={14} />} className="bg-indigo-600 hover:bg-indigo-700 border-none">
          Initiate Approval
        </Button>
      </div>
    </div>
  )
}

function ReviewRequestsTable() {
  const { tagColor } = useHealthIndicator()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [perspective, setPerspective] = useState<'mine' | 'others'>('mine')
  const [msg, ctx] = message.useMessage()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-review-requests', perspective],
    queryFn: () => ardExperimentApi.reviewRequests(perspective),
  })
  const items = data?.items ?? []

  const initiateApprovalMut = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => ardExperimentApi.transition(id, { to: 'SUBMITTED' })),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { ok: results.length - failed, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) msg.success(`Approval initiated for ${ok} experiment${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.warning(`${failed} experiment${failed !== 1 ? 's' : ''} could not be updated.`)
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-experiments-review-requests'] })
    },
    onError: () => msg.error('Failed to initiate approval.'),
  })

  const initiateVerificationMut = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => ardExperimentApi.transition(id, { to: 'VERIFICATION_REQUESTED' })),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { ok: results.length - failed, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) msg.success(`Verification initiated for ${ok} experiment${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.warning(`${failed} experiment${failed !== 1 ? 's' : ''} could not be updated.`)
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-experiments-review-requests'] })
    },
    onError: () => msg.error('Failed to initiate verification.'),
  })

  const columns = [
    {
      title: 'Product', dataIndex: 'productName',
      render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((r: ReviewRequestItem) => r.productName, items),
    },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: ReviewRequestItem) => r.code, 'Experiment Code'),
    },
    {
      title: 'Template Name', dataIndex: 'templateName',
      render: (v: string | null) => v || '—',
      ...getColumnSearchProps((r: ReviewRequestItem) => r.templateName, 'Template Name'),
    },
    {
      title: 'Status', dataIndex: 'status',
      render: (v: string) => <span className="text-xs font-semibold text-slate-600">{v}</span>,
      ...getColumnSelectFilterProps((r: ReviewRequestItem) => r.status, items),
    },
    {
      title: 'Experiment Aim', dataIndex: 'aim',
      render: (v: string | null) => stripHtml(v) || '—',
      ...getColumnSearchProps((r: ReviewRequestItem) => stripHtml(r.aim), 'Experiment Aim'),
    },
    {
      title: 'Req Count', dataIndex: 'requestCount',
      sorter: (a: ReviewRequestItem, b: ReviewRequestItem) => a.requestCount - b.requestCount,
    },
    {
      title: 'Submitted By / On',
      render: (_: unknown, r: ReviewRequestItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.submittedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">
            {r.submittedAt ? dayjs(r.submittedAt).format('DD MMM YYYY (HH:mm)') : '—'}
          </p>
        </div>
      ),
      ...getColumnSelectFilterProps((r: ReviewRequestItem) => r.submittedBy, items),
    },
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: ReviewRequestItem, b: ReviewRequestItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <div className="space-y-3">
      {ctx}
      <Tabs
        size="small"
        activeKey={perspective}
        onChange={(k) => { setPerspective(k as 'mine' | 'others'); setSelectedIds([]) }}
        items={[
          { key: 'mine', label: 'Submitted to me' },
          { key: 'others', label: 'Submitted to Others' },
        ]}
      />
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{ emptyText: 'No review requests.' }}
      />
      <div className="flex gap-2">
        <Button
          type="primary"
          disabled={selectedIds.length === 0}
          loading={initiateApprovalMut.isPending}
          onClick={() => initiateApprovalMut.mutate()}
          icon={<ArrowRight size={14} />}
          className="bg-indigo-600 hover:bg-indigo-700 border-none"
        >
          Initiate Approval
        </Button>
        <Button
          disabled={selectedIds.length === 0}
          loading={initiateVerificationMut.isPending}
          onClick={() => initiateVerificationMut.mutate()}
          icon={<ArrowRight size={14} />}
        >
          Initiate Verification
        </Button>
      </div>
    </div>
  )
}

function UnlockExperimentTable() {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnRemarks, setReturnRemarks] = useState('')
  const [msg, ctx] = message.useMessage()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-unlock-requests'],
    queryFn: () => ardExperimentApi.unlockRequests(),
  })
  const items = data?.items ?? []

  const processMut = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => ardExperimentApi.processUnlock(id)),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { ok: results.length - failed, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) msg.success(`Unlock processed for ${ok} request${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.warning(`${failed} request${failed !== 1 ? 's' : ''} could not be processed.`)
      setSelectedIds([])
      qc.invalidateQueries({ queryKey: ['ard-experiments-unlock-requests'] })
    },
    onError: () => msg.error('Failed to process unlock.'),
  })

  const returnMut = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        selectedIds.map((id) => ardExperimentApi.returnUnlock(id, { remarks: returnRemarks })),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { ok: results.length - failed, failed }
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) msg.success(`Unlock returned for ${ok} request${ok !== 1 ? 's' : ''}.`)
      if (failed) msg.warning(`${failed} request${failed !== 1 ? 's' : ''} could not be returned.`)
      setSelectedIds([])
      setReturnRemarks('')
      setReturnModalOpen(false)
      qc.invalidateQueries({ queryKey: ['ard-experiments-unlock-requests'] })
    },
    onError: () => msg.error('Failed to return unlock.'),
  })

  const columns = [
    {
      title: 'Product Name', dataIndex: 'productName',
      render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((r: UnlockRequestItem) => r.productName, items),
    },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: UnlockRequestItem) => r.code, 'Experiment Code'),
    },
    {
      title: 'Approved By / On',
      render: (_: unknown, r: UnlockRequestItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.approvedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">
            {r.approvedAt ? dayjs(r.approvedAt).format('DD MMM YYYY (HH:mm)') : '—'}
          </p>
        </div>
      ),
      ...getColumnSelectFilterProps((r: UnlockRequestItem) => r.approvedBy, items),
      sorter: (a: UnlockRequestItem, b: UnlockRequestItem) =>
        (a.approvedAt ?? '').localeCompare(b.approvedAt ?? ''),
    },
    {
      title: 'Requested By / On',
      render: (_: unknown, r: UnlockRequestItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.requestedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">
            {r.requestedAt ? dayjs(r.requestedAt).format('DD MMM YYYY (HH:mm)') : '—'}
          </p>
        </div>
      ),
    },
    {
      title: 'Reason for Unlock', dataIndex: 'unlockReason',
      render: (v: string | null) => v || '—',
      ...getColumnSearchProps((r: UnlockRequestItem) => r.unlockReason, 'Reason'),
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
        pagination={{ pageSize: 10, showTotal: (t) => `${t} requests` }}
        columns={columns as any}
        locale={{ emptyText: 'No unlock requests.' }}
      />
      <div className="flex gap-2">
        <Button
          type="primary"
          disabled={selectedIds.length === 0}
          loading={processMut.isPending}
          onClick={() => processMut.mutate()}
          icon={<Lock size={14} />}
          className="bg-indigo-600 hover:bg-indigo-700 border-none"
        >
          Process
        </Button>
        <Button
          disabled={selectedIds.length === 0}
          loading={returnMut.isPending}
          onClick={() => setReturnModalOpen(true)}
          icon={<RotateCcw size={14} />}
        >
          Return
        </Button>
      </div>

      <Modal
        {...glassModalProps}
        title="Return Unlock Request"
        open={returnModalOpen}
        onCancel={() => { setReturnModalOpen(false); setReturnRemarks('') }}
        onOk={() => returnMut.mutate()}
        okText="Confirm Return"
        okButtonProps={{ loading: returnMut.isPending, disabled: !returnRemarks.trim() }}
      >
        <div className="space-y-2 py-2">
          <p className="text-xs text-slate-600">Provide a reason for returning this unlock request.</p>
          <Input.TextArea
            rows={3}
            placeholder="Remarks (required)"
            value={returnRemarks}
            onChange={(e) => setReturnRemarks(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

const REVIEWER_ROLE_CODES = ['TL', 'TEAM_LEAD', 'HOD', 'ADMIN', 'SUPER_ADMIN']

function useReviewerOptions() {
  const { data } = useQuery({
    queryKey: ['ard-reviewer-options'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  return (data?.items ?? [])
    .filter((u) => REVIEWER_ROLE_CODES.includes(u.role_code ?? ''))
    .map((u) => ({ label: `${u.username} (${u.role_code ?? ''})`, value: u.id }))
}

function ReassignReviewerTable() {
  const user = useAppSelector(selectUser)
  const { tagColor } = useHealthIndicator()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [currentReviewerId, setCurrentReviewerId] = useState<string | undefined>(undefined)
  const [newReviewerId, setNewReviewerId] = useState<string | undefined>(undefined)
  const [esignOpen, setEsignOpen] = useState(false)
  const [msg, ctx] = message.useMessage()
  const qc = useQueryClient()
  const reviewerOptions = useReviewerOptions()

  const { data, isLoading } = useQuery({
    queryKey: ['ard-experiments-pending-reassign', currentReviewerId],
    queryFn: () => ardExperimentApi.pendingReassign(currentReviewerId!),
    enabled: !!currentReviewerId,
  })
  const items = data?.items ?? []

  const reassignMut = useMutation({
    mutationFn: (payload: { password: string }) =>
      ardExperimentApi.bulkReassignReviewer({
        experimentIds: selectedIds,
        newReviewerId: newReviewerId!,
        password: payload.password,
      }),
    onSuccess: (res) => {
      msg.success(`Reassigned ${res.updatedCount} experiment${res.updatedCount !== 1 ? 's' : ''}.`)
      setSelectedIds([])
      setNewReviewerId(undefined)
      setEsignOpen(false)
      qc.invalidateQueries({ queryKey: ['ard-experiments-pending-reassign'] })
    },
    onError: () => msg.error('Failed to reassign.'),
  })

  const columns = [
    {
      title: 'Product', dataIndex: 'productName',
      render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((r: ReassignReviewerItem) => r.productName, items),
    },
    {
      title: 'Experiment Code', dataIndex: 'code',
      render: (v: string) => <span className="font-mono text-xs font-semibold text-indigo-900">{v}</span>,
      ...getColumnSearchProps((r: ReassignReviewerItem) => r.code, 'Experiment Code'),
    },
    {
      title: 'Template Name', dataIndex: 'templateName',
      render: (v: string | null) => v || '—',
      ...getColumnSearchProps((r: ReassignReviewerItem) => r.templateName, 'Template Name'),
    },
    {
      title: 'Experiment Aim', dataIndex: 'aim',
      render: (v: string | null) => stripHtml(v) || '—',
      ...getColumnSearchProps((r: ReassignReviewerItem) => stripHtml(r.aim), 'Experiment Aim'),
    },
    {
      title: 'Stage', dataIndex: 'stage',
      render: (v: string | null) => v || '—',
      ...getColumnSelectFilterProps((r: ReassignReviewerItem) => r.stage, items),
    },
    {
      title: 'Submitted By / On',
      render: (_: unknown, r: ReassignReviewerItem) => (
        <div className="text-xs">
          <p className="font-medium text-slate-700">{r.submittedBy || '—'}</p>
          <p className="text-[11px] text-slate-400">
            {r.submittedAt ? dayjs(r.submittedAt).format('DD MMM YYYY (HH:mm)') : '—'}
          </p>
        </div>
      ),
      ...getColumnSelectFilterProps((r: ReassignReviewerItem) => r.submittedBy, items),
    },
    {
      title: 'Age', dataIndex: 'ageDays',
      sorter: (a: ReassignReviewerItem, b: ReassignReviewerItem) => (a.ageDays ?? 0) - (b.ageDays ?? 0),
      render: (v: number | null) => <AgeDot days={v} tagColor={tagColor} />,
    },
  ]

  return (
    <div className="space-y-3">
      {ctx}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-slate-600">Current Reviewer / Approver</span>
        <Select
          showSearch
          allowClear
          style={{ minWidth: 220 }}
          placeholder="Select reviewer…"
          options={reviewerOptions}
          value={currentReviewerId}
          onChange={(v) => { setCurrentReviewerId(v); setSelectedIds([]) }}
          filterOption={(input, opt) =>
            (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </div>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={items}
        size="small"
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
          getCheckboxProps: () => ({ disabled: !currentReviewerId }),
        }}
        pagination={{ pageSize: 10, showTotal: (t) => `${t} experiments` }}
        columns={columns as any}
        locale={{
          emptyText: currentReviewerId
            ? 'No experiments assigned to this reviewer.'
            : 'Select a reviewer above to load experiments.',
        }}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-slate-600">Re-assign To</span>
        <Select
          showSearch
          allowClear
          style={{ minWidth: 220 }}
          placeholder="Select new reviewer…"
          options={reviewerOptions.filter((o) => o.value !== currentReviewerId)}
          value={newReviewerId}
          onChange={setNewReviewerId}
          filterOption={(input, opt) =>
            (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
        <Button
          type="primary"
          disabled={selectedIds.length === 0 || !newReviewerId}
          loading={reassignMut.isPending}
          onClick={() => setEsignOpen(true)}
          icon={<UserCog size={14} />}
          className="bg-indigo-600 hover:bg-indigo-700 border-none"
        >
          Re-assign
        </Button>
      </div>

      <ESignatureModal
        open={esignOpen}
        title="Re-assign Reviewer (E-Signature)"
        description="Re-authenticate to confirm bulk reassignment of experiment reviewers."
        userName={user?.username || 'Current User'}
        loading={reassignMut.isPending}
        onCancel={() => setEsignOpen(false)}
        onConfirm={async (payload) => {
          await reassignMut.mutateAsync({ password: payload.password })
        }}
      />
    </div>
  )
}

export default function ArdAdExperimentsPage() {
  const [eventsRows, setEventsRows] = useState<PendingReviewItem[] | null>(null)
  const [commentsThread, setCommentsThread] = useState<ReviewCommentItem['clarifications'] | null>(null)
  const [historyExpId, setHistoryExpId] = useState<string | null>(null)
  const user = useAppSelector(selectUser)
  const isTl = ['TL', 'TEAM_LEAD'].includes(user?.role_code ?? '')
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['ard-experiment-versions', historyExpId],
    queryFn: () => ardExperimentApi.versions(historyExpId!),
    enabled: !!historyExpId,
  })

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
                    { key: 'mine', label: 'Submitted to me', children: <ReviewTable section="approval" perspective="mine" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
                    { key: 'others', label: 'Submitted to Others', children: <ReviewTable section="approval" perspective="others" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
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
                    { key: 'mine', label: 'Submitted to me', children: <ReviewTable section="verification" perspective="mine" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
                    { key: 'others', label: 'Submitted to Others', children: <ReviewTable section="verification" perspective="others" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
                  ]}
                />
              ),
            },
            {
              key: 'ongoing',
              label: 'Ongoing',
              children: <OngoingTable />,
            },
            {
              key: 'review_comments',
              label: 'Review Comments',
              children: <ReviewCommentsTable onCommentsClick={setCommentsThread} />,
            },
            ...(isTl ? [{
              key: 'unlocked',
              label: 'Unlocked Experiments',
              children: <UnlockedTable />,
            },
            {
              key: 'pending_review_verification',
              label: 'Pending for Review/Verification',
              children: (
                <Tabs
                  items={[
                    { key: 'mine', label: 'Submitted to me', children: <PendingReviewVerificationTable perspective="mine" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
                    { key: 'others', label: 'Submitted to Others', children: <PendingReviewVerificationTable perspective="others" onEventsClick={setEventsRows} onHistoryClick={setHistoryExpId} /> },
                  ]}
                />
              ),
            },
            {
              key: 'template_pending_approval',
              label: 'Template Pending Approval',
              children: <TemplatePendingApprovalTable />,
            }] : []),
            {
              key: 'review_requests',
              label: 'Review Requests',
              children: <ReviewRequestsTable />,
            },
            {
              key: 'unlock_experiment',
              label: 'Unlock Experiment',
              children: <UnlockExperimentTable />,
            },
            {
              key: 'reassign_reviewer',
              label: 'Re-assign Reviewer',
              children: <ReassignReviewerTable />,
            },
          ]}
        />
      </Card>

      {/* Improvement Suggested — the review comments thread for one experiment */}
      <Modal {...glassModalProps} title="Improvement Suggested" open={!!commentsThread} onCancel={() => setCommentsThread(null)} footer={null}>
        <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
          {(commentsThread ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">No comments.</p>
          ) : (
            (commentsThread ?? []).map((c, i) => (
              <div key={c.id ?? i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="font-semibold text-slate-700">{c.byName || 'Reviewer'}</span>
                  <span className="text-slate-400">{c.at ? dayjs(c.at).format('DD MMM YYYY (HH:mm)') : ''}</span>
                </div>
                <p className="text-slate-700">{c.message}</p>
              </div>
            ))
          )}
        </div>
      </Modal>

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

      {/* History — "Pending for Review/Verification" (TL): version snapshots for the selected experiment, distinct from Events' status-transition log */}
      <Modal {...glassModalProps} title="History" open={!!historyExpId} onCancel={() => setHistoryExpId(null)} footer={null}>
        <div className="py-2 space-y-2 max-h-[60vh] overflow-y-auto">
          {historyLoading ? (
            <p className="text-xs text-slate-400 italic">Loading…</p>
          ) : !historyData || (historyData as VersionsResponse).snapshots.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No version history recorded.</p>
          ) : (
            (historyData as VersionsResponse).snapshots.map((s) => (
              <div key={s.version} className="text-xs border-l-2 border-indigo-200 pl-2">
                <span className="font-medium text-slate-700">Version {s.version}</span>
                <span className="text-slate-500"> — {s.status ? s.status.replace(/_/g, ' ') : '—'}</span>
                <span className="text-slate-500"> by {s.savedBy || '—'}</span>
                {s.savedAt && <span className="text-slate-400"> · {dayjs(s.savedAt).format('DD MMM YYYY (HH:mm)')}</span>}
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
