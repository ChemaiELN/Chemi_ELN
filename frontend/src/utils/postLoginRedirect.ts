import type { MeResponse } from '../api/auth'

const ADMIN_PRIVILEGED_ROLES = ['SUPER_ADMIN', 'DQA']

/** Department-aware landing path after login / onboarding. */
export function getPostLoginPath(user: MeResponse): string {
  if (user.must_reset_password || user.terms_accepted === false) return '/'
  if (user.enable_security_questions && !user.has_security_questions) return '/'

  if (ADMIN_PRIVILEGED_ROLES.includes(user.role_code ?? '')) {
    return '/admin/dashboard'
  }

  switch (user.department_code) {
    case 'QA':
    case 'QC':
    case 'IT':
      return '/admin/dashboard'
    case 'INVENTORY':
      return '/inventory'
    case 'ADC_PD':
      return '/adc/projects'
    case 'CGT':
      return '/cgt/projects'
    case 'AD':
      return '/ard'
    default:
      console.warn(`[postLoginRedirect] Unhandled department_code: "${user.department_code}" — landing at /`)
      return '/'
  }
}
