import { useEffect, useState } from 'react'
import { Drawer, Form, Input, InputNumber, Switch, Select, Button, Segmented, Checkbox, type FormInstance } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Table2 } from 'lucide-react'
import { descriptorFor, type TemplateField, type TemplateScreen } from './types'
import type { CrossScreenRef, CrossScreenSpreadsheetRef } from './TemplateBuilderPage'
import { INVENTORY_SOURCES, INVENTORY_SOURCE_LIST, MAPPING_ATTRIBUTES, type InventorySourceKey } from './inventorySources'
import { lookupApi, uomApi } from '../../../api/inventory'
import { departmentApi } from '../../../api/adc'
import { calcTemplateApi } from '../../../api/calcTemplates'
import SpreadsheetFieldEditorModal from './SpreadsheetFieldEditorModal'
import { ardApi } from '../../../api/ard'

// Builder-time instruction (not persisted): apply attribute-mode auto-fill onto
// sibling fields driven by THIS inventory dropdown. The parent reconciles these
// onto the target fields' own `autoFill` config, so the runtime is unchanged.
// Inventory sources that carry a `department_id` column — the only ones a
// template author can scope to one fixed department. The rest (manufacturers,
// UOM, lookup, batches, test names/methods, etc.) have no department concept.
const DEPARTMENT_SCOPED_SOURCES: InventorySourceKey[] = ['materials', 'equipment', 'instrument']

export interface AutoPopulateApply {
  driverOldName: string       // this dropdown's name before edit (for reconcile/rename)
  mode?: 'attribute' | 'row'  // 'row' when the driver's optionsMode is 'screenRows'
  targets: { fieldName: string; attribute: string; editable: boolean }[]
}

interface Props {
  field: TemplateField | null
  // Inventory-backed dropdowns on the same screen (excluding this field) that
  // can drive auto-fill for this field.
  driverFields?: TemplateField[]
  // Non-layout, non-inventory-dropdown fields on the same screen that THIS
  // dropdown can auto-populate.
  siblingFields?: TemplateField[]
  // NUMBER fields anywhere in the same SECTION (excluding this field) — the
  // candidate targets for this NUMBER field's add/subtract computation.
  sectionNumberFields?: TemplateField[]
  // Every inventory-backed dropdown anywhere in the same SECTION (excluding
  // this field) — filtered per-source below to find candidate "filter by"
  // drivers for a cascading source (e.g. test_methods needs a test_names one).
  sectionInventoryDrivers?: TemplateField[]
  // Table / entry-table screens anywhere in the same SECTION — candidates for
  // a LOCK_TOGGLE field's "mirror rows on lock" source/target pickers.
  sectionTableScreens?: TemplateScreen[]
  // Every table screen in the WHOLE template (all sections) — candidates for
  // a DROPDOWN's optionsMode 'screenRows' source (may live in another section).
  crossTemplateTableScreens?: CrossScreenRef[]
  // Every SPREADSHEET field in the WHOLE template (all sections) — candidates
  // for a 'spreadsheet'-mode autoFill source (may live in another section).
  crossTemplateSpreadsheetFields?: CrossScreenSpreadsheetRef[]
  onClose: () => void
  onSave: (field: TemplateField, autoPopulate?: AutoPopulateApply) => void
}

// Right-side property editor for a single field — Basic Info / Field Type /
// Validation / Options, matching the "Field Configuration" requirement.
// Layout-only fields (Section heading, Spacer) skip validation entirely.
export default function FieldPropertiesDrawer({ field, driverFields = [], siblingFields = [], sectionNumberFields = [], sectionInventoryDrivers = [], sectionTableScreens = [], crossTemplateTableScreens = [], crossTemplateSpreadsheetFields = [], onClose, onSave }: Props) {
  const [form] = Form.useForm()

  const computationOn = Form.useWatch('computationEnabled', form) as boolean | undefined

  const optionsMode = Form.useWatch('optionsMode', form) as 'static' | 'inventory' | 'screenRows' | undefined
  const sourceKey = Form.useWatch(['inventorySource', 'source'], form) as InventorySourceKey | undefined
  const sourceDef = sourceKey ? INVENTORY_SOURCES[sourceKey] : undefined

  // 'screenRows' — options are rows the user already entered into another
  // table screen (any section), not inventory master data.
  const rowSourceSectionId = Form.useWatch(['rowSource', 'sectionId'], form) as string | undefined
  const rowSourceScreenId = Form.useWatch(['rowSource', 'screenId'], form) as string | undefined
  const rowSourceFilterField = Form.useWatch(['rowSource', 'filterField'], form) as string | undefined
  const rowSourceScreen = crossTemplateTableScreens.find(t => t.screenId === rowSourceScreenId)

  const autoFillOn = Form.useWatch('autoFillEnabled', form) as boolean | undefined
  const autoFillMode = (Form.useWatch(['autoFill', 'mode'], form) as 'attribute' | 'mapping' | 'row' | 'spreadsheet' | undefined) ?? 'attribute'
  const autoFillDriverName = Form.useWatch(['autoFill', 'sourceFieldName'], form) as string | undefined
  const driver = driverFields.find(f => f.name === autoFillDriverName)
  const driverSource = driver?.inventorySource?.source as InventorySourceKey | undefined
  const driverRowScreen = driver?.optionsMode === 'screenRows' && driver.rowSource
    ? crossTemplateTableScreens.find(t => t.screenId === driver.rowSource!.screenId)
    : undefined
  const driverColumns = driverSource
    ? INVENTORY_SOURCES[driverSource].columns
    : (driverRowScreen?.fields ?? []).map(f => ({ key: f.name, label: f.label }))

  // Mapping mode needs a materials driver AND a manufacturers driver on-screen.
  const materialDrivers = driverFields.filter(f => f.inventorySource?.source === 'materials')
  const manufacturerDrivers = driverFields.filter(f => f.inventorySource?.source === 'manufacturers')

  // 'spreadsheet' mode — a computed output cell from a SPREADSHEET field
  // anywhere in the template (usually a different section). The source is
  // identified by sectionId+screenId+sourceFieldName (composite key below);
  // `attribute` is the calc template's marked output field key.
  const autoFillSectionId = Form.useWatch(['autoFill', 'sectionId'], form) as string | undefined
  const autoFillScreenId = Form.useWatch(['autoFill', 'screenId'], form) as string | undefined
  const spreadsheetSourceKey = autoFillSectionId && autoFillScreenId && autoFillDriverName
    ? `${autoFillSectionId}::${autoFillScreenId}::${autoFillDriverName}` : undefined
  const spreadsheetSource = crossTemplateSpreadsheetFields.find(
    r => r.sectionId === autoFillSectionId && r.screenId === autoFillScreenId && r.field.name === autoFillDriverName,
  )
  const spreadsheetMeta = spreadsheetSource?.field.spreadsheet
  const { data: pinnedSpreadsheetVersion } = useQuery({
    queryKey: ['calc-template-version-for-autofill', spreadsheetMeta?.calcTemplateId, spreadsheetMeta?.calcTemplateVersion],
    queryFn: () => calcTemplateApi.getVersion(spreadsheetMeta!.calcTemplateId!, spreadsheetMeta!.calcTemplateVersion!),
    enabled: autoFillMode === 'spreadsheet' && spreadsheetMeta?.mode === 'template' && !!spreadsheetMeta.calcTemplateId && !!spreadsheetMeta.calcTemplateVersion,
    staleTime: 5 * 60 * 1000,
  })
  const spreadsheetOutputFields = (
    spreadsheetMeta?.mode === 'template' ? (pinnedSpreadsheetVersion?.metadata.fields ?? []) : (spreadsheetMeta?.fields ?? [])
  ).filter(f => f.role === 'output')
  const canMapping = materialDrivers.length > 0 && manufacturerDrivers.length > 0

  // Lookup types — only needed when the chosen source is the generic lookup table.
  const { data: lookupTypes = [] } = useQuery({
    queryKey: ['lookup-types'],
    queryFn: () => lookupApi.types(),
    enabled: sourceKey === 'lookup',
    staleTime: 5 * 60 * 1000,
  })

  // UOM dimensions — only needed when the chosen source is Units (UOM), to
  // optionally restrict the option list to one dimension (e.g. only "Volume").
  const { data: uomDimensions = [] } = useQuery({
    queryKey: ['uom-dimensions-for-builder'],
    queryFn: () => uomApi.list({ active_only: true }),
    enabled: sourceKey === 'uom',
    staleTime: 5 * 60 * 1000,
  })

  // Departments — only needed for sources with a department_id column
  // (Materials/Equipment/Instrument), to optionally scope the option list to
  // one fixed department chosen by the template author.
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-for-builder'],
    queryFn: () => departmentApi.list(),
    enabled: !!sourceKey && DEPARTMENT_SCOPED_SOURCES.includes(sourceKey),
    staleTime: 5 * 60 * 1000,
  })

  // ATR_REQUEST only: Form Types for the "lock to a specific Form Type"
  // picker — fetched live from ARD master data, same source RaiseAtrButton
  // uses at runtime.
  const { data: atrMasterData } = useQuery({
    queryKey: ['ard-master-data'], queryFn: ardApi.getMasterData, enabled: field?.type === 'ATR_REQUEST',
  })

  // SPREADSHEET only: edited via a separate modal (a live Univer instance,
  // not antd Form.Items), so tracked as plain state rather than form fields.
  const [spreadsheet, setSpreadsheet] = useState<TemplateField['spreadsheet']>(field?.spreadsheet)
  const [spreadsheetModalOpen, setSpreadsheetModalOpen] = useState(false)

  useEffect(() => {
    if (field) {
      // Seed the "auto-populate" list from sibling fields already driven by this
      // dropdown (attribute mode), so the config round-trips on re-open.
      const driven = siblingFields.filter(
        f => (f.autoFill?.mode ?? 'attribute') === 'attribute' && f.autoFill?.sourceFieldName === field.name,
      )
      form.setFieldsValue({
        ...field,
        optionsMode: field.optionsMode ?? 'static',
        autoFillEnabled: !!field.autoFill,
        computationEnabled: !!field.computation,
        autoPopulate: driven.map(f => ({ fieldName: f.name, attribute: f.autoFill!.attribute })),
        autoPopulateEditable: driven.some(f => f.autoFill?.editable),
      })
      setSpreadsheet(field.spreadsheet)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.name, form])

  // When the admin picks a source, seed sensible default value/label columns.
  const onSourceChange = (key: InventorySourceKey) => {
    const def = INVENTORY_SOURCES[key]
    form.setFieldsValue({
      inventorySource: {
        source: key,
        lookupType: undefined,
        dimensionKey: undefined,
        valueField: def.defaultValueField,
        labelField: def.defaultLabelField,
      },
    })
  }

  // When the admin picks a source screen for a 'screenRows' dropdown, reset
  // the dependent value/label/filter fields — they belonged to the previous
  // screen's columns and won't generally still make sense.
  const onRowSourceScreenChange = (key: string) => {
    const [sectionId, screenId] = key.split('::')
    form.setFieldsValue({
      rowSource: { sectionId, screenId, valueField: undefined, labelField: undefined, filterField: undefined, filterValue: undefined },
    })
  }

  if (!field) return null
  const descriptor = descriptorFor(field.type)
  const isDropdown = field.type === 'DROPDOWN'
  const useInventory = isDropdown && optionsMode === 'inventory'
  const useScreenRows = isDropdown && optionsMode === 'screenRows'

  const submit = (vals: Record<string, unknown>) => {
    const merged = { ...field, ...vals } as TemplateField & {
      autoFillEnabled?: boolean
      autoPopulate?: { fieldName?: string; attribute?: string }[]
      autoPopulateEditable?: boolean
      computationEnabled?: boolean
    }
    // Drop inventory/row-source config unless this field actually uses it.
    if (merged.type !== 'DROPDOWN' || merged.optionsMode !== 'inventory') {
      delete merged.inventorySource
    }
    if (merged.type !== 'DROPDOWN' || merged.optionsMode !== 'screenRows') {
      delete merged.rowSource
    }
    // Extract the (non-persisted) auto-populate instruction for the parent.
    let autoPopulate: AutoPopulateApply | undefined
    if (merged.type === 'DROPDOWN' && (merged.optionsMode === 'inventory' || merged.optionsMode === 'screenRows')) {
      const targets = (merged.autoPopulate ?? [])
        .filter(t => t?.fieldName && t?.attribute)
        .map(t => ({ fieldName: t.fieldName!, attribute: t.attribute!, editable: !!merged.autoPopulateEditable }))
      autoPopulate = { driverOldName: field.name, mode: merged.optionsMode === 'screenRows' ? 'row' : 'attribute', targets }
    }
    delete merged.autoPopulate
    delete merged.autoPopulateEditable
    // The switch is a UI-only flag — persist `autoFill` only when it's on.
    if (!merged.autoFillEnabled) {
      delete merged.autoFill
    } else if (merged.autoFill) {
      // Drop the fields belonging to the mode that isn't active.
      const af = { ...merged.autoFill }
      if ((af.mode ?? 'attribute') === 'mapping') {
        delete af.sourceFieldName
        delete af.attribute
        delete af.sectionId
        delete af.screenId
      } else if (af.mode === 'spreadsheet') {
        delete af.materialFieldName
        delete af.manufacturerFieldName
        delete af.mappingAttribute
        af.editable = false // always locked — a live computed value, not a copy the user could "own"
        // sectionId/screenId/sourceFieldName/attribute already set by the
        // "Source spreadsheet"/"Output cell" pickers above; mode stays as-is.
      } else {
        delete af.materialFieldName
        delete af.manufacturerFieldName
        delete af.mappingAttribute
        delete af.sectionId
        delete af.screenId
        // Not a manual choice outside mapping/spreadsheet — implied by the
        // chosen driver's own optionsMode ('row' for a screenRows-backed driver).
        const chosenDriver = driverFields.find(f => f.name === af.sourceFieldName)
        af.mode = chosenDriver?.optionsMode === 'screenRows' ? 'row' : 'attribute'
      }
      merged.autoFill = af
    }
    delete merged.autoFillEnabled
    // Same on/off-switch pattern as auto-fill above — persist `computation`
    // only when the switch is on and a target field is chosen.
    if (!merged.computationEnabled || !merged.computation?.targetFieldName) {
      delete merged.computation
    }
    delete merged.computationEnabled
    // Drop incomplete/empty mirror rules — each needs a source, target, and
    // at least one column mapping to be worth persisting.
    if (merged.mirrorOnLock) {
      const rules = merged.mirrorOnLock
        .filter(r => r?.sourceScreenId && r?.targetScreenId && (r.columns ?? []).some(c => c?.sourceFieldName && c?.targetFieldName))
        .map(r => ({ ...r, columns: r.columns.filter(c => c?.sourceFieldName && c?.targetFieldName) }))
      if (rules.length > 0) merged.mirrorOnLock = rules
      else delete merged.mirrorOnLock
    }
    // Not an antd Form field — edited via SpreadsheetFieldEditorModal, tracked
    // as separate component state (see the useState/useEffect above).
    if (merged.type === 'SPREADSHEET') merged.spreadsheet = spreadsheet
    else delete merged.spreadsheet
    if (merged.type !== 'ATR_REQUEST') {
      delete merged.atrRequestConfig
    } else if (merged.atrRequestConfig) {
      merged.atrRequestConfig = { ...merged.atrRequestConfig, lockedFormTypeId: merged.atrRequestConfig.lockedFormTypeId ?? null }
    }
    if (merged.type !== 'USAGE_LOG_START_STOP') {
      delete merged.usageLogConfig
    }
    // repeatConfig.screens is not authored in the drawer — preserve the existing
    // sub-screens and only update the two text labels from the form.
    if (merged.type === 'REPEATING_GROUP') {
      merged.repeatConfig = {
        screens: field.repeatConfig?.screens ?? [],
        addButtonLabel: (merged.repeatConfig as { addButtonLabel?: string } | undefined)?.addButtonLabel ?? 'Add item',
        itemLabel: (merged.repeatConfig as { itemLabel?: string } | undefined)?.itemLabel ?? 'Item',
      }
    } else {
      delete merged.repeatConfig
    }
    onSave(merged as TemplateField, autoPopulate)
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
                <Form.Item label="Unit" name="unit" className="col-span-2">
                  <Input placeholder="e.g. °C" />
                </Form.Item>
              </div>
            )}

            {field.type === 'NUMBER' && sectionNumberFields.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Computation</p>
                <Form.Item name="computationEnabled" valuePropName="checked" className="mb-2">
                  <Switch size="small" checkedChildren="On" unCheckedChildren="Off" />
                </Form.Item>
                {computationOn && (
                  <div className="space-y-3">
                    <Form.Item name={['computation', 'operation']} initialValue="subtract" className="mb-1">
                      <Segmented
                        size="small"
                        options={[
                          { label: 'Subtract from', value: 'subtract' },
                          { label: 'Add to', value: 'add' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      label="Target field"
                      name={['computation', 'targetFieldName']}
                      rules={[{ required: true, message: 'Pick a target field' }]}
                    >
                      <Select
                        placeholder="Select a Number field"
                        options={sectionNumberFields.map(f => ({ value: f.name, label: f.label }))}
                      />
                    </Form.Item>
                    <p className="text-[11px] text-slate-400">
                      When this field's value is entered, it is added to or subtracted from the target field
                      (anywhere in this section, including a table column — applied to its first row).
                      Applied once when the value is committed, not continuously recalculated.
                    </p>
                  </div>
                )}
              </>
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
                        { label: 'From another screen', value: 'screenRows' },
                      ]}
                    />
                  </Form.Item>
                )}

                {!useInventory && !useScreenRows && (
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
                    {sourceKey && DEPARTMENT_SCOPED_SOURCES.includes(sourceKey) && (
                      <Form.Item
                        label="Department"
                        name={['inventorySource', 'departmentId']}
                        help="Scope this dropdown to one department's records at runtime — fixed for every chemist who runs this template. Leave blank to show every department."
                      >
                        <Select
                          placeholder="All departments"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={departments.map(d => ({ value: d.id, label: d.name }))}
                        />
                      </Form.Item>
                    )}
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

                    {sourceDef?.supportsDimensionFilter && (
                      <Form.Item
                        label="Dimension (optional)"
                        name={['inventorySource', 'dimensionKey']}
                        help="Restrict the option list to one UOM dimension, e.g. only Volume units. Leave blank to show every unit across every dimension."
                      >
                        <Select
                          placeholder="All dimensions"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={uomDimensions.map(d => ({ value: d.dimension_key, label: d.display_name }))}
                        />
                      </Form.Item>
                    )}

                    {sourceDef?.filterByParent && (() => {
                      const parentDrivers = sectionInventoryDrivers.filter(
                        f => f.inventorySource?.source === sourceDef.filterByParent!.parentSource,
                      )
                      const parentLabel = INVENTORY_SOURCES[sourceDef.filterByParent.parentSource].label
                      return parentDrivers.length > 0 ? (
                        <Form.Item
                          label={`Filter by ${parentLabel} field`}
                          name={['inventorySource', 'filterByField']}
                          rules={[{ required: true, message: 'Pick the driver dropdown' }]}
                          extra={`Only rows tied to the value chosen in that dropdown are listed. It can be on this screen or another screen in the same section.`}
                        >
                          <Select
                            placeholder={`Select a ${parentLabel} dropdown`}
                            options={parentDrivers.map(f => ({ value: f.name, label: f.label }))}
                          />
                        </Form.Item>
                      ) : (
                        <p className="text-[11px] text-amber-600">
                          Add a {parentLabel} dropdown to this section first — this list is filtered by the selected value.
                        </p>
                      )
                    })()}

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

                {useScreenRows && (
                  <div className="space-y-3">
                    <Form.Item label="Source screen" required>
                      <Select
                        placeholder="Select a table screen"
                        value={rowSourceScreenId ? `${rowSourceSectionId}::${rowSourceScreenId}` : undefined}
                        onChange={onRowSourceScreenChange}
                        options={crossTemplateTableScreens.map(t => ({
                          value: `${t.sectionId}::${t.screenId}`,
                          label: `${t.sectionTitle} — ${t.screenTitle}`,
                        }))}
                      />
                    </Form.Item>
                    {/* Tracked in the form store so they submit correctly — the combined picker above sets both at once. */}
                    <Form.Item name={['rowSource', 'sectionId']} hidden><Input /></Form.Item>
                    <Form.Item name={['rowSource', 'screenId']} hidden><Input /></Form.Item>

                    {rowSourceScreen && (
                      <div className="grid grid-cols-2 gap-3">
                        <Form.Item
                          label="Show (label)"
                          name={['rowSource', 'labelField']}
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Select options={rowSourceScreen.fields.map(f => ({ value: f.name, label: f.label }))} />
                        </Form.Item>
                        <Form.Item
                          label="Store (value)"
                          name={['rowSource', 'valueField']}
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Select options={rowSourceScreen.fields.map(f => ({ value: f.name, label: f.label }))} />
                        </Form.Item>
                      </div>
                    )}

                    {rowSourceScreen && (
                      <>
                        <Form.Item label="Filter by column (optional)" name={['rowSource', 'filterField']}>
                          <Select
                            allowClear
                            placeholder="No filter — show every row"
                            options={rowSourceScreen.fields.map(f => ({ value: f.name, label: f.label }))}
                          />
                        </Form.Item>
                        {rowSourceFilterField && (
                          <Form.Item
                            label="Filter value"
                            name={['rowSource', 'filterValue']}
                            rules={[{ required: true, message: 'Required' }]}
                            extra="Must exactly match the stored value of that column (e.g. an inventory id) — not the label shown to the user."
                          >
                            <Input />
                          </Form.Item>
                        )}
                      </>
                    )}

                    <p className="text-[11px] text-slate-400">
                      Options are rows the user has already entered into that screen — not inventory master data.
                      Empty until the user fills in the source screen.
                    </p>
                  </div>
                )}
              </>
            )}

            {(useInventory || useScreenRows) && (sourceDef || rowSourceScreen) && siblingFields.length > 0 && (() => {
              const thisDriverColumns = useScreenRows
                ? (rowSourceScreen?.fields ?? []).map(f => ({ key: f.name, label: f.label }))
                : (sourceDef?.columns ?? [])
              return (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">Auto-populate fields</p>
                <p className="text-[11px] text-slate-400 mb-2">
                  Pick which fields on this screen fill automatically when a record is selected here — each from a column of the selected row.
                </p>
                <Form.List name="autoPopulate">
                  {(rows, { add, remove }) => (
                    <div className="space-y-2">
                      {rows.map(({ key, name }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Form.Item name={[name, 'fieldName']} noStyle rules={[{ required: true, message: 'Field' }]}>
                            <Select
                              placeholder="Field to fill"
                              className="flex-1"
                              size="small"
                              options={siblingFields.map(f => ({ value: f.name, label: f.label }))}
                            />
                          </Form.Item>
                          <span className="text-slate-400 text-xs">←</span>
                          <Form.Item name={[name, 'attribute']} noStyle rules={[{ required: true, message: 'Attribute' }]}>
                            <Select
                              placeholder="Attribute"
                              className="flex-1"
                              size="small"
                              options={thisDriverColumns.map(c => ({ value: c.key, label: c.label }))}
                            />
                          </Form.Item>
                          <button type="button" onClick={() => remove(name)} className="text-slate-400 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <Button size="small" icon={<Plus size={12} />} onClick={() => add({})}>Add field</Button>
                    </div>
                  )}
                </Form.List>
                <div className="flex items-center gap-2 mt-2">
                  <Form.Item name="autoPopulateEditable" valuePropName="checked" noStyle>
                    <Switch size="small" />
                  </Form.Item>
                  <span className="text-[12px] text-slate-500">Allow override (fields stay editable)</span>
                </div>
              </>
              )
            })()}

            {(driverFields.length > 0 || crossTemplateSpreadsheetFields.length > 0) && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2 mt-4">Auto-fill</p>
                <Form.Item name="autoFillEnabled" valuePropName="checked" className="mb-2">
                  <Switch size="small" checkedChildren="On" unCheckedChildren="Off" />
                </Form.Item>
                {autoFillOn && (
                  <div className="space-y-3">
                    {(canMapping || crossTemplateSpreadsheetFields.length > 0) && (
                      <Form.Item name={['autoFill', 'mode']} initialValue="attribute" className="mb-1">
                        <Segmented
                          size="small"
                          options={[
                            { label: 'Copy field', value: 'attribute' },
                            ...(canMapping ? [{ label: 'Material + Mfr → mapping', value: 'mapping' }] : []),
                            ...(crossTemplateSpreadsheetFields.length > 0 ? [{ label: 'Spreadsheet output', value: 'spreadsheet' }] : []),
                          ]}
                        />
                      </Form.Item>
                    )}

                    {autoFillMode === 'attribute' && (
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

                    {autoFillMode === 'spreadsheet' && (
                      <>
                        {/* Registered so Form.useWatch(['autoFill', 'sectionId'|'screenId']) actually
                            fires re-renders — otherwise the store holds the value (setFieldsValue
                            works fine) but no Field is subscribed to it, so useWatch never updates. */}
                        <Form.Item name={['autoFill', 'sectionId']} noStyle>
                          <Input type="hidden" />
                        </Form.Item>
                        <Form.Item name={['autoFill', 'screenId']} noStyle>
                          <Input type="hidden" />
                        </Form.Item>
                        <Form.Item name={['autoFill', 'sourceFieldName']} noStyle>
                          <Input type="hidden" />
                        </Form.Item>
                        <Form.Item
                          label="Source spreadsheet"
                          rules={[{ required: true, message: 'Pick a spreadsheet field' }]}
                        >
                          <Select
                            placeholder="Select a Spreadsheet field (any section)"
                            value={spreadsheetSourceKey}
                            onChange={(v: string) => {
                              const [sectionId, screenId, fieldName] = v.split('::')
                              form.setFieldsValue({ autoFill: { ...form.getFieldValue('autoFill'), sectionId, screenId, sourceFieldName: fieldName, attribute: undefined } })
                            }}
                            options={crossTemplateSpreadsheetFields.map(r => ({
                              value: `${r.sectionId}::${r.screenId}::${r.field.name}`,
                              label: `${r.sectionTitle} — ${r.field.label}`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item
                          label="Output cell"
                          name={['autoFill', 'attribute']}
                          rules={[{ required: true, message: 'Pick an output cell' }]}
                        >
                          <Select
                            placeholder={spreadsheetSource ? 'Select an output cell' : 'Pick a source spreadsheet first'}
                            disabled={!spreadsheetSource}
                            options={spreadsheetOutputFields.map(f => ({ value: f.key, label: `${f.label} (${f.display})` }))}
                          />
                        </Form.Item>
                        <p className="text-[11px] text-slate-400">
                          Live computed value from that spreadsheet's current cells — re-evaluates whenever its inputs
                          change, not a one-time copy. Read-only regardless of the "Editable" toggle below.
                        </p>
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

                    {autoFillMode !== 'spreadsheet' && (
                      <>
                        <Form.Item label="Editable" name={['autoFill', 'editable']} valuePropName="checked" className="mb-1">
                          <Switch size="small" />
                        </Form.Item>
                        <p className="text-[11px] text-slate-400">
                          Off = value is locked to the selected record. On = auto-filled, but the user may override it.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {field.type === 'LOCK_TOGGLE' && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">Mirror rows on lock</p>
            <p className="text-[11px] text-slate-400 mb-2">
              When this button locks, copy rows from a table screen above it into another table screen — the picked
              columns land read-only in the target; its other columns stay editable for the next step.
            </p>
            {sectionTableScreens.length < 2 ? (
              <p className="text-[11px] text-amber-600">
                Add at least two table screens to this section first (a source and a target) to set up a mirror rule.
              </p>
            ) : (
              <Form.List name="mirrorOnLock">
                {(rules, { add, remove }) => (
                  <div className="space-y-3">
                    {rules.map(({ key, name }) => (
                      <MirrorRuleRow
                        key={key}
                        name={name}
                        form={form}
                        sectionTableScreens={sectionTableScreens}
                        onRemove={() => remove(name)}
                      />
                    ))}
                    <Button size="small" icon={<Plus size={12} />} onClick={() => add({ columns: [] })}>Add mirror rule</Button>
                  </div>
                )}
              </Form.List>
            )}
          </>
        )}

        {field.type === 'SPREADSHEET' && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">Spreadsheet</p>
            <p className="text-[11px] text-slate-400 mb-2">
              Author a sheet inline, or reference one already published in Admin &gt; Calc Templates (pinned to its
              current version). Computed client-side at runtime, same trust level as every other field on this screen.
            </p>
            <Button icon={<Table2 size={13} />} onClick={() => setSpreadsheetModalOpen(true)}>
              {spreadsheet?.workbookData || spreadsheet?.calcTemplateId ? 'Edit Spreadsheet' : 'Create Spreadsheet'}
            </Button>
            {spreadsheet?.mode === 'template' && spreadsheet.calcTemplateId ? (
              <p className="text-[11px] text-slate-400 mt-2">
                References <b>{spreadsheet.calcTemplateName ?? spreadsheet.calcTemplateId}</b>, pinned to version {spreadsheet.calcTemplateVersion}.
              </p>
            ) : spreadsheet?.fields && spreadsheet.fields.length > 0 ? (
              <p className="text-[11px] text-slate-400 mt-2">
                {spreadsheet.fields.filter(f => f.role === 'input').length} input field(s),{' '}
                {spreadsheet.fields.filter(f => f.role === 'output').length} output field(s),{' '}
                {spreadsheet.protectedRanges.length} locked range(s).
              </p>
            ) : null}
          </>
        )}

        {field.type === 'REPEATING_GROUP' && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">Repeating Group</p>
            <Form.Item label="Item Label" name={['repeatConfig', 'itemLabel']}>
              <Input placeholder="e.g. Buffer" />
            </Form.Item>
            <Form.Item label="Add Button Label" name={['repeatConfig', 'addButtonLabel']}>
              <Input placeholder="e.g. Add Buffer" />
            </Form.Item>
            <p className="text-[11px] text-slate-400">
              Sub-screens are defined in the template seed —{' '}
              {field.repeatConfig?.screens?.length ?? 0} sub-screen(s) configured.
              They cannot be edited here.
            </p>
          </>
        )}
        {field.type === 'ATR_REQUEST' && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">ATR Request</p>
            <p className="text-[11px] text-slate-400 mb-2">
              Control which sections of the ATR Form appear when this element is raised — at runtime and in Builder Preview alike.
            </p>
            <div className="space-y-1 mb-3">
              <Form.Item name={['atrRequestConfig', 'showFormAttributes']} valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Form Attributes</Checkbox>
              </Form.Item>
              <br />
              <Form.Item name={['atrRequestConfig', 'showSampleDetails']} valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Sample Details</Checkbox>
              </Form.Item>
              <br />
              <Form.Item name={['atrRequestConfig', 'showTestDetails']} valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Test Details</Checkbox>
              </Form.Item>
              <br />
              <Form.Item name={['atrRequestConfig', 'showSupportingDocs']} valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>Supporting Docs</Checkbox>
              </Form.Item>
              <br />
              <Form.Item name={['atrRequestConfig', 'showQaCertification']} valuePropName="checked" initialValue={true} noStyle>
                <Checkbox>QA Certification</Checkbox>
              </Form.Item>
            </div>
            <Form.Item
              label="Lock to a specific Form Type (optional)"
              name={['atrRequestConfig', 'lockedFormTypeId']}
              help="If set, the 'Form Type' picker modal is skipped entirely — clicking the button creates the ATR straight away using this Form Type."
            >
              <Select
                allowClear
                placeholder="— let the user choose —"
                options={(atrMasterData?.formTypes ?? []).map(f => ({ value: f.id, label: f.name }))}
              />
            </Form.Item>
          </>
        )}
        {field.type === 'USAGE_LOG_START_STOP' && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1 mt-4">Equipment Start/Stop</p>
            <p className="text-[11px] text-slate-400 mb-2">
              Renders "Start"/"End" buttons that open/close a real inventory usage-log session, flipping the
              catalogue item's status AVAILABLE ↔ IN_USE. Reads the numeric catalogue id from another column on
              this same table screen.
            </p>
            <Form.Item
              label="Target"
              name={['usageLogConfig', 'targetKind']}
              initialValue="EQUIPMENT"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Select
                options={[
                  { value: 'EQUIPMENT', label: 'Equipment' },
                  { value: 'INSTRUMENT', label: 'Instrument' },
                ]}
              />
            </Form.Item>
            {siblingFields.length > 0 ? (
              <Form.Item
                label="Equipment/Instrument ID field"
                name={['usageLogConfig', 'idFieldName']}
                help="A field on this same table screen holding the numeric catalogue id for this row — typically a read-only autofilled column."
              >
                <Select
                  allowClear
                  placeholder="Not configured"
                  options={siblingFields.map(f => ({ value: f.name, label: f.label }))}
                />
              </Form.Item>
            ) : (
              <p className="text-[11px] text-amber-600">
                Add another column to this table screen first — e.g. a read-only autofilled column holding the
                catalogue's numeric id — then pick it here.
              </p>
            )}
          </>
        )}
      </Form>

      {field.type === 'SPREADSHEET' && (
        <SpreadsheetFieldEditorModal
          open={spreadsheetModalOpen}
          spreadsheet={spreadsheet}
          onClose={() => setSpreadsheetModalOpen(false)}
          onSave={next => { setSpreadsheet(next); setSpreadsheetModalOpen(false) }}
        />
      )}
    </Drawer>
  )
}

// One "mirror rule" row (source table -> target table + column mappings).
// Split out from the parent so its Form.useWatch calls — which depend on
// this row's own name-path — stay a fixed number of hook calls per row,
// instead of varying with Form.List's row count inside a .map().
function MirrorRuleRow({ name, form, sectionTableScreens, onRemove }: {
  name: number
  form: FormInstance
  sectionTableScreens: TemplateScreen[]
  onRemove: () => void
}) {
  const sourceScreenId = Form.useWatch(['mirrorOnLock', name, 'sourceScreenId'], form) as string | undefined
  const targetScreenId = Form.useWatch(['mirrorOnLock', name, 'targetScreenId'], form) as string | undefined
  const sourceScreen = sectionTableScreens.find(s => s.id === sourceScreenId)
  const targetScreen = sectionTableScreens.find(s => s.id === targetScreenId)

  return (
    <div className="border border-slate-200 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Form.Item name={[name, 'sourceScreenId']} noStyle rules={[{ required: true, message: 'Source table' }]}>
          <Select
            placeholder="From table"
            size="small"
            className="flex-1"
            options={sectionTableScreens.map(s => ({ value: s.id, label: s.title }))}
            onChange={() => form.setFieldValue(['mirrorOnLock', name, 'columns'], [])}
          />
        </Form.Item>
        <span className="text-slate-400 text-xs shrink-0">→</span>
        <Form.Item name={[name, 'targetScreenId']} noStyle rules={[{ required: true, message: 'Target table' }]}>
          <Select
            placeholder="Into table"
            size="small"
            className="flex-1"
            options={sectionTableScreens.filter(s => s.id !== sourceScreenId).map(s => ({ value: s.id, label: s.title }))}
            onChange={() => form.setFieldValue(['mirrorOnLock', name, 'columns'], [])}
          />
        </Form.Item>
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-500 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>

      {sourceScreen && targetScreen && (
        <Form.List name={[name, 'columns']}>
          {(cols, { add: addCol, remove: removeCol }) => (
            <div className="space-y-1.5 pl-1">
              {cols.map(c => (
                <div key={c.key} className="flex items-center gap-2">
                  <Form.Item name={[c.name, 'sourceFieldName']} noStyle rules={[{ required: true, message: 'Column' }]}>
                    <Select
                      placeholder="Column"
                      size="small"
                      className="flex-1"
                      options={sourceScreen.fields.map(f => ({ value: f.name, label: f.label }))}
                    />
                  </Form.Item>
                  <span className="text-slate-400 text-xs shrink-0">←</span>
                  <Form.Item name={[c.name, 'targetFieldName']} noStyle rules={[{ required: true, message: 'Column' }]}>
                    <Select
                      placeholder="Into column"
                      size="small"
                      className="flex-1"
                      options={targetScreen.fields.map(f => ({ value: f.name, label: f.label }))}
                    />
                  </Form.Item>
                  <button type="button" onClick={() => removeCol(c.name)} className="text-slate-400 hover:text-red-500 shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <Button size="small" icon={<Plus size={11} />} onClick={() => addCol({})}>Add column</Button>
            </div>
          )}
        </Form.List>
      )}
    </div>
  )
}
