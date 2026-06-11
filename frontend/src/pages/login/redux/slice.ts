import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  username: string
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  username: '',
  isAuthenticated: false,
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true
      state.error = null
    },
    loginSuccess(state, action: PayloadAction<{ username: string }>) {
      state.loading = false
      state.isAuthenticated = true
      state.username = action.payload.username
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false
      state.error = action.payload
    },
    logout(state) {
      state.isAuthenticated = false
      state.username = ''
      state.error = null
    },
  },
})

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions
export default authSlice.reducer