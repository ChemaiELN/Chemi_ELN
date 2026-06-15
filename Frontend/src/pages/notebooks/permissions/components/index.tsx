import React, { useState, useEffect, useCallback } from 'react'
import { Breadcrumb, Table, Button, message, Modal, Form, Select, Switch, Spin, Popconfirm, Tooltip } from 'antd'
import {
  HomeOutlined, DeleteOutlined, InfoCircleOutlined,
  CheckOutlined, MinusOutlined, LockOutlined,
} from '@ant-design/icons'
import { Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import sharedStyles from '@/pages/projects/shared/styles.module.less'
import styles from './styles.module.less'
import {
  getNotebook, getNotebookPermissions, grantNotebookPermission, updateNotebookPermission,
  revokeNotebookPermission, getUsers,
  type PermissionResponse,
} from '@/utilities/chemiaApi'

type PermFlag =
  | 'can_view' | 'can_edit' | 'can_submit' | 'can_verify' | 'can_approve'
  | 'can_clone' | 'can_export' | 'can_attach' | 'can_comment'
  | 'can_request_unlock' | 'can_deactivate'

const ROLE_LABELS: Record<string, string> = {
  QA: 'QA',
  TL: 'Team Lead',
  CHEM: 'Chemist',
  HOD: 'Head of Department',
}

function userRoleLabel(role?: string | null): string {
  if (!role) return '—'
  return ROLE_LABELS[role] ?? role
}

const PERM_FLAGS: { key: PermFlag; label: string; tooltip?: string }[] = [
  { key: 'can_view',           label: 'VIEW'    },
  { key: 'can_edit',           label: 'EDIT'    },
  { key: 'can_submit',         label: 'SUBMIT'  },
  { key: 'can_verify',         label: 'VERIFY'  },
  { key: 'can_approve',        label: 'APPROVE' },
  { key: 'can_clone',          label: 'CLONE'   },
  { key: 'can_export',         label: 'EXPORT'  },
  { key: 'can_attach',         label: 'ATTACH'  },
  { key: 'can_comment',        label: 'COMMENT' },
  { key: 'can_request_unlock', label: 'UNLOCK'  },
  { key: 'can_deactivate',     label: 'DEACT', tooltip: 'Deactivate' },
]

const NotebookPermissionsPage: React.FC = () => {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id: string }>()

  const [notebookCode, setNotebookCode] = useState('')
  const [createdBy, setCreatedBy]       = useState('')
  const [perms, setPerms]               = useState<PermissionResponse[]>([])
  const [loading, setLoading]           = useState(false)
  const [savingId, setSavingId]         = useState<string | null>(null)

  const loadPerms = useCallback(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getNotebook(id),
      getNotebookPermissions(id),
      getUsers({ page_size: 200, is_active: true }).catch(() => ({ items: [] as Awaited<ReturnType<typeof getUsers>>['items'] })),
    ])
      .then(([nb, permList, usersResp]) => {
        setNotebookCode(nb.code)
        setCreatedBy(nb.created_by)
        const roleByUserId = new Map(usersResp.items.map(u => [u.id, u.role]))
        setPerms(permList.map(p => ({
          ...p,
          user: p.user
            ? { ...p.user, role: p.user.role ?? roleByUserId.get(p.user.id) ?? null }
            : p.user,
        })))
      })
      .catch(() => message.error('Failed to load permissions'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { loadPerms() }, [loadPerms])

  // ── Inline checkbox change ─────────────────────────────────────────────────
  const handleFlagChange = async (userId: string, flag: PermFlag, value: boolean) => {
    if (!id) return
    setSavingId(userId)
    try {
      const updated = await updateNotebookPermission(id, userId, { [flag]: value })
      setPerms(prev => prev.map(p => p.user_id === userId ? updated : p))
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      setSavingId(null)
    }
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  const handleRevoke = async (userId: string) => {
    if (!id) return
    try {
      await revokeNotebookPermission(id, userId)
      message.success('Access revoked')
      setPerms(prev => prev.filter(p => p.user_id !== userId))
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to revoke')
    }
  }

  // ── Grant modal ────────────────────────────────────────────────────────────
  const [grantOpen, setGrantOpen]     = useState(false)
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantForm] = Form.useForm()
  const [userOptions, setUserOptions] = useState<{ value: string; label: string }[]>([])

  const openGrant = () => {
    grantForm.resetFields()
    const existingIds = new Set(perms.map(p => p.user_id))
    getUsers({ page_size: 100, is_active: true })
      .then(r => setUserOptions(r.items.filter(u => !existingIds.has(u.id)).map(u => ({
        value: u.id,
        label: `${u.display_name} (${u.username}) — ${u.role}`,
      }))))
      .catch(() => {})
    setGrantOpen(true)
  }

  const handleGrant = async (values: Record<string, unknown>) => {
    if (!id) return
    setGrantLoading(true)
    try {
      await grantNotebookPermission(id, {
        user_id:            values.user_id as string,
        can_view:           true,
        can_edit:           Boolean(values.can_edit),
        can_submit:         Boolean(values.can_submit),
        can_verify:         Boolean(values.can_verify),
        can_approve:        Boolean(values.can_approve),
        can_clone:          Boolean(values.can_clone),
        can_export:         Boolean(values.can_export),
        can_attach:         Boolean(values.can_attach),
        can_comment:        Boolean(values.can_comment),
        can_request_unlock: Boolean(values.can_request_unlock),
        can_deactivate:     Boolean(values.can_deactivate),
      })
      message.success('Access granted')
      setGrantOpen(false)
      loadPerms()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to grant access')
    } finally {
      setGrantLoading(false)
    }
  }

  const columns: ColumnsType<PermissionResponse> = [
    {
      title: 'User', key: 'user', width: 160,
      render: (_v, r) => <span className={styles.monoText}>{r.user?.display_name ?? r.user_id}</span>,
    },
    {
      title: 'Role', key: 'role', width: 120,
      render: (_v, r) => (
        <Tooltip title={r.user?.emp_no ? `Employee code: ${r.user.emp_no}` : undefined}>
          <div className={styles.roleCell}>
            <span className={styles.roleName}>{userRoleLabel(r.user?.role)}</span>
            {r.user?.emp_no && <span className={styles.roleCode}>{r.user.emp_no}</span>}
          </div>
        </Tooltip>
      ),
    },
    ...PERM_FLAGS.map(({ key: flag, label, tooltip }) => ({
      title: tooltip
        ? (
          <Tooltip title={tooltip}>
            <span className={styles.permColHeader}>{label}</span>
          </Tooltip>
        )
        : <span className={styles.permColHeader}>{label}</span>,
      dataIndex: flag,
      key: flag,
      width: 72,
      align: 'center' as const,
      render: (value: boolean, record: PermissionResponse) => {
        const isCreator = record.user_id === createdBy
        const isLocked = isCreator && flag === 'can_view'
        const isDisabled = isLocked || savingId === record.user_id

        if (isLocked) {
          return (
            <Tooltip title="Creator view access cannot be revoked">
              <span className={styles.permLock} aria-label="View access locked">
                <LockOutlined />
              </span>
            </Tooltip>
          )
        }

        return (
          <button
            type="button"
            className={`${styles.permToggle} ${value ? styles.permOn : styles.permOff}`}
            disabled={isDisabled}
            aria-label={`${label}: ${value ? 'enabled' : 'disabled'}`}
            onClick={() => handleFlagChange(record.user_id, flag, !value)}
          >
            {value ? <CheckOutlined /> : <MinusOutlined />}
          </button>
        )
      },
    })),
    {
      title: 'Actions', key: 'actions', width: 80,
      render: (_v, record) => {
        const isCreator = record.user_id === createdBy
        return (
          <Popconfirm
            title={`Revoke access for ${record.user?.display_name ?? record.user_id}?`}
            onConfirm={() => handleRevoke(record.user_id)}
            okText="Revoke" okButtonProps={{ danger: true }}
            disabled={isCreator}>
            <Button size="small" danger icon={<DeleteOutlined />}
              disabled={isCreator} className={styles.deleteBtn} />
          </Popconfirm>
        )
      },
    },
  ]

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
              { title: <span className={styles.breadcrumbLink} onClick={() => navigate(`/notebooks/${id}/overview`)}>{notebookCode || id}</span> },
              { title: 'Permissions' },
            ]} />
            <Button
              type="primary"
              icon={<Plus size={18} strokeWidth={2.5} aria-hidden />}
              className={sharedStyles.primaryActionBtn}
              onClick={openGrant}
            >
              Add User
            </Button>
          </div>

          {/* Tab nav */}
          <div className={styles.tabNav}>
            <button className={styles.tabBtn} onClick={() => navigate(`/notebooks/${id}/overview`)}>Overview</button>
            <button className={`${styles.tabBtn} ${styles.tabBtnActive}`}>Permissions</button>
          </div>

          {/* Info Banner */}
          <div className={styles.infoBanner}>
            <InfoCircleOutlined className={styles.bannerIcon} />
            <span>Changes take effect immediately. The notebook creator's view access cannot be revoked.</span>
          </div>

          {/* Permissions Table */}
          {loading
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spin /></div>
            : (
              <div className={styles.tableCard}>
                <div className={styles.tableCardHeader}>
                  <span className={styles.tableCardTitle}>User Permissions</span>
                  <span className={styles.countBadge}>
                    {perms.length} user{perms.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <Table<PermissionResponse>
                  columns={columns}
                  dataSource={perms.map(p => ({ ...p, key: p.id }))}
                  pagination={false}
                  rowClassName={record =>
                    record.user_id === createdBy
                      ? `${styles.tableRow} ${styles.currentUserRow}`
                      : styles.tableRow}
                  scroll={{ x: 'max-content' }}
                />
              </div>
            )
          }
        </main>
      </div>

      {/* Grant Access Modal */}
      <Modal title="Grant Notebook Access" open={grantOpen}
        onCancel={() => setGrantOpen(false)}
        onOk={() => grantForm.submit()} okText="Grant Access" confirmLoading={grantLoading}
        className={styles.grantModal}
        width={500} destroyOnClose>
        <Form form={grantForm} layout="vertical" onFinish={handleGrant} requiredMark={false} style={{ marginTop: 12 }}>
          <Form.Item name="user_id" label="User" rules={[{ required: true }]}>
            <Select options={userOptions} placeholder="Select user" showSearch
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <p style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>
            View access is always granted. Enable additional permissions below:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px' }}>
            {PERM_FLAGS.filter(f => f.key !== 'can_view').map(({ key, label }) => (
              <Form.Item key={key} name={key} valuePropName="checked" initialValue={false}
                style={{ marginBottom: 0 }}>
                <Switch size="small" checkedChildren={label} unCheckedChildren={label} />
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  )
}

export default NotebookPermissionsPage
