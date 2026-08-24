import { test as base, expect, type Page } from '@playwright/test'
import { apiLogin, seedAuthStorage, getAdminToken } from './api-auth'
import { ArdApiClient } from './uat-api'

export type ArdFixtures = {
  /** Browser page pre-seeded with admin auth token — use instead of raw `page` */
  ardPage: Page
  /** Raw API client authenticated as admin — for data seeding */
  api: ArdApiClient
}

export const test = base.extend<ArdFixtures>({
  ardPage: async ({ page }, use) => {
    const token = await getAdminToken()
    await seedAuthStorage(page, token)
    await use(page)
  },

  api: async ({}, use) => {
    const token = await getAdminToken()
    await use(new ArdApiClient(token))
  },
})

export { expect } from '@playwright/test'

// ── Timing helpers ────────────────────────────────────────────────────────────

export async function waitForNetworkSettle(page: Page, timeout = 15_000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {})
}

// ── Modal helpers ─────────────────────────────────────────────────────────────

export async function getVisibleModal(page: Page) {
  const modal = page.locator('.ant-modal').last()
  await expect(modal).toBeVisible({ timeout: 10_000 })
  return modal
}

export async function dismissModal(page: Page, buttonText: string | RegExp = /OK|Create|Save|Submit/i) {
  const modal = page.locator('.ant-modal').last()
  await modal.getByRole('button', { name: buttonText }).click()
  await expect(modal).toBeHidden({ timeout: 15_000 })
}

export async function cancelModal(page: Page) {
  const modal = page.locator('.ant-modal').last()
  await modal.getByRole('button', { name: /Cancel|Close/i }).click()
  await expect(modal).toBeHidden({ timeout: 10_000 })
}

// ── Ant Design Select helpers ─────────────────────────────────────────────────

export async function selectDropdownOption(page: Page, container: ReturnType<typeof page.locator>, optionText: string | RegExp) {
  await container.click()
  const dropdown = page.locator('.ant-select-dropdown:visible')
  await dropdown.waitFor({ timeout: 5_000 })
  await dropdown.getByTitle(optionText instanceof RegExp ? undefined : optionText).first().click()
}

export async function pickFirstDropdownOption(page: Page) {
  const dropdown = page.locator('.ant-select-dropdown:visible')
  await dropdown.waitFor({ timeout: 5_000 })
  await dropdown.locator('.ant-select-item-option').first().click()
}

// ── Unique stamp ──────────────────────────────────────────────────────────────

export function stamp(): string {
  return Date.now().toString().slice(-6)
}
