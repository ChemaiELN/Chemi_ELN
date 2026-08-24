import { Form, Input, Modal, Alert } from 'antd'
import { PenLine } from 'lucide-react'
import { glassModalProps } from '../../../utils/modalStyles'

interface PasswordSignatureModalProps {
  open: boolean
  title: string
  message: string
  loading?: boolean
  error?: string | null
  onSign: (password: string) => void
  onCancel: () => void
}

// CGT's e-signature: password re-entry proves identity at the moment of
// signing (chemist submit / HOD approve), rather than ADC's free-text
// reason — the CGT sign-off requirement calls for an actual password check.
export default function PasswordSignatureModal({
  open,
  title,
  message,
  loading,
  error,
  onSign,
  onCancel,
}: PasswordSignatureModalProps) {
  const [form] = Form.useForm()

  const handleOk = async () => {
    const vals = await form.validateFields()
    onSign(vals.password)
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
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow shadow-violet-500/30">
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
      width={420}
      centered
      {...glassModalProps}
    >
      <div className="py-2 space-y-4">
        <Alert message={message} type="info" showIcon className="text-sm" />
        {error && <Alert message={error} type="error" showIcon className="text-sm" />}
        <Form form={form} layout="vertical" requiredMark={false} onFinish={handleOk}>
          <Form.Item
            label="Your Password"
            name="password"
            rules={[{ required: true, message: 'Please enter your password to sign' }]}
          >
            <Input.Password placeholder="Enter your password" autoFocus />
          </Form.Item>
        </Form>
        <p className="text-xs text-slate-400">
          Re-entering your password is your electronic signature. This action is logged and cannot be undone.
        </p>
      </div>
    </Modal>
  )
}
