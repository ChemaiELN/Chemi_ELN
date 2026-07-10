import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { ChevronLeft, Dna, LayoutTemplate } from 'lucide-react'

// Dedicated page for the CGT Plasmid Process workflow card on the Admin →
// Workflow Templates page — mirrors the breadcrumb + header pattern used by
// the ADC Process sub-views in WorkflowTemplatesPage.tsx. Entry point into
// the Template Builder (drag-and-drop form designer) for this workflow.
export default function CgtPlasmidProcessPage() {
  const navigate = useNavigate()

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin/workflow-templates')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft size={15} /> Back
        </button>
        <span className="text-slate-300">/</span>
        <span
          className="text-sm text-slate-500 cursor-pointer hover:text-slate-700"
          onClick={() => navigate('/admin/workflow-templates')}
        >
          Workflow Templates
        </span>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-700">CGT Plasmid Process</span>
      </div>

      {/* Header */}
      <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30 shrink-0">
          <Dna size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-800">CGT Plasmid Process</h1>
          <p className="text-sm text-slate-500">Cell and Gene Therapy plasmid workflow — section templates</p>
        </div>
        <Button
          type="primary"
          icon={<LayoutTemplate size={14} />}
          onClick={() => navigate('/admin/workflow-templates/cgt-plasmid/builder')}
        >
          Open Template Builder
        </Button>
      </div>

      {/* Entry card */}
      <div
        onClick={() => navigate('/admin/workflow-templates/cgt-plasmid/builder')}
        className="glass-card rounded-3xl p-7 text-left hover:shadow-2xl hover:shadow-teal-300/40 hover:-translate-y-1 hover:bg-white/65 transition-all duration-200 group cursor-pointer max-w-md"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <LayoutTemplate size={26} className="text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Template Builder</h2>
        <p className="text-slate-500 text-sm">Design and configure the plasmid process form templates with a drag-and-drop section &amp; field designer.</p>
      </div>
    </div>
  )
}
