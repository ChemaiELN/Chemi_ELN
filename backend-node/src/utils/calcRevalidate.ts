/**
 * Calls backend/calc_revalidate/revalidate.js via child_process to recalculate
 * output fields given a set of input values. Mirrors revalidate.py.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { BadRequestError } from './errors'

const execFileAsync = promisify(execFile)

// revalidate.js lives two directories above backend-node (in backend/calc_revalidate)
const REVALIDATE_SCRIPT = path.resolve(__dirname, '..', '..', '..', 'backend', 'calc_revalidate', 'revalidate.js')

interface IRange {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

interface Field {
  key: string
  role: 'input' | 'output'
  sheetId: string
  range: IRange
  [k: string]: unknown
}

interface FieldMetadata {
  fields: Field[]
  protectedRanges?: Array<{ sheetId: string; range: IRange }>
}

function rangesIntersect(a: IRange, b: IRange): boolean {
  return !(a.endRow < b.startRow || a.startRow > b.endRow ||
           a.endColumn < b.startColumn || a.startColumn > b.endColumn)
}

export async function revalidateSubmission(
  workbookData: unknown,
  fieldMetadata: FieldMetadata,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const fields: Field[] = fieldMetadata.fields || []
  const protectedRanges = fieldMetadata.protectedRanges || []

  const inputFields = fields.filter(f => f.role === 'input')
  const outputFields = fields.filter(f => f.role === 'output')
  const inputKeys = new Set(inputFields.map(f => f.key))

  // Validate all submitted keys are known input fields
  const unknownKeys = Object.keys(values).filter(k => !inputKeys.has(k))
  if (unknownKeys.length > 0) {
    throw new BadRequestError(`Unknown input field keys: ${unknownKeys.join(', ')}`, 'UNKNOWN_KEYS')
  }

  // Check no input field overlaps a protected range
  for (const f of inputFields) {
    if (!(f.key in values)) continue
    for (const pr of protectedRanges) {
      if (pr.sheetId === f.sheetId && rangesIntersect(f.range, pr.range)) {
        throw new BadRequestError(
          `Input field "${f.key}" overlaps a protected range — template authoring error`,
          'PROTECTED_RANGE_OVERLAP'
        )
      }
    }
  }

  const payload = JSON.stringify({ workbook_data: workbookData, inputFields, outputFields, values })

  try {
    const raw = await execFileAsync('node', [REVALIDATE_SCRIPT], {
      input: payload,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    } as any) as unknown as { stdout: string; stderr: string }
    const { stdout, stderr } = raw

    if (!stdout?.trim()) {
      const detail = (stderr as string | undefined)?.slice(-2000) || ''
      throw new BadRequestError(`Revalidation produced no output. stderr: ${detail}`, 'REVALIDATION_FAILED')
    }

    let result: any
    try {
      result = JSON.parse(stdout)
    } catch {
      throw new BadRequestError(`Revalidation output is not valid JSON: ${stdout.slice(0, 500)}`, 'REVALIDATION_FAILED')
    }

    if (!result?.ok) {
      throw new BadRequestError(result?.error || 'Revalidation failed', 'REVALIDATION_FAILED')
    }

    return result.outputs || {}
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err
    if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new BadRequestError('Revalidation output exceeded buffer limit', 'REVALIDATION_FAILED')
    }
    if (err.killed || err.signal === 'SIGTERM') {
      throw new BadRequestError('Revalidation timed out (30s)', 'REVALIDATION_TIMEOUT')
    }
    throw new BadRequestError(`Revalidation error: ${err.message}`, 'REVALIDATION_FAILED')
  }
}
