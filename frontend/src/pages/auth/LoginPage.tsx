import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import loginBg from '../../assets/loginPage.jpg'
import logo from '../../assets/logo.svg'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAppDispatch } from '../../store'
import { setAuth } from '../../store/authSlice'
import { setPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { ApiError, apiGet, apiPost } from '../../api/client'
import { isSuperAdmin, resolveGrants } from '../../utils/privileges'
import { queryClient } from '../../queryClient'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

// B-62: forgot-password flow state types
type FpStep = 'idle' | 'questions' | 'reset' | 'done'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPw, setShowPw] = useState(false)
  // B-62: forgot-password state
  const [fpStep, setFpStep] = useState<FpStep>('idle')
  const [fpUsername, setFpUsername] = useState('')
  const [fpQuestions, setFpQuestions] = useState<{ index: number; text: string }[]>([])
  const [fpAnswers, setFpAnswers] = useState<Record<number, string>>({})
  const [fpResetToken, setFpResetToken] = useState('')
  const [fpNewPw, setFpNewPw] = useState('')
  const [fpLoading, setFpLoading] = useState(false)
  const [fpError, setFpError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormValues) => {
    setServerError('')
    try {
      const tokens = await authApi.login(data)
      localStorage.setItem('access_token', tokens.access_token)
      localStorage.setItem('refresh_token', tokens.refresh_token)
      const me = await authApi.me()
      // Belt-and-suspenders alongside the logout-time clear() — guards
      // against any query left in cache from a previous session in this
      // same browser tab (e.g. a session that ended without going through
      // the normal logout action) leaking into this one.
      queryClient.clear()
      dispatch(setAuth({ user: me, accessToken: tokens.access_token }))
      dispatch(setPrivileges({
        keys: resolveGrants(me),
        isQA: isSuperAdmin(me),
        deptPrivileges: me.privileges ?? [],
        isSuperAdmin: me.role_code === 'SUPER_ADMIN',
      }))
      navigate('/', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Background image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-sm scale-105" style={{ backgroundImage: `url(${loginBg})` }} />
      <div className="absolute inset-0 bg-black/30" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8">

          {/* Brand */}
          <div className="flex justify-center mb-8">
            <img src={logo} alt="Laurus ELN" className="w-[200px] h-auto" />
          </div>

          {/* Error */}
          {serverError && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/60 text-red-600 text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-slate-700">
                Username or Email
              </label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 bg-white border border-gray-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all disabled:opacity-50"
              />
              {errors.username && (
                <p className="text-xs text-red-500">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-slate-800 placeholder-slate-400 bg-white border border-gray-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 outline-none transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white
                bg-gradient-to-r from-violet-500 to-purple-600
                hover:from-violet-600 hover:to-purple-700
                disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-violet-500/30
                focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2
                transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Forgot password link */}
          <p className="text-center mt-4">
            <button
              type="button"
              onClick={async () => {
                setFpError('')
                setFpStep('questions')
                try {
                  const res = await apiGet<{ questions: { index: number; text: string }[] }>('/auth/security-questions')
                  setFpQuestions(res.questions.slice(0, 3))
                } catch {
                  setFpError('Could not load security questions.')
                }
              }}
              className="text-xs text-violet-500 hover:text-violet-700 underline underline-offset-2"
            >
              Forgot password?
            </button>
          </p>

          {/* Report login issue to administrator */}
          <p className="text-center mt-2">
            <button
              type="button"
              onClick={() => navigate('/report-login-issue')}
              className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Locked out? Report a login issue to your administrator
            </button>
          </p>

          {/* Footer note */}
          <p className="text-center text-slate-400 text-xs mt-4">
            &copy; {new Date().getFullYear()} Laurus Labs — Confidential
          </p>
        </div>
      </div>

      {/* B-62: Forgot Password Modal */}
      {fpStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
            {fpStep === 'questions' && (
              <>
                <h2 className="text-base font-bold text-slate-800 mb-1">Reset Password</h2>
                <p className="text-xs text-slate-500 mb-4">Enter your username and answer your security questions.</p>
                {fpError && <p className="text-xs text-red-500 mb-3">{fpError}</p>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Username or Email</label>
                    <input
                      value={fpUsername}
                      onChange={e => setFpUsername(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400"
                      placeholder="Your username"
                    />
                  </div>
                  {fpQuestions.map(q => (
                    <div key={q.index}>
                      <label className="text-xs font-medium text-slate-600">{q.text}</label>
                      <input
                        value={fpAnswers[q.index] ?? ''}
                        onChange={e => setFpAnswers(prev => ({ ...prev, [q.index]: e.target.value }))}
                        className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400"
                        placeholder="Your answer"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => { setFpStep('idle'); setFpError('') }}
                    className="flex-1 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >Cancel</button>
                  <button
                    disabled={fpLoading}
                    onClick={async () => {
                      setFpLoading(true); setFpError('')
                      try {
                        const res = await apiPost<{ resetToken: string }>('/auth/forgot-password/verify', {
                          username: fpUsername,
                          answers: fpQuestions.map(q => ({ questionIndex: q.index, answer: fpAnswers[q.index] ?? '' })),
                        })
                        setFpResetToken(res.resetToken)
                        setFpStep('reset')
                      } catch (e) {
                        setFpError(e instanceof ApiError ? e.detail : 'Verification failed.')
                      } finally { setFpLoading(false) }
                    }}
                    className="flex-1 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                  >{fpLoading ? 'Verifying…' : 'Verify'}</button>
                </div>
              </>
            )}
            {fpStep === 'reset' && (
              <>
                <h2 className="text-base font-bold text-slate-800 mb-1">Set New Password</h2>
                <p className="text-xs text-slate-500 mb-4">Enter your new password (at least 8 characters).</p>
                {fpError && <p className="text-xs text-red-500 mb-3">{fpError}</p>}
                <input
                  type="password"
                  value={fpNewPw}
                  onChange={e => setFpNewPw(e.target.value)}
                  placeholder="New password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-violet-400"
                />
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setFpStep('idle')} className="flex-1 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button
                    disabled={fpLoading || fpNewPw.length < 8}
                    onClick={async () => {
                      setFpLoading(true); setFpError('')
                      try {
                        await apiPost('/auth/forgot-password/reset', { resetToken: fpResetToken, newPassword: fpNewPw })
                        setFpStep('done')
                      } catch (e) {
                        setFpError(e instanceof ApiError ? e.detail : 'Reset failed.')
                      } finally { setFpLoading(false) }
                    }}
                    className="flex-1 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                  >{fpLoading ? 'Saving…' : 'Save Password'}</button>
                </div>
              </>
            )}
            {fpStep === 'done' && (
              <>
                <h2 className="text-base font-bold text-slate-800 mb-2">Password Reset</h2>
                <p className="text-sm text-slate-600 mb-4">Your password has been changed. You can now sign in with your new password.</p>
                <button
                  onClick={() => { setFpStep('idle'); setFpNewPw(''); setFpAnswers({}) }}
                  className="w-full py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                >Back to Sign In</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
