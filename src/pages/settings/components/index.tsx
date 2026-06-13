/**
 * Settings page — v2 restructure.
 *
 * Layout:
 *   ┌── My Profile card (read-only, always visible)
 *   └── Tabs
 *         ├── Global Settings  (GET/PATCH /api/admin/settings/global)
 *         ├── CRD Settings     (GET/PATCH /api/admin/settings/crd)
 *         └── SMTP Settings    (GET/PATCH /api/admin/settings/smtp)
 *
 * Only users with `allow_settings_update = true` (or the QA/HOD role) should
 * be able to edit. Visibility guard is left to the router; here we just render
 * the page.
 */
import React, { useState, useEffect } from 'react'
import {
  Form, Input, InputNumber, Select, Switch, Button,
  Tag, Tabs, Spin, message, Divider, Alert,
} from 'antd'
import {
  HomeOutlined, SaveOutlined, UserOutlined,
  MailOutlined, GlobalOutlined, ControlOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getMe,
  getGlobalSettings,  updateGlobalSettings,
  getCRDSettings,     updateCRDSettings,
  getSMTPSettings,    updateSMTPSettings, testSMTPConnection,
  type MeResponse,
  type GlobalSettings,
  type CRDSettings,
  type SMTPSettings,
} from '@/utilities/chemiaApi'
import { useCRDSettingsRefresh } from '@/common/CRDSettingsContext'

const { TabPane } = Tabs

const ROLE_COLOR: Record<string, string> = {
  QA:   'gold',
  TL:   'cyan',
  HOD:  'purple',
  CHEM: 'default',
}

// ─── ToggleRow helper ─────────────────────────────────────────────────────────

function ToggleRow({
  name, label, desc,
}: { name: string; label: string; desc?: string }) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <p className={styles.toggleLabel}>{label}</p>
        {desc && <p className={styles.toggleDesc}>{desc}</p>}
      </div>
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Switch size="small" className={styles.switch} />
      </Form.Item>
    </div>
  )
}

// ─── Section heading helper ───────────────────────────────────────────────────

function SectionHeading({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`${styles.sectionHeading}${first ? ` ${styles.sectionHeadingFirst}` : ''}`}>
      {children}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const navigate      = useNavigate()
  const refreshCRD    = useCRDSettingsRefresh()

  // ── My Profile ───────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<MeResponse | null>(null)

  useEffect(() => {
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem('chemia_user') ?? 'null') } catch { return null }
    })()
    if (stored) {
      setProfile(stored as MeResponse)
    } else {
      getMe().then(setProfile).catch(() => {})
    }
  }, [])

  // ── Global Settings ───────────────────────────────────────────────────────
  const [globalForm]    = Form.useForm<GlobalSettings>()
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalSaving,  setGlobalSaving]  = useState(false)

  const loadGlobal = () => {
    setGlobalLoading(true)
    getGlobalSettings()
      .then(s  => globalForm.setFieldsValue(s as unknown as Record<string, unknown>))
      .catch(() => {/* non-fatal — admin may not have global settings yet */})
      .finally(() => setGlobalLoading(false))
  }

  const handleSaveGlobal = async () => {
    let values: GlobalSettings
    try { values = await globalForm.validateFields() } catch { return }
    setGlobalSaving(true)
    try {
      await updateGlobalSettings(values)
      message.success('Global settings saved')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to save global settings')
    } finally {
      setGlobalSaving(false)
    }
  }

  // ── CRD Settings ──────────────────────────────────────────────────────────
  const [crdForm]    = Form.useForm<CRDSettings>()
  const [crdLoading, setCrdLoading] = useState(false)
  const [crdSaving,  setCrdSaving]  = useState(false)

  const loadCRD = () => {
    setCrdLoading(true)
    getCRDSettings()
      .then(s  => crdForm.setFieldsValue(s as unknown as Record<string, unknown>))
      .catch(() => {})
      .finally(() => setCrdLoading(false))
  }

  const handleSaveCRD = async () => {
    let values: CRDSettings
    try { values = await crdForm.validateFields() } catch { return }
    setCrdSaving(true)
    try {
      await updateCRDSettings(values)
      refreshCRD()   // update the app-level CRD context
      message.success('CRD settings saved')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to save CRD settings')
    } finally {
      setCrdSaving(false)
    }
  }

  // ── SMTP Settings ─────────────────────────────────────────────────────────
  const [smtpForm]    = Form.useForm<SMTPSettings>()
  const [smtpLoading, setSmtpLoading] = useState(false)
  const [smtpSaving,  setSmtpSaving]  = useState(false)
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [smtpTesting, setSmtpTesting] = useState(false)

  const loadSMTP = () => {
    setSmtpLoading(true)
    getSMTPSettings()
      .then(s  => smtpForm.setFieldsValue(s as unknown as Record<string, unknown>))
      .catch(() => {})
      .finally(() => setSmtpLoading(false))
  }

  const handleSaveSMTP = async () => {
    let values: SMTPSettings
    try { values = await smtpForm.validateFields() } catch { return }
    setSmtpSaving(true)
    try {
      await updateSMTPSettings(values)
      message.success('SMTP settings saved')
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to save SMTP settings')
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleTestSMTP = async () => {
    setSmtpTesting(true)
    setSmtpTestResult(null)
    try {
      const result = await testSMTPConnection()
      setSmtpTestResult({ ok: result.success, msg: result.message })
    } catch (err) {
      setSmtpTestResult({ ok: false, msg: err instanceof Error ? err.message : 'Test failed' })
    } finally {
      setSmtpTesting(false)
    }
  }

  // Load all settings on mount
  useEffect(() => {
    loadGlobal()
    loadCRD()
    loadSMTP()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab change handler ────────────────────────────────────────────────────
  // (no-op — data is loaded on mount)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.body}>
        <Sidebar activeKey="lookup" />
        <main className={styles.main}>

          {/* Top bar */}
          <div className={styles.topBar}>
            <div>
              <nav className={styles.breadcrumb}>
                <span className={styles.breadHome} onClick={() => navigate('/dashboard')}>
                  <HomeOutlined /> Home
                </span>
                <span className={styles.breadSep}>/</span>
                <span className={styles.breadCurrent}>Settings</span>
              </nav>
              <h1 className={styles.pageTitle}>System Settings</h1>
            </div>
          </div>

          {/* ── My Profile card ──────────────────────────────────────────── */}
          <div className={styles.profileCard}>
            <h2 className={styles.cardTitle}>
              <UserOutlined style={{ marginRight: 6, color: '#5aa3a1' }} />
              My Profile
            </h2>
            {profile ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem 1rem' }}>
                {([
                  ['Employee No.',   profile.emp_no],
                  ['Username',       profile.username],
                  ['Display Name',   profile.display_name],
                  ['Email',          profile.email],
                  ['Designation',    profile.designation     ?? '—'],
                  ['Department',     profile.department_name ?? '—'],
                  ['Middle Initials', profile.middle_initials ?? '—'],
                  ['Contact No.',    profile.contact_no      ?? '—'],
                  ['Site',           profile.site            ?? '—'],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: '#a8a29e' }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#292524', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.04em', color: '#a8a29e' }}>Role</span>
                  <Tag color={ROLE_COLOR[profile.role] ?? 'default'}
                    style={{ display: 'inline-block', width: 'fit-content', fontWeight: 600 }}>
                    {profile.role}
                  </Tag>
                </div>
                {(profile.must_reset_password || profile.allow_settings_update) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.04em', color: '#a8a29e' }}>Flags</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {profile.must_reset_password && (
                        <Tag style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fde68a',
                          fontWeight: 600, fontSize: 11 }}>
                          ⚠ Must Reset Password
                        </Tag>
                      )}
                      {profile.allow_settings_update && (
                        <Tag style={{ background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0',
                          fontWeight: 600, fontSize: 11 }}>
                          ⚙ Settings Access
                        </Tag>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#a8a29e', fontSize: 12, padding: '8px 0' }}>Loading profile…</div>
            )}
          </div>

          {/* ── Settings tabs ─────────────────────────────────────────────── */}
          <div className={styles.tabsCard}>
            <Tabs defaultActiveKey="global" size="small">

              {/* ── Tab 1: Global Settings ── */}
              <TabPane tab={<span><GlobalOutlined style={{ marginRight: 4 }} />Global</span>} key="global">
                {globalLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form form={globalForm} layout="vertical" requiredMark={false}>

                    <SectionHeading first>Authentication</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="auth_type" label="Auth Type">
                        <Select size="small">
                          <Select.Option value="local">Local</Select.Option>
                          <Select.Option value="ldap">LDAP</Select.Option>
                          <Select.Option value="sso">SSO</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="default_password" label="Default Password">
                        <Input.Password size="small" placeholder="Used when creating accounts" />
                      </Form.Item>
                      <Form.Item name="lock_user_after_x_attempts" label="Lock After X Failed Attempts">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = disabled" />
                      </Form.Item>
                      <Form.Item name="password_expiry_days" label="Password Expiry (days)">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = never" />
                      </Form.Item>
                    </div>
                    <div className={styles.toggleRow}>
                      <div>
                        <p className={styles.toggleLabel}>Use Random Password via Mail</p>
                        <p className={styles.toggleDesc}>Send a one-time random password to new users by email</p>
                      </div>
                      <Form.Item name="use_random_password_through_mail" valuePropName="checked" noStyle>
                        <Switch size="small" className={styles.switch} />
                      </Form.Item>
                    </div>

                    <SectionHeading>Files &amp; Limits</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="image_file_size_kb" label="Image File Size Limit (KB)">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="attachment_size_kb" label="Attachment Size Limit (KB)">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="experiment_per_limit" label="Experiments per Notebook Limit">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = unlimited" />
                      </Form.Item>
                      <Form.Item name="notebook_experiment_limit" label="Notebook Experiment Limit">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = unlimited" />
                      </Form.Item>
                      <Form.Item name="experiment_search_result_limit" label="Search Result Limit">
                        <InputNumber size="small" min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="company_logo_path" label="Company Logo Path">
                        <Input size="small" placeholder="/static/logo.png" />
                      </Form.Item>
                    </div>

                    <SectionHeading>Roles &amp; Notifications</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="qa_privilege_role" label="QA Privilege Role">
                        <Select size="small">
                          <Select.Option value="QA">QA</Select.Option>
                          <Select.Option value="HOD">HOD</Select.Option>
                        </Select>
                      </Form.Item>
                    </div>
                    <div className={styles.toggleRow}>
                      <div>
                        <p className={styles.toggleLabel}>Email Notification Enabled</p>
                        <p className={styles.toggleDesc}>Send email alerts for workflow events</p>
                      </div>
                      <Form.Item name="email_notification_enabled" valuePropName="checked" noStyle>
                        <Switch size="small" className={styles.switch} />
                      </Form.Item>
                    </div>

                    <div className={styles.saveBar}>
                      <Button type="primary" icon={<SaveOutlined />} loading={globalSaving}
                        onClick={handleSaveGlobal}
                        style={{ background: '#5aa3a1', borderColor: '#5aa3a1' }}>
                        Save Global Settings
                      </Button>
                    </div>
                  </Form>
                )}
              </TabPane>

              {/* ── Tab 2: CRD Settings ── */}
              <TabPane tab={<span><ControlOutlined style={{ marginRight: 4 }} />CRD</span>} key="crd">
                {crdLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form form={crdForm} layout="vertical" requiredMark={false}>

                    {/* Workflow */}
                    <SectionHeading first>Workflow</SectionHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <ToggleRow name="verification_request_flow"
                        label="Verification Request Flow"
                        desc="Require explicit verification request before review" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="route_and_stage"
                        label="Route &amp; Stage"
                        desc="Enable route/stage tracking for experiments" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="mandate_tl_approval_atr"
                        label="Mandate TL Approval for ATR"
                        desc="TL must approve ATR before QA" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="clone_procedure_without_numerical_data"
                        label="Clone Procedure Without Numerical Data"
                        desc="Strip numbers when cloning experiment procedure" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="include_observation_start_end_time"
                        label="Include Observation Start/End Time"
                        desc="Show time fields in observation entries" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="include_reference_for_cloned_experiments"
                        label="Include Reference for Cloned Experiments"
                        desc="Auto-link cloned experiment to its source" />
                    </div>

                    {/* Experiment Config */}
                    <SectionHeading>Experiment Configuration</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="scheme_type" label="Scheme Type">
                        <Select size="small" allowClear placeholder="Select scheme type">
                          <Select.Option value="ketcher">Ketcher</Select.Option>
                          <Select.Option value="image">Image Upload</Select.Option>
                          <Select.Option value="none">None</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="procedure_display" label="Procedure Display">
                        <Select size="small" allowClear placeholder="Select display mode">
                          <Select.Option value="rich_text">Rich Text</Select.Option>
                          <Select.Option value="steps">Steps</Select.Option>
                          <Select.Option value="both">Both</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="tlc_type" label="TLC Type">
                        <Select size="small" allowClear placeholder="Select TLC type">
                          <Select.Option value="image">Image</Select.Option>
                          <Select.Option value="data">Data Table</Select.Option>
                          <Select.Option value="both">Both</Select.Option>
                        </Select>
                      </Form.Item>
                      <Form.Item name="tlc_row_count" label="TLC Row Count">
                        <InputNumber size="small" min={1} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="sample_notebook_code" label="Sample Notebook Code">
                        <Input size="small" placeholder="e.g. NB-SAMPLE" />
                      </Form.Item>
                      <Form.Item name="reference_experiment_link_code" label="Reference Experiment Link Code">
                        <Input size="small" placeholder="Code prefix for linked experiments" />
                      </Form.Item>
                    </div>

                    {/* Stage Codes */}
                    <SectionHeading>Stage Codes</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="closing_stage" label="Closing Stage">
                        <Input size="small" placeholder="e.g. CLOSE" />
                      </Form.Item>
                      <Form.Item name="experiment_report_stage" label="Experiment Report Stage">
                        <Input size="small" placeholder="e.g. REPORT" />
                      </Form.Item>
                    </div>

                    {/* SLA */}
                    <SectionHeading>SLA Thresholds (Days)</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="sla_experiments_days" label="Experiments SLA">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = off" />
                      </Form.Item>
                      <Form.Item name="sla_delayed_submission_days" label="Delayed Submission SLA">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = off" />
                      </Form.Item>
                      <Form.Item name="sla_delayed_approval_days" label="Delayed Approval SLA">
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = off" />
                      </Form.Item>
                    </div>

                    {/* E-Signature */}
                    <SectionHeading>E-Signature (Re-auth) Gates</SectionHeading>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <ToggleRow name="reauth_save"                     label="Save Draft" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="reauth_submit_for_verification"  label="Submit for Verification" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="reauth_verification"             label="Verify Experiment" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="reauth_deactivate"               label="Void / Deactivate" />
                      <Divider style={{ margin: '6px 0' }} />
                      <ToggleRow name="reauth_attachment_upload"        label="Attachment Upload" />
                    </div>

                    {/* Input Defaults */}
                    <SectionHeading>Input Defaults</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="input_default_mol_weight" label="Default Mol. Weight">
                        <InputNumber size="small" min={0} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="input_default_quantity" label="Default Quantity">
                        <InputNumber size="small" min={0} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="input_default_mole_ratio" label="Default Mole Ratio">
                        <InputNumber size="small" min={0} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </div>
                    <div className={styles.toggleRow}>
                      <div>
                        <p className={styles.toggleLabel}>Auto Calculate Moles</p>
                        <p className={styles.toggleDesc}>Automatically compute moles from quantity and MW</p>
                      </div>
                      <Form.Item name="input_auto_calc_moles" valuePropName="checked" noStyle>
                        <Switch size="small" className={styles.switch} />
                      </Form.Item>
                    </div>

                    <div className={styles.saveBar}>
                      <Button type="primary" icon={<SaveOutlined />} loading={crdSaving}
                        onClick={handleSaveCRD}
                        style={{ background: '#5aa3a1', borderColor: '#5aa3a1' }}>
                        Save CRD Settings
                      </Button>
                    </div>
                  </Form>
                )}
              </TabPane>

              {/* ── Tab 3: SMTP Settings ── */}
              <TabPane tab={<span><MailOutlined style={{ marginRight: 4 }} />SMTP</span>} key="smtp">
                {smtpLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form form={smtpForm} layout="vertical" requiredMark={false}>

                    <SectionHeading first>Server</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="host" label="SMTP Host">
                        <Input size="small" placeholder="smtp.example.com" />
                      </Form.Item>
                      <Form.Item name="port" label="Port">
                        <InputNumber size="small" min={1} max={65535} style={{ width: '100%' }} placeholder="587" />
                      </Form.Item>
                      <Form.Item name="from_email" label="From Email">
                        <Input size="small" placeholder="noreply@example.com" />
                      </Form.Item>
                      <Form.Item name="timeout_seconds" label="Timeout (seconds)">
                        <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="30" />
                      </Form.Item>
                    </div>

                    <SectionHeading>Authentication</SectionHeading>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                      <Form.Item name="username" label="Username">
                        <Input size="small" placeholder="SMTP username" />
                      </Form.Item>
                      <Form.Item name="password" label="Password">
                        <Input.Password size="small" placeholder="SMTP password" />
                      </Form.Item>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <div className={styles.toggleRow} style={{ flex: 1 }}>
                        <div>
                          <p className={styles.toggleLabel}>Use TLS</p>
                          <p className={styles.toggleDesc}>STARTTLS (port 587)</p>
                        </div>
                        <Form.Item name="use_tls" valuePropName="checked" noStyle>
                          <Switch size="small" className={styles.switch} />
                        </Form.Item>
                      </div>
                      <div className={styles.toggleRow} style={{ flex: 1 }}>
                        <div>
                          <p className={styles.toggleLabel}>Use SSL</p>
                          <p className={styles.toggleDesc}>SSL/TLS (port 465)</p>
                        </div>
                        <Form.Item name="use_ssl" valuePropName="checked" noStyle>
                          <Switch size="small" className={styles.switch} />
                        </Form.Item>
                      </div>
                    </div>

                    {smtpTestResult && (
                      <Alert
                        type={smtpTestResult.ok ? 'success' : 'error'}
                        message={smtpTestResult.ok ? 'Connection successful' : 'Connection failed'}
                        description={smtpTestResult.msg}
                        showIcon
                        icon={smtpTestResult.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        style={{ marginTop: 12 }}
                        closable
                        onClose={() => setSmtpTestResult(null)}
                      />
                    )}

                    <div className={styles.saveBar}>
                      <Button icon={<MailOutlined />} loading={smtpTesting} onClick={handleTestSMTP}>
                        Test Connection
                      </Button>
                      <Button type="primary" icon={<SaveOutlined />} loading={smtpSaving}
                        onClick={handleSaveSMTP}
                        style={{ background: '#5aa3a1', borderColor: '#5aa3a1' }}>
                        Save SMTP Settings
                      </Button>
                    </div>
                  </Form>
                )}
              </TabPane>

            </Tabs>
          </div>

        </main>
      </div>
    </div>
  )
}

export default SettingsPage
