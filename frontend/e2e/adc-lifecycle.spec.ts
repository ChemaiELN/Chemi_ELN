/**
 * ADC full lifecycle — QA creates a project, ADC PD HOD creates a notebook,
 * ADC PD TL creates an experiment, the chemist performs it and signs "Done
 * By" on every gated section, the TL signs "Checked By", the chemist submits,
 * the HOD approves, and finally the approved experiment's report is
 * generated/downloaded.
 *
 * Unlike the ARD specs in this folder (which seed a single admin token and
 * drive everything through one session), this flow is inherently
 * multi-role: each step must be performed by the real role it's gated on
 * (adc.project.create, adc.notebook.create, adc.experiment.create,
 * adc.experiment.sign_done, adc.experiment.sign_checked,
 * adc.experiment.submit, adc.experiment.approve). So every test logs in
 * through the real UI login form as a different user, and Playwright's
 * default per-test browser context keeps their sessions isolated.
 *
 * Requires these users to already exist (department-role privileges must be
 * configured for them out of band — this test does not provision privileges):
 *   qa.hod      — HOD / QA department       — creates the project
 *   adcpd.hod   — HOD / ADC PD department    — creates the notebook, approves
 *   adcpd.tl    — TL  / ADC PD department    — creates the experiment, signs "Checked By"
 *   adcpd.chem  — Chemist / ADC PD department — signs "Done By", submits
 * All four share the password Password@123.
 *
 * The notebook is created against the "ADC Synthesis (v7)" workflow template
 * (category CGT_ADC) — the only template with SIGNATURE-gated sections, and
 * the one that must be enabled via Admin → Template Settings → ADC Template
 * Settings for it to appear in the "New Notebook" dropdown at all.
 */
import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  getVisibleModal, dismissModal, stamp,
} from './helpers/fixtures'

// The shared `selectDropdownOption` helper (helpers/fixtures.ts) breaks when
// two Selects are opened back-to-back in the same modal — the previous
// dropdown's close animation ("...-leave") is still in the DOM when the next
// one opens, so `.ant-select-dropdown:visible` matches both and the locator
// throws a strict-mode violation. Scoping to the *last* dropdown (the one
// still opening) avoids that race without needing an arbitrary sleep.
async function selectOption(page: Page, container: Locator, optionText: string) {
  await container.click()
  const dropdown = page.locator('.ant-select-dropdown:visible').last()
  await dropdown.waitFor({ timeout: 5_000 })
  await dropdown.getByTitle(optionText, { exact: true }).first().click()
  // Multi-select (mode="multiple") dropdowns stay open after picking an
  // option — close it so it doesn't intercept clicks on whatever's next
  // (e.g. the modal's submit button).
  await page.keyboard.press('Escape')
  await dropdown.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
}

const PASSWORD = 'Password@123'
const USERS = {
  qaHod:   { username: 'qa.hod',     password: PASSWORD },
  adcHod:  { username: 'adcpd.hod',  password: PASSWORD },
  adcTl:   { username: 'adcpd.tl',   password: PASSWORD },
  adcChem: { username: 'adcpd.chem', password: PASSWORD },
}

// Sections in the "ADC Synthesis (v7)" template that carry a SIGNATURE field
// (verified against the live template definition) — every one of these must
// have both "Done By" and "Checked By" signed before Submit unlocks.
const SIGNATURE_SECTIONS = [
  '1.7 System Checks',
  '2. Buffer Preparation',
  '3.6 Scientist Conclusion',
  '4.3 Scientist Conclusion',
  '5.3 Scientist Conclusion',
  '7.3 Scientist Conclusion',
]

async function loginAs(page: Page, creds: { username: string; password: string }) {
  await page.goto('/login')
  await page.getByPlaceholder('Enter your username').fill(creds.username)
  await page.getByPlaceholder('Enter your password').fill(creds.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}

async function signWithPassword(page: Page, password: string) {
  const modal = page.locator('.ant-modal').last()
  await expect(modal).toBeVisible({ timeout: 10_000 })
  await modal.getByLabel(/Your Password/i).fill(password)
  await modal.getByRole('button', { name: /Sign & Confirm/i }).click()
  await expect(modal).toBeHidden({ timeout: 15_000 })
}

async function signWithReason(page: Page, reason: string) {
  const modal = page.locator('.ant-modal').last()
  await expect(modal).toBeVisible({ timeout: 10_000 })
  await modal.getByLabel(/Reason \/ Justification/i).fill(reason)
  await modal.getByRole('button', { name: /Sign & Confirm/i }).click()
  await expect(modal).toBeHidden({ timeout: 15_000 })
}

// Module-level state threaded between the serial steps below.
const s = stamp()
const projectName  = `E2E ADC Project ${s}`
const notebookTitle = `E2E ADC Notebook ${s}`
const experimentTitle = `E2E ADC Experiment ${s}`
let projectUrl = ''
let notebookId = ''
let experimentUrl = ''

test.describe.serial('ADC full lifecycle — project to approved report', () => {
  test('QA creates the ADC project', async ({ page }) => {
    await loginAs(page, USERS.qaHod)

    await page.goto('/adc/projects')
    await page.getByRole('button', { name: /New Project/i }).click()
    const modal = await getVisibleModal(page)

    await modal.getByLabel(/^Project Name/i).fill(projectName)
    await selectOption(page, modal.getByLabel(/Project Lead \(ADC PD\)/i), 'adcpd.hod')

    await dismissModal(page, /Create Project/i)

    await page.getByText(projectName, { exact: true }).first().click()
    await page.waitForURL(/\/adc\/projects\/[0-9a-f-]+/, { timeout: 15_000 })
    projectUrl = page.url()
  })

  test('ADC PD HOD creates the notebook (with the TL assigned)', async ({ page }) => {
    test.skip(!projectUrl, 'Project was not created in the previous step')
    await loginAs(page, USERS.adcHod)

    await page.goto(projectUrl)
    await page.getByRole('button', { name: /New Notebook/i }).click()
    const modal = await getVisibleModal(page)

    await modal.getByLabel(/^Title/i).fill(notebookTitle)
    await selectOption(page, modal.getByLabel(/Workflow Template/i), 'ADC Synthesis (v7)')
    await selectOption(page, modal.getByLabel(/Team Lead/i), 'adcpd.tl')

    await dismissModal(page, /^Create$/i)

    await page.getByText(notebookTitle, { exact: true }).first().click()
    await page.waitForURL(/\/notebooks\/[0-9a-f-]+\/overview/, { timeout: 15_000 })
    notebookId = page.url().match(/\/notebooks\/([0-9a-f-]+)\/overview/)?.[1] ?? ''
  })

  test('ADC PD TL creates the experiment and assigns the chemist', async ({ page }) => {
    test.skip(!notebookId, 'Notebook was not created in the previous step')
    await loginAs(page, USERS.adcTl)

    await page.goto('/adc/experiments')
    await page.getByRole('button', { name: /New Experiment/i }).click()
    const modal = await getVisibleModal(page)

    const notebookSelect = modal.getByLabel(/^Notebook/i)
    await notebookSelect.click()
    await page.keyboard.type(notebookTitle)
    const dropdown = page.locator('.ant-select-dropdown:visible')
    await dropdown.getByTitle(new RegExp(notebookTitle)).first().click({ timeout: 10_000 })

    await modal.getByLabel(/Experiment Title/i).fill(experimentTitle)
    await selectOption(page, modal.getByLabel(/Assign Chemist/i), 'adcpd.chem')

    // The creating TL isn't automatically assigned to the experiment (only
    // the chemists picked above are), so it won't show up in the TL's own
    // "Experiments" list afterwards (that list is assignment-scoped for
    // anyone without adc.experiment.view_all) — capture the id straight off
    // the creation response instead of clicking a list row.
    const [createRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/notebooks/${notebookId}/experiments`) && r.request().method() === 'POST'),
      dismissModal(page, /^Create$/i),
    ])
    const created = await createRes.json()
    experimentUrl = `/notebooks/${notebookId}/experiments/${created.id}`
  })

  test('Chemist signs "Done By" on every gated section', async ({ page }) => {
    test.skip(!experimentUrl, 'Experiment was not created in the previous step')
    await loginAs(page, USERS.adcChem)
    await page.goto(experimentUrl)

    for (const title of SIGNATURE_SECTIONS) {
      await page.locator('button', { hasText: title }).first().click()
      const doneBtn = page.getByRole('button', { name: /^Done By$/ })
      // Idempotent across re-runs against the same experiment: skip if a prior
      // run already signed this section.
      if (await doneBtn.isEnabled().catch(() => false)) {
        await doneBtn.click()
        await signWithPassword(page, USERS.adcChem.password)
      }
    }
  })

  test('TL signs "Checked By" on every gated section', async ({ page }) => {
    await loginAs(page, USERS.adcTl)
    await page.goto(experimentUrl)

    for (const title of SIGNATURE_SECTIONS) {
      await page.locator('button', { hasText: title }).first().click()
      const checkedBtn = page.getByRole('button', { name: /^Checked By$/ })
      if (await checkedBtn.isEnabled().catch(() => false)) {
        await checkedBtn.click()
        await signWithPassword(page, USERS.adcTl.password)
      }
    }
  })

  test('Chemist submits the experiment', async ({ page }) => {
    await loginAs(page, USERS.adcChem)
    await page.goto(experimentUrl)

    await page.getByRole('button', { name: /Chemist Signature/i }).click()
    await signWithReason(page, 'All sections completed and data reviewed — submitting for approval.')

    await expect(page.getByText('SUBMITTED', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('ADC PD HOD approves the experiment', async ({ page }) => {
    await loginAs(page, USERS.adcHod)
    await page.goto(experimentUrl)

    await page.getByRole('button', { name: /Approver Signature/i }).click()
    await signWithReason(page, 'Reviewed and approved — data is accurate and complete.')

    await expect(page.getByText('APPROVED', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Approved experiment report can be generated and downloaded', async ({ page }) => {
    await loginAs(page, USERS.adcHod)
    await page.goto('/adc/reports')

    const row = page.locator('tr', { hasText: experimentTitle })
    await expect(row).toBeVisible({ timeout: 10_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      row.getByRole('button', { name: /Download/i }).click({ force: true }),
    ])

    // Despite the UI label ("Download .docx report") and the
    // /report/docx URL, the backend actually renders a PDF (see the
    // comment on that route in experiments.routes.ts) — assert what it
    // really produces rather than the misleading name.
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })
})
