import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, getSopPdfUrl } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { localized } from '../../lib/i18n'
import type { Sop } from '../../lib/types'

interface TimelineStep {
  label: string
  label_en?: string
  minutes_before: number
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

  useEffect(() => {
    if (!station) { navigate('/'); return }
    if (!sopId) return
    loadSop()
  }, [sopId])

  async function loadSop() {
    const { data } = await supabase.from('sops').select('*').eq('id', sopId).single()
    setSop(data)
    setLoading(false)

    // Find service time from today's events
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

  // Live clock — update every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

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
    if (diffMin <= 0) return lang === 'hi' ? 'अभी करें!' : 'Do now!'
    if (diffMin < 60) return `${diffMin} ${lang === 'hi' ? 'मिनट में' : 'min'}`
    const hrs = Math.floor(diffMin / 60)
    const mins = diffMin % 60
    return `${hrs}${lang === 'hi' ? 'घं' : 'h'} ${mins}${lang === 'hi' ? 'मि' : 'm'}`
  }

  function formatTime(step: TimelineStep): string {
    const t = getStepTime(step)
    if (!t) return ''
    return t.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const statusStyle: Record<string, { bg: string; ring: string; dot: string; text: string }> = {
    done: { bg: 'bg-green-50', ring: 'ring-green-500', dot: 'bg-green-500', text: 'text-green-700' },
    now: { bg: 'bg-red-50', ring: 'ring-red-500', dot: 'bg-red-500', text: 'text-red-700' },
    soon: { bg: 'bg-amber-50', ring: 'ring-amber-400', dot: 'bg-amber-400', text: 'text-amber-700' },
    later: { bg: 'bg-warm-50', ring: 'ring-gray-200', dot: 'bg-gray-300', text: 'text-gray-500' },
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
  const hasTimer = steps.length > 0 && serviceTime

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

      {/* Tabs — only show if timer available */}
      {hasTimer && (
        <div className="flex border-b border-warm-200 px-5 bg-white">
          <button onClick={() => setTab('pdf')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'pdf' ? 'border-kiosk text-kiosk' : 'border-transparent text-gray-400'}`}>
            📄 SOP
          </button>
          <button onClick={() => setTab('timer')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 relative ${tab === 'timer' ? 'border-kiosk text-kiosk' : 'border-transparent text-gray-400'}`}>
            ⏱ {lang === 'hi' ? 'टाइमर' : 'Timer'}
            {steps.some(s => getStepStatus(s) === 'now') && (
              <span className="absolute -top-0.5 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
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
        <div className="flex-1 overflow-y-auto p-5">
          {/* Service time header */}
          <div className="text-center mb-6">
            <p className="text-xs text-gray-400 font-medium">{lang === 'hi' ? 'सर्विस टाइम' : 'Service Time'}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{serviceTime?.slice(0, 5)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              {' '}{lang === 'hi' ? 'अभी' : 'now'}
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-warm-200" />

            <div className="space-y-3">
              {steps.map((step, idx) => {
                const status = getStepStatus(step)
                const style = statusStyle[status]
                return (
                  <div key={idx} className={`${style.bg} rounded-xl p-4 relative flex items-start gap-4
                    ${status === 'now' ? 'ring-2 ' + style.ring : ''}`}>
                    {/* Dot */}
                    <div className={`w-4 h-4 rounded-full ${style.dot} flex-shrink-0 mt-1 relative z-10
                      ${status === 'now' ? 'animate-pulse' : ''}`}>
                      {status === 'done' && <span className="text-white text-[10px] flex items-center justify-center h-full">✓</span>}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {lang === 'hi' ? step.label : (step.label_en || step.label)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(step)}</p>
                    </div>

                    {/* Countdown */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${style.text}`}>
                        {status === 'done' ? '✓' : formatCountdown(step)}
                      </p>
                      {step.minutes_before > 0 && (
                        <p className="text-[10px] text-gray-400">T-{step.minutes_before}m</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}