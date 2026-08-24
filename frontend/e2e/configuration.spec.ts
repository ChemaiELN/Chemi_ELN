/**
 * Configuration page — Techniques, Test Configs (Instruments/Methods),
 * Team management tabs. Mirrors AdConfigurationController coverage.
 */
import { test, expect, stamp, waitForNetworkSettle, getVisibleModal, dismissModal } from './helpers/fixtures'

test.describe('Configuration page', () => {
  test('loads configuration page', async ({ ardPage }) => {
    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Configuration/i }).first()).toBeVisible()
  })

  test('has Techniques tab', async ({ ardPage }) => {
    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.locator('.ant-tabs-tab').filter({ hasText: /Techniques|Technique/i }).first()).toBeVisible()
  })

  test('has Test Configs / Methods tab', async ({ ardPage }) => {
    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)
    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Test Config|Method|Instrument/i }).first(),
    ).toBeVisible()
  })
})

test.describe('Techniques CRUD', () => {
  test('technique created via API appears in the Techniques tab', async ({ ardPage, api }) => {
    const s = stamp()
    const tech = await api.createTechnique(s)

    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)

    // Click Techniques tab
    const tab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Techniques/i }).first()
    await tab.click()
    await ardPage.waitForTimeout(300)

    // Use search box to filter — table is paginated and new records land at the end
    const searchInput = ardPage.locator('input[placeholder*="Search technique"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(tech.code)
      await ardPage.waitForTimeout(300)
    }

    await expect(ardPage.getByText(tech.code).first()).toBeVisible({ timeout: 10_000 })
  })

  test('technique row shows its code', async ({ ardPage, api }) => {
    const s = stamp()
    const tech = await api.createTechnique(s)

    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)

    const tab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Techniques/i }).first()
    await tab.click()
    await ardPage.waitForTimeout(300)

    // Search to bring the record into view past pagination
    const searchInput = ardPage.locator('input[placeholder*="Search technique"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(`TECH-${s}`)
      await ardPage.waitForTimeout(300)
    }

    await expect(ardPage.getByText(`TECH-${s}`).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Test Configs CRUD', () => {
  test('test config created via API appears in config tab', async ({ ardPage, api }) => {
    const s = stamp()
    const tech   = await api.createTechnique(s)
    await api.createTestConfig(tech.id, s)

    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)

    const tab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Test Config|Method/i }).first()
    await tab.click()
    await ardPage.waitForTimeout(300)

    // Test type is "Assay {s}" — use it to search (table shows testType, not techniqueCode)
    const searchInput = ardPage.locator('input[placeholder*="Search test config"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(`Assay ${s}`)
      await ardPage.waitForTimeout(300)
    }

    await expect(ardPage.getByText(`Assay ${s}`).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Configuration — new-record modal', () => {
  test('New Technique button opens a modal', async ({ ardPage }) => {
    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)

    const tab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Techniques/i }).first()
    await tab.click()
    await ardPage.waitForTimeout(300)

    const addBtn = ardPage.getByRole('button', { name: /New Technique|Add/i }).first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      const modal = await getVisibleModal(ardPage)
      await expect(modal).toBeVisible()
      await dismissModal(ardPage, /Cancel/)
    }
  })
})
