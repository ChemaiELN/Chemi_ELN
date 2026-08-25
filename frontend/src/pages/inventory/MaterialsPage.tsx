import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Select, Modal, Form, InputNumber, message, Collapse, Switch, Upload, Dropdown } from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import type { MenuProps } from 'antd'
import { Plus, Pencil, Search, ChevronDown, Download, Upload as UploadIcon, Power, PowerOff, MoreVertical } from 'lucide-react'
import { StatusTag } from '../../components/ui/StatusTag'
import { materialApi, consumableTypeApi, lookupApi, storageConditionApi, masterTemplateApi, type Material, type ConsumableType } from '../../api/inventory'
import { departmentApi, type Department } from '../../api/adc'
import { glassModalProps, glassModalStyles } from '../../utils/modalStyles'
import { ApiError } from '../../api/client'
import { useDepartmentFilterLock } from '../../hooks/useDepartmentFilterLock'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const MATERIALS_TEMPLATE_KEY = 'materials'

// Material Type options are sourced from the Lookup master (inv_general_lookup)
// where lookup_type = 'Material Type'. Manage them under Inventory Master Data.
const MATERIAL_TYPE_LOOKUP = 'Material Type'
// Technical Grade options are sourced from the Lookup master (inv_general_lookup)
// where lookup_type = 'Technical Grade'. Manage them under Inventory Master Data.
const TECHNICAL_GRADE_LOOKUP = 'Technical Grade'
// The Consumable Type field only applies when this specific Material Type lookup value is selected.
const CONSUMABLES_MATERIAL_TYPE = 'Consumables'
// The ISO Type field only applies to this Material Type.
const ANTIBODY_MATERIAL_TYPE = 'Antibody Materials'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [ctypes, setCtypes] = useState<ConsumableType[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [materialTypes, setMaterialTypes] = useState<string[]>([])
  const [technicalGrades, setTechnicalGrades] = useState<string[]>([])
  const [storageConditions, setStorageConditions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  // Debounced so typing fires one query, not one per keystroke.
  const search = useDebouncedValue(searchInput, 300)
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const { isLocked: deptFilterLocked, lockedDepartmentId } = useDepartmentFilterLock()
  useEffect(() => { if (lockedDepartmentId) setDeptFilter(lockedDepartmentId) }, [lockedDepartmentId])
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [saving, setSaving] = useState(false)
  const [nextCode, setNextCode] = useState('')
  const [showConsumablesType, setShowConsumablesType] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [form] = Form.useForm()
  const selectedMaterialType = Form.useWatch('material_type', form)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { skip: (page - 1) * pageSize, limit: pageSize }
      if (search) params.search = search
      if (deptFilter) params.department_id = deptFilter
      if (typeFilter) params.material_type = typeFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      const { items, total } = await materialApi.listPaged(params)
      setMaterials(items)
      setTotal(total)
    } finally { setLoading(false) }
  }, [search, deptFilter, typeFilter, page, pageSize, sortBy, sortDir])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, unknown> = {}
      if (search) params.search = search
      if (deptFilter) params.department_id = deptFilter
      if (typeFilter) params.material_type = typeFilter
      if (sortBy) { params.sort_by = sortBy; params.sort_dir = sortDir }
      await materialApi.exportXlsx(params)
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Export failed.') }
    finally { setExporting(false) }
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, deptFilter, typeFilter])
  useEffect(() => { consumableTypeApi.list().then(setCtypes) }, [])
  useEffect(() => { departmentApi.list().then(setDepartments).catch(() => setDepartments([])) }, [])
  useEffect(() => {
    lookupApi.list({ lookup_type: MATERIAL_TYPE_LOOKUP, active_only: true })
      .then(rows => setMaterialTypes(rows.map(r => r.lookup_value)))
      .catch(() => setMaterialTypes([]))
  }, [])
  useEffect(() => {
    lookupApi.list({ lookup_type: TECHNICAL_GRADE_LOOKUP, active_only: true })
      .then(rows => setTechnicalGrades(rows.map(r => r.lookup_value)))
      .catch(() => setTechnicalGrades([]))
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

  const toggleMaterial = async (id: number) => {
    try {
      const res = await materialApi.toggle(id)
      message.success(res.message ?? 'Updated.')
      load()
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Failed to update status.') }
  }

  const handleToggle = (r: Material) => {
    if (r.is_active) {
      Modal.confirm({
        title: `Deactivate "${r.name}"?`,
        content: 'It will no longer be usable in new stock requests or batches.',
        okText: 'Deactivate',
        okButtonProps: { danger: true },
        centered: true,
        onOk: () => toggleMaterial(r.id),
      })
    } else {
      toggleMaterial(r.id)
    }
  }

  const handleBulkUpload = async (file: File) => {
    try {
      const res = await materialApi.upload(file)
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
        message.success(`${res.created} material(s) created`)
      }
      load()
    } catch (e: unknown) { message.error(e instanceof ApiError ? e.detail : 'Upload failed.') }
    return false
  }

  const columns: ColumnsType<Material> = [
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
      title: 'Material Type',
      dataIndex: 'material_type',
      ellipsis: true,
      width: 130,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    ...(showConsumablesType ? [{
      title: 'Consumables Type',
      dataIndex: 'consumable_type_id',
      ellipsis: true,
      width: 150,
      render: (v: number | null) => {
        const name = ctypes.find(c => c.id === v)?.name
        return name
          ? <span className="text-[13px] text-slate-800">{name}</span>
          : <span className="text-[13px] text-slate-800">NA</span>
      },
    } as ColumnsType<Material>[number]] : []),
    {
      title: 'CAS No',
      dataIndex: 'cas_no',
      ellipsis: true,
      width: 130,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Formula',
      dataIndex: 'molecular_formula',
      ellipsis: true,
      width: 120,
      sorter: true,
      render: (v: string | null) => v
        ? <span className=" text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Mol. Wt',
      dataIndex: 'mol_weight',
      ellipsis: true,
      width: 90,
      align: 'left',
      sorter: true,
      render: (v: number | null) => v != null
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Storage',
      dataIndex: 'storage_condition',
      ellipsis: true,
      width: 130,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Hazard Class',
      dataIndex: 'hazard_class',
      ellipsis: true,
      width: 120,
      sorter: true,
      render: (v: string | null) => v
        ? <span className="text-[13px] text-slate-800">{v}</span>
        : <span className="text-[13px] text-slate-800">NA</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department_id',
      ellipsis: true,
      width: 130,
      render: (v: string | null) => {
        const name = departments.find(d => d.id === v)?.name
        return name
          ? <span className="text-[13px] text-slate-800">{name}</span>
          : <span className="text-[13px] text-slate-800">NA</span>
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
          placeholder="Search code / name / type / CAS…"
          style={{ width: 280 }}
          allowClear
        />
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
        <Select
          value={typeFilter ?? undefined}
          onChange={v => setTypeFilter(v ?? null)}
          options={materialTypes.map(t => ({ value: t, label: t }))}
          placeholder="Filter by material type"
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="label"
        />
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate} className="rounded-md font-medium">
          New Material
        </Button>
        <Button icon={<Download size={14} />} onClick={() => masterTemplateApi.download(MATERIALS_TEMPLATE_KEY)}>
          Download Template
        </Button>
        <Button icon={<Download size={14} />} loading={exporting} onClick={handleExport}>
          Export
        </Button>
        <Upload beforeUpload={handleBulkUpload} showUploadList={false} accept=".xlsx">
          <Button icon={<UploadIcon size={14} />}>Bulk Upload</Button>
        </Upload>
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
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: t => `${t} materials`,
          }}
          onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
            if (pagination.current) setPage(pagination.current)
            if (pagination.pageSize) setPageSize(pagination.pageSize)
            const s = sorter as SorterResult<Material>
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onValuesChange={(changed) => {
            if ('material_type' in changed && changed.material_type !== CONSUMABLES_MATERIAL_TYPE) {
              form.setFieldValue('consumable_type_id', undefined)
            }
            if ('material_type' in changed && changed.material_type !== ANTIBODY_MATERIAL_TYPE) {
              form.setFieldValue('iso_type', undefined)
            }
          }}
        >
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-x-3">
            {!editing && (
              <Form.Item label="Code (auto-generated)">
                <Input value={nextCode || 'Generating…'} disabled />
              </Form.Item>
            )}
            <Form.Item name="material_type" label="Material Type" rules={[{ required: true, message: 'Material Type is required' }]}>
              <Select
                allowClear
                showSearch
                options={materialTypes.map(t => ({ value: t, label: t }))}
                placeholder="Select or type"
              />
            </Form.Item>
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="cp_grade" label="Technical Grade" rules={[{ required: true, message: 'Technical Grade is required' }]}>
              <Select
                allowClear
                showSearch
                options={technicalGrades.map(t => ({ value: t, label: t }))}
                placeholder="Select technical grade"
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
            <Form.Item name="department_id" label="Department">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={departments.map(d => ({ value: d.id, label: d.name }))}
                placeholder="Select department"
              />
            </Form.Item>
            {selectedMaterialType === ANTIBODY_MATERIAL_TYPE && (
              <Form.Item name="iso_type" label="ISO Type">
                <Input />
              </Form.Item>
            )}
            {selectedMaterialType === CONSUMABLES_MATERIAL_TYPE && (
              <Form.Item name="consumable_type_id" label="Consumable Type">
                <Select allowClear options={ctypes.map(c => ({ value: c.id, label: c.name }))} />
              </Form.Item>
            )}
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
