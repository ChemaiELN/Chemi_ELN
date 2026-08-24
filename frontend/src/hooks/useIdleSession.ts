import { useEffect, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../store'
import { clearAuth, setAccessToken, selectAccessToken } from '../store/authSlice'
import { authApi } from '../api/auth'

// Session policy:
//  - Log out after IDLE_LIMIT_MS with no user activity (the "idle timeout").
//  - While the user IS active, silently refresh the short-lived access token
//    before it expires so active work is never interrupted.
// The idle timeout is independent of the backend's ACCESS_TOKEN_EXPIRE_MINUTES;
// refresh bridges the two so the 30-min token expiry no longer forces a logout.
const IDLE_LIMIT_MS = 30 * 60 * 1000   // 30 minutes of inactivity -> logout
const TICK_MS = 30 * 1000              // how often we check idle / expiry
const REFRESH_SKEW_MS = 2 * 60 * 1000  // refresh when <2 min left on the token

// Decode a JWT's `exp` (seconds) into epoch-ms. Returns null if unparseable.
function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    if (!part) return null
    let b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const { exp } = JSON.parse(atob(b64))
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * Idle-timeout + silent-refresh session guard. Mount once near the app root.
 * Depends only on whether a token exists (a boolean), so a refresh that swaps
 * the token value does NOT restart the effect — preserving the idle clock.
 */
export function useIdleSession() {
  const dispatch = useAppDispatch()
  const authed = useAppSelector(selectAccessToken) !== null
  const lastActivity = useRef<number>(Date.now())
  const refreshing = useRef(false)

  useEffect(() => {
    if (!authed) return

    // Reset the idle clock whenever the guard (re)starts, e.g. right after login.
    lastActivity.current = Date.now()

    const markActive = () => { lastActivity.current = Date.now() }
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    const logout = () => {
      authApi.logout().catch(() => {})
      dispatch(clearAuth())
      window.location.href = '/login'
    }

    const refresh = async () => {
      const rt = localStorage.getItem('refresh_token')
      if (!rt || refreshing.current) return
      refreshing.current = true
      try {
        const tokens = await authApi.refresh(rt)
        localStorage.setItem('refresh_token', tokens.refresh_token)
        dispatch(setAccessToken(tokens.access_token))
      } catch {
        // Refresh token expired/invalid -> the session really is over.
        logout()
      } finally {
        refreshing.current = false
      }
    }

    const tick = () => {
      if (Date.now() - lastActivity.current >= IDLE_LIMIT_MS) {
        logout()
        return
      }
      const exp = tokenExpiryMs(localStorage.getItem('access_token'))
      if (exp !== null && exp - Date.now() <= REFRESH_SKEW_MS) {
        void refresh()
      }
    }

    const intervalId = window.setInterval(tick, TICK_MS)
    return () => {
      window.clearInterval(intervalId)
      events.forEach((e) => window.removeEventListener(e, markActive))
    }
  }, [authed, dispatch])
}
