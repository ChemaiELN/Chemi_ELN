import { useState } from 'react'
import { Button, message, Tooltip } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Square } from 'lucide-react'
import { usageLogApi, instrumentCatalogueApi, type UsageLog, type UsageLogCreateBody } from '../../../api/inventory'

// ── Equipment/Instrument Start/Stop advanced element — runtime (CGT + ADC
// experiment screens) ───────────────────────────────────────────────────────
// Starts/ends a REAL app.models.inventory usage-log session via the existing
// /api/inventory/usage-logs endpoints (see api/inventory.ts's usageLogApi) —
// the server auto-flips the target catalogue item's status
// AVAILABLE <-> IN_USE.
//
// A given equipment/instrument can be referenced by a Usage Log field placed
// in more than one section (e.g. logged once in "1.6 Equipment/Instrument
// Details" and again next to the step that actually uses it), so the
// authoritative Running/Ended state is resolved LIVE from the backend by
// catalogue id — not purely from this field's own locally stored value.
// Otherwise a second placement for the same asset would have no idea a
// session was already started elsewhere: it would offer Start again (a
// second, untracked session) and its own End button couldn't close the
// first one. The stored `value` still gets updated on every action, purely
// as this field's own audit record and as a fallback while the live check is
// loading or the asset has genuinely never been used.
export interface UsageLogFieldValue {
  usageLogId?: string
  status?: 'RUNNING' | 'ENDED'
}

interface UsageLogStartStopFieldProps {
  value: UsageLogFieldValue | undefined
  onChange: (v: UsageLogFieldValue) => void
  disabled?: boolean
  targetKind: 'EQUIPMENT' | 'INSTRUMENT'
  // Numeric catalogue id (EquipmentCatalogue.id / InstrumentCatalogue.id, NOT
  // the `asset_id` string) resolved by the caller from a sibling column in
  // the same row — resolving it is the caller's job, not this component's.
  catalogueId?: number
  // Provenance passthrough — mirrors AtrRequestField's originExperimentId.
  experimentId?: string
}

export default function UsageLogStartStopField({ value, onChange, disabled, targetKind, catalogueId, experimentId }: UsageLogStartStopFieldProps) {
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const notConfigured = !catalogueId

  const activeQueryKey = ['usage-log-active', targetKind, catalogueId] as const
  const activeQuery = useQuery({
    queryKey: activeQueryKey,
    queryFn: () => usageLogApi.listPaged({
      target_kind: targetKind,
      ...(targetKind === 'EQUIPMENT' ? { equipment_id: catalogueId } : { instrument_id: catalogueId }),
      status: 'ACTIVE',
      sort_by: 'started_at',
      sort_dir: 'desc',
      limit: 1,
    }),
    enabled: !!catalogueId,
    staleTime: 10_000,
  })
  const activeLog = activeQuery.data?.items[0] as UsageLog | undefined

  // Instruments flagged "Parallel Use" (e.g. multi-slot equipment) support
  // more than one concurrent session, so another placement's active session
  // must NOT block Start here — this field then tracks only its own
  // start/end pair instead of deferring to the live "someone has it" check.
  const catalogueQuery = useQuery({
    queryKey: ['instrument-catalogue-parallel-use', catalogueId],
    queryFn: () => instrumentCatalogueApi.get(catalogueId!),
    enabled: targetKind === 'INSTRUMENT' && !!catalogueId,
    staleTime: 60_000,
  })
  const allowParallelUse = targetKind === 'INSTRUMENT' && catalogueQuery.data?.allow_parallel_use === true

  // A running session found by the live check always wins (it's the true
  // current state, wherever it was started); otherwise fall back to this
  // field's own locally recorded status. Parallel-use instruments skip the
  // live check entirely so a busy instrument stays available for others.
  const status: 'RUNNING' | 'ENDED' | undefined = allowParallelUse
    ? value?.status
    : (activeLog ? 'RUNNING' : value?.status)
  const usageLogId = allowParallelUse
    ? value?.usageLogId
    : (activeLog ? String(activeLog.id) : value?.usageLogId)

  async function handleStart() {
    if (!catalogueId) return
    setBusy(true)
    try {
      const body: UsageLogCreateBody = {
        ...(targetKind === 'EQUIPMENT' ? { equipment_id: catalogueId } : { instrument_id: catalogueId }),
        started_at: new Date().toISOString(),
        usage_remarks: 'Started from experiment',
        source: 'EXPERIMENT',
        ...(experimentId ? { experiment_id: experimentId } : {}),
      }
      const res = await usageLogApi.create(body)
      onChange({ usageLogId: String(res.id), status: 'RUNNING' })
      await qc.invalidateQueries({ queryKey: activeQueryKey })
      message.success('Equipment usage started.')
    } catch (e: any) {
      message.error(e?.detail || e?.message || 'Could not start equipment usage.')
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    if (!usageLogId) return
    setBusy(true)
    try {
      await usageLogApi.end(Number(usageLogId), {
        ended_at: new Date().toISOString(),
        usage_remarks: 'Ended from experiment',
      })
      onChange({ usageLogId, status: 'ENDED' })
      await qc.invalidateQueries({ queryKey: activeQueryKey })
      message.success('Equipment usage ended.')
    } catch (e: any) {
      message.error(e?.detail || e?.message || 'Could not end equipment usage.')
    } finally {
      setBusy(false)
    }
  }

  if (notConfigured) {
    return (
      <Tooltip title="Pick an Equipment/Instrument ID field for this element in the Template Builder first.">
        <div className="flex items-center gap-2">
          <Button size="small" disabled icon={<Play size={12} />}>Start</Button>
          <Button size="small" disabled icon={<Square size={12} />}>End</Button>
          <span className="text-[11px] text-slate-400 italic">Not configured</span>
        </div>
      </Tooltip>
    )
  }

  if (status === 'ENDED') {
    return (
      <div className="flex items-center gap-2">
        <Button size="small" disabled icon={<Play size={12} />}>Start</Button>
        <Button size="small" disabled icon={<Square size={12} />}>End</Button>
        <span className="text-[11px] text-slate-400 italic">Ended</span>
      </div>
    )
  }

  if (status === 'RUNNING') {
    return (
      <div className="flex items-center gap-2">
        <Button size="small" disabled icon={<Play size={12} />}>Start</Button>
        <Button size="small" danger loading={busy} disabled={disabled} icon={<Square size={12} />} onClick={handleEnd}>End</Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="small" type="primary" loading={busy || activeQuery.isLoading} disabled={disabled} icon={<Play size={12} />} onClick={handleStart}>Start</Button>
      <Button size="small" disabled icon={<Square size={12} />}>End</Button>
    </div>
  )
}
