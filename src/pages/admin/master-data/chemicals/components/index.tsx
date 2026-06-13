import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Tag, Modal, Form,
  InputNumber, Popconfirm, message, Select, Space,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, HomeOutlined, ExperimentOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'
import {
  getChemicals, createChemical, updateChemical, deleteChemical,
  type LookupChemical, type LookupChemicalUpdate,
} from '@/utilities/chemiaApi'

interface ChemRow extends LookupChemical {}

const PAGE_SIZE = 20

const AdminChemicalsPage: React.FC = () => {
  const navigate = useNavigate()

  // ── Table state ───────────────────────────────────────────────
  const [rows,       setRows]       = useState<ChemRow[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  // ── Modal state ───────────────────────────────────────────────
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<ChemRow | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  // ── Load ──────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    getChemicals({ search: search || undefined, is_active: filterActive, page, page_size: PAGE_SIZE })
      .then(r => { setRows(r.items); setTotal(r.total) })
      .catch(() => message.error('Failed to load chemicals'))
      .finally(() => setLoading(false))
  }, [search, filterActive, page])

  useEffect(() => { load() }, [load])

  // ── Handlers ──────────────────────────────────────────────────
  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: ChemRow) => {
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
        const updated = await updateChemical(editTarget.id, values as LookupChemicalUpdate)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Chemical updated')
      } else {
        await createChemical(values)
        message.success('Chemical created')
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
      await deleteChemical(id)
      message.success('Chemical deleted')
      load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── Columns ───────────────────────────────────────────────────
  const columns: ColumnsType<ChemRow> = [
    { title: 'Chemical Name', dataIndex: 'chemical_name', key: 'chemical_name',
      render: v => <span style={{ fontWeight: 500, color: '#292524' }}>{v}</span> },
    { title: 'CAS No.',    dataIndex: 'cas_no',        key: 'cas_no',        width: 120, render: v => v ?? '—' },
    { title: 'Formula',    dataIndex: 'formula',       key: 'formula',       width: 100, render: v => v ?? '—' },
    { title: 'Mol. Wt',   dataIndex: 'mol_wt',        key: 'mol_wt',        width: 90,  render: v => v != null ? v : '—' },
    { title: 'Vendor',     dataIndex: 'vendor_name',   key: 'vendor_name',   width: 130, render: v => v ?? '—' },
    { title: 'Density',    dataIndex: 'density',       key: 'density',       width: 90,  render: v => v != null ? v : '—' },
    { title: 'Purity %',   dataIndex: 'purity_pct',    key: 'purity_pct',    width: 90,  render: v => v != null ? `${v}%` : '—' },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => <StatusTag status={v ? 'ACTIVE' : 'INACTIVE'} label={v ? 'Yes' : 'No'} /> },
    { title: '', key: 'actions', width: 90, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />}   onClick={() => openEdit(row)} />
          <Popconfirm title="Delete this chemical?" onConfirm={() => handleDelete(row.id)} okText="Delete" okButtonProps={{ danger: true }}>
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
              <span className={styles.breadCurrent}>Chemicals</span>
            </nav>
            <Button className={styles.addBtn} icon={<PlusOutlined />} onClick={openAdd}>
              Add Chemical
            </Button>
          </div>

          <div className={styles.card}>
            <div className={styles.filterRow}>
              <Input
                className={styles.filterInput}
                placeholder="Search name or CAS no…"
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

            <Table<ChemRow>
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
              scroll={{ x: 900 }}
            />
          </div>

          {/* Add / Edit Modal */}
          <Modal
            title={editTarget ? 'Edit Chemical' : 'Add Chemical'}
            open={modalOpen}
            onCancel={() => setModalOpen(false)}
            onOk={handleSave}
            okText={editTarget ? 'Update' : 'Create'}
            confirmLoading={saving}
            width={600}
            destroyOnClose
            className={styles.dataModal}
            style={{ top: 20 }}
          >
            <Form form={form} layout="vertical" requiredMark={false}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="chemical_name" label="Chemical Name"
                  rules={[{ required: true, message: 'Required' }]} style={{ gridColumn: '1 / -1' }}>
                  <Input />
                </Form.Item>
                <Form.Item name="cas_no" label="CAS No.">
                  <Input />
                </Form.Item>
                <Form.Item name="formula" label="Formula">
                  <Input />
                </Form.Item>
                <Form.Item name="mol_wt" label="Mol. Weight">
                  <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="vendor_name" label="Vendor Name">
                  <Input />
                </Form.Item>
                <Form.Item name="density" label="Density">
                  <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="purity_pct" label="Purity %">
                  <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
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

export default AdminChemicalsPage
