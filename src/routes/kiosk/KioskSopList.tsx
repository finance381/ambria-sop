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
    if (!station) { navigate('/kiosk'); return }
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
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/kiosk/home')} className="text-ambria-300 text-2xl leading-none">←</button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{title}</h1>
          <p className="text-ambria-300 text-xs">{filtered.length} SOPs</p>
        </div>
      </header>

      <div className="px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('common.search') + '...'}
          className="w-full bg-white border border-warm-200 rounded-xl px-4 py-3 text-base outline-none focus:border-ambria-400"
        />
      </div>

      <main className="flex-1 px-4 pb-6">
        {loading ? (
          <p className="text-center text-warm-300 py-12">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-warm-300 py-12">{t('kiosk.no_sops')}</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(sop => (
              <button
                key={sop.id}
                onClick={() => navigate(`/kiosk/sop/${sop.id}`)}
                className="w-full bg-white rounded-xl p-4 border border-warm-200 flex items-center gap-4 text-left active:bg-warm-100"
                >
                <div className="w-10 h-10 bg-ambria-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">📄</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {localized(sop.title_hi, sop.title)}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-warm-300">
                    {sop.pax_count && <span>{sop.pax_count} {t('kiosk.pax')}</span>}
                    {sop.prep_time_minutes && <span>{sop.prep_time_minutes} {t('kiosk.min')}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}