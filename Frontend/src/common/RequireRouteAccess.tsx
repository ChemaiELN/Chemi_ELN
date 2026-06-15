import { Navigate } from 'react-router-dom'
import { usePrivileges } from './PrivilegesContext'
import { getRouteAccess, type RouteAccessRule } from '@/utilities/routeAccess'

function isAllowed(rule: RouteAccessRule, has: (k: string) => boolean, hasAnyAdmin: () => boolean): boolean {
  if (rule.type === 'auth') return true
  if (rule.type === 'anyAdmin') return hasAnyAdmin()
  if (rule.requireAll) return rule.keys.every(k => has(k))
  return rule.keys.some(k => has(k))
}

interface Props {
  pathname: string
  children: React.ReactNode
}

export default function RequireRouteAccess({ pathname, children }: Props) {
  const { has, hasAnyAdmin } = usePrivileges()
  const rule = getRouteAccess(pathname)

  if (!isAllowed(rule, has, hasAnyAdmin)) {
    return <Navigate to="/dashboard" replace state={{ forbidden: pathname }} />
  }

  return <>{children}</>
}
