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
}

const initialState: PrivilegesState = { granted: [], isQA: false }

const privilegesSlice = createSlice({
  name: 'privileges',
  initialState,
  reducers: {
    setPrivileges(state, action: PayloadAction<{ keys: PrivilegeKey[]; isQA: boolean }>) {
      state.granted = action.payload.keys
      state.isQA = action.payload.isQA
    },
    clearPrivileges(state) {
      state.granted = []
      state.isQA = false
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
