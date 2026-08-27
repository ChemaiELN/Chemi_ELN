/**
 * Shared DB seed utilities for integration tests (Strategy B — minimal inserts).
 */
import { Op } from 'sequelize'
import { hashPassword } from '../../utils/auth.utils'
import { User } from '../../models/User.model'
import { Role } from '../../models/Role.model'
import { DepartmentRoleMapping, RolePrivilege, UserSecurityQuestion } from '../../models/RolePrivilege.model'
import { DepartmentRolePrivilege } from '../../models/DepartmentRolePrivilege.model'
import { Department } from '../../models/Department.model'
import { Lab } from '../../models/Lab.model'
import { LoginIssueRequest } from '../../models/LoginIssueRequest.model'
import { LookupChemical, LookupInstrument } from '../../models/MasterData.model'
import { IdSequenceConfig } from '../../models/IdSequence.model'
import {
  Project,
  ProjectUser,
  ProjectAttachment,
  ProjectRiskAssessment,
  ProjectRiskRow,
  Route,
} from '../../models/Project.model'
import { Notebook, NotebookPermission } from '../../models/Notebook.model'
import {
  Experiment,
  ExperimentAssignment,
  ExperimentFile,
  ExperimentAtrRequest,
  ExperimentReview,
  ExperimentHistory,
} from '../../models/Experiment.model'
import {
  AdcObjective,
  AdcRegulatoryClassification,
  AdcRiskAssessment,
  AdcRiskItem,
} from '../../models/AdcModels.model'
import { WorkflowTemplate, WorkflowTemplateVersion } from '../../models/WorkflowTemplate.model'
import {
  CgtProject,
  CgtNotebook,
  CgtNotebookPermission,
  CgtExperiment,
  CgtExperimentAssignment,
} from '../../models/CgtProject.model'
import { CgtProcess, TemplateDropdownSelection } from '../../models/TemplateSettings.model'

export const TEST_ADMIN_USERNAME = 'test_superadmin'
export const TEST_ADMIN_PASSWORD = 'TestAdmin@123'
export const TEST_ADMIN_EMAIL = 'test_superadmin@test.local'
/** Must be SUPER_ADMIN so requirePrivilege / deptPrivileges bypass works in Phase 1+. */
export const TEST_ADMIN_ROLE_CODE = 'SUPER_ADMIN'

export const TEST_NOPRIV_USERNAME = 'test_nopriv'
export const TEST_NOPRIV_PASSWORD = 'TestNopriv@123'
export const TEST_NOPRIV_ROLE_CODE = 'TEST_NOPRIV'

export interface SeededAdmin {
  username: string
  password: string
  userId: string
  roleId: string
}

export interface SeededUser {
  username: string
  password: string
  userId: string
  roleId: string
}

export async function seedMinimalAdmin(options?: {
  password?: string
  forcePassword?: boolean
}): Promise<SeededAdmin> {
  const password = options?.password ?? TEST_ADMIN_PASSWORD
  const passwordHash = await hashPassword(password)

  const [role] = await Role.findOrCreate({
    where: { code: TEST_ADMIN_ROLE_CODE },
    defaults: {
      code: TEST_ADMIN_ROLE_CODE,
      name: 'Super Admin',
      description: 'Full system access (integration-test / seed)',
      isActive: true,
    },
  })

  const [user, created] = await User.findOrCreate({
    where: { username: TEST_ADMIN_USERNAME },
    defaults: {
      username: TEST_ADMIN_USERNAME,
      email: TEST_ADMIN_EMAIL,
      passwordHash,
      roleId: role.id,
      isActive: true,
      tokenVersion: 1,
      failedLoginCount: 0,
      lockedUntil: null,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
      displayName: 'Test Super Admin',
      firstName: 'Test',
      lastName: 'Admin',
    },
  })

  if (!created) {
    // Keep password in sync for login. Only bump tokenVersion with forcePassword
    // so sibling suites' JWTs stay valid under shared sentinel use.
    const updates: Record<string, unknown> = {
      passwordHash,
      roleId: role.id,
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      mustResetPassword: false,
    }
    if (options?.forcePassword) {
      updates.passwordChangedAt = new Date()
      updates.tokenVersion = user.tokenVersion + 1
    }
    await user.update(updates)
  }

  await user.reload()

  return {
    username: TEST_ADMIN_USERNAME,
    password,
    userId: user.id,
    roleId: role.id,
  }
}

/** User with a non-privileged role — used for 403 assertions. */
export async function seedNoprivUser(): Promise<SeededUser> {
  const passwordHash = await hashPassword(TEST_NOPRIV_PASSWORD)

  const [role] = await Role.findOrCreate({
    where: { code: TEST_NOPRIV_ROLE_CODE },
    defaults: {
      code: TEST_NOPRIV_ROLE_CODE,
      name: 'Test No Privilege',
      description: 'Integration-test role with no privileges',
      isActive: true,
    },
  })

  // Hard-replace sentinel to avoid stale findOrCreate ghosts across suites
  const existing = await User.findOne({ where: { username: TEST_NOPRIV_USERNAME } })
  if (existing) {
    await LoginIssueRequest.destroy({ where: { userId: existing.id } })
    await UserSecurityQuestion.destroy({ where: { userId: existing.id } })
    await existing.destroy()
  }

  const user = await User.create({
    username: TEST_NOPRIV_USERNAME,
    email: 'test_nopriv@test.local',
    passwordHash,
    roleId: role.id,
    isActive: true,
    tokenVersion: 1,
    failedLoginCount: 0,
    lockedUntil: null,
    mustResetPassword: false,
    passwordChangedAt: new Date(),
    displayName: 'Test NoPriv',
    firstName: 'No',
    lastName: 'Priv',
  })

  return {
    username: TEST_NOPRIV_USERNAME,
    password: TEST_NOPRIV_PASSWORD,
    userId: user.id,
    roleId: role.id,
  }
}

/**
 * Soft-reset shared Phase 0 sentinel — do NOT destroy test_superadmin.
 * Later phases reuse the same SUPER_ADMIN user; deleting it mid-run
 * invalidates tokens in sibling suites.
 */
export async function cleanupTestData(): Promise<void> {
  const user = await User.findOne({ where: { username: TEST_ADMIN_USERNAME } })
  if (user) {
    await UserSecurityQuestion.destroy({ where: { userId: user.id } })
    await user.update({
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      mustResetPassword: false,
    })
  }

  const legacyRole = await Role.findOne({ where: { code: 'TEST_SUPER_ADMIN' } })
  if (legacyRole) {
    const remaining = await User.count({ where: { roleId: legacyRole.id } })
    if (remaining === 0) await legacyRole.destroy()
  }
}

/** Cleanup Phase 1 sentinels (prefix test_p1_ / test_nopriv / related rows). */
export async function cleanupPhase1Fixtures(): Promise<void> {
  const users = await User.findAll({
    where: {
      username: { [Op.or]: [{ [Op.like]: 'test_p1_%' }, TEST_NOPRIV_USERNAME] },
    },
  })
  for (const u of users) {
    await UserSecurityQuestion.destroy({ where: { userId: u.id } })
    await LoginIssueRequest.destroy({ where: { userId: u.id } })
    await u.destroy()
  }

  await Lab.destroy({ where: { code: { [Op.like]: 'P1L%' } } })

  const p1Depts = await Department.findAll({ where: { code: { [Op.like]: 'P1D%' } } })
  const p1Roles = await Role.findAll({ where: { code: { [Op.like]: 'P1R%' } } })
  const deptIds = p1Depts.map((d) => d.id)
  const roleIds = p1Roles.map((r) => r.id)
  if (deptIds.length || roleIds.length) {
    await DepartmentRoleMapping.destroy({
      where: {
        [Op.or]: [
          ...(deptIds.length ? [{ departmentId: deptIds }] : []),
          ...(roleIds.length ? [{ roleId: roleIds }] : []),
        ],
      },
    })
    await DepartmentRolePrivilege.destroy({
      where: {
        [Op.or]: [
          ...(deptIds.length ? [{ departmentId: deptIds }] : []),
          ...(roleIds.length ? [{ roleId: roleIds }] : []),
        ],
      },
    })
    if (roleIds.length) {
      await RolePrivilege.destroy({ where: { roleId: roleIds } })
    }
  }

  await Department.destroy({ where: { code: { [Op.like]: 'P1D%' } } })
  await Role.destroy({ where: { code: { [Op.like]: 'P1R%' } } })

  const noprivRole = await Role.findOne({ where: { code: TEST_NOPRIV_ROLE_CODE } })
  if (noprivRole) {
    const remaining = await User.count({ where: { roleId: noprivRole.id } })
    if (remaining === 0) await noprivRole.destroy()
  }

  await LookupChemical.destroy({ where: { chemicalName: { [Op.like]: 'P1 Chem%' } } })
  await LookupInstrument.destroy({ where: { instrumentCode: { [Op.like]: 'P1I%' } } })
  await IdSequenceConfig.destroy({ where: { code: { [Op.like]: 'P1SEQ%' } } })
  await LoginIssueRequest.destroy({ where: { username: { [Op.like]: 'test_p1_%' } } })
}

/** Ensure ADC_PD exists — project create prefers this department. */
export async function ensureAdcPdDepartment(): Promise<Department> {
  const [dept] = await Department.findOrCreate({
    where: { code: 'ADC_PD' },
    defaults: {
      code: 'ADC_PD',
      name: 'ADC PD',
      description: 'ADC Process Development (integration-test seed)',
      isActive: true,
    },
  })
  return dept
}

/**
 * Cleanup Phase 2 ADC fixtures (names/titles/slugs prefixed P2 / test_p2_).
 * Does not touch shared admin sentinel or Phase 1 prefixes.
 */
export async function cleanupPhase2Fixtures(): Promise<void> {
  const projects = await Project.findAll({
    where: { name: { [Op.like]: 'P2 %' } },
  })
  const projectIds = projects.map((p) => p.id)

  const notebooks = await Notebook.findAll({
    where: {
      [Op.or]: [
        ...(projectIds.length ? [{ projectId: projectIds }] : []),
        { title: { [Op.like]: 'P2 %' } },
      ],
    },
  })
  const notebookIds = notebooks.map((n) => n.id)

  const experiments = await Experiment.findAll({
    where: {
      [Op.or]: [
        ...(notebookIds.length ? [{ notebookId: notebookIds }] : []),
        { title: { [Op.like]: 'P2 %' } },
      ],
    },
  })
  const experimentIds = experiments.map((e) => e.id)

  if (experimentIds.length) {
    // Break clone parentId links before bulk delete
    await Experiment.update(
      { parentId: null },
      { where: { id: experimentIds, parentId: experimentIds } },
    )
    const assessments = await AdcRiskAssessment.findAll({
      where: { experimentId: experimentIds },
    })
    const assessmentIds = assessments.map((a) => a.id)
    if (assessmentIds.length) {
      await AdcRiskItem.destroy({ where: { riskAssessmentId: assessmentIds } })
    }
    await AdcRiskAssessment.destroy({ where: { experimentId: experimentIds } })
    await AdcObjective.destroy({ where: { experimentId: experimentIds } })
    await AdcRegulatoryClassification.destroy({ where: { experimentId: experimentIds } })
    await ExperimentFile.destroy({ where: { experimentId: experimentIds } })
    await ExperimentReview.destroy({ where: { experimentId: experimentIds } })
    await ExperimentAtrRequest.destroy({ where: { experimentId: experimentIds } })
    await ExperimentHistory.destroy({ where: { experimentId: experimentIds } })
    await ExperimentAssignment.destroy({ where: { experimentId: experimentIds } })
    await Experiment.destroy({ where: { id: experimentIds } })
  }

  if (notebookIds.length) {
    await Notebook.update(
      { parentNotebookId: null, linkedNotebookId: null },
      { where: { id: notebookIds } },
    )
    await NotebookPermission.destroy({ where: { notebookId: notebookIds } })
    await Notebook.destroy({ where: { id: notebookIds } })
  }

  if (projectIds.length) {
    await Route.destroy({ where: { projectId: projectIds } })
    const ras = await ProjectRiskAssessment.findAll({ where: { projectId: projectIds } })
    const raIds = ras.map((r) => r.id)
    if (raIds.length) {
      await ProjectRiskRow.destroy({ where: { assessmentId: raIds } })
    }
    await ProjectRiskAssessment.destroy({ where: { projectId: projectIds } })
    await ProjectAttachment.destroy({ where: { projectId: projectIds } })
    await ProjectUser.destroy({ where: { projectId: projectIds } })
    await Project.destroy({ where: { id: projectIds } })
  }

  const templates = await WorkflowTemplate.findAll({
    where: { slug: { [Op.like]: 'test_p2_%' } },
  })
  const templateIds = templates.map((t) => t.id)
  if (templateIds.length) {
    await WorkflowTemplateVersion.destroy({ where: { templateId: templateIds } })
    await WorkflowTemplate.destroy({ where: { id: templateIds } })
  }
}

/**
 * Cleanup Phase 4 CGT fixtures (names/titles prefixed P4 / test_p4_).
 * Does not touch shared admin sentinel or Phase 1/2 prefixes.
 */
export async function cleanupPhase4Fixtures(): Promise<void> {
  const projects = await CgtProject.findAll({
    where: { name: { [Op.like]: 'P4 %' } },
  })
  const projectIds = projects.map((p) => p.id)

  const notebooks = await CgtNotebook.findAll({
    where: {
      [Op.or]: [
        ...(projectIds.length ? [{ cgtProjectId: projectIds }] : []),
        { title: { [Op.like]: 'P4 %' } },
      ],
    },
  })
  const notebookIds = notebooks.map((n) => n.id)

  const experiments = await CgtExperiment.findAll({
    where: {
      [Op.or]: [
        ...(notebookIds.length ? [{ cgtNotebookId: notebookIds }] : []),
        { title: { [Op.like]: 'P4 %' } },
      ],
    },
  })
  const experimentIds = experiments.map((e) => e.id)

  if (experimentIds.length) {
    await CgtExperimentAssignment.destroy({ where: { cgtExperimentId: experimentIds } })
    await CgtExperiment.destroy({ where: { id: experimentIds } })
  }

  if (notebookIds.length) {
    await CgtNotebookPermission.destroy({ where: { cgtNotebookId: notebookIds } })
    await CgtNotebook.destroy({ where: { id: notebookIds } })
  }

  if (projectIds.length) {
    await CgtProject.destroy({ where: { id: projectIds } })
  }

  const processes = await CgtProcess.findAll({
    where: { name: { [Op.like]: 'P4 %' } },
  })
  const processIds = processes.map((p) => p.id)
  if (processIds.length) {
    await TemplateDropdownSelection.destroy({ where: { processId: processIds } })
    await CgtProcess.destroy({ where: { id: processIds } })
  }

  // Orphan ADC-scope selections from Phase 4 tests (none currently) — skip
  const templates = await WorkflowTemplate.findAll({
    where: { slug: { [Op.like]: 'test_p4_%' } },
  })
  const templateIds = templates.map((t) => t.id)
  if (templateIds.length) {
    await TemplateDropdownSelection.destroy({ where: { templateId: templateIds } })
    await WorkflowTemplateVersion.destroy({ where: { templateId: templateIds } })
    await WorkflowTemplate.destroy({ where: { id: templateIds } })
  }
}
