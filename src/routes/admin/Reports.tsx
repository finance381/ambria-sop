import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Station, Checklist } from '../../lib/types'
import AdminLayout from './AdminLayout'

interface DayStat {
  date: string
  submitted: number
  approved: number
  flagged: number
  expected: number
  percent: number
}

interface StationStat {
  station: Station
  submitted: number
  expected: number
  percent: number
}

interface StaffStat {
  name: string
  submitted: number
  approved: number
  flagged: number
}

type Range = 'today' | 'week' | 'month' | 'custom'

export default function Reports() {
  const navigate = useNavigate()
  const { lang } = useStore()
  const staff = useStore(s => s.staff)

  const [range, setRange] = useState<Range>('week')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [stations, setStations] = useState<Station[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [dayStats, setDayStats] = useState<DayStat[]>([])
  const [stationStats, setStationStats] = useState<StationStat[]>([])
  const [staffStats, setStaffStats] = useState<StaffStat[]>([])
  const [missedLog, setMissedLog] = useState<{ station: string; checklist: string; date: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'stations' | 'staff' | 'missed'>('overview')

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [range, customFrom, customTo])

  function getDateRange(): { from: string; to: string } {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]

    if (range === 'today') return { from: fmt(today), to: fmt(today) }
    if (range === 'week') {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from: fmt(from), to: fmt(today) }
    }
    if (range === 'month') {
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return { from: fmt(from), to: fmt(today) }
    }
    return { from: customFrom || fmt(today), to: customTo || fmt(today) }
  }

  async function loadData() {
    setLoading(true)
    const { from, to } = getDateRange()

    const [stRes, clRes, subRes] = await Promise.all([
      supabase.from('stations').select('*, department:departments(*)').eq('is_active', true),
      supabase.from('checklists').select('*').eq('is_active', true),
      supabase.from('submissions').select('*')
        .gte('submitted_at', from + 'T00:00:00')
        .lte('submitted_at', to + 'T23:59:59'),
    ])

    const sts = stRes.data || []
    const cls = clRes.data || []
    const subs = subRes.data || []

    setStations(sts)
    setChecklists(cls)

    // Day stats
    const dayMap = new Map<string, { submitted: number; approved: number; flagged: number }>()
    const fromDate = new Date(from)
    const toDate = new Date(to)
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      dayMap.set(d.toISOString().split('T')[0], { submitted: 0, approved: 0, flagged: 0 })
    }

    for (const sub of subs) {
      const day = sub.submitted_at.split('T')[0]
      const entry = dayMap.get(day)
      if (entry) {
        entry.submitted++
        if (sub.status === 'approved') entry.approved++
        if (sub.status === 'flagged') entry.flagged++
      }
    }

    const expectedPerDay = sts.length * cls.length
    const days: DayStat[] = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      ...v,
      expected: expectedPerDay,
      percent: expectedPerDay > 0 ? Math.round((v.submitted / expectedPerDay) * 100) : 0,
    }))
    setDayStats(days)

    // Station stats
    const stStats: StationStat[] = sts.map(st => {
      const stSubs = subs.filter(s => s.station_id === st.id)
      const totalDays = dayMap.size
      const expected = totalDays * cls.length
      return {
        station: st,
        submitted: stSubs.length,
        expected,
        percent: expected > 0 ? Math.round((stSubs.length / expected) * 100) : 0,
      }
    }).sort((a, b) => b.percent - a.percent)
    setStationStats(stStats)

    // Staff stats
    const staffMap = new Map<string, { submitted: number; approved: number; flagged: number }>()
    for (const sub of subs) {
      const existing = staffMap.get(sub.staff_name) || { submitted: 0, approved: 0, flagged: 0 }
      existing.submitted++
      if (sub.status === 'approved') existing.approved++
      if (sub.status === 'flagged') existing.flagged++
      staffMap.set(sub.staff_name, existing)
    }
    setStaffStats(Array.from(staffMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.submitted - a.submitted))

    // Missed log
    const missed: { station: string; checklist: string; date: string }[] = []
    for (const [date] of dayMap) {
      for (const st of sts) {
        for (const cl of cls) {
          if (cl.department_id !== st.department_id) continue
          const found = subs.some(s =>
            s.station_id === st.id &&
            s.checklist_id === cl.id &&
            s.submitted_at.startsWith(date)
          )
          if (!found) {
            missed.push({
              station: localized(st.department?.name_hi, st.name),
              checklist: localized(cl.name_hi, cl.name),
              date,
            })
          }
        }
      }
    }
    setMissedLog(missed.slice(0, 50))

    setLoading(false)
  }

  // Totals
  const totalSubmitted = dayStats.reduce((s, d) => s + d.submitted, 0)
  const totalExpected = dayStats.reduce((s, d) => s + d.expected, 0)
  const totalApproved = dayStats.reduce((s, d) => s + d.approved, 0)
  const totalFlagged = dayStats.reduce((s, d) => s + d.flagged, 0)
  const overallPercent = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0
  const maxBarValue = Math.max(...dayStats.map(d => d.expected), 1)

  const rangeLabels: Record<Range, Record<string, string>> = {
    today: { hi: 'आज', en: 'Today' },
    week: { hi: 'इस हफ्ते', en: 'This Week' },
    month: { hi: 'इस महीने', en: 'This Month' },
    custom: { hi: 'कस्टम', en: 'Custom' },
  }

  if (loading) {
    return <AdminLayout><div className="min-h-screen flex items-center justify-center text-gray-400">{t('common.loading')}</div></AdminLayout>
  }

  return (
    <AdminLayout>
    <div className="bg-warm-50 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-lg font-bold text-gray-900">{lang === 'hi' ? 'रिपोर्ट्स' : 'Reports'}</h1>
        <p className="text-xs text-gray-400">
          {lang === 'hi' ? 'कम्प्लायंस ट्रैकिंग और विश्लेषण' : 'Compliance tracking & analysis'}
        </p>
      </div>

      {/* Range picker */}
      <div className="px-5 pb-3 flex gap-2 flex-wrap">
        {(['today', 'week', 'month', 'custom'] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`text-sm px-3 py-1.5 rounded-xl font-medium transition-colors
              ${range === r ? 'bg-admin text-white' : 'bg-white text-gray-500 shadow-[var(--shadow-card)]'}`}>
            {rangeLabels[r][lang]}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="px-5 pb-3 flex gap-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="flex-1 bg-white rounded-xl px-3 py-2 text-sm shadow-[var(--shadow-card)] outline-none" />
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="flex-1 bg-white rounded-xl px-3 py-2 text-sm shadow-[var(--shadow-card)] outline-none" />
        </div>
      )}

      {/* Summary cards */}
      <div className="px-5 pb-3">
        <div className="card p-5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">{lang === 'hi' ? 'कुल कम्प्लायंस' : 'Overall Compliance'}</p>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full
              ${overallPercent >= 80 ? 'bg-green-50 text-green-600'
                : overallPercent >= 50 ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-600'}`}>
              {rangeLabels[range][lang]}
            </span>
          </div>
          <p className="text-4xl font-bold text-gray-900">{overallPercent}%</p>
          <div className="h-2 bg-warm-100 rounded-full overflow-hidden mt-3 flex">
            {totalApproved > 0 && <div className="h-full bg-green-500" style={{ width: `${(totalApproved / Math.max(totalExpected, 1)) * 100}%` }} />}
            {(totalSubmitted - totalApproved - totalFlagged) > 0 && <div className="h-full bg-amber-400" style={{ width: `${((totalSubmitted - totalApproved - totalFlagged) / Math.max(totalExpected, 1)) * 100}%` }} />}
            {totalFlagged > 0 && <div className="h-full bg-red-500" style={{ width: `${(totalFlagged / Math.max(totalExpected, 1)) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span>✅ {totalApproved}</span>
            <span>⏳ {totalSubmitted - totalApproved - totalFlagged}</span>
            <span>🚩 {totalFlagged}</span>
            <span>❌ {Math.max(0, totalExpected - totalSubmitted)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSubmitted}</p>
            <p className="text-[11px] text-gray-400">{lang === 'hi' ? 'कुल जमा' : 'Submitted'}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalExpected}</p>
            <p className="text-[11px] text-gray-400">{lang === 'hi' ? 'अपेक्षित' : 'Expected'}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{dayStats.length}</p>
            <p className="text-[11px] text-gray-400">{lang === 'hi' ? 'दिन' : 'Days'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-warm-200 px-5 bg-white">
        {(['overview', 'stations', 'staff', 'missed'] as const).map(tid => {
          const labels = {
            overview: { hi: 'ट्रेंड', en: 'Trend' },
            stations: { hi: 'स्टेशन', en: 'Stations' },
            staff: { hi: 'स्टाफ', en: 'Staff' },
            missed: { hi: 'गायब', en: 'Missed' },
          }
          return (
            <button key={tid} onClick={() => setTab(tid)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === tid ? 'border-admin text-admin' : 'border-transparent text-gray-400'}`}>
              {labels[tid][lang]}
              {tid === 'missed' && missedLog.length > 0 && (
                <span className="ml-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{missedLog.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Trend tab — daily bar chart */}
      {tab === 'overview' && (
        <div className="p-5">
          <div className="card p-4">
            <p className="text-xs text-gray-400 font-medium mb-4">
              {lang === 'hi' ? 'दैनिक कम्प्लायंस' : 'Daily Compliance'}
            </p>
            <div className="space-y-2">
              {dayStats.map(day => {
                const shortDate = new Date(day.date + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric' })
                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">{shortDate}</span>
                    <div className="flex-1 h-6 bg-warm-100 rounded-full overflow-hidden flex relative">
                      {day.approved > 0 && (
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${(day.approved / maxBarValue) * 100}%` }} />
                      )}
                      {(day.submitted - day.approved - day.flagged) > 0 && (
                        <div className="h-full bg-amber-400 transition-all" style={{ width: `${((day.submitted - day.approved - day.flagged) / maxBarValue) * 100}%` }} />
                      )}
                      {day.flagged > 0 && (
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${(day.flagged / maxBarValue) * 100}%` }} />
                      )}
                    </div>
                    <span className={`text-xs font-medium w-10 text-right flex-shrink-0
                      ${day.percent >= 80 ? 'text-green-600' : day.percent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {day.percent}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stations tab */}
      {tab === 'stations' && (
        <div className="p-4 space-y-2">
          {stationStats.map((ss, idx) => (
            <div key={ss.station.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-warm-100 text-gray-400 w-6 h-6 rounded-full flex items-center justify-center font-medium">
                    {idx + 1}
                  </span>
                  <p className="font-medium text-gray-900 text-sm">
                    {localized(ss.station.department?.name_hi, ss.station.name)}
                  </p>
                </div>
                <span className={`text-sm font-bold
                  ${ss.percent >= 80 ? 'text-green-600' : ss.percent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                  {ss.percent}%
                </span>
              </div>
              <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all
                  ${ss.percent >= 80 ? 'bg-green-500' : ss.percent >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${ss.percent}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">{ss.submitted}/{ss.expected} {lang === 'hi' ? 'जमा' : 'submitted'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Staff tab */}
      {tab === 'staff' && (
        <div className="p-4">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-200">
                  <th className="text-left p-3 text-gray-400 font-medium text-xs">{lang === 'hi' ? 'नाम' : 'Name'}</th>
                  <th className="text-center p-3 text-gray-400 font-medium text-xs">{lang === 'hi' ? 'जमा' : 'Sub'}</th>
                  <th className="text-center p-3 text-gray-400 font-medium text-xs">✅</th>
                  <th className="text-center p-3 text-gray-400 font-medium text-xs">🚩</th>
                </tr>
              </thead>
              <tbody>
                {staffStats.map(ss => (
                  <tr key={ss.name} className="border-b border-warm-100">
                    <td className="p-3 font-medium text-gray-900">{ss.name}</td>
                    <td className="p-3 text-center text-gray-600">{ss.submitted}</td>
                    <td className="p-3 text-center text-green-600">{ss.approved}</td>
                    <td className="p-3 text-center text-red-500">{ss.flagged}</td>
                  </tr>
                ))}
                {staffStats.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-400">{lang === 'hi' ? 'कोई डेटा नहीं' : 'No data'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Missed tab */}
      {tab === 'missed' && (
        <div className="p-4 space-y-2">
          {missedLog.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-400">{lang === 'hi' ? 'कोई गायब नहीं!' : 'None missed!'}</p>
            </div>
          ) : missedLog.map((m, i) => (
            <div key={i} className="card p-3 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-sm flex-shrink-0">❌</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.station}</p>
                <p className="text-xs text-gray-400">{m.checklist}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {new Date(m.date + 'T00:00:00').toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </AdminLayout>
  )
}