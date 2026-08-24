/**
 * Projects + STP (Study/Test Plan) module.
 * ELN3-specific: projects can hold STP documents used to initialise experiments.
 * Mirrors AdProjectController + AdProjectSpecificationsController.
 */
import {
  test,
  expect,
  stamp,
  waitForNetworkSettle,
  getVisibleModal,
  dismissModal,
  pickFirstDropdownOption,
} from './helpers/fixtures'

test.describe('Projects list', () => {
  test('page loads with heading', async ({ ardPage }) => {
    await ardPage.goto('/ard/projects')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Projects/i }).first()).toBeVisible()
  })

  test('New Project button is visible', async ({ ardPage }) => {
    await ardPage.goto('/ard/projects')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('button', { name: /New Project/i }).first()).toBeVisible()
  })

  test('project created via API appears in list', async ({ ardPage, api }) => {
    const s = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto('/ard/projects')
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(proj.code).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Project workspace', () => {
  test('opens and shows project code', async ({ ardPage, api }) => {
    const s    = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto(`/ard/projects/${proj.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(proj.code).first()).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has STP tab', async ({ ardPage, api }) => {
    const s    = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto(`/ard/projects/${proj.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /STP/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has Attributes tab', async ({ ardPage, api }) => {
    const s    = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto(`/ard/projects/${proj.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Attributes/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has Specifications tab', async ({ ardPage, api }) => {
    const s    = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto(`/ard/projects/${proj.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Spec|Specification/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has Attachments tab', async ({ ardPage, api }) => {
    const s    = stamp()
    const proj = await api.createProject(s)

    await ardPage.goto(`/ard/projects/${proj.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Attachment/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })
})

test.describe('Project creation modal', () => {
  test('New Project modal opens with required fields', async ({ ardPage }) => {
    await ardPage.goto('/ard/projects')
    await waitForNetworkSettle(ardPage)

    await ardPage.getByRole('button', { name: /New Project/i }).first().click()
    const modal = await getVisibleModal(ardPage)

    // Must have Project Code and Product Name inputs
    await expect(modal.getByLabel(/Project Code/i).first()).toBeVisible()
    await expect(modal.getByLabel(/Product Name/i).first()).toBeVisible()

    await dismissModal(ardPage, /Cancel/)
  })

  test('creates project via modal UI', async ({ ardPage }) => {
    const s = stamp()
    await ardPage.goto('/ard/projects')
    await waitForNetworkSettle(ardPage)

    await ardPage.getByRole('button', { name: /New Project/i }).first().click()
    const modal = await getVisibleModal(ardPage)

    await modal.getByLabel(/Project Code/i).fill(`UI-PRJ-${s}`)
    await modal.getByLabel(/Product Name/i).fill(`UI Product ${s}`)
    await dismissModal(ardPage, /Create|OK|Save/i)

    // New project should appear in the list
    await expect(ardPage.getByText(`UI-PRJ-${s}`).first()).toBeVisible({ timeout: 12_000 })
  })
})

test.describe('Experiment creation via Project STP', () => {
  test('New Experiment modal in experiments page shows Via Project STP radio option', async ({ ardPage, api }) => {
    // Seed a project so the STP option has data to populate
    const s    = stamp()
    await api.createProject(s)

    await ardPage.goto('/ard/experiments')
    await waitForNetworkSettle(ardPage)

    await ardPage.getByRole('button', { name: /New Experiment/i }).first().click()
    const modal = await getVisibleModal(ardPage)

    // The modal should have a "Via Project STP" radio toggle
    const stpOption = modal.locator('.ant-radio-button-wrapper, .ant-radio-wrapper').filter({
      hasText: /STP|Project STP/i,
    }).first()
    await expect(stpOption).toBeVisible({ timeout: 8_000 })

    await dismissModal(ardPage, /Cancel/)
  })
})
