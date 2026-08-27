import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Table, Button, Input, Select, AutoComplete, Modal, Form, InputNumber,
  message, Space, Tooltip, Switch, Tabs, Popconfirm, Collapse, Pagination, Dropdown,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import BrandSpinner from '../../components/ui/BrandSpinner'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import { Plus, Pencil, Trash2, Search, FlaskConical, Microscope, MoreVertical } from 'lucide-react'
import {
  lookupApi, uomApi, testMasterApi, storageConditionApi, storageLocationApi, measurementMasterApi, sparePartApi,
  type Lookup, type UomDimension, type UomUnit,
  type TestType, type TestName, type StorageCondition, type StorageLocation, type LabRef, type MeasurementMaster, type SparePart,
} from '../../api/inventory'
import {
  adminApi,
  type LookupChemical, type LookupInstrument, type LabOut,
} from '../../api/admin'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { useServerTable } from '../../hooks/useServerTable'
import { useQueryClient, useMutation } from '@tanstack/react-query'

const STATUS_OPTIONS = [
  { value: 'OK', label: 'OK' }, { value: 'Due', label: 'Due' },
  { value: 'Overdue', label: 'Overdue' }, { value: 'NA', label: 'NA' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
const filterBar = 'glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center'
const tableWrap = 'glass-card rounded-lg overflow-hidden'

// Case-insensitive "any of these fields contains the query" test — powers the
// per-tab client-side search boxes below.

// Shared pagination — every master-data table gets a size changer on top of
// the default page size of 10.

// Client-side column sorters — used to make table columns sortable.
// Search, sort and pagination are resolved by the server for every table on
// this page (see useServerTable). They used to fetch the full table and narrow
// it in the browser, so search missed nothing only while the table was small,
// and column sorters reordered the visible page rather than the whole set.

// Runs a toggle/activate-deactivate API call, then surfaces the backend's own
// `message` field as the toast (falls back to a generic message if absent),
// and re-loads the table. Used by every Active-switch column on this page.
async function toggleWithToast<T extends { message?: string | null }>(
  call: () => Promise<T>,
  reload: () => void,
) {
  try {
    const res = await call()
    message.success(res.message ?? 'Updated.')
    reload()
  } catch (e: unknown) {
    message.error(e instanceof ApiError ? e.detail : 'Failed to update status.')
  }
}

// ── Chemicals tab ──────────────────────────────────────────────────────────────
function ChemicalsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupChemical | null>(null)

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listChemicalsPaged({ ...params, include_inactive: true }),
    [],
  )
  const { reload, searchInput, setSearchInput, tableProps } = useServerTable<LookupChemical>(fetcher)
  const inv = () => { qc.invalidateQueries({ queryKey: ['chemicals'] }); reload() }

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => editTarget ? adminApi.updateChemical(editTarget.id, v as Parameters<typeof adminApi.updateChemical>[1]) : adminApi.createChemical(v as Parameters<typeof adminApi.createChemical>[0]),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateChemical(id, { is_active }),
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteChemical,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openEdit = (r: LookupChemical) => { setEditTarget(r); form.setFieldsValue(r); setOpen(true) }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupChemical) => Modal.confirm({ title: `Delete "${r.chemical_name}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const columns: ColumnsType<LookupChemical> = [
    { title: 'Chemical Name', dataIndex: 'chemical_name', ellipsis: true, sorter: true, render: v => <span className="font-medium text-slate-800">{v}</span> },
    { title: 'CAS No.', dataIndex: 'cas_no', ellipsis: true, responsive: ['lg'], sorter: true, render: v => <span className="  text-xs text-slate-800">{v ?? 'NA'}</span> },
    { title: 'Formula', dataIndex: 'formula', ellipsis: true, responsive: ['md'], sorter: true, render: v => v ?? <span className="text-slate-800">NA</span> },
    { title: 'Mol. Wt', dataIndex: 'mol_wt', ellipsis: true, align: 'right', responsive: ['lg'], sorter: true, render: v => v != null ? <span className="text-slate-800">{Number(v).toFixed(2)}</span> : <span className="text-slate-800">NA</span> },
    { title: 'Purity%', dataIndex: 'purity_pct', ellipsis: true, align: 'right', responsive: ['lg'], sorter: true, render: v => v != null ? <span className="text-slate-800">{v}%</span> : <span className="text-slate-800">NA</span> },
    { title: 'Vendor', dataIndex: 'vendor_name', ellipsis: true, responsive: ['md'], sorter: true, render: v => v ?? <span className="text-slate-800">NA</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={c => toggle.mutate({ id: r.id, is_active: c })} /> },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70, render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') confirmDel(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name / CAS / formula…" style={{ width: 240 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Chemical</Button>
      </div>
      <div className={tableWrap}><Table {...tableProps} columns={columns} rowKey="id" size="small" tableLayout="fixed" /></div>
      <Modal open={open} closable={false} title={editTarget ? `Edit — ${editTarget.chemical_name}` : 'Add Chemical'} onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()} okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending} width={520} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          <Form.Item name="chemical_name" label="Chemical Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="cas_no" label="CAS No."><Input placeholder="e.g. 75-05-8" /></Form.Item>
            <Form.Item name="formula" label="Formula"><Input /></Form.Item>
            <Form.Item name="mol_wt" label="Mol. Wt (g/mol)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="purity_pct" label="Purity %"><InputNumber min={0} max={100} className="w-full" /></Form.Item>
            <Form.Item name="density" label="Density (g/mL)"><InputNumber min={0} className="w-full" /></Form.Item>
            <Form.Item name="vendor_name" label="Vendor"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ── Instruments (Admin lookup) tab ─────────────────────────────────────────────
function AdminInstrumentsTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LookupInstrument | null>(null)

  const fetcher = useCallback(
    (params: Record<string, unknown>) => adminApi.listInstrumentsPaged({ ...params, include_inactive: true }),
    [],
  )
  const { reload, searchInput, setSearchInput, tableProps } = useServerTable<LookupInstrument>(fetcher)
  const inv = () => { qc.invalidateQueries({ queryKey: ['lookup-instruments'] }); reload() }

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => editTarget ? adminApi.updateInstrument(editTarget.id, v as Parameters<typeof adminApi.updateInstrument>[1]) : adminApi.createInstrument(v as Parameters<typeof adminApi.createInstrument>[0]),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => adminApi.updateInstrument(id, { is_active }),
    onSuccess: () => inv(),
  })
  const del = useMutation({
    mutationFn: adminApi.deleteInstrument,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const statusColor = (v: string | null) => ({ OK: 'success', Due: 'warning', Overdue: 'error', NA: 'default' }[v ?? ''] ?? 'default')
  const openEdit = (r: LookupInstrument) => { setEditTarget(r); form.setFieldsValue(r); setOpen(true) }
  const openCreate = () => { setEditTarget(null); form.resetFields(); setOpen(true) }
  const confirmDel = (r: LookupInstrument) => Modal.confirm({ title: `Delete "${r.instrument_name}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const columns: ColumnsType<LookupInstrument> = [
    { title: 'Code', dataIndex: 'instrument_code', ellipsis: true, sorter: true, render: v => <StatusTag color="purple" className="  text-xs">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'instrument_name', ellipsis: true, sorter: true, render: v => <span className="font-medium text-slate-800">{v}</span> },
    { title: 'Type', dataIndex: 'instrument_type', ellipsis: true, responsive: ['md'], sorter: true, render: v => v ?? <span className="text-slate-800">NA</span> },
    { title: 'Maintenance', dataIndex: 'maintenance_status', ellipsis: true, responsive: ['lg'], sorter: true, render: v => v ? <StatusTag color={statusColor(v)}>{v}</StatusTag> : <span className="text-slate-800">NA</span> },
    { title: 'Calibration', dataIndex: 'calibration_status', ellipsis: true, responsive: ['lg'], sorter: true, render: v => v ? <StatusTag color={statusColor(v)}>{v}</StatusTag> : <span className="text-slate-800">NA</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={c => toggle.mutate({ id: r.id, is_active: c })} /> },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70, render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') confirmDel(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search code / name / type…" style={{ width: 240 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Instrument</Button>
      </div>
      <div className={tableWrap}><Table {...tableProps} columns={columns} rowKey="id" size="small" tableLayout="fixed" /></div>
      <Modal open={open} closable={false} title={editTarget ? `Edit — ${editTarget.instrument_name}` : 'Add Instrument'} onCancel={() => { setOpen(false); setEditTarget(null) }} onOk={() => form.submit()} okText={editTarget ? 'Save' : 'Create'} confirmLoading={save.isPending} width={480} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          {!editTarget && <Form.Item name="instrument_code" label="Code" rules={[{ required: true }]}><Input className="uppercase  " /></Form.Item>}
          <Form.Item name="instrument_name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="instrument_type" label="Type"><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item name="maintenance_status" label="Maintenance Status"><Select placeholder="Select" allowClear options={STATUS_OPTIONS} /></Form.Item>
            <Form.Item name="calibration_status" label="Calibration Status"><Select placeholder="Select" allowClear options={STATUS_OPTIONS} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Locations
// ─────────────────────────────────────────────────────────────────────────────
function StorageLocationsTab() {
  const [labs, setLabs] = useState<LabOut[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StorageLocation | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => storageLocationApi.listPaged(params),
    [],
  )
  // Lab names are matched by the route's subquery, so searching by lab still
  // works even though they live on a join table.
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<StorageLocation>(fetcher)
  useEffect(() => { adminApi.listLabsLookup().then(setLabs).catch(() => message.error('Failed to load labs.')) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: StorageLocation) => {
    setEditing(r)
    form.setFieldsValue({ name: r.name, description: r.description, lab_ids: r.labs.map(l => l.id) })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await storageLocationApi.update(editing.id, values); message.success('Updated') }
      else { await storageLocationApi.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await storageLocationApi.delete(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Failed to delete.') }
  }

  const columns: ColumnsType<StorageLocation> = [
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    {
      title: 'Labs', dataIndex: 'labs', ellipsis: true,
      render: (labs: LabRef[]) => labs.length
        ? <Space size={4} wrap>{labs.map(l => <StatusTag key={l.id} color="blue" className="text-[13px]">{l.name}</StatusTag>)}</Space>
        : <span className="text-[13px] text-slate-400">NA</span>,
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true, render: v => <span className="text-[13px] text-slate-800">{v ?? 'NA'}</span> },
    { title: 'Batches', dataIndex: 'batch_count', align: 'center', render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    {
      title: 'Active', dataIndex: 'is_active', align: 'center',
      render: (v, r) => <Switch size="small" checked={v} onChange={() => toggleWithToast(() => storageLocationApi.toggle(r.id), load)} />,
    },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') {
            Modal.confirm({
              title: 'Delete this storage location?',
              okText: 'Delete',
              okButtonProps: { danger: true },
              centered: true,
              styles: glassModalStyles,
              onOk: () => handleDelete(r.id),
            })
          }
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search name / lab…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Storage Location</Button>
      </div>
      <div className={tableWrap}>
        <Table {...tableProps} columns={columns} rowKey="id" size="middle" tableLayout="fixed" />
      </div>
      <Modal title={editing ? 'Edit Storage Location' : 'New Storage Location'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={420} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Storage Location Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="lab_ids" label="Labs" rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one lab' }]}>
            <Select
              mode="multiple"
              placeholder="Select labs"
              showSearch
              optionFilterProp="label"
              options={labs.map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// UOM Master
// ─────────────────────────────────────────────────────────────────────────────
function UomTab() {
  const [dimModal, setDimModal] = useState(false)
  const [unitModal, setUnitModal] = useState(false)
  const [selDim, setSelDim] = useState<UomDimension | null>(null)
  const [saving, setSaving] = useState(false)
  const [dimForm] = Form.useForm()
  const [unitForm] = Form.useForm()

  // Dimensions render as a Collapse rather than a Table, so the shared
  // tableProps supply the data and the pager is rendered by hand below.
  const fetcher = useCallback(
    (params: Record<string, unknown>) => uomApi.listPaged(params),
    [],
  )
  const { rows: dims, loading, reload: load, searchInput, setSearchInput, tableProps } =
    useServerTable<UomDimension>(fetcher)

  const handleDimSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try { await uomApi.create(values); message.success('Dimension created'); setDimModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleUnitSave = async (values: Record<string, unknown>) => {
    if (!selDim) return
    setSaving(true)
    try { await uomApi.createUnit(selDim.id, values); message.success('Unit added'); setUnitModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  // Nested per-dimension list: fully loaded with the parent row and rendered
  // with pagination={false}, so these sort in the browser by design.
  const unitColumns: ColumnsType<UomUnit> = [
    { title: 'Symbol', dataIndex: 'symbol', ellipsis: true, sorter: (a, b) => (a.symbol ?? '').localeCompare(b.symbol ?? ''), render: v => <StatusTag color="blue" className="  text-[13px]">{v}</StatusTag> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''), render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Sort', dataIndex: 'sort_order', ellipsis: true, align: 'center', sorter: (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0), render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggleWithToast(() => uomApi.toggleUnit(r.id), load)} /> },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search dimension…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { dimForm.resetFields(); setDimModal(true) }} className="rounded-md font-medium">New Dimension</Button>
      </div>
      <div className={tableWrap}>
        <Collapse
          ghost
          items={dims.map(d => ({
            key: d.id,
            label: (
              <div className="flex items-center gap-3">
                <StatusTag color="violet" className="  text-[13px]">{d.dimension_key}</StatusTag>
                <span className="text-[13px] text-slate-800 font-medium">{d.display_name}</span>
                <span className="text-[11px] text-slate-400 ml-1">base: {d.base_unit}</span>
                <span onClick={e => e.stopPropagation()} className="ml-auto"><Switch size="small" checked={d.is_active} onChange={() => toggleWithToast(() => uomApi.toggle(d.id), load)} /></span>
              </div>
            ),
            children: (
              <div className="pl-4">
                <div className="mb-2 flex justify-end">
                  <Button size="small" icon={<Plus size={12} />} onClick={() => { setSelDim(d); unitForm.resetFields(); setUnitModal(true) }}>Add Unit</Button>
                </div>
                <Table dataSource={d.units} columns={unitColumns} rowKey="id" size="small" pagination={false} tableLayout="fixed" />
              </div>
            ),
          }))}
        />
        <div className="flex justify-end px-4 py-3 border-t border-white/40">
          <Pagination {...tableProps.pagination} disabled={loading} onChange={(p, ps) => tableProps.onChange({ current: p, pageSize: ps }, null, [])} />
        </div>
      </div>
      <Modal title="New Dimension" open={dimModal} closable={false} onCancel={() => setDimModal(false)} onOk={() => dimForm.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={dimForm} layout="vertical" onFinish={handleDimSave}>
          <Form.Item name="dimension_key" label="Dimension Key" rules={[{ required: true }]}><Input className="uppercase  " /></Form.Item>
          <Form.Item name="display_name" label="Display Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="base_unit" label="Base Unit" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Unit to ${selDim?.display_name}`} open={unitModal} closable={false} onCancel={() => setUnitModal(false)} onOk={() => unitForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={unitForm} layout="vertical" onFinish={handleUnitSave}>
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true }]}><Input className=" " /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="sort_order" label="Sort Order" initialValue={0}><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Lookup Master
// ─────────────────────────────────────────────────────────────────────────────
function LookupTab() {
  const [types, setTypes] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lookup | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => lookupApi.listPaged(params),
    [],
  )
  const filters = useMemo(() => (typeFilter ? { lookup_type: typeFilter } : {}), [typeFilter])
  const { reload: load, searchInput, setSearchInput, tableProps } =
    useServerTable<Lookup>(fetcher, { filters })

  useEffect(() => { lookupApi.types().then(setTypes) }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (r: Lookup) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) { await lookupApi.update(editing.id, values); message.success('Updated') }
      else { await lookupApi.create(values); message.success('Created') }
      setModalOpen(false); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const columns: ColumnsType<Lookup> = [
    { title: 'Type', dataIndex: 'lookup_type', ellipsis: true, sorter: true, render: v => <StatusTag color="geekblue" className="text-[13px]">{v}</StatusTag> },
    { title: 'Value', dataIndex: 'lookup_value', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Code', dataIndex: 'lookup_code', ellipsis: true, sorter: true, render: v => <span className="  text-[13px] text-slate-800">{v}</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggleWithToast(() => lookupApi.toggle(r.id), load)} /> },
    {
      title: 'Actions', key: 'actions', align: 'center',
      render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} /></Tooltip>,
    },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search value / code…" style={{ width: 200 }} allowClear />
        <Select placeholder="All Types" allowClear style={{ minWidth: 180 }} value={typeFilter} onChange={setTypeFilter} options={types.map(t => ({ value: t, label: t }))} />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Lookup</Button>
      </div>
      <div className={tableWrap}>
        <Table
          {...tableProps}
          pagination={{ ...tableProps.pagination, showTotal: (t: number) => `${t} entries` }}
          columns={columns} rowKey="id" size="middle" tableLayout="fixed"
        />
      </div>
      <Modal title={editing ? 'Edit Lookup' : 'New Lookup'} open={modalOpen} closable={false} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={saving} width={400} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="lookup_type" label="Type" rules={[{ required: true, whitespace: true }]}>
            <AutoComplete
              options={types.map(t => ({ value: t }))}
              filterOption={(input, option) => (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              placeholder="Select existing or type a new type"
            />
          </Form.Item>
          <Form.Item name="lookup_value" label="Value" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="lookup_code" label="Code" rules={[{ required: true }]}><Input className=" " /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Test Master
// ─────────────────────────────────────────────────────────────────────────────
function TestMasterTab() {
  const [typeModal, setTypeModal] = useState(false)
  const [nameModal, setNameModal] = useState(false)
  const [methodModal, setMethodModal] = useState(false)
  const [selType, setSelType] = useState<TestType | null>(null)
  const [selName, setSelName] = useState<TestName | null>(null)
  const [saving, setSaving] = useState(false)
  const [typeForm] = Form.useForm()
  const [nameForm] = Form.useForm()
  const [methodForm] = Form.useForm()

  // Rendered as a Collapse, so the pager below is manual. The route matches a
  // type on its own key/name or on any of its nested test names, which is what
  // the old in-browser filter did.
  const fetcher = useCallback(
    (params: Record<string, unknown>) => testMasterApi.listPaged(params),
    [],
  )
  const { rows: types, loading, reload: load, searchInput, setSearchInput, tableProps } =
    useServerTable<TestType>(fetcher)

  const handleTypeSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try { await testMasterApi.create(values); message.success('Test type created'); setTypeModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleNameSave = async (values: Record<string, unknown>) => {
    if (!selType) return
    setSaving(true)
    try { await testMasterApi.createName(selType.type_key, values); message.success('Test name added'); setNameModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleMethodSave = async (values: Record<string, unknown>) => {
    if (!selName) return
    setSaving(true)
    try { await testMasterApi.createMethod(selName.id, values); message.success('Method added'); setMethodModal(false); load() }
    catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDeleteName = async (id: number) => {
    try { await testMasterApi.deleteName(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const handleDeleteMethod = async (id: number) => {
    try { await testMasterApi.deleteMethod(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search test type / name…" style={{ width: 240 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { typeForm.resetFields(); setTypeModal(true) }} className="rounded-md font-medium">New Test Type</Button>
      </div>
      <div className={tableWrap}>
        {loading ? <div className="p-8"><BrandSpinner fullScreen={false} label="Loading test types…" /></div> : (
          <Collapse ghost items={types.map(tt => ({
            key: tt.id,
            label: (
              <div className="flex items-center gap-3">
                <StatusTag color="cyan" className="  text-[13px]">{tt.type_key}</StatusTag>
                <span className="text-[13px] text-slate-800 font-medium">{tt.name}</span>
                <span onClick={e => e.stopPropagation()}><Switch size="small" checked={tt.is_active} onChange={() => toggleWithToast(() => testMasterApi.toggle(tt.type_key), load)} /></span>
                <Button size="small" icon={<Plus size={12} />} className="ml-auto" onClick={e => { e.stopPropagation(); setSelType(tt); nameForm.resetFields(); setNameModal(true) }}>Add Name</Button>
              </div>
            ),
            children: (
              <div className="pl-4 space-y-2">
                {tt.names.length === 0 && <p className="text-[12px] text-slate-400 italic">No test names yet.</p>}
                {tt.names.map(tn => (
                  <div key={tn.id} className="glass-card rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] text-slate-800 font-medium">{tn.name}</span>
                      <Switch size="small" checked={tn.is_active} onChange={() => toggleWithToast(() => testMasterApi.toggleName(tn.id), load)} />
                      <div className="ml-auto flex gap-1">
                        <Button size="small" icon={<Plus size={11} />} onClick={() => { setSelName(tn); methodForm.resetFields(); setMethodModal(true) }}>Method</Button>
                        <Popconfirm title="Delete this test name?" onConfirm={() => handleDeleteName(tn.id)}>
                          <Button type="text" size="small" danger icon={<Trash2 size={12} />} />
                        </Popconfirm>
                      </div>
                    </div>
                    {tn.methods.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tn.methods.map(m => (
                          <div key={m.id} className="flex items-center gap-1">
                            <StatusTag className="text-[12px]">{m.method_name}</StatusTag>
                            <Switch size="small" checked={m.is_active} onChange={() => toggleWithToast(() => testMasterApi.toggleMethod(m.id), load)} />
                            <Popconfirm title="Delete method?" onConfirm={() => handleDeleteMethod(m.id)}>
                              <button className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
                            </Popconfirm>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ),
          }))} />
        )}
        <div className="flex justify-end px-4 py-3 border-t border-white/40">
          <Pagination {...tableProps.pagination} disabled={loading} onChange={(p, ps) => tableProps.onChange({ current: p, pageSize: ps }, null, [])} />
        </div>
      </div>
      <Modal title="New Test Type" open={typeModal} closable={false} onCancel={() => setTypeModal(false)} onOk={() => typeForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={typeForm} layout="vertical" onFinish={handleTypeSave}>
          <Form.Item name="type_key" label="Type Key" rules={[{ required: true }]}><Input className="uppercase  " /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Test Name to "${selType?.name}"`} open={nameModal} closable={false} onCancel={() => setNameModal(false)} onOk={() => nameForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={nameForm} layout="vertical" onFinish={handleNameSave}>
          <Form.Item name="name" label="Test Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Add Method to "${selName?.name}"`} open={methodModal} closable={false} onCancel={() => setMethodModal(false)} onOk={() => methodForm.submit()} confirmLoading={saving} width={360} centered destroyOnHidden {...glassModalProps}>
        <Form form={methodForm} layout="vertical" onFinish={handleMethodSave}>
          <Form.Item name="method_name" label="Method Name" rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Storage Master
// ─────────────────────────────────────────────────────────────────────────────
function StorageMasterTab() {
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StorageCondition | null>(null)

  const fetcher = useCallback(
    (params: Record<string, unknown>) => storageConditionApi.listPaged(params),
    [],
  )
  const { reload, searchInput, setSearchInput, tableProps } = useServerTable<StorageCondition>(fetcher)
  const inv = () => { qc.invalidateQueries({ queryKey: ['storage-conditions'] }); reload() }

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) =>
      editTarget
        ? storageConditionApi.update(editTarget.id, v)
        : storageConditionApi.create(v),
    onSuccess: () => { inv(); setOpen(false); setEditTarget(null); form.resetFields(); msg.success(editTarget ? 'Updated.' : 'Created.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })
  const toggle = useMutation({
    mutationFn: storageConditionApi.toggle,
    onSuccess: (res) => { inv(); msg.success(res.message ?? 'Updated.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed to update status.'),
  })
  const del = useMutation({
    mutationFn: storageConditionApi.delete,
    onSuccess: () => { inv(); msg.success('Deleted.') },
    onError: (e) => msg.error(e instanceof ApiError ? e.detail : 'Failed.'),
  })

  const openCreate = () => { setEditTarget(null); form.resetFields(); form.setFieldsValue({ temperature_unit: '°C' }); setOpen(true) }
  const openEdit = (r: StorageCondition) => {
    setEditTarget(r)
    form.setFieldsValue({
      label: r.label,
      temperature_min: r.temperature_min,
      temperature_max: r.temperature_max,
      temperature_unit: r.temperature_unit,
      description: r.description,
    })
    setOpen(true)
  }
  const confirmDel = (r: StorageCondition) =>
    Modal.confirm({ title: `Delete "${r.label}"?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true, styles: glassModalStyles, onOk: () => del.mutate(r.id) })

  const tempDisplay = (r: StorageCondition) => {
    if (r.temperature_min == null && r.temperature_max == null) return <span className="text-slate-800">NA</span>
    if (r.temperature_min != null && r.temperature_max != null)
      return <span className="  text-[13px] text-slate-800">{r.temperature_min} to {r.temperature_max} {r.temperature_unit}</span>
    if (r.temperature_min != null)
      return <span className="  text-[13px] text-slate-800">≥ {r.temperature_min} {r.temperature_unit}</span>
    return <span className="  text-[13px] text-slate-800">≤ {r.temperature_max} {r.temperature_unit}</span>
  }

  const columns: ColumnsType<StorageCondition> = [
    { title: 'Label', dataIndex: 'label', ellipsis: true, sorter: true, render: v => <span className="font-medium text-slate-800 text-[13px]">{v}</span> },
    { title: 'Temperature Range', key: 'temp', ellipsis: true, sorter: true, render: (_, r) => tempDisplay(r) },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggle.mutate(r.id)} /> },
    {
      title: 'Actions', key: 'actions', align: 'center', width: 70,
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') confirmDel(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
  ]

  return (
    <div className="pt-3">
      {ctx}
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search label…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">New Storage Condition</Button>
      </div>
      <div className={tableWrap}>
        <Table {...tableProps} columns={columns} rowKey="id" size="middle" tableLayout="fixed" />
      </div>
      <Modal
        open={open}
        closable={false}
        title={editTarget ? `Edit — ${editTarget.label}` : 'New Storage Condition'}
        onCancel={() => { setOpen(false); setEditTarget(null) }}
        onOk={() => form.submit()}
        okText={editTarget ? 'Save' : 'Create'}
        confirmLoading={save.isPending}
        width={460}
        centered
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={v => save.mutate(v)}>
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input placeholder="e.g. Refrigerated, Deep Freeze, Room Temperature" />
          </Form.Item>
          <div className="grid grid-cols-3 gap-x-3">
            <Form.Item name="temperature_min" label="Min Temp">
              <InputNumber className="w-full" placeholder="-20" />
            </Form.Item>
            <Form.Item name="temperature_max" label="Max Temp">
              <InputNumber className="w-full" placeholder="8" />
            </Form.Item>
            <Form.Item name="temperature_unit" label="Unit" initialValue="°C">
              <Select options={[{ value: '°C', label: '°C' }, { value: '°F', label: '°F' }, { value: 'K', label: 'K' }]} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Measurement Master (instrument measurements)
// ─────────────────────────────────────────────────────────────────────────────
function MeasurementMasterTab() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MeasurementMaster | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => measurementMasterApi.listPaged(params),
    [],
  )
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<MeasurementMaster>(fetcher)

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await measurementMasterApi.update(editing.id, v)
      else await measurementMasterApi.create(v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const columns: ColumnsType<MeasurementMaster> = [
    { title: 'Sl No', key: 'sl', ellipsis: true, render: (_, __, i) => <span className="text-[13px] text-slate-800">{i + 1}</span> },
    { title: 'Measurement Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Data Type', dataIndex: 'data_type', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'UOM', dataIndex: 'uom', ellipsis: true, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-slate-800">NA</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggleWithToast(() => measurementMasterApi.toggle(r.id), load)} /> },
    { title: 'Actions', key: 'a', align: 'center', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip> },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search measurement…" style={{ width: 220 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add Measurement</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table {...tableProps} columns={columns} rowKey="id" size="small" tableLayout="fixed" />
      </div>
      <Modal title={editing ? 'Edit Measurement' : 'Add Measurement'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={440} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ data_type: 'DECIMAL' }}>
          <Form.Item name="name" label="Measurement Name" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="data_type" label="Data Type" rules={[{ required: true }]}>
              <Select options={[{ value: 'INTEGER', label: 'Integer' }, { value: 'DECIMAL', label: 'Decimal' }]} />
            </Form.Item>
            <Form.Item name="uom" label="UOM"><Input /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Spare Parts (breakdown maintenance)
// ─────────────────────────────────────────────────────────────────────────────
function SparePartsTab() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SparePart | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetcher = useCallback(
    (params: Record<string, unknown>) => sparePartApi.listPaged(params),
    [],
  )
  const { reload: load, searchInput, setSearchInput, tableProps } = useServerTable<SparePart>(fetcher)

  const save = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) await sparePartApi.update(editing.id, v)
      else await sparePartApi.create(v)
      message.success('Saved'); setOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) } finally { setSaving(false) }
  }

  const columns: ColumnsType<SparePart> = [
    { title: 'Part Code', dataIndex: 'part_code', ellipsis: true, sorter: true, render: v => <span className="  text-[13px] text-slate-800">{v}</span> },
    { title: 'Name', dataIndex: 'name', ellipsis: true, sorter: true, render: v => <span className="text-[13px] text-slate-800">{v}</span> },
    { title: 'Description', dataIndex: 'description', ellipsis: true, sorter: true, render: v => v ? <span className="text-[13px] text-slate-800">{v}</span> : <span className="text-slate-800">NA</span> },
    { title: 'Active', dataIndex: 'is_active', align: 'center', render: (v, r) => <Switch size="small" checked={v} onChange={() => toggleWithToast(() => sparePartApi.toggle(r.id), load)} /> },
    { title: 'Actions', key: 'a', align: 'center', render: (_, r) => <Tooltip title="Edit"><Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true) }} /></Tooltip> },
  ]

  return (
    <div className="pt-3">
      <div className={filterBar}>
        <Input prefix={<Search size={13} className="text-slate-400" />} value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search part code / name…" style={{ width: 240 }} allowClear />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>Add Spare Part</Button>
      </div>
      <div className="glass-card rounded-lg overflow-hidden">
        <Table {...tableProps} columns={columns} rowKey="id" size="small" tableLayout="fixed" />
      </div>
      <Modal title={editing ? 'Edit Spare Part' : 'Add Spare Part'} open={open} closable={false} onCancel={() => { setOpen(false); form.resetFields() }} onOk={() => form.submit()} confirmLoading={saving} width={460} centered destroyOnHidden {...glassModalProps}>
        <Form form={form} layout="vertical" onFinish={save}>
          {!editing && <Form.Item name="part_code" label="Part Code" rules={[{ required: true }]}><Input /></Form.Item>}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page
// ─────────────────────────────────────────────────────────────────────────────
export default function InventoryMasterDataPage() {
  return (
    <div className="p-4 md:p-6">
      <Tabs
        tabBarGutter={20}
        tabBarStyle={{ marginBottom: 0 }}
        items={[
          { key: 'measurement-master', label: 'Measurement Master', children: <MeasurementMasterTab /> },
          { key: 'spare-parts', label: 'Spare Parts', children: <SparePartsTab /> },
          { key: 'uom',              label: 'UOM Master',        children: <UomTab /> },
          { key: 'lookup',           label: 'Lookup Master',     children: <LookupTab /> },
          { key: 'test-master',      label: 'Test Master',       children: <TestMasterTab /> },
          { key: 'storage-master',   label: 'Storage Condition',    children: <StorageMasterTab /> },
          { key: 'storage-locations', label: 'Storage Location', children: <StorageLocationsTab /> },
        ]}
      />
    </div>
  )
}
