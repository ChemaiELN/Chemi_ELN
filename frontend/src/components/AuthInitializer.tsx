import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store'
import { clearAuth, setAuth, setInitialized, selectAuthInitialized, selectAccessToken } from '../store/authSlice'
import { setPrivileges } from '../store/privilegesSlice'
import { authApi } from '../api/auth'
import { isSuperAdmin, isAdminPrivilegedRole, resolveGrants } from '../utils/privileges'
import { useIdleSession } from '../hooks/useIdleSession'
import FirstLoginGuard from './auth/FirstLoginGuard'

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const initialized = useAppSelector(selectAuthInitialized)
  const accessToken = useAppSelector(selectAccessToken)

  // Idle-timeout + silent token refresh (keeps active users logged in;
  // logs out only after sustained inactivity).
  useIdleSession()

  useEffect(() => {
    if (!accessToken) {
      dispatch(setInitialized())
      return
    }
    authApi.me()
      .then(user => {
        dispatch(setAuth({ user, accessToken }))
        dispatch(setPrivileges({
          keys: resolveGrants(user),
          isQA: isSuperAdmin(user),
          deptPrivileges: user.privileges ?? [],
          isSuperAdmin: isAdminPrivilegedRole(user.role_code),
        }))
      })
      .catch(() => {
        dispatch(clearAuth())
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <FirstLoginGuard />
      {children}
    </>
  )
}
