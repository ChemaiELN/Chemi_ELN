import { Router, Request, Response, NextFunction } from 'express'
import { Op, QueryTypes } from 'sequelize'
import { authenticate } from '../../middleware/auth.middleware'
import { successResponse } from '../../utils/response'
import { sequelize } from '../../database/connection'
import ExcelJS from 'exceljs'
import { ardReportHtml } from '../../utils/ardDocuments'
import { htmlToPdf } from '../../utils/pdfRenderer'

const router = Router()

// ── Report helpers ────────────────────────────────────────────────────────────

async function batchSummaryData() {
  // ard_atr_samples has no `tests` column — tests are rows in ard_test_requests keyed by
  // sample_id, so the counts are aggregated in SQL.
  const rows = await sequelize.query<any>(
    `SELECT f.form_no, f.product_name, s.batch_no, s.sample_code, f.status,
            COUNT(t.id) AS test_count,
            COUNT(t.id) FILTER (WHERE t.status IN ('VERIFIED', 'ACCEPTED')) AS verified_count
     FROM ard_atr_forms f
     JOIN ard_atr_samples s ON s.atr_form_id = f.id
     LEFT JOIN ard_test_requests t ON t.sample_id = s.id
     GROUP BY f.form_no, f.product_name, s.batch_no, s.sample_code, f.status, s.created_at
     ORDER BY s.created_at DESC`,
    { type: QueryTypes.SELECT }
  )
  return {
    headers: ['Form No', 'Product', 'Batch No', 'Sample Code', 'Tests', 'Verified', 'ATR Status'],
    rows: rows.map((r: any) => [
      r.form_no, r.product_name, r.batch_no, r.sample_code,
      Number(r.test_count ?? 0), Number(r.verified_count ?? 0), r.status,
    ]),
  }
}

async function unsatisfactoryTestsData() {
  const rows = await sequelize.query<any>(
    `SELECT f.form_no, f.product_name, s.sample_code, t.test_type, t.status, t.verify_remarks, t.withdraw_remarks
     FROM ard_test_requests t
     JOIN ard_atr_samples s ON t.sample_id = s.id
     JOIN ard_atr_forms f ON s.atr_form_id = f.id
     WHERE t.status IN ('VERIFICATION_REWORK', 'WITHDRAWN')`,
    { type: QueryTypes.SELECT }
  )
  return {
    headers: ['Form No', 'Product', 'Sample', 'Test Type', 'Status', 'Remarks'],
    rows: rows.map((r: any) => [r.form_no, r.product_name, r.sample_code, r.test_type, r.status, r.verify_remarks || r.withdraw_remarks || '']),
  }
}

async function experimentEventsData() {
  const rows = await sequelize.query<any>(
    `SELECT a.entity_id, a.action, a.user_id, a.created_at, e.code
     FROM ard_audit_log a
     LEFT JOIN ard_experiments e ON e.id::text = a.entity_id::text
     WHERE a.entity_type = 'EXPERIMENT'
     ORDER BY a.created_at DESC LIMIT 500`,
    { type: QueryTypes.SELECT }
  )
  const userIds = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))]
  let userMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const users = await sequelize.query<any>(
      `SELECT id, username FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
      { type: QueryTypes.SELECT, replacements: userIds }
    )
    userMap = Object.fromEntries(users.map((u: any) => [u.id, u.username]))
  }
  return {
    headers: ['Experiment', 'Action', 'By', 'At'],
    rows: rows.map((r: any) => [r.code || r.entity_id, r.action, userMap[r.user_id] || r.user_id, r.created_at]),
  }
}

async function delayedAtrsData(days: number) {
  const rows = await sequelize.query<any>(
    `SELECT form_no, product_name, status, created_by, created_at
     FROM ard_atr_forms
     WHERE status IN ('NEW','PENDING_CLARIFICATION','PENDING_APPROVAL','QA_PRE_APPROVAL','PRE_APPROVAL_REWORK')
       AND created_at <= NOW() - INTERVAL '${days} days'
     ORDER BY created_at ASC`,
    { type: QueryTypes.SELECT }
  )
  return {
    headers: ['Form No', 'Product', 'Status', 'Created By', 'Created At', 'Age (days)'],
    rows: rows.map((r: any) => {
      const age = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000)
      return [r.form_no, r.product_name, r.status, r.created_by, r.created_at, age]
    }),
  }
}

async function inactiveExperimentsData(days: number) {
  const rows = await sequelize.query<any>(
    `SELECT e.code, e.template_name, e.status, e.updated_at, u.username
     FROM ard_experiments e
     LEFT JOIN users u ON e.created_by_id = u.id
     WHERE e.status = 'IN_PROGRESS' AND e.updated_at <= NOW() - INTERVAL '${days} days'
     ORDER BY e.updated_at ASC`,
    { type: QueryTypes.SELECT }
  )
  return {
    headers: ['Code', 'Template', 'Status', 'Created By', 'Last Updated', 'Idle (days)'],
    rows: rows.map((r: any) => {
      const idle = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000)
      return [r.code, r.template_name, r.status, r.username, r.updated_at, idle]
    }),
  }
}

async function delayedApprovalsData(days: number) {
  const rows = await sequelize.query<any>(
    `SELECT e.code, e.template_name, e.updated_at, u.username
     FROM ard_experiments e
     LEFT JOIN users u ON e.created_by_id = u.id
     WHERE e.status = 'SUBMITTED' AND e.updated_at <= NOW() - INTERVAL '${days} days'
     ORDER BY e.updated_at ASC`,
    { type: QueryTypes.SELECT }
  )
  return {
    headers: ['Code', 'Template', 'Submitted By', 'Submitted At', 'Waiting (days)'],
    rows: rows.map((r: any) => {
      const waiting = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000)
      return [r.code, r.template_name, r.username, r.updated_at, waiting]
    }),
  }
}

async function projectReportData() {
  const projects = await sequelize.query<any>(
    `SELECT p.id, p.code, p.name, p.product_name, p.status, p.created_by, p.created_at
     FROM ard_projects p ORDER BY p.created_at DESC`,
    { type: QueryTypes.SELECT }
  )
  const rows = await Promise.all(projects.map(async (p: any) => {
    const [{ total }] = await sequelize.query<any>(
      `SELECT COUNT(*) AS total FROM ard_atr_forms WHERE project_code = $1`,
      { type: QueryTypes.SELECT, bind: [p.code] }
    )
    const [{ verified }] = await sequelize.query<any>(
      `SELECT COUNT(*) AS verified FROM ard_atr_forms WHERE project_code = $1 AND status IN ('VERIFIED','CERTIFIED')`,
      { type: QueryTypes.SELECT, bind: [p.code] }
    )
    const [{ exps }] = await sequelize.query<any>(
      `SELECT COUNT(*) AS exps FROM ard_experiments WHERE project_id = $1`,
      { type: QueryTypes.SELECT, bind: [p.id] }
    )
    return [p.code, p.name, p.status, p.created_by, p.created_at, total, verified, exps]
  }))
  return {
    headers: ['Project Code', 'Name', 'Status', 'Owner', 'Created', 'Total ATRs', 'Verified ATRs', 'Experiments'],
    rows,
  }
}

async function toExcel(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Report')
  ws.addRow(headers)
  rows.forEach(r => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

function buildRoute(
  path: string,
  getData: (req: Request) => Promise<{ headers: string[]; rows: any[][] }>
) {
  router.get(path, authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await getData(req)
      if (path.endsWith('.xlsx')) {
        const buf = await toExcel(data.headers, data.rows)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', `attachment; filename="report.xlsx"`)
        res.send(buf)
      } else if (path.endsWith('.pdf')) {
        const reportName = path.replace(/^\//, '').replace('.pdf', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        const html = ardReportHtml(reportName, data.headers, data.rows, {})
        const buf = await htmlToPdf(html)
        res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="report.pdf"` })
        res.send(buf)
      } else {
        res.json(successResponse('Report data', data))
      }
    } catch (err) { next(err) }
  })
}

const daysParam = (req: Request, def: number) => Math.max(1, parseInt((req.query as any).days || String(def), 10))

buildRoute('/batch-summary', () => batchSummaryData())
buildRoute('/batch-summary.xlsx', () => batchSummaryData())
buildRoute('/batch-summary.pdf', () => batchSummaryData())

buildRoute('/unsatisfactory-tests', () => unsatisfactoryTestsData())
buildRoute('/unsatisfactory-tests.xlsx', () => unsatisfactoryTestsData())
buildRoute('/unsatisfactory-tests.pdf', () => unsatisfactoryTestsData())

buildRoute('/experiment-events', () => experimentEventsData())
buildRoute('/experiment-events.xlsx', () => experimentEventsData())
buildRoute('/experiment-events.pdf', () => experimentEventsData())

buildRoute('/delayed-atrs', (req) => delayedAtrsData(daysParam(req, 7)))
buildRoute('/delayed-atrs.xlsx', (req) => delayedAtrsData(daysParam(req, 7)))
buildRoute('/delayed-atrs.pdf', (req) => delayedAtrsData(daysParam(req, 7)))

buildRoute('/inactive-experiments', (req) => inactiveExperimentsData(daysParam(req, 14)))
buildRoute('/inactive-experiments.xlsx', (req) => inactiveExperimentsData(daysParam(req, 14)))
buildRoute('/inactive-experiments.pdf', (req) => inactiveExperimentsData(daysParam(req, 14)))

buildRoute('/delayed-approvals', (req) => delayedApprovalsData(daysParam(req, 3)))
buildRoute('/delayed-approvals.xlsx', (req) => delayedApprovalsData(daysParam(req, 3)))
buildRoute('/delayed-approvals.pdf', (req) => delayedApprovalsData(daysParam(req, 3)))

buildRoute('/project-report', () => projectReportData())
buildRoute('/project-report.xlsx', () => projectReportData())
buildRoute('/project-report.pdf', () => projectReportData())

export default router
