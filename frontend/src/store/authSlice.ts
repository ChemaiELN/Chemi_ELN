import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { MeResponse } from '../api/auth'
import type { RootState } from '.'

interface AuthState {
  user: MeResponse | null
  accessToken: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('access_token'),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ user: MeResponse; accessToken: string }>) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      localStorage.setItem('access_token', action.payload.accessToken)
    },
    setUser(state, action: PayloadAction<MeResponse>) {
      state.user = action.payload
    },
    clearAuth(state) {
      state.user = null
      state.accessToken = null
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    },
  },
})

export const { setAuth, setUser, clearAuth } = authSlice.actions
export default authSlice.reducer

export const selectUser = (s: RootState) => s.auth.user
export const selectAccessToken = (s: RootState) => s.auth.accessToken
export const selectIsAuthenticated = (s: RootState) => s.auth.accessToken !== null
