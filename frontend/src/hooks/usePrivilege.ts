import { useAppSelector } from '../store'
import { selectCan, selectIsQA, type PrivilegeKey } from '../store/privilegesSlice'

export function usePrivilege(key: PrivilegeKey): boolean {
  return useAppSelector(selectCan(key))
}

export function useIsQA(): boolean {
  return useAppSelector(selectIsQA)
}
