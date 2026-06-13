import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, message, Badge,
  Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { EquipmentVerification, EquipmentCatalogue } from '../types'
import {
  getEquipmentVerifications, createEquipmentVerification,
  approveEquipmentVerification, rejectEquipmentVerification,
  getEquipmentCatalogue,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

export default function EquipmentVerificationsView() {
  const [rows,         setRows]         = useState<EquipmentVerification[]>([])
  const [loading,      setLoading]      = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [equipFilter,  setEquipFilter]  = useState<number | undefined>()
  const [search,       setSearch]       = useState('')

  const [equipment, setEquipment] = useState<EquipmentCatalogue[]>([])

  const [createOpen,   setCreateOpen]   = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm]                    = Form.useForm()

  const [decisionOpen,   setDecisionOpen]   = useState(false)
  const [decisionTarget, setDecisionTarget] = useState<EquipmentVerification | null>(null)
  const [decisionAction, setDecisionAction] = useState<'verify' | 'reject'>('verify')
  const [decisionSaving, setDecisionSaving] = useState(false)
  const [decisionForm]                      = Form.useForm()

  useEffect(() => {
    getEquipmentCatalogue({ is_active: true }).then(setEquipment).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getEquipmentVerifications({ status: statusFilter, equipment_id: equipFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.request_no.toLowerCase().includes(q) ||
              r.equipment_asset_id?.toLowerCase().includes(q) ||
              r.equipment_name?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load equipment verifications'))
      .finally(() => setLoading(false))
  }, [statusFilter, equipFilter, search])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    setSearch('')
    setEquipFilter(undefined)
    setStatusFilter(undefined)
  }

  const pendingCount = rows.filter(r => r.status === 'PENDING').length

  const handleCreate = async () => {
    let v: Record<string, unknown>
    try { v = await createForm.validateFields() } catch { return }
    setCreateSaving(true)
    try {
      await createEquipmentVerification(v)
      message.success('Verification request submitted')
      setCreateOpen(false); load()
    } catch (err) { message.error(err instanceof Error ? err.message : 'Failed') }
    finally { setCreateSaving(false) }
  }

  const openDecision = (row: EquipmentVerification, action: 'verify' | 'reject') => {
    setDecisionTarget(row); setDecisionAction(action)
    decisionForm.resetFields(); setDecisionOpen(true)
  }

  const handleDecision = async () => {
    let v: Record<string, unknown>
    try { v = await decisionForm.validateFields() } catch { return }
    const remarks = v.remarks as string | undefined
    setDecisionSaving(true)
    try {
      const updated = decisionAction === 'verify'
        ? await approveEquipmentVerification(decisionTarget!.id, remarks)
        : await rejectEquipmentVerification(decisionTarget!.id, remarks)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(decisionAction === 'verify' ? 'Equipment verified' : 'Verification rejected')
      setDecisionOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Action failed') }
    finally { setDecisionSaving(false) }
  }

  const columns: ColumnsType<EquipmentVerification> = [
    {
      title: 'Request No.', dataIndex: 'request_no', key: 'request_no', width: 150, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.codeCell} />,
    },
    {
      title: 'Equipment', key: 'equipment', width: 200, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.equipment_name || r.equipment_asset_id
            ? [r.equipment_name, r.equipment_asset_id].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmName}
        />
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Requested By', key: 'requested', width: 190, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.requested_by || r.requested_at
            ? [r.requested_by, r.requested_at ? dayjs(r.requested_at).format('DD MMM YYYY HH:mm') : null].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmCell}
        />
      ),
    },
    {
      title: 'Verified / Rejected By', key: 'verified', width: 200, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.verified_by || r.verified_at
            ? [r.verified_by, r.verified_at ? dayjs(r.verified_at).format('DD MMM YYYY HH:mm') : null].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmCell}
        />
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Actions', key: 'actions', width: 90, align: 'right',
      render: (_, row) => row.status === 'PENDING' ? (
        <Space size={3}>
          <Tooltip title="Verify">
            <Button size="small" icon={<CheckCircleOutlined />} className={styles.viewBtnSuccess}
              onClick={() => openDecision(row, 'verify')}
            />
          </Tooltip>
          <Tooltip title="Reject">
            <Button size="small" icon={<CloseCircleOutlined />} className={styles.viewBtnDanger}
              onClick={() => openDecision(row, 'reject')}
            />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Equipment Verifications</h2>
        <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
        {pendingCount > 0 && (
          <Badge count={pendingCount} style={{ backgroundColor: '#d97706', color: '#fff', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
        )}
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search request no. or equipment…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Equipment" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label"
              value={equipFilter} onChange={setEquipFilter}
              options={equipment.map(e => ({ value: e.id, label: `${e.asset_id} — ${e.name}` }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['PENDING', 'VERIFIED', 'REJECTED'].map(s => ({ value: s, label: s }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn}
            onClick={() => { createForm.resetFields(); setCreateOpen(true) }}>
            New Request
          </Button>
        </div>
        <Table<EquipmentVerification>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} requests` }}
          scroll={{ x: 940 }}
        />
      </div>

      <Modal title="New Equipment Verification Request"
        open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={handleCreate} okText="Submit"
        confirmLoading={createSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="equipment_id" label="Equipment" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={equipment.map(e => ({ value: e.id, label: `${e.asset_id} — ${e.name}` }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={decisionAction === 'verify' ? 'Verify Equipment' : 'Reject Verification'}
        open={decisionOpen} onCancel={() => setDecisionOpen(false)}
        onOk={handleDecision}
        okText={decisionAction === 'verify' ? 'Verify' : 'Reject'}
        okButtonProps={
          decisionAction === 'reject'
            ? { danger: true }
            : { style: { background: '#059669', borderColor: '#059669' } }
        }
        confirmLoading={decisionSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {decisionTarget && (
          <div className={styles.modalInfoBannerNeutral}>
            <strong>{decisionTarget.request_no}</strong> · {decisionTarget.equipment_asset_id} — {decisionTarget.equipment_name}
          </div>
        )}
        <Form form={decisionForm} layout="vertical" requiredMark={false}>
          <Form.Item name="remarks" label="Remarks"
            rules={decisionAction === 'reject' ? [{ required: true, message: 'Required for rejection' }] : []}
          >
            <Input.TextArea rows={2}
              placeholder={decisionAction === 'reject' ? 'Reason for rejection (required)…' : 'Optional notes…'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
