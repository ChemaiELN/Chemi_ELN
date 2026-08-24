import React, { useState } from 'react'
import { Modal, Form, Input, Button, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { authApi } from '../../api/auth'

interface ReAuthModalProps {
  open: boolean
  title?: string
  actionName?: string
  onClose: () => void
  onSuccess: (remarks?: string) => void
}

export const ReAuthModal: React.FC<ReAuthModalProps> = ({
  open,
  title = '21 CFR Part 11 Electronic Signature Re-Authentication',
  actionName = 'execute this action',
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      const res = await authApi.verifyPassword(values.password)
      if (res && res.verified) {
        message.success('Electronic signature re-authenticated successfully.')
        form.resetFields()
        onSuccess(values.remarks)
        onClose()
      } else {
        message.error('Authentication failed. Invalid password.')
      }
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail)
      } else if (err?.name !== 'ValidationError') {
        message.error('Password verification failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
          <LockOutlined className="text-blue-600" />
          <span>{title}</span>
        </div>
      }
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Authenticate & Confirm
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="py-2">
        <p className="text-sm text-slate-600 mb-4">
          In accordance with 21 CFR Part 11 electronic signature requirements, please re-enter your password to <strong>{actionName}</strong>.
        </p>

        <Form form={form} layout="vertical" name="reauth_form">
          <Form.Item
            name="password"
            label="Current Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400" />}
              placeholder="Enter password to re-authenticate"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="remarks"
            label="Reason / Remarks (Optional)"
          >
            <Input.TextArea
              rows={2}
              placeholder="Enter optional reason for this signature"
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  )
}
