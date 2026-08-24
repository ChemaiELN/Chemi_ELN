import { QueryTypes } from 'sequelize'
import { sequelize } from '../database/connection'
import { IdSequenceConfig, IdSequenceCounter } from '../models/IdSequence.model'
import { BadRequestError } from './errors'

/**
 * Generate next sequential ID using SELECT FOR UPDATE to prevent race conditions.
 * Equivalent to the FastAPI id_sequences module.
 */
export async function generateNextSequenceValue(code: string): Promise<{
  value: string
  code: string
  sequence: number
}> {
  const configRecord = await IdSequenceConfig.findOne({ where: { code, isActive: true } })
  if (!configRecord) {
    throw new BadRequestError(`ID sequence configuration '${code}' not found.`, 'SEQUENCE_NOT_FOUND')
  }

  const t = await sequelize.transaction()
  try {
    const now = new Date()
    const fullYear = now.getFullYear()
    const year = configRecord.yearDigits === 4 ? fullYear : fullYear % 100
    const period = null // can be extended for period-based sequences

    // SELECT FOR UPDATE to prevent concurrent duplicates. Raw queries return
    // the DB's snake_case column names (last_value), not the Sequelize
    // model's camelCase attribute (lastValue) — alias it explicitly, or
    // `counterRows.lastValue` below silently reads undefined and the
    // increment becomes NaN.
    const [counterRows] = await sequelize.query(
      `SELECT id, last_value AS "lastValue" FROM id_sequence_counters WHERE config_id = :configId AND year IS NOT DISTINCT FROM :year AND period IS NOT DISTINCT FROM :period FOR UPDATE`,
      {
        replacements: { configId: configRecord.id, year: configRecord.includeYear ? year : null, period },
        type: QueryTypes.SELECT,
        transaction: t,
      },
    ) as [{ id: string; lastValue: number } | undefined]

    let counter: IdSequenceCounter
    if (!counterRows) {
      // Create new counter row
      counter = await IdSequenceCounter.create({
        configId: configRecord.id,
        year: configRecord.includeYear ? year : null,
        period,
        lastValue: 1,
      }, { transaction: t })
    } else {
      const nextVal = counterRows.lastValue + 1
      await IdSequenceCounter.update(
        { lastValue: nextVal },
        { where: { id: counterRows.id }, transaction: t },
      )
      counter = { ...counterRows, lastValue: nextVal } as IdSequenceCounter
    }

    const seq = counter.lastValue
    const seqStr = String(seq).padStart(configRecord.sequenceDigits, '0')
    const sep = configRecord.separator || '/'

    const parts: string[] = []
    if (configRecord.prefix) parts.push(configRecord.prefix)
    if (configRecord.includeYear) parts.push(String(year))
    parts.push(seqStr)

    const value = parts.join(sep)
    await t.commit()
    return { value, code, sequence: seq }
  } catch (err) {
    await t.rollback()
    throw err
  }
}

/**
 * Generate ATR number: ATR/{year}/{MMDD}/{seq:03d}
 *
 * Derived directly from the max existing form_no for today (like
 * generateArdExperimentCode below) rather than the id_sequence_counters
 * table, since that table has no seeded 'ATR' config in some environments —
 * relying on it silently returned seq=1 forever and collided with the
 * unique constraint on ard_atr_forms.form_no (409 Conflict on every create
 * after the first ATR of the day).
 */
export async function generateAtrNumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const mmdd = `${mm}${dd}`
  const pattern = `ATR/${year}/${mmdd}/%`

  const t = await sequelize.transaction()
  try {
    const [rows] = await sequelize.query(
      `SELECT MAX(CAST(SPLIT_PART(form_no, '/', 4) AS INTEGER)) AS last_seq
       FROM ard_atr_forms
       WHERE form_no LIKE :pattern`,
      {
        replacements: { pattern },
        type: QueryTypes.SELECT,
        transaction: t,
      },
    ) as [{ last_seq: number | null }]

    const seq = (rows?.last_seq || 0) + 1

    await t.commit()
    return `ATR/${year}/${mmdd}/${String(seq).padStart(3, '0')}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}

/**
 * Generate the next ARD ATR sample code, honoring whatever format is
 * configured under Admin > ID Numbering (code ARD_ATR_SAMPLE_CODE) — auto-
 * creates the config on first use (prefix SMP, yearly reset, 4-digit year,
 * 4-digit sequence — e.g. SMP-2026-0001) if an admin hasn't already set one up.
 */
export async function generateAtrSampleCode(): Promise<string> {
  const existing = await IdSequenceConfig.findOne({ where: { code: 'ARD_ATR_SAMPLE_CODE' } })
  if (!existing) {
    await IdSequenceConfig.create({
      code: 'ARD_ATR_SAMPLE_CODE',
      label: 'ARD ATR Sample Code',
      prefix: 'SMP',
      separator: '-',
      includeYear: true,
      yearDigits: 4,
      sequenceDigits: 4,
      resetYearly: true,
      isActive: true,
      createdBy: null,
    })
  }
  const { value } = await generateNextSequenceValue('ARD_ATR_SAMPLE_CODE')
  return value
}

/**
 * Generate ARD experiment code: EXP-{year}-{seq:05d}
 */
export async function generateArdExperimentCode(): Promise<string> {
  const year = new Date().getFullYear()
  const t = await sequelize.transaction()
  try {
    const [rows] = await sequelize.query(
      `SELECT MAX(CAST(SPLIT_PART(code, '-', 3) AS INTEGER)) AS last_seq
       FROM ard_experiments
       WHERE code LIKE :pattern`,
      {
        replacements: { pattern: `EXP-${year}-%` },
        type: QueryTypes.SELECT,
        transaction: t,
      },
    ) as [{ last_seq: number | null }]

    const nextSeq = (rows?.last_seq || 0) + 1
    await t.commit()
    return `EXP-${year}-${String(nextSeq).padStart(5, '0')}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}

/**
 * Generate AR test number: E-{TECH}{MMYY}/{seq:03d}
 */
export async function generateArTestNumber(techniqueKey: string): Promise<string> {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const tech = (techniqueKey || 'GEN').slice(0, 6).toUpperCase()
  const prefix = `E-${tech}${mm}${yy}`

  const t = await sequelize.transaction()
  try {
    const [rows] = await sequelize.query(
      `SELECT MAX(CAST(SPLIT_PART(ar_number, '/', 2) AS INTEGER)) AS last_seq
       FROM ard_test_requests
       WHERE ar_number LIKE :pattern`,
      {
        replacements: { pattern: `${prefix}/%` },
        type: QueryTypes.SELECT,
        transaction: t,
      },
    ) as [{ last_seq: number | null }]

    const nextSeq = (rows?.last_seq || 0) + 1
    await t.commit()
    return `${prefix}/${String(nextSeq).padStart(3, '0')}`
  } catch (err) {
    await t.rollback()
    throw err
  }
}
