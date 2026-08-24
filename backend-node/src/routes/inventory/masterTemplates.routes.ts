import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { NotFoundError } from '../../utils/errors'

const router = Router()

const TEMPLATES_DIR = process.env.MASTER_TEMPLATES_DIR || path.join(process.cwd(), 'uploads', 'excel_templates')

/**
 * Column headers per template, in the exact positional order each bulk-upload
 * parser reads them (the parsers index row.values by column number, so order
 * is the contract — not the header text).
 *
 * Templates used to be static .xlsx files expected to already exist in
 * TEMPLATES_DIR; that directory was never populated, so every "Download
 * Template" returned 404. They're now generated on demand from these
 * definitions, which also keeps the headers from drifting away from the
 * parsers as columns change. A file placed in TEMPLATES_DIR still wins, so a
 * hand-curated workbook (validation dropdowns, sample rows, notes) can
 * override the generated one without a code change.
 */
const TEMPLATES = [
  {
    key: 'maintenance-planner',
    name: 'Maintenance Planner Template',
    filename: 'maintenance_planner_template.xlsx',
    sheet: 'Maintenance Planner',
    // schedules.routes.ts POST /upload — targetKind/logType come from the query
    // string, so the sheet only carries the per-row fields.
    columns: ['Asset Code', 'Schedule Type (MONTHLY|QUARTERLY|HALF_YEARLY|YEARLY)', 'Due Date (YYYY-MM-DD)'],
  },
  {
    key: 'calibration-planner',
    name: 'Calibration Planner Template',
    filename: 'calibration_planner_template.xlsx',
    sheet: 'Calibration Planner',
    columns: ['Asset Code', 'Schedule Type (MONTHLY|QUARTERLY|HALF_YEARLY|YEARLY)', 'Due Date (YYYY-MM-DD)'],
  },
  {
    key: 'materials',
    name: 'Materials Bulk Upload Template',
    filename: 'materials_template.xlsx',
    sheet: 'Materials',
    columns: [
      'Name *', 'Material Type', 'CAS No', 'Molecular Formula', 'Mol. Weight',
      'Storage Condition', 'Hazard Class', 'Consumable Type', 'Description',
    ],
  },
  {
    key: 'manufacturers',
    name: 'Manufacturers Bulk Upload Template',
    filename: 'manufacturers_template.xlsx',
    sheet: 'Manufacturers',
    columns: ['Code *', 'Name *', 'Country', 'Contact Person', 'Email', 'Phone', 'Website', 'Address'],
  },
  {
    key: 'mappings',
    name: 'Manufacturer Mapping Bulk Upload Template',
    filename: 'mappings_template.xlsx',
    sheet: 'Manufacturer Mappings',
    columns: [
      'Material Code *', 'Manufacturer Code *', 'Catalogue No', 'Technical Grade',
      'Lead Time (days)', 'Min Order Qty',
    ],
  },
  {
    key: 'equipment-catalogue',
    name: 'Equipment Bulk Upload Template',
    filename: 'equipment_catalogue_template.xlsx',
    sheet: 'Equipment',
    columns: [
      'Equipment Code *', 'Name *', 'Equipment Type', 'Make', 'Model',
      'Serial No', 'Lab', 'Usage Type', 'Description',
    ],
  },
  {
    key: 'instrument-catalogue',
    name: 'Instrument Bulk Upload Template',
    filename: 'instrument_catalogue_template.xlsx',
    sheet: 'Instruments',
    columns: [
      'Instrument Code *', 'Name *', 'Instrument Type', 'Make', 'Model',
      'Serial No', 'Lab', 'Usage Type', 'Lower Operating Range', 'Lower UOM',
      'Upper Operating Range', 'Upper UOM', 'Required Calibration (YES/NO)', 'Description',
    ],
  },
]

// GET /api/inventory/master-templates
router.get('/', authenticate, (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(successResponse('Master templates', TEMPLATES.map(t => ({ key: t.key, name: t.name, filename: t.filename }))))
  } catch (err) { next(err) }
})

// GET /api/inventory/master-templates/:key/download
router.get('/:key/download', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tmpl = TEMPLATES.find(t => t.key === req.params.key)
    if (!tmpl) throw new NotFoundError('Master template')

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${tmpl.filename}"`)

    // A curated workbook on disk takes precedence over the generated one.
    const filePath = path.join(TEMPLATES_DIR, tmpl.filename)
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath)
      return
    }

    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(tmpl.sheet)
    ws.addRow(tmpl.columns)
    ws.getRow(1).font = { bold: true }
    ws.columns = tmpl.columns.map((c) => ({ width: Math.max(16, Math.min(40, c.length + 4)) }))

    const buffer = await wb.xlsx.writeBuffer()
    res.end(Buffer.from(buffer))
  } catch (err) { next(err) }
})

export default router
