import { useState, useEffect, useCallback, useRef } from 'react'
import { Table, Button, Input, Modal, Form, message, Upload, Checkbox, Tag, Dropdown } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { MenuProps } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, Pencil, Search, Building2, Download, Upload as UploadIcon, FileDown, Trash2, MoreVertical, Power, PowerOff } from 'lucide-react'
import { manufacturerApi, masterTemplateApi, type Manufacturer } from '../../api/inventory'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { EmptyValue } from '../../components/ui/EmptyValue'
import { StatusTag } from '../../components/ui/StatusTag'

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
  const [pendingQualFile, setPendingQualFile] = useState<File | null>(null)
  const [form] = Form.useForm()

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

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setPendingQualFile(null)
    setModalOpen(true)
  }

  const openEdit = (m: Manufacturer) => {
    setEditing(m)
    form.setFieldsValue(m)
    setPendingQualFile(null)
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      let saved: Manufacturer
      if (editing) {
        saved = await manufacturerApi.update(editing.id, values)
        message.success('Manufacturer updated')
      } else {
        saved = await manufacturerApi.create(values)
        message.success('Manufacturer created')
      }
      if (pendingQualFile) {
        await manufacturerApi.uploadQualificationFile(saved.id, pendingQualFile)
      }
      setModalOpen(false)
      form.resetFields()
      setPendingQualFile(null)
      load()
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

  const handleDownloadQualFile = async (id: number) => {
    try {
      const { blob, filename } = await manufacturerApi.downloadQualificationFile(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch { message.error('Failed to download qualification file.') }
  }

  const handleRemoveQualFile = async (r: Manufacturer) => {
    Modal.confirm({
      title: 'Remove qualification document?',
      content: 'This will permanently delete the attached file.',
      okText: 'Remove',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await manufacturerApi.deleteQualificationFile(r.id)
          message.success('Qualification document removed.')
          load()
        } catch { message.error('Failed to remove file.') }
      },
    })
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
          styles: glassModalStyles,
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
      width: 200,
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
        : <EmptyValue />,
    },
    {
      title: 'Contact Person',
      dataIndex: 'contact_person',
      ellipsis: true,
      width: 150,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
      width: 200,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      ellipsis: true,
      width: 140,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <EmptyValue />,
    },
    {
      title: 'Qualified',
      dataIndex: 'is_qualified',
      ellipsis: true,
      width: 100,
      align: 'center',
      sorter: true,
      render: (v: boolean) => v
        ? <Tag color="green" className="text-[12px]">Qualified</Tag>
        : <EmptyValue />,
    },
    {
      title: 'Qual. Doc',
      dataIndex: 'qualification_file_path',
      width: 90,
      align: 'center',
      render: (v: string | null, r: Manufacturer) => {
        if (!v) return <EmptyValue />
        const items: MenuProps['items'] = [
          { key: 'download', label: <span className="text-[12px]">Download</span>, icon: <FileDown size={12} /> },
          { key: 'remove', label: <span className="text-[12px]">Remove</span>, icon: <Trash2 size={12} />, danger: true },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key }) => {
          if (key === 'download') handleDownloadQualFile(r.id)
          else if (key === 'remove') handleRemoveQualFile(r)
        }
        return (
          <Dropdown menu={{ items, onClick: onMenuClick }} trigger={['click']} rootClassName="admin-actions-dropdown">
            <Button type="text" size="small" icon={<MoreVertical size={13} />} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        )
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      ellipsis: true,
      width: 90,
      align: 'center',
      sorter: true,
      render: (v: boolean) => <StatusTag color={v ? 'green' : 'red'}>{v ? 'Active' : 'Inactive'}</StatusTag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 70,
      align: 'center',
      render: (_, r) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: <span className="text-[12px]">Edit</span>, icon: <Pencil size={12} /> },
          {
            key: 'toggle',
            label: <span className="text-[12px]">{r.is_active ? 'Deactivate' : 'Activate'}</span>,
            icon: r.is_active ? <PowerOff size={12} /> : <Power size={12} />,
            danger: r.is_active,
          },
        ]
        const onMenuClick: MenuProps['onClick'] = ({ key, domEvent }) => {
          domEvent.stopPropagation()
          if (key === 'edit') openEdit(r)
          else if (key === 'toggle') handleToggle(r)
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
        onCancel={() => { setModalOpen(false); form.resetFields(); setPendingQualFile(null) }}
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
            <Form.Item name="is_qualified" valuePropName="checked" label="Qualification">
              <Checkbox>Qualified Manufacturer</Checkbox>
            </Form.Item>
          </div>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Qualification Document">
            <div className="flex flex-col gap-1">
              <Upload
                beforeUpload={(file) => { setPendingQualFile(file); return false }}
                showUploadList={false}
                accept=".pdf,.doc,.docx,.xlsx,.xls"
              >
                <Button icon={<UploadIcon size={14} />}>
                  {pendingQualFile ? pendingQualFile.name : 'Attach Document'}
                </Button>
              </Upload>
              {pendingQualFile && (
                <Button
                  size="small"
                  danger
                  type="text"
                  className="w-fit"
                  onClick={() => setPendingQualFile(null)}
                >
                  Remove selected file
                </Button>
              )}
              {!pendingQualFile && editing?.qualification_file_path && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px] text-slate-500">Existing document attached</span>
                  <Button size="small" type="link" onClick={() => handleDownloadQualFile(editing.id)}>
                    Download
                  </Button>
                </div>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
