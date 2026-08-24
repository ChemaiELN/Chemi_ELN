/**
 * Unit tests for the wire-format casing bridge.
 */
import { snakeCase, camelCase, toSnakeCaseDeep, keepsCamelCase } from '../middleware/caseNormalize.middleware'

describe('snakeCase', () => {
  it('converts camelCase', () => {
    expect(snakeCase('materialType')).toBe('material_type')
    expect(snakeCase('qtyAvailable')).toBe('qty_available')
  })

  it('leaves already-snake keys alone', () => {
    expect(snakeCase('material_type')).toBe('material_type')
    expect(snakeCase('id')).toBe('id')
  })

  it('handles acronyms and digits', () => {
    expect(snakeCase('casNo')).toBe('cas_no')
    expect(snakeCase('coaFilePath')).toBe('coa_file_path')
    expect(snakeCase('molWeight')).toBe('mol_weight')
  })
})

describe('camelCase', () => {
  it('converts snake_case', () => {
    expect(camelCase('target_kind')).toBe('targetKind')
    expect(camelCase('sort_by')).toBe('sortBy')
    expect(camelCase('item_sr_no')).toBe('itemSrNo')
  })
})

describe('toSnakeCaseDeep', () => {
  it('converts nested objects and arrays', () => {
    const input = { materialType: 'RM', packs: [{ qtyPerPack: 5, batchId: 1 }] }
    expect(toSnakeCaseDeep(input)).toEqual({
      material_type: 'RM',
      packs: [{ qty_per_pack: 5, batch_id: 1 }],
    })
  })

  it('preserves keys the frontend declares in camelCase', () => {
    const out = toSnakeCaseDeep({ pageSize: 10, total: 2, formNo: 'ATR-1' }) as Record<string, unknown>
    expect(out.pageSize).toBe(10)
    expect(out.formNo).toBe('ATR-1')
    expect(out.page_size).toBeUndefined()
  })

  it('preserves path-scoped keys (e.g. doneBy/checkedBy) only when passed explicitly', () => {
    const out = toSnakeCaseDeep({ doneBy: 'x' }, 0, new Set(['doneBy', 'checkedBy'])) as Record<string, unknown>
    expect(out.doneBy).toBe('x')
    expect(out.done_by).toBeUndefined()
  })

  it('leaves an opaque value key\'s inner keys untouched', () => {
    const out = toSnakeCaseDeep(
      { workbookData: { cellData: { rowCount: 5 } }, name: 'Sheet' },
      0,
      undefined,
      new Set(['workbookData']),
    ) as Record<string, unknown>
    expect(out.name).toBe('Sheet')
    const wb = out.workbook_data as Record<string, unknown>
    expect(wb).toBeDefined()
    expect((wb.cellData as Record<string, unknown>).rowCount).toBe(5)
    expect(wb.cell_data).toBeUndefined()
  })

  it('leaves a template_snapshot\'s DSL keys camelCase so runtime field controls still match', () => {
    const snapshot = {
      sections: [{
        screens: [{
          fields: [{
            type: 'DROPDOWN',
            optionsMode: 'inventory',
            inventorySource: { source: 'materials', valueField: 'code', labelField: 'name' },
          }],
        }],
      }],
    }
    const out = toSnakeCaseDeep(
      { templateSnapshot: snapshot, notebookCode: 'NB-1' },
      0,
      undefined,
      new Set(['templateSnapshot', 'template_snapshot']),
    ) as Record<string, unknown>
    // The key itself still snake_cases (the frontend reads nb.template_snapshot)…
    expect(out.notebook_code).toBe('NB-1')
    const snap = out.template_snapshot as any
    expect(snap).toBeDefined()
    // …but the DSL inside it must survive verbatim.
    const field = snap.sections[0].screens[0].fields[0]
    expect(field.optionsMode).toBe('inventory')
    expect(field.options_mode).toBeUndefined()
    expect(field.inventorySource.labelField).toBe('name')
    expect(field.inventorySource.label_field).toBeUndefined()
  })

  it('leaves Date values intact rather than walking them', () => {
    const d = new Date('2026-01-01T00:00:00.000Z')
    const out = toSnakeCaseDeep({ createdAt: d }) as Record<string, unknown>
    expect(out.created_at).toBe(d)
  })

  it('passes primitives and null through', () => {
    expect(toSnakeCaseDeep(null)).toBeNull()
    expect(toSnakeCaseDeep(5)).toBe(5)
    expect(toSnakeCaseDeep('str')).toBe('str')
  })

  it('converts a top-level array of records', () => {
    expect(toSnakeCaseDeep([{ assetCode: 'EQ-1' }])).toEqual([{ asset_code: 'EQ-1' }])
  })
})

describe('keepsCamelCase', () => {
  it('exempts ARD routes', () => {
    expect(keepsCamelCase('/api/ard/atrs')).toBe(true)
    expect(keepsCamelCase('/api/ard')).toBe(true)
  })

  it('does not exempt other routes', () => {
    expect(keepsCamelCase('/api/inventory/materials')).toBe(false)
    expect(keepsCamelCase('/api/auth/me')).toBe(false)
    // Must not match on a shared prefix that isn't a path boundary.
    expect(keepsCamelCase('/api/ardent')).toBe(false)
  })
})
