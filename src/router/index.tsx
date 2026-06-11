import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import LoginPage                  from '@/pages/login'
import DashboardPage              from '@/pages/dashboard'
import UnlockExperimentsPage      from '@/pages/experiments/unlock'
import ExperimentsListPage        from '@/pages/experiments/list'
import ExperimentsEditorPage      from '@/pages/experiments/editor'
import ProjectsListPage           from '@/pages/projects/list'
import ProjectsOverviewPage       from '@/pages/projects/overview'
import ProjectsMilestonesPage     from '@/pages/projects/milestones'
import ProjectsRoutesPage         from '@/pages/projects/routes'
import NotebooksListPage          from '@/pages/notebooks/list'
import NotebooksOverviewPage      from '@/pages/notebooks/overview'
import NotebooksPermissionsPage   from '@/pages/notebooks/permissions'
import AtrListPage                from '@/pages/atr/list'
import AtrFormPage                from '@/pages/atr/form'
import AtrProjectATRsPage         from '@/pages/atr/project-atrs'
import AtrPendingClarificationPage from '@/pages/atr/pending-clarification'
import AtrMyATRsPage              from '@/pages/atr/my-atrs'
import AdminDashboardPage         from '@/pages/admin/dashboard'
import AdminUsersPage             from '@/pages/admin/users'
import AdminRolesPage             from '@/pages/admin/roles'
import AdminDepartmentsPage       from '@/pages/admin/departments'
import AdminAuditPage             from '@/pages/admin/audit'
import AdminChemicalsPage         from '@/pages/admin/master-data/chemicals'
import AdminInstrumentsPage       from '@/pages/admin/master-data/instruments'
import AdminSitesPage             from '@/pages/admin/master-data/sites'
import AdminRolePrivilegesPage    from '@/pages/admin/role-privileges'
import SearchPage                 from '@/pages/search'
import ReportsPage                from '@/pages/reports'
import SettingsPage               from '@/pages/settings'
import InventoryPage              from '@/pages/inventory'
import ForgotPasswordPage         from '@/pages/forgot-password'
import ResetPasswordPage          from '@/pages/reset-password'

const router = createBrowserRouter([
  { path: '/',                        element: <LoginPage /> },
  { path: '/login',                   element: <LoginPage /> },
  { path: '/forgot-password',         element: <ForgotPasswordPage /> },
  { path: '/reset-password',          element: <ResetPasswordPage /> },
  { path: '/dashboard',               element: <DashboardPage /> },
  { path: '/search',                  element: <SearchPage /> },
  { path: '/experiments/unlock',      element: <UnlockExperimentsPage /> },
  { path: '/experiments',             element: <ExperimentsListPage /> },
  { path: '/experiments/:id',         element: <ExperimentsEditorPage /> },
  { path: '/projects',                element: <ProjectsListPage /> },
  { path: '/projects/:id/overview',   element: <ProjectsOverviewPage /> },
  { path: '/projects/:id/milestones', element: <ProjectsMilestonesPage /> },
  { path: '/projects/:id/routes',     element: <ProjectsRoutesPage /> },
  { path: '/notebooks',               element: <NotebooksListPage /> },
  { path: '/notebooks/:id/overview',  element: <NotebooksOverviewPage /> },
  { path: '/notebooks/:id/permissions', element: <NotebooksPermissionsPage /> },
  { path: '/atr',                          element: <AtrListPage /> },
  { path: '/atr/project-atrs',             element: <AtrProjectATRsPage /> },
  { path: '/atr/pending-clarification',    element: <AtrPendingClarificationPage /> },
  { path: '/atr/my-atrs',                  element: <AtrMyATRsPage /> },
  { path: '/atr/:id',                      element: <AtrFormPage /> },
  { path: '/admin',                        element: <AdminDashboardPage /> },
  { path: '/admin/users',                  element: <AdminUsersPage /> },
  { path: '/admin/roles',                  element: <AdminRolesPage /> },
  { path: '/admin/departments',            element: <AdminDepartmentsPage /> },
  { path: '/admin/audit',                  element: <AdminAuditPage /> },
  { path: '/admin/master-data/chemicals',  element: <AdminChemicalsPage /> },
  { path: '/admin/master-data/instruments',element: <AdminInstrumentsPage /> },
  { path: '/admin/master-data/sites',      element: <AdminSitesPage /> },
  { path: '/admin/role-privileges',        element: <AdminRolePrivilegesPage /> },
  { path: '/reports',                      element: <ReportsPage /> },
  { path: '/settings',                     element: <SettingsPage /> },
  { path: '/inventory',                    element: <InventoryPage /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
