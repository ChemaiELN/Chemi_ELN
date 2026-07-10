import { Input, InputNumber, DatePicker, Select, Checkbox, Radio, Switch, Upload } from 'antd'
import { Paperclip, Image as ImageIcon } from 'lucide-react'
import type { TemplateField } from './types'

// Renders a single field exactly as an end user would see it — used by both
// the design canvas (non-interactive, for layout preview) and the real
// Preview modal (interactive, respects required/readOnly/hidden).
export default function FieldPreview({ field, interactive = false }: { field: TemplateField; interactive?: boolean }) {
  if (field.hidden && !interactive) {
    return <div className="text-xs text-slate-400 italic border border-dashed border-slate-200 rounded px-2 py-1.5">Hidden field: {field.label}</div>
  }
  if (field.hidden && interactive) return null

  const commonProps = { placeholder: field.placeholder, disabled: field.readOnly || !interactive }

  const control = (() => {
    switch (field.type) {
      case 'SECTION_HEADING':
        return <div className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-1.5">{field.label}</div>
      case 'SPACER':
        return <div className="h-6" />
      case 'SINGLE_LINE_TEXT':
        return <Input {...commonProps} defaultValue={field.defaultValue} maxLength={field.maxLength} />
      case 'MULTI_LINE_TEXT':
        return <Input.TextArea {...commonProps} rows={3} defaultValue={field.defaultValue} maxLength={field.maxLength} />
      case 'NUMBER':
        return <InputNumber {...commonProps} className="w-full" defaultValue={field.defaultValue ? Number(field.defaultValue) : undefined} min={field.minValue} max={field.maxValue} />
      case 'DATE':
        return <DatePicker className="w-full" disabled={field.readOnly || !interactive} />
      case 'DATE_TIME':
        return <DatePicker showTime className="w-full" disabled={field.readOnly || !interactive} />
      case 'YES_NO':
        return <Switch disabled={field.readOnly || !interactive} defaultChecked={field.defaultValue === 'true'} />
      case 'DROPDOWN':
        return (
          <Select
            className="w-full"
            placeholder={field.placeholder ?? 'Select…'}
            disabled={field.readOnly || !interactive}
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
          />
        )
      case 'CHECKBOX':
        return <Checkbox disabled={field.readOnly || !interactive} defaultChecked={field.defaultValue === 'true'}>{field.placeholder || 'Yes'}</Checkbox>
      case 'CHECKLIST':
        return (
          <Checkbox.Group
            disabled={field.readOnly || !interactive}
            options={(field.options ?? []).map(o => ({ value: o, label: o }))}
            className="flex flex-col gap-1"
          />
        )
      case 'RADIO':
        return (
          <Radio.Group disabled={field.readOnly || !interactive}>
            <div className="flex flex-col gap-1">
              {(field.options ?? []).map(o => <Radio key={o} value={o}>{o}</Radio>)}
            </div>
          </Radio.Group>
        )
      case 'ATTACHMENT':
        return (
          <Upload disabled={field.readOnly || !interactive} beforeUpload={() => false}>
            <button type="button" className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50">
              <Paperclip size={12} /> Attach file
            </button>
          </Upload>
        )
      case 'IMAGE':
        return (
          <Upload disabled={field.readOnly || !interactive} listType="picture-card" beforeUpload={() => false} showUploadList={false}>
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <ImageIcon size={16} />
              <span className="text-[11px]">Upload</span>
            </div>
          </Upload>
        )
      default:
        return null
    }
  })()

  if (field.type === 'SECTION_HEADING' || field.type === 'SPACER') return control

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      {control}
      {field.helpText && <p className="text-[11px] text-slate-400 mt-1">{field.helpText}</p>}
    </div>
  )
}
