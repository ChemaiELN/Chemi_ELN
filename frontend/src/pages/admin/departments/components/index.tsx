import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Tag, Button, Input, Space, message,
  Modal, Form, Switch,
} from 'antd'
import {
  HomeOutlined, PlusOutlined, SearchOutlined,
  ClearOutlined, EditOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
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

function mapDept(d: APIDepartment, idx: number): DeptRow {
  return {
    key: d.id,
    id: d.id,
    index: idx + 1,
    code: d.code,
    name: d.name,
    description: d.description ?? '—',
    active: d.is_active,
  }
}

export default function AdminDepartmentsPage() {
  const navigate = useNavigate()
  const [depts, setDepts]     = useState<DeptRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch]   = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadDepts = useCallback(() => {
    setLoading(true)
    getDepartments(search ? { search } : undefined)
      .then(data => setDepts(data.map(mapDept)))
      .catch(() => message.error('Failed to load departments'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { loadDepts() }, [loadDepts])

  // ── Add Department modal ──────────────────────────────────────────────────
  const [addOpen, setAddOpen]     = useState(false)
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

  // ── Edit Department modal ─────────────────────────────────────────────────
  const [editOpen, setEditOpen]     = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editId, setEditId]         = useState('')
  const [editForm] = Form.useForm()

  const openEdit = (row: DeptRow) => {
    setEditId(row.id)
    editForm.setFieldsValue({
      name: row.name,
      description: row.description === '—' ? '' : row.description,
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

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnsType<DeptRow> = [
    { title: '#',                dataIndex: 'index',       key: 'index', width: 48 },
    { title: 'CODE',             dataIndex: 'code',        key: 'code',
      render: (v: string) => <span className={styles.codeCell}>{v}</span> },
    { title: 'DEPARTMENT NAME',  dataIndex: 'name',        key: 'name', className: styles.nameCell },
    { title: 'DESCRIPTION',      dataIndex: 'description', key: 'description' },
    {
      title: 'STATUS', dataIndex: 'active', key: 'active',
      render: (v: boolean) =>
        v ? <Tag style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 500 }}>Active</Tag>
          : <Tag style={{ background: '#fff1f2', color: '#be123c', borderColor: '#fecdd3', fontWeight: 500 }}>Inactive</Tag>,
    },
    {
      title: 'ACTIONS', key: 'actions', width: 80,
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
        <Sidebar activeKey="master-data" />
        <main className={styles.main}>

          {/* Breadcrumb row */}
          <div className={styles.breadcrumbRow}>
            <div className={styles.breadcrumb}>
              <HomeOutlined className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')} />
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/admin')}>Admin</span>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbCurrent}>Departments</span>
            </div>
            <Button icon={<PlusOutlined />} className={styles.addBtn}
              onClick={() => setAddOpen(true)}>
              Add Department
            </Button>
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Departments
                <span style={{ background: '#f5f5f4', color: '#57534e', border: '1px solid #e7e5e4', borderRadius: 999, padding: '0 8px', fontSize: 11, fontWeight: 500 }}>
                  {depts.length}
                </span>
              </div>
            </div>
            <div className={styles.filterRow}>
              <Input
                className={styles.filterInput}
                placeholder="Search code / name"
                prefix={<SearchOutlined />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
              />
              <Button className={styles.searchBtn} icon={<SearchOutlined />} onClick={loadDepts}>Search</Button>
              <Button className={styles.clearBtn} onClick={() => setSearch('')}>Clear</Button>
            </div>
            <Table<DeptRow>
              columns={columns} dataSource={depts} loading={loading}
              pagination={{ pageSize: 20, showTotal: t => `Total ${t} departments` }}
              size="small" className={styles.table}
            />
          </div>
        </main>
      </div>

      {/* ── Add Department Modal ── */}
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

      {/* ── Edit Department Modal ── */}
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
