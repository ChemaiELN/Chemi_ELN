/**
 * ATR full lifecycle — API-level test that drives every state transition
 * and verifies business rules. Mirrors the Angular ARD's
 * AdAtrController + AdTestController flows.
 *
 * Serial: each step depends on the previous one's state.
 */
import { test, expect, stamp, waitForNetworkSettle } from './helpers/fixtures'

test.describe.serial('ATR + Test full lifecycle', () => {
  let atrId: string
  let sampleId: string
  let testId: string
  const s = stamp()

  // ── Seed master data + ATR ────────────────────────────────────────────────
  test('seed: create ATR with sample and test', async ({ api }) => {
    const tech   = await api.createTechnique(s)
    const config = await api.createTestConfig(tech.id, s)

    const atr    = await api.createAtr(s)
    atrId        = atr.id

    const saved  = await api.addAtrSample(atrId, s)
    sampleId     = saved.samples[0].id

    const added  = await api.addTestToSample(atrId, sampleId, [config.id])
    testId       = added.created[0].id

    expect(atr.status).toBe('DRAFT')
  })

  // ── Electronic signature verify endpoint ─────────────────────────────────
  test('verify-password: wrong password returns 401', async ({ api }) => {
    const res = await fetch(`http://localhost:8000/api/auth/verify-password`, {
      method: 'POST',
      headers: { ...api.headers },
      body: JSON.stringify({ password: 'WrongPassword!' }),
    })
    expect(res.status).toBe(401)
  })

  test('verify-password: correct password returns verified:true', async ({ api }) => {
    const result = await api.verifyPassword()
    expect(result.verified).toBe(true)
    expect(result.username).toBe('superadmin')
  })

  // ── ATR status machine ────────────────────────────────────────────────────
  test('ATR is in DRAFT or SAVED after adding samples', async ({ api }) => {
    const atr = await api.get<any>(`/ard/atrs/${atrId}`)
    // Adding samples via PUT auto-advances DRAFT → SAVED
    expect(['DRAFT', 'SAVED']).toContain(atr.status)
  })

  test('transition to NEW (submit for analysis, requires e-sign)', async ({ api }) => {
    const result = await api.transitionAtr(atrId, 'NEW')
    expect(result.status).toBe('NEW')
  })

  // ── Test execution ────────────────────────────────────────────────────────
  test('test starts as PENDING', async ({ api }) => {
    const atr = await api.get<any>(`/ard/atrs/${atrId}`)
    const sample = atr.samples.find((s: any) => s.id === sampleId)
    const tst = sample.tests.find((t: any) => t.id === testId)
    expect(tst.status).toBe('PENDING')
  })

  test('start test → IN_PROGRESS', async ({ api }) => {
    const result = await api.startTest(atrId, testId)
    expect(result.status).toBe('IN_PROGRESS')
  })

  test('save-results retains IN_PROGRESS', async ({ api }) => {
    const result = await api.saveTestResults(atrId, testId, 98.7, 'E2E lifecycle')
    expect(result.status).toBe('IN_PROGRESS')
  })

  test('submit test → VERIFICATION_REQUESTED', async ({ api }) => {
    const result = await api.submitTest(atrId, testId)
    expect(result.status).toBe('VERIFICATION_REQUESTED')
  })

  test('verify test → VERIFIED', async ({ api }) => {
    const result = await api.verifyTest(atrId, testId)
    expect(result.status).toBe('VERIFIED')
  })

  // ── ATR UI verification ───────────────────────────────────────────────────
  test('ATR workspace shows updated status after lifecycle', async ({ ardPage }) => {
    await ardPage.goto(`/ard/atrs/${atrId}`)
    await waitForNetworkSettle(ardPage)

    // ATR code should be visible in the workspace
    await expect(ardPage.getByText(`E2E-ATR-${s}`).first()).toBeVisible({ timeout: 10_000 })

    // Status chip or tag
    const statusChip = ardPage.locator('.ant-tag, .ant-badge, [class*="status"]').filter({ hasText: /NEW|IN/i }).first()
    await expect(statusChip).toBeVisible({ timeout: 5_000 })
  })

  test('ATR history tab shows transition events', async ({ ardPage }) => {
    await ardPage.goto(`/ard/atrs/${atrId}`)
    await waitForNetworkSettle(ardPage)

    const historyTab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Audit|History/i }).first()
    if (await historyTab.isVisible()) {
      await historyTab.click()
      await ardPage.waitForTimeout(500)
      // Should show at least the DRAFT → NEW transition
      await expect(ardPage.getByText(/DRAFT|NEW/i).first()).toBeVisible({ timeout: 5_000 })
    }
  })
})

test.describe('ATR list filtering', () => {
  test('status filter chips are present on ATR list', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs')
    await waitForNetworkSettle(ardPage)

    // ATR list uses Tabs for filtering (All, QA Pre-Approval, In Lab, etc.)
    const filterArea = ardPage.locator('.ant-tabs').first()
    await expect(filterArea).toBeVisible({ timeout: 10_000 })
  })
})
