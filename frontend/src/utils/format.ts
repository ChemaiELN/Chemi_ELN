export function formatDate(iso: string | null | undefined, fallback = '—'): string {
  if (!iso) return fallback
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function formatNumber(n: number, decimals = 4): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
