import React from 'react'
import { Tag } from 'antd'
import { Clock, User, Calendar, ShieldCheck, Building, Hash } from 'lucide-react'
import dayjs from 'dayjs'

export interface ArdMetadataProps {
  formNo: string
  status: string
  raisedBy?: string | null
  raisedOn?: string | null
  sourceDept?: string | null
  currentOwnerName?: string | null
  assignedTl?: string | null
  dateDiffForAge?: number | null
  certifiedBy?: string | null
  certifiedAt?: string | null
  updatedBy?: string | null
  updatedOn?: string | null
  statusColor?: string
}

export function ArdMetadataBanner({
  formNo,
  status,
  raisedBy,
  raisedOn,
  sourceDept,
  currentOwnerName,
  assignedTl,
  dateDiffForAge,
  certifiedBy,
  certifiedAt,
  statusColor = 'blue',
}: ArdMetadataProps) {
  return (
    <div className="glass-card rounded-lg px-4 py-2.5 mb-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
        <div className="space-y-0.5">
          <span className="text-slate-400 flex items-center gap-1">
            <User size={12} /> Raised By
          </span>
          <p className="font-semibold text-slate-700 truncate">{raisedBy || '—'}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-slate-400 flex items-center gap-1">
            <Calendar size={12} /> Raised On
          </span>
          <p className="font-semibold text-slate-700">
            {raisedOn ? dayjs(raisedOn).format('DD MMM YYYY, HH:mm') : '—'}
          </p>
        </div>

        <div className="space-y-0.5">
          <span className="text-slate-400 flex items-center gap-1">
            <Building size={12} /> Source Dept
          </span>
          <p className="font-semibold text-slate-700 truncate">{sourceDept || 'ARD'}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-slate-400 flex items-center gap-1">
            <User size={12} /> Current Owner / TL
          </span>
          <p className="font-semibold text-slate-700 truncate">{currentOwnerName || assignedTl || 'ARD Queue'}</p>
        </div>

        <div className="space-y-0.5">
          <span className="text-slate-400 flex items-center gap-1">
            <ShieldCheck size={12} /> QA Certified By
          </span>
          <p className="font-semibold text-slate-700 truncate">
            {certifiedBy ? `${certifiedBy} (${certifiedAt ? dayjs(certifiedAt).format('DD MMM') : ''})` : 'Pending QA'}
          </p>
        </div>

        {dateDiffForAge !== undefined && dateDiffForAge !== null && (
          <div className="space-y-0.5">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock size={12} /> ATR Age
            </span>
            <p className="font-semibold text-amber-700">{dateDiffForAge} Day(s)</p>
          </div>
        )}
      </div>
    </div>
  )
}
