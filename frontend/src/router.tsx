import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from './store'
import { useIsAdcAssignedOnly } from './hooks/useAdcLanding'
import { selectIsAuthenticated, selectUser, selectAuthInitialized, selectAccessToken } from './store/authSlice'

import LoginPage from './pages/auth/LoginPage'
import ReportLoginIssuePage from './pages/auth/ReportLoginIssuePage'
import ModuleSelectorPage from './pages/ModuleSelectorPage'
import AppShell from './components/layout/AppShell'
import InventoryShell from './components/layout/InventoryShell'
import AdcShell from './components/layout/AdcShell'
import CgtShell from './components/layout/CgtShell'
import ArdShell from './components/layout/ArdShell'

import UsersPage from './pages/admin/UsersPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import DepartmentUsersPage from './pages/admin/DepartmentUsersPage'
import DepartmentRolePrivilegesPage from './pages/admin/DepartmentRolePrivilegesPage'
import LabsPage from './pages/admin/LabsPage'
import RolePrivilegesPage from './pages/admin/RolePrivilegesPage'
import SettingsPage from './pages/admin/SettingsPage'
import AdminAuditTrailPage from './pages/admin/AuditTrailPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import TemplateBuilderPage from './pages/admin/templateBuilder/TemplateBuilderPage'
import CalcTemplatesPage from './pages/admin/calcTemplates/CalcTemplatesPage'
import CalcTemplateBuilderPage from './pages/admin/calcTemplates/CalcTemplateBuilderPage'
import FillCalcTemplatePage from './pages/admin/calcTemplates/FillCalcTemplatePage'
import InventoryMasterDataPage from './pages/inventory/InventoryMasterDataPage'
import MasterDataTypesPage from './pages/inventory/MasterDataTypesPage'
import IdSequencesPage from './pages/admin/IdSequencesPage'
import TemplateSettingsPage from './pages/admin/TemplateSettingsPage'
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import MaterialsPage from './pages/inventory/MaterialsPage'
import BatchesPage from './pages/inventory/BatchesPage'
import NonAvailableBatchesPage from './pages/inventory/NonAvailableBatchesPage'
import HistoricBatchesPage from './pages/inventory/HistoricBatchesPage'
import StockRequestsPage from './pages/inventory/StockRequestsPage'
import ManufacturersPage from './pages/inventory/ManufacturersPage'
import MappingsPage from './pages/inventory/MappingsPage'
import EquipmentPage from './pages/inventory/EquipmentPage'
import ColumnsPage from './pages/inventory/ColumnsPage'
import EquipmentDetailPage from './pages/inventory/EquipmentDetailPage'
import InstrumentDetailPage from './pages/inventory/InstrumentDetailPage'
import ChecklistsPage from './pages/inventory/ChecklistsPage'
import ChecklistBuilderPage from './pages/inventory/ChecklistBuilderPage'
import MaintenanceCalibrationPlannerPage from './pages/inventory/MaintenanceCalibrationPlannerPage'
import MaintenanceCalibrationRequestsPage from './pages/inventory/MaintenanceCalibrationRequestsPage'
import WorkOrdersQueuePage from './pages/inventory/WorkOrdersQueuePage'
import WorkOrderExecutionPage from './pages/inventory/WorkOrderExecutionPage'
import GatePassListPage from './pages/inventory/GatePassListPage'
import GatePassDetailPage from './pages/inventory/GatePassDetailPage'
import GatePassFormPage from './pages/inventory/GatePassFormPage'
import GatePassReturnsPage from './pages/inventory/GatePassReturnsPage'
import ReturnEntryPage from './pages/inventory/ReturnEntryPage'
import GatePassPrintPage from './pages/inventory/GatePassPrintPage'
import GatePassReportsPage from './pages/inventory/GatePassReportsPage'
import UsageLogsPage from './pages/inventory/UsageLogsPage'
import ReportsPage from './pages/inventory/ReportsPage'
import AuditTrailPage from './pages/inventory/AuditTrailPage'
import AdcProjectsPage from './pages/adc/AdcProjectsPage'
import AdcPdHodProjectsPage from './pages/adc/AdcPdHodProjectsPage'
import AdcProjectDetailPage from './pages/adc/AdcProjectDetailPage'
import AdcNotebookPage from './pages/adc/AdcNotebookPage'
import AdcSectionPage from './pages/adc/AdcSectionPage'
import AdcNotebookPrintPage from './pages/adc/AdcNotebookPrintPage'
import AdcExperimentsPage from './pages/adc/AdcExperimentsPage'
import AdcReportsPage from './pages/adc/AdcReportsPage'
import AdcPdChemDashboard from './pages/adc/AdcPdChemDashboard'
import AdcAtrListPage from './pages/adc/AdcAtrListPage'
import MyArdAtrsPage from './pages/shared/MyArdAtrsPage'
import NotebooksPage from './pages/notebooks/NotebooksPage'
import NotebookOverviewPage from './pages/notebooks/NotebookOverviewPage'
import ExperimentViewerRouter from './pages/notebooks/ExperimentViewerRouter'
import CgtProjectsPage from './pages/cgt/CgtProjectsPage'
import CgtProjectDetailPage from './pages/cgt/CgtProjectDetailPage'
import CgtNotebookPage from './pages/cgt/CgtNotebookPage'
import CgtSectionPage from './pages/cgt/CgtSectionPage'
import CgtNotebooksPage from './pages/cgt/CgtNotebooksPage'
import CgtExperimentsPage from './pages/cgt/CgtExperimentsPage'
import CgtReportsPage from './pages/cgt/CgtReportsPage'
import CgtChemDashboard from './pages/cgt/CgtChemDashboard'
import ArdDashboardPage from './pages/ard/ArdDashboardPage'
import ArdConfigurationPage from './pages/ard/ArdConfigurationPage'
import ArdAtrsPage from './pages/ard/ArdAtrsPage'
import ArdAtrNewPage from './pages/ard/ArdAtrNewPage'
import ArdAtrWorkspacePage from './pages/ard/ArdAtrWorkspacePage'
import ArdTemplatesPage from './pages/ard/ArdTemplatesPage'
import ArdTemplateBuilderPage from './pages/ard/ArdTemplateBuilderPage'
import ArdTestsPage from './pages/ard/ArdTestsPage'
import ArdTestExecutePage from './pages/ard/ArdTestExecutePage'
import ArdExperimentsPage from './pages/ard/ArdExperimentsPage'
import ArdAdExperimentsPage from './pages/ard/ArdAdExperimentsPage'
import ArdExperimentWorkspacePage from './pages/ard/ArdExperimentWorkspacePage'
import ArdQcTrfPage from './pages/ard/ArdQcTrfPage'
import ArdQcTrfWorkspacePage from './pages/ard/ArdQcTrfWorkspacePage'
import ArdSearchPage from './pages/ard/ArdSearchPage'
import ArdTeamPage from './pages/ard/ArdTeamPage'
import ArdAuditPage from './pages/ard/ArdAuditPage'
import ArdNotificationsPage from './pages/ard/ArdNotificationsPage'
import ArdReportsPage from './pages/ard/ArdReportsPage'
import ArdProjectsPage from './pages/ard/ArdProjectsPage'
import ArdPendingReviewPage from './pages/ard/ArdPendingReviewPage'
import ArdProjectWorkspacePage from './pages/ard/ArdProjectWorkspacePage'
import ArdNotebooksPage from './pages/ard/ArdNotebooksPage'
import ArdNotebookWorkspacePage from './pages/ard/ArdNotebookWorkspacePage'
import ArdTestProcessPage from './pages/ard/ArdTestProcessPage'
import ArdQualificationMatrixPage from './pages/ard/ArdQualificationMatrixPage'
import ArdExperimentComparePage from './pages/ard/ArdExperimentComparePage'
import ArdSeDashboardPage from './pages/ard/ArdSeDashboardPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Chemists/Analysts in CGT only ever work within notebooks assigned to them —
// block direct URL navigation to Projects/Notebooks/Experiments/Reports (the
// backend already enforces this in the API, but the route itself should never
// even render for a restricted role; nav-hiding alone isn't enough).
const CGT_ASSIGNMENT_RESTRICTED_ROLES = ['CHEM', 'ANALYST']

// ARD Configuration and Audit pages are restricted to HOD, TL, and SUPER_ADMIN,
// matching the backend's role-filtered /api/ard/menu (ADMIN_ROLE_CODES in
// ardDashboard.routes.ts) which is what actually decides who sees the link.
// Sidebar link-hiding alone is insufficient — direct URL navigation must also be blocked.
const ARD_ADMIN_ROLES = ['HOD', 'SUPER_ADMIN', 'ADMIN', 'TL', 'TEAM_LEAD']
// Analysts get into Configuration too (ArdConfigurationPage.tsx itself then
// restricts them to just the Sections/Data Items tabs) — but NOT into Audit,
// which stays on ArdAdminRoute/ARD_ADMIN_ROLES below unchanged.
const ARD_CONFIG_ROLES = [...ARD_ADMIN_ROLES, 'QA', 'QC_MANAGER', 'ANALYST', 'CHEMIST', 'CHEM']

function ArdAdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectUser)
  if (user && !ARD_ADMIN_ROLES.includes(user.role_code ?? '')) {
    return <Navigate to="/ard" replace />
  }
  return <>{children}</>
}

function ArdConfigurationRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectUser)
  if (user && !ARD_CONFIG_ROLES.includes(user.role_code ?? '')) {
    return <Navigate to="/ard" replace />
  }
  return <>{children}</>
}

function CgtIndexRedirect() {
  const user = useAppSelector(selectUser)
  const isRestricted = CGT_ASSIGNMENT_RESTRICTED_ROLES.includes(user?.role_code ?? '')
  return <Navigate to={isRestricted ? 'my-notebooks' : 'projects'} replace />
}

function CgtUnrestrictedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector(selectUser)
  const isRestricted = CGT_ASSIGNMENT_RESTRICTED_ROLES.includes(user?.role_code ?? '')
  if (isRestricted) return <Navigate to="/cgt/my-notebooks" replace />
  return <>{children}</>
}

// Same guard, mirrored for ADC — a CHEM/ANALYST landing on "/adc" (e.g. via
// the "ADC" breadcrumb crumb or the header's Modules switcher, both of which
// point at the module root) must land on their dashboard, not the plain
// Projects page they have no access to browse.
// Landing is driven by the dashboard privileges (see useAdcLanding), not by the
// notebook view_all scoping privilege — an HOD may legitimately hold the HOD
// dashboard while still being scoped to their own notebooks.
function AdcIndexRedirect() {
  const assignedOnly = useIsAdcAssignedOnly()
  return <Navigate to={assignedOnly ? 'my-notebooks' : 'projects'} replace />
}

function AdcUnrestrictedRoute({ children }: { children: React.ReactNode }) {
  const assignedOnly = useIsAdcAssignedOnly()
  if (assignedOnly) return <Navigate to="/adc/my-notebooks" replace />
  return <>{children}</>
}

// Administration is only for QA/QC department users or SUPER_ADMIN — mirrors
// the backend gate in app/shared/privileges.py. Blocking direct URL navigation
// here is defense-in-depth; every admin API call is also gated.
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']
const ADMIN_ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'HOD', 'QA']

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAppSelector(selectAccessToken)
  const initialized = useAppSelector(selectAuthInitialized)
  const user = useAppSelector(selectUser)
  // No token at all → go to login immediately.
  if (!accessToken) return <Navigate to="/login" replace />
  // Token present but /me not resolved yet — hold render until user loads.
  // selectIsAuthenticated requires BOTH token AND user, so it's false during
  // this window; checking the token alone avoids a premature redirect loop.
  if (!initialized) return null
  // /me resolved but failed (expired token etc.) → login.
  if (!user) return <Navigate to="/login" replace />
  const isSuperAdminRole = user.role_code === 'SUPER_ADMIN'
  const isAllowedRole = ADMIN_ALLOWED_ROLES.includes(user.role_code ?? '')
  const isAllowedDept = ADMIN_MODULE_DEPARTMENT_CODES.includes(user.department_code ?? '')
  if (!isSuperAdminRole && !isAllowedRole && !isAllowedDept) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/report-login-issue" element={<ReportLoginIssuePage />} />

      {/* Module selector — protected, no shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ModuleSelectorPage />
          </ProtectedRoute>
        }
      />

      {/* Calc Template fill mode — any authenticated user, not module-restricted
          (the builder itself lives under /adc/calc-templates or /cgt/calc-templates) */}
      <Route
        path="/calc-templates/:id/fill"
        element={
          <ProtectedRoute>
            <FillCalcTemplatePage />
          </ProtectedRoute>
        }
      />

      {/* Admin section — QA/QC department only */}
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AppShell />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="department-users" element={<DepartmentUsersPage />} />
        <Route path="department-role-privileges" element={<DepartmentRolePrivilegesPage />} />
        <Route path="labs" element={<LabsPage />} />
        <Route path="roles" element={<RolePrivilegesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit-trail" element={<AdminAuditTrailPage />} />
        <Route path="master-data" element={<InventoryMasterDataPage />} />
        <Route path="template-settings" element={<TemplateSettingsPage />} />
        <Route path="id-sequences" element={<IdSequencesPage />} />
      </Route>

      {/* Inventory section */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <InventoryShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<InventoryDashboard />} />
        <Route path="master-data" element={<MasterDataTypesPage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="non-available-batches" element={<NonAvailableBatchesPage />} />
        <Route path="historic-batches" element={<HistoricBatchesPage />} />
        <Route path="stock-requests" element={<StockRequestsPage />} />
        <Route path="manufacturers" element={<ManufacturersPage />} />
        <Route path="mappings" element={<MappingsPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="columns" element={<ColumnsPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="instruments/:id" element={<InstrumentDetailPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="checklists/:id" element={<ChecklistBuilderPage />} />
        <Route path="planner" element={<MaintenanceCalibrationPlannerPage />} />
        <Route path="requests" element={<MaintenanceCalibrationRequestsPage />} />
        <Route path="work-orders" element={<WorkOrdersQueuePage />} />
        <Route path="work-orders/:id" element={<WorkOrderExecutionPage />} />
        <Route path="gate-passes" element={<GatePassListPage />} />
        <Route path="gate-passes/new" element={<GatePassFormPage />} />
        <Route path="gate-pass-returns" element={<GatePassReturnsPage />} />
        <Route path="gate-pass-reports" element={<GatePassReportsPage />} />
        <Route path="gate-passes/:id/edit" element={<GatePassFormPage />} />
        <Route path="gate-passes/:id/return" element={<ReturnEntryPage />} />
        <Route path="gate-passes/:id/print" element={<GatePassPrintPage />} />
        <Route path="gate-passes/:id" element={<GatePassDetailPage />} />
        <Route path="equipment-usage-logs" element={<UsageLogsPage targetKind="EQUIPMENT" />} />
        <Route path="instrument-usage-logs" element={<UsageLogsPage targetKind="INSTRUMENT" />} />
        <Route path="column-usage-logs" element={<UsageLogsPage targetKind="COLUMN" />} />
        <Route path="reports" element={<ReportsPage />} />

        <Route path="audit-trail" element={<AuditTrailPage />} />
      </Route>

      {/* ADC — shell routes */}
      <Route
        path="/adc"
        element={
          <ProtectedRoute>
            <AdcShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdcIndexRedirect />} />
        <Route path="projects" element={<AdcUnrestrictedRoute><AdcProjectsPage /></AdcUnrestrictedRoute>} />
        <Route path="hod-projects" element={<AdcUnrestrictedRoute><AdcPdHodProjectsPage /></AdcUnrestrictedRoute>} />
        <Route path="projects/:projectId" element={<AdcUnrestrictedRoute><AdcProjectDetailPage /></AdcUnrestrictedRoute>} />
        <Route path="projects/:projectId/notebooks/:notebookId" element={<AdcNotebookPage />} />
        <Route path="projects/:projectId/notebooks/:notebookId/sections/:sectionKey" element={<AdcSectionPage />} />
        <Route path="experiments" element={<AdcUnrestrictedRoute><AdcExperimentsPage /></AdcUnrestrictedRoute>} />
        <Route path="reports" element={<AdcUnrestrictedRoute><AdcReportsPage /></AdcUnrestrictedRoute>} />
        <Route path="my-notebooks" element={<AdcPdChemDashboard />} />
        <Route path="atr" element={<MyArdAtrsPage />} />
        <Route path="atrs/:atrId" element={<ArdAtrWorkspacePage />} />
        <Route path="atrs/:atrId/tests/:testId" element={<ArdTestProcessPage />} />
        <Route path="workflow-templates" element={<TemplateBuilderPage scope="ADC" />} />
        <Route path="calc-templates" element={<CalcTemplatesPage scope="ADC" />} />
        <Route path="calc-templates/:id" element={<CalcTemplateBuilderPage scope="ADC" />} />
      </Route>

      {/* CGT — shell routes */}
      <Route
        path="/cgt"
        element={
          <ProtectedRoute>
            <CgtShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<CgtIndexRedirect />} />
        <Route path="projects" element={<CgtUnrestrictedRoute><CgtProjectsPage /></CgtUnrestrictedRoute>} />
        <Route path="projects/:projectId" element={<CgtUnrestrictedRoute><CgtProjectDetailPage /></CgtUnrestrictedRoute>} />
        <Route path="projects/:projectId/notebooks/:notebookId" element={<CgtNotebookPage />} />
        <Route path="projects/:projectId/notebooks/:notebookId/experiments/:experimentId" element={<CgtSectionPage />} />
        <Route path="notebooks" element={<CgtUnrestrictedRoute><CgtNotebooksPage /></CgtUnrestrictedRoute>} />
        <Route path="experiments" element={<CgtUnrestrictedRoute><CgtExperimentsPage /></CgtUnrestrictedRoute>} />
        <Route path="reports" element={<CgtUnrestrictedRoute><CgtReportsPage /></CgtUnrestrictedRoute>} />
        <Route path="my-notebooks" element={<CgtChemDashboard />} />
        <Route path="atr" element={<MyArdAtrsPage />} />
        <Route path="atrs/:atrId" element={<ArdAtrWorkspacePage />} />
        <Route path="atrs/:atrId/tests/:testId" element={<ArdTestProcessPage />} />
        <Route path="workflow-templates" element={<TemplateBuilderPage scope="CGT" />} />
        <Route path="calc-templates" element={<CalcTemplatesPage scope="CGT" />} />
        <Route path="calc-templates/:id" element={<CalcTemplateBuilderPage scope="CGT" />} />
      </Route>

      {/* ARD — shell routes (Phase 1 scaffold; more screens land in later phases) */}
      <Route
        path="/ard"
        element={
          <ProtectedRoute>
            <ArdShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<ArdDashboardPage />} />
        <Route path="configuration" element={<ArdConfigurationRoute><ArdConfigurationPage /></ArdConfigurationRoute>} />
        <Route path="atrs" element={<ArdAtrsPage />} />
        <Route path="atrs/new" element={<ArdAtrNewPage />} />
        <Route path="atrs/:atrId" element={<ArdAtrWorkspacePage />} />
        <Route path="tests" element={<ArdTestsPage />} />
        <Route path="tests/:atrId/:testId" element={<ArdTestExecutePage />} />
        <Route path="templates" element={<ArdTemplatesPage />} />
        <Route path="templates/:templateId" element={<ArdTemplateBuilderPage />} />
        <Route path="experiments" element={<ArdExperimentsPage />} />
        <Route path="experiments/pending-review" element={<ArdPendingReviewPage />} />
        <Route path="experiments/:experimentId" element={<ArdExperimentWorkspacePage />} />
        <Route path="ad-experiments" element={<ArdAdExperimentsPage />} />
        <Route path="qc-trf" element={<ArdQcTrfPage />} />
        <Route path="qc-trf/:trfId" element={<ArdQcTrfWorkspacePage />} />
        <Route path="search" element={<ArdSearchPage />} />
        <Route path="team" element={<ArdTeamPage />} />
        <Route path="audit" element={<ArdAdminRoute><ArdAuditPage /></ArdAdminRoute>} />
        <Route path="notifications" element={<ArdNotificationsPage />} />
        <Route path="reports" element={<ArdReportsPage />} />
        <Route path="projects" element={<ArdProjectsPage />} />
        <Route path="projects/:projectId" element={<ArdProjectWorkspacePage />} />
        <Route path="notebooks" element={<ArdNotebooksPage />} />
        <Route path="notebooks/:notebookId" element={<ArdNotebookWorkspacePage />} />
        <Route path="atrs/:atrId/tests/:testId" element={<ArdTestProcessPage />} />
        <Route path="qualification-matrix" element={<ArdQualificationMatrixPage />} />
        <Route path="experiments/compare" element={<ArdExperimentComparePage />} />
        <Route path="my-queue" element={<MyArdAtrsPage />} />
        <Route path="se-dashboard" element={<ArdSeDashboardPage />} />
      </Route>

      {/* Notebooks — global routes (same shell) */}
      <Route
        path="/notebooks"
        element={
          <ProtectedRoute>
            <AdcShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<NotebooksPage />} />
        <Route path=":notebookId/overview" element={<NotebookOverviewPage />} />
        <Route path=":notebookId/experiments/:experimentId" element={<ExperimentViewerRouter />} />
      </Route>

      {/* ADC — print (no shell) */}
      <Route
        path="/adc/print/notebooks/:notebookId"
        element={
          <ProtectedRoute>
            <AdcNotebookPrintPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
