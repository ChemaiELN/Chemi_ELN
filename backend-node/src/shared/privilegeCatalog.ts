/**
 * Fine-grained, department+role-scoped privilege catalog.
 *
 * Distinct from PRIVILEGE_CATALOG in ./privileges.ts, which holds the coarse
 * role-only admin keys ('admin.settings', 'users.manage', …) resolved against
 * the `role_privileges` table. The keys here are resolved per
 * (department, role) pair against `department_role_privileges` — see
 * ./deptPrivileges.ts.
 *
 * The `group` / `name` / `description` fields drive the admin matrix UI
 * (Group Name / Privilege Name / Description columns), so this file is the
 * single source of truth for both enforcement and that screen. Adding a module
 * later means appending entries here — no UI change required.
 */

export type PrivilegeModule = 'ADC' | 'CGT' | 'ARD' | 'INVENTORY'

export interface PrivilegeDef {
  key: string
  module: PrivilegeModule
  group: string
  name: string
  description: string
}

export const DEPT_PRIVILEGE_CATALOG: PrivilegeDef[] = [
  // ── Module Access ─────────────────────────────────────────────────────────
  {
    key: 'adc.module.access',
    module: 'ADC',
    group: 'Module Access',
    name: 'Access ADC Module',
    description: 'With this privilege user can see and enter the ADC module',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  // Landing dashboard uses fixed precedence hod > tl > chemist so that holding
  // more than one stays deterministic (see resolveLandingDashboard).
  {
    key: 'adc.dashboard.hod',
    module: 'ADC',
    group: 'Dashboard',
    name: 'HOD Dashboard',
    description: 'With this privilege user lands on the HOD dashboard',
  },
  {
    key: 'adc.dashboard.tl',
    module: 'ADC',
    group: 'Dashboard',
    name: 'Team Lead Dashboard',
    description: 'With this privilege user lands on the Team Lead dashboard',
  },
  {
    key: 'adc.dashboard.chemist',
    module: 'ADC',
    group: 'Dashboard',
    name: 'Chemist Dashboard',
    description: 'With this privilege user lands on the Chemist notebooks view',
  },

  // ── Project ───────────────────────────────────────────────────────────────
  {
    key: 'adc.project.create',
    module: 'ADC',
    group: 'Project',
    name: 'Create Project',
    description: 'With this privilege user can create new Project',
  },
  {
    key: 'adc.project.view',
    module: 'ADC',
    group: 'Project',
    name: 'View Project',
    description: 'With this privilege user can view Project',
  },
  {
    key: 'adc.project.view_all',
    module: 'ADC',
    group: 'Project',
    name: 'View All Projects',
    description: 'Without this privilege user sees only Projects they are assigned to',
  },
  {
    key: 'adc.project.edit',
    module: 'ADC',
    group: 'Project',
    name: 'Edit Project',
    description: 'With this privilege user can edit Project',
  },
  {
    key: 'adc.project.close',
    module: 'ADC',
    group: 'Project',
    name: 'Close Project',
    description: 'With this privilege user can close a Project (blocks creating new Notebooks under it; reversible)',
  },
  {
    key: 'adc.project.reopen',
    module: 'ADC',
    group: 'Project',
    name: 'Reopen Project',
    description: 'With this privilege user can reopen a closed Project back to Active',
  },
  {
    key: 'adc.project.deactivate',
    module: 'ADC',
    group: 'Project',
    name: 'Deactivate Project',
    description: 'With this privilege user can deactivate a Project once every Notebook under it is deactivated — permanent, no reopen',
  },
  {
    key: 'adc.project.manage_members',
    module: 'ADC',
    group: 'Project',
    name: 'Project User Maintenance',
    description: 'With this privilege user can add or remove Project members',
  },
  {
    key: 'adc.project.manage_attachments',
    module: 'ADC',
    group: 'Project',
    name: 'Manage Project Attachments',
    description: 'With this privilege user can upload or delete Project attachments',
  },
  {
    key: 'adc.project.risk_assessment_edit',
    module: 'ADC',
    group: 'Project',
    name: 'Edit Project Risk Assessment',
    description: 'With this privilege user can edit the Project risk assessment',
  },

  // ── Notebook ──────────────────────────────────────────────────────────────
  {
    key: 'adc.notebook.create',
    module: 'ADC',
    group: 'Notebook',
    name: 'Create Notebook',
    description: 'With this privilege user can create new Notebook',
  },
  {
    key: 'adc.notebook.view',
    module: 'ADC',
    group: 'Notebook',
    name: 'View Notebook',
    description: 'With this privilege user can view Notebook',
  },
  {
    key: 'adc.notebook.view_all',
    module: 'ADC',
    group: 'Notebook',
    name: 'View All Notebooks',
    description: 'Without this privilege user sees only Notebooks assigned to them',
  },
  {
    key: 'adc.notebook.edit',
    module: 'ADC',
    group: 'Notebook',
    name: 'Edit/Modify Notebook',
    description: 'With this privilege user can edit/modify Notebook',
  },
  {
    key: 'adc.notebook.assign_user',
    module: 'ADC',
    group: 'Notebook',
    name: 'Add/Remove User from Notebook',
    description: 'With this privilege user can assign or unassign users on a Notebook',
  },
  {
    key: 'adc.notebook.close',
    module: 'ADC',
    group: 'Notebook',
    name: 'Close Notebook',
    description: 'With this privilege user can close a Notebook (still allows new Experiments; freezes any Experiment not yet Approved; reversible)',
  },
  {
    key: 'adc.notebook.reopen',
    module: 'ADC',
    group: 'Notebook',
    name: 'Reopen Notebook',
    description: 'With this privilege user can reopen a closed Notebook back to Active, unfreezing its Experiments',
  },
  {
    key: 'adc.notebook.deactivate',
    module: 'ADC',
    group: 'Notebook',
    name: 'Deactivate Notebook',
    description: 'With this privilege Notebook can be deactivated once it contains at least one Experiment — permanent, no reopen',
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  {
    key: 'adc.workflow_templates.manage',
    module: 'ADC',
    group: 'Templates',
    name: 'Manage Workflow Templates',
    description: 'With this privilege user can view and manage ADC Workflow Templates',
  },
  {
    key: 'adc.calc_templates.manage',
    module: 'ADC',
    group: 'Templates',
    name: 'Manage Calc Templates',
    description: 'With this privilege user can view and manage ADC Calc Templates',
  },

  // ── Experiment ────────────────────────────────────────────────────────────
  {
    key: 'adc.experiment.create',
    module: 'ADC',
    group: 'Experiment',
    name: 'Create Experiment',
    description: 'With this privilege user can create new Experiment',
  },
  {
    key: 'adc.experiment.view',
    module: 'ADC',
    group: 'Experiment',
    name: 'View Experiment',
    description: 'With this privilege user can view Experiment',
  },
  {
    key: 'adc.experiment.view_all',
    module: 'ADC',
    group: 'Experiment',
    name: 'View All Experiments',
    description: 'Without this privilege user sees only Experiments assigned to them',
  },
  {
    key: 'adc.experiment.edit',
    module: 'ADC',
    group: 'Experiment',
    name: 'Edit Experiment',
    description: 'With this privilege user can edit Experiment content',
  },
  {
    key: 'adc.experiment.assign_user',
    module: 'ADC',
    group: 'Experiment',
    name: 'Assign User to Experiment',
    description: 'With this privilege user can assign or unassign users on an Experiment',
  },
  {
    key: 'adc.experiment.submit',
    module: 'ADC',
    group: 'Experiment',
    name: 'Submit Experiment',
    description: 'With this privilege user can submit Experiment for approval',
  },
  {
    key: 'adc.experiment.approve',
    module: 'ADC',
    group: 'Experiment',
    name: 'Approve Experiment',
    description: 'With this privilege user can approve a submitted Experiment',
  },
  {
    key: 'adc.experiment.reject',
    module: 'ADC',
    group: 'Experiment',
    name: 'Reject Experiment',
    description: 'With this privilege user can reject a submitted Experiment',
  },
  {
    key: 'adc.experiment.unlock',
    module: 'ADC',
    group: 'Experiment',
    name: 'Unlock Experiment',
    description: 'With this privilege user can unlock an approved Experiment',
  },
  {
    key: 'adc.experiment.void',
    module: 'ADC',
    group: 'Experiment',
    name: 'Void Experiment',
    description: 'With this privilege user can void an Experiment',
  },
  {
    key: 'adc.experiment.clone',
    module: 'ADC',
    group: 'Experiment',
    name: 'Clone Experiment',
    description: 'With this privilege user can clone an Experiment as a new version',
  },
  {
    key: 'adc.experiment.sign_done',
    module: 'ADC',
    group: 'Experiment',
    name: 'Sign as Done By',
    description: 'With this privilege user can sign a section as Done By / performer',
  },
  {
    key: 'adc.experiment.sign_checked',
    module: 'ADC',
    group: 'Experiment',
    name: 'Sign as Checked By',
    description: 'With this privilege user can sign a section as Checked By / reviewer',
  },
  {
    key: 'adc.experiment.manage_files',
    module: 'ADC',
    group: 'Experiment',
    name: 'Manage Experiment Files',
    description: 'With this privilege user can upload or delete Experiment attachments',
  },
  {
    key: 'adc.experiment.raise_atr',
    module: 'ADC',
    group: 'Experiment',
    name: 'Raise ATR',
    description: 'With this privilege user can raise an Analytical Test Request',
  },
  {
    key: 'adc.experiment.submit_to_ad',
    module: 'ADC',
    group: 'Experiment',
    name: 'Submit to AD',
    description: 'With this privilege user can submit an Experiment to Analytical Development',
  },
  {
    key: 'adc.experiment.risk_assessment_approve',
    module: 'ADC',
    group: 'Experiment',
    name: 'Approve Experiment Risk Assessment',
    description: 'With this privilege user can approve the Experiment risk assessment',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CGT — mirrors the ADC group structure 1:1 (Module Access / Dashboard /
  // Project / Notebook / Experiment) so both modules share the same admin
  // matrix layout; only the module-specific wording differs.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Module Access ─────────────────────────────────────────────────────────
  {
    key: 'cgt.module.access',
    module: 'CGT',
    group: 'Module Access',
    name: 'Access CGT Module',
    description: 'With this privilege user can see and enter the CGT module',
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  {
    key: 'cgt.dashboard.hod',
    module: 'CGT',
    group: 'Dashboard',
    name: 'HOD Dashboard',
    description: 'With this privilege user lands on the HOD dashboard',
  },
  {
    key: 'cgt.dashboard.tl',
    module: 'CGT',
    group: 'Dashboard',
    name: 'Team Lead Dashboard',
    description: 'With this privilege user lands on the Team Lead dashboard',
  },
  {
    key: 'cgt.dashboard.analyst',
    module: 'CGT',
    group: 'Dashboard',
    name: 'Analyst Dashboard',
    description: 'With this privilege user lands on the Analyst notebooks view',
  },

  // ── Project ───────────────────────────────────────────────────────────────
  {
    key: 'cgt.project.create',
    module: 'CGT',
    group: 'Project',
    name: 'Create Project',
    description: 'With this privilege user can create new Project',
  },
  {
    key: 'cgt.project.view',
    module: 'CGT',
    group: 'Project',
    name: 'View Project',
    description: 'With this privilege user can view Project',
  },
  {
    key: 'cgt.project.view_all',
    module: 'CGT',
    group: 'Project',
    name: 'View All Projects',
    description: 'Without this privilege user sees only Projects they are assigned to',
  },
  {
    key: 'cgt.project.edit',
    module: 'CGT',
    group: 'Project',
    name: 'Edit Project',
    description: 'With this privilege user can edit Project',
  },
  {
    key: 'cgt.project.close',
    module: 'CGT',
    group: 'Project',
    name: 'Close Project',
    description: 'With this privilege user can close a Project (blocks creating new Notebooks under it; reversible)',
  },
  {
    key: 'cgt.project.reopen',
    module: 'CGT',
    group: 'Project',
    name: 'Reopen Project',
    description: 'With this privilege user can reopen a closed Project back to Active',
  },
  {
    key: 'cgt.project.deactivate',
    module: 'CGT',
    group: 'Project',
    name: 'Deactivate Project',
    description: 'With this privilege user can deactivate a Project once every Notebook under it is deactivated — permanent, no reopen',
  },
  {
    key: 'cgt.project.manage_members',
    module: 'CGT',
    group: 'Project',
    name: 'Project User Maintenance',
    description: 'With this privilege user can add or remove Project members',
  },
  {
    key: 'cgt.project.manage_attachments',
    module: 'CGT',
    group: 'Project',
    name: 'Manage Project Attachments',
    description: 'With this privilege user can upload or delete Project attachments',
  },
  {
    key: 'cgt.project.risk_assessment_edit',
    module: 'CGT',
    group: 'Project',
    name: 'Edit Project Risk Assessment',
    description: 'With this privilege user can edit the Project risk assessment',
  },

  // ── Notebook ──────────────────────────────────────────────────────────────
  {
    key: 'cgt.notebook.create',
    module: 'CGT',
    group: 'Notebook',
    name: 'Create Notebook',
    description: 'With this privilege user can create new Notebook',
  },
  {
    key: 'cgt.notebook.view',
    module: 'CGT',
    group: 'Notebook',
    name: 'View Notebook',
    description: 'With this privilege user can view Notebook',
  },
  {
    key: 'cgt.notebook.view_all',
    module: 'CGT',
    group: 'Notebook',
    name: 'View All Notebooks',
    description: 'Without this privilege user sees only Notebooks assigned to them',
  },
  {
    key: 'cgt.notebook.edit',
    module: 'CGT',
    group: 'Notebook',
    name: 'Edit/Modify Notebook',
    description: 'With this privilege user can edit/modify Notebook',
  },
  {
    key: 'cgt.notebook.assign_user',
    module: 'CGT',
    group: 'Notebook',
    name: 'Add/Remove User from Notebook',
    description: 'With this privilege user can assign or unassign users on a Notebook',
  },
  {
    key: 'cgt.notebook.close',
    module: 'CGT',
    group: 'Notebook',
    name: 'Close Notebook',
    description: 'With this privilege user can close a Notebook (still allows new Experiments; freezes any Experiment not yet Approved; reversible)',
  },
  {
    key: 'cgt.notebook.reopen',
    module: 'CGT',
    group: 'Notebook',
    name: 'Reopen Notebook',
    description: 'With this privilege user can reopen a closed Notebook back to Active, unfreezing its Experiments',
  },
  {
    key: 'cgt.notebook.deactivate',
    module: 'CGT',
    group: 'Notebook',
    name: 'Deactivate Notebook',
    description: 'With this privilege Notebook can be deactivated once it contains at least one Experiment — permanent, no reopen',
  },

  // ── Templates ─────────────────────────────────────────────────────────────
  {
    key: 'cgt.workflow_templates.manage',
    module: 'CGT',
    group: 'Templates',
    name: 'Manage Workflow Templates',
    description: 'With this privilege user can view and manage CGT Workflow Templates',
  },
  {
    key: 'cgt.calc_templates.manage',
    module: 'CGT',
    group: 'Templates',
    name: 'Manage Calc Templates',
    description: 'With this privilege user can view and manage CGT Calc Templates',
  },

  // ── Experiment ────────────────────────────────────────────────────────────
  {
    key: 'cgt.experiment.create',
    module: 'CGT',
    group: 'Experiment',
    name: 'Create Experiment',
    description: 'With this privilege user can create new Experiment',
  },
  {
    key: 'cgt.experiment.view',
    module: 'CGT',
    group: 'Experiment',
    name: 'View Experiment',
    description: 'With this privilege user can view Experiment',
  },
  {
    key: 'cgt.experiment.view_all',
    module: 'CGT',
    group: 'Experiment',
    name: 'View All Experiments',
    description: 'Without this privilege user sees only Experiments assigned to them',
  },
  {
    key: 'cgt.experiment.edit',
    module: 'CGT',
    group: 'Experiment',
    name: 'Edit Experiment',
    description: 'With this privilege user can edit Experiment content',
  },
  {
    key: 'cgt.experiment.assign_user',
    module: 'CGT',
    group: 'Experiment',
    name: 'Assign User to Experiment',
    description: 'With this privilege user can assign or unassign users on an Experiment',
  },
  {
    key: 'cgt.experiment.submit',
    module: 'CGT',
    group: 'Experiment',
    name: 'Submit Experiment',
    description: 'With this privilege user can submit Experiment for approval',
  },
  {
    key: 'cgt.experiment.approve',
    module: 'CGT',
    group: 'Experiment',
    name: 'Approve Experiment',
    description: 'With this privilege user can approve a submitted Experiment',
  },
  {
    key: 'cgt.experiment.reject',
    module: 'CGT',
    group: 'Experiment',
    name: 'Reject Experiment',
    description: 'With this privilege user can reject a submitted Experiment',
  },
  {
    key: 'cgt.experiment.unlock',
    module: 'CGT',
    group: 'Experiment',
    name: 'Unlock Experiment',
    description: 'With this privilege user can unlock an approved Experiment',
  },
  {
    key: 'cgt.experiment.void',
    module: 'CGT',
    group: 'Experiment',
    name: 'Void Experiment',
    description: 'With this privilege user can void an Experiment',
  },
  {
    key: 'cgt.experiment.clone',
    module: 'CGT',
    group: 'Experiment',
    name: 'Clone Experiment',
    description: 'With this privilege user can clone an Experiment as a new version',
  },
  {
    key: 'cgt.experiment.sign_done',
    module: 'CGT',
    group: 'Experiment',
    name: 'Sign as Done By',
    description: 'With this privilege user can sign a section as Done By / performer',
  },
  {
    key: 'cgt.experiment.sign_checked',
    module: 'CGT',
    group: 'Experiment',
    name: 'Sign as Checked By',
    description: 'With this privilege user can sign a section as Checked By / reviewer',
  },
  {
    key: 'cgt.experiment.manage_files',
    module: 'CGT',
    group: 'Experiment',
    name: 'Manage Experiment Files',
    description: 'With this privilege user can upload or delete Experiment attachments',
  },
]

export const ALL_DEPT_PRIVILEGE_KEYS: string[] = DEPT_PRIVILEGE_CATALOG.map((p) => p.key)

const KEY_SET = new Set(ALL_DEPT_PRIVILEGE_KEYS)

export function isKnownPrivilegeKey(key: string): boolean {
  return KEY_SET.has(key)
}

/**
 * Catalog grouped for the admin matrix UI, preserving the declaration order of
 * both groups and the privileges inside them.
 */
export function catalogByModule(module: PrivilegeModule) {
  const groups: { group: string; privileges: PrivilegeDef[] }[] = []
  for (const def of DEPT_PRIVILEGE_CATALOG) {
    if (def.module !== module) continue
    const existing = groups.find((g) => g.group === def.group)
    if (existing) existing.privileges.push(def)
    else groups.push({ group: def.group, privileges: [def] })
  }
  return groups
}
