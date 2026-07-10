import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Select, Modal, Form, InputNumber, message, Space, Tooltip, Popconfirm, Collapse, Switch } from 'antd'
import { StatusTag } from '../../components/ui/StatusTag'
import type { ColumnsType } from 'antd/es/table'
import { Plus, Pencil, PowerOff, Search, ChevronDown } from 'lucide-react'
import { materialApi, consumableTypeApi, lookupApi, storageConditionApi, type Material, type ConsumableType } from '../../api/inventory'
import { glassModalProps } from '../../utils/modalStyles'

// Material Type options are sourced from the Lookup master (inv_general_lookup)
// where lookup_type = 'Material Type'. Manage them under Inventory Master Data.
const MATERIAL_TYPE_LOOKUP = 'Material Type'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [ctypes, setCtypes] = useState<ConsumableType[]>([])
  const [materialTypes, setMaterialTypes] = useState<string[]>([])
  const [storageConditions, setStorageConditions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [saving, setSaving] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [showConsumablesType, setShowConsumablesType] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      const { items, total } = await materialApi.listPaged(params)
      setMaterials(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, page, pageSize])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { consumableTypeApi.list().then(setCtypes) }, [])
  useEffect(() => {
    lookupApi.list({ lookup_type: MATERIAL_TYPE_LOOKUP, active_only: true })
      .then(rows => setMaterialTypes(rows.map(r => r.lookup_value)))
      .catch(() => setMaterialTypes([]))
  }, [])
  useEffect(() => {
    storageConditionApi.list()
      .then(rows => setStorageConditions(rows.filter(r => r.is_active).map(r => r.label)))
      .catch(() => setStorageConditions([]))
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
    setNextCode('')
    materialApi.nextCode().then(r => setNextCode(r.code)).catch(() => setNextCode(''))
  }
  const openEdit = (m: Material) => {
    setEditing(m)
    form.setFieldsValue({
      ...m,
      // flatten chemical_props into form fields prefixed with cp_
      cp_purity_pct:  m.chemical_props?.purity_pct  ?? null,
      cp_grade:       m.chemical_props?.grade        ?? null,
      cp_appearance:  m.chemical_props?.appearance   ?? null,
      cp_solubility:  m.chemical_props?.solubility   ?? null,
      cp_boiling_pt:  m.chemical_props?.boiling_pt   ?? null,
      cp_melting_pt:  m.chemical_props?.melting_pt   ?? null,
      cp_flash_pt:    m.chemical_props?.flash_pt     ?? null,
      cp_density:     m.chemical_props?.density      ?? null,
      cp_ph_range:    m.chemical_props?.ph_range     ?? null,
    })
    setModalOpen(true)
  }

  const handleSave = async (values: Record<string, unknown>) => {
    setSaving(true)
    try {
      // Separate core fields from chemical props (cp_* prefix)
      const coreFields: Record<string, unknown> = {}
      const cpFields: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(values)) {
        if (k.startsWith('cp_')) cpFields[k.slice(3)] = v
        else coreFields[k] = v
      }

      let savedId: number
      if (editing) {
        await materialApi.update(editing.id, coreFields)
        savedId = editing.id
        message.success('Material updated')
      } else {
        const mat = await materialApi.create(coreFields)
        savedId = mat.id
        message.success('Material created')
      }

      // Save chemical props if any were filled
      const hasChemProps = Object.values(cpFields).some(v => v != null && v !== '')
      if (hasChemProps) {
        await materialApi.upsertChemicalProps(savedId, cpFields)
      }

      setModalOpen(false); form.resetFields(); load()
    } catch (e: unknown) { message.error((e as Error).message) }
    finally { setSaving(false) }
  }

  const handleDeactivate = async (id: number) => {
    try {
      await materialApi.deactivate(id)
      message.success('Material deactivated')
      load()
    } catch (e: unknown) { message.error((e as Error).message) }
  }

  const columns: ColumnsType<Material> = [
    {
      title: 'Code',
      dataIndex: 'code',
      ellipsis: true,
      width: 110,
      render: (v) => <span className="text-[13px] text-slate-600">{v}</span>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: true,
      width:200,
      render: (v) => <span className="text-[13px] text-slate-800">{v}</span>,
    },
    {
      title: 'Material Type',
      dataIndex: 'material_type',
      ellipsis: true,
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-700">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    ...(showConsumablesType ? [{
      title: 'Consumables Type',
      dataIndex: 'consumable_type_id',
      ellipsis: true,
      width: 150,
      render: (v: number | null) => {
        const name = ctypes.find(c => c.id === v)?.name
        return name
          ? <span className="text-[13px] text-slate-700">{name}</span>
          : <span className="text-[13px] text-slate-300">—</span>
      },
    } as ColumnsType<Material>[number]] : []),
    {
      title: 'CAS No',
      dataIndex: 'cas_no',
      ellipsis: true,
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Formula',
      dataIndex: 'molecular_formula',
      ellipsis: true,
      width: 120,
      render: (v: string | null) => v
        ? <span className=" text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Mol. Wt',
      dataIndex: 'mol_weight',
      ellipsis: true,
      width: 90,
      align: 'right',
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Storage',
      dataIndex: 'storage_condition',
      ellipsis: true,
      width: 130,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-600">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Hazard Class',
      dataIndex: 'hazard_class',
      ellipsis: true,
      width: 120,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-700">{v}</span>
        : <span className="text-[13px] text-slate-300">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      ellipsis: true,
      width: 90,
      render: (v: boolean) => (
        <StatusTag color={v ? 'success' : 'default'} className="text-[13px]">{v ? 'Active' : 'Inactive'}</StatusTag>
      ),
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
          {r.is_active && (
            <Popconfirm title="Deactivate this material?" onConfirm={() => handleDeactivate(r.id)}>
              <Tooltip title="Deactivate">
                <Button type="text" size="small" danger icon={<PowerOff size={13} />} />
              </Tooltip>
            </Popconfirm>
          )}
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
          placeholder="Search code / name / type / CAS…"
          style={{ width: 280 }}
          allowClear
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Material
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-slate-600">Show Consumables Type</span>
          <Switch size="small" checked={showConsumablesType} onChange={setShowConsumablesType} />
        </div>
      </div>

      <div className="glass-card rounded-lg overflow-hidden">
        <Table
          dataSource={materials}
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
            pageSizeOptions: [20, 50, 100],
            showTotal: t => `${t} materials`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
          }}
        />
      </div>

      <Modal
        title={editing ? 'Edit Material' : 'New Material'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={620}
        centered
         closable={false}
        destroyOnHidden
        {...glassModalProps}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item label="Code (auto-generated)">
                <Input value={nextCode || 'Generating…'} disabled />
              </Form.Item>
            )}
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="material_type" label="Material Type">
              <Select
                allowClear
                showSearch
                options={materialTypes.map(t => ({ value: t, label: t }))}
                placeholder="Select or type"
              />
            </Form.Item>
            <Form.Item name="cas_no" label="CAS No">
              <Input placeholder="e.g. 75-05-8" />
            </Form.Item>
            <Form.Item name="molecular_formula" label="Molecular Formula">
              <Input />
            </Form.Item>
            <Form.Item name="mol_weight" label="Mol. Weight (g/mol)">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="storage_condition" label="Storage Condition">
              <Select
                allowClear
                showSearch
                options={storageConditions.map(s => ({ value: s, label: s }))}
                placeholder="Select storage condition"
              />
            </Form.Item>
            <Form.Item name="hazard_class" label="Hazard Class">
              <Input placeholder="e.g. Flammable, Corrosive" />
            </Form.Item>
            <Form.Item name="consumable_type_id" label="Consumable Type">
              <Select allowClear options={ctypes.map(c => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* Chemical Properties (collapsible) */}
          <Collapse
            ghost
            size="small"
            expandIcon={({ isActive }) => <ChevronDown size={13} style={{ transform: isActive ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }} />}
            items={[{
              key: 'chem',
              label: <span className="text-[13px] text-slate-500 font-medium">Chemical Properties (optional)</span>,
              children: (
                <div className="grid grid-cols-3 gap-x-3">
                  <Form.Item name="cp_purity_pct" label="Purity %">
                    <InputNumber style={{ width: '100%' }} min={0} max={100} />
                  </Form.Item>
                  <Form.Item name="cp_grade" label="Grade">
                    <Input placeholder="e.g. AR, HPLC" />
                  </Form.Item>
                  <Form.Item name="cp_appearance" label="Appearance">
                    <Input />
                  </Form.Item>
                  <Form.Item name="cp_solubility" label="Solubility">
                    <Input />
                  </Form.Item>
                  <Form.Item name="cp_boiling_pt" label="Boiling Pt (°C)">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="cp_melting_pt" label="Melting Pt (°C)">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="cp_flash_pt" label="Flash Pt (°C)">
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item name="cp_density" label="Density (g/mL)">
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                  <Form.Item name="cp_ph_range" label="pH Range">
                    <Input placeholder="e.g. 6.5–7.5" />
                  </Form.Item>
                </div>
              ),
            }]}
          />
        </Form>
      </Modal>
    </div>
  )
}
