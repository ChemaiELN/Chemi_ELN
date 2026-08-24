import React from 'react'
import { CheckCircle2, Circle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react'

export interface ArdWorkflowStepperProps {
  currentStatus: string
  mandatePreApproval?: boolean
  mandateCerti?: boolean
}

interface Step {
  key: string
  label: string
  statuses: string[]
}

export function ArdWorkflowStepper({ currentStatus, mandatePreApproval = true }: ArdWorkflowStepperProps) {
  const steps: Step[] = [
    { key: 'draft', label: 'Draft / Saved', statuses: ['DRAFT', 'SAVED'] },
    { key: 'submission', label: 'Submitted (NEW)', statuses: ['NEW', 'PENDING_CLARIFICATION', 'CLARIFIED'] },
    ...(mandatePreApproval
      ? [{ key: 'pre_approval', label: 'QA Pre-Approval', statuses: ['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK'] }]
      : []),
    { key: 'in_lab', label: 'In Lab Testing', statuses: ['PARTIAL', 'IN_PROGRESS'] },
    { key: 'approval', label: 'Verification & Approval', statuses: ['PENDING_APPROVAL', 'APPROVED', 'VERIFIED'] },
    { key: 'certified', label: 'QA Certified', statuses: ['CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK', 'CERTIFIED'] },
  ]

  const getStepIndex = (status: string) => {
    if (['DRAFT', 'SAVED'].includes(status)) return 0
    if (['NEW', 'PENDING_CLARIFICATION', 'CLARIFIED'].includes(status)) return 1
    if (['QA_PRE_APPROVAL', 'PRE_APPROVAL_REWORK'].includes(status)) return mandatePreApproval ? 2 : 1
    if (['PARTIAL', 'IN_PROGRESS'].includes(status)) return mandatePreApproval ? 3 : 2
    if (['PENDING_APPROVAL', 'APPROVED', 'VERIFIED'].includes(status)) return mandatePreApproval ? 4 : 3
    if (['CERTIFICATION_REQUESTED', 'CERTIFICATION_REWORK', 'CERTIFIED'].includes(status)) return mandatePreApproval ? 5 : 4
    return 0
  }

  const activeIdx = getStepIndex(currentStatus)
  const isRejected = ['REJECTED', 'WITHDRAWN'].includes(currentStatus)

  return (
    <div className="glass-card rounded-lg px-4 py-2.5 mb-3">
      <div className="flex items-center justify-between gap-2 overflow-x-auto">
        {steps.map((step, idx) => {
          const isDone = idx < activeIdx && !isRejected
          const isCurrent = idx === activeIdx && !isRejected
          const isUpcoming = idx > activeIdx && !isRejected

          return (
            <React.Fragment key={step.key}>
              {idx > 0 && (
                <div
                  className={`h-0.5 flex-1 min-w-[20px] rounded-full transition-colors ${
                    isDone ? 'bg-indigo-600' : isCurrent ? 'bg-indigo-400' : 'bg-slate-200'
                  }`}
                />
              )}
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isCurrent
                      ? 'bg-indigo-50 text-indigo-700 border-2 border-indigo-600 shadow-sm animate-pulse'
                      : isRejected
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 size={15} />
                  ) : isCurrent ? (
                    step.key === 'certified' ? <ShieldCheck size={14} /> : <Clock size={14} />
                  ) : isRejected ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <Circle size={12} />
                  )}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isDone
                      ? 'text-slate-800 font-semibold'
                      : isCurrent
                      ? 'text-indigo-700 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
