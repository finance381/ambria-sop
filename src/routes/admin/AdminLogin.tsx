import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t } from '../../lib/i18n'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { setIsAdmin } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setIsAdmin(true); navigate('/admin/dashboard') }
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    setIsAdmin(true)
    navigate('/admin/dashboard')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-1">AMBRIA</h1>
        <p className="text-gray-400 text-center mb-8">{t('admin.login')}</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('admin.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('admin.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-admin text-white rounded-2xl py-3.5 font-bold text-base active:scale-[0.98] disabled:opacity-50">
            {loading ? '...' : t('admin.login_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}