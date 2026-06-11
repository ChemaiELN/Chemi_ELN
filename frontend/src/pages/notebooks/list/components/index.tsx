import React, { useState, useEffect } from 'react'
import { Table, Button, Select, Tag, Input, Badge, Breadcrumb, message, Modal, Form, Tooltip } from 'antd'
import {
  HomeOutlined, PlusOutlined, SearchOutlined,
  ExportOutlined, EyeOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getNotebooks, createNotebook, getProjects, getRoutes,
  type NotebookResponse,
} from '@/utilities/chemiaApi'

interface NotebookRow {
  key: string          // UUID
  index: number
  name: string
  projectCode: string
  projectId: string
  code: string
  createdBy: string
  createdDate: string
  status: 'ACTIVE' | 'ARCHIVED' | 'LOCKED'
}

const NotebooksListPage: React.FC = () => {
  const navigate = useNavigate()
  const [allData, setAllData]     = useState<NotebookRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [searchText, setSearchText] = useState('')

  const loadNotebooks = () => {
    setLoading(true)
    getNotebooks({ page_size: 100 })
      .then(resp => {
        const rows: NotebookRow[] = resp.items.map((nb: NotebookResponse, idx: number) => ({
          key:         nb.id,
          index:       idx + 1,
          name:        nb.title,
          projectCode: '—',            // not returned in list — use code prefix
          projectId:   nb.project_id,
          code:        nb.code,
          createdBy:   nb.creator?.display_name ?? nb.created_by,
          createdDate: nb.created_at?.slice(0, 10) ?? '',
          status:      (['ACTIVE','ARCHIVED','LOCKED'].includes(nb.status) ? nb.status : 'ACTIVE') as NotebookRow['status'],
        }))
        setAllData(rows)
      })
      .catch(() => message.error('Failed to load notebooks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadNotebooks() }, [])

  const handleClear = () => { setFilterStatus(undefined); setSearchText('') }

  const filtered = allData.filter(row => {
    if (filterStatus && row.status !== filterStatus) return false
    if (searchText && !row.name.toLowerCase().includes(searchText.toLowerCase())
        && !row.code.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  // ── New Notebook modal ──────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]     = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [projOptions, setProjOptions]   = useState<{ value: string; label: string }[]>([])
  const [routeOptions, setRouteOptions] = useState<{ value: string; label: string }[]>([])
  const [stageOptions, setStageOptions] = useState<{ value: string; label: string }[]>([])
  const [selProject, setSelProject]     = useState<string | undefined>()
  const [selRoute, setSelRoute]         = useState<string | undefined>()

  const openCreate = () => {
    createForm.resetFields()
    setSelProject(undefined); setSelRoute(undefined)
    setRouteOptions([]); setStageOptions([])
    getProjects({ page_size: 100 })
      .then(r => setProjOptions(r.items.map(p => ({ value: p.id, label: `${p.code} — ${p.name}` }))))
      .catch(() => {})
    setCreateOpen(true)
  }

  const handleProjectChange = (pid: string) => {
    setSelProject(pid)
    setSelRoute(undefined)
    setStageOptions([])
    createForm.setFieldValue('route_id', undefined)
    createForm.setFieldValue('stage_id', undefined)
    if (!pid) { setRouteOptions([]); return }
    getRoutes(pid).then(routes =>
      setRouteOptions(routes.map(r => ({ value: r.id, label: `${r.code} — ${r.name}` })))
    ).catch(() => {})
  }

  const handleRouteChange = (rid: string) => {
    setSelRoute(rid)
    createForm.setFieldValue('stage_id', undefined)
    if (!selProject || !rid) { setStageOptions([]); return }
    getRoutes(selProject).then(routes => {
      const route = routes.find(r => r.id === rid)
      setStageOptions(route ? route.stages.map(s => ({ value: s.id, label: `${s.code} — ${s.name}` })) : [])
    }).catch(() => {})
  }

  const handleCreate = async (values: Record<string, string>) => {
    setCreateLoading(true)
    try {
      await createNotebook({
        title:       values.title,
        description: values.description || undefined,
        project_id:  values.project_id,
        route_id:    values.route_id || undefined,
        stage_id:    values.stage_id || undefined,
      })
      message.success('Notebook created')
      setCreateOpen(false)
      loadNotebooks()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create notebook')
    } finally {
      setCreateLoading(false)
    }
  }

  const columns: ColumnsType<NotebookRow> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 48 },
    {
      title: 'Notebook Name', dataIndex: 'name', key: 'name',
      render: (text: string, record: NotebookRow) => (
        <a className={styles.nameLink} onClick={() => navigate(`/notebooks/${record.key}/overview`)}>
          {text}
        </a>
      ),
    },
    {
      title: 'Code', dataIndex: 'code', key: 'code',
      render: (text: string) => <span className={styles.monoText}>{text}</span>,
    },
    { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy' },
    { title: 'Created Date', dataIndex: 'createdDate', key: 'createdDate' },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (status: string) => {
        const cls = status === 'ACTIVE' ? styles.statusActive
          : status === 'LOCKED' ? styles.statusLocked
          : styles.statusArchived
        const label = status === 'ACTIVE' ? 'Active' : status === 'ARCHIVED' ? 'Archived' : 'Locked'
        return <Tag className={`${styles.statusTag} ${cls}`}>{label}</Tag>
      },
    },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, record: NotebookRow) => (
        <Tooltip title="View">
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/notebooks/${record.key}/overview`)}
            className={styles.viewBtn} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="lookup2" />
        <main className={styles.main}>
          {/* Breadcrumb + New button */}
          <div className={styles.breadcrumbRow}>
            <Breadcrumb items={[
              { title: <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span> },
              { title: 'Notebooks' },
            ]} />
            <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openCreate}>
              New Notebook
            </Button>
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Notebooks
                <Badge count={filtered.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
              </div>
              <div className={styles.tableCardFilters}>
                <span className={styles.filterLabel}>Status</span>
                <Select placeholder="All statuses" value={filterStatus}
                  onChange={setFilterStatus} allowClear size="small"
                  className={styles.filterSelect}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'ARCHIVED', label: 'Archived' },
                    { value: 'LOCKED', label: 'Locked' },
                  ]} />
                <Input placeholder="Search notebooks…" prefix={<SearchOutlined />}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  size="small" className={styles.filterInput} allowClear />
                <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />}>Search</Button>
                <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
              </div>
              <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>Export</Button>
            </div>
            <Table columns={columns} dataSource={filtered} loading={loading} size="small"
              className={styles.table}
              pagination={{ total: filtered.length, pageSize: 15, showSizeChanger: false, showTotal: t => `${t} notebooks` }} />
          </div>
        </main>
      </div>

      {/* New Notebook Modal */}
      <Modal title="New Notebook" open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()} okText="Create" confirmLoading={createLoading}
        className={styles.notebookModal}
        width={540} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Notebook Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Study NB-001" />
          </Form.Item>
          <Form.Item name="project_id" label="Project" rules={[{ required: true }]}>
            <Select options={projOptions} placeholder="Select project" showSearch
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              onChange={handleProjectChange} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="route_id" label="Route (optional)">
              <Select options={routeOptions} placeholder="Select route" allowClear showSearch
                disabled={!selProject} onChange={handleRouteChange}
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="stage_id" label="Stage (optional)">
              <Select options={stageOptions} placeholder="Select stage" allowClear showSearch
                disabled={!selRoute}
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotebooksListPage
