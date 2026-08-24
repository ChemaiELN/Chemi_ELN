import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Table, Input } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Search, PenLine } from 'lucide-react'
import { calcTemplateApi, type CalcTemplateSummary } from '../../../api/calcTemplates'
import { StatusTag } from '../../../components/ui/StatusTag'

// List of Univer-based calc templates — mirrors WorkflowTemplatesPage's
// list/create/open flow, but for spreadsheet templates rather than the
// section/screen/field form builder.
//
// Scoped per-department: ADC's list only shows its own templates (legacy
// 'CALC' rows plus the new 'CALC_ADC' category) and CGT only shows
// 'CALC_CGT' rows — enforced here via the `scope` query param, mirrored by
// the backend's GET /api/calc-templates handler.
interface CalcTemplatesPageProps {
  scope: 'ADC' | 'CGT'
}

export default function CalcTemplatesPage({ scope }: CalcTemplatesPageProps) {
  const navigate = useNavigate()
  const basePath = scope === 'ADC' ? '/adc/calc-templates' : '/cgt/calc-templates'

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    debounceRef.current = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  const [page, setPage] = useState(1)
  const pageSize = 10
  const [sortBy,  setSortBy]  = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  useEffect(() => { setPage(1) }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['calc-templates', scope, page, pageSize, search, sortBy, sortDir],
    queryFn: () => calcTemplateApi.listPaged({
      scope, page, limit: pageSize, search: search || undefined,
      sort_by: sortBy ?? undefined, sort_dir: sortDir,
    }),
  })
  const templates = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-6">
      {/* Header bar */}
      <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap mb-3" style={{ backgroundColor: '#FEFEFA' }}>
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name or slug…"
          style={{ width: 260 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => navigate(`${basePath}/new`)} className="rounded-md font-medium">
          New Template
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-hidden" style={{ backgroundColor: '#FEFEFA' }}>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={templates}
          onRow={t => ({ onClick: () => navigate(`${basePath}/${t.id}`) })}
          className="cursor-pointer"
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{ current: page, pageSize, total, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} templates` }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            const s = sorter as SorterResult<CalcTemplateSummary>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
          locale={{ emptyText: 'No calc templates found.' }}
          columns={[
            {
              title: 'Name', dataIndex: 'name', key: 'name', width: 220,
              sorter: true,
              render: (v: string) => <span className="text-[13px] font-medium text-violet-600">{v}</span>,
            },
            {
              title: 'Slug', dataIndex: 'slug', key: 'slug', width: 220,
              sorter: true,
              render: (v: string) => <span className="text-[13px] text-slate-800">{v}</span>,
            },
            {
              title: 'Version', dataIndex: 'version', key: 'version', width: 90, align: 'center' as const,
              sorter: true,
              render: (v: number) => <span className="text-[13px] text-slate-800">{v}</span>,
            },
            {
              title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 130, align: 'center' as const,
              sorter: true,
              render: (active: boolean) => <StatusTag color={active ? 'green' : 'default'} className="text-[13px]">{active ? 'Published' : 'Draft'}</StatusTag>,
            },
            {
              title: 'Updated', dataIndex: 'updated_at', key: 'updated_at', width: 180,
              sorter: true,
              render: (v: string) => <span className="text-[13px] text-slate-800">{new Date(v).toLocaleString()}</span>,
            },
            {
              title: 'Actions', key: 'actions', width: 100, align: 'center' as const,
              render: (_: unknown, t: CalcTemplateSummary) => t.is_active ? (
                <Button
                  size="small" icon={<PenLine size={12} />}
                  onClick={e => { e.stopPropagation(); navigate(`/calc-templates/${t.id}/fill`) }}
                >
                  Fill
                </Button>
              ) : null,
            },
          ]}
        />
      </div>
    </div>
  )
}
