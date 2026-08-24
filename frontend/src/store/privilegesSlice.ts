import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '.'

export type PrivilegeKey =
  | 'admin.settings'
  | 'admin.excel_templates'
  | 'admin.notifications'
  | 'admin.role_privileges'
  | 'users.manage'
  | 'departments.manage'
  | 'master_data.manage'
  | 'project.manage'
  | 'notebook.manage'
  | 'experiment.manage'
  | 'atr.manage'

interface PrivilegesState {
  granted: PrivilegeKey[]
  isQA: boolean
  /**
   * Fine-grained (department, role) operation grants from /me, e.g.
   * 'adc.project.create'. Read via selectCanDo / useCan.
   */
  deptPrivileges: string[]
  /** SUPER_ADMIN bypasses the matrix entirely. */
  isSuperAdmin: boolean
}

const initialState: PrivilegesState = { granted: [], isQA: false, deptPrivileges: [], isSuperAdmin: false }

const privilegesSlice = createSlice({
  name: 'privileges',
  initialState,
  reducers: {
    setPrivileges(
      state,
      action: PayloadAction<{
        keys: PrivilegeKey[]
        isQA: boolean
        deptPrivileges?: string[]
        isSuperAdmin?: boolean
      }>,
    ) {
      state.granted = action.payload.keys
      state.isQA = action.payload.isQA
      state.deptPrivileges = action.payload.deptPrivileges ?? []
      state.isSuperAdmin = action.payload.isSuperAdmin ?? false
    },
    clearPrivileges(state) {
      state.granted = []
      state.isQA = false
      state.deptPrivileges = []
      state.isSuperAdmin = false
    },
  },
})

export const { setPrivileges, clearPrivileges } = privilegesSlice.actions
export default privilegesSlice.reducer

export const selectIsQA = (s: RootState) => s.privileges.isQA

// Selector factory — do not inline the arrow fn inside useAppSelector
export const selectCan =
  (key: PrivilegeKey) =>
  (s: RootState): boolean =>
    s.privileges.isQA || s.privileges.granted.includes(key)

/**
 * Selector for fine-grained (department, role) privileges.
 *
 * Note the deliberate absence of the `isQA` bypass that selectCan applies: that
 * bypass grants every coarse admin key to any QA-department user, which would
 * silently override the department-role matrix. Only SUPER_ADMIN short-circuits
 * here, matching userHasDeptPrivilege() on the backend.
 */
export const selectCanDo =
  (key: string) =>
  (s: RootState): boolean =>
    s.privileges.isSuperAdmin || s.privileges.deptPrivileges.includes(key)
