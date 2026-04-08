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
    <div className="min-h-screen bg-ambria-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center mb-1">AMBRIA</h1>
        <p className="text-ambria-300 text-center mb-8">{t('admin.login')}</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('admin.email')} required
            className="w-full bg-ambria-800 text-white rounded-xl px-4 py-3 border border-ambria-600 outline-none focus:border-ambria-400 placeholder:text-ambria-500" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('admin.password')} required
            className="w-full bg-ambria-800 text-white rounded-xl px-4 py-3 border border-ambria-600 outline-none focus:border-ambria-400 placeholder:text-ambria-500" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-ambria-500 text-white rounded-xl py-3 font-bold text-lg active:bg-ambria-600 disabled:opacity-50">
            {loading ? '...' : t('admin.login_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}