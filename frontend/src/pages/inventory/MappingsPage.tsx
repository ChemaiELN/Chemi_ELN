import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table, Button, Input, Select, Modal, Form, InputNumber,
  message, Space, Tooltip, Popconfirm, Upload,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Trash2, Search, Link2, Upload as UploadIcon, Download, X } from 'lucide-react'
import type { UploadFile } from 'antd/es/upload'
import {
  mappingApi, materialApi, manufacturerApi, masterTemplateApi,
  type Mapping, type Material, type Manufacturer,
} from '../../api/inventory'
import { apiDownloadBlob, ApiError } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

const MAPPINGS_TEMPLATE_KEY = 'mappings'

export default function MappingsPage() {
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
        setMaterialOptions(q ? await materialApi.list({ search: q, limit: 20 }) : materials)
      } finally { setMaterialSearching(false) }
    }, 300)
  }

  const searchManufacturers = (q: string) => {
    if (manufacturerSearchTimer.current) clearTimeout(manufacturerSearchTimer.current)
    manufacturerSearchTimer.current = setTimeout(async () => {
      setManufacturerSearching(true)
      try {
        setManufacturerOptions(q ? await manufacturerApi.list({ search: q, limit: 20 }) : manufacturers)
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
      const { items, total } = await mappingApi.listPaged(params)
      setRows(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current) }, [])
  useEffect(() => {
    materialApi.list({ limit: 200 }).then(items => { setMaterials(items); setMaterialOptions(items) })
    manufacturerApi.list({ limit: 200 }).then(items => { setManufacturers(items); setManufacturerOptions(items) })
  }, [])

  const openCreate = () => {
    setEditing(null); setDsdFile(null); form.resetFields(); setModalOpen(true)
    setMaterialOptions(materials); setManufacturerOptions(manufacturers)
  }
  const openEdit = (r: Mapping) => {
    setEditing(r)
    setDsdFile(null)
    form.setFieldsValue({
      material_id: r.material_id,
      manufacturer_id: r.manufacturer_id,
      catalogue_no: r.catalogue_no,
      technical_grade: r.technical_grade,
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
      let saved: Mapping
      if (editing) {
        const { material_id, manufacturer_id, ...rest } = values
        void material_id; void manufacturer_id
        saved = await mappingApi.update(editing.id, rest) as Mapping
      } else {
        saved = await mappingApi.create(values) as Mapping
      }
      if (dsdFile?.originFileObj) {
        await mappingApi.uploadDsd(saved.id, dsdFile.originFileObj as File)
      }
      message.success(editing ? 'Mapping updated' : 'Mapping created')
      setModalOpen(false); form.resetFields(); setDsdFile(null); load()
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
          ...glassModalProps,
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
      render: (v) => <span className="text-[13px] text-slate-800">{matName(v)}</span>,
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer_id',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: strSorter(r => mfrName(r.manufacturer_id)),
      render: (v) => <span className="text-[13px] text-slate-800">{mfrName(v)}</span>,
    },
    {
      title: 'Catalogue No',
      dataIndex: 'catalogue_no',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Grade',
      dataIndex: 'technical_grade',
      ellipsis: true,
      width: COL_WIDTH,
      sorter: true,
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
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete this mapping?" onConfirm={() => handleDelete(r.id)}>
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<Trash2 size={13} />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
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
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Mapping>
            if (s.order && typeof s.field === 'string') {
              setSortBy(s.field)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else if (!s.order) {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Mapping' : 'New Manufacturer Mapping'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setDsdFile(null) }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={560}
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
          <Form.Item name="manufacturer_id" label="Manufacturer" rules={[{ required: true }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={searchManufacturers}
              loading={manufacturerSearching}
              notFoundContent={manufacturerSearching ? 'Searching…' : 'No manufacturers found'}
              placeholder="Select manufacturer"
              disabled={!!editing}
              options={manufacturerOptions.map(m => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <div className="grid grid-cols-2 gap-x-3">
            <Form.Item name="catalogue_no" label="Catalogue No">
              <Input placeholder="e.g. SIG-12345" />
            </Form.Item>
            <Form.Item name="technical_grade" label="Technical Grade">
              <Input placeholder="e.g. HPLC, GR, AR" />
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
        </Form>
      </Modal>
    </div>
  )
}
