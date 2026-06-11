import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Table, Tag, Button, Input, Select, Space, message,
  Modal, Form, Popconfirm, Switch, Tooltip, Divider, Badge,
} from 'antd'
import {
  HomeOutlined, PlusOutlined, SearchOutlined,
  EditOutlined, StopOutlined, CheckOutlined,
  WarningOutlined, SettingOutlined, ExportOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getUsers, createUser, updateUser, activateUser, deactivateUser,
  getDepartments,
  type User as APIUser, type Department,
} from '@/utilities/chemiaApi'

// ─── Local row type ───────────────────────────────────────────────────────────

interface UserRow {
  key:                string
  id:                 string
  username:           string
  employeeNo:         string
  title:              string
  firstName:          string
  /** v2 */
  middleInitials:     string
  lastName:           string
  displayName:        string
  role:               string
  designation:        string
  email:              string
  departmentName:     string
  departmentId:       string
  active:             boolean
  /** v2 */
  contactNo:          string
  site:               string
  dashboardReference: string
  allowSettingsUpdate: boolean
  mustResetPassword:   boolean
}

function mapUser(u: APIUser, _idx: number): UserRow {
  return {
    key:                u.id,
    id:                 u.id,
    username:           u.username,
    employeeNo:         u.emp_no,
    title:              u.title              ?? '',
    firstName:          u.first_name,
    middleInitials:     u.middle_initials    ?? '',
    lastName:           u.last_name,
    displayName:        u.display_name,
    role:               u.role,
    designation:        u.designation        ?? '',
    email:              u.email,
    departmentName:     u.department?.name   ?? '',
    departmentId:       u.department_id      ?? '',
    active:             u.is_active,
    contactNo:          u.contact_no         ?? '',
    site:               u.site               ?? '',
    dashboardReference: u.dashboard_reference ?? '',
    allowSettingsUpdate: u.allow_settings_update ?? false,
    mustResetPassword:   u.must_reset_password   ?? false,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'QA',   label: 'QA'   },
  { value: 'TL',   label: 'TL'   },
  { value: 'CHEM', label: 'CHEM' },
  { value: 'HOD',  label: 'HOD'  },
]

const STATUS_OPTIONS = [
  { value: 'true',  label: 'Active'   },
  { value: 'false', label: 'Inactive' },
]

const ROLE_COLOR: Record<string, string> = {
  QA:   'gold',
  TL:   'cyan',
  HOD:  'purple',
  CHEM: 'default',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const navigate = useNavigate()

  // ── List state ────────────────────────────────────────────────────────────
  const [allUsers,     setAllUsers]     = useState<UserRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState<string | undefined>()
  const [activeFilter, setActiveFilter] = useState<string | undefined>()
  /** Toggle extra v2 columns (site, contact_no, dashboard_reference) */
  const [showExtra, setShowExtra]       = useState(false)

  // ── Departments for dropdowns ─────────────────────────────────────────────
  const [depts, setDepts] = useState<Department[]>([])
  useEffect(() => {
    getDepartments().then(setDepts).catch(() => {})
  }, [])
  const deptOptions = depts.map(d => ({ value: d.id, label: d.name }))

  // ── Load users ────────────────────────────────────────────────────────────
  const loadUsers = useCallback(() => {
    setLoading(true)
    const params: Record<string, string | boolean | undefined> = {}
    if (search)                    params.search    = search
    if (roleFilter)                params.role_code = roleFilter
    if (activeFilter !== undefined) params.is_active = activeFilter === 'true'
    getUsers({ ...params, page_size: 100 })
      .then(resp  => setAllUsers(resp.items.map(mapUser)))
      .catch(() => message.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [search, roleFilter, activeFilter])

  useEffect(() => { loadUsers() }, [loadUsers])

  // ── Add User modal ────────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addForm]                   = Form.useForm()

  const handleAdd = async (values: Record<string, string | boolean>) => {
    setAddLoading(true)
    try {
      await createUser({
        username:             String(values.username),
        emp_no:               String(values.emp_no),
        first_name:           String(values.first_name),
        last_name:            String(values.last_name),
        email:                String(values.email),
        password:             String(values.password),
        role:                 String(values.role),
        title:                values.title         ? String(values.title)              : undefined,
        middle_initials:      values.middle_initials ? String(values.middle_initials)  : undefined,
        designation:          values.designation   ? String(values.designation)        : undefined,
        department_id:        values.department_id ? String(values.department_id)      : undefined,
        contact_no:           values.contact_no    ? String(values.contact_no)         : undefined,
        site:                 values.site          ? String(values.site)               : undefined,
        dashboard_reference:  values.dashboard_reference ? String(values.dashboard_reference) : undefined,
        allow_settings_update: Boolean(values.allow_settings_update),
        must_reset_password:   Boolean(values.must_reset_password),
      })
      message.success(`User "${values.username}" created`)
      setAddOpen(false)
      addForm.resetFields()
      loadUsers()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Edit User modal ───────────────────────────────────────────────────────
  const [editOpen,    setEditOpen]    = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editId,      setEditId]      = useState('')
  const [editForm]                    = Form.useForm()

  const openEdit = (row: UserRow) => {
    setEditId(row.id)
    editForm.setFieldsValue({
      title:                row.title,
      first_name:           row.firstName,
      middle_initials:      row.middleInitials,
      last_name:            row.lastName,
      email:                row.email,
      role:                 row.role,
      designation:          row.designation,
      department_id:        row.departmentId || undefined,
      contact_no:           row.contactNo,
      site:                 row.site,
      dashboard_reference:  row.dashboardReference,
      allow_settings_update: row.allowSettingsUpdate,
      must_reset_password:   row.mustResetPassword,
    })
    setEditOpen(true)
  }

  const handleEdit = async (values: Record<string, string | boolean>) => {
    setEditLoading(true)
    try {
      await updateUser(editId, {
        title:                values.title         ? String(values.title)              : undefined,
        first_name:           String(values.first_name),
        middle_initials:      values.middle_initials ? String(values.middle_initials)  : undefined,
        last_name:            String(values.last_name),
        email:                String(values.email),
        role:                 String(values.role),
        designation:          values.designation   ? String(values.designation)        : undefined,
        department_id:        values.department_id ? String(values.department_id)      : undefined,
        contact_no:           values.contact_no    ? String(values.contact_no)         : undefined,
        site:                 values.site          ? String(values.site)               : undefined,
        dashboard_reference:  values.dashboard_reference ? String(values.dashboard_reference) : undefined,
        allow_settings_update: Boolean(values.allow_settings_update),
        must_reset_password:   Boolean(values.must_reset_password),
      })
      message.success('User updated')
      setEditOpen(false)
      loadUsers()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Activate / Deactivate ─────────────────────────────────────────────────
  const handleToggleActive = async (row: UserRow) => {
    try {
      if (row.active) {
        await deactivateUser(row.id)
        message.success(`"${row.username}" deactivated`)
      } else {
        await activateUser(row.id)
        message.success(`"${row.username}" activated`)
      }
      loadUsers()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Action failed')
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────

  const coreColumns: ColumnsType<UserRow> = [
    { title: 'USERNAME', dataIndex: 'username', key: 'username', width: 130 },
    { title: 'EMP #',    dataIndex: 'employeeNo', key: 'employeeNo', width: 90 },
    { title: 'DISPLAY NAME', dataIndex: 'displayName', key: 'displayName' },
    {
      title: 'ROLE', dataIndex: 'role', key: 'role', width: 70,
      render: (v: string) => <Tag color={ROLE_COLOR[v] ?? 'default'} style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    { title: 'DEPARTMENT', dataIndex: 'departmentName', key: 'departmentName', width: 200 },
    { title: 'EMAIL', dataIndex: 'email', key: 'email', className: styles.emailCell, ellipsis: true },
    {
      title: 'ACTIVE', dataIndex: 'active', key: 'active', width: 70,
      render: (v: boolean) =>
        v ? <Tag style={{ background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0', fontWeight: 600 }}>Y</Tag>
          : <Tag style={{ background: '#fff1f2', color: '#be123c', borderColor: '#fecdd3', fontWeight: 600 }}>N</Tag>,
    },
    {
      title: 'FLAGS', key: 'flags', width: 70,
      render: (_: unknown, record: UserRow) => (
        <Space size={4}>
          {record.mustResetPassword && (
            <Tooltip title="Must reset password on next login">
              <WarningOutlined style={{ color: '#b45309', fontSize: 13 }} />
            </Tooltip>
          )}
          {record.allowSettingsUpdate && (
            <Tooltip title="Can edit global/CRD settings">
              <SettingOutlined style={{ color: '#0f766e', fontSize: 13 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const extraColumns: ColumnsType<UserRow> = [
    { title: 'CONTACT', dataIndex: 'contactNo', key: 'contactNo', width: 130,
      render: (v: string) => v || '—' },
    { title: 'SITE', dataIndex: 'site', key: 'site', width: 100,
      render: (v: string) => v || '—' },
    { title: 'DASHBOARD REF', dataIndex: 'dashboardReference', key: 'dashboardReference', ellipsis: true,
      render: (v: string) => v || '—' },
  ]

  const actionColumn: ColumnsType<UserRow> = [
    {
      title: 'ACTIONS', key: 'actions', width: 90,
      render: (_: unknown, record: UserRow) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} size="small"
            className={styles.actionBtn} onClick={() => openEdit(record)} />
          <Popconfirm
            title={record.active ? `Deactivate "${record.username}"?` : `Activate "${record.username}"?`}
            onConfirm={() => handleToggleActive(record)}
            okText="Yes" cancelText="No"
            okButtonProps={{ danger: record.active }}
          >
            <Button type="text"
              icon={record.active ? <StopOutlined /> : <CheckOutlined />}
              size="small"
              className={record.active ? styles.actionBtnDanger : styles.actionBtnSuccess}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const columns: ColumnsType<UserRow> = [
    ...coreColumns,
    ...(showExtra ? extraColumns : []),
    ...actionColumn,
  ]

  // ── Shared form sections ──────────────────────────────────────────────────

  const v2FieldsSection = (
    <>
      <Divider orientation="left" style={{ fontSize: 12, color: '#78716c', marginTop: 4, marginBottom: 8 }}>
        v2 Fields
      </Divider>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <Form.Item name="middle_initials" label="Middle Initials">
          <Input placeholder="e.g. A." />
        </Form.Item>
        <Form.Item name="contact_no" label="Contact No.">
          <Input placeholder="e.g. +1 555 0100" />
        </Form.Item>
        <Form.Item name="site" label="Site">
          <Input placeholder="Site code or name" />
        </Form.Item>
        <Form.Item name="dashboard_reference" label="Dashboard Reference">
          <Input placeholder="URL or code" />
        </Form.Item>
        <Form.Item name="allow_settings_update" label="Allow Settings Update"
          valuePropName="checked" initialValue={false}>
          <Switch size="small"
            style={{ '--ant-switch-color': '#0f766e' } as React.CSSProperties} />
        </Form.Item>
        <Form.Item name="must_reset_password" label="Must Reset Password"
          valuePropName="checked" initialValue={false}>
          <Switch size="small" />
        </Form.Item>
      </div>
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="admin-users" />
        <main className={styles.main}>

          {/* Breadcrumb row */}
          <div className={styles.breadcrumbRow}>
            <div className={styles.breadcrumb}>
              <HomeOutlined className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')} />
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/admin')}>Admin</span>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.breadcrumbCurrent}>Users</span>
            </div>
            <Button type="primary" icon={<PlusOutlined />} className={styles.newBtn}
              onClick={() => { addForm.resetFields(); setAddOpen(true) }}>
              Add User
            </Button>
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Users
                <Badge count={allUsers.length} showZero
                  style={{ background: '#f5f5f4', color: '#57534e', boxShadow: '0 0 0 1px #e7e5e4', fontSize: 11 }} />
              </div>
              <div className={styles.tableCardFilters}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={styles.filterLabel}>Extra cols</span>
                  <Switch size="small" checked={showExtra} onChange={setShowExtra}
                    style={showExtra ? { background: '#0f766e' } : {}} />
                </div>
                <Select className={styles.filterSelect} placeholder="All roles" allowClear
                  value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} />
                <Select className={styles.filterSelect} placeholder="All statuses" allowClear
                  value={activeFilter} onChange={setActiveFilter} options={STATUS_OPTIONS} />
                <Input className={styles.filterInput} placeholder="Search name / username / email"
                  prefix={<SearchOutlined />} value={search} onChange={e => setSearch(e.target.value)} allowClear />
                <Button className={styles.searchBtn} icon={<SearchOutlined />} onClick={loadUsers}>Search</Button>
                <Button className={styles.clearBtn} onClick={() => {
                  setSearch(''); setRoleFilter(undefined); setActiveFilter(undefined)
                }}>Clear</Button>
              </div>
              <Button className={styles.exportBtn} icon={<ExportOutlined />}>Export</Button>
            </div>
            <Table<UserRow>
              columns={columns} dataSource={allUsers} loading={loading}
              pagination={{ total: allUsers.length, pageSize: 15, showSizeChanger: true,
                showTotal: t => `Total ${t} users` }}
              size="small" className={styles.table}
            />
          </div>
        </main>
      </div>

      {/* ── Add User Modal ─────────────────────────────────────────────────── */}
      <Modal title="Add New User" open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields() }}
        onOk={() => addForm.submit()} okText="Create User"
        confirmLoading={addLoading} className={styles.userModal} destroyOnClose
        style={{ top: 20 }}>
        <Form form={addForm} layout="vertical" onFinish={handleAdd} requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input placeholder="e.g. john.doe" />
            </Form.Item>
            <Form.Item name="emp_no" label="Employee No." rules={[{ required: true }]}>
              <Input placeholder="e.g. EMP-001" />
            </Form.Item>
            <Form.Item name="title" label="Title">
              <Input placeholder="Dr / Mr / Ms" />
            </Form.Item>
            <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
              <Input placeholder="First name" />
            </Form.Item>
            <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
              <Input placeholder="Last name" />
            </Form.Item>
            <Form.Item name="email" label="Email"
              rules={[{ required: true }, { type: 'email' }]}>
              <Input placeholder="user@company.com" />
            </Form.Item>
            <Form.Item name="password" label="Password"
              rules={[{ required: true }, { min: 8, message: 'Min 8 characters' }]}>
              <Input.Password placeholder="Min 8 characters" />
            </Form.Item>
            <Form.Item name="role" label="Role" initialValue="CHEM" rules={[{ required: true }]}>
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="designation" label="Designation">
              <Input placeholder="e.g. Senior Chemist" />
            </Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select options={deptOptions} placeholder="Select department" allowClear />
            </Form.Item>
          </div>
          {v2FieldsSection}
        </Form>
      </Modal>

      {/* ── Edit User Modal ────────────────────────────────────────────────── */}
      <Modal title="Edit User" open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()} okText="Save Changes"
        confirmLoading={editLoading} className={styles.userModal} destroyOnClose
        style={{ top: 20 }}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="title" label="Title">
              <Input placeholder="Dr / Mr / Ms" />
            </Form.Item>
            <Form.Item name="first_name" label="First Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="last_name" label="Last Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email"
              rules={[{ required: true }, { type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true }]}>
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item name="designation" label="Designation">
              <Input placeholder="e.g. Senior Chemist" />
            </Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select options={deptOptions} placeholder="Select department" allowClear />
            </Form.Item>
          </div>
          {v2FieldsSection}
        </Form>
      </Modal>
    </div>
  )
}
