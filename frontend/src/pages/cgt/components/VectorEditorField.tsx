import { useState } from 'react'
import { Button, Input, InputNumber, Select, Popconfirm } from 'antd'
import { Plus, Trash2, Dna } from 'lucide-react'

// ── Vector/Plasmid Editor (light) — Advanced Element ────────────────────────
// A lightweight circular plasmid map: total sequence length + a list of
// annotated features (name, start/end bp, strand, color), rendered as arcs
// around a backbone circle. No sequence-editing, no restriction-site
// analysis, no import/export of real sequence formats (GenBank/FASTA) — this
// is a "light version" per product decision, purely local to this field's
// own stored value (no backend/third-party service calls), same pattern as
// KetcherField but self-contained SVG instead of an embedded WASM editor.
export interface VectorFeature {
  id: string
  name: string
  start: number     // bp, 0-based, inclusive
  end: number        // bp, 0-based, exclusive
  strand: 1 | -1
  color: string
}

export interface VectorEditorFieldValue {
  name?: string
  length?: number    // total plasmid length in bp
  features: VectorFeature[]
}

interface VectorEditorFieldProps {
  value: VectorEditorFieldValue | undefined
  onChange: (v: VectorEditorFieldValue) => void
  disabled?: boolean
}

const PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

function newFeatureId() {
  return `feat_${Math.random().toString(36).slice(2, 9)}`
}

// Backbone circle + one arc per feature, angle 0 = top (12 o'clock), clockwise.
function VectorMap({ length, features, size = 220 }: { length: number; features: VectorFeature[]; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 28
  const featureR = r

  function angleFor(bp: number) {
    const frac = length > 0 ? (bp % length) / length : 0
    return frac * 360 - 90 // start at top
  }

  function point(angleDeg: number, radius: number) {
    const rad = (angleDeg * Math.PI) / 180
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)]
  }

  function arcPath(startBp: number, endBp: number, radius: number) {
    const a0 = angleFor(startBp)
    const a1 = angleFor(endBp <= startBp ? startBp + (length - startBp || 1) : endBp)
    const [x0, y0] = point(a0, radius)
    const [x1, y1] = point(a1, radius)
    const largeArc = a1 - a0 > 180 ? 1 : 0
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#cbd5e1" strokeWidth={2} />
      {length > 0 && [0, 25, 50, 75].map(pct => {
        const [x, y] = point(pct * 3.6 - 90, r + 12)
        const bp = Math.round((pct / 100) * length)
        return (
          <text key={pct} x={x} y={y} fontSize={9} fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">
            {bp}
          </text>
        )
      })}
      {length > 0 && features.map(f => (
        <path
          key={f.id}
          d={arcPath(f.start, f.end, featureR)}
          fill="none"
          stroke={f.color}
          strokeWidth={8}
          strokeLinecap="round"
        />
      ))}
      <text x={cx} y={cy - 6} fontSize={12} fontWeight={600} fill="#334155" textAnchor="middle">
        {length > 0 ? `${length} bp` : 'No length set'}
      </text>
    </svg>
  )
}

export default function VectorEditorField({ value, onChange, disabled }: VectorEditorFieldProps) {
  const [expanded, setExpanded] = useState(false)
  const name = value?.name ?? ''
  const length = value?.length ?? 0
  const features = value?.features ?? []

  function patch(partial: Partial<VectorEditorFieldValue>) {
    onChange({ name, length, features, ...value, ...partial })
  }

  function addFeature() {
    const feature: VectorFeature = {
      id: newFeatureId(),
      name: `Feature ${features.length + 1}`,
      start: 0,
      end: Math.min(length || 100, 100),
      strand: 1,
      color: PALETTE[features.length % PALETTE.length],
    }
    patch({ features: [...features, feature] })
  }

  function updateFeature(id: string, partial: Partial<VectorFeature>) {
    patch({ features: features.map(f => (f.id === id ? { ...f, ...partial } : f)) })
  }

  function removeFeature(id: string) {
    patch({ features: features.filter(f => f.id !== id) })
  }

  if (!expanded && !disabled) {
    return (
      <Button size="small" icon={<Dna size={12} />} onClick={() => setExpanded(true)}>
        Open Vector Editor
      </Button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50/50" style={{ maxWidth: 640 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          size="small"
          placeholder="Vector / plasmid name"
          value={name}
          disabled={disabled}
          onChange={e => patch({ name: e.target.value })}
          style={{ width: 200 }}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-slate-500">Length</span>
          <InputNumber
            size="small"
            min={0}
            value={length || null}
            disabled={disabled}
            onChange={n => patch({ length: n ?? 0 })}
            style={{ width: 100 }}
          />
          <span className="text-[12px] text-slate-400">bp</span>
        </div>
        {!disabled && (
          <Button size="small" type="text" onClick={() => setExpanded(false)}>Collapse</Button>
        )}
      </div>

      <div className="flex gap-4 items-start flex-wrap">
        <VectorMap length={length} features={features} />
        <div className="flex-1 min-w-[240px] space-y-1.5">
          {features.length === 0 && (
            <p className="text-[12px] text-slate-400 italic">No features added yet.</p>
          )}
          {features.map(f => (
            <div key={f.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
              <Input
                size="small"
                value={f.name}
                disabled={disabled}
                onChange={e => updateFeature(f.id, { name: e.target.value })}
                style={{ width: 120 }}
              />
              <InputNumber
                size="small" min={0} max={length || undefined}
                value={f.start}
                disabled={disabled}
                onChange={n => updateFeature(f.id, { start: n ?? 0 })}
                style={{ width: 70 }}
              />
              <span className="text-[11px] text-slate-400">–</span>
              <InputNumber
                size="small" min={0} max={length || undefined}
                value={f.end}
                disabled={disabled}
                onChange={n => updateFeature(f.id, { end: n ?? 0 })}
                style={{ width: 70 }}
              />
              <Select
                size="small"
                value={f.strand}
                disabled={disabled}
                onChange={strand => updateFeature(f.id, { strand })}
                style={{ width: 56 }}
                options={[{ value: 1, label: '+' }, { value: -1, label: '−' }]}
              />
              {!disabled && (
                <Popconfirm title="Remove this feature?" onConfirm={() => removeFeature(f.id)}>
                  <Button size="small" type="text" danger icon={<Trash2 size={12} />} />
                </Popconfirm>
              )}
            </div>
          ))}
          {!disabled && (
            <Button size="small" icon={<Plus size={12} />} onClick={addFeature}>Add feature</Button>
          )}
        </div>
      </div>
    </div>
  )
}
