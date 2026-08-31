import { createSlice } from '@reduxjs/toolkit'

interface BreadcrumbLabel {
  path: string
  label: string
}

interface UiState {
  sidebarOpen: boolean
  // Lets a detail page (e.g. Equipment/Instrument overview) override the last
  // breadcrumb segment once its record has loaded — the breadcrumb itself is
  // built purely from the URL (see InventoryShell.tsx's useBreadcrumbs), which
  // only ever sees the raw numeric id, never the record's human-readable code.
  // Tagged with the path it belongs to (rather than just clearing on
  // navigate) so a stale label from the previously visited page can never
  // apply to a different one, regardless of effect-ordering between the
  // shell and the page setting it.
  breadcrumbLabel: BreadcrumbLabel | null
}

const initialState: UiState = { sidebarOpen: true, breadcrumbLabel: null }

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen },
    setSidebarOpen(state, action) { state.sidebarOpen = action.payload },
    setBreadcrumbLabel(state, action) { state.breadcrumbLabel = action.payload },
  },
})

export const { toggleSidebar, setSidebarOpen, setBreadcrumbLabel } = uiSlice.actions
export const selectBreadcrumbLabelFor = (path: string) => (state: { ui: UiState }) =>
  state.ui.breadcrumbLabel?.path === path ? state.ui.breadcrumbLabel.label : null
export default uiSlice.reducer
