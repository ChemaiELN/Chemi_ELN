import { Empty } from 'antd'

interface CgtPlaceholderPageProps {
  icon: React.ElementType
  title: string
  subtitle: string
  description: string
}

// Shared "coming soon" shell for CGT sections that don't have real
// functionality yet. Mirrors the page-header + glass-card layout used
// across the ADC module so CGT reads as a first-class module, not a
// bolted-on stub, once real data/tables replace this placeholder.
export default function CgtPlaceholderPage({ icon: Icon, title, subtitle, description }: CgtPlaceholderPageProps) {
  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Icon size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="glass-card rounded-lg p-16 flex items-center justify-center">
        <Empty description={description} />
      </div>
    </div>
  )
}
