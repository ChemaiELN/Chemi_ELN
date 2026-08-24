/**
 * Small reusable "Final Report" link + actions menu for a single
 * ArdTestRequest, shown once that test is VERIFIED. Used identically from
 * ArdAtrWorkspacePage.tsx (ARD side) and AtrRequestField.tsx (CGT/ADC
 * experiment side) so both always show the same file and the same actions.
 *
 * The report itself is the shared `test_final_report` attachment slot
 * uploaded from ArdTestExecutePage.tsx's "Final Report" button (see
 * FinalReportUpload there) — same generic ARD attachments backend.
 *
 * The gear menu's actions (Accept / Unsatisfactory / Request Enhancement)
 * call the same real per-test endpoints used elsewhere in the ARD test
 * pages (backend/app/modules/ard/tests.py): accept-test, unsatisfactory,
 * enhancement-requests.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dropdown, Modal, Input, message } from 'antd'
import type { MenuProps } from 'antd'
import { Download, Eye, MoreVertical, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react'
import { ardUploadsApi } from '../../api/ard-uploads'
import { apiPost } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

const { TextArea } = Input

export default function TestFinalReportLink({ atrId, testId, status }: { atrId: string; testId: string; status?: string }) {
  const qc = useQueryClient()
  const [msgApi, ctx] = message.useMessage()
  const [unsatOpen, setUnsatOpen] = useState(false)
  const [unsatRemarks, setUnsatRemarks] = useState('')
  const [enhOpen, setEnhOpen] = useState(false)
  const [enhReason, setEnhReason] = useState('')
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [acceptPassword, setAcceptPassword] = useState('')
  const [acceptRemarks, setAcceptRemarks] = useState('')

  // Verified tests get the full action menu; once accepted, only
  // viewing/downloading the report still makes sense — everything else
  // (accept/unsatisfactory/enhancement) is a one-time, already-settled action.
  const isAccepted = status === 'ACCEPTED'
  const show = status === 'VERIFIED' || isAccepted

  const { data: files = [] } = useQuery({
    queryKey: ['ard-attachments', 'test_final_report', testId],
    queryFn: () => ardUploadsApi.list('test_final_report', testId),
    enabled: !!testId && show,
  })
  const latest = files[files.length - 1]

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ard-atr', atrId] })
    qc.invalidateQueries({ queryKey: ['ard-test', atrId, testId] })
  }

  const acceptMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/accept-test`, {
      password: acceptPassword, remarks: acceptRemarks,
    }),
    onSuccess: () => {
      setAcceptOpen(false); setAcceptPassword(''); setAcceptRemarks('')
      invalidate(); msgApi.success('Test accepted.')
    },
    onError: (e: any) => msgApi.error(e?.detail || e?.message || 'Failed to accept test.'),
  })
  const unsatMut = useMutation({
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/unsatisfactory`, { remarks: unsatRemarks }),
    onSuccess: () => { setUnsatOpen(false); setUnsatRemarks(''); invalidate(); msgApi.success('Test marked unsatisfactory.') },
    onError: (e: any) => msgApi.error(e?.detail || e?.message || 'Failed to mark unsatisfactory.'),
  })
  const enhMut = useMutation({
    // Same test, sent back to ARD for rework — no separate/additional test
    // type needed; the backend defaults it to this test's own type.
    mutationFn: () => apiPost(`/api/ard/tests/${atrId}/${testId}/enhancement-requests`, { reason: enhReason }),
    onSuccess: () => { setEnhOpen(false); setEnhReason(''); invalidate(); msgApi.success('Enhancement requested — sent back to the ARD team.') },
    onError: (e: any) => msgApi.error(e?.detail || e?.message || 'Failed to request enhancement.'),
  })

  const handleDownload = async () => {
    if (!latest) return
    try {
      const { blob, filename } = await ardUploadsApi.downloadBlob(latest.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || latest.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      msgApi.error('Failed to download report.')
    }
  }

  if (!show) return null

  const viewItem: MenuProps['items'] = [
    { key: 'view', label: 'View Report', icon: <Eye size={13} />, disabled: !latest, onClick: () => latest && window.open(latest.downloadUrl, '_blank') },
    { key: 'download', label: 'Download Report', icon: <Download size={13} />, disabled: !latest, onClick: handleDownload },
  ]
  const items: MenuProps['items'] = isAccepted ? viewItem : [
    { key: 'accept', label: 'Accept', icon: <CheckCircle2 size={13} />, onClick: () => setAcceptOpen(true) },
    ...viewItem,
    { key: 'enhancement', label: 'Request Enhancement', icon: <Wrench size={13} />, onClick: () => setEnhOpen(true) },
    { key: 'unsatisfactory', label: 'Unsatisfactory', icon: <AlertTriangle size={13} />, danger: true, onClick: () => setUnsatOpen(true) },
  ]

  return (
    <>
      {ctx}
      <div className="flex items-center gap-1.5">
        {latest && (
          <a href={latest.downloadUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline" title={latest.filename}>
            Final Report
          </a>
        )}
        <Dropdown menu={{ items }} trigger={['click']}>
          <button type="button" className="text-slate-400 hover:text-slate-700">
            <MoreVertical size={14} />
          </button>
        </Dropdown>
      </div>

      <Modal
        {...glassModalProps}
        title="Accept Test Results (E-Signature)"
        open={acceptOpen}
        onCancel={() => { setAcceptOpen(false); setAcceptPassword(''); setAcceptRemarks('') }}
        onOk={() => acceptMut.mutate()}
        okText="Sign & Accept"
        okButtonProps={{ disabled: !acceptPassword }}
        confirmLoading={acceptMut.isPending}
        destroyOnClose
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Re-enter your password to sign and accept this test's results.</p>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
              Password <span className="text-red-400">*</span>
            </label>
            <Input.Password value={acceptPassword} onChange={e => setAcceptPassword(e.target.value)} placeholder="Your password" onPressEnter={() => acceptPassword && acceptMut.mutate()} />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">Remarks (optional)</label>
            <TextArea rows={2} value={acceptRemarks} onChange={e => setAcceptRemarks(e.target.value)} placeholder="Any remarks on accepting this test..." />
          </div>
        </div>
      </Modal>

      <Modal
        {...glassModalProps}
        title="Mark Test Unsatisfactory"
        open={unsatOpen}
        onCancel={() => { setUnsatOpen(false); setUnsatRemarks('') }}
        onOk={() => unsatMut.mutate()}
        okText="Mark Unsatisfactory"
        okButtonProps={{ danger: true, disabled: !unsatRemarks.trim() }}
        confirmLoading={unsatMut.isPending}
        destroyOnClose
      >
        <p className="text-xs text-slate-500 mb-2">Remarks are required for GxP traceability.</p>
        <TextArea rows={3} value={unsatRemarks} onChange={e => setUnsatRemarks(e.target.value)} placeholder="Reason this test is unsatisfactory..." />
      </Modal>

      <Modal
        {...glassModalProps}
        title="Request Enhancement Test"
        open={enhOpen}
        onCancel={() => { setEnhOpen(false); setEnhReason('') }}
        onOk={() => enhMut.mutate()}
        okText="Request"
        okButtonProps={{ disabled: !enhReason.trim() }}
        confirmLoading={enhMut.isPending}
        destroyOnClose
      >
        <p className="text-xs text-slate-500 mb-2">
          This sends the same test back to the ARD team for rework — no separate test type needed.
        </p>
        <label className="text-xs text-slate-500 font-semibold uppercase tracking-wide block mb-1">
          Reason <span className="text-red-400">*</span>
        </label>
        <TextArea rows={3} value={enhReason} onChange={e => setEnhReason(e.target.value)} placeholder="Explain why this test needs rework..." />
      </Modal>
    </>
  )
}
