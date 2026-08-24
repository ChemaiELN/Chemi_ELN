/**
 * Playwright global setup — runs once before the test suite.
 *
 * Logs in as admin via the API and saves the token so worker-level caches
 * can be pre-warmed. Also creates any role-specific test users that don't
 * exist yet (non-fatal if the role user already exists).
 */
import { apiLogin, API_BASE } from './helpers/api-auth'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import * as path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

export default async function globalSetup() {
  // Admin login — required; throw if backend is unreachable
  const session = await apiLogin()

  // Persist admin token to disk so fixtures in all workers can reuse it
  // without each worker making a login request.
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  fs.writeFileSync(
    path.join(authDir, 'admin-session.json'),
    JSON.stringify({ access_token: session.access_token }),
    'utf-8',
  )

  console.log('[E2E setup] Admin session saved.')

  // Optionally seed role-specific test users (silently skipped if they exist)
  await ensureRoleUsers(session.access_token)
}

async function ensureRoleUsers(adminToken: string) {
  const roleMap: Record<string, { roleCode: string; displayName: string }> = {
    eln3_analyst: { roleCode: 'ARD_ANALYST',    displayName: 'E2E Analyst' },
    eln3_tl:      { roleCode: 'ARD_TL',         displayName: 'E2E Team Lead' },
    eln3_qa:      { roleCode: 'ARD_QA_ANALYST', displayName: 'E2E QA Analyst' },
    eln3_hod:     { roleCode: 'ARD_HOD',        displayName: 'E2E HOD' },
  }

  for (const [username, { roleCode, displayName }] of Object.entries(roleMap)) {
    try {
      // Check if the user already exists
      const checkRes = await fetch(`${API_BASE}/users?search=${username}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!checkRes.ok) continue
      const users = await checkRes.json()
      const exists = (Array.isArray(users) ? users : users.items ?? []).some(
        (u: any) => u.username === username,
      )
      if (exists) continue

      // Create the user
      await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email: `${username}@e2e.test`,
          displayName,
          password: 'TestPass@123',
          role_code: roleCode,
          is_active: true,
        }),
      })
      console.log(`[E2E setup] Created test user: ${username} (${roleCode})`)
    } catch {
      // Non-fatal — role users are optional for most tests
    }
  }
}
