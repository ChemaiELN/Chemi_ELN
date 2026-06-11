import React, { useState, useEffect } from 'react'
import { Card, Breadcrumb, Table, Tag, Badge, Button, Spin, message, Modal, Form, Input, Select } from 'antd'
import { HomeOutlined, ExportOutlined, EditOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getNotebook, updateNotebook, getExperiments, createExperiment,
  type NotebookResponse, type ExperimentSummary,
} from '@/utilities/chemiaApi'

const EXP_TAG: Record<string, { bg: string; color: string; cls: string }> = {
  APPROVED:  { bg: '#ecfdf5', color: '#047857', cls: 'tagApproved' },
  VERIFIED:  { bg: '#f0fdfa', color: '#0d9488', cls: 'tagVerified' },
  SUBMITTED: { bg: '#eff6ff', color: '#1d4ed8', cls: 'tagSubmitted' },
  DRAFT:     { bg: '#f5f5f4', color: '#78716c', cls: 'tagDraft'     },
  REJECTED:  { bg: '#fff1f2', color: '#be123c', cls: 'tagRejected'  },
  UNLOCKED:  { bg: '#fffbeb', color: '#92400e', cls: 'tagDraft'     },
  VOID:      { bg: '#f5f5f4', color: '#a8a29e', cls: 'tagDraft'     },
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'LOCKED',   label: 'Locked' },
]

const NotebookOverviewPage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [notebook, setNotebook] = useState<NotebookResponse | null>(null)
  const [exps, setExps]         = useState<ExperimentSummary[]>([])
  const [loading, setLoading]   = useState(true)

  const loadAll = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getNotebook(id),
      getExperiments({ notebook_id: id, page_size: 20, latest_only: true }),
    ])
      .then(([nb, expResp]) => {
        setNotebook(nb)
        setExps(expResp.items)
      })
      .catch(() => message.error('Failed to load notebook'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [id])

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen]   = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm] = Form.useForm()

  const openEdit = () => {
    if (!notebook) return
    editForm.setFieldsValue({ title: notebook.title, description: notebook.description ?? '', status: notebook.status })
    setEditOpen(true)
  }

  const handleEdit = async (values: { title: string; description: string; status: string }) => {
    if (!id) return
    setEditSaving(true)
    try {
      const nb = await updateNotebook(id, { title: values.title, description: values.description || undefined, status: values.status })
      setNotebook(nb)
      message.success('Notebook updated')
      setEditOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setEditSaving(false)
    }
  }

  // ── New Experiment modal ────────────────────────────────────────────────────
  const [newExpOpen, setNewExpOpen]     = useState(false)
  const [newExpLoading, setNewExpLoading] = useState(false)
  const [newExpForm] = Form.useForm()

  const handleNewExp = async (values: { title: string }) => {
    if (!id) return
    setNewExpLoading(true)
    try {
      const exp = await createExperiment({ notebook_id: id, title: values.title })
      message.success('Experiment created')
      setNewExpOpen(false)
      navigate(`/experiments/${exp.id}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create experiment')
    } finally {
      setNewExpLoading(false)
    }
  }

  if (loading) return (
    <div className={styles.page}>
      <Header />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    </div>
  )

  if (!notebook) return null

  // Compute breakdown
  const statusKeys = ['APPROVED','VERIFIED','SUBMITTED','DRAFT','REJECTED','UNLOCKED','VOID']
  const breakdown = statusKeys
    .map(s => ({ label: s, count: exps.filter(e => e.status === s).length }))
    .filter(x => x.count > 0)
  const total = exps.length

  const expColumns: ColumnsType<ExperimentSummary> = [
    {
      title: 'Code', dataIndex: 'full_code', key: 'full_code',
      render: (v: string) => <span className={styles.monoText}>{v}</span>,
    },
    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (s: string) => {
        const t = EXP_TAG[s] ?? EXP_TAG.DRAFT
        return <Tag className={`${styles.statusTag} ${styles[t.cls]}`}>{s}</Tag>
      },
    },
    { title: 'Date', dataIndex: 'updated_at', key: 'updated_at',
      render: (v: string) => v?.slice(0, 10) },
  ]

  const nbStatus = notebook.status
  const statusBadge = nbStatus === 'ACTIVE' ? 'success' : nbStatus === 'ARCHIVED' ? 'default' : 'warning'

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="lookup2" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumbRow}>
            <Breadcrumb items={[
              { title: <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span> },
              { title: <span className={styles.breadcrumbLink} onClick={() => navigate('/notebooks')}>Notebooks</span> },
              { title: notebook.code },
              { title: 'Overview' },
            ]} />
            <div className={styles.breadcrumbActions}>
              <Button size="small" icon={<EditOutlined />} onClick={openEdit} className={styles.actionBtn}>Edit</Button>
              <Button size="small" icon={<LockOutlined />} className={styles.actionBtn}
                onClick={() => navigate(`/notebooks/${id}/permissions`)}>
                Permissions
              </Button>
            </div>
          </div>

          {/* Tab nav */}
          <div className={styles.tabNav}>
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Overview</button>
            <button className={styles.tabBtn} onClick={() => navigate(`/notebooks/${id}/permissions`)}>Permissions</button>
          </div>

          {/* Stat Cards */}
          <div className={styles.statCards}>
            <div className={`${styles.statCard} ${styles.statCardTotal}`}>
              <div className={styles.statLabel}>Total Experiments</div>
              <div className={styles.statValue}>{total}</div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardApproved}`}>
              <div className={styles.statLabel}>Approved</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'APPROVED').length}
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardSubmitted}`}>
              <div className={styles.statLabel}>Submitted</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'SUBMITTED').length}
              </div>
            </div>
            <div className={`${styles.statCard} ${styles.statCardDraft}`}>
              <div className={styles.statLabel}>Draft</div>
              <div className={styles.statValue}>
                {exps.filter(e => e.status === 'DRAFT').length}
              </div>
            </div>
          </div>

          {/* Two-column */}
          <div className={styles.twoCol}>
            {/* Breakdown */}
            <Card className={styles.card} title={<span className={styles.cardTitle}>Experiment Status Breakdown</span>}>
              {breakdown.length === 0
                ? <p style={{ color: '#78716c', fontSize: 13, margin: 0 }}>No experiments yet.</p>
                : (
                  <div className={styles.breakdownList}>
                    {breakdown.map(item => {
                      const t = EXP_TAG[item.label] ?? EXP_TAG.DRAFT
                      const colorMap: Record<string, string> = {
                        APPROVED: 'barEmerald', VERIFIED: 'barTeal', SUBMITTED: 'barSky',
                        DRAFT: 'barStone', REJECTED: 'barRose', UNLOCKED: 'barStone', VOID: 'barStone',
                      }
                      return (
                        <div key={item.label} className={styles.breakdownRow}>
                          <div className={styles.breakdownMeta}>
                            <span className={styles.breakdownLabel} style={{ color: t.color }}>{item.label}</span>
                            <span className={styles.breakdownCount}>{item.count}</span>
                          </div>
                          <div className={styles.barTrack}>
                            <div className={`${styles.barFill} ${styles[colorMap[item.label] ?? 'barStone']}`}
                              style={{ width: total ? `${(item.count / total) * 100}%` : '0%' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </Card>

            {/* Notebook Info */}
            <Card className={styles.card} title={<span className={styles.cardTitle}>Notebook Info</span>}>
              <div className={styles.infoGrid}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Notebook Code</span>
                  <span className={styles.infoValue}><span className={styles.monoText}>{notebook.code}</span></span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Title</span>
                  <span className={styles.infoValue}>{notebook.title}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Project</span>
                  <span className={styles.infoValue}><span className={styles.monoText}>{notebook.project_id.slice(0, 8)}…</span></span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Creator</span>
                  <span className={styles.infoValue}>{notebook.creator?.display_name ?? '—'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Created</span>
                  <span className={styles.infoValue}>{notebook.created_at?.slice(0, 10)}</span>
                </div>
                {notebook.description && (
                  <div className={styles.infoRow} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <span className={styles.infoLabel}>Description</span>
                    <span style={{ fontSize: 13, color: '#44403c' }}>{notebook.description}</span>
                  </div>
                )}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Status</span>
                  <span className={styles.infoValue}><Badge status={statusBadge} text={nbStatus} /></span>
                </div>
              </div>
            </Card>
          </div>

          {/* Experiments Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>
                Recent Experiments
                <span className={styles.tableCount}>{exps.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button icon={<PlusOutlined />} size="small"
                  style={{ background: '#0f766e', borderColor: '#0f766e', color: '#fff' }}
                  onClick={() => { newExpForm.resetFields(); setNewExpOpen(true) }}>
                  New Experiment
                </Button>
                <Button icon={<ExportOutlined />} size="small" className={styles.exportBtn}>Export</Button>
              </div>
            </div>
            <Table<ExperimentSummary>
              columns={expColumns}
              dataSource={exps.map(e => ({ ...e, key: e.id }))}
              size="small" className={styles.compactTable} pagination={false}
              onRow={row => ({ onClick: () => navigate(`/experiments/${row.id}`) })}
            />
          </div>
        </main>
      </div>

      {/* Edit Modal */}
      <Modal title="Edit Notebook" open={editOpen} onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()} okText="Save" confirmLoading={editSaving} destroyOnClose width={440}
        className={styles.editModal}>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* New Experiment Modal */}
      <Modal title="New Experiment" open={newExpOpen}
        onCancel={() => setNewExpOpen(false)}
        onOk={() => newExpForm.submit()} okText="Create"
        confirmLoading={newExpLoading} destroyOnClose width={400}>
        <Form form={newExpForm} layout="vertical" onFinish={handleNewExp} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="title" label="Experiment Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Synthesis Run #1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default NotebookOverviewPage
