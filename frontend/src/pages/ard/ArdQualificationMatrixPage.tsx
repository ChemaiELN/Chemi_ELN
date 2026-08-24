import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Tooltip, Spin, Alert, Input, Button, Modal, DatePicker, Form } from 'antd'
import { CheckCircle2, AlertTriangle, XCircle, Minus, ShieldCheck, Edit3, FileCheck, Search } from 'lucide-react'
import dayjs from 'dayjs'
import { apiGet, apiPost } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Technique {
  id: string
  code: string
  name: string
  active: boolean
}

interface TechniqueEntry {
  techniqueId: string
  startDate?: string
  endDate?: string
  certificationUrl?: string
}

interface Qualification {
  id: string
  userId: string
  analystName: string
  techniqueEntries: TechniqueEntry[]
}

interface MasterData {
  techniques: Technique[]
  qualifications: Qualification[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type QStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NONE'

function cellStatus(entry: TechniqueEntry | undefined): QStatus {
  if (!entry) return 'NONE'
  if (!entry.endDate) return 'ACTIVE'
  const daysLeft = dayjs(entry.endDate).diff(dayjs(), 'day')
  if (daysLeft < 0) return 'EXPIRED'
  if (daysLeft <= 30) return 'EXPIRING'
  return 'ACTIVE'
}

function QCell({ entry, qualificationId, techniqueId }: { entry: TechniqueEntry | undefined; qualificationId?: string; techniqueId?: string }) {
  const status = cellStatus(entry)
  const expLabel = entry?.endDate ? `Expires ${dayjs(entry.endDate).format('DD MMM YY')}` : entry ? 'No expiry set' : 'Not qualified'
  const hasCert = !!entry?.certificationUrl

  const icon =
    status === 'ACTIVE'    ? <CheckCircle2 size={16} className="text-violet-500" /> :
    status === 'EXPIRING'  ? <AlertTriangle size={16} className="text-amber-400" /> :
    status === 'EXPIRED'   ? <XCircle size={16} className="text-red-400" /> :
                              <Minus size={14} className="text-slate-300" />

  return (
    <Tooltip title={expLabel} placement="top">
      <div className="flex items-center justify-center gap-1 h-full w-full cursor-default">
        {icon}
        {hasCert && qualificationId && techniqueId && (
          <a
            href={`/api/ard/master-data/qualifications/certificate?qualification_id=${qualificationId}&technique_id=${techniqueId}`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-blue-400 hover:text-blue-600"
          >
            <FileCheck size={11} />
          </a>
        )}
      </div>
    </Tooltip>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArdQualificationMatrixPage() {
  const [analystFilter, setAnalystFilter] = useState('')
  const [techFilter, setTechFilter] = useState('')
  const [editingQ, setEditingQ] = useState<Qualification | null>(null)
  const [editForm] = Form.useForm()
  const user = useAppSelector(selectUser)
  const qc = useQueryClient()

  const canManage = ['HOD', 'SUPER_ADMIN'].includes(user?.role_code ?? '')

  const { data, isLoading, error } = useQuery<MasterData>({
    queryKey: ['ard-master-data'],
    queryFn: () => apiGet('/api/ard/master-data'),
  })

  const saveMut = useMutation({
    mutationFn: (body: { id?: string; userId: string; techniqueEntries: TechniqueEntry[] }) =>
      apiPost('/api/ard/master-data/qualifications', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ard-master-data'] })
      setEditingQ(null)
    },
  })

  function openEdit(q: Qualification) {
    setEditingQ(q)
    const values: Record<string, { startDate: ReturnType<typeof dayjs> | null; endDate: ReturnType<typeof dayjs> | null }> = {}
    for (const e of q.techniqueEntries) {
      values[e.techniqueId] = {
        startDate: e.startDate ? dayjs(e.startDate) : null,
        endDate: e.endDate ? dayjs(e.endDate) : null,
      }
    }
    editForm.setFieldsValue(values)
  }

  function handleSave(values: Record<string, { startDate: ReturnType<typeof dayjs> | null; endDate: ReturnType<typeof dayjs> | null }>) {
    if (!editingQ) return
    const techniqueEntries: TechniqueEntry[] = Object.entries(values)
      .filter(([, v]) => v?.startDate || v?.endDate)
      .map(([tid, v]) => ({
        techniqueId: tid,
        startDate: v.startDate?.format('YYYY-MM-DD'),
        endDate: v.endDate?.format('YYYY-MM-DD'),
        certificationUrl: editingQ.techniqueEntries.find(e => e.techniqueId === tid)?.certificationUrl,
      }))
    saveMut.mutate({ id: editingQ.id, userId: editingQ.userId, techniqueEntries })
  }

  const techniques = useMemo(() =>
    (data?.techniques ?? []).filter(t => t.active && (!techFilter || t.name.toLowerCase().includes(techFilter.toLowerCase()) || t.code.toLowerCase().includes(techFilter.toLowerCase()))),
  [data, techFilter])

  const analysts = useMemo(() =>
    (data?.qualifications ?? []).filter(q => !analystFilter || q.analystName.toLowerCase().includes(analystFilter.toLowerCase())),
  [data, analystFilter])

  // summary counts
  const summary = useMemo(() => {
    let active = 0, expiring = 0, expired = 0
    for (const q of data?.qualifications ?? []) {
      for (const e of q.techniqueEntries) {
        const s = cellStatus(e)
        if (s === 'ACTIVE') active++
        else if (s === 'EXPIRING') expiring++
        else if (s === 'EXPIRED') expired++
      }
    }
    return { active, expiring, expired }
  }, [data])

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spin size="large" /></div>
  if (error) return <div className="p-4 md:p-6"><Alert type="error" message="Failed to load qualification data" showIcon /></div>

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Qualification Matrix</h1>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-lg px-3 py-1.5 text-sm">
          <CheckCircle2 size={14} className="text-violet-500" />
          <span className="font-semibold text-violet-700">{summary.active}</span>
          <span className="text-violet-600">Active</span>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 text-sm">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="font-semibold text-amber-700">{summary.expiring}</span>
          <span className="text-amber-600">Expiring (≤30d)</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 text-sm">
          <XCircle size={14} className="text-red-400" />
          <span className="font-semibold text-red-700">{summary.expired}</span>
          <span className="text-red-600">Expired</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <Input prefix={<Search size={16} className="text-slate-400" />} placeholder="Filter analysts" allowClear style={{ width: 220 }}
          value={analystFilter} onChange={e => setAnalystFilter(e.target.value)} />
        <Input prefix={<Search size={16} className="text-slate-400" />} placeholder="Filter techniques" allowClear style={{ width: 220 }}
          value={techFilter} onChange={e => setTechFilter(e.target.value)} />
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-slate-400">
        {[
          [<CheckCircle2 size={12} className="text-violet-500" />, 'Active'],
          [<AlertTriangle size={12} className="text-amber-400" />, 'Expiring ≤30d'],
          [<XCircle size={12} className="text-red-400" />, 'Expired'],
          [<Minus size={12} className="text-slate-300" />, 'Not qualified'],
        ].map(([icon, label], i) => (
          <span key={i} className="flex items-center gap-1">{icon as React.ReactNode} {label as string}</span>
        ))}
      </div>

      {/* Matrix table */}
      {techniques.length === 0 || analysts.length === 0 ? (
        <div className="glass-card rounded-lg p-12 text-center text-slate-400">
          {techniques.length === 0 ? 'No active techniques configured.' : 'No qualification records found.'}
        </div>
      ) : (
        <div className="glass-card rounded-lg overflow-x-auto">
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[160px]">
                  Analyst
                </th>
                {techniques.map(t => (
                  <th key={t.id} className="px-2 py-2.5 text-center font-medium text-slate-500 text-xs whitespace-nowrap min-w-[80px]">
                    <Tooltip title={t.name}>
                      <span className="font-mono">{t.code}</span>
                    </Tooltip>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center font-medium text-slate-500 text-xs min-w-[70px]">
                  Qualified
                </th>
                {canManage && (
                  <th className="px-3 py-2.5 text-center font-medium text-slate-500 text-xs min-w-[70px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {analysts.map((q, i) => {
                const entryMap = Object.fromEntries((q.techniqueEntries ?? []).map(e => [e.techniqueId, e]))
                const qualifiedCount = techniques.filter(t => cellStatus(entryMap[t.id]) !== 'NONE').length

                return (
                  <tr key={q.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                    <td className="px-4 py-2 sticky left-0 bg-white z-10 font-medium text-slate-700 border-r border-slate-100">
                      {q.analystName}
                    </td>
                    {techniques.map(t => (
                      <td key={t.id} className="px-2 py-2 text-center border-r border-slate-50 last:border-0">
                        <QCell entry={entryMap[t.id]} qualificationId={q.id} techniqueId={t.id} />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <Tag color={qualifiedCount === techniques.length ? 'green' : qualifiedCount > 0 ? 'gold' : 'default'}
                        className="text-xs font-semibold">
                        {qualifiedCount}/{techniques.length}
                      </Tag>
                    </td>
                    {canManage && (
                      <td className="px-2 py-2 text-center">
                        <Button size="small" icon={<Edit3 size={12} />} onClick={() => openEdit(q)}>Edit</Button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit qualification modal */}
      <Modal
        {...glassModalProps}
        title={editingQ ? `Edit Qualifications — ${editingQ.analystName}` : ''}
        open={!!editingQ}
        onCancel={() => setEditingQ(null)}
        onOk={() => editForm.validateFields().then(handleSave)}
        confirmLoading={saveMut.isPending}
        width={600}
        okText="Save"
      >
        <p className="text-xs text-slate-400 mb-4">
          Set start and end dates for each technique. Leave blank to remove qualification.
        </p>
        <Form form={editForm} layout="vertical">
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {(data?.techniques ?? []).filter(t => t.active).map(t => (
              <div key={t.id} className="border border-slate-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{t.code}</span>
                  {' '}{t.name}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Form.Item name={[t.id, 'startDate']} label="Start Date" className="mb-0">
                    <DatePicker format="YYYY-MM-DD" className="w-full" />
                  </Form.Item>
                  <Form.Item name={[t.id, 'endDate']} label="Expiry Date" className="mb-0">
                    <DatePicker format="YYYY-MM-DD" className="w-full" />
                  </Form.Item>
                </div>
              </div>
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
