import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BASE_URL } from '../api/client'

/**
 * Opens a Server-Sent Events connection to /api/sse/events and invalidates
 * React Query caches when the server pushes state-change events.
 *
 * JWT is passed as a query param because the browser's native EventSource
 * API cannot send custom headers. The connection is only opened when a token
 * is present in localStorage, and is automatically cleaned up on unmount.
 *
 * Wire this up once at the root of the ARD shell so it's active for the
 * whole user session.
 */
export function useSSE() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    // BASE_URL, not VITE_API_URL: the build-time env var is baked into the
    // bundle, so an intranet deployment would point every browser at its own
    // localhost. BASE_URL prefers the runtime window.__APP_CONFIG__.API_URL
    // from config.js, which is what makes the server address editable without
    // a rebuild.
    const url = `${BASE_URL}/api/sse/events?token=${encodeURIComponent(token)}`

    let es: EventSource

    try {
      es = new EventSource(url)
    } catch {
      // EventSource not supported or URL invalid — fall back to polling only
      return
    }

    // refresh: invalidate notification badge + notification list
    es.addEventListener('refresh', () => {
      queryClient.invalidateQueries({ queryKey: ['header-notifications-count'] })
      queryClient.invalidateQueries({ queryKey: ['ard-notifications'] })
    })

    // atrs: invalidate ATR list views
    es.addEventListener('atrs', () => {
      queryClient.invalidateQueries({ queryKey: ['ard-atrs'] })
    })

    // experiments: invalidate experiment list views
    es.addEventListener('experiments', () => {
      queryClient.invalidateQueries({ queryKey: ['ard-experiments'] })
    })

    return () => {
      es.close()
    }
  }, [queryClient])
}
