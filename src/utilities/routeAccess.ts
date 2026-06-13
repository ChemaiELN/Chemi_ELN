import { ADMIN_MODULE_PRIVILEGES, PRIV, PROJECT_ACCESS_PRIVILEGES, type PrivilegeKey } from './privileges'

export type RouteAccessRule =
  | { type: 'auth' }
  | { type: 'privilege'; keys: PrivilegeKey[]; requireAll?: boolean }
  | { type: 'anyAdmin' }

/** Most-specific patterns first */
const ROUTE_RULES: { pattern: RegExp; rule: RouteAccessRule }[] = [
  { pattern: /^\/admin\/users(?:\/|$)/,              rule: { type: 'privilege', keys: [PRIV.USERS_MANAGE] } },
  { pattern: /^\/admin\/roles(?:\/|$)/,              rule: { type: 'privilege', keys: [PRIV.USERS_MANAGE] } },
  { pattern: /^\/admin\/departments(?:\/|$)/,        rule: { type: 'privilege', keys: [PRIV.DEPARTMENTS_MANAGE] } },
  { pattern: /^\/admin\/master-data(?:\/|$)/,         rule: { type: 'privilege', keys: [PRIV.MASTER_DATA_MANAGE] } },
  { pattern: /^\/admin\/role-privileges(?:\/|$)/,    rule: { type: 'privilege', keys: [PRIV.ADMIN_ROLE_PRIVS] } },
  { pattern: /^\/admin\/workflow-templates(?:\/|$)/, rule: { type: 'privilege', keys: [PRIV.ADMIN_SETTINGS] } },
  { pattern: /^\/admin(?:\/|$)/,                      rule: { type: 'anyAdmin' } },
  { pattern: /^\/projects\/[^/]+\/routes(?:\/|$)/,   rule: { type: 'privilege', keys: [PRIV.PROJECTS_ROUTES] } },
  { pattern: /^\/projects(?:\/|$)/,                  rule: { type: 'privilege', keys: [...PROJECT_ACCESS_PRIVILEGES] } },
  { pattern: /^\/notebooks\/[^/]+\/permissions(?:\/|$)/, rule: { type: 'privilege', keys: [PRIV.NOTEBOOKS_PERMISSIONS] } },
  { pattern: /^\/atr\/project-atrs(?:\/|$)/,         rule: { type: 'privilege', keys: [PRIV.ATR_ASSIGN] } },
  { pattern: /^\/atr\/pending-clarification(?:\/|$)/, rule: { type: 'privilege', keys: [PRIV.ATR_ASSIGN] } },
]

const AUTH_ONLY_PREFIXES = [
  '/dashboard',
  '/search',
  '/notebooks',
  '/experiments',
  '/atr',
  '/reports',
  '/settings',
  '/inventory',
  '/admin/audit',
]

export function getRouteAccess(pathname: string): RouteAccessRule {
  for (const { pattern, rule } of ROUTE_RULES) {
    if (pattern.test(pathname)) return rule
  }
  if (AUTH_ONLY_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return { type: 'auth' }
  }
  return { type: 'auth' }
}

export { ADMIN_MODULE_PRIVILEGES }
