import { useCallback, useState } from 'react'
import { Button, Input, Space } from 'antd'
import { Search } from 'lucide-react'

// Per-column search — a small filter icon in each header that expands into an
// inline search box. Unlike antd's typical client-side filterDropdown/onFilter
// pattern, the typed value here is written into `columnFilters` state (via
// Table's onChange `filters` payload) and must be merged into the params sent
// to the backend list endpoint on every reload — filtering happens server-side
// against the full dataset, not just the already-fetched page.
export function useColumnSearch() {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})

  const getColumnSearchProps = useCallback((field: string, title: string) => ({
    filteredValue: columnFilters[field] ? [columnFilters[field]] : null,
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
      <div
        style={{ padding: 8, background: '#fafafa', borderRadius: 8, boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)', border: '1px solid #e2e8f0' }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Input
          placeholder={`Search ${title}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          autoComplete="off"
          style={{ width: 180, marginBottom: 8, display: 'block' }}
        />
        <Space>
          <Button type="primary" size="small" onClick={() => confirm()} style={{ width: 88 }}>Search</Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm() }} style={{ width: 88 }}>Reset</Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => <Search size={12} color={filtered ? '#4f46e5' : '#94a3b8'} />,
    // Rows returned are already server-filtered — no client-side removal needed.
    onFilter: () => true,
  }), [columnFilters])

  // Wire into a Table's onChange: (pagination, filters, sorter) => { ...; handleTableFilters(filters) }
  const handleTableFilters = useCallback((filters: Record<string, unknown>) => {
    const next: Record<string, string> = {}
    for (const [field, value] of Object.entries(filters)) {
      const v = (value as string[] | null)?.[0]
      if (v) next[field] = v
    }
    setColumnFilters(next)
  }, [])

  return { columnFilters, getColumnSearchProps, handleTableFilters }
}
