import { useState, useEffect } from 'react'
import { Table, Button, Input, Select, Tag, message, Modal, Form, DatePicker, Tooltip } from 'antd'
import {
  HomeOutlined,
  ExportOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { useProjectPermissions } from '@/hooks/useModulePermissions'
import styles from './styles.module.less'
import sharedStyles from '../../shared/styles.module.less'
import {
  getProjects, createProject, getDepartments, getUsers,
  type ProjectSummary as APIProject,
} from '@/utilities/chemiaApi'

interface Project {
  key: string
  no: number
  name: string
  code: string
  type: string
  customerMarket: string
  createdBy: string
  status: string   // ACTIVE | ON HOLD | COMPLETED | CANCELLED
}

const STATUS_LABEL: Record<string, string> = {
  'ACTIVE':    'Active',
  'ON HOLD':   'On Hold',
  'COMPLETED': 'Completed',
  'CANCELLED': 'Cancelled',
}

function mapProject(p: APIProject, idx: number): Project {
  return {
    key: p.id,
    no: idx + 1,
    name: p.name,
    code: p.code,
    type: p.project_type ?? 'Internal',
    customerMarket: p.market ?? '—',
    createdBy: p.creator?.display_name ?? p.creator_name ?? p.created_by,
    status: p.status,
  }
}

export default function ProjectsListPage() {
  const navigate = useNavigate()
  const { canCreate } = useProjectPermissions()
  const [allData, setAllData]       = useState<Project[]>([])
  const [loading, setLoading]       = useState(false)
  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)

  const loadProjects = () => {
    setLoading(true)
    getProjects({ page_size: 100 })
      .then((resp) => setAllData(resp.items.map(mapProject)))
      .catch(() => message.error('Failed to load projects'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadProjects() }, [])

  // ── Create Project modal ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen]   = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm] = Form.useForm()
  const [deptOptions, setDeptOptions] = useState<{ value: string; label: string }[]>([])
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([])

  const openCreate = () => {
    createForm.resetFields()
    getDepartments().then(depts => setDeptOptions(depts.map(d => ({ value: d.id, label: d.name })))).catch(() => {})
    getUsers({ page_size: 100, is_active: true }).then(r =>
      setUserOptions(r.items.map(u => ({ value: u.id, label: `${u.display_name} (${u.username})` })))
    ).catch(() => {})
    setCreateOpen(true)
  }

  const handleCreate = async (values: Record<string, unknown>) => {
    setCreateLoading(true)
    try {
      await createProject({
        code:          (values.code as string).toUpperCase(),
        name:          values.name as string,
        product_name:  (values.product_name as string | undefined) || undefined,
        project_type:  (values.project_type as string | undefined) || undefined,
        market:        (values.market as string | undefined) || undefined,
        department_id: (values.department_id as string | undefined) || undefined,
        manager_id:    (values.manager_id as string | undefined) || undefined,
        description:   (values.description as string | undefined) || undefined,
        start_date:    values.start_date ? (values.start_date as import('dayjs').Dayjs).format('YYYY-MM-DD') : undefined,
        target_date:   values.target_date ? (values.target_date as import('dayjs').Dayjs).format('YYYY-MM-DD') : undefined,
      })
      message.success('Project created')
      setCreateOpen(false)
      loadProjects()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreateLoading(false)
    }
  }

  const filteredData = allData.filter((p) => {
    const matchName = !nameFilter || p.name.toLowerCase().includes(nameFilter.toLowerCase())
    const matchType = !typeFilter || p.type === typeFilter
    return matchName && matchType
  })

  const handleClear = () => {
    setNameFilter('')
    setTypeFilter(undefined)
  }

  const goToOverview = (id: string) => navigate(`/projects/${id}/overview`)

  const columns: ColumnsType<Project> = [
    { title: '#',               dataIndex: 'no',            key: 'no',            width: 50 },
    {
      title: 'Project Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Project) => (
        <a
          style={{ color: '#5aa3a1', fontWeight: 500, cursor: 'pointer' }}
          onClick={() => navigate(`/projects/${record.key}/overview`)}
        >
          {name}
        </a>
      ),
    },
    { title: 'Code',            dataIndex: 'code',          key: 'code'           },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: Project['type']) => {
        const isInternal = type === 'Internal'
        return (
          <Tag className={`${styles.typeTag} ${isInternal ? styles.typeInternal : styles.typeExternal}`}>
            {type}
          </Tag>
        )
      },
    },
    { title: 'Customer / Market', dataIndex: 'customerMarket', key: 'customerMarket' },
    { title: 'Created By',       dataIndex: 'createdBy',     key: 'createdBy'      },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <StatusTag status={status} label={STATUS_LABEL[status]} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 56,
      render: (_: unknown, record: Project) => (
        <Tooltip title="View project">
          <Button
            icon={<EyeOutlined />}
            size="small"
            className={styles.actionBtn}
            aria-label="View project"
            onClick={() => goToOverview(record.key)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="project" />
        <main className={styles.main}>
          {/* Top row */}
          <div className={styles.topRow}>
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}>
                <HomeOutlined /> Home
              </span>
              {' / '}
              <span>Projects</span>
            </div>
            {canCreate && (
              <Button
                type="primary"
                icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
                size="small"
                className={sharedStyles.primaryActionBtn}
                onClick={openCreate}
              >
                New Project
              </Button>
            )}
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Projects
                <span className={styles.countBadge}>{filteredData.length}</span>
              </div>
              <div className={styles.tableCardFilters}>
                {/* <span className={styles.filterLabel}>Project Name</span> */}
                
                <span className={styles.filterLabel}>Type</span>
                <Select
                  placeholder="All types"
                  value={typeFilter}
                  onChange={(v) => setTypeFilter(v)}
                  className={styles.filterSelect}
                  size="small"
                  allowClear
                  options={[
                    { label: 'Internal', value: 'Internal' },
                    { label: 'External', value: 'External' },
                  ]}
                />
                <Input
                  placeholder="Search Project name…"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className={styles.filterInput}
                  size="small"
                  allowClear
                />
                <Button size="small" className={styles.clearBtn} onClick={handleClear}>
                  Clear
                </Button>
              </div>
              <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>
                Export
              </Button>
            </div>
            <Table
              className={styles.table}
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              size="small"
              pagination={{
                pageSize: 10,
                total: filteredData.length,
                showSizeChanger: false,
                size: 'small',
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </main>
      </div>

      {/* ── Create Project Modal ── */}
      <Modal title="New Project" open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()} okText="Create Project" confirmLoading={createLoading}
        className={styles.createModal}
        width={780} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreate} requiredMark={false} style={{ marginTop: 8 }}>
          {/* Row 1: Code + Name */}
          <div className={styles.formGridCodeName}>
            <Form.Item name="code" label="Project Code" rules={[{ required: true }]}>
              <Input placeholder="OQ-001" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Omeprazole API Development" />
            </Form.Item>
          </div>
          {/* Row 2: Product Name + Type + Market */}
          <div className={styles.formGrid3col}>
            <Form.Item name="product_name" label="Product Name">
              <Input placeholder="e.g. Omeprazole" />
            </Form.Item>
            <Form.Item name="project_type" label="Type">
              <Select placeholder="Select type" allowClear
                options={[{ value: 'Internal', label: 'Internal' }, { value: 'External', label: 'External' }]} />
            </Form.Item>
            <Form.Item name="market" label="Market / Customer">
              <Input placeholder="e.g. Regulated Markets" />
            </Form.Item>
          </div>
          {/* Row 3: Department + Manager + Start Date */}
          <div className={styles.formGrid3col}>
            <Form.Item name="department_id" label="Department">
              <Select options={deptOptions} placeholder="Select department" allowClear showSearch
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            {/* <Form.Item name="manager_id" label="Manager">
              <Select options={userOptions} placeholder="Select manager" allowClear showSearch
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item> */}
            <Form.Item name="start_date" label="Start Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
             <Form.Item name="target_date" label="Target Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          {/* Row 4: Target Date + Description */}
          <div >
           
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={2} placeholder="Optional project description" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
