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
  terms_accepted?: boolean
  has_security_questions?: boolean
  enable_security_questions?: boolean
  admin_privileges?: string[]
  dashboard_reference: string | null
  department_name?: string | null
  department_code?: string | null
  privileges?: string[]
}

export interface VerifyPasswordResponse {
  verified: boolean
  user_id: string
  username: string
  role_code: string
}

export const authApi = {
  login: (body: LoginRequest) => apiPost<TokenResponse>('/api/auth/login', body),
  refresh: (refresh_token: string) => apiPost<TokenResponse>('/api/auth/refresh', { refresh_token }),
  logout: () => apiPost<void>('/api/auth/logout'),
  me: () => apiGet<MeResponse>('/api/auth/me'),
  verifyPassword: (password: string) =>
    apiPost<VerifyPasswordResponse>('/api/auth/verify-password', { password }),
  changePassword: (body: {
    old_password?: string
    new_password: string
    security_answers?: { index: number; answer: string }[]
  }) => apiPost<TokenResponse>('/api/auth/change-password', body),
  acceptTerms: () => apiPost<void>('/api/auth/accept-terms', { accepted: true }),
  securityQuestions: () =>
    apiGet<{ questions: { index: number; text: string }[] }>('/api/auth/security-questions'),
  saveSecurityQuestions: (questions: { index: number; answer: string }[]) =>
    apiPost<void>('/api/auth/me/security-questions', { questions }),
}
