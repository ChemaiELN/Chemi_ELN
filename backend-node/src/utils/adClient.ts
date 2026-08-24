import axios from 'axios'

const AD_BASE = process.env.AD_API_BASE_URL || ''
const AD_KEY = process.env.AD_INTEGRATION_API_KEY || ''

export function adConfigured(): boolean {
  return Boolean(AD_BASE && AD_KEY)
}

export async function pushAtrToAd(payload: Record<string, unknown>): Promise<unknown> {
  if (!adConfigured()) {
    throw new Error('AD integration is not configured (AD_API_BASE_URL / AD_INTEGRATION_API_KEY missing)')
  }
  const resp = await axios.post(`${AD_BASE}/api/v1/integration/adc/atrs`, payload, {
    headers: { 'X-ADC-Integration-Key': AD_KEY },
    timeout: 15000,
  })
  return resp.data
}
