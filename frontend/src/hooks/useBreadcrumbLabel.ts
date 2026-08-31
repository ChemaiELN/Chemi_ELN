import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppDispatch } from '../store'
import { setBreadcrumbLabel } from '../store/uiSlice'

// Lets a detail page override the last breadcrumb segment (which InventoryShell
// otherwise derives from the raw URL — e.g. a numeric id) once it has a
// human-readable label to show instead (e.g. an Equipment/Instrument code).
// Tagged with the current pathname so the shell only ever applies it to the
// page that set it — no separate "clear on navigate" step needed, and no
// race with effect ordering between the shell and this page.
export function useBreadcrumbLabel(label: string | null | undefined) {
  const dispatch = useAppDispatch()
  const { pathname } = useLocation()
  useEffect(() => {
    if (label) dispatch(setBreadcrumbLabel({ path: pathname, label }))
  }, [dispatch, pathname, label])
}
