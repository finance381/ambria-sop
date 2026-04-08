import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Station, Checklist, Submission } from '../../lib/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { lang, toggleLang } = useStore()

  const [stations, setStations] = useState<Station[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null)
  const [tab, setTab] = useState<'overview' | 'grid' | 'review'>('overview')

  const staff = useStore(s => s.staff)

  useEffect(() => {
    if (!staff || (staff.role !== 'admin' && staff.role !== 'head_chef')) {
      navigate('/', { replace: true })
      return
    }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const [stRes, clRes, subRes] = await Promise.all([
      supabase.from('stations').select('*, department:departments(*)').eq('is_active', true),
      supabase.from('checklists').select('*').eq('is_active', true).order('scheduled_time'),
      supabase.from('submissions').select('*, checklist:checklists(*)')
        .gte('submitted_at', today + 'T00:00:00')
        .order('submitted_at', { ascending: false }),
    ])
    setStations(stRes.data || [])
    setChecklists(clRes.data || [])
    setSubmissions(subRes.data || [])
    setLoading(false)
  }

  async function handleReview(sub: Submission, status: 'approved' | 'flagged') {
    await supabase.from('submissions')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', sub.id)
    setSelectedSub(null)
    loadData()
  }

  function handleLogout() {
    navigate('/')
  }

  const totalExpected = stations.length * checklists.length
  const totalSubmitted = submissions.length
  const totalApproved = submissions.filter(s => s.status === 'approved').length
  const totalPending = submissions.filter(s => s.status === 'pending').length
  const totalFlagged = submissions.filter(s => s.status === 'flagged').length
  const totalMissing = Math.max(0, totalExpected - totalSubmitted)
  const compliancePercent = totalExpected > 0 ? Math.round((totalSubmitted / totalExpected) * 100) : 0

  function getCellStatus(stationId: string, checklistId: string) {
    const sub = submissions.find(s => s.station_id === stationId && s.checklist_id === checklistId)
    if (!sub) return 'missing'
    return sub.status
  }

  function getCellSubmission(stationId: string, checklistId: string) {
    return submissions.find(s => s.station_id === stationId && s.checklist_id === checklistId)
  }

  const statusColors: Record<string, string> = {
    approved: 'bg-green-500',
    pending: 'bg-amber-400',
    flagged: 'bg-red-500',
    missing: 'bg-gray-200',
  }

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center text-gray-400">{t('common.loading')}</div>
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4" style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">{lang === 'hi' ? 'आज का' : "Today's"}</p>
            <h1 className="text-xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/admin/staff')}
              className="w-10 h-10 rounded-full bg-admin-light flex items-center justify-center text-sm">👥</button>
            <button onClick={toggleLang}
              className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500 font-medium">
              {lang === 'hi' ? 'EN' : 'हिं'}
            </button>
            <button onClick={handleLogout}
              className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center text-sm text-gray-500">⏻</button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4">
        {/* Main compliance card */}
        <div className="card p-5 mb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-400 font-medium">{lang === 'hi' ? 'कम्प्लायंस' : 'Compliance'}</p>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full
              ${compliancePercent >= 80 ? 'bg-green-50 text-green-600'
                : compliancePercent >= 50 ? 'bg-amber-50 text-amber-600'
                : 'bg-red-50 text-red-600'}`}>
              {compliancePercent > 0 ? (compliancePercent >= 100 ? '↑' : '~') : '↓'} {lang === 'hi' ? 'आज' : 'Today'}
            </span>
          </div>
          <p className="text-4xl font-bold text-gray-900 mb-3">{compliancePercent}%</p>
          {/* Progress bar */}
          <div className="h-2 bg-warm-100 rounded-full overflow-hidden flex">
            {totalApproved > 0 && (
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(totalApproved / Math.max(totalExpected, 1)) * 100}%` }} />
            )}
            {totalPending > 0 && (
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${(totalPending / Math.max(totalExpected, 1)) * 100}%` }} />
            )}
            {totalFlagged > 0 && (
              <div className="h-full bg-red-500 transition-all" style={{ width: `${(totalFlagged / Math.max(totalExpected, 1)) * 100}%` }} />
            )}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {totalApproved} {lang === 'hi' ? 'स्वीकृत' : 'Approved'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {totalPending} {lang === 'hi' ? 'बाकी' : 'Pending'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {totalFlagged} {lang === 'hi' ? 'चिह्नित' : 'Flagged'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> {totalMissing} {lang === 'hi' ? 'गायब' : 'Missing'}
            </span>
          </div>
        </div>

        {/* Quick stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{lang === 'hi' ? 'स्वीकृत' : 'Approved'}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{totalPending}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{lang === 'hi' ? 'रिव्यू बाकी' : 'To Review'}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{totalMissing}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{lang === 'hi' ? 'गायब' : 'Missing'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-warm-200 px-4 bg-white">
        {(['overview', 'grid', 'review'] as const).map(tabId => {
          const labels = {
            overview: { hi: 'ओवरव्यू', en: 'Overview' },
            grid: { hi: 'ग्रिड', en: 'Grid' },
            review: { hi: 'रिव्यू', en: 'Review' },
          }
          return (
            <button key={tabId} onClick={() => setTab(tabId)}
              className={`px-4 py-3 text-sm font-medium border-b-2 relative transition-colors
                ${tab === tabId ? 'border-admin text-admin' : 'border-transparent text-gray-400'}`}>
              {labels[tabId][lang]}
              {tabId === 'review' && totalPending > 0 && (
                <span className="absolute -top-0 -right-0 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                  {totalPending}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="p-4 space-y-2">
          {stations.map(st => {
            const stSubs = submissions.filter(s => s.station_id === st.id)
            const stExpected = checklists.length
            const stDone = stSubs.length
            const pct = stExpected > 0 ? Math.round((stDone / stExpected) * 100) : 0
            return (
              <div key={st.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900 text-sm">
                    {localized(st.department?.name_hi, st.name)}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                    ${pct >= 100 ? 'bg-green-50 text-green-600' : pct > 0 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                    {stDone}/{stExpected}
                  </span>
                </div>
                <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500
                    ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Grid Tab */}
      {tab === 'grid' && (
        <div className="p-4 overflow-x-auto">
          <div className="card p-4">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 text-gray-400 font-medium text-xs sticky left-0 bg-white">
                    {lang === 'hi' ? 'स्टेशन' : 'Station'}
                  </th>
                  {checklists.map(cl => (
                    <th key={cl.id} className="p-2 text-gray-400 font-medium text-xs text-center whitespace-nowrap">
                      {localized(cl.name_hi, cl.name)}<br />
                      <span className="text-[10px] text-gray-300">{cl.scheduled_time?.slice(0, 5)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stations.map(st => (
                  <tr key={st.id} className="border-t border-warm-100">
                    <td className="p-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white text-xs">
                      {localized(st.department?.name_hi, st.name)}
                    </td>
                    {checklists.map(cl => {
                      const status = getCellStatus(st.id, cl.id)
                      const sub = getCellSubmission(st.id, cl.id)
                      return (
                        <td key={cl.id} className="p-2 text-center">
                          <button
                            onClick={() => sub && setSelectedSub(sub)}
                            className={`w-7 h-7 rounded-lg ${statusColors[status] || 'bg-gray-200'}
                              ${sub ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Tab */}
      {tab === 'review' && (
        <div className="p-4 space-y-3">
          {submissions.filter(s => s.status === 'pending').length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">✨</p>
              <p className="text-gray-400">{lang === 'hi' ? 'सब रिव्यू हो गया' : 'All reviewed'}</p>
            </div>
          ) : submissions.filter(s => s.status === 'pending').map(sub => (
            <div key={sub.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{sub.staff_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {localized(sub.checklist?.name_hi, sub.checklist?.name || '')} •{' '}
                    {new Date(sub.submitted_at).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => setSelectedSub(sub)}
                  className="text-admin text-sm font-medium">{lang === 'hi' ? 'देखें' : 'View'} →</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReview(sub, 'approved')}
                  className="flex-1 bg-green-500 text-white rounded-xl py-2.5 font-medium text-sm active:scale-[0.98]">
                  ✓ {t('admin.approve')}
                </button>
                <button onClick={() => handleReview(sub, 'flagged')}
                  className="flex-1 bg-red-500 text-white rounded-xl py-2.5 font-medium text-sm active:scale-[0.98]">
                  ✕ {t('admin.flag')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setSelectedSub(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900">{selectedSub.staff_name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {localized(selectedSub.checklist?.name_hi, selectedSub.checklist?.name || '')} •{' '}
                  {new Date(selectedSub.submitted_at).toLocaleString('hi-IN')}
                </p>
              </div>
              <button onClick={() => setSelectedSub(null)}
                className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-gray-400">✕</button>
            </div>

            <div className="space-y-3">
              {selectedSub.responses.map((resp, i) => (
                <div key={i} className="bg-warm-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">{lang === 'hi' ? 'आइटम' : 'Item'} {resp.item_index + 1}</p>
                  {resp.value && <p className="text-sm text-gray-700 font-medium">{resp.value}</p>}
                  {resp.photo_path && (
                    <img
                      src={supabase.storage.from('compliance-photos').getPublicUrl(resp.photo_path).data.publicUrl}
                      alt="proof"
                      className="mt-2 rounded-xl w-full max-h-52 object-cover"
                    />
                  )}
                </div>
              ))}
            </div>

            {selectedSub.status === 'pending' && (
              <div className="flex gap-2 mt-5">
                <button onClick={() => handleReview(selectedSub, 'approved')}
                  className="flex-1 bg-green-500 text-white rounded-xl py-3 font-medium active:scale-[0.98]">
                  ✓ {t('admin.approve')}
                </button>
                <button onClick={() => handleReview(selectedSub, 'flagged')}
                  className="flex-1 bg-red-500 text-white rounded-xl py-3 font-medium active:scale-[0.98]">
                  ✕ {t('admin.flag')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}