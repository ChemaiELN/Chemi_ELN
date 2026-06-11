import { Form, Input, Button } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { useNavigate, Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loginStart, loginSuccess, loginFailure } from '../redux/slice'
import { loginRequest } from '../redux/api'
import styles from './styles.module.less'

export default function LoginPage() {
  const [form] = Form.useForm()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading } = useAppSelector((s) => s.auth)

  const handleFinish = async (values: { username: string; password: string }) => {
    dispatch(loginStart())
    try {
      const data = await loginRequest(values)
      localStorage.setItem('access_token', data.access_token)
      dispatch(loginSuccess({ username: data.username }))
      navigate('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.'
      dispatch(loginFailure(message))
      // Surface the server error on the password field — most natural UX for auth failures
      form.setFields([{ name: 'password', errors: [message] }])
    }
  }

  return (
    <div className={styles.root}>
      {/* ── Image panel ── */}
      <div className={styles.imagePanel}>
        <img
          className={styles.imagePanelImg}
          src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=1400&q=80&auto=format&fit=crop"
          alt="Medical laboratory"
        />
        <div className={styles.imageOverlay} />
        <div className={styles.imageBadge}>
          <span className={styles.imageBadgeDot} />
          <span className={styles.imageBadgeText}>Chemia Labs</span>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.brandBlock}>
            <h1 className={styles.brandTitle}>Chemia ELN</h1>
          </div>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            className={styles.form}
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: 'Please enter your username.' }]}
            >
              <Input
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Please enter your password.' }]}
            >
              <Input.Password
                placeholder="Enter your password"
                autoComplete="current-password"
                iconRender={(visible) =>
                  visible ? (
                    <EyeOutlined style={{ color: '#a8a29e' }} />
                  ) : (
                    <EyeInvisibleOutlined style={{ color: '#a8a29e' }} />
                  )
                }
              />
            </Form.Item>

            <div style={{ textAlign: 'right', marginBottom: 8, marginTop: -4 }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: '#0f766e' }}>
                Forgot password?
              </Link>
            </div>

            <Form.Item className={styles.submitItem}>
              <Button
                htmlType="submit"
                loading={loading}
                className={styles.submitBtn}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          <p className={styles.footerNote}>
            Protected system — authorised personnel only
          </p>
        </div>
      </div>
    </div>
  )
}
