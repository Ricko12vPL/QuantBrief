import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Zap, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, loading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (password !== confirmPassword) {
      setLocalError(t('passwords_dont_match', 'Passwords do not match'))
      return
    }

    try {
      await register(email, password, displayName)
      navigate('/dashboard')
    } catch {
      // error is set in store
    }
  }

  const displayError = localError || error

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">QuantBrief</span>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-8 backdrop-blur">
          <h2 className="mb-6 text-center text-xl font-semibold text-white">{t('register')}</h2>

          {displayError && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">{t('display_name')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">{t('email')}</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anything@example"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">{t('password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none focus:border-orange-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-zinc-400">{t('confirm_password')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 outline-none focus:border-orange-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF7000] px-4 py-2.5 font-semibold text-white transition hover:bg-[#FF7000]/80 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('registering')}
                </>
              ) : (
                t('register')
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {t('have_account')}{' '}
            <Link to="/login" className="text-orange-400 hover:text-orange-300">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
