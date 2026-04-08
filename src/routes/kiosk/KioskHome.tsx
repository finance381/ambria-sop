import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { localized } from '../../lib/i18n'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { SopCategory } from '../../lib/types'

const categoryColors = ['bg-orange-50', 'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-pink-50', 'bg-amber-50']
const categoryAccents = ['text-orange-600', 'text-blue-600', 'text-green-600', 'text-purple-600', 'text-pink-600', 'text-amber-600']

export default function KioskHome() {
  const navigate = useNavigate()
  const { station, staff, toggleLang, lang, isOnline, setStation, setStaff } = useStore()
  const [categories, setCategories] = useState<SopCategory[]>([])

  useEffect(() => {
    if (!station) { navigate('/'); return }
    supabase
      .from('sop_categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories(data || []))
  }, [station])

  function handleLogout() {
    setStation(null)
    setStaff(null)
    navigate('/')
  }

  if (!station) return null

  const greeting = lang === 'hi'
    ? `${staff?.name_hi || staff?.name || ''}, क्या बनाना है?`
    : `${staff?.name || ''}, what's cooking?`

  const folders = [
    { id: 'today', name_hi: 'आज का मेन्यू', name_en: "Today's Menu", icon: '🍲' },
    ...categories.map(c => ({
      id: c.id,
      name_hi: c.name_hi || c.name,
      name_en: c.name,
      icon: c.icon || '📖',
    })),
  ]

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="bg-white px-6 pt-6 pb-5" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">
              {localized(station.department?.name_hi, station.department?.name || station.name)}
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">{greeting}</h1>
          </div>
          <div className="flex gap-2">
            {!isOnline && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">ऑफलाइन</span>
            )}
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

      {/* Category Grid */}
      <div className="p-5">
        <p className="text-sm text-gray-400 font-medium mb-3 px-1">
          {lang === 'hi' ? 'कैटेगरी चुनें' : 'Choose a category'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {folders.map((f, idx) => (
            <button
              key={f.id}
              onClick={() => navigate(`/kiosk/category/${f.id}`)}
              className="card card-hover p-5 flex flex-col items-center gap-3"
            >
              <div className={`w-16 h-16 rounded-2xl ${categoryColors[idx % categoryColors.length]}
                flex items-center justify-center text-3xl`}>
                {f.icon}
              </div>
              <span className={`text-sm font-semibold text-center leading-tight
                ${categoryAccents[idx % categoryAccents.length]}`}>
                {lang === 'hi' ? f.name_hi : f.name_en}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}