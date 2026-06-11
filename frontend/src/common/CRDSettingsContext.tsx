/**
 * CRDSettingsContext — loads CRD settings once at app start (after login)
 * and makes them available to any component via useCRDSettings().
 *
 * The Provider should wrap the router so all pages benefit from a single fetch.
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { getCRDSettings, type CRDSettings } from '@/utilities/chemiaApi'

interface CRDSettingsContextValue {
  settings: CRDSettings | null
  loading: boolean
  /** Reload settings (e.g. after the admin saves changes on the Settings page) */
  refresh: () => void
}

const CRDSettingsContext = createContext<CRDSettingsContextValue>({
  settings: null,
  loading:  false,
  refresh:  () => undefined,
})

export function CRDSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CRDSettings | null>(null)
  const [loading,  setLoading]  = useState(false)

  const load = () => {
    // Only fetch when an access token is present (user is logged in)
    const token = localStorage.getItem('access_token')
    if (!token) return

    setLoading(true)
    getCRDSettings()
      .then(s  => setSettings(s))
      .catch(() => { /* non-fatal — the app works without CRD settings */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // Re-fetch whenever the user logs in (token written to localStorage)
    const handler = () => load()
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CRDSettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </CRDSettingsContext.Provider>
  )
}

/** Returns the current CRD settings (null while loading or if not yet fetched). */
export function useCRDSettings(): CRDSettings | null {
  return useContext(CRDSettingsContext).settings
}

/** Returns a callback that re-fetches CRD settings from the server. */
export function useCRDSettingsRefresh(): () => void {
  return useContext(CRDSettingsContext).refresh
}

export default CRDSettingsContext
