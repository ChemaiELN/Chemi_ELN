import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Tag, Modal, Form,
  Select, Popconfirm, message, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, DeleteOutlined, HomeOutlined,
  SafetyCertificateOutlined, EditOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getRolePrivileges, createRolePrivilege, updateRolePrivilege, deleteRolePrivilege,
  getRolesList, getDepartments,
  type RolePrivilege, type RolePrivilegeCreate, type RoleShort,
} from '@/utilities/chemiaApi'

interface DeptShort { id: string; code: string; name: string }

const AdminRolePrivilegesPage: React.FC = () => {
  const navigate = useNavigate()

  // ── Data ─────────────────────────────────────────────────────
  const [rows,    setRows]    = useState<RolePrivilege[]>([])
  const [loading, setLoading] = useState(false)
  const [roles,   setRoles]   = useState<RoleShort[]>([])
  const [depts,   setDepts]   = useState<DeptShort[]>([])

  // ── Filters ───────────────────────────────────────────────────
  const [filterRole,  setFilterRole]  = useState<string | undefined>()
  const [filterDept,  setFilterDept]  = useState<string | undefined>()
  const [filterKey,   setFilterKey]   = useState('')

  // ── Modal ─────────────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<RolePrivilege | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  // ── Load lookup data once ─────────────────────────────────────
  useEffect(() => {
    getRolesList().then(setRoles).catch(() => {})
    getDepartments().then(d => setDepts(d as unknown as DeptShort[])).catch(() => {})
  }, [])

  // ── Load privileges ───────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    getRolePrivileges({
      role_id:       filterRole,
      department_id: filterDept,
      privilege_key: filterKey || undefined,
    })
      .then(setRows)
      .catch(() => message.error('Failed to load role privileges'))
      .finally(() => setLoading(false))
  }, [filterRole, filterDept, filterKey])

  useEffect(() => { load() }, [load])

  // ── Handlers ──────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_granted', true)
    setModalOpen(true)
  }

  const openEdit = (row: RolePrivilege) => {
    setEditTarget(row)
    form.setFieldsValue({
      role_id:       row.role?.id ?? row.role_id,
      department_id: row.department?.id ?? row.department_id,
      privilege_key: row.privilege_key,
      is_granted:    row.is_granted,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let values: any
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateRolePrivilege(editTarget.id, { is_granted: values.is_granted })
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Privilege updated')
      } else {
        const body: RolePrivilegeCreate = {
          role_id:       values.role_id,
          department_id: values.department_id ?? null,
          privilege_key: values.privilege_key,
          is_granted:    values.is_granted,
        }
        await createRolePrivilege(body)
        message.success('Privilege created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteRolePrivilege(id)
      message.success('Privilege deleted')
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleToggleGranted = async (row: RolePrivilege, val: boolean) => {
    try {
      const updated = await updateRolePrivilege(row.id, { is_granted: val })
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
    } catch {
      message.error('Failed to update privilege')
    }
  }

  // ── Columns ───────────────────────────────────────────────────
  const columns: ColumnsType<RolePrivilege> = [
    { title: 'Role', dataIndex: ['role', 'code'], key: 'role',
      render: (_, row) => row.role
        ? <Tag color="blue" style={{ fontWeight: 600 }}>{row.role.code}</Tag>
        : <span style={{ color: '#a8a29e' }}>—</span> },
    { title: 'Department', dataIndex: ['department', 'name'], key: 'department',
      render: (_, row) => row.department
        ? <span style={{ fontSize: 12 }}>{row.department.code} — {row.department.name}</span>
        : <span style={{ color: '#a8a29e' }}>—</span> },
    { title: 'Privilege Key', dataIndex: 'privilege_key', key: 'privilege_key',
      render: v => <span className={styles.keyCode}>{v}</span> },
    { title: 'Granted', dataIndex: 'is_granted', key: 'is_granted', width: 100,
      render: (v, row) => (
        <Tooltip title="Toggle granted">
          <Switch size="small" checked={v} onChange={val => handleToggleGranted(row, val)} />
        </Tooltip>
      ),
    },
    { title: 'Updated By', dataIndex: 'updated_by', key: 'updated_by', width: 130,
      render: v => v ?? '—' },
    { title: '', key: 'actions', width: 90, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this privilege?" onConfirm={() => handleDelete(row.id)}
            okText="Delete" okButtonProps={{ danger: true }}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
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

          <div className={styles.topBar}>
            <nav className={styles.breadcrumb}>
              <span className={styles.breadHome} onClick={() => navigate('/admin')}>
                <HomeOutlined /> Admin
              </span>
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadCurrent}>Role Privileges</span>
            </nav>
            <Button className={styles.addBtn} icon={<PlusOutlined />} onClick={openAdd}>
              Add Privilege
            </Button>
          </div>

          <div className={styles.card}>
            {/* Filters */}
            <div className={styles.filterRow}>
              <Select
                className={styles.filterSelect}
                placeholder="Filter by role"
                allowClear
                value={filterRole}
                onChange={v => setFilterRole(v)}
                options={roles.map(r => ({ value: r.id, label: r.code }))}
              />
              <Select
                className={styles.filterSelect}
                style={{ width: 220 }}
                placeholder="Filter by department"
                allowClear
                value={filterDept}
                onChange={v => setFilterDept(v)}
                options={depts.map(d => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
              />
              <Input
                className={styles.filterInput}
                placeholder="Privilege key…"
                value={filterKey}
                onChange={e => setFilterKey(e.target.value)}
                allowClear
              />
            </div>

            <Table<RolePrivilege>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={rows}
              columns={columns}
              className={styles.table}
              pagination={{ pageSize: 25, size: 'small', showSizeChanger: false }}
            />
          </div>

          {/* Add / Edit Modal */}
          <Modal
            title={editTarget ? 'Edit Privilege' : 'Add Privilege'}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onOk={handleSave}
            okText={editTarget ? 'Update' : 'Create'}
            confirmLoading={saving}
            width={460}
            destroyOnClose
            className={styles.privilegeModal}
            style={{ top: 20 }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item name="role_id" label="Role"
                rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select role…" disabled={!!editTarget}
                  options={roles.map(r => ({ value: r.id, label: `${r.code} — ${r.name}` }))} />
              </Form.Item>
              <Form.Item name="department_id" label="Department (optional)">
                <Select placeholder="All departments" allowClear
                  disabled={!!editTarget}
                  options={depts.map(d => ({ value: d.id, label: `${d.code} — ${d.name}` }))} />
              </Form.Item>
              <Form.Item name="privilege_key" label="Privilege Key"
                rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. can_approve_experiment"
                  disabled={!!editTarget} />
              </Form.Item>
              <Form.Item name="is_granted" label="Granted" valuePropName="checked">
                <Switch size="small" />
              </Form.Item>
            </Form>
          </Modal>

        </main>
      </div>
    </div>
  )
}

export default AdminRolePrivilegesPage
