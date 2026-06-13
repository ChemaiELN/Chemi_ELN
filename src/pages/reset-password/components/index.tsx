import { useState } from 'react'
import { Form, Input, Button, Result } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '@/utilities/chemiaApi'
import styles from './styles.module.less'

export default function ResetPasswordPage() {
  const navigate        = useNavigate()
  const [params]        = useSearchParams()
  const token           = params.get('token') ?? ''
  const [form]          = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  // No token in URL
  if (!token) {
    return (
      <div className={styles.root}>
        <div className={styles.imagePanel}>
          <img className={styles.imagePanelImg}
            src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1400&q=80&auto=format&fit=crop"
            alt="Laboratory" />
          <div className={styles.imageOverlay} />
        </div>
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <Result
              status="error"
              title="Invalid reset link"
              subTitle="This password reset link is missing or malformed. Please request a new one."
              extra={
                <Button className={styles.submitBtn} style={{ width: '100%' }}
                  onClick={() => navigate('/forgot-password')}>
                  Request New Link
                </Button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={styles.root}>
        <div className={styles.imagePanel}>
          <img className={styles.imagePanelImg}
            src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1400&q=80&auto=format&fit=crop"
            alt="Laboratory" />
          <div className={styles.imageOverlay} />
          <div className={styles.imageBadge}>
            <span className={styles.imageBadgeDot} />
            <span className={styles.imageBadgeText}>Chemia Labs</span>
          </div>
        </div>
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <Result
              status="success"
              title="Password updated!"
              subTitle="Your password has been reset successfully. You can now sign in with your new password."
              extra={
                <Button className={styles.submitBtn} style={{ width: '100%' }}
                  onClick={() => navigate('/login')}>
                  Go to Sign In
                </Button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const handleFinish = async (values: { new_password: string }) => {
    setLoading(true)
    setError('')
    try {
      await resetPassword(token, values.new_password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset link is invalid or expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.root}>
      {/* Image panel */}
      <div className={styles.imagePanel}>
        <img
          className={styles.imagePanelImg}
          src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1400&q=80&auto=format&fit=crop"
          alt="Laboratory"
        />
        <div className={styles.imageOverlay} />
        <div className={styles.imageBadge}>
          <span className={styles.imageBadgeDot} />
          <span className={styles.imageBadgeText}>Chemia Labs</span>
        </div>
      </div>

      {/* Form panel */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.brandBlock}>
            <h1 className={styles.brandTitle}>Set New Password</h1>
            <p className={styles.brandSub}>
              Choose a strong password — at least 8 characters.
            </p>
          </div>

          {error && (
            <div className={styles.errorBanner}>{error}</div>
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            className={styles.form}
            requiredMark={false}
          >
            <Form.Item
              name="new_password"
              label="New Password"
              rules={[
                { required: true, message: 'Please enter a new password.' },
                { min: 8, message: 'Password must be at least 8 characters.' },
              ]}
            >
              <Input.Password
                placeholder="New password"
                autoFocus
                iconRender={(visible) =>
                  visible
                    ? <EyeOutlined style={{ color: '#a8a29e' }} />
                    : <EyeInvisibleOutlined style={{ color: '#a8a29e' }} />
                }
              />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              label="Confirm Password"
              dependencies={['new_password']}
              rules={[
                { required: true, message: 'Please confirm your new password.' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('new_password') === value)
                      return Promise.resolve()
                    return Promise.reject(new Error('Passwords do not match.'))
                  },
                }),
              ]}
            >
              <Input.Password
                placeholder="Confirm new password"
                iconRender={(visible) =>
                  visible
                    ? <EyeOutlined style={{ color: '#a8a29e' }} />
                    : <EyeInvisibleOutlined style={{ color: '#a8a29e' }} />
                }
              />
            </Form.Item>

            <Form.Item className={styles.submitItem}>
              <Button htmlType="submit" loading={loading} className={styles.submitBtn}>
                {loading ? 'Updating…' : 'Reset Password'}
              </Button>
            </Form.Item>
          </Form>

          <p className={styles.footerNote}>
            <span className={styles.backLink} onClick={() => navigate('/login')}>
              ← Back to Sign In
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
