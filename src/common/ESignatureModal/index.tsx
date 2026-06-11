/**
 * ESignatureModal — re-authentication gate.
 *
 * Shown before sensitive actions (Save, Submit, Verify, Void, Attachment Upload)
 * when the corresponding `reauth_*` CRD setting is enabled.
 *
 * Usage:
 *   <ESignatureModal
 *     open={eSignOpen}
 *     actionLabel="Submit for Verification"
 *     onConfirm={async (pw) => {
 *       await submitExperiment(id, pw)   // throws on wrong password
 *       setESignOpen(false)              // only on success
 *     }}
 *     onCancel={() => setESignOpen(false)}
 *   />
 *
 * If `onConfirm` throws, the modal stays open and shows the error message inline.
 * The caller is responsible for closing the modal after a successful `onConfirm`.
 */
import { useState, useEffect } from 'react'
import { Modal, Form, Input, Alert } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import styles from './styles.module.less'

export interface ESignatureModalProps {
  /** Whether the modal is visible */
  open: boolean
  /**
   * Human-readable description of the action being confirmed.
   * Shown in the modal body, e.g. "Submit for Verification".
   */
  actionLabel: string
  /**
   * Async callback that performs the guarded action.
   * Receives the password the user typed.
   * Should throw on failure (e.g. wrong password → backend 403).
   * The modal stays open and displays the thrown error message.
   * On success, the caller must close the modal (set open=false).
   */
  onConfirm: (password: string) => Promise<void>
  /** Called when the user cancels — close the modal */
  onCancel: () => void
}

export default function ESignatureModal({
  open,
  actionLabel,
  onConfirm,
  onCancel,
}: ESignatureModalProps) {
  const [form]       = Form.useForm<{ password: string }>()
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form + error whenever the modal opens
  useEffect(() => {
    if (open) {
      form.resetFields()
      setError(null)
    }
  }, [open, form])

  const handleOk = async () => {
    let values: { password: string }
    try {
      values = await form.validateFields()
    } catch {
      // Antd validation error — field already shows inline message
      return
    }

    setBusy(true)
    setError(null)
    try {
      await onConfirm(values.password)
      // onConfirm is responsible for calling onCancel/closing on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed — please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    if (busy) return       // prevent closing while the request is in-flight
    onCancel()
  }

  return (
    <Modal
      open={open}
      width={420}
      maskClosable={false}
      closable={!busy}
      onCancel={handleCancel}
      onOk={handleOk}
      okText="Confirm"
      cancelText="Cancel"
      okButtonProps={{
        loading: busy,
        style: { background: '#0f766e', borderColor: '#0f766e' },
      }}
      cancelButtonProps={{ disabled: busy }}
      destroyOnClose
      title={
        <div className={styles.titleRow}>
          <LockOutlined className={styles.titleIcon} />
          E-Signature Required
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.description}>
          Please re-enter your password to confirm&nbsp;
          <strong>{actionLabel}</strong>.
        </p>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleOk}
          requiredMark={false}
        >
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.Password
              className={styles.passwordInput}
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              autoFocus
              autoComplete="current-password"
              disabled={busy}
            />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  )
}
