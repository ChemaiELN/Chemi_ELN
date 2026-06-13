import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, message, Badge,
  Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { InstrumentVerification, InstrumentCatalogue } from '../types'
import {
  getInstrumentVerifications, createInstrumentVerification,
  approveInstrumentVerification, rejectInstrumentVerification,
  getInstrumentCatalogue,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

export default function InstrumentVerificationsView() {
  const [rows,         setRows]         = useState<InstrumentVerification[]>([])
  const [loading,      setLoading]      = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [instrFilter,  setInstrFilter]  = useState<number | undefined>()
  const [search,       setSearch]       = useState('')

  const [instruments, setInstruments] = useState<InstrumentCatalogue[]>([])

  const [createOpen,   setCreateOpen]   = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm]                    = Form.useForm()

  const [decisionOpen,   setDecisionOpen]   = useState(false)
  const [decisionTarget, setDecisionTarget] = useState<InstrumentVerification | null>(null)
  const [decisionAction, setDecisionAction] = useState<'verify' | 'reject'>('verify')
  const [decisionSaving, setDecisionSaving] = useState(false)
  const [decisionForm]                      = Form.useForm()

  useEffect(() => {
    getInstrumentCatalogue({ is_active: true }).then(setInstruments).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getInstrumentVerifications({ status: statusFilter, instrument_id: instrFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.request_no.toLowerCase().includes(q) ||
              r.instrument_asset_id?.toLowerCase().includes(q) ||
              r.instrument_name?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load instrument verifications'))
      .finally(() => setLoading(false))
  }, [statusFilter, instrFilter, search])

  useEffect(() => { load() }, [load])

  const handleClear = () => {
    setSearch('')
    setInstrFilter(undefined)
    setStatusFilter(undefined)
  }

  const pendingCount = rows.filter(r => r.status === 'PENDING').length

  const handleCreate = async () => {
    let v: Record<string, unknown>
    try { v = await createForm.validateFields() } catch { return }
    setCreateSaving(true)
    try {
      await createInstrumentVerification(v)
      message.success('Verification request submitted')
      setCreateOpen(false); load()
    } catch (err) { message.error(err instanceof Error ? err.message : 'Failed') }
    finally { setCreateSaving(false) }
  }

  const openDecision = (row: InstrumentVerification, action: 'verify' | 'reject') => {
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
        ? await approveInstrumentVerification(decisionTarget!.id, remarks)
        : await rejectInstrumentVerification(decisionTarget!.id, remarks)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(decisionAction === 'verify' ? 'Instrument verified' : 'Verification rejected')
      setDecisionOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Action failed') }
    finally { setDecisionSaving(false) }
  }

  const columns: ColumnsType<InstrumentVerification> = [
    {
      title: 'Request No.', dataIndex: 'request_no', key: 'request_no', width: 150, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.codeCell} />,
    },
    {
      title: 'Instrument', key: 'instrument', width: 200, ellipsis: true,
      render: (_, r) => (
        <EllipsisCell
          text={r.instrument_name || r.instrument_asset_id
            ? [r.instrument_name, r.instrument_asset_id].filter(Boolean).join(' · ')
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
        <h2 className={styles.sectionTitle}>Instrument Verifications</h2>
        <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
        {pendingCount > 0 && (
          <Badge count={pendingCount} style={{ backgroundColor: '#d97706', color: '#fff', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
        )}
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search request no. or instrument…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Instrument" allowClear style={{ width: 200 }}
              showSearch optionFilterProp="label"
              value={instrFilter} onChange={setInstrFilter}
              options={instruments.map(i => ({ value: i.id, label: `${i.asset_id} — ${i.name}` }))} />
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
        <Table<InstrumentVerification>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} requests` }}
          scroll={{ x: 940 }}
        />
      </div>

      <Modal title="New Instrument Verification Request"
        open={createOpen} onCancel={() => setCreateOpen(false)}
        onOk={handleCreate} okText="Submit"
        confirmLoading={createSaving} width={440} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={createForm} layout="vertical" requiredMark={false}>
          <Form.Item name="instrument_id" label="Instrument" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label"
              options={instruments.map(i => ({ value: i.id, label: `${i.asset_id} — ${i.name}` }))}
            />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={decisionAction === 'verify' ? 'Verify Instrument' : 'Reject Verification'}
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
            <strong>{decisionTarget.request_no}</strong> · {decisionTarget.instrument_asset_id} — {decisionTarget.instrument_name}
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
