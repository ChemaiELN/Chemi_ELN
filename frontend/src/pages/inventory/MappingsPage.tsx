import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form, InputNumber,
  message, Space, Tooltip, Upload, Dropdown,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Trash2, Search, Link2, Upload as UploadIcon, Download, X, MoreVertical } from 'lucide-react'
import type { UploadFile } from 'antd/es/upload'
import {
  mappingApi, materialApi, manufacturerApi, masterTemplateApi,
  type Mapping, type Material, type Manufacturer,
} from '../../api/inventory'
import { apiDownloadBlob, ApiError } from '../../api/client'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { useAppSelector } from '../../store'
import { selectUser } from '../../store/authSlice'
import { isSuperAdmin } from '../../utils/privileges'
import { useColumnSearch } from '../../hooks/useColumnSearch'

// Material/Manufacturer columns filter by joined-record name (backend params
// `material_name`/`manufacturer_name`), not the FK id these columns render —
// map the antd filter keys (their dataIndex) to the actual param names.
const COLUMN_FILTER_PARAM_MAP: Record<string, string> = {
  material_id: 'material_name',
  manufacturer_id: 'manufacturer_name',
}
const toColumnFilterParams = (columnFilters: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(columnFilters).map(([k, v]) => [COLUMN_FILTER_PARAM_MAP[k] ?? k, v]))

const MAPPINGS_TEMPLATE_KEY = 'mappings'

// Departments whose members can see materials across every department (not
// just their own) in the New Mapping modal's Material dropdown — QA/QC/
// Inventory work across all departments' materials day-to-day. Mirrors
// NewBatchModal.tsx / StockRequestsPage.tsx.
const UNRESTRICTED_DEPARTMENT_CODES = ['QA', 'QC', 'INVENTORY']

export default function MappingsPage() {
  const user = useAppSelector(selectUser)
  const unrestricted = isSuperAdmin(user) ||
    (!!user?.department_code && UNRESTRICTED_DEPARTMENT_CODES.includes(user.department_code))
  // Only scopes the New Mapping modal's Material dropdown — `materials`
  // itself stays unfiltered since the table also uses it to resolve
  // existing mappings' material names regardless of department.
  const materialDeptId = !unrestricted ? (user?.department_id ?? undefined) : undefined
  const [rows, setRows] = useState<Mapping[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { columnFilters, getColumnSearchProps, handleTableFilters } = useColumnSearch()
  const [modalOpen, setModalOpen] = useState(false)

  const handleDownloadSds = async (r: Mapping) => {
    try {
      const ext = r.dsd_file_path?.split('.').pop() ?? 'pdf'
      const matName = materials.find(m => m.id === r.material_id)?.name?.replace(/\s+/g, '_') ?? String(r.id)
      const { blob } = await apiDownloadBlob(`/api/inventory/mappings/${r.id}/dsd/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SDS_${matName}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) { message.error((e as Error).message) }
  }
  const [editing, setEditing] = useState<Mapping | null>(null)
  const [saving, setSaving] = useState(false)
  const [dsdFile, setDsdFile] = useState<UploadFile | null>(null)
  // One material can map to several manufacturers at once (New Mapping only —
  // each row below becomes its own mapping record on submit); rowFiles stays
  // index-aligned with the Form.List "manufacturers" fields.
  const [rowFiles, setRowFiles] = useState<(UploadFile | null)[]>([null])
  const [form] = Form.useForm()

  // Dropdown-specific search results for the New/Edit Mapping modal — kept
  // separate from `materials`/`manufacturers` (used for table name lookups)
  // since the modal needs debounced server-side search across the FULL
  // material/manufacturer catalogue, not just the first page loaded for the table.
  const [materialOptions, setMaterialOptions] = useState<Material[]>([])
  const [manufacturerOptions, setManufacturerOptions] = useState<Manufacturer[]>([])
  const [materialSearching, setMaterialSearching] = useState(false)
  const [manufacturerSearching, setManufacturerSearching] = useState(false)
  const materialSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const manufacturerSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const searchMaterials = (q: string) => {
    if (materialSearchTimer.current) clearTimeout(materialSearchTimer.current)
    materialSearchTimer.current = setTimeout(async () => {
      setMaterialSearching(true)
      try {
        const deptFilter = materialDeptId ? { department_id: materialDeptId } : {}
        if (q) {
          setMaterialOptions(await materialApi.list({ search: q, limit: 20, active_only: true, ...deptFilter }))
        } else if (materialDeptId) {
          setMaterialOptions(await materialApi.list({ limit: 200, active_only: true, ...deptFilter }))
        } else {
          setMaterialOptions(materials.filter(m => m.is_active))
        }
      } finally { setMaterialSearching(false) }
    }, 300)
  }

  const searchManufacturers = (q: string) => {
    if (manufacturerSearchTimer.current) clearTimeout(manufacturerSearchTimer.current)
    manufacturerSearchTimer.current = setTimeout(async () => {
      setManufacturerSearching(true)
      try {
        setManufacturerOptions(q ? await manufacturerApi.list({ search: q, limit: 20, active_only: true }) : manufacturers)
      } finally { setManufacturerSearching(false) }
    }, 300)
  }

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current)
    searchDebounceTimer.current = setTimeout(() => setSearch(value), 300)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      Object.assign(params, toColumnFilterParams(columnFilters))
      const { items, total } = await mappingApi.listPaged(params)
      setRows(items)
      setTotal(total)
      // `materials` is only ever the first 200 (there are 500+ materials in
      // this DB) — any mapping referencing a material outside that page
      // showed as "#123" instead of its real name. Backfill exactly the
      // ones this page's rows actually need.
      setMaterials(prev => {
        const known = new Set(prev.map(m => m.id))
        const missingIds = [...new Set(items.map(r => r.material_id))].filter(id => !known.has(id))
        if (missingIds.length) {
          Promise.all(missingIds.map(id => materialApi.get(id).catch(() => null))).then(fetched => {
            const found = fetched.filter((m): m is Material => !!m)
            if (found.length) setMaterials(cur => [...cur, ...found])
          })
        }
        return prev
      })
    } finally { setLoading(false) }
  }, [search, page, pageSize, sortBy, sortDir, columnFilters])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, columnFilters])
  useEffect(() => () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current) }, [])
  useEffect(() => {
    materialApi.list({ limit: 200 }).then(items => { setMaterials(items); setMaterialOptions(items) })
    manufacturerApi.list({ limit: 200, active_only: true }).then(items => { setManufacturers(items); setManufacturerOptions(items) })
  }, [])

  const openCreate = () => {
    setEditing(null); setDsdFile(null); setRowFiles([null]); form.resetFields(); setModalOpen(true)
    form.setFieldsValue({ manufacturers: [{}] })
    if (materialDeptId) {
      materialApi.list({ limit: 200, active_only: true, department_id: materialDeptId }).then(setMaterialOptions)
    } else {
      setMaterialOptions(materials.filter(m => m.is_active))
    }
    setManufacturerOptions(manufacturers)
  }
  const openEdit = (r: Mapping) => {
    setEditing(r)
    setDsdFile(null)
    form.setFieldsValue({
      material_id: r.material_id,
      manufacturer_id: r.manufacturer_id,
      catalogue_no: r.catalogue_no,
      lead_time_days: r.lead_time_days,
      min_order_qty: r.min_order_qty,
    })
    setModalOpen(true)
    // The dropdown is disabled while editing, but still needs its current
    // selection present as an option to render the label — fetch it directly
    // in case it falls outside the default first page loaded for the table.
    setMaterialOptions(materials)
    if (!materials.some(m => m.id === r.material_id)) {
      materialApi.get(r.material_id).then(m => setMaterialOptions(prev => [m, ...prev]))
    }
    setManufacturerOptions(manufacturers)
    if (!manufacturers.some(m => m.id === r.manufacturer_id)) {
      manufacturerApi.get(r.manufacturer_id).then(m => setManufacturerOptions(prev => [m, ...prev]))
    }
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        const { material_id, manufacturer_id, ...rest } = values
        void material_id; void manufacturer_id
        const saved = await mappingApi.update(editing.id, rest) as Mapping
        if (dsdFile?.originFileObj) {
          await mappingApi.uploadDsd(saved.id, dsdFile.originFileObj as File)
        }
        message.success('Mapping updated')
      } else {
        const manufacturerRows = (values.manufacturers as Record<string, unknown>[] | undefined) ?? []
        for (let i = 0; i < manufacturerRows.length; i++) {
          const row = manufacturerRows[i]
          const saved = await mappingApi.create({ material_id: values.material_id, ...row }) as Mapping
          const file = rowFiles[i]
          if (file?.originFileObj) {
            await mappingApi.uploadDsd(saved.id, file.originFileObj as File)
          }
        }
        message.success(`${manufacturerRows.length} mapping${manufacturerRows.length === 1 ? '' : 's'} created`)
      }
      setModalOpen(false); form.resetFields(); setDsdFile(null); setRowFiles([null]); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await mappingApi.delete(id); message.success('Deleted'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const handleDeleteDsd = async (id: number) => {
    try { await mappingApi.deleteDsd(id); message.success('SDS removed'); load() }
    catch (e: unknown) { message.error((e as Error).message) }
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const res = await mappingApi.upload(file)
      if (res.errors.length) {
        Modal.warning({
          title: <span className="text-slate-800">{res.created} created, {res.skipped} skipped</span>,
          width: 560,
          centered: true,
          okText: 'OK',
          okButtonProps: { style: { background: '#c084fc', borderColor: '#c084fc' } },
          content: (
            <div className="max-h-72 overflow-y-auto mt-2 pr-1">
              <ul className="list-disc pl-4 space-y-1">
                {res.errors.map((err, i) => (
                  <li key={i} className="text-[13px] text-slate-800">{err}</li>
                ))}
              </ul>
            </div>
          ),
          styles: glassModalStyles,
        })
      } else {
        message.success(`${res.created} mapping(s) created`)
      }
      load()
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Upload failed.') }
    return false
  }

  const matName = (id: number) => materials.find(m => m.id === id)?.name ?? `#${id}`
  const mfrName = (id: number) => manufacturers.find(m => m.id === id)?.name ?? `#${id}`

  const COL_WIDTH = 150

  const strSorter = (get: (r: Mapping) => string) => (a: Mapping, b: Mapping) => get(a).localeCompare(get(b))

  const columns: ColumnsType<Mapping> = [
    {
      title: 'Material',
      dataIndex: 'material_id',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: strSorter(r => matName(r.material_id)),
      ...getColumnSearchProps('material_id', 'Material'),
      render: (v) => <span className="text-[13px] text-slate-800">{matName(v)}</span>,
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer_id',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: strSorter(r => mfrName(r.manufacturer_id)),
      ...getColumnSearchProps('manufacturer_id', 'Manufacturer'),
      render: (v) => <span className="text-[13px] text-slate-800">{mfrName(v)}</span>,
    },
    {
      title: 'Catalogue No',
      dataIndex: 'catalogue_no',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: true,
      ...getColumnSearchProps('catalogue_no', 'Catalogue No'),
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Lead Time',
      dataIndex: 'lead_time_days',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: true,
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-800">{v} days</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Min Order Qty',
      dataIndex: 'min_order_qty',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: true,
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'SDS File',
      dataIndex: 'dsd_file_path',
      width: COL_WIDTH,
      align: 'center',
      render: (v: string | null, r) => v ? (
        <Space size={4}>
          <Tooltip title="Download SDS">
            <Button type="text" size="small" icon={<Download size={13} />} onClick={() => handleDownloadSds(r)} />
          </Tooltip>
          {/* <Popconfirm title="Remove SDS file?" onConfirm={() => handleDeleteDsd(r.id)}>
            <Tooltip title="Remove">
              <Button type="text" size="small" danger icon={<X size={13} />} />
            </Tooltip>
          </Popconfirm> */}
        </Space>
      ) : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: COL_WIDTH,
      align: 'center',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          { key: 'delete', label: <span className="text-[12px]">Delete</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'edit') openEdit(r)
          else if (key === 'delete') {
            Modal.confirm({
              title: 'Delete this mapping?',
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
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search material / manufacturer / catalogue / grade…"
          style={{ width: 340 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Mapping
        </Button>
        <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download(MAPPINGS_TEMPLATE_KEY)}>
          Download Template
        </Button>
        <Upload beforeUpload={handleBulkUpload} showUploadList={false} accept=".xlsx">
          <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
        </Upload>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} mappings`,
          }}
          onChange={(pagination: TablePaginationConfig, filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Mapping>
            if (s.order && typeof s.field === 'string') {
              setSortBy(s.field)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else if (!s.order) {
              setSortBy(null)
            }
            handleTableFilters(filters)
          }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Mapping' : 'New Manufacturer Mapping'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setDsdFile(null); setRowFiles([null]) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={editing ? 560 : 640}
        centered
         closable={false}
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="material_id" label="Material" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchMaterials}
              loading={materialSearching}
              notFoundContent={materialSearching ? 'Searching…' : 'No materials found'}
              placeholder="Select material"
              disabled={!!editing}
              options={materialOptions.map(m => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>

          {editing ? (
            <>
              <Form.Item name="manufacturer_id" label="Manufacturer" rules={[{ required: true }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={searchManufacturers}
                  loading={manufacturerSearching}
                  notFoundContent={manufacturerSearching ? 'Searching…' : 'No manufacturers found'}
                  placeholder="Select manufacturer"
                  disabled
                  options={manufacturerOptions.map(m => ({ value: m.id, label: m.name }))}
                />
              </Form.Item>
              <div className="grid grid-cols-2 gap-x-3">
                <Form.Item name="catalogue_no" label="Catalogue No">
                  <Input placeholder="e.g. SIG-12345" />
                </Form.Item>
                <Form.Item name="lead_time_days" label="Lead Time (days)">
                  <InputNumber min={0} className="w-full" />
                </Form.Item>
                <Form.Item name="min_order_qty" label="Min Order Qty">
                  <InputNumber min={0} className="w-full" />
                </Form.Item>
              </div>
              <Form.Item label="SDS File">
                <Upload
                  maxCount={1}
                  beforeUpload={() => false}
                  fileList={dsdFile ? [dsdFile] : []}
                  onChange={({ fileList }) => setDsdFile(fileList[fileList.length - 1] ?? null)}
                  accept=".pdf,.doc,.docx,.xlsx,.xls"
                >
                  <Button icon={<UploadIcon size={13} />}>
                    {editing?.dsd_file_path ? 'Replace SDS File' : 'Upload SDS File'}
                  </Button>
                </Upload>
                {editing?.dsd_file_path && !dsdFile && (
                  <p className="text-[12px] text-emerald-600 mt-1">
                    ✓ SDS file already attached
                  </p>
                )}
              </Form.Item>
            </>
          ) : (
            // A single material can be sourced from several manufacturers, each
            // with its own catalogue no / lead time / min qty / SDS — one row
            // per manufacturer here becomes its own mapping record on submit.
            <Form.List name="manufacturers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, idx) => (
                    <div key={field.key} className="rounded-md border border-slate-200 p-3 mb-3 relative">
                      {fields.length > 1 && (
                        <Button
                          type="text"
                          size="small"
                          icon={<X size={14} />}
                          className="absolute top-1 right-1"
                          onClick={() => { remove(field.name); setRowFiles(prev => prev.filter((_, i) => i !== idx)) }}
                        />
                      )}
                      <div className="grid grid-cols-2 gap-x-3">
                        <Form.Item
                          name={[field.name, 'manufacturer_id']}
                          label="Manufacturer"
                          rules={[{ required: true, message: 'Manufacturer is required' }]}
                        >
                          <Select
                            showSearch
                            filterOption={false}
                            onSearch={searchManufacturers}
                            loading={manufacturerSearching}
                            notFoundContent={manufacturerSearching ? 'Searching…' : 'No manufacturers found'}
                            placeholder="Select manufacturer"
                            options={manufacturerOptions.map(m => ({ value: m.id, label: m.name }))}
                          />
                        </Form.Item>
                        <Form.Item name={[field.name, 'catalogue_no']} label="Catalogue No">
                          <Input placeholder="e.g. SIG-12345" />
                        </Form.Item>
                      </div>
                      <div className="grid grid-cols-3 gap-x-3">
                        <Form.Item name={[field.name, 'lead_time_days']} label="Lead Time (days)">
                          <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'min_order_qty']} label="Min Order Qty">
                          <InputNumber min={0} className="w-full" />
                        </Form.Item>
                        <Form.Item label="SDS File" className="!mb-0">
                          <Upload
                            maxCount={1}
                            beforeUpload={() => false}
                            fileList={rowFiles[idx] ? [rowFiles[idx] as UploadFile] : []}
                            onChange={({ fileList }) => setRowFiles(prev => {
                              const next = [...prev]
                              next[idx] = fileList[fileList.length - 1] ?? null
                              return next
                            })}
                            accept=".pdf,.doc,.docx,.xlsx,.xls"
                            className="w-full [&_.ant-upload]:w-full"
                          >
                            <Button icon={<UploadIcon size={13} />} className="w-full">Upload SDS</Button>
                          </Upload>
                        </Form.Item>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<Plus size={14} />}
                    onClick={() => { add(); setRowFiles(prev => [...prev, null]) }}
                  >
                    Add Manufacturer
                  </Button>
                </>
              )}
            </Form.List>
          )}
        </Form>
      </Modal>
    </div>
  )
}
