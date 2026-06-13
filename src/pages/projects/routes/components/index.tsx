import { useState, useEffect } from 'react'
import { Button, Tag, message, Modal, Form, Input, Select, Popconfirm } from 'antd'
import { HomeOutlined, PlusOutlined, RightOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import { useProjectPermissions } from '@/hooks/useModulePermissions'
import styles from './styles.module.less'
import {
  getRoutes, createRoute, updateRoute, createStage, updateStage, deleteStage,
  getProject,
  type RouteResponse, type StageResponse,
} from '@/utilities/chemiaApi'

const ROUTE_STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Active' },
  { value: 'DRAFT',    label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export default function RouteStageManagerPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { canEdit, canRoutes } = useProjectPermissions()

  const [projectCode, setProjectCode] = useState('')
  const [routes, setRoutes]           = useState<RouteResponse[]>([])
  const [loading, setLoading]         = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const loadRoutes = () => {
    if (!id) return
    setLoading(true)
    getRoutes(id)
      .then(r => {
        setRoutes(r)
        // Auto-expand first route
        if (r.length > 0) setExpandedKeys(new Set([r[0].id]))
      })
      .catch(() => message.error('Failed to load routes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!id) return
    loadRoutes()
    getProject(id).then(p => setProjectCode(p.code)).catch(() => {})
  }, [id])

  const toggleRoute = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ── Add Route modal ───────────────────────────────────────────────────────
  const [addRouteOpen, setAddRouteOpen]   = useState(false)
  const [addRouteLoading, setAddRouteLoading] = useState(false)
  const [addRouteForm] = Form.useForm()

  const handleAddRoute = async (values: Record<string, unknown>) => {
    if (!id) return
    setAddRouteLoading(true)
    try {
      const r = await createRoute(id, {
        code:        (values.code as string).toUpperCase(),
        name:        values.name as string,
        description: (values.description as string | undefined) || undefined,
      })
      message.success(`Route "${r.code}" created`)
      setAddRouteOpen(false)
      addRouteForm.resetFields()
      loadRoutes()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddRouteLoading(false)
    }
  }

  // ── Edit Route modal ──────────────────────────────────────────────────────
  const [editRouteOpen, setEditRouteOpen]   = useState(false)
  const [editRouteLoading, setEditRouteLoading] = useState(false)
  const [editRouteId, setEditRouteId]       = useState('')
  const [editRouteForm] = Form.useForm()

  const openEditRoute = (route: RouteResponse) => {
    setEditRouteId(route.id)
    editRouteForm.setFieldsValue({ name: route.name, description: route.description ?? '', status: route.status })
    setEditRouteOpen(true)
  }

  const handleEditRoute = async (values: Record<string, unknown>) => {
    if (!id) return
    setEditRouteLoading(true)
    try {
      await updateRoute(id, editRouteId, {
        name:        values.name as string,
        description: (values.description as string | undefined) || undefined,
        status:      values.status as string,
      })
      message.success('Route updated')
      setEditRouteOpen(false)
      loadRoutes()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setEditRouteLoading(false)
    }
  }

  // ── Add Stage modal ───────────────────────────────────────────────────────
  const [addStageOpen, setAddStageOpen]   = useState(false)
  const [addStageLoading, setAddStageLoading] = useState(false)
  const [addStageRouteId, setAddStageRouteId] = useState('')
  const [addStageForm] = Form.useForm()

  const openAddStage = (routeId: string) => {
    setAddStageRouteId(routeId)
    addStageForm.resetFields()
    setAddStageOpen(true)
  }

  const handleAddStage = async (values: Record<string, unknown>) => {
    if (!id) return
    setAddStageLoading(true)
    try {
      await createStage(id, addStageRouteId, {
        code: (values.code as string).toUpperCase(),
        name: values.name as string,
        description: (values.description as string | undefined) || undefined,
      })
      message.success('Stage added')
      setAddStageOpen(false)
      addStageForm.resetFields()
      loadRoutes()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAddStageLoading(false)
    }
  }

  // ── Edit Stage modal ──────────────────────────────────────────────────────
  const [editStageOpen, setEditStageOpen]   = useState(false)
  const [editStageLoading, setEditStageLoading] = useState(false)
  const [editStageIds, setEditStageIds]     = useState({ routeId: '', stageId: '' })
  const [editStageForm] = Form.useForm()

  const openEditStage = (routeId: string, stage: StageResponse) => {
    setEditStageIds({ routeId, stageId: stage.id })
    editStageForm.setFieldsValue({ name: stage.name, description: stage.description ?? '', status: stage.status })
    setEditStageOpen(true)
  }

  const handleEditStage = async (values: Record<string, unknown>) => {
    if (!id) return
    setEditStageLoading(true)
    try {
      await updateStage(id, editStageIds.routeId, editStageIds.stageId, {
        name:        values.name as string,
        description: (values.description as string | undefined) || undefined,
        status:      values.status as string,
      })
      message.success('Stage updated')
      setEditStageOpen(false)
      loadRoutes()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setEditStageLoading(false)
    }
  }

  const handleDeleteStage = async (routeId: string, stageId: string) => {
    if (!id) return
    try {
      await deleteStage(id, routeId, stageId)
      message.success('Stage deleted')
      loadRoutes()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to delete — stage may have linked experiments')
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalStages = routes.reduce((a, r) => a + r.stages.length, 0)

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="project" />
        <main className={styles.main}>
          {/* Breadcrumb */}
          <div className={styles.topRow}>
            <div className={styles.breadcrumb}>
              <span className={styles.breadcrumbLink} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span>
              {' / '}
              <span className={styles.breadcrumbLink} onClick={() => navigate('/projects')}>Projects</span>
              {' / '}
              <span className={styles.breadcrumbLink} onClick={() => navigate(`/projects/${id}/overview`)}>{projectCode || id}</span>
              {' / '}
              <span>Routes &amp; Stages</span>
            </div>
            {canRoutes && (
              <Button type="primary" icon={<PlusOutlined />} className={styles.addRouteBtn}
                loading={loading} onClick={() => setAddRouteOpen(true)}>
                Add Route
              </Button>
            )}
          </div>

          {/* Tab nav */}
          <div className={styles.tabNav}>
            <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/overview`)}>Overview</button>
            {canEdit && (
              <button className={styles.tabBtn} onClick={() => navigate(`/projects/${id}/milestones`)}>Milestones</button>
            )}
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Routes &amp; Stages</button>
          </div>

          {/* Stat cards */}
          <div className={styles.statRow}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Routes</div>
              <div className={styles.statValue}>{routes.length}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Total Stages</div>
              <div className={styles.statValue}>{totalStages}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Active Routes</div>
              <div className={styles.statValue}>{routes.filter(r => r.status === 'ACTIVE').length}</div>
            </div>
          </div>

          {/* Route tree */}
          {routes.length === 0 && !loading
            ? <div className={styles.emptyState}>{canRoutes ? 'No routes yet. Click "Add Route" to create one.' : 'No routes yet.'}</div>
            : (
              <div className={styles.routeTree}>
                {routes.map(route => {
                  const isExpanded = expandedKeys.has(route.id)
                  return (
                    <div key={route.id} className={styles.routeCard}>
                      {/* Route header */}
                      <div
                        className={`${styles.routeHeader} ${isExpanded ? styles.routeHeaderExpanded : ''}`}
                        onClick={() => toggleRoute(route.id)}
                      >
                        <span className={`${styles.routeToggle} ${isExpanded ? styles.expanded : ''}`}>
                          <RightOutlined />
                        </span>
                        <span className={styles.routeCodeBadge}>{route.code}</span>
                        <span className={styles.routeName}>{route.name}</span>
                        <div className={styles.routeMeta}>
                          <span className={styles.metaItem}>{route.stages.length} stage{route.stages.length !== 1 ? 's' : ''}</span>
                        </div>
                        <StatusTag status={route.status} />
                        {canRoutes && (
                          <div className={styles.routeActions} onClick={e => e.stopPropagation()}>
                            <button className={styles.actionBtn} onClick={() => openAddStage(route.id)}>
                              <PlusOutlined style={{ marginRight: 4 }} />Add Stage
                            </button>
                            <button className={styles.actionBtn} onClick={() => openEditRoute(route)}>
                              <EditOutlined style={{ marginRight: 4 }} />Edit
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stage rows */}
                      {isExpanded && route.stages.length > 0 && (
                        <div className={styles.stageList}>
                          {route.stages.map(stage => (
                            <div key={stage.id} className={styles.stageRow}>
                              <span className={styles.stageCodeBadge}>{stage.code}</span>
                              <span className={styles.stageName}>{stage.name}</span>
                              <StatusTag status={stage.status} />
                              {canRoutes && (
                                <div className={styles.stageActions}>
                                  <button className={styles.actionBtn} onClick={() => openEditStage(route.id, stage)}>
                                    <EditOutlined style={{ marginRight: 4 }} />Edit
                                  </button>
                                  <Popconfirm
                                    title="Delete this stage? This fails if experiments are linked."
                                    onConfirm={() => handleDeleteStage(route.id, stage.id)}
                                    okText="Delete" okButtonProps={{ danger: true }}>
                                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`}>
                                      <DeleteOutlined style={{ marginRight: 4 }} />Delete
                                    </button>
                                  </Popconfirm>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isExpanded && route.stages.length === 0 && (
                        <div className={styles.noStages}>No stages added yet.</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          }
        </main>
      </div>

      {/* Add Route Modal */}
      <Modal title="Add Route" open={addRouteOpen}
        onCancel={() => { setAddRouteOpen(false); addRouteForm.resetFields() }}
        onOk={() => addRouteForm.submit()} okText="Create" confirmLoading={addRouteLoading}
        className={styles.routeModal}
        width={440} destroyOnClose>
        <Form form={addRouteForm} layout="vertical" onFinish={handleAddRoute} requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0 12px' }}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input placeholder="R1" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="name" label="Route Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Direct Acylation" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Route Modal */}
      <Modal title="Edit Route" open={editRouteOpen}
        onCancel={() => setEditRouteOpen(false)}
        onOk={() => editRouteForm.submit()} okText="Save" confirmLoading={editRouteLoading}
        className={styles.routeModal}
        width={440} destroyOnClose>
        <Form form={editRouteForm} layout="vertical" onFinish={handleEditRoute} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Route Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={ROUTE_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Stage Modal */}
      <Modal title="Add Stage" open={addStageOpen}
        onCancel={() => { setAddStageOpen(false); addStageForm.resetFields() }}
        onOk={() => addStageForm.submit()} okText="Add Stage" confirmLoading={addStageLoading}
        className={styles.routeModal}
        width={440} destroyOnClose>
        <Form form={addStageForm} layout="vertical" onFinish={handleAddStage} requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0 12px' }}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input placeholder="S1" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item name="name" label="Stage Name" rules={[{ required: true }]}>
              <Input placeholder="e.g. Purification" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Stage Modal */}
      <Modal title="Edit Stage" open={editStageOpen}
        onCancel={() => setEditStageOpen(false)}
        onOk={() => editStageForm.submit()} okText="Save" confirmLoading={editStageLoading}
        className={styles.routeModal}
        width={440} destroyOnClose>
        <Form form={editStageForm} layout="vertical" onFinish={handleEditStage} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Stage Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select options={ROUTE_STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
