export const BASE_URL =
  (typeof window !== 'undefined' && (window as { __APP_CONFIG__?: { API_URL?: string } }).__APP_CONFIG__?.API_URL) ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json', ...extra })
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    let detail = 'Invalid credentials.'
    try {
      const body = await res.clone().json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch { /* keep default */ }

    const lowerDetail = detail.toLowerCase()
    if (
      lowerDetail.includes('signature') ||
      lowerDetail.includes('password verification') ||
      lowerDetail.includes('invalid password') ||
      lowerDetail.includes('incorrect password') ||
      lowerDetail.includes('password')
    ) {
      throw new ApiError(401, detail)
    }

    const hadToken = !!localStorage.getItem('access_token')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    if (hadToken) {
      // Session expired — redirect to login.
      window.location.href = '/login'
    }
    throw new ApiError(401, detail)
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body.detail)) {
        // FastAPI/Pydantic 422 validation errors arrive as [{ loc, msg, ... }].
        // Flatten to the human-readable messages (stripping the "Value error,"
        // prefix Pydantic adds) instead of dumping raw JSON at the user.
        detail =
          body.detail
            .map((e: { msg?: string }) => (e?.msg ?? '').replace(/^Value error,\s*/, ''))
            .filter(Boolean)
            .join('; ') || `HTTP ${res.status}`
      } else if (body.detail != null) {
        detail = JSON.stringify(body.detail)
      }
    } catch {
      // non-JSON error body — keep the default detail
    }
    throw new ApiError(res.status, detail)
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Core request helpers ─────────────────────────────────────

export async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(BASE_URL + path)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(url.toString(), { method: 'GET', headers: buildHeaders() })
  return parseResponse<T>(res)
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: buildHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return parseResponse<T>(res)
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })
  return parseResponse<T>(res)
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: 'PUT',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })
  return parseResponse<T>(res)
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path, { method: 'DELETE', headers: buildHeaders() })
  return parseResponse<T>(res)
}

// Binary download — returns a Blob (for file save)
export async function apiDownloadBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = getToken()
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(BASE_URL + path, { method: 'GET', headers })
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorised')
  }
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }
  const cd = res.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="?([^";\n]+)"?/)
  const filename = match ? match[1] : 'download'
  const blob = await res.blob()
  return { blob, filename }
}

// Multipart (file uploads) — no Content-Type header; browser sets boundary automatically
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(BASE_URL + path, { method: 'POST', headers, body: formData })
  return parseResponse<T>(res)
}
