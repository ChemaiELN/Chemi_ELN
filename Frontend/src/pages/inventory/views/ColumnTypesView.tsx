import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Modal, Form, InputNumber,
  Popconfirm, message, Select, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnType } from '../types'
import { getColumnTypes, createColumnType, updateColumnType, toggleColumnType } from '@/api/inventoryApi'
import { InventoryCountBadge, InventoryAddButton } from '../components/shared/InventoryListChrome'
import styles from './styles.module.less'

export default function ColumnTypesView() {
  const [rows,         setRows]         = useState<ColumnType[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<ColumnType | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const load = useCallback(() => {
    setLoading(true)
    getColumnTypes({ search: search || undefined, is_active: activeFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load column types'))
      .finally(() => setLoading(false))
  }, [search, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null); form.resetFields()
    form.setFieldValue('is_active', true); setModalOpen(true)
  }

  const openEdit = (row: ColumnType) => {
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
        const updated = await updateColumnType(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Column type updated')
      } else {
        await createColumnType(v); message.success('Column type created'); load()
      }
      setModalOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleToggle = async (row: ColumnType) => {
    try {
      const updated = await toggleColumnType(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(updated.is_active ? 'Activated' : 'Deactivated')
    } catch { message.error('Toggle failed') }
  }

  const columns: ColumnsType<ColumnType> = [
    { title: 'Code',           dataIndex: 'code',              key: 'code',              width: 120, render: v => <span className={styles.codeCell}>{v}</span> },
    { title: 'Name',           dataIndex: 'name',              key: 'name',              render: v => <span className={styles.nameCell}>{v}</span> },
    {
      title: 'Description', dataIndex: 'description', key: 'description', width: 180, ellipsis: true,
      render: (v: string | null) => {
        if (!v) return <span className={styles.dimCell}>—</span>
        return (
          <Typography.Text ellipsis={{ tooltip: v }} className={styles.dimCell}>
            {v}
          </Typography.Text>
        )
      },
    },
    { title: 'Length (mm)',    dataIndex: 'length_mm',         key: 'length_mm',         width: 110, align: 'right', render: v => v ?? '—' },
    { title: 'Particle (µm)', dataIndex: 'particle_size_um',  key: 'particle_size_um',  width: 115, align: 'right', render: v => v ?? '—' },
    { title: 'Pore (Å)',      dataIndex: 'pore_size_angstrom',key: 'pore_size_angstrom', width: 90,  align: 'right', render: v => v ?? '—' },
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
            Column Types
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
        <Table<ColumnType> rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} types` }}
          scroll={{ x: 780 }}
        />
      </div>
      <Modal title={editTarget ? 'Edit Column Type' : 'Add Column Type'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={saving} width={540} destroyOnClose
        className={styles.equipMasterModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input disabled={!!editTarget} placeholder="e.g. C18-150" />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Description" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="length_mm" label="Length (mm)">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="particle_size_um" label="Particle Size (µm)">
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="pore_size_angstrom" label="Pore Size (Å)">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
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
