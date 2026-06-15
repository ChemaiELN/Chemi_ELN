import { useState, useEffect } from 'react'
import { Table, Tag, Button, message, Modal, Form, Input, Select, DatePicker, InputNumber, Popconfirm } from 'antd'
import { HomeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { useProjectPermissions } from '@/hooks/useModulePermissions'
import styles from './styles.module.less'
import sharedStyles from '../../shared/styles.module.less'
import ProjectEmptyState from '../../shared/ProjectEmptyState'
import {
  getMilestones, createMilestone, updateMilestone, deleteMilestone, getUsers, getProject,
  type MilestoneResponse,
} from '@/utilities/chemiaApi'

type MilestoneStatus = 'NOT STARTED' | 'ON TRACK' | 'AT RISK' | 'COMPLETED' | 'DELAYED'

const STATUS_OPTIONS = ['NOT STARTED','ON TRACK','AT RISK','COMPLETED','DELAYED'].map(v => ({ value: v, label: v }))

export default function ProjectMilestonesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canEdit, canRoutes } = useProjectPermissions()

  const [projectCode, setProjectCode] = useState('')
  const [milestones, setMilestones]   = useState<MilestoneResponse[]>([])
  const [loading, setLoading]         = useState(false)
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([])

  const loadMilestones = () => {
    if (!id) return
    setLoading(true)
    getMilestones(id)
      .then(setMilestones)
      .catch(() => message.error('Failed to load milestones'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!id) return
    loadMilestones()
    getProject(id).then(p => setProjectCode(p.code)).catch(() => {})
    getUsers({ page_size: 100 }).then(r => {
      setUserOptions(r.items.map(u => ({ value: u.id, label: `${u.display_name} (${u.username})` })))
    }).catch(() => {})
  }, [id])

  // ── Add Milestone modal ───────────────────────────────────────────────────
  const [addOpen, setAddOpen]       = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addForm] = Form.useForm()

  const handleAdd = async (values: Record<string, unknown>) => {
    if (!id) return
    setAddLoading(true)
    try {
      await createMilestone(id, {
        name:     values.name as string,
        due_date: values.due_date ? (values.due_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
        owner_id: values.owner_id as string | undefined,
        status:   (values.status as string) ?? 'NOT STARTED',
        pct:      (values.pct as number) ?? 0,
      })
      message.success('Milestone created')
      setAddOpen(false)
      addForm.resetFields()
      loadMilestones()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Edit Milestone modal ──────────────────────────────────────────────────
  const [editOpen, setEditOpen]       = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editId, setEditId]           = useState('')
  const [editForm] = Form.useForm()

  const openEdit = (ms: MilestoneResponse) => {
    setEditId(ms.id)
    editForm.setFieldsValue({
      name:           ms.name,
      due_date:       ms.due_date ? dayjs(ms.due_date) : null,
      completed_date: ms.completed_date ? dayjs(ms.completed_date) : null,
      owner_id:       ms.owner_id ?? undefined,
      status:         ms.status,
      pct:            ms.pct,
    })
    setEditOpen(true)
  }

  const handleEdit = async (values: Record<string, unknown>) => {
    if (!id) return
    setEditLoading(true)
    try {
      await updateMilestone(id, editId, {
        name:           values.name as string,
        due_date:       values.due_date ? (values.due_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        completed_date: values.completed_date ? (values.completed_date as dayjs.Dayjs).format('YYYY-MM-DD') : null,
        owner_id:       (values.owner_id as string | undefined) ?? null,
        status:         values.status as string,
        pct:            values.pct as number,
      })
      message.success('Milestone updated')
      setEditOpen(false)
      loadMilestones()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (msId: string) => {
    if (!id) return
    try {
      await deleteMilestone(id, msId)
      message.success('Milestone deleted')
      loadMilestones()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    }
  }

  // ── Status summary counts ─────────────────────────────────────────────────
  const statusCounts = (['NOT STARTED','ON TRACK','AT RISK','COMPLETED','DELAYED'] as MilestoneStatus[])
    .map(s => ({ status: s, count: milestones.filter(m => m.status === s).length }))

  const columns: ColumnsType<MilestoneResponse> = [
    { title: '#', key: 'no', width: 50, render: (_v, _r, idx) => idx + 1 },
    { title: 'MILESTONE NAME', dataIndex: 'name', key: 'name' },
    { title: 'OWNER', key: 'owner',
      render: (_v, r) => r.owner?.display_name ?? '—' },
    { title: 'DUE DATE', dataIndex: 'due_date', key: 'due_date',
      render: (v: string | null) => v ?? '—' },
    { title: 'COMPLETED', dataIndex: 'completed_date', key: 'completed_date',
      render: (v: string | null) => v ?? '—' },
    {
      title: 'PROGRESS', dataIndex: 'pct', key: 'pct', width: 140,
      render: (pct: number) => (
        <div>
          <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
          <div className={styles.progressLabel}>{pct}%</div>
        </div>
      ),
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status',
      render: (s: string) => <StatusTag status={s} />,
    },
    ...(canEdit ? [{
      title: 'ACTIONS', key: 'actions', width: 80,
      render: (_v, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <Button type="text" size="small" icon={<EditOutlined />}
            style={{ color: '#5aa3a1' }} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this milestone?" onConfirm={() => handleDelete(record.id)}
            okText="Delete" okButtonProps={{ danger: true }}>
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#be123c' }} />
          </Popconfirm>
        </span>
      ),
    }] : []),
  ]

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="project" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span>
            {' / '}
            <span className={styles.breadcrumbLink} onClick={() => navigate('/projects')}>Projects</span>
            {' / '}
            <span className={styles.breadcrumbLink} onClick={() => navigate(`/projects/${id}/overview`)}>{projectCode || id}</span>
            {' / '}
            <span>Milestones</span>
          </div>

          {/* Tab nav */}
          <div className={styles.tabNav}>
            <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/overview`)}>Overview</button>
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Milestones</button>
            {canRoutes && (
              <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/routes`)}>Routes &amp; Stages</button>
            )}
          </div>

          {/* Page header */}
          <div className={styles.pageHeader}>
            {milestones.length > 0 ? (
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Status summary:</span>
                {statusCounts.map(({ status, count }) => (
                  <StatusTag key={status} status={status} label={`${status} ${count}`} className={styles.chipTag} />
                ))}
              </div>
            ) : (
              <span />
            )}
            {canEdit && (
              <Button type="primary"
                icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
                className={sharedStyles.primaryActionBtn}
                onClick={() => setAddOpen(true)}>
                Add Milestone
              </Button>
            )}
          </div>

          {/* Table card */}
          <div className={styles.tableCard}>
            <div className={styles.tableCardHeader}>
              <div className={styles.tableCardTitle}>Milestones</div>
            </div>
            <Table<MilestoneResponse>
              className={styles.table}
              columns={columns}
              dataSource={milestones.map(m => ({ ...m, key: m.id }))}
              loading={loading}
              size="small"
              pagination={false}
              locale={{
                emptyText: (
                  <ProjectEmptyState
                    message={canEdit
                      ? 'No milestones yet. Click "Add Milestone" to get started.'
                      : 'No milestones yet.'}
                  />
                ),
              }}
            />
          </div>
        </main>
      </div>

      {/* Add Milestone Modal */}
      <Modal title="Add Milestone" open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields() }}
        onOk={() => addForm.submit()} okText="Create" confirmLoading={addLoading}
        className={styles.milestoneModal}
        width={480} destroyOnClose>
        <Form form={addForm} layout="vertical" onFinish={handleAdd} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Milestone Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Route Scouting Complete" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="status" label="Status" initialValue="NOT STARTED">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            {/* <Form.Item name="due_date" label="Due Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item> */}
            <Form.Item name="owner_id" label="Owner">
              <Select options={userOptions} placeholder="Select owner" allowClear
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                showSearch />
            </Form.Item>
            {/* <Form.Item name="status" label="Status" initialValue="NOT STARTED">
              <Select options={STATUS_OPTIONS} />
            </Form.Item> */}
            <Form.Item name="due_date" label="Due Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="pct" label="Progress %" initialValue={0}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Edit Milestone Modal */}
      <Modal title="Edit Milestone" open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()} okText="Save" confirmLoading={editLoading}
        className={styles.milestoneModal}
        width={480} destroyOnClose>
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Milestone Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="due_date" label="Due Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="completed_date" label="Completed Date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="owner_id" label="Owner">
              <Select options={userOptions} placeholder="Select owner" allowClear showSearch
                filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="pct" label="Progress %">
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
