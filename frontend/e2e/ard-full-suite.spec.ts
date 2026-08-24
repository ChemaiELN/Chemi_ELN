import { test, expect, type Page } from '@playwright/test'

const USERNAME = 'superadmin'
const PASSWORD = 'Password@123'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('Enter your username').fill(USERNAME)
  await page.getByPlaceholder('Enter your password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
}

test.describe.serial('Comprehensive ARD Application Test Suite', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('1. Dashboard Page & Metrics Verification', async ({ page }) => {
    await page.goto('/ard')
    await expect(page.getByRole('heading', { name: /ARD Dashboard|Dashboard/i }).first()).toBeVisible()
    await expect(page.getByText('ATR Requests').first()).toBeVisible()
    await expect(page.getByText('Active Experiments').first()).toBeVisible()
    await expect(page.getByText('Test Requests').first()).toBeVisible()
  })

  test('2. Projects List & Workspace Tab Navigation', async ({ page }) => {
    await page.goto('/ard/projects')
    await expect(page.getByRole('heading', { name: /Projects/i }).first()).toBeVisible()

    // Create a new project
    await page.getByRole('button', { name: /New Project/i }).first().click()
    const modal = page.locator('.ant-modal').filter({ hasText: /New Project/i }).last()
    await expect(modal).toBeVisible()

    const ts = Date.now().toString().slice(-4)
    const code = `PRJ-FULL-${ts}`
    const prod = `Full Suite Product ${ts}`

    await modal.getByLabel('Project Code').fill(code)
    await modal.getByLabel('Product Name').fill(prod)
    await modal.getByRole('button', { name: /Create|OK/i }).click()
    await expect(modal).toBeHidden({ timeout: 15000 })

    // Open project workspace
    const cell = page.getByText(code).first()
    await expect(cell).toBeVisible({ timeout: 15000 })
    await cell.click()

    await page.waitForURL(/\/ard\/projects\//, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: new RegExp(code, 'i') })).toBeVisible()

    // Verify tabs: Overview, STP, Attributes, Attachments, Audit Trail
    const tabs = ['STP', 'Attributes', 'Attachments', 'Audit Trail']
    for (const tabName of tabs) {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: tabName }).first()
      await tab.click()
      await page.waitForTimeout(200)
    }
  })

  test('3. ATRs List & Creation Page', async ({ page }) => {
    await page.goto('/ard/atrs')
    await expect(page.getByRole('heading', { name: /Analytical Test Requests|ATRs/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /New ATR/i }).first()).toBeVisible()

    // Click New ATR
    await page.getByRole('button', { name: /New ATR/i }).first().click()
    await page.waitForURL(/\/ard\/atrs\/new/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: /New Analytical Test Request/i }).first()).toBeVisible()
  })

  test('4. Test Queue Page', async ({ page }) => {
    await page.goto('/ard/tests')
    await expect(page.getByRole('heading', { name: /Test Queue/i }).first()).toBeVisible()
    await expect(page.locator('.ant-table').first()).toBeVisible()
  })

  test('5. QC-TRF List & Modal Creation', async ({ page }) => {
    await page.goto('/ard/qc-trf')
    await expect(page.getByRole('heading', { name: /QC Transfer Request Forms/i }).first()).toBeVisible()

    await page.getByRole('button', { name: /New QC-TRF/i }).first().click()
    const modal = page.locator('.ant-modal').filter({ hasText: /New QC-TRF/i }).last()
    await expect(modal).toBeVisible()

    // QC-TRFs are linked to an existing project; selecting it must populate
    // the read-only project code rather than allowing a free-text project.
    await modal.getByLabel('Project Name').click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click()
    const projectCode = await modal.getByLabel('Project Code').inputValue()
    expect(projectCode).not.toBe('')
    await modal.getByRole('button', { name: /OK|Create/i }).click()
    await expect(modal).toBeHidden({ timeout: 15000 })

    await expect(page.getByText(projectCode).first()).toBeVisible({ timeout: 15000 })
  })

  test('6. Qualification Matrix Page', async ({ page }) => {
    await page.goto('/ard/qualification-matrix')
    await expect(page.getByRole('heading', { name: /Qualification Matrix/i }).first()).toBeVisible()
    await expect(page.getByText(/Analyst ✕ Technique/i).first()).toBeVisible()
  })

  test('7. Reports Page & PDF Exports', async ({ page }) => {
    await page.goto('/ard/reports')
    await expect(page.getByRole('heading', { name: /ARD Analytical Reports|Reports/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Export PDF/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Export Excel/i }).first()).toBeVisible()
  })

  test('8. Notifications Page & Category Filtering', async ({ page }) => {
    await page.goto('/ard/notifications')
    await expect(page.getByRole('heading', { name: /ARD Alerts & Notifications|Notifications/i }).first()).toBeVisible()
    await expect(page.getByText(/All \(/i).first()).toBeVisible()

    // Test Segmented category filtering
    const options = [/Qualifications/i, /ATR Status/i, /Workflows/i, /All \(/i]
    for (const opt of options) {
      const el = page.getByText(opt).first()
      if (await el.isVisible().catch(() => false)) {
        await el.click()
        await page.waitForTimeout(200)
      }
    }
  })

  test('9. Search Page & Global Search Query', async ({ page }) => {
    await page.goto('/ard/search')
    await expect(page.getByRole('heading', { name: /Search/i }).first()).toBeVisible()
    await page.getByPlaceholder(/Search ATRs/i).fill('PRJ')
    await page.waitForTimeout(300)
  })

  test('10. Team Directory Page', async ({ page }) => {
    await page.goto('/ard/team')
    await expect(page.getByRole('heading', { name: /^Team$/i }).first()).toBeVisible()
    const workloadTab = page.locator('.ant-tabs-tab').filter({ hasText: 'Workload' }).first()
    await workloadTab.click()
    await expect(page.locator('.ant-table').first()).toBeVisible()
  })

  test('11. Templates Page & Creation Modal', async ({ page }) => {
    await page.goto('/ard/templates')
    await expect(page.getByRole('heading', { name: /Templates/i }).first()).toBeVisible()
    await page.getByRole('button', { name: /New Template/i }).first().click()
    const modal = page.locator('.ant-modal').filter({ hasText: /New Template/i }).last()
    await expect(modal).toBeVisible()
  })

  test('12. Audit Trail Log Page', async ({ page }) => {
    await page.goto('/ard/audit')
    await expect(page.getByRole('heading', { name: /Audit/i }).first()).toBeVisible()
    await expect(page.locator('.ant-table').first()).toBeVisible()
  })

  test('13. Configuration Page & All Master Data Tabs', async ({ page }) => {
    await page.goto('/ard/configuration')
    await expect(page.getByRole('heading', { name: /ARD Master Data & System Configuration|Configuration/i }).first()).toBeVisible()

    // Verify master data tabs
    const tabs = ['Lookups', 'Techniques', 'Test Configurations', 'Test Groups', 'Form Types', 'Data Items', 'Analyst Qualifications', 'Alerts', 'Settings']
    for (const t of tabs) {
      const tab = page.locator('.ant-tabs-tab').filter({ hasText: new RegExp(t, 'i') }).first()
      if (await tab.isVisible().catch(() => false)) {
        await tab.click()
        await page.waitForTimeout(200)
      }
    }
  })

  test('14. Experiments List & Compare Page', async ({ page }) => {
    await page.goto('/ard/experiments')
    await expect(page.getByRole('heading', { name: /Experiments/i }).first()).toBeVisible()

    await page.goto('/ard/experiments/compare')
    await expect(page.getByRole('heading', { name: /Compare Experiments|Experiment Comparison/i }).first()).toBeVisible()
  })

})
