import { useState } from 'react'
import { Button, Modal, Tag, Tooltip } from 'antd'
import { Lock, Unlock, ShieldOff } from 'lucide-react'
import PasswordSignatureModal from '../../pages/cgt/components/PasswordSignatureModal'

// Shared three-state lifecycle for Project and Notebook, in both the ADC and
// CGT modules — replaces the old free-form status fields (Project's
// ACTIVE/ON_HOLD/COMPLETED/CANCELLED/ARCHIVED dropdown, Notebook's inert
// status column) with a real, enforced model:
//   ACTIVE <-> CLOSED -> DEACTIVATED (terminal, no way back)
// Every transition is password-signed (re-entering your password proves it's
// you, right now) and privilege-gated on the caller's side.
export const LIFECYCLE_STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'green',
  CLOSED: 'orange',
  DEACTIVATED: 'red',
}

export function LifecycleStatusTag({ status }: { status: string }) {
  return <Tag color={LIFECYCLE_STATUS_COLOR[status] ?? 'default'}>{status}</Tag>
}

interface ProjectLifecycleActionsProps {
  status: string
  canClose: boolean
  canReopen: boolean
  canDeactivate: boolean
  // Client-side hint only (disables the button + explains why) — the backend
  // re-checks this itself regardless.
  allNotebooksDeactivated: boolean
  onClose: (password: string) => Promise<unknown>
  onReopen: (password: string) => Promise<unknown>
  onDeactivate: (password: string) => Promise<unknown>
}

export function ProjectLifecycleActions({
  status, canClose, canReopen, canDeactivate, allNotebooksDeactivated, onClose, onReopen, onDeactivate,
}: ProjectLifecycleActionsProps) {
  const [modal, setModal] = useState<'close' | 'reopen' | 'deactivate' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSign = async (password: string) => {
    setLoading(true)
    setError(null)
    try {
      if (modal === 'close') await onClose(password)
      else if (modal === 'reopen') await onReopen(password)
      else if (modal === 'deactivate') await onDeactivate(password)
      setModal(null)
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Action failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {status === 'ACTIVE' && canClose && (
        <Button size="small" icon={<Lock size={13} />} onClick={() => setModal('close')}>Close Project</Button>
      )}
      {status === 'CLOSED' && canReopen && (
        <Button size="small" icon={<Unlock size={13} />} onClick={() => setModal('reopen')}>Reopen Project</Button>
      )}
      {status !== 'DEACTIVATED' && canDeactivate && (
        <Tooltip title={allNotebooksDeactivated ? undefined : 'Every Notebook under this Project must be deactivated first.'}>
          <Button
            size="small" danger disabled={!allNotebooksDeactivated}
            icon={<ShieldOff size={13} />} onClick={() => setModal('deactivate')}
          >
            Deactivate Project
          </Button>
        </Tooltip>
      )}

      <PasswordSignatureModal
        open={!!modal}
        title={
          modal === 'close' ? 'Close Project'
            : modal === 'reopen' ? 'Reopen Project'
              : 'Deactivate Project'
        }
        message={
          modal === 'close' ? 'Closing this Project blocks creating new Notebooks under it. It can be reopened later.'
            : modal === 'reopen' ? 'Reopening this Project makes it Active again — new Notebooks can be created under it.'
              : 'Deactivating this Project is permanent — it and every Notebook under it can no longer be changed in any way. This cannot be undone.'
        }
        loading={loading}
        error={error}
        onSign={handleSign}
        onCancel={() => { setModal(null); setError(null) }}
      />
    </>
  )
}

interface NotebookLifecycleActionsProps {
  status: string
  canClose: boolean
  canReopen: boolean
  canDeactivate: boolean
  // Experiments in this Notebook that are not yet Approved — closing will
  // freeze them, so the user is warned and must confirm before signing.
  nonApprovedExperimentCount: number
  // Deactivate is blocked on a Notebook with no Experiments at all.
  hasAnyExperiment: boolean
  onClose: (password: string) => Promise<unknown>
  onReopen: (password: string) => Promise<unknown>
  onDeactivate: (password: string) => Promise<unknown>
}

export function NotebookLifecycleActions({
  status, canClose, canReopen, canDeactivate, nonApprovedExperimentCount, hasAnyExperiment,
  onClose, onReopen, onDeactivate,
}: NotebookLifecycleActionsProps) {
  const [modal, setModal] = useState<'close' | 'reopen' | 'deactivate' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openClose = () => {
    if (nonApprovedExperimentCount > 0) {
      Modal.confirm({
        title: 'This Notebook has ongoing Experiments',
        content: `${nonApprovedExperimentCount} experiment(s) in this Notebook are not yet Approved. Closing the Notebook will freeze them — they cannot be edited, submitted, or reviewed again until the Notebook is reopened. Are you sure?`,
        okText: 'Yes, close and freeze',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        centered: true,
        onOk: () => setModal('close'),
      })
    } else {
      setModal('close')
    }
  }

  const handleSign = async (password: string) => {
    setLoading(true)
    setError(null)
    try {
      if (modal === 'close') await onClose(password)
      else if (modal === 'reopen') await onReopen(password)
      else if (modal === 'deactivate') await onDeactivate(password)
      setModal(null)
    } catch (e: any) {
      setError(e?.detail || e?.message || 'Action failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {status === 'ACTIVE' && canClose && (
        <Button size="small" icon={<Lock size={13} />} onClick={openClose}>Close Notebook</Button>
      )}
      {status === 'CLOSED' && canReopen && (
        <Button size="small" icon={<Unlock size={13} />} onClick={() => setModal('reopen')}>Reopen Notebook</Button>
      )}
      {status !== 'DEACTIVATED' && canDeactivate && (
        <Tooltip title={hasAnyExperiment ? undefined : 'This Notebook has no Experiments — nothing to deactivate.'}>
          <Button
            size="small" danger disabled={!hasAnyExperiment}
            icon={<ShieldOff size={13} />} onClick={() => setModal('deactivate')}
          >
            Deactivate Notebook
          </Button>
        </Tooltip>
      )}

      <PasswordSignatureModal
        open={!!modal}
        title={
          modal === 'close' ? 'Close Notebook'
            : modal === 'reopen' ? 'Reopen Notebook'
              : 'Deactivate Notebook'
        }
        message={
          modal === 'close' ? 'Closing this Notebook freezes any Experiment not yet Approved. New Experiments can still be created. It can be reopened later.'
            : modal === 'reopen' ? 'Reopening this Notebook makes it Active again and unfreezes any Experiment that was frozen when it closed.'
              : 'Deactivating this Notebook is permanent — every Experiment in it is frozen and no new ones can be created. This cannot be undone.'
        }
        loading={loading}
        error={error}
        onSign={handleSign}
        onCancel={() => { setModal(null); setError(null) }}
      />
    </>
  )
}
