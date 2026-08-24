/**
 * Analyst-qualification helpers — port of backend/app/shared/ard_qualifications.py.
 */
import { ArdAnalystQualification, ArdTestConfiguration } from '../models/index'
import { BadRequestError } from '../utils/errors'

function parseDate(value: unknown): Date | null {
  if (!value) return null
  const raw = String(value).slice(0, 10)
  const ms = Date.parse(`${raw}T00:00:00Z`)
  return Number.isNaN(ms) ? null : new Date(ms)
}

export function qualificationActive(entry: Record<string, unknown>, today?: Date): boolean {
  const day = today ?? new Date()
  const todayIso = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const start = parseDate(entry.startDate)
  const end = parseDate(entry.endDate)
  if (start && todayIso < start) return false
  if (end && todayIso > end) return false
  return true
}

function entryTechnique(entry: Record<string, unknown>): string | null {
  const key = entry.techniqueId ?? entry.techniqueCode ?? entry.technique
  return key != null && String(key) !== '' ? String(key) : null
}

export async function resolveTestTechniqueKey(test: { techniqueCode?: string | null; testConfigId?: string | null }): Promise<string | null> {
  if (test.techniqueCode) return test.techniqueCode
  if (test.testConfigId) {
    const config = await (ArdTestConfiguration as any).findByPk(test.testConfigId)
    if (config?.techniqueCode) return config.techniqueCode as string
  }
  return null
}

export async function techniqueHasQualificationRecords(techniqueKey: string): Promise<boolean> {
  const rows = await (ArdAnalystQualification as any).findAll()
  return rows.some((q: any) =>
    ((q.techniqueEntries as any[]) || []).some((e: any) => entryTechnique(e) === techniqueKey),
  )
}

export async function listQualifiedAnalystIds(techniqueKey: string): Promise<Set<string>> {
  const ids = new Set<string>()
  const rows = await (ArdAnalystQualification as any).findAll()
  for (const q of rows) {
    for (const entry of ((q.techniqueEntries as any[]) || [])) {
      if (entryTechnique(entry) === techniqueKey && qualificationActive(entry)) {
        ids.add(String(q.userId))
      }
    }
  }
  return ids
}

export async function assertAnalystQualifiedForTest(analystId: string, test: { techniqueCode?: string | null; testConfigId?: string | null }): Promise<void> {
  const techniqueKey = await resolveTestTechniqueKey(test)
  if (!techniqueKey) return
  if (!(await techniqueHasQualificationRecords(techniqueKey))) return
  const qualified = await listQualifiedAnalystIds(techniqueKey)
  if (!qualified.has(String(analystId))) {
    throw new BadRequestError(
      `Analyst is not certified for technique '${techniqueKey}' or certification has expired. ` +
      'Assign a qualified analyst or update qualification records.',
    )
  }
}
