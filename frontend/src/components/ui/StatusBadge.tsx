interface StatusBadgeProps {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}

export default function StatusBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        active
          ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60'
          : 'bg-slate-50/80 text-slate-500 border-slate-200/60'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
