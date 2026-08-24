import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Input, Modal, Tag, Pagination } from 'antd'
import { Search, ChevronRight, FlaskConical } from 'lucide-react'
import dayjs from 'dayjs'
import { notebookApi, experimentApi, type Notebook, type Experiment } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import bookCloseSvg from '../../assets/book close.svg'
import bookOpenSvg from '../../assets/book open.svg'
import BrandSpinner from '../../components/ui/BrandSpinner'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', SUBMITTED: 'blue', APPROVED: 'green',
  REJECTED: 'red', LOCKED: 'purple',
}

// Light soft gradient tile
const TILE_BG = 'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)'
const TILE_BG_HOVER = 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)'

function NotebookTile({ notebook, onClick }: { notebook: Notebook; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer border-0 outline-none"
      style={{ background: hovered ? TILE_BG_HOVER : TILE_BG, minHeight: 140, boxShadow: hovered ? '0 8px 24px rgba(165,180,252,0.5)' : '0 2px 8px rgba(199,210,254,0.4)' }}
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
  notebook: Notebook | null
  onClose: () => void
}) {
  const navigate = useNavigate()

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ['nb-experiments', notebook?.id],
    queryFn:  () => experimentApi.listForNotebook(notebook!.id),
    enabled:  !!notebook,
  })

  return (
    <Modal
      open={!!notebook}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      closable={false}
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
        <div className="py-6"><BrandSpinner fullScreen={false} size={64} label="Loading experiments…" /></div>
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
          {experiments.map((exp: Experiment) => (
            <button
              key={exp.id}
              onClick={() => { navigate(`/notebooks/${notebook!.id}/experiments/${exp.id}`); onClose() }}
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

const PAGE_SIZE = 44

export default function ChemistNotebooksPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [page, setPage]               = useState(1)
  const [selected, setSelected]       = useState<Notebook | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])
  useEffect(() => { setPage(1) }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['my-notebooks', page, search],
    queryFn:  () => notebookApi.listAll({
      search:         search || undefined,
      assigned_to_me: true,
      page,
      limit:          PAGE_SIZE,
    }),
  })

  const notebooks = data?.items ?? []
  const total     = data?.total ?? 0

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
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
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
      </div>

      {/* Grid */}
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
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13 gap-3 lg:gap-4">
            {notebooks.map(nb => (
              <NotebookTile key={nb.id} notebook={nb} onClick={() => setSelected(nb)} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-center mt-8">
              <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} showSizeChanger={false} />
            </div>
          )}
        </>
      )}

      {/* Experiments modal */}
      <ExperimentsModal notebook={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
