import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store/useStore'
import { t, localized } from '../../lib/i18n'
import type { Station, Checklist, Submission } from '../../lib/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const { setIsAdmin, lang, toggleLang } = useStore()

  const [stations, setStations] = useState<Station[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null)
  const [tab, setTab] = useState<'grid' | 'review'>('grid')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/admin'); return }
      loadData()
    })
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

  async function handleLogout() {
    await supabase.auth.signOut()
    setIsAdmin(false)
    navigate('/admin')
  }

  const totalExpected = stations.length * checklists.length
  const totalSubmitted = submissions.length
  const totalApproved = submissions.filter(s => s.status === 'approved').length
  const totalPending = submissions.filter(s => s.status === 'pending').length
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
    pending: 'bg-yellow-400',
    flagged: 'bg-red-500',
    missing: 'bg-gray-200',
  }

  if (loading) {
    return <div className="min-h-screen bg-warm-50 flex items-center justify-center text-warm-300">{t('common.loading')}</div>
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="bg-ambria-900 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">{t('admin.dashboard')}</h1>
        <div className="flex items-center gap-3">
          <button onClick={toggleLang} className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-2 py-1">
            {lang === 'hi' ? 'EN' : 'हिं'}
          </button>
          <button onClick={() => navigate('/admin/staff')} className="text-ambria-300 text-sm border border-ambria-600 rounded-lg px-2 py-1">👥</button>
          <button onClick={handleLogout} className="text-ambria-400 text-sm">{t('admin.logout')}</button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 p-4">
        <div className="bg-white rounded-xl p-3 text-center border border-warm-200">
          <p className="text-2xl font-bold text-ambria-700">{compliancePercent}%</p>
          <p className="text-xs text-warm-300">कम्प्लायंस</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-warm-200">
          <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
          <p className="text-xs text-warm-300">{t('comply.approved')}</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-warm-200">
          <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
          <p className="text-xs text-warm-300">{t('comply.pending')}</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-warm-200">
          <p className="text-2xl font-bold text-red-600">{totalMissing}</p>
          <p className="text-xs text-warm-300">गायब</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-warm-200 px-4">
        <button onClick={() => setTab('grid')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'grid' ? 'border-ambria-600 text-ambria-700' : 'border-transparent text-warm-300'}`}>
          कम्प्लायंस ग्रिड
        </button>
        <button onClick={() => setTab('review')}
          className={`px-4 py-2 text-sm font-medium border-b-2 relative ${tab === 'review' ? 'border-ambria-600 text-ambria-700' : 'border-transparent text-warm-300'}`}>
          रिव्यू
          {totalPending > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{totalPending}</span>
          )}
        </button>
      </div>

      {/* Grid Tab */}
      {tab === 'grid' && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 text-warm-300 font-medium text-xs sticky left-0 bg-warm-50">स्टेशन</th>
                {checklists.map(cl => (
                  <th key={cl.id} className="p-2 text-warm-300 font-medium text-xs text-center whitespace-nowrap">
                    {localized(cl.name_hi, cl.name)}<br />
                    <span className="text-[10px]">{cl.scheduled_time?.slice(0, 5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map(st => (
                <tr key={st.id} className="border-t border-warm-100">
                  <td className="p-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-warm-50 text-xs">
                    {localized(st.department?.name_hi, st.name)}
                  </td>
                  {checklists.map(cl => {
                    const status = getCellStatus(st.id, cl.id)
                    const sub = getCellSubmission(st.id, cl.id)
                    return (
                      <td key={cl.id} className="p-2 text-center">
                        <button
                          onClick={() => sub && setSelectedSub(sub)}
                          className={`w-8 h-8 rounded-lg ${statusColors[status] || 'bg-gray-200'} ${sub ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-4 mt-4 text-xs text-warm-300">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> स्वीकृत</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> बाकी</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> चिह्नित</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> गायब</span>
          </div>
        </div>
      )}

      {/* Review Tab */}
      {tab === 'review' && (
        <div className="p-4 space-y-3">
          {submissions.filter(s => s.status === 'pending').length === 0 ? (
            <p className="text-center text-warm-300 py-12">कोई बाकी रिव्यू नहीं</p>
          ) : submissions.filter(s => s.status === 'pending').map(sub => (
            <div key={sub.id} className="bg-white rounded-xl p-4 border border-warm-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-800">{sub.staff_name}</p>
                  <p className="text-xs text-warm-300">
                    {localized(sub.checklist?.name_hi, sub.checklist?.name || '')} •{' '}
                    {new Date(sub.submitted_at).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button onClick={() => setSelectedSub(sub)} className="text-ambria-600 text-sm font-medium">देखें →</button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleReview(sub, 'approved')}
                  className="flex-1 bg-green-500 text-white rounded-lg py-2 font-medium text-sm">
                  ✓ {t('admin.approve')}
                </button>
                <button onClick={() => handleReview(sub, 'flagged')}
                  className="flex-1 bg-red-500 text-white rounded-lg py-2 font-medium text-sm">
                  ✕ {t('admin.flag')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedSub(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{selectedSub.staff_name}</h3>
              <button onClick={() => setSelectedSub(null)} className="text-warm-300 text-xl">✕</button>
            </div>
            <p className="text-sm text-warm-300 mb-4">
              {localized(selectedSub.checklist?.name_hi, selectedSub.checklist?.name || '')} •{' '}
              {new Date(selectedSub.submitted_at).toLocaleString('hi-IN')}
            </p>
            {selectedSub.responses.map((resp, i) => (
              <div key={i} className="mb-3 p-3 bg-warm-50 rounded-lg">
                <p className="text-xs text-warm-300 mb-1">आइटम {resp.item_index + 1}</p>
                {resp.value && <p className="text-sm">{resp.value}</p>}
                {resp.photo_path && (
                  <img
                    src={supabase.storage.from('compliance-photos').getPublicUrl(resp.photo_path).data.publicUrl}
                    alt="proof"
                    className="mt-2 rounded-lg w-full max-h-48 object-cover"
                  />
                )}
              </div>
            ))}
            {selectedSub.status === 'pending' && (
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleReview(selectedSub, 'approved')}
                  className="flex-1 bg-green-500 text-white rounded-lg py-2 font-medium">✓ {t('admin.approve')}</button>
                <button onClick={() => handleReview(selectedSub, 'flagged')}
                  className="flex-1 bg-red-500 text-white rounded-lg py-2 font-medium">✕ {t('admin.flag')}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}