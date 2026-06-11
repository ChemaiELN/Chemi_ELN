/**
 * Search page — v2
 *
 * Tabs:
 *   1. Experiments          (searchExperiments)
 *   2. Experiments by Param (searchExperimentsByParameter)
 *   3. ATRs                 (searchATRs)
 *   4. Notebooks            (searchNotebooks)
 *   5. Projects             (searchProjects)
 */
import React, { useState } from 'react'
import {
  Tabs, Form, Input, Button, Select, DatePicker,
  Table, Tag, InputNumber, message, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { SearchOutlined, ClearOutlined, HomeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  searchExperiments, searchExperimentsByParameter,
  searchATRs, searchNotebooks, searchProjects,
  type SearchExperimentResult, type SearchATRResult,
  type SearchNotebookResult, type SearchProjectResult,
} from '@/utilities/chemiaApi'

const { TabPane } = Tabs
const { RangePicker } = DatePicker

const PAGE_SIZE = 25

const EXP_STATUSES = ['DRAFT','INPROGRESS','SUBMITTED','REWORK','VERIFIED','APPROVED','REJECTED','VOID']
const ATR_STATUSES = ['OPEN','SUBMITTED','CLOSED','REJECTED']
const NB_STATUSES  = ['OPEN','CLOSED']
const PROJ_STATUSES = ['ACTIVE','COMPLETED','ARCHIVED']

// ─── Status color helper ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'default', INPROGRESS: 'processing', SUBMITTED: 'blue',
  REWORK: 'orange', VERIFIED: 'cyan', APPROVED: 'green',
  REJECTED: 'red', VOID: 'volcano',
  OPEN: 'blue', CLOSED: 'default',
  ACTIVE: 'green', COMPLETED: 'cyan', ARCHIVED: 'default',
}

// ─── Experiments tab ─────────────────────────────────────────────────────────

function ExperimentsTab() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [rows,    setRows]    = useState<SearchExperimentResult[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({})

  const doSearch = async (params: Record<string, unknown>, pg = 1) => {
    setLoading(true)
    setLastParams(params)
    try {
      const r = await searchExperiments({ ...params, page: pg, page_size: PAGE_SIZE } as Parameters<typeof searchExperiments>[0])
      setRows(r.items); setTotal(r.total); setPage(pg)
    } catch { message.error('Search failed') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    const v = form.getFieldsValue()
    const dateRange = v.date_range
    const params: Record<string, unknown> = {
      q:         v.q         || undefined,
      full_code: v.full_code || undefined,
      status:    v.status    || undefined,
      date_from: dateRange?.[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined,
      date_to:   dateRange?.[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined,
    }
    await doSearch(params)
  }

  const handleClear = () => { form.resetFields(); setRows([]); setTotal(0) }

  const columns: ColumnsType<SearchExperimentResult> = [
    { title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 160,
      render: (v, row) => (
        <span className={styles.codeLink} onClick={() => navigate(`/experiments/${row.id}`)}>{v}</span>
      ) },
    { title: 'Title',    dataIndex: 'title',        key: 'title' },
    { title: 'Status',   dataIndex: 'status',       key: 'status',       width: 110,
      render: v => <Tag className={styles.statusTag} color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: 'Notebook', dataIndex: 'notebook_code', key: 'notebook_code', width: 130, render: v => v ?? '—' },
    { title: 'Project',  dataIndex: 'project_code',  key: 'project_code',  width: 130, render: v => v ?? '—' },
    { title: 'Created By', dataIndex: 'creator_name', key: 'creator_name', width: 140, render: v => v ?? '—' },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
  ]

  return (
    <>
      <Form form={form} layout="inline" className={styles.filterForm}>
        <Form.Item name="q"         label="Keyword">  <Input size="small" placeholder="Title keyword…" style={{ width: 180 }} /></Form.Item>
        <Form.Item name="full_code" label="Code">     <Input size="small" placeholder="Full code…"     style={{ width: 140 }} /></Form.Item>
        <Form.Item name="status"    label="Status">
          <Select size="small" allowClear placeholder="Any" style={{ width: 140 }}
            options={EXP_STATUSES.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item name="date_range" label="Date range">
          <RangePicker size="small" format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item>
          <Space size={4}>
            <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleSearch}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}>Search</Button>
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>Clear</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<SearchExperimentResult>
        rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, size: 'small',
          showSizeChanger: false, onChange: pg => doSearch(lastParams, pg) }}
        scroll={{ x: 900 }}
      />
    </>
  )
}

// ─── Experiments by Parameter tab ────────────────────────────────────────────

function ByParamTab() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [rows,    setRows]    = useState<SearchExperimentResult[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({})

  const doSearch = async (params: Record<string, unknown>, pg = 1) => {
    setLoading(true)
    setLastParams(params)
    try {
      const r = await searchExperimentsByParameter({ ...params, page: pg, page_size: PAGE_SIZE } as Parameters<typeof searchExperimentsByParameter>[0])
      setRows(r.items); setTotal(r.total); setPage(pg)
    } catch { message.error('Search failed') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    const v = form.getFieldsValue()
    const params: Record<string, unknown> = {
      code:      v.code      || undefined,
      value_min: v.value_min ?? undefined,
      value_max: v.value_max ?? undefined,
    }
    await doSearch(params)
  }

  const handleClear = () => { form.resetFields(); setRows([]); setTotal(0) }

  const columns: ColumnsType<SearchExperimentResult> = [
    { title: 'Code', dataIndex: 'full_code', key: 'full_code', width: 160,
      render: (v, row) => (
        <span className={styles.codeLink} onClick={() => navigate(`/experiments/${row.id}`)}>{v}</span>
      ) },
    { title: 'Title',  dataIndex: 'title',  key: 'title' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <Tag className={styles.statusTag} color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: 'Created By', dataIndex: 'creator_name', key: 'creator_name', width: 140, render: v => v ?? '—' },
  ]

  return (
    <>
      <Form form={form} layout="inline" className={styles.filterForm}>
        <Form.Item name="code"      label="Param Code"><Input size="small" placeholder="e.g. YIELD" style={{ width: 140 }} /></Form.Item>
        <Form.Item name="value_min" label="Min Value"> <InputNumber size="small" style={{ width: 120 }} /></Form.Item>
        <Form.Item name="value_max" label="Max Value"> <InputNumber size="small" style={{ width: 120 }} /></Form.Item>
        <Form.Item>
          <Space size={4}>
            <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleSearch}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}>Search</Button>
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>Clear</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<SearchExperimentResult>
        rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, size: 'small',
          showSizeChanger: false, onChange: pg => doSearch(lastParams, pg) }}
      />
    </>
  )
}

// ─── ATRs tab ─────────────────────────────────────────────────────────────────

function ATRsTab() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [rows,    setRows]    = useState<SearchATRResult[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({})

  const doSearch = async (params: Record<string, unknown>, pg = 1) => {
    setLoading(true)
    setLastParams(params)
    try {
      const r = await searchATRs({ ...params, page: pg, page_size: PAGE_SIZE } as Parameters<typeof searchATRs>[0])
      setRows(r.items); setTotal(r.total); setPage(pg)
    } catch { message.error('Search failed') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    const v = form.getFieldsValue()
    await doSearch({
      q:         v.q         || undefined,
      status:    v.status    || undefined,
      test_type: v.test_type || undefined,
    })
  }

  const handleClear = () => { form.resetFields(); setRows([]); setTotal(0) }

  const columns: ColumnsType<SearchATRResult> = [
    { title: 'ATR No.', dataIndex: 'atr_no', key: 'atr_no', width: 160,
      render: (v, row) => (
        <span className={styles.codeLink} onClick={() => navigate(`/atr/${row.id}`)}>{v}</span>
      ) },
    { title: 'Test Type', dataIndex: 'test_type', key: 'test_type', width: 130 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => <Tag className={styles.statusTag} color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: 'Raised By', dataIndex: 'raised_by', key: 'raised_by', width: 140 },
    { title: 'Raised At', dataIndex: 'raised_at', key: 'raised_at', width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
  ]

  return (
    <>
      <Form form={form} layout="inline" className={styles.filterForm}>
        <Form.Item name="q"         label="Keyword">   <Input size="small" placeholder="ATR no. or title…" style={{ width: 180 }} /></Form.Item>
        <Form.Item name="status"    label="Status">
          <Select size="small" allowClear placeholder="Any" style={{ width: 130 }}
            options={ATR_STATUSES.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item name="test_type" label="Test Type">  <Input size="small" style={{ width: 140 }} /></Form.Item>
        <Form.Item>
          <Space size={4}>
            <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleSearch}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}>Search</Button>
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>Clear</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<SearchATRResult>
        rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, size: 'small',
          showSizeChanger: false, onChange: pg => doSearch(lastParams, pg) }}
      />
    </>
  )
}

// ─── Notebooks tab ────────────────────────────────────────────────────────────

function NotebooksTab() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [rows,    setRows]    = useState<SearchNotebookResult[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({})

  const doSearch = async (params: Record<string, unknown>, pg = 1) => {
    setLoading(true)
    setLastParams(params)
    try {
      const r = await searchNotebooks({ ...params, page: pg, page_size: PAGE_SIZE } as Parameters<typeof searchNotebooks>[0])
      setRows(r.items); setTotal(r.total); setPage(pg)
    } catch { message.error('Search failed') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    const v = form.getFieldsValue()
    await doSearch({ q: v.q || undefined, status: v.status || undefined })
  }

  const handleClear = () => { form.resetFields(); setRows([]); setTotal(0) }

  const columns: ColumnsType<SearchNotebookResult> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 150,
      render: (v, row) => (
        <span className={styles.codeLink} onClick={() => navigate(`/notebooks/${row.id}/overview`)}>{v}</span>
      ) },
    { title: 'Title',   dataIndex: 'title',        key: 'title' },
    { title: 'Status',  dataIndex: 'status',        key: 'status', width: 100,
      render: v => <Tag className={styles.statusTag} color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: 'Project', dataIndex: 'project_code',  key: 'project_code', width: 130, render: v => v ?? '—' },
    { title: 'Created', dataIndex: 'created_at',    key: 'created_at',   width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
  ]

  return (
    <>
      <Form form={form} layout="inline" className={styles.filterForm}>
        <Form.Item name="q"      label="Keyword"><Input size="small" placeholder="Code or title…" style={{ width: 200 }} /></Form.Item>
        <Form.Item name="status" label="Status">
          <Select size="small" allowClear placeholder="Any" style={{ width: 120 }}
            options={NB_STATUSES.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item>
          <Space size={4}>
            <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleSearch}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}>Search</Button>
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>Clear</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<SearchNotebookResult>
        rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, size: 'small',
          showSizeChanger: false, onChange: pg => doSearch(lastParams, pg) }}
      />
    </>
  )
}

// ─── Projects tab ─────────────────────────────────────────────────────────────

function ProjectsTab() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [rows,    setRows]    = useState<SearchProjectResult[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({})

  const doSearch = async (params: Record<string, unknown>, pg = 1) => {
    setLoading(true)
    setLastParams(params)
    try {
      const r = await searchProjects({ ...params, page: pg, page_size: PAGE_SIZE } as Parameters<typeof searchProjects>[0])
      setRows(r.items); setTotal(r.total); setPage(pg)
    } catch { message.error('Search failed') }
    finally { setLoading(false) }
  }

  const handleSearch = async () => {
    const v = form.getFieldsValue()
    await doSearch({ q: v.q || undefined, status: v.status || undefined })
  }

  const handleClear = () => { form.resetFields(); setRows([]); setTotal(0) }

  const columns: ColumnsType<SearchProjectResult> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 140,
      render: (v, row) => (
        <span className={styles.codeLink} onClick={() => navigate(`/projects/${row.id}/overview`)}>{v}</span>
      ) },
    { title: 'Name',       dataIndex: 'name',            key: 'name' },
    { title: 'Status',     dataIndex: 'status',           key: 'status', width: 100,
      render: v => <Tag className={styles.statusTag} color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag> },
    { title: 'Department', dataIndex: 'department_name',  key: 'department_name', width: 160, render: v => v ?? '—' },
    { title: 'Created',    dataIndex: 'created_at',       key: 'created_at',      width: 110,
      render: v => dayjs(v).format('DD/MM/YYYY') },
  ]

  return (
    <>
      <Form form={form} layout="inline" className={styles.filterForm}>
        <Form.Item name="q"      label="Keyword"><Input size="small" placeholder="Code or name…" style={{ width: 200 }} /></Form.Item>
        <Form.Item name="status" label="Status">
          <Select size="small" allowClear placeholder="Any" style={{ width: 130 }}
            options={PROJ_STATUSES.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item>
          <Space size={4}>
            <Button size="small" type="primary" icon={<SearchOutlined />} onClick={handleSearch}
              style={{ background: '#0f766e', borderColor: '#0f766e' }}>Search</Button>
            <Button size="small" icon={<ClearOutlined />} onClick={handleClear}>Clear</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<SearchProjectResult>
        rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, size: 'small',
          showSizeChanger: false, onChange: pg => doSearch(lastParams, pg) }}
      />
    </>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

const SearchPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="search" />
        <main className={styles.main}>

          <div className={styles.topBar}>
            <div>
              <nav className={styles.breadcrumb}>
                <span className={styles.breadHome} onClick={() => navigate('/dashboard')}>
                  <HomeOutlined /> Home
                </span>
                <span className={styles.breadSep}>/</span>
                <span className={styles.breadCurrent}>Search</span>
              </nav>
              <h1 className={styles.pageTitle}>
                <SearchOutlined style={{ marginRight: 6, color: '#0f766e' }} />
                Search
              </h1>
            </div>
          </div>

          <div className={styles.tabsCard}>
            <Tabs defaultActiveKey="experiments" size="small">
              <TabPane tab="Experiments"        key="experiments">   <ExperimentsTab /> </TabPane>
              <TabPane tab="By Parameter"       key="by-param">      <ByParamTab />     </TabPane>
              <TabPane tab="ATRs"               key="atrs">          <ATRsTab />        </TabPane>
              <TabPane tab="Notebooks"          key="notebooks">     <NotebooksTab />   </TabPane>
              <TabPane tab="Projects"           key="projects">      <ProjectsTab />    </TabPane>
            </Tabs>
          </div>

        </main>
      </div>
    </div>
  )
}

export default SearchPage
