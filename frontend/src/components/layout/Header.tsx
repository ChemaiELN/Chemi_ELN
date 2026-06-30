import { Menu as MenuIcon, ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}
interface HeaderProps {
  onToggle: () => void
  isMobile?: boolean
  breadcrumbs?: BreadcrumbItem[]
}

export default function Header({ onToggle, isMobile = false, breadcrumbs = [] }: HeaderProps) {
  return (
    <header className="flex items-center gap-3 px-4 shrink-0 pt-[10px]" style={{ height: 36 }}>
      {isMobile && (
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-violet-600 hover:bg-white/60 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <MenuIcon size={17} />
        </button>
      )}

      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm min-w-0 flex-1">
          {breadcrumbs.map((bc, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
              <span
                className={
                  i === breadcrumbs.length - 1
                    ? 'text-violet-700 font-semibold truncate'
                    : 'text-slate-400 truncate hidden sm:block'
                }
              >
                {bc.label}
              </span>
            </span>
          ))}
        </nav>
      )}

      <div className="ml-auto" />
    </header>
  )
}
