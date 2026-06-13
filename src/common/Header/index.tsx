import { useState, useEffect, useCallback } from 'react'
import {
  FullscreenOutlined, FullscreenExitOutlined, HomeOutlined, InfoCircleOutlined,
  UserOutlined, DownOutlined, LogoutOutlined, BellOutlined,
} from '@ant-design/icons'
import { Lock } from 'lucide-react'
import { Dropdown, Modal, Form, Input, message, Popover, Badge } from 'antd'
import type { MenuProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '@/store/hooks'
import { logout as logoutAction } from '@/pages/login/redux/slice'
import { logout as logoutAPI, changePassword } from '@/utilities/chemiaApi'
import styles from './styles.module.less'

function MoleculeIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#5aa3a1" opacity="0.12" />
      <circle cx="18" cy="18" r="5" fill="#5aa3a1" />
      <circle cx="9"  cy="10" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="27" cy="10" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="9"  cy="26" r="3" fill="#5aa3a1" opacity="0.85" />
      <circle cx="27" cy="26" r="3" fill="#5aa3a1" opacity="0.85" />
      <line x1="18" y1="18" x2="9"  y2="10" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="27" y2="10" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="9"  y2="26" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
      <line x1="18" y1="18" x2="27" y2="26" stroke="#5aa3a1" strokeWidth="1.5" opacity="0.6" />
    </svg>
  )
}

export default function Header() {
  const navigate   = useNavigate()
  const dispatch   = useAppDispatch()
  const [cpOpen, setCpOpen]             = useState(false)
  const [cpLoading, setCpLoading]       = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      message.error('Fullscreen is not available in this browser')
    }
  }, [])

  // ── Current user from localStorage ────────────────────────────────────────
  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('chemia_user') ?? '{}') } catch { return {} }
  })()
  const displayName: string = storedUser?.display_name ?? storedUser?.username ?? 'User'
  const userRole: string    = storedUser?.role ?? ''

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await logoutAPI()
    } catch {
      // even if API call fails, clear local session
    }
    dispatch(logoutAction())
    navigate('/login')
  }

  // ── Change password ────────────────────────────────────────────────────────
  const handleCPSubmit = async (values: {
    current_password: string
    new_password: string
    confirm_password: string
  }) => {
    setCpLoading(true)
    try {
      await changePassword(values.current_password, values.new_password)
      message.success('Password changed successfully')
      setCpOpen(false)
      form.resetFields()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password'
      form.setFields([{ name: 'current_password', errors: [msg] }])
    } finally {
      setCpLoading(false)
    }
  }

  // ── User dropdown menu ─────────────────────────────────────────────────────
  const userMenuItems: MenuProps['items'] = [
    { key: 'profile',          label: 'Profile' },
    { key: 'change-password',  label: 'Change Password' },
    { type: 'divider' },
    {
      key: 'logout',
      label: (
        <span style={{ color: '#e11d48' }}>
          <LogoutOutlined style={{ marginRight: 6 }} />Logout
        </span>
      ),
    },
  ]

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout')          handleLogout()
    if (key === 'change-password') setCpOpen(true)
    if (key === 'profile')         navigate('/settings')
  }

  return (
    <>
      <header className={styles.header}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}><MoleculeIcon /></div>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>
              Chemia <span className={styles.logoAt}>@ Cchance</span>
            </span>
            <span className={styles.logoSub}>CHEMIA RESEARCH</span>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <button
            className={styles.navItem}
            title="Home"
            onClick={() => {
              localStorage.removeItem('chemia_module')
              navigate('/dashboard')
            }}
          >
            <HomeOutlined className={styles.navIcon} />
            <span className={styles.navLabel}>Home</span>
          </button>

          <button
            className={styles.navItem}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen
              ? <FullscreenExitOutlined className={styles.navIcon} />
              : <FullscreenOutlined className={styles.navIcon} />}
            <span className={styles.navLabel}>Max./Min.</span>
          </button>

          <button
            className={styles.navItem}
            title="Change Password"
            onClick={() => setCpOpen(true)}
          >
            <Lock className={styles.navLucideIcon} size={15} strokeWidth={2} aria-hidden />
            <span className={styles.navLabel}>Password</span>
          </button>

          <button className={styles.navItem} title="About">
            <InfoCircleOutlined className={styles.navIcon} />
            <span className={styles.navLabel}>About</span>
          </button>

          {/* Notification bell */}
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <div style={{ width: 288 }}>
                <div style={{ padding: '0.5rem 0.875rem', borderBottom: '1px solid #f5f5f4',
                  fontSize: 12, fontWeight: 600, color: '#57534e', letterSpacing: '0.04em' }}>
                  Notifications
                </div>
                <div style={{ padding: '1.5rem 0.875rem', textAlign: 'center',
                  color: '#a8a29e', fontSize: 12 }}>
                  No new notifications
                </div>
              </div>
            }
          >
            <button className={styles.navItem} title="Notifications">
              <Badge count={0} size="small" showZero={false}>
                <BellOutlined className={styles.navIcon} />
              </Badge>
              <span className={styles.navLabel}>Alerts</span>
            </button>
          </Popover>

          {/* User dropdown */}
          <Dropdown
            menu={{ items: userMenuItems, onClick: handleMenuClick }}
            trigger={['click']}
            placement="bottomRight"
          >
            <button className={styles.navItem} title="User menu">
              <UserOutlined className={styles.navIcon} />
              <span className={styles.navLabel} style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}{userRole ? ` (${userRole})` : ''}
              </span>
              <DownOutlined className={styles.navChevron} />
            </button>
          </Dropdown>
        </nav>
      </header>

      {/* ── Change Password Modal ── */}
      <Modal
        title="Change Password"
        open={cpOpen}
        onCancel={() => { setCpOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText="Update Password"
        confirmLoading={cpLoading}
        className={styles.notebookModal}
        width={540}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCPSubmit}
          requiredMark={false}
          style={{ marginTop: 12 }}
        >
          <Form.Item
            name="current_password"
            label="Current Password"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password placeholder="Current password" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm New Password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value)
                    return Promise.resolve()
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
