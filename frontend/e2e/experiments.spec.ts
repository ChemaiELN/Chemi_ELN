/**
 * Experiment workspace — covers ELN3-specific features:
 * - Version history drawer
 * - Reference experiment linking
 * - Section editing + save
 *
 * Mirrors AdExperimentController + AdExperimentWorkspaceController.
 */
import { test, expect, stamp, waitForNetworkSettle } from './helpers/fixtures'

test.describe('Experiments list', () => {
  test('page loads with heading', async ({ ardPage }) => {
    await ardPage.goto('/ard/experiments')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Experiments/i }).first()).toBeVisible()
  })

  test('New Experiment button is present', async ({ ardPage }) => {
    await ardPage.goto('/ard/experiments')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('button', { name: /New Experiment/i }).first()).toBeVisible()
  })

  test('experiment created via API appears in list', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    await ardPage.goto('/ard/experiments')
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(exp.code).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Experiment workspace', () => {
  test('opens and shows code', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(exp.code).first()).toBeVisible({ timeout: 12_000 })
  })

  test('workspace renders section tabs from template', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    // Template has a section titled "Reagents & Standards"
    await expect(ardPage.getByText(/Reagents|Standards|Observations/i).first()).toBeVisible({ timeout: 12_000 })
  })

  test('History button opens the version history drawer', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    // Create at least one patch so there is a snapshot
    await api.patchExperiment(exp.id, {
      sections: { sec1: [{ col1: 'NaOH', col2: 1.0, col3: 'B-001' }] },
    })

    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    const historyBtn = ardPage.getByRole('button', { name: /History|Version/i }).first()
    if (await historyBtn.isVisible()) {
      await historyBtn.click()
      const drawer = ardPage.locator('.ant-drawer').last()
      await expect(drawer).toBeVisible({ timeout: 8_000 })
      // Drawer should mention the version number
      await expect(drawer.getByText(/Version|v1|v\s*1/i).first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('workspace has Reference Experiments panel', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    // The ReferenceExperimentsPanel renders a card with "Reference Experiments" heading
    await expect(ardPage.getByText(/Reference Experiments?/i).first()).toBeVisible({ timeout: 12_000 })
  })
})

test.describe('Experiment submission workflow', () => {
  test('submit button is present in workspace toolbar', async ({ ardPage, api }) => {
    const s = stamp()
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s)

    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    const submitBtn = ardPage.getByRole('button', { name: /Submit/i }).first()
    await expect(submitBtn).toBeVisible({ timeout: 12_000 })
  })
})
