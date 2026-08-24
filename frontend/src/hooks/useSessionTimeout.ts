import { useEffect, useRef } from 'react'
import { message, Modal } from 'antd'
import { authApi } from '../api/auth'
import { useAppDispatch } from '../store'
import { clearAuth } from '../store/authSlice'

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000 // 20 Minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000 // 2 Minutes warning

export function useSessionTimeout(enabled = true) {
  const dispatch = useAppDispatch()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    if (!enabled) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    // Warning after 18 minutes
    warningRef.current = setTimeout(() => {
      Modal.warning({
        title: 'Session Expiry Warning',
        content: 'Your session will expire in 2 minutes due to inactivity. Move your mouse or press any key to stay logged in.',
        okText: 'Extend Session',
      })
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS)

    // Auto logout after 20 minutes
    timeoutRef.current = setTimeout(async () => {
      message.error('Session expired due to inactivity. Please log in again.')
      try {
        await authApi.logout()
      } catch {
        // ignore error on forced logout
      }
      dispatch(clearAuth())
    }, INACTIVITY_TIMEOUT_MS)
  }

  useEffect(() => {
    if (!enabled) return

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    const handleActivity = () => resetTimer()

    events.forEach(evt => window.addEventListener(evt, handleActivity))
    resetTimer()

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [enabled])
}
