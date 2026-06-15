import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Tag, Modal, Form,
  Popconfirm, message, Select, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, HomeOutlined, ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'
import {
  getInstruments, createInstrument, updateInstrument, deleteInstrument,
  type LookupInstrument, type LookupInstrumentUpdate,
} from '@/utilities/chemiaApi'

const PAGE_SIZE = 20

const MAINT_OPTIONS = ['OK', 'DUE', 'OVERDUE', 'UNDER_MAINTENANCE']
const CALIB_OPTIONS = ['OK', 'DUE', 'OVERDUE', 'EXPIRED']

const AdminInstrumentsPage: React.FC = () => {
  const navigate = useNavigate()

  const [rows,         setRows]         = useState<LookupInstrument[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<LookupInstrument | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [form]                          = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getInstruments({ search: search || undefined, is_active: filterActive, page, page_size: PAGE_SIZE })
      .then(r => { setRows(r.items); setTotal(r.total) })
      .catch(() => message.error('Failed to load instruments'))
      .finally(() => setLoading(false))
  }, [search, filterActive, page])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: LookupInstrument) => {
    setEditTarget(row)
    form.setFieldsValue(row as unknown as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let values: any
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateInstrument(editTarget.id, values as LookupInstrumentUpdate)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Instrument updated')
      } else {
        await createInstrument(values)
        message.success('Instrument created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteInstrument(id)
      message.success('Instrument deleted')
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const columns: ColumnsType<LookupInstrument> = [
    { title: 'Code', dataIndex: 'instrument_code', key: 'instrument_code', width: 140,
      render: v => <span style={{ fontWeight: 600, color: '#5aa3a1' }}>{v}</span> },
    { title: 'Type',  dataIndex: 'instrument_type', key: 'instrument_type', width: 130, render: v => v ?? '—' },
    { title: 'Name',  dataIndex: 'instrument_name', key: 'instrument_name' },
    { title: 'Maintenance', dataIndex: 'maintenance_status', key: 'maintenance_status', width: 130,
      render: v => v ? <StatusTag status={v} /> : '—' },
    { title: 'Calibration', dataIndex: 'calibration_status', key: 'calibration_status', width: 120,
      render: v => v ? <StatusTag status={v} /> : '—' },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => <StatusTag status={v ? 'ACTIVE' : 'INACTIVE'} label={v ? 'Yes' : 'No'} /> },
    { title: '', key: 'actions', width: 90, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this instrument?" onConfirm={() => handleDelete(row.id)}
            okText="Delete" okButtonProps={{ danger: true }}>
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
        <Sidebar activeKey="master-data" />
        <main className={styles.main}>

          <div className={styles.topBar}>
            <nav className={styles.breadcrumb}>
              <span className={styles.breadHome} onClick={() => navigate('/admin')}>
                <HomeOutlined /> Admin
              </span>
              <span className={styles.breadSep}>/</span>
              <span className={styles.breadCurrent}>Instruments</span>
            </nav>
            <Button className={styles.addBtn} icon={<PlusOutlined />} onClick={openAdd}>
              Add Instrument
            </Button>
          </div>

          <div className={styles.card}>
            <div className={styles.filterRow}>
              <Input
                className={styles.filterInput}
                placeholder="Search code or name…"
                prefix={<SearchOutlined style={{ color: '#a8a29e' }} />}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                allowClear
              />
              <Select
                className={styles.filterSelect}
                placeholder="Active filter"
                allowClear
                value={filterActive}
                onChange={v => { setFilterActive(v); setPage(1) }}
                options={[
                  { value: true,  label: 'Active only' },
                  { value: false, label: 'Inactive only' },
                ]}
              />
            </div>

            <Table<LookupInstrument>
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={rows}
              columns={columns}
              className={styles.table}
              pagination={{
                current: page, pageSize: PAGE_SIZE, total,
                size: 'small', showSizeChanger: false,
                onChange: p => setPage(p),
              }}
              scroll={{ x: 800 }}
            />
          </div>

          {/* Add / Edit Modal */}
          <Modal
            title={editTarget ? 'Edit Instrument' : 'Add Instrument'}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onOk={handleSave}
            okText={editTarget ? 'Update' : 'Create'}
            confirmLoading={saving}
            width={520}
            destroyOnClose
            className={styles.dataModal}
            style={{ top: 20 }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="instrument_code" label="Instrument Code"
                  rules={[{ required: true, message: 'Required' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="instrument_type" label="Type">
                  <Input placeholder="e.g. HPLC, Balance" />
                </Form.Item>
                <Form.Item name="instrument_name" label="Name" style={{ gridColumn: '1 / -1' }}>
                  <Input />
                </Form.Item>
                <Form.Item name="maintenance_status" label="Maintenance Status">
                  <Select allowClear placeholder="Select…">
                    {MAINT_OPTIONS.map(o => <Select.Option key={o} value={o}>{o}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="calibration_status" label="Calibration Status">
                  <Select allowClear placeholder="Select…">
                    {CALIB_OPTIONS.map(o => <Select.Option key={o} value={o}>{o}</Select.Option>)}
                  </Select>
                </Form.Item>
                <Form.Item name="is_active" label="Active" valuePropName="checked">
                  <Switch size="small" />
                </Form.Item>
              </div>
            </Form>
          </Modal>

        </main>
      </div>
    </div>
  )
}

export default AdminInstrumentsPage
