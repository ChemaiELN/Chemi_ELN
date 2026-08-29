import { useEffect, useState } from 'react'
import { Form, Input, Button, Checkbox, Select, Spin, message } from 'antd'
import { ShieldAlert, FileText, HelpCircle } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { selectUser, setAuth } from '../../store/authSlice'
import { authApi } from '../../api/auth'
import { AdminModal } from '../ui/AdminModal'

type Step = 'password' | 'terms' | 'security' | 'done'

const TERMS_TEXT = `By using the Laurus ELN system, you agree to comply with all applicable company policies, data integrity requirements, and GxP regulations. Unauthorized access or misuse of the system is prohibited.`

export default function FirstLoginGuard() {
  const user = useAppSelector(selectUser)
  const dispatch = useAppDispatch()
  const [step, setStep] = useState<Step>('done')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [questions, setQuestions] = useState<{ index: number; text: string }[]>([])
  const [pwForm] = Form.useForm()
  const [sqForm] = Form.useForm()

  useEffect(() => {
    if (!user) { setStep('done'); return }
    if (user.must_reset_password) { setStep('password'); return }
    if (!user.terms_accepted) { setStep('terms'); return }
    if (user.enable_security_questions && !user.has_security_questions) {
      setStep('security')
      authApi.securityQuestions().then(r => setQuestions(r.questions ?? [])).catch(() => {})
      return
    }
    setStep('done')
  }, [user])

  const refreshMe = async () => {
    setRefreshing(true)
    try {
      const me = await authApi.me()
      dispatch(setAuth({ user: me, accessToken: localStorage.getItem('access_token') ?? '' }))
    } finally {
      setRefreshing(false)
    }
  }

  const storeTokens = (tokens: { access_token: string; refresh_token: string }) => {
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    dispatch(setAuth({ user: user!, accessToken: tokens.access_token }))
  }

  const submitPassword = async () => {
    const values = await pwForm.validateFields()
    setLoading(true)
    try {
      const tokens = await authApi.changePassword({
        old_password: values.currentPassword,
        new_password: values.newPassword,
      })
      storeTokens(tokens)
      message.success('Password updated.')
      pwForm.resetFields()
      await refreshMe()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  const submitTerms = async () => {
    if (!termsAccepted) return
    setLoading(true)
    try {
      await authApi.acceptTerms()
      await refreshMe()
    } catch {
      message.error('Failed to accept terms.')
    } finally {
      setLoading(false)
    }
  }

  const submitSecurity = async () => {
    const values = await sqForm.validateFields()
    if (values.q1Index === values.q2Index) {
      message.error('Please choose two different security questions.')
      return
    }
    setLoading(true)
    try {
      await authApi.saveSecurityQuestions([
        { index: values.q1Index, answer: values.q1Answer },
        { index: values.q2Index, answer: values.q2Answer },
      ])
      message.success('Security questions saved.')
      sqForm.resetFields()
      await refreshMe()
    } catch {
      message.error('Failed to save security questions.')
    } finally {
      setLoading(false)
    }
  }

  if (!user || step === 'done') return null

  const body = refreshing ? (
    <div className="flex justify-center py-10">
      <Spin size="large" />
    </div>
  ) : null

  if (step === 'password') {
    return (
      <AdminModal
        open
        title={
          <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
            <ShieldAlert className="text-amber-600" size={20} />
            <span>Password Change Required</span>
          </div>
        }
        closable={false}
        footer={[
          <Button key="submit" type="primary" loading={loading || refreshing} onClick={submitPassword} className="bg-indigo-600">
            Update Password
          </Button>,
        ]}
      >
        {body ?? (
          <>
            <p className="text-sm text-slate-600 mb-4">You must change your password before continuing.</p>
            <Form form={pwForm} layout="vertical">
              <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true }]}>
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Form.Item name="newPassword" label="New Password" rules={[{ required: true }, { min: 8 }]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={['newPassword']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                      return Promise.reject(new Error('Passwords do not match'))
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </Form>
          </>
        )}
      </AdminModal>
    )
  }

  if (step === 'terms') {
    return (
      <AdminModal
        open
        title={
          <div className="flex items-center gap-2 font-bold text-base">
            <FileText size={20} className="text-indigo-600" />
            <span>Terms & Conditions</span>
          </div>
        }
        closable={false}
        footer={[
          <Button key="accept" type="primary" loading={loading || refreshing} disabled={!termsAccepted} onClick={submitTerms}>
            Accept & Continue
          </Button>,
        ]}
      >
        {body ?? (
          <>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{TERMS_TEXT}</p>
            <Checkbox className="mt-4" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}>
              I have read and accept the Terms & Conditions
            </Checkbox>
          </>
        )}
      </AdminModal>
    )
  }

  return (
    <AdminModal
      open
      title={
        <div className="flex items-center gap-2 font-bold text-base">
          <HelpCircle size={20} className="text-indigo-600" />
          <span>Set Security Questions</span>
        </div>
      }
      closable={false}
      footer={[
        <Button key="save" type="primary" loading={loading || refreshing} onClick={submitSecurity}>
          Save & Continue
        </Button>,
      ]}
    >
      {body ?? (
        <>
          <p className="text-sm text-slate-600 mb-4">Choose two security questions for account recovery.</p>
          <Form form={sqForm} layout="vertical">
            <Form.Item name="q1Index" label="Question 1" rules={[{ required: true }]}>
              <Select options={questions.map(q => ({ value: q.index, label: q.text }))} placeholder="Select question" />
            </Form.Item>
            <Form.Item name="q1Answer" label="Answer 1" rules={[{ required: true }]}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="q2Index" label="Question 2" rules={[{ required: true }]}>
              <Select options={questions.map(q => ({ value: q.index, label: q.text }))} placeholder="Select question" />
            </Form.Item>
            <Form.Item name="q2Answer" label="Answer 2" rules={[{ required: true }]}>
              <Input autoComplete="off" />
            </Form.Item>
          </Form>
        </>
      )}
    </AdminModal>
  )
}
