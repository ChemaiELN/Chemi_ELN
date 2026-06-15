import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Tag, Button, Input, Select, Space, message,
  Modal, Form, Switch,
} from 'antd'
import {
  HomeOutlined, SearchOutlined,
  EditOutlined, ExportOutlined,
} from '@ant-design/icons'
import { Plus } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import styles from './styles.module.less'
import {
  getDepartments, createDepartment, updateDepartment,
  type Department as APIDepartment,
} from '@/utilities/chemiaApi'

interface DeptRow {
  key: string
  id: string
  index: number
  code: string
  name: string
  description: string
  active: boolean
}

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

function mapDept(d: APIDepartment, idx: number): DeptRow {
  return {
    key: d.id,
    id: d.id,
    index: idx + 1,
    code: d.code,
    name: d.name,
    description: d.description ?? '',
    active: d.is_active,
  }
}

function exportDepartmentsCsv(rows: DeptRow[]) {
  const header = ['Code', 'Department Name', 'Status']
  const lines = rows.map(d => [
    d.code,
    d.name,
    d.active ? 'Active' : 'Inactive',
  ])
  const csv = [header, ...lines]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'departments.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminDepartmentsPage() {
  const navigate = useNavigate()
  const [depts, setDepts] = useState<DeptRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | undefined>()
  const [pageSize, setPageSize] = useState(10)

  const loadDepts = useCallback(() => {
    setLoading(true)
    getDepartments({
      search: search || undefined,
      is_active: activeFilter === 'true' ? true : activeFilter === 'false' ? false : undefined,
    })
      .then(data => setDepts(data.map(mapDept)))
      .catch(() => message.error('Failed to load departments'))
      .finally(() => setLoading(false))
  }, [search, activeFilter])

  useEffect(() => { loadDepts() }, [loadDepts])

  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addForm] = Form.useForm()

  const handleAdd = async (values: Record<string, string>) => {
    setAddLoading(true)
    try {
      await createDepartment({
        code: values.code,
        name: values.name,
        description: values.description || undefined,
      })
      message.success(`Department "${values.name}" created`)
      setAddOpen(false)
      addForm.resetFields()
      loadDepts()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create department')
    } finally {
      setAddLoading(false)
    }
  }

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editId, setEditId] = useState('')
  const [editForm] = Form.useForm()

  const openEdit = (row: DeptRow) => {
    setEditId(row.id)
    editForm.setFieldsValue({
      name: row.name,
      description: row.description,
      is_active: row.active,
    })
    setEditOpen(true)
  }

  const handleEdit = async (values: { name: string; description: string; is_active: boolean }) => {
    setEditLoading(true)
    try {
      await updateDepartment(editId, {
        name: values.name,
        description: values.description || undefined,
        is_active: values.is_active,
      })
      message.success('Department updated')
      setEditOpen(false)
      loadDepts()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update department')
    } finally {
      setEditLoading(false)
    }
  }

  const columns: ColumnsType<DeptRow> = [
    { title: '#', dataIndex: 'index', key: 'index', width: 48 },
    {
      title: 'CODE',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (v: string) => <span className={styles.codeCell}>{v}</span>,
    },
    { title: 'DEPARTMENT NAME', dataIndex: 'name', key: 'name', className: styles.nameCell },
    {
      title: 'STATUS',
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (v: boolean) =>
        v
          ? <Tag className={styles.statusActive}>Active</Tag>
          : <Tag className={styles.statusInactive}>Inactive</Tag>,
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: DeptRow) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} size="small"
            className={styles.editBtn} onClick={() => openEdit(record)} />
        </Space>
      ),
    },
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="admin-departments" />
        <main className={styles.main}>

          <div className={styles.breadcrumbRow}>
            <div className={styles.breadcrumb}>
              <HomeOutlined className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')} />
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/admin')}>Admin</span>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbCurrent}>Departments</span>
            </div>
            <Button
              icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
              className={sharedStyles.primaryActionBtn}
              onClick={() => setAddOpen(true)}
            >
              Add Department
            </Button>
          </div>

          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Departments
                <span className={styles.countBadge}>{depts.length}</span>
              </div>
              <div className={styles.tableCardFilters}>
                <Select
                  className={styles.filterSelect}
                  placeholder="All statuses"
                  allowClear
                  value={activeFilter}
                  onChange={setActiveFilter}
                  options={STATUS_OPTIONS}
                />
                <Input
                  className={styles.filterInput}
                  placeholder="Search code / name"
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  allowClear
                />
                <Button className={styles.clearBtn} onClick={() => {
                  setSearch('')
                  setActiveFilter(undefined)
                }}>
                  Clear
                </Button>
                <Button
                  className={styles.exportBtn}
                  icon={<ExportOutlined />}
                  onClick={() => exportDepartmentsCsv(depts)}
                >
                  Export
                </Button>
              </div>
            </div>
            <Table<DeptRow>
              columns={columns}
              dataSource={depts}
              loading={loading}
              pagination={{
                total: depts.length,
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: [10, 25, 50],
                showTotal: t => `Total ${t} departments`,
                onShowSizeChange: (_current, size) => setPageSize(size),
              }}
              size="small"
              className={styles.table}
            />
          </div>
        </main>
      </div>

      <Modal title="Add Department" open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields() }}
        onOk={() => addForm.submit()} okText="Create" confirmLoading={addLoading}
        width={480} destroyOnClose className={styles.deptModal} style={{ top: 20 }}>
        <Form form={addForm} layout="vertical" onFinish={handleAdd} requiredMark={false}>
          <Form.Item name="code" label="Department Code" rules={[{ required: true }]}>
            <Input placeholder="e.g. RD" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Research & Development" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit Department" open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()} okText="Save Changes" confirmLoading={editLoading}
        width={480} destroyOnClose className={styles.deptModal} style={{ top: 20 }}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <Form.Item name="name" label="Department Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
