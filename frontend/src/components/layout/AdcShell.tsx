import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Drawer, Grid } from 'antd'
import { ChevronLeft } from 'lucide-react'
import { useAppSelector } from '../../store'
import { selectIsAuthenticated, selectUser } from '../../store/authSlice'
import AdcSidebar from './AdcSidebar'
import Header from './Header'

// Context that lets child pages override the display label for a path segment
interface BreadcrumbCtx { setLabel: (segment: string, label: string) => void }
export const BreadcrumbContext = createContext<BreadcrumbCtx>({ setLabel: () => {} })
export function useBreadcrumbLabel(segment: string, label: string | null | undefined) {
  const { setLabel } = useContext(BreadcrumbContext)
  useEffect(() => {
    if (segment && label) setLabel(segment, label)
  }, [segment, label, setLabel])
}

const STATIC_LABELS: Record<string, string> = {
  adc: 'ADC',
  projects: 'Projects',
  'hod-projects': 'All Projects',
  notebooks: 'Notebooks',
  experiments: 'Experiments',
  sections: 'Sections',
  overview: 'Overview',
  reports: 'Reports',
  'my-notebooks': 'Dashboard',
}

function useBreadcrumbs(overrides: Record<string, string>) {
  const { pathname } = useLocation()
  const user = useAppSelector(selectUser)
  const segments = pathname.split('/').filter(Boolean)
  // A CHEM or TL user only lands on a dashboard page (no browsable
  // project/notebook chain from there) — inside a single experiment, collapse
  // the whole breadcrumb trail down to just "Experiment" instead of showing
  // the notebook/experiment chain they'd otherwise have to navigate back through.
  const isChemistOrTl = user?.role_code === 'CHEM' || user?.role_code === 'TL'
  const isExperimentPage = segments[segments.length - 2] === 'experiments'
  if (isChemistOrTl && isExperimentPage) {
    return [{ label: 'Experiment' }]
  }
  return segments.map((seg, i) => ({
    label: overrides[seg] ?? STATIC_LABELS[seg] ?? (seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))
}

const { useBreakpoint } = Grid

export default function AdcShell() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({})
  const setLabel = useCallback((segment: string, label: string) => {
    setLabelOverrides(prev => prev[segment] === label ? prev : { ...prev, [segment]: label })
  }, [])
  const breadcrumbs = useBreadcrumbs(labelOverrides)
  const screens = useBreakpoint()

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
    <div className="module-surface solid-surface relative h-screen flex overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: '#f4f4f8' }} />

      {/* Desktop/Tablet Sidebar */}
      {!isMobile && (
        <>
          <AdcSidebar collapsed={collapsed} />
          <button
            onClick={handleToggle}
            style={{ left: collapsed ? 52 : 212 ,top:50}}
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
            wrapper: { width: 224, boxShadow: '4px 0 24px rgba(59,130,246,0.15)' },
          }}
        >
          <div className="absolute inset-0 backdrop-blur-2xl" style={{ backgroundColor: '#f4f4f8' }} />
          <div className="relative h-full">
            <AdcSidebar collapsed={false} onItemClick={() => setDrawerOpen(false)} />
          </div>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header onToggle={handleToggle} isMobile={isMobile} breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <BreadcrumbContext.Provider value={{ setLabel }}>
            <Outlet />
          </BreadcrumbContext.Provider>
        </main>
      </div>
    </div>
  )
}
