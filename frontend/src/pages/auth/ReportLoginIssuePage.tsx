import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import loginBg from '../../assets/loginPage.jpg'
import logo from '../../assets/logo.svg'
import { ApiError } from '../../api/client'
import { loginIssuePublicApi } from '../../api/loginIssues'

const ISSUE_OPTIONS = [
  { value: 'UNLOCK', label: 'Unlock User Account' },
  { value: 'PASSWORD_RESET', label: 'Password Reset' },
] as const

export default function ReportLoginIssuePage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [issueType, setIssueType] = useState<'UNLOCK' | 'PASSWORD_RESET' | ''>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const onSubmit = async () => {
    setError('')
    if (!username.trim() || !issueType) {
      setError('Username and issue type are required.')
      return
    }
    setSubmitting(true)
    try {
      await loginIssuePublicApi.submit({ username: username.trim(), issue_type: issueType, description: description.trim() || undefined })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm scale-105" style={{ backgroundImage: `url(${loginBg})` }} />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex justify-center mb-6">
            <img src={logo} alt="Laurus ELN" className="w-[180px] h-auto" />
          </div>

          {done ? (
            <>
              <h2 className="text-base font-bold text-slate-800 mb-2 text-center">Request Submitted</h2>
              <p className="text-sm text-slate-600 text-center mb-6">An administrator will review your request shortly.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                Back to Login
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-bold text-slate-800 mb-1 text-center">Report Login Issue to Administrator</h2>
              <p className="text-xs text-slate-500 text-center mb-5">
                Use this if you're locked out or need your password reset by an administrator.
              </p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/60 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your username"
                    className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Issue Type</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as 'UNLOCK' | 'PASSWORD_RESET' | '')}
                    className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400 bg-white"
                  >
                    <option value="">Select an issue…</option>
                    {ISSUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Any extra details for the administrator"
                    className="mt-1 w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => navigate('/login')}
                  className="flex-1 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Back to Login
                </button>
                <button
                  disabled={submitting}
                  onClick={onSubmit}
                  className="flex-1 py-2.5 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
