import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  hasAnyAdminPrivilege,
  hasAnyPrivilege,
  hasPrivilege,
  privilegesFromRole,
  readStoredPrivileges,
  type PrivilegeKey,
} from '@/utilities/privileges'
import { getMe, type MeResponse } from '@/utilities/chemiaApi'

interface PrivilegesContextValue {
  user: MeResponse | null
  privileges: Set<string>
  role: string
  has: (key: PrivilegeKey | string) => boolean
  hasAny: (keys: (PrivilegeKey | string)[]) => boolean
  hasAnyAdmin: () => boolean
  refresh: () => Promise<void>
}

const PrivilegesContext = createContext<PrivilegesContextValue | null>(null)

function readUser(): MeResponse | null {
  try {
    const raw = localStorage.getItem('chemia_user')
    return raw ? (JSON.parse(raw) as MeResponse) : null
  } catch {
    return null
  }
}

/** Persist user JSON and notify listeners only when content changes. */
export function notifyUserUpdated(user?: MeResponse) {
  if (user) {
    const next = JSON.stringify(user)
    if (localStorage.getItem('chemia_user') === next) return
    localStorage.setItem('chemia_user', next)
  }
  window.dispatchEvent(new Event('chemia-user-updated'))
}

export function PrivilegesProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(() => readUser())

  useEffect(() => {
    const sync = () => setUser(readUser())
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'chemia_user' || e.key === 'access_token') sync()
    }
    window.addEventListener('chemia-user-updated', sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('chemia-user-updated', sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const privileges = useMemo(() => {
    if (user?.privileges?.length) return new Set(user.privileges)
    if (user?.role) return privilegesFromRole(user.role)
    return readStoredPrivileges()
  }, [user])

  const refresh = useCallback(async () => {
    if (!localStorage.getItem('access_token')) return
    try {
      const me = await getMe()
      const next = JSON.stringify(me)
      if (localStorage.getItem('chemia_user') !== next) {
        notifyUserUpdated(me)
        setUser(me)
      }
    } catch { /* session may have expired */ }
  }, [])

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      void refresh()
    }
  }, [refresh])

  const value = useMemo<PrivilegesContextValue>(() => ({
    user,
    privileges,
    role: user?.role ?? '',
    has: (key) => hasPrivilege(privileges, key),
    hasAny: (keys) => hasAnyPrivilege(privileges, keys),
    hasAnyAdmin: () => hasAnyAdminPrivilege(privileges),
    refresh,
  }), [user, privileges, refresh])

  return (
    <PrivilegesContext.Provider value={value}>
      {children}
    </PrivilegesContext.Provider>
  )
}

export function usePrivileges(): PrivilegesContextValue {
  const ctx = useContext(PrivilegesContext)
  if (!ctx) {
    throw new Error('usePrivileges must be used within PrivilegesProvider')
  }
  return ctx
}
