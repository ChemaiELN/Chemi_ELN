import { QueryClient } from '@tanstack/react-query'

// Single shared instance — imported by main.tsx to back the app's
// QueryClientProvider, and by the logout paths so they can clear it. Logout
// only ever does a client-side navigate('/login'), never a full page
// reload, so without an explicit clear() every cached query (dashboards,
// project pickers, notebooks, etc.) would keep serving the previous user's
// data to whoever logs into the same browser tab next.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})
