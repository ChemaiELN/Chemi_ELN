import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Modal, Form,
  Popconfirm, message, Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import type { EquipmentType } from '../types'
import { getEquipmentTypes, createEquipmentType, updateEquipmentType, toggleEquipmentType } from '@/api/inventoryApi'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

export default function EquipmentTypesView() {
  const [rows,         setRows]         = useState<EquipmentType[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<EquipmentType | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getEquipmentTypes({ search: search || undefined, is_active: activeFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load equipment types'))
      .finally(() => setLoading(false))
  }, [search, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: EquipmentType) => {
    setEditTarget(row)
    form.setFieldsValue({ ...row } as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    let v: Record<string, unknown>
    try { v = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateEquipmentType(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Equipment type updated')
      } else {
        await createEquipmentType(v)
        message.success('Equipment type created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const handleToggle = async (row: EquipmentType) => {
    try {
      const updated = await toggleEquipmentType(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(`${updated.is_active ? 'Activated' : 'Deactivated'}`)
    } catch { message.error('Toggle failed') }
  }

  const columns: ColumnsType<EquipmentType> = [
    { title: 'Code',        dataIndex: 'code',        key: 'code',        width: 120, render: v => <span className={styles.codeCell}>{v}</span> },
    { title: 'Name',        dataIndex: 'name',        key: 'name',        render: v => <span className={styles.nameCell}>{v}</span> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: v => <span className={styles.dimCell}>{v ?? '—'}</span> },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 72, align: 'center',
      render: (v, row) => (
        <Popconfirm title={`${v ? 'Deactivate' : 'Activate'}?`} onConfirm={() => handleToggle(row)} okText="Yes">
          <Switch size="small" checked={v} />
        </Popconfirm>
      ),
    },
    {
      title: '', key: 'actions', width: 52, align: 'right',
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
            Equipment Types
            <InventoryCountBadge count={rows.length} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search code or name…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={activeFilter} onChange={setActiveFilter}
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
          <InventoryAddButton onClick={openAdd}>Add Type</InventoryAddButton>
        </div>
        <Table<EquipmentType> rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} types` }}
        />
      </div>

      <Modal title={editTarget ? 'Edit Equipment Type' : 'Add Equipment Type'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={saving} width={480} destroyOnClose
        className={styles.equipMasterModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}>
            <Input disabled={!!editTarget} placeholder="e.g. CENTRIFUGE" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch size="small" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
