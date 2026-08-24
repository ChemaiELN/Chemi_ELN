import { useEffect, useRef, useState } from 'react'
import { Spin } from 'antd'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import '@univerjs/preset-sheets-core/lib/index.css'

export type SheetValue = {
  headers: string[]
  rows: string[][]
}

export function defaultSheetValue(cols = 5, rows = 8): SheetValue {
  return {
    headers: Array.from({ length: cols }, (_, i) => `Column ${i + 1}`),
    rows: Array.from({ length: rows }, () => Array(cols).fill('')),
  }
}

function toColLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function UniverSheetField({
  readOnly = false,
  height = 320,
  headers,
  lockHeaderRow = false,
}: {
  readOnly?: boolean
  height?: number
  headers?: string[]
  lockHeaderRow?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const univerRef = useRef<{ dispose: () => void } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headerKey = JSON.stringify(headers)

  useEffect(() => {
    let cancelled = false

    if (!containerRef.current) return

    const mountEl = document.createElement('div')
    mountEl.id = `univer-sheet-${Math.random().toString(36).slice(2)}`
    mountEl.style.width = '100%'
    mountEl.style.height = `${height}px`
    mountEl.style.position = 'relative'

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(mountEl)

    setLoading(true)
    setError(null)

    try {
      const colCount = headers?.length || 5
      const initialSheet = defaultSheetValue(colCount)
      if (headers?.length) {
        initialSheet.headers = headers
      }

      const cellData: Record<number, Record<number, { v: string; s?: object }>> = {}
      initialSheet.headers.forEach((h, col) => {
        cellData[0] ??= {}
        cellData[0][col] = {
          v: h,
          s: { bl: 1, bg: { rgb: '#EEF2FF' } },
        }
      })
      initialSheet.rows.forEach((r, rIdx) => {
        const rowLine = rIdx + 1
        cellData[rowLine] = {}
        initialSheet.headers.forEach((_, col) => {
          cellData[rowLine][col] = { v: r[col] ?? '' }
        })
      })

      const workbookData = {
        id: 'ard-univer-workbook',
        name: 'ARD Spreadsheet',
        appVersion: '0.25.1',
        sheetOrder: ['sheet1'],
        sheets: {
          sheet1: {
            id: 'sheet1',
            name: 'Sheet1',
            cellData,
            rowCount: 30,
            columnCount: 12,
          },
        },
      }

      const { univer, univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: mergeLocales(sheetsCoreEnUS) },
        presets: [
          UniverSheetsCorePreset({
            container: mountEl.id,
            toolbar: !readOnly,
            header: false,
            footer: false,
          } as any),
        ],
      })

      const workbook = univerAPI.createWorkbook(workbookData as any)
      univerRef.current = univerAPI

      if (lockHeaderRow && headers?.length) {
        // Protect header row from editing — analysts can fill data rows but not overwrite column names
        void (async () => {
          try {
            const sheet = workbook.getSheetBySheetId('sheet1')
            const headerRange = `A1:${toColLetter(headers.length)}1`
            const range = sheet?.getRange(headerRange)
            const rangePerm = (range as any)?.getRangePermission?.()
            if (rangePerm) {
              const existing = (await (rangePerm as any).listRules?.()) ?? []
              const rule = existing.length
                ? existing[0]
                : await (rangePerm as any).protect?.({ name: 'Column Headers', allowViewByOthers: true })
              await rule?.setPoint?.((univerAPI as any).Enum?.RangePermissionPoint?.Edit, false)
            }
          } catch {
            // Permission API may be unavailable — header row styled but remains editable
          }
          if (!cancelled) setLoading(false)
        })()
      } else {
        if (!cancelled) setLoading(false)
      }
    } catch (err) {
      if (!cancelled) {
        setLoading(false)
        setError(err instanceof Error ? err.message : 'Spreadsheet failed to initialize')
      }
    }

    return () => {
      cancelled = true
      try {
        univerRef.current?.dispose?.()
      } catch (e) {
        // ignore cleanup error
      }
    }
  }, [readOnly, height, headerKey, lockHeaderRow])

  return (
    <div className="relative w-full glass-card rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Spin tip="Loading Univer Spreadsheet..." />
        </div>
      )}
      {error && (
        <div className="p-4 text-xs text-red-500 bg-red-50 font-mono">{error}</div>
      )}
      <div ref={containerRef} style={{ minHeight: height }} />
    </div>
  )
}
