import { useQuery } from '@tanstack/react-query'
import { ardApi } from '../api/ard'

interface HealthIndicator {
  amberDays: number
  redDays: number
  tagColor: (days: number | null) => string
  textColor: (days: number | null) => string
}

export function useHealthIndicator(): HealthIndicator {
  const { data: settings } = useQuery({
    queryKey: ['ard-settings-map'],
    queryFn: ardApi.settingsMap,
    staleTime: 5 * 60 * 1000,
  })

  const amberDays = Number((settings as any)?.HealthIndicatorAmberDays?.value ?? 7)
  const redDays = Number((settings as any)?.HealthIndicatorRedDays?.value ?? 14)

  const tagColor = (days: number | null): string => {
    if (days === null || days === undefined) return 'default'
    if (days >= redDays) return 'volcano'
    if (days >= amberDays) return 'orange'
    return 'green'
  }

  const textColor = (days: number | null): string => {
    if (days === null || days === undefined) return 'text-slate-400'
    if (days >= redDays) return 'text-red-500'
    if (days >= amberDays) return 'text-amber-500'
    return 'text-green-600'
  }

  return { amberDays, redDays, tagColor, textColor }
}
