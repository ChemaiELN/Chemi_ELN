/**
 * Reports page — delayed submission / approval reports and export buttons.
 * Mirrors AD's insights.spec.ts and the delayed-reports section.
 */
import { test, expect, waitForNetworkSettle } from './helpers/fixtures'

test.describe('Reports page', () => {
  test('page loads', async ({ ardPage }) => {
    await ardPage.goto('/ard/reports')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Reports/i }).first()).toBeVisible()
  })

  test('has report type tabs or cards', async ({ ardPage }) => {
    await ardPage.goto('/ard/reports')
    await waitForNetworkSettle(ardPage)

    // Reports page should have tabs or cards for different report types
    const reportSection = ardPage.locator('.ant-tabs, .ant-card, .ant-collapse').first()
    await expect(reportSection).toBeVisible({ timeout: 10_000 })
  })

  test('delayed submission report section is present', async ({ ardPage }) => {
    await ardPage.goto('/ard/reports')
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.getByText(/Delayed ATRs|Delayed Submission|Submission Delay|Overdue/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('delayed approval report section is present', async ({ ardPage }) => {
    await ardPage.goto('/ard/reports')
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.getByText(/Delayed Approval|Approval Delay|Pending Approval/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('export button is present on reports page', async ({ ardPage }) => {
    await ardPage.goto('/ard/reports')
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.getByRole('button', { name: /Export|Download|Excel|PDF/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
