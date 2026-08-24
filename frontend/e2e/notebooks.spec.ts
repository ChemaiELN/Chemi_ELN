/**
 * Notebook workspace — creation, opening, experiment tab.
 * ELN3-specific: notebooks group experiments and optionally link to projects.
 */
import { test, expect, stamp, waitForNetworkSettle } from './helpers/fixtures'

test.describe('Notebooks list', () => {
  test('page loads', async ({ ardPage }) => {
    await ardPage.goto('/ard/notebooks')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('heading', { name: /Notebooks/i }).first()).toBeVisible()
  })

  test('New Notebook button is visible', async ({ ardPage }) => {
    await ardPage.goto('/ard/notebooks')
    await waitForNetworkSettle(ardPage)
    await expect(ardPage.getByRole('button', { name: /New Notebook/i }).first()).toBeVisible()
  })

  test('notebook created via API appears in list', async ({ ardPage, api }) => {
    const s = stamp()
    const nb = await api.createNotebook(s)

    await ardPage.goto('/ard/notebooks')
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(nb.code).first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Notebook workspace', () => {
  test('opens notebook workspace', async ({ ardPage, api }) => {
    const s = stamp()
    const nb = await api.createNotebook(s)

    await ardPage.goto(`/ard/notebooks/${nb.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(nb.code).first()).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has Experiments tab', async ({ ardPage, api }) => {
    const s = stamp()
    const nb = await api.createNotebook(s)

    await ardPage.goto(`/ard/notebooks/${nb.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Experiments/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })

  test('workspace has Overview/Details tab', async ({ ardPage, api }) => {
    const s = stamp()
    const nb = await api.createNotebook(s)

    await ardPage.goto(`/ard/notebooks/${nb.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(
      ardPage.locator('.ant-tabs-tab').filter({ hasText: /Overview|Details|Info/i }).first(),
    ).toBeVisible({ timeout: 12_000 })
  })

  test('New Experiment button is present in Experiments tab', async ({ ardPage, api }) => {
    const s = stamp()
    const nb = await api.createNotebook(s)

    await ardPage.goto(`/ard/notebooks/${nb.id}`)
    await waitForNetworkSettle(ardPage)

    // Click the Experiments tab first
    const expTab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Experiments/i }).first()
    await expTab.click()
    await ardPage.waitForTimeout(300)

    await expect(
      ardPage.getByRole('button', { name: /New Experiment/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('experiment inside notebook workspace is accessible', async ({ ardPage, api }) => {
    const s = stamp()
    const nb  = await api.createNotebook(s)
    const tpl = await api.createTemplate(s)
    await api.publishTemplate(tpl.id)
    const exp = await api.createExperiment(tpl.id, s, nb.id)

    // Navigate directly to the experiment (not via notebook)
    await ardPage.goto(`/ard/experiments/${exp.id}`)
    await waitForNetworkSettle(ardPage)

    await expect(ardPage.getByText(exp.code).first()).toBeVisible({ timeout: 12_000 })
  })
})
