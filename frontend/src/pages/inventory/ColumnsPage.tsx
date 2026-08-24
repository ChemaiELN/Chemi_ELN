import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Select, Modal, Form, InputNumber, message, Space, Tooltip } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Search } from 'lucide-react'
import {
  columnCatalogueApi, columnTypeApi, manufacturerApi, uomApi,
  type ColumnCatalogue, type ColumnType, type Manufacturer, type UomUnit,
} from '../../api/inventory'
import { departmentApi, type Department } from '../../api/adc'
import { glassModalProps } from '../../utils/modalStyles'
import { useDepartmentFilterLock } from '../../hooks/useDepartmentFilterLock'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const COL_STATUS_COLOR: Record<string, string> = { ACTIVE: 'green', EXHAUSTED: 'red', RETIRED: 'default' }

// Each spec's unit dropdown is sourced from the UOM Master rather than being
// hardcoded — length-family specs share the "length" dimension (mm/cm/µm/Å),
// particle size uses its own dedicated "particle_size" dimension.
const SPEC_FIELDS: { key: string; label: string; dimensionKey: 'length' | 'particle_size' }[] = [
  { key: 'length', label: 'Length', dimensionKey: 'length' },
  { key: 'pore_size', label: 'Pore Size', dimensionKey: 'length' },
  { key: 'inner_diameter', label: 'Inner Diameter', dimensionKey: 'length' },
  { key: 'particle_size', label: 'Particle Size', dimensionKey: 'particle_size' },
  { key: 'film_thickness', label: 'Film Thickness', dimensionKey: 'length' },
  { key: 'outer_diameter', label: 'Outer Diameter', dimensionKey: 'length' },
]

export default function ColumnsPage() {
  const [items, setItems] = useState<ColumnCatalogue[]>([])
  const [colTypes, setColTypes] = useState<ColumnType[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [unitsByDimension, setUnitsByDimension] = useState<Record<string, UomUnit[]>>({})
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const { isLocked: deptFilterLocked, lockedDepartmentId } = useDepartmentFilterLock()
  useEffect(() => { if (lockedDepartmentId) setDeptFilter(lockedDepartmentId) }, [lockedDepartmentId])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ColumnCatalogue | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (deptFilter) params.department_id = deptFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await columnCatalogueApi.listPaged(params)
      setItems(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, statusFilter, deptFilter, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, statusFilter, deptFilter])
  useEffect(() => { columnTypeApi.list().then(setColTypes) }, [])
  useEffect(() => { manufacturerApi.list({ active_only: true }).then(setManufacturers) }, [])
  useEffect(() => { departmentApi.list().then(setDepartments).catch(() => setDepartments([])) }, [])
  useEffect(() => {
    const dimensionKeys = [...new Set(SPEC_FIELDS.map(f => f.dimensionKey))]
    Promise.all(dimensionKeys.map(key => uomApi.get(key)))
      .then(dims => setUnitsByDimension(Object.fromEntries(dims.map(d => [d.dimension_key, d.units.filter(u => u.is_active)]))))
      .catch(() => setUnitsByDimension({}))
  }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: ColumnCatalogue) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await columnCatalogueApi.update(editing.id, values)
        message.success('Column updated')
      } else {
        await columnCatalogueApi.create(values)
        message.success('Column created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<ColumnCatalogue> = [
    { title: 'Column ID', ellipsis: true, dataIndex: 'column_id', width: 140, sorter: true, render: v => <StatusTag color="cyan" className="text-[13px]">{v}</StatusTag> },
    { title: 'Name', ellipsis: true, dataIndex: 'name', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Manufacturer', ellipsis: true, dataIndex: 'manufacturer', width: 140, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Length', ellipsis: true, key: 'length', width: 120, render: (_, r) => r.length_value != null ? <span className="text-[13px] text-slate-800">{r.length_value} {r.length_unit}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Particle Size', ellipsis: true, key: 'particle_size', width: 120, render: (_, r) => r.particle_size_value != null ? <span className="text-[13px] text-slate-800">{r.particle_size_value} {r.particle_size_unit}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Pore Size', ellipsis: true, key: 'pore_size', width: 120, render: (_, r) => r.pore_size_value != null ? <span className="text-[13px] text-slate-800">{r.pore_size_value} {r.pore_size_unit}</span> : <span className="text-[13px] text-slate-800">NA</span> },
    { title: 'Max Inj.', ellipsis: true, dataIndex: 'max_injections', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Used', ellipsis: true, dataIndex: 'cumulative_injections', width: 140, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Remaining', ellipsis: true, dataIndex: 'injections_remaining', width: 140, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Department', ellipsis: true, dataIndex: 'department_id', width: 140, render: v => { const d = departments.find(x => x.id === v); return d ? <span className="text-[13px] text-slate-800">{d.name}</span> : <span className="text-[13px] text-slate-800">NA</span> } },
    { title: 'Status', ellipsis: true, dataIndex: 'status', width: 140, sorter: true, render: v => <StatusTag color={COL_STATUS_COLOR[v] ?? 'default'} className="text-[13px]">{v}</StatusTag> },
    { title: 'Actions', key: 'actions', width: 140, align: 'center', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip> },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search column ID / name…" style={{ width: 200 }} allowClear />
        <Select
          value={deptFilter ?? undefined}
          onChange={v => setDeptFilter(v ?? null)}
          options={departments.map(d => ({ value: d.id, label: d.name }))}
          placeholder="Filter by department"
          style={{ width: 200 }}
          allowClear={!deptFilterLocked}
          showSearch
          optionFilterProp="label"
          disabled={deptFilterLocked}
        />
        <Select placeholder="All Status" allowClear style={{ minWidth: 140 }} value={statusFilter} onChange={setStatusFilter} options={['ACTIVE', 'EXHAUSTED', 'RETIRED'].map(s => ({ value: s, label: s }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Column</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          tableLayout="fixed"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} columns`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<ColumnCatalogue>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal title={editing ? 'Edit Column' : 'New Column'} open={modalOpen} closable={false} onCancel={() => { setModalOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="column_id" label="Column ID" rules={[{ required: true }]}><Input /></Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="column_type_id" label="Column Type">
              <Select allowClear showSearch optionFilterProp="label" options={colTypes.map(t => ({ value: t.id, label: t.name }))} />
            </Form.Item>
            <Form.Item name="manufacturer" label="Manufacturer">
              <Select
                placeholder="Select manufacturer"
                allowClear
                showSearch
                optionFilterProp="label"
                options={manufacturers.map(m => ({ value: m.name, label: m.name }))}
              />
            </Form.Item>
            {SPEC_FIELDS.map(f => (
              <Form.Item key={f.key} label={f.label} className="!mb-2">
                <Space.Compact style={{ width: '100%' }}>
                  <Form.Item name={`${f.key}_value`} noStyle>
                    <InputNumber style={{ width: '65%' }} min={0} placeholder="Value" />
                  </Form.Item>
                  <Form.Item name={`${f.key}_unit`} noStyle>
                    <Select
                      style={{ width: '35%' }}
                      placeholder="Unit"
                      options={(unitsByDimension[f.dimensionKey] ?? []).map(u => ({ value: u.symbol, label: u.symbol }))}
                    />
                  </Form.Item>
                </Space.Compact>
              </Form.Item>
            ))}
            <Form.Item name="max_injections" label="Max Injections" initialValue={500}>
              <InputNumber style={{ width: '100%' }} min={1} />
            </Form.Item>
            <Form.Item name="department_id" label="Department">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select department"
              />
            </Form.Item>
            {editing && (
              <Form.Item name="status" label="Status">
                <Select options={['ACTIVE', 'EXHAUSTED', 'RETIRED'].map(s => ({ value: s, label: s }))} />
              </Form.Item>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
