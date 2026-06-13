import AppRouter from './router'
import { CRDSettingsProvider } from './common/CRDSettingsContext'
import { PrivilegesProvider } from './common/PrivilegesContext'

export default function App() {
  return (
    <PrivilegesProvider>
      <CRDSettingsProvider>
        <AppRouter />
      </CRDSettingsProvider>
    </PrivilegesProvider>
  )
}
