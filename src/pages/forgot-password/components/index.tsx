import { useState } from 'react'
import { Form, Input, Button, Result } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { forgotPassword } from '@/utilities/chemiaApi'
import styles from './styles.module.less'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [form]    = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleFinish = async (values: { email: string }) => {
    setLoading(true)
    try {
      await forgotPassword(values.email)
      setSent(true)
    } catch {
      // API never reveals whether email exists — always show success
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className={styles.root}>
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
        <div className={styles.formPanel}>
          <div className={styles.formCard}>
            <Result
              status="success"
              title="Check your inbox"
              subTitle="If that email is registered, you'll receive a password reset link within a few minutes."
              extra={
                <Button
                  className={styles.submitBtn}
                  style={{ width: '100%' }}
                  onClick={() => navigate('/login')}
                >
                  Back to Sign In
                </Button>
              }
            />
          </div>
        </div>
      </div>
    )
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
            <h1 className={styles.brandTitle}>Forgot Password</h1>
            <p className={styles.brandSub}>
              Enter your registered email and we'll send you a reset link.
            </p>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            className={styles.form}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              label="Email Address"
              rules={[
                { required: true, message: 'Please enter your email address.' },
                { type: 'email', message: 'Please enter a valid email address.' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#a8a29e' }} />}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
            </Form.Item>

            <Form.Item className={styles.submitItem}>
              <Button htmlType="submit" loading={loading} className={styles.submitBtn}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </Form.Item>
          </Form>

          <p className={styles.footerNote}>
            <span
              className={styles.backLink}
              onClick={() => navigate('/login')}
            >
              ← Back to Sign In
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
