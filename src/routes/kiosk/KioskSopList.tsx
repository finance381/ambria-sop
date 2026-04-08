import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { localized, t } from '../../lib/i18n'
import type { Sop } from '../../lib/types'

export default function KioskSopList() {
  const { categoryId } = useParams()
  const navigate = useNavigate()
  const { station, lang } = useStore()
  const [sops, setSops] = useState<Sop[]>([])
  const [search, setSearch] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!station) { navigate('/'); return }
    loadSops()
  }, [categoryId, station])

  async function loadSops() {
    if (!station) return
    setLoading(true)

    if (categoryId === 'today') {
      setTitle(t('kiosk.today_menu'))
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('daily_menus')
        .select('*, sop:sops(*)')
        .eq('station_id', station.id)
        .eq('event_date', today)
      setSops((data || []).map((d: any) => d.sop).filter(Boolean))
    } else {
      const { data: cat } = await supabase
        .from('sop_categories')
        .select('*')
        .eq('id', categoryId)
        .single()
      setTitle(cat ? localized(cat.name_hi, cat.name) : '')

      const { data } = await supabase
        .from('sops')
        .select('*')
        .eq('department_id', station.department_id)
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .order('title')
      setSops(data || [])
    }
    setLoading(false)
  }

  const filtered = sops.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.title.toLowerCase().includes(q) || (s.title_hi && s.title_hi.includes(q))
  })

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/kiosk/home')}
            className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">
            ←
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400">{filtered.length} SOPs</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search') + '...'}
            className="w-full bg-warm-50 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ambria-200"
          />
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-center text-gray-400 py-16">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-400">{t('kiosk.no_sops')}</p>
          </div>
        ) : (
          filtered.map(sop => (
            <button
              key={sop.id}
              onClick={() => navigate(`/kiosk/sop/${sop.id}`)}
              className="w-full card card-hover p-4 flex items-center gap-4 text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-kiosk-light flex items-center justify-center text-xl flex-shrink-0">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {localized(sop.title_hi, sop.title)}
                </p>
                {sop.title_hi && lang === 'hi' && sop.title && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{sop.title}</p>
                )}
                <div className="flex gap-3 mt-1.5">
                  {sop.pax_count && (
                    <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {sop.pax_count} {t('kiosk.pax')}
                    </span>
                  )}
                  {sop.prep_time_minutes && (
                    <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full">
                      ⏱ {sop.prep_time_minutes} {t('kiosk.min')}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}