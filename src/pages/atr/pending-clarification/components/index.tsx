import React, { useState, useEffect } from 'react'
import { Table, Button, Select, Tag, Badge, message } from 'antd'
import { HomeOutlined, ExportOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import { getATRs, type ATRSummary as APIATR } from '@/utilities/chemiaApi'

interface ClarificationRecord {
  key: string
  atrNo: string
  testType: string
  objectives: string
  status: string
  raisedBy: string
  raisedOn: string
  dueDate: string
}

const statusClassMap: Record<string, string> = {
  NEW:       styles.tagNew ?? styles.tagPending,
  SUBMITTED: styles.tagSubmitted ?? styles.tagPending,
  VERIFIED:  styles.tagVerified ?? styles.tagResolved,
  COMPLETED: styles.tagCompleted ?? styles.tagResolved,
  CANCELLED: styles.tagNew ?? styles.tagPending,
}

function mapATR(a: APIATR): ClarificationRecord {
  return {
    key: a.id,
    atrNo: a.atr_no,
    testType: a.test_type,
    objectives: a.objectives,
    status: a.status,
    raisedBy: a.raised_by,
    raisedOn: a.raised_at ? a.raised_at.slice(0, 10) : '—',
    dueDate: a.due_date ? a.due_date.slice(0, 10) : '—',
  }
}

const PendingClarificationPage: React.FC = () => {
  const navigate = useNavigate()
  const [tableData, setTableData]       = useState<ClarificationRecord[]>([])
  const [loading, setLoading]           = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  useEffect(() => {
    setLoading(true)
    // Show SUBMITTED ATRs as "pending clarification"
    getATRs({ status: 'SUBMITTED', page_size: 100 })
      .then((resp) => setTableData(resp.items.map(mapATR)))
      .catch(() => { message.error('Failed to load Pending Clarifications') })
      .finally(() => { setLoading(false) })
  }, [])

  const filtered = tableData.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    return true
  })

  const columns: ColumnsType<ClarificationRecord> = [
    { title: 'ATR No.', dataIndex: 'atrNo', key: 'atrNo',
      render: (v: string) => <span className={styles.monoText}>{v}</span> },
    { title: 'Test Type', dataIndex: 'testType', key: 'testType' },
    { title: 'Objectives', dataIndex: 'objectives', key: 'objectives' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (v: string) => (
        <Tag className={`${styles.statusTag} ${statusClassMap[v] ?? ''}`}>{v}</Tag>
      ),
    },
    { title: 'Raised By', dataIndex: 'raisedBy', key: 'raisedBy' },
    { title: 'Raised On', dataIndex: 'raisedOn', key: 'raisedOn' },
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
            <span>Pending Clarification</span>
          </div>

          {/* Filter card */}
          {/*
          <div className={styles.filterCard}>
            <span className={styles.filterLabel}>Status</span>
            <Select
              placeholder="All statuses" allowClear size="small"
              className={styles.filterSelect ?? ''}
              value={statusFilter} onChange={setStatusFilter}
              options={[
                { value: 'NEW', label: 'NEW' }, { value: 'SUBMITTED', label: 'SUBMITTED' },
                { value: 'VERIFIED', label: 'VERIFIED' }, { value: 'COMPLETED', label: 'COMPLETED' },
              ]}
            />
          </div>
          */}

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Pending Clarification
                <Badge
                  count={filtered.length}
                  style={{ backgroundColor: '#fffbeb', color: '#b45309', boxShadow: 'none', fontWeight: 600, fontSize: 11 }}
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
                  ]}
                />
                <Button className={styles.exportBtn} size="small" icon={<ExportOutlined />}>Export</Button>
              </div>
            </div>
            <Table<ClarificationRecord>
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

export default PendingClarificationPage
