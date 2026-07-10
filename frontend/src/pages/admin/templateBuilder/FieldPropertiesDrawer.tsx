import { useEffect } from 'react'
import { Drawer, Form, Input, InputNumber, Switch, Select, Button } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import { descriptorFor, type TemplateField } from './types'

interface Props {
  field: TemplateField | null
  onClose: () => void
  onSave: (field: TemplateField) => void
}

// Right-side property editor for a single field — Basic Info / Field Type /
// Validation / Options, matching the "Field Configuration" requirement.
// Layout-only fields (Section heading, Spacer) skip validation entirely.
export default function FieldPropertiesDrawer({ field, onClose, onSave }: Props) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (field) form.setFieldsValue(field)
  }, [field, form])

  if (!field) return null
  const descriptor = descriptorFor(field.type)

  const submit = (vals: Record<string, unknown>) => {
    onSave({ ...field, ...vals } as TemplateField)
  }

  return (
    <Drawer
      title={`Edit Field — ${descriptor.label}`}
      open={!!field}
      onClose={onClose}
      width={420}
      destroyOnHidden
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
                <p className="text-[11px] text-slate-400 mb-2">Static options — dynamic (API-backed) options coming in a future update.</p>
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
              </>
            )}
          </>
        )}
      </Form>
    </Drawer>
  )
}
