import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import fs from 'fs'
import { config } from './config'
import { connectDatabase } from './database/connection'
import { logger } from './utils/logger'
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware'
import { normalizeRequestCase, snakeCaseResponse } from './middleware/caseNormalize.middleware'

// Import all models to register associations
import './models/index'

// Route imports
import authRouter from './routes/auth.routes'
import usersRouter from './routes/users.routes'
import departmentsRouter from './routes/departments.routes'
import labsRouter from './routes/labs.routes'
import rolesRouter, { rolePrivRouter } from './routes/roles.routes'
import deptRolePrivilegesRouter from './routes/deptRolePrivileges.routes'
import adminRouter from './routes/admin.routes'
import adminAuditTrailRouter from './routes/adminAuditTrail.routes'
import adminDashboardRouter from './routes/adminDashboard.routes'
import loginIssuesRouter from './routes/loginIssues.routes'
import masterDataRouter from './routes/masterData.routes'
import sseRouter from './routes/sse.routes'

const app = express()

// ── Security / Infra Middleware ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-ADC-Integration-Key'],
}))

app.use(morgan(config.isDev ? 'dev' : 'combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}))

app.use(express.json({ limit: `${config.maxBodyBytes}b` }))
app.use(express.urlencoded({ extended: true }))

// ── Wire-format casing bridge ────────────────────────────────────────────────
// The frontend speaks snake_case (it was written against the FastAPI backend) while
// Sequelize models are camelCase. These translate at the edge so routes can keep
// using camelCase attributes. Must sit after the body parser and before the routes.
app.use(normalizeRequestCase)
app.use(snakeCaseResponse)

// ── Static file serving for uploads ─────────────────────────────────────────
const uploadDir = path.resolve(config.uploadDir)
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
// Note: files are served via res.download(), not static hosting, to maintain auth

// ── Logs directory ──────────────────────────────────────────────────────────
if (!fs.existsSync('logs')) fs.mkdirSync('logs', { recursive: true })

// ── API Routes ───────────────────────────────────────────────────────────────
const api = '/api'

// Health endpoint — required by load balancers and k8s liveness probes
app.get(`${api}/health`, (_req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version ?? '1.0.0', timestamp: new Date().toISOString() })
})

app.use(`${api}/auth`, authRouter)
app.use(`${api}/users`, usersRouter)
app.use(`${api}/departments`, departmentsRouter)
app.use(`${api}/labs`, labsRouter)
app.use(`${api}/roles`, rolesRouter)
app.use(`${api}/role-privileges`, rolePrivRouter)
app.use(`${api}/department-role-privileges`, deptRolePrivilegesRouter)
app.use(`${api}/admin`, adminRouter)
app.use(`${api}/admin/audit-trail`, adminAuditTrailRouter)
app.use(`${api}/admin/dashboard`, adminDashboardRouter)
app.use(`${api}/login-issues`, loginIssuesRouter)
app.use(`${api}/master-data`, masterDataRouter)
app.use(`${api}/sse`, sseRouter)

// ID sequences (alternate path)
app.use(`${api}/id-sequences`, (req, _res, next) => {
  // Remap /id-sequences/:code/next to admin router
  req.url = `/id-sequences-next${req.url.replace(/\/next$/, '')}`
  next()
}, adminRouter)

// ── Lazy-load optional routes (registered after module resolution) ────────────
// These are imported dynamically to handle cases where route files may not exist yet
async function loadOptionalRoutes() {
  const optionalRoutes: Array<{ path: string; file: string; namedExport?: string }> = [
    { path: `${api}/projects`, file: './routes/projects.routes' },
    { path: `${api}`, file: './routes/notebooks.routes' },
    { path: `${api}`, file: './routes/experiments.routes' },
    { path: `${api}/workflow-templates`, file: './routes/workflowTemplates.routes' },
    { path: `${api}/calc-templates`, file: './routes/workflowTemplates.routes', namedExport: 'calcTemplateRouter' },
    { path: `${api}/template-settings`, file: './routes/templateSettings.routes' },
    { path: api, file: './routes/cgt.routes' },
    { path: `${api}/ard/atrs`, file: './routes/ard/atrs.routes' },
    { path: `${api}/ard/tests`, file: './routes/ard/ardTests.routes' },
    { path: `${api}/ard/experiments`, file: './routes/ard/ardExperiments.routes' },
    { path: `${api}/ard/templates`, file: './routes/ard/ardTemplates.routes' },
    { path: `${api}/ard/sections`, file: './routes/ard/ardSections.routes' },
    { path: `${api}/ard/data-items`, file: './routes/ard/ardDataItems.routes' },
    { path: `${api}/ard/uploads`, file: './routes/ard/ardUploads.routes' },
    { path: `${api}/ard/master-data`, file: './routes/ard/ardMasterData.routes' },
    { path: `${api}/ard`, file: './routes/ard/ardDashboard.routes' },
    { path: `${api}/ard/search`, file: './routes/ard/ardSearch.routes' },
    { path: `${api}/ard/qc-trf`, file: './routes/ard/ardQcTrf.routes' },
    { path: `${api}/ard/notifications`, file: './routes/ard/ardNotifications.routes' },
    { path: `${api}/ard/notebooks`, file: './routes/ard/ardNotebooks.routes' },
    { path: `${api}/ard/projects`, file: './routes/ard/ardProjects.routes' },
    { path: `${api}/ard/reports`, file: './routes/ard/ardReporting.routes' },
    { path: `${api}/ard/audit`, file: './routes/ard/ardAudit.routes' },
    { path: `${api}/ard/team`, file: './routes/ard/ardTeam.routes' },
    { path: `${api}/inventory`, file: './routes/inventory/index' },
    { path: `${api}/adc`, file: './routes/adc.routes' },
    // Also mounted at /api because the frontend calls the experiment-scoped ADC
    // actions as /api/experiments/:id/submit-to-ad and .../ad-results, matching
    // FastAPI's exp_router. Registered after experiments.routes so that router's
    // own paths win.
    { path: api, file: './routes/adc.routes' },
  ]

  for (const route of optionalRoutes) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(route.file)
      const router = route.namedExport ? mod[route.namedExport] : (mod.default || mod)
      if (router && typeof router === 'function') {
        app.use(route.path, router)
      }
    } catch {
      logger.warn(`Optional route ${route.file} not loaded — file may not exist yet`)
    }
  }
}

// ── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await connectDatabase()
    await loadOptionalRoutes()

    // Error handlers must be registered AFTER all routes (including lazy-loaded ones)
    app.use(notFoundMiddleware)
    app.use(errorMiddleware)

    app.listen(config.port, () => {
      logger.info(`Laurus ELN backend running on port ${config.port} [${config.nodeEnv}]`)
    })
  } catch (err) {
    logger.error('Failed to start server', err)
    process.exit(1)
  }
}

start()

export default app
