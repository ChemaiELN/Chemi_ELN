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
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Form, Input, InputNumber, Select, Switch, Button,
  Tabs, Spin, message, Divider, Alert, Upload, Tag, Tooltip,
} from 'antd'
import {
  HomeOutlined, SaveOutlined, UserOutlined,
  MailOutlined, GlobalOutlined, ControlOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UploadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import Header from '@/common/Header'
import Sidebar from '@/common/Sidebar'
import styles from './styles.module.less'
import {
  getMe, getRoles,
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

function LogoUploadField({
  value,
  onChange,
}: {
  value?: string | null
  onChange?: (v: string | null) => void
}) {
  const previewSrc = value
    ? (value.startsWith('data:') || value.startsWith('http') || value.startsWith('/')
      ? value
      : undefined)
    : undefined

  return (
    <div className={styles.logoUpload}>
      {previewSrc ? (
        <img src={previewSrc} alt="Company logo preview" className={styles.logoPreview} />
      ) : (
        <div className={styles.logoPlaceholder}>No logo uploaded</div>
      )}
      <div className={styles.logoActions}>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={(file) => {
            const reader = new FileReader()
            reader.onload = () => onChange?.(reader.result as string)
            reader.readAsDataURL(file)
            return false
          }}
        >
          <Button size="small" icon={<UploadOutlined />}>Upload logo</Button>
        </Upload>
        {value && (
          <Button type="link" size="small" onClick={() => onChange?.(null)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  )
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

function TabSaveBar({
  dirty,
  showSaved,
  saving,
  onSave,
  label,
  extra,
}: {
  dirty: boolean
  showSaved: boolean
  saving: boolean
  onSave: () => void
  label: string
  extra?: React.ReactNode
}) {
  return (
    <div className={styles.saveBar}>
      {dirty && <span className={styles.unsavedHint}>Unsaved changes</span>}
      {showSaved && !dirty && (
        <span className={styles.savedFlash}>
          <CheckCircleOutlined /> Saved successfully
        </span>
      )}
      {extra}
      <Button
        type="primary"
        icon={<SaveOutlined />}
        loading={saving}
        onClick={onSave}
        className={styles.saveBtn}
      >
        {label}
      </Button>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const navigate      = useNavigate()
  const refreshCRD    = useCRDSettingsRefresh()
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activeTab, setActiveTab] = useState('global')
  const [globalDirty, setGlobalDirty] = useState(false)
  const [crdDirty, setCrdDirty] = useState(false)
  const [smtpDirty, setSmtpDirty] = useState(false)
  const [savedFlashTab, setSavedFlashTab] = useState<string | null>(null)

  const markSaved = useCallback((tab: string) => {
    setSavedFlashTab(tab)
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current)
    savedFlashTimer.current = setTimeout(() => setSavedFlashTab(null), 2500)
  }, [])

  // ── My Profile ───────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<MeResponse | null>(null)
  const [roleNames, setRoleNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = (() => {
      try { return JSON.parse(localStorage.getItem('chemia_user') ?? 'null') } catch { return null }
    })()
    if (stored) {
      setProfile(stored as MeResponse)
    } else {
      getMe().then(setProfile).catch(() => {})
    }
    getRoles()
      .then(roles => setRoleNames(Object.fromEntries(roles.map(r => [r.code, r.name]))))
      .catch(() => {})
  }, [])

  // ── Global Settings ───────────────────────────────────────────────────────
  const [globalForm]    = Form.useForm<GlobalSettings>()
  const [globalLoading, setGlobalLoading] = useState(false)
  const [globalSaving,  setGlobalSaving]  = useState(false)

  const loadGlobal = () => {
    setGlobalLoading(true)
    getGlobalSettings()
      .then(s => {
        globalForm.setFieldsValue({
          ...(s as unknown as Record<string, unknown>),
          experiment_per_limit: s.experiment_per_limit ?? s.notebook_experiment_limit,
        })
        setGlobalDirty(false)
      })
      .catch(() => {/* non-fatal — admin may not have global settings yet */})
      .finally(() => setGlobalLoading(false))
  }

  const handleSaveGlobal = async () => {
    let values: GlobalSettings
    try { values = await globalForm.validateFields() } catch { return }
    setGlobalSaving(true)
    try {
      const limit = values.experiment_per_limit
      await updateGlobalSettings({
        ...values,
        notebook_experiment_limit: limit,
      })
      setGlobalDirty(false)
      markSaved('global')
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
      .then(s => {
        crdForm.setFieldsValue(s as unknown as Record<string, unknown>)
        setCrdDirty(false)
      })
      .catch(() => {})
      .finally(() => setCrdLoading(false))
  }

  const handleSaveCRD = async () => {
    let values: CRDSettings
    try { values = await crdForm.validateFields() } catch { return }
    setCrdSaving(true)
    try {
      await updateCRDSettings(values)
      refreshCRD()
      setCrdDirty(false)
      markSaved('crd')
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
      .then(s => {
        smtpForm.setFieldsValue(s as unknown as Record<string, unknown>)
        setSmtpDirty(false)
      })
      .catch(() => {})
      .finally(() => setSmtpLoading(false))
  }

  const handleSaveSMTP = async () => {
    let values: SMTPSettings
    try { values = await smtpForm.validateFields() } catch { return }
    setSmtpSaving(true)
    try {
      await updateSMTPSettings(values)
      setSmtpDirty(false)
      markSaved('smtp')
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

  useEffect(() => {
    loadGlobal()
    loadCRD()
    loadSMTP()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const smtpHost = Form.useWatch('host', smtpForm)
  const smtpNotConfigured = !smtpHost?.trim()

  const profileFields: [string, string][] = profile ? [
    ['Employee No.', profile.emp_no],
    ['Username', profile.username],
    ['Display Name', profile.display_name],
    ['Email', profile.email],
    ['Designation', profile.designation ?? '—'],
    ['Department', profile.department_name ?? '—'],
    ['Middle Initials', profile.middle_initials ?? '—'],
    ['Contact No.', profile.contact_no ?? '—'],
    ['Site', profile.site ?? '—'],
  ] : []

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
              <p className={styles.pageSubtitle}>
                Configure authentication, workflow behaviour, and email delivery for your organisation.
              </p>
            </div>
          </div>

          {/* ── My Profile card ──────────────────────────────────────────── */}
          <div className={styles.profileCard}>
            <h2 className={styles.cardTitle}>
              <UserOutlined style={{ marginRight: 6, color: '#5aa3a1' }} />
              My Profile
            </h2>
            {profile ? (
              <div className={styles.profileGrid}>
                {profileFields.map(([label, value]) => (
                  <div key={label} className={styles.profileItem}>
                    <span className={styles.profileKey}>{label}</span>
                    <span className={styles.profileVal}>{value}</span>
                  </div>
                ))}
                <div className={styles.profileItem}>
                  <span className={styles.profileKey}>Role</span>
                  <Tooltip title={roleNames[profile.role] ?? profile.role}>
                    <span className={styles.roleBadge}>{profile.role}</span>
                  </Tooltip>
                </div>
                {(profile.must_reset_password || profile.allow_settings_update) && (
                  <div className={styles.profileFlags}>
                    <span className={styles.profileKey}>Flags</span>
                    <div className={styles.profileFlagsRow}>
                      {profile.must_reset_password && (
                        <Tag className={styles.flagWarn}>Must Reset Password</Tag>
                      )}
                      {profile.allow_settings_update && (
                        <Tag className={styles.flagOk}>Settings Access</Tag>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.profileLoading}>Loading profile…</div>
            )}
          </div>

          {/* ── Settings tabs ─────────────────────────────────────────────── */}
          <div className={styles.tabsCard}>
            <Tabs activeKey={activeTab} onChange={setActiveTab} size="small">

              {/* ── Tab 1: Global Settings ── */}
              <TabPane tab={<span><GlobalOutlined style={{ marginRight: 4 }} />Global</span>} key="global">
                {globalLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form
                    form={globalForm}
                    layout="vertical"
                    requiredMark={false}
                    onValuesChange={() => setGlobalDirty(true)}
                  >

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
                      <Form.Item name="lock_user_after_x_attempts" label="Max Failed Login Attempts">
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
                      <Form.Item
                        name="experiment_per_limit"
                        label="Max Experiments per Notebook"
                        extra="Maximum number of experiments allowed in a single notebook."
                      >
                        <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0 = unlimited" />
                      </Form.Item>
                      <Form.Item name="experiment_search_result_limit" label="Search Result Limit">
                        <InputNumber size="small" min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item name="company_logo_path" label="Company Logo">
                        <LogoUploadField />
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

                    <TabSaveBar
                      dirty={globalDirty}
                      showSaved={savedFlashTab === 'global'}
                      saving={globalSaving}
                      onSave={() => void handleSaveGlobal()}
                      label="Save Global Settings"
                    />
                  </Form>
                )}
              </TabPane>

              {/* ── Tab 2: CRD Settings ── */}
              <TabPane tab={<span><ControlOutlined style={{ marginRight: 4 }} />CRD</span>} key="crd">
                {crdLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form
                    form={crdForm}
                    layout="vertical"
                    requiredMark={false}
                    onValuesChange={() => setCrdDirty(true)}
                  >

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

                    <TabSaveBar
                      dirty={crdDirty}
                      showSaved={savedFlashTab === 'crd'}
                      saving={crdSaving}
                      onSave={() => void handleSaveCRD()}
                      label="Save CRD Settings"
                    />
                  </Form>
                )}
              </TabPane>

              {/* ── Tab 3: SMTP Settings ── */}
              <TabPane tab={<span><MailOutlined style={{ marginRight: 4 }} />SMTP</span>} key="smtp">
                {smtpLoading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}><Spin /></div>
                ) : (
                  <Form
                    form={smtpForm}
                    layout="vertical"
                    requiredMark={false}
                    onValuesChange={() => setSmtpDirty(true)}
                  >

                    {smtpNotConfigured && (
                      <Alert
                        type="warning"
                        showIcon
                        className={styles.smtpWarning}
                        message="SMTP is not configured. Email notifications and password reset emails are currently disabled."
                      />
                    )}

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

                    <TabSaveBar
                      dirty={smtpDirty}
                      showSaved={savedFlashTab === 'smtp'}
                      saving={smtpSaving}
                      onSave={() => void handleSaveSMTP()}
                      label="Save SMTP Settings"
                      extra={(
                        <Button icon={<MailOutlined />} loading={smtpTesting} onClick={handleTestSMTP}>
                          Test Connection
                        </Button>
                      )}
                    />
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
