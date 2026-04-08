import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { t } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import type { Station, StaffMember } from '../../lib/types'

export default function KioskPinLock() {
  const navigate = useNavigate()
  const { setStation, setStaff, station, toggleLang, lang } = useStore()

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [step, setStep] = useState<'pin' | 'name'>('pin')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('stations')
      .select('*, department:departments(*)')
      .eq('is_active', true)
      .then(({ data }) => {
        setStations(data || [])
        setLoading(false)
      })
  }, [])

  function handlePinKey(digit: string) {
    if (digit === 'clear') { setPin(''); setError(''); return }
    if (digit === 'back') { setPin(p => p.slice(0, -1)); return }
    const next = pin + digit
    if (next.length > 4) return
    setPin(next)
    setError('')

    if (next.length === 4) {
      const matched = stations.find(s => s.tablet_pin === next)
      if (matched) {
        setStation(matched)
        supabase
          .from('staff')
          .select('*')
          .eq('department_id', matched.department_id)
          .eq('is_active', true)
          .then(({ data }) => {
            setStaffList(data || [])
            setStep('name')
          })
      } else {
        setError(t('kiosk.wrong_pin'))
        setPin('')
      }
    }
  }

  function handleNameSelect(member: StaffMember) {
    setStaff(member)
    navigate('/kiosk/home')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ambria-900">
        <p className="text-white text-xl">{t('common.loading')}</p>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen bg-ambria-900 flex flex-col items-center p-6">
        <button
          onClick={() => { setStep('pin'); setPin(''); setStation(null) }}
          className="self-start text-ambria-300 mb-4"
        >
          ← {t('kiosk.back')}
        </button>
        <h2 className="text-2xl font-bold text-white mb-2">
          {station?.department?.name_hi || station?.name}
        </h2>
        <p className="text-ambria-300 mb-8">{t('kiosk.select_name')}</p>
        <div className="w-full max-w-md space-y-3">
          {staffList.map(member => (
            <button
              key={member.id}
              onClick={() => handleNameSelect(member)}
              className="w-full bg-ambria-700 text-white rounded-xl p-4 text-left text-lg font-medium active:bg-ambria-500"
            >
              {member.name_hi || member.name}
              {member.role === 'section_head' && (
                <span className="text-ambria-300 text-sm ml-2">• सेक्शन हेड</span>
              )}
            </button>
          ))}
          {staffList.length === 0 && (
            <p className="text-ambria-400 text-center py-8">इस विभाग में कोई स्टाफ नहीं मिला</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ambria-900 flex flex-col items-center justify-center p-6">
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 text-ambria-300 text-sm border border-ambria-600 rounded-lg px-3 py-1"
      >
        {lang === 'hi' ? 'EN' : 'हिं'}
      </button>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white tracking-wide">AMBRIA</h1>
        <p className="text-ambria-300 mt-1">{t('app.tagline')}</p>
      </div>
      <p className="text-ambria-200 mb-4 text-lg">{t('kiosk.enter_pin')}</p>
      <div className="flex gap-3 mb-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold
              ${pin.length > i ? 'border-white bg-ambria-700 text-white' : 'border-ambria-600 text-ambria-600'}`}
          >
            {pin.length > i ? '•' : ''}
          </div>
        ))}
      </div>
      {error && <p className="text-red-400 mb-4 font-medium">{error}</p>}
      <div className="grid grid-cols-3 gap-3 w-64">
        {['1','2','3','4','5','6','7','8','9','clear','0','back'].map(key => (
          <button
            key={key}
            onClick={() => handlePinKey(key)}
            className={`h-16 rounded-xl text-xl font-semibold transition-colors
              ${key === 'clear' || key === 'back'
                ? 'bg-ambria-800 text-ambria-300 text-base'
                : 'bg-ambria-700 text-white active:bg-ambria-500'}`}
          >
            {key === 'clear' ? '✕' : key === 'back' ? '←' : key}
          </button>
        ))}
      </div>
    </div>
  )
}