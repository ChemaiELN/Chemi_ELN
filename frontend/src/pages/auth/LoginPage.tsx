import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import loginBg from '../../assets/loginPage.jpg'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, FlaskConical } from 'lucide-react'
import { useAppDispatch } from '../../store'
import { setAuth } from '../../store/authSlice'
import { setPrivileges } from '../../store/privilegesSlice'
import { authApi } from '../../api/auth'
import { ApiError } from '../../api/client'
import type { PrivilegeKey } from '../../store/privilegesSlice'

const DEFAULT_GRANTS: Record<string, PrivilegeKey[]> = {
  QA: ['admin.settings','admin.excel_templates','admin.notifications',
       'admin.role_privileges','users.manage','departments.manage','master_data.manage'],
  HOD: ['master_data.manage'],
}

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [showPw, setShowPw] = useState(false)

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
      dispatch(setAuth({ user: me, accessToken: tokens.access_token }))
      const isQA = me.role_code === 'QA'
      dispatch(setPrivileges({ keys: DEFAULT_GRANTS[me.role_code] ?? [], isQA }))
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.detail : 'An unexpected error occurred.')
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">

      {/* Background image */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${loginBg})` }} />
      <div className="absolute inset-0 bg-black/30" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="glass-strong rounded-3xl p-8">

          {/* Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/40 mb-4">
              <FlaskConical size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Laurus ELN</h1>
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
              <label className="block text-sm font-medium text-slate-700">
                Username or Email
              </label>
              <input
                {...register('username')}
                type="text"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                placeholder="Enter your username"
                className="glass-input w-full px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 disabled:opacity-50"
              />
              {errors.username && (
                <p className="text-xs text-red-500">{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  placeholder="Enter your password"
                  className="glass-input w-full px-4 py-3 pr-11 rounded-xl text-sm text-slate-800 placeholder-slate-400 disabled:opacity-50"
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

          {/* Footer note */}
          <p className="text-center text-slate-400 text-xs mt-6">
            &copy; {new Date().getFullYear()} Laurus Labs — Confidential
          </p>
        </div>
      </div>
    </div>
  )
}
