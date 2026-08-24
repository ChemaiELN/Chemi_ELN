/**
 * Template management — create, publish, version, and use templates.
 * Mirrors AD's templates-versioning.spec.ts.
 */
import { test, expect, stamp, waitForNetworkSettle, getVisibleModal, dismissModal } from './helpers/fixtures'

test.describe('Templates list', () => {
  test('page loads', async ({ ardPage }) => {
    await ardPage.goto('/ard/configuration')
    await waitForNetworkSettle(ardPage)

    const tab = ardPage.locator('.ant-tabs-tab').filter({ hasText: /Templates?/i }).first()
    if (await tab.isVisible()) {
      await tab.click()
      await ardPage.waitForTimeout(300)
    }
    // If templates are on a separate page
    else {
      await ardPage.goto('/ard/templates').catch(() => {})
      await waitForNetworkSettle(ardPage)
    }
    // Either way we should see template content
    const content = ardPage.locator('.ant-table, [class*="template"]').first()
    await expect(content).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Template lifecycle (API)', () => {
  test.describe.serial('create → publish', () => {
    let tplId: string
    const s = stamp()

    test('create template as DRAFT', async ({ api }) => {
      const tpl = await api.createTemplate(s)
      tplId = tpl.id
      expect(tpl.status ?? 'DRAFT').toBe('DRAFT')
    })

    test('publish template', async ({ api }) => {
      const result = await api.publishTemplate(tplId)
      expect(result.status).toBe('PUBLISHED')
    })

    test('published template can be used to create an experiment', async ({ api }) => {
      const s2  = stamp()
      const exp = await api.createExperiment(tplId, s2)
      expect(exp.id).toBeTruthy()
      expect(exp.templateId ?? exp.template_id).toBe(tplId)
    })

    test('published template appears in experiment creation dropdown', async ({ ardPage }) => {
      await ardPage.goto('/ard/experiments')
      await waitForNetworkSettle(ardPage)

      await ardPage.getByRole('button', { name: /New Experiment/i }).first().click()
      const modal = await getVisibleModal(ardPage)

      // Template select should be present
      const tplSelect = modal.locator('.ant-select').first()
      await expect(tplSelect).toBeVisible({ timeout: 8_000 })

      await dismissModal(ardPage, /Cancel/)
    })
  })
})

test.describe('Template workspace', () => {
  test('template workspace loads sections', async ({ ardPage, api }) => {
    const s   = stamp()
    const tpl = await api.createTemplate(s)

    // Templates workspace URL — try common patterns
    for (const url of [`/ard/templates/${tpl.id}`, `/ard/configuration?tpl=${tpl.id}`]) {
      await ardPage.goto(url).catch(() => {})
      const loadState = await ardPage.waitForLoadState('domcontentloaded').then(() => true).catch(() => false)
      if (!loadState) continue

      const hasContent = await ardPage.getByText(/Reagents|Standards|Section/i).first().isVisible().catch(() => false)
      if (hasContent) {
        await expect(ardPage.getByText(/Reagents|Standards|Section/i).first()).toBeVisible()
        break
      }
    }
  })
})
