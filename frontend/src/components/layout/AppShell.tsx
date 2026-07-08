import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Drawer, Grid } from 'antd'
import { ChevronLeft } from 'lucide-react'
import { useAppSelector, useAppDispatch } from '../../store'
import { selectIsAuthenticated, setAuth } from '../../store/authSlice'
import { setPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { isSuperAdmin, resolveGrants } from '../../utils/privileges'
import AdminSidebar from './AdminSidebar'
import Header from './Header'

function useBreadcrumbs() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    href: '/' + segments.slice(0, i + 1).join('/'),
  }))
}

const { useBreakpoint } = Grid

export default function AppShell() {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const breadcrumbs = useBreadcrumbs()
  const screens = useBreakpoint()

  const isMobile = !screens.md
  const isTablet = screens.md && !screens.lg

  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (isTablet) setCollapsed(true)
    else if (screens.lg) setCollapsed(false)
  }, [isTablet, screens.lg])

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token || !isAuthenticated) return
    authApi.me().then((me) => {
      dispatch(setAuth({ user: me, accessToken: token }))
      dispatch(setPrivileges({ keys: resolveGrants(me), isQA: isSuperAdmin(me) }))
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggle = () => {
    if (isMobile) setDrawerOpen((o) => !o)
    else setCollapsed((c) => !c)
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden">

      {/* Background */}
      <div className="fixed inset-0 -z-20 bg-gradient-to-br from-purple-100 via-purple-50 to-indigo-100" />
      <div className="fixed top-[-100px] left-[-100px] -z-10 w-[500px] h-[500px] bg-purple-200/50 rounded-full blur-3xl animate-blob" />
      <div className="fixed top-10 right-[-80px] -z-10 w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="fixed bottom-[-80px] left-1/2 -z-10 w-[450px] h-[450px] bg-indigo-200/40 rounded-full blur-3xl animate-blob animation-delay-4000" />

      {/* Desktop/Tablet Sidebar */}
      {!isMobile && (
        <>
          <AdminSidebar collapsed={collapsed} />
          {/* Edge toggle button — half inside, half outside the sidebar */}
          <button
            onClick={handleToggle}
            style={{ left: collapsed ? 52 : 212 }}
            className="absolute top-[62px] z-50 w-6 h-6 rounded-full bg-white/95 border border-purple-200 shadow-md shadow-purple-200/40 flex items-center justify-center text-purple-500 hover:bg-purple-50 hover:border-purple-400 transition-all duration-200"
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
            wrapper: { width: 224, boxShadow: '4px 0 24px rgba(124,58,237,0.15)' },
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-100/90 via-purple-50/80 to-indigo-100/90 backdrop-blur-2xl" />
          <div className="relative h-full">
            <AdminSidebar collapsed={false} onItemClick={() => setDrawerOpen(false)} />
          </div>
        </Drawer>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header onToggle={handleToggle} isMobile={isMobile} breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
