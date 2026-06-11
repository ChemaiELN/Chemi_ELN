import React, { useState, useEffect } from 'react'
import {
  Table, Button, Input, Switch, Tag, Modal, Form,
  Popconfirm, message, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  HomeOutlined, GlobalOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getSites, createSite, updateSite, deleteSite,
  type Site, type SiteUpdate,
} from '@/utilities/chemiaApi'

const AdminSitesPage: React.FC = () => {
  const navigate = useNavigate()

  const [rows,       setRows]       = useState<Site[]>([])
  const [loading,    setLoading]    = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<Site | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const load = () => {
    setLoading(true)
    getSites()
      .then(data => setRows(data))
      .catch(() => message.error('Failed to load sites'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: Site) => {
    setEditTarget(row)
    form.setFieldsValue({ code: row.code, name: row.name, is_active: row.is_active } as unknown as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let values: any
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const body: SiteUpdate = { name: values.name, is_active: values.is_active }
        const updated = await updateSite(editTarget.id, body)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Site updated')
      } else {
        await createSite({ code: values.code, name: values.name })
        message.success('Site created')
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
      await deleteSite(id)
      message.success('Site deleted')
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnsType<Site> = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 140,
      render: v => <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#0f766e' }}>{v}</span> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => <Tag className={styles.statusTag} color={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Tag> },
    { title: '', key: 'actions', width: 90, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this site?" onConfirm={() => handleDelete(row.id)}
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
              <span className={styles.breadCurrent}>Sites</span>
            </nav>
            <Button className={styles.addBtn} icon={<PlusOutlined />} onClick={openAdd}>
              Add Site
            </Button>
          </div>

          <div className={styles.card}>
            <Table<Site>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={rows}
              columns={columns}
              className={styles.table}
              pagination={false}
            />
          </div>

          {/* Add / Edit Modal */}
          <Modal
            title={editTarget ? 'Edit Site' : 'Add Site'}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onOk={handleSave}
            okText={editTarget ? 'Update' : 'Create'}
            confirmLoading={saving}
            width={400}
            destroyOnClose
            className={styles.dataModal}
            style={{ top: 20 }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item name="code" label="Site Code"
                rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. HQ, PLANT-A" disabled={!!editTarget} />
              </Form.Item>
              <Form.Item name="name" label="Site Name"
                rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
              {editTarget && (
                <Form.Item name="is_active" label="Active" valuePropName="checked">
                  <Switch size="small" />
                </Form.Item>
              )}
            </Form>
          </Modal>

        </main>
      </div>
    </div>
  )
}

export default AdminSitesPage
