import { useState } from 'react'
import { Modal, Form, Input, Typography, message } from 'antd'
import { ShieldCheck } from 'lucide-react'
import { authApi } from '../../api/auth'
import { glassModalProps } from '../../utils/modalStyles'

const { Paragraph, Text } = Typography

export type ESignaturePayload = {
  userName: string
  password: string
  reason?: string
}

export type ESignatureModalProps = {
  open: boolean
  title?: string
  description?: string
  userName: string
  requireReason?: boolean
  reasonLabel?: string
  loading?: boolean
  onCancel: () => void
  onConfirm: (payload: ESignaturePayload) => void | Promise<void>
}

/** GxP Electronic Signature / Re-authentication Modal */
export function ESignatureModal({
  open,
  title = 'Electronic Signature',
  description = 'Re-enter your credentials to confirm this sensitive action.',
  userName,
  requireReason = true,
  reasonLabel = 'Reason for signing',
  loading = false,
  onCancel,
  onConfirm,
}: ESignatureModalProps) {
  const [form] = Form.useForm<ESignaturePayload>()
  const [submitting, setSubmitting] = useState(false)

  const handleFinish = async (values: ESignaturePayload) => {
    setSubmitting(true)
    try {
      await authApi.verifyPassword(values.password)
      await onConfirm({
        userName,
        password: values.password,
        reason: values.reason,
      })
      form.resetFields()
    } catch (err: any) {
      const msg = err?.detail || err?.message || 'Incorrect password — electronic signature not verified.'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      {...glassModalProps}
      title={
        <div className="flex items-center gap-2 text-indigo-900 font-bold text-base">
          <ShieldCheck size={20} className="text-indigo-600" />
          <span>{title}</span>
        </div>
      }
      open={open}
      destroyOnClose
      confirmLoading={loading || submitting}
      okText="Sign & Confirm"
      okButtonProps={{ className: 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-none' }}
      onCancel={onCancel}
      onOk={() => form.submit()}
      afterOpenChange={(visible) => {
        if (visible) {
          form.setFieldsValue({ userName, password: '', reason: '' })
        }
      }}
    >
      <Paragraph type="secondary" className="text-xs text-slate-500 mb-4">
        {description}
      </Paragraph>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ userName }}
      >
        <Form.Item label="Signed By" className="mb-3">
          <div className="px-3 py-1.5 bg-slate-100/80 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800">
            {userName || 'Logged-in User'}
          </div>
        </Form.Item>
        <Form.Item
          name="password"
          label="Password Re-authentication"
          rules={[{ required: true, message: 'Password is required to complete electronic signature' }]}
          className="mb-3"
        >
          <Input.Password placeholder="Enter your password" autoComplete="current-password" />
        </Form.Item>
        {requireReason && (
          <Form.Item
            name="reason"
            label={reasonLabel}
            rules={[{ required: true, min: 3, message: 'Please enter a valid reason for signing' }]}
            className="mb-2"
          >
            <Input.TextArea rows={2} placeholder="e.g. Verified analytical results against STP specification limit" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
