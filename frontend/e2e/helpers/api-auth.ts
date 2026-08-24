import type { Page } from '@playwright/test'

export const API_BASE = process.env.ELN3_API_BASE ?? 'http://localhost:8000/api'

export const ADMIN_CREDS = { username: 'superadmin', password: 'Password@123' }

export const ROLE_CREDS: Record<string, { username: string; password: string }> = {
  admin:   ADMIN_CREDS,
  analyst: { username: 'eln3_analyst', password: 'TestPass@123' },
  tl:      { username: 'eln3_tl',      password: 'TestPass@123' },
  qa:      { username: 'eln3_qa',      password: 'TestPass@123' },
  hod:     { username: 'eln3_hod',     password: 'TestPass@123' },
}

export interface AuthSession {
  access_token: string
  refresh_token?: string
}

export async function apiLogin(
  username = ADMIN_CREDS.username,
  password = ADMIN_CREDS.password,
): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${username} (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function seedAuthStorage(page: Page, token: string): Promise<void> {
  await page.addInitScript((tok: string) => {
    localStorage.setItem('access_token', tok)
  }, token)
}

// Module-level token cache — refreshed once per worker process
let _adminToken: string | null = null

export async function getAdminToken(): Promise<string> {
  if (!_adminToken) {
    const session = await apiLogin()
    _adminToken = session.access_token
  }
  return _adminToken
}
