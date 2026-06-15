import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Modal, Form,
  Popconfirm, message, Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import type { Manufacturer } from '../types'
import { getManufacturers, createManufacturer, updateManufacturer, toggleManufacturer } from '@/api/inventoryApi'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

export default function ManufacturersView() {
  const [rows,         setRows]         = useState<Manufacturer[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<Manufacturer | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getManufacturers({ search: search || undefined, is_active: activeFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load manufacturers'))
      .finally(() => setLoading(false))
  }, [search, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: Manufacturer) => {
    setEditTarget(row)
    form.setFieldsValue({ ...row } as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    let values: Record<string, unknown>
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateManufacturer(editTarget.id, values)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Manufacturer updated')
      } else {
        await createManufacturer(values)
        message.success('Manufacturer created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (row: Manufacturer) => {
    try {
      const updated = await toggleManufacturer(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(`Manufacturer ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch {
      message.error('Toggle failed')
    }
  }

  const columns: ColumnsType<Manufacturer> = [
    { title: 'Code',    dataIndex: 'code',           key: 'code',           width: 100, render: v => <span className={styles.codeCell}>{v}</span> },
    { title: 'Name',    dataIndex: 'name',           key: 'name',           render: v => <span className={styles.nameCell}>{v}</span> },
    { title: 'Country', dataIndex: 'country',        key: 'country',        width: 110, render: v => v ?? '—' },
    { title: 'Contact', dataIndex: 'contact_person', key: 'contact_person', width: 140, render: v => v ?? '—' },
    { title: 'Email',   dataIndex: 'email',          key: 'email',          width: 190,
      render: v => v ? <a href={`mailto:${v}`} style={{ color: '#4a9290' }}>{v}</a> : <span className={styles.dimCell}>—</span> },
    { title: 'Phone',   dataIndex: 'phone',          key: 'phone',          width: 180, render: v => v ?? '—' },
    { title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 72, align: 'center',
      render: (v, row) => (
        <Popconfirm title={`${v ? 'Deactivate' : 'Activate'}?`} onConfirm={() => handleToggle(row)} okText="Yes">
          <Switch size="small" checked={v} />
        </Popconfirm>
      ),
    },
    { title: '', key: 'actions', width: 52, align: 'right',
      render: (_, row) => (
        <Tooltip title="Edit">
          <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Manufacturers
            <InventoryCountBadge count={rows.length} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search name, code or country…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={activeFilter} onChange={setActiveFilter}
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
          <InventoryAddButton onClick={openAdd}>Add Manufacturer</InventoryAddButton>
        </div>
        <Table<Manufacturer>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} manufacturers` }}
          scroll={{ x: 860 }}
        />
      </div>

      <Modal
        title={editTarget ? 'Edit Manufacturer' : 'Add Manufacturer'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={saving} width={600} destroyOnClose
        className={styles.inventoryModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input disabled={!!editTarget} placeholder="e.g. MFR-001" />
            </Form.Item>
            <Form.Item name="country" label="Country">
              <Input />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="contact_person" label="Contact Person">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="website" label="Website">
              <Input placeholder="https://…" />
            </Form.Item>
            <Form.Item name="address" label="Address" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
