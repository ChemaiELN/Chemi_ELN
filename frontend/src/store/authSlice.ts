import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { MeResponse } from '../api/auth'
import type { RootState } from '.'

interface AuthState {
  user: MeResponse | null
  accessToken: string | null
  initialized: boolean
  loginTime: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('access_token'),
  initialized: false,
  loginTime: localStorage.getItem('login_time'),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ user: MeResponse; accessToken: string }>) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.initialized = true
      state.loginTime = new Date().toISOString()
      localStorage.setItem('access_token', action.payload.accessToken)
      localStorage.setItem('login_time', state.loginTime)
    },
    setUser(state, action: PayloadAction<MeResponse>) {
      state.user = action.payload
    },
    // Swap only the access token (used by the silent-refresh flow) without
    // touching the already-loaded user — keeps the session alive seamlessly.
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload
      localStorage.setItem('access_token', action.payload)
    },
    clearAuth(state) {
      state.user = null
      state.accessToken = null
      state.loginTime = null
      state.initialized = true
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('login_time')
    },
    setInitialized(state) {
      state.initialized = true
    },
  },
})

export const { setAuth, setUser, setAccessToken, clearAuth, setInitialized } = authSlice.actions
export default authSlice.reducer

export const selectUser = (s: RootState) => s.auth.user
export const selectLoginTime = (s: RootState) => s.auth.loginTime
export const selectAccessToken = (s: RootState) => s.auth.accessToken
export const selectIsAuthenticated = (s: RootState) => s.auth.accessToken !== null && s.auth.user !== null
export const selectAuthInitialized = (s: RootState) => s.auth.initialized
