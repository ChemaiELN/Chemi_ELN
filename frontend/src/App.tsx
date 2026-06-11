import AppRouter from './router'
import { CRDSettingsProvider } from './common/CRDSettingsContext'

export default function App() {
  return (
    <CRDSettingsProvider>
      <AppRouter />
    </CRDSettingsProvider>
  )
}
