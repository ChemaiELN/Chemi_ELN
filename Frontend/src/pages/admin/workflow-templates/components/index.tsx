import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Table, Button, Tag, Switch, Popconfirm, message, Space, Tooltip, Empty, Modal, Input } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { HomeOutlined, FormOutlined, DeleteOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import styles from './styles.module.less'
import {
  getWorkflowTemplates,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
  getTemplateVersions,
  type WorkflowTemplateSummary,
} from '@/utilities/chemiaApi'

type AdminTemplateRow = WorkflowTemplateSummary & {
  description?: string
  _isHistorical?: boolean
  _definition?: Record<string, unknown> | null
  _savedAt?: string
  _templateId?: string
}

const AdminWorkflowTemplatesPage: React.FC = () => {
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminTemplateRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [descEdit, setDescEdit] = useState<{ id: string; description: string } | null>(null)
  const [descSaving, setDescSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const templates = await getWorkflowTemplates({ includeInactive: true })
      const allVersions = await Promise.all(templates.map(t => getTemplateVersions(t.id).catch(() => [])))

      const combined: AdminTemplateRow[] = []
      templates.forEach((t, i) => {
        combined.push(t)
        allVersions[i].forEach(v => {
          combined.push({
            id: v.id,
            name: t.name,
            slug: t.slug,
            category: t.category ?? undefined,
            version: v.version,
            is_active: false,
            _isHistorical: true,
            _definition: v.definition,
            _savedAt: v.saved_at,
            _templateId: t.id,
          })
        })
      })
      setRows(combined)
    } catch {
      message.error('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.name.toLowerCase().includes(q)
      || r.slug.toLowerCase().includes(q)
      || (r.description ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  const currentCount = useMemo(() => rows.filter(r => !r._isHistorical).length, [rows])

  const handleToggleActive = async (row: AdminTemplateRow, val: boolean) => {
    try {
      const updated = await updateWorkflowTemplate(row.id, { is_active: val })
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, is_active: updated.is_active } : r))
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

  const handleSaveDescription = async () => {
    if (!descEdit) return
    setDescSaving(true)
    try {
      const updated = await updateWorkflowTemplate(descEdit.id, {
        description: descEdit.description.trim() || undefined,
      })
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, description: updated.description } : r))
      message.success('Description updated')
      setDescEdit(null)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update description')
    } finally {
      setDescSaving(false)
    }
  }

  const columns: ColumnsType<AdminTemplateRow> = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: row._isHistorical ? 400 : 600, fontSize: 13, color: row._isHistorical ? '#a8a29e' : '#1c1917' }}>
            {v}
          </div>
          <div style={{ fontSize: 11, color: '#a8a29e' }}>{row.slug}</div>
        </div>
      ),
    },
    {
      title: 'Category', dataIndex: 'category', key: 'category', width: 140,
      render: (v, row) => v
        ? <Tag style={{ fontSize: 11, opacity: row._isHistorical ? 0.45 : 1 }}>{v}</Tag>
        : <span style={{ color: '#a8a29e' }}>—</span>,
    },
    {
      title: 'Description', dataIndex: 'description', key: 'description',
      render: (v: string | undefined, row) => row._isHistorical
        ? <span style={{ color: '#a8a29e', fontSize: 12 }}>—</span>
        : (
          <button type="button" className={styles.descCell} onClick={() => setDescEdit({ id: row.id, description: v ?? '' })}>
            {v
              ? <span className={styles.descText}>{v}</span>
              : <span className={styles.noDesc}>No description</span>}
          </button>
        ),
    },
    {
      title: 'Ver', dataIndex: 'version', key: 'version', width: 60, align: 'center',
      render: (v, row) => (
        <span style={{ fontSize: 12, color: row._isHistorical ? '#a8a29e' : undefined }}>v{v}</span>
      ),
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 72, align: 'center',
      render: (v, row) => (
        <Switch
          size="small"
          checked={v}
          disabled={!!row._isHistorical}
          onChange={val => handleToggleActive(row, val)}
        />
      ),
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, row) => row._isHistorical ? (
        <Tooltip title="Open & edit this version">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/admin/workflow-templates/${row._templateId}`, {
              state: { restoreDefinition: row._definition, fromVersion: row.version },
            })}
          />
        </Tooltip>
      ) : (
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
              className={sharedStyles.primaryActionBtn}
              icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
              onClick={() => navigate('/admin/workflow-templates/new')}
            >
              New Template
            </Button>
          </div>

          <div className={styles.infoNote}>
            Templates define the field structure used when recording experiments.
            Each template contains sections, screens, and fields that scientists fill in during data entry.
          </div>

          <div className={styles.card}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Templates
                <span className={styles.countBadge}>{currentCount}</span>
              </div>
              <div className={styles.tableCardFilters}>
                <Input
                  className={styles.filterInput}
                  placeholder="Search templates…"
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  allowClear
                />
                <Button className={styles.clearBtn} onClick={() => setSearch('')}>Clear</Button>
              </div>
            </div>
            <Table<AdminTemplateRow>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={filteredRows}
              columns={columns}
              className={styles.table}
              locale={{ emptyText: <Empty description="No templates yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
              rowClassName={row => row._isHistorical ? styles.historicalRow ?? '' : ''}
            />
          </div>

        </main>
      </div>

      <Modal
        title="Edit description"
        open={!!descEdit}
        onCancel={() => setDescEdit(null)}
        onOk={handleSaveDescription}
        okText="Save"
        confirmLoading={descSaving}
        destroyOnClose
        width={440}
      >
        <Input.TextArea
          rows={4}
          value={descEdit?.description ?? ''}
          onChange={e => setDescEdit(prev => prev ? { ...prev, description: e.target.value } : prev)}
          placeholder="Optional description for this template"
        />
      </Modal>
    </div>
  )
}

export default AdminWorkflowTemplatesPage
