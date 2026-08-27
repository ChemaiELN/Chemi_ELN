/**
 * Shared Puppeteer-based HTML → PDF renderer.
 * Re-uses a single browser instance across requests (lazy-launched).
 */
import puppeteer, { Browser, Page } from 'puppeteer'

let _browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser
  _browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    // Puppeteer's own Chrome download can be unavailable in locked-down dev
    // environments; PUPPETEER_EXECUTABLE_PATH lets ops point it at any
    // already-installed Chrome/Chromium (e.g. Playwright's) instead.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  })
  return _browser
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  let page: Page | null = null
  try {
    page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
    })
    return Buffer.from(buffer)
  } finally {
    if (page) await page.close()
  }
}

// graceful shutdown
process.on('exit', () => { _browser?.close() })
