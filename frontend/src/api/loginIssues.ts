import { apiGet, apiPost } from './client'

// Public (unauthenticated) submission — reachable from the login page by a
// user who is locked out and can't sign in to reach anything else.
export interface LoginIssueSubmit {
  username: string
  issue_type: 'UNLOCK' | 'PASSWORD_RESET'
  description?: string
}

export const loginIssuePublicApi = {
  submit: (body: LoginIssueSubmit) => apiPost<{ id: string }>('/api/login-issues', body),
}

// Admin-facing queue — used by the Admin Dashboard.
export interface LoginIssueEntry {
  id: string
  username: string
  display_name: string | null
  designation: string | null
  department_name: string | null
  is_locked: boolean
  issue_type: 'UNLOCK' | 'PASSWORD_RESET'
  description: string | null
  status: 'PENDING' | 'RESOLVED'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export const loginIssueAdminApi = {
  list: (status?: string) => apiGet<{ items: LoginIssueEntry[] }>('/api/login-issues', status ? { status } : undefined),
  resolve: (id: string) => apiPost<void>(`/api/login-issues/${id}/resolve`),
}
