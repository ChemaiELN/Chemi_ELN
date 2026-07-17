import { Input, InputNumber, DatePicker, Select, Checkbox, Radio } from 'antd'
import { Paperclip } from 'lucide-react'
import dayjs from 'dayjs'
import type { TemplateField } from '../../admin/templateBuilder/types'
import { useInventoryOptions } from '../../admin/templateBuilder/useInventoryOptions'

// Renders ONE runtime control for a TemplateField (the same JSON shape the
// CGT Template Builder produces — section -> screen -> field, with `id`/`name`
// rather than ADC's legacy `key` schema, so ADC's FieldRenderer doesn't apply
// here). Fully controlled (value + onChange) for real data capture, unlike
// FieldPreview.tsx (templateBuilder) which only demos fields with defaultValue.
//
// Simplification: ATTACHMENT/IMAGE render a disabled placeholder — no file
// storage endpoint is wired for CGT experiments yet.
export default function CgtFieldControl({ field, value, onChange, disabled }: {
  field: TemplateField
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  // Auto-filled fields are read-only unless explicitly marked editable — their
  // value is derived from the driver dropdown's selected record.
  const locked = !!field.autoFill && !field.autoFill.editable
  const dis = disabled || locked
  const commonProps = { placeholder: field.placeholder, disabled: dis }
  // Static or inventory-backed dropdown options (no-op fetch for static fields).
  const { options: dropdownOptions, loading: optionsLoading } = useInventoryOptions(field)

  switch (field.type) {
    case 'SECTION_HEADING':
      return <div className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-1.5">{field.label}</div>
    case 'SPACER':
      return <div className="h-6" />
    case 'SINGLE_LINE_TEXT':
      return <Input {...commonProps} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={field.maxLength} />
    case 'MULTI_LINE_TEXT':
      return <Input.TextArea {...commonProps} rows={3} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} maxLength={field.maxLength} />
    case 'NUMBER':
      return (
        <InputNumber
          {...commonProps} className="w-full"
          value={value === '' || value == null ? undefined : Number(value)}
          onChange={v => onChange(v)}
          min={field.minValue} max={field.maxValue}
        />
      )
    case 'DATE':
      return (
        <DatePicker
          className="w-full" disabled={dis}
          value={value ? dayjs(value as string) : null}
          onChange={d => onChange(d ? d.format('YYYY-MM-DD') : null)}
        />
      )
    case 'DATE_TIME':
      return (
        <DatePicker
          showTime className="w-full" disabled={dis}
          value={value ? dayjs(value as string) : null}
          onChange={d => onChange(d ? d.toISOString() : null)}
        />
      )
    case 'DROPDOWN':
      return (
        <Select
          className="w-full" placeholder={field.placeholder ?? 'Select…'} disabled={dis}
          value={(value as string) || undefined}
          onChange={v => onChange(v)}
          options={dropdownOptions}
          loading={optionsLoading}
          showSearch
          optionFilterProp="label"
          allowClear
        />
      )
    case 'CHECKBOX':
      return <Checkbox disabled={dis} checked={!!value} onChange={e => onChange(e.target.checked)}>{field.placeholder || 'Yes'}</Checkbox>
    case 'CHECKLIST':
      return (
        <Checkbox.Group
          disabled={dis}
          value={(value as string[]) ?? []}
          onChange={v => onChange(v)}
          options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          className="flex flex-col gap-1"
        />
      )
    case 'RADIO':
      return (
        <Radio.Group disabled={dis} value={(value as string) ?? undefined} onChange={e => onChange(e.target.value)}>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(field.options ?? []).map(o => <Radio key={o} value={o}>{o}</Radio>)}
          </div>
        </Radio.Group>
      )
    case 'ATTACHMENT':
    case 'IMAGE':
      return (
        <button type="button" disabled className="flex items-center gap-1.5 text-xs text-slate-400 border border-dashed border-slate-200 rounded-md px-3 py-1.5 cursor-not-allowed">
          <Paperclip size={12} /> File upload not yet available
        </button>
      )
    default:
      return null
  }
}
