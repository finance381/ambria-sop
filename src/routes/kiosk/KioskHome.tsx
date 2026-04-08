import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { localized } from '../../lib/i18n'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { SopCategory } from '../../lib/types'

export default function KioskHome() {
  const navigate = useNavigate()
  const { station, staff, toggleLang, lang, isOnline, setStation, setStaff } = useStore()
  const [categories, setCategories] = useState<SopCategory[]>([])

  useEffect(() => {
    if (!station) { navigate('/kiosk'); return }
    supabase
      .from('sop_categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories(data || []))
  }, [station])

  function handleLogout() {
    setStation(null)
    setStaff(null)
    navigate('/kiosk')
  }

  if (!station) return null

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
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-wide">AMBRIA</h1>
          <p className="text-ambria-300 text-sm">
            {localized(station.department?.name_hi, station.department?.name || station.name)}
            {staff && <span className="ml-2">• {staff.name_hi || staff.name}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="bg-amber-500 text-xs px-2 py-1 rounded-full font-medium">ऑफलाइन</span>
          )}
          <button onClick={toggleLang} className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
            {lang === 'hi' ? 'EN' : 'हिं'}
          </button>
          <button onClick={handleLogout} className="text-ambria-400 text-sm">🔒</button>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => navigate(`/kiosk/category/${f.id}`)}
              className="bg-white rounded-2xl p-6 shadow-sm border border-warm-200
                flex flex-col items-center gap-3 active:scale-95 transition-transform hover:shadow-md"
            >
              <span className="text-4xl">{f.icon}</span>
              <span className="text-base font-semibold text-gray-800 text-center leading-tight">
                {lang === 'hi' ? f.name_hi : f.name_en}
              </span>
            </button>
          ))}
        </div>
      </main>

      <footer className="text-center py-3 text-warm-300 text-xs">
        Ambria Kitchen SOP System
      </footer>
    </div>
  )
}