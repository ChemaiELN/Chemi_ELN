import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, message,
  Select, Space, Tooltip, Popconfirm,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined, CloseCircleOutlined, SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { BatchVerification, Batch } from '../types'
import {
  getBatchVerifications, createBatchVerification,
  approveBatchVerification, rejectBatchVerification,
  getBatches,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '../components/shared/StatusTag'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

export default function BatchVerificationsView() {
  const [rows,         setRows]         = useState<BatchVerification[]>([])
  const [loading,      setLoading]      = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [batchFilter,  setBatchFilter]  = useState<number | undefined>()
  const [search,       setSearch]       = useState('')

  const [batches, setBatches] = useState<Batch[]>([])

  // Create modal
  const [createOpen,  setCreateOpen]  = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm]                    = Form.useForm()

  // Decision modal (verify / reject)
  const [decisionOpen,   setDecisionOpen]   = useState(false)
  const [decisionTarget, setDecisionTarget] = useState<BatchVerification | null>(null)
  const [decisionAction, setDecisionAction] = useState<'verify' | 'reject'>('verify')
  const [decisionSaving, setDecisionSaving] = useState(false)
  const [decisionForm]                      = Form.useForm()

  useEffect(() => {
    getBatches({ is_active: true })
      .then(setBatches)
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getBatchVerifications({ status: statusFilter, batch_id: batchFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.request_no.toLowerCase().includes(q) ||
              r.batch_no?.toLowerCase().includes(q) ||
              r.material_name?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load batch verifications'))
      .finally(() => setLoading(false))
  }, [statusFilter, batchFilter, search])

  useEffect(() => { load() }, [load])

  // ── Create ───────────────────────────────────────────────────────────────────

  const openCreate = () => {
    createForm.resetFields()
    setCreateOpen(true)
  }

  const handleCreate = async () => {
    let v: Record<string, unknown>
    try { v = await createForm.validateFields() } catch { return }
    setCreateSaving(true)
    try {
      await createBatchVerification(v)
      message.success('Verification request submitted')
      setCreateOpen(false)
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create request')
    } finally {
      setCreateSaving(false)
    }
  }

  // ── Decision ─────────────────────────────────────────────────────────────────

  const openDecision = (row: BatchVerification, action: 'verify' | 'reject') => {
    setDecisionTarget(row)
    setDecisionAction(action)
    decisionForm.resetFields()
    setDecisionOpen(true)
  }

  const handleDecision = async () => {
    let v: Record<string, unknown>
    try { v = await decisionForm.validateFields() } catch { return }
    setDecisionSaving(true)
    try {
      const remarks = v.remarks as string | undefined
      const updated = decisionAction === 'verify'
        ? await approveBatchVerification(decisionTarget!.id, remarks)
        : await rejectBatchVerification(decisionTarget!.id, remarks)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(decisionAction === 'verify' ? 'Batch verified' : 'Batch verification rejected')
      setDecisionOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setDecisionSaving(false)
    }
  }

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: ColumnsType<BatchVerification> = [
    {
      title: 'Request No.', dataIndex: 'request_no', key: 'request_no', width: 150, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.codeCell} />,
    },
    {
      title: 'Batch', key: 'batch', width: 130, ellipsis: true,
      render: (_, r) => <EllipsisCell text={r.batch_no} className={styles.codeCell} />,
    },
    {
      title: 'Material', dataIndex: 'material_name', key: 'material_name', ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmName} />,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <StatusTag status={v} />,
    },
    {
      title: 'Requested By', key: 'requested', width: 180, ellipsis: true,
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
          text={r.verified_by
            ? [r.verified_by, r.verified_at ? dayjs(r.verified_at).format('DD MMM YYYY HH:mm') : null].filter(Boolean).join(' · ')
            : null}
          className={styles.batchSmCell}
        />
      ),
    },
    {
      title: 'Remarks', dataIndex: 'remarks', key: 'remarks', width: 180, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: '', key: 'actions', width: 90, align: 'right',
      render: (_, row) => row.status === 'PENDING' ? (
        <Space size={4}>
          <Tooltip title="Verify">
            <Button
              size="small" type="primary" icon={<CheckCircleOutlined />}
              style={{ background: '#059669', borderColor: '#059669' }}
              onClick={() => openDecision(row, 'verify')}
            />
          </Tooltip>
          <Tooltip title="Reject">
            <Button
              size="small" danger icon={<CloseCircleOutlined />}
              onClick={() => openDecision(row, 'reject')}
            />
          </Tooltip>
        </Space>
      ) : null,
    },
  ]

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Batch Verifications
            <InventoryCountBadge count={rows.length} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search request no., batch, material…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={statusFilter} onChange={setStatusFilter}
              options={['PENDING', 'VERIFIED', 'REJECTED'].map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Batch" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label" value={batchFilter} onChange={setBatchFilter}
              options={batches.map(b => ({ value: b.id, label: `${b.batch_no} — ${b.material_name ?? ''}` }))} />
          </div>
          <InventoryAddButton onClick={openCreate}>New Request</InventoryAddButton>
        </div>

        <Table<BatchVerification>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} requests` }}
          scroll={{ x: 960 }}
        />
      </div>

      <Modal
        title="New Batch Verification Request"
        open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={handleCreate} okText="Submit"
        confirmLoading={createSaving} width={480} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="batch_id" label="Batch" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={batches.map(b => ({ value: b.id, label: `${b.batch_no} — ${b.material_name ?? ''}` }))} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={decisionAction === 'verify' ? 'Verify Batch' : 'Reject Verification'}
        open={decisionOpen} onCancel={() => setDecisionOpen(false)}
        onOk={handleDecision}
        okText={decisionAction === 'verify' ? 'Verify' : 'Reject'}
        okButtonProps={decisionAction === 'reject' ? { danger: true } : { style: { background: '#059669', borderColor: '#059669' } }}
        confirmLoading={decisionSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        {decisionTarget && (
          <div className={styles.modalInfoBannerNeutral}>
            Request: <strong>{decisionTarget.request_no}</strong> · Batch: <strong>{decisionTarget.batch_no}</strong>
          </div>
        )}
        <Form form={decisionForm} layout="vertical" requiredMark={false}>
          <Form.Item
            name="remarks" label="Remarks"
            rules={decisionAction === 'reject' ? [{ required: true, message: 'Remarks required for rejection' }] : []}
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
