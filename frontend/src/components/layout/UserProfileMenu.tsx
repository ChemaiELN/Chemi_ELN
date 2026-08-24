import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from 'antd'
import { LogOut } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { clearAuth, selectUser } from '../../store/authSlice'
import { clearPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { glassModalProps } from '../../utils/modalStyles'

const COLLAPSED_W = 52
const EXPANDED_W = 240
const HEIGHT = 52
const DEFAULT_TOP = 0
const EDGE_MARGIN = 8
const STORAGE_KEY = 'userProfileMenu.topPos'

function clampTop(top: number) {
  const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - HEIGHT - EDGE_MARGIN)
  return Math.min(Math.max(top, EDGE_MARGIN), maxTop)
}

function loadSavedTop() {
  const raw = Number(localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(raw) && raw > 0 ? clampTop(raw) : DEFAULT_TOP
}

// Fixed to the viewport's right edge — vertically draggable, horizontally locked —
// so it stays reachable at any scroll height across every authenticated shell
// (Admin / Inventory / ADC / module selector) without depending on each page's
// own header layout.
export default function UserProfileMenu() {
  const [hovered, setHovered] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [top, setTop] = useState(loadSavedTop)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const user = useAppSelector(selectUser)

  // Keep the component on-screen if the window is resized/rotated.
  useEffect(() => {
    const onResize = () => setTop(t => clampTop(t))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleLogout = async () => {
    setConfirmOpen(false)
    try { await authApi.logout() } catch { /* ignore */ }
    dispatch(clearAuth())
    dispatch(clearPrivileges())
    navigate('/login', { replace: true })
  }

  const stopDragging = useCallback((e: PointerEvent) => {
    const state = dragState.current
    dragState.current = null
    setDragging(false)
    document.body.style.removeProperty('user-select')
    if (state?.moved) {
      const finalTop = clampTop(state.startTop + (e.clientY - state.startY))
      localStorage.setItem(STORAGE_KEY, String(finalTop))
    }
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', stopDragging)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const state = dragState.current
    if (!state) return
    const dy = e.clientY - state.startY
    if (Math.abs(dy) > 2) state.moved = true
    setTop(clampTop(state.startTop + dy))
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only the primary button/touch should start a drag.
    if (e.button !== undefined && e.button !== 0) return
    dragState.current = { startY: e.clientY, startTop: top, moved: false }
    setDragging(true)
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? 'U'

  return (
    <>
      <div
        onMouseEnter={() => !dragging && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="fixed right-0 z-[200] flex items-center justify-center bg-white/90 backdrop-blur-md border border-white/60 border-r-0 shadow-md shadow-violet-200/30 overflow-hidden"
        style={{
          top,
          height: HEIGHT,
          width: hovered ? EXPANDED_W : COLLAPSED_W,
          maxWidth: 'calc(100vw - 8px)',
          borderTopLeftRadius: 18,
          borderBottomLeftRadius: 18,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          transition: dragging ? 'none' : 'width 300ms ease-in-out',
        }}
      >
        {/* Avatar — always visible, leads the reveal, and doubles as the vertical drag handle */}
        <div
          onPointerDown={handlePointerDown}
          className="flex items-center justify-center shrink-0 pl-[15px]"
          style={{ width: COLLAPSED_W, height: HEIGHT, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}
          title="Drag to reposition"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center pointer-events-none">
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </div>
        </div>

        {/* Username / department + actions — revealed on hover, follows the avatar */}
        <div
          className="flex items-center gap-2 min-w-0 pr-3 transition-opacity duration-200"
          style={{
            width: hovered ? EXPANDED_W - COLLAPSED_W : 0,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateX(0)' : 'translateX(-8px)',
            transitionProperty: 'width, opacity, transform',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-slate-700 text-xs font-semibold truncate leading-tight">{user?.username}</p>
            <p className="text-slate-400 text-[10px] truncate">{user?.department_name || user?.role_name}</p>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            title="Sign out"
            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50/60 shrink-0"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>

      <Modal
        title="Sign out"
        open={confirmOpen}
        onOk={handleLogout}
        onCancel={() => setConfirmOpen(false)}
        okText="Sign out"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        centered
        {...glassModalProps}
      >
        <p className="text-sm text-slate-600">Are you sure you want to sign out?</p>
      </Modal>
    </>
  )
}
