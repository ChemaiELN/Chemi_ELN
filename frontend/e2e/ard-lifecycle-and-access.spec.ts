import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const USERNAME = 'superadmin'
const PASSWORD = 'Password@123'
const BACKEND_URL = 'http://localhost:8000'

type ApiRecord = Record<string, any>

async function loginApi(request: APIRequestContext, username = USERNAME, password = PASSWORD) {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: { username, password } })
  expect(response.ok(), `login failed for ${username}: ${await response.text()}`).toBeTruthy()
  const body = await response.json()
  return { Authorization: `Bearer ${body.access_token}` }
}

async function apiJson(request: APIRequestContext, method: 'get' | 'post' | 'put', url: string, headers: Record<string, string>, data?: ApiRecord) {
  const response = await request[method](`${BACKEND_URL}${url}`, { headers, data })
  expect(response.ok(), `${method.toUpperCase()} ${url} failed: ${await response.text()}`).toBeTruthy()
  return response.json()
}

async function loginUi(page: Page) {
  await page.goto('/login')
  await page.getByPlaceholder('Enter your username').fill(USERNAME)
  await page.getByPlaceholder('Enter your password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
}

test.describe.serial('ARD lifecycle, signature, reports, and access-control E2E', () => {
  test('ATR, test execution, e-signature, template, experiment, and QC-TRF lifecycles', async ({ request }) => {
    const headers = await loginApi(request)
    const stamp = `${Date.now()}`

    // The password verification endpoint is the electronic-signature primitive
    // used by the state-changing ARD actions.
    const badSignature = await request.post(`${BACKEND_URL}/api/auth/verify-password`, {
      headers,
      data: { password: 'not-the-password' },
    })
    expect(badSignature.status()).toBe(401)
    const signature = await apiJson(request, 'post', '/api/auth/verify-password', headers, { password: PASSWORD })
    expect(signature).toMatchObject({ verified: true, username: USERNAME })

    // Establish a configuration and an ATR sample/test, then execute and verify
    // the test through the real workflow endpoints.
    const technique = await apiJson(request, 'post', '/api/ard/master-data/techniques', headers, {
      code: `E2E-${stamp}`, name: `E2E Technique ${stamp}`,
    })
    const config = await apiJson(request, 'post', '/api/ard/master-data/test-configs', headers, {
      techniqueId: technique.id,
      testType: `E2E Assay ${stamp}`,
      resultParams: [{ id: 'assay', name: 'Assay', dataType: 'number', uom: '%', validationType: 'RANGE', lowerLimit: 95, upperLimit: 105 }],
    })
    const atr = await apiJson(request, 'post', '/api/ard/atrs', headers, {
      projectCode: `E2E-ATR-${stamp}`, productName: `E2E Product ${stamp}`,
    })
    const savedAtr = await apiJson(request, 'put', `/api/ard/atrs/${atr.id}`, headers, {
      samples: [{ sampleCode: `SAMPLE-${stamp}`, sampleType: 'API', quantity: '10', uom: 'g', batchNo: `B-${stamp}` }],
    })
    const sampleId = savedAtr.samples[0].id
    const testAdd = await apiJson(request, 'post', `/api/ard/atrs/${atr.id}/samples/${sampleId}/tests`, headers, {
      testConfigIds: [config.id],
    })
    const testId = testAdd.created[0].id
    const submittedAtr = await apiJson(request, 'post', `/api/ard/atrs/${atr.id}/transition`, headers, {
      to: 'NEW', password: PASSWORD,
    })
    expect(submittedAtr.status).toBe('NEW')

    const started = await apiJson(request, 'post', `/api/ard/tests/${atr.id}/${testId}/start`, headers, {})
    expect(started.status).toBe('IN_PROGRESS')
    const savedResults = await apiJson(request, 'post', `/api/ard/tests/${atr.id}/${testId}/save-results`, headers, {
      results: [{ parameterId: 'assay', value: 99.2 }], resultRemarks: 'E2E result entry',
    })
    expect(savedResults.status).toBe('IN_PROGRESS')
    const testSubmitted = await apiJson(request, 'post', `/api/ard/tests/${atr.id}/${testId}/submit`, headers, {
      submitRemarks: 'E2E submit',
    })
    expect(testSubmitted.status).toBe('VERIFICATION_REQUESTED')
    const verified = await apiJson(request, 'post', `/api/ard/tests/${atr.id}/${testId}/verify`, headers, {
      remarks: 'E2E verification', verifiedBy: USERNAME,
    })
    expect(verified.status).toBe('VERIFIED')

    // A valid section is required before a template can be submitted/published.
    const sectionCatalog = await apiJson(request, 'get', '/api/ard/templates/section-types', headers)
    expect(sectionCatalog.map((section: ApiRecord) => section.type)).toEqual(expect.arrayContaining([
      'weighing', 'ph', 'equipment', 'column', 'chemical', 'quantitative_result', 'further_actions',
    ]))
    const template = await apiJson(request, 'post', '/api/ard/templates', headers, {
      name: `E2E Template ${stamp}`,
      sections: [
        { id: `section-${stamp}`, type: 'richtext', title: 'Purpose' },
        { id: `weighing-${stamp}`, type: 'weighing', title: 'Weighing Details' },
        { id: `results-${stamp}`, type: 'quantitative_result', title: 'Quantitative Results' },
      ],
    })
    const pendingTemplate = await apiJson(request, 'post', `/api/ard/templates/${template.id}/transition`, headers, { to: 'PENDING_APPROVAL' })
    expect(pendingTemplate.status).toBe('PENDING_APPROVAL')
    const publishedTemplate = await apiJson(request, 'post', `/api/ard/templates/${template.id}/transition`, headers, { to: 'PUBLISHED' })
    expect(publishedTemplate.status).toBe('PUBLISHED')

    const notebook = await apiJson(request, 'post', '/api/ard/notebooks', headers, { name: `E2E Notebook ${stamp}` })
    const experiment = await apiJson(request, 'post', '/api/ard/experiments', headers, {
      name: `E2E Experiment ${stamp}`, templateId: template.id, notebookId: notebook.id,
    })
    expect(experiment.status).toBe('IN_PROGRESS')
    for (const to of ['SUBMITTED', 'APPROVED', 'VERIFICATION_REQUESTED', 'VERIFIED', 'UNLOCK_REQUESTED', 'UNLOCKED']) {
      const transitioned = await apiJson(request, 'post', `/api/ard/experiments/${experiment.id}/transition`, headers, { to, remarks: `E2E ${to}` })
      expect(transitioned.status).toBe(to)
    }

    const trf = await apiJson(request, 'post', '/api/ard/qc-trf', headers, {
      projectCode: `E2E-QC-${stamp}`, projectName: `E2E QC Project ${stamp}`,
    })
    const savedTrf = await apiJson(request, 'put', `/api/ard/qc-trf/${trf.id}`, headers, {
      sampleCode: `QC-SAMPLE-${stamp}`, batchNo: `QC-BATCH-${stamp}`, sampleQty: '10', sampleQtyUom: 'g',
      mfgDate: '2026-01-01', expDate: '2027-01-01', storageCondition: 'Room temperature',
      preparedBy: USERNAME, sampledBy: USERNAME,
      testRequests: [{ testType: `E2E Assay ${stamp}`, status: 'REQUESTED' }],
    })
    expect(savedTrf.status).toBe('DRAFT')
    const trfSubmitted = await apiJson(request, 'post', `/api/ard/qc-trf/${trf.id}/transition`, headers, { to: 'SUBMITTED' })
    expect(trfSubmitted.status).toBe('SUBMITTED')
    const trfRegistered = await apiJson(request, 'post', `/api/ard/qc-trf/${trf.id}/transition`, headers, {
      to: 'REGISTERED', receivedBy: USERNAME, sampleIntegrity: 'INTACT', receivingRemarks: 'E2E receipt',
    })
    expect(trfRegistered.status).toBe('REGISTERED')
  })

  test('reports download from the browser and non-admin roles are denied configuration access', async ({ page, request }) => {
    await loginUi(page)
    await page.goto('/ard/reports')
    const download = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Excel' }).first().click(),
    ])
    expect(download[0].suggestedFilename()).toMatch(/\.xlsx$/i)

    const analystHeaders = await loginApi(request, 'ad.analyst')
    const denied = await request.post(`${BACKEND_URL}/api/ard/master-data/techniques`, {
      headers: analystHeaders,
      data: { code: 'DENIED-E2E', name: 'Must not be created' },
    })
    expect(denied.status()).toBe(403)

    await page.goto('/login')
    await page.getByPlaceholder('Enter your username').fill('ad.analyst')
    await page.getByPlaceholder('Enter your password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
    await page.goto('/ard/configuration')
    await expect(page).toHaveURL(/\/ard(?:$|\?)/, { timeout: 15000 })
  })
})
