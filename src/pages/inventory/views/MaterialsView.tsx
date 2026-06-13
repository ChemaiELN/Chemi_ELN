import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Switch, Modal, Form, Badge,
  InputNumber, Popconfirm, message, Select, Space, Tooltip, Drawer,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  PlusOutlined, EditOutlined, SearchOutlined,
  InfoCircleOutlined, StopOutlined, CheckOutlined,
} from '@ant-design/icons'
import type { Material } from '../types'
import {
  getMaterials, createMaterial, updateMaterial, toggleMaterial,
} from '@/api/inventoryApi'
import StatusTag from '@/common/StatusTag'
import styles from './styles.module.less'

const MATERIAL_TYPES = [
  'CHEMICAL', 'REAGENT', 'REFERENCE_STANDARD', 'CONSUMABLE',
  'SOLVENT', 'BUFFER', 'MEDIA', 'COLUMN', 'OTHER',
]

export default function MaterialsView() {
  const [rows,    setRows]    = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<Material | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow,  setDetailRow]  = useState<Material | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getMaterials({ search: search || undefined, type: typeFilter, is_active: activeFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load materials'))
      .finally(() => setLoading(false))
  }, [search, typeFilter, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    form.resetFields()
    form.setFieldValue('is_active', true)
    setModalOpen(true)
  }

  const openEdit = (row: Material) => {
    setEditTarget(row)
    form.setFieldsValue({ ...row } as Record<string, unknown>)
    setModalOpen(true)
  }

  const openDetail = (row: Material) => { setDetailRow(row); setDetailOpen(true) }

  const handleSave = async () => {
    let values: Record<string, unknown>
    try { values = await form.validateFields() } catch { return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateMaterial(editTarget.id, values)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Material updated')
      } else {
        await createMaterial(values)
        message.success('Material created')
        load()
      }
      setModalOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => { setSearch(''); setTypeFilter(undefined); setActiveFilter(undefined) }

  const handleToggle = async (row: Material) => {
    try {
      const updated = await toggleMaterial(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(`Material ${updated.is_active ? 'activated' : 'deactivated'}`)
    } catch {
      message.error('Toggle failed')
    }
  }

  const columns: ColumnsType<Material> = [
    {
      title: 'Code', dataIndex: 'code', key: 'code', width: 110,
      render: v => <span className={styles.codeCell}>{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v, row) => (
        <button type="button" className={styles.nameLink} onClick={() => openDetail(row)}>
          {v}
        </button>
      ),
    },
    {
      title: 'Type', dataIndex: 'material_type', key: 'material_type', width: 140,
      render: v => <StatusTag status={v} variant="info" />,
    },
    {
      title: 'CAS No.',    dataIndex: 'cas_no',           key: 'cas_no',           width: 110, render: v => v ?? '—' },
    {
      title: 'Storage',   dataIndex: 'storage_condition', key: 'storage_condition', width: 120,
      render: v => <span className={styles.dimCell}>{v ?? '—'}</span>,
    },
    {
      title: 'Hazard',    dataIndex: 'hazard_class',     key: 'hazard_class',     width: 90,
      render: v => v ? <StatusTag status={v} variant="warning" /> : <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 72, align: 'center',
      render: (v, row) => (
        <Popconfirm
          title={`${v ? 'Deactivate' : 'Activate'} this material?`}
          onConfirm={() => handleToggle(row)}
          okText="Yes"
        >
          <Switch size="small" checked={v} />
        </Popconfirm>
      ),
    },
    {
      title: '', key: 'actions', width: 60, align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Details"><Button size="small" icon={<InfoCircleOutlined />} className={styles.viewBtn} onClick={() => openDetail(row)} /></Tooltip>
          <Tooltip title="Edit">   <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardTitle}>
            Materials
            <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
          </div>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search name, code or CAS…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Type" allowClear style={{ width: 160 }}
              value={typeFilter} onChange={setTypeFilter}
              options={MATERIAL_TYPES.map(t => ({ value: t, label: t }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={activeFilter} onChange={setActiveFilter}
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openAdd}>Add Material</Button>
        </div>
        <Table<Material>
          rowKey="id" size="small" loading={loading}
          dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} materials` }}
          scroll={{ x: 860 }}
        />
      </div>

      <Modal
        title={editTarget ? 'Edit Material' : 'Add Material'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Create'}
        confirmLoading={saving} width={640} destroyOnClose
        className={styles.inventoryModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="code" label="Code" rules={[{ required: true }]}>
              <Input disabled={!!editTarget} placeholder="e.g. MAT-001" />
            </Form.Item>
            <Form.Item name="material_type" label="Material Type" rules={[{ required: true }]}>
              <Select options={MATERIAL_TYPES.map(t => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="cas_no" label="CAS No.">
              <Input />
            </Form.Item>
            <Form.Item name="molecular_formula" label="Molecular Formula">
              <Input />
            </Form.Item>
            <Form.Item name="mol_weight" label="Mol. Weight (g/mol)">
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="storage_condition" label="Storage Condition">
              <Input placeholder="e.g. 2–8 °C" />
            </Form.Item>
            <Form.Item name="hazard_class" label="Hazard Class" style={{ gridColumn: '1 / -1' }}>
              <Input placeholder="e.g. Flammable, Corrosive" />
            </Form.Item>
            <Form.Item name="description" label="Description" style={{ gridColumn: '1 / -1' }}>
              <Input.TextArea rows={2} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={detailRow ? `${detailRow.code} — ${detailRow.name}` : 'Material Detail'}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={440}
      >
        {detailRow && (
          <>
            <div className={styles.drawerSection}>
              <h4>Basic Info</h4>
              <dl className={styles.kv}>
                <dt>Code</dt>          <dd><span className={styles.codeCell}>{detailRow.code}</span></dd>
                <dt>Type</dt>          <dd><StatusTag status={detailRow.material_type} variant="info" /></dd>
                <dt>CAS No.</dt>       <dd>{detailRow.cas_no ?? '—'}</dd>
                <dt>Formula</dt>       <dd>{detailRow.molecular_formula ?? '—'}</dd>
                <dt>Mol. Weight</dt>   <dd>{detailRow.mol_weight != null ? `${detailRow.mol_weight} g/mol` : '—'}</dd>
                <dt>Storage</dt>       <dd>{detailRow.storage_condition ?? '—'}</dd>
                <dt>Hazard</dt>        <dd>{detailRow.hazard_class ?? '—'}</dd>
                <dt>Status</dt>        <dd><StatusTag status={detailRow.is_active ? 'ACTIVE' : 'INACTIVE'} label={detailRow.is_active ? 'Active' : 'Inactive'} /></dd>
              </dl>
            </div>
            {detailRow.description && (
              <div className={styles.drawerSection}>
                <h4>Description</h4>
                <p style={{ fontSize: 13, color: '#44403c', margin: 0 }}>{detailRow.description}</p>
              </div>
            )}
            {detailRow.chemical_props && Object.values(detailRow.chemical_props).some(v => v != null) && (
              <div className={styles.drawerSection}>
                <h4>Chemical Properties</h4>
                <dl className={styles.kv}>
                  {detailRow.chemical_props.purity_pct   != null && <><dt>Purity</dt><dd>{detailRow.chemical_props.purity_pct}%</dd></>}
                  {detailRow.chemical_props.grade         && <><dt>Grade</dt><dd>{detailRow.chemical_props.grade}</dd></>}
                  {detailRow.chemical_props.appearance    && <><dt>Appearance</dt><dd>{detailRow.chemical_props.appearance}</dd></>}
                  {detailRow.chemical_props.density      != null && <><dt>Density</dt><dd>{detailRow.chemical_props.density}</dd></>}
                  {detailRow.chemical_props.boiling_pt   != null && <><dt>Boiling Pt</dt><dd>{detailRow.chemical_props.boiling_pt} °C</dd></>}
                  {detailRow.chemical_props.melting_pt   != null && <><dt>Melting Pt</dt><dd>{detailRow.chemical_props.melting_pt} °C</dd></>}
                  {detailRow.chemical_props.flash_pt     != null && <><dt>Flash Pt</dt><dd>{detailRow.chemical_props.flash_pt} °C</dd></>}
                  {detailRow.chemical_props.ph_range      && <><dt>pH Range</dt><dd>{detailRow.chemical_props.ph_range}</dd></>}
                </dl>
              </div>
            )}
            {detailRow.formulation_props && Object.values(detailRow.formulation_props).some(v => v != null) && (
              <div className={styles.drawerSection}>
                <h4>Formulation Properties</h4>
                <dl className={styles.kv}>
                  {detailRow.formulation_props.role          && <><dt>Role</dt><dd>{detailRow.formulation_props.role}</dd></>}
                  {detailRow.formulation_props.concentration != null && <><dt>Concentration</dt><dd>{detailRow.formulation_props.concentration} {detailRow.formulation_props.units}</dd></>}
                  {detailRow.formulation_props.function      && <><dt>Function</dt><dd>{detailRow.formulation_props.function}</dd></>}
                </dl>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button size="small" className={styles.newBtn} icon={<EditOutlined />}
                onClick={() => { setDetailOpen(false); openEdit(detailRow) }}>
                Edit
              </Button>
              <Popconfirm
                title={`${detailRow.is_active ? 'Deactivate' : 'Activate'} this material?`}
                onConfirm={() => { handleToggle(detailRow); setDetailOpen(false) }}
                okText="Yes"
              >
                <Button size="small" className={styles.newBtn}
                  icon={detailRow.is_active ? <StopOutlined /> : <CheckOutlined />}>
                  {detailRow.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </Popconfirm>
            </div>
          </>
        )}
      </Drawer>
    </div>
  )
}
