import React, { useState, useEffect } from 'react'
import { Table, Button, Select, Input, Tag, Checkbox, Badge, message } from 'antd'
import { HomeOutlined, ExportOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'
import { getATRs, type ATRSummary as APIATR } from '@/utilities/chemiaApi'

interface ProjectATRRecord {
  key: string
  index: number
  atrNo: string
  testType: string
  objectives: string
  status: string
  raisedBy: string
  raisedOn: string
  assignedTo: string
  dueDate: string
}

function mapATR(a: APIATR, idx: number): ProjectATRRecord {
  return {
    key: a.id,
    index: idx + 1,
    atrNo: a.atr_no,
    testType: a.test_type,
    objectives: a.objectives,
    status: a.status,
    raisedBy: a.raised_by,
    raisedOn: a.raised_at ? a.raised_at.slice(0, 10) : '—',
    assignedTo: a.assigned_to ?? '—',
    dueDate: a.due_date ? a.due_date.slice(0, 10) : '—',
  }
}

const ProjectATRsPage: React.FC = () => {
  const navigate = useNavigate()
  const [tableData, setTableData]           = useState<ProjectATRRecord[]>([])
  const [loading, setLoading]               = useState(false)
  const [statusFilter, setStatusFilter]     = useState<string | undefined>(undefined)
  const [testTypeFilter, setTestTypeFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate]             = useState('')
  const [toDate, setToDate]                 = useState('')

  useEffect(() => {
    setLoading(true)
    getATRs({ page_size: 100 })
      .then((resp) => setTableData(resp.items.map(mapATR)))
      .catch(() => { message.error('Failed to load Project ATRs') })
      .finally(() => { setLoading(false) })
  }, [])

  const filtered = tableData.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (testTypeFilter && r.testType !== testTypeFilter) return false
    if (fromDate && r.raisedOn !== '—' && r.raisedOn < fromDate) return false
    if (toDate && r.raisedOn !== '—' && r.raisedOn > toDate) return false
    return true
  })

  const columns: ColumnsType<ProjectATRRecord> = [
    {
      title: '', dataIndex: 'select', key: 'select', width: 40,
      render: () => <Checkbox />,
    },
    { title: 'ATR No.', dataIndex: 'atrNo', key: 'atrNo',
      render: (v: string) => <span className={styles.monoText}>{v}</span> },
    { title: 'Test Type', dataIndex: 'testType', key: 'testType' },
    { title: 'Objectives', dataIndex: 'objectives', key: 'objectives' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => <StatusTag status={v} />,
    },
    { title: 'Raised By', dataIndex: 'raisedBy', key: 'raisedBy' },
    { title: 'Raised On', dataIndex: 'raisedOn', key: 'raisedOn' },
    { title: 'Assigned To', dataIndex: 'assignedTo', key: 'assignedTo' },
    { title: 'Due Date', dataIndex: 'dueDate', key: 'dueDate' },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="atr" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
              <HomeOutlined style={{ marginRight: 4 }} />Home
            </span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/atr')}>ATR</span>
            <span style={{ margin: '0 6px' }}>/</span>
            <span>Project ATRs</span>
          </div>

          {/* Filter card */}
          {/*
          <div className={styles.filterCard}>
            <div className={styles.filterRow}>
              <div>
                <div className={styles.filterLabel}>Status</div>
                <Select placeholder="All statuses" size="small" style={{ width: '100%' }} allowClear
                  value={statusFilter} onChange={setStatusFilter}
                  options={[
                    { value: 'NEW', label: 'NEW' }, { value: 'SUBMITTED', label: 'SUBMITTED' },
                    { value: 'VERIFIED', label: 'VERIFIED' }, { value: 'COMPLETED', label: 'COMPLETED' },
                    { value: 'CANCELLED', label: 'CANCELLED' },
                  ]}
                />
              </div>
              <div>
                <div className={styles.filterLabel}>Test Type</div>
                <Select placeholder="All types" size="small" style={{ width: '100%' }} allowClear
                  value={testTypeFilter} onChange={setTestTypeFilter}
                  options={[
                    { value: 'NMR', label: 'NMR' }, { value: 'HPLC', label: 'HPLC' },
                    { value: 'MS', label: 'MS' }, { value: 'IR', label: 'IR' },
                    { value: 'GC-MS', label: 'GC-MS' }, { value: 'XRD', label: 'XRD' },
                  ]}
                />
              </div>
              <div>
                <div className={styles.filterLabel}>From</div>
                <Input type="date" size="small" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <div className={styles.filterLabel}>To</div>
                <Input type="date" size="small" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <Button className={styles.searchBtn} size="small" icon={<SearchOutlined />}>Search</Button>
            </div>
          </div>
          */}

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Project ATRs
                <Badge
                  count={filtered.length}
                  style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }}
                />
              </div>
              <div className={styles.tableCardActions}>
                <Select
                  className={styles.headerSelect}
                  placeholder="All statuses"
                  allowClear
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'NEW', label: 'NEW' }, { value: 'SUBMITTED', label: 'SUBMITTED' },
                    { value: 'VERIFIED', label: 'VERIFIED' }, { value: 'COMPLETED', label: 'COMPLETED' },
                    { value: 'CANCELLED', label: 'CANCELLED' },
                  ]}
                />
                <Select
                  className={styles.headerSelect}
                  placeholder="All types"
                  allowClear
                  value={testTypeFilter}
                  onChange={setTestTypeFilter}
                  options={[
                    { value: 'NMR', label: 'NMR' }, { value: 'HPLC', label: 'HPLC' },
                    { value: 'MS', label: 'MS' }, { value: 'IR', label: 'IR' },
                    { value: 'GC-MS', label: 'GC-MS' }, { value: 'XRD', label: 'XRD' },
                  ]}
                />
                <Button
                  className={styles.searchBtn}
                  icon={<SearchOutlined />}
                  onClick={() => {}}
                >Search</Button>
                <Button
                  className={styles.clearBtn}
                  onClick={() => { setStatusFilter(undefined); setTestTypeFilter(undefined) }}
                >Clear</Button>
                <Button className={styles.exportBtn} size="small" icon={<ExportOutlined />}>Export</Button>
              </div>
            </div>
            <Table<ProjectATRRecord>
              className={styles.table}
              columns={columns}
              dataSource={filtered}
              loading={loading}
              size="small"
              rowKey="key"
              pagination={{ pageSize: 10, showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}` }}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default ProjectATRsPage
