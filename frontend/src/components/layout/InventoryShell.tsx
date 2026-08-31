import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Drawer, Grid } from 'antd'
import { ChevronLeft } from 'lucide-react'
import { useAppSelector } from '../../store'
import { selectIsAuthenticated } from '../../store/authSlice'
import { selectBreadcrumbLabelFor } from '../../store/uiSlice'
import Sidebar from './Sidebar'
import Header from './Header'
import { ErrorBoundary } from '../ErrorBoundary'

function useBreadcrumbs() {
  const { pathname } = useLocation()
  const overrideLabel = useAppSelector(selectBreadcrumbLabelFor(pathname))
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => {
    const isLast = i === segments.length - 1
    return {
      label: isLast && overrideLabel
        ? overrideLabel
        : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: '/' + segments.slice(0, i + 1).join('/'),
    }
  })
}

// A render error on one Inventory page used to unmount the whole shell —
// sidebar, header, everything — down to a blank white screen with no visible
// message (only a console.error), because nothing between the router and
// individual pages ever caught a thrown render error. Keying by pathname
// resets the boundary automatically when the user navigates to a different
// page instead of it staying stuck in its errored state.
function RouteErrorBoundary() {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary key={pathname} fallbackMessage="This page failed to load.">
      <Outlet />
    </ErrorBoundary>
  )
}

const { useBreakpoint } = Grid

export default function InventoryShell() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const breadcrumbs = useBreadcrumbs()
  const screens = useBreakpoint()

  const isMobile = !screens.md
  const isTablet = screens.md && !screens.lg

  // Start collapsed; the user expands manually via the edge toggle.
  const [collapsed, setCollapsed] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (isTablet) setCollapsed(true)
  }, [isTablet])

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  const handleToggle = () => {
    if (isMobile) setDrawerOpen(o => !o)
    else setCollapsed(c => !c)
  }

  return (
    <div className="module-surface inventory-surface relative h-screen flex overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-20" style={{ backgroundColor: '#f4f4f8' }} />

      {/* Desktop/Tablet Sidebar */}
      {!isMobile && (
        <>
          <Sidebar collapsed={collapsed} />
          <button
            onClick={handleToggle}
            style={{ left: collapsed ? 52 : 212 ,top:50 }}
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
            <Sidebar collapsed={false} onItemClick={() => setDrawerOpen(false)} />
          </div>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header onToggle={handleToggle} isMobile={isMobile} breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <RouteErrorBoundary />
        </main>
      </div>
    </div>
  )
}
