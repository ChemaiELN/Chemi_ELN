import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tag, Spin, Empty, Button } from 'antd'
import { Plus, Minus, Pencil, ChevronDown, ChevronRight } from 'lucide-react'
import dayjs from 'dayjs'
import { workflowTemplateApi } from '../../../api/adc'
import { diffTemplateDefinitions, type DiffEntry } from './versionDiff'
import type { TemplateDefinition } from './types'

const KIND_STYLE: Record<DiffEntry['kind'], { color: string; bg: string; icon: React.ElementType }> = {
  added: { color: '#16a34a', bg: '#f0fdf4', icon: Plus },
  removed: { color: '#dc2626', bg: '#fef2f2', icon: Minus },
  modified: { color: '#2563eb', bg: '#eff6ff', icon: Pencil },
}
const LEVEL_LABEL: Record<DiffEntry['level'], string> = {
  section: 'Section',
  screen: 'Screen',
  field: 'Field',
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const style = KIND_STYLE[entry.kind]
  const Icon = style.icon
  return (
    <div className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg" style={{ backgroundColor: style.bg }}>
      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: style.color }}>
        <Icon size={10} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: style.color }}>{LEVEL_LABEL[entry.level]}</span>
          <span className="text-[12px] font-semibold text-slate-800 truncate">{entry.label}</span>
        </div>
        {entry.level === 'field' && <p className="text-[10px] text-slate-400 mt-0.5">in {entry.path}</p>}
        {entry.changes && entry.changes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {entry.changes.map((c, i) => <li key={i} className="text-[11px] text-slate-600">• {c}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

// One previous-version card, styled the same as the current template's card,
// with a compact change summary vs. the version right after it, expandable
// in place to the full diff — no popup/drawer.
function PreviousVersionCard({
  version, nextDefinition, nextLabel,
}: {
  version: { version: number; saved_by: string | null; saved_at: string; definition: unknown }
  nextDefinition: unknown
  nextLabel: string
}) {
  const [open, setOpen] = useState(false)
  const diff = diffTemplateDefinitions(version.definition as TemplateDefinition, nextDefinition as TemplateDefinition)
  const counts = {
    added: diff.filter((d) => d.kind === 'added').length,
    removed: diff.filter((d) => d.kind === 'removed').length,
    modified: diff.filter((d) => d.kind === 'modified').length,
  }

  return (
    <div className="rounded-xl p-4 flex flex-col col-span-full" style={{ backgroundColor: '#FEFEFA' }}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-semibold text-slate-800 truncate">Previous Version</p>
        <Tag>v{version.version}</Tag>
      </div>
      <p className="text-xs text-slate-400 mb-1">
        {dayjs(version.saved_at).format('MMM D, YYYY h:mm A')}{version.saved_by ? ` · ${version.saved_by}` : ''}
      </p>
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <Tag color="green" bordered className="text-[11px]">{counts.added} added</Tag>
        <Tag color="red" bordered className="text-[11px]">{counts.removed} removed</Tag>
        <Tag color="blue" bordered className="text-[11px]">{counts.modified} modified</Tag>
        <span className="text-[11px] text-slate-400">vs {nextLabel}</span>
      </div>
      <div className="border-t border-white/50 pt-3">
        <Button
          size="small"
          icon={open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Hide Changes' : 'View Changes'}
        </Button>
      </div>
      {open && (
        <div className="mt-3 space-y-1.5">
          {diff.length === 0 ? (
            <p className="text-[12px] text-slate-400 text-center py-2">No structural differences.</p>
          ) : diff.map((entry, i) => <DiffRow key={i} entry={entry} />)}
        </div>
      )}
    </div>
  )
}

export default function PreviousVersionsList({ templateId, currentVersion }: { templateId: string; currentVersion: number }) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['workflow-template-versions', templateId],
    queryFn: () => workflowTemplateApi.versions(templateId),
  })

  const sorted = [...versions].sort((a, b) => b.version - a.version)
  const previous = sorted.filter((v) => v.version !== currentVersion)
  const byVersion = new Map(sorted.map((v) => [v.version, v]))

  if (isLoading) return <div className="flex justify-center py-6"><Spin size="small" /></div>
  if (previous.length === 0) return <Empty description="No previous versions yet" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-4" />

  return (
    <>
      {previous.map((v) => {
        const next = byVersion.get(v.version + 1)
        if (!next) return null
        return (
          <PreviousVersionCard
            key={v.version}
            version={v}
            nextDefinition={next.definition}
            nextLabel={`v${next.version}`}
          />
        )
      })}
    </>
  )
}
