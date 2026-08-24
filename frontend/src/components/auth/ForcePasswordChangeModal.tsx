import React, { useState } from 'react'
import { Modal, Form, Input, Button, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { ShieldAlert } from 'lucide-react'
import { apiPost } from '../../api/client'

interface ForcePasswordChangeModalProps {
  open: boolean
  onSuccess: () => void
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  open,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setLoading(true)

      await apiPost('/api/users/change-password', {
        old_password: values.currentPassword,
        new_password: values.newPassword,
      })

      message.success('Password updated successfully.')
      form.resetFields()
      onSuccess()
    } catch (err: any) {
      if (err?.response?.data?.detail) {
        message.error(err.response.data.detail)
      } else {
        message.error('Failed to change password. Please check credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <ShieldAlert className="text-amber-600" size={20} />
          <span>Password Change Required</span>
        </div>
      }
      closable={false}
      maskClosable={false}
      footer={[
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          className="bg-indigo-600 hover:bg-indigo-700 font-medium"
        >
          Update Password
        </Button>,
      ]}
    >
      <div className="py-2">
        <p className="text-sm text-slate-600 mb-4">
          Your account is configured to require a password update before proceeding.
        </p>

        <Form form={form} layout="vertical">
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Please enter current password' }]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  )
}
