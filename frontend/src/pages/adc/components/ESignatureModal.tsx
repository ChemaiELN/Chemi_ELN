import { Form, Input, Modal, Alert } from 'antd'
import { PenLine } from 'lucide-react'
import { glassModalProps } from '../../../utils/modalStyles'

interface ESignatureModalProps {
  open: boolean
  title?: string
  message?: string
  loading?: boolean
  onSign: (reason: string) => void
  onCancel: () => void
}

export default function ESignatureModal({
  open,
  title = 'Electronic Signature',
  message = 'By signing, you confirm the accuracy and completeness of the recorded data. This signature is legally binding.',
  loading,
  onSign,
  onCancel,
}: ESignatureModalProps) {
  const [form] = Form.useForm()

  const handleOk = async () => {
    const vals = await form.validateFields()
    onSign(vals.reason)
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow shadow-indigo-500/30">
            <PenLine size={14} className="text-white" />
          </div>
          <span>{title}</span>
        </div>
      }
      okText="Sign & Confirm"
      cancelText="Cancel"
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      destroyOnHidden
      width={460}
      centered
      {...glassModalProps}
    >
      <div className="py-2 space-y-4">
        <Alert
          message={message}
          type="info"
          showIcon
          className="text-sm"
        />
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            label="Reason / Justification"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason for signing' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="e.g. All data reviewed and confirmed accurate."
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
        <p className="text-xs text-slate-400">
          Your identity is confirmed by your active session. This action is logged and cannot be undone.
        </p>
      </div>
    </Modal>
  )
}
