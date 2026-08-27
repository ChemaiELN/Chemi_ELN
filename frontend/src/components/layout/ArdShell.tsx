import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Drawer, Grid } from 'antd'
import { ChevronLeft } from 'lucide-react'
import { useAppSelector } from '../../store'
import { selectIsAuthenticated } from '../../store/authSlice'
import ArdSidebar from './ArdSidebar'
import Header from './Header'
import { useSSE } from '../../hooks/useSSE'

export interface BreadcrumbItem { label: string; href: string }

// Context that lets child pages override the display label for a path segment,
// and inject extra crumbs the flat URL can't express on its own — e.g. ARD's
// notebook/experiment routes are flat (/ard/notebooks/:id,
// /ard/experiments/:id, not nested under their project/notebook), so a page
// reached via Project → Notebook → Experiment would otherwise only ever show
// its own single segment, with no way back to the project or notebook it
// actually came from.
interface BreadcrumbCtx {
  setLabel: (segment: string, label: string) => void
  setPrefixCrumbs: (crumbs: BreadcrumbItem[] | null) => void
}
export const BreadcrumbContext = createContext<BreadcrumbCtx>({ setLabel: () => {}, setPrefixCrumbs: () => {} })
export function useBreadcrumbLabel(segment: string, label: string | null | undefined) {
  const { setLabel } = useContext(BreadcrumbContext)
  useEffect(() => {
    if (segment && label) setLabel(segment, label)
  }, [segment, label, setLabel])
}
// Inserts `crumbs` right after the leading "ARD" crumb, e.g. on the notebook
// workspace: ARD > [Projects, ProjectName] > Notebooks > NotebookName.
// Pass null/empty (or just navigate away) to fall back to the plain
// URL-derived trail — the effect clears its own registration on unmount so
// leaving the page never leaves a stale trail behind for the next one.
export function useBreadcrumbPrefix(crumbs: BreadcrumbItem[] | null) {
  const { setPrefixCrumbs } = useContext(BreadcrumbContext)
  const key = crumbs ? JSON.stringify(crumbs) : null
  useEffect(() => {
    setPrefixCrumbs(crumbs && crumbs.length ? crumbs : null)
    return () => setPrefixCrumbs(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setPrefixCrumbs])
}

const STATIC_LABELS: Record<string, string> = {
  ard: 'ARD',
}

function useBreadcrumbs(overrides: Record<string, string>) {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: overrides[seg] ?? STATIC_LABELS[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))
}

const { useBreakpoint } = Grid

export default function ArdShell() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({})
  const setLabel = useCallback((segment: string, label: string) => {
    setLabelOverrides(prev => prev[segment] === label ? prev : { ...prev, [segment]: label })
  }, [])
  const [prefixCrumbs, setPrefixCrumbs] = useState<BreadcrumbItem[] | null>(null)
  const urlBreadcrumbs = useBreadcrumbs(labelOverrides)
  // Splice the extra crumbs in right after the leading "ARD" entry.
  const breadcrumbs = prefixCrumbs
    ? [urlBreadcrumbs[0], ...prefixCrumbs, ...urlBreadcrumbs.slice(1)]
    : urlBreadcrumbs
  const screens = useBreakpoint()

  // SSE: real-time push notifications for the whole ARD session
  useSSE()

  const isMobile = !screens.md
  const isTablet = screens.md && !screens.lg

  // Start collapsed; the user expands manually via the edge toggle.
  const [collapsed, setCollapsed]   = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (isTablet) setCollapsed(true)
  }, [isTablet])

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  if (!isAuthenticated) return null

  const handleToggle = () => {
    if (isMobile) setDrawerOpen(o => !o)
    else setCollapsed(c => !c)
  }

  return (
    <div className="module-surface relative h-screen flex overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: '#f4f4f8' }} />

      {/* Desktop/Tablet Sidebar */}
      {!isMobile && (
        <>
          <ArdSidebar collapsed={collapsed} />
          <button
            onClick={handleToggle}
            style={{ left: collapsed ? 52 : 212, top: 50 }}
            className="absolute top-[62px] z-50 w-6 h-6 rounded-full bg-white/95 border border-violet-200 shadow-md shadow-violet-200/40 flex items-center justify-center text-violet-500 hover:bg-violet-50 hover:border-violet-400 transition-all duration-200"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={12} className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          styles={{
            body: { padding: 0, background: 'transparent' },
            section: { width: 224 },
            wrapper: { width: 224, boxShadow: '4px 0 24px rgba(139,92,246,0.15)' },
          }}
        >
          <div className="absolute inset-0 backdrop-blur-2xl" style={{ backgroundColor: '#f4f4f8' }} />
          <div className="relative h-full">
            <ArdSidebar collapsed={false} onItemClick={() => setDrawerOpen(false)} />
          </div>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header onToggle={handleToggle} isMobile={isMobile} breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <BreadcrumbContext.Provider value={{ setLabel, setPrefixCrumbs }}>
            <Outlet />
          </BreadcrumbContext.Provider>
        </main>
      </div>
    </div>
  )
}
