import React, { useState, useEffect } from 'react'
import {
  Button, Input, Tag, Card, Typography, Breadcrumb, Form, Select,
  Spin, message, Modal, Popconfirm, Upload, Table, Tabs,
} from 'antd'
import {
  HomeOutlined, SaveOutlined, SendOutlined, CheckCircleOutlined,
  CloseCircleOutlined, UploadOutlined, DeleteOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'
import {
  getATR, updateATR, submitATR, assignATR, completeATR, cancelATR,
  uploadATRAttachment, deleteATRAttachment,
  getUsers,
  type ATRResponse,
  type ATRAttachmentResponse,
} from '@/utilities/chemiaApi'

const { Text, Title } = Typography
const { TextArea }    = Input
const { TabPane }     = Tabs

const TEST_TYPES = ['NMR', 'HPLC', 'MS', 'IR', 'GC-MS', 'XRD', 'UV-Vis', 'TGA', 'DSC']

// ─── Info row helper ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      borderBottom: '1px solid #f5f5f4', paddingBottom: 8,
    }}>
      <Text style={{ fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, textAlign: 'right', maxWidth: '60%' }}>{value ?? '—'}</Text>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

const ATRForm: React.FC = () => {
  const navigate = useNavigate()
  const { id }   = useParams<{ id: string }>()

  const [atr,           setAtr]           = useState<ATRResponse | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Editable draft fields (only when status === NEW)
  const [draftObjectives, setDraftObjectives] = useState('')
  const [draftTestType,   setDraftTestType]   = useState('')
  const [draftDueDate,    setDraftDueDate]     = useState('')

  // Sub-resources
  const [attachments,  setAttachments]  = useState<ATRAttachmentResponse[]>([])

  // Modals
  const [assignOpen,     setAssignOpen]     = useState(false)
  const [assignForm]                        = Form.useForm()
  const [assignLoading,  setAssignLoading]  = useState(false)
  const [userOptions, setUserOptions]       = useState<{ value: string; label: string }[]>([])

  const [completeOpen,    setCompleteOpen]    = useState(false)
  const [completeForm]                        = Form.useForm()
  const [completeLoading, setCompleteLoading] = useState(false)

  // ── Load ATR ───────────────────────────────────────────────────────────────
  const loadATR = () => {
    if (!id || id === 'new') { setLoading(false); return }
    setLoading(true)
    getATR(id)
      .then(a => {
        setAtr(a)
        setDraftObjectives(a.objectives ?? '')
        setDraftTestType(a.test_type ?? '')
        setDraftDueDate(a.due_date ?? '')
        setAttachments(a.attachments ?? [])
      })
      .catch(() => message.error('Failed to load ATR'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadATR() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save editable fields (NEW only) ───────────────────────────────────────
  const handleSave = async () => {
    if (!id || !atr) return
    setSaving(true)
    try {
      const updated = await updateATR(id, {
        test_type:  draftTestType  || undefined,
        objectives: draftObjectives || undefined,
        due_date:   draftDueDate   || undefined,
      })
      setAtr(updated)
      message.success('ATR saved')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // ── Submit (NEW → SUBMITTED) ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!id) return
    setActionLoading('submit')
    try {
      const updated = await submitATR(id)
      setAtr(updated)
      message.success('ATR submitted')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Assign (SUBMITTED → VERIFIED) ────────────────────────────────────────
  const openAssign = () => {
    assignForm.resetFields()
    getUsers({ page_size: 100, is_active: true })
      .then(r => setUserOptions(r.items.map(u => ({
        value: u.id,
        label: `${u.display_name} (${u.username})`,
      }))))
      .catch(() => {})
    setAssignOpen(true)
  }

  const handleAssign = async (values: { assigned_to: string; due_date?: string }) => {
    if (!id) return
    setAssignLoading(true)
    try {
      const updated = await assignATR(id, {
        assigned_to: values.assigned_to,
        due_date:    values.due_date || undefined,
      })
      setAtr(updated)
      message.success('ATR assigned')
      setAssignOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setAssignLoading(false)
    }
  }

  // ── Complete (VERIFIED → COMPLETED) ──────────────────────────────────────
  const handleComplete = async (values: { result: string; result_observations?: string }) => {
    if (!id) return
    setCompleteLoading(true)
    try {
      const updated = await completeATR(id, {
        result:              values.result,
        result_observations: values.result_observations || undefined,
      })
      setAtr(updated)
      message.success('ATR completed')
      setCompleteOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to complete')
    } finally {
      setCompleteLoading(false)
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!id) return
    setActionLoading('cancel')
    try {
      const updated = await cancelATR(id)
      setAtr(updated)
      message.success('ATR cancelled')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to cancel')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Attachments ───────────────────────────────────────────────────────────
  const uploadProps: UploadProps = {
    beforeUpload: async (file) => {
      try {
        const att = await uploadATRAttachment(id!, file)
        setAttachments(prev => [...prev, att])
        message.success(`${file.name} uploaded`)
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Upload failed')
      }
      return false
    },
    showUploadList: false,
  }

  const handleDeleteAttachment = async (attId: string) => {
    try {
      await deleteATRAttachment(id!, attId)
      setAttachments(prev => prev.filter(a => a.id !== attId))
      message.success('Deleted')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────
  const attachColumns: ColumnsType<ATRAttachmentResponse> = [
    { title: 'File Name', dataIndex: 'filename',    key: 'filename' },
    { title: 'Size',      dataIndex: 'file_size',   key: 'file_size', width: 90,
      render: (v: number | null) => v ? `${Math.round(v / 1024)} KB` : '—' },
    { title: 'Uploaded',  dataIndex: 'uploaded_at', key: 'uploaded_at', width: 100,
      render: (v: string) => v?.slice(0, 10) },
    {
      title: 'Actions', key: 'actions', width: 72,
      render: (_: unknown, record: ATRAttachmentResponse) => (
        <Popconfirm title="Delete this attachment?" onConfirm={() => handleDeleteAttachment(record.id)}
          okText="Delete" okButtonProps={{ danger: true }}>
          <Button size="small" icon={<DeleteOutlined />} danger type="text" />
        </Popconfirm>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className={styles.page}>
      <Header />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    </div>
  )

  if (!atr) return null

  const isNew    = atr.status === 'NEW'
  const canWrite = atr.status !== 'CANCELLED' && atr.status !== 'COMPLETED'

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="atr" />
        <main className={styles.main}>

          {/* Breadcrumb */}
          <div className={styles.breadcrumbRow}>
            <Breadcrumb items={[
              { title: <span className={styles.breadcrumbHome} onClick={() => navigate('/dashboard')}><HomeOutlined /> Home</span> },
              { title: <span className={styles.breadcrumbLink} onClick={() => navigate('/atr')}>ATR</span> },
              { title: atr.atr_no },
            ]} />
          </div>

          {/* Older-version banner — v2 */}
          {!atr.is_latest_version && (
            <div className={styles.olderVersionBanner}>
              <WarningOutlined style={{ color: '#b45309', flexShrink: 0 }} />
              <span>
                You are viewing an <strong>older version</strong> (v{atr.version}) of this ATR.
                <span
                  className={styles.olderVersionLink}
                  onClick={() => navigate('/atr')}
                >
                  Browse ATR list →
                </span>
              </span>
            </div>
          )}

          {/* Page header */}
          <div className={styles.pageHeader}>
            <div className={styles.pageHeaderLeft}>
              <Title level={4} className={styles.pageTitle}>ATR Form</Title>
              <StatusTag status={atr.status} />
              {/* v2: version badge */}
              <span className={styles.versionBadge}>v{atr.version}</span>
              {atr.is_latest_version && (
                <Tag className={styles.latestBadge}>Latest</Tag>
              )}
              <Text className={styles.atrNoText}>{atr.atr_no}</Text>
            </div>

            <div className={styles.pageHeaderRight}>
              {/* Save — NEW only */}
              {isNew && (
                <Button icon={<SaveOutlined />} className={styles.saveBtn} loading={saving} onClick={handleSave}>
                  Save
                </Button>
              )}

              {/* Submit (NEW → SUBMITTED) */}
              {isNew && (
                <Popconfirm title="Submit this ATR?" onConfirm={handleSubmit} okText="Submit">
                  <Button type="primary" icon={<SendOutlined />} className={styles.submitBtn}
                    loading={actionLoading === 'submit'}>
                    Submit
                  </Button>
                </Popconfirm>
              )}

              {/* Assign (SUBMITTED → VERIFIED) */}
              {atr.status === 'SUBMITTED' && (
                <Button icon={<CheckCircleOutlined />} onClick={openAssign}
                  style={{ borderColor: '#4a9290', color: '#4a9290' }}>
                  Assign to Analyst
                </Button>
              )}

              {/* Complete (VERIFIED → COMPLETED) */}
              {atr.status === 'VERIFIED' && (
                <Button icon={<CheckCircleOutlined />}
                  onClick={() => { completeForm.resetFields(); setCompleteOpen(true) }}
                  style={{ borderColor: '#047857', color: '#047857' }}>
                  Record Results &amp; Complete
                </Button>
              )}

              {/* Cancel */}
              {atr.status !== 'COMPLETED' && atr.status !== 'CANCELLED' && (
                <Popconfirm title="Cancel this ATR?" onConfirm={handleCancel} okText="Cancel ATR"
                  okButtonProps={{ danger: true }}>
                  <Button danger ghost icon={<CloseCircleOutlined />} loading={actionLoading === 'cancel'}>
                    Cancel
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>

          {/* Experiment context bar */}
          {atr.experiment_id && (
            <Card className={styles.experimentBar}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <div className={styles.expItem}>
                  <Text className={styles.expLabel}>Experiment</Text>
                  <Text className={styles.expValue} style={{ cursor: 'pointer', color: '#5aa3a1' }}
                    onClick={() => navigate(`/experiments/${atr.experiment_id}`)}>
                    {atr.experiment_id.slice(0, 8)}…
                  </Text>
                </div>
                <div className={styles.expDivider} />
                <div className={styles.expItem}>
                  <Text className={styles.expLabel}>Test Type</Text>
                  <Text className={styles.expValue}>{atr.test_type}</Text>
                </div>
                {atr.due_date && (
                  <>
                    <div className={styles.expDivider} />
                    <div className={styles.expItem}>
                      <Text className={styles.expLabel}>Due Date</Text>
                      <Text className={styles.expValue}>{atr.due_date}</Text>
                    </div>
                  </>
                )}
                {atr.assigned_to && (
                  <>
                    <div className={styles.expDivider} />
                    <div className={styles.expItem}>
                      <Text className={styles.expLabel}>Assigned To</Text>
                      <Text className={styles.expValue}>{atr.assigned_to}</Text>
                    </div>
                  </>
                )}
                {/* v2: submitted_to */}
                {atr.submitted_to && (
                  <>
                    <div className={styles.expDivider} />
                    <div className={styles.expItem}>
                      <Text className={styles.expLabel}>Submitted To</Text>
                      <Text className={styles.expValue}>{atr.submitted_to}</Text>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {/* ── Tabbed main content ─────────────────────────────────────────── */}
          <div className={styles.tabsCard}>
            <Tabs defaultActiveKey="details" size="small">

              {/* Tab 1: ATR Details */}
              <TabPane tab="Details" key="details">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>

                  {/* Form details */}
                  <Card className={styles.sectionCard}
                    title={<span className={styles.cardTitle}>ATR Details</span>}>
                    <Form layout="vertical">
                      <Form.Item label={<span className={styles.formLabel}>Test Type</span>}>
                        {isNew
                          ? (
                            <Select value={draftTestType} onChange={setDraftTestType} size="small">
                              {TEST_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                            </Select>
                          )
                          : <Text style={{ fontSize: '0.875rem', fontWeight: 600 }}>{atr.test_type}</Text>
                        }
                      </Form.Item>
                      <Form.Item label={<span className={styles.formLabel}>Objectives</span>}>
                        <TextArea
                          rows={5}
                          value={draftObjectives}
                          onChange={e => setDraftObjectives(e.target.value)}
                          disabled={!isNew}
                          className={styles.textarea}
                          placeholder="Describe the analysis objectives…"
                        />
                      </Form.Item>
                      <Form.Item label={<span className={styles.formLabel}>Due Date</span>} style={{ marginBottom: 0 }}>
                        {isNew
                          ? <Input type="date" value={draftDueDate} onChange={e => setDraftDueDate(e.target.value)}
                              size="small" style={{ width: 160 }} />
                          : <Text style={{ fontSize: '0.875rem' }}>{atr.due_date ?? '—'}</Text>
                        }
                      </Form.Item>
                    </Form>
                  </Card>

                  {/* Status & Meta info */}
                  <Card className={styles.sectionCard}
                    title={<span className={styles.cardTitle}>
                      {atr.status === 'COMPLETED' ? 'Results' : 'Status Info'}
                    </span>}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      <InfoRow label="Raised By"   value={atr.raised_by} />
                      <InfoRow label="Raised On"   value={atr.raised_at?.slice(0, 10)} />
                      {atr.submitted_to && (
                        <InfoRow label="Submitted To" value={atr.submitted_to} />
                      )}
                      {atr.submitted_at && (
                        <InfoRow label="Submitted At" value={atr.submitted_at.slice(0, 10)} />
                      )}
                      {atr.verified_by && (
                        <InfoRow label="Assigned By" value={atr.verified_by} />
                      )}
                      {atr.assigned_to && (
                        <InfoRow label="Assigned To" value={atr.assigned_to} />
                      )}
                      {atr.assigned_at && (
                        <InfoRow label="Assigned At" value={atr.assigned_at.slice(0, 10)} />
                      )}
                      {atr.completed_by && (
                        <InfoRow label="Completed By" value={atr.completed_by} />
                      )}
                      {atr.completed_at && (
                        <InfoRow label="Completed At" value={atr.completed_at.slice(0, 10)} />
                      )}
                      {/* Result section */}
                      {atr.result && (
                        <>
                          <InfoRow label="Result" value={atr.result} />
                          {atr.result_observations && (
                            <div>
                              <Text style={{ fontSize: 12, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                Observations
                              </Text>
                              <Text style={{ fontSize: 13 }}>{atr.result_observations}</Text>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              </TabPane>

              {/* Tab 2: Attachments */}
              <TabPane tab={`Attachments${attachments.length ? ` (${attachments.length})` : ''}`} key="attachments">
                {canWrite && (
                  <Upload {...uploadProps}>
                    <div style={{
                      border: '2px dashed #d6d3d1', borderRadius: 8, height: 80,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#a8a29e', marginBottom: 12, fontSize: 13,
                    }}>
                      <UploadOutlined style={{ marginRight: 6 }} />
                      Click to upload a file
                    </div>
                  </Upload>
                )}
                <Table<ATRAttachmentResponse>
                  columns={attachColumns}
                  dataSource={attachments.map(a => ({ ...a, key: a.id }))}
                  size="small" pagination={false}
                  locale={{ emptyText: 'No attachments yet.' }}
                  style={{ fontSize: 13 }}
                />
              </TabPane>

            </Tabs>
          </div>

        </main>
      </div>

      {/* ── Assign Modal ──────────────────────────────────────────────────── */}
      <Modal title="Assign ATR to Analyst" open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={() => assignForm.submit()} okText="Assign"
        confirmLoading={assignLoading} destroyOnClose width={420}>
        <Form form={assignForm} layout="vertical" onFinish={handleAssign} requiredMark={false}
          style={{ marginTop: 12 }}>
          <Form.Item name="assigned_to" label="Assign To" rules={[{ required: true }]}>
            <Select options={userOptions} showSearch placeholder="Select analyst"
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())} />
          </Form.Item>
          <Form.Item name="due_date" label="Due Date (optional)">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Complete Modal ────────────────────────────────────────────────── */}
      <Modal title="Record Results & Complete ATR" open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={() => completeForm.submit()} okText="Complete"
        okButtonProps={{ style: { background: '#047857', borderColor: '#047857' } }}
        confirmLoading={completeLoading} destroyOnClose width={480}>
        <Form form={completeForm} layout="vertical" onFinish={handleComplete} requiredMark={false}
          style={{ marginTop: 12 }}>
          <Form.Item name="result" label="Result / Conclusion" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Summarize the test result…" />
          </Form.Item>
          <Form.Item name="result_observations" label="Observations (optional)">
            <TextArea rows={3} placeholder="Detailed observations, instrument readings, etc." />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  )
}

export default ATRForm
