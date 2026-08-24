import { useAppSelector } from '../store'
import { selectUser } from '../store/authSlice'

// Inventory list pages' "Filter by department" dropdown is locked to the
// logged-in user's own department when they belong to ADC_PD or CGT — those
// two departments should only ever see their own department's inventory
// rows, with no way to switch the filter to another department. Every other
// department keeps today's unrestricted behavior (any department, or none).
const LOCKED_DEPARTMENT_CODES = new Set(['ADC_PD', 'CGT'])

export function useDepartmentFilterLock() {
  const user = useAppSelector(selectUser)
  const isLocked = !!user?.department_code && LOCKED_DEPARTMENT_CODES.has(user.department_code)
  return {
    isLocked,
    lockedDepartmentId: isLocked ? (user?.department_id ?? null) : null,
  }
}
