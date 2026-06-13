import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Modal, Form, Badge,
  InputNumber, Popconfirm, message, Select, Space, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import type { ManufacturerMapping, Material, Manufacturer } from '../types'
import {
  getMappings, createMapping, updateMapping, deleteMapping,
  getMaterials, getManufacturers,
} from '@/api/inventoryApi'
import styles from './styles.module.less'

export default function MappingsView() {
  const [rows,     setRows]     = useState<ManufacturerMapping[]>([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')

  const [materials,      setMaterials]      = useState<Material[]>([])
  const [manufacturers,  setManufacturers]  = useState<Manufacturer[]>([])
  const [matFilter,      setMatFilter]      = useState<number | undefined>()
  const [mfrFilter,      setMfrFilter]      = useState<number | undefined>()

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<ManufacturerMapping | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  // Load lookups once
  useEffect(() => {
    getMaterials({ is_active: true }).then(setMaterials).catch(() => {})
    getManufacturers({ is_active: true }).then(setManufacturers).catch(() => {})
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    getMappings({ material_id: matFilter, manufacturer_id: mfrFilter })
      .then(data => {
        const q = search.toLowerCase()
        setRows(q
          ? data.filter(r =>
              r.material_name?.toLowerCase().includes(q) ||
              r.manufacturer_name?.toLowerCase().includes(q) ||
              r.catalogue_no?.toLowerCase().includes(q)
            )
          : data
        )
      })
      .catch(() => message.error('Failed to load mappings'))
      .finally(() => setLoading(false))
  }, [search, matFilter, mfrFilter])

  useEffect(() => { load() }, [load])

  const handleClear = () => { setSearch(''); setMatFilter(undefined); setMfrFilter(undefined) }

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (row: ManufacturerMapping) => {
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
        const updated = await updateMapping(editTarget.id, values)
        setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, material_name: r.material_name, manufacturer_name: r.manufacturer_name } : r))
        message.success('Mapping updated')
      } else {
        await createMapping(values)
        message.success('Mapping created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMapping(id)
      setRows(prev => prev.filter(r => r.id !== id))
      message.success('Mapping deleted')
    } catch {
      message.error('Delete failed')
    }
  }

  const columns: ColumnsType<ManufacturerMapping> = [
    { title: 'Material',     dataIndex: 'material_name',     key: 'material_name',     render: v => <span className={styles.nameCell}>{v ?? '—'}</span> },
    { title: 'Mat. Code',    dataIndex: 'material_code',     key: 'material_code',     width: 100, render: v => <span className={styles.codeCell}>{v ?? '—'}</span> },
    { title: 'Manufacturer', dataIndex: 'manufacturer_name', key: 'manufacturer_name', render: v => v ?? '—' },
    { title: 'Catalogue No.',dataIndex: 'catalogue_no',      key: 'catalogue_no',      width: 130, render: v => v ?? '—' },
    { title: 'Grade',        dataIndex: 'technical_grade',   key: 'technical_grade',   width: 110, render: v => v ?? '—' },
    { title: 'Lead (days)',  dataIndex: 'lead_time_days',    key: 'lead_time_days',    width: 100, render: v => v ?? '—' },
    { title: 'Min. Order',   dataIndex: 'min_order_qty',     key: 'min_order_qty',     width: 100, render: v => v ?? '—' },
    { title: '', key: 'actions', width: 70, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Popconfirm title="Delete this mapping?" onConfirm={() => handleDelete(row.id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Material–Vendor Mappings
            <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search material, vendor, cat. no…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Material" allowClear style={{ width: 180 }}
              showSearch optionFilterProp="label" value={matFilter} onChange={setMatFilter}
              options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Manufacturer" allowClear style={{ width: 180 }}
              showSearch optionFilterProp="label" value={mfrFilter} onChange={setMfrFilter}
              options={manufacturers.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openAdd}>Add Mapping</Button>
        </div>
        <Table<ManufacturerMapping>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} mappings` }}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        title={editTarget ? 'Edit Mapping' : 'Add Material–Vendor Mapping'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={saving} width={560} destroyOnClose
        className={styles.inventoryModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="material_id" label="Material" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Select showSearch optionFilterProp="label" disabled={!!editTarget}
                options={materials.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Form.Item>
            <Form.Item name="manufacturer_id" label="Manufacturer" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Select showSearch optionFilterProp="label" disabled={!!editTarget}
                options={manufacturers.map(m => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Form.Item>
            <Form.Item name="catalogue_no" label="Catalogue No.">
              <Input />
            </Form.Item>
            <Form.Item name="technical_grade" label="Technical Grade">
              <Input placeholder="e.g. HPLC, ACS, GR" />
            </Form.Item>
            <Form.Item name="lead_time_days" label="Lead Time (days)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_order_qty" label="Min. Order Qty">
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
