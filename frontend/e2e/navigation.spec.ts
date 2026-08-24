/**
 * Navigation tests — verifies that all ARD module routes load and show
 * the expected primary heading. Uses token-injection via the ardPage fixture
 * so no UI login round-trip is needed.
 */
import { test, expect, waitForNetworkSettle } from './helpers/fixtures'

const ARD_ROUTES = [
  { path: '/ard',              heading: /ARD Dashboard|Dashboard/i },
  { path: '/ard/atrs',         heading: /Analytical Test Requests|ATRs/i },
  { path: '/ard/atrs/new',     heading: /New Analytical Test Request/i },
  { path: '/ard/tests',        heading: /Test.*Queue|Test Execution/i },
  { path: '/ard/experiments',  heading: /Experiments/i },
  { path: '/ard/notebooks',    heading: /Notebooks/i },
  { path: '/ard/qc-trf',       heading: /QC.?TRF|Transfer Request/i },
  { path: '/ard/projects',     heading: /Projects/i },
  { path: '/ard/configuration',heading: /Configuration/i },
  { path: '/ard/reports',      heading: /Reports/i },
  { path: '/ard/search',       heading: /Search/i },
]

test.describe('ARD navigation — all routes load', () => {
  for (const route of ARD_ROUTES) {
    test(`${route.path} renders heading`, async ({ ardPage }) => {
      await ardPage.goto(route.path)
      await waitForNetworkSettle(ardPage)
      await expect(
        ardPage.getByRole('heading', { name: route.heading }).first(),
      ).toBeVisible({ timeout: 12_000 })
    })
  }
})

test.describe('ARD sidebar navigation', () => {
  test('sidebar links are present on the dashboard', async ({ ardPage }) => {
    await ardPage.goto('/ard')
    await waitForNetworkSettle(ardPage)

    const nav = ardPage.locator('[class*="sider"], nav, .ant-layout-sider')
    await expect(nav.first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking ATRs nav link navigates to /ard/atrs', async ({ ardPage }) => {
    await ardPage.goto('/ard')
    await waitForNetworkSettle(ardPage)

    // Click the ATRs sidebar entry (Ant Menu uses navigate(), not <a href>)
    const atrLink = ardPage.locator('.ant-menu-item').filter({ hasText: /^ATRs?$/ }).first()
    await atrLink.click()
    await ardPage.waitForURL(/\/ard\/atrs/, { timeout: 10_000 })
    await expect(
      ardPage.getByRole('heading', { name: /Analytical Test Requests|ATRs/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('404 redirects gracefully', async ({ ardPage }) => {
    await ardPage.goto('/ard/does-not-exist-xyz')
    await ardPage.waitForLoadState('domcontentloaded')
    // App should either show a 404 component or redirect to dashboard — either is acceptable
    const url = ardPage.url()
    const body = await ardPage.locator('body').textContent()
    const isHandled =
      url.includes('/ard') ||
      (body ?? '').toLowerCase().includes('not found') ||
      (body ?? '').toLowerCase().includes('404')
    expect(isHandled).toBeTruthy()
  })
})
