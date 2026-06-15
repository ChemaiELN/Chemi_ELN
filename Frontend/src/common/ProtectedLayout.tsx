import { Outlet, useLocation } from 'react-router-dom'
import RequireAuth from './RequireAuth'
import RequireRouteAccess from './RequireRouteAccess'

export default function ProtectedLayout() {
  const { pathname } = useLocation()

  return (
    <RequireAuth>
      <RequireRouteAccess pathname={pathname}>
        <Outlet />
      </RequireRouteAccess>
    </RequireAuth>
  )
}
