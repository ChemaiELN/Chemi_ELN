import { useAppSelector } from '../store'
import { selectCan, selectCanDo, selectIsQA, type PrivilegeKey } from '../store/privilegesSlice'
import type { AdcPrivilege, CgtPrivilege } from '../utils/adcPrivileges'

export function usePrivilege(key: PrivilegeKey): boolean {
  return useAppSelector(selectCan(key))
}

export function useIsQA(): boolean {
  return useAppSelector(selectIsQA)
}

/**
 * Fine-grained (department, role) operation check, configured per department+role
 * in Admin → Department/Role → Department Role Privileges.
 */
export function useCan(key: AdcPrivilege | CgtPrivilege): boolean {
  return useAppSelector(selectCanDo(key))
}
