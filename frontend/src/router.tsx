import { Routes, Route, Navigate } from 'react-router-dom'
import { useAppSelector } from './store'
import { selectIsAuthenticated, selectUser } from './store/authSlice'

import LoginPage from './pages/auth/LoginPage'
import ModuleSelectorPage from './pages/ModuleSelectorPage'
import AppShell from './components/layout/AppShell'
import InventoryShell from './components/layout/InventoryShell'
import AdcShell from './components/layout/AdcShell'
import CgtShell from './components/layout/CgtShell'

import UsersPage from './pages/admin/UsersPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import RolePrivilegesPage from './pages/admin/RolePrivilegesPage'
import SettingsPage from './pages/admin/SettingsPage'
import WorkflowTemplatesPage from './pages/admin/WorkflowTemplatesPage'
import CgtPlasmidProcessPage from './pages/admin/CgtPlasmidProcessPage'
import TemplateBuilderPage from './pages/admin/templateBuilder/TemplateBuilderPage'
import InventoryMasterDataPage from './pages/inventory/InventoryMasterDataPage'
import InventoryDashboard from './pages/inventory/InventoryDashboard'
import MaterialsPage from './pages/inventory/MaterialsPage'
import BatchesPage from './pages/inventory/BatchesPage'
import StockRequestsPage from './pages/inventory/StockRequestsPage'
import ManufacturersPage from './pages/inventory/ManufacturersPage'
import MappingsPage from './pages/inventory/MappingsPage'
import EquipmentPage from './pages/inventory/EquipmentPage'
import EquipmentDetailPage from './pages/inventory/EquipmentDetailPage'
import InstrumentDetailPage from './pages/inventory/InstrumentDetailPage'
import ChecklistsPage from './pages/inventory/ChecklistsPage'
import ChecklistBuilderPage from './pages/inventory/ChecklistBuilderPage'
import PlannerPage from './pages/inventory/PlannerPage'
import RequestsPage from './pages/inventory/RequestsPage'
import WorkOrdersQueuePage from './pages/inventory/WorkOrdersQueuePage'
import WorkOrderExecutionPage from './pages/inventory/WorkOrderExecutionPage'
import UsageLogsPage from './pages/inventory/UsageLogsPage'
import ReportsPage from './pages/inventory/ReportsPage'
import AuditTrailPage from './pages/inventory/AuditTrailPage'
import AdcProjectsPage from './pages/adc/AdcProjectsPage'
import AdcProjectDetailPage from './pages/adc/AdcProjectDetailPage'
import AdcNotebookPage from './pages/adc/AdcNotebookPage'
import AdcSectionPage from './pages/adc/AdcSectionPage'
import AdcNotebookPrintPage from './pages/adc/AdcNotebookPrintPage'
import AdcExperimentsPage from './pages/adc/AdcExperimentsPage'
import AdcReportsPage from './pages/adc/AdcReportsPage'
import ChemistNotebooksPage from './pages/adc/ChemistNotebooksPage'
import NotebooksPage from './pages/notebooks/NotebooksPage'
import NotebookOverviewPage from './pages/notebooks/NotebookOverviewPage'
import ExperimentDetailPage from './pages/notebooks/ExperimentDetailPage'
import CgtProjectsPage from './pages/cgt/CgtProjectsPage'
import CgtNotebooksPage from './pages/cgt/CgtNotebooksPage'
import CgtExperimentsPage from './pages/cgt/CgtExperimentsPage'
import CgtReportsPage from './pages/cgt/CgtReportsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Administration is only for QA/QC department users — mirrors the backend gate
// in app/shared/privileges.py (ADMIN_MODULE_DEPARTMENT_CODES). Blocking direct
// URL navigation here is defense-in-depth; every admin API call is also gated.
const ADMIN_MODULE_DEPARTMENT_CODES = ['QA', 'QC']

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const user = useAppSelector(selectUser)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!ADMIN_MODULE_DEPARTMENT_CODES.includes(user?.department_code ?? '')) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Module selector — protected, no shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ModuleSelectorPage />
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
        <Route index element={<Navigate to="users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="role-privileges" element={<RolePrivilegesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="workflow-templates" element={<WorkflowTemplatesPage />} />
        <Route path="workflow-templates/cgt-plasmid" element={<CgtPlasmidProcessPage />} />
        <Route path="workflow-templates/cgt-plasmid/builder" element={<TemplateBuilderPage />} />
        <Route path="master-data" element={<InventoryMasterDataPage />} />
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
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="stock-requests" element={<StockRequestsPage />} />
        <Route path="manufacturers" element={<ManufacturersPage />} />
        <Route path="mappings" element={<MappingsPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="instruments/:id" element={<InstrumentDetailPage />} />
        <Route path="checklists" element={<ChecklistsPage />} />
        <Route path="checklists/:id" element={<ChecklistBuilderPage />} />
        <Route path="maintenance-planner" element={<PlannerPage targetKind="EQUIPMENT" />} />
        <Route path="calibration-planner" element={<PlannerPage targetKind="INSTRUMENT" />} />
        <Route path="maintenance-requests" element={<RequestsPage targetKind="EQUIPMENT" />} />
        <Route path="calibration-requests" element={<RequestsPage targetKind="INSTRUMENT" />} />
        <Route path="work-orders" element={<WorkOrdersQueuePage />} />
        <Route path="work-orders/:id" element={<WorkOrderExecutionPage />} />
        <Route path="equipment-usage-logs" element={<UsageLogsPage targetKind="EQUIPMENT" />} />
        <Route path="instrument-usage-logs" element={<UsageLogsPage targetKind="INSTRUMENT" />} />
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
        <Route index element={<Navigate to="projects" replace />} />
        <Route path="projects" element={<AdcProjectsPage />} />
        <Route path="projects/:projectId" element={<AdcProjectDetailPage />} />
        <Route path="projects/:projectId/notebooks/:notebookId" element={<AdcNotebookPage />} />
        <Route path="projects/:projectId/notebooks/:notebookId/sections/:sectionKey" element={<AdcSectionPage />} />
        <Route path="experiments" element={<AdcExperimentsPage />} />
        <Route path="reports" element={<AdcReportsPage />} />
        <Route path="my-notebooks" element={<ChemistNotebooksPage />} />
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
        <Route index element={<Navigate to="projects" replace />} />
        <Route path="projects" element={<CgtProjectsPage />} />
        <Route path="notebooks" element={<CgtNotebooksPage />} />
        <Route path="experiments" element={<CgtExperimentsPage />} />
        <Route path="reports" element={<CgtReportsPage />} />
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
        <Route path=":notebookId/experiments/:experimentId" element={<ExperimentDetailPage />} />
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
