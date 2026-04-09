import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Sop, Station } from '../../lib/types'
import AdminLayout from './AdminLayout'

interface EventRecord {
  id: string
  contract_no: string
  event_date: string
  venue_name: string
  location: string
  client_name: string
  event_name: string
  session: string
  service_time: string
  total_plates: number
  complementary_plates: number
  status: string
  source: string
}

interface EventSop {
  id: string
  event_id: string
  sop_id: string
  station_id: string
  sop?: Sop
  station?: Station
}

const LMS_URL = 'https://gyv.inqcrm.in/api/v1/processerp_api/get_event_with_contract'

export default function EventManager() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const staff = useStore(s => s.staff)

  const [events, setEvents] = useState<EventRecord[]>([])
  const [sops, setSops] = useState<Sop[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<Partial<EventRecord> | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // SOP assignment
  const [assigningEvent, setAssigningEvent] = useState<EventRecord | null>(null)
  const [eventSops, setEventSops] = useState<EventSop[]>([])
  const [selectedSopId, setSelectedSopId] = useState('')
  const [selectedStationId, setSelectedStationId] = useState('')

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [dateFilter])

  async function loadData() {
    setLoading(true)
    const [evRes, sopRes, stRes] = await Promise.all([
      supabase.from('events').select('*').eq('event_date', dateFilter).order('service_time'),
      supabase.from('sops').select('*').eq('is_active', true).order('title'),
      supabase.from('stations').select('*, department:departments(*)').eq('is_active', true),
    ])
    setEvents(evRes.data || [])
    setSops(sopRes.data || [])
    setStations(stRes.data || [])
    setLoading(false)
  }

  // --- LMS SYNC ---
  async function syncFromLms() {
    setSyncing(true)
    setError('')
    try {
      const res = await fetch(LMS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loggeduserid: '1',
          depcode: 'VENUE',
          dated: dateFilter,
          vebuid: '',
          contractno: '',
        }),
      })
      const json = await res.json()
      const lmsEvents = json.data || []

      if (lmsEvents.length === 0) {
        setError(lang === 'hi' ? 'LMS में कोई इवेंट नहीं मिला' : 'No events found in LMS')
        setSyncing(false)
        return
      }

      let imported = 0
      for (const ev of lmsEvents) {
        // Skip if already imported
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('contract_no', ev.ContractNo)
          .eq('event_date', ev.ContractDate || dateFilter)

        if (existing && existing.length > 0) continue

        await supabase.from('events').insert({
          contract_no: ev.ContractNo,
          event_date: ev.ContractDate || dateFilter,
          venue_name: ev.VenueName || '',
          location: ev.Location || '',
          client_name: ev.ClientName || '',
          event_name: ev.EventName || '',
          session: ev.Session || '',
          service_time: ev.Session || '19:00',
          total_plates: ev.TotalPlates || 0,
          complementary_plates: ev.ComplementryPlates || 0,
          status: 'confirmed',
          source: 'lms',
          lms_raw: ev,
        })
        imported++
      }

      setError(imported > 0
        ? (lang === 'hi' ? `${imported} इवेंट इम्पोर्ट हुए` : `${imported} events imported`)
        : (lang === 'hi' ? 'सब पहले से इम्पोर्ट हैं' : 'All already imported'))
      loadData()
    } catch (err: any) {
      setError('LMS sync failed: ' + (err.message || 'Network error'))
    }
    setSyncing(false)
  }

  // --- MANUAL ADD/EDIT ---
  function startNew() {
    setEditing({
      contract_no: '', event_date: dateFilter, venue_name: '', location: '',
      client_name: '', event_name: '', session: '', service_time: '19:00',
      total_plates: 100, complementary_plates: 0, status: 'confirmed', source: 'manual',
    })
    setError('')
  }

  function startEdit(ev: EventRecord) {
    setEditing({ ...ev })
    setError('')
  }

  async function saveEvent() {
    if (!editing) return
    if (!editing.client_name?.trim() && !editing.event_name?.trim()) {
      setError(lang === 'hi' ? 'क्लाइंट या इवेंट नाम ज़रूरी' : 'Client or event name required')
      return
    }
    setSaving(true)
    setError('')

    const record = {
      contract_no: editing.contract_no || null,
      event_date: editing.event_date || dateFilter,
      venue_name: editing.venue_name || '',
      location: editing.location || '',
      client_name: editing.client_name || '',
      event_name: editing.event_name || '',
      session: editing.session || '',
      service_time: editing.service_time || '19:00',
      total_plates: editing.total_plates || 0,
      complementary_plates: editing.complementary_plates || 0,
      status: editing.status || 'confirmed',
      source: editing.source || 'manual',
    }

    if ((editing as any).id) {
      await supabase.from('events').update(record).eq('id', (editing as any).id)
    } else {
      await supabase.from('events').insert(record)
    }

    setSaving(false)
    setEditing(null)
    loadData()
  }

  // --- SOP ASSIGNMENT ---
  async function openAssign(ev: EventRecord) {
    setAssigningEvent(ev)
    const { data } = await supabase
      .from('event_sops')
      .select('*, sop:sops(*), station:stations(*, department:departments(*))')
      .eq('event_id', ev.id)
    setEventSops(data || [])
    setSelectedSopId('')
    setSelectedStationId('')
  }

  async function addSopToEvent() {
    if (!assigningEvent || !selectedSopId) return
    await supabase.from('event_sops').insert({
      event_id: assigningEvent.id,
      sop_id: selectedSopId,
      station_id: selectedStationId || null,
    })
    openAssign(assigningEvent)
  }

  async function removeSopFromEvent(esId: string) {
    await supabase.from('event_sops').delete().eq('id', esId)
    if (assigningEvent) openAssign(assigningEvent)
  }

  async function deleteEvent(ev: EventRecord) {
    await supabase.from('event_sops').delete().eq('event_id', ev.id)
    await supabase.from('events').delete().eq('id', ev.id)
    loadData()
  }

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-50 text-green-600',
    tentative: 'bg-amber-50 text-amber-600',
    cancelled: 'bg-red-50 text-red-600',
  }

  if (loading) {
    return <AdminLayout><div className="min-h-screen flex items-center justify-center text-gray-400">{t('common.loading')}</div></AdminLayout>
  }

  const totalPax = events.filter(e => e.status !== 'cancelled').reduce((sum, e) => sum + e.total_plates, 0)

  return (
    <AdminLayout>
    <div className="bg-warm-50 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{lang === 'hi' ? 'इवेंट्स' : 'Events'}</h1>
            <p className="text-xs text-gray-400">
              {events.length} {lang === 'hi' ? 'इवेंट' : 'events'} • {totalPax} {lang === 'hi' ? 'कुल प्लेट' : 'total plates'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={syncFromLms} disabled={syncing}
              className="bg-blue-500 text-white text-sm rounded-xl px-3 py-2 font-medium active:scale-[0.98] disabled:opacity-50">
              {syncing ? '⟳' : '🔄'} LMS
            </button>
            <button onClick={startNew}
              className="bg-admin text-white text-sm rounded-xl px-3 py-2 font-medium active:scale-[0.98]">
              + {lang === 'hi' ? 'नया' : 'New'}
            </button>
          </div>
        </div>

        {/* Date picker */}
        <input type="date" value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-white rounded-xl px-4 py-2.5 text-sm shadow-[var(--shadow-card)] outline-none focus:ring-2 focus:ring-admin/20 w-full" />

        {error && (
          <p className={`mt-2 text-sm font-medium ${error.includes('fail') || error.includes('नहीं') ? 'text-red-500' : 'text-green-600'}`}>
            {error}
          </p>
        )}
      </div>

      {/* Events list */}
      <div className="px-4 pb-6 space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎪</p>
            <p className="text-gray-400">{lang === 'hi' ? 'इस तारीख का कोई इवेंट नहीं' : 'No events for this date'}</p>
          </div>
        ) : events.map(ev => (
          <div key={ev.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">{ev.event_name || ev.client_name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[ev.status] || ''}`}>
                    {ev.status}
                  </span>
                  {ev.source === 'lms' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">LMS</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {ev.client_name} • {ev.venue_name}
                  {ev.location && <span> • {ev.location}</span>}
                </p>
              </div>
            </div>

            {/* Key info */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs bg-warm-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
                🍽 {ev.total_plates} plates
              </span>
              <span className="text-xs bg-warm-100 text-gray-600 px-2.5 py-1 rounded-lg font-medium">
                ⏰ {ev.service_time?.slice(0, 5)}
              </span>
              {ev.contract_no && (
                <span className="text-xs bg-warm-100 text-gray-500 px-2.5 py-1 rounded-lg">
                  #{ev.contract_no}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <button onClick={() => openAssign(ev)}
                className="flex-1 bg-admin-light text-admin text-sm rounded-xl py-2 font-medium active:scale-[0.98]">
                🍲 {lang === 'hi' ? 'मेन्यू असाइन' : 'Assign Menu'}
              </button>
              <button onClick={() => startEdit(ev)}
                className="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center text-sm text-gray-400">✏️</button>
              <button onClick={() => deleteEvent(ev)}
                className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-sm text-red-400">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* Event Editor Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setEditing(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-warm-100 z-10">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-900">
                  {(editing as any).id ? (lang === 'hi' ? 'इवेंट एडिट' : 'Edit Event') : (lang === 'hi' ? 'नया इवेंट' : 'New Event')}
                </h3>
                <button onClick={() => setEditing(null)}
                  className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
            </div>

            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">{lang === 'hi' ? 'इवेंट नाम' : 'Event Name'}</label>
                  <input type="text" value={editing.event_name || ''}
                    onChange={e => setEditing({ ...editing, event_name: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">{lang === 'hi' ? 'क्लाइंट' : 'Client'}</label>
                  <input type="text" value={editing.client_name || ''}
                    onChange={e => setEditing({ ...editing, client_name: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Venue</label>
                  <input type="text" value={editing.venue_name || ''}
                    onChange={e => setEditing({ ...editing, venue_name: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Location</label>
                  <input type="text" value={editing.location || ''}
                    onChange={e => setEditing({ ...editing, location: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">{lang === 'hi' ? 'प्लेट' : 'Plates'}</label>
                  <input type="number" value={editing.total_plates || ''}
                    onChange={e => setEditing({ ...editing, total_plates: parseInt(e.target.value) || 0 })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">{lang === 'hi' ? 'सर्विस' : 'Service'}</label>
                  <input type="time" value={editing.service_time || '19:00'}
                    onChange={e => setEditing({ ...editing, service_time: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1">Status</label>
                  <select value={editing.status || 'confirmed'}
                    onChange={e => setEditing({ ...editing, status: e.target.value })}
                    className="w-full bg-warm-50 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                    <option value="confirmed">Confirmed</option>
                    <option value="tentative">Tentative</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">{lang === 'hi' ? 'तारीख' : 'Date'}</label>
                <input type="date" value={editing.event_date || dateFilter}
                  onChange={e => setEditing({ ...editing, event_date: e.target.value })}
                  className="w-full bg-warm-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-admin/20" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-warm-100 flex gap-2">
              <button onClick={() => setEditing(null)}
                className="flex-1 bg-warm-100 text-gray-500 rounded-xl py-3 font-medium">
                {lang === 'hi' ? 'रद्द' : 'Cancel'}
              </button>
              <button onClick={saveEvent} disabled={saving}
                className="flex-1 bg-admin text-white rounded-xl py-3 font-medium disabled:opacity-50 active:scale-[0.98]">
                {saving ? '...' : (lang === 'hi' ? 'सेव' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOP Assignment Modal */}
      {assigningEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setAssigningEvent(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 pt-5 pb-3 border-b border-warm-100 z-10">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    {lang === 'hi' ? 'मेन्यू असाइन' : 'Assign Menu'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {assigningEvent.event_name} • {assigningEvent.total_plates} plates
                  </p>
                </div>
                <button onClick={() => setAssigningEvent(null)}
                  className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Current assignments */}
              {eventSops.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs text-gray-400 font-medium mb-2">
                    {lang === 'hi' ? 'असाइन किए गए SOP' : 'Assigned SOPs'} ({eventSops.length})
                  </p>
                  {eventSops.map(es => (
                    <div key={es.id} className="flex items-center gap-3 bg-warm-50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {localized(es.sop?.title_hi, es.sop?.title || '')}
                        </p>
                        {es.station && (
                          <p className="text-[11px] text-gray-400 truncate">
                            → {localized((es.station as any).department?.name_hi, es.station?.name || '')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => removeSopFromEvent(es.id)}
                        className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-sm">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add SOP */}
              <div className="space-y-2">
                <p className="text-xs text-gray-400 font-medium">
                  {lang === 'hi' ? 'SOP जोड़ें' : 'Add SOP'}
                </p>
                <select value={selectedSopId} onChange={e => setSelectedSopId(e.target.value)}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                  <option value="">{lang === 'hi' ? 'SOP चुनें...' : 'Select SOP...'}</option>
                  {sops.filter(s => !eventSops.some(es => es.sop_id === s.id)).map(s => (
                    <option key={s.id} value={s.id}>{localized(s.title_hi, s.title)} ({s.pax_count || '?'} pax)</option>
                  ))}
                </select>

                <select value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)}
                  className="w-full bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-admin/20">
                  <option value="">{lang === 'hi' ? 'स्टेशन (वैकल्पिक)' : 'Station (optional)'}</option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id}>{localized((s as any).department?.name_hi, s.name)}</option>
                  ))}
                </select>

                <button onClick={addSopToEvent} disabled={!selectedSopId}
                  className="w-full bg-admin text-white rounded-xl py-3 text-sm font-medium disabled:opacity-30 active:scale-[0.98]">
                  + {lang === 'hi' ? 'जोड़ें' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminLayout>
  )
}