/**
 * Shared DB seed utilities for integration tests (Strategy B — minimal inserts).
 */
import { hashPassword } from '../../utils/auth.utils'
import { User } from '../../models/User.model'
import { Role } from '../../models/Role.model'
import { UserSecurityQuestion } from '../../models/RolePrivilege.model'

export const TEST_ADMIN_USERNAME = 'test_superadmin'
export const TEST_ADMIN_PASSWORD = 'TestAdmin@123'
export const TEST_ADMIN_EMAIL = 'test_superadmin@test.local'
/** Must be SUPER_ADMIN so requirePrivilege / deptPrivileges bypass works in Phase 1+. */
export const TEST_ADMIN_ROLE_CODE = 'SUPER_ADMIN'

export interface SeededAdmin {
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
    // Always sync passwordHash to the password we return — avoids stale-hash drift
    // when a previous suite mutated the password without cleanup.
    const updates: Record<string, unknown> = {
      passwordHash,
      roleId: role.id,
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
      mustResetPassword: false,
      passwordChangedAt: new Date(),
    }
    if (options?.forcePassword) {
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

/**
 * Removes Phase 0 sentinel user only.
 * Never deletes the SUPER_ADMIN role — it is a shared system role.
 * Also cleans leftover TEST_SUPER_ADMIN role from earlier Phase 0 iterations.
 */
export async function cleanupTestData(): Promise<void> {
  const user = await User.findOne({ where: { username: TEST_ADMIN_USERNAME } })
  if (user) {
    await UserSecurityQuestion.destroy({ where: { userId: user.id } })
    await user.destroy()
  }

  // Legacy role from first Phase 0 iteration — safe to remove if unused
  const legacyRole = await Role.findOne({ where: { code: 'TEST_SUPER_ADMIN' } })
  if (legacyRole) {
    const remaining = await User.count({ where: { roleId: legacyRole.id } })
    if (remaining === 0) {
      await legacyRole.destroy()
    }
  }
}
