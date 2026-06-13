import React, { useState, useEffect } from 'react'
import { Table, Button, Input, Select, Tag, Typography, Breadcrumb, Modal, Form, Switch, Tooltip } from 'antd'
import { HomeOutlined, PlusOutlined, SearchOutlined, ExportOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'
import { getATRs, createATR, getExperiments, type ATRSummary as APIATR } from '@/utilities/chemiaApi'
import { message } from 'antd'

const { Text } = Typography
const { Option } = Select

const TEST_TYPES = ['NMR', 'HPLC', 'MS', 'IR', 'GC-MS', 'XRD', 'UV-Vis', 'TGA', 'DSC']

interface ATRRecord {
  key: string
  index: number
  atrNo: string
  testType: string
  objectives: string
  status: 'NEW' | 'SUBMITTED' | 'VERIFIED' | 'COMPLETED' | 'CANCELLED'
  raisedBy: string
  raisedOn: string
  dueDate: string
  /** v2 */
  version: number
  isLatestVersion: boolean
}

function mapATR(a: APIATR, idx: number): ATRRecord {
  return {
    key:             a.id,
    index:           idx + 1,
    atrNo:           a.atr_no,
    testType:        a.test_type,
    objectives:      a.objectives,
    status:          a.status as ATRRecord['status'],
    raisedBy:        a.raised_by,
    raisedOn:        a.raised_at ? a.raised_at.slice(0, 10) : '—',
    dueDate:         a.due_date  ? a.due_date.slice(0, 10)  : '—',
    version:         a.version         ?? 1,
    isLatestVersion: a.is_latest_version ?? true,
  }
}

const ATRList: React.FC = () => {
  const navigate = useNavigate()
  const [allData, setAllData]           = useState<ATRRecord[]>([])
  const [loading, setLoading]           = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate]         = useState('')
  const [toDate, setToDate]             = useState('')
  const [raisedBy, setRaisedBy]         = useState('')
  /** v2: show only latest version of each ATR (default true) */
  const [latestOnly, setLatestOnly]     = useState(true)

  // New ATR modal
  const [createOpen, setCreateOpen]     = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [expOptions, setExpOptions]     = useState<{ value: string; label: string }[]>([])

  const openCreate = () => {
    createForm.resetFields()
    getExperiments({ page_size: 100 })
      .then(r => setExpOptions(r.items.map(e => ({ value: e.id, label: `${e.full_code} — ${e.title}` }))))
      .catch(() => {})
    setCreateOpen(true)
  }

  const handleCreate = async (values: Record<string, string>) => {
    setCreateLoading(true)
    try {
      const atr = await createATR({
        test_type:     values.test_type,
        objectives:    values.objectives,
        experiment_id: values.experiment_id || undefined,
        due_date:      values.due_date || undefined,
      })
      message.success('ATR created')
      setCreateOpen(false)
      navigate(`/atr/${atr.id}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create ATR')
    } finally {
      setCreateLoading(false)
    }
  }

  const loadATRs = () => {
    setLoading(true)
    getATRs({ page_size: 200, latest_only: latestOnly })
      .then((resp) => setAllData(resp.items.map(mapATR)))
      .catch(() => message.error('Failed to load ATRs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadATRs() }, [latestOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredData = allData.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (fromDate && r.raisedOn !== '—' && r.raisedOn < fromDate) return false
    if (toDate && r.raisedOn !== '—' && r.raisedOn > toDate) return false
    if (raisedBy && !r.raisedBy.toLowerCase().includes(raisedBy.toLowerCase())) return false
    return true
  })

  const handleClear = () => {
    setStatusFilter(undefined)
    setFromDate('')
    setToDate('')
    setRaisedBy('')
    setLatestOnly(true)
  }

  const columns: ColumnsType<ATRRecord> = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      width: 48,
    },
    {
      title: 'ATR No.',
      dataIndex: 'atrNo',
      key: 'atrNo',
      render: (val: string) => (
        <Text className={styles.atrNo}>{val}</Text>
      ),
    },
    {
      title: 'Ver.',
      dataIndex: 'version',
      key: 'version',
      width: 64,
      render: (v: number, record: ATRRecord) => (
        <Tooltip title={record.isLatestVersion ? 'Latest version' : 'Older version'}>
          <Tag
            style={{
              fontSize: 10, fontWeight: 700,
              borderRadius: 3, padding: '0 5px', cursor: 'default',
              background: record.isLatestVersion ? '#f0fdf4' : '#fefce8',
              color:      record.isLatestVersion ? '#15803d'  : '#92400e',
              border:     record.isLatestVersion ? '1px solid #bbf7d0' : '1px solid #fde68a',
            }}
          >
            v{v}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Test Type',
      dataIndex: 'testType',
      key: 'testType',
    },
    {
      title: 'Objectives',
      dataIndex: 'objectives',
      key: 'objectives',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        return <StatusTag status={val} />
      },
    },
    {
      title: 'Raised By',
      dataIndex: 'raisedBy',
      key: 'raisedBy',
    },
    {
      title: 'Raised On',
      dataIndex: 'raisedOn',
      key: 'raisedOn',
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: ATRRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/atr/${record.key}`)}
          className={styles.viewBtn}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="atr" />
        <main className={styles.main}>
          <div className={styles.breadcrumbRow}>
            <Breadcrumb
              items={[
                {
                  title: (
                    <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}>
                      <HomeOutlined /> Home
                    </span>
                  ),
                },
                { title: 'ATR' },
              ]}
            />
            <Button
              icon={<PlusOutlined />}
              size="small"
              className={styles.newBtn}
              onClick={openCreate}
            >
              New ATR
            </Button>
          </div>

          <div className={styles.filterCard}>
            <span className={styles.filterLabel}>Status</span>
            <Select
              placeholder="All statuses"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              size="small"
              className={styles.filterSelect}
            >
              <Option value="NEW">NEW</Option>
              <Option value="SUBMITTED">SUBMITTED</Option>
              <Option value="VERIFIED">VERIFIED</Option>
              <Option value="COMPLETED">COMPLETED</Option>
            </Select>
            <span className={styles.filterLabel}>From Date</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              size="small"
              className={styles.filterInput}
            />
            <span className={styles.filterLabel}>To Date</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              size="small"
              className={styles.filterInput}
            />
            <span className={styles.filterLabel}>Raised By</span>
            <Input
              placeholder="Raised by"
              value={raisedBy}
              onChange={(e) => setRaisedBy(e.target.value)}
              size="small"
              className={styles.filterInput}
            />
            <Button icon={<SearchOutlined />} size="small" className={styles.searchBtn}>
              Search
            </Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>
              Clear
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
              <span className={styles.filterLabel}>Latest Only</span>
              <Switch
                size="small"
                checked={latestOnly}
                onChange={setLatestOnly}
                style={{ background: latestOnly ? '#5aa3a1' : undefined }}
              />
            </div>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>
                <span className={styles.tableTitleText}>Analytical Test Requests</span>
                <span className={styles.tableCount}>{filteredData.length}</span>
              </div>
              <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>
                Export
              </Button>
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              size="small"
              className={styles.table}
              pagination={{
                total: filteredData.length,
                pageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => `Total ${total} records`,
              }}
            />
          </div>
        </main>
      </div>

      {/* New ATR Modal */}
      <Modal title="New ATR" open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()} okText="Create"
        confirmLoading={createLoading} width={480} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="test_type" label="Test Type" rules={[{ required: true }]}>
            <Select placeholder="Select test type">
              {TEST_TYPES.map(t => <Option key={t} value={t}>{t}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="objectives" label="Objectives" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Describe what needs to be tested…" />
          </Form.Item>
          <Form.Item name="experiment_id" label="Linked Experiment (optional)">
            <Select options={expOptions} allowClear showSearch placeholder="Select experiment"
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="due_date" label="Due Date (optional)">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ATRList
