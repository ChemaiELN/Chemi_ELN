import React, { useState, useEffect, useCallback } from 'react'
import { Table, Button, Tag, Switch, Popconfirm, message, Space, Tooltip, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { HomeOutlined, AppstoreAddOutlined, FormOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getWorkflowTemplates,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  type WorkflowTemplateResponse,
} from '@/utilities/chemiaApi'

const AdminWorkflowTemplatesPage: React.FC = () => {
  const navigate = useNavigate()
  const [rows,    setRows]    = useState<WorkflowTemplateResponse[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getWorkflowTemplates()
      .then(data => setRows(data as WorkflowTemplateResponse[]))
      .catch(() => message.error('Failed to load templates'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (row: WorkflowTemplateResponse, val: boolean) => {
    try {
      const updated = await updateWorkflowTemplate(row.id, { is_active: val })
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
    } catch {
      message.error('Failed to update template')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkflowTemplate(id)
      setRows(prev => prev.filter(r => r.id !== id))
      message.success('Template deleted')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnsType<WorkflowTemplateResponse> = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1c1917' }}>{v}</div>
          <div style={{ fontSize: 11, color: '#78716c' }}>{row.slug}</div>
        </div>
      ),
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 140,
      render: v => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : <span style={{ color: '#a8a29e' }}>—</span>,
    },
    {
      title: 'Description', dataIndex: 'description', key: 'description',
      render: v => <span style={{ fontSize: 12, color: '#78716c' }}>{v || '—'}</span>,
    },
    {
      title: 'Ver', dataIndex: 'version', key: 'version', width: 60, align: 'center',
      render: v => <span style={{ fontSize: 12 }}>v{v}</span>,
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 72, align: 'center',
      render: (v, row) => (
        <Switch size="small" checked={v} onChange={val => handleToggleActive(row, val)} />
      ),
    },
    {
      title: '', key: 'actions', width: 100, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Configure fields">
            <Button
              size="small"
              icon={<FormOutlined />}
              onClick={() => navigate(`/admin/workflow-templates/${row.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete this template?"
            description="Notebooks linked to it will lose the field configuration."
            onConfirm={() => handleDelete(row.id)}
            okText="Delete" okButtonProps={{ danger: true }}
          >
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
        <Sidebar activeKey="workflow-templates" />
        <main className={styles.main}>

          <div className={styles.topBar}>
            <nav className={styles.breadcrumb}>
              <span className={styles.breadHome} onClick={() => navigate('/admin')}>
                <HomeOutlined /> Admin
              </span>
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadCurrent}>Experiment Templates</span>
            </nav>
            <Button
              className={styles.addBtn}
              icon={<AppstoreAddOutlined />}
              onClick={() => navigate('/admin/workflow-templates/new')}
            >
              New Template
            </Button>
          </div>

          <div className={styles.infoNote}>
            Templates define the field structure scientists fill in when recording experiments.
            Each template has <strong>sections</strong> → <strong>screens</strong> → <strong>fields</strong>.
            Field values are stored in the experiment's <code>data</code> JSON blob, keyed by <code>screen_key</code>.
          </div>

          <div className={styles.card}>
            <Table<WorkflowTemplateResponse>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={rows}
              columns={columns}
              className={styles.table}
              locale={{ emptyText: <Empty description="No templates yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
            />
          </div>

        </main>
      </div>
    </div>
  )
}

export default AdminWorkflowTemplatesPage
