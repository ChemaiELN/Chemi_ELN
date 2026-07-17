import { useState, useEffect, useCallback, useRef } from 'react'
import { Table, Button, Input, Modal, Form, message, Tooltip, Switch, Upload } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Search, Building2, Download, Upload as UploadIcon } from 'lucide-react'
import { manufacturerApi, masterTemplateApi, type Manufacturer } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'

const MANUFACTURERS_TEMPLATE_KEY = 'manufacturers'
const SEARCH_DEBOUNCE_MS = 300

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Manufacturer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // Debounce the search box: only re-query the backend 300ms after the user
  // stops typing, instead of firing a request on every keystroke.
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current)
    searchDebounceTimer.current = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => { if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current) }
  }, [searchInput])
  useEffect(() => { setPage(1) }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await manufacturerApi.listPaged(params)
      setManufacturers(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, page, pageSize, sortBy, sortDir])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true) }
  const openEdit = (m: Manufacturer) => { setEditing(m); form.setFieldsValue(m); setModalOpen(true) }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (editing) {
        await manufacturerApi.update(editing.id, values)
        message.success('Manufacturer updated')
      } else {
        await manufacturerApi.create(values)
        message.success('Manufacturer created')
      }
      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const toggleManufacturer = async (id: number) => {
    try {
      const res = await manufacturerApi.toggle(id)
      message.success(res.message ?? 'Updated.')
      load()
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Failed to update status.') }
  }

  const handleToggle = (r: Manufacturer) => {
    if (r.is_active) {
      Modal.confirm({
        title: `Deactivate "${r.name}"?`,
        content: 'It will no longer be selectable for new manufacturer mappings or batches.',
        okText: 'Deactivate',
        okButtonProps: { danger: true },
        centered: true,
        onOk: () => toggleManufacturer(r.id),
      })
    } else {
      toggleManufacturer(r.id)
    }
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const res = await manufacturerApi.upload(file)
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
        message.success(`${res.created} manufacturer(s) created`)
      }
      load()
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Upload failed.') }
    return false
  }

  const columns: ColumnsType<Manufacturer> = [
    {
      title: 'Code',
      dataIndex: 'code',
      ellipsis: true,
      width: 110,
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: true,
      width:200,
      sorter: true,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      ellipsis: true,
      width: 120,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
      width: 200,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      ellipsis: true,
      width: 140,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      ellipsis: true,
      width: 90,
      align: 'center',
      sorter: true,
      render: (v: boolean, r: Manufacturer) => <Switch size="small" checked={v} onChange={() => handleToggle(r)} />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, r) => (
        <Tooltip title="Edit">
          <Button type="text" size="small" icon={<Pencil size={13} />} onClick={() => openEdit(r)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="glass-card rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
        <Input
          prefix={<Search size={13} className="text-slate-400" />}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search code / name / country / contact / email / phone…"
          style={{ width: 200 }}
          allowClear
        />
        <Button type="primary" icon={<Building2 size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Manufacturer
        </Button>
        <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download(MANUFACTURERS_TEMPLATE_KEY)}>
          Download Template
        </Button>
        <Upload beforeUpload={handleBulkUpload} showUploadList={false} accept=".xlsx">
          <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
        </Upload>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={manufacturers}
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
            showTotal: t => `${t} manufacturers`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Manufacturer>
            if (s.order) {
              setSortBy(s.field as string)
              setSortDir(s.order === 'ascend' ? 'asc' : 'desc')
            } else {
              setSortBy(null)
            }
          }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Manufacturer' : 'New Manufacturer'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={560}
        centered
         closable={false}
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="country" label="Country">
              <Input />
            </Form.Item>
            <Form.Item name="contact_person" label="Contact Person">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input type="email" />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="website" label="Website">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
