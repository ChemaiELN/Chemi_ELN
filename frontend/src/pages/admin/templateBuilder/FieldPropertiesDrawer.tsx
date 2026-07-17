import { useEffect } from 'react'
import { Drawer, Form, Input, InputNumber, Switch, Select, Button, Segmented } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { descriptorFor, type TemplateField } from './types'
import { INVENTORY_SOURCES, INVENTORY_SOURCE_LIST, MAPPING_ATTRIBUTES, type InventorySourceKey } from './inventorySources'
import { lookupApi } from '../../../api/inventory'

interface Props {
  field: TemplateField | null
  // Inventory-backed dropdowns on the same screen (excluding this field) that
  // can drive auto-fill for this field.
  driverFields?: TemplateField[]
  onClose: () => void
  onSave: (field: TemplateField) => void
}

// Right-side property editor for a single field — Basic Info / Field Type /
// Validation / Options, matching the "Field Configuration" requirement.
// Layout-only fields (Section heading, Spacer) skip validation entirely.
export default function FieldPropertiesDrawer({ field, driverFields = [], onClose, onSave }: Props) {
  const [form] = Form.useForm()

  const optionsMode = Form.useWatch('optionsMode', form) as 'static' | 'inventory' | undefined
  const sourceKey = Form.useWatch(['inventorySource', 'source'], form) as InventorySourceKey | undefined
  const sourceDef = sourceKey ? INVENTORY_SOURCES[sourceKey] : undefined

  const autoFillOn = Form.useWatch('autoFillEnabled', form) as boolean | undefined
  const autoFillMode = (Form.useWatch(['autoFill', 'mode'], form) as 'attribute' | 'mapping' | undefined) ?? 'attribute'
  const autoFillDriverName = Form.useWatch(['autoFill', 'sourceFieldName'], form) as string | undefined
  const driver = driverFields.find(f => f.name === autoFillDriverName)
  const driverSource = driver?.inventorySource?.source as InventorySourceKey | undefined
  const driverColumns = driverSource ? INVENTORY_SOURCES[driverSource].columns : []

  // Mapping mode needs a materials driver AND a manufacturers driver on-screen.
  const materialDrivers = driverFields.filter(f => f.inventorySource?.source === 'materials')
  const manufacturerDrivers = driverFields.filter(f => f.inventorySource?.source === 'manufacturers')
  const canMapping = materialDrivers.length > 0 && manufacturerDrivers.length > 0

  // Lookup types — only needed when the chosen source is the generic lookup table.
  const { data: lookupTypes = [] } = useQuery({
    queryKey: ['lookup-types'],
    queryFn: () => lookupApi.types(),
    enabled: sourceKey === 'lookup',
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (field) {
      form.setFieldsValue({
        ...field,
        optionsMode: field.optionsMode ?? 'static',
        autoFillEnabled: !!field.autoFill,
      })
    }
  }, [field, form])

  // When the admin picks a source, seed sensible default value/label columns.
  const onSourceChange = (key: InventorySourceKey) => {
    const def = INVENTORY_SOURCES[key]
    form.setFieldsValue({
      inventorySource: {
        source: key,
        lookupType: undefined,
        valueField: def.defaultValueField,
        labelField: def.defaultLabelField,
      },
    })
  }

  if (!field) return null
  const descriptor = descriptorFor(field.type)
  const isDropdown = field.type === 'DROPDOWN'
  const useInventory = isDropdown && optionsMode === 'inventory'

  const submit = (vals: Record<string, unknown>) => {
    const merged = { ...field, ...vals } as TemplateField & { autoFillEnabled?: boolean }
    // Drop inventory config unless this is an inventory-backed dropdown.
    if (merged.type !== 'DROPDOWN' || merged.optionsMode !== 'inventory') {
      delete merged.inventorySource
    }
    // The switch is a UI-only flag — persist `autoFill` only when it's on.
    if (!merged.autoFillEnabled) {
      delete merged.autoFill
    } else if (merged.autoFill) {
      // Drop the fields belonging to the mode that isn't active.
      const af = { ...merged.autoFill }
      if ((af.mode ?? 'attribute') === 'mapping') {
        delete af.sourceFieldName
        delete af.attribute
      } else {
        delete af.materialFieldName
        delete af.manufacturerFieldName
        delete af.mappingAttribute
      }
      merged.autoFill = af
    }
    delete merged.autoFillEnabled
    onSave(merged as TemplateField)
  }

  return (
    <Drawer
      title={`Edit Field — ${descriptor.label}`}
      open={!!field}
      onClose={onClose}
      width={420}
      destroyOnHidden
      // Force a solid white panel — the global Drawer theme is translucent glass.
      styles={{ content: { background: '#ffffff' }, header: { background: '#ffffff' }, body: { background: '#ffffff' } }}
      extra={<Button type="primary" size="small" onClick={() => form.submit()}>Apply</Button>}
    >
      <Form form={form} layout="vertical" onFinish={submit} initialValues={field}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Basic Information</p>
        <Form.Item label="Field Label" name="label" rules={[{ required: true, message: 'Required' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Internal Field Name"
          name="name"
          rules={[
            { required: true, message: 'Required' },
            { pattern: /^[a-z][a-z0-9_]*$/, message: 'lowercase letters, numbers, underscores only' },
          ]}
        >
          <Input />
        </Form.Item>

        {!descriptor.isLayoutOnly && (
          <>
            <Form.Item label="Placeholder" name="placeholder">
              <Input />
            </Form.Item>
            <Form.Item label="Help Text" name="helpText">
              <Input.TextArea rows={2} />
            </Form.Item>

            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Validation</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <Form.Item label="Required" name="required" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item label="Read Only" name="readOnly" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item label="Hidden" name="hidden" valuePropName="checked"><Switch /></Form.Item>
            </div>
            <Form.Item label="Default Value" name="defaultValue">
              <Input />
            </Form.Item>

            {(field.type === 'SINGLE_LINE_TEXT' || field.type === 'MULTI_LINE_TEXT') && (
              <div className="grid grid-cols-2 gap-3">
                <Form.Item label="Minimum Length" name="minLength"><InputNumber className="w-full" min={0} /></Form.Item>
                <Form.Item label="Maximum Length" name="maxLength"><InputNumber className="w-full" min={0} /></Form.Item>
              </div>
            )}
            {field.type === 'NUMBER' && (
              <div className="grid grid-cols-2 gap-3">
                <Form.Item label="Minimum Value" name="minValue"><InputNumber className="w-full" /></Form.Item>
                <Form.Item label="Maximum Value" name="maxValue"><InputNumber className="w-full" /></Form.Item>
              </div>
            )}
            {(field.type === 'SINGLE_LINE_TEXT' || field.type === 'MULTI_LINE_TEXT') && (
              <Form.Item label="Regex Validation (optional)" name="regex">
                <Input placeholder="e.g. ^[A-Z]{2}\\d{4}$" />
              </Form.Item>
            )}

            {descriptor.hasOptions && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Options</p>

                {isDropdown && (
                  <Form.Item name="optionsMode" initialValue="static" className="mb-3">
                    <Segmented
                      size="small"
                      options={[
                        { label: 'Static list', value: 'static' },
                        { label: 'From inventory', value: 'inventory' },
                      ]}
                    />
                  </Form.Item>
                )}

                {!useInventory && (
                  <Form.List name="options">
                    {(fields, { add, remove }) => (
                      <div className="space-y-2">
                        {fields.map(f => (
                          <div key={f.key} className="flex items-center gap-2">
                            <Form.Item {...f} noStyle rules={[{ required: true, message: 'Required' }]}>
                              <Input placeholder="Option value" />
                            </Form.Item>
                            <button type="button" onClick={() => remove(f.name)} className="text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <Button size="small" icon={<Plus size={12} />} onClick={() => add('New option')}>
                          Add Option
                        </Button>
                      </div>
                    )}
                  </Form.List>
                )}

                {useInventory && (
                  <div className="space-y-3">
                    <Form.Item
                      label="Source table"
                      name={['inventorySource', 'source']}
                      rules={[{ required: true, message: 'Pick a source' }]}
                    >
                      <Select
                        placeholder="Select inventory source"
                        onChange={onSourceChange}
                        options={INVENTORY_SOURCE_LIST.map(s => ({ value: s.key, label: s.label }))}
                      />
                    </Form.Item>

                    {sourceDef?.needsLookupType && (
                      <Form.Item
                        label="Lookup type"
                        name={['inventorySource', 'lookupType']}
                        rules={[{ required: true, message: 'Pick a lookup type' }]}
                      >
                        <Select
                          placeholder="Select lookup type"
                          showSearch
                          options={lookupTypes.map(t => ({ value: t, label: t }))}
                        />
                      </Form.Item>
                    )}

                    {sourceDef && (
                      <div className="grid grid-cols-2 gap-3">
                        <Form.Item
                          label="Show (label)"
                          name={['inventorySource', 'labelField']}
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Select options={sourceDef.columns.map(c => ({ value: c.key, label: c.label }))} />
                        </Form.Item>
                        <Form.Item
                          label="Store (value)"
                          name={['inventorySource', 'valueField']}
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Select options={sourceDef.columns.map(c => ({ value: c.key, label: c.label }))} />
                        </Form.Item>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400">
                      The list is loaded live from inventory. The <b>stored value</b> is saved into the
                      experiment; the <b>label</b> is what the user sees.
                    </p>
                  </div>
                )}
              </>
            )}

            {driverFields.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Auto-fill</p>
                <Form.Item name="autoFillEnabled" valuePropName="checked" className="mb-2">
                  <Switch size="small" checkedChildren="On" unCheckedChildren="Off" />
                </Form.Item>
                {autoFillOn && (
                  <div className="space-y-3">
                    {canMapping && (
                      <Form.Item name={['autoFill', 'mode']} initialValue="attribute" className="mb-1">
                        <Segmented
                          size="small"
                          options={[
                            { label: 'Copy field', value: 'attribute' },
                            { label: 'Material + Mfr → mapping', value: 'mapping' },
                          ]}
                        />
                      </Form.Item>
                    )}

                    {autoFillMode !== 'mapping' && (
                      <>
                        <Form.Item
                          label="Fill from field"
                          name={['autoFill', 'sourceFieldName']}
                          rules={[{ required: true, message: 'Pick a source field' }]}
                        >
                          <Select
                            placeholder="Select a dropdown"
                            onChange={() => form.setFieldValue(['autoFill', 'attribute'], undefined)}
                            options={driverFields.map(f => ({ value: f.name, label: f.label }))}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Attribute to copy"
                          name={['autoFill', 'attribute']}
                          rules={[{ required: true, message: 'Pick an attribute' }]}
                        >
                          <Select
                            placeholder={driver ? 'Select attribute' : 'Pick a source field first'}
                            disabled={!driver}
                            options={driverColumns.map(c => ({ value: c.key, label: c.label }))}
                          />
                        </Form.Item>
                      </>
                    )}

                    {autoFillMode === 'mapping' && (
                      <>
                        <Form.Item
                          label="Material field"
                          name={['autoFill', 'materialFieldName']}
                          rules={[{ required: true, message: 'Pick a materials dropdown' }]}
                        >
                          <Select
                            placeholder="Select a materials dropdown"
                            options={materialDrivers.map(f => ({ value: f.name, label: f.label }))}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Manufacturer field"
                          name={['autoFill', 'manufacturerFieldName']}
                          rules={[{ required: true, message: 'Pick a manufacturers dropdown' }]}
                        >
                          <Select
                            placeholder="Select a manufacturers dropdown"
                            options={manufacturerDrivers.map(f => ({ value: f.name, label: f.label }))}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Mapping value to copy"
                          name={['autoFill', 'mappingAttribute']}
                          rules={[{ required: true, message: 'Pick a value' }]}
                        >
                          <Select options={MAPPING_ATTRIBUTES.map(c => ({ value: c.key, label: c.label }))} />
                        </Form.Item>
                        <p className="text-[11px] text-slate-400">
                          Fills from the mapping matching the chosen material + manufacturer.
                        </p>
                      </>
                    )}

                    <Form.Item label="Editable" name={['autoFill', 'editable']} valuePropName="checked" className="mb-1">
                      <Switch size="small" />
                    </Form.Item>
                    <p className="text-[11px] text-slate-400">
                      Off = value is locked to the selected record. On = auto-filled, but the user may override it.
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Form>
    </Drawer>
  )
}
