import { useCan } from './usePrivilege'

export type AdcLanding = 'hod' | 'tl' | 'chemist' | 'projects'

/**
 * Where a user's ADC home is, and therefore which pages they may browse.
 *
 * This is deliberately separate from `adc.notebook.view_all`, which answers a
 * different question — whether a user sees every notebook or only the ones
 * assigned to them. Conflating the two meant granting "HOD Dashboard" had no
 * effect on where the user landed.
 *
 * Precedence hod > tl > chemist keeps the result deterministic when more than
 * one dashboard privilege is granted. With no dashboard privilege at all we fall
 * back to the scoping privilege: someone who can see all notebooks gets the
 * project browser, otherwise the assigned-only view.
 */
export function useAdcLanding(): AdcLanding {
  const hod         = useCan('adc.dashboard.hod')
  const tl          = useCan('adc.dashboard.tl')
  const chemist     = useCan('adc.dashboard.chemist')
  const viewAllNbks = useCan('adc.notebook.view_all')

  if (hod) return 'hod'
  if (tl) return 'tl'
  if (chemist) return 'chemist'
  return viewAllNbks ? 'projects' : 'chemist'
}

/**
 * True when the user's home is the assigned-only notebooks view, and so should
 * not be browsing the full project/experiment lists.
 */
export function useIsAdcAssignedOnly(): boolean {
  return useAdcLanding() === 'chemist'
}
