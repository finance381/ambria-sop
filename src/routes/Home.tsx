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
    accent: 'bg-kiosk',
    accentLight: 'bg-kiosk-light',
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
    accent: 'bg-comply',
    accentLight: 'bg-comply-light',
    roles: ['admin', 'head_chef', 'section_head', 'staff'],
  },
  {
    id: 'admin',
    icon: '📊',
    title_hi: 'एडमिन डैशबोर्ड',
    title_en: 'Admin Dashboard',
    desc_hi: 'कम्प्लायंस रिव्यू और प्रबंधन',
    desc_en: 'Review compliance & manage',
    route: '/admin/dashboard',
    accent: 'bg-admin',
    accentLight: 'bg-admin-light',
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

    setStaff(data as StaffMember)
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

  const roleLabel: Record<string, Record<string, string>> = {
    admin: { hi: 'एडमिन', en: 'Admin' },
    head_chef: { hi: 'हेड शेफ', en: 'Head Chef' },
    section_head: { hi: 'सेक्शन हेड', en: 'Section Head' },
    staff: { hi: 'स्टाफ', en: 'Staff' },
  }

  // --- LOGGED IN ---
  if (staff) {
    const visibleCards = allCards.filter(c => c.roles.includes(staff.role))
    const greeting = lang === 'hi'
      ? `नमस्ते, ${staff.name_hi || staff.name}`
      : `Hey, ${staff.name}`

    return (
      <div className="min-h-screen bg-warm-50">
        {/* Header */}
        <div className="bg-white px-6 pt-8 pb-6" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {roleLabel[staff.role]?.[lang] || staff.role}
                {staff.department && (
                  <span> • {lang === 'hi' ? staff.department.name_hi : staff.department.name}</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={toggleLang}
                className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500 font-medium">
                {lang === 'hi' ? 'EN' : 'हिं'}
              </button>
              <button onClick={handleLogout}
                className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm">
                🔒
              </button>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="p-5 max-w-lg mx-auto space-y-4">
          {visibleCards.map(card => (
            <button
              key={card.id}
              onClick={() => navigate(card.route)}
              className="w-full card card-hover p-5 flex items-center gap-4 text-left"
            >
              <div className={`w-14 h-14 rounded-2xl ${card.accentLight} flex items-center justify-center text-2xl flex-shrink-0`}>
                {card.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-[17px]">
                  {lang === 'hi' ? card.title_hi : card.title_en}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {lang === 'hi' ? card.desc_hi : card.desc_en}
                </p>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </button>
          ))}
        </div>

        <p className="text-center text-gray-300 text-xs py-6">Ambria Group</p>
      </div>
    )
  }

  // --- PIN SCREEN ---
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <button onClick={toggleLang}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500 font-medium">
        {lang === 'hi' ? 'EN' : 'हिं'}
      </button>

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AMBRIA</h1>
        <p className="text-gray-400 mt-1 text-sm">{t('app.tagline')}</p>
      </div>

      <p className="text-gray-500 mb-5">
        {lang === 'hi' ? 'अपना PIN दर्ज करें' : 'Enter your PIN'}
      </p>

      {/* PIN dots */}
      <div className="flex gap-4 mb-5">
        {[0, 1, 2, 3].map(i => (
          <div key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200
              ${pin.length > i ? 'bg-ambria-600 scale-110' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {error && <p className="text-red-500 mb-4 text-sm font-medium">{error}</p>}
      {loading && <p className="text-gray-400 mb-4 text-sm">{t('common.loading')}</p>}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-72 mt-2">
        {['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key => (
          <button key={key} onClick={() => handlePinKey(key)}
            className={`h-16 rounded-2xl text-xl font-medium transition-colors
              ${key === 'clear' || key === 'back'
                ? 'bg-warm-100 text-gray-400 text-base'
                : 'bg-warm-50 text-gray-700 active:bg-ambria-100'}`}
          >
            {key === 'clear' ? '✕' : key === 'back' ? '←' : key}
          </button>
        ))}
      </div>
    </div>
  )
}