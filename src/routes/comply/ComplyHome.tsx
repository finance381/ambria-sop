import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import { compressPhoto } from '../../lib/imageCompress'
import type { Checklist, Station, StaffMember } from '../../lib/types'

type Step = 'pin' | 'name' | 'home' | 'checklist' | 'success'

export default function ComplyHome() {
  const navigate = useNavigate()
  const { lang, toggleLang, isOnline } = useStore()
  const globalStaff = useStore(s => s.staff)
  const globalStation = useStore(s => s.station)

  const [step, setStep] = useState<Step>('pin')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [station, setStation] = useState<Station | null>(null)
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [staff, setStaff] = useState<StaffMember | null>(null)

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null)
  const [responses, setResponses] = useState<Record<number, { value?: string; photo?: File }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [todaySubmissions, setTodaySubmissions] = useState<string[]>([])

  useEffect(() => {
    if (globalStaff && globalStation) {
      setStation(globalStation)
      setStaff(globalStaff)
      loadChecklists(globalStaff, globalStation)
      setStep('home')
      return
    }
    supabase.from('stations').select('*, department:departments(*)')
      .eq('is_active', true)
      .then(({ data }) => setStations(data || []))
  }, [])

  function verifyPin() {
    const matched = stations.find(s => s.tablet_pin === pin)
    if (matched) {
      setStation(matched)
      setPinError('')
      supabase.from('staff').select('*')
        .eq('department_id', matched.department_id)
        .eq('is_active', true)
        .then(({ data }) => { setStaffList(data || []); setStep('name') })
    } else {
      setPinError(t('kiosk.wrong_pin'))
      setPin('')
    }
  }

  function selectStaff(member: StaffMember) {
    setStaff(member)
    if (station) loadChecklists(member, station)
    setStep('home')
  }

  async function loadChecklists(member: StaffMember, st: Station) {
    const { data } = await supabase
      .from('checklists').select('*')
      .eq('department_id', st.department_id)
      .eq('is_active', true)
      .order('scheduled_time')
    setChecklists(data || [])

    const today = new Date().toISOString().split('T')[0]
    const { data: subs } = await supabase
      .from('submissions').select('checklist_id')
      .eq('station_id', st.id)
      .eq('staff_name', member.name)
      .gte('submitted_at', today + 'T00:00:00')
    setTodaySubmissions((subs || []).map((s: any) => s.checklist_id))
  }

  function updateResponse(idx: number, field: 'value' | 'photo', val: string | File) {
    setResponses(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: val } }))
  }

  async function submitChecklist() {
    if (!activeChecklist || !station || !staff) return
    setSubmitting(true)
    try {
      const built: { item_index: number; value: string; photo_path?: string }[] = []
      for (const [idxStr, resp] of Object.entries(responses)) {
        const idx = parseInt(idxStr)
        let photo_path: string | undefined
        if (resp.photo && isOnline) {
          const compressed = await compressPhoto(resp.photo)
          const path = `${station.id}/${Date.now()}-${idx}.jpg`
          const { error } = await supabase.storage.from('compliance-photos').upload(path, compressed)
          if (!error) photo_path = path
        }
        built.push({ item_index: idx, value: resp.value || 'Done', photo_path })
      }
      await supabase.from('submissions').insert({
        checklist_id: activeChecklist.id,
        station_id: station.id,
        staff_name: staff.name,
        status: 'pending',
        responses: built,
      })
      setStep('success')
      setTodaySubmissions(prev => [...prev, activeChecklist.id])
    } catch { alert(t('common.error')) }
    finally { setSubmitting(false) }
  }

  const completedCount = activeChecklist
    ? activeChecklist.items.filter((item, idx) => {
        if (item.requires_photo) return responses[idx]?.photo
        return responses[idx]?.value
      }).length
    : 0

  // --- PIN ---
  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <button onClick={() => navigate('/')}
          className="absolute top-5 left-5 w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">←</button>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">AMBRIA</h1>
        <p className="text-gray-400 mb-8 text-sm">{t('comply.title')}</p>
        <input type="tel" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
          onKeyDown={e => e.key === 'Enter' && verifyPin()}
          placeholder="Station PIN"
          className="bg-warm-50 text-center text-2xl tracking-[0.5em] rounded-xl px-6 py-4 w-48 outline-none focus:ring-2 focus:ring-ambria-200
            placeholder:text-gray-300 placeholder:text-base placeholder:tracking-normal"
          autoFocus />
        {pinError && <p className="text-red-500 mt-3 text-sm">{pinError}</p>}
        <button onClick={verifyPin} className="mt-4 bg-ambria-600 text-white rounded-xl px-8 py-3 font-medium">→</button>
      </div>
    )
  }

  // --- NAME ---
  if (step === 'name') {
    return (
      <div className="min-h-screen bg-warm-50 p-5">
        <button onClick={() => { setStep('pin'); setPin('') }}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-gray-500 mb-4" style={{ boxShadow: 'var(--shadow-card)' }}>←</button>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{station?.department?.name_hi || station?.name}</h2>
        <p className="text-gray-400 mb-6 text-sm">{t('kiosk.select_name')}</p>
        <div className="space-y-2">
          {staffList.map(m => (
            <button key={m.id} onClick={() => selectStaff(m)}
              className="w-full card card-hover p-4 text-left font-medium text-gray-900">
              {m.name_hi || m.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // --- SUCCESS ---
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-comply-light flex items-center justify-center mb-5">
          <span className="text-4xl">✅</span>
        </div>
        <p className="text-xl font-bold text-gray-900 mb-1">{t('comply.success')}</p>
        <p className="text-sm text-gray-400 mb-8">{localized(activeChecklist?.name_hi, activeChecklist?.name || '')}</p>
        <button onClick={() => { setStep('home'); setActiveChecklist(null); setResponses({}) }}
          className="bg-comply text-white rounded-xl px-8 py-3 font-medium">
          {t('kiosk.back')}
        </button>
      </div>
    )
  }

  // --- CHECKLIST FORM ---
  if (step === 'checklist' && activeChecklist) {
    const total = activeChecklist.items.length
    const progress = total > 0 ? (completedCount / total) * 100 : 0
    const allFilled = completedCount === total

    return (
      <div className="min-h-screen bg-warm-50 flex flex-col">
        {/* Header with progress */}
        <div className="bg-white px-5 pt-5 pb-4" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => { setStep('home'); setActiveChecklist(null); setResponses({}) }}
              className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">←</button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{localized(activeChecklist.name_hi, activeChecklist.name)}</h1>
              <p className="text-xs text-gray-400">{completedCount}/{total} {lang === 'hi' ? 'पूरा' : 'complete'}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
            <div className="h-full bg-comply rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 p-4 space-y-3">
          {activeChecklist.items.map((item, idx) => {
            const done = item.requires_photo ? !!responses[idx]?.photo : !!responses[idx]?.value
            return (
              <div key={idx} className={`card p-5 transition-all ${done ? 'ring-2 ring-comply/30' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                    ${done ? 'bg-comply text-white text-sm' : 'bg-warm-100 text-gray-300 text-xs'}`}>
                    {done ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${done ? 'text-gray-400' : 'text-gray-900'}`}>
                      {localized(item.label_hi, item.label)}
                    </p>

                    {item.requires_photo && (
                      <label className="block mt-3">
                        <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
                          ${responses[idx]?.photo ? 'border-comply bg-comply-light' : 'border-gray-200 hover:border-gray-300'}`}>
                          {responses[idx]?.photo
                            ? <span className="text-comply font-medium">✓ {lang === 'hi' ? 'फ़ोटो ली गई' : 'Photo taken'}</span>
                            : <span className="text-gray-400">📷 {t('comply.take_photo')}</span>}
                        </div>
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) updateResponse(idx, 'photo', f) }} />
                      </label>
                    )}

                    {item.type === 'temp' && (
                      <div className="mt-3 flex items-center gap-2">
                        <input type="number" step="0.1" placeholder="°C"
                          className="flex-1 bg-warm-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ambria-200"
                          onChange={e => updateResponse(idx, 'value', e.target.value)} />
                        <span className="text-gray-400 text-sm">°C</span>
                      </div>
                    )}

                    {item.type === 'check' && !item.requires_photo && (
                      <button onClick={() => updateResponse(idx, 'value', 'Done')}
                        className={`mt-3 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
                          ${responses[idx]?.value === 'Done'
                            ? 'bg-comply text-white'
                            : 'bg-warm-100 text-gray-500 hover:bg-warm-200'}`}>
                        {responses[idx]?.value === 'Done' ? '✓ हो गया' : 'हो गया चिह्नित करें'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Submit bar */}
        <div className="p-4 bg-white" style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.06)' }}>
          <button onClick={submitChecklist} disabled={submitting || !allFilled}
            className={`w-full py-4 rounded-2xl text-lg font-bold transition-all
              ${allFilled && !submitting
                ? 'bg-comply text-white active:scale-[0.98]'
                : 'bg-warm-100 text-gray-300 cursor-not-allowed'}`}>
            {submitting ? t('comply.submitting') : t('comply.submit')}
          </button>
        </div>
      </div>
    )
  }

  // --- HOME: CHECKLIST LIST ---
  return (
    <div className="min-h-screen bg-warm-50">
      <div className="bg-white px-5 pt-6 pb-5" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{station?.department?.name_hi}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">
              {lang === 'hi' ? `${staff?.name_hi || staff?.name}, आज की चेकलिस्ट` : `${staff?.name}'s checklists`}
            </h1>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleLang}
              className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500 font-medium">
              {lang === 'hi' ? 'EN' : 'हिं'}
            </button>
            <button onClick={() => navigate('/')}
              className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm">🔒</button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {checklists.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✨</p>
            <p className="text-gray-400">{t('comply.no_pending')}</p>
          </div>
        ) : checklists.map(cl => {
          const done = todaySubmissions.includes(cl.id)
          return (
            <button key={cl.id}
              onClick={() => { if (!done) { setActiveChecklist(cl); setResponses({}); setStep('checklist') } }}
              disabled={done}
              className={`w-full card p-4 text-left transition-all ${done ? 'opacity-60' : 'card-hover'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl
                  ${done ? 'bg-comply-light' : 'bg-warm-100'}`}>
                  {done ? '✅' : cl.type === 'temp_log' ? '🌡️' : cl.type === 'closing' ? '🔒' : '☀️'}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold ${done ? 'text-gray-400' : 'text-gray-900'}`}>
                    {localized(cl.name_hi, cl.name)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cl.scheduled_time?.slice(0, 5)} • {cl.items.length} {lang === 'hi' ? 'आइटम' : 'items'}
                  </p>
                </div>
                {done
                  ? <span className="text-xs bg-comply-light text-comply font-medium px-3 py-1 rounded-full">{t('comply.submitted')}</span>
                  : <span className="text-gray-300 text-xl">›</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}