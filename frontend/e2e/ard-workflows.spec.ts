import { test, expect, type Page } from '@playwright/test'

const USERNAME = 'superadmin'
const PASSWORD = 'Password@123'

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('domcontentloaded')
  
  // Fill credentials
  await page.getByPlaceholder('Enter your username').fill(USERNAME)
  await page.getByPlaceholder('Enter your password').fill(PASSWORD)

  // Click Sign In
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
}

test.describe.serial('ARD Module End-to-End Workflows', () => {

  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Workflow 1: ATR -> Test -> Verify Flow', async ({ page }) => {
    // 1. Navigate to ATR list
    await page.goto('/ard/atrs')
    await expect(page.getByRole('heading', { name: /Analytical Test Requests|ATRs/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /New ATR/i }).first()).toBeVisible()

    // 2. Navigate to Tests List & Execution
    await page.goto('/ard/tests')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await expect(page.getByRole('heading', { name: /Test Queue/i }).first()).toBeVisible()

    // Verify test table is visible
    const table = page.locator('.ant-table').first()
    await expect(table).toBeVisible()
  })

  test('Workflow 2: QC-TRF Creation & Registration Flow', async ({ page }) => {
    // 1. Navigate to QC-TRF list
    await page.goto('/ard/qc-trf')
    await expect(page.getByRole('heading', { name: /QC Transfer Request Forms|QC-TRF/i }).first()).toBeVisible()

    // 2. Open New QC-TRF Modal
    await page.getByRole('button', { name: /New QC-TRF/i }).first().click()
    const modal = page.locator('.ant-modal').filter({ hasText: /New QC-TRF/i }).last()
    await expect(modal).toBeVisible()

    // 3. Fill Project details
    // Project is a required relationship, and its code is intentionally
    // populated from the selected project rather than entered manually.
    await modal.getByLabel('Project Name').click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click()
    const projectCode = await modal.getByLabel('Project Code').inputValue()
    expect(projectCode).not.toBe('')

    // 4. Submit Modal
    await modal.getByRole('button', { name: /OK|Create|Save/i }).click()
    await expect(modal).toBeHidden({ timeout: 15000 })

    // 5. Verify created form appears in list using its linked project code.
    await expect(page.getByText(projectCode).first()).toBeVisible({ timeout: 15000 })
  })

  test('Workflow 3: Project Creation & STP Document Approval Flow', async ({ page }) => {
    // 1. Navigate to Projects list
    await page.goto('/ard/projects')
    await expect(page.getByRole('heading', { name: /Projects/i }).first()).toBeVisible()

    // 2. Create New Project
    await page.getByRole('button', { name: /New Project/i }).first().click()
    const projModal = page.locator('.ant-modal').filter({ hasText: /New Project/i }).last()
    await expect(projModal).toBeVisible()

    const timestamp = Date.now().toString().slice(-4)
    const projCode = `PRJ-E2E-${timestamp}`
    const prodName = `Metformin E2E ${timestamp}`

    await projModal.getByLabel('Project Code').fill(projCode)
    await projModal.getByLabel('Product Name').fill(prodName)
    await projModal.getByLabel(/Customer/i).fill('Laurus Internal E2E')

    await projModal.getByRole('button', { name: /Create|OK/i }).click()
    await expect(projModal).toBeHidden({ timeout: 15000 })

    // 3. Verify Project appears and open workspace
    const cell = page.getByText(projCode).first()
    await expect(cell).toBeVisible({ timeout: 15000 })
    await cell.click()

    // 4. In Project Workspace: Click STP Tab & Add STP Document
    await page.waitForURL(/\/ard\/projects\//, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: new RegExp(projCode, 'i') })).toBeVisible()

    // Switch to STP Tab
    const stpTab = page.locator('.ant-tabs-tab').filter({ hasText: /STP/i }).first()
    await stpTab.click()

    // Click Add STP document button
    await page.getByRole('button', { name: /Add STP document|Add STP/i }).first().click()
    const stpModal = page.locator('.ant-modal').filter({ hasText: /Add STP Document/i }).last()
    await expect(stpModal).toBeVisible()

    const stpDocNo = `STP-E2E-${timestamp}`
    const stpTitle = `Standard Dissolution Assay SOP ${timestamp}`

    await stpModal.getByLabel('Document No.').fill(stpDocNo)
    await stpModal.getByLabel('Title').fill(stpTitle)
    await stpModal.getByLabel('Test Type').fill('Dissolution & Assay')

    // Submit STP Modal
    await stpModal.getByRole('button', { name: /OK|Create|Save/i }).click()
    await expect(stpModal).toBeHidden({ timeout: 15000 })

    // 5. Verify STP document appears in project workspace table
    await expect(page.getByText(stpDocNo).first()).toBeVisible({ timeout: 15000 })
  })

})
