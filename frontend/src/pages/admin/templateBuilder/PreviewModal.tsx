import { Modal } from 'antd'
import { glassModalProps } from '../../../utils/modalStyles'
import FieldPreview from './FieldPreview'
import type { TemplateDefinition } from './types'

// Renders the template exactly as an end user would see it — respects
// required/readOnly/hidden, shows dropdown values, renders attachments/images.
export default function PreviewModal({ open, onClose, definition, title }: {
  open: boolean
  onClose: () => void
  definition: TemplateDefinition
  title: string
}) {
  return (
    <Modal
      title={`Preview — ${title}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      centered
      destroyOnHidden
      {...glassModalProps}
    >
      <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-1 -mr-1">
        {definition.sections.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">This template has no sections yet.</p>
        )}
        {definition.sections.map(section => (
          <div key={section.id} className="glass-card rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">{section.title}</p>
            <div style={{ display: 'grid', gridTemplateColumns: section.columns === 2 ? '1fr 1fr' : '1fr', gap: '14px' }}>
              {section.fields.map(field => (
                <div key={field.id} style={{ gridColumn: field.colSpan === 2 ? 'span 2' : undefined }}>
                  <FieldPreview field={field} interactive />
                </div>
              ))}
              {section.fields.length === 0 && <p className="text-xs text-slate-300 col-span-full">No fields in this section.</p>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
