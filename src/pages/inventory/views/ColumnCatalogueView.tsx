import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Tag, Switch, Modal, Form, InputNumber, DatePicker, Badge,
  Popconfirm, message, Select, Space, Tooltip, Drawer, Progress,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, EditOutlined, SearchOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnCatalogue, ColumnType } from '../types'
import {
  getColumnCatalogue, createColumn, updateColumn, toggleColumn,
  getColumnTypes,
} from '@/api/inventoryApi'
import EllipsisCell from '../components/shared/EllipsisCell'
import styles from './styles.module.less'

const COL_STATUSES = ['ACTIVE', 'INACTIVE', 'EXHAUSTED']

function injectionPercent(row: ColumnCatalogue): number | null {
  if (!row.max_injections || row.max_injections === 0) return null
  return Math.min(100, Math.round((row.cumulative_injections / row.max_injections) * 100))
}

export default function ColumnCatalogueView() {
  const [rows,         setRows]         = useState<ColumnCatalogue[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [typeFilter,   setTypeFilter]   = useState<number | undefined>()
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>()

  const [types, setTypes] = useState<ColumnType[]>([])

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editTarget, setEditTarget] = useState<ColumnCatalogue | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [form]                      = Form.useForm()

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow,  setDetailRow]  = useState<ColumnCatalogue | null>(null)

  useEffect(() => { getColumnTypes({ is_active: true }).then(setTypes).catch(() => {}) }, [])

  const load = useCallback(() => {
    setLoading(true)
    getColumnCatalogue({ search: search || undefined, status: statusFilter, column_type_id: typeFilter, is_active: activeFilter })
      .then(setRows)
      .catch(() => message.error('Failed to load column catalogue'))
      .finally(() => setLoading(false))
  }, [search, statusFilter, typeFilter, activeFilter])

  useEffect(() => { load() }, [load])

  const openAdd = () => {
    setEditTarget(null); form.resetFields()
    form.setFieldsValue({ status: 'ACTIVE', cumulative_injections: 0, is_active: true })
    setModalOpen(true)
  }

  const openEdit = (row: ColumnCatalogue) => {
    setEditTarget(row)
    form.setFieldsValue({
      ...row,
      purchased_date: row.purchased_date ? dayjs(row.purchased_date) : undefined,
    } as Record<string, unknown>)
    setModalOpen(true)
  }

  const handleSave = async () => {
    let v: Record<string, unknown>
    try { v = await form.validateFields() } catch { return }
    if (v.purchased_date) v.purchased_date = (v.purchased_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateColumn(editTarget.id, v)
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        message.success('Column updated')
      } else { await createColumn(v); message.success('Column added'); load() }
      setModalOpen(false)
    } catch (err) { message.error(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  const handleClear = () => {
    setSearch('')
    setTypeFilter(undefined)
    setStatusFilter(undefined)
    setActiveFilter(undefined)
  }

  const handleToggle = async (row: ColumnCatalogue) => {
    try {
      const updated = await toggleColumn(row.id)
      setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
      message.success(updated.is_active ? 'Activated' : 'Deactivated')
    } catch { message.error('Toggle failed') }
  }

  const openDetail = (row: ColumnCatalogue) => { setDetailRow(row); setDetailOpen(true) }

  const columns: ColumnsType<ColumnCatalogue> = [
    {
      title: 'Column ID', dataIndex: 'column_id', key: 'column_id', width: 120, ellipsis: true,
      render: (v, row) => (
        <button type="button" className={styles.ellipsisLink} onClick={() => openDetail(row)}>
          <EllipsisCell text={v} className={styles.codeCell} />
        </button>
      ),
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 160, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmName} />,
    },
    {
      title: 'Type', dataIndex: 'column_type_name', key: 'column_type_name', width: 130, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Manufacturer', dataIndex: 'manufacturer', key: 'manufacturer', width: 120, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Part No.', dataIndex: 'part_no', key: 'part_no', width: 110, ellipsis: true,
      render: v => <EllipsisCell text={v} className={styles.batchSmCell} />,
    },
    {
      title: 'Injections', key: 'inj', width: 180,
      render: (_, r) => {
        const pct = injectionPercent(r)
        const strokeColor = pct != null && pct >= 90 ? '#e11d48' : pct != null && pct >= 70 ? '#d97706' : '#0d9488'
        return (
          <div>
            <div style={{ fontSize: 12 }}>
              <strong>{r.cumulative_injections}</strong>
              {r.max_injections != null && <span className={styles.dimCell}> / {r.max_injections}</span>}
            </div>
            {pct != null && (
              <Progress percent={pct} size="small" showInfo={false} strokeColor={strokeColor} style={{ margin: 0 }} />
            )}
          </div>
        )
      },
    },
    {
      title: 'Remaining', dataIndex: 'injections_remaining', key: 'injections_remaining', width: 90, align: 'right',
      render: v => v != null ? <span style={{ fontWeight: 500 }}>{v}</span> : <span className={styles.dimCell}>—</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => <Tag color={v === 'EXHAUSTED' ? 'red' : v === 'INACTIVE' ? 'default' : 'green'} className={styles.statusTag}>{v}</Tag>,
    },
    {
      title: 'Active', dataIndex: 'is_active', key: 'is_active', width: 68, align: 'center',
      render: (v, row) => (
        <Popconfirm title={`${v ? 'Deactivate' : 'Activate'}?`} onConfirm={() => handleToggle(row)} okText="Yes">
          <Switch size="small" checked={v} />
        </Popconfirm>
      ),
    },
    {
      title: 'Actions', key: 'actions', width: 70, align: 'right',
      render: (_, row) => (
        <Space size={3}>
          <Tooltip title="Details">
            <Button size="small" icon={<InfoCircleOutlined />} className={styles.viewBtn} onClick={() => openDetail(row)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} className={styles.viewBtn} onClick={() => openEdit(row)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.masterPageTitle}>
        <h2 className={styles.sectionTitle}>Column Catalogue</h2>
        <Badge count={rows.length} style={{ backgroundColor: '#f5f5f4', color: '#57534e', boxShadow: 'none', fontWeight: 600, fontSize: 11 }} />
      </div>

      <div className={styles.masterCard}>
        <div className={styles.masterCardHeader}>
          <div className={styles.masterCardFilters}>
            <Input className={styles.filterInput} size="small" placeholder="Search column ID or name…"
              prefix={<SearchOutlined />} value={search} allowClear onChange={e => setSearch(e.target.value)} />
            <Select className={styles.filterSelect} size="small" placeholder="Type" allowClear style={{ width: 160 }}
              value={typeFilter} onChange={setTypeFilter}
              options={types.map(t => ({ value: t.id, label: t.name }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Status" allowClear style={{ width: 130 }}
              value={statusFilter} onChange={setStatusFilter}
              options={COL_STATUSES.map(s => ({ value: s, label: s }))} />
            <Select className={styles.filterSelect} size="small" placeholder="Active" allowClear style={{ width: 110 }}
              value={activeFilter} onChange={setActiveFilter}
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
            <Button size="small" className={styles.searchBtn} icon={<SearchOutlined />} onClick={load}>Search</Button>
            <Button size="small" className={styles.clearBtn} onClick={handleClear}>Clear</Button>
          </div>
          <Button icon={<PlusOutlined />} size="small" className={styles.newBtn} onClick={openAdd}>Add Column</Button>
        </div>
        <Table<ColumnCatalogue> rowKey="id" size="small" loading={loading} dataSource={rows} columns={columns}
          className={styles.masterTable}
          pagination={{ pageSize: 15, size: 'small', showSizeChanger: false, showTotal: t => `${t} columns` }}
          scroll={{ x: 1000 }}
        />
      </div>

      <Modal title={editTarget ? `Edit — ${editTarget.column_id}` : 'Add Column'}
        open={modalOpen} onCancel={() => setModalOpen(false)}
        onOk={handleSave} okText={editTarget ? 'Update' : 'Add'}
        confirmLoading={saving} width={600} destroyOnClose
        className={styles.batchesModal} style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="column_id" label="Column ID" rules={[{ required: true }]}>
              <Input disabled={!!editTarget} placeholder="e.g. COL-2024-001" />
            </Form.Item>
            <Form.Item name="column_type_id" label="Column Type">
              <Select allowClear showSearch optionFilterProp="label"
                options={types.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ gridColumn: '1 / -1' }}>
              <Input />
            </Form.Item>
            <Form.Item name="serial_no"      label="Serial No.">    <Input /></Form.Item>
            <Form.Item name="manufacturer"   label="Manufacturer">  <Input /></Form.Item>
            <Form.Item name="part_no"        label="Part No.">      <Input /></Form.Item>
            <Form.Item name="purchased_date" label="Purchase Date">
              <DatePicker format="DD-MMM-YYYY" />
            </Form.Item>
            <Form.Item name="max_injections" label="Max Injections">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cumulative_injections" label="Cumulative Injections">
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={COL_STATUSES.map(s => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer title={detailRow ? `${detailRow.column_id} — ${detailRow.name}` : 'Column Detail'}
        open={detailOpen} onClose={() => setDetailOpen(false)} width={420}
      >
        {detailRow && (() => {
          const pct = injectionPercent(detailRow)
          const strokeColor = pct != null && pct >= 90 ? '#e11d48' : pct != null && pct >= 70 ? '#d97706' : '#0d9488'
          return (
            <>
              <div className={styles.drawerSection}>
                <h4>Column Info</h4>
                <dl className={styles.kv}>
                  <dt>Column ID</dt>    <dd><span className={styles.codeCell}>{detailRow.column_id}</span></dd>
                  <dt>Type</dt>         <dd>{detailRow.column_type_name ?? '—'}</dd>
                  <dt>Serial No.</dt>   <dd>{detailRow.serial_no ?? '—'}</dd>
                  <dt>Manufacturer</dt> <dd>{detailRow.manufacturer ?? '—'}</dd>
                  <dt>Part No.</dt>     <dd>{detailRow.part_no ?? '—'}</dd>
                  <dt>Purchase Date</dt><dd>{detailRow.purchased_date ? dayjs(detailRow.purchased_date).format('DD MMM YYYY') : '—'}</dd>
                </dl>
              </div>
              <div className={styles.drawerSection}>
                <h4>Injection Usage</h4>
                <dl className={styles.kv}>
                  <dt>Cumulative</dt>  <dd>{detailRow.cumulative_injections}</dd>
                  <dt>Max</dt>         <dd>{detailRow.max_injections ?? 'Not set'}</dd>
                  <dt>Remaining</dt>   <dd>{detailRow.injections_remaining ?? '—'}</dd>
                </dl>
                {pct != null && (
                  <div style={{ marginTop: 8 }}>
                    <Progress percent={pct} strokeColor={strokeColor} size="small" />
                  </div>
                )}
              </div>
              <div className={styles.drawerSection}>
                <h4>Status</h4>
                <dl className={styles.kv}>
                  <dt>Status</dt> <dd>
                    <Tag color={detailRow.status === 'EXHAUSTED' ? 'red' : detailRow.status === 'INACTIVE' ? 'default' : 'green'} className={styles.statusTag}>
                      {detailRow.status}
                    </Tag>
                  </dd>
                  <dt>Active</dt> <dd><Tag color={detailRow.is_active ? 'success' : 'default'} className={styles.statusTag}>{detailRow.is_active ? 'Yes' : 'No'}</Tag></dd>
                </dl>
              </div>
              <Button size="small" icon={<EditOutlined />} className={styles.newBtn}
                onClick={() => { setDetailOpen(false); openEdit(detailRow) }}>
                Edit
              </Button>
            </>
          )
        })()}
      </Drawer>
    </div>
  )
}
