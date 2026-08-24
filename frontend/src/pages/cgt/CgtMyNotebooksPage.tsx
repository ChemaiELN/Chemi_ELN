import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input, Modal, Tag } from 'antd'
import { Search, ChevronRight, FlaskConical } from 'lucide-react'
import dayjs from 'dayjs'
import { cgtNotebookApi, cgtExperimentApi, type CgtNotebook, type CgtExperiment } from '../../api/cgt'
import { glassModalProps } from '../../utils/modalStyles'
import BrandSpinner from '../../components/ui/BrandSpinner'
import bookCloseSvg from '../../assets/book close.svg'
import bookOpenSvg from '../../assets/book open.svg'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green', REJECTED: 'red',
}

const TILE_BG = 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)'
const TILE_BG_HOVER = 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)'

function NotebookTile({ notebook, onClick }: { notebook: CgtNotebook; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer border-0 outline-none"
      style={{ background: hovered ? TILE_BG_HOVER : TILE_BG, minHeight: 140, boxShadow: hovered ? '0 8px 24px rgba(167,139,250,0.5)' : '0 2px 8px rgba(221,214,254,0.4)' }}
    >
      <img
        src={hovered ? bookOpenSvg : bookCloseSvg}
        alt="notebook"
        className="object-contain drop-shadow transition-all duration-200"
        style={{ width: hovered ? 64 : 56, height: hovered ? 64 : 56, filter: 'brightness(0) invert(1)' }}
      />
      <div className="w-full">
        <p className="text-violet-800 font-bold text-xs leading-tight truncate">{notebook.code}</p>
        <p className="text-violet-600/80 text-[11px] mt-0.5 truncate">{notebook.title}</p>
      </div>
    </button>
  )
}

function ExperimentsModal({
  notebook,
  onClose,
}: {
  notebook: CgtNotebook | null
  onClose: () => void
}) {
  const navigate = useNavigate()

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['cgt-nb-experiments', notebook?.id],
    queryFn:  () => cgtExperimentApi.listForNotebook(notebook!.id),
    enabled:  !!notebook,
  })

  return (
    <Modal
      open={!!notebook}
      onCancel={onClose}
      footer={null}
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md shadow-violet-500/30 shrink-0">
            <img src={bookOpenSvg} alt="" className="w-5 h-5" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-800 leading-tight">{notebook?.code}</p>
            <p className="text-xs text-slate-400 font-normal leading-tight mt-0.5">{notebook?.title}</p>
          </div>
        </div>
      }
      width={580}
      centered
      destroyOnHidden
      {...glassModalProps}
    >
      {isLoading ? (
        <div className="py-12">
          <BrandSpinner fullScreen={false} label="Loading experiments…" />
        </div>
      ) : experiments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FlaskConical size={22} className="text-slate-300" />
          </div>
          <p className="text-[13px]">No experiments in this notebook yet.</p>
        </div>
      ) : (
        <div className="space-y-1 pb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {experiments.length} Experiment{experiments.length !== 1 ? 's' : ''}
          </p>
          {experiments.map((exp: CgtExperiment) => (
            <button
              key={exp.id}
              onClick={() => {
                navigate(`/cgt/projects/${notebook!.cgt_project_id}/notebooks/${notebook!.id}/experiments/${exp.id}`)
                onClose()
              }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-violet-50/70 active:bg-violet-100/70 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <FlaskConical size={13} className="text-violet-500" />
                </div>
                <div className="text-left min-w-0">
                  <p className=" text-[12px] font-semibold text-slate-700 leading-tight">{exp.full_code}</p>
                  <p className="text-[12px] text-slate-500 truncate leading-tight mt-0.5">{exp.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Tag color={STATUS_COLOR[exp.status] ?? 'default'} className="text-[11px] m-0 leading-none">
                  {exp.status}
                </Tag>
                <span className="text-[11px] text-slate-400 hidden sm:inline">{dayjs(exp.created_at).format('DD MMM YYYY')}</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// Landing page for CGT chemists/analysts — mirrors ADC's ChemistNotebooksPage:
// only notebooks explicitly assigned to them (server-enforced via
// assigned_to_me, not just a nav-hiding convention).
export default function CgtMyNotebooksPage() {
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<CgtNotebook | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cgt-my-notebooks', search],
    queryFn:  () => cgtNotebookApi.listAll({
      search:         search || undefined,
      assigned_to_me: true,
      limit:          200,
    }),
  })

  const notebooks = data?.items ?? []
  const total     = data?.total ?? 0

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">My Notebooks</h1>
          <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2.5 py-0.5 rounded-full">
            {total}
          </span>
        </div>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          placeholder="Search notebooks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13 gap-3 lg:gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse bg-slate-200" style={{ minHeight: 140 }} />
          ))}
        </div>
      ) : notebooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <img src={bookCloseSvg} alt="no notebooks" className="w-14 h-14 opacity-20 mb-4"
            style={{ filter: 'brightness(0) saturate(0)' }} />
          <p className="text-sm font-medium">No notebooks assigned to you yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13 gap-3 lg:gap-4">
          {notebooks.map(nb => (
            <NotebookTile key={nb.id} notebook={nb} onClick={() => setSelected(nb)} />
          ))}
        </div>
      )}

      <ExperimentsModal notebook={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
