import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { t } from '../lib/i18n'
import type { StaffMember } from '../lib/types'

const allCards = [
  {
    id: 'kiosk',
    icon: '📖',
    title_hi: 'SOP किचन स्टेशन',
    title_en: 'Kitchen Station SOPs',
    desc_hi: 'रेसिपी और प्रक्रियाएं देखें',
    desc_en: 'View recipes & procedures',
    route: '/kiosk/home',
    color: 'bg-ambria-100 border-ambria-300',
    roles: ['admin', 'head_chef', 'section_head', 'staff'],
  },
  {
    id: 'comply',
    icon: '📷',
    title_hi: 'कम्प्लायंस',
    title_en: 'Compliance',
    desc_hi: 'फ़ोटो प्रूफ जमा करें',
    desc_en: 'Submit photo proof',
    route: '/comply',
    color: 'bg-green-50 border-green-300',
    roles: ['admin', 'head_chef', 'section_head', 'staff'],
  },
  {
    id: 'admin',
    icon: '📊',
    title_hi: 'एडमिन डैशबोर्ड',
    title_en: 'Admin Dashboard',
    desc_hi: 'कम्प्लायंस रिव्यू और प्रबंधन',
    desc_en: 'Review compliance & manage',
    route: '/admin',
    color: 'bg-purple-50 border-purple-300',
    roles: ['admin', 'head_chef'],
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { lang, toggleLang, setStaff, setStation, staff } = useStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function verifyPin(pinValue: string) {
    setLoading(true)
    setError('')

    const { data } = await supabase
      .from('staff')
      .select('*, department:departments(*)')
      .eq('pin', pinValue)
      .eq('is_active', true)
      .single()

    if (!data) {
      setError(t('kiosk.wrong_pin'))
      setPin('')
      setLoading(false)
      return
    }

    // Set staff in store
    setStaff(data as StaffMember)

    // Also set station context if one exists for their department
    const { data: stationData } = await supabase
      .from('stations')
      .select('*, department:departments(*)')
      .eq('department_id', data.department_id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (stationData) setStation(stationData)
    setLoading(false)
  }

  function handlePinKey(digit: string) {
    if (digit === 'clear') { setPin(''); setError(''); return }
    if (digit === 'back') { setPin(p => p.slice(0, -1)); return }
    const next = pin + digit
    if (next.length > 4) return
    setPin(next)
    setError('')
    if (next.length === 4) verifyPin(next)
  }

  function handleLogout() {
    setStaff(null)
    setStation(null)
    setPin('')
  }

  // --- LOGGED IN: SHOW CARDS ---
  if (staff) {
    const visibleCards = allCards.filter(c => c.roles.includes(staff.role))

    return (
      <div className="min-h-screen bg-warm-50 flex flex-col">
        <header className="bg-ambria-900 text-white px-6 py-5 relative">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wide">AMBRIA</h1>
            <p className="text-ambria-300 text-sm mt-1">
              {staff.name_hi || staff.name} • {lang === 'hi'
                ? (staff.role === 'admin' ? 'एडमिन' : staff.role === 'head_chef' ? 'हेड शेफ' : staff.role === 'section_head' ? 'सेक्शन हेड' : 'स्टाफ')
                : staff.role.replace('_', ' ')}
            </p>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={toggleLang}
              className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
              {lang === 'hi' ? 'EN' : 'हिं'}
            </button>
            <button onClick={handleLogout}
              className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
              🔒
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-lg mx-auto w-full">
          <div className="space-y-4">
            {visibleCards.map(card => (
              <button
                key={card.id}
                onClick={() => navigate(card.route)}
                className={`w-full rounded-2xl p-5 border-2 text-left active:scale-[0.98] transition-transform ${card.color}`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{card.icon}</span>
                  <div>
                    <p className="font-bold text-gray-800 text-lg">
                      {lang === 'hi' ? card.title_hi : card.title_en}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {lang === 'hi' ? card.desc_hi : card.desc_en}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>

        <footer className="text-center py-4 text-warm-300 text-xs">
          Ambria Group — Digital SOP System
        </footer>
      </div>
    )
  }

  // --- PIN ENTRY ---
  return (
    <div className="min-h-screen bg-ambria-900 flex flex-col items-center justify-center p-6">
      <button onClick={toggleLang}
        className="absolute top-4 right-4 text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
        {lang === 'hi' ? 'EN' : 'हिं'}
      </button>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white tracking-wide">AMBRIA</h1>
        <p className="text-ambria-300 mt-1">{t('app.tagline')}</p>
      </div>

      <p className="text-ambria-200 mb-4 text-lg">
        {lang === 'hi' ? 'अपना PIN दर्ज करें' : 'Enter your PIN'}
      </p>

      <div className="flex gap-3 mb-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold
              ${pin.length > i ? 'border-white bg-ambria-700 text-white' : 'border-ambria-600 text-ambria-600'}`}>
            {pin.length > i ? '•' : ''}
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 mb-4 font-medium">{error}</p>}
      {loading && <p className="text-ambria-300 mb-4">{t('common.loading')}</p>}

      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key => (
          <button key={key} onClick={() => handlePinKey(key)}
            className={`h-16 rounded-xl text-xl font-semibold transition-colors
              ${key === 'clear' || key === 'back'
                ? 'bg-ambria-800 text-ambria-300 text-base'
                : 'bg-ambria-700 text-white active:bg-ambria-500'}`}>
            {key === 'clear' ? '✕' : key === 'back' ? '←' : key}
          </button>
        ))}
      </div>
    </div>
  )
}