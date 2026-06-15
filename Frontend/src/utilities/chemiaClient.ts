/**
 * Axios client pre-configured for the Chemia API (port 8002).
 * - Attaches Bearer token on every request
 * - On 401: attempts a silent token refresh (rotate), then retries once
 * - On refresh failure: clears session and redirects to /login
 */
import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'

export const CHEMIA_BASE = import.meta.env.VITE_CHEMIA_API_URL ?? 'http://localhost:8000'

const chemiaClient = axios.create({
  baseURL: CHEMIA_BASE,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ──────────────────────────────────
chemiaClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

// ── Response interceptor: silent refresh on 401 ───────────────────────────────
let _refreshing = false
let _refreshQueue: Array<(token: string) => void> = []

function _flushQueue(newToken: string) {
  _refreshQueue.forEach((cb) => cb(newToken))
  _refreshQueue = []
}

function _clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('chemia_user')
  window.location.href = '/login'
}

chemiaClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as AxiosRequestConfig & { _retry?: boolean }

    // ── 401 handling ──────────────────────────────────────────────────────────
    if (err?.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')

      // No refresh token → go straight to login
      if (!refreshToken) {
        _clearSession()
        return Promise.reject(new Error('Session expired'))
      }

      // Already refreshing: queue this request until refresh completes
      if (_refreshing) {
        return new Promise((resolve) => {
          _refreshQueue.push((token) => {
            original.headers = { ...(original.headers ?? {}), Authorization: 'Bearer ' + token }
            resolve(chemiaClient(original))
          })
        })
      }

      // Start refresh
      _refreshing = true
      try {
        const { data } = await axios.post(
          `${CHEMIA_BASE}/api/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        )
        const newAccess: string = data.access_token
        const newRefresh: string = data.refresh_token
        localStorage.setItem('access_token', newAccess)
        localStorage.setItem('refresh_token', newRefresh)
        _flushQueue(newAccess)
        original.headers = { ...(original.headers ?? {}), Authorization: 'Bearer ' + newAccess }
        return chemiaClient(original)
      } catch {
        _clearSession()
        return Promise.reject(new Error('Session expired'))
      } finally {
        _refreshing = false
      }
    }

    // ── Other errors: extract detail message ──────────────────────────────────
    // FastAPI validation errors return detail as an array of {loc,msg,type} objects
    const raw = err?.response?.data?.detail
    const detailStr: string | undefined = Array.isArray(raw)
      ? raw.map((e: { msg?: string; loc?: string[] }) =>
          [e.loc?.slice(-1)[0], e.msg].filter(Boolean).join(': ')
        ).join('; ')
      : (typeof raw === 'string' ? raw : undefined)

    const message: string =
      detailStr ??
      (err?.response?.data?.message as string | undefined) ??
      (err?.message as string | undefined) ??
      'Unexpected error'
    return Promise.reject(new Error(message))
  },
)

export default chemiaClient
