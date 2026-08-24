import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input, List, Tag, Empty, Button, Checkbox } from 'antd'
import { Search, X } from 'lucide-react'
import { apiGet } from '../../api/client'

const KIND_ROUTE: Record<string, (item: any) => string> = {
  ATR: (i) => `/ard/atrs/${i.id}`,
  Test: (i) => `/ard/atrs/${i.atrId}`,
  Experiment: (i) => `/ard/experiments/${i.id}`,
  'QC-TRF': (i) => `/ard/qc-trf/${i.id}`,
  Project: (i) => `/ard/projects/${i.id}`,
}

interface SearchResult {
  id: string
  kind: string
  title: string
  subtitle?: string
  status: string
  atrId?: string
}

export default function ArdSearchPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [arNo, setArNo] = useState('')
  const [batch, setBatch] = useState('')
  const [technique, setTechnique] = useState('')
  const [includeAttachments, setIncludeAttachments] = useState(false)

  const hasFilter = q.length >= 3 || arNo.length > 1 || batch.length > 1 || technique.length > 1

  const { data, isFetching } = useQuery({
    queryKey: ['ard-search', q, arNo, batch, technique, includeAttachments],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (q) params.q = q
      if (arNo) params.ar_no = arNo
      if (batch) params.batch = batch
      if (technique) params.technique = technique
      if (includeAttachments) params.include_attachments = 'true'
      return apiGet<{ items: SearchResult[] }>('/api/ard/search', params)
    },
    enabled: hasFilter,
  })

  const clearAll = () => { setQ(''); setArNo(''); setBatch(''); setTechnique(''); setIncludeAttachments(false) }

  const results = data?.items ?? []

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-slate-800">Search</h1>
        {hasFilter && <Tag color="blue" className="font-semibold rounded-full px-2.5">{results.length}</Tag>}
      </div>

      {/* Main text search */}
      <Input
        prefix={<Search size={16} className="text-slate-400" />}
        placeholder="Search ATRs, tests, experiments, QC-TRFs… (min 3 chars)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        allowClear
        className="mb-3"
      />

      {/* Faceted filters */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">AR Number</p>
          <Input
            size="small"
            placeholder="e.g. AR-001"
            value={arNo}
            onChange={(e) => setArNo(e.target.value)}
            allowClear
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Batch No</p>
          <Input
            size="small"
            placeholder="e.g. BCH-2024"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            allowClear
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Technique</p>
          <Input
            size="small"
            placeholder="e.g. HPLC"
            value={technique}
            onChange={(e) => setTechnique(e.target.value)}
            allowClear
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Checkbox
          checked={includeAttachments}
          onChange={(e) => setIncludeAttachments(e.target.checked)}
          className="text-xs text-slate-600"
        >
          Include Attachments
        </Checkbox>
        {(arNo || batch || technique || includeAttachments) && (
          <Button size="small" icon={<X size={12} />} onClick={clearAll} className="text-xs">
            Clear all filters
          </Button>
        )}
      </div>

      <List
        loading={isFetching}
        dataSource={results}
        locale={{ emptyText: hasFilter ? <Empty description="No results" /> : ' ' }}
        renderItem={(item) => (
          <List.Item
            className="cursor-pointer hover:bg-slate-50 rounded-lg"
            onClick={() => navigate(KIND_ROUTE[item.kind]?.(item) ?? '/ard')}
          >
            <div className="flex justify-between w-full items-center px-2">
              <div>
                <Tag>{item.kind}</Tag>
                <span className="font-medium">{item.title}</span>
                {item.subtitle && <span className="text-slate-400 ml-2 text-sm">{item.subtitle}</span>}
              </div>
              <Tag>{item.status}</Tag>
            </div>
          </List.Item>
        )}
      />
    </div>
  )
}
