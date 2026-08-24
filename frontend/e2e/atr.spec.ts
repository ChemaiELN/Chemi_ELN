/**
 * ATR — basic CRUD and UI smoke tests.
 * Deep lifecycle (submit → analyse → verify → approve) is in atr-lifecycle.spec.ts.
 */
import { test, expect, stamp, waitForNetworkSettle, getVisibleModal, dismissModal } from './helpers/fixtures'

test.describe('ATR list page', () => {
  test('shows heading and New ATR button', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Analytical Test Requests|ATRs/i }).first()).toBeVisible()
    await expect(ardPage.getByRole('button', { name: /New ATR/i }).first()).toBeVisible()
  })

  test('table renders with expected columns', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs')
    await waitForNetworkSettle(ardPage)
    const table = ardPage.locator('.ant-table').first()
    await expect(table).toBeVisible()
    // ATR Code and Status columns should be present in the header
    await expect(table.getByText(/Code/i).first()).toBeVisible()
    await expect(table.getByText(/Status/i).first()).toBeVisible()
  })

  test('ATR created via API appears in list', async ({ ardPage, api }) => {
    const s = stamp()
    const atr = await api.createAtr(s)

    await ardPage.goto('/ard/atrs')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByText(atr.code).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('ATR New form', () => {
  test('New ATR button navigates to new-form page', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs')
    await ardPage.getByRole('button', { name: /New ATR/i }).first().click()
    await ardPage.waitForURL(/\/ard\/atrs\/new/, { timeout: 10_000 })
    await expect(ardPage.getByRole('heading', { name: /New Analytical Test Request/i }).first()).toBeVisible()
  })

  test('new ATR form has required fields', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs/new')
    await waitForNetworkSettle(ardPage)

    // Should have project name and project code inputs
    await expect(ardPage.getByLabel(/Project Name|Product Name/i).first()).toBeVisible()
    await expect(ardPage.getByLabel(/Project Code/i).first()).toBeVisible()
  })

  test('submitting empty form shows validation errors', async ({ ardPage }) => {
    await ardPage.goto('/ard/atrs/new')
    await waitForNetworkSettle(ardPage)

    // Find a submit/create button (might say "Create", "Save", or "Submit")
    const btn = ardPage.getByRole('button', { name: /Create ATR|Submit|Save/i }).first()
    if (await btn.isVisible()) {
      await btn.click()
      // Ant Design shows .ant-form-item-explain-error on validation failure
      const errors = ardPage.locator('.ant-form-item-explain-error')
      await expect(errors.first()).toBeVisible({ timeout: 5_000 })
    }
  })
})

test.describe('ATR workspace', () => {
  test('opens workspace for an existing ATR', async ({ ardPage, api }) => {
    const s = stamp()
    const atr = await api.createAtr(s)

    await ardPage.goto(`/ard/atrs/${atr.id}`)
    await waitForNetworkSettle(ardPage)

    // Workspace heading or ATR code should be visible
    await expect(ardPage.getByText(atr.code).first()).toBeVisible({ timeout: 10_000 })
  })

  test('ATR workspace shows Samples tab', async ({ ardPage, api }) => {
    const s = stamp()
    const atr = await api.createAtr(s)

    await ardPage.goto(`/ard/atrs/${atr.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.locator('.ant-tabs-tab').filter({ hasText: /Samples/i }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('ATR workspace shows Audit Trail tab', async ({ ardPage, api }) => {
    const s = stamp()
    const atr = await api.createAtr(s)

    await ardPage.goto(`/ard/atrs/${atr.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.locator('.ant-tabs-tab').filter({ hasText: /Audit/i }).first()).toBeVisible({ timeout: 10_000 })
  })
})
