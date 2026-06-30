import { apiGet, apiPost } from './client'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface MeResponse {
  id: string
  username: string
  emp_no: string
  email: string
  role_id: string
  role_code: string
  role_name: string
  department_id: string | null
  is_active: boolean
  must_reset_password: boolean
  site: string | null
  dashboard_reference: string | null
}

export const authApi = {
  login: (body: LoginRequest) => apiPost<TokenResponse>('/api/auth/login', body),
  refresh: (refresh_token: string) => apiPost<TokenResponse>('/api/auth/refresh', { refresh_token }),
  logout: () => apiPost<void>('/api/auth/logout'),
  me: () => apiGet<MeResponse>('/api/auth/me'),
}
