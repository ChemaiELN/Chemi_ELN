import { useEffect, useState } from 'react'
import { Button, InputNumber } from 'antd'
import { Play, Square, RotateCcw } from 'lucide-react'
import dayjs from 'dayjs'

// ── Timer (Start/End) advanced element — runtime ────────────────────────────
// Generic stopwatch for a process step's duration (e.g. "Thaw time on ice").
// Purely local to this field's own stored value — no backend calls, unlike
// UsageLogStartStopField (which starts/ends a real inventory usage-log
// session). Start/End record wall-clock timestamps; the elapsed duration is
// computed automatically on End but the chemist can still type over it
// afterward (e.g. correcting for a paused/restarted timer) via
// `durationOverridden`, which is set the moment they edit the number field.
export interface TimerFieldValue {
  startedAt?: string
  endedAt?: string
  duration?: number           // in `durationUnit`
  durationOverridden?: boolean
}

interface TimerFieldProps {
  value: TimerFieldValue | undefined
  onChange: (v: TimerFieldValue) => void
  disabled?: boolean
  durationUnit?: 'seconds' | 'minutes' | 'hours'
}

function computeDuration(startedAt: string, endedAt: string, unit: 'seconds' | 'minutes' | 'hours'): number {
  const ms = dayjs(endedAt).diff(dayjs(startedAt))
  const divisor = unit === 'seconds' ? 1000 : unit === 'minutes' ? 60_000 : 3_600_000
  return Math.round((ms / divisor) * 100) / 100
}

const UNIT_LABEL: Record<'seconds' | 'minutes' | 'hours', string> = {
  seconds: 'sec', minutes: 'min', hours: 'hr',
}

export default function TimerField({ value, onChange, disabled, durationUnit = 'minutes' }: TimerFieldProps) {
  // Live-ticking display while running — doesn't touch the stored value
  // (only Start/End/manual edits do), just re-renders every second.
  const [, forceTick] = useState(0)
  const running = !!value?.startedAt && !value?.endedAt
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => forceTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  function handleStart() {
    onChange({ startedAt: dayjs().toISOString(), endedAt: undefined, duration: undefined, durationOverridden: false })
  }

  function handleEnd() {
    if (!value?.startedAt) return
    const endedAt = dayjs().toISOString()
    onChange({ ...value, endedAt, duration: computeDuration(value.startedAt, endedAt, durationUnit) })
  }

  function handleReset() {
    onChange({ startedAt: undefined, endedAt: undefined, duration: undefined, durationOverridden: false })
  }

  function handleDurationChange(n: number | null) {
    onChange({ ...value, duration: n ?? undefined, durationOverridden: true })
  }

  const liveElapsed = running && value?.startedAt
    ? computeDuration(value.startedAt, dayjs().toISOString(), durationUnit)
    : undefined

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="small" type="primary" icon={<Play size={12} />}
        disabled={disabled || running || !!value?.endedAt}
        onClick={handleStart}
      >
        Start
      </Button>
      <Button
        size="small" danger icon={<Square size={12} />}
        disabled={disabled || !running}
        onClick={handleEnd}
      >
        End
      </Button>
      {(value?.startedAt || value?.endedAt) && (
        <Button
          size="small" type="text" icon={<RotateCcw size={12} />}
          disabled={disabled}
          onClick={handleReset}
          title="Reset timer"
        />
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-slate-500">Duration</span>
        <InputNumber
          size="small"
          min={0}
          value={value?.duration ?? liveElapsed ?? null}
          onChange={handleDurationChange}
          disabled={disabled}
          placeholder="—"
          style={{ width: 90 }}
        />
        <span className="text-[12px] text-slate-400">{UNIT_LABEL[durationUnit]}</span>
      </div>
      {running && (
        <span className="text-[11px] text-emerald-600 italic">Running…</span>
      )}
      {value?.durationOverridden && (
        <span className="text-[11px] text-amber-600 italic">Manually edited</span>
      )}
    </div>
  )
}
