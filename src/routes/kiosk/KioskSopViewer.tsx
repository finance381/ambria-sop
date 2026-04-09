import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getSopPdfUrl } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { localized } from '../../lib/i18n'
import type { Sop } from '../../lib/types'

interface TimelineStep {
  label: string
  label_en?: string
  minutes_before: number
  duration_minutes?: number
  details?: string
  details_en?: string
  ingredients?: string
  ingredients_en?: string
}

interface TimerState {
  running: boolean
  elapsed: number // seconds elapsed
  duration: number // total seconds
  startedAt: number | null
}

export default function KioskSopViewer() {
  const { sopId } = useParams()
  const navigate = useNavigate()
  const { station, lang } = useStore()
  const [sop, setSop] = useState<Sop | null>(null)
  const [loading, setLoading] = useState(true)
  const [serviceTime, setServiceTime] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())
  const [tab, setTab] = useState<'pdf' | 'timer'>('pdf')
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  // Per-step timers
  const [timers, setTimers] = useState<Record<number, TimerState>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!station) { navigate('/'); return }
    if (!sopId) return
    loadSop()
  }, [sopId])

  async function loadSop() {
    const { data } = await supabase.from('sops').select('*').eq('id', sopId).single()
    setSop(data)
    setLoading(false)

    if (data) {
      const today = new Date().toISOString().split('T')[0]
      const { data: events } = await supabase
        .from('events')
        .select('id, service_time')
        .eq('event_date', today)
        .eq('status', 'confirmed')

      if (events && events.length > 0) {
        const { data: links } = await supabase
          .from('event_sops')
          .select('event_id')
          .eq('sop_id', data.id)
          .in('event_id', events.map((e: any) => e.id))

        if (links && links.length > 0) {
          const ev = events.find((e: any) => e.id === links[0].event_id)
          if (ev) setServiceTime(ev.service_time)
        }
      }
    }
  }

  // Master clock — ticks every second
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setNow(new Date())
      setTimers(prev => {
        const next = { ...prev }
        let changed = false
        for (const [key, timer] of Object.entries(next)) {
          if (timer.running && timer.startedAt) {
            const newElapsed = Math.floor((Date.now() - timer.startedAt) / 1000)
            if (newElapsed !== timer.elapsed) {
              next[parseInt(key)] = { ...timer, elapsed: newElapsed }
              changed = true
            }
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  function startTimer(idx: number, durationMin: number) {
    setTimers(prev => ({
      ...prev,
      [idx]: {
        running: true,
        elapsed: 0,
        duration: durationMin * 60,
        startedAt: Date.now(),
      },
    }))
  }

  function stopTimer(idx: number) {
    setTimers(prev => ({
      ...prev,
      [idx]: { ...prev[idx], running: false },
    }))
  }

  function resetTimer(idx: number) {
    setTimers(prev => {
      const next = { ...prev }
      delete next[idx]
      return next
    })
  }

  function formatTimer(seconds: number): string {
    const abs = Math.abs(seconds)
    const m = Math.floor(abs / 60)
    const s = abs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function getStepTime(step: TimelineStep): Date | null {
    if (!serviceTime) return null
    const [h, m] = serviceTime.split(':').map(Number)
    const target = new Date()
    target.setHours(h, m, 0, 0)
    target.setMinutes(target.getMinutes() - step.minutes_before)
    return target
  }

  function getStepStatus(step: TimelineStep): 'done' | 'now' | 'soon' | 'later' {
    const stepTime = getStepTime(step)
    if (!stepTime) return 'later'
    const diffMin = (stepTime.getTime() - now.getTime()) / 60000
    if (diffMin < -5) return 'done'
    if (diffMin < 15) return 'now'
    if (diffMin < 45) return 'soon'
    return 'later'
  }

  function formatCountdown(step: TimelineStep): string {
    const stepTime = getStepTime(step)
    if (!stepTime) return ''
    const diffMin = Math.round((stepTime.getTime() - now.getTime()) / 60000)
    if (diffMin <= 0) return lang === 'hi' ? 'अभी!' : 'Now!'
    if (diffMin < 60) return `${diffMin}m`
    const hrs = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return `${hrs}h ${mins}m`
  }

  function formatTime(step: TimelineStep): string {
    const t = getStepTime(step)
    if (!t) return ''
    return t.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const statusBg: Record<string, string> = {
    done: 'bg-green-50',
    now: 'bg-red-50',
    soon: 'bg-amber-50',
    later: 'bg-white',
  }

  const statusDot: Record<string, string> = {
    done: 'bg-green-500',
    now: 'bg-red-500',
    soon: 'bg-amber-400',
    later: 'bg-gray-300',
  }

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center"><p className="text-gray-400">लोड हो रहा है...</p></div>
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center p-6">
        <p className="text-4xl mb-3">🤷</p>
        <p className="text-gray-400 mb-4">SOP नहीं मिला</p>
        <button onClick={() => navigate(-1)} className="text-ambria-600 font-medium">← वापस</button>
      </div>
    )
  }

  const pdfUrl = getSopPdfUrl(sop.pdf_path)
  const steps: TimelineStep[] = (sop as any).timeline_steps || []
  const hasTimer = steps.length > 0

  const activeTimerCount = Object.values(timers).filter(t => t.running).length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-gray-500">←</button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">{localized(sop.title_hi, sop.title)}</h1>
          <div className="flex gap-2 mt-0.5">
            {sop.pax_count && <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full">{sop.pax_count} Pax</span>}
            {serviceTime && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">⏰ {serviceTime.slice(0, 5)}</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      {hasTimer && (
        <div className="flex border-b border-warm-200 px-5 bg-white">
          <button onClick={() => setTab('pdf')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'pdf' ? 'border-kiosk text-kiosk' : 'border-transparent text-gray-400'}`}>
            📄 SOP
          </button>
          <button onClick={() => setTab('timer')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 relative ${tab === 'timer' ? 'border-kiosk text-kiosk' : 'border-transparent text-gray-400'}`}>
            ⏱ {lang === 'hi' ? 'स्टेप्स + टाइमर' : 'Steps + Timer'}
            {activeTimerCount > 0 && (
              <span className="absolute -top-0.5 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                {activeTimerCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* PDF Tab */}
      {(tab === 'pdf' || !hasTimer) && (
        <div className="flex-1 relative">
          {sop.pdf_path
            ? <iframe src={pdfUrl} className="w-full h-full absolute inset-0 border-0" title={sop.title} />
            : <div className="flex items-center justify-center h-full text-gray-400">PDF उपलब्ध नहीं है</div>}
        </div>
      )}

      {/* Timer Tab */}
      {tab === 'timer' && hasTimer && (
        <div className="flex-1 overflow-y-auto">
          {/* Service time header */}
          {serviceTime && (
            <div className="text-center py-4 bg-warm-50 border-b border-warm-200">
              <p className="text-xs text-gray-400">{lang === 'hi' ? 'सर्विस टाइम' : 'Service Time'}</p>
              <p className="text-2xl font-bold text-gray-900">{serviceTime.slice(0, 5)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
            </div>
          )}

          {/* Steps */}
          <div className="p-4 space-y-3">
            {steps.map((step, idx) => {
              const status = getStepStatus(step)
              const timer = timers[idx]
              const isExpanded = expandedStep === idx
              const remaining = timer ? timer.duration - timer.elapsed : 0
              const isOvertime = timer ? timer.elapsed > timer.duration : false
              const overtimeSeconds = timer ? Math.max(0, timer.elapsed - timer.duration) : 0

              return (
                <div key={idx}
                  className={`rounded-2xl overflow-hidden transition-all ${statusBg[status]}
                    ${timer?.running ? (isOvertime ? 'ring-2 ring-red-500' : 'ring-2 ring-green-500') : ''}
                    shadow-[var(--shadow-card)]`}>

                  {/* Step header — always visible */}
                  <div className="p-4 cursor-pointer" onClick={() => setExpandedStep(isExpanded ? null : idx)}>
                    <div className="flex items-start gap-3">
                      {/* Step number + status dot */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${timer?.running
                            ? (isOvertime ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white')
                            : timer && !timer.running && timer.elapsed > 0
                              ? 'bg-green-500 text-white'
                              : `${statusDot[status]} ${status === 'done' || status === 'now' ? 'text-white' : 'text-gray-500'}`
                          }`}>
                          {timer && !timer.running && timer.elapsed > 0 ? '✓' : idx + 1}
                        </div>
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">
                          {lang === 'hi' ? step.label : (step.label_en || step.label)}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {serviceTime && (
                            <span className="text-xs text-gray-400">
                              📍 {formatTime(step)}
                            </span>
                          )}
                          {step.duration_minutes && step.duration_minutes > 0 && (
                            <span className="text-xs bg-warm-200 text-gray-600 px-2 py-0.5 rounded-full">
                              ⏱ {step.duration_minutes} {lang === 'hi' ? 'मिनट' : 'min'}
                            </span>
                          )}
                          {serviceTime && (
                            <span className={`text-xs font-medium
                              ${status === 'now' ? 'text-red-600' : status === 'soon' ? 'text-amber-600' : 'text-gray-400'}`}>
                              {formatCountdown(step)}
                            </span>
                          )}
                        </div>

                        {/* Ingredients preview (always visible) */}
                        {step.ingredients && (
                          <p className="text-xs text-gray-500 mt-2 bg-warm-100 rounded-lg px-3 py-1.5">
                            🧂 {lang === 'hi' ? step.ingredients : (step.ingredients_en || step.ingredients)}
                          </p>
                        )}
                      </div>

                      {/* Timer display + expand arrow */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {timer?.running && (
                          <div className={`text-right ${isOvertime ? 'text-red-600' : 'text-green-600'}`}>
                            <p className="text-2xl font-mono font-bold">
                              {isOvertime ? '+' : ''}{formatTimer(isOvertime ? overtimeSeconds : remaining)}
                            </p>
                            <p className="text-[10px]">
                              {isOvertime
                                ? (lang === 'hi' ? 'ओवरटाइम!' : 'OVERTIME!')
                                : (lang === 'hi' ? 'बाकी' : 'left')}
                            </p>
                          </div>
                        )}
                        {timer && !timer.running && timer.elapsed > 0 && (
                          <div className="text-right">
                            <p className={`text-lg font-mono font-bold ${timer.elapsed > timer.duration ? 'text-red-500' : 'text-green-600'}`}>
                              {formatTimer(timer.elapsed)}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {timer.elapsed > timer.duration
                                ? `+${formatTimer(timer.elapsed - timer.duration)} ${lang === 'hi' ? 'ओवर' : 'over'}`
                                : (lang === 'hi' ? 'पूरा' : 'done')}
                            </p>
                          </div>
                        )}
                        <span className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-warm-200 pt-3">
                      {/* Full instructions */}
                      {step.details && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 font-medium mb-1">
                            {lang === 'hi' ? 'निर्देश' : 'Instructions'}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {lang === 'hi' ? step.details : (step.details_en || step.details)}
                          </p>
                        </div>
                      )}

                      {/* Timer controls */}
                      {step.duration_minutes && step.duration_minutes > 0 && (
                        <div className="flex gap-2 mt-3">
                          {!timer || (!timer.running && timer.elapsed === 0) ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); startTimer(idx, step.duration_minutes!) }}
                              className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98]">
                              ▶ {lang === 'hi' ? 'टाइमर शुरू' : 'Start Timer'} ({step.duration_minutes}m)
                            </button>
                          ) : timer.running ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); stopTimer(idx) }}
                              className={`flex-1 ${isOvertime ? 'bg-red-500' : 'bg-amber-500'} text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98]`}>
                              ⏹ {lang === 'hi' ? 'पूरा हुआ' : 'Done'}
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); startTimer(idx, step.duration_minutes!) }}
                                className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold text-sm active:scale-[0.98]">
                                ▶ {lang === 'hi' ? 'फिर से' : 'Restart'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); resetTimer(idx) }}
                                className="bg-warm-200 text-gray-500 rounded-xl px-4 py-3 text-sm active:scale-[0.98]">
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Active timers floating summary */}
          {activeTimerCount > 0 && (
            <div className="sticky bottom-0 bg-white border-t border-warm-200 p-3">
              <div className="flex gap-2 overflow-x-auto">
                {Object.entries(timers).filter(([, t]) => t.running).map(([idxStr, timer]) => {
                  const idx = parseInt(idxStr)
                  const step = steps[idx]
                  const isOver = timer.elapsed > timer.duration
                  const remaining = timer.duration - timer.elapsed
                  return (
                    <div key={idx}
                      className={`flex-shrink-0 rounded-xl px-3 py-2 ${isOver ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                      onClick={() => { setExpandedStep(idx); window.scrollTo({ top: idx * 200, behavior: 'smooth' }) }}>
                      <p className="text-xs font-medium truncate max-w-[120px]">
                        {lang === 'hi' ? step?.label : step?.label_en}
                      </p>
                      <p className="text-lg font-mono font-bold">
                        {isOver ? '+' : ''}{formatTimer(isOver ? timer.elapsed - timer.duration : remaining)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}