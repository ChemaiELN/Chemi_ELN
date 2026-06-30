import { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Input, Select, Modal, Form, InputNumber,
  message, Space, Tooltip, Popconfirm, Upload,
} from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, Trash2, Search, Link2, Upload as UploadIcon, Download, X } from 'lucide-react'
import type { UploadFile } from 'antd/es/upload'
import {
  mappingApi, materialApi, manufacturerApi,
  type Mapping, type Material, type Manufacturer,
} from '../../api/inventory'
import { apiDownloadBlob } from '../../api/client'
import { glassModalProps } from '../../utils/modalStyles'

export default function MappingsPage() {
  const [rows, setRows] = useState<Mapping[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await mappingApi.list({}))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    materialApi.list({}).then(setMaterials)
    manufacturerApi.list({}).then(setManufacturers)
  }, [])

  const filtered = search
    ? rows.filter(r => {
        const mat = materials.find(m => m.id === r.material_id)?.name ?? ''
        const mfr = manufacturers.find(m => m.id === r.manufacturer_id)?.name ?? ''
        const q = search.toLowerCase()
        return (
          mat.toLowerCase().includes(q) ||
          mfr.toLowerCase().includes(q) ||
          (r.catalogue_no ?? '').toLowerCase().includes(q) ||
          (r.technical_grade ?? '').toLowerCase().includes(q)
        )
      })
    : rows

  const openCreate = () => { setEditing(null); setDsdFile(null); form.resetFields(); setModalOpen(true) }
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

  const matName = (id: number) => materials.find(m => m.id === id)?.name ?? `#${id}`
  const mfrName = (id: number) => manufacturers.find(m => m.id === id)?.name ?? `#${id}`

  const columns: ColumnsType<Mapping> = [
    {
      title: 'Material',
      dataIndex: 'material_id',
      render: (v) => <span className="text-[13px] text-slate-800 font-medium">{matName(v)}</span>,
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer_id',
      render: (v) => <span className="text-[13px] text-slate-700">{mfrName(v)}</span>,
    },
    {
      title: 'Catalogue No',
      dataIndex: 'catalogue_no',
      width: 150,
      render: (v: string | null) => v
        ? <span className="font-mono text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Grade',
      dataIndex: 'technical_grade',
      width: 120,
      render: (v: string | null) => v
        ? <StatusTag color="blue">{v}</StatusTag>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Lead Time',
      dataIndex: 'lead_time_days',
      width: 110,
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-600">{v} days</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Min Order Qty',
      dataIndex: 'min_order_qty',
      width: 120,
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'SDS File',
      dataIndex: 'dsd_file_path',
      width: 110,
      render: (v: string | null, r) => v ? (
        <Space size={4}>
          <Tooltip title="Download SDS">
            <Button type="text" size="small" icon={<Download size={13} />} onClick={() => handleDownloadSds(r)} />
          </Tooltip>
          <Popconfirm title="Remove SDS file?" onConfirm={() => handleDeleteDsd(r.id)}>
            <Tooltip title="Remove">
              <Button type="text" size="small" danger icon={<X size={13} />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ) : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'right',
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
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search material / manufacturer / catalogue / grade…"
          style={{ width: 340 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Mapping
        </Button>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `${t} mappings` }}
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
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="material_id" label="Material" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select material"
              disabled={!!editing}
              options={materials.map(m => ({ value: m.id, label: m.name }))}
            />
          </Form.Item>
          <Form.Item name="manufacturer_id" label="Manufacturer" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select manufacturer"
              disabled={!!editing}
              options={manufacturers.map(m => ({ value: m.id, label: m.name }))}
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
