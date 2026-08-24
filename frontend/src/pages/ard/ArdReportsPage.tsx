import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, Table, Button, Input, message, Tag, Spin, DatePicker, InputNumber } from 'antd'
import { FileText, Search, FileSpreadsheet, BarChart2, Activity, Clock, FlaskConical, CheckCircle, FolderKanban } from 'lucide-react'
import type { Dayjs } from 'dayjs'
import { ardReportsApi, type ReportTable, type ReportKey } from '../../api/ard'

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function ReportTableView({
  data,
  isLoading,
  report,
  filenamePrefix,
  title,
  days,
}: {
  data?: ReportTable
  isLoading?: boolean
  report: ReportKey
  filenamePrefix: string
  title: string
  days?: number
}) {
  const [msg, ctx] = message.useMessage()
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [exportingXlsx, setExportingXlsx] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const onExportXlsx = async () => {
    setExportingXlsx(true)
    try {
      const { blob } = await ardReportsApi.downloadXlsx(report, days)
      download(blob, `${filenamePrefix}.xlsx`)
      msg.success('Excel report downloaded successfully.')
    } catch {
      msg.error('Failed to export Excel report.')
    } finally {
      setExportingXlsx(false)
    }
  }

  const onExportPdf = async () => {
    setExportingPdf(true)
    try {
      const { blob } = await ardReportsApi.downloadPdf(report, days)
      download(blob, `${filenamePrefix}.pdf`)
      msg.success('PDF report downloaded successfully.')
    } catch {
      msg.error('Failed to export PDF report.')
    } finally {
      setExportingPdf(false)
    }
  }

  const allRows = (data?.rows ?? []).map((r) =>
    Object.fromEntries((data?.headers ?? []).map((h, i) => [h, r[i]]))
  )

  const filteredRows = allRows.filter((row) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!Object.values(row).some((val) => String(val ?? '').toLowerCase().includes(q))) return false
    }
    if (dateRange[0] || dateRange[1]) {
      const dateVals = Object.values(row).map(v => String(v ?? '')).filter(v => /^\d{4}-\d{2}-\d{2}/.test(v))
      if (dateVals.length > 0) {
        const inRange = dateVals.some(v => {
          if (dateRange[0] && v < dateRange[0].format('YYYY-MM-DD')) return false
          if (dateRange[1] && v > dateRange[1].format('YYYY-MM-DD')) return false
          return true
        })
        if (!inRange) return false
      }
    }
    return true
  })

  return (
    <div className="space-y-4">
      {ctx}
      {/* Action and Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 glass-card rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Input
            placeholder="Search report records..."
            prefix={<Search size={15} className="text-slate-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64"
            allowClear
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range ?? [null, null])}
            format="DD MMM YYYY"
            placeholder={['From date', 'To date']}
            allowClear
            className="w-full sm:w-auto"
          />
          <Tag color="blue" className="px-2.5 py-1 text-xs rounded-full font-medium">
            {filteredRows.length} of {allRows.length} records
          </Tag>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            icon={<FileSpreadsheet size={15} className="text-violet-600" />}
            onClick={onExportXlsx}
            loading={exportingXlsx}
            className="hover:border-violet-500 hover:text-violet-600"
          >
            Export Excel
          </Button>
          <Button
            type="primary"
            icon={<FileText size={15} />}
            onClick={onExportPdf}
            loading={exportingPdf}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 border-none"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Table Display */}
      <div className="glass-card rounded-lg p-2 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spin size="large" /></div>
        ) : null}
        <Table
          rowKey={(_, i) => String(i)}
          dataSource={isLoading ? [] : filteredRows}
          size="middle"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t) => `Total ${t} items` }}
          columns={(data?.headers ?? []).map((h) => ({
            title: h,
            dataIndex: h,
            key: h,
            render: (val: unknown) => {
              if (val === null || val === undefined || val === '') return <span className="text-slate-300">—</span>
              if (String(val).toUpperCase() === 'APPROVED' || String(val).toUpperCase() === 'VERIFIED') {
                return <Tag color="green">{String(val)}</Tag>
              }
              if (String(val).toUpperCase() === 'REJECTED' || String(val).toUpperCase() === 'WITHDRAWN') {
                return <Tag color="red">{String(val)}</Tag>
              }
              if (String(val).toUpperCase().includes('REWORK') || String(val).toUpperCase().includes('PENDING')) {
                return <Tag color="gold">{String(val)}</Tag>
              }
              return <span className="text-slate-700">{String(val)}</span>
            },
          }))}
        />
      </div>
    </div>
  )
}

function DayFilteredReport({
  label,
  report,
  filenamePrefix,
  title,
  defaultDays,
  fetchFn,
}: {
  label: string
  report: ReportKey
  filenamePrefix: string
  title: string
  defaultDays: number
  fetchFn: (days: number) => Promise<ReportTable>
}) {
  const [days, setDays] = useState(defaultDays)
  const { data, isLoading } = useQuery({
    queryKey: [`ard-report-${report}`, days],
    queryFn: () => fetchFn(days),
  })
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Show records older than</span>
        <InputNumber
          min={1} max={365} value={days}
          onChange={v => v && setDays(v)}
          addonAfter="days"
          style={{ width: 140 }}
        />
      </div>
      <ReportTableView data={data} isLoading={isLoading} report={report}
        filenamePrefix={filenamePrefix} title={title} days={days} />
    </div>
  )
}

export default function ArdReportsPage() {
  const { data: batchSummary, isLoading: loadingBatch } = useQuery({
    queryKey: ['ard-report-batch-summary'],
    queryFn: ardReportsApi.batchSummary,
  })
  const { data: unsatisfactory, isLoading: loadingUnsat } = useQuery({
    queryKey: ['ard-report-unsatisfactory'],
    queryFn: ardReportsApi.unsatisfactoryTests,
  })
  const { data: expEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['ard-report-exp-events'],
    queryFn: ardReportsApi.experimentEvents,
  })
  const { data: projectReport, isLoading: loadingProject } = useQuery({
    queryKey: ['ard-report-project'],
    queryFn: ardReportsApi.projectReport,
  })

  return (
    <div className="p-4 md:p-6 space-y-4 w-full">
      <div className="flex items-center gap-2">
        <BarChart2 size={20} className="text-violet-600" />
        <h1 className="text-lg font-bold text-slate-800">Analytical Reports</h1>
      </div>
      {/* Tabs Section */}
      <div className="glass-card rounded-lg p-6">
        <Tabs
          type="card"
          items={[
            {
              key: 'batch',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <BarChart2 size={16} /> Batch Summary
                </span>
              ),
              children: (
                <ReportTableView
                  data={batchSummary}
                  isLoading={loadingBatch}
                  report="batch-summary"
                  filenamePrefix="ard-batch-summary"
                  title="Batch Summary Report"
                />
              ),
            },
            {
              key: 'unsatisfactory',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <FileText size={16} /> Unsatisfactory Tests
                </span>
              ),
              children: (
                <ReportTableView
                  data={unsatisfactory}
                  isLoading={loadingUnsat}
                  report="unsatisfactory-tests"
                  filenamePrefix="ard-unsatisfactory-tests"
                  title="Unsatisfactory Tests Report"
                />
              ),
            },
            {
              key: 'events',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <Activity size={16} /> Experiment Events
                </span>
              ),
              children: (
                <ReportTableView
                  data={expEvents}
                  isLoading={loadingEvents}
                  report="experiment-events"
                  filenamePrefix="ard-experiment-events"
                  title="Experiment Audit Events Report"
                />
              ),
            },
            {
              key: 'delayed-atrs',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <Clock size={16} /> Delayed Submission
                </span>
              ),
              children: (
                <DayFilteredReport
                  label="Delayed ATRs"
                  report="delayed-atrs"
                  filenamePrefix="ard-delayed-atrs"
                  title="Delayed ATRs Report"
                  defaultDays={7}
                  fetchFn={ardReportsApi.delayedAtrs}
                />
              ),
            },
            {
              key: 'inactive-experiments',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <FlaskConical size={16} /> Inactive Experiments
                </span>
              ),
              children: (
                <DayFilteredReport
                  label="Inactive Experiments"
                  report="inactive-experiments"
                  filenamePrefix="ard-inactive-experiments"
                  title="Inactive Experiments Report"
                  defaultDays={14}
                  fetchFn={ardReportsApi.inactiveExperiments}
                />
              ),
            },
            {
              key: 'delayed-approvals',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <CheckCircle size={16} /> Delayed Approvals
                </span>
              ),
              children: (
                <DayFilteredReport
                  label="Delayed Approvals"
                  report="delayed-approvals"
                  filenamePrefix="ard-delayed-approvals"
                  title="Delayed Approvals Report"
                  defaultDays={3}
                  fetchFn={ardReportsApi.delayedApprovals}
                />
              ),
            },
            {
              key: 'project-report',
              label: (
                <span className="flex items-center gap-2 px-1 py-0.5">
                  <FolderKanban size={16} /> Project Summary
                </span>
              ),
              children: (
                <ReportTableView
                  data={projectReport}
                  isLoading={loadingProject}
                  report="project-report"
                  filenamePrefix="ard-project-report"
                  title="Project Summary Report"
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
