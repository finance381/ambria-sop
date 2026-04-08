import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import { compressPhoto } from '../../lib/imageCompress'
import type { Checklist, Station, StaffMember } from '../../lib/types'

type Step = 'pin' | 'name' | 'home' | 'checklist' | 'success'

export default function ComplyHome() {
  const { lang, toggleLang, isOnline } = useStore()

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
    loadChecklists(member)
    setStep('home')
  }

  async function loadChecklists(member: StaffMember) {
    if (!station) return
    const { data } = await supabase
      .from('checklists')
      .select('*')
      .eq('department_id', station.department_id)
      .eq('is_active', true)
      .order('scheduled_time')
    setChecklists(data || [])

    const today = new Date().toISOString().split('T')[0]
    const { data: subs } = await supabase
      .from('submissions')
      .select('checklist_id')
      .eq('station_id', station.id)
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
      const built = []
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
    } catch {
      alert(t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  // --- PIN ---
  if (step === 'pin') {
    return (
      <div className="min-h-screen bg-ambria-900 flex flex-col items-center justify-center p-6">
        <button onClick={toggleLang} className="absolute top-4 right-4 text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1">
          {lang === 'hi' ? 'EN' : 'हिं'}
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">AMBRIA</h1>
        <p className="text-ambria-300 mb-6 text-sm">{t('comply.title')}</p>
        <input
          type="tel" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError('') }}
          onKeyDown={e => e.key === 'Enter' && verifyPin()}
          placeholder="Station PIN"
          className="bg-ambria-800 text-white text-center text-2xl tracking-[0.5em] rounded-xl px-6 py-4 w-48 border border-ambria-600 outline-none focus:border-ambria-400 placeholder:text-ambria-600 placeholder:text-base placeholder:tracking-normal"
          autoFocus
        />
        {pinError && <p className="text-red-400 mt-2 text-sm">{pinError}</p>}
        <button onClick={verifyPin} className="mt-4 bg-ambria-600 text-white rounded-xl px-8 py-3 font-medium">→</button>
      </div>
    )
  }

  // --- NAME ---
  if (step === 'name') {
    return (
      <div className="min-h-screen bg-ambria-900 p-6">
        <button onClick={() => { setStep('pin'); setPin('') }} className="text-ambria-300 mb-4">← {t('kiosk.back')}</button>
        <h2 className="text-xl font-bold text-white mb-1">{station?.department?.name_hi || station?.name}</h2>
        <p className="text-ambria-300 mb-6">{t('kiosk.select_name')}</p>
        <div className="space-y-2">
          {staffList.map(m => (
            <button key={m.id} onClick={() => selectStaff(m)}
              className="w-full bg-ambria-700 text-white rounded-xl p-4 text-left text-lg font-medium active:bg-ambria-500">
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
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center p-6">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xl font-bold text-gray-800 mb-2">{t('comply.success')}</p>
        <button onClick={() => { setStep('home'); setActiveChecklist(null); setResponses({}) }}
          className="mt-6 bg-ambria-600 text-white rounded-xl px-8 py-3 font-medium">
          {t('kiosk.back')}
        </button>
      </div>
    )
  }

  // --- CHECKLIST FORM ---
  if (step === 'checklist' && activeChecklist) {
    const allFilled = activeChecklist.items.every((item, idx) => {
      if (item.requires_photo) return responses[idx]?.photo
      return responses[idx]?.value
    })

    return (
      <div className="min-h-screen bg-warm-50 flex flex-col">
        <header className="bg-ambria-900 text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setStep('home'); setActiveChecklist(null); setResponses({}) }} className="text-ambria-300 text-2xl">←</button>
          <h1 className="text-lg font-bold">{localized(activeChecklist.name_hi, activeChecklist.name)}</h1>
        </header>

        <main className="flex-1 p-4 space-y-3">
          {activeChecklist.items.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl p-4 border border-warm-200">
              <p className="font-medium text-gray-800 mb-2">{localized(item.label_hi, item.label)}</p>

              {item.requires_photo && (
                <label className="block">
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer
                    ${responses[idx]?.photo ? 'border-green-400 bg-green-50' : 'border-warm-200'}`}>
                    {responses[idx]?.photo
                      ? <span className="text-green-700 font-medium">✓ फ़ोटो ली गई</span>
                      : <span className="text-warm-300">📷 {t('comply.take_photo')}</span>}
                  </div>
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) updateResponse(idx, 'photo', f) }} />
                </label>
              )}

              {item.type === 'temp' && (
                <input type="number" step="0.1" placeholder="°C"
                  className="mt-2 w-full border border-warm-200 rounded-lg px-3 py-2 outline-none focus:border-ambria-400"
                  onChange={e => updateResponse(idx, 'value', e.target.value)} />
              )}

              {item.type === 'check' && !item.requires_photo && (
                <button onClick={() => updateResponse(idx, 'value', 'Done')}
                  className={`mt-2 px-4 py-2 rounded-lg font-medium
                    ${responses[idx]?.value === 'Done' ? 'bg-green-500 text-white' : 'bg-warm-100 text-warm-300'}`}>
                  {responses[idx]?.value === 'Done' ? '✓ हो गया' : 'हो गया चिह्नित करें'}
                </button>
              )}
            </div>
          ))}
        </main>

        <div className="p-4 border-t border-warm-200 bg-white">
          <button onClick={submitChecklist} disabled={submitting || !allFilled}
            className={`w-full py-4 rounded-xl text-lg font-bold
              ${allFilled && !submitting ? 'bg-ambria-600 text-white active:bg-ambria-700' : 'bg-warm-200 text-warm-300 cursor-not-allowed'}`}>
            {submitting ? t('comply.submitting') : t('comply.submit')}
          </button>
        </div>
      </div>
    )
  }

  // --- HOME: CHECKLIST LIST ---
  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <header className="bg-ambria-900 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{t('comply.title')}</h1>
          <p className="text-ambria-300 text-sm">{station?.department?.name_hi} • {staff?.name_hi || staff?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang} className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-2 py-1">
            {lang === 'hi' ? 'EN' : 'हिं'}
          </button>
          <button onClick={() => { setStep('pin'); setPin(''); setStation(null); setStaff(null) }}
            className="text-ambria-400 text-sm">🔒</button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-3">
        {checklists.length === 0 ? (
          <p className="text-center text-warm-300 py-12">{t('comply.no_pending')}</p>
        ) : checklists.map(cl => {
          const done = todaySubmissions.includes(cl.id)
          return (
            <button key={cl.id}
              onClick={() => { if (!done) { setActiveChecklist(cl); setResponses({}); setStep('checklist') } }}
              disabled={done}
              className={`w-full rounded-xl p-4 border text-left
                ${done ? 'bg-green-50 border-green-200' : 'bg-white border-warm-200 active:bg-warm-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{localized(cl.name_hi, cl.name)}</p>
                  <p className="text-xs text-warm-300 mt-0.5">{cl.scheduled_time?.slice(0, 5)} • {cl.items.length} आइटम</p>
                </div>
                {done
                  ? <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium">✓ {t('comply.submitted')}</span>
                  : <span className="text-ambria-600 text-xl">›</span>}
              </div>
            </button>
          )
        })}
      </main>
    </div>
  )
}